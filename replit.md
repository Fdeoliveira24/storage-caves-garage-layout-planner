# Garage Layout Planner

## Overview

A professional, browser-based garage and storage layout planning tool built entirely with vanilla HTML5, CSS3, and JavaScript ES6. The application allows users to select from pre-defined floor plans (ranging from 500-1200 sq ft), add and manipulate realistic items (vehicles, RVs, boats, storage units), and export layouts as JSON, PNG, or PDF. This is a premium product designed for Envato marketplace with enterprise-grade architecture and zero build dependencies - it runs by simply opening index.html in any modern browser.

## Recent Changes (Nov 10, 2025)

**Critical Bug Fixes (v2.9.0):**
- **BUG FIX: Empty State After Refresh** - Fixed empty state message appearing over items after page refresh
  - Root cause: loadAutosave() didn't hide empty state after loading items
  - Solution: Added hideEmptyState() call after items are restored
  - Test: Refresh page with saved layout - empty state no longer appears
- **BUG FIX: Inconsistent Boundary Constraints** - Fixed items escaping canvas bounds during multi-select
  - Root cause: constrainToFloorPlan() only handled single items with customData, not ActiveSelection objects
  - Design decision: Items should NOT be allowed outside floor plan (garage planner use case)
  - Solution: Enhanced constrainToFloorPlan() to handle both single items and multi-select
  - Single items: Uses customData dimensions with rotation-aware bounding box
  - Multi-select: Uses getBoundingRect() to constrain entire selection as a unit
  - Test: Multi-select drag now properly constrains all items within bounds

**Zoom Slider Implementation (v2.8.0):**
- **Slider-Based Zoom Control** - Replaced Zoom In/Out buttons with modern range slider
  - Range: 10% minimum, 200% maximum, 5% steps, default 100%
  - Live percentage display updates as slider moves
  - Slider styled with branded primary color and smooth hover/active transitions
- **Synchronized Zoom Limits** - All zoom pathways now respect 10-200% range:
  - Mouse wheel zoom clamped to slider range (was 10-2000%)
  - Zoom In/Out buttons limited to 10-200%
  - Slider value stays synchronized across all zoom operations
  - Fit to Screen respects same bounds
- **UI Synchronization** - Zoom percentage display updates across all controls:
  - Toolbar button shows current zoom percentage
  - Slider thumb position matches zoom level
  - Slider label displays current percentage in primary color
- **Branded Styling** - Slider matches project design system:
  - Primary color thumb with shadow and hover effects
  - Secondary background track
  - Smooth transitions and visual feedback

**UX Improvements - Entry Zone & Zoom (v2.6.0):**
- **Entry Zone Label Rotation** - "ENTRY ZONE" text now rotates 90° when positioned on left or right sides for better readability
- **Item Wall Collision Fix** - Items can now touch walls properly; boundary detection uses actual rectangle dimensions instead of bounding box with label text
- **Zoom Dropdown** - Replaced three separate zoom buttons with modern dropdown showing current zoom percentage (e.g., "100%")
  - Zoom In/Out buttons inside dropdown
  - "Fit to Screen" button (better icon than previous square corners)
  - Percentage updates in real-time for all zoom operations (wheel, buttons, fit-to-screen)
- **Zoom Event Synchronization** - All zoom pathways (mouse wheel, toolbar buttons, fit-to-screen, auto-fit) now emit zoom events to keep UI synchronized

**Enhanced Entry Zone Controls (v2.5.0):**
- **Entry Zone Border Toggle** - Show/hide the red dotted border around entry zone (visible by default)
- **4-Position Entry Zone** - Position entry zone on any side: top, bottom, left, or right (defaults to bottom)
  - Horizontal zones (top/bottom): 20% of height, full width
  - Vertical zones (left/right): 20% of width, full height
  - Entry zone label automatically repositions for each orientation
- **Entry Zone Label Toggle** - Show/hide "ENTRY ZONE" text label (visible by default)
- **Grid Z-Index Fix** - Grid now properly renders behind entry zone border and label as requested
- **Modern Item Labels** - Item labels now use clean sans-serif font (system-ui) instead of default serif
- **Export Compatibility** - All new settings (border visibility, position) included in JSON exports and rendered in PNG/PDF exports
- **Smart Defaults** - Legacy saved states default to: border visible, entry at bottom, label visible

**View Controls Dropdown (v2.4.0):**
- **Grid Toggle** - Show/hide grid overlay for alignment assistance (persists across sessions)
- **UI Synchronization** - View dropdown buttons always reflect current state on page load, preventing mismatched UI
- **Consistent Fallbacks** - All features use `!== false` check for robust undefined handling

**Modal Keyboard Fix (v2.3.3):**
- **Enter Key Handler** - Added Enter key support to confirm modals (was missing, causing Enter to bubble up and create duplicate overlays)
- **Event Bubbling Prevention** - Added preventDefault() and stopPropagation() to all modal keyboard events
- **Memory Leak Fix** - Properly cleanup keyboard event listeners when modals close
- **Consistent Behavior** - Both showConfirm and showPrompt now use unified document-level keyboard handling

**Empty State & UX Fixes (v2.3.2):**
- **Empty State Centering** - Fixed "Start Planning Your Space" positioning with 100ms setTimeout and auto-recentering on resize
- **Canvas Dimensions** - Added fallback 800x600 dimensions to prevent zero-sized container issues
- **Browser Alerts Removed** - Replaced browser alert() with Modal.showInfo() for consistent UX
- **Toast Position** - Moved toast notifications from top-right to bottom-right corner with reverse stacking

**Info Panel Repositioned (v2.3.1):**
- **Info Bar Below Canvas** - Moved info bar to appear below the canvas area (not below toolbar as initially implemented)
- **Canvas Clear Bug** - Fixed emptyStateGroup reference not being nulled in clear() method, preventing stale object issues

**Info Panel Redesign (v2.3.0):**
- **Inline Horizontal Layout** - Moved info panel from disruptive right sidebar to compact horizontal bar
- **Modern Format** - Shows data in single line: "Floor: 24' × 40' | Items: 3 | Selected: Pickup Truck | Size: 6.7' × 19.2' | Position: 3.0' from left, 7.0' from top"
- **Segment-Based Design** - Uses flex layout with labeled segments separated by vertical dividers for clean visual hierarchy
- **Responsive Wrapping** - Info bar wraps on narrow screens (≤768px) with proper spacing
- **Canvas Space** - Removed right sidebar to maximize canvas workspace, matching Figma/Canva aesthetics

**Bug Fixes (Earlier Today):**
- **Export Filenames** - PNG/PDF exports now use consistent format: "ProjectName_YYYY-MM-DD.png/pdf"
- **Load/Delete Buttons** - Fixed Saved Layouts tab Load/Delete functionality to properly restore layouts
- **Empty State Centering** - Empty state message now properly centers after using +New button
- **Zoom to Center** - Zoom In/Out now correctly zoom toward canvas center instead of drifting right

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
- **Saved Layouts Tab** - New "Saved" tab in sidebar displays all saved layouts with Load/Delete actions
- **Save/Load System** - Full save/load functionality for managing multiple named layouts in localStorage
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
- Header → Toolbar → Info Bar → Sidebar + Canvas container
- Info Bar displays floor plan, selection, and position data in single horizontal line
- Sidebar has tabbed interface (Floor Plans vs Items vs Saved)
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