/* global Helpers, Modal */

/**
 * Text Manager
 * Handles creation and property updates for Fabric IText objects
 */
class TextManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.getCanvas();
    this.active = false;
    this.clickHandler = null;

    this.defaults = {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: '#18181b',
      fontWeight: 'normal',
      fontStyle: 'normal',
      underline: false,
      linethrough: false,
      lineHeight: 1.2,
      charSpacing: 0,
      borderColor: '#D32F2F',
      cornerColor: '#D32F2F',
      cornerStrokeColor: '#ffffff',
      cornerStyle: 'circle',
      cornerSize: 14,
      transparentCorners: false,
      borderDashArray: [4, 4],
      borderScaleFactor: 2,
      rotatingPointOffset: 40,
    };

    this._registerEventHooks();
  }

  activate() {
    if (this.active) return;
    this.active = true;
    if (this.canvas) {
      this.canvas.defaultCursor = 'text';
    }
    this._attachClickHandler();
    this.eventBus.emit('text:tool:activated');
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
    if (this.canvas) {
      this.canvas.defaultCursor = 'default';
    }
    this._detachClickHandler();
    this.eventBus.emit('text:tool:deactivated');
  }

  toggle() {
    if (this.active) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  _attachClickHandler() {
    if (!this.canvas || this.clickHandler) return;

    this.clickHandler = (options) => {
      if (!this.active) return;
      const target = options?.target;
      if (target && this._isTextObject(target)) {
        this.canvas.setActiveObject(target);
        target.enterEditing();
        target.selectAll();
        this.canvas.requestRenderAll();
        this.eventBus.emit('canvas:selection:changed', target);
        this.deactivate();
        return;
      }

      if (target && !this._isTextObject(target)) {
        this.deactivate();
        return;
      }

      if (!this._canAddText()) {
        Modal?.showInfo?.('Please select a floor plan first');
        this.deactivate();
        return;
      }

      const pointer = this.canvas.getPointer(options.e);
      this.addText(pointer.x, pointer.y);
      this.deactivate();
    };
    this.canvas.on('mouse:down', this.clickHandler);
  }

  _detachClickHandler() {
    if (!this.canvas || !this.clickHandler) return;
    this.canvas.off('mouse:down', this.clickHandler);
    this.clickHandler = null;
  }

  addText(x, y) {
    if (!this.canvas) return null;

    let targetX = x;
    let targetY = y;
    if (typeof targetX !== 'number' || typeof targetY !== 'number') {
      const center = this.canvas.getCenter();
      targetX = center.left;
      targetY = center.top;
    }

    const text = new fabric.IText('Type here', {
      left: targetX,
      top: targetY,
      originX: 'center',
      originY: 'center',
      ...this.defaults,
      editable: true,
    });

    this._ensureTextId(text);
    text.isTextObject = true;
    this._applyControlStyling(text);
    this._registerTextEvents(text);

    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();

    this._persistTextState(text);
    this.canvas.renderAll();

    this.eventBus.emit('text:added', text);
    this.eventBus.emit('canvas:selection:changed', text);
    return text;
  }

  updateTextProperty(property, value) {
    const obj = this.canvas ? this.canvas.getActiveObject() : null;
    if (!this._isTextObject(obj)) return;

    if (property === 'charSpacing' && typeof value === 'number') {
      obj.set('charSpacing', value);
    } else {
      obj.set(property, value);
    }
    obj.setCoords();
    this._persistTextState(obj);
    this.canvas.requestRenderAll();
    this.eventBus.emit('text:modified', obj);
  }

  restoreTextsFromState(texts = []) {
    if (!this.canvas || !Array.isArray(texts)) return;

    texts.forEach((textData) => {
      const text = this._createTextFromData(textData);
      if (text) {
        this.canvas.add(text);
      }
    });

    this.canvas.requestRenderAll();
  }

  _createTextFromData(data) {
    if (!data) return null;

    const text = new fabric.IText(data.text || 'Type here', {
      left: data.x ?? data.left ?? 0,
      top: data.y ?? data.top ?? 0,
      originX: data.originX || 'center',
      originY: data.originY || 'center',
      fontFamily: data.fontFamily || this.defaults.fontFamily,
      fontSize: data.fontSize || this.defaults.fontSize,
      fill: data.fill || this.defaults.fill,
      fontWeight: data.fontWeight || this.defaults.fontWeight,
      fontStyle: data.fontStyle || this.defaults.fontStyle,
      underline: data.underline || false,
      lineHeight: data.lineHeight || this.defaults.lineHeight,
      linethrough: data.linethrough || false,
      charSpacing:
        typeof data.charSpacing === 'number' ? data.charSpacing : this.defaults.charSpacing,
      angle: data.angle || 0,
      scaleX: data.scaleX || 1,
      scaleY: data.scaleY || 1,
      textAlign: data.textAlign || 'left',
      editable: true,
    });

    text.textId = data.id || data.textId || Helpers.generateId('text');
    text.isTextObject = true;
    this._applyControlStyling(text);
    this._registerTextEvents(text);
    return text;
  }

  _registerTextEvents(text) {
    if (!text || typeof text.on !== 'function') return;

    text.on('editing:exited', () => {
      this._persistTextState(text);
      this.eventBus.emit('text:modified', text);
      this.deactivate();
    });
  }

  _registerEventHooks() {
    if (this.eventBus && typeof this.eventBus.on === 'function') {
      this.eventBus.on('canvas:object:modified', (obj) => this._handleObjectModified(obj));
      this.eventBus.on('text:deleted', (obj) => this._removeTextFromState(obj));
      this.eventBus.on('items:cleared', () => this.clearTexts());
      this.eventBus.on('text:imported:batch', (texts) => this._handleImportedTexts(texts));
    }

    if (this.canvas && typeof this.canvas.on === 'function') {
      this.canvas.on('text:changed', (e) => this._handleTextChanged(e));
    }
  }

  _handleObjectModified(obj) {
    if (!this._isTextObject(obj)) return;
    this._persistTextState(obj);
    this.eventBus.emit('text:modified', obj);
  }

  _handleTextChanged(event) {
    const target = event ? event.target : null;
    if (!this._isTextObject(target)) return;
    this._persistTextState(target);
    this.eventBus.emit('text:modified', target);
  }

  _persistTextState(text) {
    if (!this._isTextObject(text)) return null;
    this._ensureTextId(text);

    const textData = this._serializeText(text);
    const texts = this.state.get('texts') || [];
    const existingIndex = texts.findIndex((t) => t.id === textData.id);
    if (existingIndex >= 0) {
      texts[existingIndex] = textData;
    } else {
      texts.push(textData);
    }
    this.state.setState({ texts });
    return textData;
  }

  _removeTextFromState(text) {
    const id = text?.textId || text?.id;
    if (!id) return;
    const texts = this.state.get('texts') || [];
    const updated = texts.filter((t) => t.id !== id);
    if (updated.length !== texts.length) {
      this.state.setState({ texts: updated });
    }
  }

  _serializeText(text) {
    return {
      id: text.textId,
      text: text.text || '',
      x: text.left,
      y: text.top,
      angle: text.angle || 0,
      fontFamily: text.fontFamily || this.defaults.fontFamily,
      fontSize: text.fontSize || this.defaults.fontSize,
      fill: text.fill || this.defaults.fill,
      fontWeight: text.fontWeight || this.defaults.fontWeight,
      fontStyle: text.fontStyle || this.defaults.fontStyle,
      underline: !!text.underline,
      linethrough: !!text.linethrough,
      lineHeight: text.lineHeight || this.defaults.lineHeight,
      charSpacing: typeof text.charSpacing === 'number' ? text.charSpacing : this.defaults.charSpacing,
      scaleX: text.scaleX || 1,
      scaleY: text.scaleY || 1,
      originX: text.originX || 'center',
      originY: text.originY || 'center',
      textAlign: text.textAlign || 'left',
    };
  }

  _ensureTextId(text) {
    if (!text.textId) {
      text.textId = Helpers.generateId('text');
    }
  }

  _handleImportedTexts(texts = []) {
    const imported = Array.isArray(texts) ? texts : [];
    this.clearTexts();
    this.state.setState({ texts: imported });
    this.restoreTextsFromState(imported);
  }

  clearTexts() {
    if (!this.canvas) return;
    const existing = (this.canvas.getObjects() || []).filter((obj) => this._isTextObject(obj));
    if (existing.length === 0) return;
    existing.forEach((text) => {
      this.canvas.remove(text);
    });
    this.state.setState({ texts: [] });
    this.canvas.requestRenderAll();
  }

  _isTextObject(obj) {
    return !!obj && (obj.type === 'i-text' || obj.type === 'textbox');
  }

  _applyControlStyling(text) {
    if (!text || typeof text.set !== 'function') return;
    text.set({
      borderColor: this.defaults.borderColor,
      cornerColor: this.defaults.cornerColor,
      cornerStrokeColor: this.defaults.cornerStrokeColor,
      cornerStyle: this.defaults.cornerStyle,
      cornerSize: this.defaults.cornerSize,
      transparentCorners: this.defaults.transparentCorners,
      borderDashArray: this.defaults.borderDashArray,
      borderScaleFactor: this.defaults.borderScaleFactor,
      rotatingPointOffset: this.defaults.rotatingPointOffset,
    });
  }

  _canAddText() {
    return !!this.state?.get?.('floorPlan');
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.TextManager = TextManager;
}
