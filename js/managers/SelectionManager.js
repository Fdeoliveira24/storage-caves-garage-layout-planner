/**
 * Selection Manager
 * Handles item selection, multi-select, and grouping
 */
class SelectionManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
    this.canvas = canvasManager.getCanvas();
    this.clipboard = null; // For copy/paste
  }

  /**
   * Select item
   */
  selectItem(item) {
    this.canvas.setActiveObject(item);
    this.canvas.renderAll();
    
    this.state.setState({ selection: [item] });
    this.eventBus.emit('item:selected', item);
  }

  /**
   * Deselect all
   */
  deselectAll() {
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    
    this.state.setState({ selection: null });
    this.eventBus.emit('selection:cleared');
  }

  /**
   * Get selected items
   */
  getSelection() {
    const active = this.canvas.getActiveObject();
    
    if (!active) return [];
    
    if (active.type === 'activeSelection') {
      return active.getObjects();
    }
    
    return [active];
  }

  /**
   * Select multiple items
   */
  selectMultiple(items) {
    if (items.length === 0) return;
    
    if (items.length === 1) {
      this.selectItem(items[0]);
      return;
    }

    const selection = new fabric.ActiveSelection(items, {
      canvas: this.canvas
    });
    
    this.canvas.setActiveObject(selection);
    this.canvas.renderAll();
    
    this.state.setState({ selection: items });
    this.eventBus.emit('items:selected', items);
  }

  /**
   * Select all items
   */
  selectAll() {
    const objects = this.canvas.getObjects().filter(obj => {
      return obj.customData && !obj.customData.isLabel && 
             obj !== this.canvasManager.floorPlanRect &&
             obj !== this.canvasManager.entryZoneRect;
    });

    this.selectMultiple(objects);
  }

  /**
   * Delete selected items
   */
  deleteSelected() {
    const selected = this.getSelection();
    
    selected.forEach(item => {
      if (item.customData && item.customData.id) {
        this.eventBus.emit('item:delete:requested', item.customData.id);
      }
    });

    this.deselectAll();
  }

  /**
   * Duplicate selected items
   */
  duplicateSelected() {
    const selected = this.getSelection();
    
    selected.forEach(item => {
      if (item.customData && item.customData.id) {
        this.eventBus.emit('item:duplicate:requested', item.customData.id);
      }
    });
  }

  /**
   * Copy selected items to clipboard
   */
  copySelected() {
    const selected = this.getSelection();
    if (selected.length === 0) return;

    this.clipboard = selected.map(item => {
      if (item.customData) {
        // Use Fabric's getCenterPoint() for accurate center even when rotated
        const center = item.getCenterPoint();
        
        return {
          itemId: item.customData.itemId,
          id: item.customData.id,
          label: item.customData.label,
          widthFt: item.customData.widthFt,
          lengthFt: item.customData.lengthFt,
          category: item.customData.category,
          x: center.x,
          y: center.y,
          angle: item.angle || 0
        };
      }
      return null;
    }).filter(item => item !== null);
  }

  /**
   * Paste items from clipboard
   */
  pasteSelected() {
    if (!this.clipboard || this.clipboard.length === 0) return;

    this.clipboard.forEach(item => {
      this.eventBus.emit('item:paste:requested', item);
    });
  }

  /**
   * Rotate selected items
   */
  rotateSelected(angle) {
    const selected = this.getSelection();
    
    selected.forEach(item => {
      const currentAngle = item.angle || 0;
      item.rotate(currentAngle + angle);
    });

    this.canvas.renderAll();
    this.eventBus.emit('items:rotated', selected);
  }

  /**
   * Move selected items
   */
  moveSelected(dx, dy) {
    const selected = this.getSelection();
    
    selected.forEach(item => {
      item.set({
        left: item.left + dx,
        top: item.top + dy
      });
      item.setCoords();
    });

    this.canvas.renderAll();
    this.eventBus.emit('items:moved', selected);
  }

  /**
   * Align selected items
   */
  alignSelected(alignment) {
    const selected = this.getSelection();
    if (selected.length < 2) return;

    const bounds = selected.map(item => Bounds.getItemBounds(item));

    switch (alignment) {
      case 'left':
        const minLeft = Math.min(...bounds.map(b => b.left));
        selected.forEach((item, i) => {
          item.set({ left: item.left + (minLeft - bounds[i].left) });
          item.setCoords();
        });
        break;

      case 'right':
        const maxRight = Math.max(...bounds.map(b => b.right));
        selected.forEach((item, i) => {
          item.set({ left: item.left + (maxRight - bounds[i].right) });
          item.setCoords();
        });
        break;

      case 'top':
        const minTop = Math.min(...bounds.map(b => b.top));
        selected.forEach((item, i) => {
          item.set({ top: item.top + (minTop - bounds[i].top) });
          item.setCoords();
        });
        break;

      case 'bottom':
        const maxBottom = Math.max(...bounds.map(b => b.bottom));
        selected.forEach((item, i) => {
          item.set({ top: item.top + (maxBottom - bounds[i].bottom) });
          item.setCoords();
        });
        break;

      case 'center':
        const avgCenterX = bounds.reduce((sum, b) => sum + (b.left + b.right) / 2, 0) / bounds.length;
        selected.forEach((item, i) => {
          const itemCenterX = (bounds[i].left + bounds[i].right) / 2;
          item.set({ left: item.left + (avgCenterX - itemCenterX) });
          item.setCoords();
        });
        break;

      case 'middle':
        const avgCenterY = bounds.reduce((sum, b) => sum + (b.top + b.bottom) / 2, 0) / bounds.length;
        selected.forEach((item, i) => {
          const itemCenterY = (bounds[i].top + bounds[i].bottom) / 2;
          item.set({ top: item.top + (avgCenterY - itemCenterY) });
          item.setCoords();
        });
        break;
    }

    this.canvas.renderAll();
    this.eventBus.emit('items:aligned', selected);
  }

  /**
   * Bring selected to front
   */
  bringToFront() {
    const selected = this.getSelection();
    selected.forEach(item => item.bringToFront());
    this.canvas.renderAll();
  }

  /**
   * Send selected to back
   */
  sendToBack() {
    const selected = this.getSelection();
    
    // Send items to layer 4 (above grid at 3, but below other items)
    // Layers: 0=floor, 1=entry zone, 2=entry label, 3=grid, 4+=items
    selected.forEach(item => {
      item.moveTo(4);
    });
    
    // Ensure floor plan elements stay in correct order
    if (this.canvasManager.floorPlanRect) {
      this.canvasManager.floorPlanRect.moveTo(0);
    }
    if (this.canvasManager.entryZoneRect) {
      this.canvasManager.entryZoneRect.moveTo(1);
    }
    if (this.canvasManager.entryZoneLabel) {
      this.canvasManager.entryZoneLabel.moveTo(2);
    }
    
    // Keep grid above floor plan but below items
    this.canvasManager.gridLines.forEach(line => line.moveTo(3));
    
    this.canvas.renderAll();
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.SelectionManager = SelectionManager;
}
