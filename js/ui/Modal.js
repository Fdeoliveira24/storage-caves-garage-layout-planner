/**
 * Modal and Toast UI System
 */
class Modal {
  static showConfirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.display = 'flex';

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
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.display = 'flex';

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
      input.focus();
      input.select();

      const handleClose = (value) => {
        document.removeEventListener('keydown', keyHandler);
        overlay.remove();
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
        keyHandler
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
