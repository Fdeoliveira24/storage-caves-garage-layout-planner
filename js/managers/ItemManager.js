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
    const itemTemplate = Items.getById(itemId);
    if (!itemTemplate) {
      console.error('Item not found:', itemId);
      return null;
    }

    // Create unique item data
    const itemData = {
      ...itemTemplate,
      id: Helpers.generateId('item'),
      x: x,
      y: y,
      angle: 0,
      locked: false
    };

    // Add to canvas
    const canvasGroup = this.canvasManager.addItem(itemData, x, y);

    // Store reference to canvas object (now a group)
    itemData.canvasObject = canvasGroup;

    // Add to state
    const items = this.state.get('items') || [];
    items.push(itemData);
    this.state.setState({ items });

    // Emit event
    this.eventBus.emit('item:added', itemData);

    return itemData;
  }

  /**
   * Remove item
   */
  removeItem(itemId) {
    const items = this.state.get('items') || [];
    const item = items.find(i => i.id === itemId);
    
    if (!item) return false;

    // Remove from canvas
    if (item.canvasObject) {
      this.canvasManager.removeItem(item.canvasObject);
    }

    // Remove from state
    const updatedItems = items.filter(i => i.id !== itemId);
    this.state.setState({ items: updatedItems });

    // Emit event
    this.eventBus.emit('item:removed', itemId);

    return true;
  }

  /**
   * Update item properties
   */
  updateItem(itemId, updates) {
    const items = this.state.get('items') || [];
    const itemIndex = items.findIndex(i => i.id === itemId);
    
    if (itemIndex === -1) return false;

    // Update item
    items[itemIndex] = { ...items[itemIndex], ...updates };
    this.state.setState({ items });

    // Emit event
    this.eventBus.emit('item:updated', items[itemIndex]);

    return true;
  }

  /**
   * Get item by ID
   */
  getItem(itemId) {
    const items = this.state.get('items') || [];
    return items.find(i => i.id === itemId);
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
  duplicateItem(itemId) {
    const item = this.getItem(itemId);
    if (!item) return null;

    // Get current position from canvas object if available
    let x = item.x + 20;
    let y = item.y + 20;
    let angle = item.angle || 0;

    if (item.canvasObject) {
      // Use Fabric's getCenterPoint() for accurate center even when rotated
      const center = item.canvasObject.getCenterPoint();
      x = center.x + 20;
      y = center.y + 20;
      angle = item.canvasObject.angle || 0;
    }

    // Create duplicate with offset (addItem expects center coordinates)
    const newItem = this.addItem(item.itemId, x, y);
    
    // Copy rotation
    if (newItem && newItem.canvasObject && angle !== 0) {
      newItem.canvasObject.rotate(angle);
      this.canvasManager.getCanvas().renderAll();
    }

    return newItem;
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
    items.forEach(item => this.removeItem(item.id));
  }

  /**
   * Get item library
   */
  getItemLibrary() {
    return Items.getAll();
  }

  /**
   * Get items by category
   */
  getItemsByCategory(category) {
    return Items.getByCategory(category);
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
