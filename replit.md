# Garage Layout Planner

## Overview

A professional, browser-based garage and storage layout planning tool built entirely with vanilla HTML5, CSS3, and JavaScript ES6. The application allows users to select from pre-defined floor plans (ranging from 500-1200 sq ft), add and manipulate realistic items (vehicles, RVs, boats, storage units), and export layouts as JSON, PNG, or PDF. This is a premium product designed for Envato marketplace with enterprise-grade architecture and zero build dependencies - it runs by simply opening index.html in any modern browser.

## Recent Changes (Nov 10, 2025)

**PDF Export - Print-Ready (300 DPI):**
- **Professional Output** - Generates print-ready PDFs with 300 DPI resolution (3x multiplier)
- **Smart Paper Selection** - Auto-selects paper size based on floor plan physical dimensions:
  - Garages ≥40ft → Tabloid (11" × 17")
  - Garages ≥30ft → Legal (8.5" × 14")
  - Garages <30ft → Letter (8.5" × 11")
- **Auto Orientation** - Detects landscape vs portrait based on canvas aspect ratio
- **Full jsPDF Compatibility** - Supports ALL jsPDF format/orientation options (strings, arrays, shorthands)
- **Proper Margins** - 0.5 inch (12.7mm) margins on all sides
- **Future-Ready Structure** - 25mm header area reserved for logo/branding customization
- **Metadata** - Includes title, subject, author, keywords for professional output
- **Validation** - Guards against zero canvas dimensions, invalid scales, and negative content areas

**UI Improvements:**
- **New Button** - Added "+ New" button to toolbar for starting fresh layouts with confirmation
- **Export Debugging** - PNG/PDF exports include console logging and validation checks
- **Empty State** - Prominent canvas center message when no floor plan selected
- **Z-Index Fixes** - Dropdown menus properly appear above canvas
- **Tooltips Removed** - All tooltips completely removed as requested

**Previous Fixes (Nov 9, 2025):**
- Undo/Redo properly restores items
- Item text labels move with items during drag/rotate
- Autosave loading works correctly
- Boundary constraints prevent dragging items outside floor plan
- Modal/Toast UI replaced browser alerts

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern

The application follows a **centralized state management** pattern with an **event bus** for decoupled communication between modules. There are no global variables except the single `window.app` instance, ensuring clean separation of concerns.

**Key architectural decisions:**
- **Pure JavaScript (ES6)** - No frameworks, no build tools, no TypeScript. Chosen for maximum portability and zero deployment complexity. Trade-off: More verbose code, manual DOM manipulation.
- **Single Source of Truth** - The `State` class maintains all application data in a serializable JSON structure with an observer pattern for reactivity
- **Event Bus Pattern** - Decouples features through publish/subscribe, allowing modules to communicate without direct dependencies
- **Manager-Based Architecture** - Domain logic separated into specialized managers (CanvasManager, ItemManager, FloorPlanManager, etc.)

### Frontend Architecture

**Rendering:**
- **Fabric.js 5.3.0** handles all canvas rendering and manipulation. Chosen over native Canvas API for built-in support of interactive objects, transformations, and selection. Loaded via CDN.
- Custom CSS3 with CSS variables for theming
- Modular CSS structure (`main.css` imports component styles)

**Layout Structure:**
- Header → Toolbar → Sidebar + Canvas container
- Sidebar has tabbed interface (Floor Plans vs Items)
- Canvas wrapper with overlay controls (magnifier, measurement tools)

**State Management:**
```javascript
State = {
  floorPlan: null,          // Current active floor plan
  items: [],                // All placed items
  selection: null,          // Currently selected items
  history: [],              // Undo/redo stack (50 levels)
  settings: {},             // User preferences
  ui: {},                   // UI state
  metadata: {}              // Project metadata
}
```

**Component Communication:**
- Managers subscribe to EventBus events (`item:added`, `floorplan:changed`, etc.)
- UI updates triggered by state changes through observer pattern
- No direct component-to-component calls

### Data Storage Solutions

**LocalStorage:**
- Auto-save every 30 seconds to `localStorage`
- Save/load multiple layout projects
- Wrapped in `Storage` utility with quota error handling
- No backend database - fully client-side

**Data Format:**
- Floor plans defined in `js/data/floorPlans.js` as static templates
- 20+ items defined in `js/data/items.js` with realistic dimensions (in feet)
- All dimensions stored in feet, converted to pixels at 10px/foot ratio
- Export format is pure JSON with metadata

### Key Features Implementation

**Boundary Detection:**
- `Bounds` utility constrains items within floor plan using Fabric.js bounding boxes
- Entry zone (bottom 20%) calculated and rendered as overlay rectangle

**Undo/Redo:**
- `HistoryManager` maintains state snapshots (max 50)
- Deep clones state to prevent mutation issues
- Can disable during restore to prevent recursive saves

**Multi-Select:**
- Fabric.js built-in `ActiveSelection` for grouping
- Shift+click for multi-select
- Selection box drawing supported

**Alignment & Distribution:**
- Custom alignment algorithms in `SelectionManager`
- Uses Fabric.js object coordinates for left/right/top/bottom alignment

**Export Capabilities:**
- JSON: Serialized state with metadata
- PNG: Multiple resolutions (1x, 2x, 4x, 8x) using Fabric.js `toDataURL()`
- PDF: Uses jsPDF library with item list table

## External Dependencies

**Third-Party Libraries (All loaded via CDN):**

1. **Fabric.js 5.3.0** - Canvas rendering and interactive object manipulation
   - Handles all drawing, transformations, selections
   - Provides built-in event system for mouse/touch interactions

2. **Turf.js 6.x** - Advanced geometry operations
   - Used in `Geometry` utility for polygon calculations
   - Point-in-polygon detection, area calculations, distance measurements
   - Has fallback implementations if CDN fails

3. **jsPDF** - PDF generation
   - Creates professional PDF reports with floor plan image and item list
   - Used only in `ExportManager`

4. **html2canvas** - Canvas-to-image conversion
   - Captures canvas as PNG for high-resolution exports
   - Alternative to Fabric.js native export for better quality

**Browser APIs:**
- Canvas API (2D context)
- LocalStorage API
- File download (Blob + createObjectURL)
- Keyboard events for shortcuts
- Mouse events for drag-and-drop

**No Server Dependencies:**
- No backend API calls
- No authentication system
- Fully static - can be hosted on any CDN or web server
- Works offline after initial load