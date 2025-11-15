/* global Helpers, Config */

/**
 * Boundary Detection Utilities
 * Handle item constraints within floor plan
 */
const Bounds = {
  /**
   * Constrain item to floor plan boundaries
   */
  constrainToBounds(item, floorPlan) {
    if (!floorPlan) return;

    const itemBounds = item.getBoundingRect();
    const maxX = Helpers.feetToPx(floorPlan.widthFt);
    const maxY = Helpers.feetToPx(floorPlan.heightFt);

    let newLeft = item.left;
    let newTop = item.top;

    // Check left boundary
    if (itemBounds.left < 0) {
      newLeft = item.left - itemBounds.left;
    }

    // Check right boundary
    if (itemBounds.left + itemBounds.width > maxX) {
      newLeft = item.left - (itemBounds.left + itemBounds.width - maxX);
    }

    // Check top boundary
    if (itemBounds.top < 0) {
      newTop = item.top - itemBounds.top;
    }

    // Check bottom boundary
    if (itemBounds.top + itemBounds.height > maxY) {
      newTop = item.top - (itemBounds.top + itemBounds.height - maxY);
    }

    item.set({ left: newLeft, top: newTop });
    item.setCoords();
  },

  /**
   * Check if item is within floor plan
   */
  isWithinBounds(item, floorPlan) {
    if (!floorPlan) return false;

    const itemBounds = item.getBoundingRect();
    const maxX = Helpers.feetToPx(floorPlan.widthFt);
    const maxY = Helpers.feetToPx(floorPlan.heightFt);

    return (
      itemBounds.left >= 0 &&
      itemBounds.top >= 0 &&
      itemBounds.left + itemBounds.width <= maxX &&
      itemBounds.top + itemBounds.height <= maxY
    );
  },

  /**
   * Check if item is in entry zone
   * Supports all 4 entry zone positions (top, bottom, left, right)
   */
  isInEntryZone(item, floorPlan, entryZonePosition, canvasBounds) {
    if (!floorPlan || !item) return false;

    const bounds = canvasBounds || floorPlan?.canvasBounds;
    const position = entryZonePosition || 'bottom';
    const itemBounds = item.getBoundingRect(true);

    if (bounds) {
      const zoneHeight = bounds.height * Config.ENTRY_ZONE_PERCENTAGE;
      const zoneWidth = bounds.width * Config.ENTRY_ZONE_PERCENTAGE;

      if (position === 'bottom') {
        const entryZoneStart = bounds.top + bounds.height - zoneHeight;
        return itemBounds.top + itemBounds.height > entryZoneStart;
      }
      if (position === 'top') {
        const entryZoneEnd = bounds.top + zoneHeight;
        return itemBounds.top < entryZoneEnd;
      }
      if (position === 'left') {
        const entryZoneEnd = bounds.left + zoneWidth;
        return itemBounds.left < entryZoneEnd;
      }
      if (position === 'right') {
        const entryZoneStart = bounds.left + bounds.width - zoneWidth;
        return itemBounds.left + itemBounds.width > entryZoneStart;
      }

      return false;
    }

    // Fallback to legacy origin-based detection
    const floorPlanWidth = Helpers.feetToPx(floorPlan.widthFt);
    const floorPlanHeight = Helpers.feetToPx(floorPlan.heightFt);

    if (position === 'bottom') {
      const entryZoneStart = floorPlanHeight * (1 - Config.ENTRY_ZONE_PERCENTAGE);
      return itemBounds.top + itemBounds.height > entryZoneStart;
    }
    if (position === 'top') {
      const entryZoneEnd = floorPlanHeight * Config.ENTRY_ZONE_PERCENTAGE;
      return itemBounds.top < entryZoneEnd;
    }
    if (position === 'left') {
      const entryZoneEnd = floorPlanWidth * Config.ENTRY_ZONE_PERCENTAGE;
      return itemBounds.left < entryZoneEnd;
    }
    if (position === 'right') {
      const entryZoneStart = floorPlanWidth * (1 - Config.ENTRY_ZONE_PERCENTAGE);
      return itemBounds.left + itemBounds.width > entryZoneStart;
    }

    return false;
  },

  /**
   * Snap to grid
   */
  snapToGrid(value, gridSize = Config.GRID_SIZE) {
    return Math.round(value / gridSize) * gridSize;
  },

  /**
   * Snap item to grid
   */
  snapItemToGrid(item, gridSize = Config.GRID_SIZE) {
    item.set({
      left: this.snapToGrid(item.left, gridSize),
      top: this.snapToGrid(item.top, gridSize),
    });
    item.setCoords();
  },

  /**
   * Get item bounds as object
   */
  getItemBounds(item) {
    const bounds = item.getBoundingRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.left + bounds.width,
      bottom: bounds.top + bounds.height,
      width: bounds.width,
      height: bounds.height,
    };
  },

  /**
   * Check if two items overlap
   */
  itemsOverlap(item1, item2) {
    const b1 = this.getItemBounds(item1);
    const b2 = this.getItemBounds(item2);

    return Helpers.rectanglesOverlap(b1, b2);
  },

  /**
   * Find nearby items for snapping
   */
  findNearbyItems(targetItem, allItems, threshold = 5) {
    const nearby = [];
    const targetBounds = this.getItemBounds(targetItem);

    allItems.forEach((item) => {
      if (item === targetItem) return;

      const itemBounds = this.getItemBounds(item);

      // Check if edges are close
      const edges = [
        { type: 'left', dist: Math.abs(targetBounds.left - itemBounds.left) },
        { type: 'right', dist: Math.abs(targetBounds.right - itemBounds.right) },
        { type: 'top', dist: Math.abs(targetBounds.top - itemBounds.top) },
        { type: 'bottom', dist: Math.abs(targetBounds.bottom - itemBounds.bottom) },
        {
          type: 'centerX',
          dist: Math.abs(
            (targetBounds.left + targetBounds.right) / 2 - (itemBounds.left + itemBounds.right) / 2,
          ),
        },
        {
          type: 'centerY',
          dist: Math.abs(
            (targetBounds.top + targetBounds.bottom) / 2 - (itemBounds.top + itemBounds.bottom) / 2,
          ),
        },
      ];

      edges.forEach((edge) => {
        if (edge.dist < threshold) {
          nearby.push({
            item,
            edge: edge.type,
            distance: edge.dist,
          });
        }
      });
    });

    return nearby;
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Bounds = Bounds;
}
