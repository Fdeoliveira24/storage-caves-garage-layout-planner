/* global Helpers */

/**
 * Geometry Utilities using Turf.js
 * Complex geometric calculations and validations
 */
const Geometry = {
  /**
   * Convert Fabric.js rectangle to Turf.js polygon
   */
  rectToPolygon(rect) {
    const bounds = rect.getBoundingRect();
    return {
      type: 'Polygon',
      coordinates: [
        [
          [bounds.left, bounds.top],
          [bounds.left + bounds.width, bounds.top],
          [bounds.left + bounds.width, bounds.top + bounds.height],
          [bounds.left, bounds.top + bounds.height],
          [bounds.left, bounds.top], // Close the loop
        ],
      ],
    };
  },

  /**
   * Check if point is inside polygon (using Turf.js)
   */
  pointInPolygon(point, polygon) {
    if (typeof turf !== 'undefined') {
      const turfPoint = turf.point([point.x, point.y]);
      return turf.booleanPointInPolygon(turfPoint, polygon);
    }
    // Fallback without Turf.js
    return this._pointInPolygonFallback(point, polygon);
  },

  /**
   * Calculate polygon area (using Turf.js)
   */
  calculateArea(polygon) {
    if (typeof turf !== 'undefined') {
      return turf.area(polygon); // Returns square meters
    }
    // Fallback: simple rectangle area
    return 0;
  },

  /**
   * Calculate distance between two points (using Turf.js)
   */
  distance(point1, point2, units = 'pixels') {
    if (typeof turf !== 'undefined' && units === 'meters') {
      const p1 = turf.point([point1.x, point1.y]);
      const p2 = turf.point([point2.x, point2.y]);
      return turf.distance(p1, p2, { units: 'meters' });
    }
    // Fallback: Euclidean distance
    return Helpers.distance(point1.x, point1.y, point2.x, point2.y);
  },

  /**
   * Validate polygon (check for self-intersections)
   */
  validatePolygon(polygon) {
    if (typeof turf !== 'undefined') {
      const kinks = turf.kinks(polygon);
      return {
        valid: kinks.features.length === 0,
        intersections: kinks.features,
      };
    }
    return { valid: true, intersections: [] };
  },

  /**
   * Simplify polygon
   */
  simplifyPolygon(polygon, tolerance = 0.01) {
    if (typeof turf !== 'undefined') {
      return turf.simplify(polygon, { tolerance });
    }
    return polygon;
  },

  /**
   * Calculate bounding box of polygon
   */
  getBoundingBox(polygon) {
    if (typeof turf !== 'undefined') {
      const bbox = turf.bbox(polygon);
      return {
        left: bbox[0],
        top: bbox[1],
        right: bbox[2],
        bottom: bbox[3],
        width: bbox[2] - bbox[0],
        height: bbox[3] - bbox[1],
      };
    }
    return null;
  },

  /**
   * Point in polygon fallback (ray casting algorithm)
   * @private
   */
  _pointInPolygonFallback(point, polygon) {
    const coords = polygon.coordinates[0];
    let inside = false;

    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const xi = coords[i][0],
        yi = coords[i][1];
      const xj = coords[j][0],
        yj = coords[j][1];

      const intersect =
        yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Geometry = Geometry;
}
