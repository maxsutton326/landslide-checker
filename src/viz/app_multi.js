/**
 * Multi-Panel Application for Landslide Data Quality Assessment
 *
 * Coordinates 5-panel synchronized display system
 */

import { DataManager } from '../data/data_manager.js';
import { Panel } from './panel.js';
import { PanelManager } from './panel_manager.js';
import { SyncController } from './sync_controller.js';
import { LandslideNavigator } from './landslide_navigator.js';
import { ProgressTracker } from './progress_tracker.js';
import { QuickJump } from './quick_jump.js';
import { KeyboardHandler } from './keyboard_handler.js';
import { NavigationState } from '../state/navigation_state.js';
import { PerformanceMonitor } from '../utils/performance.js';
import { showLoading, hideLoading } from './transitions.js';
import { calculateDisplayWindow } from '../utils/window_calculator.js';
import { cropArray4D } from '../utils/image_cropper.js';

/**
 * Multi-Panel Landslide Viewer Application
 */
class MultiPanelLandslideApp {
  constructor() {
    this.dataManager = null;
    this.panelManager = null;
    this.syncController = null;
    this.navigator = null;
    this.progressTracker = null;
    this.quickJump = null;
    this.keyboardHandler = null;
    this.navigationState = null;
    this.performanceMonitor = null;
    this.landslides = [];
    this.config = null;
    this.isLoading = false;
    this.currentLabel = null;
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
      this.landslides = this.dataManager.landslides.features;

      if (this.landslides.length === 0) {
        throw new Error('No landslides found in dataset');
      }

      this.showStatus(`Loaded ${this.landslides.length} landslides`);

      // Initialize navigation components
      this.setupNavigation();

      // Setup UI
      this.setupPanels();
      this.setupControls();
      this.setupEventHandlers();

      // Restore last session
      const lastId = this.navigationState.getLastLandslideId();
      let startIndex = 0;
      if (lastId) {
        const index = this.landslides.findIndex(l =>
          (l.properties?.FID || l.id) === lastId);
        if (index >= 0) {
          startIndex = index;
        }
      }

      // Load first/last landslide
      await this.navigator.goTo(startIndex);

      this.showStatus('Ready');
    } catch (error) {
      this.showError(`Failed to initialize: ${error.message}`);
      console.error(error);
    }
  }

  /**
   * Load configuration
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
          epsg: '32610'
        },
        predictions: {
          path: 'data/predictions.json',
          shape: [100, 100, 2]
        }
      };
    }
  }

  /**
   * Setup navigation components
   */
  setupNavigation() {
    // Navigation state
    this.navigationState = new NavigationState();

    // Navigator
    this.navigator = new LandslideNavigator(this.landslides, this.dataManager);
    this.navigator.on('change', async ({ landslide, index }) => {
      await this.loadLandslide(index);
    });

    // Progress tracker
    const progressContainer = document.getElementById('progress-tracker-container');
    if (progressContainer) {
      this.progressTracker = new ProgressTracker(progressContainer, this.landslides.length);
    }

    // Quick jump
    const quickJumpContainer = document.getElementById('quick-jump-container');
    if (quickJumpContainer) {
      this.quickJump = new QuickJump(quickJumpContainer, this.landslides);
      this.quickJump.loadHistory();
      this.quickJump.loadBookmarks();

      this.quickJump.onSelect(async ({ index, id }) => {
        await this.navigator.goTo(index);
      });
    }

    // Keyboard handler
    this.keyboardHandler = new KeyboardHandler();
    this.setupKeyboardBindings();

    // Performance monitor (optional)
    if (window.location.search.includes('debug')) {
      this.performanceMonitor = new PerformanceMonitor({ fpsTarget: 30 });
      this.performanceMonitor.start();
      this.performanceMonitor.showOverlay();
    }
  }

  /**
   * Setup keyboard bindings
   */
  setupKeyboardBindings() {
    const kb = this.keyboardHandler;

    // Navigation
    kb.on('next', () => this.navigator.next());
    kb.on('previous', () => this.navigator.previous());
    kb.on('first', () => this.navigator.first());
    kb.on('last', () => this.navigator.last());

    // View controls
    kb.on('zoom-in', () => {
      const masterPanel = this.panelManager.masterPanel;
      if (masterPanel?.viewController) {
        const canvas = masterPanel.canvas;
        masterPanel.viewController.zoom(1.3, canvas.width / 2, canvas.height / 2);
        masterPanel.render();
      }
    });

    kb.on('zoom-out', () => {
      const masterPanel = this.panelManager.masterPanel;
      if (masterPanel?.viewController) {
        const canvas = masterPanel.canvas;
        masterPanel.viewController.zoom(0.7, canvas.width / 2, canvas.height / 2);
        masterPanel.render();
      }
    });

    kb.on('reset-view', () => {
      this.syncController.resetAllViews();
    });

    kb.on('toggle-sync', () => {
      this.syncController.toggleSync();
      const syncState = this.syncController.getSyncState();
      const syncBtn = document.getElementById('toggle-sync');
      if (syncBtn) {
        syncBtn.classList.toggle('active', syncState.enabled);
      }
    });

    // Jump
    kb.on('jump', () => {
      if (this.quickJump) {
        this.quickJump.focus();
      }
    });

    // Help
    kb.on('show-help', () => {
      this.keyboardHandler.showHelp();
    });

    kb.on('escape', () => {
      this.keyboardHandler.hideHelp();
      if (this.quickJump) {
        this.quickJump.clear();
      }
    });

    // Bookmarks
    kb.on('toggle-bookmark', () => {
      const current = this.navigator.getCurrent();
      const id = current?.properties?.FID || current?.id;
      if (id && this.quickJump) {
        this.quickJump.toggleBookmark(String(id));
        this.updateBookmarkButton();
      }
    });

    // Labeling
    kb.on('label-1', () => this.applyLabel('landslide'));
    kb.on('label-2', () => this.applyLabel('no-landslide'));
    kb.on('label-3', () => this.applyLabel('uncertain'));
    kb.on('label-4', () => this.applyLabel('skip'));
    kb.on('label-5', () => this.applyLabel('flag'));
    kb.on('label-6', () => this.applyLabel(null));
  }

  /**
   * Setup panels
   */
  setupPanels() {
    // Create panel manager
    this.panelManager = new PanelManager();

    // Create panels
    const panelConfigs = [
      { id: 'source-1', type: 'source', label: 'Source Image 1 (Before)' },
      { id: 'source-2', type: 'source', label: 'Source Image 2 (After)' },
      { id: 'planet-before', type: 'planet', label: 'Planet Before' },
      { id: 'planet-after', type: 'planet', label: 'Planet After' },
      { id: 'prediction', type: 'prediction', label: 'Model Prediction' }
    ];

    panelConfigs.forEach(config => {
      const container = document.getElementById(config.id);
      if (container) {
        const panel = new Panel(container, config.type, config.label);
        this.panelManager.addPanel(config.id, panel);

        // Enable interactions on all panels
        panel.enableInteractions();

        // Listen for hover events
        panel.on('hover', (coords) => {
          this.updateCoordinateDisplay(coords.geo);
        });
      }
    });

    // Create sync controller
    this.syncController = new SyncController(this.panelManager);
    this.syncController.enableSync();

    // Set first panel as master
    const firstPanel = this.panelManager.getPanel('source-1');
    if (firstPanel) {
      this.panelManager.setMasterPanel(firstPanel);
    }
  }

  /**
   * Setup UI controls
   */
  setupControls() {
    // Navigation bar controls
    const firstBtn = document.getElementById('first-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const lastBtn = document.getElementById('last-btn');

    if (firstBtn) {
      firstBtn.addEventListener('click', () => this.navigator.first());
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigator.previous());
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigator.next());
    }

    if (lastBtn) {
      lastBtn.addEventListener('click', () => this.navigator.last());
    }

    // Bookmark button
    const bookmarkBtn = document.getElementById('toggle-bookmark-btn');
    if (bookmarkBtn) {
      bookmarkBtn.addEventListener('click', () => {
        const current = this.navigator.getCurrent();
        const id = current?.properties?.FID || current?.id;
        if (id && this.quickJump) {
          this.quickJump.toggleBookmark(String(id));
          this.updateBookmarkButton();
        }
      });
    }

    // Help button
    const helpBtn = document.getElementById('show-help');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.keyboardHandler.showHelp());
    }

    // Label buttons
    for (let i = 1; i <= 6; i++) {
      const labelBtn = document.getElementById(`label-${i}`);
      if (labelBtn) {
        labelBtn.addEventListener('click', () => {
          const labels = ['landslide', 'no-landslide', 'uncertain', 'skip', 'flag', null];
          this.applyLabel(labels[i - 1]);
        });
      }
    }

    // View controls
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetBtn = document.getElementById('reset-view');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        const masterPanel = this.panelManager.masterPanel;
        if (masterPanel && masterPanel.viewController) {
          const canvas = masterPanel.canvas;
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          masterPanel.viewController.zoom(1.3, centerX, centerY);
          masterPanel.render();
        }
      });
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const masterPanel = this.panelManager.masterPanel;
        if (masterPanel && masterPanel.viewController) {
          const canvas = masterPanel.canvas;
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          masterPanel.viewController.zoom(0.7, centerX, centerY);
          masterPanel.render();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.syncController.resetAllViews();
      });
    }

    // Sync toggle
    const syncBtn = document.getElementById('toggle-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncController.toggleSync();
        const syncState = this.syncController.getSyncState();
        syncBtn.classList.toggle('active', syncState.enabled);
      });
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        this.nextLandslide();
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        this.previousLandslide();
      } else if (e.key === 'r' || e.key === 'R') {
        this.syncController.resetAllViews();
      } else if (e.key === 's' || e.key === 'S') {
        this.syncController.toggleSync();
        const syncState = this.syncController.getSyncState();
        const syncBtn = document.getElementById('toggle-sync');
        if (syncBtn) {
          syncBtn.classList.toggle('active', syncState.enabled);
        }
      }
    });
  }

  /**
   * Load and display a landslide
   */
  async loadLandslide(index) {
    if (this.isLoading) return;

    if (index < 0 || index >= this.landslides.length) {
      console.warn('Invalid landslide index:', index);
      return;
    }

    this.isLoading = true;
    const landslide = this.landslides[index];

    // Show loading indicators
    this.panelManager.getAllPanels().forEach(panel => {
      showLoading(panel.container, 'Loading landslide...');
    });

    try {
      this.showStatus(`Loading landslide ${index + 1}/${this.landslides.length}...`);

      // Get metadata
      const metadata = await this.dataManager.getData('numpy_stack').metadata;
      const origin = metadata.origin;
      const pixelSize = metadata.pixelSize;

      // Calculate display window
      const displayWindow = calculateDisplayWindow(
        landslide,
        { contextBuffer: 1.5, minWindowSize: 50 },
        origin,
        pixelSize,
        this.config.shapefile.epsg
      );

      // Crop data for each panel
      const stackShape = this.config.numpy_stack.shape;
      console.log(displayWindow)

      // Source 1 (before)
      const source1Data = cropArray4D(
        this.dataManager.numpy_stack,
        stackShape,
        displayWindow.rowStart,
        displayWindow.rowEnd,
        displayWindow.colStart,
        displayWindow.colEnd,
        0
      );

      // Source 2 (after)
      const source2Data = cropArray4D(
        this.dataManager.numpy_stack,
        stackShape,
        displayWindow.rowStart,
        displayWindow.rowEnd,
        displayWindow.colStart,
        displayWindow.colEnd,
        1
      );

      // For now, use same data for planet panels (in production, these would be separate)
      const planetBeforeData = { ...source1Data };
      const planetAfterData = { ...source2Data };

      // Prediction data (simplified)
      const predictionData = { ...source1Data };

      // Update all panels
      this.panelManager.updateAll({
        landslide,
        source1Data: {
          array: source1Data.data,
          shape: source1Data.shape,
          bounds: displayWindow.geoBounds
        },
        source2Data: {
          array: source2Data.data,
          shape: source2Data.shape,
          bounds: displayWindow.geoBounds
        },
        planetBeforeData: {
          array: planetBeforeData.data,
          shape: planetBeforeData.shape,
          bounds: displayWindow.geoBounds
        },
        planetAfterData: {
          array: planetAfterData.data,
          shape: planetAfterData.shape,
          bounds: displayWindow.geoBounds
        },
        predictionData: {
          array: predictionData.data,
          shape: predictionData.shape,
          bounds: displayWindow.geoBounds
        }
      });

      // Hide loading indicators
      this.panelManager.getAllPanels().forEach(panel => {
        hideLoading(panel.container);
      });

      // Update info panel
      this.updateInfoPanel(landslide, index);

      // Update progress tracker
      if (this.progressTracker) {
        this.progressTracker.update(index);
      }

      // Update navigation state
      const id = landslide.properties?.FID || landslide.id;
      if (id) {
        this.navigationState.pushState(id, { index, timestamp: Date.now() });
      }

      // Update bookmark button
      this.updateBookmarkButton();

      // Update navigation buttons
      this.updateNavigationButtons();

      this.showStatus(`Landslide ${index + 1}/${this.landslides.length}`);
    } catch (error) {
      this.showError(`Failed to load landslide: ${error.message}`);
      console.error(error);

      // Hide loading indicators
      this.panelManager.getAllPanels().forEach(panel => {
        hideLoading(panel.container);
      });
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Update info panel
   */
  updateInfoPanel(landslide, index) {
    const infoPanel = document.getElementById('landslide-info');

    if (!infoPanel) return;

    const props = landslide.properties;

    infoPanel.innerHTML = `
      <p><strong>ID:</strong> ${props.FID || landslide.id}</p>
      <p><strong>Area:</strong> ${props.area?.toFixed(2) || 'N/A'} m²</p>
      <p><strong>Confidence:</strong> ${((props.confidence || 0) * 100).toFixed(1)}%</p>
      <p><strong>Date Mapped:</strong> ${props.date_mapped || 'N/A'}</p>
      <p class="hint">Use arrow keys to navigate. Press S to toggle sync.</p>
    `;
  }

  /**
   * Update navigation buttons state
   */
  updateNavigationButtons() {
    const firstBtn = document.getElementById('first-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const lastBtn = document.getElementById('last-btn');

    if (firstBtn) firstBtn.disabled = this.navigator.isFirst();
    if (prevBtn) prevBtn.disabled = this.navigator.isFirst();
    if (nextBtn) nextBtn.disabled = this.navigator.isLast();
    if (lastBtn) lastBtn.disabled = this.navigator.isLast();
  }

  /**
   * Update bookmark button state
   */
  updateBookmarkButton() {
    const bookmarkBtn = document.getElementById('toggle-bookmark-btn');
    if (!bookmarkBtn || !this.quickJump) return;

    const current = this.navigator.getCurrent();
    const id = current?.properties?.FID || current?.id;

    if (id && this.quickJump.isBookmarked(String(id))) {
      bookmarkBtn.classList.add('bookmarked');
      bookmarkBtn.textContent = '★';
    } else {
      bookmarkBtn.classList.remove('bookmarked');
      bookmarkBtn.textContent = '☆';
    }
  }

  /**
   * Apply label to current landslide
   *
   * @param {string|null} label - Label to apply
   */
  applyLabel(label) {
    this.currentLabel = label;

    // Update UI
    for (let i = 1; i <= 6; i++) {
      const btn = document.getElementById(`label-${i}`);
      if (btn) {
        btn.classList.remove('active');
      }
    }

    if (label) {
      const labels = ['landslide', 'no-landslide', 'uncertain', 'skip', 'flag'];
      const index = labels.indexOf(label);
      if (index >= 0) {
        const btn = document.getElementById(`label-${index + 1}`);
        if (btn) {
          btn.classList.add('active');
        }
      }
    }

    // Update progress tracker if this is a definitive label
    if (this.progressTracker && (label === 'landslide' || label === 'no-landslide')) {
      this.progressTracker.incrementStat('labeled');
    }

    console.log(`Applied label: ${label}`);
  }

  /**
   * Update coordinate display
   */
  updateCoordinateDisplay(geoCoord) {
    const coordX = document.getElementById('coord-x');
    const coordY = document.getElementById('coord-y');

    if (coordX) {
      coordX.textContent = geoCoord.x.toFixed(2) + ' m';
    }

    if (coordY) {
      coordY.textContent = geoCoord.y.toFixed(2) + ' m';
    }
  }

  /**
   * Show status message
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
    const app = new MultiPanelLandslideApp();
    await app.init();

    // Make app accessible for debugging
    window.landslideApp = app;
  });
}

export { MultiPanelLandslideApp };
