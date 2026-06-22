/**
 * Configuration Constants
 * Central configuration for the Garage Layout Planner
 */
const Config = {
  LAYOUT_SCHEMA_VERSION: 3,
  MAX_FLOOR_PLAN_UNITS: 10,
  // Screen-space catch zone for unit-to-unit edge snapping. CanvasManager
  // converts this to logical canvas coordinates at the current zoom.
  FLOOR_PLAN_SNAP_THRESHOLD: 16,
  FLOOR_PLAN_INITIAL_GAP: 20,
  USE_IMAGES: true,
  // Scaling
  PX_PER_FOOT: 10,

  // Bump this whenever item images are replaced/re-cropped so browsers
  // (and local dev servers like Live Server, which don't cache-bust by
  // default) don't keep showing the old cached PNG after the file on disk
  // has changed at the same path.
  ASSET_VERSION: '2026-06-19-4',

  // Floor Plans (in feet)
  FLOOR_PLANS: [
    {
      id: 'fp-unit-a',
      shortName: 'Unit A',
      widthFt: 22,
      heightFt: 55,
      name: "Units A - 22'×55'",
      area: 1210,
      description: "Door: 14' × 14'",
      doorWidth: 14,
      doorHeight: 14,
    },
    {
      id: 'fp-unit-b',
      shortName: 'Unit B',
      widthFt: 15,
      heightFt: 55,
      name: "Units B - 15'×55'",
      area: 825,
      description: "Door: 13' × 14'",
      doorWidth: 13,
      doorHeight: 14,
    },
    {
      id: 'fp-unit-c',
      shortName: 'Unit C',
      widthFt: 15,
      heightFt: 55,
      name: "Units C - 15'×55'",
      area: 825,
      description: "Door: 13' × 14'",
      doorWidth: 13,
      doorHeight: 14,
    },
    {
      id: 'fp-unit-d',
      shortName: 'Unit D',
      widthFt: 15,
      heightFt: 50,
      name: "Units D - 15'×50'",
      area: 750,
      description: "Door: 13' × 14'",
      doorWidth: 13,
      doorHeight: 14,
    },
    {
      id: 'fp-unit-e',
      shortName: 'Unit E',
      widthFt: 14,
      heightFt: 35,
      name: "Units E - 14'×35'",
      area: 490,
      description: "Door: 12' × 12'",
      doorWidth: 12,
      doorHeight: 12,
    },
    {
      id: 'fp-unit-f',
      shortName: 'Unit F',
      widthFt: 18,
      heightFt: 50,
      name: "Units F - 18'×50'",
      area: 900,
      description: "Door: 14' × 14'",
      doorWidth: 14,
      doorHeight: 14,
    },
    {
      id: 'fp-unit-h',
      shortName: 'Unit H',
      widthFt: 15,
      heightFt: 50,
      name: "Units H - 15'×50'",
      area: 750,
      description: "Door: 13' × 14'",
      doorWidth: 13,
      doorHeight: 14,
    },
  ],

  // Canvas
  CANVAS_PADDING: 50,
  GRID_SIZE: 10, // 1 foot in pixels

  // History
  MAX_HISTORY: 50,

  // Auto-save
  AUTOSAVE_INTERVAL: 30000, // 30 seconds

  // Entry Zone
  ENTRY_ZONE_PERCENTAGE: 0.05, // Bottom 5%

  // Units
  UNITS: {
    FEET: 'feet',
    METERS: 'meters',
  },

  // Export
  EXPORT_RESOLUTIONS: [1, 2, 4, 8],
  PDF_MARGINS: 0.5, // inches

  // Magnifier
  MAGNIFIER_ZOOM: 2.5,
  MAGNIFIER_SIZE: 150,

  // Keyboard
  NUDGE_DISTANCE: 2, // pixels
  NUDGE_DISTANCE_LARGE: 10, // pixels with Shift

  // Colors
  COLORS: {
    floorPlan: '#ffffff',
    floorPlanStroke: '#2c3e50',
    grid: '#b0b0b0',
    entryZone: 'rgba(255, 0, 0, 0.15)',
    entryZoneWarning: 'rgba(255, 0, 0, 0.3)',
    selection: '#2196F3',
    alignmentGuide: '#FF5722',
    dimension: '#666666',
  },

  // Feature Flags
  FEATURES: {
    enableClientManagement: true,
    enableGoogleSheetsSync: false,
  },

  // Storage Keys
  STORAGE_KEYS: {
    layouts: 'garage-planner-layouts',
    settings: 'garage-planner-settings',
    autosave: 'garage-planner-autosave',
    activeLayout: 'garage-planner-active-layout',
    clients: 'storage-caves-clients',
    sheetsConfig: 'storage-caves-sheets-config',
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Config = Config;
}
