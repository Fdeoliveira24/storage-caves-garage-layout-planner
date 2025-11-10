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
    this.autosaveInterval = null;
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
    
    // Ensure viewport starts at default state
    this.canvasManager.resetViewport();

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

    // Setup dropdown menus
    this.setupDropdowns();

    // Initialize UI
    this.initializeUI();

    // Setup autosave
    this.setupAutosave();

    // Load last autosave if exists
    this.loadAutosave();

    // Save initial state to history
    this.historyManager.save();

    // Application initialized successfully
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
      this.historyManager.save();
    });

    // Item events
    this.eventBus.on('item:added', () => {
      this.historyManager.save();
      this.updateInfoPanel();
    });

    this.eventBus.on('item:removed', () => {
      this.historyManager.save();
      this.updateInfoPanel();
    });

    this.eventBus.on('item:delete:requested', (itemId) => {
      this.itemManager.removeItem(itemId);
    });

    this.eventBus.on('item:duplicate:requested', (itemId) => {
      this.itemManager.duplicateItem(itemId);
    });

    this.eventBus.on('item:paste:requested', (itemData) => {
      // Add pasted item with offset (x,y are already center coordinates from copySelected)
      const newItem = this.itemManager.addItem(itemData.itemId, itemData.x + 20, itemData.y + 20);
      if (newItem && newItem.canvasObject) {
        newItem.canvasObject.rotate(itemData.angle);
        this.canvasManager.getCanvas().renderAll();
      }
    });

    // Floor plan events
    this.eventBus.on('floorplan:changed', () => {
      this.historyManager.save();
      this.updateInfoPanel();
    });

    // Selection events
    this.eventBus.on('canvas:selection:created', () => {
      this.updateInfoPanel();
    });

    this.eventBus.on('canvas:selection:cleared', () => {
      this.updateInfoPanel();
    });

    // History events
    this.eventBus.on('history:undo', () => {
      this.refreshCanvas();
    });

    this.eventBus.on('history:redo', () => {
      this.refreshCanvas();
    });

    // Zoom events
    this.eventBus.on('canvas:zoomed', (zoom) => {
      this.updateZoomDisplay(zoom);
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

      // Esc - Deselect
      if (e.key === 'Escape') {
        this.selectionManager.deselectAll();
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
   * Initialize UI
   */
  initializeUI() {
    this.renderFloorPlanList();
    this.renderItemPalette();
    this.updateInfoPanel();
    this.setupToolbarHandlers();
    this.setupTabSwitching();
    this.syncViewDropdownUI();
  }

  /**
   * Sync View dropdown UI with current settings
   */
  syncViewDropdownUI() {
    // Update grid toggle text
    const showGrid = this.state.get('settings.showGrid');
    const gridToggleText = document.getElementById('grid-toggle-text');
    if (gridToggleText) {
      gridToggleText.textContent = showGrid ? 'Hide Grid' : 'Show Grid';
    }

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
      entryBorderToggleText.textContent = showEntryBorder ? 'Hide Entry Border' : 'Show Entry Border';
    }
  }

  /**
   * Setup tab switching
   */
  setupTabSwitching() {
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        
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

  /**
   * Render floor plan list
   */
  renderFloorPlanList() {
    const container = document.getElementById('floorplan-list');
    if (!container) return;

    const floorPlans = this.floorPlanManager.getAllFloorPlans();
    const currentId = this.state.get('floorPlan')?.id;
    
    container.innerHTML = floorPlans.map(fp => `
      <div class="floorplan-item ${currentId === fp.id ? 'selected' : ''}" data-id="${fp.id}">
        <div class="floorplan-name">${fp.name}</div>
        <div class="floorplan-info">${fp.description}</div>
        <div class="floorplan-area">${fp.area} sq ft</div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.floorplan-item').forEach(item => {
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
    
    container.innerHTML = categories.map(catName => {
      const category = Items.categories[catName];
      return `
        <div class="item-category">
          <div class="category-name">${category.name}</div>
          <div class="category-items">
            ${category.items.map(item => `
              <div class="palette-item" data-id="${item.id}" 
                   style="background-color: ${item.color}20; border-color: ${item.color}">
                <div class="item-label">${item.label}</div>
                <div class="item-size">${item.lengthFt}' × ${item.widthFt}'</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Make items draggable
    container.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const itemId = item.dataset.id;
        const floorPlan = this.state.get('floorPlan');
        
        if (!floorPlan) {
          Modal.showInfo('Please select a floor plan first');
          return;
        }

        // Add item to center of canvas
        const centerX = Helpers.feetToPx(floorPlan.widthFt) / 2;
        const centerY = Helpers.feetToPx(floorPlan.heightFt) / 2;
        
        this.itemManager.addItem(itemId, centerX, centerY);
      });
    });
  }

  /**
   * Setup toolbar handlers
   */
  setupToolbarHandlers() {
    // New layout
    const newBtn = document.getElementById('btn-new');
    if (newBtn) {
      newBtn.addEventListener('click', async () => {
        const confirmed = await Modal.showConfirm(
          'Start New Layout?',
          'Any unsaved changes will be lost. Are you sure?'
        );
        if (confirmed) {
          // [App] Starting new layout
          
          // Clear everything
          this.state.reset();
          this.canvasManager.clear();
          
          // Ensure viewport is reset (clear() already does this, but be explicit)
          this.canvasManager.resetViewport();
          
          // Show empty state
          this.canvasManager.showEmptyState();
          
          this.renderFloorPlanList();
          this.updateInfoPanel();
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

    // Export JSON
    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportManager.exportJSON());
    }

    // Export PNG
    const exportPngBtn = document.getElementById('btn-export-png');
    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => this.exportManager.exportPNG(2));
    }

    // Export PDF
    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportManager.exportPDF());
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

    // View controls
    const toggleGridBtn = document.getElementById('btn-toggle-grid');
    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', () => {
        this.canvasManager.toggleGrid();
        const showGrid = this.state.get('settings.showGrid');
        document.getElementById('grid-toggle-text').textContent = showGrid ? 'Hide Grid' : 'Show Grid';
      });
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
      });
    }
    
    if (entryZoneBottomBtn) {
      entryZoneBottomBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'bottom');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
      });
    }
    
    if (entryZoneLeftBtn) {
      entryZoneLeftBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'left');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
      });
    }
    
    if (entryZoneRightBtn) {
      entryZoneRightBtn.addEventListener('click', () => {
        this.state.set('settings.entryZonePosition', 'right');
        this.canvasManager.redrawFloorPlan();
        this.syncViewDropdownUI();
      });
    }

    const toggleEntryLabelBtn = document.getElementById('btn-toggle-entry-label');
    if (toggleEntryLabelBtn) {
      toggleEntryLabelBtn.addEventListener('click', () => {
        const showLabel = this.state.get('settings.showEntryZoneLabel') !== false;
        this.state.set('settings.showEntryZoneLabel', !showLabel);
        this.canvasManager.redrawFloorPlan();
        document.getElementById('entry-label-toggle-text').textContent = showLabel ? 'Show Entry Label' : 'Hide Entry Label';
      });
    }

    const toggleEntryBorderBtn = document.getElementById('btn-toggle-entry-border');
    if (toggleEntryBorderBtn) {
      toggleEntryBorderBtn.addEventListener('click', () => {
        const showBorder = this.state.get('settings.showEntryZoneBorder') !== false;
        this.state.set('settings.showEntryZoneBorder', !showBorder);
        this.canvasManager.redrawFloorPlan();
        document.getElementById('entry-border-toggle-text').textContent = showBorder ? 'Show Entry Border' : 'Hide Entry Border';
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
      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Floor:</span>
          <span class="info-bar__value">${floorPlan.widthFt}' × ${floorPlan.heightFt}' (${floorPlan.area} sq ft)</span>
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

    if (selection.length > 0) {
      const item = selection[0];
      const itemData = item.customData || {};
      
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

      const posX = ((item.left - (floorPlan?.canvasBounds?.left || 0)) / 10).toFixed(1);
      const posY = ((item.top - (floorPlan?.canvasBounds?.top || 0)) / 10).toFixed(1);
      
      segments.push(`
        <div class="info-bar__segment">
          <span class="info-bar__label">Position:</span>
          <span class="info-bar__value">${posX}' from left, ${posY}' from top</span>
        </div>
      `);
    }

    const divider = '<span class="info-bar__divider"></span>';
    panel.innerHTML = segments.join(divider);
  }

  /**
   * Update zoom percentage display in toolbar
   */
  updateZoomDisplay(zoom) {
    let zoomPercent = Math.round(zoom * 100);
    
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
   * Refresh canvas after undo/redo
   */
  /**
   * Refresh canvas - redraw everything from state
   * Used after undo/redo operations
   */
  refreshCanvas() {
    // [App] Refreshing canvas from state
    
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      // Clear canvas (this resets viewport)
      this.canvasManager.clear();
      
      // Ensure viewport is at default state
      this.canvasManager.resetViewport();
      
      // Draw floor plan
      this.canvasManager.drawFloorPlan(floorPlan);
      
      // Re-add items from state
      const items = this.state.get('items') || [];
      items.forEach(item => {
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
          metadata: state.metadata
        }
        // NOTE: Viewport (zoom/pan) is intentionally NOT saved
      };
      
      Storage.save(Config.STORAGE_KEYS.autosave, autosaveData);
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
    try {
      const savedData = Storage.load(Config.STORAGE_KEYS.autosave);
      
      if (!savedData) {
        // [App] No autosave found
        return;
      }
      
      // Validate version
      const APP_VERSION = '2.1';
      if (savedData.version !== APP_VERSION) {
        // [App] Incompatible autosave version
        Storage.remove(Config.STORAGE_KEYS.autosave);
        return;
      }
      
      // Validate timestamp (ignore if > 7 days old)
      if (savedData.timestamp) {
        const savedDate = new Date(savedData.timestamp);
        const daysSinceAutosave = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceAutosave > 7) {
          // [App] Autosave expired (>7 days old), clearing...
          Storage.remove(Config.STORAGE_KEYS.autosave);
          return;
        }
      }
      
      // Validate required data
      if (!savedData.state) {
        // [App] Invalid autosave structure, missing state
        Storage.remove(Config.STORAGE_KEYS.autosave);
        return;
      }
      
      const savedState = savedData.state;
      
      // Must have a floor plan to restore
      if (!savedState.floorPlan) {
        // [App] No floor plan in autosave, skipping
        return;
      }
      
      // [App] Loading autosave from timestamp
      
      // Load state
      this.state.loadState(savedState);
      
      // CRITICAL: Reset viewport BEFORE drawing anything
      this.canvasManager.resetViewport();
      
      // Set floor plan
      this.floorPlanManager.setFloorPlan(savedState.floorPlan.id);
      
      // Restore items
      const items = savedState.items || [];
      items.forEach(item => {
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
      
      // Final viewport reset to ensure clean state
      this.canvasManager.resetViewport();
      
      // Render canvas
      this.canvasManager.getCanvas().renderAll();
      
      // [App] Autosave loaded successfully
      
    } catch (error) {
      console.error('[App] Failed to load autosave:', error);
      // [App] Clearing corrupted autosave data
      Storage.remove(Config.STORAGE_KEYS.autosave);
    }
  }

  /**
   * Update item position in state after drag
   * x, y are center coordinates (object uses originX/Y: 'center')
   */
  updateItemPosition(itemId, x, y, angle) {
    const items = this.state.get('items') || [];
    const item = items.find(i => i.id === itemId);
    if (item) {
      // Store center coordinates
      item.x = x;
      item.y = y;
      item.angle = angle;
      this.state.setState({ items });
    }
  }

  /**
   * Save layout
   */
  async saveLayout() {
    const name = await Modal.showPrompt('Save Layout', 'Enter layout name:');
    if (!name) return;

    const state = this.state.getState();
    const layouts = Storage.load(Config.STORAGE_KEYS.layouts) || [];
    
    layouts.push({
      id: Helpers.generateId('layout'),
      name: name,
      created: new Date().toISOString(),
      state: state,
      thumbnail: this.exportManager.generateThumbnail()
    });

    Storage.save(Config.STORAGE_KEYS.layouts, layouts);
    Modal.showSuccess('Layout saved successfully!');
    
    this.renderSavedLayouts();
  }

  /**
   * Render saved layouts list
   */
  renderSavedLayouts() {
    const container = document.getElementById('saved-layouts-list');
    if (!container) return;

    const layouts = Storage.load(Config.STORAGE_KEYS.layouts) || [];
    
    if (layouts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No saved layouts</p>
          <p style="font-size: 12px; margin-top: 8px;">Click the Save button to save your current layout</p>
        </div>
      `;
      return;
    }

    container.innerHTML = layouts.map(layout => `
      <div class="saved-layout-item" data-id="${layout.id}">
        <div class="saved-layout-name">${layout.name}</div>
        <div class="saved-layout-date">${new Date(layout.created).toLocaleDateString()}</div>
        <div class="saved-layout-actions">
          <button class="btn-load-layout" data-id="${layout.id}">Load</button>
          <button class="btn-delete-layout" data-id="${layout.id}">Delete</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-load-layout').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.loadLayout(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-delete-layout').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const confirmed = await Modal.showConfirm(
          'Delete Layout?',
          'Are you sure you want to delete this layout? This cannot be undone.'
        );
        if (confirmed) {
          this.deleteLayout(btn.dataset.id);
        }
      });
    });
  }

  /**
   * Load a saved layout
   */
  /**
   * Load a saved layout
   * Validates data and resets viewport
   */
  async loadLayout(layoutId) {
    try {
      const layouts = Storage.load(Config.STORAGE_KEYS.layouts) || [];
      const layout = layouts.find(l => l.id === layoutId);
      
      if (!layout) {
        Modal.showError('Layout not found');
        return;
      }

      const confirmed = await Modal.showConfirm(
        'Load Layout?',
        'This will replace your current layout. Any unsaved changes will be lost.'
      );
      
      if (!confirmed) return;

      // [App] Loading layout: id
      
      // Validate layout data
      if (!layout.state || !layout.state.floorPlan) {
        Modal.showError('Invalid layout data');
        return;
      }

      // Load state
      this.state.loadState(layout.state);
      
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
    let layouts = Storage.load(Config.STORAGE_KEYS.layouts) || [];
    layouts = layouts.filter(l => l.id !== layoutId);
    Storage.save(Config.STORAGE_KEYS.layouts, layouts);
    
    this.renderSavedLayouts();
    Modal.showSuccess('Layout deleted');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.App = App;
}
