/* global Helpers, Modal */

/**
 * Export Manager
 * Handles JSON, PNG, and PDF exports and imports
 */
class ExportManager {
  constructor(state, eventBus, canvasManager) {
    this.state = state;
    this.eventBus = eventBus;
    this.canvasManager = canvasManager;
    this.logoMeta = null;
  }

  /**
   * Export as JSON
   */
  exportJSON() {
    const state = this.state.getState();

    const exportData = {
      version: '1.3.0',
      exported: new Date().toISOString(),
      metadata: state.metadata,
      floorPlan: state.floorPlan,
      items: state.items.map((item) => ({
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
        color: item.color,
      })),
      settings: state.settings,
    };

    const json = JSON.stringify(exportData, null, 2);
    const safeName = Helpers.sanitizeFilename(state.metadata.projectName || 'layout', 'layout');
    const filename = `${safeName}-${Date.now()}.json`;

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
      quality: 1,
    });

    console.log('Data URL length:', dataURL.length);

    if (!dataURL || dataURL.length < 100) {
      console.error('Failed to generate canvas image');
      Modal.showError('Failed to export PNG');
      return;
    }

    // Format: "Project Name_YYYY-MM-DD_Buford-GA.png"
    const projectName = this.state.get('metadata.projectName') || 'Untitled Layout';
    const safeProjectName = Helpers.sanitizeFilename(projectName, 'Untitled_Layout');
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `${safeProjectName}_${date}_Buford-GA.png`;

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
    const pdfOptions = { ...options, unit: 'mm', compress: true };

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
    const headerHeight = 40; // Reserved for branding + project details
    const footerHeight = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2 - headerHeight - footerHeight;

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
      multiplier: 3,
    });

    if (!imgData || imgData.length < 100) {
      console.error('Failed to generate canvas image');
      Modal.showError('Failed to generate PDF');
      return;
    }

    // === HEADER AREA ===
    const title = this.state.get('metadata.projectName') || 'Garage Layout Plan';
    let logoBlockHeight = 0;
    try {
      const logoMeta = await this.getLogoMeta();
      if (logoMeta?.dataUrl) {
        const maxLogoWidth = 50;
        const aspect = logoMeta.width && logoMeta.height ? logoMeta.height / logoMeta.width : 0.3;
        const logoWidth = maxLogoWidth;
        const logoHeight = Math.max(10, logoWidth * aspect);
        pdf.addImage(logoMeta.dataUrl, 'PNG', margin, margin, logoWidth, logoHeight, undefined, 'FAST');
        logoBlockHeight = logoHeight;
      }
    } catch (logoError) {
      console.warn('Unable to load logo for PDF header', logoError);
    }

    const headerTextX = pageWidth - margin;
    const titleBaseline = margin + Math.max(logoBlockHeight, 10);
    const dateBaseline = titleBaseline + 6;

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(40);
    pdf.text(title, headerTextX, titleBaseline, { align: 'right' });

    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, headerTextX, dateBaseline, { align: 'right' });

    // === CANVAS IMAGE ===
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight, undefined, 'FAST');

    // === FOOTER AREA ===
    const footerY = pageHeight - margin - 5;
    pdf.setFontSize(8);
    pdf.setTextColor(120);

    const currentFloorPlan = this.state.get('floorPlan');
    const items = this.state.get('items') || [];
    const itemCount = items.length;
    const itemNames = items.map((item) => item.label || item.itemId).filter(Boolean);
    const occupancy = currentFloorPlan ? this.calculateOccupancy().toFixed(1) : null;

    const planLines = [];
    if (currentFloorPlan) {
      const planName =
        currentFloorPlan.name || currentFloorPlan.label || `${currentFloorPlan.widthFt}' × ${currentFloorPlan.heightFt}'`;
      planLines.push(`Floor Plan: ${planName}`);

      const sizeParts = [];
      if (currentFloorPlan.widthFt && currentFloorPlan.heightFt) {
        sizeParts.push(`Dimensions: ${currentFloorPlan.widthFt}' × ${currentFloorPlan.heightFt}'`);
      }
      if (currentFloorPlan.area) {
        sizeParts.push(`Area: ${currentFloorPlan.area} sq ft`);
      }
      if (occupancy) {
        sizeParts.push(`Occupied: ${occupancy}%`);
      }
      if (sizeParts.length) {
        planLines.push(sizeParts.join(' | '));
      }
      if (currentFloorPlan.description) {
        planLines.push(`Details: ${currentFloorPlan.description}`);
      }
    }

    planLines.push(`Items Selected: ${itemCount}`);
    if (itemNames.length) {
      const namesWrapped = pdf.splitTextToSize(`Items: ${itemNames.join(', ')}`, contentWidth / 2);
      planLines.push(...namesWrapped);
    }

    let leftY = footerY - (planLines.length - 1) * 4;
    planLines.forEach((line) => {
      pdf.text(line, margin, leftY);
      leftY += 4;
    });

    const contactLines = [
      'Storage Caves',
      'Location: Buford, GA',
      '6034 Lanier Islands Parkway, Buford, Georgia',
      'Corporate Office: 721 S. Parker St., Suite 190, Orange, CA 92868',
      'Email: info@storagecaves.com',
      'Web: www.storagecaves.com',
      'Phone: 1-844-992-2837',
    ];
    let contactY = footerY - (contactLines.length - 1) * 4;
    contactLines.forEach((line) => {
      pdf.text(line, pageWidth - margin, contactY, { align: 'right' });
      contactY += 4;
    });

    // PDF metadata
    pdf.setProperties({
      title: title,
      subject: 'Garage Layout Design',
      author: 'Garage Layout Planner',
      keywords: 'garage, layout, plan, design, storage',
      creator: 'Garage Layout Planner',
    });

    // Save
    // Format: "Project Name_YYYY-MM-DD.pdf"
    const projectName = this.state.get('metadata.projectName') || 'Untitled Layout';
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const safeProjectName = Helpers.sanitizeFilename(projectName, 'Untitled_Layout');
    const filename = `${safeProjectName}_${date}_Buford-GA.pdf`;
    pdf.save(filename);

    console.log(`PDF exported: ${pdfOptions.format}, ${pdfOptions.orientation}, 300 DPI`);
    Modal.showSuccess('PDF exported successfully!');
    this.eventBus.emit('export:pdf:complete', {
      filename,
      format: pdfOptions.format,
      orientation: pdfOptions.orientation,
    });

    return pdf;
  }

  /**
   * Load company logo as data URL for embedding into PDF
   * Caches the result to avoid multiple fetches per session
   */
  async getLogoMeta() {
    if (this.logoMeta) return this.logoMeta;

    const logoPath = 'assets/images/logo/Storage-Caves-Logo.png';
    try {
      const response = await fetch(logoPath, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { width, height } = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
      });
      this.logoMeta = { dataUrl, width, height };
      return this.logoMeta;
    } catch (error) {
      console.warn('Failed to fetch logo asset for PDF header', error);
      return null;
    }
  }

  /**
   * Calculate occupancy percentage
   */
  /**
   * Import from JSON
   * Loads a previously exported layout from JSON file
   */
  async importJSON(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file provided'));
        return;
      }

      if (!file.name.endsWith('.json')) {
        Modal.showError('Please select a valid JSON file');
        reject(new Error('Invalid file type'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const importData = JSON.parse(e.target.result);

          // Validate the imported data structure
          if (!importData.version || !importData.floorPlan || !importData.items) {
            Modal.showError('Invalid layout file format');
            reject(new Error('Invalid JSON structure'));
            return;
          }

          // Load the floor plan first
          if (importData.floorPlan) {
            this.state.set('floorPlan', importData.floorPlan);
            this.eventBus.emit('floorplan:loaded', importData.floorPlan);
          }

          // Load settings if available
          if (importData.settings) {
            Object.keys(importData.settings).forEach((key) => {
              this.state.set(`settings.${key}`, importData.settings[key]);
            });
          }

          // Load metadata if available
          if (importData.metadata) {
            Object.keys(importData.metadata).forEach((key) => {
              this.state.set(`metadata.${key}`, importData.metadata[key]);
            });
          }

          // Clear existing items and load new ones
          this.state.set('items', []);
          this.eventBus.emit('items:cleared');

          // Add imported items
          if (importData.items && importData.items.length > 0) {
            importData.items.forEach((itemData) => {
              this.eventBus.emit('item:add:imported', itemData);
            });
          }

          Modal.showSuccess(
            `Layout "${importData.metadata?.projectName || 'Untitled'}" imported successfully!`,
          );
          this.eventBus.emit('import:json:complete', importData);
          resolve(importData);
        } catch (error) {
          console.error('Error parsing JSON:', error);
          Modal.showError('Failed to parse JSON file');
          reject(error);
        }
      };

      reader.onerror = () => {
        Modal.showError('Failed to read file');
        reject(new Error('File read error'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Calculate occupancy percentage
   * @returns {number} Occupancy percentage
   */
  calculateOccupancy() {
    const floorPlan = this.state.get('floorPlan');
    if (!floorPlan) return 0;

    const totalArea = floorPlan.widthFt * floorPlan.heightFt;
    const items = this.state.get('items') || [];
    const occupiedArea = items.reduce((sum, item) => sum + item.lengthFt * item.widthFt, 0);

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
      height: height,
    });
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.ExportManager = ExportManager;
}
