/* File: js/features/ClientCMS.js
 * Enterprise-grade Client Management slide-in panel
 * Figma/Canva-style design with professional UX
 */
/* global Modal, Config, flatpickr */
(function (window) {
  'use strict';

  // Storage keys
  const STORAGE_KEYS = (window.Config && Config.STORAGE_KEYS) || {};
  const STORAGE_KEY_CLIENTS = STORAGE_KEYS.clients || 'storage-caves-clients';
  const STORAGE_KEY_LAYOUTS = STORAGE_KEYS.layouts || 'garage-planner-layouts';
  const STORAGE_KEY_ACTIVE_LAYOUT = STORAGE_KEYS.activeLayout || 'garage-planner-active-layout';

  // Check if Storage utility exists
  const hasStorage = () =>
    typeof window.Storage !== 'undefined' &&
    window.Storage &&
    typeof window.Storage.save === 'function';

  // Check if Modal exists
  const hasModal = () => typeof window.Modal !== 'undefined' && window.Modal;

  // Safe JSON helpers
  const safeJSON = {
    parse(str, fallback = null) {
      try {
        return JSON.parse(str) ?? fallback;
      } catch {
        return fallback;
      }
    },
    stringify(obj) {
      try {
        return JSON.stringify(obj);
      } catch {
        return '[]';
      }
    },
  };

  // Unique ID generator - shorter format
  const uid = (prefix = 'client') => {
    const timestamp = Date.now().toString(36); // Base36 timestamp (shorter)
    const random = Math.random().toString(36).slice(2, 5); // 3 chars instead of 6
    return `${prefix}-${timestamp}-${random}`;
  };

  // Download helper
  function downloadFile(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  // CSV helpers
  function toCSV(rows) {
    const headers = ['name', 'email', 'phone', 'unitPreference', 'notes', 'followUpDate'];
    const escape = (s = '') => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [headers.join(',')];
    rows.forEach((r) => {
      lines.push(
        [
          escape(r.name),
          escape(r.email || ''),
          escape(r.phone || ''),
          escape(r.unitPreference || ''),
          escape(r.notes || ''),
          escape(r.followUpDate || ''),
        ].join(','),
      );
    });
    return lines.join('\n');
  }

  function fromCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      const cols = [];
      let cur = '';
      let inQ = false;
      for (let j = 0; j < row.length; j++) {
        const ch = row[j];
        if (inQ) {
          if (ch === '"' && row[j + 1] === '"') {
            cur += '"';
            j++;
          } else if (ch === '"') {
            inQ = false;
          } else {
            cur += ch;
          }
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ',') {
            cols.push(cur);
            cur = '';
          } else {
            cur += ch;
          }
        }
      }
      cols.push(cur);
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = (cols[idx] ?? '').trim()));
      out.push(obj);
    }
    return out;
  }

  // HTML escape helpers with XSS protection
  function escapeHTML(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(str = '') {
    return escapeHTML(str);
  }

  // Sanitize email - remove dangerous characters
  function sanitizeEmail(email = '') {
    return String(email)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._+-]/gi, '');
  }

  // Sanitize phone - keep only numbers, spaces, dashes, parens, plus
  function sanitizePhone(phone = '') {
    return String(phone)
      .trim()
      .replace(/[^0-9\s()+-]/g, '');
  }

  // Get initials from name
  function getInitials(name) {
    return (name || 'U')
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  // Get floor plans from Config
  function getFloorPlans() {
    return (window.Config && Config.FLOOR_PLANS) || [];
  }

  // SVG Icons
  const ICONS = {
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    json: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    cloudSync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
  };

  class ClientCMS {
    constructor(appInstance) {
      this.app = appInstance;
      this.state = appInstance?.state || null;
      this.eventBus = appInstance?.eventBus || null;
      this.clients = [];
      this.$panel = null;
      this.$backdrop = null;
      this.$list = null;
      this.$search = null;

      // Google Sheets sync
      this.sheetsSync = null; // Will be initialized after EventBus is available

      // Focus management
      this._lastFocus = null;
      this._focusTrapHandler = this._onFocusTrap.bind(this);

      // Bind handlers
      this._escHandler = this._onEsc.bind(this);
      this._searchHandler = this._onSearch.bind(this);
      this._delegatedClickHandler = this._onListClick.bind(this);
    }

    /**
     * Initialize Google Sheets sync
     * Call this from App.js after ClientCMS is created
     */
    initGoogleSheets(eventBus) {
      if (typeof GoogleSheetsSync !== 'undefined') {
        this.sheetsSync = new GoogleSheetsSync(this, eventBus);
        
        // Hook into save events for auto-sync
        if (this.sheetsSync.autoSyncEnabled) {
          this.sheetsSync.scheduleAutoSync();
        }
      }
    }

    init() {
      // Get or create panel
      this.$panel = document.getElementById('client-cms-panel');
      if (!this.$panel) {
        this.$panel = document.createElement('div');
        this.$panel.id = 'client-cms-panel';
        this.$panel.className = 'client-cms-panel';
        document.body.appendChild(this.$panel);
      }

      // Get or create backdrop
      this.$backdrop = document.getElementById('client-cms-backdrop');
      if (!this.$backdrop) {
        this.$backdrop = document.createElement('div');
        this.$backdrop.id = 'client-cms-backdrop';
        this.$backdrop.className = 'client-cms-backdrop';
        document.body.appendChild(this.$backdrop);
      }

      this._renderBase();
      this._bindStaticEvents();
      this._load();
      this._renderList();

      // Toolbar button
      const btn = document.getElementById('btn-clients');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.toggle();
        });
      }
    }

    open() {
      this._lastFocus = document.activeElement;
      this.$panel.classList.add('open');
      this.$backdrop.classList.add('active');
      document.addEventListener('keydown', this._escHandler);
      document.addEventListener('keydown', this._focusTrapHandler);
    }

    close() {
      this.$panel.classList.remove('open');
      this.$backdrop.classList.remove('active');
      document.removeEventListener('keydown', this._escHandler);
      document.removeEventListener('keydown', this._focusTrapHandler);
      this._closeDropdowns();
      document.getElementById('btn-clients')?.focus();
    }

    toggle() {
      if (this.$panel.classList.contains('open')) this.close();
      else this.open();
    }

    // --- Base UI ---
    _renderBase() {
      this.$panel.innerHTML = `
        <div class="client-cms">
          <div class="client-cms__header">
            <h3 class="client-cms__title">Client Management</h3>
            <button class="client-cms__close" id="client-cms-close" aria-label="Close panel">
              ${ICONS.close}
            </button>
          </div>

          <div class="client-cms__toolbar">
            <div class="client-cms__search-wrapper">
              <span class="client-cms__search-icon">${ICONS.search}</span>
              <input 
                id="client-cms-search" 
                class="client-cms__search" 
                type="search" 
                placeholder="Search clients..." 
                aria-label="Search clients"
              />
            </div>

            <div class="client-cms__actions">
              <button id="client-cms-new" class="cms-btn cms-btn--primary">
                ${ICONS.plus}
                <span>New Client</span>
              </button>

              <div class="cms-dropdown">
                <button class="cms-btn" id="client-cms-import-btn" aria-haspopup="true" aria-expanded="false">
                  ${ICONS.upload}
                  <span>Import</span>
                </button>
                <div class="cms-dropdown__menu" id="client-cms-import-menu">
                  <button class="cms-dropdown__item" id="client-cms-import-json">
                    ${ICONS.json}
                    <span>Import JSON</span>
                  </button>
                  <button class="cms-dropdown__item" id="client-cms-import-csv">
                    ${ICONS.fileText}
                    <span>Import CSV</span>
                  </button>
                </div>
              </div>

              <div class="cms-dropdown">
                <button class="cms-btn" id="client-cms-export-btn" aria-haspopup="true" aria-expanded="false">
                  ${ICONS.download}
                  <span>Export</span>
                </button>
                <div class="cms-dropdown__menu" id="client-cms-export-menu">
                  <button class="cms-dropdown__item" id="client-cms-export-json">
                    ${ICONS.json}
                    <span>Export JSON</span>
                  </button>
                  <button class="cms-dropdown__item" id="client-cms-export-csv">
                    ${ICONS.fileText}
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              <div class="cms-dropdown">
                <button class="cms-btn" id="client-cms-sheets-btn" aria-haspopup="true" aria-expanded="false">
                  ${ICONS.cloudSync}
                  <span>Google Sheets</span>
                </button>
                <div class="cms-dropdown__menu" id="client-cms-sheets-menu">
                  <button class="cms-dropdown__item" id="client-cms-sheets-sync">
                    ${ICONS.cloudSync}
                    <span>Sync to Google Sheets</span>
                  </button>
                  <button class="cms-dropdown__item" id="client-cms-sheets-fetch">
                    ${ICONS.download}
                    <span>Fetch from Google Sheets</span>
                  </button>
                  <div class="cms-dropdown__divider"></div>
                  <button class="cms-dropdown__item" id="client-cms-sheets-settings">
                    ${ICONS.edit}
                    <span>Sync Settings</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="client-cms__list" id="client-cms-list" aria-live="polite"></div>
        </div>
      `;
    }

    _bindStaticEvents() {
      // Close button
      this.$panel.querySelector('#client-cms-close').addEventListener('click', () => this.close());
      this.$backdrop.addEventListener('click', () => this.close());

      // New client
      this.$panel.querySelector('#client-cms-new').addEventListener('click', () => this._openForm());

      // Search
      this.$search = this.$panel.querySelector('#client-cms-search');
      this.$search.addEventListener('input', this._searchHandler);

      // List delegation
      this.$list = this.$panel.querySelector('#client-cms-list');
      this.$list.addEventListener('click', this._delegatedClickHandler);

      // Import/Export buttons
      this.$panel.querySelector('#client-cms-import-json').addEventListener('click', () => {
        this._closeDropdowns();
        this._importJSON();
      });
      this.$panel.querySelector('#client-cms-import-csv').addEventListener('click', () => {
        this._closeDropdowns();
        this._importCSV();
      });
      this.$panel.querySelector('#client-cms-export-json').addEventListener('click', () => {
        this._closeDropdowns();
        this._exportJSON();
      });
      this.$panel.querySelector('#client-cms-export-csv').addEventListener('click', () => {
        this._closeDropdowns();
        this._exportCSV();
      });

      // Dropdown toggles
      this._setupDropdown('client-cms-import-btn', 'client-cms-import-menu');
      this._setupDropdown('client-cms-export-btn', 'client-cms-export-menu');
      this._setupDropdown('client-cms-sheets-btn', 'client-cms-sheets-menu');

      // Google Sheets sync handlers
      this._bindSheetsHandlers();

      // Close dropdowns when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.cms-dropdown')) {
          this._closeDropdowns();
        }
      });
    }

    _bindSheetsHandlers() {
      // Google Sheets sync
      const sheetsSyncBtn = this.$panel.querySelector('#client-cms-sheets-sync');
      if (sheetsSyncBtn) {
        sheetsSyncBtn.addEventListener('click', () => {
          this._closeDropdowns();
          if (this.sheetsSync) {
            this.sheetsSync.syncToSheets();
          } else {
            this._toast('Google Sheets sync not initialized', 'error');
          }
        });
      }

      const sheetsFetchBtn = this.$panel.querySelector('#client-cms-sheets-fetch');
      if (sheetsFetchBtn) {
        sheetsFetchBtn.addEventListener('click', async () => {
          this._closeDropdowns();
          if (!this.sheetsSync) {
            this._toast('Google Sheets sync not initialized', 'error');
            return;
          }
          
          const clients = await this.sheetsSync.fetchFromSheets();
          if (clients && clients.length > 0) {
            // Merge fetched clients with existing ones
            const confirmResult = await Modal.showConfirm(
              'Import from Google Sheets',
              `Found ${clients.length} client(s). Merge with existing clients?`
            );
            
            if (confirmResult) {
              clients.forEach(client => {
                // Ensure client has required structure
                const cleanClient = {
                  id: client.id || this._generateId(),
                  name: client.name || '',
                  email: client.email || '',
                  phone: client.phone || '',
                  unitPreference: client.unitPreference || '',
                  notes: client.notes || '',
                  followUpDate: client.followUpDate || '',
                  layoutIds: Array.isArray(client.layoutIds) ? client.layoutIds : [],
                  createdDate: client.createdDate || new Date().toISOString(),
                  modifiedDate: new Date().toISOString()
                };
                
                const existing = this.clients.find(c => c.id === cleanClient.id);
                if (!existing) {
                  this.clients.push(cleanClient);
                } else {
                  // Update existing client
                  Object.assign(existing, cleanClient);
                }
              });
              this._save();
              this._renderList();
              this._toast(`Imported ${clients.length} client(s)`, 'success');
            }
          }
        });
      }

      const sheetsSettingsBtn = this.$panel.querySelector('#client-cms-sheets-settings');
      if (sheetsSettingsBtn) {
        sheetsSettingsBtn.addEventListener('click', () => {
          this._closeDropdowns();
          if (this.sheetsSync) {
            this.sheetsSync.showSettingsModal();
          } else {
            this._toast('Google Sheets sync not initialized', 'error');
          }
        });
      }
    }

    _generateId() {
      return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    _setupDropdown(btnId, menuId) {
      const btn = this.$panel.querySelector(`#${btnId}`);
      const menu = this.$panel.querySelector(`#${menuId}`);
      if (!btn || !menu) return;

      const onKey = (e) => {
        if (e.key === 'Escape') {
          menu.classList.remove('show');
          btn.setAttribute('aria-expanded', 'false');
          btn.focus();
        }
      };

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('show');

        // Close all dropdowns first
        this._closeDropdowns();

        if (!isOpen) {
          menu.classList.add('show');
          btn.setAttribute('aria-expanded', 'true');
          document.addEventListener('keydown', onKey, { once: true });
        }
      });
    }

    _closeDropdowns() {
      this.$panel.querySelectorAll('.cms-dropdown__menu.show').forEach((m) => {
        m.classList.remove('show');
      });
      this.$panel.querySelectorAll('.cms-dropdown button[aria-expanded="true"]').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
      });
    }

    _onFocusTrap(e) {
      if (e.key !== 'Tab' || !this.$panel.classList.contains('open')) return;
      const focusables = this.$panel.querySelectorAll(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    _onEsc(e) {
      if (e.key === 'Escape') {
        this.close();
        e.stopPropagation();
      }
    }

    _suppressDefaultModalFooter(enable) {
      const modal = document.querySelector('.modal');
      if (!modal) return;
      modal.classList.toggle('client-cms--no-default-footer', !!enable);
    }

    // --- Data ---
    _load() {
      let list = [];
      if (hasStorage()) {
        list = window.Storage.load(STORAGE_KEY_CLIENTS) || [];
      } else {
        list = safeJSON.parse(localStorage.getItem(STORAGE_KEY_CLIENTS), []) || [];
      }
      this.clients = Array.isArray(list) ? list : [];
    }

    _save() {
      if (hasStorage()) {
        window.Storage.save(STORAGE_KEY_CLIENTS, this.clients);
      } else {
        localStorage.setItem(STORAGE_KEY_CLIENTS, safeJSON.stringify(this.clients));
      }
      
      // Trigger auto-sync if enabled
      if (this.sheetsSync && this.sheetsSync.autoSyncEnabled) {
        this.sheetsSync.scheduleAutoSync();
      }
    }

    // --- Render List ---
    _renderList() {
      const q = (this.$search?.value || '').toLowerCase();
      const items = this.clients
        .filter((c) => {
          if (!q) return true;
          return (
            (c.name || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q)
          );
        })
        .sort((a, b) => (b.modifiedDate || '').localeCompare(a.modifiedDate || ''));

      if (!items.length) {
        this.$list.innerHTML = `
          <div class="cms-empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <p class="cms-empty-title">${q ? 'No clients found' : 'No clients yet'}</p>
            <p class="cms-empty-subtitle">${q ? 'Try a different search term' : 'Click "New Client" to add your first client'}</p>
          </div>
        `;
        return;
      }

      const rows = items
        .map(
          (c) => {
            const unitLabel = this._getUnitLabelById(c.unitPreference) || '';
            return `
        <div class="client-cms__card" data-id="${c.id}">
          <div class="client-cms__card-avatar">${getInitials(c.name)}</div>
          <div class="client-cms__card-content">
            <div class="client-cms__card-name">${escapeHTML(c.name)}</div>
            <div class="client-cms__card-meta">
              ${c.email ? `<span class="client-cms__card-meta-item">${ICONS.mail}${escapeHTML(c.email)}</span>` : ''}
              ${c.phone ? `<span class="client-cms__card-meta-item">${ICONS.phone}${escapeHTML(c.phone)}</span>` : ''}
              ${unitLabel ? `<span class="client-cms__card-meta-item">${ICONS.building}${escapeHTML(unitLabel)}</span>` : ''}
            </div>
          </div>
          <div class="client-cms__card-actions client-actions">
            <button class="client-cms__action-btn js-view" data-tooltip="View details">
              ${ICONS.eye}
            </button>
            <button class="client-cms__action-btn js-edit" data-tooltip="Edit client">
              ${ICONS.edit}
            </button>
            <button class="client-cms__action-btn js-assign" data-tooltip="Assign to layout">
              ${ICONS.link}
            </button>
            <button class="client-cms__action-btn client-cms__action-btn--danger js-delete" data-tooltip="Delete">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      `;
          },
        )
        .join('');

      this.$list.innerHTML = rows;
    }

    _onSearch() {
      this._renderList();
    }

    _onListClick(e) {
      const btn = e.target.closest('.client-cms__action-btn');
      if (!btn) return;

      const row = btn.closest('.client-cms__card');
      if (!row) return;

      const id = row.getAttribute('data-id');
      const c = this.clients.find((x) => x.id === id);
      if (!c) return;

      if (btn.classList.contains('js-view')) {
        this._viewClient(c);
      } else if (btn.classList.contains('js-edit')) {
        this._openForm(c);
      } else if (btn.classList.contains('js-delete')) {
        this._deleteClient(c);
      } else if (btn.classList.contains('js-assign')) {
        this._assignClient(c);
      }
    }

    // --- Forms / Modals ---
    _openForm(existing) {
      const isEdit = !!existing;
      const data = existing || {
        id: uid(),
        name: '',
        email: '',
        phone: '',
        unitPreference: '',
        notes: '',
        followUpDate: '',
        layoutIds: [],
      };

      this._unitOptions = this._getAllFloorPlanOptions();
      const unitOptions = this._unitOptions
        .map(
          (fp) =>
            `<option value="${escapeAttr(fp.value)}" ${
              data.unitPreference === fp.value || data.unitPreference === fp.label ? 'selected' : ''
            }>${escapeHTML(fp.label)}</option>`,
        )
        .join('');

      // Get current layout for "Assign Current" button
      const currentLayoutId = this._getCurrentLayoutId();
      const currentLayoutName = this._getCurrentLayoutName();

      // Get assigned layouts with names
      const assignedLayouts = this._getLayoutNamesByIds(data.layoutIds || []);
      const layoutIdsArray = data.layoutIds || [];
      
      const assignedLayoutsHTML = isEdit && assignedLayouts.length > 0
        ? assignedLayouts
            .map((name, idx) => {
              const layoutId = layoutIdsArray[idx];
              return `
                <div class="client-cms-form__layout-tag" data-layout-id="${escapeAttr(layoutId)}">
                  <span>${escapeHTML(name)}</span>
                  <button type="button" class="client-cms-form__layout-remove" data-layout-id="${escapeAttr(layoutId)}">&times;</button>
                </div>
              `;
            })
            .join('')
        : '<span class="client-cms-form__layout-empty">No layouts assigned yet</span>';

      const isCurrentLayoutAssigned = currentLayoutId && layoutIdsArray.includes(currentLayoutId);

      const html = `
        <form id="client-form" class="client-cms-form client-form">
          <div class="client-cms-form__group">
            <label class="client-cms-form__label client-cms-form__label--required" for="cf-name">Name</label>
            <input id="cf-name" name="name" class="client-cms-form__input" type="text" required value="${escapeAttr(data.name)}" placeholder="Enter client name" />
          </div>

          <div class="client-cms-form__row">
            <div class="client-cms-form__group">
              <label class="client-cms-form__label" for="cf-email">Email</label>
              <input id="cf-email" name="email" class="client-cms-form__input" type="email" value="${escapeAttr(data.email || '')}" placeholder="email@example.com" />
            </div>
            <div class="client-cms-form__group">
              <label class="client-cms-form__label" for="cf-phone">Phone</label>
              <input id="cf-phone" name="phone" class="client-cms-form__input" type="tel" value="${escapeAttr(data.phone || '')}" placeholder="(555) 555-5555" />
            </div>
          </div>

          <div class="client-cms-form__row">
            <div class="client-cms-form__group">
              <label class="client-cms-form__label" for="cf-unit">Unit Preference</label>
              <select id="cf-unit" name="unitPreference" class="client-cms-form__select">
                <option value="">Select a unit...</option>
                ${unitOptions}
              </select>
            </div>
            <div class="client-cms-form__group">
              <label class="client-cms-form__label" for="cf-date">Follow-up Date</label>
              <input id="cf-date" name="followUpDate" class="client-cms-form__input" type="text" value="${escapeAttr(data.followUpDate || '')}" placeholder="Select date..." autocomplete="off" />
            </div>
          </div>

          ${
            isEdit
              ? `
          <div class="client-cms-form__group">
            <label class="client-cms-form__label">Assigned Layouts</label>
            <div class="client-cms-form__layouts-list" id="cf-layouts-list">
              ${assignedLayoutsHTML}
            </div>
            ${
              currentLayoutId
                ? `
              <button type="button" class="client-cms-form__layout-assign-btn" id="cf-assign-current" ${isCurrentLayoutAssigned ? 'disabled' : ''}>
                ${isCurrentLayoutAssigned ? 'Current layout already assigned' : '+ Assign current layout'}
              </button>
              <div class="client-cms-form__layout-hint">Current layout: ${escapeHTML(currentLayoutName)}</div>
              `
                : ''
            }
          </div>
          `
              : ''
          }

          <div class="client-cms-form__group client-cms-form__group--notes">
            <label class="client-cms-form__label" for="cf-notes">Notes</label>
            <textarea id="cf-notes" name="notes" class="client-cms-form__textarea" rows="3" maxlength="500" placeholder="Add notes about this client...">${escapeHTML(data.notes || '')}</textarea>
            <span class="client-cms-form__char-count char-count" id="cf-notes-counter">${(data.notes || '').length}/500</span>
            
          </div>
        </form>
      `;

      const onSubmit = () => {
        const form = document.getElementById('client-form');
        if (!form) return;

        const nameInput = form.querySelector('[name="name"]');
        const emailInput = form.querySelector('[name="email"]');
        const phoneInput = form.querySelector('[name="phone"]');
        const unitInput = form.querySelector('[name="unitPreference"]');
        const dateInput = form.querySelector('[name="followUpDate"]');
        const notesInput = form.querySelector('[name="notes"]');

        const rawEmail = emailInput?.value?.trim() || '';
        const rawPhone = phoneInput?.value?.trim() || '';

        const rawDate = dateInput?.value || '';
        let normalizedDate = rawDate;
        if (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          const parsed = new Date(rawDate);
          if (!Number.isNaN(parsed.getTime())) {
            normalizedDate = parsed.toISOString().slice(0, 10);
          }
        }

        const next = {
          id: data.id,
          name: nameInput?.value?.trim() || '',
          email: sanitizeEmail(rawEmail),
          phone: sanitizePhone(rawPhone),
          unitPreference: unitInput?.value?.trim() || '',
          followUpDate: normalizedDate,
          notes: notesInput?.value?.trim() || '',
          createdDate: data.createdDate || new Date().toISOString(),
          modifiedDate: new Date().toISOString(),
          layoutIds: Array.isArray(data.layoutIds) ? data.layoutIds : [],
        };

        if (!next.name) {
          this._toast('Name is required', 'error');
          return;
        }

        if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) {
          this._toast('Invalid email address', 'error');
          return;
        }

        // Validate date is not in the past for new clients
        if (!isEdit && next.followUpDate) {
          const selectedDate = new Date(next.followUpDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            this._toast('Follow-up date cannot be in the past', 'error');
            return;
          }
        }

        const idx = this.clients.findIndex((c) => c.id === next.id);
        if (idx >= 0) this.clients[idx] = next;
        else this.clients.unshift(next);

        this._save();
        this._renderList();
        this._suppressDefaultModalFooter(false);
        if (hasModal() && Modal.close) Modal.close();
        this._toast(isEdit ? 'Client updated' : 'Client created', 'success');
      };

      Modal.show(
        isEdit ? 'Edit Client' : 'New Client',
        `
        ${html}
        <div class="cms-modal-footer">
          <button class="modal-btn modal-btn-secondary" id="client-form-cancel" type="button">Cancel</button>
          <button class="modal-btn modal-btn-primary" id="client-form-submit" type="button">${isEdit ? 'Save Changes' : 'Create Client'}</button>
        </div>
      `,
      );
      this._suppressDefaultModalFooter(true);

      requestAnimationFrame(() => {
        const submitBtn = document.getElementById('client-form-submit');
        const cancelBtn = document.getElementById('client-form-cancel');
        const notesTextarea = document.getElementById('cf-notes');

        submitBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          onSubmit();
        });
        cancelBtn?.addEventListener('click', (e) => {
          e.preventDefault();
          this._suppressDefaultModalFooter(false);
          Modal.close && Modal.close();
        });

        if (notesTextarea) {
          notesTextarea.addEventListener('input', (e) => {
            const len = e.target.value.length;
            const counter = e.target.parentElement.querySelector('.char-count');
            if (!counter) return;
            counter.textContent = `${len}/500`;
            counter.classList.toggle('near-limit', len > 400 && len < 500);
            counter.classList.toggle('at-limit', len >= 500);
          });
          notesTextarea.dispatchEvent(new Event('input'));
        }

        // Layout management handlers
        if (isEdit) {
          // Handle assign current layout button
          const assignBtn = document.getElementById('cf-assign-current');
          if (assignBtn && !assignBtn.disabled) {
            assignBtn.addEventListener('click', () => {
              const currentLayoutId = this._getCurrentLayoutId();
              if (!currentLayoutId) return;
              
              if (!data.layoutIds) data.layoutIds = [];
              if (!data.layoutIds.includes(currentLayoutId)) {
                data.layoutIds.push(currentLayoutId);
                // Re-render the form to show the updated list
                this._openForm(data);
                this._toast('Layout assigned', 'success');
              }
            });
          }

          // Handle remove layout buttons
          const layoutsList = document.getElementById('cf-layouts-list');
          if (layoutsList) {
            layoutsList.addEventListener('click', (e) => {
              const removeBtn = e.target.closest('.client-cms-form__layout-remove');
              if (!removeBtn) return;

              const layoutId = removeBtn.getAttribute('data-layout-id');
              if (data.layoutIds && layoutId) {
                data.layoutIds = data.layoutIds.filter((id) => id !== layoutId);
                // Re-render the form to show the updated list
                this._openForm(data);
                this._toast('Layout removed', 'success');
              }
            });
          }
        }
      });

      // Ensure date picker wires up after modal content is mounted
      setTimeout(() => {
        const dateInput = document.getElementById('cf-date');
        if (dateInput) {
          if (typeof flatpickr !== 'undefined') {
            flatpickr(dateInput, {
              dateFormat: 'Y-m-d',
              altInput: true,
              altFormat: 'M j, Y',
              defaultDate: data.followUpDate || null,
              allowInput: true,
              // keep basic keyboard nav + close on select
              clickOpens: true,
              wrap: false,
            });
          } else {
            // Graceful fallback: native date input
            dateInput.type = 'date';
            dateInput.value = data.followUpDate || '';
          }
        }
      }, 50);
    }

    _viewClient(c) {
      const unitLabel = this._getUnitLabelById(c.unitPreference) || 'Not selected';
      const formattedDate = (c.followUpDate || '').trim();

      // Get assigned layouts info with actual names
      const layoutCount = Array.isArray(c.layoutIds) ? c.layoutIds.length : 0;
      const layoutNames = this._getLayoutNamesByIds(c.layoutIds);
      const layoutsText = layoutNames.length > 0 
        ? layoutNames.join(', ') 
        : 'No layouts assigned yet';

      const html = `
        <div class="client-cms-view client-cms-form">
          <div class="client-cms-form__group">
            <label class="client-cms-view__label">Name</label>
            <div class="client-cms-view__value">${escapeHTML(c.name)}</div>
          </div>

          <div class="client-cms-form__row">
            <div class="client-cms-form__group">
              <label class="client-cms-view__label">Email</label>
              <div class="client-cms-view__value${!c.email ? ' client-cms-view__value--empty' : ''}">
                ${c.email ? escapeHTML(c.email) : 'Not provided'}
              </div>
            </div>
            <div class="client-cms-form__group">
              <label class="client-cms-view__label">Phone</label>
              <div class="client-cms-view__value${!c.phone ? ' client-cms-view__value--empty' : ''}">
                ${c.phone ? escapeHTML(c.phone) : 'Not provided'}
              </div>
            </div>
          </div>

          <div class="client-cms-form__row">
            <div class="client-cms-form__group">
              <label class="client-cms-view__label">Unit Preference</label>
              <div class="client-cms-view__value">${escapeHTML(unitLabel)}</div>
            </div>
            <div class="client-cms-form__group">
              <label class="client-cms-view__label">Follow-up Date</label>
              <div class="client-cms-view__value${!c.followUpDate ? ' client-cms-view__value--empty' : ''}">
                ${c.followUpDate ? escapeHTML(formattedDate) : 'Not scheduled'}
              </div>
            </div>
          </div>

          <div class="client-cms-form__group">
            <label class="client-cms-view__label">Assigned Layouts</label>
            <div class="client-cms-view__value${layoutCount === 0 ? ' client-cms-view__value--empty' : ''}">
              ${escapeHTML(layoutsText)}
            </div>
          </div>

          <div class="client-cms-form__group">
            <label class="client-cms-view__label">Notes</label>
            <div class="client-cms-view__value client-cms-view__value--textarea${!c.notes ? ' client-cms-view__value--empty' : ''}">
              ${c.notes ? escapeHTML(c.notes) : 'No notes added'}
            </div>
          </div>
        </div>
      `;

      Modal.show(
        'Client Details', 
        `${html}
        <div class="cms-modal-footer">
          <button class="modal-btn modal-btn-primary" onclick="if(window.Modal && Modal.close) Modal.close()">Close</button>
        </div>`
      );
    }

    _deleteClient(c) {
      Modal.showConfirm(
        'Delete Client',
        `Are you sure you want to delete "${escapeHTML(c.name)}"? This action cannot be undone.`,
      ).then((confirmed) => {
        if (confirmed) {
          const idx = this.clients.findIndex((x) => x.id === c.id);
          if (idx >= 0) {
            this.clients.splice(idx, 1);
            this._save();
            this._renderList();
            this._toast('Client deleted', 'success');
          }
        }
      });
    }

    /**
     * Assign client to current layout
     * This links the client record to the currently active/saved layout.
     * Use case: Track which clients are interested in or assigned to specific unit layouts.
     * The client's layoutIds array stores all layouts they've been assigned to.
     */
    _assignClient(c) {
      const layoutId = this._getCurrentLayoutId();
      const layoutName = this._getCurrentLayoutName();

      if (!layoutId) {
        this._toast('No layout found. Please save a layout first.', 'error');
        return;
      }

      if (!Array.isArray(c.layoutIds)) c.layoutIds = [];
      
      // Check if already assigned
      if (c.layoutIds.includes(layoutId)) {
        this._toast(`"${c.name}" is already assigned to ${layoutName}`, 'info');
        return;
      }

      c.layoutIds.push(layoutId);
      c.modifiedDate = new Date().toISOString();
      this._save();
      this._renderList();

      // Emit event for other features to listen
      this.eventBus?.emit?.('client:assigned', { clientId: c.id, layoutId, clientName: c.name });

      this._toast(`✓ Assigned "${c.name}" to ${layoutName}`, 'success');
    }

    _getCurrentLayoutId() {
      const layouts = this._loadStoredLayouts();
      const active = this._getActiveLayoutMeta();
      const activeLayout = active?.id
        ? layouts.find((l) => l.id === active.id || l.layoutId === active.id)
        : null;

      if (activeLayout) return activeLayout.id || activeLayout.layoutId || null;

      const latestLayout = this._getMostRecentLayout(layouts);
      if (latestLayout) return latestLayout.id || latestLayout.layoutId || null;

      return null;
    }

    _getCurrentLayoutName() {
      const layouts = this._loadStoredLayouts();
      const active = this._getActiveLayoutMeta();
      const activeLayout = active?.id
        ? layouts.find((l) => l.id === active.id || l.layoutId === active.id)
        : null;

      if (activeLayout) {
        return (
          active?.name ||
          activeLayout.name ||
          activeLayout.metadata?.projectName ||
          'Current Layout'
        );
      }

      if (active?.name) {
        return active.name;
      }

      const latestLayout = this._getMostRecentLayout(layouts);
      if (latestLayout) {
        return latestLayout.name || latestLayout.metadata?.projectName || 'Current Layout';
      }

      return 'Current Layout';
    }

    _getAllFloorPlanOptions() {
      const plans = getFloorPlans() || [];
      return plans.map((fp) => ({
        value: fp.id || fp.name || '',
        label: fp.name || fp.id || '',
      }));
    }

    _getUnitLabelById(id) {
      if (!id) return '';
      const opts = this._unitOptions || this._getAllFloorPlanOptions();
      const match = opts.find((o) => o.value === id || o.label === id);
      return match ? match.label : id;
    }

    _loadStoredLayouts() {
      if (hasStorage()) {
        return window.Storage.load(STORAGE_KEY_LAYOUTS) || [];
      }
      return safeJSON.parse(localStorage.getItem(STORAGE_KEY_LAYOUTS), []);
    }

    _getActiveLayoutMeta() {
      if (hasStorage()) {
        return window.Storage.load(STORAGE_KEY_ACTIVE_LAYOUT) || null;
      }
      return safeJSON.parse(localStorage.getItem(STORAGE_KEY_ACTIVE_LAYOUT), null);
    }

    _getMostRecentLayout(layouts) {
      if (!Array.isArray(layouts) || layouts.length === 0) return null;
      return [...layouts].sort((a, b) => {
        const aDate = new Date(a.created || 0).getTime();
        const bDate = new Date(b.created || 0).getTime();
        return bDate - aDate;
      })[0];
    }

    _getLayoutNamesByIds(layoutIds) {
      if (!Array.isArray(layoutIds) || layoutIds.length === 0) {
        return [];
      }

      const layouts = this._loadStoredLayouts();
      const active = this._getActiveLayoutMeta();

      // Map layout IDs to names
      const names = layoutIds
        .map((id) => {
          const layout =
            layouts.find((l) => l.id === id || l.layoutId === id) ||
            (active?.id === id ? { name: active.name } : null);
          return layout?.name || layout?.metadata?.projectName || null;
        })
        .filter(Boolean);

      return names;
    }

    // --- Import / Export ---
    _upsertClients(newClients) {
      const key = (c) =>
        c.email?.toLowerCase() || `${(c.name || '').toLowerCase()}|${c.phone || ''}`;
      const map = new Map(this.clients.map((c) => [key(c), c]));
      newClients.forEach((nc) => map.set(key(nc), nc)); // latest wins
      this.clients = Array.from(map.values());
    }

    _importJSON() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const arr = safeJSON.parse(reader.result, []);
            if (!Array.isArray(arr)) {
              this._toast('Invalid JSON format', 'error');
              return;
            }
            const mapped = arr
              .map((x) => ({
                id: x.id || uid(),
                name: x.name?.trim() || '',
                email: (x.email || '').trim(),
                phone: (x.phone || '').trim(),
                unitPreference: (x.unitPreference || '').trim(),
                notes: (x.notes || '').trim(),
                followUpDate: x.followUpDate || '',
                createdDate: x.createdDate || new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
                layoutIds: Array.isArray(x.layoutIds) ? x.layoutIds : [],
              }))
              .filter((x) => x.name);

            if (mapped.length === 0) {
              this._toast('No valid clients found in file', 'error');
              return;
            }

            this._upsertClients(mapped);
            this._save();
            this._renderList();
            this._toast(`Imported ${mapped.length} client(s)`, 'success');
          } catch (err) {
            this._toast('Error parsing JSON file', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    _exportJSON() {
      if (this.clients.length === 0) {
        this._toast('No clients to export', 'error');
        return;
      }
      const json = safeJSON.stringify(this.clients);
      downloadFile('clients.json', 'application/json', json);
      this._toast('Clients exported as JSON', 'success');
    }

    _importCSV() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,text/csv';
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const rows = fromCSV(String(reader.result || ''));
            if (!rows.length) {
              this._toast('No rows found in CSV', 'error');
              return;
            }
            const mapped = rows
              .map((x) => ({
                id: uid(),
                name: (x.name || '').trim(),
                email: (x.email || '').trim(),
                phone: (x.phone || '').trim(),
                unitPreference: (x.unitPreference || '').trim(),
                notes: (x.notes || '').trim(),
                followUpDate: (x.followUpDate || '').trim(),
                createdDate: new Date().toISOString(),
                modifiedDate: new Date().toISOString(),
                layoutIds: [],
              }))
              .filter((x) => x.name);

            if (mapped.length === 0) {
              this._toast('No valid clients found in CSV', 'error');
              return;
            }

            this._upsertClients(mapped);
            this._save();
            this._renderList();
            this._toast(`Imported ${mapped.length} client(s)`, 'success');
          } catch (err) {
            this._toast('Error parsing CSV file', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }

    _exportCSV() {
      if (this.clients.length === 0) {
        this._toast('No clients to export', 'error');
        return;
      }
      const csv = toCSV(this.clients);
      downloadFile('clients.csv', 'text/csv', csv);
      this._toast('Clients exported as CSV', 'success');
    }

    // --- Toast ---
    _toast(message, type = 'info') {
      if (!hasModal()) {
        console.log(`[ClientCMS] ${message}`);
        return;
      }
      if (type === 'success' && Modal.showSuccess) return Modal.showSuccess(message);
      if (type === 'error' && Modal.showError) return Modal.showError(message);
      if (Modal.showInfo) return Modal.showInfo(message);
      console.log(`[ClientCMS] ${message}`);
    }
  }

  // Expose globally
  window.ClientCMS = ClientCMS;
})(window);
