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
    const floorPlan = FloorPlans.getById(floorPlanId);
    
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

    // Update state
    this.state.setState({ floorPlan });

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
    return FloorPlans.getAll();
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
      return total + (item.lengthFt * item.widthFt);
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
    this.state.setState({ floorPlan: null, items: [] });
    this.canvasManager.clear();
    this.eventBus.emit('floorplan:cleared');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.FloorPlanManager = FloorPlanManager;
}
