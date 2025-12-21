/* global Config, Validation */

/**
 * Floor Plan Manager
 * Handles floor plan CRUD operations and validation
 */
class FloorPlanManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
  }

  /**
   * Set active floor plan
   */
  setFloorPlan(floorPlanId) {
    const floorPlan = this._getFloorPlanById(floorPlanId);

    if (!floorPlan) {
      console.error('Floor plan not found:', floorPlanId);
      return false;
    }

    // Validate
    const validation = Validation.validateFloorPlan(floorPlan);
    if (!validation.valid) {
      console.error('Invalid floor plan:', validation.errors);
      return false;
    }

    // [FloorPlanManager] Setting floor plan: id

    // Reset layout metadata (recenter + lock by default)
    const currentLayout = this.state.get('layout') || {};
    this.state.setState({
      floorPlan,
      layout: {
        ...currentLayout,
        floorPlanPosition: null,
        floorPlanBounds: null,
        floorPlanLocked: false,
      },
    });

    // Reset viewport before drawing new floor plan
    this.canvasManager.resetViewport();

    // Draw on canvas
    this.canvasManager.drawFloorPlan(floorPlan);

    // Emit event
    this.eventBus.emit('floorplan:changed', floorPlan);

    return true;
  }

  /**
   * Get current floor plan
   */
  getCurrentFloorPlan() {
    return this.state.get('floorPlan');
  }

  /**
   * Get all floor plan templates
   */
  getAllFloorPlans() {
    return Config.FLOOR_PLANS || [];
  }

  /**
   * Get floor plan by ID from Config
   * @private
   */
  _getFloorPlanById(id) {
    const floorPlans = Config.FLOOR_PLANS || [];
    return floorPlans.find((fp) => fp.id === id);
  }

  /**
   * Get floor plan area in square feet
   */
  getArea() {
    const floorPlan = this.getCurrentFloorPlan();
    if (!floorPlan) return 0;
    return floorPlan.widthFt * floorPlan.heightFt;
  }

  /**
   * Get occupied area (sum of all items)
   */
  getOccupiedArea() {
    const items = this.state.get('items') || [];
    return items.reduce((total, item) => {
      return total + item.lengthFt * item.widthFt;
    }, 0);
  }

  /**
   * Get percentage of occupied space
   */
  getOccupancyPercentage() {
    const total = this.getArea();
    const occupied = this.getOccupiedArea();
    return total > 0 ? (occupied / total) * 100 : 0;
  }

  /**
   * Clear floor plan
   */
  clearFloorPlan() {
    const currentLayout = this.state.get('layout') || {};
    this.state.setState({
      floorPlan: null,
      items: [],
      layout: {
        ...currentLayout,
        floorPlanPosition: null,
        floorPlanBounds: null,
        floorPlanLocked: false,
      },
    });
    this.canvasManager.clear();
    this.eventBus.emit('floorplan:cleared');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.FloorPlanManager = FloorPlanManager;
}
