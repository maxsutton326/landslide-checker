/**
 * Class Counter
 *
 * Tracks and persists counts of labeled instances by class
 */

export class ClassCounter {
  /**
   * @param {Array} labelConfig - Label configuration with class codes
   * @param {string} storageKey - localStorage key for persistence
   */
  constructor(labelConfig, storageKey = 'fidelity_class_counts') {
    this.storageKey = storageKey;
    this.classes = labelConfig.map(l => l.code);
    this.counts = {};

    // Initialize counts
    this.classes.forEach(code => {
      this.counts[code] = 0;
    });

    // Load saved counts
    this.load();
  }

  /**
   * Increment count for a class
   *
   * @param {string} classCode - Class code to increment
   */
  increment(classCode) {
    if (this.counts.hasOwnProperty(classCode)) {
      this.counts[classCode]++;
      this.save();
      console.log(`Incremented ${classCode}: ${this.counts[classCode]}`);
    } else {
      console.warn(`Unknown class code: ${classCode}`);
    }
  }

  /**
   * Decrement count for a class
   *
   * @param {string} classCode - Class code to decrement
   */
  decrement(classCode) {
    if (this.counts.hasOwnProperty(classCode) && this.counts[classCode] > 0) {
      this.counts[classCode]--;
      this.save();
      console.log(`Decremented ${classCode}: ${this.counts[classCode]}`);
    }
  }

  /**
   * Update count when label changes
   *
   * @param {string|null} oldLabel - Previous label
   * @param {string} newLabel - New label
   */
  updateLabel(oldLabel, newLabel) {
    if (oldLabel && this.counts.hasOwnProperty(oldLabel)) {
      this.decrement(oldLabel);
    }
    if (newLabel && this.counts.hasOwnProperty(newLabel)) {
      this.increment(newLabel);
    }
  }

  /**
   * Get count for a class
   *
   * @param {string} classCode - Class code
   * @returns {number}
   */
  getCount(classCode) {
    return this.counts[classCode] || 0;
  }

  /**
   * Get all counts
   *
   * @returns {Object}
   */
  getAllCounts() {
    return { ...this.counts };
  }

  /**
   * Get total count across all classes
   *
   * @returns {number}
   */
  getTotalCount() {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Reset all counts
   */
  reset() {
    this.classes.forEach(code => {
      this.counts[code] = 0;
    });
    this.save();
    console.log('Class counts reset');
  }

  /**
   * Save counts to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.counts));
    } catch (error) {
      console.error('Failed to save class counts:', error);
    }
  }

  /**
   * Load counts from localStorage
   */
  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const loadedCounts = JSON.parse(saved);

        // Merge with current counts (preserves new classes)
        Object.keys(loadedCounts).forEach(key => {
          if (this.counts.hasOwnProperty(key)) {
            this.counts[key] = loadedCounts[key];
          }
        });

        console.log('Loaded class counts:', this.counts);
      }
    } catch (error) {
      console.error('Failed to load class counts:', error);
    }
  }

  /**
   * Export counts as JSON
   *
   * @returns {string}
   */
  export() {
    return JSON.stringify({
      counts: this.counts,
      total: this.getTotalCount(),
      timestamp: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Import counts from JSON
   *
   * @param {string} jsonString - JSON string
   */
  import(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.counts) {
        Object.keys(data.counts).forEach(key => {
          if (this.counts.hasOwnProperty(key)) {
            this.counts[key] = data.counts[key];
          }
        });
        this.save();
        console.log('Imported class counts:', this.counts);
      }
    } catch (error) {
      console.error('Failed to import class counts:', error);
    }
  }

  /**
   * Get counts summary for display
   *
   * @returns {string}
   */
  getSummary() {
    const total = this.getTotalCount();
    const lines = [`Total: ${total}`];

    Object.entries(this.counts).forEach(([code, count]) => {
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      lines.push(`${code}: ${count} (${percentage}%)`);
    });

    return lines.join('\n');
  }
}
