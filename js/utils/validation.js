/* global Config */

/**
 * Validation Utilities
 * Input validation and data checking
 */
const Validation = {
  /**
   * Validate floor plan data
   */
  validateFloorPlan(floorPlan) {
    const errors = [];

    if (!floorPlan) {
      errors.push('Floor plan is required');
      return { valid: false, errors };
    }

    if (!floorPlan.widthFt || floorPlan.widthFt <= 0) {
      errors.push('Floor plan width must be greater than 0');
    }

    if (!floorPlan.heightFt || floorPlan.heightFt <= 0) {
      errors.push('Floor plan height must be greater than 0');
    }

    if (floorPlan.widthFt * floorPlan.heightFt < 100) {
      errors.push('Floor plan area must be at least 100 sq ft');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate item data
   */
  validateItem(item) {
    const errors = [];

    if (!item) {
      errors.push('Item is required');
      return { valid: false, errors };
    }

    if (!item.id) {
      errors.push('Item ID is required');
    }

    if (!item.label || item.label.trim() === '') {
      errors.push('Item label is required');
    }

    if (!item.lengthFt || item.lengthFt <= 0) {
      errors.push('Item length must be greater than 0');
    }

    if (!item.widthFt || item.widthFt <= 0) {
      errors.push('Item width must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate layout name
   */
  validateLayoutName(name) {
    const errors = [];

    if (!name || name.trim() === '') {
      errors.push('Layout name is required');
    }

    if (name.length > 100) {
      errors.push('Layout name must be less than 100 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate export options
   */
  validateExportOptions(options) {
    const errors = [];

    if (options.type && !['json', 'png', 'pdf'].includes(options.type)) {
      errors.push('Invalid export type');
    }

    if (options.resolution && !Config.EXPORT_RESOLUTIONS.includes(options.resolution)) {
      errors.push('Invalid export resolution');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Sanitize HTML string
   */
  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Validate number within range
   */
  validateNumber(value, min, max) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Validation = Validation;
}
