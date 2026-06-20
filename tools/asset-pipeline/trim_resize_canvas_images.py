#!/usr/bin/env python3
"""
Canvas image trim/resize pipeline for the Garage Layout Planner item library.

WHY THIS EXISTS
----------------
Canvas item images (the top-down PNGs used on the planning canvas) must be
pixel-perfect representations of each item's real-world footprint at
Config.PX_PER_FOOT (10px/ft). If a source PNG has transparent padding around
the object, or its aspect ratio doesn't match widthFt:lengthFt, the item will
render undersized/off-center relative to its declared dimensions -- it will
"not look realistic" even though the bounding box math is correct.

WHAT IT DOES
------------
For every row in assets/images/items/master-Items-top-measurements.csv:
  1. Opens the referenced canvasImage.
  2. Crops it to the bounding box of its non-transparent (alpha > 0) pixels,
     removing any padding baked into the source render.
  3. Compares the trimmed image's aspect ratio to the expected
     widthFt:lengthFt ratio (the CSV's canvasWidthPx:canvasHeightPx columns
     encode this same ratio at 10px/ft -- the live on-canvas display density
     -- but that is NOT the resolution this script exports at; see below).
  4. If that doesn't fit within --max-error, tries the image rotated 90
     degrees. Some items (e.g. a coffee table wider than it is deep) are
     legitimately landscape; most are portrait. A 90-degree rotation fixes
     source renders that were shot/exported in the wrong orientation,
     without needing a new photo at all.
  5. Whichever orientation (original or rotated) fits best and is within
     --max-error gets cropped to its alpha bbox and resized, overwriting
     the file.
  6. If neither orientation fits, the file is left untouched and reported
     under "NEEDS NEW SOURCE ART" -- forcing a fix on those would visibly
     stretch/distort the object. Those items need a different photo, a
     re-rendered angle, or a hand-cropped replacement.

OUTPUT RESOLUTION -- IMPORTANT
-------------------------------
CanvasManager renders items at Config.PX_PER_FOOT (10px/ft) by default, but
it does this by scaling whatever-resolution image you give it down to fit
that box (fabric.js `img.scale()`) -- it does NOT require the file itself to
be 10px/ft. An earlier version of this script resized files down to the
literal 10px/ft display size (e.g. a 2.5ft x 3ft item -> a 25x30px PNG).
That made the on-disk file correctly proportioned but threw away all the
resolution needed for the user to zoom in (canvas zoom goes up to 200%) or
for PNG export (up to 8x, see Config.EXPORT_RESOLUTIONS) -- both end up
upscaling a tiny bitmap, which is what causes the blurry/"ghosted" look.

This script instead exports at --render-px-per-foot (default 80 -- 8x the
live display density, matching the highest export multiplier) so the source
stays sharp under zoom and export, while CanvasManager's existing scaling
logic handles displaying it correctly at the smaller live size. No CanvasManager
changes are needed for this -- it already scales proportionally regardless
of the source file's actual resolution.

USAGE
-----
  python3 tools/asset-pipeline/trim_resize_canvas_images.py            # apply fixes
  python3 tools/asset-pipeline/trim_resize_canvas_images.py --dry-run  # report only
  python3 tools/asset-pipeline/trim_resize_canvas_images.py --max-error 40
  python3 tools/asset-pipeline/trim_resize_canvas_images.py --render-px-per-foot 100

IMPORTANT: this script overwrites files in place. Back up
assets/images/items/canvas/ first (a timestamped copy under .tmp/ is fine) --
don't rely on this script alone before re-running it on already-processed
images, since reprocessing an already-shrunk file can't recover lost detail.

WHEN TO RUN THIS
-----------------
- After adding new items via tools/item-builder (new canvas PNGs).
- After replacing any of the "NEEDS NEW SOURCE ART" images with new source art.
- As a periodic QA pass if items start looking off again.
"""

import argparse
import csv
import os

from PIL import Image

DEFAULT_CSV = "assets/images/items/master-Items-top-measurements.csv"
DEFAULT_RENDER_PX_PER_FOOT = 80

# Known historical typos where the CSV/items data had a truncated filename
# (e.g. copy-pasted from a spreadsheet column that displayed "...").
# Add future occurrences here rather than hand-editing the CSV.
PATH_FIXES = {
    "assets/images/items/canvas/garage-cabinets-with-shel...-top.png": (
        "assets/images/items/canvas/garage-cabinets-with-shelves-top.png"
    ),
    "assets/images/items/canvas/inflatable-swimmin...g-top.png": (
        "assets/images/items/canvas/inflatable-swimming-ring-top.png"
    ),
}


def load_rows(csv_path):
    with open(csv_path, newline="") as f:
        return list(csv.DictReader(f))


def process(csv_path, max_error, dry_run, render_px_per_foot):
    rows = load_rows(csv_path)
    fixed, needs_art, errors, skipped_no_image = [], [], [], []

    for r in rows:
        rel = PATH_FIXES.get(r["canvasImage"], r["canvasImage"])
        if not rel:
            skipped_no_image.append(r["id"])
            continue

        if not os.path.exists(rel):
            errors.append((r["id"], rel, "file not found"))
            continue

        try:
            # canvasWidthPx/canvasHeightPx are widthFt/lengthFt * 10 (the live
            # display density) -- recover the real-world feet so we can
            # render the output at a much higher density instead.
            width_ft = float(r["canvasWidthPx"]) / 10
            length_ft = float(r["canvasHeightPx"]) / 10
            expected_w = int(round(float(r["canvasWidthPx"])))
            expected_h = int(round(float(r["canvasHeightPx"])))
            output_w = max(1, round(width_ft * render_px_per_foot))
            output_h = max(1, round(length_ft * render_px_per_foot))
        except (KeyError, ValueError):
            errors.append((r["id"], rel, "missing/invalid canvasWidthPx/canvasHeightPx"))
            continue

        expected_ratio = expected_w / expected_h if expected_h else 0

        try:
            im = Image.open(rel).convert("RGBA")
        except Exception as e:
            errors.append((r["id"], rel, f"open error: {e}"))
            continue

        bbox = im.split()[-1].getbbox()
        if not bbox:
            errors.append((r["id"], rel, "fully transparent image"))
            continue

        bbox_w, bbox_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        orig_ratio = bbox_w / bbox_h if bbox_h else 0
        orig_err = abs(orig_ratio - expected_ratio) / expected_ratio * 100 if expected_ratio else 999

        rot_ratio = bbox_h / bbox_w if bbox_w else 0
        rot_err = abs(rot_ratio - expected_ratio) / expected_ratio * 100 if expected_ratio else 999

        use_rotated = rot_err < orig_err
        ratio_err_pct = rot_err if use_rotated else orig_err

        if ratio_err_pct > max_error:
            needs_art.append(
                (r["id"], r.get("label", ""), rel, round(orig_err, 1), round(rot_err, 1))
            )
            continue

        if not dry_run:
            source = im.rotate(-90, expand=True) if use_rotated else im
            bbox2 = source.split()[-1].getbbox()
            cropped = source.crop(bbox2)
            resized = cropped.resize((output_w, output_h), Image.LANCZOS)
            resized.save(rel, "PNG")

        orientation = "rotated 90deg" if use_rotated else "original"
        fixed.append(
            (r["id"], rel, f"{bbox_w}x{bbox_h}", f"{output_w}x{output_h}", round(ratio_err_pct, 1), orientation)
        )

    return fixed, needs_art, errors, skipped_no_image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=DEFAULT_CSV)
    parser.add_argument(
        "--max-error",
        type=float,
        default=60.0,
        help="Max acceptable aspect-ratio error (%%) before an image is flagged instead of stretched.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report only, don't modify files.")
    parser.add_argument(
        "--render-px-per-foot",
        type=float,
        default=DEFAULT_RENDER_PX_PER_FOOT,
        help=(
            "Output resolution density, in pixels per real-world foot. "
            "Default 80 (8x the 10px/ft live display density) keeps images "
            "sharp under canvas zoom and PNG export. Do NOT set this to 10 -- "
            "that reproduces the old blur-on-zoom bug."
        ),
    )
    args = parser.parse_args()

    fixed, needs_art, errors, skipped = process(
        args.csv, args.max_error, args.dry_run, args.render_px_per_foot
    )

    mode = "WOULD FIX" if args.dry_run else "FIXED"
    print(f"{mode}: {len(fixed)}")
    for f in fixed:
        print("  ", f)

    print(
        f"\nNEEDS NEW SOURCE ART (best of original/rotated still > {args.max_error}% off): "
        f"{len(needs_art)}"
    )
    for n in sorted(needs_art, key=lambda x: min(x[3], x[4])):
        print("  ", n, "(id, label, path, orig_err%, rotated_err%)")

    if errors:
        print(f"\nERRORS: {len(errors)}")
        for e in errors:
            print("  ", e)


if __name__ == "__main__":
    main()
