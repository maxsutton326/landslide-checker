/**
 * Synchronization Controller
 *
 * Detects user interactions on panels and synchronizes view transformations
 * across all panels with debouncing for smooth performance.
 */

/**
 * Debounce function to limit rapid updates
 *
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit update frequency
 *
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function} - Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * SyncController class
 */
export class SyncController {
  /**
   * @param {PanelManager} panelManager - Panel manager instance
   */
  constructor(panelManager) {
    if (!panelManager) {
      throw new Error('PanelManager is required');
    }

    this.panelManager = panelManager;
    this.leadPanel = null;
    this.syncEnabled = true;
    this.isUpdating = false;

    // Performance settings
    this.updateThrottle = 16; // ~60 FPS
    this.debounceDelay = 100;

    // Bind methods
    this.handleViewChange = throttle(
      this.handleViewChange.bind(this),
      this.updateThrottle
    );

    this.handleViewChangeEnd = debounce(
      this.handleViewChangeEnd.bind(this),
      this.debounceDelay
    );
  }

  /**
   * Enable synchronization
   */
  enableSync() {
    this.syncEnabled = true;
    this.attachListeners();
    return this;
  }

  /**
   * Disable synchronization
   */
  disableSync() {
    this.syncEnabled = false;
    this.detachListeners();
    return this;
  }

  /**
   * Toggle synchronization
   */
  toggleSync() {
    if (this.syncEnabled) {
      this.disableSync();
    } else {
      this.enableSync();
    }
    return this;
  }

  /**
   * Attach event listeners to all panels
   */
  attachListeners() {
    const panels = this.panelManager.getAllPanels();

    panels.forEach(panel => {
      panel.on('viewchange', (transform) => {
        if (this.syncEnabled && !this.isUpdating) {
          this.handleViewChange(panel, transform);
        }
      });
    });
  }

  /**
   * Detach event listeners from all panels
   */
  detachListeners() {
    const panels = this.panelManager.getAllPanels();

    panels.forEach(panel => {
      panel.off('viewchange');
    });
  }

  /**
   * Handle view change from a panel
   *
   * @param {Panel} sourcePanel - Panel that initiated the change
   * @param {Object} transform - View transformation
   */
  handleViewChange(sourcePanel, transform) {
    if (!this.syncEnabled || this.isUpdating) {
      return;
    }

    // Set this panel as lead
    this.leadPanel = sourcePanel;

    // Prevent recursive updates
    this.isUpdating = true;

    try {
      // Broadcast to all other panels
      this.synchronizePanels(sourcePanel, transform);
    } finally {
      this.isUpdating = false;
    }

    // Trigger end handler
    this.handleViewChangeEnd(sourcePanel, transform);
  }

  /**
   * Synchronize all panels with the transform
   *
   * @param {Panel} sourcePanel - Panel that initiated the change
   * @param {Object} transform - View transformation
   */
  synchronizePanels(sourcePanel, transform) {
    const panels = this.panelManager.getAllPanels();

    panels.forEach(panel => {
      if (panel !== sourcePanel) {
        // Apply same transform to other panels
        panel.setView(transform);
      }
    });
  }

  /**
   * Handle end of view change sequence (debounced)
   *
   * @param {Panel} sourcePanel - Panel that initiated the change
   * @param {Object} transform - View transformation
   */
  handleViewChangeEnd(sourcePanel, transform) {
    // This is called after user stops interacting
    // Can be used for final adjustments or logging
    console.debug('View change completed', {
      leadPanel: this.leadPanel?.label,
      transform: {
        scale: transform.scale,
        offset: transform.offset
      }
    });
  }

  /**
   * Set the lead panel (panel that controls synchronization)
   *
   * @param {Panel} panel - Panel to set as lead
   */
  setLeadPanel(panel) {
    this.leadPanel = panel;
    this.panelManager.setMasterPanel(panel);
    return this;
  }

  /**
   * Get the current lead panel
   *
   * @returns {Panel|null} - Lead panel
   */
  getLeadPanel() {
    return this.leadPanel;
  }

  /**
   * Synchronize all panels to a specific transform
   *
   * @param {Object} transform - Target transformation
   */
  syncAllToTransform(transform) {
    this.isUpdating = true;

    try {
      const panels = this.panelManager.getAllPanels();
      panels.forEach(panel => {
        panel.setView(transform);
      });
    } finally {
      this.isUpdating = false;
    }

    return this;
  }

  /**
   * Reset all panels to initial view
   */
  resetAllViews() {
    this.isUpdating = true;

    try {
      this.panelManager.resetAllViews();
    } finally {
      this.isUpdating = false;
    }

    return this;
  }

  /**
   * Get synchronization state
   *
   * @returns {Object} - Sync state
   */
  getSyncState() {
    return {
      enabled: this.syncEnabled,
      leadPanelId: this.leadPanel?.id || null,
      leadPanelLabel: this.leadPanel?.label || null,
      isUpdating: this.isUpdating,
      panelCount: this.panelManager.panels.size
    };
  }

  /**
   * Set throttle rate for updates
   *
   * @param {number} throttle - Milliseconds between updates
   */
  setThrottle(throttle) {
    this.updateThrottle = throttle;

    // Recreate throttled handler
    this.handleViewChange = throttle(
      this.handleViewChange.bind(this),
      this.updateThrottle
    );

    return this;
  }

  /**
   * Set debounce delay for end handler
   *
   * @param {number} delay - Milliseconds to debounce
   */
  setDebounce(delay) {
    this.debounceDelay = delay;

    // Recreate debounced handler
    this.handleViewChangeEnd = debounce(
      this.handleViewChangeEnd.bind(this),
      this.debounceDelay
    );

    return this;
  }

  /**
   * Destroy controller and clean up
   */
  destroy() {
    this.detachListeners();
    this.leadPanel = null;
    this.panelManager = null;
  }
}
