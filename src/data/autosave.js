/**
 * Auto-Save Mechanism
 *
 * Automatically saves labels at intervals and on navigation
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * AutoSave class
 */
export class AutoSave extends EventEmitter {
  /**
   * @param {LabelManager} labelManager - Label manager instance
   * @param {Object} options - Configuration options
   */
  constructor(labelManager, options = {}) {
    super();

    if (!labelManager) {
      throw new Error('LabelManager is required');
    }

    this.labelManager = labelManager;
    this.options = {
      interval: 30000, // 30 seconds
      saveOnNavigation: true,
      saveOnChange: false,
      maxRetries: 3,
      ...options
    };

    this.isRunning = false;
    this.intervalId = null;
    this.lastSave = null;
    this.saveCount = 0;
    this.retryCount = 0;
    this.isSaving = false;
  }

  /**
   * Start auto-save
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Set up interval
    this.intervalId = setInterval(() => {
      this.saveNow();
    }, this.options.interval);

    // Listen for changes if configured
    if (this.options.saveOnChange) {
      this.labelManager.on('change', () => {
        this.scheduleDelayedSave();
      });
    }

    this.emit('started');
  }

  /**
   * Stop auto-save
   *
   * @param {boolean} saveBeforeStopping - Whether to save before stopping
   */
  async stop(saveBeforeStopping = true) {
    if (!this.isRunning) {
      return;
    }

    if (saveBeforeStopping && this.labelManager.hasUnsavedChanges()) {
      await this.saveNow();
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.delayedSaveTimeout) {
      clearTimeout(this.delayedSaveTimeout);
      this.delayedSaveTimeout = null;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Save now
   *
   * @returns {Promise<boolean>} - True if saved successfully
   */
  async saveNow() {
    if (this.isSaving) {
      return false;
    }

    if (!this.labelManager.hasUnsavedChanges()) {
      this.emit('no-changes');
      return true;
    }

    this.isSaving = true;
    this.emit('saving');

    try {
      // Attempt save
      this.labelManager.saveToStorage();

      // Success
      this.lastSave = Date.now();
      this.saveCount++;
      this.retryCount = 0;
      this.isSaving = false;

      this.emit('saved', {
        timestamp: this.lastSave,
        count: this.saveCount
      });

      return true;
    } catch (error) {
      this.isSaving = false;

      // Retry logic
      if (this.retryCount < this.options.maxRetries) {
        this.retryCount++;

        this.emit('retry', {
          attempt: this.retryCount,
          maxRetries: this.options.maxRetries,
          error
        });

        // Retry after delay
        setTimeout(() => {
          this.saveNow();
        }, 1000 * this.retryCount); // Exponential backoff

        return false;
      } else {
        // Max retries exceeded
        this.emit('error', {
          error,
          retries: this.retryCount
        });

        this.retryCount = 0;
        return false;
      }
    }
  }

  /**
   * Schedule delayed save
   *
   * @param {number} delay - Delay in ms
   */
  scheduleDelayedSave(delay = 5000) {
    if (this.delayedSaveTimeout) {
      clearTimeout(this.delayedSaveTimeout);
    }

    this.delayedSaveTimeout = setTimeout(() => {
      this.saveNow();
      this.delayedSaveTimeout = null;
    }, delay);
  }

  /**
   * Recover from crash
   *
   * @returns {boolean} - True if recovery data found
   */
  recover() {
    try {
      const loaded = this.labelManager.loadFromStorage();

      if (loaded) {
        this.emit('recovered', {
          timestamp: this.labelManager.lastSaved,
          count: this.labelManager.labels.size
        });
      }

      return loaded;
    } catch (error) {
      this.emit('recovery-error', { error });
      return false;
    }
  }

  /**
   * Get auto-save status
   *
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isSaving: this.isSaving,
      lastSave: this.lastSave,
      saveCount: this.saveCount,
      hasUnsavedChanges: this.labelManager.hasUnsavedChanges(),
      nextSave: this.intervalId ?
        this.lastSave + this.options.interval : null
    };
  }

  /**
   * Register save callback
   *
   * @param {Function} callback - Callback function
   */
  onSave(callback) {
    this.on('saved', callback);
  }

  /**
   * Register error callback
   *
   * @param {Function} callback - Callback function
   */
  onError(callback) {
    this.on('error', callback);
  }

  /**
   * Force immediate save
   */
  forceSave() {
    return this.saveNow();
  }

  /**
   * Reset save statistics
   */
  resetStats() {
    this.saveCount = 0;
    this.retryCount = 0;
    this.lastSave = null;
  }

  /**
   * Update save interval
   *
   * @param {number} interval - New interval in ms
   */
  setInterval(interval) {
    this.options.interval = interval;

    if (this.isRunning && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.saveNow();
      }, interval);
    }
  }

  /**
   * Get time since last save
   *
   * @returns {number|null} - Milliseconds since last save
   */
  getTimeSinceLastSave() {
    if (!this.lastSave) {
      return null;
    }

    return Date.now() - this.lastSave;
  }

  /**
   * Check if save is due
   *
   * @returns {boolean}
   */
  isSaveDue() {
    if (!this.lastSave) {
      return true;
    }

    return this.getTimeSinceLastSave() >= this.options.interval;
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.stop(false);
    this.removeAllListeners();
  }
}

/**
 * Create auto-save instance with defaults
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {number} interval - Save interval in seconds
 * @returns {AutoSave} - AutoSave instance
 */
export function createAutoSave(labelManager, interval = 30) {
  return new AutoSave(labelManager, {
    interval: interval * 1000,
    saveOnNavigation: true,
    saveOnChange: false
  });
}

/**
 * Setup auto-save with UI feedback
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Function} updateStatusFn - Function to update status UI
 * @returns {AutoSave} - AutoSave instance
 */
export function setupAutoSaveWithFeedback(labelManager, updateStatusFn) {
  const autoSave = createAutoSave(labelManager, 30);

  // Listen for events and update UI
  autoSave.on('saving', () => {
    if (updateStatusFn) {
      updateStatusFn('saving');
    }
  });

  autoSave.on('saved', () => {
    if (updateStatusFn) {
      updateStatusFn('saved');
    }
  });

  autoSave.on('error', () => {
    if (updateStatusFn) {
      updateStatusFn('error');
    }
  });

  autoSave.on('no-changes', () => {
    if (updateStatusFn) {
      updateStatusFn('saved');
    }
  });

  // Start auto-save
  autoSave.start();

  return autoSave;
}
