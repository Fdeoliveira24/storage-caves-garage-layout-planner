# Garage Layout Planner

## Overview

A professional, browser-based garage and storage layout planning tool built entirely with vanilla HTML5, CSS3, and JavaScript ES6. The application allows users to select from pre-defined floor plans, add and manipulate realistic items (vehicles, RVs, boats, storage units), and export layouts as JSON, PNG, or PDF. This is a premium product designed for Envato marketplace with enterprise-grade architecture and zero build dependencies.

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