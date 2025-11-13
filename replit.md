# Garage Layout Planner

## Overview
A browser-based garage and storage layout planning tool using vanilla HTML5, CSS3, and JavaScript ES6. Users can select floor plans, add and manipulate items (vehicles, RVs, boats, storage units), and export layouts as JSON, PNG, or PDF. This is a premium product designed for the Envato marketplace with enterprise-grade architecture and zero build dependencies.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture Pattern
The application uses a centralized state management pattern with an event bus for decoupled communication. It avoids global variables, using a single `window.app` instance.

**Key architectural decisions:**
- **Pure JavaScript (ES6)**: No frameworks, build tools, or TypeScript for portability and deployment simplicity.
- **Single Source of Truth**: The `State` class manages all application data as a serializable JSON structure with an observer pattern.
- **Event Bus Pattern**: Decouples features via publish/subscribe for module communication.
- **Manager-Based Architecture**: Domain logic is separated into specialized managers (e.g., CanvasManager, ItemManager, FloorPlanManager).

### Frontend Architecture

**Rendering:**
- **Fabric.js 5.3.0**: Used for all canvas rendering and manipulation, providing interactive objects, transformations, and selection. Loaded via CDN.
- Custom CSS3: Uses CSS variables for theming and a modular structure.

**Layout Structure:**
- Comprises a Header, Toolbar, Info Bar, Sidebar, and Canvas container.
- Info Bar displays floor plan, selection, and position data.
- Sidebar features a tabbed interface for Floor Plans, Items, and Saved layouts.
- Canvas wrapper includes overlay controls for magnification and measurements.

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
- Customizable entry zone (border toggle, 4-position, label toggle).
- Grid overlay toggle.
- Info panel redesigned to an inline horizontal layout.
- Consistent toast notifications and modal dialogs.
- **Mobile UI Overhaul**: Modern mobile-first UI for viewports ≤ 767px with bottom tab navigation, Floating Action Button (FAB), bottom sheet components, and optimized mobile pages for Floor Plans, Items, Canvas, and More. Includes touch optimization and GPU-accelerated animations.
- **Responsive Design**: Mobile/tablet responsiveness with breakpoints, touch-optimized UI, and landscape orientation support. Features include collapsible sidebars, full-screen drawer sidebars, and a bottom toolbar for mobile.
- **Entry Zone Warning System**: Visual warning badge for items blocking entry zones, with real-time detection and debounced checks.

### Data Storage Solutions

**LocalStorage:**
- Auto-saves every 30 seconds to `localStorage`.
- Supports saving/loading multiple layout projects.
- `Storage` utility handles quota errors.
- Fully client-side with no backend database.

**Data Format:**
- Floor plans are defined in `js/data/floorPlans.js` as static templates.
- Items are defined in `js/data/items.js` with realistic dimensions (in feet).
- All dimensions are stored in feet and converted to pixels at a 10px/foot ratio.
- Export format is pure JSON with metadata.

### Key Features Implementation

**Boundary Detection:**
- `Bounds` utility constrains items within the floor plan using Fabric.js bounding boxes.
- Entry zone (bottom 20%) is calculated and rendered as an overlay rectangle.

**Undo/Redo:**
- `HistoryManager` maintains up to 50 state snapshots using deep cloning.

**Multi-Select:**
- Fabric.js `ActiveSelection` is used for grouping.
- Supports Shift+click for multi-select and selection box drawing.

**Export Capabilities:**
- **JSON**: Serializes state with metadata.
- **PNG**: Exports at multiple resolutions (1x, 2x, 4x, 8x) using Fabric.js `toDataURL()`.
- **PDF**: Uses jsPDF for professional, print-ready (300 DPI) reports with smart paper selection, auto-orientation, margins, metadata, and an item list table.

## External Dependencies

**Third-Party Libraries (All loaded via CDN):**

1.  **Fabric.js 5.3.0**: Canvas rendering and interactive object manipulation.
2.  **Turf.js 6.x**: Advanced geometry operations.
3.  **jsPDF**: PDF generation.

**Browser APIs:**
- Canvas API (2D context)
- LocalStorage API
- File download (Blob + createObjectURL)
- Keyboard events
- Mouse events

**No Server Dependencies:**
- The application is fully static, requires no backend API calls or authentication, and works offline after initial load.