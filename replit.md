# Garage Layout Planner

## Overview

A professional, browser-based garage and storage layout planning tool built entirely with vanilla HTML5, CSS3, and JavaScript ES6. The application allows users to select from pre-defined floor plans, add and manipulate realistic items (vehicles, RVs, boats, storage units), and export layouts as JSON, PNG, or PDF. This is a premium product designed for Envato marketplace with enterprise-grade architecture and zero build dependencies.

## Recent Changes

### Nov 11, 2025 - Mobile/Tablet Responsiveness & Entry Zone Warnings (v2.12.0)

**FEATURE: Full Mobile/Tablet Responsive Design**
- **Mobile-First CSS Architecture** (css/responsive.css)
  - Breakpoints: 1024px (tablet landscape), 767px (tablet portrait), 480px (mobile)
  - Touch-optimized UI: 44px minimum touch targets, increased spacing, larger buttons
  - GPU acceleration for smooth animations (transform, backdrop-filter)
  - Accessibility: prefers-reduced-motion support for animation reduction
  - Landscape orientation support for tablets/phones

- **Tablet Landscape (1024px - 768px)**
  - Collapsible sidebar: 280px → 60px icon-only mode (auto-collapses, expands on hover)
  - Touch-friendly toolbar buttons (44px height)
  - Responsive canvas scaling
  - Maintained desktop-like experience with space optimization

- **Tablet Portrait (767px - 481px)**
  - Full-screen drawer sidebar with blur backdrop overlay
  - Hamburger menu button (#mobile-menu-toggle) in header
  - Sidebar close button (× icon top-right)
  - Auto-close sidebar when selecting floor plan/item
  - Stacked toolbar layout with wrapped buttons

- **Mobile (≤ 480px)**
  - Bottom toolbar (56px fixed height, safe-area-inset support)
    - Essential actions: Undo, Redo, Delete, More (vertical icon + label layout)
    - "More" menu: Export JSON/PNG/PDF, Duplicate, Rotate 90°, Reset Zoom
  - Full-screen drawer sidebar (slide-in from left, blur backdrop)
  - 2-column item grid (optimized for small screens)
  - Compact header (reduced padding, smaller logo)
  - Hidden less-critical UI elements (info bar minimal mode)

- **Touch Gesture Support** (setupTouchGestures)
  - Pinch zoom: 2-finger gesture with center-point tracking (10%-200% zoom range)
  - Pan/drag: Single-finger canvas panning when no object selected
  - Tap: Object selection and canvas interaction
  - Long-press: Context menu trigger
  - Passive event listeners for 60fps scroll performance
  - Compatible with Fabric.js touch events (touch:gesture, touch:drag, touch:longpress)

- **Mobile JavaScript (setupMobileFeatures)**
  - Viewport change detection: Show/hide mobile elements based on screen width
  - Sidebar toggle: Drawer animation with backdrop, prevents body scroll
  - Auto-close: Sidebar closes after selecting floor plan/item (300ms delay)
  - Mobile toolbar handlers: Wired to existing event bus (undo, redo, delete)
  - Resolution picker: PNG export dialog for mobile (1x/2x/4x/8x options)

**FEATURE: Entry Zone Warning System**
- **Visual Warning Badge** (toolbar)
  - Animated badge with pulsing effect when items block entry zone
  - Orange/amber color scheme matching warning semantics
  - Click to show details/fix violations
  - Badge visibility synced to state.ui.entryZoneViolation flag

- **Entry Zone Detection** (Bounds.isInEntryZone)
  - Supports all 4 entry zone positions: top, bottom, left, right
  - 20% threshold for entry zone depth
  - Uses Fabric.js bounding boxes for accurate collision detection
  - Handles rotated objects correctly

- **Real-time Violation Checking** (checkEntryZoneViolations)
  - Debounced checking (16ms interval) for drag performance
  - Comprehensive guards: null floor plan, missing itemManager, empty items array
  - Try/catch error handling to prevent silent failures
  - Wired to events: object:modified, item:added, item:removed, floorplan:changed, duplicate, paste
  - Safe no-op when preconditions not met (no floor plan loaded)

**FEATURE: Project Rename**
- **updateProjectName() helper**
  - Syncs DOM title element, document title, and state.metadata.projectName
  - Called from: init(), loadAutosave(), rename button click
  - Fixes autosave/reload race conditions
  - ExportManager uses projectName in JSON/PNG/PDF filenames (e.g., "My-Garage-Layout.json")

**Technical Improvements:**
- Fixed console errors in event handlers (floorplan:changed, item:added)
- Improved error logging (console.warn for non-critical issues)
- Performance: CSS will-change for animated elements, passive touch listeners
- Mobile toolbar conditionally shown via JavaScript (no CSS-only solutions)
- Hamburger menu icon using Material Design SVG paths

**Files Modified:**
- css/responsive.css (new file, 438 lines)
- css/main.css (added responsive.css import)
- index.html (mobile toolbar, hamburger, backdrop, close button)
- js/core/App.js (setupMobileFeatures, touch gestures, entry zone checks)
- js/utils/bounds.js (isInEntryZone for 4 positions)

**Testing Recommendations:**
- Tablet: Sidebar collapse/expand, touch targets (44px), drawer toggle
- Mobile: Bottom toolbar actions, gestures (pinch/pan), drawer UX
- Entry zone: Warnings across add/remove/duplicate/paste, all 4 positions
- Performance: 60fps animations on mid-range devices, scroll smoothness

### Nov 10, 2025 - Viewport & Zoom Management (v2.11.0)

**Major Viewport & Zoom Management Overhaul (v2.11.0):**
- **FIX: Canvas Initialization Timing** - Resolved 17% zoom bug and canvas shifting to bottom-right corner
  - Root cause: Fabric.js canvas started at 300×150px default size. When loadAutosave() ran centerAndFit(), zoom was calculated based on tiny canvas yielding ~17%, then resizeCanvas() fired 100ms later but zoom stayed incorrect
  - Solution: Made init() call resizeCanvas() synchronously BEFORE any viewport operations
  - Files: js/managers/CanvasManager.js
  - Test: Reload with saved layout → canvas centered at 100% zoom, no shift

- **FIX: Empty State Text Flickering** - Resolved text appearing on left then moving to center
  - Root cause: Empty state positioned relative to 300×150 default canvas, shifted when resize occurred
  - Solution: Synchronous resize ensures empty state uses correct dimensions immediately
  - Test: Fresh load → empty state centered with no flicker

- **FEATURE: Zoom Persistence** - Manual zoom levels now preserved across window resizes
  - User need: Users zoom in for precision work; window resize was resetting zoom to auto-fit
  - Implementation: Added isAutoFitMode flag to track manual vs auto-fit zoom state
    - centerAndFit() sets isAutoFitMode = true (floor plan selection, reset zoom)
    - Manual zoom methods (slider, mousewheel, buttons) set isAutoFitMode = false
    - resizeCanvas() only re-centers when isAutoFitMode === true
  - Behavior: Manual zoom preserved during resize; auto-fit maintained for floor plan changes
  - Files: js/managers/CanvasManager.js
  - Test: Zoom to 150% → resize window → zoom stays at 150%

- **FIX: +New Button Autosave** - Fixed old data reappearing after clicking +New
  - Root cause: +New cleared memory but not localStorage autosave
  - Solution: Added Storage.remove() to clear autosave when +New clicked
  - Files: js/core/App.js
  - Test: Click +New, confirm, refresh → stays blank

- **Technical Improvements:**
  - Store floor plan dimensions (floorPlanWidth/Height) for proper re-centering
  - loadAutosave() returns boolean to indicate success/failure
  - Enhanced console logging for autosave flow debugging

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern

The application follows a **centralized state management** pattern with an **event bus** for decoupled communication between modules. There are no global variables except the single `window.app` instance, ensuring clean separation of concerns.

**Key architectural decisions:**
- **Pure JavaScript (ES6)** - No frameworks, no build tools, no TypeScript. Chosen for maximum portability and zero deployment complexity.
- **Single Source of Truth** - The `State` class maintains all application data in a serializable JSON structure with an observer pattern for reactivity.
- **Event Bus Pattern** - Decouples features through publish/subscribe, allowing modules to communicate without direct dependencies.
- **Manager-Based Architecture** - Domain logic separated into specialized managers (CanvasManager, ItemManager, FloorPlanManager, etc.).

### Frontend Architecture

**Rendering:**
- **Fabric.js 5.3.0** handles all canvas rendering and manipulation. Chosen over native Canvas API for built-in support of interactive objects, transformations, and selection. Loaded via CDN.
- Custom CSS3 with CSS variables for theming and a modular CSS structure.

**Layout Structure:**
- Header → Toolbar → Info Bar → Sidebar + Canvas container.
- Info Bar displays floor plan, selection, and position data in a single horizontal line.
- Sidebar has a tabbed interface (Floor Plans vs Items vs Saved).
- Canvas wrapper with overlay controls (magnifier, measurement tools).

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

**UI/UX Decisions:**
- Modern range slider for zoom control (10%-200%).
- Entry zone label rotation for readability.
- Consolidated zoom options into a dropdown.
- Entry zone customization (border toggle, 4-position, label toggle).
- Grid overlay toggle.
- Info panel redesigned to an inline horizontal layout below the canvas.
- Consistent toast notifications and modal dialogs replacing browser alerts.

### Data Storage Solutions

**LocalStorage:**
- Auto-save every 30 seconds to `localStorage`.
- Save/load multiple layout projects.
- Wrapped in `Storage` utility with quota error handling.
- No backend database - fully client-side.

**Data Format:**
- Floor plans defined in `js/data/floorPlans.js` as static templates.
- 20+ items defined in `js/data/items.js` with realistic dimensions (in feet).
- All dimensions stored in feet, converted to pixels at 10px/foot ratio.
- Export format is pure JSON with metadata.

### Key Features Implementation

**Boundary Detection:**
- `Bounds` utility constrains items within floor plan using Fabric.js bounding boxes.
- Entry zone (bottom 20%) calculated and rendered as overlay rectangle.

**Undo/Redo:**
- `HistoryManager` maintains state snapshots (max 50) with deep cloning.

**Multi-Select:**
- Fabric.js built-in `ActiveSelection` for grouping.
- Shift+click for multi-select and selection box drawing.

**Export Capabilities:**
- JSON: Serialized state with metadata.
- PNG: Multiple resolutions (1x, 2x, 4x, 8x) using Fabric.js `toDataURL()`.
- PDF: Uses jsPDF library for professional, print-ready (300 DPI) reports with smart paper selection, auto-orientation, margins, and metadata. Includes item list table.

## External Dependencies

**Third-Party Libraries (All loaded via CDN):**

1.  **Fabric.js 5.3.0**: Canvas rendering and interactive object manipulation.
2.  **Turf.js 6.x**: Advanced geometry operations (e.g., point-in-polygon detection, area calculations).
3.  **jsPDF**: PDF generation for creating professional reports.
4.  **html2canvas**: Canvas-to-image conversion for high-resolution PNG exports.

**Browser APIs:**
- Canvas API (2D context)
- LocalStorage API
- File download (Blob + createObjectURL)
- Keyboard events
- Mouse events

**No Server Dependencies:**
- The application is fully static, requires no backend API calls or authentication, and works offline after the initial load.