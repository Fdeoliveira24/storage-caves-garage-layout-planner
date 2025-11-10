/**
 * Export Manager
 * Handles JSON, PNG, and PDF exports
 */
class ExportManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
  }

  /**
   * Export as JSON
   */
  exportJSON() {
    const state = this.state.getState();
    
    const exportData = {
      version: '1.0.0',
      exported: new Date().toISOString(),
      metadata: state.metadata,
      floorPlan: state.floorPlan,
      items: state.items.map(item => ({
        id: item.id,
        itemId: item.itemId,
        label: item.label,
        lengthFt: item.lengthFt,
        widthFt: item.widthFt,
        x: item.x,
        y: item.y,
        angle: item.angle,
        locked: item.locked,
        category: item.category,
        color: item.color
      })),
      settings: state.settings
    };

    const json = JSON.stringify(exportData, null, 2);
    const filename = `${state.metadata.projectName || 'layout'}-${Date.now()}.json`;
    
    Helpers.downloadFile(json, filename, 'application/json');
    this.eventBus.emit('export:json:complete', filename);
    
    return exportData;
  }

  /**
   * Export as PNG
   */
  exportPNG(resolution = 1) {
    console.log('Attempting PNG export at', resolution, 'x resolution');
    
    const dataURL = this.canvasManager.toDataURL({
      multiplier: resolution,
      format: 'png',
      quality: 1
    });

    console.log('Data URL length:', dataURL.length);
    
    if (!dataURL || dataURL.length < 100) {
      console.error('Failed to generate canvas image');
      Modal.showError('Failed to export PNG');
      return;
    }

    const filename = `${this.state.get('metadata.projectName') || 'layout'}-${resolution}x.png`;
    
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Modal.showSuccess('PNG exported successfully!');
    this.eventBus.emit('export:png:complete', { filename, resolution });
    
    return dataURL;
  }

  /**
   * Export as PDF (Print-Ready with 300 DPI)
   * 
   * Generates a professional, print-ready PDF with 300 DPI resolution.
   * Supports ALL jsPDF format/orientation options for backward compatibility.
   * 
   * @param {Object} options - jsPDF options (passed through)
   * @param {string|array} options.format - Any jsPDF format ('letter', 'a4', [width,height], etc.)
   * @param {string} options.orientation - Any jsPDF orientation ('landscape', 'portrait', 'l', 'p')
   */
  async exportPDF(options = {}) {
    // Check if jsPDF is loaded
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      console.error('jsPDF library not loaded');
      Modal.showError('PDF library not loaded. Please refresh the page.');
      return;
    }

    const { jsPDF } = window.jspdf || window;
    console.log('Generating print-ready PDF...');

    // Deselect all objects for clean export
    this.canvasManager.canvas.discardActiveObject();
    this.canvasManager.canvas.renderAll();

    // Validate canvas is ready
    const canvasWidth = this.canvasManager.canvas.width;
    const canvasHeight = this.canvasManager.canvas.height;
    
    if (!canvasWidth || !canvasHeight || canvasWidth <= 0 || canvasHeight <= 0) {
      console.error('Invalid canvas dimensions:', canvasWidth, canvasHeight);
      Modal.showError('Canvas not ready. Please select a floor plan first.');
      return;
    }

    // Smart defaults when options not provided
    let pdfOptions = { ...options, unit: 'mm', compress: true };
    
    if (!pdfOptions.format) {
      // Auto-select format based on floor plan physical size
      const floorPlan = this.state.get('floorPlan');
      if (floorPlan && floorPlan.widthFt && floorPlan.heightFt) {
        const maxDim = Math.max(floorPlan.widthFt, floorPlan.heightFt);
        pdfOptions.format = maxDim >= 40 ? 'tabloid' : maxDim >= 30 ? 'legal' : 'letter';
      } else {
        pdfOptions.format = 'letter';
      }
    }
    
    if (!pdfOptions.orientation) {
      // Auto-detect orientation from canvas aspect ratio
      const aspectRatio = canvasWidth / canvasHeight;
      pdfOptions.orientation = aspectRatio > 1 ? 'landscape' : 'portrait';
    }

    // Create PDF (passes through ALL jsPDF options)
    const pdf = new jsPDF(pdfOptions);

    // Get page dimensions
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Layout: margins and reserved areas
    const margin = 12.7; // 0.5 inch = 12.7mm
    const headerHeight = 25; // Reserved for future logo/branding
    const footerHeight = 10;
    const contentWidth = pageWidth - (margin * 2);
    const contentHeight = pageHeight - (margin * 2) - headerHeight - footerHeight;

    // Validate content area
    if (contentWidth <= 0 || contentHeight <= 0) {
      console.error('Content area too small');
      Modal.showError('Paper size too small for this layout.');
      return;
    }

    // Calculate scale to fit canvas
    const scale = Math.min(contentWidth / canvasWidth, contentHeight / canvasHeight);
    
    if (scale <= 0 || !isFinite(scale)) {
      console.error('Invalid scale:', scale);
      Modal.showError('Cannot fit layout on page.');
      return;
    }

    const imgWidth = canvasWidth * scale;
    const imgHeight = canvasHeight * scale;
    const imgX = margin + (contentWidth - imgWidth) / 2;
    const imgY = margin + headerHeight + (contentHeight - imgHeight) / 2;

    // Export canvas at 3x for 300 DPI
    const imgData = this.canvasManager.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 3
    });

    if (!imgData || imgData.length < 100) {
      console.error('Failed to generate canvas image');
      Modal.showError('Failed to generate PDF');
      return;
    }

    // === HEADER AREA (reserved for future customization) ===
    // TODO: Add logo, company branding, contact info here
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(40);
    const title = this.state.get('metadata.projectName') || 'Garage Layout Plan';
    pdf.text(title, margin, margin + 8);
    
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, margin + 15);

    // === CANVAS IMAGE ===
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight, undefined, 'FAST');

    // === FOOTER AREA ===
    const footerY = pageHeight - margin - 5;
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    
    const currentFloorPlan = this.state.get('floorPlan');
    if (currentFloorPlan && currentFloorPlan.widthFt && currentFloorPlan.heightFt) {
      const specs = `Floor Plan: ${currentFloorPlan.widthFt}' × ${currentFloorPlan.heightFt}' (${currentFloorPlan.area || 0} sq ft) | Occupied: ${this.calculateOccupancy().toFixed(1)}%`;
      pdf.text(specs, margin, footerY);
    }
    
    pdf.text('Generated by Garage Layout Planner', pageWidth - margin, footerY, { align: 'right' });

    // PDF metadata
    pdf.setProperties({
      title: title,
      subject: 'Garage Layout Design',
      author: 'Garage Layout Planner',
      keywords: 'garage, layout, plan, design, storage',
      creator: 'Garage Layout Planner'
    });

    // Save
    const filename = `${this.state.get('metadata.projectName') || 'garage_layout'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);

    console.log(`PDF exported: ${pdfOptions.format}, ${pdfOptions.orientation}, 300 DPI`);
    Modal.showSuccess('PDF exported successfully!');
    this.eventBus.emit('export:pdf:complete', { filename, format: pdfOptions.format, orientation: pdfOptions.orientation });
    
    return pdf;
  }

  /**
   * Calculate occupancy percentage
   */
  calculateOccupancy() {
    const floorPlan = this.state.get('floorPlan');
    if (!floorPlan) return 0;

    const totalArea = floorPlan.widthFt * floorPlan.heightFt;
    const items = this.state.get('items') || [];
    const occupiedArea = items.reduce((sum, item) => sum + (item.lengthFt * item.widthFt), 0);

    return (occupiedArea / totalArea) * 100;
  }

  /**
   * Generate thumbnail
   */
  generateThumbnail(width = 200, height = 150) {
    return this.canvasManager.toDataURL({
      multiplier: 1,
      format: 'png',
      width: width,
      height: height
    });
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ExportManager = ExportManager;
}
