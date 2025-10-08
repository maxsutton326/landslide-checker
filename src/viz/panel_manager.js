/**
 * Panel Manager
 *
 * Coordinates multiple visualization panels, manages data distribution,
 * and handles synchronized updates across all panels.
 */

/**
 * PanelManager class
 */
export class PanelManager {
  constructor() {
    this.panels = new Map();
    this.masterPanel = null;
    this.syncEnabled = true;
    this.timeIndex = 0;
  }

  /**
   * Add a panel to the manager
   *
   * @param {string} id - Panel identifier
   * @param {Panel} panel - Panel instance
   */
  addPanel(id, panel) {
    this.panels.set(id, panel);

    // Listen for view changes from this panel
    panel.on('viewchange', (transform) => {
      if (this.syncEnabled && panel === this.masterPanel) {
        this.broadcastView(transform, panel);
      }
    });

    // Set as master if first panel
    if (this.panels.size === 1) {
      this.setMasterPanel(panel);
    }

    return this;
  }

  /**
   * Remove a panel from the manager
   *
   * @param {string} id - Panel identifier
   */
  removePanel(id) {
    const panel = this.panels.get(id);
    if (panel) {
      panel.destroy();
      this.panels.delete(id);

      if (this.masterPanel === panel) {
        // Set new master panel
        const firstPanel = this.panels.values().next().value;
        if (firstPanel) {
          this.setMasterPanel(firstPanel);
        } else {
          this.masterPanel = null;
        }
      }
    }
    return this;
  }

  /**
   * Get a panel by ID
   *
   * @param {string} id - Panel identifier
   * @returns {Panel|undefined} - Panel instance
   */
  getPanel(id) {
    return this.panels.get(id);
  }

  /**
   * Get all panels
   *
   * @returns {Array<Panel>} - Array of all panels
   */
  getAllPanels() {
    return Array.from(this.panels.values());
  }

  /**
   * Set the master panel that controls view synchronization
   *
   * @param {Panel} panel - Panel to set as master
   */
  setMasterPanel(panel) {
    // Deactivate current master
    if (this.masterPanel) {
      this.masterPanel.setActive(false);
    }

    this.masterPanel = panel;

    if (panel) {
      panel.setActive(true);
    }

    return this;
  }

  /**
   * Broadcast view transformation to all panels except source
   *
   * @param {Object} transform - View transformation
   * @param {Panel} sourcePanel - Panel that initiated the change
   */
  broadcastView(transform, sourcePanel = null) {
    this.panels.forEach(panel => {
      if (panel !== sourcePanel) {
        panel.setView(transform);
      }
    });
  }

  /**
   * Update all panels with new landslide data
   *
   * @param {Object} landslideData - Landslide and associated data
   */
  updateAll(landslideData) {
    const {
      landslide,
      source1Data,
      source2Data,
      planetBeforeData,
      planetAfterData,
      predictionData
    } = landslideData;

    // Set polygon on all panels
    this.panels.forEach(panel => {
      panel.setPolygon(landslide);
    });

    // Set data for each panel
    if (source1Data) {
      const panel = this.getPanel('source-1');
      if (panel) panel.setData(source1Data);
    }

    if (source2Data) {
      const panel = this.getPanel('source-2');
      if (panel) panel.setData(source2Data);
    }

    if (planetBeforeData) {
      const panel = this.getPanel('planet-before');
      if (panel) panel.setData(planetBeforeData);
    }

    if (planetAfterData) {
      const panel = this.getPanel('planet-after');
      if (panel) panel.setData(planetAfterData);
    }

    if (predictionData) {
      const panel = this.getPanel('prediction');
      if (panel) panel.setData(predictionData);
    }

    return this;
  }

  /**
   * Set time index for temporal data
   *
   * @param {number} index - Time index
   */
  setTimeIndex(index) {
    this.timeIndex = index;
    // Trigger re-render of relevant panels
    this.renderAll();
    return this;
  }

  /**
   * Render all panels
   */
  renderAll() {
    this.panels.forEach(panel => panel.render());
    return this;
  }

  /**
   * Clear all panels
   */
  clearAll() {
    this.panels.forEach(panel => panel.clear());
    return this;
  }

  /**
   * Reset all panel views
   */
  resetAllViews() {
    this.panels.forEach(panel => panel.resetView());
    return this;
  }

  /**
   * Enable synchronization
   */
  enableSync() {
    this.syncEnabled = true;
    return this;
  }

  /**
   * Disable synchronization
   */
  disableSync() {
    this.syncEnabled = false;
    return this;
  }

  /**
   * Toggle synchronization
   */
  toggleSync() {
    this.syncEnabled = !this.syncEnabled;
    return this;
  }

  /**
   * Get synchronization state
   *
   * @returns {boolean} - Whether sync is enabled
   */
  isSyncEnabled() {
    return this.syncEnabled;
  }

  /**
   * Enable interactions on all panels
   */
  enableAllInteractions() {
    this.panels.forEach(panel => panel.enableInteractions());
    return this;
  }

  /**
   * Disable interactions on all panels except master
   */
  enableMasterOnly() {
    this.panels.forEach(panel => {
      if (panel === this.masterPanel) {
        panel.enableInteractions();
      } else {
        panel.disableInteractions();
      }
    });
    return this;
  }

  /**
   * Set panel visibility
   *
   * @param {string} id - Panel identifier
   * @param {boolean} visible - Visibility state
   */
  setPanelVisibility(id, visible) {
    const panel = this.panels.get(id);
    if (panel) {
      panel.setVisible(visible);
    }
    return this;
  }

  /**
   * Get manager state
   *
   * @returns {Object} - Manager state
   */
  getState() {
    return {
      panelCount: this.panels.size,
      syncEnabled: this.syncEnabled,
      timeIndex: this.timeIndex,
      masterPanelId: this.masterPanel?.id || null,
      panels: Array.from(this.panels.entries()).map(([id, panel]) => ({
        id,
        info: panel.getInfo()
      }))
    };
  }

  /**
   * Destroy all panels and clean up
   */
  destroy() {
    this.panels.forEach(panel => panel.destroy());
    this.panels.clear();
    this.masterPanel = null;
  }
}
