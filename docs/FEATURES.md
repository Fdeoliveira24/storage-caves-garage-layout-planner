# Features Documentation

What the Garage Layout Planner ("Storage Caves" build) actually does today.
This replaces the previous version of this doc, which described a much
earlier "Phase 1 MVP" (Nov 2025, 64 features, 1.0.0) that no longer matches
the shipped product — the app has grown well beyond that since, and this
doc had not been kept in sync.

**Last verified against source:** June 2026.

## Floor Plans

7 pre-defined floor plans, modeled on real storage-unit dimensions rather
than generic garage sizes (`js/core/Config.js → FLOOR_PLANS`):

| Plan | Size | Area | Door |
|---|---|---|---|
| Units A | 22' × 55' | 1,210 sq ft | 14' × 14' |
| Units B | 15' × 55' | 825 sq ft | 13' × 14' |
| Units C | 15' × 55' | 825 sq ft | 13' × 14' |
| Units D | 15' × 50' | 750 sq ft | 13' × 14' |
| Units E | 14' × 35' | 490 sq ft | 12' × 12' |
| Units F | 18' × 50' | 900 sq ft | 14' × 14' |
| Units H | 15' × 50' | 750 sq ft | 13' × 14' |

## Item Catalog

**108 items across 10 categories** (`js/data/items.js`), each with a
real-world footprint in feet and a top-down canvas image:

- Vehicles — 20 items (cars, trucks, motorcycles, trailers, a semi cabin, a food truck)
- Recreational — 13 items (boats, RVs, ATVs, golf carts, snowmobiles)
- Workshop & Tools — 7 items (air compressor, CNC machine, welding machine, scissor lift, etc.)
- Garage Equipment — 12 items (car lift, jacks, cabinets, pegboard, garage door)
- Furniture & Living — 16 items (sofas, tables, chairs, appliances)
- Fitness & Sports — 10 items (treadmill, dumbbell rack, punching bag, climbing gear)
- Storage & Organization — 16 items (shelving, tool chests, bike racks, boxes)
- Entertainment — 5 items (pool table, foosball, arcade game, gas grill, hot dog cart)
- Mezzanine Options — 5 sizes (no image — rendered as a flat tiled overlay)
- 2D Shapes — 4 generic shapes (square, circle, rectangle, triangle) for custom drawing

Search and filtering: a search box and a category-filter dropdown live
directly in the Items panel (not shared with Floor Plans/Saved). Typing or
filtering hides whole category headers when nothing in them matches,
instead of leaving empty unclickable headers visible.

**Image quality note:** as of this writing, 94 of 108 item images are
correctly cropped/oriented/sized; 14 still need replacement source art
because their renders don't represent a usable top-down silhouette in any
orientation. See `docs/IMAGE-PIPELINE.md` for the exact list, the standard
new images must follow, and the script (`tools/asset-pipeline/trim_resize_canvas_images.py`)
that crops/resizes/rotates new art automatically.

## Item Manipulation

- Click to add an item from the palette; drag to reposition
- Single-click and Shift+click multi-select; drag a selection box
- Selecting an item on canvas highlights its matching card in the Items
  panel (brand red outline) so it's clear which catalog item is selected
- Rotate (90° button, `R` key, or free rotate via the corner handle)
- Duplicate (`Ctrl+D`), copy/paste (`Ctrl+C`/`Ctrl+V`), delete (`Delete`/`Backspace`)
- Z-order control (bring to front / send to back)
- Lock/unlock individual items
- Align selected items (left/right/top/bottom edges, horizontal/vertical center)
- Snap-to-grid (1 ft increments) and floor-plan boundary detection
- Entry-zone warning overlay (configurable position/border/label), with
  real-time detection of items blocking it

## Keyboard Shortcuts

Arrow keys (nudge 2px, Shift for 10px) · `Delete`/`Backspace` · `R` (rotate)
· `Ctrl+D` (duplicate) · `Ctrl+C`/`Ctrl+V` (copy/paste) · `Ctrl+Z`/`Ctrl+Y`
(undo/redo) · `Ctrl+A` (select all) · `Esc` (deselect)

## Measurement & Visual Tools

- Magnifying glass (2.5x zoom, adjustable, follows cursor)
- Click-two-points measurement tool with a persistent distance line
- Grid toggle and ruler overlay
- Unit toggle (feet/meters)
- Real-time area calculation (total vs. occupied space, occupancy %)
- Canvas zoom (10%–200%, mouse wheel or slider) and pan
- Show/hide all item labels

## Text & Annotation

A full typography tool (`js/managers/TextManager.js` +
`js/ui/TextPropertiesPanel.js`), not just a basic label: font family, size,
weight, style, underline/strikethrough, line height, letter spacing, and
color, with a draggable floating properties panel. Labels stay upright
regardless of item rotation.

## Undo/Redo

50-level history stack with state snapshots (`HistoryManager`), `Ctrl+Z`/`Ctrl+Y`.

## Save / Load / Export

- Save/load named layouts to `localStorage`, with auto-save every 30 seconds
- Export layout as JSON, PNG (1x/2x/4x/8x), or a formatted PDF report
  (item list table, project metadata, 300 DPI)
- Import a previously exported JSON layout

## Client & Lead Management (CRM)

A full lead-management panel (`js/features/ClientCMS.js`), separate from
the planning tool itself — this is a sales tool for Storage Caves, not a
generic Envato template:

- Add/edit/delete leads with contact info, unit preference, notes, and a
  follow-up date (date picker)
- Assign a lead to one or more saved layouts, and jump back to a lead's
  layout from their record
- Search/filter the lead list
- Import/export leads as CSV or JSON
- Optional bidirectional Google Sheets sync (`js/managers/GoogleSheetsSync.js`):
  manual sync or auto-sync every 2 minutes, pointed at a configured Apps
  Script web app URL. Disabled by default (`Config.FEATURES.enableGoogleSheetsSync`).

## Mobile Experience

Below 768px, a dedicated mobile UI takes over (`js/ui/mobile/MobileUIManager.js`)
— not just responsive CSS on the desktop layout. It has its own bottom tab
bar, a floating action button for canvas tools, bottom-sheet panels for
Floor Plans/Items/Saved, and touch-optimized gestures.

## Internal Tooling (not part of the customer-facing app)

Two developer-only tools live in `tools/`, never loaded by `index.html`:

- `tools/item-builder/` — a small page for pulling 3D renders via the
  PixelSquid API and generating the palette/canvas image pair plus an
  `items.js` snippet for a new catalog item.
- `tools/pixelsquid-backend/` — an Express server that proxies PixelSquid
  API requests (auth keys live in a local `.env`, not committed) for the
  item-builder page above.
- `tools/asset-pipeline/trim_resize_canvas_images.py` — the image
  crop/resize/rotate script referenced above; safe to re-run any time.

## Technical Architecture

- Centralized `State` with an observer pattern; `EventBus` for decoupled
  module communication
- Manager classes: `CanvasManager`, `FloorPlanManager`, `ItemManager`,
  `SelectionManager`, `ExportManager`, `HistoryManager`, `TextManager`,
  `GoogleSheetsSync` — plus `MobileUIManager` and `ClientCMS` for the
  mobile UI and CRM panel respectively (see `docs/ARCHITECTURE.md`)
- No build step: pure HTML5/CSS3/ES6, Fabric.js 5.3.0 for canvas rendering,
  Turf.js for geometry, jsPDF + html2canvas for exports
- Cache-busted asset loading: every script/stylesheet `<link>`/`<script>`
  tag carries a `?v=` query string, and item images use
  `Config.ASSET_VERSION` via `Helpers.withCacheBust()` — bump these after
  editing the relevant file so browsers (and dev servers like Live Server)
  don't keep serving a stale cached copy
- `index.html` is served with `Cache-Control: no-cache` meta tags so the
  document itself doesn't get stuck in a browser's HTTP cache either

## Known Issues / Housekeeping

- **Version number is inconsistent.** The page `<title>` says "1.8",
  `package.json` says "1.4.0". Pick one and reconcile — neither has been
  treated as the source of truth.
- **14 item images need new source art** (see Item Catalog above).
- `js/data/items-backup.js` is now redundant (its content was copied into
  the live `js/data/items.js` and reorganized into the 10 categories
  above) — safe to delete once you've confirmed you don't need the old
  5-category version for reference.

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+, and modern mobile browsers
(touch events, pointer events, Canvas API, CSS Grid/Flexbox, localStorage).
No IE11 support — the app uses ES6+ freely.
