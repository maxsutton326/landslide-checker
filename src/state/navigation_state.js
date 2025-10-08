/**
 * Navigation State Manager
 *
 * Tracks navigation history with undo/redo support and session persistence
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * NavigationState class
 */
export class NavigationState extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();

    this.options = {
      maxHistorySize: 100,
      sessionKey: 'landslide-navigation-state',
      autosave: true,
      ...options
    };

    this.history = [];
    this.currentIndex = -1;
    this.sessionData = {
      lastLandslideId: null,
      lastViewState: null,
      timestamp: null
    };

    // Load from session if available
    if (this.options.autosave) {
      this.restoreFromSession();
    }
  }

  /**
   * Push new state to history
   *
   * @param {string|number} landslideId - Landslide ID
   * @param {Object} metadata - Optional metadata
   */
  pushState(landslideId, metadata = {}) {
    // Remove any future states if we're in the middle of history
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Create state entry
    const state = {
      landslideId,
      timestamp: Date.now(),
      metadata: { ...metadata }
    };

    this.history.push(state);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    // Update session data
    this.sessionData.lastLandslideId = landslideId;
    this.sessionData.timestamp = Date.now();

    if (this.options.autosave) {
      this.saveToSession();
    }

    this.emit('state-changed', {
      type: 'push',
      state,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });
  }

  /**
   * Check if undo is available
   *
   * @returns {boolean}
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is available
   *
   * @returns {boolean}
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Undo to previous state
   *
   * @returns {Object|null} - Previous state or null
   */
  undo() {
    if (!this.canUndo()) {
      return null;
    }

    this.currentIndex--;
    const state = this.history[this.currentIndex];

    this.emit('state-changed', {
      type: 'undo',
      state,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });

    if (this.options.autosave) {
      this.saveToSession();
    }

    return state;
  }

  /**
   * Redo to next state
   *
   * @returns {Object|null} - Next state or null
   */
  redo() {
    if (!this.canRedo()) {
      return null;
    }

    this.currentIndex++;
    const state = this.history[this.currentIndex];

    this.emit('state-changed', {
      type: 'redo',
      state,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    });

    if (this.options.autosave) {
      this.saveToSession();
    }

    return state;
  }

  /**
   * Get current state
   *
   * @returns {Object|null} - Current state or null
   */
  getCurrentState() {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Get state at index
   *
   * @param {number} index - History index
   * @returns {Object|null} - State or null
   */
  getStateAt(index) {
    if (index >= 0 && index < this.history.length) {
      return this.history[index];
    }
    return null;
  }

  /**
   * Jump to specific state in history
   *
   * @param {number} index - History index
   * @returns {Object|null} - State or null
   */
  jumpToState(index) {
    if (index >= 0 && index < this.history.length) {
      this.currentIndex = index;
      const state = this.history[index];

      this.emit('state-changed', {
        type: 'jump',
        state,
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });

      if (this.options.autosave) {
        this.saveToSession();
      }

      return state;
    }
    return null;
  }

  /**
   * Get navigation history
   *
   * @returns {Array} - History array
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Get recent history
   *
   * @param {number} count - Number of recent entries
   * @returns {Array} - Recent history
   */
  getRecentHistory(count = 10) {
    const start = Math.max(0, this.history.length - count);
    return this.history.slice(start);
  }

  /**
   * Find state by landslide ID
   *
   * @param {string|number} landslideId - Landslide ID
   * @returns {Object|null} - State or null
   */
  findStateByLandslideId(landslideId) {
    // Search backwards (most recent first)
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].landslideId === landslideId) {
        return {
          state: this.history[i],
          index: i
        };
      }
    }
    return null;
  }

  /**
   * Get visited landslide IDs
   *
   * @returns {Set} - Set of visited IDs
   */
  getVisitedLandslides() {
    const visited = new Set();
    this.history.forEach(state => {
      visited.add(state.landslideId);
    });
    return visited;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    this.currentIndex = -1;

    this.emit('state-changed', {
      type: 'clear',
      state: null,
      canUndo: false,
      canRedo: false
    });

    if (this.options.autosave) {
      this.saveToSession();
    }
  }

  /**
   * Update view state for current landslide
   *
   * @param {Object} viewState - View state (zoom, pan, etc.)
   */
  updateViewState(viewState) {
    const current = this.getCurrentState();
    if (current) {
      current.metadata.viewState = { ...viewState };
    }

    this.sessionData.lastViewState = { ...viewState };

    if (this.options.autosave) {
      this.saveToSession();
    }
  }

  /**
   * Get last view state
   *
   * @returns {Object|null} - View state or null
   */
  getLastViewState() {
    const current = this.getCurrentState();
    return current?.metadata?.viewState || this.sessionData.lastViewState || null;
  }

  /**
   * Save state to session storage
   */
  saveToSession() {
    try {
      const data = {
        history: this.history,
        currentIndex: this.currentIndex,
        sessionData: this.sessionData
      };

      sessionStorage.setItem(this.options.sessionKey, JSON.stringify(data));

      this.emit('saved', { timestamp: Date.now() });
    } catch (error) {
      console.error('Failed to save navigation state:', error);
    }
  }

  /**
   * Restore state from session storage
   *
   * @returns {boolean} - True if restored successfully
   */
  restoreFromSession() {
    try {
      const stored = sessionStorage.getItem(this.options.sessionKey);

      if (!stored) {
        return false;
      }

      const data = JSON.parse(stored);

      this.history = data.history || [];
      this.currentIndex = data.currentIndex ?? -1;
      this.sessionData = data.sessionData || {
        lastLandslideId: null,
        lastViewState: null,
        timestamp: null
      };

      this.emit('restored', {
        historySize: this.history.length,
        lastLandslideId: this.sessionData.lastLandslideId,
        timestamp: this.sessionData.timestamp
      });

      return true;
    } catch (error) {
      console.error('Failed to restore navigation state:', error);
      return false;
    }
  }

  /**
   * Get last visited landslide ID
   *
   * @returns {string|number|null} - Last landslide ID or null
   */
  getLastLandslideId() {
    return this.sessionData.lastLandslideId;
  }

  /**
   * Export history as JSON
   *
   * @returns {string} - JSON string
   */
  exportHistory() {
    return JSON.stringify({
      history: this.history,
      currentIndex: this.currentIndex,
      sessionData: this.sessionData,
      exportedAt: Date.now()
    }, null, 2);
  }

  /**
   * Import history from JSON
   *
   * @param {string} jsonString - JSON string
   * @returns {boolean} - True if imported successfully
   */
  importHistory(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      this.history = data.history || [];
      this.currentIndex = data.currentIndex ?? -1;
      this.sessionData = data.sessionData || {};

      this.emit('imported', {
        historySize: this.history.length,
        timestamp: data.exportedAt
      });

      if (this.options.autosave) {
        this.saveToSession();
      }

      return true;
    } catch (error) {
      console.error('Failed to import history:', error);
      return false;
    }
  }

  /**
   * Get statistics
   *
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    const visited = this.getVisitedLandslides();
    const timeSpan = this.history.length > 0 ?
      this.history[this.history.length - 1].timestamp - this.history[0].timestamp : 0;

    return {
      totalStates: this.history.length,
      currentIndex: this.currentIndex,
      uniqueLandslides: visited.size,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      timeSpan,
      averageTimePerState: this.history.length > 1 ?
        timeSpan / (this.history.length - 1) : 0,
      lastVisited: this.sessionData.lastLandslideId,
      lastTimestamp: this.sessionData.timestamp
    };
  }

  /**
   * Prune old states to reduce memory
   *
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {number} - Number of states removed
   */
  pruneOldStates(maxAge) {
    const cutoff = Date.now() - maxAge;
    const originalLength = this.history.length;

    // Find first state within age limit
    let cutIndex = 0;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].timestamp >= cutoff) {
        cutIndex = i;
        break;
      }
    }

    if (cutIndex > 0) {
      this.history = this.history.slice(cutIndex);
      this.currentIndex = Math.max(0, this.currentIndex - cutIndex);

      if (this.options.autosave) {
        this.saveToSession();
      }

      return originalLength - this.history.length;
    }

    return 0;
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.clearHistory();
    this.off('state-changed');
    this.off('saved');
    this.off('restored');
    this.off('imported');
  }
}
