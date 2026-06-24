/* global State, EventBus, CanvasManager, FloorPlanManager, ItemManager, SelectionManager, ExportManager, HistoryManager, Modal, Config, Items, Helpers, StorageUtil, Bounds, ClientCMS, GoogleSheetsSync, TextManager, TextPropertiesPanel, ShortcutRegistry, Icons, FloorPlanComposition */

/**
 * Main Application Controller
 * Coordinates all managers and features
 */
class App {
  constructor() {
    this.state = null;
    this.eventBus = null;
    this.canvasManager = null;
    this.floorPlanManager = null;
    this.itemManager = null;
    this.selectionManager = null;
    this.exportManager = null;
    this.historyManager = null;
    this.textManager = null;
    this.textPropertiesPanel = null;
    this.sidebarCollapsed = false;
    this.mobileUIManager = null;
    this.clientCMS = null;
    this.autosaveInterval = null;
    this.duplicateBatchDepth = 0;
    this.measurementTool = null;
    this.measurementModeActive = false;
    this.measurementInProgress = false;
    this.historySuppressed = false;

    // Cached DOM references for performance
    this.entryZoneCheckDebounce = null;
  }

  /**
   * Initialize application
   */
  async init() {
    // Initializing Garage Layout Planner...

    // Initialize core
    this.state = new State();
    this.eventBus = new EventBus();

    // Initialize canvas manager
    this.canvasManager = new CanvasManager('canvas', this.state, this.eventBus);
    this.canvasManager.init();
    this.measurementTool = this.canvasManager.getMeasurementTool();
    this.textManager = new TextManager(this.state, this.eventBus, this.canvasManager);

    // Ensure viewport starts at default state
    this.canvasManager.resetViewport();
    this.canvasManager.showEmptyState();

    // Initialize managers
    this.floorPlanManager = new FloorPlanManager(this.state, this.eventBus, this.canvasManager);
    this.itemManager = new ItemManager(this.state, this.eventBus, this.canvasManager);
    this.selectionManager = new SelectionManager(this.state, this.eventBus, this.canvasManager);
    this.exportManager = new ExportManager(this.state, this.eventBus, this.canvasManager);
    this.historyManager = new HistoryManager(this.state, this.eventBus);
    this.textPropertiesPanel = new TextPropertiesPanel(this.state, this.eventBus, this.textManager);
    this.textPropertiesPanel.init();

    // Setup event listeners
    this.setupEventListeners();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Initialize UI
    this.initializeUI();

    // Initialize modern mobile UI (NEW - replaces old mobile features)
    if (window.MobileUIManager) {
      // eslint-disable-next-line new-cap
      this.mobileUIManager = new window.MobileUIManager(this);
      this.mobileUIManager.init();
      this.mobileUIManager.setMeasurementModeActive?.(this.isMeasurementModeActive());
    } else {
      // MobileUIManager not present - legacy mobile toolbar disabled intentionally
      console.warn('[App] MobileUIManager not found; mobile UI disabled');
    }

    // Initialize Client CMS if enabled
    if (window.ClientCMS && Config.FEATURES?.enableClientManagement) {
      this.clientCMS = new ClientCMS(this);
      this.clientCMS.init();

      // Initialize Google Sheets sync for ClientCMS
      if (window.GoogleSheetsSync && Config.FEATURES?.enableGoogleSheetsSync) {
        this.clientCMS.initGoogleSheets(this.eventBus);
      }
    }

    // Setup autosave
    this.setupAutosave();

    // Save initial empty state before loading anything
    this.saveHistorySnapshot();

    // Load last autosave if exists
    const autosaveLoaded = this.loadAutosave();

    if (autosaveLoaded) {
      this.canvasManager.hideEmptyState();
      // Record loaded layout as a new history entry
      this.saveHistorySnapshot();
    }

    // Sync project name from state to UI
    this.updateProjectName(this.state.get('metadata.projectName'));

    // Check entry zone violations after load
    this.checkEntryZoneViolations();

    // Application initialized successfully
  }

  /**
   * Save a history snapshot unless suppressed (e.g., during undo/redo rebuilds)
   */
  saveHistorySnapshot() {
    if (!this.historyManager || this.historySuppressed) {
      return;
    }
    this.historyManager.save();
  }

  /**
   * Run provided callback while temporarily suppressing history captures.
   * Ensures Fabric-driven updates during undo/redo do not enqueue new entries.
   * @param {Function} callback
   */
  runWithHistorySuppressed(callback) {
    const historyManager = this.historyManager;
    const prevEnabled = historyManager?.enabled;
    this.historySuppressed = true;
    if (historyManager) {
      historyManager.enabled = false;
    }

    let restored = false;
    const finish = () => {
      if (restored) return;
      restored = true;
      const restore = () => {
        this.historySuppressed = false;
        if (historyManager) {
          historyManager.enabled = prevEnabled ?? true;
        }
      };

      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(restore);
      } else {
        setTimeout(restore, 0);
      }
    };

    let result;
    try {
      result = typeof callback === 'function' ? callback() : undefined;
    } catch (error) {
      finish();
      throw error;
    }

    if (result && typeof result.then === 'function') {
      result.then(finish, finish);
    } else {
      finish();
    }

    return result;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const saveTextHistory = Helpers.debounce(() => this.saveHistorySnapshot(), 150);

    // Canvas events
    this.eventBus.on('canvas:object:modified', (obj) => {
      // Text objects: skip item position updates but still capture history
      if (obj && obj.type === 'i-text') {
        saveTextHistory();
        return;
      }

      // Update item position in state when moved
      // obj.left and obj.top are already center coords due to originX/Y: 'center'
      if (obj && obj.customData && obj.customData.id) {
        this.updateItemPosition(obj.customData.id, obj.left, obj.top, obj.angle || 0);
      }
      this.saveHistorySnapshot();

      // Check entry zone violations (debounced to avoid thrashing during drags)
      this.debouncedCheckEntryZone();
    });

    // Item events
    this.eventBus.on('item:added', () => {
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
    });

    this.eventBus.on('item:removed', (itemId) => {
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
      if (this.measurementTool && typeof this.measurementTool.handleItemRemoved === 'function') {
        this.measurementTool.handleItemRemoved(itemId);
      }
    });

    this.eventBus.on('item:delete:requested', (itemId) => {
      this.itemManager.removeItem(itemId);
    });

    this.eventBus.on('item:duplicate:requested', (payload) => {
      if (payload && typeof payload === 'object') {
        this.itemManager.duplicateItem(payload.itemId, {
          canvasObject: payload.canvasObject,
          centerOverride: payload.center,
        });
      } else {
        this.itemManager.duplicateItem(payload);
      }
      this.checkEntryZoneViolations();
    });

    this.eventBus.on('items:duplicate:batch:start', () => {
      this.duplicateBatchDepth += 1;
      if (this.historyManager) {
        this.historyManager.enabled = false;
      }
    });

    this.eventBus.on('items:duplicate:batch:end', () => {
      if (this.duplicateBatchDepth > 0) {
        this.duplicateBatchDepth -= 1;
      }
      if (this.duplicateBatchDepth === 0 && this.historyManager) {
        this.historyManager.enabled = true;
        this.saveHistorySnapshot();
      }
    });

    this.eventBus.on('item:paste:requested', (itemData) => {
      // Add pasted item with offset (x,y are already center coordinates from copySelected)
      const newItem = this.itemManager.addItem(itemData.itemId, itemData.x + 20, itemData.y + 20);
      if (newItem && newItem.canvasObject) {
        newItem.canvasObject.rotate(itemData.angle);
        this.canvasManager.getCanvas().renderAll();
      }
      this.checkEntryZoneViolations();
    });

    // Import item from JSON
    this.eventBus.on('item:add:imported', (itemData) => {
      const newItem = this.itemManager.addItem(itemData.itemId, itemData.x, itemData.y);
      if (newItem && newItem.canvasObject) {
        newItem.canvasObject.rotate(itemData.angle || 0);
        if (itemData.locked) {
          newItem.canvasObject.set({ lockMovementX: true, lockMovementY: true });
        }
        this.canvasManager.getCanvas().renderAll();
      }
    });

    // Items cleared (for import)
    this.eventBus.on('items:cleared', () => {
      this.canvasManager.clearItems();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
    });

    // Floor plan loaded (for import)
    this.eventBus.on('floorplan:loaded', (floorPlan) => {
      this.canvasManager.drawFloorPlan(floorPlan);
      this.updateInfoPanel();
      this.updateFloatingToolbarVisibility();
    });

    // Import completed - save to history after all items loaded
    this.eventBus.on('import:json:complete', () => {
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
    });

    // Floor plan events
    this.eventBus.on('floorplan:changed', () => {
      this.renderFloorPlanList();
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
      this.updateFloatingToolbarVisibility();
      this.syncViewDropdownUI();
    });

    this.eventBus.on('floorplan:cleared', () => {
      this.renderFloorPlanList();
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
      this.updateFloatingToolbarVisibility();
      this.syncViewDropdownUI();
    });

    this.eventBus.on('floorplan:moved', (payload) => {
      if (payload?.position) {
        this.state.set('layout.floorPlanPosition', payload.position);
      }
      if (payload?.bounds) {
        this.state.set('layout.floorPlanBounds', payload.bounds);
      }
      if (payload?.unitPositions) {
        this.state.set('layout.unitPositions', payload.unitPositions);
      }
      this.renderFloorPlanList();
      this.updateInfoPanel();
      this.refreshFloorPlanSelectionUI();
      this.debouncedCheckEntryZone();
      this.saveHistorySnapshot();
    });

    this.eventBus.on('floorplan:lock:toggled', (locked) => {
      this.state.set('layout.floorPlanLocked', locked);
      this.syncViewDropdownUI();
      this.saveHistorySnapshot();
    });

    // Selection events
    this.eventBus.on('canvas:selection:created', () => {
      this.updateInfoPanel();
      this.refreshFloorPlanSelectionUI();
    });

    this.eventBus.on('canvas:selection:updated', () => {
      this.updateInfoPanel();
      this.refreshFloorPlanSelectionUI();
    });

    this.eventBus.on('canvas:selection:cleared', () => {
      this.updateInfoPanel();
      this.refreshFloorPlanSelectionUI();
    });

    this.eventBus.on('canvas:selection:changed', () => {
      this.updateInfoPanel();
      this.refreshFloorPlanSelectionUI();
    });

    const syncTextToolButton = (isActive) => {
      const textBtn = document.getElementById('btn-text');
      if (!textBtn) return;
      textBtn.classList.toggle('is-active', !!isActive);
    };

    this.eventBus.on('text:tool:activated', () => {
      syncTextToolButton(true);
      // Disable measurement tool if text tool is activated
      if (this.measurementModeActive && this.measurementTool?.disableMeasurementMode) {
        this.measurementTool.disableMeasurementMode();
        this.setMeasurementModeActive(false);
      }
    });
    this.eventBus.on('text:tool:deactivated', () => syncTextToolButton(false));

    // Text events
    this.eventBus.on('text:added', () => {
      this.saveHistorySnapshot();
    });

    this.eventBus.on('text:modified', () => {
      saveTextHistory();
    });

    this.eventBus.on('text:deleted', () => {
      this.saveHistorySnapshot();
      this.updateInfoPanel();
    });

    // Measurement events
    this.eventBus.on('measurement:added', () => {
      this.saveHistorySnapshot();
    });

    this.eventBus.on('measurement:removed', () => {
      this.saveHistorySnapshot();
    });

    // Rotation event (from keyboard 'R' or desktop rotate button)
    this.eventBus.on('items:rotated', () => {
      this.saveHistorySnapshot();
    });

    // Measurement tool events
    this.eventBus.on('tool:measure:activated', () => {
      this.setMeasurementModeActive(true);
      this.state.set('ui.measurementActive', true);
    });

    this.eventBus.on('tool:measure:deactivated', () => {
      this.setMeasurementModeActive(false);
      this.measurementInProgress = false;
      this.state.set('ui.measurementActive', false);
    });

    this.eventBus.on('tool:measure:start', () => {
      this.measurementInProgress = true;
    });

    this.eventBus.on('tool:measure:complete', (payload = {}) => {
      this.measurementInProgress = false;
      if (typeof payload.distanceFeet === 'number') {
        this.state.set('ui.lastMeasurementDistance', payload.distanceFeet);
      }
      this.updateInfoPanel();
    });

    this.eventBus.on('canvas:selection:created', (selected) => {
      this._handleMeasurementSelectionEvent(selected);
    });

    this.eventBus.on('canvas:selection:updated', (selected) => {
      this._handleMeasurementSelectionEvent(selected);
    });

    this.eventBus.on('canvas:selection:cleared', () => {
      this._handleMeasurementSelectionEvent(null);
    });

    this.eventBus.on('item:selected', (item) => {
      this._handleMeasurementSelectionEvent(item ? [item] : null);
    });

    this.eventBus.on('items:selected', (items) => {
      this._handleMeasurementSelectionEvent(items);
    });

    this.eventBus.on('selection:cleared', () => {
      this._handleMeasurementSelectionEvent(null);
    });

    // History events
    this.eventBus.on('history:undo', (state) => {
      console.log('[App] history:undo event', {
        itemsCount: state?.items?.length,
      });
      this.runWithHistorySuppressed(() => {
        this.refreshCanvas();
        this.renderFloorPlanList();
        this.renderSavedLayouts();
        this.updateInfoPanel();
        this.syncViewDropdownUI();
      });
    });

    this.eventBus.on('history:redo', (state) => {
      console.log('[App] history:redo event', {
        itemsCount: state?.items?.length,
      });
      this.runWithHistorySuppressed(() => {
        this.refreshCanvas();
        this.renderFloorPlanList();
        this.renderSavedLayouts();
        this.updateInfoPanel();
        this.syncViewDropdownUI();
      });
    });

    // Zoom events
    this.eventBus.on('canvas:zoomed', (zoom) => {
      this.updateZoomDisplay(zoom);
    });

    this.eventBus.on('items:zorder:changed', () => {
      this.saveHistorySnapshot();
    });

    this.eventBus.on('items:aligned', () => {
      this.saveHistorySnapshot();
    });

    this.eventBus.on('items:move:batch:start', () => {
      if (this.historyManager) {
        this.historyManager.enabled = false;
      }
    });

    this.eventBus.on('items:move:batch:end', () => {
      if (this.historyManager) {
        this.historyManager.enabled = true;
        this.saveHistorySnapshot();
      }
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => this.handleKeyboardShortcut(event));

    document.addEventListener('keyup', (event) => {
      if (event.code === 'Space' && this.isSpacePanning) {
        this.isSpacePanning = false;
        this.canvasManager?.disablePanMode?.();
      }
    });

    // Safety net: if the window/tab loses focus while Space is held (e.g.
    // alt-tab), no keyup ever fires and pan mode would otherwise get stuck
    // on permanently.
    window.addEventListener('blur', () => {
      if (this.isSpacePanning) {
        this.isSpacePanning = false;
        this.canvasManager?.disablePanMode?.();
      }
    });
  }

  _isShortcutSuppressed(event) {
    const target = event.target;
    const isElement = typeof Element !== 'undefined' && target instanceof Element;
    if (
      isElement &&
      target.closest(
        'input, textarea, select, button, a, [contenteditable="true"], [role="button"]',
      )
    ) {
      return true;
    }
    return !!document.querySelector('.modal-overlay, .client-cms-panel.open');
  }

  handleKeyboardShortcut(event) {
    if (this._isShortcutSuppressed(event)) return false;
    const action = ShortcutRegistry?.getAction?.(event);
    if (!action) return false;

    const selection = this.selectionManager?.getSelection?.() || [];
    const hasSelection = selection.length > 0;
    const canvas = this.canvasManager?.getCanvas?.();
    const activeObject = canvas?.getActiveObject?.();
    const isText =
      activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox');
    const selectedUnitIds = this.canvasManager?.getSelectedFloorPlanUnitIds?.() || [];
    const consume = () => event.preventDefault();

    switch (action) {
      case 'help':
        consume();
        this.showKeyboardShortcuts();
        return true;
      case 'save':
        consume();
        if (document.body.classList.contains('mobile-layout')) {
          this.mobileUIManager?.saveMobileLayout?.();
        } else {
          this.saveLayout();
        }
        return true;
      case 'undo':
        consume();
        this.historyManager.undo();
        return true;
      case 'redo':
      case 'redo-shift':
        consume();
        this.historyManager.redo();
        return true;
      case 'duplicate':
        if (!hasSelection) return false;
        consume();
        this.selectionManager.duplicateSelected();
        return true;
      case 'copy':
        if (!hasSelection) return false;
        consume();
        this.selectionManager.copySelected();
        return true;
      case 'paste':
        consume();
        this.selectionManager.pasteSelected();
        return true;
      case 'select-all':
        consume();
        this.selectionManager.selectAll();
        return true;
      case 'delete':
        if (!hasSelection && !selectedUnitIds.length) return false;
        consume();
        this.deleteCurrentSelection();
        return true;
      case 'send-back':
        if (!hasSelection) return false;
        consume();
        this.selectionManager.sendToBack();
        return true;
      case 'bring-front':
        if (!hasSelection) return false;
        consume();
        this.selectionManager.bringToFront();
        return true;
      case 'rotate':
        if (!hasSelection) return false;
        consume();
        this.selectionManager.rotateSelected(90);
        return true;
      case 'escape':
        if (isText) {
          if (activeObject.isEditing && typeof activeObject.exitEditing === 'function') {
            activeObject.exitEditing();
          }
          this.textManager?.deactivate();
          canvas?.requestRenderAll?.();
          consume();
          return true;
        }
        if (this.textManager?.active) {
          this.textManager.deactivate();
          consume();
          return true;
        }
        if (this.measurementTool?.isMeasuring || this.measurementInProgress) {
          if (this.measurementInProgress) {
            this.measurementTool.cancelActiveMeasurement();
            this.measurementInProgress = false;
          } else {
            this.measurementTool.disableMeasurementMode();
          }
          consume();
          return true;
        }
        if (hasSelection || selectedUnitIds.length) {
          this.selectionManager.deselectAll();
          consume();
          return true;
        }
        return false;
      case 'text-tool':
        consume();
        this.textManager.toggle();
        return true;
      case 'measure':
        consume();
        this.toggleMeasurementMode();
        return true;
      case 'toggle-grid': {
        consume();
        const showGrid = this.state.get('settings.showGrid') !== false;
        this.state.set('settings.showGrid', !showGrid);
        this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        this.syncViewDropdownUI();
        return true;
      }
      case 'snap-grid': {
        consume();
        const snapEnabled = this.state.get('settings.snapToGrid') === true;
        this.state.set('settings.snapToGrid', !snapEnabled);
        this.syncViewDropdownUI();
        return true;
      }
      case 'toggle-rulers': {
        consume();
        const showRuler = this.state.get('settings.showRuler') !== false;
        this.state.set('settings.showRuler', !showRuler);
        this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        this.syncViewDropdownUI();
        return true;
      }
      case 'zoom-in':
        consume();
        this.canvasManager.zoomIn();
        return true;
      case 'zoom-out':
        consume();
        this.canvasManager.zoomOut();
        return true;
      case 'fit-view':
        if (!this.state.get('floorPlan')) return false;
        consume();
        this.canvasManager.resetZoom();
        return true;
      case 'focus-search':
        if (!this.focusItemsSearch()) return false;
        consume();
        return true;
      case 'pan':
        if (event.repeat || this.isSpacePanning) return false;
        consume();
        this.isSpacePanning = true;
        this.canvasManager.enablePanMode();
        return true;
      case 'bold':
        if (!isText) return false;
        consume();
        this.textManager.updateTextProperty(
          'fontWeight',
          activeObject.fontWeight === 'bold' ? 'normal' : 'bold',
        );
        return true;
      case 'italic':
        if (!isText) return false;
        consume();
        this.textManager.updateTextProperty(
          'fontStyle',
          activeObject.fontStyle === 'italic' ? 'normal' : 'italic',
        );
        return true;
      case 'underline':
        if (!isText) return false;
        consume();
        this.textManager.updateTextProperty('underline', !activeObject.underline);
        return true;
      default:
        if (action.startsWith('nudge-') && hasSelection) {
          consume();
          const large = action.startsWith('nudge-large-');
          const distance = large ? Config.NUDGE_DISTANCE_LARGE : Config.NUDGE_DISTANCE;
          const direction = action.replace(large ? 'nudge-large-' : 'nudge-', '');
          const offsets = {
            left: [-distance, 0],
            right: [distance, 0],
            up: [0, -distance],
            down: [0, distance],
          };
          this.selectionManager.moveSelected(...offsets[direction]);
          return true;
        }
        return false;
    }
  }

  deleteCurrentSelection() {
    const selection = this.selectionManager?.getSelection?.() || [];
    const selectedUnitIds = this.canvasManager?.getSelectedFloorPlanUnitIds?.() || [];
    if (selectedUnitIds.length && !selection.length) {
      const canvas = this.canvasManager?.getCanvas?.();
      canvas?.discardActiveObject?.();
      canvas?.requestRenderAll?.();
      return this.floorPlanManager.removeFloorPlans(selectedUnitIds);
    }
    if (selection.length) {
      this.selectionManager.deleteSelected();
      return true;
    }
    return false;
  }

  focusItemsSearch() {
    if (document.body.classList.contains('mobile-layout')) return false;
    if (this.sidebarCollapsed) this.toggleSidebar();
    document.querySelector('.sidebar-tab[data-tab="items"]')?.click();
    const searchInput = document.getElementById('items-search');
    if (!searchInput) return false;
    searchInput.focus();
    searchInput.select();
    return true;
  }

  showKeyboardShortcuts() {
    const displayGroups = ShortcutRegistry.getDisplayGroups();
    const sourceEntries = new Map(ShortcutRegistry.entries.map((entry) => [entry.id, entry]));
    const content = document.createElement('div');
    content.className = 'shortcut-reference';

    const intro = document.createElement('div');
    intro.className = 'shortcut-reference__intro';
    const introCopy = document.createElement('div');
    introCopy.className = 'shortcut-reference__intro-copy';
    const introText = document.createElement('p');
    introText.textContent =
      'Work faster across the canvas. Shortcuts pause while you type or use a dialog.';
    introCopy.appendChild(introText);

    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'shortcut-reference__search-wrapper client-cms__search-wrapper';
    const searchIcon = document.createElement('span');
    searchIcon.className = 'client-cms__search-icon';
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.innerHTML = Icons.render('search');
    const searchInput = document.createElement('input');
    searchInput.id = 'shortcut-search';
    searchInput.className = 'client-cms__search shortcut-reference__search-input';
    searchInput.type = 'search';
    searchInput.placeholder = 'Search shortcuts';
    searchInput.setAttribute('aria-label', 'Search keyboard shortcuts and canvas gestures');
    searchInput.setAttribute('autocomplete', 'off');
    searchWrapper.append(searchIcon, searchInput);

    intro.append(introCopy, searchWrapper);
    content.appendChild(intro);

    const groups = document.createElement('div');
    groups.className = 'shortcut-reference__groups';

    const emptyState = document.createElement('div');
    emptyState.className = 'shortcut-reference__empty cms-empty-state';
    emptyState.hidden = true;
    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'cms-empty-title';
    emptyTitle.textContent = 'No shortcuts found';
    const emptyDescription = document.createElement('p');
    emptyDescription.className = 'cms-empty-subtitle';
    emptyDescription.textContent = 'Try a different search term.';
    emptyState.append(emptyTitle, emptyDescription);

    const getKeySearchText = (entry) => {
      const source = sourceEntries.get(entry.id);
      const keySets = [
        ...(entry.keySets || []),
        ...(source?.keys?.default || []),
        ...(source?.keys?.mac || []),
      ];
      const labels = keySets.flat().filter(Boolean);
      const chords = keySets.map((keySet) => keySet.filter(Boolean));
      return [
        ...labels,
        ...chords.map((keySet) => keySet.join(' ')),
        ...chords.map((keySet) => keySet.join(' + ')),
        ...chords.map((keySet) => keySet.join('')),
      ]
        .join(' ')
        .replace(/⌘/g, 'cmd command')
        .replace(/−/g, '- minus');
    };

    const getEntrySearchText = (group, entry) =>
      [
        group.category,
        entry.description,
        entry.context,
        entry.id,
        entry.type,
        sourceEntries.get(entry.id)?.aliases?.join(' '),
        getKeySearchText(entry),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const renderGroups = (query = '') => {
      const normalizedQuery = query.trim().toLowerCase();
      groups.replaceChildren();
      let visibleEntries = 0;

      displayGroups.forEach((group) => {
        const entries = normalizedQuery
          ? group.entries.filter((entry) =>
              getEntrySearchText(group, entry).includes(normalizedQuery),
            )
          : group.entries;
        if (!entries.length) return;

        const section = document.createElement('section');
        section.className = 'shortcut-group';
        const heading = document.createElement('h4');
        heading.className = 'shortcut-group__title';
        heading.textContent = group.category;
        section.appendChild(heading);

        entries.forEach((entry) => {
          visibleEntries += 1;
          const row = document.createElement('div');
          row.className = 'shortcut-row';
          const copy = document.createElement('div');
          copy.className = 'shortcut-row__copy';
          const label = document.createElement('span');
          label.className = 'shortcut-row__label';
          label.textContent = entry.description;
          const context = document.createElement('span');
          context.className = 'shortcut-row__context';
          context.textContent = entry.context;
          copy.append(label, context);

          const keys = document.createElement('div');
          keys.className = 'shortcut-row__keys';
          entry.keySets.forEach((keySet, index) => {
            if (index > 0) {
              const or = document.createElement('span');
              or.className = 'shortcut-row__or';
              or.textContent = 'or';
              keys.appendChild(or);
            }
            const chord = document.createElement('span');
            chord.className = 'shortcut-key-chord';
            keySet.forEach((key) => {
              const keyEl = document.createElement('kbd');
              keyEl.textContent = key;
              chord.appendChild(keyEl);
            });
            keys.appendChild(chord);
          });

          row.append(copy, keys);
          section.appendChild(row);
        });
        groups.appendChild(section);
      });
      emptyState.hidden = visibleEntries > 0;
      groups.hidden = visibleEntries === 0;
    };

    renderGroups();
    searchInput.addEventListener('input', () => renderGroups(searchInput.value));

    content.appendChild(groups);
    content.appendChild(emptyState);

    return Modal.show('Keyboard shortcuts & canvas gestures', content, {
      className: 'shortcuts-modal',
      titleIcon: 'keyboard',
      initialFocus: '[data-action="close"]',
    });
  }

  /**
   * Toggle measurement mode
   */
  toggleMeasurementMode() {
    if (!this.measurementTool) return;
    const hasFloorPlan = !!this.state.get('floorPlan');
    if (!hasFloorPlan) {
      Modal.showInfo?.('Please select a floor plan first');
      if (this.measurementTool.isMeasuring) {
        this.measurementTool.disableMeasurementMode();
      }
      return;
    }
    this.measurementTool.toggleMeasurementMode();
  }

  /**
   * Toggle ruler/grid overlays
   */
  toggleRulerGrid() {
    if (!this.canvasManager) return;
    this.canvasManager.toggleGrid();
    this.syncViewDropdownUI();
    this.saveHistorySnapshot();
  }

  _handleMeasurementSelectionEvent(selected) {
    if (!this.measurementTool) return;
    let selection = Array.isArray(selected) ? selected : selected ? [selected] : [];

    if ((!selection || selection.length === 0) && this.selectionManager) {
      selection = this.selectionManager.getSelection();
    }

    const target = selection?.find((obj) => this._isMeasurableSelection(obj));
    if (target) {
      this.measurementTool.onItemSelected(target);
    } else {
      this.measurementTool.onSelectionCleared();
    }
  }

  _isMeasurableSelection(obj) {
    return (
      obj &&
      obj.customData &&
      obj.customData.id &&
      !obj.customData.isFloorPlan &&
      !obj.measurement &&
      !obj.isMeasurementLabel &&
      !obj.isDimensionOverlay
    );
  }

  /**
   * Update measurement toggle UI state
   */
  setMeasurementModeActive(isActive) {
    this.measurementModeActive = !!isActive;

    const measureBtn = document.getElementById('btn-measure');
    if (measureBtn) {
      measureBtn.setAttribute('aria-pressed', String(this.measurementModeActive));
      measureBtn.classList.toggle('is-active', this.measurementModeActive);
    }
    if (this.measurementModeActive && this.textManager?.active) {
      this.textManager.deactivate();
    }
    const measureToggleText = document.getElementById('measure-toggle-text');
    if (measureToggleText) {
      measureToggleText.textContent = this.measurementModeActive
        ? 'Measure Tool (On)'
        : 'Measure Tool (Off)';
    }

    this.mobileUIManager?.setMeasurementModeActive?.(this.measurementModeActive);
  }

  /**
   * Whether measurement mode is active
   */
  isMeasurementModeActive() {
    return !!this.measurementModeActive;
  }

  /**
   * Initialize UI
   */
  initializeUI() {
    this.renderFloorPlanList();
    this.renderItemPalette();
    this.renderSavedLayouts();
    this.updateInfoPanel();
    this.setupToolbarHandlers();
    this.setupTabSwitching();
    this.setupSidebarToggle();
    this.setupComboPanelToggle();
    this.setupDropdowns();
    this.syncViewDropdownUI();
    this.setMeasurementModeActive(this.measurementModeActive);
    this.setupItemsSearchAndFilter();
    this.setupCanvasItemHighlight();
    this.setupDraggableToolbar();
    this.updateFloatingToolbarVisibility();
  }

  /**
   * Mirror canvas selection onto the Items palette: when a placed item is
   * selected on canvas, highlight its matching card in the sidebar so it's
   * obvious which catalog item is currently selected.
   */
  setupCanvasItemHighlight() {
    const highlightForSelection = (selected) => {
      document.querySelectorAll('.palette-item.is-selected-on-canvas').forEach((el) => {
        el.classList.remove('is-selected-on-canvas');
      });

      if (!selected || !selected.length) return;

      // NOTE: customData.id is a unique PER-INSTANCE id (see
      // ItemManager.addItem -> Helpers.generateId('item')), not the catalog
      // item type. The catalog type (matching .palette-item[data-id]) is
      // preserved separately as customData.itemId.
      const ids = new Set(selected.map((obj) => obj?.customData?.itemId).filter(Boolean));

      ids.forEach((id) => {
        document.querySelectorAll(`.palette-item[data-id="${id}"]`).forEach((el) => {
          el.classList.add('is-selected-on-canvas');
        });
      });

      // Intentionally no auto-scroll here: the card highlights, but the
      // sidebar doesn't jump to it -- avoids yanking the user's scroll
      // position around while they're working on the canvas. They can
      // scroll to the highlighted card themselves if they want to see it.
    };

    this.eventBus.on('canvas:selection:created', (selected) => highlightForSelection(selected));
    this.eventBus.on('canvas:selection:updated', (selected) => highlightForSelection(selected));
    this.eventBus.on('canvas:selection:cleared', () => highlightForSelection(null));
  }

  /**
   * Search + category filter for the Items panel.
   * Scoped entirely to #items-tab -- it no longer touches floor plans or
   * saved layouts, since search only ever made sense for items.
   */
  setupItemsSearchAndFilter() {
    const searchInput = document.getElementById('items-search');
    const filterBtn = document.getElementById('btn-items-filter');
    const filterMenu = document.getElementById('items-filter-menu');
    const filterOptions = document.getElementById('items-filter-options');
    const filterBadge = document.getElementById('items-filter-badge');
    const clearBtn = document.getElementById('btn-items-filter-clear');
    if (!searchInput || !filterOptions) return;

    this.itemsFilter = { query: '', categories: new Set() };

    // Build the category checkbox list once -- the catalog is static for the session.
    filterOptions.innerHTML = Items.getCategoryNames()
      .map((catName) => {
        const category = Items.categories[catName];
        return `
          <label class="items-filter-option">
            <input type="checkbox" value="${catName}" class="items-filter-checkbox" />
            <span>${category.name}</span>
          </label>
        `;
      })
      .join('');

    const updateFilterButtonState = () => {
      const count = this.itemsFilter.categories.size;
      filterBtn.classList.toggle('is-active', count > 0);
      filterBtn.setAttribute('aria-pressed', count > 0 ? 'true' : 'false');
      if (filterBadge) {
        filterBadge.textContent = String(count);
        filterBadge.classList.toggle('hidden', count === 0);
      }
    };

    const applyItemsFilter = () => {
      const { query, categories } = this.itemsFilter;
      document.querySelectorAll('#item-palette .item-category').forEach((categoryEl) => {
        const catName = categoryEl.dataset.category;
        const categorySelected = categories.size === 0 || categories.has(catName);

        let visibleCount = 0;
        categoryEl.querySelectorAll('.palette-item').forEach((item) => {
          const matchesQuery = !query || item.textContent.toLowerCase().includes(query);
          const visible = categorySelected && matchesQuery;
          item.classList.toggle('hidden', !visible);
          if (visible) visibleCount += 1;
        });

        // Hide the (unclickable) category header entirely when nothing in
        // it matches, instead of leaving a dangling empty title.
        categoryEl.classList.toggle('hidden', visibleCount === 0);
      });
    };

    searchInput.addEventListener('input', (e) => {
      this.itemsFilter.query = e.target.value.toLowerCase();
      applyItemsFilter();
    });

    if (filterBtn && filterMenu) {
      // Reuse the app-wide dropdown open/close behavior (registered in
      // setupDropdowns), but stop clicks *inside* the menu from bubbling to
      // the document-level "close all dropdowns" listener -- otherwise the
      // panel would close every time a checkbox is ticked.
      filterMenu.addEventListener('click', (e) => e.stopPropagation());

      filterOptions.addEventListener('change', (e) => {
        if (!e.target.classList.contains('items-filter-checkbox')) return;
        if (e.target.checked) {
          this.itemsFilter.categories.add(e.target.value);
        } else {
          this.itemsFilter.categories.delete(e.target.value);
        }
        updateFilterButtonState();
        applyItemsFilter();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.itemsFilter.categories.clear();
        filterOptions
          .querySelectorAll('.items-filter-checkbox')
          .forEach((cb) => (cb.checked = false));
        updateFilterButtonState();
        applyItemsFilter();
      });
    }
  }

  /**
   * Expandable section toggle handler
   */
  /**
   * Draggable toolbar handler
   */
  setupDraggableToolbar() {
    const toolbar = document.getElementById('floatingToolbar');
    const dragHandle = toolbar?.querySelector('.toolbar-drag-handle');
    if (!toolbar || !dragHandle) return;

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    dragHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      // Get current position BEFORE modifying styles
      const rect = toolbar.getBoundingClientRect();
      const parentRect = toolbar.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };
      initialLeft = rect.left - parentRect.left;
      initialTop = rect.top - parentRect.top;

      toolbar.style.cursor = 'grabbing';
      dragHandle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // Only start actual dragging if moved more than 3px (prevents accidental jumps on click)
      if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasMoved = true;
        // NOW remove the default positioning styles
        toolbar.style.bottom = 'auto';
        toolbar.style.transform = 'none';
      }

      if (!hasMoved) return;

      const parentRect = toolbar.offsetParent?.getBoundingClientRect() || {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      const toolbarRect = toolbar.getBoundingClientRect();
      const maxLeft = parentRect.width - toolbarRect.width - 8;
      const maxTop = parentRect.height - toolbarRect.height - 8;
      const nextLeft = clamp(initialLeft + dx, 8, maxLeft);
      const nextTop = clamp(initialTop + dy, 8, maxTop);
      toolbar.style.left = `${nextLeft}px`;
      toolbar.style.top = `${nextTop}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        toolbar.style.cursor = '';
        dragHandle.style.cursor = 'grab';
      }
    });
  }

  normalizeEntryZonePosition(position) {
    return (
      FloorPlanComposition.normalizeEntryZonePosition(position) ||
      FloorPlanComposition.normalizeEntryZonePosition(this.state?.get?.('settings.entryZonePosition')) ||
      'bottom'
    );
  }

  getEntryZoneTargetUnitIds() {
    const units = this.floorPlanManager?.getUnits?.() || [];
    if (!units.length) return [];

    const unitIds = new Set(units.map((unit) => unit.instanceId));
    const selectedIds = (this.canvasManager?.getSelectedFloorPlanUnitIds?.() || []).filter((id) =>
      unitIds.has(id),
    );

    return selectedIds.length ? selectedIds : [...unitIds];
  }

  getUnitEntryZonePosition(unit) {
    return (
      FloorPlanComposition.normalizeEntryZonePosition(unit?.entryZonePosition) ||
      FloorPlanComposition.normalizeEntryZonePosition(this.state.get('settings.entryZonePosition')) ||
      'bottom'
    );
  }

  getActiveEntryZonePosition() {
    const units = this.floorPlanManager?.getUnits?.() || [];
    if (!units.length) return this.normalizeEntryZonePosition();

    const targetIds = new Set(this.getEntryZoneTargetUnitIds());
    const targetUnits = units.filter((unit) => targetIds.has(unit.instanceId));
    if (!targetUnits.length) return this.normalizeEntryZonePosition();

    const positions = new Set(targetUnits.map((unit) => this.getUnitEntryZonePosition(unit)));
    return positions.size === 1 ? [...positions][0] : null;
  }

  setEntryZonePosition(position) {
    const normalizedPosition = FloorPlanComposition.normalizeEntryZonePosition(position);
    if (!normalizedPosition) return false;

    const units = this.floorPlanManager?.getUnits?.() || [];
    const selectedIds = this.canvasManager?.getSelectedFloorPlanUnitIds?.() || [];
    const targetIds = this.getEntryZoneTargetUnitIds();
    const appliesToAllUnits = !selectedIds.length;
    const currentDefault = this.normalizeEntryZonePosition();
    let defaultChanged = false;

    if (appliesToAllUnits && currentDefault !== normalizedPosition) {
      this.state.set('settings.entryZonePosition', normalizedPosition);
      defaultChanged = true;
    }

    let updatedPlan = false;
    if (units.length && targetIds.length) {
      updatedPlan =
        this.floorPlanManager?.setUnitEntryZonePosition?.(targetIds, normalizedPosition, {
          preserveViewport: true,
        }) === true;
    }

    if (updatedPlan && selectedIds.length) {
      this.canvasManager?.selectFloorPlanUnits?.(selectedIds);
    } else if (!updatedPlan && defaultChanged) {
      this.canvasManager?.redrawFloorPlan?.({ preserveViewport: true });
      this.saveHistorySnapshot();
    } else if (!units.length && defaultChanged) {
      this.saveHistorySnapshot();
    }

    this.refreshFloorPlanSelectionUI();
    this.checkEntryZoneViolations();
    return updatedPlan || defaultChanged;
  }

  refreshFloorPlanSelectionUI() {
    this.syncViewDropdownUI();
    this.renderFloorPlanComboPanel(this.floorPlanManager?.getUnits?.() || []);
  }

  /**
   * Sync View dropdown UI with current settings
   */
  syncViewDropdownUI() {
    const showGrid = this.state.get('settings.showGrid') !== false;
    const showRuler = this.state.get('settings.showRuler') !== false;
    const snapEnabled = this.state.get('settings.snapToGrid') === true;

    const gridToggleText = document.getElementById('grid-toggle-text');
    if (gridToggleText) {
      gridToggleText.textContent = showGrid ? 'Hide Grid' : 'Show Grid';
    }

    const rulerToggleText = document.getElementById('ruler-toggle-text');
    if (rulerToggleText) {
      rulerToggleText.textContent = showRuler ? 'Hide Rulers' : 'Show Rulers';
    }

    const snapToggleText = document.getElementById('snap-toggle-text');
    if (snapToggleText) {
      snapToggleText.textContent = snapEnabled ? 'Disable Snap to Grid' : 'Enable Snap to Grid';
    }

    this.mobileUIManager?.setRulerGridActive?.(!!showGrid);

    // Update entry zone position buttons
    const entryZonePosition = this.getActiveEntryZonePosition();
    const entryZoneTopBtn = document.getElementById('btn-entry-zone-top');
    const entryZoneBottomBtn = document.getElementById('btn-entry-zone-bottom');
    const entryZoneLeftBtn = document.getElementById('btn-entry-zone-left');
    const entryZoneRightBtn = document.getElementById('btn-entry-zone-right');
    const hasFloorPlan = (this.floorPlanManager?.getUnits?.().length || 0) > 0;
    const entryZoneButtons = [
      { button: entryZoneTopBtn, position: 'top' },
      { button: entryZoneBottomBtn, position: 'bottom' },
      { button: entryZoneLeftBtn, position: 'left' },
      { button: entryZoneRightBtn, position: 'right' },
    ];

    entryZoneButtons.forEach(({ button, position }) => {
      if (!button) return;
      button.style.display = '';
      button.classList.toggle('active', entryZonePosition === position);
      button.setAttribute('aria-pressed', String(entryZonePosition === position));
      if (hasFloorPlan) {
        button.removeAttribute('disabled');
        button.removeAttribute('aria-disabled');
      } else {
        button.setAttribute('disabled', 'disabled');
        button.setAttribute('aria-disabled', 'true');
      }
    });

    // Update entry label toggle text
    const showEntryLabel = this.state.get('settings.showEntryZoneLabel') !== false;
    const entryLabelToggleText = document.getElementById('entry-label-toggle-text');
    if (entryLabelToggleText) {
      entryLabelToggleText.textContent = showEntryLabel ? 'Hide Entry Label' : 'Show Entry Label';
    }

    // Update entry border toggle text
    const showEntryBorder = this.state.get('settings.showEntryZoneBorder') !== false;
    const entryBorderToggleText = document.getElementById('entry-border-toggle-text');
    if (entryBorderToggleText) {
      entryBorderToggleText.textContent = showEntryBorder
        ? 'Hide Entry Border'
        : 'Show Entry Border';
    }

    // Update labels toggle text
    const showItemLabels = this.state.get('settings.showItemLabels') !== false;
    const labelsToggleText = document.getElementById('labels-toggle-text');
    if (labelsToggleText) {
      labelsToggleText.textContent = showItemLabels ? 'Hide Item Labels' : 'Show Item Labels';
    }

    const lockToggleText = document.getElementById('floorplan-lock-text');
    const lockIcon = document.getElementById('floorplan-lock-icon');
    const locked = this.state.get('layout.floorPlanLocked') !== false;

    if (lockToggleText) {
      lockToggleText.textContent = locked ? 'Unlock Floor Plan' : 'Lock Floor Plan';
    }

    if (lockIcon) {
      const lockedMarkup = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2"></rect>
          <path d="M7 11V7a5 5 0 0110 0v4"></path>
          <line x1="12" y1="16" x2="12" y2="18"></line>
          <circle cx="12" cy="16" r="1"></circle>
        </svg>
      `;
      const unlockedMarkup = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2"></rect>
          <path d="M17 11V7a5 5 0 00-9.33-3"></path>
          <line x1="12" y1="16" x2="12" y2="18"></line>
          <circle cx="12" cy="16" r="1"></circle>
        </svg>
      `;
      lockIcon.innerHTML = locked ? lockedMarkup : unlockedMarkup;
    }
  }

  /**
   * Setup tab switching
   */
  setupTabSwitching() {
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        // Remove active from all tabs
        tabs.forEach((t) => t.classList.remove('active'));

        // Add active to clicked tab
        tab.classList.add('active');

        // Hide all tab contents
        document.getElementById('floorplan-tab').classList.add('hidden');
        document.getElementById('items-tab').classList.add('hidden');
        document.getElementById('saved-tab').classList.add('hidden');

        // Show selected tab content
        const tabName = tab.dataset.tab;
        if (tabName === 'floorplans') {
          document.getElementById('floorplan-tab').classList.remove('hidden');
        } else if (tabName === 'items') {
          document.getElementById('items-tab').classList.remove('hidden');
        } else if (tabName === 'saved') {
          document.getElementById('saved-tab').classList.remove('hidden');
          this.renderSavedLayouts();
        }
      });
    });
  }

  setupSidebarToggle() {
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => this.toggleSidebar());
  }

  setupDropdowns() {
    const dropdownTriggers = [
      'btn-view',
      'btn-export',
      'btn-zoom',
      'btn-ruler-grid',
      'btn-edit',
      'btn-items-filter',
    ]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!dropdownTriggers.length) return;

    const closeAll = (exception) => {
      document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
        if (menu !== exception) {
          menu.classList.remove('show');
          this.resetDropdownPlacement(menu);
        }
      });
    };

    const positionDropdownMenu = (trigger, menu) => {
      this.resetDropdownPlacement(menu);

      const gap = 6;
      const viewportPadding = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const desiredHeight = menu.scrollHeight || menu.getBoundingClientRect().height;
      const spaceAbove = Math.max(0, triggerRect.top - viewportPadding - gap);
      const spaceBelow = Math.max(0, window.innerHeight - triggerRect.bottom - viewportPadding - gap);
      const shouldOpenBelow = desiredHeight <= spaceBelow || spaceBelow >= spaceAbove;
      const availableSpace = shouldOpenBelow ? spaceBelow : spaceAbove;

      menu.classList.add(shouldOpenBelow ? 'dropdown-menu--below' : 'dropdown-menu--above');
      menu.style.setProperty(
        '--dropdown-max-height',
        `${Math.max(140, Math.floor(availableSpace))}px`,
      );

      const menuRect = menu.getBoundingClientRect();
      if (menuRect.right > window.innerWidth - viewportPadding) {
        menu.style.left = 'auto';
        menu.style.right = '0';
      } else if (menuRect.left < viewportPadding) {
        menu.style.left = '0';
        menu.style.right = 'auto';
      }
    };

    dropdownTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        if (trigger.hasAttribute('disabled')) {
          event.preventDefault();
          return;
        }
        const splitMode = trigger.dataset.dropdownMode === 'split';
        const chevronClicked = !!event.target.closest('.dropdown-chevron');
        if (splitMode && !chevronClicked) {
          closeAll(null);
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const dropdown = trigger.closest('.dropdown');
        const menu = dropdown?.querySelector('.dropdown-menu');
        if (!menu) return;

        const shouldOpen = !menu.classList.contains('show');
        closeAll(shouldOpen ? menu : null);
        if (shouldOpen) {
          menu.classList.add('show');
          positionDropdownMenu(trigger, menu);
        }
      });
    });

    document.addEventListener('click', () => closeAll(null));

    window.addEventListener('resize', () => {
      document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
        const trigger = menu.closest('.dropdown')?.querySelector('.btn, button');
        if (trigger) positionDropdownMenu(trigger, menu);
      });
    });
  }

  resetDropdownPlacement(menu) {
    if (!menu) return;
    menu.classList.remove('dropdown-menu--above', 'dropdown-menu--below');
    menu.style.removeProperty('--dropdown-max-height');
    menu.style.removeProperty('left');
    menu.style.removeProperty('right');
  }

  /**
   * Render floor plan template list (Floor Plans tab in the sidebar)
   */
  renderFloorPlanList() {
    const container = document.getElementById('floorplan-list');
    if (!container) return;

    const floorPlans = this.floorPlanManager.getAllFloorPlans();
    const currentPlan = this.floorPlanManager.getCurrentFloorPlan();
    const units = currentPlan?.units || [];
    const counts = units.reduce((map, unit) => {
      map[unit.templateId] = (map[unit.templateId] || 0) + 1;
      return map;
    }, {});
    const atLimit = units.length >= Config.MAX_FLOOR_PLAN_UNITS;

    container.innerHTML = `
      <div class="floorplan-template-list">
        ${floorPlans
          .map(
            (fp) => `
              <div class="floorplan-item ${counts[fp.id] ? 'selected' : ''}" data-id="${fp.id}">
                <div class="floorplan-item-copy">
                  <div class="floorplan-name">${fp.name}</div>
                  <div class="floorplan-info">${fp.description}</div>
                  <div class="floorplan-area">${fp.area} sq ft</div>
                </div>
                <button type="button" class="floorplan-add" data-add-floor-plan="${fp.id}" ${atLimit ? 'disabled' : ''}>
                  <span class="floorplan-add-plus" aria-hidden="true">+</span> Add
                </button>
              </div>
            `,
          )
          .join('')}
      </div>
    `;

    container.querySelectorAll('[data-add-floor-plan]').forEach((button) => {
      button.addEventListener('click', () => {
        this.floorPlanManager.addFloorPlan(button.dataset.addFloorPlan);
      });
    });

    this.renderFloorPlanComboPanel(units);
  }

  /**
   * Render the "Selected units" panel docked to the canvas edge.
   *
   * This used to live inline at the top of the Floor Plans sidebar list,
   * pushing the actual template cards further down every time a unit was
   * added, and duplicated the span/area the info bar already shows. It's
   * now a separate floating panel so it stays out of the way (toggleable,
   * not tied to which sidebar tab is active) and no longer repeats the
   * total/span figures.
   */
  renderFloorPlanComboPanel(units) {
    const panel = document.getElementById('floorplan-combo-panel');
    const content = document.getElementById('floorplan-combo-panel-content');
    if (!panel || !content) return;

    if (!units.length) {
      content.innerHTML = '';
      panel.classList.add('hidden');
      panel.classList.remove('is-open');
      return;
    }

    panel.classList.remove('hidden');

    // Default to open the first time a combo appears; afterward respect
    // whatever the user last chose via the toggle handle.
    if (this.comboPanelOpen === undefined) this.comboPanelOpen = true;
    panel.classList.toggle('is-open', this.comboPanelOpen);

    const toggleBtn = document.getElementById('btn-toggle-combo-panel');
    toggleBtn?.setAttribute('aria-expanded', String(this.comboPanelOpen));

    const activeUnitIds = new Set(this.canvasManager?.getSelectedFloorPlanUnitIds?.() || []);

    content.innerHTML = `
      <section class="floorplan-combo-summary" aria-label="Selected adjacent units">
        <div class="floorplan-combo-heading">
          <div>
            <strong>Selected units</strong>
            <span>${units.length}/${Config.MAX_FLOOR_PLAN_UNITS}</span>
          </div>
          <div class="floorplan-combo-hint">Drag units freely; edges snap when close. Shift-click units to select multiple, then press Delete.</div>
        </div>
        <div class="floorplan-combo-units">
          ${units
            .map(
              (unit, index) => `
                <div class="floorplan-combo-unit ${activeUnitIds.has(unit.instanceId) ? 'is-active' : ''}" data-instance-id="${unit.instanceId}">
                  <span class="floorplan-combo-index">${index + 1}</span>
                  <span class="floorplan-combo-unit-name">${unit.shortName}</span>
                  <div class="floorplan-combo-actions">
                    <button type="button" data-combo-action="remove" aria-label="Remove ${unit.shortName}">×</button>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
        ${
          units.length > 1
            ? '<p class="floorplan-combo-disclaimer">Unit combinations are for planning purposes. Please confirm adjacent-unit availability with Storage Caves.</p>'
            : ''
        }
      </section>
    `;

    content.querySelectorAll('.floorplan-combo-unit').forEach((row) => {
      row.addEventListener('click', () => {
        const instanceId = row.dataset.instanceId;
        if (!instanceId) return;
        this.canvasManager?.selectFloorPlanUnits?.([instanceId]);
        this.refreshFloorPlanSelectionUI();
      });

      row.querySelectorAll('[data-combo-action]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const instanceId = row.dataset.instanceId;
          const action = button.dataset.comboAction;
          if (action === 'remove') this.floorPlanManager.removeFloorPlan(instanceId);
        });
      });
    });
  }

  /**
   * Wire the slide-panel toggle handle (separate from the sidebar's own
   * hamburger toggle).
   */
  setupComboPanelToggle() {
    const toggleBtn = document.getElementById('btn-toggle-combo-panel');
    const panel = document.getElementById('floorplan-combo-panel');
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', () => {
      this.comboPanelOpen = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', this.comboPanelOpen);
      toggleBtn.setAttribute('aria-expanded', String(this.comboPanelOpen));
    });
  }

  /**
   * Render item palette
   */
  renderItemPalette() {
    const container = document.getElementById('item-palette');
    if (!container) return;

    const categories = Items.getCategoryNames();

    container.innerHTML = categories
      .map((catName) => {
        const category = Items.categories[catName];
        return `
          <div class="item-category" data-category="${catName}">
            <div class="category-title">${category.name}</div>
            <div class="category-items">
              ${category.items
                .map((item) => {
                  const hasImage = Config.USE_IMAGES && item.paletteImage;
                  const accentColor = item.color || '#6366F1';
                  const isMezzanine = item.category === 'mezzanine';
                  const isShape = item.category === 'shapes';
                  let visualMarkup;

                  if (hasImage) {
                    visualMarkup = `
                      <div class="palette-item-image" style="--fallback-color: ${accentColor};">
                        <img src="${Helpers.withCacheBust(item.paletteImage)}" loading="lazy" decoding="async" alt="${item.label}">
                        <div class="palette-image-fallback" aria-hidden="true"></div>
                      </div>
                    `;
                  } else if (isMezzanine) {
                    visualMarkup = `
                      <div class="palette-item-placeholder palette-item-placeholder--mezzanine" aria-hidden="true"></div>
                    `;
                  } else if (isShape) {
                    const shapeType = item.shapeType || 'rectangle';
                    visualMarkup = `
                      <div class="palette-shape-preview palette-shape-preview--${shapeType}" style="--shape-color: ${accentColor};" aria-hidden="true"></div>
                    `;
                  } else {
                    visualMarkup = `
                      <div class="palette-item-icon" style="background-color: ${accentColor}22; color: ${accentColor}">
                        ${item.label.charAt(0)}
                      </div>
                    `;
                  }

                  return `
                    <div class="palette-item" data-id="${item.id}" data-category="${item.category || catName}">
                      ${visualMarkup}
                      <div class="item-label">${item.label}</div>
                      <div class="item-size">${item.lengthFt}' × ${item.widthFt}'</div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      })
      .join('');

    // Make items draggable
    container.querySelectorAll('.palette-item').forEach((item) => {
      item.addEventListener('click', () => {
        const itemId = item.dataset.id;
        const floorPlan = this.state.get('floorPlan');

        if (!floorPlan) {
          Modal.showInfo('Please select a floor plan first');
          return;
        }

        let targetX;
        let targetY;

        if (this.canvasManager && typeof this.canvasManager.getFloorPlanPosition === 'function') {
          const planCenter = this.canvasManager.getFloorPlanPosition();
          if (planCenter) {
            targetX = planCenter.left;
            targetY = planCenter.top;
          }
        }

        if (targetX === undefined || targetY === undefined) {
          const bounds =
            typeof this.canvasManager.getFloorPlanBounds === 'function'
              ? this.canvasManager.getFloorPlanBounds()
              : null;
          if (bounds) {
            targetX = bounds.left + bounds.width / 2;
            targetY = bounds.top + bounds.height / 2;
          }
        }

        if (targetX === undefined || targetY === undefined) {
          // Fallback to geometric center using plan dimensions
          targetX = Helpers.feetToPx(floorPlan.widthFt) / 2;
          targetY = Helpers.feetToPx(floorPlan.heightFt) / 2;
        }

        this.itemManager.addItem(itemId, targetX, targetY);
      });
    });

    // Provide visual fallback if palette image fails to load
    container.querySelectorAll('.palette-item-image img').forEach((img) => {
      img.addEventListener('error', () => {
        const wrapper = img.closest('.palette-item-image');
        if (wrapper) {
          wrapper.classList.add('palette-item-image--error');
        }
      });
    });
  }

  /**
   * Setup toolbar handlers
   */
  setupToolbarHandlers() {
    // Rename project
    const renameBtn = document.getElementById('btn-rename-project');
    const projectNameLabel = document.getElementById('project-name');
    const handleDesktopRename = async () => {
      if (document.body.classList.contains('mobile-layout')) {
        console.log('[App] Desktop rename blocked - mobile mode active');
        return;
      }

      const currentName = this.state.get('metadata.projectName') || 'Untitled Layout';
      const newName = await Modal.showPrompt('Rename Project', 'Enter project name:', currentName);
      const sanitizedName = Helpers.sanitizeLayoutName(newName || '', '');

      if (sanitizedName) {
        this.updateProjectName(sanitizedName);
        Modal.showSuccess('Project renamed successfully');
      } else if (newName && newName.trim() !== '') {
        Modal.showError('Invalid project name');
      }
    };

    if (renameBtn) {
      renameBtn.addEventListener('click', handleDesktopRename);
    }

    if (projectNameLabel) {
      projectNameLabel.addEventListener('dblclick', handleDesktopRename);
    }

    // New layout
    const newBtn = document.getElementById('btn-new');
    if (newBtn) {
      newBtn.addEventListener('click', async () => {
        const confirmed = await Modal.showConfirm(
          'Start New Layout?',
          'Any unsaved changes will be lost. Are you sure?',
        );
        if (confirmed) {
          console.log('[App] Starting new layout');

          // Clear everything
          this.state.reset();
          this.canvasManager.clear();

          // Clear history stack to prevent undoing back to old layout
          this.historyManager.clear();

          // CRITICAL: Clear autosave from localStorage immediately
          StorageUtil.remove(Config.STORAGE_KEYS.autosave);
          console.log('[App] Cleared autosave from localStorage');

          // Ensure viewport is reset (clear() already does this, but be explicit)
          this.canvasManager.resetViewport();

          // Show empty state
          this.canvasManager.showEmptyState();

          // Reset project name in DOM and document title
          this.updateProjectName('Untitled Layout');

          this.renderFloorPlanList();
          this.updateInfoPanel();
          this.updateFloatingToolbarVisibility();
          this.syncViewDropdownUI();
          Modal.showSuccess('New layout started');
        }
      });
    }

    // Undo
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.historyManager.undo());
    }

    // Redo
    const redoBtn = document.getElementById('btn-redo');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.historyManager.redo());
    }

    const copyBtn = document.getElementById('btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.selectionManager.copySelected());
    }

    const pasteBtn = document.getElementById('btn-paste');
    if (pasteBtn) {
      pasteBtn.addEventListener('click', () => this.selectionManager.pasteSelected());
    }

    // Delete
    const deleteBtn = document.getElementById('btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteCurrentSelection());
    }

    // Duplicate
    const duplicateBtn = document.getElementById('btn-duplicate');
    if (duplicateBtn) {
      duplicateBtn.addEventListener('click', () => this.selectionManager.duplicateSelected());
    }

    // Rotate
    const rotateBtn = document.getElementById('btn-rotate');
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => this.selectionManager.rotateSelected(90));
    }

    const textBtn = document.getElementById('btn-text');
    if (textBtn) {
      textBtn.addEventListener('click', () => {
        this.textManager.toggle();
      });
    }

    // Measurement tool
    const measureBtn = document.getElementById('btn-measure');
    if (measureBtn) {
      measureBtn.addEventListener('click', () => {
        // Turn off text tool when enabling measurement
        if (!this.measurementModeActive && this.textManager?.active) {
          this.textManager.deactivate();
        }
        this.toggleMeasurementMode();
      });
    }

    const toggleGridMenuBtn = document.getElementById('btn-toggle-grid');
    if (toggleGridMenuBtn) {
      toggleGridMenuBtn.addEventListener('click', () => {
        const showGrid = this.state.get('settings.showGrid') !== false;
        this.state.set('settings.showGrid', !showGrid);
        this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        this.syncViewDropdownUI();
      });
    }

    const toggleRulersMenuBtn = document.getElementById('btn-toggle-rulers');
    if (toggleRulersMenuBtn) {
      toggleRulersMenuBtn.addEventListener('click', () => {
        const showRuler = this.state.get('settings.showRuler') !== false;
        this.state.set('settings.showRuler', !showRuler);
        this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        this.syncViewDropdownUI();
      });
    }

    const toggleSnapBtn = document.getElementById('btn-toggle-snap');
    if (toggleSnapBtn) {
      toggleSnapBtn.addEventListener('click', () => {
        const snapEnabled = this.state.get('settings.snapToGrid') === true;
        this.state.set('settings.snapToGrid', !snapEnabled);
        this.syncViewDropdownUI();
      });
    }

    // Export JSON
    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportManager.exportJSON());
    }

    // Export PNG
    const exportPngBtn = document.getElementById('btn-export-png');
    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => this.exportManager.exportPNG(4));
    }

    // Export PDF
    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportManager.exportPDF());
    }

    // Share via Email
    const shareEmailBtn = document.getElementById('btn-share-email');
    if (shareEmailBtn) {
      shareEmailBtn.addEventListener('click', () => this.shareViaEmail());
    }

    // Import JSON
    const importJsonBtn = document.getElementById('btn-import-json');
    const jsonFileInput = document.getElementById('json-file-input');
    if (importJsonBtn && jsonFileInput) {
      importJsonBtn.addEventListener('click', () => {
        jsonFileInput.click();
      });

      jsonFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            await this.exportManager.importJSON(file);
            // Clear the input so the same file can be imported again
            jsonFileInput.value = '';
          } catch (error) {
            console.error('Import failed:', error);
          }
        }
      });
    }

    // Save
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveLayout());
    }

    const shortcutsBtn = document.getElementById('btn-shortcuts');
    if (shortcutsBtn) {
      shortcutsBtn.addEventListener('click', () => this.showKeyboardShortcuts());
    }

    // Zoom controls
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomSliderValue = document.getElementById('zoom-slider-value');

    if (zoomSlider && zoomSliderValue) {
      zoomSlider.addEventListener('input', (e) => {
        const zoomPercent = parseInt(e.target.value);
        zoomSliderValue.textContent = `${zoomPercent}%`;
        this.canvasManager.setZoomPercent(zoomPercent);
      });
    }

    const zoomResetBtn = document.getElementById('btn-zoom-reset');
    if (zoomResetBtn) {
      zoomResetBtn.addEventListener('click', () => this.canvasManager.resetZoom());
    }

    // Z-order
    const bringFrontBtn = document.getElementById('btn-bring-front');
    if (bringFrontBtn) {
      bringFrontBtn.addEventListener('click', () => this.selectionManager.bringToFront());
    }

    const sendBackBtn = document.getElementById('btn-send-back');
    if (sendBackBtn) {
      sendBackBtn.addEventListener('click', () => this.selectionManager.sendToBack());
    }

    // Entry zone position handlers
    const entryZoneTopBtn = document.getElementById('btn-entry-zone-top');
    const entryZoneBottomBtn = document.getElementById('btn-entry-zone-bottom');
    const entryZoneLeftBtn = document.getElementById('btn-entry-zone-left');
    const entryZoneRightBtn = document.getElementById('btn-entry-zone-right');

    if (entryZoneTopBtn) {
      entryZoneTopBtn.addEventListener('click', () => this.setEntryZonePosition('top'));
    }

    if (entryZoneBottomBtn) {
      entryZoneBottomBtn.addEventListener('click', () => this.setEntryZonePosition('bottom'));
    }

    if (entryZoneLeftBtn) {
      entryZoneLeftBtn.addEventListener('click', () => this.setEntryZonePosition('left'));
    }

    if (entryZoneRightBtn) {
      entryZoneRightBtn.addEventListener('click', () => this.setEntryZonePosition('right'));
    }

    const toggleEntryLabelBtn = document.getElementById('btn-toggle-entry-label');
    if (toggleEntryLabelBtn) {
      toggleEntryLabelBtn.addEventListener('click', () => {
        const showLabel = this.state.get('settings.showEntryZoneLabel') !== false;
        this.state.set('settings.showEntryZoneLabel', !showLabel);
        this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    const toggleEntryBorderBtn = document.getElementById('btn-toggle-entry-border');
    if (toggleEntryBorderBtn) {
      toggleEntryBorderBtn.addEventListener('click', () => {
        const showBorder = this.state.get('settings.showEntryZoneBorder') !== false;
        this.state.set('settings.showEntryZoneBorder', !showBorder);
        this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    const toggleLabelsBtn = document.getElementById('btn-toggle-labels');
    if (toggleLabelsBtn) {
      toggleLabelsBtn.addEventListener('click', () => {
        const showLabels = this.state.get('settings.showItemLabels') !== false;
        this.state.set('settings.showItemLabels', !showLabels);
        this.canvasManager.toggleItemLabels(!showLabels);
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    const floorPlanLockBtn = document.getElementById('btn-floorplan-lock');
    if (floorPlanLockBtn) {
      floorPlanLockBtn.addEventListener('click', () => {
        const locked = this.state.get('layout.floorPlanLocked') !== false;
        this.canvasManager.setFloorPlanLocked(!locked);
      });
    }

    const floorPlanCenterBtn = document.getElementById('btn-floorplan-center');
    if (floorPlanCenterBtn) {
      floorPlanCenterBtn.addEventListener('click', () => {
        this.canvasManager.resetFloorPlanPosition();
      });
    }
  }

  /**
   * Update info panel - Inline horizontal format
   */
  updateInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    const floorPlan = this.state.get('floorPlan');
    const items = this.state.get('items') || [];
    const selection =
      (this.selectionManager && typeof this.selectionManager.getSelection === 'function'
        ? this.selectionManager.getSelection()
        : []) || [];
    const selectionCount = selection.length;
    const selectedUnitIds = this.canvasManager?.getSelectedFloorPlanUnitIds?.() || [];
    const selectedUnitCount = selectedUnitIds.length;

    const editBtn = document.getElementById('btn-edit');
    if (editBtn) {
      if (selectionCount === 0 && selectedUnitCount === 0) {
        editBtn.setAttribute('disabled', 'disabled');
        editBtn.setAttribute('aria-disabled', 'true');
      } else {
        editBtn.removeAttribute('disabled');
        editBtn.setAttribute('aria-disabled', 'false');
      }
    }

    const segments = [];

    if (floorPlan) {
      const floorPlanName =
        floorPlan.name || floorPlan.label || floorPlan.id || floorPlan.slug || 'Floor Plan';
      const floorDetails = [];
      if ((floorPlan.units?.length || 0) > 1) {
        const span = this.floorPlanManager.getSpan();
        floorDetails.push(`${floorPlan.units.length} units`);
        floorDetails.push(
          `${Helpers.formatNumber(span.widthFt, 1)}' × ${Helpers.formatNumber(span.heightFt, 1)}' span`,
        );
      } else if (floorPlan.widthFt && floorPlan.heightFt) {
        floorDetails.push(`${floorPlan.widthFt}' × ${floorPlan.heightFt}'`);
      }
      if (floorPlan.area) {
        floorDetails.push(`${floorPlan.area} sq ft`);
      }
      const floorValue = [floorPlanName, floorDetails.join(' | ')].filter(Boolean).join(' • ');

      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Floor:</span>
          <span class="info-bar__value">${floorValue}</span>
        </div>
      `);

      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Items:</span>
          <span class="info-bar__value">${items.length}</span>
        </div>
      `);
    } else {
      segments.push('<div class="info-bar__placeholder">Select a floor plan to begin</div>');
    }

    if (selectedUnitCount > 0) {
      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Selected:</span>
          <span class="info-bar__value">${selectedUnitCount} garage ${selectedUnitCount === 1 ? 'unit' : 'units'}</span>
        </div>
      `);
    } else if (selectionCount === 0) {
      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Selection:</span>
          <span class="info-bar__value">None</span>
        </div>
      `);
    } else if (selectionCount > 1) {
      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Selected:</span>
          <span class="info-bar__value">${selectionCount} items</span>
        </div>
      `);
    }

    if (selectionCount === 1) {
      const selectedItem = selection[0];
      if (selectedItem && selectedItem.type === 'i-text') {
        segments.push(`
          <div class="info-bar__segment">
            <span class="info-bar__label">Selected:</span>
            <span class="info-bar__value">Text</span>
          </div>
        `);
      } else {
        const itemData = selectedItem?.customData || {};

        segments.push(`
          <div class="info-bar__segment">
            <span class="info-bar__label">Selected:</span>
            <span class="info-bar__value">${itemData.label || 'Unknown'}</span>
          </div>
        `);

        if (itemData.lengthFt && itemData.widthFt) {
          segments.push(`
            <div class="info-bar__segment">
              <span class="info-bar__label">Size:</span>
              <span class="info-bar__value">${itemData.lengthFt}' × ${itemData.widthFt}'</span>
            </div>
          `);
        }

        if (typeof itemData._insideFloorPlan !== 'undefined') {
          segments.push(`
            <div class="info-bar__segment">
              <span class="info-bar__label">Inside Floor:</span>
              <span class="info-bar__value">${itemData._insideFloorPlan ? 'Yes' : 'No'}</span>
            </div>
          `);
        }
      }
    }

    const entryViolation = this.state.get('ui.entryZoneViolation');
    if (entryViolation && floorPlan) {
      segments.push(`
        <div class="info-bar__segment info-bar__segment--warning" title="Items blocking entry zone">
          <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;margin-right:4px">
            <path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" />
          </svg>
          <span class="info-bar__value">Entry zone blocked</span>
        </div>
      `);
    }

    const lastMeasurement = this.state.get('ui.lastMeasurementDistance');
    if (typeof lastMeasurement === 'number') {
      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Last Measure:</span>
          <span class="info-bar__value">${Helpers.formatNumber(lastMeasurement, 2)} ft</span>
        </div>
      `);
    }

    const divider = '<span class="info-bar__divider"></span>';
    panel.innerHTML = segments.join(divider);
  }

  /**
   * Toggle floating toolbar visibility based on floor plan presence.
   */
  updateFloatingToolbarVisibility() {
    const toolbar = document.getElementById('floatingToolbar');
    if (!toolbar) return;
    const hasFloorPlan = !!this.state?.get?.('floorPlan');
    toolbar.classList.toggle('hidden', !hasFloorPlan);
  }

  toggleSidebar(forceState) {
    const container = document.querySelector('.app-container');
    if (!container) return;

    const shouldCollapse =
      typeof forceState === 'boolean'
        ? forceState
        : !container.classList.contains('sidebar-collapsed');

    container.classList.toggle('sidebar-collapsed', shouldCollapse);
    this.sidebarCollapsed = shouldCollapse;

    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', String(shouldCollapse));
      toggleBtn.title = shouldCollapse ? 'Show sidebar' : 'Hide sidebar';
    }

    requestAnimationFrame(() => {
      this.canvasManager?.resizeCanvas?.();
    });
  }

  /**
   * Update zoom percentage display in toolbar
   */
  updateZoomDisplay(zoom) {
    const zoomPercent = Math.round(zoom * 100);

    const zoomPercentage = document.getElementById('zoom-percentage');
    if (zoomPercentage) {
      zoomPercentage.textContent = `${zoomPercent}%`;
    }

    // Clamp slider value to 10-200% range
    const clampedPercent = Math.max(10, Math.min(200, zoomPercent));

    const zoomSlider = document.getElementById('zoom-slider');
    const zoomSliderValue = document.getElementById('zoom-slider-value');
    if (zoomSlider) {
      zoomSlider.value = clampedPercent;
    }
    if (zoomSliderValue) {
      zoomSliderValue.textContent = `${clampedPercent}%`;
    }
  }

  /**
   * Update project name in DOM and document title
   */
  updateProjectName(projectName) {
    const name = Helpers.sanitizeLayoutName(projectName || 'Untitled Layout', 'Untitled Layout');

    // Update DOM
    const projectNameEl = document.getElementById('project-name');
    if (projectNameEl) {
      projectNameEl.textContent = name;
    }

    // Update document title
    document.title = `${name} - Garage Layout Planner`;

    // Update state if different
    if (this.state.get('metadata.projectName') !== name) {
      this.state.set('metadata.projectName', name);
    }
  }

  /**
   * Check for entry zone violations
   * Returns true if any items are blocking the entry zone
   */
  checkEntryZoneViolations() {
    try {
      const floorPlan = this.state.get('floorPlan');
      if (!floorPlan) {
        this.updateEntryZoneWarning(false);
        return false;
      }

      // Guard: Check if itemManager exists and has getItems method
      if (!this.itemManager || typeof this.itemManager.getItems !== 'function') {
        this.updateEntryZoneWarning(false);
        return false;
      }

      const items = this.itemManager.getItems();
      if (!items || items.length === 0) {
        this.updateEntryZoneWarning(false);
        return false;
      }

      const units = floorPlan.units || [];
      const unitBounds = this.canvasManager.getUnitBoundsMap?.() || {};

      // Check if any item is in the entry zone
      const hasViolation = items.some((item) => {
        if (
          !item ||
          !item.canvasObject ||
          typeof item.canvasObject.getBoundingRect !== 'function'
        ) {
          return false;
        }
        const instanceId =
          item.canvasObject.customData?.unitInstanceId || item.unitInstanceId || null;
        const unit = units.find((candidate) => candidate.instanceId === instanceId);
        const bounds = instanceId ? unitBounds[instanceId] : null;
        if (!unit || !bounds) return false;
        const entryZonePosition = this.getUnitEntryZonePosition(unit);
        return Bounds.isInEntryZone(
          item.canvasObject,
          unit,
          entryZonePosition,
          bounds,
        );
      });

      this.updateEntryZoneWarning(hasViolation);
      return hasViolation;
    } catch (error) {
      console.warn('[App] Error checking entry zone violations:', error);
      this.updateEntryZoneWarning(false);
      return false;
    }
  }

  /**
   * Update entry zone warning UI (desktop + stored state)
   * @param {boolean} isBlocked
   */
  updateEntryZoneWarning(isBlocked) {
    this.state.set('ui.entryZoneViolation', !!isBlocked);

    const warningEl = document.getElementById('entry-zone-warning');
    if (warningEl) {
      warningEl.classList.toggle('hidden', !isBlocked);
    }

    this.updateInfoPanel();
  }

  /**
   * Ensure floor plan bounds object has numeric values before use
   * @private
   */
  _getValidFloorPlanBounds(bounds) {
    if (
      !bounds ||
      typeof bounds !== 'object' ||
      !['left', 'top', 'width', 'height'].every(
        (key) => typeof bounds[key] === 'number' && Number.isFinite(bounds[key]),
      )
    ) {
      return null;
    }
    return bounds;
  }

  /**
   * Debounced entry zone check (16ms to avoid thrashing during drags)
   */
  debouncedCheckEntryZone() {
    if (this.entryZoneCheckDebounce) {
      clearTimeout(this.entryZoneCheckDebounce);
    }
    this.entryZoneCheckDebounce = setTimeout(() => {
      this.checkEntryZoneViolations();
    }, 16);
  }

  // Legacy `setupMobileFeatures` removed. Mobile UI is handled exclusively
  // by `MobileUIManager`. The legacy DOM toolbar and its event wiring
  // were removed to prevent duplicate mobile controls.

  /**
   * Setup touch gestures (pinch zoom, pan, tap, long-press)
   */
  setupTouchGestures() {
    const canvas = this.canvasManager.getCanvas();
    if (!canvas) return;

    let lastDistance = 0;
    // eslint-disable-next-line no-unused-vars
    let lastCenter = null;
    let isPinching = false;

    // Handle touch start
    canvas.on('touch:gesture', (e) => {
      if (e.e.touches && e.e.touches.length === 2) {
        isPinching = true;

        // Calculate distance between two fingers
        const touch1 = e.e.touches[0];
        const touch2 = e.e.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        lastDistance = Math.sqrt(dx * dx + dy * dy);

        // Calculate center point
        lastCenter = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2,
        };
      }
    });

    // Handle pinch zoom
    canvas.on('touch:drag', (e) => {
      if (isPinching && e.e.touches && e.e.touches.length === 2) {
        const touch1 = e.e.touches[0];
        const touch2 = e.e.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (lastDistance > 0) {
          const delta = distance / lastDistance;
          const zoom = canvas.getZoom();
          let newZoom = zoom * delta;

          // Clamp zoom (10% - 200%)
          newZoom = Math.max(0.1, Math.min(2, newZoom));

          // Zoom to pinch center
          const center = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2,
          };

          canvas.zoomToPoint({ x: center.x, y: center.y }, newZoom);

          // Mark as manual zoom (not auto-fit)
          this.canvasManager.isAutoFitMode = false;

          this.eventBus.emit('canvas:zoomed', newZoom);
        }

        lastDistance = distance;
      }
    });

    // Handle touch end
    canvas.on('touch:longpress', () => {
      isPinching = false;
      lastDistance = 0;
      lastCenter = null;
    });

    // Enable touch scrolling/panning when no object is selected
    canvas.allowTouchScrolling = true;
  }

  /**
   * Show mobile "More" menu with additional actions
   */
  /**
   * Show mobile "More" menu with Export and View options
   */
  async showMobileMoreMenu() {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // EXPORT section
    const exportSection = document.createElement('div');
    exportSection.innerHTML = `
      <div style="margin-bottom: 8px; color: #71717A; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
        EXPORT
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button class="dropdown-item" data-action="export-png">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/></svg>
          Export PNG
        </button>
        <button class="dropdown-item" data-action="export-pdf">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M15.5,15C15.5,16.38 14.38,17.5 13,17.5H11.5V19H10V13H13A2.5,2.5 0 0,1 15.5,15.5M13,16.5A1,1 0 0,0 14,15.5A1,1 0 0,0 13,14.5H11.5V16.5M13,9V3.5L18.5,9"/></svg>
          Export PDF
        </button>
        <button class="dropdown-item" data-action="share-email">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z"/></svg>
          Share via Email
        </button>
      </div>
    `;

    // VIEW OPTIONS section
    const viewSection = document.createElement('div');
    const currentSettings = this.state.get('settings') || {};
    const entryLabelVisible = currentSettings.showEntryZoneLabel !== false;
    const entryBorderVisible = currentSettings.showEntryZoneBorder !== false;
    const itemLabelsVisible = currentSettings.showItemLabels !== false;
    const entryPosition = this.getActiveEntryZonePosition();

    viewSection.innerHTML = `
      <div style="margin-bottom: 8px; color: #71717A; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
        VIEW OPTIONS
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button class="dropdown-item" data-action="toggle-item-labels">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8,9H16V11H8V9M4,3H20A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3Z" /></svg>
          ${itemLabelsVisible ? 'Hide' : 'Show'} Item Labels
        </button>
        <button class="dropdown-item" data-action="toggle-entry-label">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9.62,12L12,5.67L14.37,12M11,3L5.5,17H7.75L8.87,14H15.12L16.25,17H18.5L13,3H11Z"/></svg>
          ${entryLabelVisible ? 'Hide' : 'Show'} Entry Label
        </button>
        <button class="dropdown-item" data-action="toggle-entry-border">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z"/></svg>
          ${entryBorderVisible ? 'Hide' : 'Show'} Entry Border
        </button>
        <button class="dropdown-item ${entryPosition === 'bottom' ? 'active' : ''}" data-action="entry-bottom">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z"/></svg>
          Entry Zone: Bottom ${entryPosition === 'bottom' ? '✓' : ''}
        </button>
        <button class="dropdown-item ${entryPosition === 'left' ? 'active' : ''}" data-action="entry-left">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M20,9V15H8L13.5,9.5L12.08,8.08L4.16,16L12.08,23.92L13.5,22.5L8,17H20V9Z"/></svg>
          Entry Zone: Left ${entryPosition === 'left' ? '✓' : ''}
        </button>
        <button class="dropdown-item ${entryPosition === 'right' ? 'active' : ''}" data-action="entry-right">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M4,15V9H16L10.5,14.5L11.92,15.92L19.84,8L11.92,0.0799999L10.5,1.5L16,7H4V15Z"/></svg>
          Entry Zone: Right ${entryPosition === 'right' ? '✓' : ''}
        </button>
        <button class="dropdown-item ${entryPosition === 'top' ? 'active' : ''}" data-action="entry-top">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z"/></svg>
          Entry Zone: Top ${entryPosition === 'top' ? '✓' : ''}
        </button>
      </div>
    `;

    container.appendChild(exportSection);
    container.appendChild(viewSection);

    // Export handlers
    container.querySelector('[data-action="export-png"]').onclick = () => {
      Modal.close();
      this.showPNGExportDialog();
    };

    container.querySelector('[data-action="export-pdf"]').onclick = () => {
      this.exportManager.exportPDF();
      Modal.close();
    };

    container.querySelector('[data-action="share-email"]').onclick = () => {
      this.shareViaEmail();
      Modal.close();
    };

    container.querySelector('[data-action="toggle-item-labels"]').onclick = () => {
      const showLabels = this.state.get('settings.showItemLabels') !== false;
      this.state.set('settings.showItemLabels', !showLabels);
      this.canvasManager.toggleItemLabels(!showLabels);
      this.saveHistorySnapshot();
      Modal.close();
    };

    container.querySelector('[data-action="toggle-entry-label"]').onclick = () => {
      const showLabel = this.state.get('settings.showEntryZoneLabel') !== false;
      this.state.set('settings.showEntryZoneLabel', !showLabel);
      this.canvasManager.redrawFloorPlan();
      this.saveHistorySnapshot();
      Modal.close();
    };

    container.querySelector('[data-action="toggle-entry-border"]').onclick = () => {
      const showBorder = this.state.get('settings.showEntryZoneBorder') !== false;
      this.state.set('settings.showEntryZoneBorder', !showBorder);
      this.canvasManager.redrawFloorPlan();
      this.saveHistorySnapshot();
      Modal.close();
    };

    container.querySelector('[data-action="entry-bottom"]').onclick = () => {
      this.setEntryZonePosition('bottom');
      Modal.close();
    };

    container.querySelector('[data-action="entry-left"]').onclick = () => {
      this.setEntryZonePosition('left');
      Modal.close();
    };

    container.querySelector('[data-action="entry-right"]').onclick = () => {
      this.setEntryZonePosition('right');
      Modal.close();
    };

    container.querySelector('[data-action="entry-top"]').onclick = () => {
      this.setEntryZonePosition('top');
      Modal.close();
    };

    Modal.show('More Actions', container);
  }

  /**
   * Show PNG export resolution dialog
   */
  async showPNGExportDialog() {
    const resolutions = [
      { label: '1x (Standard)', value: 1 },
      { label: '2x (High Quality)', value: 2 },
      { label: '4x (Print)', value: 4 },
      { label: '8x (Ultra HD)', value: 8 },
    ];

    const menuHTML = resolutions
      .map((res) => `<button class="dropdown-item" data-res="${res.value}">${res.label}</button>`)
      .join('');

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${menuHTML}
      </div>
    `;

    container.querySelectorAll('[data-res]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const resolution = parseInt(btn.dataset.res);
        this.exportManager.exportPNG(resolution);
        Modal.close();
      });
    });

    Modal.show('Select PNG Resolution', container);
  }

  /**
   * Refresh canvas after undo/redo
   */
  /**
   * Refresh canvas - redraw everything from state
   * Used after undo/redo operations
   */
  refreshCanvas() {
    console.log('[App] refreshCanvas()', {
      floorPlan: this.state.get('floorPlan'),
      itemsCount: (this.state.get('items') || []).length,
    });
    // [App] Refreshing canvas from state

    // ALWAYS clear canvas first (critical for undo/redo)
    // This also resets viewport automatically
    this.canvasManager.clear();

    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      // Draw floor plan
      this.canvasManager.drawFloorPlan(floorPlan);

      // Re-add items from state
      const items = this.state.get('items') || [];
      items.forEach((item) => {
        if (item.itemId && item.x !== undefined && item.y !== undefined) {
          const canvasGroup = this.canvasManager.addItem(item, item.x, item.y);

          // Restore rotation if exists
          if (item.angle && canvasGroup) {
            canvasGroup.rotate(item.angle);
          }

          // Update item reference
          item.canvasObject = canvasGroup;
        }
      });
      this.canvasManager.refreshItemFloorPlanStates();

      const texts = this.state.get('texts') || [];
      if (this.textManager) {
        this.textManager.restoreTextsFromState(texts);
      }

      // Restore measurements
      const measurements = this.state.get('measurements') || [];
      if (this.measurementTool && measurements.length > 0) {
        this.measurementTool.restoreMeasurementsFromState(measurements);
      }

      // Final render
      this.canvasManager.getCanvas().renderAll();

      // Apply label visibility setting
      const showLabels = this.state.get('settings.showItemLabels') !== false;
      this.canvasManager.toggleItemLabels(showLabels);
    } else {
      // No floor plan - show empty state
      this.canvasManager.showEmptyState();
    }

    this.updateInfoPanel();
  }

  /**
   * Setup autosave
   */
  /**
   * Setup autosave timer
   * Saves application state every 30 seconds
   */
  setupAutosave() {
    // Skip autosave setup if storage is not available
    if (!StorageUtil.isAvailable) {
      console.warn('[App] Autosave disabled - persistent storage not available');
      return;
    }

    // [App] Setting up autosave (interval: 30s)
    this.autosaveInterval = setInterval(() => {
      this.autosave();
    }, Config.AUTOSAVE_INTERVAL);
  }

  /**
   * Autosave current state
   * Saves only application data (floor plan, items, settings)
   * Does NOT save canvas viewport (zoom/pan)
   */
  autosave() {
    // Skip if storage not available
    if (!StorageUtil.isAvailable) {
      return;
    }

    try {
      const state = this.state.getState();

      // Prepare autosave data with metadata
      const autosaveData = {
        version: '3.0',
        schemaVersion: Config.LAYOUT_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        state: {
          floorPlan: state.floorPlan,
          items: state.items,
          texts: state.texts,
          measurements: state.measurements,
          settings: state.settings,
          layout: state.layout,
          metadata: state.metadata,
        },
        // NOTE: Viewport (zoom/pan) is intentionally NOT saved
      };

      StorageUtil.save(Config.STORAGE_KEYS.autosave, autosaveData);
      // [App] Autosave completed + timestamp
    } catch (error) {
      console.error('[App] Autosave failed:', error);
    }
  }

  /**
   * Load autosave if exists
   * Validates data and resets viewport after loading
   */
  loadAutosave() {
    // Skip if storage not available
    if (!StorageUtil.isAvailable) {
      console.log('[App] Autosave unavailable - persistent storage not available');
      return false;
    }

    try {
      const savedData = StorageUtil.load(Config.STORAGE_KEYS.autosave);

      if (!savedData) {
        console.log('[App] No autosave found');
        return false;
      }

      // Validate version
      const isCurrentSchema = savedData.schemaVersion === Config.LAYOUT_SCHEMA_VERSION;
      const isLegacySchema = savedData.version === '2.1';
      if (!isCurrentSchema && !isLegacySchema) {
        console.log(
          '[App] Incompatible autosave version:',
          savedData.version,
          'expected:',
          Config.LAYOUT_SCHEMA_VERSION,
        );
        StorageUtil.remove(Config.STORAGE_KEYS.autosave);
        return false;
      }

      // Validate timestamp (ignore if > 7 days old)
      if (savedData.timestamp) {
        const savedDate = new Date(savedData.timestamp);
        const daysSinceAutosave = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceAutosave > 7) {
          console.log('[App] Autosave expired (>7 days old), clearing...');
          StorageUtil.remove(Config.STORAGE_KEYS.autosave);
          return false;
        }
      }

      // Validate required data
      if (!savedData.state) {
        console.log('[App] Invalid autosave structure, missing state');
        StorageUtil.remove(Config.STORAGE_KEYS.autosave);
        return false;
      }

      const savedState = savedData.state;

      // Remove serialized Fabric references (cannot be revived from JSON)
      if (Array.isArray(savedState.items)) {
        savedState.items = savedState.items.map((item) => {
          const sanitized = { ...item };
          delete sanitized.canvasObject;
          return sanitized;
        });
      }
      if (!Array.isArray(savedState.texts)) {
        savedState.texts = [];
      }

      // Must have a floor plan to restore
      if (!savedState.floorPlan) {
        console.log('[App] No floor plan in autosave, skipping');
        return false;
      }

      console.log('[App] Loading autosave from', savedData.timestamp);

      // Load state
      this.state.loadState(savedState);

      // Restore normalized single- or multi-unit floor plan.
      this.floorPlanManager.restoreFloorPlan(savedState.floorPlan, {
        resetPosition: false,
        reason: 'autosave',
      });

      // Restore items
      const items = savedState.items || [];
      items.forEach((item) => {
        if (item.itemId && item.x !== undefined && item.y !== undefined) {
          const canvasGroup = this.canvasManager.addItem(item, item.x, item.y);

          // Restore rotation if exists
          if (item.angle && canvasGroup) {
            canvasGroup.rotate(item.angle);
          }

          // Update item reference
          item.canvasObject = canvasGroup;
        }
      });
      this.canvasManager.refreshItemFloorPlanStates();

      if (this.textManager) {
        this.textManager.restoreTextsFromState(savedState.texts);
      }

      // Render canvas
      this.canvasManager.getCanvas().renderAll();

      // Apply label visibility setting
      const showLabels = this.state.get('settings.showItemLabels') !== false;
      this.canvasManager.toggleItemLabels(showLabels);

      // Sync project name from loaded state to UI
      this.updateProjectName(savedState.metadata?.projectName);

      // Autosave has no layout id; clear any stale active layout pointers
      this._setActiveLayoutMeta(null);

      console.log('[App] Autosave loaded successfully: floor plan + ' + items.length + ' items');
      return true;
    } catch (error) {
      console.error('[App] Failed to load autosave:', error);
      console.log('[App] Clearing corrupted autosave data');
      StorageUtil.remove(Config.STORAGE_KEYS.autosave);
      return false;
    }
  }

  /**
   * Update item position in state after drag
   * x, y are center coordinates (object uses originX/Y: 'center')
   */
  updateItemPosition(itemId, x, y, angle) {
    const items = this.state.get('items') || [];
    const item = items.find((i) => i.id === itemId);
    if (item) {
      // Store center coordinates
      item.x = x;
      item.y = y;
      item.angle = angle;
      item.unitInstanceId = item.canvasObject?.customData?.unitInstanceId || null;
      this.state.setState({ items });
    }
  }

  /**
   * Save layout (desktop + mobile)
   * @param {Object} options
   * @param {boolean} options.allowMobile Allow invocation while mobile layout is active
   * @param {string|null} options.presetName Optional pre-filled name (skips prompt if provided)
   * @param {Function} options.onBeforePrompt Async hook before prompting user
   * @param {Function} options.onAfterSave Called with saved layout data on success
   * @param {Function} options.onCancel Called when user cancels/enters empty name
   * @returns {Promise<{saved: boolean, layout?: object, reason?: string}>}
   */
  async saveLayout(options = {}) {
    const {
      allowMobile = false,
      presetName = null,
      onBeforePrompt = null,
      onAfterSave = null,
      onCancel = null,
    } = options;

    const isMobileLayout = document.body.classList.contains('mobile-layout');
    if (!allowMobile && isMobileLayout) {
      console.log('[App] Desktop saveLayout blocked - mobile mode active');
      return { saved: false, reason: 'mobile_blocked' };
    }

    this._maybeWarnAboutStorage();

    if (typeof onBeforePrompt === 'function') {
      await onBeforePrompt();
    }

    const rawName = presetName ?? (await Modal.showPrompt('Save Layout', 'Enter layout name:'));
    const name = Helpers.sanitizeLayoutName(rawName || '', '');
    if (!name) {
      if (typeof onCancel === 'function') {
        onCancel();
      }
      return { saved: false, reason: 'cancelled' };
    }

    const state = this.state.getState();
    const layouts = StorageUtil.load(Config.STORAGE_KEYS.layouts) || [];
    const layoutRecord = {
      id: Helpers.generateId('layout'),
      name: name,
      created: new Date().toISOString(),
      state: state,
      thumbnail: this.exportManager.generateThumbnail(),
    };

    layouts.push(layoutRecord);

    const saved = StorageUtil.save(Config.STORAGE_KEYS.layouts, layouts);
    if (saved) {
      Modal.showSuccess('Layout saved successfully!');
      this._setActiveLayoutMeta(layoutRecord);
      this.renderSavedLayouts();
      if (typeof onAfterSave === 'function') {
        onAfterSave(layoutRecord);
      }
      return { saved: true, layout: layoutRecord };
    }

    Modal.showError('Failed to save layout - storage error');
    return { saved: false, reason: 'storage_error' };
  }

  /**
   * Warn users when data will not persist beyond the session
   * @private
   */
  _maybeWarnAboutStorage() {
    if (StorageUtil.isPersistent || window._storageWarningShown) return;
    window._storageWarningShown = true;
    const mode = StorageUtil.mode;
    if (mode === 'session') {
      Modal.showInfo(
        'Your layouts will be saved for this session, but will be cleared when you close this tab',
      );
    } else if (mode === 'memory') {
      Modal.showInfo(
        'Your layouts will only be saved temporarily and will be lost when you reload this page',
      );
    }
  }

  /**
   * Persist which layout is currently active so Client CMS can reference it reliably.
   * @param {object|null} layout
   * @private
   */
  _setActiveLayoutMeta(layout) {
    try {
      if (!layout || !layout.id) {
        StorageUtil.remove(Config.STORAGE_KEYS.activeLayout);
        return;
      }

      const layoutName =
        (Helpers?.sanitizeLayoutName &&
          Helpers.sanitizeLayoutName(
            layout.name || layout.state?.metadata?.projectName || 'Current Layout',
            'Current Layout',
          )) ||
        layout.name ||
        layout.state?.metadata?.projectName ||
        'Current Layout';

      StorageUtil.save(Config.STORAGE_KEYS.activeLayout, {
        id: layout.id,
        name: layoutName,
        updated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[App] Failed to update active layout metadata', error);
    }
  }

  /**
   * Share layout via email
   */
  shareViaEmail() {
    const floorPlan = this.state.get('floorPlan');
    const items = this.state.get('items') || [];
    const metadata = this.state.get('metadata') || {};
    const projectName = metadata.projectName || 'Untitled Layout';

    if (!floorPlan) {
      Modal.showError('Please select a floor plan first');
      return;
    }

    // Calculate area
    const areaSqFt = floorPlan.area || floorPlan.widthFt * floorPlan.heightFt;
    const units = floorPlan.units || [];
    const span = this.floorPlanManager.getSpan();
    const unitInfo = units.length
      ? units
          .map((unit, index) => {
            const door =
              unit.doorWidth && unit.doorHeight
                ? `${unit.doorWidth}' × ${unit.doorHeight}'`
                : 'N/A';
            return `${index + 1}. ${unit.shortName || unit.name} — ${unit.widthFt}' × ${unit.heightFt}' — Door: ${door}`;
          })
          .join('\n')
      : `1. ${floorPlan.name}`;

    // Create email content
    const subject = encodeURIComponent(`Storage Caves Garage Layout: ${projectName}`);

    const layoutInfo = `
Location: ${metadata.location || 'Buford, GA'}
Floor Plan: ${floorPlan.name}
Units (${units.length || 1}):
${unitInfo}
Overall Span: ${Helpers.formatNumber(span.widthFt, 1)}' × ${Helpers.formatNumber(span.heightFt, 1)}'
Area: ${areaSqFt} sq ft
Items: ${items.length}

Item List:
${items.map((item, i) => `${i + 1}. ${item.label} - ${item.lengthFt}' × ${item.widthFt}'`).join('\n')}

Occupancy: ${this.floorPlanManager.getOccupancyPercentage().toFixed(1)}%
    `.trim();

    const body = encodeURIComponent(
      `Hi,\n\nI'd like to share my garage layout plan with you:\n\n${layoutInfo}\n\n---\nCreated with Storage Caves Garage Layout Planner`,
    );

    // Open default email client
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  /**
   * Render saved layouts list
   */
  renderSavedLayouts() {
    const container = document.getElementById('saved-layouts-list');
    if (!container) return;

    const layouts = StorageUtil.load(Config.STORAGE_KEYS.layouts) || [];

    if (layouts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No saved layouts</p>
          <p style="font-size: 12px; margin-top: 8px;">Click the Save button to save your current layout</p>
        </div>
      `;
      return;
    }

    container.innerHTML = layouts
      .map((layout) => {
        const layoutName = Helpers.sanitizeLayoutName(
          layout.name || 'Untitled Layout',
          'Untitled Layout',
        );
        const layoutDate = new Date(layout.created).toLocaleDateString();
        return `
      <div class="saved-layout-item" data-id="${layout.id}">
        <div class="saved-layout-name">${layoutName}</div>
        <div class="saved-layout-date">${layoutDate}</div>
        <div class="saved-layout-actions">
          <button class="btn-load-layout" data-id="${layout.id}">Load</button>
          <button class="btn-delete-layout" data-id="${layout.id}">Delete</button>
        </div>
      </div>
    `;
      })
      .join('');

    container.querySelectorAll('.btn-load-layout').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadLayout(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-delete-layout').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await Modal.showConfirm(
          'Delete Layout?',
          'Are you sure you want to delete this layout? This cannot be undone.',
        );
        if (confirmed) {
          this.deleteLayout(btn.dataset.id);
        }
      });
    });
  }

  /**
   * Load a saved layout
   * Validates data and resets viewport
   */
  async loadLayout(layoutId) {
    try {
      const layouts = StorageUtil.load(Config.STORAGE_KEYS.layouts) || [];
      const layout = layouts.find((l) => l.id === layoutId);

      if (!layout) {
        Modal.showError('Layout not found');
        return;
      }

      const confirmed = await Modal.showConfirm(
        'Load Layout?',
        'This will replace your current layout. Any unsaved changes will be lost.',
      );

      if (!confirmed) return;

      // Validate layout data
      if (!layout.state || !layout.state.floorPlan) {
        Modal.showError('Invalid layout data');
        return;
      }

      // Load state
      this.state.loadState(layout.state);

      // Update project name in UI and document title
      this.updateProjectName(layout.state.metadata?.projectName);

      // Sync view dropdown UI with loaded state
      this.syncViewDropdownUI();

      // Reset viewport BEFORE refreshing canvas
      this.canvasManager.resetViewport();

      // Refresh canvas with new state
      this.refreshCanvas();

      // Update UI
      this.renderFloorPlanList();
      this.renderSavedLayouts();
      this.updateInfoPanel();
      this._setActiveLayoutMeta(layout);

      Modal.showSuccess('Layout loaded successfully!');
    } catch (error) {
      console.error('[App] Failed to load layout:', error);
      Modal.showError('Failed to load layout');
    }
  }

  /**
   * Delete a saved layout
   */
  deleteLayout(layoutId) {
    try {
      let layouts = StorageUtil.load(Config.STORAGE_KEYS.layouts) || [];
      layouts = layouts.filter((l) => l.id !== layoutId);
      const saved = StorageUtil.save(Config.STORAGE_KEYS.layouts, layouts);

      if (saved) {
        const fallbackLayout = layouts.length ? layouts[layouts.length - 1] : null;
        this._setActiveLayoutMeta(fallbackLayout);
        // Update both desktop and mobile saved lists
        this.renderSavedLayouts();
        if (this.mobileUIManager) {
          this.mobileUIManager.renderSaved();
        }
        Modal.showSuccess('Layout deleted');
      } else {
        Modal.showError('Failed to delete layout - storage error');
      }
    } catch (error) {
      console.error('[App] Failed to delete layout:', error);
      Modal.showError('Failed to delete layout');
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.App = App;
}
