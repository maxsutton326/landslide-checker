/**
 * Panel Class
 *
 * Encapsulates a single visualization panel with its own canvas,
 * data, and rendering logic. Supports synchronization with other panels.
 */

import { CanvasRenderer } from './canvas_renderer.js';
import { ViewController } from './view_controller.js';
import { confidenceStyle } from './polygon_renderer.js';

/**
 * Event emitter base class
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
    return this;
  }
}

/**
 * Panel class representing a single visualization panel
 */
export class Panel extends EventEmitter {
  /**
   * @param {HTMLElement} container - Container element for the panel
   * @param {string} type - Panel type: 'source', 'planet', 'prediction'
   * @param {string} label - Display label for the panel
   */
  constructor(container, type, label) {
    super();

    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.type = type;
    this.label = label;
    this.id = `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Data
    this.data = null;
    this.metadata = null;
    this.polygon = null;

    // Rendering
    this.canvas = null;
    this.renderer = null;
    this.viewController = null;

    // State
    this.isActive = false;
    this.isVisible = true;
    this.bounds = null;

    // Initialize
    this.initialize();
  }

  /**
   * Initialize the panel UI and components
   */
  initialize() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'panel-canvas';
    this.canvas.setAttribute('data-panel-id', this.id);

    // Size canvas to container
    this.resize();

    // Append to container
    this.container.appendChild(this.canvas);

    // Initialize renderer
    this.renderer = new CanvasRenderer(this.canvas);

    // Handle container resize
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Resize canvas to fit container
   */
  resize() {
    const rect = this.container.getBoundingClientRect();
    const headerHeight = 30; // Account for panel header

    this.canvas.width = Math.floor(rect.width);
    this.canvas.height = Math.floor(rect.height - headerHeight);

    // Re-render if we have data
    if (this.data && this.viewController) {
      this.render();
    }
  }

  /**
   * Set data for this panel
   *
   * @param {Object} data - Data object with array, shape, bounds
   * @param {Object} metadata - Optional metadata
   */
  setData(data, metadata = null) {
    this.data = data;
    this.metadata = metadata;

    if (data && data.bounds) {
      this.bounds = data.bounds;

      // Initialize view controller if not exists
      if (!this.viewController) {
        this.viewController = new ViewController(this.canvas, this.bounds);
        this.viewController.setConstraints(0.5, 8.0, this.bounds);

        // Listen for view changes
        this.viewController.on('viewchange', (transform) => {
          this.render();
          this.emit('viewchange', transform);
        });

        // Listen for hover events
        this.viewController.on('hover', (coords) => {
          this.emit('hover', coords);
        });
      } else {
        // Update bounds
        this.viewController.bounds = this.bounds;
        this.viewController.initialBounds = { ...this.bounds };
      }
    }

    // Render with new data
    this.render();
  }

  /**
   * Set polygon overlay
   *
   * @param {Object} polygon - GeoJSON polygon feature
   */
  setPolygon(polygon) {
    this.polygon = polygon;
    this.render();
  }

  /**
   * Set view transformation
   *
   * @param {Object} transform - Transform object from another panel
   */
  setView(transform) {
    if (!this.viewController) return;

    // Update view controller state
    this.viewController.scale = transform.scale;
    this.viewController.offset = { ...transform.offset };

    // Render with new view
    this.render();
  }

  /**
   * Get current view transformation
   *
   * @returns {Object} - Transform object
   */
  getView() {
    if (!this.viewController) return null;
    return this.viewController.getTransform();
  }

  /**
   * Render the panel content
   */
  render() {
    if (!this.data || !this.renderer) return;

    // Clear canvas
    this.renderer.clear();

    const transform = this.viewController.getTransform();

    // Render based on panel type
    if (this.type === 'prediction') {
      this.renderPrediction(transform);
    } else {
      this.renderImage(transform);
    }

    // Render polygon overlay if present
    if (this.polygon) {
      this.renderPolygon(transform);
    }

    // Draw panel border if active
    if (this.isActive) {
      this.drawActiveBorder();
    }
  }

  /**
   * Render image data
   *
   * @param {Object} transform - Coordinate transform
   */
  renderImage(transform) {
    if (!this.data.array || !this.data.shape) {
      this.renderPlaceholder('No image data');
      return;
    }

    try {
      this.renderer.renderArray(
        this.data.array,
        this.data.shape,
        this.data.bounds,
        transform
      );
    } catch (error) {
      console.error(`Error rendering image in panel ${this.label}:`, error);
      this.renderPlaceholder('Error loading image');
    }
  }

  /**
   * Render prediction heatmap
   *
   * @param {Object} transform - Coordinate transform
   */
  renderPrediction(transform) {
    if (!this.data.array || !this.data.shape) {
      this.renderPlaceholder('No prediction data');
      return;
    }

    try {
      // Predictions are typically 2-channel (background, landslide)
      // We'll visualize the landslide probability as a heatmap
      this.renderer.renderArray(
        this.data.array,
        this.data.shape,
        this.data.bounds,
        transform
      );
    } catch (error) {
      console.error(`Error rendering prediction in panel ${this.label}:`, error);
      this.renderPlaceholder('Error loading predictions');
    }
  }

  /**
   * Render polygon overlay
   *
   * @param {Object} transform - Coordinate transform
   */
  renderPolygon(transform) {
    const style = confidenceStyle(
      this.polygon.properties?.confidence || 0.5
    );

    this.renderer.renderPolygon(
      this.polygon.geometry,
      style,
      transform
    );
  }

  /**
   * Render placeholder text
   *
   * @param {string} message - Placeholder message
   */
  renderPlaceholder(message) {
    const ctx = this.canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#666';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
  }

  /**
   * Draw active border around panel
   */
  drawActiveBorder() {
    const ctx = this.canvas.getContext('2d');
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Clear the panel
   */
  clear() {
    if (this.renderer) {
      this.renderer.clear();
    }
  }

  /**
   * Enable user interactions
   */
  enableInteractions() {
    if (this.viewController) {
      this.viewController.enablePan();
      this.viewController.enableZoom();
    }
  }

  /**
   * Disable user interactions
   */
  disableInteractions() {
    if (this.viewController) {
      this.viewController.disablePan();
      this.viewController.disableZoom();
    }
  }

  /**
   * Set panel as active
   */
  setActive(active) {
    this.isActive = active;
    if (active) {
      this.container.classList.add('active');
    } else {
      this.container.classList.remove('active');
    }
    this.render();
  }

  /**
   * Set panel visibility
   *
   * @param {boolean} visible - Whether panel should be visible
   */
  setVisible(visible) {
    this.isVisible = visible;
    this.container.style.display = visible ? 'block' : 'none';
  }

  /**
   * Reset view to initial state
   */
  resetView() {
    if (this.viewController) {
      this.viewController.reset();
      this.render();
    }
  }

  /**
   * Get panel info
   *
   * @returns {Object} - Panel information
   */
  getInfo() {
    return {
      id: this.id,
      type: this.type,
      label: this.label,
      isActive: this.isActive,
      isVisible: this.isVisible,
      hasData: !!this.data,
      bounds: this.bounds
    };
  }

  /**
   * Destroy panel and clean up
   */
  destroy() {
    if (this.viewController) {
      this.viewController.destroy();
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    this.events = {};
    this.data = null;
    this.metadata = null;
    this.polygon = null;
  }
}
