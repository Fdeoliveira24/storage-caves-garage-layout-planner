/**
 * MobileUIManager - Manages mobile-specific UI components and interactions
 * Activated only on mobile devices (max-width: 767px)
 */

class MobileUIManager {
  constructor(app) {
    this.app = app;
    this.state = app.state;
    this.eventBus = app.eventBus;
    
    // Mobile-specific state
    this.mobileState = {
      activeTab: 'canvas',
      fabOpen: false,
      activeSheet: null,
      searchQuery: '',
      activeCategory: 'all'
    };
    
    // Component references
    this.tabBar = null;
    this.fab = null;
    this.bottomSheet = null;
    this.pages = {};
    
    // Media query for mobile detection
    this.mobileMediaQuery = window.matchMedia('(max-width: 767px)');
    this.isMobile = this.mobileMediaQuery.matches;
    
    // Bind methods
    this.handleMediaChange = this.handleMediaChange.bind(this);
    this.handleTabClick = this.handleTabClick.bind(this);
    this.handleFabClick = this.handleFabClick.bind(this);
  }
  
  /**
   * Initialize mobile UI
   */
  init() {
    // Only initialize if mobile
    if (!this.isMobile) {
      console.log('[MobileUI] Desktop detected, skipping mobile init');
      return;
    }
    
    console.log('[MobileUI] Initializing mobile interface');
    
    // Setup DOM elements
    this.setupMobileDom();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Listen for viewport changes
    this.mobileMediaQuery.addEventListener('change', this.handleMediaChange);
    
    // Initialize views
    this.initializeViews();
    
    // Set initial tab
    this.switchTab('canvas');
    
    console.log('[MobileUI] Mobile interface initialized');
  }
  
  /**
   * Setup mobile DOM structure
   */
  setupMobileDom() {
    // Hide desktop elements
    const sidebar = document.querySelector('.sidebar');
    const toolbar = document.querySelector('.toolbar');
    const header = document.querySelector('.header');
    
    if (sidebar) sidebar.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (header) header.style.display = 'none';
    
    // Create mobile container if doesn't exist
    if (!document.getElementById('mobile-container')) {
      const container = document.createElement('div');
      container.id = 'mobile-container';
      container.className = 'mobile-only';
      document.querySelector('.app-container').appendChild(container);
      
      container.innerHTML = `
        <!-- Mobile Pages -->
        <div id="mobile-page-floor-plans" class="mobile-page">
          <div class="mobile-page-header">
            <h1 class="mobile-page-title">Floor Plans</h1>
            <p class="mobile-page-subtitle">Select a floor plan to start</p>
          </div>
          <div id="mobile-floor-plan-list" class="mobile-floor-plan-grid"></div>
        </div>
        
        <div id="mobile-page-items" class="mobile-page">
          <div class="mobile-page-header">
            <h1 class="mobile-page-title">Items</h1>
            <p class="mobile-page-subtitle">Add items to your layout</p>
          </div>
          <div class="mobile-search-bar">
            <div class="mobile-search-input-wrapper">
              <input 
                type="search" 
                id="mobile-search-input" 
                class="mobile-search-input" 
                placeholder="Search items..."
                autocomplete="off"
              />
              <svg class="mobile-search-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
              <button class="mobile-search-clear" type="button">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="mobile-category-filter" id="mobile-category-filter"></div>
          <div id="mobile-item-list" class="mobile-item-grid"></div>
        </div>
        
        <div id="mobile-page-canvas" class="mobile-page active">
          <div class="mobile-page-header">
            <h1 class="mobile-page-title" id="mobile-canvas-title">Start Planning</h1>
            <p class="mobile-page-subtitle" id="mobile-canvas-subtitle">Select a floor plan from the Floor Plans tab</p>
          </div>
        </div>
        
        <div id="mobile-page-more" class="mobile-page">
          <div class="mobile-page-header">
            <h1 class="mobile-page-title">More</h1>
            <p class="mobile-page-subtitle">Settings and actions</p>
          </div>
          <div class="mobile-bottom-sheet-content" id="mobile-more-content"></div>
        </div>
        
        <!-- Bottom Tab Bar -->
        <div class="mobile-tab-bar">
          <button class="mobile-tab" data-tab="floor-plans">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,9.3V4H12.7L19,9.3M20,10.2L14,4.2V4C14,2.9 13.1,2 12,2H4C2.9,2 2,2.9 2,4V20C2,21.1 2.9,22 4,22H20C21.1,22 22,21.1 22,20V12C22,11.3 21.8,10.6 21.4,10C21.1,10.1 20.5,10.2 20,10.2M4,20V4H11V9H16V15H13.5C12.7,15 12,15.7 12,16.5V18H10.5C9.7,18 9,18.7 9,19.5V20H4M20,20H11V19.5C11,19.2 11.2,19 11.5,19H13V16.5C13,16.2 13.2,16 13.5,16H16V11.2L20,11.3V20Z"/>
            </svg>
            <span class="mobile-tab-label">Plans</span>
          </button>
          
          <button class="mobile-tab" data-tab="items">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,2L14,6.5V17.5L19,13V2M6.5,5C4.55,5 2.45,5.4 1,6.5V21.16C1,21.41 1.25,21.66 1.5,21.66C1.6,21.66 1.65,21.59 1.75,21.59C3.1,20.94 5.05,20.5 6.5,20.5C8.45,20.5 10.55,20.9 12,22C13.35,21.15 15.8,20.5 17.5,20.5C19.15,20.5 20.85,20.81 22.25,21.56C22.35,21.61 22.4,21.59 22.5,21.59C22.75,21.59 23,21.34 23,21.09V6.5C22.4,6.05 21.75,5.75 21,5.5V7.5L21,13V19.5C19.9,19.2 18.7,19 17.5,19C15.8,19 13.35,19.65 12,20.5V8C10.55,6.9 8.45,6.5 6.5,6.5V5Z"/>
            </svg>
            <span class="mobile-tab-label">Items</span>
          </button>
          
          <button class="mobile-tab active" data-tab="canvas">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L5,8.09V15.91L12,19.85L19,15.91V8.09L12,4.15Z"/>
            </svg>
            <span class="mobile-tab-label">Canvas</span>
          </button>
          
          <button class="mobile-tab" data-tab="more">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/>
            </svg>
            <span class="mobile-tab-label">More</span>
          </button>
        </div>
        
        <!-- Floating Action Button -->
        <button class="mobile-fab" id="mobile-fab">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
          </svg>
        </button>
        
        <!-- Canvas Controls -->
        <div class="mobile-canvas-controls">
          <button class="mobile-canvas-control-btn" id="mobile-zoom-in" title="Zoom in">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C11.71,14 13.5,12.21 13.5,10C13.5,7.79 11.71,6 9.5,6C7.29,6 5.5,7.79 5.5,10C5.5,12.21 7.29,14 9.5,14M10,7H9V9H7V10H9V12H10V10H12V9H10V7Z"/>
            </svg>
          </button>
          <button class="mobile-canvas-control-btn" id="mobile-zoom-out" title="Zoom out">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5,14L20.5,19L19,20.5L14,15.5V14.71L13.73,14.43C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.43,13.73L14.71,14H15.5M9.5,14C11.71,14 13.5,12.21 13.5,10C13.5,7.79 11.71,6 9.5,6C7.29,6 5.5,7.79 5.5,10C5.5,12.21 7.29,14 9.5,14M7,9H12V10H7V9Z"/>
            </svg>
          </button>
          <button class="mobile-canvas-control-btn" id="mobile-zoom-reset" title="Reset zoom">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M13,7H11V11H7V13H11V17H13V13H17V11H13V7Z"/>
            </svg>
          </button>
        </div>
        
        <!-- Bottom Sheet Overlay -->
        <div class="mobile-bottom-sheet-overlay" id="mobile-bottom-sheet-overlay"></div>
        <div class="mobile-bottom-sheet" id="mobile-bottom-sheet">
          <div class="mobile-bottom-sheet-handle"></div>
          <div class="mobile-bottom-sheet-header">
            <h2 class="mobile-bottom-sheet-title" id="mobile-sheet-title">Actions</h2>
          </div>
          <div class="mobile-bottom-sheet-content" id="mobile-sheet-content"></div>
        </div>
      `;
    }
    
    // Cache references
    this.tabBar = document.querySelector('.mobile-tab-bar');
    this.fab = document.getElementById('mobile-fab');
    this.bottomSheet = document.getElementById('mobile-bottom-sheet');
    this.bottomSheetOverlay = document.getElementById('mobile-bottom-sheet-overlay');
    
    this.pages = {
      'floor-plans': document.getElementById('mobile-page-floor-plans'),
      'items': document.getElementById('mobile-page-items'),
      'canvas': document.getElementById('mobile-page-canvas'),
      'more': document.getElementById('mobile-page-more')
    };
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab clicks
    const tabs = document.querySelectorAll('.mobile-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', this.handleTabClick);
    });
    
    // FAB click
    if (this.fab) {
      this.fab.addEventListener('click', this.handleFabClick);
    }
    
    // Bottom sheet overlay
    if (this.bottomSheetOverlay) {
      this.bottomSheetOverlay.addEventListener('click', () => this.closeBottomSheet());
    }
    
    // Canvas controls
    const zoomIn = document.getElementById('mobile-zoom-in');
    const zoomOut = document.getElementById('mobile-zoom-out');
    const zoomReset = document.getElementById('mobile-zoom-reset');
    
    if (zoomIn) {
      zoomIn.addEventListener('click', () => {
        const currentZoom = this.app.canvasManager.getCanvas().getZoom();
        this.app.canvasManager.setZoom(Math.min(currentZoom + 0.1, 2));
      });
    }
    
    if (zoomOut) {
      zoomOut.addEventListener('click', () => {
        const currentZoom = this.app.canvasManager.getCanvas().getZoom();
        this.app.canvasManager.setZoom(Math.max(currentZoom - 0.1, 0.1));
      });
    }
    
    if (zoomReset) {
      zoomReset.addEventListener('click', () => {
        this.app.canvasManager.centerAndFit();
      });
    }
    
    // Search
    const searchInput = document.getElementById('mobile-search-input');
    const searchClear = document.querySelector('.mobile-search-clear');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.mobileState.searchQuery = e.target.value;
        this.filterItems();
      });
    }
    
    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          this.mobileState.searchQuery = '';
          this.filterItems();
        }
      });
    }
  }
  
  /**
   * Handle tab click
   */
  handleTabClick(e) {
    const tab = e.currentTarget;
    const tabName = tab.dataset.tab;
    this.switchTab(tabName);
  }
  
  /**
   * Switch active tab
   */
  switchTab(tabName) {
    console.log('[MobileUI] Switching to tab:', tabName);
    
    // Update state
    this.mobileState.activeTab = tabName;
    
    // Update tab bar
    const tabs = document.querySelectorAll('.mobile-tab');
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // Update pages
    Object.keys(this.pages).forEach(key => {
      if (key === tabName) {
        this.pages[key].classList.add('active');
      } else {
        this.pages[key].classList.remove('active');
      }
    });
    
    // Update FAB based on context
    this.updateFab();
    
    // Render content for the active tab
    this.renderActiveTab();
  }
  
  /**
   * Update FAB appearance based on context
   */
  updateFab() {
    if (!this.fab) return;
    
    const activeTab = this.mobileState.activeTab;
    
    // Change FAB icon based on active tab
    if (activeTab === 'canvas') {
      this.fab.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
        </svg>
      `;
    } else if (activeTab === 'items') {
      this.fab.style.display = 'none'; // Hide FAB on items page
    } else {
      this.fab.style.display = 'flex';
    }
  }
  
  /**
   * Handle FAB click
   */
  handleFabClick() {
    const activeTab = this.mobileState.activeTab;
    
    if (activeTab === 'canvas') {
      // Show quick actions
      this.showQuickActions();
    }
  }
  
  /**
   * Show quick actions bottom sheet
   */
  showQuickActions() {
    const actions = [
      { 
        label: 'Undo', 
        icon: 'M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z',
        action: () => this.app.historyManager.undo()
      },
      { 
        label: 'Redo', 
        icon: 'M18.4,10.6C16.55,9 14.15,8 11.5,8C6.85,8 2.92,11.03 1.54,15.22L3.9,16C4.95,12.81 7.95,10.5 11.5,10.5C13.45,10.5 15.23,11.22 16.62,12.38L13,16H22V7L18.4,10.6Z',
        action: () => this.app.historyManager.redo()
      },
      { 
        label: 'Export PNG', 
        icon: 'M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z',
        action: () => {
          this.closeBottomSheet();
          this.app.exportManager.exportPNG(2);
        }
      },
      { 
        label: 'Export PDF', 
        icon: 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M15.5,15C15.5,16.38 14.38,17.5 13,17.5H11.5V19H10V13H13A2.5,2.5 0 0,1 15.5,15.5M13,16.5A1,1 0 0,0 14,15.5A1,1 0 0,0 13,14.5H11.5V16.5M13,9V3.5L18.5,9',
        action: () => {
          this.closeBottomSheet();
          this.app.exportManager.exportPDF();
        }
      }
    ];
    
    const content = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${actions.map(action => `
          <button class="dropdown-item" data-action="${action.label.toLowerCase().replace(' ', '-')}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="${action.icon}"/>
            </svg>
            ${action.label}
          </button>
        `).join('')}
      </div>
    `;
    
    this.showBottomSheet('Quick Actions', content);
    
    // Attach action handlers
    actions.forEach(action => {
      const btn = this.bottomSheet.querySelector(`[data-action="${action.label.toLowerCase().replace(' ', '-')}"]`);
      if (btn) {
        btn.addEventListener('click', action.action);
      }
    });
  }
  
  /**
   * Show bottom sheet
   */
  showBottomSheet(title, content) {
    if (!this.bottomSheet || !this.bottomSheetOverlay) return;
    
    // Set content
    document.getElementById('mobile-sheet-title').textContent = title;
    document.getElementById('mobile-sheet-content').innerHTML = content;
    
    // Show
    this.bottomSheetOverlay.classList.add('active');
    this.bottomSheet.classList.add('active');
    
    this.mobileState.activeSheet = title;
  }
  
  /**
   * Close bottom sheet
   */
  closeBottomSheet() {
    if (!this.bottomSheet || !this.bottomSheetOverlay) return;
    
    this.bottomSheetOverlay.classList.remove('active');
    this.bottomSheet.classList.remove('active');
    
    this.mobileState.activeSheet = null;
  }
  
  /**
   * Initialize views
   */
  initializeViews() {
    this.renderFloorPlans();
    this.renderItems();
    this.renderMorePage();
  }
  
  /**
   * Render active tab content
   */
  renderActiveTab() {
    const activeTab = this.mobileState.activeTab;
    
    if (activeTab === 'floor-plans') {
      this.renderFloorPlans();
    } else if (activeTab === 'items') {
      this.renderItems();
    } else if (activeTab === 'canvas') {
      this.updateCanvasPage();
    } else if (activeTab === 'more') {
      this.renderMorePage();
    }
  }
  
  /**
   * Render floor plans
   */
  renderFloorPlans() {
    const container = document.getElementById('mobile-floor-plan-list');
    if (!container) return;
    
    const floorPlans = this.app.floorPlanManager.getAllFloorPlans();
    const currentFloorPlan = this.app.state.get('floorPlan');
    
    container.innerHTML = floorPlans.map(fp => `
      <div class="mobile-floor-plan-card ${currentFloorPlan?.id === fp.id ? 'active' : ''}" data-id="${fp.id}">
        <div class="mobile-floor-plan-card-header">
          <h3 class="mobile-floor-plan-card-title">${fp.name}</h3>
          <span class="mobile-floor-plan-card-badge">${fp.area} sq ft</span>
        </div>
        <p style="color: var(--mobile-text-secondary); font-size: 14px; margin: 8px 0 0 0;">${fp.description}</p>
        <div class="mobile-floor-plan-card-details">
          <div class="mobile-floor-plan-card-detail">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L5,8.09V15.91L12,19.85L19,15.91V8.09L12,4.15Z"/>
            </svg>
            ${fp.widthFt}' × ${fp.heightFt}'
          </div>
          <div class="mobile-floor-plan-card-detail">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,19H5V5H19M19,3H5C3.9,3 3,3.9 3,5V19C3,20.1 3.9,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.9 20.1,3 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z"/>
            </svg>
            Door: ${fp.doorWidth}' × ${fp.doorHeight}'
          </div>
        </div>
      </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.mobile-floor-plan-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.app.floorPlanManager.setFloorPlan(id);
        this.switchTab('canvas');
        this.renderFloorPlans(); // Re-render to update active state
      });
    });
  }
  
  /**
   * Render items
   */
  renderItems() {
    // Render category filter
    this.renderCategoryFilter();
    
    // Render items grid
    const container = document.getElementById('mobile-item-list');
    if (!container) return;
    
    const allItems = Items.getAllItems();
    const query = this.mobileState.searchQuery.toLowerCase();
    const category = this.mobileState.activeCategory;
    
    let filteredItems = allItems;
    
    // Filter by category
    if (category !== 'all') {
      filteredItems = filteredItems.filter(item => item.category === category);
    }
    
    // Filter by search
    if (query) {
      filteredItems = filteredItems.filter(item => 
        item.label.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    }
    
    if (filteredItems.length === 0) {
      container.innerHTML = `
        <div class="mobile-empty-state" style="grid-column: 1 / -1;">
          <svg class="mobile-empty-state-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
          </svg>
          <h3 class="mobile-empty-state-title">No items found</h3>
          <p class="mobile-empty-state-text">Try adjusting your search or filters</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = filteredItems.map(item => {
      const iconData = Icons.getIconData(item.icon);
      return `
        <div class="mobile-item-card" data-id="${item.id}">
          <div class="mobile-item-card-icon">
            ${iconData ? iconData : `<div style="width: 32px; height: 32px; background: ${item.color}; border-radius: 8px;"></div>`}
          </div>
          <div class="mobile-item-card-label">${item.label}</div>
          <div class="mobile-item-card-size">${item.lengthFt}' × ${item.widthFt}'</div>
        </div>
      `;
    }).join('');
    
    // Add click handlers
    container.querySelectorAll('.mobile-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const floorPlan = this.app.state.get('floorPlan');
        
        if (!floorPlan) {
          Modal.showError('Please select a floor plan first');
          this.switchTab('floor-plans');
          return;
        }
        
        // Add item to center of canvas
        const canvas = this.app.canvasManager.getCanvas();
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        this.app.itemManager.addItem(id, centerX, centerY);
        this.switchTab('canvas');
        Modal.showSuccess('Item added to canvas');
      });
    });
  }
  
  /**
   * Render category filter
   */
  renderCategoryFilter() {
    const container = document.getElementById('mobile-category-filter');
    if (!container) return;
    
    const categories = [
      { id: 'all', label: 'All' },
      { id: 'vehicle', label: 'Vehicles' },
      { id: 'boat', label: 'Boats' },
      { id: 'rv', label: 'RVs' },
      { id: 'storage', label: 'Storage' }
    ];
    
    container.innerHTML = categories.map(cat => `
      <button class="mobile-category-chip ${this.mobileState.activeCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
        ${cat.label}
      </button>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.mobile-category-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.mobileState.activeCategory = chip.dataset.category;
        this.renderCategoryFilter();
        this.renderItems();
      });
    });
  }
  
  /**
   * Filter items
   */
  filterItems() {
    this.renderItems();
  }
  
  /**
   * Update canvas page
   */
  updateCanvasPage() {
    const floorPlan = this.app.state.get('floorPlan');
    const title = document.getElementById('mobile-canvas-title');
    const subtitle = document.getElementById('mobile-canvas-subtitle');
    
    if (floorPlan) {
      if (title) title.textContent = this.app.state.get('metadata.projectName') || floorPlan.name;
      if (subtitle) subtitle.textContent = `${floorPlan.area} sq ft`;
    } else {
      if (title) title.textContent = 'Start Planning';
      if (subtitle) subtitle.textContent = 'Select a floor plan from the Floor Plans tab';
    }
  }
  
  /**
   * Render More page
   */
  renderMorePage() {
    const container = document.getElementById('mobile-more-content');
    if (!container) return;
    
    container.innerHTML = `
      <div style="padding: 16px;">
        <div class="mobile-section-title">PROJECT</div>
        <button class="dropdown-item" id="mobile-rename-project">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
          </svg>
          Rename Project
        </button>
        <button class="dropdown-item" id="mobile-new-project">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
          </svg>
          New Project
        </button>
        
        <div class="mobile-divider"></div>
        
        <div class="mobile-section-title">EXPORT</div>
        <button class="dropdown-item" id="mobile-export-png">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>
          </svg>
          Export as PNG
        </button>
        <button class="dropdown-item" id="mobile-export-pdf">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M15.5,15C15.5,16.38 14.38,17.5 13,17.5H11.5V19H10V13H13A2.5,2.5 0 0,1 15.5,15.5M13,16.5A1,1 0 0,0 14,15.5A1,1 0 0,0 13,14.5H11.5V16.5M13,9V3.5L18.5,9"/>
          </svg>
          Export as PDF
        </button>
        
        <div class="mobile-divider"></div>
        
        <div class="mobile-section-title">VIEW</div>
        <button class="dropdown-item" id="mobile-toggle-grid">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M10,4V8H14V4H10M16,4V8H20V4H16M16,10V14H20V10H16M16,16V20H20V16H16M14,20V16H10V20H14M8,20V16H4V20H8M8,14V10H4V14H8M8,8V4H4V8H8M10,14H14V10H10V14M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4C2.89,22 2,21.1 2,20V4A2,2 0 0,1 4,2Z"/>
          </svg>
          Toggle Grid
        </button>
        <button class="dropdown-item" id="mobile-toggle-labels">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M8,9H16V11H8V9M4,3H20A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3Z" />
          </svg>
          Toggle Labels
        </button>
      </div>
    `;
    
    // Add event handlers
    document.getElementById('mobile-rename-project')?.addEventListener('click', () => {
      // Use existing rename dialog
      document.getElementById('btn-rename-project')?.click();
    });
    
    document.getElementById('mobile-new-project')?.addEventListener('click', async () => {
      const confirmed = await Modal.showConfirm(
        'Start New Layout?',
        "This will clear the current layout. Make sure you've saved your work."
      );
      if (confirmed) {
        this.app.state.reset();
        this.app.canvasManager.clear();
        this.app.historyManager.clear();
        Storage.remove(Config.STORAGE_KEYS.autosave);
        this.app.canvasManager.showEmptyState();
        this.app.updateProjectName('Untitled Layout');
        this.switchTab('floor-plans');
        Modal.showSuccess('New layout started');
      }
    });
    
    document.getElementById('mobile-export-png')?.addEventListener('click', () => {
      this.app.exportManager.exportPNG(2);
    });
    
    document.getElementById('mobile-export-pdf')?.addEventListener('click', () => {
      this.app.exportManager.exportPDF();
    });
    
    document.getElementById('mobile-toggle-grid')?.addEventListener('click', () => {
      this.app.canvasManager.toggleGrid();
    });
    
    document.getElementById('mobile-toggle-labels')?.addEventListener('click', () => {
      const showLabels = this.app.state.get('settings.showItemLabels') !== false;
      this.app.state.set('settings.showItemLabels', !showLabels);
      this.app.canvasManager.toggleItemLabels(!showLabels);
    });
  }
  
  /**
   * Handle media query change
   */
  handleMediaChange(e) {
    this.isMobile = e.matches;
    
    if (this.isMobile) {
      console.log('[MobileUI] Switched to mobile');
      this.init();
    } else {
      console.log('[MobileUI] Switched to desktop');
      this.destroy();
    }
  }
  
  /**
   * Destroy mobile UI
   */
  destroy() {
    // Show desktop elements
    const sidebar = document.querySelector('.sidebar');
    const toolbar = document.querySelector('.toolbar');
    const header = document.querySelector('.header');
    
    if (sidebar) sidebar.style.display = '';
    if (toolbar) toolbar.style.display = '';
    if (header) header.style.display = '';
    
    // Remove mobile container
    const container = document.getElementById('mobile-container');
    if (container) {
      container.remove();
    }
    
    console.log('[MobileUI] Mobile interface destroyed');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.MobileUIManager = MobileUIManager;
}
