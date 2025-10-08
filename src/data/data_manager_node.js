/**
 * Data Manager
 *
 * Centralized manager for loading and accessing all data sources
 * Handles caching, validation, and provides unified access interface
 */

// Use browser-compatible loaders with fetch() API
import { loadNumpyArray } from './numpy_loader_browser.js';
import { loadShapefile } from './shapefile_loader_browser.js';
import { loadGeoTiff } from './geotiff_loader_browser.js';
import { loadPredictions } from './prediction_loader_browser.js';
import { validateDatasets, generateValidationReport } from './validator.js';

/**
 * Data Manager Class
 *
 * Manages loading, caching, and validation of all data sources
 */
export class DataManager {
  /**
   * Create a new DataManager instance
   * @param {Object} config - Configuration object from config_loader
   */
  constructor(config) {
    this.config = config;
    this.cache = new Map();
    this.validationResult = null;
    this.loadingProgress = new Map();
  }

  /**
   * Load all data sources specified in configuration
   * @param {Object} options - Loading options
   * @param {Function} options.onProgress - Progress callback
   * @returns {Promise<void>}
   */
  async loadAll(options = {}) {
    const { onProgress = null } = options;

    const dataSources = this.config;

    // Track overall progress
    const sourcesToLoad = [];
    if (dataSources.numpy_stack) sourcesToLoad.push('numpy_stack');
    if (dataSources.shapefile) sourcesToLoad.push('shapefile');
    if (dataSources.source_images) sourcesToLoad.push('source_images');
    if (dataSources.predictions) sourcesToLoad.push('predictions');

    const totalSources = sourcesToLoad.length;
    let completedSources = 0;

    const updateOverallProgress = (source, progress) => {
      this.loadingProgress.set(source, progress);

      if (onProgress) {
        const avgProgress = Array.from(this.loadingProgress.values())
          .reduce((sum, p) => sum + p.progress, 0) / totalSources;

        onProgress({
          source,
          stage: progress.stage,
          progress: avgProgress,
          completed: completedSources,
          total: totalSources,
          message: progress.message
        });
      }
    };

    try {
      // Load NumPy stack (required)
      if (dataSources.numpy_stack) {
        const stackConfig = dataSources.numpy_stack;

        await this._loadNumpyStack(stackConfig, (progress) => {
          updateOverallProgress('numpy_stack', progress);
        });

        completedSources++;
      }

      // Load shapefile (required)
      if (dataSources.shapefile) {
        const shpConfig = dataSources.shapefile;

        await this._loadShapefile(shpConfig, (progress) => {
          updateOverallProgress('shapefile', progress);
        });

        completedSources++;
      }

      // Load source images (optional)
      if (dataSources.source_images) {
        await this._loadSourceImages(dataSources.source_images, (progress) => {
          updateOverallProgress('source_images', progress);
        });

        completedSources++;
      }

      // Load predictions (optional)
      if (dataSources.predictions) {
        const predConfig = dataSources.predictions;

        await this._loadPredictions(predConfig, (progress) => {
          updateOverallProgress('predictions', progress);
        });

        completedSources++;
      }

      // Run validation
      if (onProgress) {
        onProgress({
          source: 'validation',
          stage: 'validating',
          progress: 0.9,
          completed: completedSources,
          total: totalSources,
          message: 'Validating datasets...'
        });
      }

      this._runValidation();

      if (onProgress) {
        onProgress({
          source: 'all',
          stage: 'complete',
          progress: 1.0,
          completed: totalSources,
          total: totalSources,
          message: 'All data loaded'
        });
      }

    } catch (error) {
      // Clear partial cache on error
      this.cache.clear();
      throw error;
    }
  }

  /**
   * Load NumPy stack data
   * @private
   */
  async _loadNumpyStack(config, onProgress) {
    const data = await loadNumpyArray(config.path, {
      expectedDimensions: 4,
      validateRange: true,
      onProgress
    });

    // Add config metadata to loaded data
    data.metadata.epsg = config.epsg;
    data.metadata.origin = config.origin;
    data.metadata.pixelSize = config.pixel_size;
    data.metadata.beforeIndex = config.before_index;
    data.metadata.afterIndex = config.after_index;

    this.cache.set('numpy_stack', data);
  }

  /**
   * Load shapefile data
   * @private
   */
  async _loadShapefile(config, onProgress) {
    const data = await loadShapefile(config.file, {
      idField: config.id_field,
      onProgress
    });

    this.cache.set('shapefile', data);
  }

  /**
   * Load source images
   * @private
   */
  async _loadSourceImages(imagesConfig, onProgress) {
    const images = [];

    for (let i = 0; i < imagesConfig.length; i++) {
      const imgConfig = imagesConfig[i];

      const imageData = await loadGeoTiff(imgConfig.file, {
        metadataOnly: true, // For now, only load metadata
        onProgress: (progress) => {
          if (onProgress) {
            onProgress({
              ...progress,
              message: `Loading source image ${i + 1}/${imagesConfig.length}...`
            });
          }
        }
      });

      imageData.type = imgConfig.type; // 'before' or 'after'
      images.push(imageData);
    }

    this.cache.set('source_images', images);
  }

  /**
   * Load predictions
   * @private
   */
  async _loadPredictions(config, onProgress) {
    // Get expected shape from numpy stack
    const numpyStack = this.cache.get('numpy_stack');
    let expectedShape = null;

    if (numpyStack) {
      const stackShape = numpyStack.metadata.shape;
      // Expected: [rows, cols, classes]
      expectedShape = [stackShape[1], stackShape[2], 2]; // Assume 2 classes by default
    }

    const data = await loadPredictions(config.file, {
      expectedShape: null, // Don't enforce shape, just warn
      validateRange: true,
      onProgress
    });

    data.metadata.defaultIndex = config.default_index;

    this.cache.set('predictions', data);
  }

  /**
   * Run validation on all loaded datasets
   * @private
   */
  _runValidation() {
    const datasets = {
      numpy_stack: this.cache.get('numpy_stack'),
      shapefile: this.cache.get('shapefile'),
      source_images: this.cache.get('source_images'),
      predictions: this.cache.get('predictions')
    };

    this.validationResult = validateDatasets(datasets);

    // Log validation results
    if (!this.validationResult.valid) {
      console.error('Data validation failed:');
      this.validationResult.errors.forEach(err => {
        console.error(`  ✗ ${err}`);
      });
    }

    if (this.validationResult.warnings.length > 0) {
      console.warn('Data validation warnings:');
      this.validationResult.warnings.forEach(warn => {
        console.warn(`  ⚠ ${warn}`);
      });
    }

    // Throw error if validation failed
    if (!this.validationResult.valid) {
      throw new Error(
        `Data validation failed with ${this.validationResult.errors.length} error(s). ` +
        'See console for details.'
      );
    }
  }

  /**
   * Get loaded data for a specific source
   * @param {string} source - Source name ('numpy_stack', 'shapefile', etc.)
   * @returns {Object|null} - Loaded data or null if not loaded
   */
  getData(source) {
    return this.cache.get(source);
  }

  /**
   * Check if a data source is loaded
   * @param {string} source - Source name
   * @returns {boolean} - True if loaded
   */
  isLoaded(source) {
    return this.cache.has(source);
  }

  /**
   * Get all loaded data sources
   * @returns {Array<string>} - Array of loaded source names
   */
  getLoadedSources() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get validation report
   * @param {boolean} formatted - Return formatted text report
   * @returns {Object|string} - Validation result or formatted report
   */
  getValidationReport(formatted = false) {
    if (!this.validationResult) {
      return formatted ? 'No validation has been run yet.' : null;
    }

    return formatted
      ? generateValidationReport(this.validationResult)
      : this.validationResult;
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.cache.clear();
    this.validationResult = null;
    this.loadingProgress.clear();
  }

  /**
   * Get memory usage estimate
   * @returns {Object} - Memory usage information
   */
  getMemoryUsage() {
    const usage = {};
    let totalBytes = 0;

    this.cache.forEach((data, source) => {
      let bytes = 0;

      if (data.data && Array.isArray(data.data)) {
        // Estimate array size (assuming 8 bytes per number)
        bytes = data.data.length * 8;
      }

      if (data.features && Array.isArray(data.features)) {
        // Rough estimate for features
        bytes = JSON.stringify(data.features).length;
      }

      usage[source] = {
        bytes,
        megabytes: (bytes / 1024 / 1024).toFixed(2)
      };

      totalBytes += bytes;
    });

    usage.total = {
      bytes: totalBytes,
      megabytes: (totalBytes / 1024 / 1024).toFixed(2)
    };

    return usage;
  }

  /**
   * Reload a specific data source
   * @param {string} source - Source name to reload
   * @returns {Promise<void>}
   */
  async reload(source) {
    const dataSources = this.config.data_sources;

    // Remove from cache
    this.cache.delete(source);

    // Reload based on source type
    switch (source) {
      case 'numpy_stack':
        if (dataSources.numpy_stack) {
          await this._loadNumpyStack(dataSources.numpy_stack);
        }
        break;

      case 'shapefile':
        if (dataSources.shapefile) {
          await this._loadShapefile(dataSources.shapefile);
        }
        break;

      case 'source_images':
        if (dataSources.source_images) {
          await this._loadSourceImages(dataSources.source_images);
        }
        break;

      case 'predictions':
        if (dataSources.predictions) {
          await this._loadPredictions(dataSources.predictions);
        }
        break;

      default:
        throw new Error(`Unknown data source: ${source}`);
    }

    // Re-run validation
    this._runValidation();
  }

  /**
   * Get summary of all loaded data
   * @returns {Object} - Summary information
   */
  getSummary() {
    const summary = {
      loaded_sources: this.getLoadedSources(),
      validation_status: this.validationResult?.valid ? 'PASSED' : 'FAILED',
      memory_usage: this.getMemoryUsage(),
      details: {}
    };

    // Add details for each source
    const numpyStack = this.cache.get('numpy_stack');
    if (numpyStack) {
      summary.details.numpy_stack = {
        shape: numpyStack.metadata.shape,
        dtype: numpyStack.metadata.dtypeName,
        epsg: numpyStack.metadata.epsg
      };
    }

    const shapefile = this.cache.get('shapefile');
    if (shapefile) {
      summary.details.shapefile = {
        feature_count: shapefile.count,
        projection: shapefile.projection,
        bounds: shapefile.bounds
      };
    }

    const predictions = this.cache.get('predictions');
    if (predictions) {
      summary.details.predictions = {
        shape: predictions.metadata.shape,
        classes: predictions.metadata.classes
      };
    }

    const sourceImages = this.cache.get('source_images');
    if (sourceImages) {
      summary.details.source_images = {
        count: sourceImages.length,
        types: sourceImages.map(img => img.type)
      };
    }

    return summary;
  }
}
