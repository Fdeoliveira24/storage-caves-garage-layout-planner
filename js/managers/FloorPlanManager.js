/* global Config, Validation, FloorPlanComposition, Helpers */

/**
 * Floor Plan Manager
 * Owns the normalized one-to-Config.MAX_FLOOR_PLAN_UNITS-unit floor plan composition.
 */
class FloorPlanManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
  }

  /** Replace the active composition with one unit (legacy-compatible API). */
  setFloorPlan(floorPlanId) {
    const floorPlan = this._getFloorPlanById(floorPlanId);
    if (!floorPlan) {
      console.error('Floor plan not found:', floorPlanId);
      return false;
    }

    const validation = Validation.validateFloorPlan(floorPlan);
    if (!validation.valid) {
      console.error('Invalid floor plan:', validation.errors);
      return false;
    }

    const nextPlan = FloorPlanComposition.composeUnits([
      FloorPlanComposition.createUnit(floorPlan),
    ]);
    return this._applyFloorPlan(nextPlan, { resetPosition: true, reason: 'replace' });
  }

  /** Add a unit to the right side of the current composition. */
  addFloorPlan(floorPlanId) {
    const template = this._getFloorPlanById(floorPlanId);
    if (!template) return false;

    const current = this.getCurrentFloorPlan();
    const count = current?.units?.length || 0;
    if (count >= Config.MAX_FLOOR_PLAN_UNITS) return false;

    const nextPlan = FloorPlanComposition.addUnit(current, floorPlanId);
    return this._applyFloorPlan(nextPlan, {
      resetPosition: !current,
      reason: 'add',
    });
  }

  /**
   * Remove one unit instance. Removing the last remaining unit clears the
   * whole floor plan (and its items) back to an empty canvas, the same as
   * the "New Layout" action -- there's no reason to special-case "1 unit
   * left" as un-removable when the user explicitly asked to remove it.
   */
  removeFloorPlan(instanceId) {
    return this.removeFloorPlans([instanceId]);
  }

  /** Remove multiple unit instances in one redraw/history operation. */
  removeFloorPlans(instanceIds = []) {
    const current = this.getCurrentFloorPlan();
    if (!current) return false;
    const requestedIds = new Set(Array.isArray(instanceIds) ? instanceIds : [instanceIds]);
    const removedInstanceIds = current.units
      .filter((unit) => requestedIds.has(unit.instanceId))
      .map((unit) => unit.instanceId);
    if (!removedInstanceIds.length) return false;

    if (removedInstanceIds.length >= current.units.length) {
      this.clearFloorPlan();
      return true;
    }

    const removed = new Set(removedInstanceIds);
    const nextPlan = FloorPlanComposition.composeUnits(
      current.units.filter((unit) => !removed.has(unit.instanceId)),
    );
    return this._applyFloorPlan(nextPlan, {
      removedInstanceIds,
      reason: removedInstanceIds.length > 1 ? 'remove-multiple' : 'remove',
    });
  }

  /** Move one unit to a new zero-based position. */
  reorderFloorPlan(instanceId, targetIndex) {
    const current = this.getCurrentFloorPlan();
    if (!current) return false;
    const nextPlan = FloorPlanComposition.reorderUnit(current, instanceId, targetIndex);
    if (
      !nextPlan ||
      nextPlan.units.every((unit, index) => unit.instanceId === current.units[index]?.instanceId)
    ) {
      return false;
    }
    return this._applyFloorPlan(nextPlan, { reason: 'reorder' });
  }

  /** Update the entry-zone edge for one or more unit instances. */
  setUnitEntryZonePosition(instanceIds = [], position, options = {}) {
    const normalizedPosition = FloorPlanComposition.normalizeEntryZonePosition(position);
    const current = this.getCurrentFloorPlan();
    if (!current || !normalizedPosition) return false;

    const requestedIds = new Set(Array.isArray(instanceIds) ? instanceIds : [instanceIds]);
    if (!requestedIds.size) return false;

    let changed = false;
    const units = current.units.map((unit) => {
      if (!requestedIds.has(unit.instanceId)) return unit;
      if (unit.entryZonePosition === normalizedPosition) return unit;
      changed = true;
      return {
        ...unit,
        entryZonePosition: normalizedPosition,
      };
    });

    if (!changed) return false;

    return this._applyFloorPlan(FloorPlanComposition.composeUnits(units), {
      preserveViewport: options.preserveViewport !== false,
      reason: 'entry-zone-position',
    });
  }

  /** Replace the active composition from an ordered list of template IDs. */
  setFloorPlans(floorPlanIds = []) {
    const units = floorPlanIds
      .slice(0, Config.MAX_FLOOR_PLAN_UNITS)
      .map((id) => this._getFloorPlanById(id))
      .filter(Boolean)
      .map((template) => FloorPlanComposition.createUnit(template));
    if (!units.length) return false;
    return this._applyFloorPlan(FloorPlanComposition.composeUnits(units), {
      resetPosition: true,
      reason: 'replace',
    });
  }

  /** Restore an already-normalized or legacy saved floor plan. */
  restoreFloorPlan(savedFloorPlan, options = {}) {
    const normalized = FloorPlanComposition.normalizeFloorPlan(savedFloorPlan);
    if (!normalized) return false;
    return this._applyFloorPlan(normalized, {
      resetPosition: options.resetPosition === true,
      reason: options.reason || 'restore',
    });
  }

  _applyFloorPlan(nextPlan, options = {}) {
    if (!nextPlan) return false;

    const oldBounds = this.canvasManager.getUnitBoundsMap?.() || {};
    this.canvasManager.captureItemUnitAssignments?.(oldBounds);

    const currentLayout = this.state.get('layout') || {};

    this.state.setState({
      floorPlan: nextPlan,
      layout: {
        ...currentLayout,
        floorPlanPosition: options.resetPosition ? null : currentLayout.floorPlanPosition,
        floorPlanBounds: null,
        floorPlanLocked: options.resetPosition ? false : currentLayout.floorPlanLocked,
        unitPositions: options.resetPosition ? {} : currentLayout.unitPositions || {},
      },
    });

    if (options.resetPosition) {
      this.canvasManager.floorPlanPosition = null;
      this.canvasManager.floorPlanLocked = false;
      this.canvasManager.resetViewport();
    }

    this.canvasManager.drawFloorPlan(nextPlan, {
      preserveViewport: options.preserveViewport === true,
      suppressStateEvent: true,
    });
    const newBounds = this.canvasManager.getUnitBoundsMap?.() || {};
    this.canvasManager.reflowItemsForUnitChanges?.(
      oldBounds,
      newBounds,
      options.removedInstanceIds || [],
    );

    this.state.setState({
      items: this.state.get('items') || [],
      layout: {
        ...(this.state.get('layout') || {}),
        floorPlanPosition: this.canvasManager.getFloorPlanPosition?.() || null,
        floorPlanBounds: this.canvasManager.getFloorPlanBounds?.() || null,
        unitPositions: this.canvasManager.getUnitPositions?.() || {},
      },
    });

    this.eventBus.emit('floorplan:changed', nextPlan);
    return true;
  }

  getCurrentFloorPlan() {
    return FloorPlanComposition.normalizeFloorPlan(this.state.get('floorPlan'));
  }

  getUnits() {
    return this.getCurrentFloorPlan()?.units || [];
  }

  getUnitBounds(instanceId) {
    return this.canvasManager.getUnitBounds?.(instanceId) || null;
  }

  getAllFloorPlans() {
    return Config.FLOOR_PLANS || [];
  }

  _getFloorPlanById(id) {
    return (Config.FLOOR_PLANS || []).find((floorPlan) => floorPlan.id === id);
  }

  getArea() {
    return this.getCurrentFloorPlan()?.area || 0;
  }

  getSpan() {
    const bounds = this.canvasManager.getFloorPlanBounds?.();
    if (!bounds) return { widthFt: 0, heightFt: 0 };
    return {
      widthFt: Helpers.pxToFeet(bounds.width),
      heightFt: Helpers.pxToFeet(bounds.height),
    };
  }

  getOccupiedArea() {
    const items = this.state.get('items') || [];
    return items.reduce((total, item) => {
      if (!item.unitInstanceId) return total;
      return total + item.lengthFt * item.widthFt;
    }, 0);
  }

  getOccupancyPercentage() {
    const total = this.getArea();
    const occupied = this.getOccupiedArea();
    return total > 0 ? (occupied / total) * 100 : 0;
  }

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
        unitPositions: {},
      },
    });
    this.canvasManager.clear();
    this.canvasManager.showEmptyState?.();
    this.eventBus.emit('floorplan:cleared');
  }
}

if (typeof window !== 'undefined') {
  window.FloorPlanManager = FloorPlanManager;
}
