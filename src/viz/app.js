/**
 * Main Application for Landslide Data Quality Assessment
 *
 * Coordinates data loading, rendering, and user interactions
 */

import { DataManager } from '../core/data_manager.js';
import { CanvasRenderer } from './canvas_renderer.js';
import { drawPolygon, confidenceStyle } from './polygon_renderer.js';
import { ViewController } from './view_controller.js';
import { calculateDisplayWindow } from '../utils/window_calculator.js';
import { cropArray4D, cropPredictions } from '../utils/image_cropper.js';

/**
 * Main Application class
 */
class LandslideViewerApp {
  constructor() {
    this.dataManager = null;
    this.renderer = null;
    this.viewController = null;
    this.currentLandslideIndex = 0;
    this.landslides = [];
    this.config = null;
    this.isLoading = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.showStatus('Loading configuration...');

      // Load configuration
      this.config = await this.loadConfig();

      // Initialize data manager
      this.dataManager = new DataManager(this.config);

      this.showStatus('Loading data...');

      // Load all data
      await this.dataManager.loadAll();

      // Get landslides list
      this.landslides = this.dataManager.shapefile.features;

      if (this.landslides.length === 0) {
        throw new Error('No landslides found in dataset');
      }

      this.showStatus(`Loaded ${this.landslides.length} landslides`);

      // Setup UI
      this.setupCanvas();
      this.setupControls();
      this.setupEventHandlers();

      // Load first landslide
      await this.loadLandslide(0);

      this.showStatus('Ready');
    } catch (error) {
      this.showError(`Failed to initialize: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Load configuration from file or use defaults
   */
  async loadConfig() {
    try {
      const response = await fetch('data/test_data_summary.json');
      const summary = await response.json();

      return {
        numpy_stack: {
          path: summary.files.numpy_stack.path,
          shape: summary.files.numpy_stack.shape
        },
        shapefile: {
          path: summary.files.polygons.path,
          crs: summary.files.polygons.crs
        },
        predictions: {
          path: summary.files.predictions.path,
          shape: summary.files.predictions.shape
        },
        metadata: {
          source1: summary.files.geotiff_metadata.source1,
          source2: summary.files.geotiff_metadata.source2
        }
      };
    } catch (error) {
      console.warn('Could not load config, using defaults:', error);
      return {
        numpy_stack: {
          path: 'data/test_stack.json',
          shape: [2, 100, 100, 3]
        },
        shapefile: {
          path: 'data/landslides.geojson',
          crs: 'EPSG:32610'
        },
        predictions: {
          path: 'data/predictions.json',
          shape: [100, 100, 2]
        }
      };
    }
  }

  /**
   * Setup canvas and renderer
   */
  setupCanvas() {
    const canvas = document.getElementById('main-canvas');

    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    // Set canvas size
    const container = document.getElementById('viewer-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight - 50; // Account for controls

    // Create renderer
    this.renderer = new CanvasRenderer(canvas);

    // Handle window resize
    window.addEventListener('resize', () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight - 50;
      if (this.viewController) {
        this.viewController.reset();
        this.render();
      }
    });
  }

  /**
   * Setup UI controls
   */
  setupControls() {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetBtn = document.getElementById('reset-view');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        const canvas = this.renderer.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        this.viewController.zoom(1.3, centerX, centerY);
        this.render();
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const canvas = this.renderer.canvas;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        this.viewController.zoom(0.7, centerX, centerY);
        this.render();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.viewController.reset();
        this.render();
      });
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'n') {
        this.nextLandslide();
      } else if (e.key === 'ArrowLeft' || e.key === 'p') {
        this.previousLandslide();
      } else if (e.key === 'r') {
        this.viewController.reset();
        this.render();
      }
    });
  }

  /**
   * Load and display a landslide
   *
   * @param {number} index - Index of landslide to load
   */
  async loadLandslide(index) {
    if (this.isLoading) {
      return;
    }

    if (index < 0 || index >= this.landslides.length) {
      console.warn('Invalid landslide index:', index);
      return;
    }

    this.isLoading = true;
    this.currentLandslideIndex = index;
    const landslide = this.landslides[index];

    try {
      this.showStatus(`Loading landslide ${index + 1}/${this.landslides.length}...`);

      // Calculate display window
      const metadata = await this.dataManager.loadMetadata('source1');
      const origin = [metadata.geoTransform[0], metadata.geoTransform[3]];
      const pixelSize = metadata.geoTransform[1];

      const displayWindow = calculateDisplayWindow(
        landslide,
        origin,
        pixelSize,
        { contextBuffer: 1.5, minWindowSize: 50 }
      );

      // Crop image data
      const stackShape = this.config.numpy_stack.shape;
      const croppedBefore = cropArray4D(
        this.dataManager.numpy_stack,
        stackShape,
        displayWindow.rowStart,
        displayWindow.rowEnd,
        displayWindow.colStart,
        displayWindow.colEnd,
        0 // Time index for "before" image
      );

      // Initialize view controller
      if (this.viewController) {
        this.viewController.destroy();
      }

      this.viewController = new ViewController(
        this.renderer.canvas,
        displayWindow.geoBounds
      );

      this.viewController.setConstraints(0.5, 8.0, displayWindow.geoBounds);
      this.viewController.enablePan();
      this.viewController.enableZoom();

      // Listen for view changes
      this.viewController.on('viewchange', () => {
        this.render();
      });

      // Listen for hover events
      this.viewController.on('hover', (coords) => {
        this.updateCoordinateDisplay(coords.geo);
      });

      // Store current data
      this.currentData = {
        imageArray: croppedBefore.data,
        imageShape: croppedBefore.shape,
        bounds: displayWindow.geoBounds,
        landslide: landslide,
        window: displayWindow
      };

      // Initial render
      this.render();

      // Update info panel
      this.updateInfoPanel(landslide, index);

      this.showStatus(`Landslide ${index + 1}/${this.landslides.length}`);
    } catch (error) {
      this.showError(`Failed to load landslide: ${error.message}`);
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render the current view
   */
  render() {
    if (!this.currentData) {
      return;
    }

    const transform = this.viewController.getTransform();

    // Clear canvas
    this.renderer.clear();

    // Render image
    this.renderer.renderArray(
      this.currentData.imageArray,
      this.currentData.imageShape,
      this.currentData.bounds,
      transform
    );

    // Render landslide polygon
    const style = confidenceStyle(
      this.currentData.landslide.properties.confidence || 0.5
    );

    this.renderer.renderPolygon(
      this.currentData.landslide.geometry,
      style,
      transform
    );
  }

  /**
   * Load next landslide
   */
  async nextLandslide() {
    const nextIndex = (this.currentLandslideIndex + 1) % this.landslides.length;
    await this.loadLandslide(nextIndex);
  }

  /**
   * Load previous landslide
   */
  async previousLandslide() {
    const prevIndex = (this.currentLandslideIndex - 1 + this.landslides.length) % this.landslides.length;
    await this.loadLandslide(prevIndex);
  }

  /**
   * Update info panel
   *
   * @param {Object} landslide - Landslide feature
   * @param {number} index - Landslide index
   */
  updateInfoPanel(landslide, index) {
    const infoPanel = document.getElementById('landslide-info');

    if (!infoPanel) {
      return;
    }

    const props = landslide.properties;

    infoPanel.innerHTML = `
      <h3>Landslide ${index + 1} of ${this.landslides.length}</h3>
      <p><strong>ID:</strong> ${props.FID || landslide.id}</p>
      <p><strong>Area:</strong> ${props.area?.toFixed(2) || 'N/A'} m²</p>
      <p><strong>Confidence:</strong> ${((props.confidence || 0) * 100).toFixed(1)}%</p>
      <p><strong>Date Mapped:</strong> ${props.date_mapped || 'N/A'}</p>
      <p class="hint">Use arrow keys or N/P to navigate</p>
    `;
  }

  /**
   * Update coordinate display
   *
   * @param {Object} geoCoord - Geographic coordinates {x, y}
   */
  updateCoordinateDisplay(geoCoord) {
    const coordsDiv = document.getElementById('coordinates');

    if (!coordsDiv) {
      return;
    }

    coordsDiv.innerHTML = `
      <strong>X:</strong> ${geoCoord.x.toFixed(2)} m
      <strong>Y:</strong> ${geoCoord.y.toFixed(2)} m
    `;
  }

  /**
   * Show status message
   *
   * @param {string} message - Status message
   */
  showStatus(message) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = 'status';
    }
  }

  /**
   * Show error message
   *
   * @param {string} message - Error message
   */
  showError(message) {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = 'status error';
    }
  }
}

// Initialize app when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const app = new LandslideViewerApp();
    await app.init();

    // Make app accessible for debugging
    window.landslideApp = app;
  });
}

export { LandslideViewerApp };
