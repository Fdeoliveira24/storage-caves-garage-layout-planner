/* global App */

/**
 * Main Entry Point
 * Initialize application when DOM is ready
 */
(function () {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  function initApp() {
    console.log('DOM ready, starting application...');

    // Create and initialize app
    const app = new App();
    app.init().catch((error) => {
      console.error('Failed to initialize application:', error);
      showError('Failed to initialize application. Please refresh the page.');
    });

    // Make app globally available
    window.app = app;
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }
})();
