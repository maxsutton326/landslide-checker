/**
 * Progress Tracker
 *
 * Displays current position, total count, and progress visualization
 */

/**
 * ProgressTracker class
 */
export class ProgressTracker {
  /**
   * @param {HTMLElement} container - Container element
   * @param {number} total - Total number of items
   */
  constructor(container, total) {
    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.total = total;
    this.current = 0;
    this.labeled = 0;
    this.unlabeled = 0;

    // Statistics tracking
    this.stats = {
      labeled: 0,
      unlabeled: 0,
      skipped: 0,
      flagged: 0
    };

    this.initialize();
  }

  /**
   * Initialize UI elements
   */
  initialize() {
    this.container.innerHTML = '';
    this.container.className = 'progress-tracker';

    // Position display
    this.positionDisplay = document.createElement('div');
    this.positionDisplay.className = 'position-display';
    this.positionDisplay.textContent = `1 / ${this.total}`;
    this.container.appendChild(this.positionDisplay);

    // Progress bar container
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';

    // Progress bar background
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'progress-bar';

    // Progress fill
    this.progressFill = document.createElement('div');
    this.progressFill.className = 'progress-fill';
    this.progressFill.style.width = '0%';

    this.progressBar.appendChild(this.progressFill);
    progressBarContainer.appendChild(this.progressBar);
    this.container.appendChild(progressBarContainer);

    // Stats display
    this.statsDisplay = document.createElement('div');
    this.statsDisplay.className = 'stats-display';
    this.updateStatsDisplay();
    this.container.appendChild(this.statsDisplay);
  }

  /**
   * Update current position
   *
   * @param {number} current - Current index (0-based)
   * @param {number} labeled - Number of labeled items
   */
  update(current, labeled = null) {
    if (current < 0 || current >= this.total) {
      console.warn(`Invalid current index: ${current}`);
      return;
    }

    this.current = current;

    if (labeled !== null) {
      this.labeled = labeled;
      this.unlabeled = this.total - labeled;
      this.stats.labeled = labeled;
      this.stats.unlabeled = this.unlabeled;
    }

    // Update position display
    this.positionDisplay.textContent = `${current + 1} / ${this.total}`;

    // Update progress bar
    const progress = ((current + 1) / this.total) * 100;
    this.progressFill.style.width = `${progress}%`;

    // Update stats
    this.updateStatsDisplay();

    // Add completion animation if finished
    if (current === this.total - 1) {
      this.progressFill.classList.add('complete');
    } else {
      this.progressFill.classList.remove('complete');
    }
  }

  /**
   * Update statistics display
   */
  updateStatsDisplay() {
    const percentage = this.total > 0 ?
      ((this.stats.labeled / this.total) * 100).toFixed(1) : 0;

    this.statsDisplay.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">Labeled:</span>
        <span class="stat-value">${this.stats.labeled}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Progress:</span>
        <span class="stat-value">${percentage}%</span>
      </div>
    `;
  }

  /**
   * Get current statistics
   *
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      total: this.total,
      current: this.current,
      labeled: this.stats.labeled,
      unlabeled: this.stats.unlabeled,
      skipped: this.stats.skipped,
      flagged: this.stats.flagged,
      percentage: this.total > 0 ?
        ((this.stats.labeled / this.total) * 100) : 0,
      completionPercentage: this.total > 0 ?
        ((this.current + 1) / this.total) * 100 : 0
    };
  }

  /**
   * Increment a statistic
   *
   * @param {string} statName - Name of statistic to increment
   */
  incrementStat(statName) {
    if (this.stats.hasOwnProperty(statName)) {
      this.stats[statName]++;
      this.updateStatsDisplay();
    }
  }

  /**
   * Decrement a statistic
   *
   * @param {string} statName - Name of statistic to decrement
   */
  decrementStat(statName) {
    if (this.stats.hasOwnProperty(statName) && this.stats[statName] > 0) {
      this.stats[statName]--;
      this.updateStatsDisplay();
    }
  }

  /**
   * Set a statistic value
   *
   * @param {string} statName - Name of statistic
   * @param {number} value - New value
   */
  setStat(statName, value) {
    if (this.stats.hasOwnProperty(statName)) {
      this.stats[statName] = value;
      this.updateStatsDisplay();
    }
  }

  /**
   * Reset all statistics
   */
  reset() {
    this.current = 0;
    this.labeled = 0;
    this.unlabeled = this.total;

    this.stats = {
      labeled: 0,
      unlabeled: this.total,
      skipped: 0,
      flagged: 0
    };

    this.update(0, 0);
  }

  /**
   * Update total count
   *
   * @param {number} total - New total count
   */
  setTotal(total) {
    this.total = total;
    this.unlabeled = total - this.labeled;
    this.stats.unlabeled = this.unlabeled;
    this.positionDisplay.textContent = `${this.current + 1} / ${this.total}`;
    this.updateStatsDisplay();
  }

  /**
   * Show completion message
   *
   * @param {string} message - Optional custom message
   */
  showCompletion(message = 'All items reviewed!') {
    const completionDiv = document.createElement('div');
    completionDiv.className = 'completion-message';
    completionDiv.textContent = message;
    this.container.appendChild(completionDiv);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      completionDiv.remove();
    }, 3000);
  }

  /**
   * Set progress bar color
   *
   * @param {string} color - CSS color value
   */
  setProgressColor(color) {
    this.progressFill.style.backgroundColor = color;
  }

  /**
   * Add custom stat
   *
   * @param {string} name - Stat name
   * @param {string} label - Display label
   * @param {number} initialValue - Initial value
   */
  addCustomStat(name, label, initialValue = 0) {
    this.stats[name] = initialValue;

    // Add to display
    const statItem = document.createElement('div');
    statItem.className = 'stat-item';
    statItem.dataset.statName = name;
    statItem.innerHTML = `
      <span class="stat-label">${label}:</span>
      <span class="stat-value">${initialValue}</span>
    `;
    this.statsDisplay.appendChild(statItem);
  }

  /**
   * Remove custom stat
   *
   * @param {string} name - Stat name
   */
  removeCustomStat(name) {
    if (this.stats.hasOwnProperty(name)) {
      delete this.stats[name];

      // Remove from display
      const statItem = this.statsDisplay.querySelector(`[data-stat-name="${name}"]`);
      if (statItem) {
        statItem.remove();
      }
    }
  }

  /**
   * Export statistics as JSON
   *
   * @returns {string} - JSON string
   */
  exportStats() {
    return JSON.stringify(this.getStats(), null, 2);
  }

  /**
   * Import statistics from JSON
   *
   * @param {string} jsonString - JSON string
   */
  importStats(jsonString) {
    try {
      const imported = JSON.parse(jsonString);

      if (imported.current !== undefined) {
        this.current = imported.current;
      }

      Object.keys(this.stats).forEach(key => {
        if (imported[key] !== undefined) {
          this.stats[key] = imported[key];
        }
      });

      this.update(this.current, this.stats.labeled);
    } catch (error) {
      console.error('Failed to import stats:', error);
    }
  }

  /**
   * Get DOM element
   *
   * @returns {HTMLElement} - Container element
   */
  getElement() {
    return this.container;
  }

  /**
   * Destroy tracker and clean up
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
