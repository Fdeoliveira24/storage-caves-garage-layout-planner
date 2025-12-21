# API Documentation

## Public API Reference

This document describes the public API for the Garage Layout Planner application.

## Global Objects

The application exposes the following global objects:

```javascript
window.app; // Main application instance
window.Config; // Configuration constants
window.State; // State class (not instance)
window.EventBus; // EventBus class (not instance)
```

## App Instance

Access via `window.app` after initialization.

### Properties

```javascript
app.state; // State instance
app.eventBus; // EventBus instance
app.canvasManager; // Canvas operations
app.floorPlanManager; // Floor plan operations
app.itemManager; // Item operations
app.selectionManager; // Selection operations
app.exportManager; // Export operations
app.historyManager; // Undo/redo operations
```

### Methods

```javascript
// Initialize application
await app.init();

// Get current state
const state = app.state.getState();

// Subscribe to state changes
app.state.subscribe((newState) => {
  console.log('State changed:', newState);
});

// Listen to events
app.eventBus.on('item:added', (item) => {
  console.log('Item added:', item);
});
```

## CanvasManager API

### Methods

```javascript
// Initialize canvas
canvasManager.init();

// Draw floor plan
canvasManager.drawFloorPlan(floorPlan);

// Add item to canvas
const { rect, label } = canvasManager.addItem(itemData, x, y);

// Remove item
canvasManager.removeItem(item);

// Zoom controls
canvasManager.zoomIn();
canvasManager.zoomOut();
canvasManager.resetZoom();

// Get canvas instance
const fabricCanvas = canvasManager.getCanvas();

// Export as data URL
const dataURL = canvasManager.toDataURL({
  multiplier: 2, // Resolution multiplier
  format: 'png', // Format
  quality: 1, // Quality (0-1)
});

// Clear canvas
canvasManager.clear();

// Resize canvas
canvasManager.resizeCanvas();
```

## FloorPlanManager API

### Methods

```javascript
// Set active floor plan
floorPlanManager.setFloorPlan('fp-24x30');

// Get current floor plan
const floorPlan = floorPlanManager.getCurrentFloorPlan();

// Get all floor plans
const allFloorPlans = floorPlanManager.getAllFloorPlans();

// Get area calculations
const totalArea = floorPlanManager.getArea(); // sq ft
const occupiedArea = floorPlanManager.getOccupiedArea(); // sq ft
const occupancy = floorPlanManager.getOccupancyPercentage(); // %

// Clear floor plan
floorPlanManager.clearFloorPlan();
```

## ItemManager API

### Methods

```javascript
// Add item
const item = itemManager.addItem('sedan', 100, 100);

// Remove item
itemManager.removeItem(itemId);

// Update item
itemManager.updateItem(itemId, { x: 150, y: 150 });

// Get item
const item = itemManager.getItem(itemId);

// Get all items
const items = itemManager.getAllItems();

// Duplicate item
const newItem = itemManager.duplicateItem(itemId);

// Lock/unlock item
itemManager.lockItem(itemId);
itemManager.unlockItem(itemId);

// Clear all items
itemManager.clearAll();

// Get item library
const library = itemManager.getItemLibrary();

// Get items by category
const vehicles = itemManager.getItemsByCategory('vehicles');

// Search items
const results = itemManager.searchItems('car');
```

## SelectionManager API

### Methods

```javascript
// Select single item
selectionManager.selectItem(item);

// Select multiple items
selectionManager.selectMultiple([item1, item2]);

// Select all
selectionManager.selectAll();

// Deselect all
selectionManager.deselectAll();

// Get selection
const selected = selectionManager.getSelection();

// Delete selected
selectionManager.deleteSelected();

// Duplicate selected
selectionManager.duplicateSelected();

// Rotate selected (degrees)
selectionManager.rotateSelected(90);

// Move selected (dx, dy in pixels)
selectionManager.moveSelected(10, 0);

// Align selected
selectionManager.alignSelected('left'); // left|right|center|top|bottom|middle

// Z-order
selectionManager.bringToFront();
selectionManager.sendToBack();
```

## ExportManager API

### Methods

```javascript
// Export as JSON
const jsonData = exportManager.exportJSON();

// Export as PNG
const dataURL = exportManager.exportPNG(2); // Resolution multiplier

// Export as PDF
await exportManager.exportPDF({
  orientation: 'landscape', // landscape|portrait
  format: 'letter', // letter|a4|legal|tabloid
});

// Generate thumbnail
const thumbnailURL = exportManager.generateThumbnail(200, 150);

// Calculate occupancy
const occupancyPercent = exportManager.calculateOccupancy();
```

## HistoryManager API

### Methods

```javascript
// Save current state
historyManager.save();

// Undo
const previousState = historyManager.undo();

// Redo
const nextState = historyManager.redo();

// Check availability
const canUndo = historyManager.canUndo();
const canRedo = historyManager.canRedo();

// Clear history
historyManager.clear();

// Get history info
const info = historyManager.getInfo();
// Returns: { total, currentIndex, canUndo, canRedo }
```

## EventBus API

### Event Names

```javascript
// Item events
'item:added'; // {item}
'item:removed'; // {itemId}
'item:updated'; // {item}
'item:selected'; // {item}
'item:moved'; // {items}
'item:rotated'; // {items}
'item:delete:requested'; // {itemId}
'item:duplicate:requested'; // {itemId}

// Floor plan events
'floorplan:changed'; // {floorPlan}
'floorplan:cleared'; // {}

// Selection events
'canvas:selection:created'; // {items}
'canvas:selection:updated'; // {items}
'canvas:selection:cleared'; // {}

// Canvas events
'canvas:zoomed'; // {zoom}
'canvas:object:moving'; // {item}
'canvas:object:modified'; // {item}

// History events
'history:undo'; // {state}
'history:redo'; // {state}
'history:changed'; // {canUndo, canRedo}

// Export events
'export:json:complete'; // {filename}
'export:png:complete'; // {filename, resolution}
'export:pdf:complete'; // {filename}

// Tool events
'tool:measure:activated'; // {}
'tool:measure:deactivated'; // {}
'tool:measure:complete'; // {distance, unit}

// State events
'state:changed'; // {state}
```

### Methods

```javascript
// Subscribe to event
eventBus.on('item:added', (data) => {
  console.log('Item added:', data);
});

// Unsubscribe from event
eventBus.off('item:added', callback);

// Subscribe once (auto-unsubscribe after first call)
eventBus.once('item:added', (data) => {
  console.log('First item added:', data);
});

// Emit event
eventBus.emit('custom:event', { data: 'value' });

// Clear all listeners
eventBus.clear();

// Get registered events
const events = eventBus.getEvents();
```

## State API

### Methods

```javascript
// Get complete state
const state = stateInstance.getState();

// Update state
stateInstance.setState({
  settings: {
    unit: 'meters',
  },
});

// Get specific property
const unit = stateInstance.get('settings.unit');

// Set specific property
stateInstance.set('settings.unit', 'feet');

// Subscribe to changes
const unsubscribe = stateInstance.subscribe((newState) => {
  console.log('State updated:', newState);
});

// Unsubscribe
unsubscribe();

// Reset state
stateInstance.reset();

// Load state
stateInstance.loadState(savedState);

// Serialize to JSON
const json = stateInstance.toJSON();
```

## Utility Functions

### Helpers

```javascript
// Unit conversion
const px = Helpers.feetToPx(10); // 100px (at 1ft=10px)
const ft = Helpers.pxToFeet(100); // 10ft
const m = Helpers.feetToMeters(10); // 3.048m
const ft2 = Helpers.metersToFeet(3.048); // 10ft

// Formatting
const num = Helpers.formatNumber(10.12345, 2); // 10.12

// ID generation
const id = Helpers.generateId('item'); // "item-1636123456789-abc123"

// Debounce/Throttle
const debouncedFn = Helpers.debounce(fn, 300);
const throttledFn = Helpers.throttle(fn, 100);

// Clone
const copy = Helpers.deepClone(object);

// Download
Helpers.downloadFile(data, 'filename.json', 'application/json');

// Distance/Angle
const dist = Helpers.distance(x1, y1, x2, y2);
const angle = Helpers.angleBetweenPoints(x1, y1, x2, y2);

// Clamp
const value = Helpers.clamp(num, 0, 100);
```

### Storage

```javascript
// Save to localStorage
Storage.save('key', { data: 'value' });

// Load from localStorage
const data = Storage.load('key');

// Remove
Storage.remove('key');

// Check existence
const exists = Storage.has('key');

// Clear all
Storage.clear();

// Get size
const size = Storage.getSize(); // bytes
```

### Bounds

```javascript
// Constrain to floor plan
Bounds.constrainToBounds(item, floorPlan);

// Check if within bounds
const isInside = Bounds.isWithinBounds(item, floorPlan);

// Check entry zone
const inEntryZone = Bounds.isInEntryZone(item, floorPlan);

// Snap to grid
Bounds.snapItemToGrid(item, 10);

// Check overlap
const overlaps = Bounds.itemsOverlap(item1, item2);

// Find nearby items for snapping
const nearby = Bounds.findNearbyItems(item, allItems, 5);
```

### Validation

```javascript
// Validate floor plan
const result = Validation.validateFloorPlan(floorPlan);
// Returns: { valid: boolean, errors: string[] }

// Validate item
const result = Validation.validateItem(item);

// Validate layout name
const result = Validation.validateLayoutName(name);

// Sanitize HTML
const safe = Validation.sanitizeHTML(userInput);

// Validate number in range
const valid = Validation.validateNumber(value, 0, 100);
```

## Configuration

### Constants

```javascript
Config.PX_PER_FOOT; // 10
Config.GRID_SIZE; // 10
Config.MAX_HISTORY; // 50
Config.AUTOSAVE_INTERVAL; // 30000
Config.ENTRY_ZONE_PERCENTAGE; // 0.2
Config.NUDGE_DISTANCE; // 2
Config.NUDGE_DISTANCE_LARGE; // 10
Config.MAGNIFIER_ZOOM; // 2.5
Config.MAGNIFIER_SIZE; // 150
Config.PDF_MARGINS; // 0.5

Config.COLORS = {
  floorPlan: '#f0f0f0',
  floorPlanStroke: '#333333',
  grid: '#e0e0e0',
  entryZone: 'rgba(255, 200, 0, 0.1)',
  selection: '#2196F3',
  alignmentGuide: '#FF5722',
  dimension: '#666666',
};

Config.STORAGE_KEYS = {
  layouts: 'garage-planner-layouts',
  settings: 'garage-planner-settings',
  autosave: 'garage-planner-autosave',
};
```

## Examples

### Complete Example

```javascript
// Wait for app to initialize
document.addEventListener('DOMContentLoaded', async () => {
  const app = window.app;

  // Set a floor plan
  app.floorPlanManager.setFloorPlan('fp-24x30');

  // Add some items
  app.itemManager.addItem('sedan', 100, 100);
  app.itemManager.addItem('suv', 200, 100);

  // Listen to item additions
  app.eventBus.on('item:added', (item) => {
    console.log('Added:', item.label);
  });

  // Export as JSON
  setTimeout(() => {
    app.exportManager.exportJSON();
  }, 2000);
});
```

---

**Version:** 1.0.0  
**Last Updated:** November 2025
