# Canvas Item Image Pipeline

How top-down item images must be prepared so they render at a realistic scale
on the planner canvas, and what to do when they don't.

## Background: what went wrong (June 2026)

Items were rendering smaller than their declared real-world size and
sitting off-center inside their bounding box. Root cause, confirmed by
measuring all 101 source PNGs against `assets/images/items/master-Items-top-measurements.csv`:

1. **Source images weren't cropped.** Every canvas PNG was a raw export
   (mostly 600x600 squares) with transparent padding around the actual
   object — on average 35% padding on width, 23% on height.
2. **The renderer compounded it.** `CanvasManager._swapGroupImage()` scaled
   images with `Math.min(scaleX, scaleY)` ("contain") anchored to the
   top-left corner. For any non-square item (literally every car, RV, boat),
   the image filled the box on only one axis and was pinned in a corner,
   leaving a visible gap.
3. Two items had a literal `"..."` (Excel-truncated filename) baked into
   their `canvasImage` path in `items-backup.js`, so those silently 404'd.

Fixes applied:
- `tools/asset-pipeline/trim_resize_canvas_images.py` alpha-trims every
  canvas PNG to its real silhouette, then resizes it to the exact pixel
  footprint from the CSV (`widthFt`/`lengthFt` x `Config.PX_PER_FOOT`).
- `CanvasManager._swapGroupImage()` now anchors the image at the group's
  center (origin `center`/`center`) instead of the top-left corner, so any
  remaining mismatch is split evenly instead of dumped into one corner.
- The two truncated filenames in `items-backup.js` were corrected.
- `Config.ASSET_VERSION` + `Helpers.withCacheBust()` were added and wired
  into every place an item image is loaded (`CanvasManager`, `App.js`,
  `MobileUIManager.js`). Overwriting a PNG in place at the same URL doesn't
  get picked up by a browser (or Live Server) until the URL changes — bump
  `ASSET_VERSION` after touching any image so this stops causing "did my fix
  even apply?" confusion.

**A second pass found that most of the remaining problem images weren't
wrong content — they were rotated 90 degrees.** This catalog's convention
(visible across the whole working set) is: the *longer* real-world
dimension is `lengthFt` and renders vertically (portrait); the shorter one
is `widthFt` and renders horizontally. Several PixelSquid exports were
rendered in landscape (long axis horizontal) instead, which is a natural
way to shoot a product photo but is 90 degrees off from this project's
convention. The script now also tries the image rotated 90 degrees and

**A third pass fixed a resolution bug introduced by the first fix.**
Resizing every image down to its literal 10px/ft display size (e.g. a
2.5ft x 3ft item -> a 25x30px file) made the bounding box correct but threw
away the resolution needed for the user to zoom in (canvas zoom goes up to
200%) or export at higher multipliers (up to 8x, see
`Config.EXPORT_RESOLUTIONS`) — both end up upscaling a tiny bitmap, which
shows up as a blurry/"ghosted" look exactly like the one reported after
zooming in on a placed item. `CanvasManager` never required files to be
10px/ft in the first place — it scales whatever resolution you give it down
to fit the display box (`img.scale()`), so there was no reason to throw away
quality. The script now defaults to `--render-px-per-foot 80` (8x the live
display density) instead. All 85 previously "fixed" images were restored
from the original pre-edit backup and reprocessed at the higher resolution
— canvas folder is now ~24MB total, still reasonable for a web app.

**One image could not be restored to high resolution: `washing-machine`.**
The user replaced this file with a new, better-cropped photo mid-session.
That replacement was processed (cropped + resized) before this resolution
bug was caught, and — unlike every other change in this pipeline — it
wasn't backed up first, so the higher-resolution version of that specific
new photo is gone. The file has been reverted to the original pre-swap
washing machine photo as a placeholder. If a higher-res copy of the
preferred photo still exists (e.g. wherever it was downloaded from), it
should be dropped back into `assets/images/items/canvas/washing-machine-top.png`
and run through this script again.
keeps whichever orientation fits best.

Final result: **94 of 108 images are now correctly sized** (83 needed only
crop+resize, 11 needed a 90-degree rotation first). **14 images still
can't be auto-fixed** — their source render's content itself doesn't match
the footprint (not just orientation), so cropping/rotating can't fix them.
See "Items needing new source art" below.

## The standard going forward

Direct answers, since these come up every time a new item is added:

**Is the issue the image, or the code/data?** The image. `CanvasManager`'s
rendering math and `master-Items-top-measurements.csv`'s target sizes are
both correct — they're just a spec the source PNG has to match.

**What size should I export at?** Exactly `widthFt * 10` x `lengthFt * 10`
pixels — a literal 1:1 mapping at `Config.PX_PER_FOOT`. E.g. a 6ft x 16ft
sedan exports at exactly 60 x 160px. Not "close to," not "with some margin
for safety" — exact. The CSV's `canvasWidthPx`/`canvasHeightPx` columns
already give you this number per item; that's what they're for (they were
reference data, but they're the literal target export size).

**Should the object touch the corners, or fill the canvas?** Fill it.
The image canvas *is* the item's bounding box — there is no extra space
reserved for margin. The object's silhouette should touch all four edges.
Any transparent padding left in the export directly shows up as the object
rendering smaller than its real-world size on the floor plan.

**Which orientation?** Portrait, with the *longer* real-world dimension
running vertically. That's the convention this whole catalog already uses
(cars are taller than wide in their canvas image, RVs are taller than wide,
etc.) — match it even if a landscape product shot looks more natural for a
catalog photo elsewhere.

**Should I re-render everything?** No — only the 14 items listed below.
Everything else either already worked or just needed cropping/rotating in
place (handled automatically; no new renders needed for those 94).

Checklist for any new or replacement image:
1. **Top-down (bird's-eye) view**, not a 3/4 or side angle.
2. **Zero padding** — object touches all four edges.
3. **Portrait orientation** — longer real dimension vertical.
4. **Exact pixel size** — `widthFt * 10` x `lengthFt * 10`.
5. **Real alpha channel** (transparent background, not white).

## Running the pipeline

```bash
# Report only, no files touched
python3 tools/asset-pipeline/trim_resize_canvas_images.py --dry-run

# Apply fixes (crops + resizes in place, only for items within tolerance)
python3 tools/asset-pipeline/trim_resize_canvas_images.py

# Be stricter/looser about how much distortion is acceptable
python3 tools/asset-pipeline/trim_resize_canvas_images.py --max-error 30
```

Run this any time you add new items via `tools/item-builder`, or after
replacing one of the flagged images below.

## Items needing new source art

These 14 items' source images don't represent a usable top-down silhouette
in *either* orientation (camera angle, padding pattern, or content doesn't
match the footprint) — cropping and rotating can't fix them. They currently
render with the old (unfixed) image, which will look noticeably wrong.
Replace the source PNG following the checklist above (re-render from
PixelSquid at a true top-down angle, or hand-crop in Photoshop), then
re-run the script — it'll pick up the fix automatically.

| id | label | error (original) | error (rotated) |
|---|---|---|---|
| garage-pegboard | Garage Pegboard | 4315% | 64% |
| tv | TV (Flat Screen) | 606% | 61% |
| floor-lamp | Floor Lamp | 448% | 557% |
| electric-car-charging | EV Charger | 326% | 161% |
| scaffold-rack | Scaffold Rack | 187% | 891% |
| double-door-fridge | Refrigerator | 120% | 82% |
| punching-bag-hanging | Punching Bag | 111% | 237% |
| garage-door | Garage Door | 88% | 4073% |
| metal-staircase | Metal Staircase | 87% | 493% |
| storage-ladder | Storage Ladder | 79% | 796% |
| fliperama | Arcade Game | 73% | 132% |
| car-jack | Car Jack | 69% | 475% |
| water-cooler | Water Cooler | 69% | 321% |
| fosball | Foosball Table | 64% | 70% |

`scaffold-rack` is part of the **live catalog**, so it's user-facing today
— prioritize that one first. The rest are reachable in the sidebar but
less likely to be picked immediately.

Items that *were* in this list before but turned out to just need a
90-degree rotation (no new art needed, already fixed automatically):
`cnc-machine`, `rolling-tool-chest`, `l-shaped-sofa`, `coffee-table`,
`hot-dog-cart`, `garage-bar-counter`, `gas-grill`, `garage-cabinets-with-shelves`,
`bench-press`, `shelf-boxes`, `pressure-washer-machine`.

## Note on palette images

This pipeline only covers **canvas** images (the top-down image used on the
floor plan). The **palette** images (`assets/images/items/palette/*-side.png`,
shown in the item picker sidebar) are cosmetic only — they don't affect
in-canvas measurements — and were not analyzed or modified here.
