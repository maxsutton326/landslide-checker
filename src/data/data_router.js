/**
 * Data Router
 *
 * Maps panels to data sources, handles transformations,
 * caches processed data, and manages temporal indices.
 */

/**
 * DataRouter class
 */
export class DataRouter {
  /**
   * @param {DataManager} dataManager - Data manager instance
   * @param {Object} config - Configuration object
   */
  constructor(dataManager, config) {
    this.dataManager = dataManager;
    this.config = config;

    // Cache for processed data
    this.cache = new Map();

    // Current temporal index
    this.currentTimeIndex = 0;

    // Panel to data source mapping
    this.panelMapping = {
      'source-1': { dataType: 'numpy_stack', timeIndex: 0 },
      'source-2': { dataType: 'numpy_stack', timeIndex: 1 },
      'planet-before': { dataType: 'numpy_stack', timeIndex: 0 },
      'planet-after': { dataType: 'numpy_stack', timeIndex: 1 },
      'prediction': { dataType: 'predictions', timeIndex: null }
    };
  }

  /**
   * Assign data to a panel
   *
   * @param {string} panelId - Panel identifier
   * @param {string} dataType - Data type ('numpy_stack', 'predictions', etc.)
   * @param {number} timeIndex - Optional time index
   */
  assignDataToPanel(panelId, dataType, timeIndex = null) {
    this.panelMapping[panelId] = { dataType, timeIndex };
  }

  /**
   * Get data for a specific panel
   *
   * @param {string} panelId - Panel identifier
   * @param {Object} displayWindow - Display window specification
   * @param {number} overrideTimeIndex - Override time index
   * @returns {Object} - Data object with array, shape, bounds
   */
  getDataForPanel(panelId, displayWindow, overrideTimeIndex = null) {
    const mapping = this.panelMapping[panelId];
    if (!mapping) {
      console.warn(`No mapping found for panel ${panelId}`);
      return null;
    }

    // Determine time index
    const timeIndex = overrideTimeIndex !== null ?
      overrideTimeIndex :
      (mapping.timeIndex !== null ? mapping.timeIndex : this.currentTimeIndex);

    // Create cache key
    const cacheKey = this.createCacheKey(panelId, displayWindow, timeIndex);

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get data based on type
    let data;
    if (mapping.dataType === 'numpy_stack') {
      data = this.getStackData(displayWindow, timeIndex);
    } else if (mapping.dataType === 'predictions') {
      data = this.getPredictionData(displayWindow);
    } else {
      console.warn(`Unknown data type: ${mapping.dataType}`);
      return null;
    }

    // Cache the result
    if (data) {
      this.cache.set(cacheKey, data);

      // Limit cache size
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return data;
  }

  /**
   * Get stack data (imagery)
   *
   * @param {Object} displayWindow - Display window
   * @param {number} timeIndex - Time index
   * @returns {Object} - Data object
   */
  getStackData(displayWindow, timeIndex) {
    const { cropArray4D } = require('../utils/image_cropper.js');

    const stackShape = this.config.numpy_stack.shape;
    const croppedData = cropArray4D(
      this.dataManager.numpy_stack,
      stackShape,
      displayWindow.rowStart,
      displayWindow.rowEnd,
      displayWindow.colStart,
      displayWindow.colEnd,
      timeIndex
    );

    return {
      array: croppedData.data,
      shape: croppedData.shape,
      bounds: displayWindow.geoBounds,
      dataType: 'imagery',
      timeIndex
    };
  }

  /**
   * Get prediction data
   *
   * @param {Object} displayWindow - Display window
   * @returns {Object} - Data object
   */
  getPredictionData(displayWindow) {
    const { cropPredictions } = require('../utils/image_cropper.js');

    const predShape = this.config.predictions.shape;
    const croppedData = cropPredictions(
      this.dataManager.predictions,
      predShape,
      displayWindow.rowStart,
      displayWindow.rowEnd,
      displayWindow.colStart,
      displayWindow.colEnd
    );

    return {
      array: croppedData.data,
      shape: croppedData.shape,
      bounds: displayWindow.geoBounds,
      dataType: 'prediction'
    };
  }

  /**
   * Update temporal index
   *
   * @param {number} index - New time index
   */
  updateTimeIndex(index) {
    this.currentTimeIndex = index;
  }

  /**
   * Get current time index
   *
   * @returns {number} - Current time index
   */
  getCurrentTimeIndex() {
    return this.currentTimeIndex;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear cache for specific panel
   *
   * @param {string} panelId - Panel identifier
   */
  clearPanelCache(panelId) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(panelId + ':')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Create cache key
   *
   * @param {string} panelId - Panel identifier
   * @param {Object} displayWindow - Display window
   * @param {number} timeIndex - Time index
   * @returns {string} - Cache key
   */
  createCacheKey(panelId, displayWindow, timeIndex) {
    return `${panelId}:${timeIndex}:${displayWindow.rowStart}-${displayWindow.rowEnd}:${displayWindow.colStart}-${displayWindow.colEnd}`;
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} - Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Prefetch data for panels
   *
   * @param {Array<string>} panelIds - Panel identifiers
   * @param {Object} displayWindow - Display window
   */
  prefetchData(panelIds, displayWindow) {
    panelIds.forEach(panelId => {
      this.getDataForPanel(panelId, displayWindow);
    });
  }

  /**
   * Get panel mapping
   *
   * @returns {Object} - Panel mapping configuration
   */
  getPanelMapping() {
    return { ...this.panelMapping };
  }

  /**
   * Set panel mapping
   *
   * @param {Object} mapping - New mapping configuration
   */
  setPanelMapping(mapping) {
    this.panelMapping = { ...mapping };
    this.clearCache();
  }
}
