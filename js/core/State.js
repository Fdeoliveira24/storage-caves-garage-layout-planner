/**
 * State Management - Single source of truth
 * Implements observer pattern for state changes
 */
class State {
  constructor() {
    this.state = {
      floorPlan: null,
      items: [],
      selection: null,
      history: [],
      settings: {
        unit: 'feet',
        showGrid: true,
        snapToGrid: false,
        showLabels: true,
        showDimensions: true,
        showRuler: false,
        entryZonePosition: 'bottom',
        showEntryZoneLabel: true,
        showEntryZoneBorder: true
      },
      ui: {
        sidebarOpen: true,
        infoPanelOpen: true,
        activeTab: 'floorplans',
        magnifierActive: false,
        measurementActive: false
      },
      metadata: {
        projectName: 'Untitled Layout',
        clientName: '',
        created: null,
        modified: null,
        version: '1.0.0'
      }
    };
    
    this.observers = [];
  }

  /**
   * Get current state (read-only)
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update state and notify observers
   * @param {object} updates - Partial state updates
   */
  setState(updates) {
    // Deep merge updates into state
    this._deepMerge(this.state, updates);
    
    // Update modified timestamp
    this.state.metadata.modified = new Date().toISOString();
    
    // Notify observers
    this._notifyObservers();
  }

  /**
   * Subscribe to state changes
   * @param {function} callback - Observer callback
   */
  subscribe(callback) {
    this.observers.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.observers = this.observers.filter(obs => obs !== callback);
    };
  }

  /**
   * Get specific state property
   * @param {string} path - Dot notation path (e.g., 'settings.unit')
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Set specific state property
   * @param {string} path - Dot notation path
   * @param {any} value - New value
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this.state);
    target[lastKey] = value;
    
    this.state.metadata.modified = new Date().toISOString();
    this._notifyObservers();
  }

  /**
   * Reset state to initial values
   */
  reset() {
    const settings = { ...this.state.settings };
    
    this.state = {
      floorPlan: null,
      items: [],
      selection: null,
      history: [],
      settings: settings,
      ui: {
        sidebarOpen: true,
        infoPanelOpen: true,
        activeTab: 'floorplans',
        magnifierActive: false,
        measurementActive: false
      },
      metadata: {
        projectName: 'Untitled Layout',
        clientName: '',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    this._notifyObservers();
  }

  /**
   * Load state from object
   * @param {object} savedState - Previously saved state
   */
  /**
   * Load saved state
   * Validates and merges saved state into current state
   * @param {object} savedState - Previously saved state object
   */
  loadState(savedState) {
    if (!savedState) {
      console.warn('[State] Attempted to load null/undefined state');
      return;
    }
    
    // Validate state structure
    if (typeof savedState !== 'object') {
      console.error('[State] Invalid state type:', typeof savedState);
      return;
    }
    
    // [State] Loading state
    
    // Merge saved state, preserving structure
    this.state = {
      ...this.state,
      floorPlan: savedState.floorPlan || null,
      items: Array.isArray(savedState.items) ? savedState.items : [],
      settings: {
        ...this.state.settings,
        ...(savedState.settings || {})
      },
      metadata: {
        ...this.state.metadata,
        ...(savedState.metadata || {}),
        modified: new Date().toISOString()
      }
    };
    
    this._notifyObservers();
  }

  /**
   * Serialize state to JSON
   */
  toJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Notify all observers of state change
   * @private
   */
  _notifyObservers() {
    const state = this.getState();
    this.observers.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('Error in state observer:', error);
      }
    });
  }

  /**
   * Deep merge objects
   * @private
   */
  _deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.State = State;
}
