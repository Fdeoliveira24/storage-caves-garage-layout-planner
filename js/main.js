/* global App */

(function () {
  const REQUIRED_GLOBALS = ['fabric', 'Config', 'EventBus', 'State', 'App'];
  let hasBootstrapped = false;

  const setupFabricDefaults = (() => {
    let applied = false;
    return function () {
      if (applied || typeof fabric === 'undefined') return;
      applied = true;

      if (fabric.Text && typeof fabric.Text.prototype.toObject === 'function') {
        const originalToObject = fabric.Text.prototype.toObject;
        fabric.Text.prototype.toObject = function (propertiesToInclude) {
          return originalToObject.call(this, propertiesToInclude);
        };
        fabric.Text.prototype.textBaseline = 'alphabetic';
      }

      if (typeof CanvasRenderingContext2D !== 'undefined') {
        const proto = CanvasRenderingContext2D.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'textBaseline');
        if (descriptor && descriptor.configurable) {
          Object.defineProperty(proto, 'textBaseline', {
            get: descriptor.get,
            set(value) {
              const normalized = value === 'alphabetical' ? 'alphabetic' : value;
              descriptor.set.call(this, normalized);
            },
          });
        }
      }
    };
  })();

  function reportMissingDependencies(missing) {
    const message =
      'Garage Planner failed to load:\n' +
      missing.join(', ') +
      '\n\nPlease refresh the page. If the problem persists, verify all files exist on the server.';
    console.error(message);
    alert(message);
  }

  function startApplication() {
    if (hasBootstrapped) return;
    hasBootstrapped = true;

    const missing = REQUIRED_GLOBALS.filter((key) => typeof window[key] === 'undefined');
    if (missing.length) {
      reportMissingDependencies(missing);
      return;
    }

    setupFabricDefaults();

    try {
      const app = new App();
      app.init();
      window.app = app;
      const loadingEl = document.getElementById('app-loading');
      if (loadingEl) {
        loadingEl.style.opacity = '0';
        setTimeout(() => loadingEl.remove(), 300);
      }
    } catch (err) {
      console.error('Error during App.init():', err);
      alert('Garage Planner hit an error during startup. Please check the console logs.');
      return;
    }

  }

  function queueBootstrap() {
    if (window.fabric) {
      startApplication();
      return;
    }

    if (Array.isArray(window.__fabricReadyCallbacks)) {
      window.__fabricReadyCallbacks.push(startApplication);
    } else {
      window.addEventListener('load', () => {
        if (window.fabric) {
          startApplication();
        } else {
          reportMissingDependencies(['Fabric.js']);
        }
      });
    }
  }

  queueBootstrap();
})();
