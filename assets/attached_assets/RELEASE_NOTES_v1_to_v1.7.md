# Garage Layout Planner Release Notes (v1 to v1.7)

Highlights
- Text tool (new): add text directly on the canvas and edit it with a properties panel (font, size, color, weight).
- Improved toolbar experience: clearer tool access and better usability while working on the canvas.
- Cleaner editing flow: more consistent selection, easier editing, and fewer accidental actions while placing or updating items.
- General stability and UI polish: small fixes and refinements across the app to make it feel smoother and more reliable.

New Features
- Client Management panel (new): search + CRUD, CSV/JSON import/export, and optional Google Sheets sync (feature-flag controlled).
- Text layer persistence: text items are now saved, exported, and imported with layouts.
- Local Fabric.js bundle with CDN fallback for more reliable loading.
- New UI modules: text properties panel, client CMS UI, and additional component styling.

UX and UI Improvements
- Reworked header and floating toolbar layout with clearer structure and updated controls.
- Added loading screen and updated branding/structure in the main layout.
- Modal improvements: focus trapping, ARIA attributes, and scroll locking for better accessibility.

Editing and Selection Improvements
- Selection logic prevents mixed measurement/text/item selections that cause accidental edits.
- Text objects now participate cleanly in delete, align, and rotate flows.
- Rotation and align operations refresh object bounds for more consistent manipulation.

Content and Library
- Item library reorganized/updated with new assets and category adjustments.
- New component stylesheets added for richer UI presentation.
