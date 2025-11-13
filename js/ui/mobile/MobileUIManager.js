/**
 * MobileUIManager - Professional Mobile Interface for Storage Caves
 * 
 * Architecture:
 * - Dedicated mobile containers (no style.display manipulation)
 * - Class-based toggling (.mobile-active, .mobile-hide-desktop)
 * - Explicit mobile rendering (no desktop tab .click() triggers)
 * - Uses existing managers through public APIs
 * - Clean teardown on viewport change
 */

class MobileUIManager {
  constructor(app) {
    this.app = app;
    this.state = app.state;
    this.eventBus = app.eventBus;
    
    // Manager references
    this.floorPlanManager = null;
    this.itemManager = null;
    this.canvasManager = null;
    this.historyManager = null;
    
    // Mobile state
    this.activeTab = 'floorplans';
    this.isMobile = false;
    this.initialized = false;
    
    // Mobile containers
    this.mobileContainer = null;
    this.tabBar = null;
    this.mobileToolbar = null;
    this.moreMenu = null;
    
    // Media query
    this.mediaQuery = window.matchMedia('(max-width: 767px)');
    
    // Bind methods
    this.handleMediaChange = this.handleMediaChange.bind(this);
    this.handleTabClick = this.handleTabClick.bind(this);
  }
  
  /**
   * Initialize mobile UI (only if mobile viewport)
   */
  init() {
    this.isMobile = this.mediaQuery.matches;
    
    if (!this.isMobile) {
      console.log('[MobileUI] Desktop viewport detected');
      return;
    }
    
    if (this.initialized) return;
    
    console.log('[MobileUI] Initializing mobile interface');
    
    // Wait for managers
    setTimeout(() => {
      this.cacheManagers();
      this.createMobileContainers();
      this.applyMobileClasses();
      this.setupEventListeners();
      this.renderInitialTab();
      this.initialized = true;
      console.log('[MobileUI] Mobile interface ready');
    }, 100);
    
    // Listen for viewport changes
    this.mediaQuery.addEventListener('change', this.handleMediaChange);
  }
  
  /**
   * Cache manager references
   */
  cacheManagers() {
    this.floorPlanManager = this.app.floorPlanManager;
    this.itemManager = this.app.itemManager;
    this.canvasManager = this.app.canvasManager;
    this.historyManager = this.app.historyManager;
  }
  
  /**
   * Create dedicated mobile containers
   */
  createMobileContainers() {
    // Main mobile container
    this.mobileContainer = document.createElement('div');
    this.mobileContainer.id = 'mobile-ui-container';
    this.mobileContainer.className = 'mobile-ui-container';
    
    // Mobile content area for floor plans and items
    this.mobileContainer.innerHTML = `
      <div id="mobile-content" class="mobile-content">
        <div id="mobile-floor-plans-view" class="mobile-view"></div>
        <div id="mobile-items-view" class="mobile-view"></div>
        <div id="mobile-saved-view" class="mobile-view"></div>
        <div id="mobile-more-view" class="mobile-view"></div>
      </div>
    `;
    
    document.body.appendChild(this.mobileContainer);
    
    // Create bottom tab bar
    this.createTabBar();
    
    // Create mobile toolbar (for canvas actions)
    this.createMobileToolbar();
  }
  
  /**
   * Apply mobile CSS classes (no style.display)
   */
  applyMobileClasses() {
    document.body.classList.add('mobile-layout');
    
    // Mark desktop elements to hide on mobile (via CSS)
    const desktopElements = [
      '.sidebar',
      '.toolbar',
      '.header',
      '.info-bar'
    ];
    
    desktopElements.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) el.classList.add('mobile-hide-desktop');
    });
  }
  
  /**
   * Create bottom tab navigation
   */
  createTabBar() {
    this.tabBar = document.createElement('nav');
    this.tabBar.id = 'mobile-tab-bar';
    this.tabBar.className = 'mobile-tab-bar';
    this.tabBar.innerHTML = `
      <button class="mobile-tab mobile-tab-active" data-tab="floorplans">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
        <span>Plans</span>
      </button>
      <button class="mobile-tab" data-tab="items">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>Items</span>
      </button>
      <button class="mobile-tab" data-tab="saved">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
        </svg>
        <span>Saved</span>
      </button>
      <button class="mobile-tab" data-tab="canvas">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        </svg>
        <span>Canvas</span>
      </button>
      <button class="mobile-tab" data-tab="more">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
        <span>More</span>
      </button>
    `;
    
    document.body.appendChild(this.tabBar);
  }
  
  /**
   * Create mobile toolbar for canvas actions
   */
  createMobileToolbar() {
    this.mobileToolbar = document.createElement('div');
    this.mobileToolbar.id = 'mobile-toolbar';
    this.mobileToolbar.className = 'mobile-toolbar';
    this.mobileToolbar.innerHTML = `
      <div class="mobile-toolbar-row">
        <button class="mobile-tool-btn" data-action="zoom-out" title="Zoom Out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="mobile-tool-btn" data-action="zoom-in" title="Zoom In">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="mobile-tool-btn" data-action="fit-view" title="Fit to View">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
        </button>
      </div>
      <div class="mobile-toolbar-row">
        <button class="mobile-tool-btn" data-action="undo" title="Undo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        </button>
        <button class="mobile-tool-btn" data-action="redo" title="Redo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
          </svg>
        </button>
        <button class="mobile-tool-btn" data-action="rotate" title="Rotate 90°">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
        </button>
        <button class="mobile-tool-btn" data-action="duplicate" title="Duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      </div>
      <div class="mobile-toolbar-row">
        <button class="mobile-tool-btn" data-action="bring-front" title="Bring to Front">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>
          </svg>
        </button>
        <button class="mobile-tool-btn" data-action="send-back" title="Send to Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>
          </svg>
        </button>
        <button class="mobile-tool-btn mobile-tool-danger" data-action="delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    `;
    
    document.body.appendChild(this.mobileToolbar);
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab navigation
    if (this.tabBar) {
      this.tabBar.addEventListener('click', this.handleTabClick);
    }
    
    // Toolbar actions
    if (this.mobileToolbar) {
      this.mobileToolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.mobile-tool-btn');
        if (btn) this.handleToolAction(btn.dataset.action);
      });
    }
    
    // Listen to manager events
    this.eventBus.on('floorplan:changed', () => this.onFloorPlanSelected());
    this.eventBus.on('item:added', () => this.onItemAdded());
  }
  
  /**
   * Handle tab click
   */
  handleTabClick(e) {
    const tab = e.target.closest('.mobile-tab');
    if (!tab) return;
    
    const tabName = tab.dataset.tab;
    this.switchTab(tabName);
  }
  
  /**
   * Switch tabs
   */
  switchTab(tabName) {
    this.activeTab = tabName;
    
    // Update tab bar
    this.tabBar.querySelectorAll('.mobile-tab').forEach(t => {
      t.classList.toggle('mobile-tab-active', t.dataset.tab === tabName);
    });
    
    // Toggle views via CSS classes
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const mobileContent = document.getElementById('mobile-content');
    
    if (tabName === 'canvas') {
      // Show canvas
      if (canvasWrapper) canvasWrapper.classList.add('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.remove('mobile-show-content');
      if (this.mobileToolbar) this.mobileToolbar.classList.add('mobile-show-toolbar');
    } else {
      // Show mobile content area
      if (canvasWrapper) canvasWrapper.classList.remove('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.add('mobile-show-content');
      if (this.mobileToolbar) this.mobileToolbar.classList.remove('mobile-show-toolbar');
      
      // Show appropriate view
      const views = document.querySelectorAll('.mobile-view');
      views.forEach(v => v.classList.remove('mobile-view-active'));
      
      if (tabName === 'floorplans') {
        document.getElementById('mobile-floor-plans-view')?.classList.add('mobile-view-active');
        this.renderFloorPlans();
      } else if (tabName === 'items') {
        document.getElementById('mobile-items-view')?.classList.add('mobile-view-active');
        this.renderItems();
      } else if (tabName === 'saved') {
        document.getElementById('mobile-saved-view')?.classList.add('mobile-view-active');
        this.renderSaved();
      } else if (tabName === 'more') {
        document.getElementById('mobile-more-view')?.classList.add('mobile-view-active');
        this.renderMore();
      }
    }
  }
  
  /**
   * Render initial tab
   */
  renderInitialTab() {
    // Show mobile content area
    const mobileContent = document.getElementById('mobile-content');
    if (mobileContent) {
      mobileContent.classList.add('mobile-show-content');
    }
    
    // Render floor plans tab
    this.switchTab('floorplans');
  }
  
  /**
   * Render floor plans view
   */
  renderFloorPlans() {
    const container = document.getElementById('mobile-floor-plans-view');
    if (!container) return;
    
    // Get floor plans from manager (NOT window.FLOOR_PLANS)
    const floorPlans = this.floorPlanManager?.getAllFloorPlans() || [];
    const currentPlan = this.state.get('floorPlan');
    
    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Floor Plans</h2>
        <p>Select a garage layout</p>
      </div>
      <div class="mobile-floor-plan-list">
        ${floorPlans.map(plan => `
          <button class="mobile-floor-plan-card ${currentPlan?.id === plan.id ? 'mobile-card-selected' : ''}" 
                  data-floor-plan-id="${plan.id}">
            <div class="mobile-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </div>
            <h3>${plan.name}</h3>
            <div class="mobile-card-meta">
              <span>${plan.widthFt}' × ${plan.heightFt}'</span>
              <span>${plan.description}</span>
              <span>${plan.area} sq ft</span>
            </div>
          </button>
        `).join('')}
      </div>
    `;
    
    // Setup floor plan click handlers
    container.querySelectorAll('.mobile-floor-plan-card').forEach(card => {
      card.addEventListener('click', () => {
        const planId = card.dataset.floorPlanId;
        this.selectFloorPlan(planId);
      });
    });
  }
  
  /**
   * Render items view
   */
  renderItems() {
    const container = document.getElementById('mobile-items-view');
    if (!container || !this.itemManager) return;
    
    // Get items from Items.getAll() (loaded from js/data/items.js)
    const items = window.Items?.getAll() || [];
    
    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Items</h2>
        <p>Add items to your layout</p>
      </div>
      <div class="mobile-item-list">
        ${items.map(item => `
          <button class="mobile-item-card" data-item-id="${item.id}">
            <div class="mobile-card-image">
              <img src="${item.paletteImage}" alt="${item.label}" loading="lazy" onerror="this.style.display='none'">
            </div>
            <h4>${item.label}</h4>
            <span class="mobile-item-size">${item.lengthFt}' × ${item.widthFt}'</span>
          </button>
        `).join('')}
      </div>
    `;
    
    // Setup item click handlers
    container.querySelectorAll('.mobile-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const itemId = card.dataset.itemId;
        this.addItem(itemId);
      });
    });
  }
  
  /**
   * Render more menu
   */
  renderMore() {
    const container = document.getElementById('mobile-more-view');
    if (!container) return;
    
    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Actions</h2>
        <p>Export and manage your layout</p>
      </div>
      <div class="mobile-more-list">
        <button class="mobile-more-item" data-action="export-png">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Export as PNG</span>
        </button>
        <button class="mobile-more-item" data-action="export-pdf">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Export as PDF</span>
        </button>
        <button class="mobile-more-item mobile-json-export" data-action="export-json">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
          </svg>
          <span>Export as JSON</span>
        </button>
        <button class="mobile-more-item" data-action="share-email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span>Share via Email</span>
        </button>
        <button class="mobile-more-item" data-action="new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New Layout</span>
        </button>
      </div>
    `;
    
    // Setup more item click handlers
    container.querySelectorAll('.mobile-more-item').forEach(item => {
      item.addEventListener('click', () => {
        this.handleMoreAction(item.dataset.action);
      });
    });
  }
  
  /**
   * Render saved layouts
   */
  renderSaved() {
    const container = document.getElementById('mobile-saved-view');
    if (!container) return;
    
    const layouts = window.Storage?.load(window.Config?.STORAGE_KEYS?.layouts) || [];
    
    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Saved Layouts</h2>
        <p>Load or manage saved layouts</p>
      </div>
      <div class="mobile-saved-list">
        ${layouts.length === 0 ? `
          <div class="mobile-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <p>No saved layouts</p>
            <p style="font-size: 12px; margin-top: 8px;">Save your current layout from the More tab</p>
          </div>
        ` : layouts.map(layout => `
          <div class="mobile-saved-item">
            <div class="mobile-saved-info">
              <div class="mobile-saved-name">${layout.name}</div>
              <div class="mobile-saved-date">${new Date(layout.created).toLocaleDateString()}</div>
            </div>
            <div class="mobile-saved-actions">
              <button class="mobile-btn-load" data-layout-id="${layout.id}">Load</button>
              <button class="mobile-btn-delete" data-layout-id="${layout.id}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Setup load handlers
    container.querySelectorAll('.mobile-btn-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const layoutId = btn.dataset.layoutId;
        if (this.app && this.app.loadLayout) {
          this.app.loadLayout(layoutId);
        }
      });
    });
    
    // Setup delete handlers
    container.querySelectorAll('.mobile-btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const layoutId = btn.dataset.layoutId;
        if (this.app && this.app.deleteLayout) {
          const confirmed = await window.Modal?.showConfirm(
            'Delete Layout?',
            'Are you sure you want to delete this layout? This cannot be undone.'
          );
          if (confirmed) {
            this.app.deleteLayout(layoutId);
            // Re-render after delete
            this.renderSaved();
          }
        }
      });
    });
  }
  
  /**
   * Select floor plan
   */
  selectFloorPlan(planId) {
    if (this.floorPlanManager) {
      this.floorPlanManager.setFloorPlan(planId);
    }
  }
  
  /**
   * Add item to canvas
   */
  addItem(itemId) {
    if (this.itemManager) {
      this.itemManager.addItem(itemId);
    }
  }
  
  /**
   * Handle toolbar actions
   */
  handleToolAction(action) {
    switch (action) {
      case 'zoom-in':
        this.canvasManager?.zoomIn();
        break;
      case 'zoom-out':
        this.canvasManager?.zoomOut();
        break;
      case 'fit-view':
        this.canvasManager?.resetViewport();
        break;
      case 'undo':
        this.historyManager?.undo();
        break;
      case 'redo':
        this.historyManager?.redo();
        break;
      case 'rotate':
        this.app.rotateSelection?.();
        break;
      case 'duplicate':
        this.app.duplicateSelection?.();
        break;
      case 'bring-front':
        this.app.bringToFront?.();
        break;
      case 'send-back':
        this.app.sendToBack?.();
        break;
      case 'delete':
        this.app.deleteSelection?.();
        break;
    }
  }
  
  /**
   * Handle more menu actions
   */
  handleMoreAction(action) {
    const actions = {
      'export-png': '#btn-export-png',
      'export-pdf': '#btn-export-pdf',
      'export-json': '#btn-export-json',
      'share-email': '#btn-share-email',
      'new': '#btn-new'
    };
    
    const btn = document.querySelector(actions[action]);
    if (btn) btn.click();
  }
  
  /**
   * Event handlers
   */
  onFloorPlanSelected() {
    // Auto-switch to canvas after selecting floor plan
    setTimeout(() => this.switchTab('canvas'), 300);
  }
  
  onItemAdded() {
    // Auto-switch to canvas after adding item
    setTimeout(() => this.switchTab('canvas'), 300);
  }
  
  /**
   * Handle viewport change
   */
  handleMediaChange(e) {
    if (e.matches && !this.initialized) {
      this.init();
    } else if (!e.matches && this.initialized) {
      this.destroy();
    }
  }
  
  /**
   * Clean up mobile UI
   */
  destroy() {
    console.log('[MobileUI] Destroying mobile interface');
    
    // Remove mobile classes
    document.body.classList.remove('mobile-layout');
    
    // Remove mobile-hide-desktop classes
    document.querySelectorAll('.mobile-hide-desktop').forEach(el => {
      el.classList.remove('mobile-hide-desktop');
    });
    
    // Remove mobile containers
    this.mobileContainer?.remove();
    this.tabBar?.remove();
    this.mobileToolbar?.remove();
    
    this.initialized = false;
  }
}

window.MobileUIManager = MobileUIManager;
