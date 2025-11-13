/**
 * EventBus - Decoupled event communication system
 * Implements pub/sub pattern for module communication
 */
class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Event name (e.g., 'item:added')
   * @param {function} callback - Callback function
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name
   * @param {function} callback - Callback to remove
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;

    this.events[eventName] = this.events[eventName].filter((cb) => cb !== callback);

    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;

    this.events[eventName].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error);
      }
    });
  }

  /**
   * Subscribe to event once (auto-unsubscribe after first call)
   * @param {string} eventName - Event name
   * @param {function} callback - Callback function
   */
  once(eventName, callback) {
    const onceCallback = (data) => {
      callback(data);
      this.off(eventName, onceCallback);
    };
    this.on(eventName, onceCallback);
  }

  /**
   * Clear all event listeners
   */
  clear() {
    this.events = {};
  }

  /**
   * Get list of all registered events
   */
  getEvents() {
    return Object.keys(this.events);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.EventBus = EventBus;
}
