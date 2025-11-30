/* global Helpers, Icons */
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
    this.selectionManager = null;

    // Mobile state
    this.activeTab = 'canvas';
    this.isMobile = false;
    this.initialized = false;
    this.topTabOpen = false;
    this.lastTopTab = 'floorplans';
    this.measurementModeActive = false;
    this.actionPanelOpen = false;

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
    this.selectionManager = this.app.selectionManager;
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
        <div class="mobile-project-brand">
          <img
            src="assets/images/logo/Storage-Caves-Logo.png"
            alt="Storage Caves Logo"
            class="mobile-project-logo"
          />
          <button id="mobile-project-name" class="mobile-project-name" title="Rename layout" type="button">
            <span id="mobile-project-name-text">Untitled Layout</span>
            ${Icons.render('edit', 'mobile-icon')}
          </button>
        </div>
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
      if (el) {
        el.classList.add('mobile-hide-desktop');
      }
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
      <button class="mobile-tab" data-action="toggle-top-tabs">
        ${Icons.render('search', 'mobile-tab-icon')}
        <span>Browse</span>
      </button>
      <button class="mobile-tab" data-action="toggle-actions">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        </svg>
        <span>Actions</span>
      </button>
      <button class="mobile-tab mobile-tab-active mobile-tab-canvas" data-tab="canvas">
        <svg class="mobile-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        </svg>
        <span>Canvas</span>
      </button>
      <button class="mobile-tab" data-tab="more">
        ${Icons.render('moreHorizontal', 'mobile-tab-icon')}
        <span>More</span>
      </button>
      <button class="mobile-tab" data-action="new-layout">
        ${Icons.render('new', 'mobile-tab-icon')}
        <span>New</span>
      </button>
    `;

    document.body.appendChild(this.tabBar);
  }

  /**
   * Create mobile toolbar for canvas actions
   */
  createMobileToolbar() {
    this.mobileToolbar = document.createElement('div');
    this.mobileToolbar.id = 'mobile-action-panel';
    this.mobileToolbar.className = 'mobile-action-panel';
    this.mobileToolbar.innerHTML = `
      <div class="mobile-action-panel-header">
        <h2>Canvas Tools</h2>
      </div>
      <div class="mobile-action-panel-grid">
        <button class="mobile-action-btn" data-action="zoom-in">
          ${Icons.render('zoomIn', 'mobile-action-icon')}
          <span>Zoom In</span>
        </button>
        <button class="mobile-action-btn" data-action="zoom-out">
          ${Icons.render('zoomOut', 'mobile-action-icon')}
          <span>Zoom Out</span>
        </button>
        <button class="mobile-action-btn" data-action="fit-view">
          ${Icons.render('fitView', 'mobile-action-icon')}
          <span>Fit View</span>
        </button>
        <button class="mobile-action-btn" data-action="rotate">
          ${Icons.render('rotate', 'mobile-action-icon')}
          <span>Rotate</span>
        </button>
        
        <button class="mobile-action-btn" data-action="duplicate">
          ${Icons.render('duplicate', 'mobile-action-icon')}
          <span>Duplicate</span>
        </button>
        <button class="mobile-action-btn" data-action="delete">
          ${Icons.render('delete', 'mobile-action-icon')}
          <span>Delete</span>
        </button>
        <button class="mobile-action-btn" data-action="bring-front">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2,2H11V11H2V2M9,4H4V9H9V4M22,13V22H13V13H22M15,15V20H20V15H15M16,8V11H13V8H16M11,16H8V13H11V16Z"/>
          </svg>
          <span>Bring Front</span>
        </button>
        <button class="mobile-action-btn" data-action="send-back">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2,2H11V6H9V4H4V9H6V11H2V2M22,13V22H13V18H15V20H20V15H18V13H22M8,8H16V16H8V8Z"/>
          </svg>
          <span>Send Back</span>
        </button>
        <button class="mobile-action-btn" data-action="toggle-floorplan-lock">
          ${Icons.render('lock', 'mobile-action-icon')}
          <span class="mobile-floorplan-lock-label">Lock Floor Plan</span>
        </button>
        <button class="mobile-action-btn" data-action="recenter-floorplan">
          ${Icons.render('recenter', 'mobile-action-icon')}
          <span>Re-center Floor Plan</span>
        </button>
        <button class="mobile-action-btn" data-action="toggle-grid" aria-pressed="true">
          ${Icons.render('rulerGrid', 'mobile-action-icon')}
          <span>Grid</span>
        </button>
        <button class="mobile-action-btn" data-action="toggle-rulers" aria-pressed="false">
          ${Icons.render('rulerGrid', 'mobile-action-icon')}
          <span>Rulers</span>
        </button>
        <button class="mobile-action-btn" data-action="toggle-snap" aria-pressed="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="3" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="21" y2="12" />
            <line x1="12" y1="3" x2="12" y2="9" />
            <line x1="12" y1="15" x2="12" y2="21" />
          </svg>
          <span>Snap to Grid</span>
        </button>
        <button class="mobile-action-btn" data-action="toggle-measure" aria-pressed="false">
          ${Icons.render('measure', 'mobile-action-icon')}
          <span>Measure</span>
        </button>
        <button class="mobile-action-btn mobile-clear-measure" data-action="clear-measurement" style="display: none;">
          ${Icons.render('close', 'mobile-action-icon')}
          <span>Clear Measurement</span>
        </button>
      </div>
    `;

    document.body.appendChild(this.mobileToolbar);
    this.updateFloorPlanControls();
    this.setMeasurementModeActive(this.app?.isMeasurementModeActive?.());
    this.setRulerGridActive(
      this.state.get('settings.showGrid') !== false,
      this.state.get('settings.showRuler') !== false,
    );
  }

  toggleActionPanel() {
    if (!this.mobileToolbar) return;
    if (this.mobileToolbar.classList.contains('mobile-action-panel-open')) {
      this.closeActionPanel();
    } else {
      this.openActionPanel();
    }
  }

  openActionPanel() {
    if (!this.mobileToolbar) return;
    this.closeTopTabs();
    this.updateFloorPlanControls();
    this.mobileToolbar.classList.add('mobile-action-panel-open');
    this.actionPanelOpen = true;
    const actionTab = this.tabBar?.querySelector('[data-action="toggle-actions"]');
    actionTab?.classList.add('mobile-tab-active');
  }

  closeActionPanel() {
    if (!this.mobileToolbar) return;
    this.mobileToolbar.classList.remove('mobile-action-panel-open');
    this.actionPanelOpen = false;
    const actionTab = this.tabBar?.querySelector('[data-action="toggle-actions"]');
    actionTab?.classList.remove('mobile-tab-active');
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
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          this.handleToolAction(btn.dataset.action);
        }
      });
    }

    // Listen to manager events
    this.eventBus.on('floorplan:changed', () => {
      this.onFloorPlanSelected();
      this.updateFloorPlanControls();
    });
    this.eventBus.on('item:added', () => this.onItemAdded());
  }

  /**
   * Setup project name editing
   */
  setupProjectName() {
    const projectNameButton = document.getElementById('mobile-project-name');
    const projectNameText = document.getElementById('mobile-project-name-text');

    const triggerRename = async () => {
      const metadata = this.state.get('metadata') || {};
      const newName = await window.Modal?.showPrompt(
        'Rename Layout',
        'Enter a name for your layout:',
        metadata.projectName || 'Untitled Layout',
      );

      if (newName && newName.trim()) {
        const trimmed = newName.trim();
        // Use the same high-level rename flow as desktop
        this.app?.updateProjectName?.(trimmed);
        if (projectNameText) {
          projectNameText.textContent = trimmed;
        }
      }
    };

    if (projectNameButton && projectNameText) {
      // Update from state
      const metadata = this.state.get('metadata') || {};
      projectNameText.textContent = metadata.projectName || 'Untitled Layout';
      projectNameButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        triggerRename();
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

    // Update views - Clear ALL views (not just top-tabs) for consistency
    document
      .querySelectorAll('.mobile-view')
      .forEach((v) => v.classList.remove('mobile-view-active'));

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

    const { action } = tab.dataset;
    if (action) {
      if (action === 'new-layout') {
        this.handleNewLayout();
      } else if (action === 'toggle-top-tabs') {
        this.closeActionPanel();
        this.closeMorePanel();
        if (this.topTabOpen) {
          // Closing browse: hide the sheet and return to canvas (empty state if no plan)
          this.closeTopTabs();
          this.switchTab('canvas');
        } else {
          // Ensure we show the browse content (floorplans/items/saved) when toggling open
          this.switchTab(this.lastTopTab || 'floorplans');
        }
      } else if (action === 'toggle-actions') {
        // Close More panel if open (no forced state)
        if (this.isMorePanelOpen()) {
          this.closeMorePanel();
        }
        // Pure toggle - no forced canvas switch
        if (this.actionPanelOpen) {
          this.closeActionPanel();
        } else {
          this.openActionPanel();
        }
      }
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
    // TOGGLE MORE PANEL - works like a drawer
    if (tabName === 'more') {
      if (this.isMorePanelOpen()) {
        this.closeMorePanel({ activateCanvas: true });
      } else {
        this.openMorePanel();
      }
      return;
    }

    // Close floating panels when switching to other tabs
    this.closeActionPanel();
    if (this.isMorePanelOpen()) {
      this.closeMorePanel();
    }

    // Update bottom tab bar active states
    const tabs = this.tabBar?.querySelectorAll('.mobile-tab');
    tabs?.forEach((t) => {
      t.classList.toggle('mobile-tab-active', t.dataset.tab === tabName);
    });

    // Get key elements
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const mobileContent = document.getElementById('mobile-content');
    const mobileTopTabs = document.getElementById('mobile-top-tabs');

    if (tabName === 'canvas') {
      // Show canvas, hide ALL panels
      if (canvasWrapper) canvasWrapper.classList.add('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.remove('mobile-show-content');
      if (mobileTopTabs) mobileTopTabs.classList.add('mobile-top-tabs-closed');

      // Hide ALL content views
      document
        .querySelectorAll('.mobile-view')
        .forEach((v) => v.classList.remove('mobile-view-active'));

      // Defer canvas resize/fit until visible
      requestAnimationFrame(() => {
        this.canvasManager?.resizeCanvas();
        if (this.canvasManager?.isAutoFitMode) {
          this.canvasManager?.centerAndFit();
        }
      });
    } else if (tabName === 'floorplans' || tabName === 'items' || tabName === 'saved') {
      // Show Browse panel (top tabs), hide canvas and More panel
      if (canvasWrapper) canvasWrapper.classList.remove('mobile-show-canvas');
      if (mobileContent) mobileContent.classList.remove('mobile-show-content');

      // CRITICAL: Hide more-view before showing browse content
      document.getElementById('mobile-more-view')?.classList.remove('mobile-view-active');

      // Switch to the specific top tab view
      this.switchTopTab(tabName);
    }
  }

  isMorePanelOpen() {
    return (
      this.tabBar?.querySelector('[data-tab="more"]')?.classList.contains('mobile-tab-active') ??
      false
    );
  }

  openMorePanel() {
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const mobileContent = document.getElementById('mobile-content');
    const mobileTopTabs = document.getElementById('mobile-top-tabs');
    const moreTab = this.tabBar?.querySelector('[data-tab="more"]');

    // Close other panels
    this.closeActionPanel();
    if (mobileTopTabs) mobileTopTabs.classList.add('mobile-top-tabs-closed');

    // Update tab bar - only More is active
    this.tabBar
      ?.querySelectorAll('.mobile-tab')
      .forEach((t) => t.classList.remove('mobile-tab-active'));
    moreTab?.classList.add('mobile-tab-active');

    // Hide canvas
    canvasWrapper?.classList.remove('mobile-show-canvas');

    // Show More panel with slide-in animation
    if (mobileContent) {
      mobileContent.classList.add('mobile-show-content');
    }

    // Hide all other views, show only more-view
    document
      .querySelectorAll('.mobile-view')
      .forEach((v) => v.classList.remove('mobile-view-active'));
    document.getElementById('mobile-more-view')?.classList.add('mobile-view-active');

    this.renderMore();
  }

  closeMorePanel({ activateCanvas = false } = {}) {
    if (!this.isMorePanelOpen()) return;

    const mobileContent = document.getElementById('mobile-content');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const moreTab = this.tabBar?.querySelector('[data-tab="more"]');
    const canvasTab = this.tabBar?.querySelector('[data-tab="canvas"]');
    const moreView = document.getElementById('mobile-more-view');

    // Remove active state from More button
    moreTab?.classList.remove('mobile-tab-active');

    // Hide More panel with slide-out animation (CSS handles the animation)
    if (mobileContent) {
      mobileContent.classList.remove('mobile-show-content');

      // Keep the content visible during the slide-out, then hide once the transform finishes
      if (moreView) {
        const hideContent = () => {
          moreView.classList.remove('mobile-view-active');
        };

        const onTransitionEnd = (evt) => {
          if (evt.propertyName === 'transform') {
            hideContent();
          }
        };

        mobileContent.addEventListener('transitionend', onTransitionEnd, { once: true });
        // Fallback timeout in case transitionend doesn't fire
        setTimeout(hideContent, 500);
      }
    }

    // Show canvas immediately behind the sliding panel
    canvasWrapper?.classList.add('mobile-show-canvas');

    // Activate canvas tab if requested
    if (activateCanvas) {
      canvasTab?.classList.add('mobile-tab-active');
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
              <span>Door: ${plan.doorWidth}' × ${plan.doorHeight}'</span>
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
    const useImages =
      typeof window !== 'undefined' && window.Config ? window.Config.USE_IMAGES !== false : true;

    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Items</h2>
        <p>Add items to your layout</p>
      </div>
      <div class="mobile-item-list">
        ${items
          .map((item) => {
            const hasImage = useImages && item.paletteImage;
            const isMezzanine = item.category === 'mezzanine';
            const isShape = item.category === 'shapes';
            const accentColor = item.color || '#6366F1';
            let visualMarkup;
            if (hasImage) {
              visualMarkup = `
                <div class="mobile-card-image" style="--fallback-color: ${accentColor};">
                  <img src="${item.paletteImage}" alt="${item.label}" loading="lazy">
                  <div class="mobile-image-fallback" aria-hidden="true"></div>
                </div>
              `;
            } else if (isShape) {
              const shapeType = item.shapeType || 'rectangle';
              visualMarkup = `
                <div class="mobile-card-image mobile-card-image--shape" data-shape="${shapeType}" style="--shape-color: ${accentColor};" aria-hidden="true"></div>
              `;
            } else {
              const placeholderClasses = ['mobile-card-image', 'mobile-card-image--placeholder'];
              if (isMezzanine) placeholderClasses.push('mobile-card-image--mezzanine');
              visualMarkup = `<div class="${placeholderClasses.join(' ')}" aria-hidden="true"></div>`;
            }

            return `
              <button class="mobile-item-card" data-item-id="${item.id}" data-category="${item.category || ''}">
                ${visualMarkup}
                <h4>${item.label}</h4>
                <span class="mobile-item-size">${item.lengthFt}' × ${item.widthFt}'</span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;

    // Handle palette image failures gracefully
    container.querySelectorAll('.mobile-card-image img').forEach((img) => {
      img.addEventListener('error', () => {
        const wrapper = img.closest('.mobile-card-image');
        if (wrapper) {
          wrapper.classList.add('mobile-card-image--error');
        }
      });
    });

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
    const showEntryZoneLabel =
      settings.showEntryZoneLabel !== undefined ? settings.showEntryZoneLabel : true;
    const showEntryZoneBorder =
      settings.showEntryZoneBorder !== undefined ? settings.showEntryZoneBorder : true;
    const entryZonePosition = settings.entryZonePosition || 'bottom';

    container.innerHTML = `
      <div class="mobile-view-header">
        <h2>Project Actions</h2>
        <p>Export, share, and configure your layout</p>
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
        <button class="mobile-more-item" data-action="import-layout">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Import Layout</span>
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
          <div class="mobile-view-options-positions">
            <button class="mobile-toggle-btn ${showEntryZoneLabel ? 'mobile-toggle-active' : ''}" data-action="toggle-entry-label">
              <span>Entry Label</span>
              ${showEntryZoneLabel ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <button class="mobile-toggle-btn ${showEntryZoneBorder ? 'mobile-toggle-active' : ''}" data-action="toggle-entry-border">
              <span>Entry Border</span>
              ${showEntryZoneBorder ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <!-- Snap to Grid removed from More view (available under Actions) -->
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
      item.addEventListener('click', (event) => {
        // Prevent event from bubbling to desktop handlers
        event.preventDefault();
        event.stopPropagation();
        this.handleMoreAction(item.dataset.action);
      });
    });

    // Setup View Options handlers
    container.querySelectorAll('.mobile-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.handleViewOptionToggle(btn.dataset.action);
      });
    });

    container.querySelectorAll('.mobile-position-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
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
                .map((layout) => {
                  const layoutName = Helpers?.sanitizeLayoutName
                    ? Helpers.sanitizeLayoutName(
                        layout.name || 'Untitled Layout',
                        'Untitled Layout',
                      )
                    : layout.name || 'Untitled Layout';
                  const layoutDate = new Date(layout.created).toLocaleDateString();
                  return `
          <div class="mobile-saved-item">
            <div class="mobile-saved-info">
              <div class="mobile-saved-name">${layoutName}</div>
              <div class="mobile-saved-date">${layoutDate}</div>
            </div>
            <div class="mobile-saved-actions">
              <button class="mobile-btn-load" data-layout-id="${layout.id}">Load</button>
              <button class="mobile-btn-delete" data-layout-id="${layout.id}">Delete</button>
            </div>
          </div>
        `;
                })
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
    const floorPlan = this.state.get('floorPlan');
    if (!floorPlan) {
      window.Modal?.showInfo('Please select a floor plan before adding items');
      // Guide user back to floor plan tab for selection
      this.switchTopTab('floorplans');
      this.switchTab('floorplans');
      return;
    }

    if (this.itemManager) {
      this.itemManager.addItem(itemId);
      // After adding, return to canvas view so the user sees the item
      this.switchTab('canvas');
    }
  }

  /**
   * Handle toolbar actions
   */
  handleToolAction(action) {
    let shouldCloseActionPanel = true;
    switch (action) {
      case 'zoom-in':
        // Use the same zoom helpers as desktop (CanvasManager)
        this.canvasManager?.zoomIn();
        break;
      case 'zoom-out':
        this.canvasManager?.zoomOut();
        break;
      case 'fit-view':
        this.canvasManager?.centerAndFit();
        break;
      case 'rotate': {
        // Reuse desktop rotation behavior
        this.selectionManager?.rotateSelected?.(90);
        break;
      }
      case 'duplicate':
        // Mirror desktop duplicate behavior
        this.selectionManager?.duplicateSelected?.();
        break;
      case 'delete':
        // Mirror desktop delete behavior
        this.selectionManager?.deleteSelected?.();
        break;
      case 'bring-front':
        if (this.selectionManager) {
          this.selectionManager.bringToFront();
        }
        break;
      case 'send-back':
        if (this.selectionManager) {
          this.selectionManager.sendToBack();
        }
        break;
      case 'toggle-floorplan-lock':
        this.toggleFloorPlanLock();
        break;
      case 'recenter-floorplan':
        this.recenterFloorPlan();
        break;
      case 'toggle-measure':
        this.app?.toggleMeasurementMode?.();
        shouldCloseActionPanel = false;
        break;
      case 'clear-measurement':
        // Clear active measurement line
        if (this.app?.measurementTool) {
          this.app.measurementTool.disableMeasurementMode();
          // Ensure UI state reflects that measurement mode is now off
          this.setMeasurementModeActive(false);
          this.clearAllMeasurements();
        }
        shouldCloseActionPanel = false;
        break;
      case 'toggle-grid':
        // Toggle grid only
        {
          const showGrid = this.state.get('settings.showGrid') !== false;
          const nextGrid = !showGrid;
          this.state.set('settings.showGrid', nextGrid);
          if (this.canvasManager) {
            this.canvasManager.redrawFloorPlan({ preserveViewport: true });
          }
          this.setRulerGridActive(nextGrid, this.state.get('settings.showRuler') !== false);
        }
        shouldCloseActionPanel = false;
        break;
      case 'toggle-rulers': {
        // Toggle rulers only
        const showRulers = this.state.get('settings.showRuler') !== false;
        this.state.set('settings.showRuler', !showRulers);
        // CRITICAL: Redraw floor plan to show/hide rulers
        if (this.canvasManager) {
          this.canvasManager.redrawFloorPlan({ preserveViewport: true });
        }
        // Sync button states with current grid/ruler visibility
        this.setRulerGridActive(this.state.get('settings.showGrid') !== false, !showRulers);
        this.eventBus.emit('settings:ruler:changed', !showRulers);
        shouldCloseActionPanel = false;
        break;
      }
      case 'toggle-snap': {
        // Toggle snap to grid immediately
        const settings = this.state.get('settings') || {};
        const currently = !!settings.snapToGrid;
        settings.snapToGrid = !currently;
        this.state.set('settings', settings);
        // Notify canvas / emit event
        this.eventBus.emit('settings:snap:changed', settings.snapToGrid);
        if (this.canvasManager && this.canvasManager.updateSnapState) {
          try {
            this.canvasManager.updateSnapState(settings.snapToGrid);
          } catch (e) {
            // Ignore snap state update errors to avoid blocking UI flow
          }
        }
        // Reflect snap state on the button for accessibility
        const snapBtn = this.mobileToolbar?.querySelector('[data-action="toggle-snap"]');
        if (snapBtn) {
          snapBtn.classList.toggle('is-active', settings.snapToGrid);
          snapBtn.setAttribute('aria-pressed', settings.snapToGrid ? 'true' : 'false');
        }
        shouldCloseActionPanel = false;
        break;
      }
    }
    // Close action panel after action (unless tool stays active)
    if (shouldCloseActionPanel) {
      this.closeActionPanel();
    }
  }

  updateFloorPlanControls() {
    if (!this.mobileToolbar) return;
    const hasFloorPlan = !!this.state.get('floorPlan');
    const locked = this.state.get('layout.floorPlanLocked') !== false;

    const lockBtn = this.mobileToolbar.querySelector('[data-action="toggle-floorplan-lock"]');
    const lockLabel = this.mobileToolbar.querySelector('.mobile-floorplan-lock-label');
    const recenterBtn = this.mobileToolbar.querySelector('[data-action="recenter-floorplan"]');

    if (lockLabel) {
      lockLabel.textContent = locked ? 'Unlock Floor Plan' : 'Lock Floor Plan';
    }

    if (lockBtn) {
      lockBtn.classList.toggle('is-active', locked);
      lockBtn.setAttribute('aria-pressed', locked ? 'true' : 'false');
    }

    [lockBtn, recenterBtn].forEach((btn) => {
      if (!btn) return;
      if (hasFloorPlan) {
        btn.disabled = false;
        btn.setAttribute('aria-disabled', 'false');
        btn.classList.remove('mobile-action-btn-disabled');
      } else {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('mobile-action-btn-disabled');
      }
    });
  }

  setMeasurementModeActive(isActive) {
    this.measurementModeActive = !!isActive;
    const measureBtn = this.mobileToolbar?.querySelector('[data-action="toggle-measure"]');
    if (measureBtn) {
      measureBtn.classList.toggle('is-active', this.measurementModeActive);
      measureBtn.setAttribute('aria-pressed', this.measurementModeActive ? 'true' : 'false');
    }

    // Show/hide Clear Measurement button based on measurement mode state
    const clearMeasureBtn = this.mobileToolbar?.querySelector('[data-action="clear-measurement"]');
    if (clearMeasureBtn) {
      clearMeasureBtn.style.display = this.measurementModeActive ? 'flex' : 'none';
    }
  }

  setRulerGridActive(gridActive, rulersActive) {
    const gridBtn = this.mobileToolbar?.querySelector('[data-action="toggle-grid"]');
    if (gridBtn) {
      gridBtn.classList.toggle('is-active', !!gridActive);
      gridBtn.setAttribute('aria-pressed', gridActive ? 'true' : 'false');
    }

    const rulersBtn = this.mobileToolbar?.querySelector('[data-action="toggle-rulers"]');
    if (rulersBtn) {
      rulersBtn.classList.toggle('is-active', !!rulersActive);
      rulersBtn.setAttribute('aria-pressed', rulersActive ? 'true' : 'false');
    }
  }

  clearAllMeasurements() {
    const canvas = this.canvasManager?.getCanvas?.();
    if (!canvas) return;
    const toRemove = canvas.getObjects().filter((obj) => obj.measurementId);
    if (!toRemove.length) return;
    toRemove.forEach((obj) => canvas.remove(obj));
    canvas.requestRenderAll?.();
  }

  toggleFloorPlanLock() {
    if (!this.state.get('floorPlan')) return;
    const locked = this.state.get('layout.floorPlanLocked') !== false;
    this.canvasManager?.setFloorPlanLocked(!locked);
    this.state.set('layout.floorPlanLocked', !locked);
    this.updateFloorPlanControls();
  }

  recenterFloorPlan() {
    if (!this.state.get('floorPlan')) return;
    this.canvasManager?.resetFloorPlanPosition?.();
    this.switchTab('canvas');
  }

  /**
   * Handle more menu actions
   */
  async handleMoreAction(action) {
    if (action === 'save-layout') {
      await this.saveMobileLayout();
      return;
    }

    const actions = {
      'export-png': '#btn-export-png',
      'export-pdf': '#btn-export-pdf',
      'export-json': '#btn-export-json',
      'share-email': '#btn-share-email',
      'import-layout': '#btn-import-json',
      new: '#btn-new',
    };

    if (action === 'toggle-floorplan-lock') {
      this.toggleFloorPlanLock();
      return;
    }

    if (action === 'recenter-floorplan') {
      this.recenterFloorPlan();
      return;
    }

    const btn = document.querySelector(actions[action]);
    if (btn) {
      btn.click();
      // Switch to canvas after export actions
      if (action.startsWith('export-')) {
        this.switchTab('canvas');
      }
    }
  }

  /**
   * Handle View Options toggle actions
   */
  handleViewOptionToggle(action) {
    const settings = this.state.get('settings') || {};

    switch (action) {
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
      case 'toggle-snap': {
        // Toggle snapToGrid in state and notify canvas manager
        const snapEnabled = !!settings.snapToGrid;
        settings.snapToGrid = !snapEnabled;
        this.state.set('settings', settings);
        // Update canvas manager if available (CanvasManager checks state on move)
        if (this.canvasManager && this.canvasManager.updateSnapState) {
          try {
            this.canvasManager.updateSnapState(settings.snapToGrid);
          } catch (e) {
            // ignore if not implemented
          }
        }
        this.switchTab('canvas');
        break;
      }
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
   * Save layout (mobile entry point)
   */
  async saveMobileLayout() {
    try {
      const result = await this.app.saveLayout({
        allowMobile: true,
        onBeforePrompt: async () => {
          this.switchTab('canvas');
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        onCancel: () => {
          this.switchTab('more');
        },
        onAfterSave: () => {
          this.switchTab('canvas');
        },
      });

      if (!result?.saved && result?.reason !== 'cancelled') {
        // if blocked or failed (not user cancel), return user to More tab
        this.switchTab('more');
      }
    } catch (error) {
      console.warn('[MobileUI] saveMobileLayout error:', error);
      this.switchTab('more');
    }
  }

  /**
   * Clean up mobile UI
   */
  destroy() {
    console.log('[MobileUI] Destroying mobile interface');

    // Remove mobile classes
    document.body.classList.remove('mobile-layout');

    // Remove mobile-hide-desktop classes so desktop UI is fully restored
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
