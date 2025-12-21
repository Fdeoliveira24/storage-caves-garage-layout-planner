/**
 * Global Type Definitions
 * Provides TypeScript type definitions for CDN-loaded libraries and custom window properties
 */

// Fabric.js CDN library
declare const fabric: any;

// Turf.js CDN library
declare const turf: any;

// jsPDF CDN library
declare const jsPDF: any;

// StorageUtil global (alias for Storage module)
declare const StorageUtil: any;

// Custom window properties for application modules
interface Window {
  // Core modules
  App: any;
  Config: any;
  EventBus: any;
  State: any;

  // Data modules
  Icons: any;
  Items: any;

  // Feature modules
  Magnifier: any;
  MeasurementTool: any;

  // Manager modules
  CanvasManager: any;
  ExportManager: any;
  FloorPlanManager: any;
  HistoryManager: any;
  ItemManager: any;
  SelectionManager: any;

  // UI modules
  Modal: any;
  MobileUIManager: any;

  // Utility modules
  Bounds: any;
  Geometry: any;
  Helpers: any;
  Storage: any;
  StorageUtil: any;
  Validation: any;

  // Application instance
  app: any;

  // jsPDF namespace (alternative loading method)
  jspdf?: {
    jsPDF: any;
  };

  // Storage warning flag
  _storageWarningShown?: boolean;
}
