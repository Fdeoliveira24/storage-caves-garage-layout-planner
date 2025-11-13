/**
 * Local/session storage wrapper with graceful fallbacks.
 * Falls back to sessionStorage (per-tab) and then in-memory storage when needed.
 */
const Storage = (() => {
  const STORAGE_TYPES = {
    LOCAL: 'local',
    SESSION: 'session',
    MEMORY: 'memory',
  };

  const memoryStorage = new Map();
  let activeStorageType = STORAGE_TYPES.LOCAL;
  let isStorageAvailable = false;

  /**
   * Try accessing the requested storage bucket with a read/write test.
   */
  function canUseStorage(type) {
    if (typeof window === 'undefined') return false;
    const storage = type === STORAGE_TYPES.LOCAL ? window.localStorage : window.sessionStorage;
    if (!storage) return false;

    try {
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Switch to the provided storage type.
   */
  function setActiveStorage(type) {
    activeStorageType = type;
    isStorageAvailable = type !== STORAGE_TYPES.MEMORY;

    if (type === STORAGE_TYPES.LOCAL) {
      console.log('[Storage] Using localStorage');
    } else if (type === STORAGE_TYPES.SESSION) {
      console.warn('[Storage] Falling back to sessionStorage (cleared when tab closes)');
    } else {
      console.warn('[Storage] Using volatile in-memory storage (cleared on reload)');
    }
  }

  /**
   * Run detection in priority order: localStorage -> sessionStorage -> memory.
   */
  function detectStorage() {
    if (canUseStorage(STORAGE_TYPES.LOCAL)) {
      setActiveStorage(STORAGE_TYPES.LOCAL);
      return true;
    }

    if (canUseStorage(STORAGE_TYPES.SESSION)) {
      setActiveStorage(STORAGE_TYPES.SESSION);
      return true;
    }

    setActiveStorage(STORAGE_TYPES.MEMORY);
    return false;
  }

  /**
   * Attempt to fallback to the next available storage tier.
   */
  function fallbackToNextTier() {
    if (activeStorageType === STORAGE_TYPES.LOCAL && canUseStorage(STORAGE_TYPES.SESSION)) {
      setActiveStorage(STORAGE_TYPES.SESSION);
      return true;
    }

    setActiveStorage(STORAGE_TYPES.MEMORY);
    return false;
  }

  function getActiveBrowserStorage() {
    if (typeof window === 'undefined') return null;
    if (activeStorageType === STORAGE_TYPES.LOCAL) {
      return window.localStorage;
    }
    if (activeStorageType === STORAGE_TYPES.SESSION) {
      return window.sessionStorage;
    }
    return null;
  }

  // Initial detection
  detectStorage();

  return {
    /**
     * Flag indicating if we have persistent (local or session) storage.
     */
    get isAvailable() {
      return isStorageAvailable;
    },

    /**
     * Whether data survives a full browser restart (only true for localStorage).
     */
    get isPersistent() {
      return activeStorageType === STORAGE_TYPES.LOCAL;
    },

    /**
     * Expose current mode for debugging (local, session, memory)
     */
    get mode() {
      return activeStorageType;
    },

    save(key, data) {
      const serialized = JSON.stringify(data);

      if (activeStorageType === STORAGE_TYPES.MEMORY) {
        memoryStorage.set(key, serialized);
        return true;
      }

      try {
        const storage = getActiveBrowserStorage();
        if (!storage) {
          throw new Error('Active storage missing');
        }
        storage.setItem(key, serialized);
        return true;
      } catch (error) {
        console.error('[Storage] Error saving data:', error);
        if (error.name === 'QuotaExceededError') {
          console.warn('[Storage] Quota exceeded - attempting fallback');
        }

        if (fallbackToNextTier()) {
          return this.save(key, data);
        }

        try {
          memoryStorage.set(key, serialized);
          return true;
        } catch (memError) {
          console.error('[Storage] Memory fallback also failed:', memError);
          return false;
        }
      }
    },

    load(key) {
      try {
        if (activeStorageType === STORAGE_TYPES.MEMORY) {
          const data = memoryStorage.get(key);
          return data ? JSON.parse(data) : null;
        }

        const storage = getActiveBrowserStorage();
        const data = storage ? storage.getItem(key) : null;
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error('[Storage] Error loading data:', error);
        return null;
      }
    },

    remove(key) {
      try {
        if (activeStorageType === STORAGE_TYPES.MEMORY) {
          memoryStorage.delete(key);
          return true;
        }

        const storage = getActiveBrowserStorage();
        if (storage) {
          storage.removeItem(key);
          return true;
        }

        return false;
      } catch (error) {
        console.error('[Storage] Error removing data:', error);
        return false;
      }
    },

    has(key) {
      try {
        if (activeStorageType === STORAGE_TYPES.MEMORY) {
          return memoryStorage.has(key);
        }

        const storage = getActiveBrowserStorage();
        return storage ? storage.getItem(key) !== null : false;
      } catch (error) {
        console.error('[Storage] Error checking key:', error);
        return false;
      }
    },

    clear() {
      try {
        if (activeStorageType === STORAGE_TYPES.MEMORY) {
          memoryStorage.clear();
          return true;
        }

        const storage = getActiveBrowserStorage();
        if (storage) {
          storage.clear();
          return true;
        }

        return false;
      } catch (error) {
        console.error('[Storage] Error clearing storage:', error);
        return false;
      }
    },

    keys() {
      try {
        if (activeStorageType === STORAGE_TYPES.MEMORY) {
          return Array.from(memoryStorage.keys());
        }

        const storage = getActiveBrowserStorage();
        return storage ? Object.keys(storage) : [];
      } catch (error) {
        console.error('[Storage] Error getting keys:', error);
        return [];
      }
    },

    getSize() {
      try {
        let size = 0;

        if (activeStorageType === STORAGE_TYPES.MEMORY) {
          for (const [key, value] of memoryStorage) {
            size += key.length + value.length;
          }
          return size;
        }

        const storage = getActiveBrowserStorage();
        if (!storage) return 0;

        for (const key in storage) {
          if (Object.prototype.hasOwnProperty.call(storage, key)) {
            size += storage[key].length + key.length;
          }
        }
        return size;
      } catch (error) {
        console.error('[Storage] Error calculating size:', error);
        return 0;
      }
    },

    redetect() {
      return detectStorage();
    },
  };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.Storage = Storage;
}
