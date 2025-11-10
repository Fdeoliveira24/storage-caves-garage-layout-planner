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
    console.log('Initializing Garage Layout Planner...');

    // Initialize core
    this.state = new State();
    this.eventBus = new EventBus();

    // Initialize canvas manager
    this.canvasManager = new CanvasManager('canvas', this.state, this.eventBus);
    this.canvasManager.init();

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

    // Setup autosave
    this.setupAutosave();

    // Load last autosave if exists
    this.loadAutosave();

    console.log('Application initialized successfully');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Canvas events
    this.eventBus.on('canvas:object:modified', (obj) => {
      // Update item position in state when moved
      if (obj && obj.customData && obj.customData.id) {
        const center = obj.getCenterPoint();
        this.updateItemPosition(obj.customData.id, center.x, center.y, obj.angle || 0);
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
        
        // Show selected tab content
        const tabName = tab.dataset.tab;
        if (tabName === 'floorplans') {
          document.getElementById('floorplan-tab').classList.remove('hidden');
        } else if (tabName === 'items') {
          document.getElementById('items-tab').classList.remove('hidden');
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
          alert('Please select a floor plan first');
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
    const zoomInBtn = document.getElementById('btn-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.canvasManager.zoomIn());
    }

    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.canvasManager.zoomOut());
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
  }

  /**
   * Update info panel
   */
  updateInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    const floorPlan = this.state.get('floorPlan');
    const items = this.state.get('items') || [];
    const selection = this.selectionManager.getSelection();

    let html = '<div class="info-section">';

    if (floorPlan) {
      html += `
        <h3>Floor Plan</h3>
        <div>${floorPlan.name}</div>
        <div>${floorPlan.widthFt}' × ${floorPlan.heightFt}'</div>
        <div>${floorPlan.area} sq ft</div>
        <div>Items: ${items.length}</div>
      `;
    } else {
      html += '<div class="empty-state">Select a floor plan to begin</div>';
    }

    html += '</div>';

    if (selection.length > 0) {
      const item = selection[0];
      html += `
        <div class="info-section">
          <h3>Selected Item</h3>
          <div>${item.customData?.label || 'Unknown'}</div>
          <div>Position: ${Math.round(item.left)}, ${Math.round(item.top)}</div>
          <div>Angle: ${Math.round(item.angle || 0)}°</div>
        </div>
      `;
    }

    panel.innerHTML = html;
  }

  /**
   * Refresh canvas after undo/redo
   */
  refreshCanvas() {
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      this.canvasManager.clear();
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
      
      this.canvasManager.getCanvas().renderAll();
    }
    this.updateInfoPanel();
  }

  /**
   * Setup autosave
   */
  setupAutosave() {
    this.autosaveInterval = setInterval(() => {
      this.autosave();
    }, Config.AUTOSAVE_INTERVAL);
  }

  /**
   * Autosave
   */
  autosave() {
    const state = this.state.getState();
    state.version = '2.0'; // Mark version for compatibility check
    Storage.save(Config.STORAGE_KEYS.autosave, state);
  }

  /**
   * Load autosave
   */
  loadAutosave() {
    const savedState = Storage.load(Config.STORAGE_KEYS.autosave);
    
    // Check version and clear if incompatible
    const APP_VERSION = '2.0'; // Updated coordinate system
    console.log('Saved version:', savedState ? savedState.version : 'none', 'Current version:', APP_VERSION);
    
    if (savedState && savedState.version !== APP_VERSION) {
      console.log('Incompatible version detected, clearing autosave...');
      Storage.remove(Config.STORAGE_KEYS.autosave);
      return;
    }
    
    if (savedState && savedState.floorPlan) {
      console.log('Autosave found, loading...');
      this.state.loadState(savedState);
      if (savedState.floorPlan) {
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
        
        this.canvasManager.getCanvas().renderAll();
      }
    }
  }

  /**
   * Update item position in state after drag
   */
  updateItemPosition(itemId, x, y, angle) {
    const items = this.state.get('items') || [];
    const item = items.find(i => i.id === itemId);
    if (item) {
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
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.App = App;
}
