/* global Config */

/**
 * Utility Helper Functions
 */
const Helpers = {
  /**
   * Convert feet to pixels
   */
  feetToPx(feet) {
    return feet * Config.PX_PER_FOOT;
  },

  /**
   * Convert pixels to feet
   */
  pxToFeet(px) {
    return px / Config.PX_PER_FOOT;
  },

  /**
   * Convert feet to meters
   */
  feetToMeters(feet) {
    return feet * 0.3048;
  },

  /**
   * Convert meters to feet
   */
  metersToFeet(meters) {
    return meters / 0.3048;
  },

  /**
   * Format number to fixed decimal places
   */
  formatNumber(num, decimals = 1) {
    return Number(num.toFixed(decimals));
  },

  /**
   * Generate unique ID
   */
  generateId(prefix = 'item') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Deep clone object
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Download data as file
   */
  downloadFile(data, filename, type = 'application/json') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Format date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  },

  /**
   * Calculate distance between two points
   */
  distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },

  /**
   * Calculate angle between two points (in degrees)
   */
  angleBetweenPoints(x1, y1, x2, y2) {
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  },

  /**
   * Constrain number to range
   */
  clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
  },

  /**
   * Check if two rectangles overlap
   */
  rectanglesOverlap(r1, r2) {
    return !(r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom);
  },

  /**
   * Sanitize user-provided layout/project names for display/storage
   */
  sanitizeLayoutName(name, fallback = '') {
    if (typeof name !== 'string') {
      return fallback;
    }
    const normalized = name
      .replace(/[\u0000-\u001f]+/g, '')
      .replace(/[\r\n\t]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
    if (!normalized) {
      return fallback;
    }
    const stripped = normalized.replace(/[<>]/g, '');
    return stripped.substring(0, 100);
  },

  /**
   * Sanitize strings for use as filenames
   */
  sanitizeFilename(name, fallback = 'layout') {
    const base = typeof name === 'string' && name.trim().length ? name.trim() : fallback;
    const normalized = base
      .normalize('NFKD')
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+/, '')
      .replace(/\.+$/, '');
    const safe = normalized.substring(0, 80);
    return safe || fallback;
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Helpers = Helpers;
}
