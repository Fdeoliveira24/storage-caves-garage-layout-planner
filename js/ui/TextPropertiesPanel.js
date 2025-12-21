/**
 * TextPropertiesPanel - Enterprise Text Editor
 * Modern, professional typography controls
 * Version: 2.0.0
 */
class TextPropertiesPanel {
  constructor(state, eventBus, textManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.textManager = textManager;
    this.panel = null;
    this.currentText = null;

    // Drag state
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    // Bind methods
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  init() {
    this._createPanel();
    this._setupEventListeners();
  }

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.className = 'text-props';
    this.panel.id = 'text-properties-panel';
    this.panel.innerHTML = `
      <header class="text-props__header">
        <div class="text-props__title">
          <span class="text-props__title-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
          </span>
          <span>Text Properties</span>
        </div>
        <button class="text-props__close" type="button" aria-label="Close panel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <div class="text-props__body">
        <!-- Typography Section -->
        <section class="text-props__section">
          <h3 class="text-props__section-title">Typography</h3>
          <div class="text-props__grid">
            <div class="text-props__field text-props__field--full">
              <label class="text-props__label">Font Family</label>
              <select class="text-props__select" data-prop="fontFamily">
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Verdana">Verdana</option>
                <option value="Courier New">Courier New</option>
                <option value="Trebuchet MS">Trebuchet MS</option>
                <option value="Impact">Impact</option>
              </select>
            </div>
            <div class="text-props__field">
              <label class="text-props__label">Size</label>
              <div class="text-props__number-wrapper">
                <input type="number" class="text-props__number" data-prop="fontSize" min="8" max="200" step="1" value="18">
                <span class="text-props__number-unit">px</span>
                <div class="text-props__spinner">
                  <button type="button" class="text-props__spinner-btn" data-action="increment" data-target="fontSize" aria-label="Increase">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  </button>
                  <button type="button" class="text-props__spinner-btn" data-action="decrement" data-target="fontSize" aria-label="Decrease">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="text-props__field">
              <label class="text-props__label">Color</label>
              <div class="text-props__color-wrapper">
                <input type="color" class="text-props__color" data-prop="fill" value="#111827">
                <span class="text-props__color-value">#111827</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Style Section -->
        <section class="text-props__section">
          <h3 class="text-props__section-title">Style</h3>
          <div class="text-props__grid">
            <div class="text-props__field text-props__field--full">
              <label class="text-props__label">Formatting</label>
              <div class="text-props__toggles">
                <button type="button" class="text-props__toggle" data-prop="fontWeight" data-value="bold" title="Bold">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
                  </svg>
                </button>
                <button type="button" class="text-props__toggle" data-prop="fontStyle" data-value="italic" title="Italic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="4" x2="10" y2="4"></line>
                    <line x1="14" y1="20" x2="5" y2="20"></line>
                    <line x1="15" y1="4" x2="9" y2="20"></line>
                  </svg>
                </button>
                <button type="button" class="text-props__toggle" data-prop="underline" data-value="true" title="Underline">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
                    <line x1="4" y1="21" x2="20" y2="21"></line>
                  </svg>
                </button>
                <button type="button" class="text-props__toggle" data-prop="linethrough" data-value="true" title="Strikethrough">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="12" x2="20" y2="12"></line>
                    <path d="M9 5a7 7 0 0 1 6 0"></path>
                    <path d="M9 19a7 7 0 0 0 6 0"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Alignment Section -->
        <section class="text-props__section">
          <h3 class="text-props__section-title">Alignment</h3>
          <div class="text-props__grid text-props__grid--single">
            <div class="text-props__field">
              <div class="text-props__align-group">
                <button type="button" class="text-props__align-btn" data-prop="textAlign" data-value="left" title="Align Left">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="17" y1="10" x2="3" y2="10"></line>
                    <line x1="21" y1="6" x2="3" y2="6"></line>
                    <line x1="21" y1="14" x2="3" y2="14"></line>
                    <line x1="17" y1="18" x2="3" y2="18"></line>
                  </svg>
                </button>
                <button type="button" class="text-props__align-btn" data-prop="textAlign" data-value="center" title="Align Center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="10" x2="6" y2="10"></line>
                    <line x1="21" y1="6" x2="3" y2="6"></line>
                    <line x1="21" y1="14" x2="3" y2="14"></line>
                    <line x1="18" y1="18" x2="6" y2="18"></line>
                  </svg>
                </button>
                <button type="button" class="text-props__align-btn" data-prop="textAlign" data-value="right" title="Align Right">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="21" y1="10" x2="7" y2="10"></line>
                    <line x1="21" y1="6" x2="3" y2="6"></line>
                    <line x1="21" y1="14" x2="3" y2="14"></line>
                    <line x1="21" y1="18" x2="7" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Spacing Section -->
        <section class="text-props__section">
          <h3 class="text-props__section-title">Spacing</h3>
          <div class="text-props__grid">
            <div class="text-props__field">
              <label class="text-props__label">Line Height</label>
              <div class="text-props__number-wrapper">
                <input type="number" class="text-props__number" data-prop="lineHeight" min="0.5" max="3" step="0.1" value="1.2">
                <span class="text-props__number-unit">×</span>
                <div class="text-props__spinner">
                  <button type="button" class="text-props__spinner-btn" data-action="increment" data-target="lineHeight" aria-label="Increase">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  </button>
                  <button type="button" class="text-props__spinner-btn" data-action="decrement" data-target="lineHeight" aria-label="Decrease">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="text-props__field">
              <label class="text-props__label">Letter Spacing</label>
              <div class="text-props__number-wrapper">
                <input type="number" class="text-props__number" data-prop="charSpacing" min="-10" max="50" step="1" value="0">
                <span class="text-props__number-unit">px</span>
                <div class="text-props__spinner">
                  <button type="button" class="text-props__spinner-btn" data-action="increment" data-target="charSpacing" aria-label="Increase">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>
                  </button>
                  <button type="button" class="text-props__spinner-btn" data-action="decrement" data-target="charSpacing" aria-label="Decrease">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(this.panel);
    this._bindControls();
    this._setupDrag();
  }

  _setupEventListeners() {
    // Show panel when text is selected or added
    this.eventBus.on('text:added', (obj) => this.show(obj));
    
    this.eventBus.on('canvas:selection:changed', (obj) => {
      if (obj && obj.type === 'i-text') {
        this.show(obj);
      } else {
        this.hide();
      }
    });

    // Hide on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.hide();
      }
    });
  }

  _bindControls() {
    const panel = this.panel;

    // Close button
    panel.querySelector('.text-props__close').addEventListener('click', () => this.hide());

    // Select inputs
    panel.querySelectorAll('.text-props__select').forEach((select) => {
      select.addEventListener('change', (e) => {
        const prop = e.target.dataset.prop;
        this._updateProperty(prop, e.target.value);
      });
    });

    // Number inputs
    panel.querySelectorAll('.text-props__number').forEach((input) => {
      input.addEventListener('input', (e) => {
        const prop = e.target.dataset.prop;
        let value = parseFloat(e.target.value);
        
        if (Number.isNaN(value)) return;

        // Special handling for charSpacing (convert px to Fabric units)
        if (prop === 'charSpacing') {
          const fontSize = this.currentText?.fontSize || 1;
          value = Math.round((value / fontSize) * 1000);
        }

        this._updateProperty(prop, value);
      });
    });

    // Color input
    const colorInput = panel.querySelector('[data-prop="fill"]');
    const colorValue = panel.querySelector('.text-props__color-value');
    
    if (colorInput) {
      colorInput.addEventListener('input', (e) => {
        const color = e.target.value;
        if (colorValue) colorValue.textContent = color.toUpperCase();
        this._updateProperty('fill', color);
      });
    }

    // Toggle buttons (bold, italic, underline)
    panel.querySelectorAll('.text-props__toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prop = btn.dataset.prop;
        const isActive = btn.classList.contains('is-active');

        let newValue;
        if (prop === 'fontWeight') {
          newValue = isActive ? 'normal' : 'bold';
        } else if (prop === 'fontStyle') {
          newValue = isActive ? 'normal' : 'italic';
        } else if (prop === 'underline') {
          newValue = !isActive;
        } else if (prop === 'linethrough') {
          newValue = !isActive;
        }

        btn.classList.toggle('is-active');
        this._updateProperty(prop, newValue);
      });
    });

    // Alignment buttons
    panel.querySelectorAll('.text-props__align-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        
        // Update active state
        panel.querySelectorAll('.text-props__align-btn').forEach((b) => {
          b.classList.remove('is-active');
        });
        btn.classList.add('is-active');
        
        this._updateProperty('textAlign', value);
      });
    });

    // Spinner buttons
    panel.querySelectorAll('.text-props__spinner-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const targetProp = btn.dataset.target;
        const input = panel.querySelector(`[data-prop="${targetProp}"]`);
        
        if (!input) return;

        const min = parseFloat(input.getAttribute('min'));
        const max = parseFloat(input.getAttribute('max'));
        const step = parseFloat(input.getAttribute('step'));
        let currentValue = parseFloat(input.value) || 0;

        if (action === 'increment') {
          currentValue = Math.min(currentValue + step, max);
        } else if (action === 'decrement') {
          currentValue = Math.max(currentValue - step, min);
        }

        // Round to step precision
        const decimals = step.toString().split('.')[1]?.length || 0;
        currentValue = parseFloat(currentValue.toFixed(decimals));

        input.value = currentValue;

        // Trigger the input event to update the property
        let value = currentValue;
        if (targetProp === 'charSpacing') {
          const fontSize = this.currentText?.fontSize || 1;
          value = Math.round((currentValue / fontSize) * 1000);
        }

        this._updateProperty(targetProp, value);
      });
    });
  }

  _setupDrag() {
    const header = this.panel.querySelector('.text-props__header');

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.text-props__close')) return;
      if (e.button !== 0) return;
      
      e.preventDefault();
      
      const rect = this.panel.getBoundingClientRect();
      this.isDragging = true;
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Convert to absolute positioning
      this.panel.style.right = 'auto';
      this.panel.style.left = `${rect.left}px`;
      this.panel.style.top = `${rect.top}px`;

      document.addEventListener('mousemove', this._onMouseMove);
      document.addEventListener('mouseup', this._onMouseUp);
    });
  }

  _onMouseMove(e) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    
    const newLeft = e.clientX - this.dragOffset.x;
    const newTop = e.clientY - this.dragOffset.y;
    
    // Constrain to viewport
    const maxX = window.innerWidth - this.panel.offsetWidth - 8;
    const maxY = window.innerHeight - this.panel.offsetHeight - 8;
    
    this.panel.style.left = `${Math.max(8, Math.min(newLeft, maxX))}px`;
    this.panel.style.top = `${Math.max(8, Math.min(newTop, maxY))}px`;
  }

  _onMouseUp() {
    this.isDragging = false;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  _updateProperty(prop, value) {
    if (!this.textManager) return;
    this.textManager.updateTextProperty(prop, value);
  }

  _syncControls(textObject) {
    if (!textObject) return;

    const panel = this.panel;

    // Font family
    const fontFamily = panel.querySelector('[data-prop="fontFamily"]');
    if (fontFamily) fontFamily.value = textObject.fontFamily || 'Arial';

    // Font size
    const fontSize = panel.querySelector('[data-prop="fontSize"]');
    if (fontSize) fontSize.value = textObject.fontSize || 18;

    // Color
    const fillInput = panel.querySelector('[data-prop="fill"]');
    const colorValue = panel.querySelector('.text-props__color-value');
    const color = textObject.fill || '#111827';
    if (fillInput) fillInput.value = color;
    if (colorValue) colorValue.textContent = color.toUpperCase();

    // Line height
    const lineHeight = panel.querySelector('[data-prop="lineHeight"]');
    if (lineHeight) lineHeight.value = textObject.lineHeight || 1.2;

    // Letter spacing (convert from Fabric units to px)
    const charSpacing = panel.querySelector('[data-prop="charSpacing"]');
    if (charSpacing) {
      const pxValue = ((textObject.charSpacing || 0) / 1000) * (textObject.fontSize || 1);
      charSpacing.value = pxValue.toFixed(1);
    }

    // Toggle buttons
    const boldBtn = panel.querySelector('[data-prop="fontWeight"]');
    if (boldBtn) {
      boldBtn.classList.toggle('is-active', textObject.fontWeight === 'bold');
    }

    const italicBtn = panel.querySelector('[data-prop="fontStyle"]');
    if (italicBtn) {
      italicBtn.classList.toggle('is-active', textObject.fontStyle === 'italic');
    }

    const underlineBtn = panel.querySelector('[data-prop="underline"]');
    if (underlineBtn) {
      underlineBtn.classList.toggle('is-active', !!textObject.underline);
    }

    const strikeBtn = panel.querySelector('[data-prop="linethrough"]');
    if (strikeBtn) {
      strikeBtn.classList.toggle('is-active', !!textObject.linethrough);
    }

    // Alignment buttons
    const alignValue = textObject.textAlign || 'left';
    panel.querySelectorAll('.text-props__align-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.value === alignValue);
    });
  }

  show(textObject) {
    if (!textObject) return;
    
    this.currentText = textObject;
    this._syncControls(textObject);
    this.panel.classList.add('is-open');
  }

  hide() {
    this.panel.classList.remove('is-open');
    this.currentText = null;
  }

  isOpen() {
    return this.panel?.classList.contains('is-open');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.TextPropertiesPanel = TextPropertiesPanel;
}
