/* global Helpers, Config */

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
    this.floorPlanLocked = false;
    this.floorPlanPosition = this.state.get('layout.floorPlanPosition') || null;
    this.floorPlanBounds = this.state.get('layout.floorPlanBounds') || null;
    this.gridLines = [];
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

    this._floorPlanMoveHandler = this._handleFloorPlanMove.bind(this);
    this.enforceFloorBounds = false; // Items can be placed anywhere by default
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
      padding: 0,
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
      padding: 0,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Listen to window resize
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvasWrapper = canvasEl.parentElement;

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

    this.canvas.renderAll();
  }

  /**
   * Position floor plan group, optionally forcing canvas center
   * @param {boolean} forceCenter
   * @private
   */
  _positionFloorPlanGroup(forceCenter = false) {
    if (!this.floorPlanGroup || !this.canvas) return;

    const canvasCenter = this.canvas.getCenter();
    const persistedPosition = this.state.get('layout.floorPlanPosition');
    let targetPosition = this.floorPlanPosition || persistedPosition;

    if (!targetPosition || forceCenter) {
      targetPosition = { left: canvasCenter.left, top: canvasCenter.top };
    }

    this.floorPlanGroup.set({
      left: targetPosition.left,
      top: targetPosition.top,
    });
    this.floorPlanGroup.setCoords();
    this.floorPlanPosition = { ...targetPosition };
    this._updateFloorPlanBounds();
    this.ensureStaticLayersBehind();
    this.canvas.renderAll();
  }

  /**
   * Handle floor plan drag events
   * @private
   */
  _handleFloorPlanMove() {
    if (!this.floorPlanGroup) return;
    this.floorPlanPosition = {
      left: this.floorPlanGroup.left,
      top: this.floorPlanGroup.top,
    };
    this.floorPlanGroup.setCoords();
    this.ensureStaticLayersBehind();
    this._emitFloorPlanStateChanged();
  }

  /**
   * Lock/unlock floor plan movement
   */
  setFloorPlanLocked(isLocked = true) {
    this.floorPlanLocked = isLocked;
    if (!this.floorPlanGroup) return;
    this.floorPlanGroup.set({
      lockMovementX: isLocked,
      lockMovementY: isLocked,
      selectable: !isLocked,
      evented: !isLocked,
    });
    this.floorPlanGroup.setCoords();
    this.canvas.requestRenderAll();
    this.eventBus.emit('floorplan:lock:toggled', isLocked);
  }

  /**
   * Reset floor plan position to canvas center
   */
  resetFloorPlanPosition() {
    this.floorPlanPosition = null;
    this._positionFloorPlanGroup(true);
    // Ensure viewport recenters on the floor plan so it becomes visible
    this.centerAndFit();
    this._emitFloorPlanStateChanged();
  }

  /**
   * Get current floor plan position
   */
  getFloorPlanPosition() {
    return this.floorPlanPosition;
  }

  /**
   * Get current floor plan bounds
   */
  getFloorPlanBounds() {
    return this.floorPlanBounds ? { ...this.floorPlanBounds } : null;
  }

  /**
   * Check if a canvas coordinate lies within the current floor plan bounds
   */
  isPointInsideFloorPlan(x, y) {
    const bounds = this.floorPlanBounds || this._updateFloorPlanBounds();
    if (!bounds) return false;
    return (
      x >= bounds.left &&
      x <= bounds.left + bounds.width &&
      y >= bounds.top &&
      y <= bounds.top + bounds.height
    );
  }

  /**
   * Update item styling based on whether it's inside the floor plan
   * @private
   */
  _updateItemFloorPlanState(obj, suppressRender = false) {
    if (!obj || obj === this.floorPlanGroup || obj.type === 'activeSelection') return;
    if (!obj.customData) return;

    const inside = this.isPointInsideFloorPlan(obj.left, obj.top);
    if (obj.customData._insideFloorPlan === inside) return;

    obj.customData._insideFloorPlan = inside;

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
      if (obj.customData && obj !== this.floorPlanGroup) {
        this._updateItemFloorPlanState(obj, true);
      }
    });
    this.canvas.requestRenderAll();
  }

  /**
   * Update cached floor plan bounds
   * @private
   */
  _updateFloorPlanBounds() {
    if (!this.floorPlanGroup) {
      this.floorPlanBounds = null;
      return null;
    }
    this.floorPlanBounds = this.floorPlanGroup.getBoundingRect(true);
    return this.floorPlanBounds;
  }

  /**
   * Emit floor plan state (position + bounds)
   * @private
   */
  _emitFloorPlanStateChanged() {
    if (!this.floorPlanGroup) return;
    const bounds = this._updateFloorPlanBounds();
    this._refreshItemFloorPlanStates();
    this.eventBus.emit('floorplan:moved', {
      position: this.floorPlanPosition ? { ...this.floorPlanPosition } : null,
      bounds: bounds ? { ...bounds } : null,
    });
  }

  /**
   * Setup canvas event listeners
   */
  setupEventListeners() {
    // Object moving
    this.canvas.on('object:moving', (e) => {
      this._updateItemFloorPlanState(e.target);
      this.eventBus.emit('canvas:object:moving', e.target);
    });

    // Object moved
    this.canvas.on('object:modified', (e) => {
      this._updateItemFloorPlanState(e.target);
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
          <h3>Start Planning Your Space</h3>
          <p>Select a floor plan from the sidebar to begin</p>
        </div>
      `;

      this.canvasWrapper.appendChild(el);
      this.emptyStateEl = el;
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
  drawFloorPlan(floorPlan) {
    // Hide empty state
    this.hideEmptyState();

    // Clear existing floor plan group
    if (this.floorPlanGroup) {
      this.floorPlanGroup.off('moving', this._floorPlanMoveHandler);
      this.canvas.remove(this.floorPlanGroup);
      this.floorPlanGroup = null;
    }
    this.floorPlanRect = null;
    this.entryZoneRect = null;
    this.entryZoneLabel = null;

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
      evented: false,
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
      opacity: showEntryBorder ? 1 : 0,
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
      opacity: showEntryLabel ? 0.8 : 0,
    });

    const floorPlanElements = [this.floorPlanRect, this.entryZoneRect];
    if (this.entryZoneLabel) {
      floorPlanElements.push(this.entryZoneLabel);
    }

    if (this.state.get('settings.showGrid')) {
      this.gridLines = this._createGridLines(width, height);
      floorPlanElements.push(...this.gridLines);
    } else {
      this.gridLines = [];
    }

    this.floorPlanGroup = new fabric.Group(floorPlanElements, {
      left: 0,
      top: 0,
      originX: 'center',
      originY: 'center',
      selectable: !this.floorPlanLocked,
      evented: !this.floorPlanLocked,
      hasBorders: false,
      hasControls: false,
    });

    this.floorPlanGroup.lockScalingX = true;
    this.floorPlanGroup.lockScalingY = true;
    this.floorPlanGroup.lockRotation = true;
    this.floorPlanGroup.lockSkewingX = true;
    this.floorPlanGroup.lockSkewingY = true;
    this.floorPlanGroup.customData = { isFloorPlan: true };

    this.floorPlanGroup.on('moving', this._floorPlanMoveHandler);

    this.canvas.add(this.floorPlanGroup);
    this.setFloorPlanLocked(this.floorPlanLocked);
    this._positionFloorPlanGroup();
    this._emitFloorPlanStateChanged();

    // Ensure core layers remain in the correct order
    this.setLayerOrder();

    // Center and fit
    this.centerAndFit(width, height);

    this.canvas.renderAll();
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
        }),
      );
    }

    return lines;
  }

  /**
   * Center and fit floor plan in viewport
   * Sets auto-fit mode flag
   * If no dimensions provided, uses stored floor plan dimensions
   */
  centerAndFit(width, height) {
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

    let planCenter;
    if (this.floorPlanGroup) {
      planCenter = this.floorPlanGroup.getCenterPoint();
    } else {
      planCenter = new fabric.Point(width / 2, height / 2);
    }

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
   * Add item to canvas
   * Always returns a group immediately (synchronous)
   * If image available, swaps rectangle with image asynchronously
   */
  addItem(itemData, x, y) {
    // Create base group with rectangle immediately
    const group = this._createBaseGroup(itemData, x, y);

    // Add to canvas and render
    this.canvas.add(group);
    this._updateItemFloorPlanState(group);
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
        { crossOrigin: 'anonymous' },
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

    // Create label at center
    const label = new fabric.Text(itemData.label, {
      left: 0,
      top: 0,
      fontSize: 11,
      fill: isMezzanine ? '#374151' : '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: isMezzanine ? '600' : 'bold',
      originX: 'center',
      originY: 'center',
      shadow: new fabric.Shadow({
        color: isMezzanine ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
        blur: isMezzanine ? 0 : 3,
      }),
    });

    // Group rectangle and label together with CENTER origin
    const group = new fabric.Group([baseShape, label], {
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
      originY: 'top',
    });
    img.scaleToWidth(width);
    img.scaleY = height / img.height;

    // Find and remove the rectangle (first child, index 0)
    const shapeChild = group.item(0);
    if (shapeChild && ['rect', 'circle', 'triangle'].includes(shapeChild.type)) {
      group.remove(shapeChild);
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
        obj !== this.floorPlanGroup
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

    if (this.floorPlanGroup) {
      this.floorPlanGroup.off('moving', this._floorPlanMoveHandler);
      this.floorPlanGroup = null;
    }
    this.floorPlanRect = null;
    this.entryZoneRect = null;
    this.entryZoneLabel = null;
    this.floorPlanPosition = null;
    this.floorPlanBounds = null;
    this.gridLines = [];
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
   * Toggle grid visibility
   */
  toggleGrid() {
    const currentState = this.state.get('settings.showGrid');
    this.state.set('settings.showGrid', !currentState);
    this.redrawFloorPlan();
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

    if (this.floorPlanGroup) {
      this.floorPlanGroup.moveTo(0);
    }
  }

  /**
   * Ensure static layers (floor plan, grid, entry zone) stay behind items
   * Called after bring-front/send-back operations to prevent items from going behind floor plan
   */
  ensureStaticLayersBehind() {
    if (!this.canvas) return;

    if (this.floorPlanGroup) {
      this.floorPlanGroup.sendToBack();
    }

    this.canvas.renderAll();
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.CanvasManager = CanvasManager;
}
