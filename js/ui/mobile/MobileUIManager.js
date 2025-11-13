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
    this.activeTab = 'canvas';
    this.isMobile = false;
    this.initialized = false;
    this.topTabOpen = false;
    this.lastTopTab = 'floorplans';

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

    // Mobile content area with project header and top tabs
    this.mobileContainer.innerHTML = `
      <div id="mobile-project-header" class="mobile-project-header">
        <button id="mobile-menu-btn" class="mobile-menu-btn" title="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h1 id="mobile-project-name" class="mobile-project-name">Untitled Layout</h1>
      </div>
      <div id="mobile-top-tabs" class="mobile-top-tabs">
        <div class="mobile-top-tabs-strip">
          <button class="mobile-top-tab mobile-top-tab-active" data-top-tab="floorplans">Floor Plans</button>
          <button class="mobile-top-tab" data-top-tab="items">Items</button>
          <button class="mobile-top-tab" data-top-tab="saved">Saved</button>
        </div>
        <div class="mobile-top-tabs-content">
          <div id="mobile-floor-plans-view" class="mobile-view mobile-view-active"></div>
          <div id="mobile-items-view" class="mobile-view"></div>
          <div id="mobile-saved-view" class="mobile-view"></div>
        </div>
      </div>
      <div id="mobile-content" class="mobile-content">
        <div id="mobile-more-view" class="mobile-view"></div>
      </div>
    `;

    document.body.appendChild(this.mobileContainer);

    // Create bottom tab bar
    this.createTabBar();

    // Create mobile toolbar (for canvas actions - now will be FAB)
    this.createMobileToolbar();

    // Setup project name editing
    this.setupProjectName();

    // Setup top tab listeners
    this.setupTopTabs();
  }

  /**
   * Apply mobile CSS classes (no style.display)
   */
  applyMobileClasses() {
    document.body.classList.add('mobile-layout');

    // Mark desktop elements to hide on mobile (via CSS)
    const desktopElements = ['.sidebar', '.toolbar', '.header', '.info-bar'];

    desktopElements.forEach((selector) => {
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
      <button class="mobile-tab" data-action="new-layout">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>New</span>
      </button>
      <button class="mobile-tab mobile-tab-active mobile-tab-canvas" data-tab="canvas">
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
    const fab = document.createElement('button');
    fab.id = 'mobile-fab';
    fab.className = 'mobile-fab';
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    `;

    this.mobileToolbar = document.createElement('div');
    this.mobileToolbar.id = 'mobile-action-panel';
    this.mobileToolbar.className = 'mobile-action-panel';
    this.mobileToolbar.innerHTML = `
      <div class="mobile-action-panel-header">
        <h3>Canvas Actions</h3>
        <button class="mobile-action-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="mobile-action-panel-grid">
        <button class="mobile-action-btn" data-action="zoom-in">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <span>Zoom In</span>
        </button>
        <button class="mobile-action-btn" data-action="zoom-out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <span>Zoom Out</span>
        </button>
        <button class="mobile-action-btn" data-action="fit-view">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
          <span>Fit View</span>
        </button>
        <button class="mobile-action-btn" data-action="rotate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
          </svg>
          <span>Rotate</span>
        </button>
        <button class="mobile-action-btn" data-action="duplicate">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          <span>Duplicate</span>
        </button>
        <button class="mobile-action-btn" data-action="delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          <span>Delete</span>
        </button>
        <button class="mobile-action-btn" data-action="bring-front">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>
          </svg>
          <span>Bring Front</span>
        </button>
        <button class="mobile-action-btn" data-action="send-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>
          </svg>
          <span>Send Back</span>
        </button>
      </div>
    `;

    fab.addEventListener('click', () => {
      this.mobileToolbar.classList.toggle('mobile-action-panel-open');
    });

    const closeBtn = this.mobileToolbar.querySelector('.mobile-action-close');
    closeBtn.addEventListener('click', () => {
      this.mobileToolbar.classList.remove('mobile-action-panel-open');
    });

    document.body.appendChild(fab);
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
        const btn = e.target.closest('.mobile-action-btn');
        if (btn) this.handleToolAction(btn.dataset.action);
      });
    }

    // Listen to manager events
    this.eventBus.on('floorplan:changed', () => this.onFloorPlanSelected());
    this.eventBus.on('item:added', () => this.onItemAdded());
  }

  /**
   * Setup project name editing
   */
  setupProjectName() {
    const projectName = document.getElementById('mobile-project-name');
    const menuBtn = document.getElementById('mobile-menu-btn');

    if (projectName) {
      // Update from state
      const metadata = this.state.get('metadata') || {};
      projectName.textContent = metadata.name || 'Untitled Layout';

      // Click to edit
      projectName.addEventListener('click', async () => {
        // Close top tabs first to prevent flicker
        this.closeTopTabs();

        const currentMetadata = this.state.get('metadata') || {};
        const newName = await window.Modal?.showPrompt(
          'Rename Layout',
          'Enter a name for your layout:',
          currentMetadata.name || 'Untitled Layout',
        );
        if (newName && newName.trim()) {
          this.state.set('metadata', { ...currentMetadata, name: newName.trim() });
          projectName.textContent = newName.trim();
        }
      });
    }

    // Menu button to toggle top tabs
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        // Toggle top tabs visibility
        if (this.topTabOpen) {
          this.closeTopTabs();
        } else {
          // switchTopTab will open tabs with forceOpen=true by default
          this.switchTopTab(this.lastTopTab || 'floorplans');
        }
      });
    }
  }

  /**
   * Setup top tab strip listeners
   */
  setupTopTabs() {
    const topTabsStrip = document.querySelector('.mobile-top-tabs-strip');
    if (!topTabsStrip) return;

    topTabsStrip.addEventListener('click', (e) => {
      const tab = e.target.closest('.mobile-top-tab');
      if (!tab) return;

      const tabName = tab.dataset.topTab;
      this.switchTopTab(tabName);
    });
  }

  /**
   * Switch top tabs (Floor Plans / Items / Saved)
   * @param {string} tabName - The tab to switch to
   * @param {Object} options - Options for tab switching
   * @param {boolean} options.forceOpen - Whether to force open the top tabs (default: true)
   */
  switchTopTab(tabName, { forceOpen = true } = {}) {
    this.lastTopTab = tabName;

    // Update tab active state
    document.querySelectorAll('.mobile-top-tab').forEach((t) => {
      t.classList.toggle('mobile-top-tab-active', t.dataset.topTab === tabName);
    });

    // Update views
    const views = document.querySelectorAll('#mobile-top-tabs .mobile-view');
    views.forEach((v) => v.classList.remove('mobile-view-active'));

    if (tabName === 'floorplans') {
      document.getElementById('mobile-floor-plans-view')?.classList.add('mobile-view-active');
      this.renderFloorPlans();
    } else if (tabName === 'items') {
      document.getElementById('mobile-items-view')?.classList.add('mobile-view-active');
      this.renderItems();
    } else if (tabName === 'saved') {
      document.getElementById('mobile-saved-view')?.classList.add('mobile-view-active');
      this.renderSaved();
    }

    // Conditionally open top tabs if requested
    if (forceOpen) {
      this.openTopTabs();
    }
  }

  /**
   * Open top tabs sheet (slide right animation)
   */
  openTopTabs() {
    const topTabsSheet = document.getElementById('mobile-top-tabs');
    if (topTabsSheet) {
      topTabsSheet.classList.remove('mobile-top-tabs-closed');
      this.topTabOpen = true;
    }
  }

  /**
   * Close top tabs sheet (slide left animation)
   */
  closeTopTabs() {
    const topTabsSheet = document.getElementById('mobile-top-tabs');
    if (topTabsSheet) {
      topTabsSheet.classList.add('mobile-top-tabs-closed');
      this.topTabOpen = false;
    }
  }

  /**
   * Handle tab click
   */
  handleTabClick(e) {
    const tab = e.target.closest('.mobile-tab');
    if (!tab) return;

    // Handle new layout action
    if (tab.dataset.action === 'new-layout') {
      this.handleNewLayout();
      return;
    }

    const tabName = tab.dataset.tab;
    if (tabName) {
      this.switchTab(tabName);
    }
  }

  /**
   * Switch tabs
   */
  switchTab(tabName) {
    // Update bottom tab bar active states
    const tabs = this.tabBar?.querySelectorAll('.mobile-tab');
    tabs?.forEach((t) => {
      t.classList.toggle('mobile-tab-active', t.dataset.tab === tabName);
    });

    // Get key elements
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const mobileContent = document.getElementById('mobile-content');

    if (tabName === 'canvas') {
      // Show canvas, hide content views, close top tabs
      if (canvasWrapper) canvasWrapper.classList.add('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.remove('mobile-show-content');
      this.closeTopTabs();

      // Defer canvas resize/fit until visible
      requestAnimationFrame(() => {
        this.canvasManager?.resizeCanvas();
        if (this.canvasManager?.isAutoFitMode) {
          this.canvasManager?.centerAndFit();
        }
      });
    } 
    else if (tabName === 'more') {
      // Hide canvas, show content, close top tabs, show More view
      if (canvasWrapper) canvasWrapper.classList.remove('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.add('mobile-show-content');
      this.closeTopTabs();

      const views = document.querySelectorAll('.mobile-view');
      views.forEach((v) => v.classList.remove('mobile-view-active'));
      document.getElementById('mobile-more-view')?.classList.add('mobile-view-active');
      this.renderMore();
    }
    else if (tabName === 'floorplans' || tabName === 'items' || tabName === 'saved') {
      // Hide canvas, show content, show specific view
      if (canvasWrapper) canvasWrapper.classList.remove('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.add('mobile-show-content');

      // Switch to the specific top tab view (will open tabs with forceOpen=true by default)
      this.switchTopTab(tabName);
    }
  }

  /**
   * Handle new layout button click
   */
  handleNewLayout() {
    const btn = document.querySelector('#btn-new');
    if (btn) btn.click();
  }

  /**
   * Render initial tab
   */
  renderInitialTab() {
    // Initialize topTabOpen to match DOM state (tabs start open)
    this.topTabOpen = true;
    // Render floor plans (tabs already open by default)
    this.switchTopTab('floorplans');
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
        ${floorPlans
          .map(
            (plan) => `
          <button class="mobile-floor-plan-card ${currentPlan?.id === plan.id ? 'mobile-card-selected' : ''}" 
                  data-floor-plan-id="${plan.id}">
            <h3>${plan.name}</h3>
            <div class="mobile-card-meta">
              <span>${plan.widthFt}' × ${plan.heightFt}'</span>
              <span>Door: ${plan.description}</span>
              <span>${plan.area} sq ft</span>
            </div>
          </button>
        `,
          )
          .join('')}
      </div>
    `;

    // Setup floor plan click handlers
    container.querySelectorAll('.mobile-floor-plan-card').forEach((card) => {
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
        ${items
          .map(
            (item) => `
          <button class="mobile-item-card" data-item-id="${item.id}">
            <div class="mobile-card-image">
              <img src="${item.paletteImage}" alt="${item.label}" loading="lazy" onerror="this.style.display='none'">
            </div>
            <h4>${item.label}</h4>
            <span class="mobile-item-size">${item.lengthFt}' × ${item.widthFt}'</span>
          </button>
        `,
          )
          .join('')}
      </div>
    `;

    // Setup item click handlers
    container.querySelectorAll('.mobile-item-card').forEach((card) => {
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

    // Read current settings state
    const settings = this.state.get('settings') || {};
    const showGrid = settings.showGrid !== undefined ? settings.showGrid : true;
    const showEntryZoneLabel =
      settings.showEntryZoneLabel !== undefined ? settings.showEntryZoneLabel : true;
    const showEntryZoneBorder =
      settings.showEntryZoneBorder !== undefined ? settings.showEntryZoneBorder : true;
    const entryZonePosition = settings.entryZonePosition || 'bottom';

    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Actions</h2>
        <p>Export and manage your layout</p>
      </div>
      <div class="mobile-more-list">
        <button class="mobile-more-item" data-action="save-layout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>Save Layout</span>
        </button>
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
      </div>
      <div class="mobile-view-options">
        <h3>View Options</h3>
        <div class="mobile-view-options-group">
          <h4>Display</h4>
          <div class="mobile-view-options-toggles">
            <button class="mobile-toggle-btn ${showGrid ? 'mobile-toggle-active' : ''}" data-action="toggle-grid">
              <span>Grid</span>
              ${showGrid ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <button class="mobile-toggle-btn ${showEntryZoneLabel ? 'mobile-toggle-active' : ''}" data-action="toggle-entry-label">
              <span>Entry Label</span>
              ${showEntryZoneLabel ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <button class="mobile-toggle-btn ${showEntryZoneBorder ? 'mobile-toggle-active' : ''}" data-action="toggle-entry-border">
              <span>Entry Border</span>
              ${showEntryZoneBorder ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
          </div>
        </div>
        <div class="mobile-view-options-group">
          <h4>Entry Zone Position</h4>
          <div class="mobile-view-options-positions">
            <button class="mobile-position-btn ${entryZonePosition === 'bottom' ? 'mobile-position-active' : ''}" data-action="set-entry-position" data-position="bottom">Bottom</button>
            <button class="mobile-position-btn ${entryZonePosition === 'left' ? 'mobile-position-active' : ''}" data-action="set-entry-position" data-position="left">Left</button>
            <button class="mobile-position-btn ${entryZonePosition === 'right' ? 'mobile-position-active' : ''}" data-action="set-entry-position" data-position="right">Right</button>
            <button class="mobile-position-btn ${entryZonePosition === 'top' ? 'mobile-position-active' : ''}" data-action="set-entry-position" data-position="top">Top</button>
          </div>
        </div>
      </div>
    `;

    // Setup more item click handlers
    container.querySelectorAll('.mobile-more-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.handleMoreAction(item.dataset.action);
      });
    });

    // Setup View Options handlers
    container.querySelectorAll('.mobile-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.handleViewOptionToggle(btn.dataset.action);
      });
    });

    container.querySelectorAll('.mobile-position-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.handleEntryPositionChange(btn.dataset.position);
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
        ${
          layouts.length === 0
            ? `
          <div class="mobile-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <p>No saved layouts</p>
            <p style="font-size: 12px; margin-top: 8px;">Save your current layout from the More tab</p>
          </div>
        `
            : layouts
                .map(
                  (layout) => `
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
        `,
                )
                .join('')
        }
      </div>
    `;

    // Setup load handlers
    container.querySelectorAll('.mobile-btn-load').forEach((btn) => {
      btn.addEventListener('click', () => {
        const layoutId = btn.dataset.layoutId;
        if (this.app && this.app.loadLayout) {
          this.app.loadLayout(layoutId);
          // Close top tabs and switch to canvas
          this.closeTopTabs();
          setTimeout(() => this.switchTab('canvas'), 300);
        }
      });
    });

    // Setup delete handlers
    container.querySelectorAll('.mobile-btn-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const layoutId = btn.dataset.layoutId;
        if (this.app && this.app.deleteLayout) {
          const confirmed = await window.Modal?.showConfirm(
            'Delete Layout?',
            'Are you sure you want to delete this layout? This cannot be undone.',
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
        this.canvasManager?.centerAndFit();
        break;
      case 'rotate': {
        const selection = this.canvasManager?.getCanvas()?.getActiveObjects() || [];
        selection.forEach((item) => {
          const currentAngle = item.angle || 0;
          item.rotate(currentAngle + 90);
        });
        this.canvasManager?.getCanvas()?.renderAll();
        break;
      }
      case 'duplicate':
        this.canvasManager
          ?.getCanvas()
          ?.getActiveObjects()
          .forEach((item) => {
            if (item.customData?.id) {
              this.itemManager?.duplicateItem(item.customData.id);
            }
          });
        break;
      case 'delete':
        this.canvasManager
          ?.getCanvas()
          ?.getActiveObjects()
          .forEach((item) => {
            if (item.customData?.id) {
              this.itemManager?.removeItem(item.customData.id);
            }
          });
        break;
      case 'bring-front':
        this.canvasManager
          ?.getCanvas()
          ?.getActiveObjects()
          .forEach((item) => item.bringToFront());
        this.canvasManager?.ensureStaticLayersBehind();
        break;
      case 'send-back':
        this.canvasManager
          ?.getCanvas()
          ?.getActiveObjects()
          .forEach((item) => item.sendToBack());
        this.canvasManager?.ensureStaticLayersBehind();
        break;
    }
    // Close action panel after action
    this.mobileToolbar?.classList.remove('mobile-action-panel-open');
  }

  /**
   * Handle more menu actions
   */
  async handleMoreAction(action) {
    if (action === 'save-layout') {
      await this.app.saveLayout();
      this.switchTab('canvas');
      return;
    }

    const actions = {
      'export-png': '#btn-export-png',
      'export-pdf': '#btn-export-pdf',
      'export-json': '#btn-export-json',
      'share-email': '#btn-share-email',
      new: '#btn-new',
    };

    const btn = document.querySelector(actions[action]);
    if (btn) btn.click();
  }

  /**
   * Handle View Options toggle actions
   */
  handleViewOptionToggle(action) {
    const settings = this.state.get('settings') || {};

    switch (action) {
      case 'toggle-grid':
        settings.showGrid = !settings.showGrid;
        this.state.set('settings', settings);
        if (this.canvasManager && this.canvasManager.toggleGrid) {
          this.canvasManager.toggleGrid();
        }
        this.switchTab('canvas');
        break;

      case 'toggle-entry-label':
        settings.showEntryZoneLabel = !settings.showEntryZoneLabel;
        this.state.set('settings', settings);
        this.redrawFloorPlan();
        this.switchTab('canvas');
        break;

      case 'toggle-entry-border':
        settings.showEntryZoneBorder = !settings.showEntryZoneBorder;
        this.state.set('settings', settings);
        this.redrawFloorPlan();
        this.switchTab('canvas');
        break;
    }
  }

  /**
   * Handle Entry Zone position change
   */
  handleEntryPositionChange(position) {
    const settings = this.state.get('settings') || {};
    settings.entryZonePosition = position;
    this.state.set('settings', settings);
    this.redrawFloorPlan();
    this.switchTab('canvas');
  }

  /**
   * Redraw floor plan
   */
  redrawFloorPlan() {
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan && this.canvasManager && this.canvasManager.drawFloorPlan) {
      this.canvasManager.drawFloorPlan(floorPlan);
    }
  }

  /**
   * Event handlers
   */
  onFloorPlanSelected() {
    // Close top tabs and switch to canvas after selecting floor plan
    this.closeTopTabs();
    setTimeout(() => this.switchTab('canvas'), 300);
  }

  onItemAdded() {
    // Close top tabs and switch to canvas after adding item
    this.closeTopTabs();
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
    document.querySelectorAll('.mobile-hide-desktop').forEach((el) => {
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
