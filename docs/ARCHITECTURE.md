# Architecture Documentation

## System Overview

The Garage Layout Planner is built with a modular, scalable architecture using pure JavaScript with no frameworks. It follows enterprise-grade design patterns including State Management, Event Bus, and Manager pattern.

## Core Principles

1. **No Global Variables** - Only the `app` instance is global
2. **Single Source of Truth** - Centralized State management
3. **Decoupled Communication** - Event Bus pattern
4. **Separation of Concerns** - Manager classes for each domain
5. **Serializable State** - Can convert to/from JSON
6. **Modular Design** - Each file is self-contained

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│           User Interface Layer           │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐│
│  │Toolbar  │  │Sidebar  │  │InfoPanel ││
│  └─────────┘  └─────────┘  └──────────┘│
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│          Application Controller          │
│           (App.js - Main)                │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌───────┐            ┌─────────────┐
│State  │◄───────────┤  EventBus   │
└───┬───┘            └──────┬──────┘
    │                       │
    │    ┌──────────────────┴──────────────┐
    ▼    ▼                  ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│CanvasManager │  │FloorPlanMgr  │  │  ItemManager │
└──────────────┘  └──────────────┘  └──────────────┘
    ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│SelectionMgr  │  │ ExportManager│  │HistoryMgr    │
└──────────────┘  └──────────────┘  └──────────────┘
    │                  │                  │
    └──────────────────┴──────────────────┘
                       ▼
                ┌─────────────┐
                │  Fabric.js  │
                │  Canvas API │
                └─────────────┘
```

**Not pictured above (added after this diagram was first drawn, see
`docs/FEATURES.md` for what each does):**

- `TextManager` + `TextPropertiesPanel` — text/annotation tool, sits
  alongside SelectionMgr/HistoryMgr at the same level
- `GoogleSheetsSync` — syncs `ClientCMS` data to/from Google Sheets
- `ClientCMS` (`js/features/`) — the lead/client CRM slide-in panel; reads
  and writes saved layouts independently of the State/EventBus flow above
- `MobileUIManager` (`js/ui/mobile/`) — an entirely separate UI Layer that
  takes over below 768px, with its own rendering for Floor Plans/Items/Saved
  rather than reusing the desktop Sidebar
- `ShortcutRegistry` (`js/data/shortcuts.js`) — the shared source for keyboard
  event matching and the platform-aware keyboard/gesture reference modal

## Core Modules

### 1. State Management (State.js)

**Purpose:** Single source of truth for all application data

**Responsibilities:**

- Store complete application state
- Implement observer pattern
- Provide getters/setters
- Serialize/deserialize state
- Track state changes

**Key Methods:**

```javascript
setState(updates); // Update state and notify observers
getState(); // Get complete state (read-only)
subscribe(callback); // Subscribe to state changes
get(path); // Get specific property
set(path, value); // Set specific property
```

**State Structure:**

```javascript
{
  floorPlan: {
    kind: 'unit-combo',
    id,
    widthFt,
    heightFt,
    area,
    units: [{ instanceId, templateId, widthFt, heightFt, offsetXFt, offsetYFt }]
  },
  layout: {
    items: [{ id, label, x, y, angle, floorPlanUnitId, ... }],
    unitPositions: { [instanceId]: { left, top } }
  },
  selection: [...],
  history: [...],
  settings: { unit, showGrid, snapToGrid, ... },
  ui: { sidebarOpen, activeTab, ... },
  metadata: { projectName, clientName, created, modified }
}
```

### 2. Event Bus (EventBus.js)

**Purpose:** Decoupled inter-module communication

**Responsibilities:**

- Publish/subscribe event system
- Type-safe event handling
- Error isolation

**Key Events:**

- `item:added`, `item:removed`, `item:selected`, `item:moved`
- `floorplan:changed`, `floorplan:moved`, `floorplan:custom:start`
- `export:json`, `export:png`, `export:pdf`
- `history:undo`, `history:redo`, `history:changed`
- `canvas:zoomed`, `canvas:object:moving`

**Usage:**

```javascript
// Subscribe
eventBus.on('item:added', (item) => { ... });

// Emit
eventBus.emit('item:added', itemData);

// Unsubscribe
eventBus.off('item:added', callback);
```

### 3. Configuration (Config.js)

**Purpose:** Central configuration constants

**Key Constants:**

- `PX_PER_FOOT: 10` - Scaling factor
- `MAX_HISTORY: 50` - History stack size
- `AUTOSAVE_INTERVAL: 30000` - Auto-save frequency
- `ENTRY_ZONE_PERCENTAGE: 0.2` - Entry zone size
- `COLORS` - Color scheme
- `STORAGE_KEYS` - localStorage keys

## Manager Classes

### CanvasManager

**Responsibilities:**

- Initialize Fabric.js canvas
- Handle zoom/pan
- Draw independently movable floor-plan units and snap nearby edges
- Add/remove items from canvas
- Grid rendering
- Export canvas as image

**Key Methods:**

```javascript
init(); // Initialize canvas
drawFloorPlan(floorPlan); // Draw floor plan
addItem(itemData, x, y); // Add item to canvas
zoomIn() / zoomOut(); // Zoom controls
toDataURL(options); // Export as image
```

### FloorPlanManager

**Responsibilities:**

- Floor plan CRUD operations
- Validation
- Area calculations
- Occupancy tracking

**Key Methods:**

```javascript
setFloorPlan(id); // Set active floor plan
addFloorPlan(id); // Add an independently movable unit (max Config.MAX_FLOOR_PLAN_UNITS, currently 10)
removeFloorPlan(instanceId); // Remove one unit instance
removeFloorPlans(instanceIds); // Remove multiple selected instances atomically
reorderFloorPlan(instanceId, targetIndex); // Change initial/default unit order
getUnits(); // Get normalized unit instances
getAllFloorPlans(); // Get all templates
getArea(); // Get total area
getSpan(); // Get the current arrangement's bounding span
getOccupiedArea(); // Get occupied area
getOccupancyPercentage(); // Calculate occupancy
```

### ItemManager

**Responsibilities:**

- Item library access
- Add/remove/update items
- Duplicate/lock/unlock
- Search/filter

**Key Methods:**

```javascript
addItem(itemId, x, y); // Add item
removeItem(itemId); // Remove item
updateItem(itemId, data); // Update item
duplicateItem(itemId); // Duplicate item
lockItem() / unlockItem(); // Lock controls
```

### SelectionManager

**Responsibilities:**

- Single/multi-select
- Alignment tools
- Transform operations (move, rotate, scale)
- Grouping
- Z-order control

**Key Methods:**

```javascript
selectItem(item); // Select single
selectMultiple(items); // Multi-select
selectAll(); // Select all
alignSelected(alignment); // Align items
rotateSelected(angle); // Rotate items
bringToFront() / sendToBack(); // Z-order
```

### ExportManager

**Responsibilities:**

- JSON export
- PNG export (multiple resolutions)
- PDF generation
- Thumbnail generation

**Key Methods:**

```javascript
exportJSON(); // Export as JSON
exportPNG(resolution); // Export as PNG
exportPDF(options); // Generate PDF
generateThumbnail(); // Create thumbnail
```

### HistoryManager

**Responsibilities:**

- Undo/redo stack
- State snapshots
- History navigation

**Key Methods:**

```javascript
save(); // Save current state
undo(); // Undo last change
redo(); // Redo last undo
canUndo() / canRedo(); // Check availability
clear(); // Clear history
```

## Utility Modules

### Helpers (helpers.js)

- Unit conversion (feet ↔ pixels, feet ↔ meters)
- Number formatting
- ID generation
- Debounce/throttle
- Distance/angle calculations

### Storage (storage.js)

- localStorage wrapper
- Error handling
- Quota management
- Size tracking

### Bounds (bounds.js)

- Boundary detection
- Constraint enforcement
- Snap to grid
- Collision detection
- Proximity detection

### Geometry (geometry.js)

- Turf.js integration
- Polygon operations
- Area calculations
- Point-in-polygon tests
- Distance calculations

### Validation (validation.js)

- Floor plan validation
- Item validation
- Input sanitization
- Export validation

## Data Flow

### Adding an Item

```
User clicks item in palette
    ↓
ItemManager.addItem()
    ↓
Create item data
    ↓
CanvasManager.addItem() → Fabric.js
    ↓
Update State (items array)
    ↓
EventBus.emit('item:added')
    ↓
HistoryManager.save()
    ↓
InfoPanel updates (via State observer)
```

### Undo Operation

```
User presses Ctrl+Z
    ↓
HistoryManager.undo()
    ↓
Get previous state snapshot
    ↓
State.loadState(previousState)
    ↓
State notifies observers
    ↓
Canvas refreshes
Info panel updates
```

## Extension Points

### Adding New Features

1. **New Manager**
   - Create in `js/managers/`
   - Inject State and EventBus
   - Initialize in App.js

2. **New Tool**
   - Create in `js/features/`
   - Listen to EventBus events
   - Emit results

3. **New Item Type**
   - Add to `js/data/items.js`
   - Extend ItemManager if needed

4. **New Export Format**
   - Add method to ExportManager
   - Add UI button
   - Connect to EventBus

## Performance Considerations

### Optimizations

- Debounce mouse move events (16ms)
- Throttle canvas re-renders
- Lazy load templates
- Cache calculated values
- Minimize DOM manipulation
- Use requestAnimationFrame for animations

### Memory Management

- Limit history to 50 states
- Clear unused canvas objects
- Remove event listeners on destroy
- Compress saved states

## Security

### Best Practices

- Sanitize all user input
- Validate all data before processing
- No eval() or Function() usage
- Content Security Policy compatible
- No inline scripts (except initialization)

## Testing Strategy

### Unit Tests (Future)

- State management logic
- Geometry calculations
- Validation functions
- Utility functions

### Integration Tests (Future)

- Manager interactions
- Event flow
- State updates

### E2E Tests (Future)

- User workflows
- Export functionality
- Save/load operations

## Browser Compatibility

### Target Browsers

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### No IE11 Support

- Uses ES6 features freely
- Modern Canvas API
- CSS Grid/Flexbox

## Deployment

### Static Hosting

- The planner itself can be hosted on any static server - no backend
  required for core functionality
- CDN-friendly
- Two optional pieces do involve a backend, but neither is required to run
  the planner: the CRM's Google Sheets sync (calls an external Apps Script
  web app) and the internal `tools/item-builder` + `tools/pixelsquid-backend`
  (a small Express server, dev-only, never loaded by `index.html`)

### Recommended Hosts

- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Firebase Hosting

---

**Version:** see `docs/FEATURES.md` → Known Issues (page title and
`package.json` currently disagree)
**Last Updated:** June 2026
