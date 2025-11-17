/* global Items, Helpers, Modal */

/**
 * Item Manager
 * Handles item library and CRUD operations
 */
class ItemManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
  }

  /**
   * Add item to canvas
   */
  addItem(itemId, x, y) {
    try {
      const itemTemplate = Items.getById(itemId);
      if (!itemTemplate) {
        console.error('Item not found:', itemId);
        return null;
      }

      if (x === undefined || y === undefined) {
        const center = this.canvasManager.getViewportCenter();
        x = center.x;
        y = center.y;
      }

      const itemData = {
        ...itemTemplate,
        itemId: itemTemplate.id,
        id: Helpers.generateId('item'),
        x: x,
        y: y,
        angle: 0,
        locked: false,
      };

      const canvasGroup = this.canvasManager.addItem(itemData, x, y);
      if (!canvasGroup) {
        throw new Error('Canvas group creation failed');
      }

      itemData.canvasObject = canvasGroup;

      const items = this.state.get('items') || [];
      items.push(itemData);
      this.state.setState({ items });

      this.eventBus.emit('item:added', itemData);

      return itemData;
    } catch (error) {
      this._handleItemError('addItem', error);
      return null;
    }
  }

  /**
   * Remove item
   */
  removeItem(itemId) {
    try {
      const items = this.state.get('items') || [];
      const item = items.find((i) => i.id === itemId);

      if (!item) return false;

      if (item.canvasObject) {
        this.canvasManager.removeItem(item.canvasObject);
      }

      const updatedItems = items.filter((i) => i.id !== itemId);
      this.state.setState({ items: updatedItems });

      this.eventBus.emit('item:removed', itemId);

      return true;
    } catch (error) {
      this._handleItemError('removeItem', error);
      return false;
    }
  }

  /**
   * Update item properties
   */
  updateItem(itemId, updates) {
    try {
      const items = this.state.get('items') || [];
      const itemIndex = items.findIndex((i) => i.id === itemId);

      if (itemIndex === -1) return false;

      items[itemIndex] = { ...items[itemIndex], ...updates };
      this.state.setState({ items });
      this.eventBus.emit('item:updated', items[itemIndex]);

      return true;
    } catch (error) {
      this._handleItemError('updateItem', error);
      return false;
    }
  }

  /**
   * Get item by ID
   */
  getItem(itemId) {
    const items = this.state.get('items') || [];
    return items.find((i) => i.id === itemId);
  }

  /**
   * Get all items
   */
  getAllItems() {
    return this.state.get('items') || [];
  }

  /**
   * Duplicate item
   */
  duplicateItem(itemId, options = {}) {
    try {
      const { centerOverride = null, canvasObject: canvasObjectOverride = null } = options;
      const item = this.getItem(itemId);
      if (!item) return null;

      let x = item.x + 20;
      let y = item.y + 20;
      let angle = item.angle || 0;

      if (canvasObjectOverride && typeof canvasObjectOverride.getCenterPoint === 'function') {
        const center = canvasObjectOverride.getCenterPoint();
        x = center.x + 20;
        y = center.y + 20;
        angle = canvasObjectOverride.angle || 0;
      } else if (
        centerOverride &&
        typeof centerOverride.x === 'number' &&
        typeof centerOverride.y === 'number'
      ) {
        x = centerOverride.x + 20;
        y = centerOverride.y + 20;
      } else if (item.canvasObject && typeof item.canvasObject.getCenterPoint === 'function') {
        const center = item.canvasObject.getCenterPoint();
        x = center.x + 20;
        y = center.y + 20;
        angle = item.canvasObject.angle || 0;
      }

      const newItem = this.addItem(item.itemId, x, y);

      if (newItem && newItem.canvasObject && angle !== 0) {
        newItem.canvasObject.rotate(angle);
        this.canvasManager.getCanvas().renderAll();

        const items = this.state.get('items') || [];
        const stateItem = items.find((i) => i.id === newItem.id);
        if (stateItem) {
          stateItem.angle = angle;
          this.state.setState({ items });
        }
      }

      return newItem;
    } catch (error) {
      this._handleItemError('duplicateItem', error);
      return null;
    }
  }

  /**
   * Lock item
   */
  lockItem(itemId) {
    const item = this.getItem(itemId);
    if (!item) return false;

    if (item.canvasObject) {
      item.canvasObject.lockMovementX = true;
      item.canvasObject.lockMovementY = true;
      item.canvasObject.lockRotation = true;
      item.canvasObject.lockScalingX = true;
      item.canvasObject.lockScalingY = true;
    }

    return this.updateItem(itemId, { locked: true });
  }

  /**
   * Unlock item
   */
  unlockItem(itemId) {
    const item = this.getItem(itemId);
    if (!item) return false;

    if (item.canvasObject) {
      item.canvasObject.lockMovementX = false;
      item.canvasObject.lockMovementY = false;
      item.canvasObject.lockRotation = false;
      item.canvasObject.lockScalingX = false;
      item.canvasObject.lockScalingY = false;
    }

    return this.updateItem(itemId, { locked: false });
  }

  /**
   * Clear all items
   */
  clearAll() {
    const items = this.getAllItems();
    items.forEach((item) => this.removeItem(item.id));
  }

  /**
   * Get item library
   */
  getItemLibrary() {
    return Items.getAll();
  }

  /**
   * Handle item-related errors gracefully
   * @private
   */
  _handleItemError(context, error) {
    console.error(`[ItemManager] ${context} failed:`, error);
    if (typeof Modal !== 'undefined' && typeof Modal.showError === 'function') {
      Modal.showError('Item action failed. Please try again.');
    }
  }

  /**
   * Get items by category
   */
  getItemsByCategory(category) {
    return Items.getByCategory(category);
  }

  /**
   * Get all placed items (from state)
   */
  getItems() {
    return this.state.get('items') || [];
  }

  /**
   * Search items
   */
  searchItems(query) {
    return Items.search(query);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ItemManager = ItemManager;
}
