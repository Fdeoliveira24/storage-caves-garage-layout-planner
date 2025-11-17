/* global Helpers, Config, fabric, Items */

/**
 * Measurement Tool
 * ---------------------------------------------
 * Modes:
 *  - Normal: measurement mode disabled, tool is idle.
 *  - Measuring: two consecutive clicks create a measurement line + label.
 *
 * Public API:
 *  - init(canvas)
 *  - enableMeasurementMode()
 *  - disableMeasurementMode()
 *  - toggleMeasurementMode()
 *  - cancelActiveMeasurement()
 *  - onItemSelected(object)
 *  - onSelectionCleared()
 */
class MeasurementTool {
  constructor(canvas, state, eventBus) {
    this.canvas = null;
    this.state = state;
    this.eventBus = eventBus;

    this.isMeasuring = false;
    this.startPoint = null;
    this.dimensionOverlays = [];
    this.dimensionTarget = null;
    this.dimensionTargetId = null;
    this.startPointIndicator = null;
    this._cursorApplied = false;
    this._prevDefaultCursor = null;
    this._prevHoverCursor = null;
    this._draggingHandle = null;
    this._boundHandleMove = this._handleHandleMove.bind(this);
    this._boundHandleUp = this._handleHandleUp.bind(this);
    this._dimensionEvents = ['moving', 'rotating', 'scaling', 'skewing', 'modified'];
    this._boundDimensionUpdate = this._updateDimensionOverlayPositions.bind(this);
    this._tickLength = 12;

    this._handleCanvasMouseDown = this._handleCanvasMouseDown.bind(this);

    if (canvas) {
      this.init(canvas);
    }
  }

  /**
   * Attach Fabric canvas reference
   */
  init(canvas) {
    if (this.canvas) {
      this.canvas.off('mouse:down', this._handleCanvasMouseDown);
      this.canvas.off('mouse:move', this._boundHandleMove);
      this.canvas.off('mouse:up', this._boundHandleUp);
    }
    this.canvas = canvas;
    if (this.isMeasuring) {
      this.canvas.on('mouse:down', this._handleCanvasMouseDown);
      this._cursorApplied = false;
      this._prevDefaultCursor = null;
      this._prevHoverCursor = null;
      this._applyMeasurementCursor();
    }
    if (this.canvas) {
      this.canvas.on('mouse:move', this._boundHandleMove);
      this.canvas.on('mouse:up', this._boundHandleUp);
    }
  }

  enableMeasurementMode() {
    if (!this.canvas || this.isMeasuring) return;
    this.isMeasuring = true;
    this.startPoint = null;
    this.canvas.on('mouse:down', this._handleCanvasMouseDown);
    this._applyMeasurementCursor();
    this.eventBus?.emit('tool:measure:activated');
  }

  disableMeasurementMode() {
    if (!this.isMeasuring) return;
    this.isMeasuring = false;
    this.startPoint = null;
    if (this.canvas) {
      this.canvas.off('mouse:down', this._handleCanvasMouseDown);
    }
    this._removeStartIndicator();
    this._restoreMeasurementCursor();
    this.eventBus?.emit('tool:measure:deactivated');
  }

  toggleMeasurementMode() {
    if (this.isMeasuring) {
      this.disableMeasurementMode();
    } else {
      this.enableMeasurementMode();
    }
    return this.isMeasuring;
  }

  cancelActiveMeasurement() {
    this.startPoint = null;
    this._removeStartIndicator();
  }

  /**
   * Remove measurement objects related to given Fabric object or ID
   * @param {fabric.Object|string} target
   */
  removeMeasurement(target) {
    if (!this.canvas || !target) return;

    const measurementId = typeof target === 'string' ? target : target.measurementId;
    if (!measurementId) {
      if (target && typeof target === 'object' && target.measurement) {
        this.canvas.remove(target);
        this.canvas.requestRenderAll();
      }
      return;
    }

    const relatedObjects = this.canvas
      .getObjects()
      .filter((obj) => obj.measurementId === measurementId);

    relatedObjects.forEach((obj) => this.canvas.remove(obj));
    this.canvas.requestRenderAll();
  }

  onItemSelected(object) {
    if (!this.canvas || !object) {
      this.onSelectionCleared();
      return;
    }

    if (
      object.type === 'activeSelection' ||
      !object.customData ||
      !object.customData.id ||
      object.customData.isFloorPlan ||
      object.measurement ||
      object.isMeasurementLabel ||
      object.isDimensionOverlay
    ) {
      this.onSelectionCleared();
      return;
    }

    const template =
      typeof Items !== 'undefined' && object.customData.itemId
        ? Items.getById(object.customData.itemId)
        : null;

    const lengthFt = template?.lengthFt ?? object.customData.lengthFt;
    const widthFt = template?.widthFt ?? object.customData.widthFt;

    if (typeof lengthFt !== 'number' || typeof widthFt !== 'number') {
      this.onSelectionCleared();
      return;
    }

    // Clean up previous overlays before drawing new ones
    this.onSelectionCleared();

    this.dimensionTarget = object;
    this.dimensionTargetId = object.customData.id;

    const lengthLabel = this._createDimensionLabel(
      `Length: ${Helpers.formatNumber(lengthFt, 1)} ft`,
      'length',
    );
    const widthLabel = this._createDimensionLabel(
      `Width: ${Helpers.formatNumber(widthFt, 1)} ft`,
      'width',
    );

    this.dimensionOverlays = [lengthLabel, widthLabel];

    this.canvas.add(lengthLabel);
    this.canvas.add(widthLabel);
    this._attachDimensionListeners();
    this._updateDimensionOverlayPositions();
  }

  onSelectionCleared() {
    this._detachDimensionListeners();
    this._removeStartIndicator();

    if (this.canvas && this.dimensionOverlays.length) {
      this.dimensionOverlays.forEach((overlay) => this.canvas.remove(overlay));
      this.canvas.requestRenderAll();
    }

    this.dimensionOverlays = [];
    this.dimensionTarget = null;
    this.dimensionTargetId = null;
  }

  _handleCanvasMouseDown(options) {
    if (!this.isMeasuring || !this.canvas) return;

    if (options.target && options.target.measurement) {
      this.canvas.setActiveObject(options.target);
      this.canvas.requestRenderAll();
      return;
    }

    if (this.canvas.calcOffset) {
      this.canvas.calcOffset();
    }
    const pointer = this.canvas.getPointer(options.e);
    if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) {
      return;
    }
    const snappedPoint = this._getSnappedPoint(pointer.x, pointer.y);
    if (!snappedPoint) return;

    if (!this.startPoint) {
      this.startPoint = snappedPoint;
      this._showStartIndicator(snappedPoint);
      this.eventBus?.emit('tool:measure:start', { point: snappedPoint });
      return;
    }

    this._createMeasurement(this.startPoint, snappedPoint);
    this.startPoint = null;
  }

  _getSnappedPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    const snapEnabled = this.state?.get('settings.snapToGrid');
    if (!snapEnabled) {
      return { x, y };
    }

    const gridSize = Number(Config.GRID_SIZE) || Number(Config.PX_PER_FOOT) || 10;
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;
    return { x: snappedX, y: snappedY };
  }

  _createMeasurement(startPoint, endPoint) {
    const lineId = Helpers.generateId('measurement');
    const distancePx = Helpers.distance(startPoint.x, startPoint.y, endPoint.x, endPoint.y);
    const distanceFeet = distancePx / Config.PX_PER_FOOT;
    const distanceLabel = `${Helpers.formatNumber(distanceFeet, 1)} ft`;

    const measurementLine = new fabric.Line(
      [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
      {
        stroke: Config.COLORS.dimension,
        strokeWidth: 2,
        strokeDashArray: [6, 4],
        strokeLineCap: 'round',
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
      },
    );

    const hitLine = new fabric.Line(
      [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
      {
        stroke: 'rgba(0,0,0,0.001)',
        strokeWidth: 22,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center',
        excludeFromSave: true,
        isMeasurementHelper: true,
      },
    );

    const tickLength = this._tickLength;
    const createTick = (point) =>
      new fabric.Line([point.x, point.y - tickLength, point.x, point.y + tickLength], {
        stroke: Config.COLORS.dimension,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromSave: true,
        isMeasurementHelper: true,
      });
    const startTick = createTick(startPoint);
    const endTick = createTick(endPoint);

    const createPin = (point) =>
      new fabric.Circle({
        left: point.x,
        top: point.y,
        radius: 6,
        fill: 'rgba(0,0,0,0.001)',
        stroke: 'rgba(0,0,0,0.001)',
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: true,
        hoverCursor: 'pointer',
        excludeFromSave: true,
        isMeasurementHelper: true,
        opacity: 1,
      });
    const startCap = createPin(startPoint);
    const endCap = createPin(endPoint);

    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = (startPoint.y + endPoint.y) / 2;

    const measurementText = new fabric.Text(distanceLabel, {
      left: midX,
      top: midY - 14,
      fontSize: 14,
      fill: Config.COLORS.dimension,
      backgroundColor: 'rgba(255,255,255,0.95)',
      padding: 4,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    measurementText.measurementLabel = true;
    measurementText.isMeasurementLabel = true;
    measurementText.excludeFromSave = true;

    const measurementGroup = new fabric.Group(
      [hitLine, measurementLine, startTick, endTick, startCap, endCap, measurementText],
      {
        measurement: true,
        measurementId: lineId,
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        hoverCursor: 'move',
        excludeFromSave: true,
        perPixelTargetFind: false,
        subTargetCheck: true,
        padding: 10,
        targetFindTolerance: 10,
      },
    );
    measurementGroup.measurementParts = {
      hitLine,
      line: measurementLine,
      startTick,
      endTick,
      startCap,
      endCap,
      label: measurementText,
    };
    measurementGroup.isMeasurementSelected = false;
    this._decorateMeasurementGroup(measurementGroup);

    measurementGroup.measurementData = {
      start: { x: startPoint.x, y: startPoint.y },
      end: { x: endPoint.x, y: endPoint.y },
    };
    this._refreshMeasurementGraphics(measurementGroup);

    this.canvas.add(measurementGroup);
    this.canvas.bringToFront(measurementGroup);
    this.canvas.renderAll();

    this._removeStartIndicator();

    this.eventBus?.emit('tool:measure:complete', {
      distanceFeet,
      lineId,
    });
  }

  _applyMeasurementCursor() {
    if (!this.canvas || this._cursorApplied) return;
    this._prevDefaultCursor = this.canvas.defaultCursor || 'default';
    this._prevHoverCursor = this.canvas.hoverCursor || 'move';
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.hoverCursor = 'crosshair';
    this._cursorApplied = true;
  }

  _restoreMeasurementCursor() {
    if (!this.canvas || !this._cursorApplied) return;
    this.canvas.defaultCursor = this._prevDefaultCursor || 'default';
    this.canvas.hoverCursor = this._prevHoverCursor || 'move';
    this._cursorApplied = false;
  }

  _showStartIndicator(point) {
    if (!this.canvas) return;
    this._removeStartIndicator();
    this.startPointIndicator = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: 6,
      fill: 'rgba(99,102,241,0.08)',
      stroke: Config.COLORS.dimension,
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      excludeFromSave: true,
      isMeasurementHelper: true,
    });
    this.canvas.add(this.startPointIndicator);
    this.canvas.bringToFront(this.startPointIndicator);
    this.canvas.requestRenderAll();
  }

  _removeStartIndicator() {
    if (this.canvas && this.startPointIndicator) {
      this.canvas.remove(this.startPointIndicator);
      this.startPointIndicator = null;
      this.canvas.requestRenderAll();
    }
  }

  _decorateMeasurementGroup(group) {
    if (!group) return;
    const highlight = (state) => {
      this._setMeasurementHighlight(group, state);
    };
    group.on('mousedown', (opt) => {
      const subTarget = opt?.subTargets?.[0];
      if (!subTarget || !group.measurementParts) return;
      const parts = group.measurementParts;
      if (subTarget === parts.startCap || subTarget === parts.endCap) {
        const handleKey = subTarget === parts.startCap ? 'start' : 'end';
        this._beginHandleDrag(group, handleKey);
        opt.e?.preventDefault();
        opt.e?.stopPropagation();
      }
    });
    group.on('mouseover', () => {
      highlight(true);
    });
    group.on('mouseout', () => {
      if (!group.isMeasurementSelected) {
        highlight(false);
      }
    });
    group.on('selected', () => {
      group.isMeasurementSelected = true;
      highlight(true);
    });
    group.on('deselected', () => {
      group.isMeasurementSelected = false;
      highlight(false);
    });
    group.on('moving', () => {
      this._syncMeasurementDataFromLocal(group);
    });
    highlight(false);
  }

  _setMeasurementHighlight(group, isActive) {
    if (!group?.measurementParts) return;
    const parts = group.measurementParts;
    const activeColor = '#16a34a';
    const normalColor = Config.COLORS.dimension;
    const strokeColor = isActive ? activeColor : normalColor;
    [parts.line, parts.startTick, parts.endTick].forEach((shape) => {
      shape?.set('stroke', strokeColor);
    });
    [parts.startCap, parts.endCap].forEach((cap) => {
      if (cap) {
        cap.set({
          stroke: isActive ? strokeColor : 'rgba(0,0,0,0.001)',
          fill: isActive ? 'rgba(22,163,74,0.2)' : 'rgba(0,0,0,0.001)',
          opacity: 1,
        });
      }
    });
    if (parts.label) {
      parts.label.set({
        fill: isActive ? '#065f46' : normalColor,
        backgroundColor: isActive ? 'rgba(22,163,74,0.12)' : 'rgba(255,255,255,0.95)',
      });
    }
    this.canvas?.requestRenderAll();
  }

  _beginHandleDrag(group, handleKey) {
    if (!group) return;
    this._draggingHandle = { group, handle: handleKey };
    group.lockMovementX = true;
    group.lockMovementY = true;
    this.canvas?.setActiveObject(group);
    group.isMeasurementSelected = true;
    this._setMeasurementHighlight(group, true);
  }

  _handleHandleMove(opt) {
    if (!this._draggingHandle || !this.canvas) return;
    if (this.canvas.calcOffset) {
      this.canvas.calcOffset();
    }
    const pointer = this.canvas.getPointer(opt.e);
    if (!pointer) return;
    const snapped = this._getSnappedPoint(pointer.x, pointer.y);
    if (!snapped) return;
    const data = this._draggingHandle.group.measurementData;
    if (!data) return;
    data[this._draggingHandle.handle] = { x: snapped.x, y: snapped.y };
    this._refreshMeasurementGraphics(this._draggingHandle.group);
    opt?.e?.preventDefault();
    opt?.e?.stopPropagation();
  }

  _handleHandleUp() {
    if (!this._draggingHandle) return;
    const { group } = this._draggingHandle;
    if (group) {
      group.lockMovementX = false;
      group.lockMovementY = false;
    }
    this._draggingHandle = null;
  }

  _refreshMeasurementGraphics(group) {
    if (!group?.measurementParts || !group.measurementData) return;
    const parts = group.measurementParts;
    const { start, end } = group.measurementData;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const localStart = { x: start.x - centerX, y: start.y - centerY };
    const localEnd = { x: end.x - centerX, y: end.y - centerY };
    group.set({ left: centerX, top: centerY });
    group.measurementLocal = { start: localStart, end: localEnd };
    parts.line.set({ x1: localStart.x, y1: localStart.y, x2: localEnd.x, y2: localEnd.y });
    if (parts.hitLine) {
      parts.hitLine.set({ x1: localStart.x, y1: localStart.y, x2: localEnd.x, y2: localEnd.y });
    }
    const dx = localEnd.x - localStart.x;
    const dy = localEnd.y - localStart.y;
    const hyp = Math.sqrt(dx * dx + dy * dy) || 1;
    const halfTick = this._tickLength / 2;
    const offsetX = (-dy / hyp) * halfTick;
    const offsetY = (dx / hyp) * halfTick;
    this._positionTick(parts.startTick, localStart, offsetX, offsetY);
    this._positionTick(parts.endTick, localEnd, offsetX, offsetY);
    parts.startCap.set({ left: localStart.x, top: localStart.y });
    parts.startCap.setCoords();
    parts.endCap.set({ left: localEnd.x, top: localEnd.y });
    parts.endCap.setCoords();
    const labelX = (localStart.x + localEnd.x) / 2;
    const labelY = (localStart.y + localEnd.y) / 2 - 14;
    const distanceFeet =
      Helpers.distance(start.x, start.y, end.x, end.y) / Config.PX_PER_FOOT;
    parts.label.set({
      left: labelX,
      top: labelY,
      text: `${Helpers.formatNumber(distanceFeet, 1)} ft`,
    });
    parts.label.setCoords();
    parts.line.setCoords();
    parts.hitLine?.setCoords();
    group.setCoords();
    this.canvas?.requestRenderAll();
  }

  _positionTick(tick, point, offsetX, offsetY) {
    if (!tick || point === undefined) return;
    tick.set({
      x1: point.x - offsetX,
      y1: point.y - offsetY,
      x2: point.x + offsetX,
      y2: point.y + offsetY,
    });
    tick.setCoords();
  }

  _syncMeasurementDataFromLocal(group) {
    if (!group?.measurementLocal || !group.measurementData) return;
    const center = group.getCenterPoint();
    if (!center) return;
    const { start, end } = group.measurementLocal;
    group.measurementData.start = {
      x: center.x + start.x,
      y: center.y + start.y,
    };
    group.measurementData.end = {
      x: center.x + end.x,
      y: center.y + end.y,
    };
  }

  _createDimensionLabel(text, dimensionType) {
    return new fabric.Text(text, {
      fontSize: 13,
      fill: Config.COLORS.dimension,
      backgroundColor: 'rgba(255,255,255,0.95)',
      padding: 4,
      originX: 'center',
      originY: 'center',
      hasControls: false,
      hasBorders: false,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      isDimensionOverlay: true,
      excludeFromSave: true,
      dimensionType,
    });
  }

  _attachDimensionListeners() {
    if (!this.dimensionTarget) return;
    this._dimensionEvents.forEach((eventName) => {
      this.dimensionTarget.on(eventName, this._boundDimensionUpdate);
    });
  }

  _detachDimensionListeners() {
    if (!this.dimensionTarget) return;
    this._dimensionEvents.forEach((eventName) => {
      this.dimensionTarget.off(eventName, this._boundDimensionUpdate);
    });
  }

  _updateDimensionOverlayPositions() {
    if (!this.canvas || !this.dimensionTarget || this.dimensionOverlays.length === 0) return;

    const target = this.dimensionTarget;
    if (!target.canvas) {
      this.onSelectionCleared();
      return;
    }

    const center = target.getCenterPoint();
    if (!center) return;

    const width = target.getScaledWidth ? target.getScaledWidth() : target.width || 0;
    const height = target.getScaledHeight ? target.getScaledHeight() : target.height || 0;
    const margin = 18;
    const angleRad = fabric.util.degreesToRadians(target.angle || 0);
    const sin = Math.sin(angleRad);
    const cos = Math.cos(angleRad);

    this.dimensionOverlays.forEach((label) => {
      let offsetX = 0;
      let offsetY = 0;

      if (label.dimensionType === 'length') {
        offsetY = -(height / 2 + margin);
      } else {
        offsetX = width / 2 + margin;
      }

      const rotatedX = offsetX * cos - offsetY * sin;
      const rotatedY = offsetX * sin + offsetY * cos;

      label.set({
        left: center.x + rotatedX,
        top: center.y + rotatedY,
      });
      label.setCoords();
    });

    this.canvas.requestRenderAll();
  }

  handleItemRemoved(itemId) {
    if (!itemId) return;
    if (this.dimensionTargetId && this.dimensionTargetId === itemId) {
      this.onSelectionCleared();
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.MeasurementTool = MeasurementTool;
}
