/* global Helpers, Config */

/**
 * Boundary Detection Utilities
 * Handle item constraints within floor plan
 */
const Bounds = {
  /**
   * Constrain item to floor plan boundaries
   */
  constrainToBounds(item, floorPlan, canvasBounds) {
    if (!floorPlan || !item || typeof item.set !== 'function') return;

    const itemBounds = this.getItemBounds(item);
    if (!itemBounds) return;

    let newLeft = item.left;
    let newTop = item.top;
    const bounds = this._resolveCanvasBounds(floorPlan, canvasBounds);

    if (bounds) {
      const minLeft = bounds.left;
      const minTop = bounds.top;
      const maxLeft = bounds.left + bounds.width - itemBounds.width;
      const maxTop = bounds.top + bounds.height - itemBounds.height;

      if (itemBounds.left < minLeft) {
        newLeft += minLeft - itemBounds.left;
      }
      if (itemBounds.top < minTop) {
        newTop += minTop - itemBounds.top;
      }
      if (itemBounds.left > maxLeft) {
        newLeft -= itemBounds.left - maxLeft;
      }
      if (itemBounds.top > maxTop) {
        newTop -= itemBounds.top - maxTop;
      }
    } else {
      const maxX = Helpers.feetToPx(floorPlan.widthFt);
      const maxY = Helpers.feetToPx(floorPlan.heightFt);

      if (itemBounds.left < 0) {
        newLeft += -itemBounds.left;
      }
      if (itemBounds.left + itemBounds.width > maxX) {
        newLeft -= itemBounds.left + itemBounds.width - maxX;
      }
      if (itemBounds.top < 0) {
        newTop += -itemBounds.top;
      }
      if (itemBounds.top + itemBounds.height > maxY) {
        newTop -= itemBounds.top + itemBounds.height - maxY;
      }
    }

    if (newLeft !== item.left || newTop !== item.top) {
      item.set({ left: newLeft, top: newTop });
      item.setCoords();
    }
  },

  /**
   * Check if item is within floor plan
   */
  isWithinBounds(item, floorPlan, canvasBounds) {
    if (!floorPlan || !item) return false;

    const itemBounds = this.getItemBounds(item);
    if (!itemBounds) return false;

    const bounds = this._resolveCanvasBounds(floorPlan, canvasBounds);
    if (bounds) {
      return (
        itemBounds.left >= bounds.left &&
        itemBounds.top >= bounds.top &&
        itemBounds.left + itemBounds.width <= bounds.left + bounds.width &&
        itemBounds.top + itemBounds.height <= bounds.top + bounds.height
      );
    }

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

    const bounds = this._resolveCanvasBounds(floorPlan, canvasBounds);
    const position = entryZonePosition || 'bottom';
    const itemBounds = this.getItemBounds(item);
    if (!itemBounds) return false;

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
    const rect = this._getBoundingRect(item);
    if (!rect) return null;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
    };
  },

  /**
   * Check if two items overlap
   */
  itemsOverlap(item1, item2) {
    const b1 = this.getItemBounds(item1);
    const b2 = this.getItemBounds(item2);
    if (!b1 || !b2) return false;
    return Helpers.rectanglesOverlap(b1, b2);
  },

  /**
   * Find nearby items for snapping
   */
  findNearbyItems(targetItem, allItems, threshold = 5) {
    const nearby = [];
    const targetBounds = this.getItemBounds(targetItem);
    if (!targetBounds) return nearby;
    allItems.forEach((item) => {
      if (item === targetItem) return;

      const itemBounds = this.getItemBounds(item);
      if (!itemBounds) return;

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

  _resolveCanvasBounds(floorPlan, overrideBounds) {
    if (this._isValidBounds(overrideBounds)) return overrideBounds;
    if (floorPlan && this._isValidBounds(floorPlan.canvasBounds)) {
      return floorPlan.canvasBounds;
    }
    return null;
  },

  _isValidBounds(bounds) {
    return (
      !!bounds &&
      Number.isFinite(bounds.left) &&
      Number.isFinite(bounds.top) &&
      Number.isFinite(bounds.width) &&
      Number.isFinite(bounds.height)
    );
  },

  _getBoundingRect(item) {
    if (!item || typeof item.getBoundingRect !== 'function') return null;
    try {
      return item.getBoundingRect(true);
    } catch (error) {
      console.warn('[Bounds] Failed to compute bounding rect:', error);
      return null;
    }
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Bounds = Bounds;
}
