# Garage Layout Planner

**Professional, Enterprise-Grade Garage & Storage Layout Planning Tool**

A browser-based garage layout planner built with pure HTML5, CSS3, and JavaScript ES6. No frameworks, no build tools - just open and use.

## Features

### Core Functionality

- **7 Pre-Defined Floor Plans** - From 20×25' to 24×50' (500-1200 sq ft)
- **20+ Realistic Items** - Vehicles, RVs, boats, storage with accurate dimensions
- **Drag & Drop Interface** - Intuitive item placement
- **Boundary Detection** - Items stay inside floor plan automatically
- **Entry Zone Warnings** - Bottom 20% marked for garage door clearance

### Item Manipulation

- **Selection Tools** - Single-click, multi-select (Shift+click), selection box
- **Transform Operations** - Move, rotate (90° or free), duplicate, delete
- **Alignment Tools** - Left, right, center, top, bottom, middle
- **Z-Order Control** - Bring to front, send to back
- **Lock/Unlock** - Prevent accidental movement

### Professional Tools

- **50-Level Undo/Redo** - Full history stack
- **Magnifying Glass** - 2.5x zoom for precision
- **Measurement Tool** - Click two points to measure distance
- **Dimensions Display** - Real-time size and position info
- **Area Calculations** - Total vs occupied space
- **Snap to Grid** - 1-foot increments

### Export & Save

- **JSON Export** - Complete layout data
- **PNG Export** - Multiple resolutions (1x, 2x, 4x, 8x)
- **PDF Export** - Professional reports with item list
- **Auto-Save** - Every 30 seconds to localStorage
- **Save/Load Layouts** - Manage multiple projects

### Keyboard Shortcuts

- **Arrow Keys** - Nudge items (2px, Shift = 10px)
- **Delete/Backspace** - Remove selected items
- **R** - Rotate 90°
- **Ctrl+D** - Duplicate
- **Ctrl+C/V** - Copy/Paste
- **Ctrl+Z/Y** - Undo/Redo
- **Ctrl+A** - Select all
- **Esc** - Deselect

## Installation

### Option 1: Direct Open

1. Download or clone this repository
2. Open `index.html` in your browser
3. Start planning!

### Option 2: Local Web Server

```bash
# Python 3
python3 -m http.server 5000

# Python 2
python -m SimpleHTTPServer 5000

# Node.js
npx http-server -p 5000
```

Then open `http://localhost:5000` in your browser.

## Usage Guide

### Getting Started

1. **Select a Floor Plan** - Click a floor plan from the left sidebar
2. **Add Items** - Switch to "Items" tab and click items to add them
3. **Arrange Layout** - Drag items, rotate, resize as needed
4. **Save** - Click the save button to store your layout

### Item Management

- **Add Item** - Click any item in the palette (added to center)
- **Move Item** - Click and drag or use arrow keys
- **Rotate Item** - Click rotate button or press R
- **Duplicate Item** - Select and press Ctrl+D
- **Delete Item** - Select and press Delete
- **Lock Item** - Prevent movement (coming soon)

### Alignment

- Select multiple items (Shift+click)
- Use alignment buttons to align edges or centers
- Items snap together for precise placement

### Export Options

- **JSON** - Save complete layout data for backup/sharing
- **PNG** - High-resolution images for presentations
- **PDF** - Professional reports with measurements

## Browser Support

- Chrome 90+ ✓
- Firefox 88+ ✓
- Safari 14+ ✓
- Edge 90+ ✓
- Modern mobile browsers (iOS 14+, Android)

## Technology Stack

- **Pure HTML5, CSS3, JavaScript ES6** - No frameworks
- **Fabric.js 5.3.0** - Canvas rendering
- **Turf.js 6.x** - Geometry operations
- **jsPDF** - PDF generation
- **html2canvas** - Canvas screenshots

## Architecture

### Modular Design

- **State Management** - Centralized state with observer pattern
- **Event Bus** - Decoupled module communication
- **Manager Classes** - Separation of concerns
  - CanvasManager - Fabric.js operations
  - FloorPlanManager - Floor plan CRUD
  - ItemManager - Item library and operations
  - SelectionManager - Selection and manipulation
  - ExportManager - JSON/PNG/PDF exports
  - HistoryManager - Undo/redo stack

### File Structure

```
├── index.html
├── css/
│   ├── reset.css
│   ├── variables.css
│   ├── layout.css
│   ├── components/
│   └── main.css
├── js/
│   ├── core/          # State, EventBus, Config, App
│   ├── managers/      # 6 manager classes
│   ├── features/      # Magnifier, Measurement, etc.
│   ├── ui/            # UI components
│   ├── utils/         # Helper functions
│   └── data/          # Floor plans, items, icons
├── assets/
└── docs/
```

## Scaling & Dimensions

- **1 foot = 10 pixels** (PX_PER_FOOT = 10)
- All items are **vertical by default** (length = height)

## Release Notes

- **v1.3** – Added the improved measurement tool workflow (desktop + mobile toggle, snapping, dimension overlays, grid/ruler helpers) for more precise planning.
- Realistic dimensions based on actual vehicles/items
- Automatic unit conversion (feet ↔ meters)

## Customization

### Adding Custom Items

Edit `js/data/items.js` to add new items:

```javascript
{
  id: 'custom-item',
  label: 'Custom Item',
  lengthFt: 10,
  widthFt: 5,
  color: '#FF5722',
  category: 'storage'
}
```

### Custom Floor Plans

Phase 2 will include custom floor plan drawing tool.

## License

MIT License - See LICENSE.txt for details

## Credits

Built as an enterprise-grade product for sale on Envato marketplace.

## Support

For issues or questions, please create an issue on GitHub or contact support.

## Roadmap

### Phase 1 (Current - MVP) ✓

- 7 rectangular floor plans
- 20+ items
- Complete manipulation tools
- Export (JSON, PNG, PDF)
- Undo/redo system
- Keyboard shortcuts

### Phase 2 (Advanced Features)

- Custom floor plan drawing
- L-shaped & T-shaped floor plans
- Doors, windows, obstacles
- Multiple rooms/zones
- Import floor plan images
- 30+ pre-made templates
- Collaboration features

### Phase 3 (Pro Features)

- 3D preview mode
- AI layout assistant
- Cost estimation
- Client management
- Proposal generation
- White-label branding

---

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Status:** Production Ready

## PixelSquid Asset Pipeline (Internal Tools)

To speed up adding new inventory from PixelSquid, the repo now includes a helper API and an Item Builder UI. These are **internal** utilities – the production planner remains a static site.

### 1. PixelSquid Backend (`tools/pixelsquid-backend`)

A lightweight Express server that talks to the PixelSquid REST API and saves renders directly into `assets/images/items/`.

```bash
cd tools/pixelsquid-backend
cp .env.example .env   # add your PixelSquid keys
npm install
npm run start          # or npm run dev
```

Available endpoints:

- `GET /ps/product/:id` – fetch product metadata
- `GET /ps/product/:id/spinner?spinnerId=...` – spinner + angle info
- `POST /ps/download` – downloads a PNG for a given product/angle and stores it under `assets/images/items/{palette|canvas}`. Returns the relative path plus a snippet stub for `items.js`.
- `GET /health` – simple health check

### 2. Item Builder UI (`tools/item-builder`)

A static page (no build step) that you open in the browser. It lets you:

1. Enter product/spinner IDs and inspect the API response.
2. Download palette + canvas renders with one click (the UI calls the backend above).
3. Enter final metadata (label, feet dimensions, category, tags) and get a ready-to-paste JSON snippet for `js/data/items.js`.

Usage:

1. Start the backend (`npm run start` as shown above).
2. Open `tools/item-builder/index.html` directly in your browser (or use a simple static server if you prefer).
3. Fill in the form:
   - Backend URL (defaults to `http://localhost:3001`).
   - Product ID, spinner/angle IDs, filename base.
   - Item metadata (label, size, category).
4. Click “Generate Snippet” and copy the JSON block into the desired category inside `js/data/items.js`.

With this flow you no longer need to manually screenshot PixelSquid spinners or hand-edit file paths – the automation takes care of downloading assets and generating the item definition.
