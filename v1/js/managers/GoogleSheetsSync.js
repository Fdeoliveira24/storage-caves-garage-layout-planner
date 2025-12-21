/* global Modal, Config */

/**
 * Google Sheets Sync Manager
 * Handles bidirectional sync between ClientCMS and Google Sheets
 * 
 * Features:
 * - Manual sync (user-triggered)
 * - Auto-sync with 2-minute debounce (user can enable/disable)
 * - Status indicators (syncing, success, error)
 * - Error handling with fallback to manual sync
 */
class GoogleSheetsSync {
  constructor(clientCMS, eventBus) {
    this.clientCMS = clientCMS;
    this.eventBus = eventBus;
    
    // Configuration - CORS FIX VERSION
    this.webAppUrl = 'https://script.google.com/macros/s/AKfycbyAtAAQ1oyHiXaxgve4uCXoHq2uKyKiEJjZGQt-pvSzB4nnfpV-b5O9of_iZp99GfiKGQ/exec';
    this.autoSyncEnabled = false;
    this.autoSyncDelay = 120000; // 2 minutes (120000ms)
    this.autoSyncTimer = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.lastSyncStatus = null; // 'success', 'error', or null
    this.isLocalDevelopment = this.detectLocalDevelopment();
    
    // Load settings from storage
    this.loadSettings();
    
    // Initialize connection indicator
    setTimeout(() => this.updateConnectionIndicator(), 100);
    
    // Initialize sync status
    this.updateSyncStatus(this.isLocalDevelopment ? 'disconnected' : 'connected');
    
    // Make sync status clickable to open settings
    this.initSyncStatusClick();
  }

  /**
   * Detect if running in local development environment
   */
  detectLocalDevelopment() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.startsWith('192.168.') ||
           window.location.protocol === 'file:';
  }

  /**
   * Initialize sync status click handler
   */
  initSyncStatusClick() {
    const indicator = document.getElementById('sheets-sync-status');
    if (indicator) {
      indicator.style.cursor = 'pointer';
      indicator.addEventListener('click', () => {
        this.showSettingsModal();
      });
    }
  }

  /**
   * Load sync settings from storage
   */
  loadSettings() {
    const settings = this.getStorageItem('garage-planner-sheets-config');
    if (settings) {
      this.webAppUrl = settings.webAppUrl || this.webAppUrl;
      this.autoSyncEnabled = settings.autoSyncEnabled || false;
      this.autoSyncDelay = settings.autoSyncDelay || 120000;
    }
  }

  /**
   * Save sync settings to storage
   */
  saveSettings() {
    const settings = {
      webAppUrl: this.webAppUrl,
      autoSyncEnabled: this.autoSyncEnabled,
      autoSyncDelay: this.autoSyncDelay,
      lastSyncTime: this.lastSyncTime,
      lastSyncStatus: this.lastSyncStatus
    };
    this.setStorageItem('garage-planner-sheets-config', settings);
  }

  /**
   * Update connection indicator
   */
  updateConnectionIndicator() {
    const indicator = document.getElementById('sheets-connection-indicator');
    if (!indicator) return;
    
    indicator.className = 'connection-indicator';
    
    if (this.webAppUrl && this.webAppUrl.includes('script.google.com')) {
      indicator.classList.add('connected');
      indicator.title = 'Google Sheets connected';
    } else {
      indicator.classList.add('disconnected');
      indicator.title = 'Google Sheets not configured';
    }
  }

  /**
   * Enable auto-sync
   */
  enableAutoSync() {
    this.autoSyncEnabled = true;
    this.saveSettings();
    this.eventBus?.emit?.('sheets:autosync:enabled');
    Modal.showSuccess('Auto-sync enabled (2-minute delay)');
  }

  /**
   * Disable auto-sync
   */
  disableAutoSync() {
    this.autoSyncEnabled = false;
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    this.saveSettings();
    this.eventBus?.emit?.('sheets:autosync:disabled');
    Modal.showSuccess('Auto-sync disabled');
  }

  /**
   * Schedule auto-sync (debounced)
   */
  scheduleAutoSync() {
    if (!this.autoSyncEnabled) return;

    // Clear existing timer
    if (this.autoSyncTimer) {
      clearTimeout(this.autoSyncTimer);
    }

    // Schedule new sync
    this.autoSyncTimer = setTimeout(() => {
      this.syncToSheets();
    }, this.autoSyncDelay);
  }

  /**
   * Manual sync to Google Sheets (user-triggered)
   * CORS FIX: Uses GET with URL parameters instead of POST with JSON body
   */
  async syncToSheets() {
    if (this.isSyncing) {
      Modal.showInfo('Sync already in progress...');
      return false;
    }

    this.isSyncing = true;
    this.updateSyncStatus('syncing');

    try {
      const clients = this.clientCMS.clients;

      // CORS FIX: Send data as URL parameter instead of POST body
      const dataParam = encodeURIComponent(JSON.stringify(clients));
      const url = `${this.webAppUrl}?action=sync&data=${dataParam}`;

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.lastSyncTime = new Date().toISOString();
        this.lastSyncStatus = 'success';
        this.saveSettings();
        this.updateSyncStatus('success');
        
        Modal.showSuccess(`✅ Synced ${clients.length} client(s) to Google Sheets`);
        this.eventBus?.emit?.('sheets:sync:success', result);
        
        return true;
      } else {
        throw new Error(result.message || 'Sync failed');
      }

    } catch (error) {
      console.error('[GoogleSheetsSync] Sync error:', error);
      this.lastSyncStatus = 'error';
      this.saveSettings();
      this.updateSyncStatus('error');
      
      Modal.showError(`Sync failed: ${error.message}`);
      this.eventBus?.emit?.('sheets:sync:error', error);
      
      return false;

    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch clients from Google Sheets
   * CORS FIX: Uses simple GET request with action parameter
   */
  async fetchFromSheets() {
    if (this.isSyncing) {
      Modal.showInfo('Sync already in progress...');
      return null;
    }

    this.isSyncing = true;
    this.updateSyncStatus('syncing');

    try {
      const response = await fetch(`${this.webAppUrl}?action=fetch`, {
        method: 'GET',
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        this.lastSyncTime = new Date().toISOString();
        this.lastSyncStatus = 'success';
        this.saveSettings();
        this.updateSyncStatus('success');
        
        const clients = result.data || [];
        Modal.showSuccess(`✅ Fetched ${clients.length} client(s) from Google Sheets`);
        this.eventBus?.emit?.('sheets:fetch:success', clients);
        
        return clients;
      } else {
        throw new Error(result.message || 'Fetch failed');
      }

    } catch (error) {
      console.error('[GoogleSheetsSync] Fetch error:', error);
      this.lastSyncStatus = 'error';
      this.saveSettings();
      this.updateSyncStatus('error');
      
      Modal.showError(`Fetch failed: ${error.message}`);
      this.eventBus?.emit?.('sheets:fetch:error', error);
      
      return null;

    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Update sync status indicator in UI
   */
  updateSyncStatus(status) {
    const indicator = document.getElementById('sheets-sync-status');
    const statusText = document.getElementById('sheets-status-text');
    if (!indicator || !statusText) return;

    // Reset classes
    indicator.className = 'sheets-sync-status';
    
    if (status === 'syncing') {
      indicator.classList.add('syncing');
      statusText.textContent = 'Syncing...';
    } else if (status === 'connected') {
      indicator.classList.add('connected');
      statusText.textContent = 'Connected';
    } else if (status === 'success') {
      indicator.classList.add('connected');
      statusText.textContent = 'Synced';
      
      // Clear success indicator after 3 seconds
      setTimeout(() => {
        if (this.isLocalDevelopment) {
          this.updateSyncStatus('disconnected');
        } else {
          this.updateSyncStatus('connected');
        }
      }, 3000);
      
    } else if (status === 'error') {
      indicator.classList.add('error');
      statusText.textContent = 'Sync Error';
      
      // Clear error indicator after 5 seconds
      setTimeout(() => {
        if (this.isLocalDevelopment) {
          this.updateSyncStatus('disconnected');
        } else {
          this.updateSyncStatus('connected');
        }
      }, 5000);
    } else if (status === 'disconnected') {
      indicator.classList.add('disconnected');
      if (this.isLocalDevelopment) {
        statusText.textContent = 'Local Dev Mode';
      } else {
        statusText.textContent = 'Not Connected';
      }
    }
  }

  /**
   * Show sync settings modal
   */
  async showSettingsModal() {
    const modalHtml = `
      <div class="sheets-settings-container">
        <div class="setting-group">
          <label class="checkbox-container">
            <input type="checkbox" id="auto-sync-checkbox" ${this.autoSyncEnabled ? 'checked' : ''}>
            <span class="checkbox-text">Enable Auto-Sync (2-minute delay after changes)</span>
          </label>
        </div>

        <div class="setting-info">
          <h4>Sync Behavior:</h4>
          <ul>
            <li>When enabled, changes automatically sync after 2 minutes of inactivity</li>
            <li>You can always trigger manual sync with the "Sync Now" button</li>
            <li>Sync status shows in the toolbar</li>
          </ul>
        </div>

        ${this.lastSyncTime ? `
          <div class="sync-status">
            <h4>Last Sync:</h4>
            <p><strong>Time:</strong> ${new Date(this.lastSyncTime).toLocaleString()}</p>
            <p>
              <strong>Status:</strong>
              <span class="status-badge status-${this.lastSyncStatus}">
                ${this.lastSyncStatus === 'success'
                  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg><span>Success</span>'
                  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>Error</span>'}
              </span>
            </p>
          </div>
        ` : ''}

        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="sheets-cancel-btn">Cancel</button>
          <button type="button" class="btn-primary" id="sheets-save-btn">Save Settings</button>
        </div>
      </div>
    `;

    Modal.show('Google Sheets Sync', modalHtml);

    return new Promise((resolve) => {
      const saveBtn = document.getElementById('sheets-save-btn');
      const cancelBtn = document.getElementById('sheets-cancel-btn');

      if (saveBtn) {
        saveBtn.onclick = () => {
          const autoSyncCheckbox = document.getElementById('auto-sync-checkbox');
          const newAutoSyncEnabled = autoSyncCheckbox?.checked || false;
          
          if (newAutoSyncEnabled !== this.autoSyncEnabled) {
            if (newAutoSyncEnabled) {
              this.enableAutoSync();
            } else {
              this.disableAutoSync();
            }
          }

          this.saveSettings();
          Modal.close && Modal.close();
          resolve(true);
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          Modal.close && Modal.close();
          resolve(false);
        };
      }
    });
  }

  /**
   * Storage helpers (with fallback)
   */
  getStorageItem(key) {
    if (window.Storage && window.Storage.load) {
      return window.Storage.load(key);
    }
    const item = localStorage.getItem(key);
    try {
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }

  setStorageItem(key, value) {
    if (window.Storage && window.Storage.save) {
      window.Storage.save(key, value);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  /**
   * Get sync status for display
   */
  getSyncStatusText() {
    if (this.isSyncing) {
      return 'Syncing...';
    }
    if (this.lastSyncTime) {
      const time = new Date(this.lastSyncTime);
      const now = new Date();
      const diffMinutes = Math.floor((now - time) / 60000);
      
      if (diffMinutes < 1) {
        return 'Synced just now';
      } else if (diffMinutes < 60) {
        return `Synced ${diffMinutes} min ago`;
      } else {
        return `Synced ${time.toLocaleTimeString()}`;
      }
    }
    return 'Never synced';
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.GoogleSheetsSync = GoogleSheetsSync;
}