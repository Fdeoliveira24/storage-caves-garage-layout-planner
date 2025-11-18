/* global Helpers, Config */

class MeasurementTool {
  constructor(canvas, state, eventBus) {
    this.canvas = canvas;
    this.state = state;
    this.eventBus = eventBus;
    this.isMeasuring = false;
    this.startPoint = null;
    this.startPointIndicator = null;
    this._cursorApplied = false;
    this._prevDefaultCursor = null;
    this._prevHoverCursor = null;
    
    this._handleCanvasMouseDown = this._handleCanvasMouseDown.bind(this);
    this._handleObjectMoving = this._handleObjectMoving.bind(this);
    this._handleMouseOver = this._handleMouseOver.bind(this);
    this._handleMouseOut = this._handleMouseOut.bind(this);
    this._handleSelectionEvent = this._handleSelectionEvent.bind(this);
    
    this._setupInteractionHandlers();
  }

  _setupInteractionHandlers() {
    if (!this.canvas) return;
    this.canvas.on('object:moving', this._handleObjectMoving);
    this.canvas.on('mouse:over', this._handleMouseOver);
    this.canvas.on('mouse:out', this._handleMouseOut);
    this.canvas.on('selection:created', this._handleSelectionEvent);
    this.canvas.on('selection:updated', this._handleSelectionEvent);
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

  _handleCanvasMouseDown(options) {
    if (!this.isMeasuring || !this.canvas) return;

    // Don't interfere with existing measurements
    if (options.target && options.target.measurementId) {
      return;
    }

    const pointer = this.canvas.getPointer(options.e);
    if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return;

    if (!this.startPoint) {
      this.startPoint = { x: pointer.x, y: pointer.y };
      this._showStartIndicator(this.startPoint);
      return;
    }

    const endPoint = { x: pointer.x, y: pointer.y };
    this._createMeasurement(this.startPoint, endPoint);
    this.startPoint = null;
    this._removeStartIndicator();
  }

  _createMeasurement(start, end) {
    const measurementId = Helpers.generateId('measurement');
    const distancePx = Helpers.distance(start.x, start.y, end.x, end.y);
    const distanceFeet = distancePx / Config.PX_PER_FOOT;

    const tickLen = 12;
    const startTick = new fabric.Line([start.x, start.y - tickLen, start.x, start.y + tickLen], {
      stroke: Config.COLORS.dimension,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      measurementId: measurementId,
      measurementPart: 'tick',
      excludeFromSave: true,
    });

    const endTick = new fabric.Line([end.x, end.y - tickLen, end.x, end.y + tickLen], {
      stroke: Config.COLORS.dimension,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      measurementId: measurementId,
      measurementPart: 'tick',
      excludeFromSave: true,
    });

    // Main line - this is the movable object
    const line = new fabric.Line([start.x, start.y, end.x, end.y], {
      stroke: Config.COLORS.dimension,
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      strokeLineCap: 'round',
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
      measurementId: measurementId,
      measurement: true,
      excludeFromSave: true,
    });

    // Handles for adjusting endpoints
    const startHandle = new fabric.Circle({
      left: start.x,
      top: start.y,
      radius: 8,
      fill: '#6366F1',
      stroke: '#ffffff',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'pointer',
      measurementId: measurementId,
      measurementHandle: 'start',
      excludeFromSave: true,
    });

    const endHandle = new fabric.Circle({
      left: end.x,
      top: end.y,
      radius: 8,
      fill: '#6366F1',
      stroke: '#ffffff',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'pointer',
      measurementId: measurementId,
      measurementHandle: 'end',
      excludeFromSave: true,
    });

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Check if labels should be visible (respect showItemLabels setting)
    const showLabels = this.state?.get('settings.showItemLabels') !== false;
    
    const text = new fabric.Text(`${Helpers.formatNumber(distanceFeet, 1)} ft`, {
      left: midX,
      top: midY - 20,
      fontSize: 14,
      fill: Config.COLORS.dimension,
      backgroundColor: 'rgba(255,255,255,0.95)',
      padding: 4,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      visible: showLabels,
      opacity: showLabels ? 1 : 0,
      measurementId: measurementId,
      measurementPart: 'text',
      excludeFromSave: true,
    });

    this.canvas.add(startTick);
    this.canvas.add(endTick);
    this.canvas.add(line);
    line.setCoords();
    line.measurementData = {
      left: line.left,
      top: line.top,
    };
    this.canvas.add(startHandle);
    this.canvas.add(endHandle);
    this.canvas.add(text);
    
    this.canvas.renderAll();
    this.eventBus?.emit('tool:measure:complete', { distanceFeet, lineId: measurementId });
  }

  _handleObjectMoving(e) {
    const obj = e.target;
    if (!obj || !obj.measurementId) return;

    const measurementId = obj.measurementId;
    
    if (obj.measurementHandle) {
      // Handle moved - adjust endpoint
      this._updateFromHandle(measurementId, obj.measurementHandle, obj.left, obj.top);
    } else if (obj.measurement) {
      // Line moved - move everything together
      this._updateFromLine(measurementId, obj);
    }
  }

  _updateFromHandle(measurementId, handle, x, y) {
    const objects = this.canvas.getObjects().filter(o => o.measurementId === measurementId);
    const line = objects.find(o => o.measurement);
    const otherHandle = objects.find(o => o.measurementHandle && o.measurementHandle !== handle);
    const ticks = objects.filter(o => o.measurementPart === 'tick');
    const text = objects.find(o => o.measurementPart === 'text');

    if (!line || !otherHandle) return;

    const start = handle === 'start' ? { x, y } : { x: otherHandle.left, y: otherHandle.top };
    const end = handle === 'end' ? { x, y } : { x: otherHandle.left, y: otherHandle.top };

    // Update line
    line.set({ x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    line.setCoords();

    // Update ticks
    const tickLen = 12;
    if (ticks[0]) {
      ticks[0].set({ x1: start.x, y1: start.y - tickLen, x2: start.x, y2: start.y + tickLen });
      ticks[0].setCoords();
    }
    if (ticks[1]) {
      ticks[1].set({ x1: end.x, y1: end.y - tickLen, x2: end.x, y2: end.y + tickLen });
      ticks[1].setCoords();
    }

    // Update text
    if (text) {
      const distancePx = Helpers.distance(start.x, start.y, end.x, end.y);
      const distanceFeet = distancePx / Config.PX_PER_FOOT;
      text.set({
        left: (start.x + end.x) / 2,
        top: (start.y + end.y) / 2 - 20,
        text: `${Helpers.formatNumber(distanceFeet, 1)} ft`
      });
      text.setCoords();
    }

    line.measurementData = {
      left: line.left,
      top: line.top,
    };

    this.canvas.renderAll();
  }

  _updateFromLine(measurementId, line) {
    const objects = this.canvas.getObjects().filter(o => o.measurementId === measurementId);
    const handles = objects.filter(o => o.measurementHandle);
    const ticks = objects.filter(o => o.measurementPart === 'tick');
    const text = objects.find(o => o.measurementPart === 'text');

    const data = line.measurementData || { left: line.left, top: line.top };
    const dx = line.left - data.left;
    const dy = line.top - data.top;

    if (dx === 0 && dy === 0) {
      return;
    }

    // Move handles
    handles.forEach(handle => {
      handle.set({
        left: handle.left + dx,
        top: handle.top + dy,
      });
      handle.setCoords();
    });

    // Move ticks
    if (ticks[0]) {
      ticks[0].set({
        x1: ticks[0].x1 + dx,
        y1: ticks[0].y1 + dy,
        x2: ticks[0].x2 + dx,
        y2: ticks[0].y2 + dy,
      });
      ticks[0].setCoords();
    }
    if (ticks[1]) {
      ticks[1].set({
        x1: ticks[1].x1 + dx,
        y1: ticks[1].y1 + dy,
        x2: ticks[1].x2 + dx,
        y2: ticks[1].y2 + dy,
      });
      ticks[1].setCoords();
    }

    // Move text
    if (text) {
      text.set({
        left: text.left + dx,
        top: text.top + dy,
      });
      text.setCoords();
    }

    // Update stored data
    line.measurementData = {
      left: line.left,
      top: line.top,
    };

    this.canvas.renderAll();
  }

  _handleMouseOver(e) {
    const obj = e.target;
    if (!obj || !obj.measurementId) return;
    
    if (obj.measurementHandle) {
      obj.set({ scaleX: 1.2, scaleY: 1.2 });
      this.canvas.renderAll();
    }
    
    this._highlightMeasurement(obj.measurementId, true);
  }

  _handleMouseOut(e) {
    const obj = e.target;
    if (!obj || !obj.measurementId) return;
    
    if (obj.measurementHandle) {
      obj.set({ scaleX: 1, scaleY: 1 });
      this.canvas.renderAll();
    }
    
    this._highlightMeasurement(obj.measurementId, false);
  }

  _highlightMeasurement(measurementId, highlight) {
    const objects = this.canvas.getObjects().filter(o => o.measurementId === measurementId);
    const color = highlight ? '#16a34a' : Config.COLORS.dimension;
    const handleColor = highlight ? '#16a34a' : '#6366F1';
    
    objects.forEach(obj => {
      if (obj.type === 'line') {
        obj.set('stroke', color);
      } else if (obj.measurementHandle) {
        obj.set({ fill: handleColor });
      } else if (obj.measurementPart === 'text') {
        obj.set({ 
          fill: highlight ? '#065f46' : Config.COLORS.dimension,
          backgroundColor: highlight ? 'rgba(22,163,74,0.12)' : 'rgba(255,255,255,0.95)'
        });
      }
    });
    
    this.canvas.renderAll();
  }

  _handleSelectionEvent() {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObject();
    if (!active || active.type !== 'activeSelection' || !Array.isArray(active._objects)) {
      return;
    }

    const measurementObjects = active._objects.filter((obj) => obj?.measurementId);
    if (!measurementObjects.length) {
      return;
    }

    const measurementLine =
      measurementObjects.find((obj) => obj.measurement) || measurementObjects[0];

    measurementObjects.forEach((obj) => {
      active.removeWithUpdate(obj);
    });

    if (active.isEmpty()) {
      this.canvas.discardActiveObject();
    } else {
      active.setCoords();
    }

    if (measurementLine) {
      this.canvas.setActiveObject(measurementLine);
    }
    this.canvas.requestRenderAll();
  }

  _showStartIndicator(point) {
    if (!this.canvas) return;
    this._removeStartIndicator();
    
    this.startPointIndicator = new fabric.Circle({
      left: point.x,
      top: point.y,
      radius: 8,
      fill: 'rgba(99,102,241,0.2)',
      stroke: '#6366F1',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      excludeFromSave: true,
    });
    
    this.canvas.add(this.startPointIndicator);
    this.canvas.renderAll();
  }

  _removeStartIndicator() {
    if (this.canvas && this.startPointIndicator) {
      this.canvas.remove(this.startPointIndicator);
      this.startPointIndicator = null;
      this.canvas.renderAll();
    }
  }

  _applyMeasurementCursor() {
    if (!this.canvas) return;
    this._prevDefaultCursor = this.canvas.defaultCursor;
    this._prevHoverCursor = this.canvas.hoverCursor;
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.hoverCursor = 'crosshair';
  }

  _restoreMeasurementCursor() {
    if (!this.canvas) return;
    this.canvas.defaultCursor = this._prevDefaultCursor || 'default';
    this.canvas.hoverCursor = this._prevHoverCursor || 'move';
  }

  removeMeasurement(target) {
    if (!this.canvas || !target) return;
    const measurementId = typeof target === 'string' ? target : target.measurementId;
    if (!measurementId) return;

    const objects = this.canvas.getObjects().filter(obj => obj.measurementId === measurementId);
    objects.forEach(obj => this.canvas.remove(obj));
    this.canvas.renderAll();
  }

  onItemSelected(_object) {}
  onSelectionCleared() {}
  handleItemRemoved(_itemId) {}
}

if (typeof window !== 'undefined') {
  window.MeasurementTool = MeasurementTool;
}
