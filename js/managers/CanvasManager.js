/* global fabric, Helpers, Config */

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
    this.floorPlanWidth = null; // Store floor plan dimensions for re-centering
    this.floorPlanHeight = null;
    this.isAutoFitMode = true; // Track if zoom is auto-fit vs manual
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
      preserveObjectStacking: true,
      // Professional control styling
      selectionColor: 'rgba(99, 102, 241, 0.1)',
      selectionBorderColor: '#6366F1',
      selectionLineWidth: 2,
      // Corner/control styling for better visibility
      borderColor: '#6366F1',
      cornerColor: '#6366F1',
      cornerStrokeColor: '#ffffff',
      cornerStyle: 'circle',
      cornerSize: 14,
      transparentCorners: false,
      borderDashArray: [5, 5],
      borderScaleFactor: 2,
      // Rotation control styling
      rotatingPointOffset: 40,
      // Padding for better hit area
      padding: 0
    });

    // Customize multi-selection (ActiveSelection) appearance
    fabric.ActiveSelection.prototype.set({
      borderColor: '#6366F1',
      cornerColor: '#6366F1',
      cornerStrokeColor: '#ffffff',
      cornerStyle: 'circle',
      cornerSize: 14,
      transparentCorners: false,
      borderDashArray: [5, 5],
      borderScaleFactor: 2,
      padding: 0
    });

    // Setup event listeners
    this.setupEventListeners();

    // Listen to window resize
    window.addEventListener('resize', () => this.resizeCanvas());

    // CRITICAL: Resize canvas synchronously BEFORE any viewport operations
    // This ensures centerAndFit() uses the correct canvas dimensions, not the default 300x150
    this.resizeCanvas();

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

    this.canvas.setDimensions({ width, height });

    // Re-center floor plan ONLY if in auto-fit mode
    // This preserves user's manual zoom level when resizing window
    if (this.isAutoFitMode && this.floorPlanWidth && this.floorPlanHeight) {
      this.centerAndFit(this.floorPlanWidth, this.floorPlanHeight);
    }

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
   * Uses actual item rectangle dimensions (not group bounding box with label)
   * Handles both single items and multi-select (ActiveSelection)
   */
  constrainToFloorPlan(obj) {
    if (!obj || !this.floorPlanRect) return;

    const floorPlan = this.floorPlanRect;

    // Handle multi-select (ActiveSelection) differently
    if (obj.type === 'activeSelection') {
      // Use the entire selection's bounding box
      const boundingRect = obj.getBoundingRect(true);
      let isOutOfBounds = false;
      let offsetX = 0;
      let offsetY = 0;

      // Check bounds and calculate needed offset
      if (boundingRect.left < floorPlan.left) {
        offsetX = floorPlan.left - boundingRect.left;
        isOutOfBounds = true;
      }
      if (boundingRect.left + boundingRect.width > floorPlan.left + floorPlan.width) {
        offsetX = floorPlan.left + floorPlan.width - (boundingRect.left + boundingRect.width);
        isOutOfBounds = true;
      }
      if (boundingRect.top < floorPlan.top) {
        offsetY = floorPlan.top - boundingRect.top;
        isOutOfBounds = true;
      }
      if (boundingRect.top + boundingRect.height > floorPlan.top + floorPlan.height) {
        offsetY = floorPlan.top + floorPlan.height - (boundingRect.top + boundingRect.height);
        isOutOfBounds = true;
      }

      if (isOutOfBounds) {
        obj.set({
          left: obj.left + offsetX,
          top: obj.top + offsetY
        });
        obj.setCoords();
        this.canvas.renderAll();
      }
      return;
    }

    // Handle single items with customData
    if (!obj.customData) return;

    let isOutOfBounds = false;

    // Get center position (obj.left/top are already center due to originX/Y: 'center')
    const centerX = obj.left;
    const centerY = obj.top;

    // Use actual item rectangle dimensions from customData (not group bounding box)
    // This prevents label text from affecting boundary calculations
    const itemWidth = Helpers.feetToPx(obj.customData.widthFt);
    const itemHeight = Helpers.feetToPx(obj.customData.lengthFt);

    // Calculate rotated bounding box dimensions
    const angle = ((obj.angle || 0) * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const halfWidth = (itemWidth * cos + itemHeight * sin) / 2;
    const halfHeight = (itemWidth * sin + itemHeight * cos) / 2;

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

    // Limit zoom to match slider range (10% - 200%)
    if (zoom > 2) zoom = 2;
    if (zoom < 0.1) zoom = 0.1;

    const canvasPoint = new fabric.Point(opt.e.offsetX, opt.e.offsetY);
    this.canvas.zoomToPoint(canvasPoint, zoom);

    // User manually zoomed - exit auto-fit mode
    this.isAutoFitMode = false;

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
    const subtitle = new fabric.Text('Select a floor plan from the sidebar', {
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

    // Store dimensions for re-centering on resize
    this.floorPlanWidth = width;
    this.floorPlanHeight = height;

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
      selectable: false,
      evented: false,
      opacity: showEntryBorder ? 1 : 0
    });

    // Add entry zone label with rotation for vertical positions
    const labelAngle = entryZonePosition === 'left' || entryZonePosition === 'right' ? 90 : 0;

    this.entryZoneLabel = new fabric.Text('ENTRY ZONE', {
      left: labelLeft,
      top: labelTop,
      fontSize: 12,
      fill: '#D32F2F',
      fontWeight: 'bold',
      originX: 'center',
      originY: 'center',
      angle: labelAngle,
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
    } else {
      this.gridLines.forEach((line) => this.canvas.remove(line));
      this.gridLines = [];
    }

    // Ensure core layers remain in the correct order
    this.setLayerOrder();

    // Center and fit
    this.centerAndFit(width, height);

    this.canvas.renderAll();
  }

  /**
   * Draw grid
   */
  drawGrid(width, height) {
    // Clear existing grid
    this.gridLines.forEach((line) => this.canvas.remove(line));
    this.gridLines = [];

    const gridSize = Config.GRID_SIZE;

    const majorLineEvery = gridSize * 5; // Highlight every 5 feet

    // Vertical lines
    for (let i = 0; i <= width; i += gridSize) {
      const isMajor = i % majorLineEvery === 0;
      const line = new fabric.Line([i, 0, i, height], {
        stroke: Config.COLORS.grid,
        strokeWidth: isMajor ? 1.25 : 0.5,
        opacity: isMajor ? 0.35 : 0.18,
        selectable: false,
        evented: false
      });
      this.gridLines.push(line);
      this.canvas.add(line);
    }

    // Horizontal lines
    for (let i = 0; i <= height; i += gridSize) {
      const isMajor = i % majorLineEvery === 0;
      const line = new fabric.Line([0, i, width, i], {
        stroke: Config.COLORS.grid,
        strokeWidth: isMajor ? 1.25 : 0.5,
        opacity: isMajor ? 0.35 : 0.18,
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
   * Sets auto-fit mode flag
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

    // Mark as auto-fit mode (will be preserved during window resize)
    this.isAutoFitMode = true;

    // Emit zoom event to update UI
    this.eventBus.emit('canvas:zoomed', scale);
  }

  /**
   * Add item to canvas
   * Always returns a group immediately (synchronous)
   * If image available, swaps rectangle with image asynchronously
   */
  addItem(itemData, x, y) {
    // Create base group with rectangle immediately
    const group = this._createBaseGroup(itemData, x, y);

    // Add to canvas and render
    this.canvas.add(group);
    this.canvas.renderAll();

    // If image available, start async load to swap rectangle with image
    if (Config.USE_IMAGES && itemData.canvasImage) {
      fabric.Image.fromURL(
        itemData.canvasImage,
        (img) => {
          if (!img) {
            console.warn('[CanvasManager] Failed to load image for item:', itemData.id);
            return; // Keep rectangle fallback
          }
          this._swapGroupImage(group, img, itemData);
        },
        { crossOrigin: 'anonymous' }
      );
    }

    return group;
  }

  /**
   * Create base group with rectangle and label
   * @private
   */
  _createBaseGroup(itemData, x, y) {
    const width = Helpers.feetToPx(itemData.widthFt);
    const height = Helpers.feetToPx(itemData.lengthFt);

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
        offsetY: 2
      })
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
      mtr: true
    });

    group.label = label;

    const keepLabelUpright = () => {
      if (!group.label) return;
      group.label.set('angle', -group.angle);
      group.label.setCoords();
    };

    group.on('rotating', keepLabelUpright);
    group.on('rotated', keepLabelUpright);

    // Store custom data on group
    group.customData = { ...itemData };

    return group;
  }

  /**
   * Swap rectangle in group with loaded image
   * @private
   */
  _swapGroupImage(group, img, itemData) {
    if (!group || !img) return;

    const width = Helpers.feetToPx(itemData.widthFt);
    const height = Helpers.feetToPx(itemData.lengthFt);

    // Scale image to match dimensions
    img.set({
      left: -width / 2,
      top: -height / 2,
      originX: 'left',
      originY: 'top'
    });
    img.scaleToWidth(width);
    img.scaleY = height / img.height;

    // Find and remove the rectangle (first child, index 0)
    const rectChild = group.item(0);
    if (rectChild && rectChild.type === 'rect') {
      group.remove(rectChild);
    }

    // Add image at the beginning (so label stays on top)
    group.insertAt(img, 0);
    group.addWithUpdate();

    // Re-render canvas
    this.canvas.renderAll();
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
    objects.forEach((obj) => {
      if (
        obj.customData &&
        !obj.customData.isLabel &&
        obj !== this.floorPlanRect &&
        obj !== this.entryZoneRect
      ) {
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

    // RESET VIEWPORT TRANSFORM (zoom and pan)
    this.resetViewport();

    this.floorPlanRect = null;
    this.entryZoneRect = null;
    this.entryZoneLabel = null;
    this.gridLines = [];
    this.emptyStateGroup = null;
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
   * Zoom in
   */
  zoomIn() {
    const canvas = this.canvas;
    let zoom = canvas.getZoom();
    zoom = Math.min(zoom * 1.1, 2); // Max 200%

    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), zoom);

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
        this.setLayerOrder();
      } else {
        this.gridLines.forEach((line) => this.canvas.remove(line));
        this.gridLines = [];
      }
      this.canvas.renderAll();
    }
  }

  /**
   * Toggle item labels visibility
   */
  toggleItemLabels(show) {
    const objects = this.canvas.getObjects();
    objects.forEach((obj) => {
      if (obj.type === 'group' && obj.label) {
        obj.label.set({ visible: show, opacity: show ? 1 : 0 });
        obj.label.setCoords();
      }
    });
    this.canvas.requestRenderAll();
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

  /**
   * Keep core canvas layers (floor plan, grid, entry zone) in correct order
   * Floor plan base (0) -> grid (1) -> entry zone fill (2) -> label (3)
   */
  setLayerOrder() {
    if (!this.canvas) return;

    if (this.floorPlanRect) {
      this.floorPlanRect.moveTo(0);
    }

    if (this.gridLines.length > 0) {
      this.gridLines.forEach((line) => line.moveTo(1));
    }

    if (this.entryZoneRect) {
      this.entryZoneRect.moveTo(2);
    }

    if (this.entryZoneLabel) {
      this.entryZoneLabel.moveTo(3);
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.CanvasManager = CanvasManager;
}
