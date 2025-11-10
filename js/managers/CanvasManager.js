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
    this.gridLines = [];
    this.alignmentGuides = [];
    this.emptyStateGroup = null;
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

    // Setup event listeners
    this.setupEventListeners();

    // Listen to window resize
    window.addEventListener('resize', () => this.resizeCanvas());

    // Ensure canvas is properly sized and show empty state after DOM is fully laid out
    setTimeout(() => {
      this.resizeCanvas();
      this.showEmptyState();
    }, 100);

    return this.canvas;
  }

  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    if (!this.canvas) return;

    const container = this.canvas.wrapperEl.parentElement;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    this.canvas.setDimensions({ width, height });
    
    // Re-center empty state if it exists
    if (this.emptyStateGroup) {
      this.emptyStateGroup.set({
        left: width / 2,
        top: height / 2
      });
    }
    
    this.canvas.renderAll();
  }

  /**
   * Setup canvas event listeners
   */
  setupEventListeners() {
    // Object moving
    this.canvas.on('object:moving', (e) => {
      this.constrainToFloorPlan(e.target);
      this.eventBus.emit('canvas:object:moving', e.target);
    });

    // Object moved
    this.canvas.on('object:modified', (e) => {
      this.constrainToFloorPlan(e.target);
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
   * Constrain object to floor plan bounds
   * Objects use center origin, so left/top represent center coordinates
   */
  constrainToFloorPlan(obj) {
    if (!obj || !obj.customData || !this.floorPlanRect) return;

    const bounds = obj.getBoundingRect();
    const floorPlan = this.floorPlanRect;

    let isOutOfBounds = false;

    // Get center position (obj.left/top are already center due to originX/Y: 'center')
    const centerX = obj.left;
    const centerY = obj.top;
    const halfWidth = obj.getScaledWidth() / 2;
    const halfHeight = obj.getScaledHeight() / 2;

    let newX = centerX;
    let newY = centerY;

    // Constrain left
    if (centerX - halfWidth < floorPlan.left) {
      newX = floorPlan.left + halfWidth;
      isOutOfBounds = true;
    }

    // Constrain right
    if (centerX + halfWidth > floorPlan.left + floorPlan.width) {
      newX = floorPlan.left + floorPlan.width - halfWidth;
      isOutOfBounds = true;
    }

    // Constrain top
    if (centerY - halfHeight < floorPlan.top) {
      newY = floorPlan.top + halfHeight;
      isOutOfBounds = true;
    }

    // Constrain bottom
    if (centerY + halfHeight > floorPlan.top + floorPlan.height) {
      newY = floorPlan.top + floorPlan.height - halfHeight;
      isOutOfBounds = true;
    }

    if (isOutOfBounds) {
      obj.set({ left: newX, top: newY });
      obj.setCoords();
      this.canvas.renderAll();
    }
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
   * Show empty state message
   */
  showEmptyState() {
    // Remove existing empty state if any
    if (this.emptyStateGroup) {
      this.canvas.remove(this.emptyStateGroup);
      this.emptyStateGroup = null;
    }

    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    // Create grid icon using basic shapes
    const gridSize = 80;
    const gridSpacing = 28;
    const gridColor = '#D1D5DB';
    
    const gridSquares = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const square = new fabric.Rect({
          left: col * gridSpacing - gridSize / 2,
          top: row * gridSpacing - gridSize / 2,
          width: 20,
          height: 20,
          fill: gridColor,
          rx: 3,
          ry: 3
        });
        gridSquares.push(square);
      }
    }

    // Create title text
    const title = new fabric.Text('Start Planning Your Space', {
      left: 0,
      top: gridSize / 2 + 20,
      fontSize: 24,
      fontWeight: '600',
      fill: '#18181B',
      originX: 'center',
      originY: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // Create subtitle text
    const subtitle = new fabric.Text('Select a floor plan from the sidebar to begin', {
      left: 0,
      top: gridSize / 2 + 55,
      fontSize: 15,
      fill: '#71717A',
      originX: 'center',
      originY: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    // Group all elements
    this.emptyStateGroup = new fabric.Group([...gridSquares, title, subtitle], {
      left: canvasWidth / 2,
      top: canvasHeight / 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    this.canvas.add(this.emptyStateGroup);
    this.canvas.renderAll();
  }

  /**
   * Hide empty state message
   */
  hideEmptyState() {
    if (this.emptyStateGroup) {
      this.canvas.remove(this.emptyStateGroup);
      this.canvas.renderAll();
    }
  }

  /**
   * Draw floor plan
   */
  drawFloorPlan(floorPlan) {
    // Hide empty state
    this.hideEmptyState();

    // Clear existing floor plan
    if (this.floorPlanRect) {
      this.canvas.remove(this.floorPlanRect);
    }
    if (this.entryZoneRect) {
      this.canvas.remove(this.entryZoneRect);
    }
    if (this.entryZoneLabel) {
      this.canvas.remove(this.entryZoneLabel);
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

    // Create entry zone
    const entryZonePosition = this.state.get('settings.entryZonePosition') || 'bottom';
    const showEntryBorder = this.state.get('settings.showEntryZoneBorder') !== false;
    const showEntryLabel = this.state.get('settings.showEntryZoneLabel') !== false;
    
    let entryLeft, entryTop, entryWidth, entryHeight, labelLeft, labelTop;
    
    if (entryZonePosition === 'left' || entryZonePosition === 'right') {
      // Vertical entry zone (left or right side)
      entryWidth = width * Config.ENTRY_ZONE_PERCENTAGE;
      entryHeight = height;
      entryLeft = entryZonePosition === 'left' ? 0 : width - entryWidth;
      entryTop = 0;
      labelLeft = entryLeft + entryWidth / 2;
      labelTop = height / 2;
    } else {
      // Horizontal entry zone (top or bottom)
      entryWidth = width;
      entryHeight = height * Config.ENTRY_ZONE_PERCENTAGE;
      entryLeft = 0;
      entryTop = entryZonePosition === 'top' ? 0 : height - entryHeight;
      labelLeft = width / 2;
      labelTop = entryTop + entryHeight / 2;
    }
    
    this.entryZoneRect = new fabric.Rect({
      left: entryLeft,
      top: entryTop,
      width: entryWidth,
      height: entryHeight,
      fill: Config.COLORS.entryZone,
      stroke: '#D32F2F',
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: false,
      evented: false,
      opacity: showEntryBorder ? 1 : 0
    });
    
    // Add entry zone label
    this.entryZoneLabel = new fabric.Text('ENTRY ZONE', {
      left: labelLeft,
      top: labelTop,
      fontSize: 12,
      fill: '#D32F2F',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      opacity: showEntryLabel ? 0.8 : 0
    });

    this.canvas.add(this.floorPlanRect);
    this.canvas.add(this.entryZoneRect);
    this.canvas.add(this.entryZoneLabel);
    
    // Draw grid if enabled
    if (this.state.get('settings.showGrid')) {
      this.drawGrid(width, height);
    }

    // Set z-order: floor plan at back, then grid, then entry zone/label
    // First send all grid lines to back
    this.gridLines.forEach(line => line.sendToBack());
    // Then send floor plan to back (this puts it below the grid)
    this.floorPlanRect.sendToBack();
    // Bring entry zone elements to front (but still behind items)
    this.entryZoneRect.bringForward();
    this.entryZoneLabel.bringForward();

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
        strokeWidth: i % 50 === 0 ? 1.5 : 0.5,
        selectable: false,
        evented: false
      });
      this.gridLines.push(line);
      this.canvas.add(line);
    }

    // Horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
      const line = new fabric.Line([0, i, width, i], {
        stroke: Config.COLORS.grid,
        strokeWidth: i % 50 === 0 ? 1.5 : 0.5,
        selectable: false,
        evented: false
      });
      this.gridLines.push(line);
      this.canvas.add(line);
    }
    
    // Note: z-order is set in drawFloorPlan() after grid is drawn
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

    // Create rectangle centered at origin
    const rect = new fabric.Rect({
      left: -width / 2,
      top: -height / 2,
      width: width,
      height: height,
      fill: itemData.color || '#2196F3',
      stroke: '#333',
      strokeWidth: 2,
      rx: 4,
      ry: 4
    });

    // Create label at center
    const label = new fabric.Text(itemData.label, {
      left: 0,
      top: 0,
      fontSize: 11,
      fill: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.5)',
        blur: 3
      })
    });

    // Group rectangle and label together with CENTER origin
    const group = new fabric.Group([rect, label], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingX: true,
      lockScalingY: true,
      lockSkewingX: true,
      lockSkewingY: true,
      borderColor: '#6366F1',
      borderScaleFactor: 2,
      cornerColor: '#6366F1',
      cornerSize: 12,
      transparentCorners: false,
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.3)',
        blur: 10,
        offsetX: 2,
        offsetY: 2
      })
    });

    // Hide all control handles EXCEPT rotation (mtr)
    group.setControlsVisibility({
      mt: false,   // middle top
      mb: false,   // middle bottom
      ml: false,   // middle left
      mr: false,   // middle right
      bl: false,   // bottom left
      br: false,   // bottom right
      tl: false,   // top left
      tr: false,   // top right
      mtr: true    // rotation handle - KEEP VISIBLE
    });

    // Store custom data on group
    group.customData = {
      id: itemData.id,
      itemId: itemData.itemId || itemData.id,
      label: itemData.label,
      lengthFt: itemData.lengthFt,
      widthFt: itemData.widthFt,
      category: itemData.category,
      locked: false
    };

    this.canvas.add(group);

    return group;
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
    this.entryZoneLabel = null;
    this.gridLines = [];
    this.emptyStateGroup = null;
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
    const canvas = this.canvas;
    let zoom = canvas.getZoom();
    zoom = Math.min(zoom * 1.1, 20);
    
    canvas.zoomToPoint(
      new fabric.Point(canvas.width / 2, canvas.height / 2),
      zoom
    );
    
    this.eventBus.emit('canvas:zoomed', zoom);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    const canvas = this.canvas;
    let zoom = canvas.getZoom();
    zoom = Math.max(zoom / 1.1, 0.1);
    
    canvas.zoomToPoint(
      new fabric.Point(canvas.width / 2, canvas.height / 2),
      zoom
    );
    
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

  /**
   * Toggle grid visibility
   */
  toggleGrid() {
    const currentState = this.state.get('settings.showGrid');
    this.state.set('settings.showGrid', !currentState);
    
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      if (!currentState) {
        const width = Helpers.feetToPx(floorPlan.widthFt);
        const height = Helpers.feetToPx(floorPlan.heightFt);
        this.drawGrid(width, height);
      } else {
        this.gridLines.forEach(line => this.canvas.remove(line));
        this.gridLines = [];
      }
      this.canvas.renderAll();
    }
  }

  /**
   * Redraw floor plan with current settings
   */
  redrawFloorPlan() {
    const floorPlan = this.state.get('floorPlan');
    if (floorPlan) {
      this.drawFloorPlan(floorPlan);
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.CanvasManager = CanvasManager;
}
