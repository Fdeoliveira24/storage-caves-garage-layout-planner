/* global Helpers, Config, Bounds, Modal, MeasurementTool, FloorPlanComposition */

const SelectionFilters =
  (typeof window !== 'undefined' && window.SelectionFilters) ||
  (() => {
    const filters = {
      isMeasurementObject(obj) {
        if (!obj) return false;
        return (
          !!obj.measurement ||
          !!obj.measurementHandle ||
          !!obj.isMeasurementLabel ||
          obj.measurementPart === 'text' ||
          !!obj.measurementId
        );
      },
      isFloorPlanObject(obj) {
        if (!obj) return false;
        return !!(obj.customData && obj.customData.isFloorPlan);
      },
      isLockedObject(obj) {
        if (!obj) return false;
        if (obj.customData && obj.customData.locked) return true;
        return (
          obj.lockMovementX === true && obj.lockMovementY === true && obj.lockRotation === true
        );
      },
      isSelectableObject(obj) {
        if (!obj) return false;
        if (obj.type === 'i-text') {
          if (this.isMeasurementObject(obj)) return false;
          if (this.isLockedObject(obj)) return false;
          if (obj.excludeFromSelection) return false;
          return true;
        }
        if (this.isFloorPlanObject(obj)) return false;
        if (this.isMeasurementObject(obj)) return false;
        if (this.isLockedObject(obj)) return false;
        if (obj.excludeFromSelection) return false;
        return !!(obj.customData && obj.customData.id);
      },
    };
    filters.isSelectableObject = filters.isSelectableObject.bind(filters);
    return filters;
  })();

if (typeof window !== 'undefined') {
  window.SelectionFilters = SelectionFilters;
}

/**
 * Canvas Manager - Fabric.js Canvas Management
 * Handles canvas initialization, zoom, pan, rendering
 */
class CanvasManager {
  constructor(canvasId, state, eventBus) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvas = null;
    this.canvasId = canvasId;
    this.floorPlanRect = null;
    this.entryZoneRect = null;
    this.entryZoneLabel = null;
    this.floorPlanGroup = null;
    this.floorPlanUnitGroups = new Map();
    this.unitBounds = {};
    this.floorPlanLocked = false;
    this.floorPlanPosition = this.state.get('layout.floorPlanPosition') || null;
    this.floorPlanBounds = this.state.get('layout.floorPlanBounds') || null;
    this.gridLines = [];
    this.rulerMarks = [];
    this.alignmentGuides = [];
    this.emptyStateEl = null;
    this.canvasWrapper = null;
    this.floorPlanWidth = null; // Store floor plan dimensions for re-centering
    this.floorPlanHeight = null;
    this.isAutoFitMode = true; // Track if zoom is auto-fit vs manual
    const storedLockState = this.state.get('layout.floorPlanLocked');
    if (typeof storedLockState === 'boolean') {
      this.floorPlanLocked = storedLockState;
    }

    // When true, object moves are clamped to the floor plan bounds.
    // Disabled by default so power users can stage items outside the plan.
    this.enforceFloorBounds = false;
    this.measurementTool = null;
    this._marqueeSuppressed = false;
    this._previousSelectionEnabled = true;
  }

  /**
   * Initialize Fabric.js canvas
   */
  init() {
    const canvasEl = document.getElementById(this.canvasId);
    if (!canvasEl) {
      console.error('Canvas element not found');
      return;
    }

    // Hint to browsers that we'll read pixel data often (improves getImageData perf)
    try {
      const existingContext = canvasEl.getContext('2d', { willReadFrequently: true });
      if (existingContext && typeof existingContext.willReadFrequently === 'boolean') {
        existingContext.willReadFrequently = true;
      }
    } catch (err) {
      // Older browsers may not support the option; ignore silently
    }

    this.canvas = new fabric.Canvas(this.canvasId, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      // Professional control styling
      selectionColor: 'rgba(211, 47, 47, 0.08)',
      selectionBorderColor: '#D32F2F',
      selectionLineWidth: 1.5,
      // Corner/control styling for better visibility
      borderColor: '#D32F2F',
      cornerColor: '#D32F2F',
      cornerStrokeColor: '#ffffff',
      cornerStyle: 'circle',
      cornerSize: 14,
      transparentCorners: false,
      borderDashArray: [4, 4],
      borderScaleFactor: 2,
      // Rotation control styling
      rotatingPointOffset: 40,
      // Padding for better hit area
      padding: 0,
    });
    this.canvas.perPixelTargetFind = true;
    this.canvas.targetFindTolerance = 12;

    // Customize multi-selection (ActiveSelection) appearance
    fabric.ActiveSelection.prototype.set({
      borderColor: '#D32F2F',
      cornerColor: '#D32F2F',
      cornerStrokeColor: '#ffffff',
      cornerStyle: 'circle',
      cornerSize: 14,
      transparentCorners: false,
      borderDashArray: [4, 4],
      borderScaleFactor: 2,
      padding: 0,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Listen to window resize
    window.addEventListener('resize', () => this.resizeCanvas());

    // IMPORTANT: by this point `new fabric.Canvas()` has already run, which
    // wraps the original <canvas> in Fabric's OWN internal wrapper div.
    // canvasEl.parentElement now refers to *that* Fabric-managed wrapper,
    // not our app's stable outer .canvas-wrapper from index.html -- two
    // different elements. Using .closest() explicitly targets ours instead
    // of whichever div happens to be the immediate DOM parent today.
    this.canvasWrapper = canvasEl.closest('.canvas-wrapper') || canvasEl.parentElement;

    // CRITICAL: Resize canvas synchronously BEFORE any viewport operations
    // This ensures centerAndFit() uses the correct canvas dimensions, not the default 300x150
    this.resizeCanvas();

    // The sidebar's collapse/expand uses a CSS width transition
    // (--transition-fast, 150ms). A single requestAnimationFrame after
    // toggling the class fires on the *next paint* (~16ms later) -- long
    // before that transition finishes -- so resizeCanvas() was reading a
    // mid-transition width and never getting called again once the
    // container settled. That's what cut off content after closing the
    // sidebar. ResizeObserver fires on every actual size change of the
    // container, including the transition's final settled state, so this
    // covers sidebar toggle, window resize, and any future layout change
    // without guessing at transition timing.
    //
    // This MUST observe the stable outer wrapper above, not Fabric's own
    // wrapper -- Fabric resizes its own wrapper every time setDimensions()
    // runs, and resizeCanvas() calls setDimensions(). Observing that element
    // would mean every resize triggers another resize, which on a fresh fit
    // can compute a fractionally different size and visibly nudge the
    // viewport (e.g. right after deleting something, since that's commonly
    // followed by a re-render). Observing our own wrapper avoids that loop
    // entirely, since its size is driven by page layout, not by Fabric.
    if (typeof ResizeObserver !== 'undefined' && this.canvasWrapper) {
      this._resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this._resizeObserver.observe(this.canvasWrapper);
    }

    // Initialize measurement tool once canvas is ready
    if (typeof MeasurementTool !== 'undefined') {
      this.measurementTool = new MeasurementTool(this.canvas, this.state, this.eventBus);
    }

    return this.canvas;
  }

  /**
   * Resize canvas to fit container
   * Re-centers floor plan ONLY if in auto-fit mode (preserves manual zoom)
   */
  resizeCanvas() {
    if (!this.canvas) return;

    const container = this.canvas.wrapperEl.parentElement;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Skip the work entirely if the container's size hasn't actually
    // changed since last time. Without this, anything that calls
    // resizeCanvas() speculatively (window resize listener, the
    // ResizeObserver above) re-runs setDimensions + centerAndFit every
    // single time even when nothing changed, which is at best wasted work
    // and at worst a visible nudge if a sub-pixel rounding difference
    // sneaks in between calls.
    if (this._lastCanvasWidth === width && this._lastCanvasHeight === height) {
      return;
    }
    this._lastCanvasWidth = width;
    this._lastCanvasHeight = height;

    this.canvas.setDimensions({ width, height });

    // Re-center floor plan ONLY if in auto-fit mode
    // This preserves user's manual zoom level when resizing window
    if (this.isAutoFitMode && this.floorPlanWidth && this.floorPlanHeight) {
      this.centerAndFit(this.floorPlanWidth, this.floorPlanHeight);
    }

    this.canvas.renderAll();
  }

  /**
   * Get measurement tool instance
   */
  getMeasurementTool() {
    return this.measurementTool;
  }

  /**
   * Normalize Fabric selection to only include selectable objects
   * Enforces mutually exclusive selections for measurements and text objects
   * @private
   */
  _normalizeSelection() {
    if (!this.canvas) return [];
    const active = this.canvas.getActiveObject();
    if (!active) return [];

    if (active.type === 'activeSelection') {
      const objects = active.getObjects() || [];
      const floorPlanUnitObjs = objects.filter((obj) => obj?.customData?.isFloorPlanUnit);
      const measurementObjs = objects.filter((obj) => SelectionFilters.isMeasurementObject(obj));
      const textObjs = objects.filter(
        (obj) => obj.type === 'i-text' && !SelectionFilters.isMeasurementObject(obj),
      );
      const itemObjs = objects.filter(
        (obj) => SelectionFilters.isSelectableObject(obj) && obj.type !== 'i-text',
      );

      const hasMeasurement = measurementObjs.length > 0;
      const hasText = textObjs.length > 0;
      const hasItems = itemObjs.length > 0;

      // Floor-plan units may be Shift-clicked into their own active
      // selection for batch deletion. Keep them isolated from items, text,
      // and measurements so normal item tools never operate on a garage.
      if (floorPlanUnitObjs.length === objects.length && floorPlanUnitObjs.length > 0) {
        active.set?.({
          hasControls: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
        });
        this.canvas.requestRenderAll();
        return floorPlanUnitObjs;
      }

      // Prevent mixed selection: measurement + anything (mutually exclusive)
      if (hasMeasurement && (hasText || hasItems)) {
        // Try to restore original state before corruption
        if (typeof active._restoreObjectsState === 'function') {
          active._restoreObjectsState();
        }
        // Disallow mixed selection entirely to prevent movement/corruption
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        return [];
      }

      // Only one text object can be selected at a time (mutually exclusive)
      if (hasText && textObjs.length > 1) {
        const firstText = textObjs[0];
        this.canvas.setActiveObject(firstText);
        this.canvas.requestRenderAll();
        return [firstText];
      }

      // Prevent mixed selection: text + items (mutually exclusive)
      if (hasText && hasItems) {
        // Keep only items (discard text to maintain consistency)
        if (itemObjs.length === 1) {
          this.canvas.setActiveObject(itemObjs[0]);
        } else if (itemObjs.length > 1) {
          const selection = new fabric.ActiveSelection(itemObjs, { canvas: this.canvas });
          this.canvas.setActiveObject(selection);
        } else {
          this.canvas.discardActiveObject();
        }
        this.canvas.requestRenderAll();
        return itemObjs;
      }

      // Allow only: multiple items OR single text OR multiple measurements (all mutually exclusive)
      const filtered = hasItems ? itemObjs : hasText ? textObjs : measurementObjs;
      if (filtered.length === 0) {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        return [];
      }
      if (filtered.length !== objects.length) {
        if (filtered.length === 1) {
          this.canvas.setActiveObject(filtered[0]);
        } else {
          const selection = new fabric.ActiveSelection(filtered, {
            canvas: this.canvas,
          });
          this.canvas.setActiveObject(selection);
        }
        this.canvas.requestRenderAll();
      }
      return filtered;
    }

    if (SelectionFilters.isSelectableObject(active) || active?.customData?.isFloorPlanUnit) {
      return [active];
    }

    return [];
  }

  /**
   * Filter helper for selection arrays
   * @private
   */
  _filterSelectableObjects(objects = []) {
    return objects.filter((obj) => SelectionFilters.isSelectableObject(obj));
  }

  _hasMixedMeasurementSelection() {
    const active = this.canvas?.getActiveObject?.();
    if (!active || active.type !== 'activeSelection') return false;
    const objects = active.getObjects?.() || [];
    if (!objects.length) return false;
    const hasMeasurement = objects.some((obj) => SelectionFilters.isMeasurementObject(obj));
    const hasNonMeasurement = objects.some((obj) => !SelectionFilters.isMeasurementObject(obj));
    return hasMeasurement && hasNonMeasurement;
  }

  /** Position independent unit groups, preserving saved coordinates when available. */
  _positionFloorPlanGroup(forceCenter = false) {
    if (!this.floorPlanUnitGroups.size || !this.canvas) return;
    const floorPlan = FloorPlanComposition.normalizeFloorPlan(this.state.get('floorPlan'));
    if (!floorPlan) return;
    const canvasCenter = this.canvas.getCenter();
    const savedPositions = this.state.get('layout.unitPositions') || {};
    const gap = Config.FLOOR_PLAN_INITIAL_GAP;
    const positionedBounds = [];
    const positionedIds = new Set();

    floorPlan.units.forEach((unit) => {
      const group = this.floorPlanUnitGroups.get(unit.instanceId);
      if (!group) return;
      const width = Helpers.feetToPx(unit.widthFt);
      const height = Helpers.feetToPx(unit.heightFt);
      const saved = savedPositions[unit.instanceId];
      const position = forceCenter ? { left: group.left, top: group.top } : saved;
      if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
        group.set({ left: position.left, top: position.top });
        group.setCoords();
        positionedIds.add(unit.instanceId);
        positionedBounds.push({
          left: position.left - width / 2,
          top: position.top - height / 2,
          right: position.left + width / 2,
          bottom: position.top + height / 2,
        });
      }
    });

    let rightEdge = positionedBounds.length
      ? Math.max(...positionedBounds.map((bounds) => bounds.right))
      : canvasCenter.left -
        (floorPlan.units.reduce((sum, unit) => sum + Helpers.feetToPx(unit.widthFt), 0) +
          gap * Math.max(0, floorPlan.units.length - 1)) /
          2;
    const bottomEdge = positionedBounds.length
      ? Math.max(...positionedBounds.map((bounds) => bounds.bottom))
      : canvasCenter.top + Helpers.feetToPx(floorPlan.heightFt) / 2;
    if (positionedBounds.length) rightEdge += gap;

    floorPlan.units.forEach((unit) => {
      const group = this.floorPlanUnitGroups.get(unit.instanceId);
      if (!group) return;
      if (positionedIds.has(unit.instanceId)) return;

      const width = Helpers.feetToPx(unit.widthFt);
      const height = Helpers.feetToPx(unit.heightFt);
      group.set({
        left: rightEdge + width / 2,
        top: bottomEdge - height / 2,
      });
      group.setCoords();
      rightEdge += width + gap;
    });

    if (forceCenter) {
      this._updateFloorPlanBounds();
      const bounds = this.floorPlanBounds;
      if (bounds) {
        const deltaX = canvasCenter.left - (bounds.left + bounds.width / 2);
        const deltaY = canvasCenter.top - (bounds.top + bounds.height / 2);
        this.floorPlanUnitGroups.forEach((group) => {
          group.set({ left: group.left + deltaX, top: group.top + deltaY });
          group.setCoords();
        });
      }
    }

    this.floorPlanUnitGroups.forEach((group) => {
      group._lastUnitPosition = { left: group.left, top: group.top };
    });
    this._updateFloorPlanBounds();
    this.ensureStaticLayersBehind();
    this.canvas.renderAll();
  }

  _handleUnitMoving(group) {
    if (!group?.customData?.isFloorPlanUnit) return;
    const snappedToNeighbor = this._snapUnitToNeighbors(group);
    // Mutually exclusive with the neighbor snap above, on purpose: both
    // adjust group.left/top independently, and if a drag position happens
    // to be near a neighbor's edge AND near the viewport center at once
    // (common, since combos are usually auto-centered), running both would
    // have the center-guide silently override the neighbor snap's
    // carefully-zeroed gap with its own correction -- producing exactly the
    // overlap/gap-between-units bug this was causing. Neighbor adjacency
    // wins whenever both could apply.
    if (!snappedToNeighbor) {
      this._updateUnitSmartGuides(group);
    } else {
      this._hideSmartGuides();
    }
    // Compute the position delta AFTER both snaps above so assigned items
    // ride along with the unit's final post-snap position, not a
    // pre-snap one they'd otherwise drift out of sync with.
    const previous = group._lastUnitPosition || { left: group.left, top: group.top };
    const deltaX = group.left - previous.left;
    const deltaY = group.top - previous.top;
    this._moveItemsWithUnit(group.customData.unitInstanceId, deltaX, deltaY);
    group._lastUnitPosition = { left: group.left, top: group.top };
    group.setCoords();
    this._updateFloorPlanBounds();
    this.ensureStaticLayersBehind();
  }

  _handleUnitModified(group) {
    if (!group?.customData?.isFloorPlanUnit) return;
    this._handleUnitMoving(group);
    this._hideSmartGuides();
    this.refreshItemFloorPlanStates();
    this._emitFloorPlanStateChanged();
  }

  /**
   * Smart guides for a dragged unit/garage: show/snap when centered on the
   * canvas viewport itself, the "canvas" reference the request asked for
   * (as opposed to an item's guide, which is relative to its own unit).
   * @private
   */
  _updateUnitSmartGuides(group) {
    const center = this.getViewportCenter();
    const span = this._getViewportLogicalBounds();
    const zoom = this.canvas?.getZoom?.() || 1;
    this._updateSmartGuides(group, { x: center.x, y: center.y }, span, 6 / zoom);
  }

  _moveItemsWithUnit(instanceId, deltaX, deltaY) {
    if (!deltaX && !deltaY) return;
    const items = this.state.get('items') || [];
    items.forEach((item) => {
      if (item.unitInstanceId !== instanceId || !item.canvasObject) return;
      item.canvasObject.set({
        left: item.canvasObject.left + deltaX,
        top: item.canvasObject.top + deltaY,
      });
      item.canvasObject.setCoords();
      this._syncItemLabel(item.canvasObject);
      item.x = item.canvasObject.left;
      item.y = item.canvasObject.top;
    });
  }

  /**
   * @returns {boolean} true if a neighbor edge-snap was found and applied
   */
  _snapUnitToNeighbors(group) {
    // Config.FLOOR_PLAN_SNAP_THRESHOLD is a LOGICAL (canvas-space) distance,
    // but the user is aiming a mouse cursor in SCREEN space. At 100% zoom
    // those are the same thing, but a multi-unit combo is normally viewed
    // zoomed out to fit on screen (50-85% in practice) -- at 70% zoom a
    // a small logical threshold becomes an even smaller screen target, well below
    // reliable mouse precision. That's what made this feel random: it's
    // not inconsistent, the catch zone is just too small to hit once
    // you're zoomed out enough to see the whole layout. Dividing by zoom
    // keeps the on-screen catch zone a constant size regardless of zoom.
    const zoom = this.canvas?.getZoom?.() || 1;
    const threshold = Config.FLOOR_PLAN_SNAP_THRESHOLD / zoom;
    const alignmentThreshold = threshold * 2;
    const movingBounds = this._getUnitBoundsForGroup(group);
    if (!movingBounds) return false;
    const previousPosition = group._lastUnitPosition;
    const previousBounds = previousPosition
      ? this._shiftBounds(
          movingBounds,
          previousPosition.left - group.left,
          previousPosition.top - group.top,
        )
      : movingBounds;
    const candidates = [];

    this.floorPlanUnitGroups.forEach((otherGroup) => {
      if (otherGroup === group) return;
      const other = this._getUnitBoundsForGroup(otherGroup);
      if (!other) return;

      const verticalOverlap = this._intervalOverlap(
        movingBounds.top,
        movingBounds.bottom,
        other.top,
        other.bottom,
      );
      const verticalGap = Math.max(0, -verticalOverlap);
      const previousVerticalOverlap = this._intervalOverlap(
        previousBounds.top,
        previousBounds.bottom,
        other.top,
        other.bottom,
      );

      const horizontalEdges = [
        {
          distance: Math.abs(movingBounds.right - other.left),
          delta: other.left - movingBounds.right,
          crossed:
            previousBounds.right < other.left &&
            movingBounds.right >= other.left &&
            Math.max(verticalOverlap, previousVerticalOverlap) > 0,
        },
        {
          distance: Math.abs(movingBounds.left - other.right),
          delta: other.right - movingBounds.left,
          crossed:
            previousBounds.left > other.right &&
            movingBounds.left <= other.right &&
            Math.max(verticalOverlap, previousVerticalOverlap) > 0,
        },
      ];
      horizontalEdges.forEach((edge) => {
        if (verticalGap > alignmentThreshold || (edge.distance > threshold && !edge.crossed)) {
          return;
        }
        const alignments =
          verticalOverlap > 0
            ? [
                other.top - movingBounds.top,
                other.bottom - movingBounds.bottom,
                other.centerY - movingBounds.centerY,
              ]
            : [other.top - movingBounds.bottom, other.bottom - movingBounds.top];
        const alignY = alignments.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
        const deltaY = Math.abs(alignY) <= alignmentThreshold ? alignY : 0;
        candidates.push({
          score: Math.hypot(edge.delta, deltaY),
          deltaX: edge.delta,
          deltaY,
        });
      });

      const horizontalOverlap = this._intervalOverlap(
        movingBounds.left,
        movingBounds.right,
        other.left,
        other.right,
      );
      const horizontalGap = Math.max(0, -horizontalOverlap);
      const previousHorizontalOverlap = this._intervalOverlap(
        previousBounds.left,
        previousBounds.right,
        other.left,
        other.right,
      );

      const verticalEdges = [
        {
          distance: Math.abs(movingBounds.bottom - other.top),
          delta: other.top - movingBounds.bottom,
          crossed:
            previousBounds.bottom < other.top &&
            movingBounds.bottom >= other.top &&
            Math.max(horizontalOverlap, previousHorizontalOverlap) > 0,
        },
        {
          distance: Math.abs(movingBounds.top - other.bottom),
          delta: other.bottom - movingBounds.top,
          crossed:
            previousBounds.top > other.bottom &&
            movingBounds.top <= other.bottom &&
            Math.max(horizontalOverlap, previousHorizontalOverlap) > 0,
        },
      ];
      verticalEdges.forEach((edge) => {
        if (horizontalGap > alignmentThreshold || (edge.distance > threshold && !edge.crossed)) {
          return;
        }
        const alignments =
          horizontalOverlap > 0
            ? [
                other.left - movingBounds.left,
                other.right - movingBounds.right,
                other.centerX - movingBounds.centerX,
              ]
            : [other.left - movingBounds.right, other.right - movingBounds.left];
        const alignX = alignments.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
        const deltaX = Math.abs(alignX) <= alignmentThreshold ? alignX : 0;
        candidates.push({
          score: Math.hypot(deltaX, edge.delta),
          deltaX,
          deltaY: edge.delta,
        });
      });
    });

    const best = candidates.sort((a, b) => a.score - b.score)[0];
    if (!best) return false;
    group.set({ left: group.left + best.deltaX, top: group.top + best.deltaY });
    group.setCoords();
    return true;
  }

  _intervalOverlap(startA, endA, startB, endB) {
    return Math.min(endA, endB) - Math.max(startA, startB);
  }

  _shiftBounds(bounds, deltaX, deltaY) {
    return {
      ...bounds,
      left: bounds.left + deltaX,
      right: bounds.right + deltaX,
      top: bounds.top + deltaY,
      bottom: bounds.bottom + deltaY,
      centerX: bounds.centerX + deltaX,
      centerY: bounds.centerY + deltaY,
    };
  }

  /**
   * Lock/unlock floor plan movement
   */
  setFloorPlanLocked(isLocked = true, options = {}) {
    this.floorPlanLocked = isLocked;
    if (!this.floorPlanUnitGroups.size) return;
    this.floorPlanUnitGroups.forEach((group) => {
      group.set({
        lockMovementX: isLocked,
        lockMovementY: isLocked,
        selectable: !isLocked,
        evented: !isLocked,
      });
      group.setCoords();
    });
    this.canvas.requestRenderAll();
    if (!options.silent) {
      this.eventBus.emit('floorplan:lock:toggled', isLocked);
    }
  }

  /**
   * Reset floor plan position to canvas center
   */
  resetFloorPlanPosition() {
    this._positionFloorPlanGroup(true);
    // Ensure viewport recenters on the floor plan so it becomes visible
    this.centerAndFit();
    this._emitFloorPlanStateChanged();
  }

  /**
   * Get current floor plan position
   */
  getFloorPlanPosition() {
    const bounds = this.floorPlanBounds || this._updateFloorPlanBounds();
    if (!bounds) return null;
    return { left: bounds.left + bounds.width / 2, top: bounds.top + bounds.height / 2 };
  }

  getUnitPositions() {
    return Object.fromEntries(
      [...this.floorPlanUnitGroups.entries()].map(([instanceId, group]) => [
        instanceId,
        { left: group.left, top: group.top },
      ]),
    );
  }

  getSelectedFloorPlanUnitIds() {
    const active = this.canvas?.getActiveObject?.();
    if (!active) return [];
    const objects =
      active.type === 'activeSelection' && typeof active.getObjects === 'function'
        ? active.getObjects()
        : [active];
    return [
      ...new Set(
        objects
          .filter((object) => object?.customData?.isFloorPlanUnit)
          .map((object) => object.customData.unitInstanceId)
          .filter(Boolean),
      ),
    ];
  }

  selectFloorPlanUnits(instanceIds = []) {
    if (!this.canvas) return false;
    const ids = [...new Set(Array.isArray(instanceIds) ? instanceIds : [instanceIds])].filter(
      Boolean,
    );
    const groups = ids.map((id) => this.floorPlanUnitGroups.get(id)).filter(Boolean);
    if (!groups.length) return false;

    if (groups.length === 1) {
      this.canvas.setActiveObject(groups[0]);
    } else if (typeof fabric !== 'undefined' && fabric.ActiveSelection) {
      this.canvas.setActiveObject(new fabric.ActiveSelection(groups, { canvas: this.canvas }));
    }

    this._syncFloorPlanUnitSelectionHighlights();
    this.canvas.requestRenderAll?.();
    return true;
  }

  _syncFloorPlanUnitSelectionHighlights() {
    if (!this.floorPlanUnitGroups?.size) return;

    this.floorPlanUnitGroups.forEach((group) => {
      group.set?.({
        borderColor: 'rgba(102, 102, 255, 0.55)',
      });

      if (group.floorPlanRect?.set) {
        group.floorPlanRect.set({
          fill: Config.COLORS.floorPlan,
          stroke: Config.COLORS.floorPlanStroke,
          strokeWidth: 2,
        });
      }

      group.dirty = true;
    });

    this.canvas?.requestRenderAll?.();
  }

  /**
   * Get current floor plan bounds
   */
  getFloorPlanBounds() {
    return this.floorPlanBounds ? { ...this.floorPlanBounds } : null;
  }

  getUnitBounds(instanceId) {
    const bounds = this.unitBounds?.[instanceId];
    return bounds ? { ...bounds } : null;
  }

  getUnitBoundsMap() {
    return Object.fromEntries(
      Object.entries(this.unitBounds || {}).map(([instanceId, bounds]) => [
        instanceId,
        { ...bounds },
      ]),
    );
  }

  /**
   * Check if a canvas coordinate lies within the current floor plan bounds
   */
  isPointInsideFloorPlan(x, y) {
    this._updateUnitBounds();
    return Object.values(this.unitBounds).some(
      (bounds) =>
        x >= bounds.left &&
        x <= bounds.left + bounds.width &&
        y >= bounds.top &&
        y <= bounds.top + bounds.height,
    );
  }

  getContainingUnitId(obj, boundsMap = this.unitBounds) {
    if (!obj) return null;
    const floorPlan = FloorPlanComposition.normalizeFloorPlan(this.state.get('floorPlan'));
    if (!floorPlan) return null;
    const currentInstanceId = obj.customData?.unitInstanceId;
    const orderedUnits = [...floorPlan.units].sort((a, b) => {
      if (a.instanceId === currentInstanceId) return -1;
      if (b.instanceId === currentInstanceId) return 1;
      return 0;
    });
    const unit = orderedUnits.find((candidate) => {
      const bounds = boundsMap?.[candidate.instanceId];
      return bounds && Bounds.isWithinBounds(obj, candidate, bounds);
    });
    return unit?.instanceId || null;
  }

  /**
   * Update item styling based on whether it's inside the floor plan
   * @private
   */
  _updateItemFloorPlanState(obj, suppressRender = false) {
    if (!obj || SelectionFilters.isFloorPlanObject(obj) || obj.type === 'activeSelection') return;
    if (!obj.customData) return;

    const unitInstanceId = this.getContainingUnitId(obj);
    const inside = !!unitInstanceId;
    if (
      obj.customData._insideFloorPlan === inside &&
      obj.customData.unitInstanceId === unitInstanceId
    ) {
      return;
    }

    obj.customData._insideFloorPlan = inside;
    obj.customData.unitInstanceId = unitInstanceId;

    if (!obj._originalBorderColor) {
      obj._originalBorderColor = obj.borderColor || '#6366F1';
    }
    if (!obj._originalShadow) {
      obj._originalShadow = obj.shadow;
    }

    if (inside) {
      obj.set({
        borderColor: '#22C55E',
        shadow: new fabric.Shadow({
          color: 'rgba(34,197,94,0.4)',
          blur: 18,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    } else {
      obj.set({
        borderColor: obj._originalBorderColor,
        shadow: obj._originalShadow || null,
      });
    }

    obj.setCoords();
    if (!suppressRender) {
      this.canvas.requestRenderAll();
    }
  }

  _refreshItemFloorPlanStates() {
    if (!this.canvas) return;
    const objects = this.canvas.getObjects() || [];
    objects.forEach((obj) => {
      if (obj.customData && !SelectionFilters.isFloorPlanObject(obj)) {
        this._updateItemFloorPlanState(obj, true);
      }
    });
    this.canvas.requestRenderAll();
  }

  refreshItemFloorPlanStates() {
    this._refreshItemFloorPlanStates();
    const items = this.state.get('items') || [];
    items.forEach((item) => {
      if (item.canvasObject?.customData) {
        item.unitInstanceId = item.canvasObject.customData.unitInstanceId || null;
      }
    });
    return items;
  }

  captureItemUnitAssignments(boundsMap = this.unitBounds) {
    const items = this.state.get('items') || [];
    items.forEach((item) => {
      if (!item.canvasObject) return;
      const instanceId = this.getContainingUnitId(item.canvasObject, boundsMap);
      item.unitInstanceId = instanceId;
      if (item.canvasObject.customData) {
        item.canvasObject.customData.unitInstanceId = instanceId;
      }
    });
    return items;
  }

  reflowItemsForUnitChanges(oldBounds = {}, newBounds = {}, removedInstanceIds = []) {
    const removed = new Set(removedInstanceIds);
    const items = this.state.get('items') || [];

    items.forEach((item) => {
      const instanceId = item.unitInstanceId;
      const canvasObject = item.canvasObject;
      if (!canvasObject || !instanceId) return;

      if (removed.has(instanceId) || !newBounds[instanceId]) {
        item.unitInstanceId = null;
        if (canvasObject.customData) canvasObject.customData.unitInstanceId = null;
        return;
      }

      const previous = oldBounds[instanceId];
      const next = newBounds[instanceId];
      if (!previous || !next) return;

      const deltaX = next.left - previous.left;
      const deltaY = next.top - previous.top;
      canvasObject.set({
        left: canvasObject.left + deltaX,
        top: canvasObject.top + deltaY,
      });
      canvasObject.setCoords();
      item.x = canvasObject.left;
      item.y = canvasObject.top;
    });

    this.refreshItemFloorPlanStates();
    this.canvas.requestRenderAll();
  }

  /**
   * Update cached floor plan bounds
   * @private
   */
  _updateFloorPlanBounds() {
    this._updateUnitBounds();
    const boundsList = Object.values(this.unitBounds);
    if (!boundsList.length) {
      this.floorPlanBounds = null;
      return null;
    }
    const left = Math.min(...boundsList.map((bounds) => bounds.left));
    const top = Math.min(...boundsList.map((bounds) => bounds.top));
    const right = Math.max(...boundsList.map((bounds) => bounds.left + bounds.width));
    const bottom = Math.max(...boundsList.map((bounds) => bounds.top + bounds.height));
    this.floorPlanBounds = {
      left,
      top,
      width: right - left,
      height: bottom - top,
    };
    this.floorPlanWidth = this.floorPlanBounds.width;
    this.floorPlanHeight = this.floorPlanBounds.height;
    this.floorPlanPosition = {
      left: left + this.floorPlanBounds.width / 2,
      top: top + this.floorPlanBounds.height / 2,
    };
    return this.floorPlanBounds;
  }

  _updateUnitBounds() {
    const floorPlan = FloorPlanComposition.normalizeFloorPlan(this.state.get('floorPlan'));
    if (!floorPlan || !this.floorPlanUnitGroups.size) {
      this.unitBounds = {};
      return this.unitBounds;
    }

    this.unitBounds = Object.fromEntries(
      floorPlan.units
        .map((unit) => {
          const group = this.floorPlanUnitGroups.get(unit.instanceId);
          return group ? [unit.instanceId, this._getUnitBoundsForGroup(group)] : null;
        })
        .filter(Boolean),
    );
    return this.unitBounds;
  }

  _getUnitBoundsForGroup(group) {
    const instanceId = group?.customData?.unitInstanceId;
    const floorPlan = FloorPlanComposition.normalizeFloorPlan(this.state.get('floorPlan'));
    const unit = floorPlan?.units.find((candidate) => candidate.instanceId === instanceId);
    if (!group || !unit) return null;

    // A Fabric group can be larger and asymmetrical relative to the actual
    // floor rectangle because it also contains strokes, ruler labels, and
    // other decorations. Snapping from group.left/top plus nominal unit
    // dimensions therefore produces visible seams or overlaps. Transform
    // the floor rectangle's own fill boundary into canvas space instead.
    const rect = group.floorPlanRect;
    const matrix = rect?.calcTransformMatrix?.();
    if (
      rect &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      Array.isArray(matrix) &&
      matrix.length >= 6 &&
      matrix.every(Number.isFinite)
    ) {
      const halfWidth = rect.width / 2;
      const halfHeight = rect.height / 2;
      const corners = [
        [-halfWidth, -halfHeight],
        [halfWidth, -halfHeight],
        [halfWidth, halfHeight],
        [-halfWidth, halfHeight],
      ].map(([x, y]) => ({
        x: matrix[0] * x + matrix[2] * y + matrix[4],
        y: matrix[1] * x + matrix[3] * y + matrix[5],
      }));
      const left = Math.min(...corners.map((corner) => corner.x));
      const right = Math.max(...corners.map((corner) => corner.x));
      const top = Math.min(...corners.map((corner) => corner.y));
      const bottom = Math.max(...corners.map((corner) => corner.y));
      return {
        left,
        top,
        right,
        bottom,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
        width: right - left,
        height: bottom - top,
      };
    }

    // Lightweight test doubles and legacy groups do not expose a child
    // transform matrix, so preserve the nominal-dimension fallback.
    const width = Helpers.feetToPx(unit.widthFt);
    const height = Helpers.feetToPx(unit.heightFt);
    return {
      left: group.left - width / 2,
      top: group.top - height / 2,
      right: group.left + width / 2,
      bottom: group.top + height / 2,
      centerX: group.left,
      centerY: group.top,
      width,
      height,
    };
  }

  /**
   * Emit floor plan state (position + bounds)
   * @private
   */
  _emitFloorPlanStateChanged() {
    if (!this.floorPlanUnitGroups.size) return;
    const bounds = this._updateFloorPlanBounds();
    this._refreshItemFloorPlanStates();
    this.eventBus.emit('floorplan:moved', {
      position: this.floorPlanPosition ? { ...this.floorPlanPosition } : null,
      bounds: bounds ? { ...bounds } : null,
      unitBounds: this.getUnitBoundsMap(),
      unitPositions: this.getUnitPositions(),
    });
  }

  /**
   * Setup canvas event listeners
   */
  setupEventListeners() {
    // Suppress marquee when starting on restricted layers
    this.canvas.on('mouse:down', (opt) => {
      const target = opt ? opt.target : null;
      const suppress =
        !!target &&
        (SelectionFilters.isFloorPlanObject(target) ||
          SelectionFilters.isMeasurementObject(target));
      if (suppress) {
        this._marqueeSuppressed = true;
        this._previousSelectionEnabled = this.canvas.selection;
        this.canvas.selection = false;
      }
    });

    this.canvas.on('mouse:up', () => {
      if (this._marqueeSuppressed) {
        this.canvas.selection = this._previousSelectionEnabled !== false;
        this._marqueeSuppressed = false;
      }
    });

    // Object moving
    this.canvas.on('object:moving', (e) => {
      if (SelectionFilters.isFloorPlanObject(e?.target)) return;
      // If snap-to-grid is enabled, snap the moving object to the grid.
      try {
        if (this.state && this.state.get && this.state.get('settings.snapToGrid')) {
          if (e && e.target) {
            Bounds.snapItemToGrid(e.target);
          }
        }
      } catch (err) {
        // Defensive: don't let snapping break dragging
        console.warn('[CanvasManager] Snap-to-grid failed during move:', err);
      }

      this._enforceItemBounds(e.target);
      this._updateItemFloorPlanState(e.target);
      this._moveLabelsWithTarget(e.target);
      this._updateItemSmartGuides(e.target);
      this.eventBus.emit('canvas:object:moving', e.target);
    });

    // Object moved
    this.canvas.on('object:modified', (e) => {
      if (SelectionFilters.isFloorPlanObject(e?.target)) return;
      // Snap item to grid on modification (drop) if setting enabled
      try {
        if (this.state && this.state.get && this.state.get('settings.snapToGrid')) {
          if (e && e.target) {
            Bounds.snapItemToGrid(e.target);
          }
        }
      } catch (err) {
        console.warn('[CanvasManager] Snap-to-grid failed on modify:', err);
      }

      this._enforceItemBounds(e.target);
      this._updateItemFloorPlanState(e.target);
      this._syncLabelsForTarget(e.target);
      this._resetLabelTracking(e.target);
      this._hideSmartGuides();
      this.eventBus.emit('canvas:object:modified', e.target);
    });

    // Selection created
    this.canvas.on('selection:created', (_e) => {
      if (this._hasMixedMeasurementSelection()) {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        this.eventBus.emit('canvas:selection:cleared');
        this.eventBus.emit('canvas:selection:changed', null);
        return;
      }
      const normalized = this._normalizeSelection();
      if (!normalized.length) {
        this._syncFloorPlanUnitSelectionHighlights();
        this.eventBus.emit('canvas:selection:cleared');
        this.eventBus.emit('canvas:selection:changed', null);
        return;
      }
      this._primeLabelTracking(this.canvas.getActiveObject());
      this._syncFloorPlanUnitSelectionHighlights();
      this.eventBus.emit('canvas:selection:created', normalized);
      this.eventBus.emit('canvas:selection:changed', this.canvas.getActiveObject() || null);
    });

    // Selection updated
    this.canvas.on('selection:updated', (_e) => {
      if (this._hasMixedMeasurementSelection()) {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
        this.eventBus.emit('canvas:selection:cleared');
        this.eventBus.emit('canvas:selection:changed', null);
        return;
      }
      const normalized = this._normalizeSelection();
      if (!normalized.length) {
        this._syncFloorPlanUnitSelectionHighlights();
        this.eventBus.emit('canvas:selection:cleared');
        this.eventBus.emit('canvas:selection:changed', null);
        return;
      }
      this._primeLabelTracking(this.canvas.getActiveObject());
      this._syncFloorPlanUnitSelectionHighlights();
      this.eventBus.emit('canvas:selection:updated', normalized);
      this.eventBus.emit('canvas:selection:changed', this.canvas.getActiveObject() || null);
    });

    // Selection cleared
    this.canvas.on('selection:cleared', () => {
      this._syncAllItemLabels();
      this._syncFloorPlanUnitSelectionHighlights();
      this.eventBus.emit('canvas:selection:cleared');
      this.eventBus.emit('canvas:selection:changed', null);
    });

    // Disallow starting a mixed selection between measurement and non-measurement objects
    this.canvas.on('mouse:down', (opt) => {
      const target = opt?.target;
      if (!target) return;
      const active = this.canvas.getActiveObject();
      if (!active) return;

      const targetIsMeasurement = SelectionFilters.isMeasurementObject(target);

      const activeObjects =
        active.type === 'activeSelection' && typeof active.getObjects === 'function'
          ? active.getObjects()
          : [active];

      const activeHasMeasurement = activeObjects.some((obj) =>
        SelectionFilters.isMeasurementObject(obj),
      );
      const activeHasNonMeasurement = activeObjects.some(
        (obj) => !SelectionFilters.isMeasurementObject(obj),
      );

      const activeIsMeasurementOnly = activeHasMeasurement && !activeHasNonMeasurement;
      const activeIsNonMeasurementOnly = activeHasNonMeasurement && !activeHasMeasurement;

      if (
        (activeIsMeasurementOnly && !targetIsMeasurement) ||
        (activeIsNonMeasurementOnly && targetIsMeasurement)
      ) {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
      }
    });

    // Mouse wheel zoom
    this.canvas.on('mouse:wheel', (opt) => {
      this.handleMouseWheel(opt);
    });

    // Photoshop-style hold-spacebar-to-pan. App.js toggles _panModeActive
    // via enablePanMode()/disablePanMode() on keydown/keyup; these handlers
    // just do the actual dragging once that mode is on, and stay inert
    // (immediate return) the rest of the time.
    this.canvas.on('mouse:down', (opt) => {
      if (!this._panModeActive) return;
      this._isPanning = true;
      this._lastPanClientPoint = { x: opt.e.clientX, y: opt.e.clientY };
      this.canvas.defaultCursor = 'grabbing';
      this.canvas.setCursor('grabbing');
    });

    this.canvas.on('mouse:move', (opt) => {
      if (!this._panModeActive || !this._isPanning) return;
      const point = this._lastPanClientPoint;
      const deltaX = opt.e.clientX - point.x;
      const deltaY = opt.e.clientY - point.y;
      this._lastPanClientPoint = { x: opt.e.clientX, y: opt.e.clientY };
      this.canvas.relativePan(new fabric.Point(deltaX, deltaY));
      this.isAutoFitMode = false;
    });

    this.canvas.on('mouse:up', () => {
      if (!this._panModeActive) return;
      this._isPanning = false;
      this.canvas.defaultCursor = 'grab';
      this.canvas.setCursor('grab');
    });
  }

  /**
   * Handle mouse wheel for zoom
   */
  handleMouseWheel(opt) {
    const delta = opt.e.deltaY;
    let zoom = this.canvas.getZoom();
    zoom *= 0.999 ** delta;

    // Limit zoom to match slider range (10% - 200%)
    if (zoom > 2) zoom = 2;
    if (zoom < 0.1) zoom = 0.1;

    // Zoom around the viewport's own center, not the cursor position.
    // zoomToPoint() keeps whatever point you pass it visually fixed while
    // scaling everything else around it -- anchoring on the cursor (the
    // previous behavior) is the standard "zoom toward pointer" pattern, but
    // since the cursor is rarely exactly centered, every scroll was also
    // shifting the pan by a few pixels as a side effect of keeping that
    // off-center point fixed. That's what read as "scrolling sideways"
    // instead of a pure in/out zoom. Anchoring on the canvas center makes
    // wheel-zoom purely radial -- no lateral drift, regardless of where
    // the cursor happens to be.
    const center = this.canvas.getCenter();
    this.canvas.zoomToPoint(new fabric.Point(center.left, center.top), zoom);

    // User manually zoomed - exit auto-fit mode
    this.isAutoFitMode = false;

    opt.e.preventDefault();
    opt.e.stopPropagation();

    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Enter spacebar-pan mode: clicking and dragging pans the viewport
   * instead of selecting/moving objects. Stores prior selection/targeting
   * state so disablePanMode() can restore it exactly.
   */
  enablePanMode() {
    if (!this.canvas || this._panModeActive) return;
    this._panModeActive = true;
    this._prevSelection = this.canvas.selection;
    this._prevSkipTargetFind = this.canvas.skipTargetFind;
    this.canvas.selection = false;
    this.canvas.skipTargetFind = true;
    this.canvas.defaultCursor = 'grab';
    this.canvas.setCursor('grab');
  }

  /**
   * Exit spacebar-pan mode and restore normal click/select/drag behavior.
   */
  disablePanMode() {
    if (!this.canvas || !this._panModeActive) return;
    this._panModeActive = false;
    this._isPanning = false;
    this.canvas.selection = this._prevSelection !== false;
    this.canvas.skipTargetFind = this._prevSkipTargetFind || false;
    this.canvas.defaultCursor = 'default';
    this.canvas.setCursor('default');
    this.canvas.requestRenderAll();
  }

  /**
   * Show empty state message
   */
  showEmptyState() {
    if (!this.canvasWrapper) return;

    if (!this.emptyStateEl) {
      const el = document.createElement('div');
      el.className = 'canvas-empty-state';
      el.innerHTML = `
        <div class="canvas-empty-card">
          <svg class="canvas-empty-icon" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="8" y="12" width="48" height="40" rx="8" ry="8" />
            <rect x="14" y="18" width="12" height="28" rx="4" ry="4" />
            <rect x="30" y="24" width="20" height="16" rx="4" ry="4" />
            <path d="M30 45h20" stroke-linecap="round" stroke-width="3" />
          </svg>
          <h3>Start planning your space</h3>
          <p>Pick a unit size from the left to drop a floor plan on the canvas, then drag in vehicles and gear to see what fits.</p>
          <button type="button" class="canvas-empty-action" data-canvas-empty-action="floorplans">
            Choose a floor plan
          </button>
          <div class="canvas-empty-tip">
            <span aria-hidden="true">✣</span>
            <span>Tip — combine up to ${Config.MAX_FLOOR_PLAN_UNITS || 10} units for multi-bay layouts</span>
          </div>
        </div>
      `;

      this.canvasWrapper.appendChild(el);
      this.emptyStateEl = el;
      el.querySelector('[data-canvas-empty-action="floorplans"]')?.addEventListener('click', () => {
        if (window.app?.toggleSidebar) {
          window.app.toggleSidebar(false);
        } else {
          document.querySelector('.app-container')?.classList.remove('sidebar-collapsed');
        }
        document.querySelector('.sidebar-tab[data-tab="floorplans"]')?.click();
      });
    } else {
      this.emptyStateEl.classList.remove('canvas-empty-state--hidden');
    }
  }

  /**
   * Hide empty state message
   */
  hideEmptyState() {
    if (this.emptyStateEl) {
      this.emptyStateEl.classList.add('canvas-empty-state--hidden');
    }
  }

  /**
   * Draw floor plan
   */
  drawFloorPlan(floorPlan, options = {}) {
    try {
      const normalizedPlan = FloorPlanComposition.normalizeFloorPlan(floorPlan);
      if (!normalizedPlan) return;

      // Hide empty state when a floor plan is drawn
      this.hideEmptyState();

      const preserveViewport = options?.preserveViewport;
      const currentViewport =
        preserveViewport && this.canvas ? [...this.canvas.viewportTransform] : null;
      const currentZoom = preserveViewport && this.canvas ? this.canvas.getZoom() : null;

      // Don't hide empty state here - keep it visible until first item is added

      // Clear existing floor plan group
      this._teardownFloorPlanGroup();
      this.floorPlanRect = null;
      this.entryZoneRect = null;
      this.entryZoneLabel = null;
      this.floorPlanUnitGroups = new Map();
      this.unitBounds = {};

      const width = Helpers.feetToPx(normalizedPlan.widthFt);
      const height = Helpers.feetToPx(normalizedPlan.heightFt);

      // Store dimensions for re-centering on resize
      this.floorPlanWidth = width;
      this.floorPlanHeight = height;

      const fallbackEntryZonePosition =
        FloorPlanComposition.normalizeEntryZonePosition(
          this.state.get('settings.entryZonePosition'),
        ) || 'bottom';
      const showEntryBorder = this.state.get('settings.showEntryZoneBorder') !== false;
      const showEntryLabel = this.state.get('settings.showEntryZoneLabel') !== false;
      const showGrid = this.state.get('settings.showGrid');
      const showRuler = this.state.get('settings.showRuler');

      this.gridLines = [];
      this.rulerMarks = [];
      normalizedPlan.units.forEach((unit, index) => {
        const entryZonePosition =
          FloorPlanComposition.normalizeEntryZonePosition(unit.entryZonePosition) ||
          fallbackEntryZonePosition;
        const unitGroup = this._createFloorPlanUnitGroup(unit, {
          entryZonePosition,
          showEntryBorder,
          showEntryLabel,
          showGrid,
          showRuler,
        });
        if (index === 0) {
          this.floorPlanRect = unitGroup.floorPlanRect;
          this.entryZoneRect = unitGroup.entryZoneRect;
          this.entryZoneLabel = unitGroup.entryZoneLabel;
        }
        this.floorPlanUnitGroups.set(unit.instanceId, unitGroup);
        unitGroup.on('moving', () => this._handleUnitMoving(unitGroup));
        unitGroup.on('modified', () => this._handleUnitModified(unitGroup));
        this.canvas.add(unitGroup);
      });

      this.floorPlanGroup = null;
      this.setFloorPlanLocked(this.floorPlanLocked, { silent: true });
      this._positionFloorPlanGroup();
      if (!options.suppressStateEvent) {
        this._emitFloorPlanStateChanged();
      } else {
        this._updateFloorPlanBounds();
        this._refreshItemFloorPlanStates();
      }

      // Ensure core layers remain in the correct order
      this.setLayerOrder();

      // Center and fit unless preserving current viewport
      if (!preserveViewport) {
        this.centerAndFit(width, height);
      } else if (currentViewport && currentZoom && this.canvas) {
        this.canvas.setViewportTransform(currentViewport);
        this.canvas.setZoom(currentZoom);
        this.canvas.requestRenderAll();
      }

      this.canvas.renderAll();
      this._syncFloorPlanUnitSelectionHighlights();
    } catch (error) {
      this._handleCanvasError('drawFloorPlan', error);
    }
  }

  _createFloorPlanUnitGroup(unit, options) {
    const width = Helpers.feetToPx(unit.widthFt);
    const height = Helpers.feetToPx(unit.heightFt);
    const floorPlanRect = new fabric.Rect({
      left: 0,
      top: 0,
      width,
      height,
      fill: Config.COLORS.floorPlan,
      stroke: Config.COLORS.floorPlanStroke,
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });

    const position = options.entryZonePosition || 'bottom';
    let entryLeft;
    let entryTop;
    let entryWidth;
    let entryHeight;
    let labelLeft;
    let labelTop;

    if (position === 'left' || position === 'right') {
      entryWidth = width * Config.ENTRY_ZONE_PERCENTAGE;
      entryHeight = height;
      entryLeft = position === 'left' ? 0 : width - entryWidth;
      entryTop = 0;
      labelLeft = entryLeft + entryWidth / 2;
      labelTop = height / 2;
    } else {
      entryWidth = width;
      entryHeight = height * Config.ENTRY_ZONE_PERCENTAGE;
      entryLeft = 0;
      entryTop = position === 'top' ? 0 : height - entryHeight;
      labelLeft = width / 2;
      labelTop = entryTop + entryHeight / 2;
    }

    const entryZoneRect = new fabric.Rect({
      left: entryLeft,
      top: entryTop,
      width: entryWidth,
      height: entryHeight,
      fill: Config.COLORS.entryZone,
      stroke: '#D32F2F',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      opacity: options.showEntryBorder ? 1 : 0,
    });

    const entryZoneLabel = new fabric.Text('ENTRY ZONE', {
      left: labelLeft,
      top: labelTop,
      fontSize: 12,
      fill: '#D32F2F',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      angle: position === 'left' || position === 'right' ? 90 : 0,
      selectable: false,
      evented: false,
      opacity: options.showEntryLabel ? 0.8 : 0,
    });

    const unitLabel = new fabric.Text(unit.shortName || unit.name, {
      left: width / 2,
      top: 15,
      fontSize: 14,
      fill: '#2c3e50',
      backgroundColor: 'rgba(255,255,255,0.88)',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    const elements = [floorPlanRect, entryZoneRect, entryZoneLabel];
    if (options.showGrid) {
      const gridLines = this._createGridLines(width, height);
      this.gridLines.push(...gridLines);
      elements.push(...gridLines);
    }
    if (options.showRuler) {
      const rulerMarks = this._createRulerMarks(width, height);
      this.rulerMarks.push(...rulerMarks);
      elements.push(...rulerMarks);
    }
    elements.push(unitLabel);

    const group = new fabric.Group(elements, {
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      selectable: !this.floorPlanLocked,
      evented: !this.floorPlanLocked,
      hasBorders: true,
      hasControls: false,
      subTargetCheck: false,
    });
    group.lockScalingX = true;
    group.lockScalingY = true;
    group.lockRotation = true;
    group.lockSkewingX = true;
    group.lockSkewingY = true;
    group.customData = {
      isFloorPlan: true,
      isFloorPlanUnit: true,
      unitInstanceId: unit.instanceId,
    };
    group.floorPlanRect = floorPlanRect;
    group.entryZoneRect = entryZoneRect;
    group.entryZoneLabel = entryZoneLabel;
    return group;
  }

  /**
   * Build grid lines for the floor plan group
   * @private
   */
  _createGridLines(width, height) {
    const lines = [];
    const gridSize = Config.GRID_SIZE;
    const majorLineEvery = gridSize * 5;

    for (let i = 0; i <= width; i += gridSize) {
      const isMajor = i % majorLineEvery === 0;
      lines.push(
        new fabric.Line([i, 0, i, height], {
          stroke: Config.COLORS.grid,
          strokeWidth: isMajor ? 1.25 : 0.5,
          opacity: isMajor ? 0.35 : 0.18,
          selectable: false,
          evented: false,
          isGridLine: true,
          excludeFromSave: true,
        }),
      );
    }

    for (let i = 0; i <= height; i += gridSize) {
      const isMajor = i % majorLineEvery === 0;
      lines.push(
        new fabric.Line([0, i, width, i], {
          stroke: Config.COLORS.grid,
          strokeWidth: isMajor ? 1.25 : 0.5,
          opacity: isMajor ? 0.35 : 0.18,
          selectable: false,
          evented: false,
          isGridLine: true,
          excludeFromSave: true,
        }),
      );
    }

    return lines;
  }

  /**
   * Create ruler ticks and labels
   * @private
   */
  _createRulerMarks(width, height) {
    const marks = [];
    const intervalFeet = 5;
    const pxPerFoot = Config.PX_PER_FOOT || Config.GRID_SIZE || 10;
    const spacing = intervalFeet * pxPerFoot;

    const createTick = (coords) =>
      new fabric.Line(coords, {
        stroke: Config.COLORS.dimension,
        strokeWidth: 1,
        opacity: 0.55,
        selectable: false,
        evented: false,
        isRulerMark: true,
        excludeFromSave: true,
      });

    const createLabel = (text, left, top, angle = 0) =>
      new fabric.Text(text, {
        left,
        top,
        fontSize: 11,
        fill: Config.COLORS.dimension,
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 3,
        originX: 'center',
        originY: 'center',
        angle,
        selectable: false,
        evented: false,
        isRulerMark: true,
        excludeFromSave: true,
      });

    for (let x = spacing; x <= width; x += spacing) {
      const ftValue = Helpers.formatNumber(x / pxPerFoot, 0);
      marks.push(createTick([x, 0, x, 10]));
      marks.push(createLabel(`${ftValue} ft`, x, 20));
    }

    for (let y = spacing; y <= height; y += spacing) {
      const ftValue = Helpers.formatNumber(y / pxPerFoot, 0);
      marks.push(createTick([0, y, 10, y]));
      marks.push(createLabel(`${ftValue} ft`, 32, y));
    }

    return marks;
  }

  /**
   * Center and fit floor plan in viewport
   * Sets auto-fit mode flag
   * If no dimensions provided, uses stored floor plan dimensions
   */
  centerAndFit(width, height) {
    const clusterBounds = this._updateFloorPlanBounds();
    if (clusterBounds) {
      width = clusterBounds.width;
      height = clusterBounds.height;
    }
    // If no dimensions provided, use stored floor plan dimensions
    if (width === undefined || height === undefined) {
      width = this.floorPlanWidth;
      height = this.floorPlanHeight;
    }

    if (!width || !height) return; // No floor plan to center

    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    const scaleX = (canvasWidth - Config.CANVAS_PADDING * 2) / width;
    const scaleY = (canvasHeight - Config.CANVAS_PADDING * 2) / height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Reset transform
    this.canvas.setZoom(scale);

    const planCenter = clusterBounds
      ? new fabric.Point(
          clusterBounds.left + clusterBounds.width / 2,
          clusterBounds.top + clusterBounds.height / 2,
        )
      : new fabric.Point(width / 2, height / 2);

    const panPoint = new fabric.Point(
      planCenter.x - canvasWidth / (2 * scale),
      planCenter.y - canvasHeight / (2 * scale),
    );

    this.canvas.absolutePan(panPoint);

    // Mark as auto-fit mode (will be preserved during window resize)
    this.isAutoFitMode = true;

    // Emit zoom event to update UI
    this.eventBus.emit('canvas:zoomed', scale);
  }

  /**
   * Add item to canvas.
   * Coordinates (x, y) represent the desired center point in canvas space.
   * Returns the group immediately and exposes a `group.imageLoadPromise`
   * that resolves once the canvas image (if any) has finished loading.
   */
  addItem(itemData, x, y) {
    try {
      // Hide empty state when first item is added
      this.hideEmptyState();

      const group = this._createBaseGroup(itemData, x, y);
      const label = this._createItemLabel(itemData);
      group.label = label;
      let resolveImageLoad;
      const imageLoadPromise = new Promise((resolve) => {
        resolveImageLoad = resolve;
      });
      group.imageLoadPromise = imageLoadPromise;

      this.canvas.add(group);
      if (label) {
        this.canvas.add(label);
        this._attachItemLabel(group, label);
        this._syncItemLabel(group);
        const showLabels = this.state?.get?.('settings.showItemLabels') !== false;
        label.set({ visible: showLabels, opacity: showLabels ? 1 : 0 });
      }

      // If snap-to-grid is enabled, snap newly added items to the grid immediately.
      try {
        if (this.state && this.state.get && this.state.get('settings.snapToGrid')) {
          Bounds.snapItemToGrid(group);
        }
      } catch (err) {
        console.warn('[CanvasManager] Snap-to-grid failed while adding item:', err);
      }

      this._syncItemLabel(group);
      this._updateItemFloorPlanState(group);
      this.canvas.renderAll();

      if (Config.USE_IMAGES && itemData.canvasImage) {
        fabric.Image.fromURL(
          Helpers.withCacheBust(itemData.canvasImage),
          (img) => {
            if (!img) {
              console.warn('[CanvasManager] Failed to load image for item:', itemData.id);
              resolveImageLoad?.({ image: null, canvasObject: group, success: false });
              this.eventBus.emit('canvas:itemImageLoaded', {
                itemId: itemData.id,
                success: false,
                canvasObject: group,
              });
              this._handleCanvasError('loadItemImage', new Error('Image failed to load'));
              return;
            }
            this._swapGroupImage(group, img, itemData);
            resolveImageLoad?.({ image: img, canvasObject: group, success: true });
            this.eventBus.emit('canvas:itemImageLoaded', {
              itemId: itemData.id,
              success: true,
              canvasObject: group,
            });
          },
          { crossOrigin: 'anonymous' },
        );
      } else {
        resolveImageLoad?.({ image: null, canvasObject: group, success: true });
        this.eventBus.emit('canvas:itemImageLoaded', {
          itemId: itemData.id,
          success: true,
          canvasObject: group,
        });
      }

      return group;
    } catch (error) {
      this._handleCanvasError('addItem', error);
      return null;
    }
  }

  /**
   * Points for a regular N-sided polygon inscribed in a width x height box,
   * in local 0..width / 0..height coordinates (so it can be dropped
   * straight into a fabric.Polygon positioned the same way the other base
   * shapes are: left=-width/2, top=-height/2).
   * @private
   */
  _regularPolygonPoints(sides, width, height, rotationDeg = -90) {
    const rx = width / 2;
    const ry = height / 2;
    const rotationRad = (rotationDeg * Math.PI) / 180;
    const points = [];
    for (let i = 0; i < sides; i += 1) {
      const angle = rotationRad + (i * 2 * Math.PI) / sides;
      points.push({ x: rx + rx * Math.cos(angle), y: ry + ry * Math.sin(angle) });
    }
    return points;
  }

  /**
   * Points for an N-pointed star inscribed in a width x height box, same
   * coordinate convention as _regularPolygonPoints.
   * @private
   */
  _starPoints(spikes, width, height, innerRatio = 0.5) {
    const rx = width / 2;
    const ry = height / 2;
    const points = [];
    const total = spikes * 2;
    for (let i = 0; i < total; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
      const r = i % 2 === 0 ? 1 : innerRatio;
      points.push({ x: rx + rx * r * Math.cos(angle), y: ry + ry * r * Math.sin(angle) });
    }
    return points;
  }

  /**
   * Create base group with rectangle/image footprint.
   * All shapes are positioned relative to the group's origin (0,0)
   * so that the group's left/top can safely be treated as center coordinates.
   * @private
   */
  _createBaseGroup(itemData, x, y) {
    const width = Helpers.feetToPx(itemData.widthFt);
    const height = Helpers.feetToPx(itemData.lengthFt);

    const isMezzanine = itemData.category === 'mezzanine';
    const isShape = itemData.category === 'shapes';
    const shapeType = itemData.shapeType || (isShape ? 'rectangle' : 'rectangle');
    const baseFillColor = itemData.color || '#2196F3';
    const mezzanineFill = new fabric.Pattern({
      source: (() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(236, 239, 244, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        ctx.lineTo(canvas.width, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, canvas.height);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        return canvas;
      })(),
      repeat: 'repeat',
    });

    const fillStyle = isMezzanine ? mezzanineFill : baseFillColor;
    const strokeColor = isMezzanine ? '#9CA3AF' : itemData.strokeColor || '#111827';
    const strokeWidth = isMezzanine ? 1.5 : 2;

    let baseShape;
    if (shapeType === 'circle') {
      const diameter = Math.min(width, height);
      baseShape = new fabric.Circle({
        left: -diameter / 2,
        top: -diameter / 2,
        radius: diameter / 2,
        fill: fillStyle,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    } else if (shapeType === 'triangle') {
      baseShape = new fabric.Triangle({
        left: -width / 2,
        top: -height / 2,
        width: width,
        height: height,
        fill: fillStyle,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    } else if (shapeType === 'oval') {
      baseShape = new fabric.Ellipse({
        left: -width / 2,
        top: -height / 2,
        rx: width / 2,
        ry: height / 2,
        fill: fillStyle,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    } else if (
      shapeType === 'diamond' ||
      shapeType === 'pentagon' ||
      shapeType === 'hexagon' ||
      shapeType === 'octagon'
    ) {
      const sidesByType = { diamond: 4, pentagon: 5, hexagon: 6, octagon: 8 };
      baseShape = new fabric.Polygon(
        this._regularPolygonPoints(sidesByType[shapeType], width, height),
        {
          left: -width / 2,
          top: -height / 2,
          fill: fillStyle,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        },
      );
    } else if (shapeType === 'star') {
      baseShape = new fabric.Polygon(this._starPoints(5, width, height), {
        left: -width / 2,
        top: -height / 2,
        fill: fillStyle,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
      });
    } else if (shapeType === 'l-shape') {
      // Notch cut from the top-right quadrant.
      baseShape = new fabric.Polygon(
        [
          { x: 0, y: 0 },
          { x: width / 2, y: 0 },
          { x: width / 2, y: height / 2 },
          { x: width, y: height / 2 },
          { x: width, y: height },
          { x: 0, y: height },
        ],
        {
          left: -width / 2,
          top: -height / 2,
          fill: fillStyle,
          stroke: strokeColor,
          strokeWidth: strokeWidth,
        },
      );
    } else {
      baseShape = new fabric.Rect({
        left: -width / 2,
        top: -height / 2,
        width: width,
        height: height,
        fill: fillStyle,
        stroke: strokeColor,
        strokeWidth: strokeWidth,
        strokeDashArray: null,
        rx: isMezzanine ? 6 : 4,
        ry: isMezzanine ? 6 : 4,
      });
    }

    const group = new fabric.Group([baseShape], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingX: false,
      lockScalingY: false,
      lockSkewingX: true,
      lockSkewingY: true,
      borderColor: '#6366F1',
      borderScaleFactor: 2,
      borderDashArray: [5, 5],
      cornerColor: '#6366F1',
      cornerStrokeColor: '#ffffff',
      cornerStyle: 'circle',
      cornerSize: 14,
      transparentCorners: false,
      rotatingPointOffset: 40,
      padding: 0,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.3)',
        blur: 10,
        offsetX: 2,
        offsetY: 2,
      }),
    });

    group.setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
      bl: true,
      br: true,
      tl: true,
      tr: true,
      mtr: true,
    });

    this._enforceFootprintSize(group, itemData);

    // Store custom data on group
    group.customData = { ...itemData };

    return group;
  }

  /**
   * Create a compact readable item label that sits above the canvas item.
   * Kept as a separate Fabric object so it does not alter the item's physical footprint.
   * @private
   */
  _createItemLabel(itemData) {
    if (!itemData?.label) return null;

    const width = Helpers.feetToPx(itemData.widthFt);
    const height = Helpers.feetToPx(itemData.lengthFt);
    const maxLabelWidth = Math.max(88, Math.min(168, Math.max(width, height) * 0.9));
    let fontSize = 11;
    const text = new fabric.Text(itemData.label, {
      fontSize,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '700',
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    while (text.width > maxLabelWidth && fontSize > 8) {
      fontSize -= 0.5;
      text.set({ fontSize });
      text.initDimensions?.();
    }

    const labelPaddingX = 18;
    const labelPaddingY = 5;
    const textWidth = Math.ceil(text.width);
    const labelWidth = textWidth + labelPaddingX * 2;
    const labelHeight = Math.ceil(text.height + labelPaddingY * 2);

    text.set({
      left: 0,
      top: 0,
      width: textWidth,
      textAlign: 'center',
    });
    text.initDimensions?.();

    const background = new fabric.Rect({
      left: 0,
      top: 0,
      width: labelWidth,
      height: labelHeight,
      rx: 5,
      ry: 5,
      fill: '#b42518',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    const label = new fabric.Group([background, text], {
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      objectCaching: false,
      excludeFromExport: false,
    });

    label.isItemLabel = true;
    label.customData = {
      isLabel: true,
      itemId: itemData.id,
      catalogItemId: itemData.itemId,
    };

    return label;
  }

  /**
   * Keep a separate label anchored above its item group.
   * @private
   */
  _syncItemLabel(group) {
    if (!group?.label) return;
    if (group.group?.type === 'activeSelection') return;

    const bounds =
      typeof group.getBoundingRect === 'function'
        ? group.getBoundingRect(true, true)
        : { left: group.left, top: group.top, width: group.width || 0, height: group.height || 0 };
    const center = group.getCenterPoint();
    const labelHeight = group.label.getScaledHeight?.() || 18;
    group.label.set({
      left: center.x,
      top: bounds.top - labelHeight / 2 - 6,
      angle: 0,
    });
    group.label.setCoords();
    group._labelFollowCenter = { x: center.x, y: center.y };
    if (typeof group.label.bringToFront === 'function') {
      group.label.bringToFront();
    }
  }

  /**
   * Keep labels visually attached while an item or ActiveSelection is being dragged.
   * Drag-time translation avoids the rubber-band effect caused by repeatedly
   * recalculating bounds while Fabric is still mutating active selection geometry.
   * @private
   */
  _moveLabelsWithTarget(target) {
    if (!target) return;

    if (target.type === 'activeSelection' && typeof target.getObjects === 'function') {
      const previous = target._labelFollowPosition || { left: target.left, top: target.top };
      const deltaX = target.left - previous.left;
      const deltaY = target.top - previous.top;
      if (deltaX || deltaY) {
        target.getObjects().forEach((obj) => this._translateItemLabel(obj, deltaX, deltaY));
      }
      target._labelFollowPosition = { left: target.left, top: target.top };
      return;
    }

    if (!target.label) return;
    const center = target.getCenterPoint?.();
    if (!center) return;

    const previous = target._labelFollowCenter;
    if (!previous) {
      this._syncItemLabel(target);
      return;
    }

    const deltaX = center.x - previous.x;
    const deltaY = center.y - previous.y;
    this._translateItemLabel(target, deltaX, deltaY);
    target._labelFollowCenter = { x: center.x, y: center.y };
  }

  /**
   * Record the current position before Fabric starts moving selected objects.
   * @private
   */
  _primeLabelTracking(target) {
    if (!target) return;
    if (target.type === 'activeSelection') {
      target._labelFollowPosition = { left: target.left, top: target.top };
      target.getObjects?.().forEach((obj) => {
        const center = obj.getCenterPoint?.();
        if (center) obj._labelFollowCenter = { x: center.x, y: center.y };
      });
      return;
    }
    const center = target.getCenterPoint?.();
    if (center) target._labelFollowCenter = { x: center.x, y: center.y };
  }

  /**
   * Move a separate label by the same delta as its item.
   * @private
   */
  _translateItemLabel(group, deltaX, deltaY) {
    if (!group?.label || (!deltaX && !deltaY)) return;
    group.label.set({
      left: group.label.left + deltaX,
      top: group.label.top + deltaY,
      angle: 0,
    });
    group.label.setCoords();
  }

  /**
   * Sync one item label or every item label in an ActiveSelection.
   * @private
   */
  _syncLabelsForTarget(target) {
    if (!target) return;
    if (target.type === 'activeSelection' && typeof target.getObjects === 'function') {
      // Items inside an ActiveSelection use temporary local coordinates while
      // the selection remains active. Labels are separate canvas objects, so
      // re-anchoring here would snap them to those local coordinates. During a
      // multi-item drag we keep labels attached by the selection delta, then
      // re-anchor once Fabric clears the selection and item coordinates settle.
      return;
    }
    this._syncItemLabel(target);
  }

  /**
   * Clear temporary drag tracking after Fabric settles object coordinates.
   * @private
   */
  _resetLabelTracking(target) {
    if (!target) return;
    if (target.type === 'activeSelection') {
      delete target._labelFollowPosition;
      target.getObjects?.().forEach((obj) => {
        delete obj._labelFollowCenter;
      });
      return;
    }
    delete target._labelFollowCenter;
  }

  /**
   * Re-anchor every item label. Used when an ActiveSelection is released.
   * @private
   */
  _syncAllItemLabels() {
    if (!this.canvas) return;
    this.canvas.getObjects().forEach((obj) => {
      if (obj?.label) this._syncItemLabel(obj);
    });
  }

  /**
   * Attach label updates to item transforms.
   * @private
   */
  _attachItemLabel(group, label) {
    if (!group || !label) return;
    const sync = () => {
      if (group.group?.type === 'activeSelection') return;
      this._syncItemLabel(group);
    };
    group.on('moving', sync);
    group.on('scaling', sync);
    group.on('rotating', sync);
    group.on('modified', sync);
  }

  /**
   * Swap rectangle in group with loaded image
   * @private
   */
  _swapGroupImage(group, img, itemData) {
    try {
      if (!group || !img) return;

      const width = Helpers.feetToPx(itemData.widthFt);
      const height = Helpers.feetToPx(itemData.lengthFt);

      // Anchor at the group's center (matches the base shape/label) so that
      // any residual size mismatch between the source image and the item's
      // real-world footprint is split evenly on all sides instead of being
      // pinned into one corner, which used to make items look off-center
      // and undersized relative to their declared dimensions.
      img.set({
        left: 0,
        top: 0,
        originX: 'center',
        originY: 'center',
      });

      // Scale to fit within the defined dimensions while maintaining aspect ratio.
      // Source PNGs are expected to be pre-trimmed/sized to their real-world
      // footprint (see tools/item-builder + docs/IMAGE-PIPELINE.md), so scaleX
      // and scaleY should normally be ~equal; "contain" (min) is kept as a
      // safety net for any image that isn't perfectly sized yet.
      const scaleX = width / img.width;
      const scaleY = height / img.height;
      const scale = Math.min(scaleX, scaleY);

      img.scale(scale);

      const shapeChild = group.item(0);
      if (shapeChild && ['rect', 'circle', 'triangle'].includes(shapeChild.type)) {
        // Keep the base shape as an invisible size anchor so text does not dictate group bounds
        shapeChild.set({
          fill: 'rgba(0,0,0,0)',
          stroke: null,
          strokeWidth: 0,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
      }

      // Insert image above the base shape but below the label
      group.insertAt(img, 1);
      group.addWithUpdate();
      this._enforceFootprintSize(group, itemData);
      this._syncItemLabel(group);
      this.canvas.renderAll();
    } catch (error) {
      this._handleCanvasError('_swapGroupImage', error);
    }
  }

  /**
   * Remove item from canvas
   */
  removeItem(item) {
    if (item?.label) {
      this.canvas.remove(item.label);
      item.label = null;
    }
    this.canvas.remove(item);
  }

  /**
   * Clear all items (keep floor plan)
   */
  clearItems() {
    const objects = this.canvas.getObjects();
    objects.forEach((obj) => {
      const isItemObject =
        obj.customData && !obj.customData.isLabel && !SelectionFilters.isFloorPlanObject(obj);
      const isItemLabel = obj.isItemLabel || obj.customData?.isLabel;
      const isHelperObject =
        obj.measurement ||
        obj.isMeasurementLabel ||
        obj.isDimensionOverlay ||
        obj.isGridLine ||
        obj.isRulerMark ||
        obj.isMeasurementHelper;
      if (isItemObject || isItemLabel || isHelperObject) {
        this.canvas.remove(obj);
      }
    });
  }

  /**
   * Get canvas as data URL
   */
  toDataURL(options = {}) {
    return this.canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: options.multiplier || 1,
      ...options,
    });
  }

  /**
   * Clear canvas
   */
  clear() {
    this.canvas.clear();

    // RESET VIEWPORT TRANSFORM (zoom and pan)
    this.resetViewport();

    this._teardownFloorPlanGroup();
    this.floorPlanRect = null;
    this.entryZoneRect = null;
    this.entryZoneLabel = null;
    this.floorPlanPosition = null;
    this.floorPlanBounds = null;
    this.floorPlanUnitGroups = new Map();
    this.unitBounds = {};
    this.gridLines = [];
    this.rulerMarks = [];
    // canvas.clear() above already destroyed these fabric objects; drop our
    // references too so _ensureSmartGuides() recreates fresh ones instead
    // of touching dead objects.
    this._guideLineV = null;
    this._guideLineH = null;
    this.alignmentGuides = [];
    if (this.emptyStateEl) {
      this.emptyStateEl.remove();
      this.emptyStateEl = null;
    }
    this.floorPlanWidth = null;
    this.floorPlanHeight = null;
  }

  /**
   * Reset viewport to default (1:1 zoom, no pan)
   * Ensures canvas is at 100% zoom and centered
   */
  resetViewport() {
    // [CanvasManager] Resetting viewport to default state

    // Reset viewport transform to identity matrix
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.canvas.setZoom(1);
    this.canvas.requestRenderAll();

    // Update zoom UI elements
    this.eventBus.emit('canvas:zoomed', 1);

    const zoomPercentage = document.getElementById('zoom-percentage');
    if (zoomPercentage) {
      zoomPercentage.textContent = '100%';
    }

    const zoomSlider = document.getElementById('zoom-slider');
    const zoomSliderValue = document.getElementById('zoom-slider-value');
    if (zoomSlider) {
      zoomSlider.value = 100;
    }
    if (zoomSliderValue) {
      zoomSliderValue.textContent = '100%';
    }
  }

  /**
   * Get canvas instance
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Get viewport center in canvas coordinates
   * Accounts for zoom and pan transformations
   */
  getViewportCenter() {
    const canvas = this.canvas;
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();

    // Convert viewport center to canvas coordinates
    const centerX = (canvas.width / 2 - vpt[4]) / zoom;
    const centerY = (canvas.height / 2 - vpt[5]) / zoom;

    return { x: centerX, y: centerY };
  }

  /**
   * Logical (canvas-space) bounds of whatever's currently visible in the
   * viewport, accounting for pan/zoom. Used to size smart-guide lines so
   * they span the visible area rather than an arbitrary fixed length.
   */
  _getViewportLogicalBounds() {
    const canvas = this.canvas;
    const vpt = canvas.viewportTransform;
    const zoom = canvas.getZoom();
    const left = -vpt[4] / zoom;
    const top = -vpt[5] / zoom;
    return {
      left,
      top,
      right: left + canvas.width / zoom,
      bottom: top + canvas.height / zoom,
    };
  }

  /**
   * Lazily create the two reusable smart-guide lines (one vertical, one
   * horizontal). Reused across drags rather than created/destroyed on every
   * mousemove -- they just toggle visible and reposition.
   */
  _ensureSmartGuides() {
    if (this._guideLineV && this._guideLineH) return;
    const lineDefaults = {
      stroke: '#EC4899',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      excludeFromExport: true,
      visible: false,
      isSmartGuide: true,
    };
    this._guideLineV = new fabric.Line([0, 0, 0, 0], { ...lineDefaults });
    this._guideLineH = new fabric.Line([0, 0, 0, 0], { ...lineDefaults });
    this.canvas.add(this._guideLineV, this._guideLineH);
    this.alignmentGuides = [this._guideLineV, this._guideLineH];
  }

  /**
   * Show/move/hide the vertical and horizontal smart-center guides for the
   * object currently being dragged, snapping it to dead-center when within
   * threshold on either axis (Illustrator/Photoshop "smart guide" pattern).
   *
   * @param {fabric.Object} target - the object being dragged
   * @param {{x: number, y: number}} anchor - the center point to compare
   *   against (containing unit's center for items, viewport center for units)
   * @param {{left:number, top:number, right:number, bottom:number}} span -
   *   logical bounds the guide lines should stretch across
   * @param {number} threshold - logical px distance considered "centered"
   */
  _updateSmartGuides(target, anchor, span, threshold = 4) {
    if (!target || !anchor || !span) {
      this._hideSmartGuides();
      return;
    }
    this._ensureSmartGuides();

    const dx = target.left - anchor.x;
    const dy = target.top - anchor.y;
    const centeredX = Math.abs(dx) <= threshold;
    const centeredY = Math.abs(dy) <= threshold;

    if (centeredX) {
      target.set({ left: anchor.x });
      this._guideLineV.set({
        x1: anchor.x,
        y1: span.top,
        x2: anchor.x,
        y2: span.bottom,
        visible: true,
      });
    } else {
      this._guideLineV.set({ visible: false });
    }

    if (centeredY) {
      target.set({ top: anchor.y });
      this._guideLineH.set({
        x1: span.left,
        y1: anchor.y,
        x2: span.right,
        y2: anchor.y,
        visible: true,
      });
    } else {
      this._guideLineH.set({ visible: false });
    }

    if (centeredX || centeredY) {
      target.setCoords();
      this.canvas.bringToFront(this._guideLineV);
      this.canvas.bringToFront(this._guideLineH);
    }
  }

  /**
   * Hide both smart-guide lines (drag ended, or nothing to align to).
   */
  _hideSmartGuides() {
    this._guideLineV?.set({ visible: false });
    this._guideLineH?.set({ visible: false });
  }

  /**
   * Smart guides for a dragged item: show/snap when centered within
   * whichever unit it's currently over (its "garage"), not the whole
   * canvas -- an item's natural reference frame is the unit it lives in.
   * @private
   */
  _updateItemSmartGuides(target) {
    if (!target || !target.customData?.id || target.type === 'activeSelection') {
      this._hideSmartGuides();
      return;
    }

    const instanceId = this.getContainingUnitId(target);
    const bounds = instanceId ? this.unitBounds?.[instanceId] : null;
    if (!bounds) {
      this._hideSmartGuides();
      return;
    }

    const anchor = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
    const span = {
      left: bounds.left,
      top: bounds.top,
      right: bounds.left + bounds.width,
      bottom: bounds.top + bounds.height,
    };
    const zoom = this.canvas?.getZoom?.() || 1;
    this._updateSmartGuides(target, anchor, span, 4 / zoom);
  }

  /**
   * Zoom in
   */
  zoomIn() {
    const canvas = this.canvas;
    let zoom = canvas.getZoom();
    zoom = Math.min(zoom * 1.1, 2); // Max 200%

    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), zoom);
    canvas.requestRenderAll();

    // User manually zoomed - exit auto-fit mode
    this.isAutoFitMode = false;

    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    const canvas = this.canvas;
    let zoom = canvas.getZoom();
    zoom = Math.max(zoom / 1.1, 0.1); // Min 10%

    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), zoom);
    canvas.requestRenderAll();

    // User manually zoomed - exit auto-fit mode
    this.isAutoFitMode = false;

    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Set zoom to specific percentage (10-200%)
   */
  setZoomPercent(percent) {
    const canvas = this.canvas;
    // Clamp to slider range
    const clampedPercent = Math.max(10, Math.min(200, percent));
    const zoom = clampedPercent / 100;

    // Get current viewport center
    const vpt = canvas.viewportTransform;
    const centerX = (canvas.width / 2 - vpt[4]) / vpt[0];
    const centerY = (canvas.height / 2 - vpt[5]) / vpt[3];

    // Calculate new viewport transform to keep the same center point
    const newVpt = [zoom, 0, 0, zoom, 0, 0];
    newVpt[4] = canvas.width / 2 - centerX * zoom;
    newVpt[5] = canvas.height / 2 - centerY * zoom;

    canvas.setViewportTransform(newVpt);
    canvas.requestRenderAll();

    // User manually zoomed - exit auto-fit mode
    this.isAutoFitMode = false;

    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Reset zoom to auto-fit
   */
  resetZoom() {
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      const width = Helpers.feetToPx(floorPlan.widthFt);
      const height = Helpers.feetToPx(floorPlan.heightFt);
      // centerAndFit() will set isAutoFitMode = true
      this.centerAndFit(width, height);
    }
  }

  /**
   * Force the group's scaled size to match the declared footprint.
   * Prevents images or labels from altering the physical dimensions on canvas.
   * @private
   */
  _enforceFootprintSize(group, itemData) {
    if (!group || !itemData) return;

    const targetWidth = Helpers.feetToPx(itemData.widthFt);
    const targetHeight = Helpers.feetToPx(itemData.lengthFt);
    const currentScaledWidth = group.getScaledWidth();
    const currentScaledHeight = group.getScaledHeight();

    if (!currentScaledWidth || !currentScaledHeight) return;

    const scaleX = group.scaleX || 1;
    const scaleY = group.scaleY || 1;

    const desiredScaleX = scaleX * (targetWidth / currentScaledWidth);
    const desiredScaleY = scaleY * (targetHeight / currentScaledHeight);

    group.scaleX = desiredScaleX;
    group.scaleY = desiredScaleY;
    group.setCoords();
  }

  /**
   * Toggle grid visibility
   */
  toggleGrid() {
    const currentState = this.state.get('settings.showGrid');
    const nextState = !currentState;
    this.state.set('settings.showGrid', nextState);
    this.state.set('settings.showRuler', nextState);
    this.redrawFloorPlan({ preserveViewport: true });
  }

  /**
   * Toggle item labels visibility
   */
  toggleItemLabels(show) {
    const objects = this.canvas.getObjects();
    objects.forEach((obj) => {
      // Hide/show item labels (for storage items)
      if (obj.type === 'group' && obj.label) {
        obj.label.set({ visible: show, opacity: show ? 1 : 0 });
        obj.label.setCoords();
      }
      // Hide/show measurement labels (distance text)
      if (obj.measurementPart === 'text') {
        obj.set({ visible: show, opacity: show ? 1 : 0 });
        obj.setCoords();
      }
    });
    this.canvas.requestRenderAll();
  }

  /**
   * Redraw floor plan with current settings
   */
  redrawFloorPlan(options = {}) {
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      this.drawFloorPlan(floorPlan, options);
    }
  }

  /**
   * Keep core canvas layers (floor plan, grid, entry zone) in correct order
   * Floor plan base (0) -> grid (1) -> entry zone fill (2) -> label (3)
   */
  setLayerOrder() {
    if (!this.canvas) return;
    [...this.floorPlanUnitGroups.values()].forEach((group, index) => group.moveTo(index));
  }

  /**
   * Ensure static layers (floor plan, grid, entry zone) stay behind items
   * Called after bring-front/send-back operations to prevent items from going behind floor plan
   */
  ensureStaticLayersBehind() {
    if (!this.canvas) return;

    [...this.floorPlanUnitGroups.values()].forEach((group, index) => group.moveTo(index));

    this.canvas.renderAll();
  }

  /**
   * Keep items inside the current floor plan bounds
   * @private
   */
  _enforceItemBounds(target) {
    if (!this.enforceFloorBounds || !target || target === this.floorPlanGroup) return;
    if (target.customData && target.customData.isFloorPlan) return;
    if (target.type === 'activeSelection') return;

    const floorPlan = FloorPlanComposition.normalizeFloorPlan(this.state.get('floorPlan'));
    if (!floorPlan) return;
    const instanceId = target.customData?.unitInstanceId || this.getContainingUnitId(target);
    const unit =
      floorPlan.units.find((candidate) => candidate.instanceId === instanceId) ||
      floorPlan.units[0];
    const bounds = unit ? this.getUnitBounds(unit.instanceId) : null;
    if (unit && bounds) Bounds.constrainToBounds(target, unit, bounds);
  }

  /**
   * Handle canvas-related errors gracefully
   * @private
   */
  _handleCanvasError(context, error) {
    console.error(`[CanvasManager] ${context} failed:`, error);
    if (typeof Modal !== 'undefined' && typeof Modal.showError === 'function') {
      Modal.showError('Something went wrong on the canvas. Please try again.');
    }
  }

  /**
   * Remove floor plan group and detach listeners safely
   * @private
   */
  _teardownFloorPlanGroup() {
    this.floorPlanUnitGroups.forEach((group) => {
      group.off('moving');
      group.off('modified');
      if (this.canvas && typeof this.canvas.remove === 'function') {
        this.canvas.remove(group);
      }
    });
    if (this.floorPlanGroup && this.canvas && typeof this.canvas.remove === 'function') {
      this.canvas.remove(this.floorPlanGroup);
    }
    this.floorPlanGroup = null;
    this.floorPlanUnitGroups = new Map();
    this.unitBounds = {};
    this.gridLines = [];
    this.rulerMarks = [];
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.CanvasManager = CanvasManager;
}
