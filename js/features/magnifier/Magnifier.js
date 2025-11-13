/* global Config */

/**
 * Magnifier Tool
 * Provides 2.5x zoom magnifying glass over canvas
 */
class Magnifier {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.zoom = config.zoom || Config.MAGNIFIER_ZOOM;
    this.size = config.size || Config.MAGNIFIER_SIZE;
    this.active = false;
    this.magnifierEl = null;
    this.magnifierCanvas = null;
    this.magnifierCtx = null;
  }

  /**
   * Initialize magnifier
   */
  init() {
    this.createMagnifierElement();
    this.setupEventListeners();
  }

  /**
   * Create magnifier DOM element
   */
  createMagnifierElement() {
    // Container
    this.magnifierEl = document.createElement('div');
    this.magnifierEl.style.cssText = `
      position: absolute;
      width: ${this.size}px;
      height: ${this.size}px;
      border: 3px solid #2196F3;
      border-radius: 50%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
      display: none;
      overflow: hidden;
      z-index: 1000;
    `;

    // Canvas for magnified view
    this.magnifierCanvas = document.createElement('canvas');
    this.magnifierCanvas.width = this.size;
    this.magnifierCanvas.height = this.size;
    this.magnifierCtx = this.magnifierCanvas.getContext('2d');

    this.magnifierEl.appendChild(this.magnifierCanvas);
    document.body.appendChild(this.magnifierEl);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const canvasEl = this.canvas.lowerCanvasEl;

    canvasEl.addEventListener('mousemove', (e) => {
      if (!this.active) return;

      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.updateMagnifier(x, y, e.clientX, e.clientY);
    });

    canvasEl.addEventListener('mouseout', () => {
      if (this.active) {
        this.magnifierEl.style.display = 'none';
      }
    });

    canvasEl.addEventListener('mouseover', () => {
      if (this.active) {
        this.magnifierEl.style.display = 'block';
      }
    });
  }

  /**
   * Update magnifier position and content
   */
  updateMagnifier(canvasX, canvasY, screenX, screenY) {
    // Position magnifier
    const offset = 20;
    this.magnifierEl.style.left = screenX + offset + 'px';
    this.magnifierEl.style.top = screenY + offset + 'px';

    // Clear magnifier canvas
    this.magnifierCtx.clearRect(0, 0, this.size, this.size);

    // Get source canvas
    const sourceCanvas = this.canvas.lowerCanvasEl;

    // Calculate source region
    const sourceSize = this.size / this.zoom;
    const sourceX = canvasX - sourceSize / 2;
    const sourceY = canvasY - sourceSize / 2;

    // Draw magnified region
    this.magnifierCtx.save();
    this.magnifierCtx.beginPath();
    this.magnifierCtx.arc(this.size / 2, this.size / 2, this.size / 2, 0, Math.PI * 2);
    this.magnifierCtx.clip();

    this.magnifierCtx.drawImage(
      sourceCanvas,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      this.size,
      this.size
    );

    this.magnifierCtx.restore();

    // Draw crosshair
    this.drawCrosshair();
  }

  /**
   * Draw crosshair in center
   */
  drawCrosshair() {
    const center = this.size / 2;
    this.magnifierCtx.strokeStyle = '#FF5722';
    this.magnifierCtx.lineWidth = 1;

    // Vertical line
    this.magnifierCtx.beginPath();
    this.magnifierCtx.moveTo(center, center - 10);
    this.magnifierCtx.lineTo(center, center + 10);
    this.magnifierCtx.stroke();

    // Horizontal line
    this.magnifierCtx.beginPath();
    this.magnifierCtx.moveTo(center - 10, center);
    this.magnifierCtx.lineTo(center + 10, center);
    this.magnifierCtx.stroke();
  }

  /**
   * Toggle magnifier
   */
  toggle() {
    this.active = !this.active;
    this.magnifierEl.style.display = this.active ? 'block' : 'none';
    return this.active;
  }

  /**
   * Activate magnifier
   */
  activate() {
    this.active = true;
  }

  /**
   * Deactivate magnifier
   */
  deactivate() {
    this.active = false;
    this.magnifierEl.style.display = 'none';
  }

  /**
   * Destroy magnifier
   */
  destroy() {
    if (this.magnifierEl) {
      this.magnifierEl.remove();
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.Magnifier = Magnifier;
}
