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
    this.gridLines = [];
    this.alignmentGuides = [];
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

    this.canvas = new fabric.Canvas(this.canvasId, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true
    });

    // Set canvas size
    this.resizeCanvas();

    // Setup event listeners
    this.setupEventListeners();

    // Listen to window resize
    window.addEventListener('resize', () => this.resizeCanvas());

    return this.canvas;
  }

  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    if (!this.canvas) return;

    const container = this.canvas.wrapperEl.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.canvas.setDimensions({ width, height });
    this.canvas.renderAll();
  }

  /**
   * Setup canvas event listeners
   */
  setupEventListeners() {
    // Object moving
    this.canvas.on('object:moving', (e) => {
      this.eventBus.emit('canvas:object:moving', e.target);
    });

    // Object moved
    this.canvas.on('object:modified', (e) => {
      this.eventBus.emit('canvas:object:modified', e.target);
    });

    // Selection created
    this.canvas.on('selection:created', (e) => {
      this.eventBus.emit('canvas:selection:created', e.selected);
    });

    // Selection updated
    this.canvas.on('selection:updated', (e) => {
      this.eventBus.emit('canvas:selection:updated', e.selected);
    });

    // Selection cleared
    this.canvas.on('selection:cleared', () => {
      this.eventBus.emit('canvas:selection:cleared');
    });

    // Mouse wheel zoom
    this.canvas.on('mouse:wheel', (opt) => {
      this.handleMouseWheel(opt);
    });
  }

  /**
   * Handle mouse wheel for zoom
   */
  handleMouseWheel(opt) {
    const delta = opt.e.deltaY;
    let zoom = this.canvas.getZoom();
    zoom *= 0.999 ** delta;
    
    // Limit zoom
    if (zoom > 20) zoom = 20;
    if (zoom < 0.1) zoom = 0.1;

    this.canvas.zoomToPoint(
      { x: opt.e.offsetX, y: opt.e.offsetY },
      zoom
    );
    
    opt.e.preventDefault();
    opt.e.stopPropagation();

    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Draw floor plan
   */
  drawFloorPlan(floorPlan) {
    // Clear existing floor plan
    if (this.floorPlanRect) {
      this.canvas.remove(this.floorPlanRect);
    }
    if (this.entryZoneRect) {
      this.canvas.remove(this.entryZoneRect);
    }

    const width = Helpers.feetToPx(floorPlan.widthFt);
    const height = Helpers.feetToPx(floorPlan.heightFt);

    // Create floor plan rectangle
    this.floorPlanRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: width,
      height: height,
      fill: Config.COLORS.floorPlan,
      stroke: Config.COLORS.floorPlanStroke,
      strokeWidth: 2,
      selectable: false,
      evented: false
    });

    // Create entry zone (bottom 20%)
    const entryHeight = height * Config.ENTRY_ZONE_PERCENTAGE;
    this.entryZoneRect = new fabric.Rect({
      left: 0,
      top: height - entryHeight,
      width: width,
      height: entryHeight,
      fill: Config.COLORS.entryZone,
      stroke: '#FFC107',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false
    });

    this.canvas.add(this.floorPlanRect);
    this.canvas.add(this.entryZoneRect);
    this.floorPlanRect.sendToBack();
    this.entryZoneRect.sendToBack();

    // Draw grid if enabled
    if (this.state.get('settings.showGrid')) {
      this.drawGrid(width, height);
    }

    // Center and fit
    this.centerAndFit(width, height);
    
    this.canvas.renderAll();
  }

  /**
   * Draw grid
   */
  drawGrid(width, height) {
    // Clear existing grid
    this.gridLines.forEach(line => this.canvas.remove(line));
    this.gridLines = [];

    const gridSize = Config.GRID_SIZE;

    // Vertical lines
    for (let i = 0; i <= width; i += gridSize) {
      const line = new fabric.Line([i, 0, i, height], {
        stroke: Config.COLORS.grid,
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      this.gridLines.push(line);
      this.canvas.add(line);
      line.sendToBack();
    }

    // Horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
      const line = new fabric.Line([0, i, width, i], {
        stroke: Config.COLORS.grid,
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      this.gridLines.push(line);
      this.canvas.add(line);
      line.sendToBack();
    }
  }

  /**
   * Center and fit floor plan in viewport
   */
  centerAndFit(width, height) {
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    const scaleX = (canvasWidth - Config.CANVAS_PADDING * 2) / width;
    const scaleY = (canvasHeight - Config.CANVAS_PADDING * 2) / height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1:1

    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); // Reset transform
    this.canvas.setZoom(scale);

    const offsetX = (canvasWidth - width * scale) / 2;
    const offsetY = (canvasHeight - height * scale) / 2;

    this.canvas.absolutePan({ x: -offsetX / scale, y: -offsetY / scale });
  }

  /**
   * Add item to canvas
   */
  addItem(itemData, x, y) {
    const width = Helpers.feetToPx(itemData.widthFt);
    const height = Helpers.feetToPx(itemData.lengthFt); // Vertical by default

    const rect = new fabric.Rect({
      left: x,
      top: y,
      width: width,
      height: height,
      fill: itemData.color || '#2196F3',
      stroke: '#000000',
      strokeWidth: 1,
      angle: 0
    });

    // Store custom data
    rect.customData = {
      id: itemData.id,
      itemId: itemData.id,
      label: itemData.label,
      lengthFt: itemData.lengthFt,
      widthFt: itemData.widthFt,
      category: itemData.category,
      locked: false
    };

    // Add label
    const label = new fabric.Text(itemData.label, {
      left: x + width / 2,
      top: y + height / 2,
      fontSize: 12,
      fill: '#ffffff',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    label.customData = { parentId: rect.customData.id, isLabel: true };

    this.canvas.add(rect);
    this.canvas.add(label);

    return { rect, label };
  }

  /**
   * Remove item from canvas
   */
  removeItem(item) {
    this.canvas.remove(item);
  }

  /**
   * Clear all items (keep floor plan)
   */
  clearItems() {
    const objects = this.canvas.getObjects();
    objects.forEach(obj => {
      if (obj.customData && !obj.customData.isLabel && obj !== this.floorPlanRect && obj !== this.entryZoneRect) {
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
      ...options
    });
  }

  /**
   * Clear canvas
   */
  clear() {
    this.canvas.clear();
    this.floorPlanRect = null;
    this.entryZoneRect = null;
    this.gridLines = [];
  }

  /**
   * Get canvas instance
   */
  getCanvas() {
    return this.canvas;
  }

  /**
   * Zoom in
   */
  zoomIn() {
    let zoom = this.canvas.getZoom();
    zoom = Math.min(zoom * 1.1, 20);
    this.canvas.setZoom(zoom);
    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    let zoom = this.canvas.getZoom();
    zoom = Math.max(zoom / 1.1, 0.1);
    this.canvas.setZoom(zoom);
    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Reset zoom
   */
  resetZoom() {
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      const width = Helpers.feetToPx(floorPlan.widthFt);
      const height = Helpers.feetToPx(floorPlan.heightFt);
      this.centerAndFit(width, height);
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.CanvasManager = CanvasManager;
}
