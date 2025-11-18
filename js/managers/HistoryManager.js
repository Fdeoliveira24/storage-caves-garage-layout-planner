/* global Config, Helpers */

/**
 * History Manager - Undo/Redo System
 * Manages state history stack (50 levels)
 */
class HistoryManager {
  constructor(state, eventBus, maxStates = Config.MAX_HISTORY) {
    this.state = state;
    this.eventBus = eventBus;
    this.maxStates = maxStates;
    this.states = [];
    this.currentIndex = -1;
    this.enabled = true;
  }

  /**
   * Save current state to history
   */
  save() {
    if (!this.enabled) return;

    // Get current state
    const currentState = this.state.getState();

    console.log('[History] save() called', {
      itemsCount: currentState.items?.length,
      currentIndexBefore: this.currentIndex,
      stackSizeBefore: this.states.length,
    });

    // Remove any states after current index (for redo clear)
    this.states = this.states.slice(0, this.currentIndex + 1);

    // Add new state
    this.states.push(Helpers.deepClone(currentState));
    this.currentIndex++;

    console.log('[History] after push', {
      currentIndexAfter: this.currentIndex,
      stackSizeAfter: this.states.length,
    });

    // Limit stack size
    if (this.states.length > this.maxStates) {
      this.states.shift();
      this.currentIndex--;
    }

    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });
  }

  /**
   * Undo last action
   */
  undo() {
    if (!this.canUndo()) {
      console.log('[History] undo() blocked: canUndo() is false');
      return null;
    }

    this.enabled = false;
    this.currentIndex--;
    const previousState = Helpers.deepClone(this.states[this.currentIndex]);

    console.log('[History] undo() applying state', {
      currentIndex: this.currentIndex,
      itemsCount: previousState.items?.length,
    });
    this.state.loadState(previousState);
    this.enabled = true;

    this.eventBus.emit('history:undo', previousState);
    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });

    return previousState;
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (!this.canRedo()) {
      console.log('[History] redo() blocked: canRedo() is false');
      return null;
    }

    this.enabled = false;
    this.currentIndex++;
    const nextState = Helpers.deepClone(this.states[this.currentIndex]);

    console.log('[History] redo() applying state', {
      currentIndex: this.currentIndex,
      itemsCount: nextState.items?.length,
    });
    this.state.loadState(nextState);
    this.enabled = true;

    this.eventBus.emit('history:redo', nextState);
    this.eventBus.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    });

    return nextState;
  }

  /**
   * Check if can undo
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Check if can redo
   */
  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  /**
   * Clear all history
   */
  clear() {
    this.states = [];
    this.currentIndex = -1;
    this.eventBus.emit('history:changed', {
      canUndo: false,
      canRedo: false,
    });
  }

  /**
   * Get history info
   */
  getInfo() {
    return {
      total: this.states.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.HistoryManager = HistoryManager;
}
