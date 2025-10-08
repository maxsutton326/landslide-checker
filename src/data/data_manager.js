/**
 * Data Manager - Browser Version
 *
 * Fetches data from server API instead of loading files directly
 * Server handles all heavy lifting with Node.js modules
 */

const API_BASE = 'http://localhost:3000';

/**
 * Data Manager Class for Browser
 *
 * Communicates with server to fetch data slices on demand
 */
export class DataManager {
  /**
   * Create a new DataManager instance
   * @param {Object} config - Configuration object (optional, will fetch from server)
   */
  constructor(config = null) {
    this.config = config;
    this.summary = null;
    this.landslides = null;
    this.loaded = false;
  }

  /**
   * Load configuration and data summary from server
   * @param {Object} options - Loading options
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<void>}
   */
  async loadAll(options = {}) {
    const { onProgress = null } = options;

    try {
      if (onProgress) {
        onProgress({
          source: 'config',
          stage: 'reading',
          progress: 0.1,
          message: 'Loading configuration...'
        });
      }

      // Load config from server (this triggers server to load all data)
      const configRes = await fetch(`${API_BASE}/api/config?path=tests/test_configs/browser_test.yaml`);
      if (!configRes.ok) {
        throw new Error(`Failed to load config: ${configRes.status}`);
      }
      this.config = await configRes.json();

      if (onProgress) {
        onProgress({
          source: 'summary',
          stage: 'reading',
          progress: 0.3,
          message: 'Loading data summary...'
        });
      }

      // Get data summary from server
      const summaryRes = await fetch(`${API_BASE}/api/data/summary`);
      if (!summaryRes.ok) {
        // Server is still loading, wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryRes = await fetch(`${API_BASE}/api/data/summary`);
        if (!retryRes.ok) {
          throw new Error(`Failed to load data summary: ${retryRes.status}`);
        }
        this.summary = await retryRes.json();
      } else {
        this.summary = await summaryRes.json();
      }

      if (onProgress) {
        onProgress({
          source: 'landslides',
          stage: 'reading',
          progress: 0.6,
          message: 'Loading landslide features...'
        });
      }

      // Load landslide features
      const landslidesRes = await fetch(`${API_BASE}/api/landslides`);
      if (!landslidesRes.ok) {
        throw new Error(`Failed to load landslides: ${landslidesRes.status}`);
      }
      this.landslides = await landslidesRes.json();

      if (onProgress) {
        onProgress({
          source: 'all',
          stage: 'complete',
          progress: 1.0,
          message: 'All data loaded'
        });
      }

      this.loaded = true;

    } catch (error) {
      console.error('Failed to load data:', error);
      throw error;
    }
  }

  /**
   * Get image slice from server
   *
   * @param {number} timeIndex - Time index (0 = before, 1 = after)
   * @param {number} bandIndex - Band index
   * @param {Object} window - Optional window {rowStart, rowEnd, colStart, colEnd}
   * @returns {Promise<Object>} - {data, shape}
   */
  async getImageSlice(timeIndex, bandIndex, window = null) {
    const params = new URLSearchParams({
      time: timeIndex,
      band: bandIndex
    });

    if (window) {
      params.append('rowStart', window.rowStart);
      params.append('rowEnd', window.rowEnd);
      params.append('colStart', window.colStart);
      params.append('colEnd', window.colEnd);
    }

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch image slice: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get prediction slice from server
   *
   * @param {number} classIndex - Class index
   * @param {Object} window - Optional window {rowStart, rowEnd, colStart, colEnd}
   * @returns {Promise<Object>} - {data, shape}
   */
  async getPredictionSlice(classIndex, window = null) {
    const params = new URLSearchParams({
      class: classIndex
    });

    if (window) {
      params.append('rowStart', window.rowStart);
      params.append('rowEnd', window.rowEnd);
      params.append('colStart', window.colStart);
      params.append('colEnd', window.colEnd);
    }

    const response = await fetch(`${API_BASE}/api/predictions/slice?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch prediction slice: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get loaded data summary (metadata only, no actual pixel data)
   * @param {string} source - Source name
   * @returns {Object|null} - Data summary or null
   */
  getData(source) {
    if (!this.loaded) {
      return null;
    }

    switch (source) {
      case 'numpy_stack':
        return {
          metadata: this.summary.numpy_stack,
          // Data is fetched on-demand via getImageSlice()
          data: null,
        };

      case 'shapefile':
        return {
          features: this.landslides.features,
          count: this.landslides.count,
          projection: this.landslides.projection
        };

      case 'predictions':
        return this.summary.predictions ? {
          metadata: this.summary.predictions,
          // Data is fetched on-demand via getPredictionSlice()
          data: null
        } : null;

      default:
        return null;
    }
  }

  /**
   * Check if a data source is loaded
   * @param {string} source - Source name
   * @returns {boolean} - True if loaded
   */
  isLoaded(source) {
    if (!this.loaded) {
      return false;
    }

    switch (source) {
      case 'numpy_stack':
        return !!this.summary?.numpy_stack;
      case 'shapefile':
        return !!this.landslides;
      case 'predictions':
        return !!this.summary?.predictions;
      default:
        return false;
    }
  }

  /**
   * Get all loaded data sources
   * @returns {Array<string>} - Array of loaded source names
   */
  getLoadedSources() {
    if (!this.loaded) {
      return [];
    }

    const sources = [];
    if (this.summary?.numpy_stack) sources.push('numpy_stack');
    if (this.landslides) sources.push('shapefile');
    if (this.summary?.predictions) sources.push('predictions');
    return sources;
  }

  /**
   * Get validation report (simplified for browser)
   * @param {boolean} formatted - Return formatted text report
   * @returns {Object|string} - Validation result
   */
  getValidationReport(formatted = false) {
    if (!this.loaded) {
      return formatted ? 'No data loaded yet.' : null;
    }

    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Basic validation
    if (!this.summary?.numpy_stack) {
      result.errors.push('NumPy stack not loaded');
      result.valid = false;
    }

    if (!this.landslides) {
      result.errors.push('Shapefile not loaded');
      result.valid = false;
    }

    if (formatted) {
      let report = '=== Data Validation Report ===\n\n';
      report += `Status: ${result.valid ? 'PASSED' : 'FAILED'}\n\n`;

      if (result.errors.length > 0) {
        report += 'Errors:\n';
        result.errors.forEach(err => report += `  ✗ ${err}\n`);
      }

      if (result.warnings.length > 0) {
        report += '\nWarnings:\n';
        result.warnings.forEach(warn => report += `  ⚠ ${warn}\n`);
      }

      return report;
    }

    return result;
  }

  /**
   * Get summary of all loaded data
   * @returns {Object} - Summary information
   */
  getSummary() {
    if (!this.loaded) {
      return {
        loaded_sources: [],
        validation_status: 'NOT_LOADED',
        details: {}
      };
    }

    return {
      loaded_sources: this.getLoadedSources(),
      validation_status: 'PASSED',
      details: {
        numpy_stack: this.summary.numpy_stack,
        shapefile: {
          feature_count: this.landslides.count,
          projection: this.landslides.projection
        },
        predictions: this.summary.predictions
      }
    };
  }

  /**
   * Clear cached data (browser version doesn't cache pixel data)
   */
  clear() {
    this.config = null;
    this.summary = null;
    this.landslides = null;
    this.loaded = false;
  }
}
