/* global Helpers, Config */

/**
 * Measurement Tool
 * Click two points to measure distance
 */
class MeasurementTool {
  constructor(canvas, state, eventBus) {
    this.canvas = canvas;
    this.state = state;
    this.eventBus = eventBus;
    this.active = false;
    this.points = [];
    this.measurementLine = null;
    this.measurementText = null;
  }

  /**
   * Activate measurement tool
   */
  activate() {
    this.active = true;
    this.points = [];
    this.setupClickHandler();
    this.eventBus.emit('tool:measure:activated');
  }

  /**
   * Deactivate measurement tool
   */
  deactivate() {
    this.active = false;
    this.clearMeasurement();
    this.eventBus.emit('tool:measure:deactivated');
  }

  /**
   * Toggle measurement tool
   */
  toggle() {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
    return this.active;
  }

  /**
   * Setup click handler
   */
  setupClickHandler() {
    this.clickHandler = (options) => {
      if (!this.active) return;

      const pointer = this.canvas.getPointer(options.e);
      this.addPoint(pointer.x, pointer.y);
    };

    this.canvas.on('mouse:down', this.clickHandler);
  }

  /**
   * Add measurement point
   */
  addPoint(x, y) {
    this.points.push({ x, y });

    if (this.points.length === 2) {
      this.drawMeasurement();
      this.deactivate();
    }
  }

  /**
   * Draw measurement line and distance
   */
  drawMeasurement() {
    const [p1, p2] = this.points;

    // Calculate distance
    const distancePx = Helpers.distance(p1.x, p1.y, p2.x, p2.y);
    const distanceFt = Helpers.pxToFeet(distancePx);
    const unit = this.state.get('settings.unit') || 'feet';

    let displayDistance = distanceFt;
    let unitLabel = 'ft';

    if (unit === 'meters') {
      displayDistance = Helpers.feetToMeters(distanceFt);
      unitLabel = 'm';
    }

    // Draw line
    this.measurementLine = new fabric.Line([p1.x, p1.y, p2.x, p2.y], {
      stroke: Config.COLORS.dimension,
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });

    // Draw text
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    this.measurementText = new fabric.Text(
      `${Helpers.formatNumber(displayDistance, 2)} ${unitLabel}`,
      {
        left: midX,
        top: midY - 10,
        fontSize: 14,
        fill: Config.COLORS.dimension,
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: 4,
        selectable: false,
        evented: false,
      },
    );

    this.canvas.add(this.measurementLine);
    this.canvas.add(this.measurementText);
    this.canvas.renderAll();

    this.eventBus.emit('tool:measure:complete', {
      distance: displayDistance,
      unit: unitLabel,
    });
  }

  /**
   * Clear measurement
   */
  clearMeasurement() {
    if (this.measurementLine) {
      this.canvas.remove(this.measurementLine);
      this.measurementLine = null;
    }

    if (this.measurementText) {
      this.canvas.remove(this.measurementText);
      this.measurementText = null;
    }

    if (this.clickHandler) {
      this.canvas.off('mouse:down', this.clickHandler);
    }

    this.points = [];
    this.canvas.renderAll();
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.MeasurementTool = MeasurementTool;
}
