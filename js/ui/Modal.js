/**
 * Modal and Toast UI System
 */
class Modal {
  static showConfirm(title, message) {
    return new Promise((resolve) => {
      // Guard: Prevent multiple confirms from opening simultaneously
      if (Modal._currentConfirm) {
        console.warn('[Modal] Confirm already open, returning false');
        resolve(false);
        return;
      }

      // CRITICAL FIX: Remove any orphaned modal overlays before creating new one
      const existingOverlays = document.querySelectorAll('.modal-overlay');
      if (existingOverlays.length > 0) {
        console.warn('[Modal] Found', existingOverlays.length, 'existing overlays, removing them');
        existingOverlays.forEach(o => o.remove());
      }

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.display = 'flex';

      // Mark that a confirm is currently open
      Modal._currentConfirm = true;

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
          <button class="modal-btn modal-btn-primary" data-action="confirm">Confirm</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const handleClose = (confirmed) => {
        document.removeEventListener('keydown', keyHandler);
        // Clear the confirm guard flag
        Modal._currentConfirm = false;
        overlay.remove();
        resolve(confirmed);
      };

      const keyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          handleClose(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handleClose(false);
        }
      };

      modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
        handleClose(true);
      });

      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        handleClose(false);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose(false);
      });

      document.addEventListener('keydown', keyHandler);
    });
  }

  static showPrompt(title, message, defaultValue = '') {
    return new Promise((resolve) => {
      console.log('[Modal] showPrompt called with title:', title, '| Stack trace:', new Error().stack);
      
      // Guard: Prevent multiple prompts from opening simultaneously
      if (Modal._currentPrompt) {
        console.warn('[Modal] ⚠️ BLOCKED: Prompt already open, returning null');
        console.warn('[Modal] Blocked prompt was:', title);
        resolve(null);
        return;
      }

      console.log('[Modal] ✓ Opening prompt:', title);
      
      // CRITICAL FIX: Remove any orphaned modal overlays before creating new one
      const existingOverlays = document.querySelectorAll('.modal-overlay');
      if (existingOverlays.length > 0) {
        console.warn('[Modal] Found', existingOverlays.length, 'existing overlays, removing them');
        existingOverlays.forEach(o => o.remove());
      }
      
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.display = 'flex';

      // Preserve scroll position before locking body
      const scrollY = window.scrollY;
      document.body.style.top = `-${scrollY}px`;
      document.body.classList.add('modal-open');

      // Mark that a prompt is currently open
      Modal._currentPrompt = true;

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
          <input type="text" class="modal-input" value="${defaultValue}" autofocus>
        </div>
        <div class="modal-footer">
          <button class="modal-btn modal-btn-secondary" data-action="cancel">Cancel</button>
          <button class="modal-btn modal-btn-primary" data-action="ok">OK</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const input = modal.querySelector('.modal-input');
      
      // Mobile keyboard detection
      const handleInputFocus = () => {
        // Add keyboard-aware styling when input is focused on mobile
        if (window.innerWidth <= 767) {
          overlay.classList.add('modal-overlay--keyboard');
        }
      };

      const handleInputBlur = () => {
        // Remove keyboard styling when input loses focus
        overlay.classList.remove('modal-overlay--keyboard');
      };

      input.addEventListener('focus', handleInputFocus);
      input.addEventListener('blur', handleInputBlur);

      input.focus();
      input.select();

      const handleClose = (value) => {
        console.log('[Modal] Closing prompt, value:', value);
        document.removeEventListener('keydown', keyHandler);
        input.removeEventListener('focus', handleInputFocus);
        input.removeEventListener('blur', handleInputBlur);
        
        // Restore scroll position
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
        
        // Clear the prompt guard flag
        Modal._currentPrompt = false;
        // Track last prompt close time (used by mobile tap guards)
        Modal._lastPromptClosedAt = Date.now();
        console.log('[Modal] ✓ Prompt closed, guard flag cleared');
        
        // Check if overlay still exists before removing
        if (overlay && overlay.parentNode) {
          console.log('[Modal] Removing overlay from DOM');
          overlay.remove();
        } else {
          console.warn('[Modal] ⚠️ Overlay already removed or not in DOM');
        }
        
        resolve(value);
      };

      const keyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          handleClose(input.value || null);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handleClose(null);
        }
      };

      modal.querySelector('[data-action="ok"]').addEventListener('click', () => {
        handleClose(input.value || null);
      });

      modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
        handleClose(null);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose(null);
      });

      document.addEventListener('keydown', keyHandler);
    });
  }

  static show(title, content) {
    return new Promise((resolve) => {
      // Guard: Close any existing modal before opening new one
      if (Modal._currentModal) {
        console.warn('Modal already open, closing previous modal');
        Modal.close();
      }

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.display = 'flex';

      const modal = document.createElement('div');
      modal.className = 'modal';

      // Create modal structure
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.innerHTML = `<h3 class="modal-title">${title}</h3>`;

      const body = document.createElement('div');
      body.className = 'modal-body';

      // Append content (can be string or DOM element)
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else {
        body.appendChild(content);
      }

      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.innerHTML = `
        <button class="modal-btn modal-btn-secondary" data-action="close">Close</button>
      `;

      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const handleClose = () => {
        document.removeEventListener('keydown', keyHandler);
        overlay.remove();
        Modal._currentModal = null;
        resolve(true);
      };

      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        }
      };

      // Store reference for Modal.close() - including keyHandler for proper cleanup
      Modal._currentModal = {
        overlay,
        resolve,
        keyHandler,
      };

      footer.querySelector('[data-action="close"]').addEventListener('click', handleClose);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) handleClose();
      });

      document.addEventListener('keydown', keyHandler);
    });
  }

  static close() {
    if (Modal._currentModal) {
      const { overlay, resolve, keyHandler } = Modal._currentModal;

      // Clean up event listener if keyHandler exists
      if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
      }

      overlay.remove();
      Modal._currentModal = null;
      resolve(true);
    }
  }

  static showToast(message, type = 'success', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  static showSuccess(message) {
    this.showToast(message, 'success');
  }

  static showError(message) {
    this.showToast(message, 'error');
  }

  static showInfo(message) {
    this.showToast(message, 'info');
  }
}

if (typeof window !== 'undefined') {
  window.Modal = Modal;
}
