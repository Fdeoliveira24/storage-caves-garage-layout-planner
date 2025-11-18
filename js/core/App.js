/* global State, EventBus, CanvasManager, FloorPlanManager, ItemManager, SelectionManager, ExportManager, HistoryManager, Modal, Config, Items, Helpers, StorageUtil, Bounds */

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
    this.sidebarCollapsed = false;
    this.mobileUIManager = null;
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

    // Ensure viewport starts at default state
    this.canvasManager.resetViewport();
    this.canvasManager.showEmptyState();

    // Initialize managers
    this.floorPlanManager = new FloorPlanManager(this.state, this.eventBus, this.canvasManager);
    this.itemManager = new ItemManager(this.state, this.eventBus, this.canvasManager);
    this.selectionManager = new SelectionManager(this.state, this.eventBus, this.canvasManager);
    this.exportManager = new ExportManager(this.state, this.eventBus, this.canvasManager);
    this.historyManager = new HistoryManager(this.state, this.eventBus);

    // Setup event listeners
    this.setupEventListeners();

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();

    // Initialize UI
    this.initializeUI();

    // Initialize modern mobile UI (NEW - replaces old mobile features)
    if (window.MobileUIManager) {
      this.mobileUIManager = new MobileUIManager(this);
      this.mobileUIManager.init();
      this.mobileUIManager.setMeasurementModeActive?.(this.isMeasurementModeActive());
    } else {
      // Fallback to legacy mobile features if MobileUIManager not available
      this.setupMobileFeatures();
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
    // Canvas events
    this.eventBus.on('canvas:object:modified', (obj) => {
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
      this.canvasManager.redrawFloorPlan();
      this.updateInfoPanel();
    });

    // Import completed - save to history after all items loaded
    this.eventBus.on('import:json:complete', () => {
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
    });

    // Floor plan events
    this.eventBus.on('floorplan:changed', () => {
      this.saveHistorySnapshot();
      this.updateInfoPanel();
      this.checkEntryZoneViolations();
    });

    this.eventBus.on('floorplan:moved', (payload) => {
      if (payload?.position) {
        this.state.set('layout.floorPlanPosition', payload.position);
      }
      if (payload?.bounds) {
        this.state.set('layout.floorPlanBounds', payload.bounds);
      }
      this.updateInfoPanel();
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
    });

    this.eventBus.on('canvas:selection:updated', () => {
      this.updateInfoPanel();
    });

    this.eventBus.on('canvas:selection:cleared', () => {
      this.updateInfoPanel();
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
    document.addEventListener('keydown', (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

      // Delete/Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.selectionManager.deleteSelected();
      }

      // Ctrl+Z - Undo
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        this.historyManager.undo();
      }

      // Ctrl+Y - Redo
      if (ctrl && e.key === 'y') {
        e.preventDefault();
        this.historyManager.redo();
      }

      // Ctrl+D - Duplicate
      if (ctrl && e.key === 'd') {
        e.preventDefault();
        this.selectionManager.duplicateSelected();
      }

      // Ctrl+A - Select All
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        this.selectionManager.selectAll();
      }

      // Ctrl+C - Copy
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        this.selectionManager.copySelected();
      }

      // Ctrl+V - Paste
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        this.selectionManager.pasteSelected();
      }

      // Esc - Measurement cancel / exit / deselect
      if (e.key === 'Escape') {
        if (this.measurementTool?.isMeasuring) {
          if (this.measurementInProgress) {
            this.measurementTool.cancelActiveMeasurement();
            this.measurementInProgress = false;
          } else {
            this.measurementTool.disableMeasurementMode();
          }
          e.preventDefault();
          return;
        }

        this.selectionManager.deselectAll();
        return;
      }

      // R - Rotate 90°
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        this.selectionManager.rotateSelected(90);
      }

      // Arrow keys - Nudge
      const nudge = e.shiftKey ? Config.NUDGE_DISTANCE_LARGE : Config.NUDGE_DISTANCE;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.selectionManager.moveSelected(-nudge, 0);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.selectionManager.moveSelected(nudge, 0);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectionManager.moveSelected(0, -nudge);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectionManager.moveSelected(0, nudge);
      }
    });
  }

  /**
   * Toggle measurement mode
   */
  toggleMeasurementMode() {
    if (!this.measurementTool) return;
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
    let selection = Array.isArray(selected)
      ? selected
      : selected
        ? [selected]
        : [];

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
      measureBtn.classList.toggle('is-active', this.measurementModeActive);
      measureBtn.setAttribute('aria-pressed', this.measurementModeActive ? 'true' : 'false');
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
    this.updateInfoPanel();
    this.setupToolbarHandlers();
    this.setupTabSwitching();
    this.setupSidebarToggle();
    this.setupDropdowns();
    this.syncViewDropdownUI();
    this.setMeasurementModeActive(this.measurementModeActive);
  }

  /**
   * Sync View dropdown UI with current settings
   */
  syncViewDropdownUI() {
    const showGrid = this.state.get('settings.showGrid');

    const rulerGridBtn = document.getElementById('btn-ruler-grid');
    if (rulerGridBtn) {
      rulerGridBtn.classList.toggle('is-active', !!showGrid);
      rulerGridBtn.setAttribute('aria-pressed', showGrid ? 'true' : 'false');
    }

    this.mobileUIManager?.setRulerGridActive?.(!!showGrid);

    // Update entry zone position buttons visibility
    const entryZonePosition = this.state.get('settings.entryZonePosition') || 'bottom';
    const entryZoneTopBtn = document.getElementById('btn-entry-zone-top');
    const entryZoneBottomBtn = document.getElementById('btn-entry-zone-bottom');
    const entryZoneLeftBtn = document.getElementById('btn-entry-zone-left');
    const entryZoneRightBtn = document.getElementById('btn-entry-zone-right');

    // Hide all position buttons first
    if (entryZoneTopBtn) entryZoneTopBtn.style.display = 'none';
    if (entryZoneBottomBtn) entryZoneBottomBtn.style.display = 'none';
    if (entryZoneLeftBtn) entryZoneLeftBtn.style.display = 'none';
    if (entryZoneRightBtn) entryZoneRightBtn.style.display = 'none';

    // Show only the buttons for OTHER positions
    if (entryZonePosition === 'top') {
      if (entryZoneBottomBtn) entryZoneBottomBtn.style.display = 'block';
      if (entryZoneLeftBtn) entryZoneLeftBtn.style.display = 'block';
      if (entryZoneRightBtn) entryZoneRightBtn.style.display = 'block';
    } else if (entryZonePosition === 'bottom') {
      if (entryZoneTopBtn) entryZoneTopBtn.style.display = 'block';
      if (entryZoneLeftBtn) entryZoneLeftBtn.style.display = 'block';
      if (entryZoneRightBtn) entryZoneRightBtn.style.display = 'block';
    } else if (entryZonePosition === 'left') {
      if (entryZoneTopBtn) entryZoneTopBtn.style.display = 'block';
      if (entryZoneBottomBtn) entryZoneBottomBtn.style.display = 'block';
      if (entryZoneRightBtn) entryZoneRightBtn.style.display = 'block';
    } else if (entryZonePosition === 'right') {
      if (entryZoneTopBtn) entryZoneTopBtn.style.display = 'block';
      if (entryZoneBottomBtn) entryZoneBottomBtn.style.display = 'block';
      if (entryZoneLeftBtn) entryZoneLeftBtn.style.display = 'block';
    }

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
      labelsToggleText.textContent = showItemLabels ? 'Hide Labels' : 'Show Labels';
    }

    const lockToggleText = document.getElementById('floorplan-lock-text');
    const lockIcon = document.getElementById('floorplan-lock-icon');
    const locked = this.state.get('layout.floorPlanLocked') !== false;

    if (lockToggleText) {
      lockToggleText.textContent = locked ? 'Unlock Floor Plan' : 'Lock Floor Plan';
    }

    if (lockIcon) {
      const lockedMarkup = `
        <rect x="5" y="11" width="14" height="10" rx="2"></rect>
        <path d="M7 11V7a5 5 0 0110 0v4"></path>
        <line x1="12" y1="16" x2="12" y2="18"></line>
        <circle cx="12" cy="16" r="1"></circle>
      `;
      const unlockedMarkup = `
        <rect x="5" y="11" width="14" height="10" rx="2"></rect>
        <path d="M17 11V7a5 5 0 10-9.33-3"></path>
        <line x1="12" y1="16" x2="12" y2="18"></line>
        <circle cx="12" cy="16" r="1"></circle>
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
    const dropdownTriggers = ['btn-view', 'btn-export', 'btn-zoom']
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!dropdownTriggers.length) return;

    const closeAll = (exception) => {
      document.querySelectorAll('.dropdown-menu.show').forEach((menu) => {
        if (menu !== exception) {
          menu.classList.remove('show');
        }
      });
    };

    dropdownTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        const dropdown = trigger.closest('.dropdown');
        const menu = dropdown?.querySelector('.dropdown-menu');
        if (!menu) return;

        const shouldOpen = !menu.classList.contains('show');
        closeAll(shouldOpen ? menu : null);
        if (shouldOpen) {
          menu.classList.add('show');
        }
      });
    });

    document.addEventListener('click', () => closeAll(null));
  }

  /**
   * Render floor plan list
   */
  renderFloorPlanList() {
    const container = document.getElementById('floorplan-list');
    if (!container) return;

    const floorPlans = this.floorPlanManager.getAllFloorPlans();
    const currentId = this.state.get('floorPlan')?.id;

    container.innerHTML = floorPlans
      .map(
        (fp) => `
      <div class="floorplan-item ${currentId === fp.id ? 'selected' : ''}" data-id="${fp.id}">
        <div class="floorplan-name">${fp.name}</div>
        <div class="floorplan-info">${fp.description}</div>
        <div class="floorplan-area">${fp.area} sq ft</div>
      </div>
    `,
      )
      .join('');

    // Add click handlers
    container.querySelectorAll('.floorplan-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.floorPlanManager.setFloorPlan(id);
        // Refresh floor plan list to update selected state
        this.renderFloorPlanList();
      });
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
          <div class="item-category">
            <div class="category-name">${category.name}</div>
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
                        <img src="${item.paletteImage}" loading="lazy" decoding="async" alt="${item.label}">
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

      if (newName && newName.trim() !== '') {
        this.updateProjectName(newName.trim());
        Modal.showSuccess('Project renamed successfully');
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

    // Delete
    const deleteBtn = document.getElementById('btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.selectionManager.deleteSelected());
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

    // Measurement tool
    const measureBtn = document.getElementById('btn-measure');
    if (measureBtn) {
      measureBtn.addEventListener('click', () => this.toggleMeasurementMode());
    }

    const rulerGridBtn = document.getElementById('btn-ruler-grid');
    if (rulerGridBtn) {
      rulerGridBtn.addEventListener('click', () => this.toggleRulerGrid());
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
      entryZoneTopBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'top');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    if (entryZoneBottomBtn) {
      entryZoneBottomBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'bottom');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    if (entryZoneLeftBtn) {
      entryZoneLeftBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'left');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    if (entryZoneRightBtn) {
      entryZoneRightBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'right');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    const toggleEntryLabelBtn = document.getElementById('btn-toggle-entry-label');
    if (toggleEntryLabelBtn) {
      toggleEntryLabelBtn.addEventListener('click', () => {
        const showLabel = this.state.get('settings.showEntryZoneLabel') !== false;
        this.state.set('settings.showEntryZoneLabel', !showLabel);
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    const toggleEntryBorderBtn = document.getElementById('btn-toggle-entry-border');
    if (toggleEntryBorderBtn) {
      toggleEntryBorderBtn.addEventListener('click', () => {
        const showBorder = this.state.get('settings.showEntryZoneBorder') !== false;
        this.state.set('settings.showEntryZoneBorder', !showBorder);
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
        this.saveHistorySnapshot();
      });
    }

    const toggleLabelsBtn = document.getElementById('btn-toggle-labels');
    if (toggleLabelsBtn) {
      toggleLabelsBtn.addEventListener('click', () => {
        const showLabels = this.state.get('settings.showItemLabels') !== false;
        this.state.set('settings.showItemLabels', !showLabels);
        document.getElementById('labels-toggle-text').textContent = showLabels
          ? 'Show Labels'
          : 'Hide Labels';
        this.canvasManager.toggleItemLabels(!showLabels);
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
    const selection = this.selectionManager.getSelection();

    const segments = [];

    if (floorPlan) {
      const floorPlanName =
        floorPlan.name || floorPlan.label || floorPlan.id || floorPlan.slug || 'Floor Plan';
      const floorDetails = [];
      if (floorPlan.widthFt && floorPlan.heightFt) {
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

    const selectedItem = selection.find(
      (obj) => obj && obj.customData && obj.customData.id && !obj.isMeasurementLabel,
    );

    if (selectedItem) {
      const itemData = selectedItem.customData || {};

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

  toggleSidebar(forceState) {
    const container = document.querySelector('.app-container');
    if (!container) return;

    const shouldCollapse =
      typeof forceState === 'boolean' ? forceState : !container.classList.contains('sidebar-collapsed');

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
    const name = projectName || 'Untitled Layout';

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

      const entryZonePosition = this.state.get('settings.entryZonePosition') || 'bottom';
      const layoutState = this.state.get('layout') || {};
      const floorPlanBounds = this._getValidFloorPlanBounds(layoutState.floorPlanBounds);

      // Check if any item is in the entry zone
      const hasViolation = items.some((item) => {
        if (
          !item ||
          !item.canvasObject ||
          typeof item.canvasObject.getBoundingRect !== 'function'
        ) {
          return false;
        }
        return Bounds.isInEntryZone(item.canvasObject, floorPlan, entryZonePosition, floorPlanBounds);
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

  /**
   * Setup mobile/responsive features
   */
  setupMobileFeatures() {
    // Cache DOM elements
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const sidebar = document.querySelector('.sidebar');
    const mobileToolbar = document.querySelector('.mobile-toolbar');

    // Handle viewport changes
    const handleViewportChange = () => {
      const width = window.innerWidth;

      // Show/hide mobile elements based on viewport
      if (width <= 767) {
        // Mobile/Tablet: Show hamburger, close button, backdrop
        if (mobileMenuToggle) mobileMenuToggle.style.display = 'inline-flex';
        if (sidebarClose) sidebarClose.style.display = 'flex';
        if (width <= 480 && mobileToolbar) mobileToolbar.style.display = 'flex';
      } else {
        // Desktop: Hide mobile elements
        if (mobileMenuToggle) mobileMenuToggle.style.display = 'none';
        if (sidebarClose) sidebarClose.style.display = 'none';
        if (mobileToolbar) mobileToolbar.style.display = 'none';
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
      }
    };

    // Sidebar toggle function
    const toggleSidebar = () => {
      if (sidebar && sidebarBackdrop) {
        const isActive = sidebar.classList.toggle('active');
        sidebarBackdrop.classList.toggle('active', isActive);

        // Prevent body scroll when sidebar is open
        document.body.classList.toggle('drawer-open', isActive);
      }
    };

    // Close sidebar
    const closeSidebar = () => {
      if (sidebar && sidebarBackdrop) {
        sidebar.classList.remove('active');
        sidebarBackdrop.classList.remove('active');
        document.body.classList.remove('drawer-open');
      }
    };

    // Hamburger menu toggle
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', toggleSidebar);
    }

    // Sidebar close button
    if (sidebarClose) {
      sidebarClose.addEventListener('click', closeSidebar);
    }

    // Backdrop click to close
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    // Close sidebar when selecting floor plan or item on mobile
    if (sidebar) {
      sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 767) {
          const isFloorPlanItem = e.target.closest('.floorplan-item');
          const isPaletteItem = e.target.closest('.palette-item');
          const isSavedLayout = e.target.closest('.saved-layout-item');

          if (isFloorPlanItem || isPaletteItem || isSavedLayout) {
            setTimeout(closeSidebar, 300); // Delay for better UX
          }
        }
      });
    }

    // Mobile toolbar button handlers
    const mobileBtnNew = document.getElementById('mobile-btn-new');
    const mobileBtnUndo = document.getElementById('mobile-btn-undo');
    const mobileBtnRedo = document.getElementById('mobile-btn-redo');
    const mobileBtnRotate = document.getElementById('mobile-btn-rotate');
    const mobileBtnDuplicate = document.getElementById('mobile-btn-duplicate');
    const mobileBtnDelete = document.getElementById('mobile-btn-delete');
    const mobileBtnMore = document.getElementById('mobile-btn-more');

    // Mobile toolbar: New button
    if (mobileBtnNew) {
      mobileBtnNew.addEventListener('click', async () => {
        const confirmed = await Modal.showConfirm(
          'Start New Layout?',
          "This will clear the current layout. Make sure you've saved your work.",
        );
        if (confirmed) {
          console.log('[App] Starting new layout (mobile)');

          // Clear everything (same as desktop version)
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
          this.syncViewDropdownUI();
          Modal.showSuccess('New layout started');
        }
      });
    }

    if (mobileBtnUndo) {
      mobileBtnUndo.addEventListener('click', () => this.historyManager.undo());
    }

    if (mobileBtnRedo) {
      mobileBtnRedo.addEventListener('click', () => this.historyManager.redo());
    }

    // Mobile toolbar: Rotate button
    if (mobileBtnRotate) {
      mobileBtnRotate.addEventListener('click', () => {
        const selection = this.canvasManager.getCanvas().getActiveObject();
        if (selection) {
          selection.rotate((selection.angle || 0) + 90);
          this.canvasManager.getCanvas().renderAll();

          // Update item position in state (including rotation)
          if (selection.customData && selection.customData.id) {
            this.updateItemPosition(
              selection.customData.id,
              selection.left,
              selection.top,
              selection.angle,
            );
          }

          this.saveHistorySnapshot();
        } else {
          Modal.showError('Please select an item to rotate');
        }
      });
    }

    // Mobile toolbar: Duplicate button
    if (mobileBtnDuplicate) {
      mobileBtnDuplicate.addEventListener('click', () => {
        const selection = this.canvasManager.getCanvas().getActiveObject();
        if (selection && selection.type === 'activeSelection') {
          this.selectionManager.duplicateSelected();
        } else if (selection && selection.customData) {
          this.eventBus.emit('item:duplicate:requested', {
            itemId: selection.customData.id,
            canvasObject: selection,
          });
        } else {
          Modal.showError('Please select an item to duplicate');
        }
      });
    }

    if (mobileBtnDelete) {
      mobileBtnDelete.addEventListener('click', () => {
        const selection = this.canvasManager.getCanvas().getActiveObject();
        if (selection) {
          this.eventBus.emit('item:delete:requested', selection.customData?.id);
        }
      });
    }

    if (mobileBtnMore) {
      mobileBtnMore.addEventListener('click', () => {
        this.showMobileMoreMenu();
      });
    }

    // Setup touch gestures for canvas
    this.setupTouchGestures();

    // Listen for viewport changes
    window.addEventListener('resize', handleViewportChange);
    handleViewportChange(); // Initial call
  }

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
    const entryLabelVisible = currentSettings.showEntryLabel !== false;
    const entryBorderVisible = currentSettings.showEntryBorder !== false;
    const itemLabelsVisible = currentSettings.showItemLabels !== false;
    const entryPosition = currentSettings.entryZonePosition || 'bottom';

    viewSection.innerHTML = `
      <div style="margin-bottom: 8px; color: #71717A; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
        VIEW OPTIONS
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <button class="dropdown-item" data-action="toggle-item-labels">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8,9H16V11H8V9M4,3H20A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3Z" /></svg>
          ${itemLabelsVisible ? 'Hide' : 'Show'} Labels
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
      this.state.set('settings.entryZonePosition', 'bottom');
      this.canvasManager.redrawFloorPlan();
      this.saveHistorySnapshot();
      Modal.close();
    };

    container.querySelector('[data-action="entry-left"]').onclick = () => {
      this.state.set('settings.entryZonePosition', 'left');
      this.canvasManager.redrawFloorPlan();
      this.saveHistorySnapshot();
      Modal.close();
    };

    container.querySelector('[data-action="entry-right"]').onclick = () => {
      this.state.set('settings.entryZonePosition', 'right');
      this.canvasManager.redrawFloorPlan();
      this.saveHistorySnapshot();
      Modal.close();
    };

    container.querySelector('[data-action="entry-top"]').onclick = () => {
      this.state.set('settings.entryZonePosition', 'top');
      this.canvasManager.redrawFloorPlan();
      this.saveHistorySnapshot();
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
        version: '2.1', // Center-based coordinate system
        timestamp: new Date().toISOString(),
        state: {
          floorPlan: state.floorPlan,
          items: state.items,
          settings: state.settings,
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
      const APP_VERSION = '2.1';
      if (savedData.version !== APP_VERSION) {
        console.log(
          '[App] Incompatible autosave version:',
          savedData.version,
          'expected:',
          APP_VERSION,
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

      // Must have a floor plan to restore
      if (!savedState.floorPlan) {
        console.log('[App] No floor plan in autosave, skipping');
        return false;
      }

      console.log('[App] Loading autosave from', savedData.timestamp);

      // Load state
      this.state.loadState(savedState);

      // Set floor plan (this internally calls centerAndFit)
      this.floorPlanManager.setFloorPlan(savedState.floorPlan.id);

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

      // Render canvas
      this.canvasManager.getCanvas().renderAll();

      // Apply label visibility setting
      const showLabels = this.state.get('settings.showItemLabels') !== false;
      this.canvasManager.toggleItemLabels(showLabels);

      // Sync project name from loaded state to UI
      this.updateProjectName(savedState.metadata?.projectName);

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
    const name = rawName ? rawName.trim() : '';
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
      Modal.showInfo('Your layouts will only be saved temporarily and will be lost when you reload this page');
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
    const areaSqFt = floorPlan.widthFt * floorPlan.heightFt;

    // Format door dimensions - check both key formats
    const doorWidth = floorPlan.doorWidth ?? floorPlan.doorWidthFt;
    const doorHeight = floorPlan.doorHeight ?? floorPlan.doorHeightFt;
    const doorInfo = doorWidth && doorHeight ? `${doorWidth}' × ${doorHeight}'` : 'N/A';

    // Create email content
    const subject = encodeURIComponent(`Storage Caves Garage Layout: ${projectName}`);

    const layoutInfo = `
Location: ${metadata.location || 'Buford, GA'}
Floor Plan: ${floorPlan.name}
Door: ${doorInfo}
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
      .map(
        (layout) => `
      <div class="saved-layout-item" data-id="${layout.id}">
        <div class="saved-layout-name">${layout.name}</div>
        <div class="saved-layout-date">${new Date(layout.created).toLocaleDateString()}</div>
        <div class="saved-layout-actions">
          <button class="btn-load-layout" data-id="${layout.id}">Load</button>
          <button class="btn-delete-layout" data-id="${layout.id}">Delete</button>
        </div>
      </div>
    `,
      )
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
