/**
 * Label Manager
 *
 * Stores and manages labels for landslides with undo/redo support
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * LabelManager class
 */
export class LabelManager extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();

    this.options = {
      storageKey: 'landslide-labels',
      maxHistorySize: 100,
      autosave: true,
      ...options
    };

    // Label storage - Map of landslideId -> label data
    this.labels = new Map();

    // Undo/redo history
    this.history = [];
    this.historyIndex = -1;

    // Track modifications
    this.modified = false;
    this.lastSaved = null;

    // Load from storage if available
    if (this.options.autosave) {
      this.loadFromStorage();
    }
  }

  /**
   * Set label for landslide
   *
   * @param {string} landslideId - Landslide ID
   * @param {string} labelCode - Label code
   * @param {string} confidence - Confidence level
   * @param {string} notes - Notes
   * @returns {Object} - Label data
   */
  setLabel(landslideId, labelCode, confidence = 'medium', notes = '') {
    // Create label data
    const labelData = {
      landslideId,
      label: labelCode,
      confidence,
      notes,
      timestamp: Date.now(),
      modified: Date.now()
    };

    // Get old value for undo
    const oldValue = this.labels.get(landslideId);

    // Store label
    this.labels.set(landslideId, labelData);

    // Add to history
    this.addToHistory({
      type: 'set',
      landslideId,
      oldValue: oldValue ? { ...oldValue } : null,
      newValue: { ...labelData }
    });

    // Mark as modified
    this.modified = true;

    // Emit event
    this.emit('label-set', { landslideId, labelData });
    this.emit('change');

    // Auto-save if enabled
    if (this.options.autosave) {
      this.saveToStorage();
    }

    return labelData;
  }

  /**
   * Get label for landslide
   *
   * @param {string} landslideId - Landslide ID
   * @returns {Object|null} - Label data or null
   */
  getLabel(landslideId) {
    return this.labels.get(landslideId) || null;
  }

  /**
   * Remove label for landslide
   *
   * @param {string} landslideId - Landslide ID
   * @returns {boolean} - True if removed
   */
  removeLabel(landslideId) {
    const oldValue = this.labels.get(landslideId);

    if (!oldValue) {
      return false;
    }

    this.labels.delete(landslideId);

    // Add to history
    this.addToHistory({
      type: 'remove',
      landslideId,
      oldValue: { ...oldValue },
      newValue: null
    });

    // Mark as modified
    this.modified = true;

    // Emit event
    this.emit('label-removed', { landslideId });
    this.emit('change');

    // Auto-save if enabled
    if (this.options.autosave) {
      this.saveToStorage();
    }

    return true;
  }

  /**
   * Get all labels
   *
   * @returns {Map} - Map of all labels
   */
  getAllLabels() {
    return new Map(this.labels);
  }

  /**
   * Get labels as array
   *
   * @returns {Array} - Array of label objects
   */
  getLabelsArray() {
    return Array.from(this.labels.values());
  }

  /**
   * Check if landslide has label
   *
   * @param {string} landslideId - Landslide ID
   * @returns {boolean}
   */
  hasLabel(landslideId) {
    return this.labels.has(landslideId);
  }

  /**
   * Get statistics
   *
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    const stats = {
      total: this.labels.size,
      byLabel: {},
      byConfidence: {
        high: 0,
        medium: 0,
        low: 0
      },
      withNotes: 0,
      lastModified: null
    };

    this.labels.forEach(labelData => {
      // Count by label
      if (!stats.byLabel[labelData.label]) {
        stats.byLabel[labelData.label] = 0;
      }
      stats.byLabel[labelData.label]++;

      // Count by confidence
      if (labelData.confidence) {
        stats.byConfidence[labelData.confidence]++;
      }

      // Count with notes
      if (labelData.notes && labelData.notes.trim().length > 0) {
        stats.withNotes++;
      }

      // Track last modified
      if (!stats.lastModified || labelData.modified > stats.lastModified) {
        stats.lastModified = labelData.modified;
      }
    });

    return stats;
  }

  /**
   * Add operation to history
   *
   * @param {Object} operation - Operation to add
   */
  addToHistory(operation) {
    // Remove any future history if we're in the middle
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add operation
    this.history.push(operation);
    this.historyIndex++;

    // Limit history size
    if (this.history.length > this.options.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * Check if can undo
   *
   * @returns {boolean}
   */
  canUndo() {
    return this.historyIndex >= 0;
  }

  /**
   * Check if can redo
   *
   * @returns {boolean}
   */
  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  /**
   * Undo last operation
   *
   * @returns {Object|null} - Undone operation or null
   */
  undo() {
    if (!this.canUndo()) {
      return null;
    }

    const operation = this.history[this.historyIndex];
    this.historyIndex--;

    // Apply reverse operation
    if (operation.type === 'set') {
      if (operation.oldValue) {
        this.labels.set(operation.landslideId, operation.oldValue);
      } else {
        this.labels.delete(operation.landslideId);
      }
    } else if (operation.type === 'remove') {
      if (operation.oldValue) {
        this.labels.set(operation.landslideId, operation.oldValue);
      }
    }

    this.modified = true;
    this.emit('undo', operation);
    this.emit('change');

    if (this.options.autosave) {
      this.saveToStorage();
    }

    return operation;
  }

  /**
   * Redo last undone operation
   *
   * @returns {Object|null} - Redone operation or null
   */
  redo() {
    if (!this.canRedo()) {
      return null;
    }

    this.historyIndex++;
    const operation = this.history[this.historyIndex];

    // Apply operation
    if (operation.type === 'set') {
      this.labels.set(operation.landslideId, operation.newValue);
    } else if (operation.type === 'remove') {
      this.labels.delete(operation.landslideId);
    }

    this.modified = true;
    this.emit('redo', operation);
    this.emit('change');

    if (this.options.autosave) {
      this.saveToStorage();
    }

    return operation;
  }

  /**
   * Check if has unsaved changes
   *
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.modified;
  }

  /**
   * Mark as saved
   */
  markAsSaved() {
    this.modified = false;
    this.lastSaved = Date.now();
  }

  /**
   * Clear all labels
   */
  clearAll() {
    const oldLabels = new Map(this.labels);

    this.labels.clear();

    // Add to history
    this.addToHistory({
      type: 'clear',
      oldValue: oldLabels,
      newValue: null
    });

    this.modified = true;
    this.emit('clear');
    this.emit('change');

    if (this.options.autosave) {
      this.saveToStorage();
    }
  }

  /**
   * Save to localStorage
   */
  saveToStorage() {
    try {
      const data = {
        labels: Array.from(this.labels.entries()),
        lastSaved: Date.now()
      };

      localStorage.setItem(this.options.storageKey, JSON.stringify(data));
      this.markAsSaved();

      this.emit('saved', { timestamp: data.lastSaved });
    } catch (error) {
      console.error('Failed to save labels:', error);
      this.emit('save-error', { error });
    }
  }

  /**
   * Load from localStorage
   *
   * @returns {boolean} - True if loaded successfully
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.options.storageKey);

      if (!stored) {
        return false;
      }

      const data = JSON.parse(stored);

      // Restore labels
      this.labels = new Map(data.labels);
      this.lastSaved = data.lastSaved;
      this.modified = false;

      this.emit('loaded', { count: this.labels.size, timestamp: data.lastSaved });

      return true;
    } catch (error) {
      console.error('Failed to load labels:', error);
      this.emit('load-error', { error });
      return false;
    }
  }

  /**
   * Export labels as JSON
   *
   * @returns {string} - JSON string
   */
  exportJSON() {
    return JSON.stringify({
      labels: Array.from(this.labels.entries()),
      statistics: this.getStatistics(),
      exportedAt: Date.now()
    }, null, 2);
  }

  /**
   * Import labels from JSON
   *
   * @param {string} jsonString - JSON string
   * @returns {boolean} - True if imported successfully
   */
  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (!data.labels || !Array.isArray(data.labels)) {
        throw new Error('Invalid label data format');
      }

      // Clear existing labels
      this.labels.clear();

      // Import labels
      this.labels = new Map(data.labels);
      this.modified = true;

      this.emit('imported', { count: this.labels.size });
      this.emit('change');

      if (this.options.autosave) {
        this.saveToStorage();
      }

      return true;
    } catch (error) {
      console.error('Failed to import labels:', error);
      this.emit('import-error', { error });
      return false;
    }
  }

  /**
   * Export labels as CSV
   *
   * @returns {string} - CSV string
   */
  exportCSV() {
    const headers = ['landslide_id', 'label', 'confidence', 'notes', 'timestamp'];
    const rows = [headers.join(',')];

    this.labels.forEach((labelData, landslideId) => {
      const row = [
        landslideId,
        labelData.label,
        labelData.confidence || '',
        (labelData.notes || '').replace(/"/g, '""'), // Escape quotes
        new Date(labelData.timestamp).toISOString()
      ];
      rows.push(row.map(v => `"${v}"`).join(','));
    });

    return rows.join('\n');
  }

  /**
   * Get labels by filter
   *
   * @param {Function} predicate - Filter function
   * @returns {Array} - Filtered labels
   */
  filter(predicate) {
    const results = [];

    this.labels.forEach((labelData, landslideId) => {
      if (predicate(labelData, landslideId)) {
        results.push({ landslideId, ...labelData });
      }
    });

    return results;
  }

  /**
   * Get labels by label code
   *
   * @param {string} labelCode - Label code
   * @returns {Array} - Matching labels
   */
  getByLabel(labelCode) {
    return this.filter(labelData => labelData.label === labelCode);
  }

  /**
   * Get labels by confidence
   *
   * @param {string} confidence - Confidence level
   * @returns {Array} - Matching labels
   */
  getByConfidence(confidence) {
    return this.filter(labelData => labelData.confidence === confidence);
  }

  /**
   * Get labels with notes
   *
   * @returns {Array} - Labels with notes
   */
  getWithNotes() {
    return this.filter(labelData =>
      labelData.notes && labelData.notes.trim().length > 0
    );
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    if (this.options.autosave && this.modified) {
      this.saveToStorage();
    }

    this.labels.clear();
    this.history = [];
    this.removeAllListeners();
  }
}
