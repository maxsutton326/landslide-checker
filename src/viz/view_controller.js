/**
 * View Controller for Pan and Zoom
 *
 * Manages view transformations and user interactions
 */

/**
 * Simple event emitter
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
  }

  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

/**
 * ViewController class
 *
 * Handles pan, zoom, and coordinate transformations
 */
export class ViewController extends EventEmitter {
  /**
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Object} initialBounds - Initial geographic bounds {minX, minY, maxX, maxY}
   */
  constructor(canvas, initialBounds) {
    super();

    this.canvas = canvas;
    this.initialBounds = { ...initialBounds };
    this.bounds = { ...initialBounds };

    // View state
    this.scale = 1.0;
    this.offset = { x: 0, y: 0 };

    // Constraints
    this.minZoom = 0.1;
    this.maxZoom = 10.0;
    this.constraintBounds = null;

    // Interaction state
    this.isPanning = false;
    this.lastMousePos = null;

    // Event handlers (bound to this)
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);

    // Calculate initial transform
    this.calculateInitialTransform();
  }

  /**
   * Calculate initial transform to fit bounds in canvas
   */
  calculateInitialTransform() {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const geoWidth = this.bounds.colEnd - this.bounds.colStart;
    const geoHeight = this.bounds.rowEnd - this.bounds.rowStart;

    // Calculate scale to fit
    const scaleX = canvasWidth / geoWidth;
    const scaleY = canvasHeight / geoHeight;

    // Use smaller scale to ensure everything fits
    this.scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for padding

    // Center the view
    const geoCenterX = (this.bounds.colStart + this.bounds.colEnd) / 2;
    const geoCenterY = (this.bounds.rowStart + this.bounds.rowEnd) / 2;

    this.offset.x = canvasWidth / 2 - geoCenterX * this.scale;
    this.offset.y = canvasHeight / 2 + geoCenterY * this.scale; // Y is flipped
  }

  /**
   * Get current transform object
   *
   * @returns {Object} - Transform with geoToCanvas and canvasToGeo functions
   */
  getTransform() {
    const scale = this.scale;
    const offset = this.offset;

    return {
      scale: scale,
      offset: { ...offset },

      geoToCanvas: (x, y) => {
        return {
          x: x * scale + offset.x,
          y: -y * scale + offset.y // Y is flipped (canvas Y increases down)
        };
      },

      canvasToGeo: (x, y) => {
        return {
          x: (x - offset.x) / scale,
          y: -(y - offset.y) / scale // Y is flipped
        };
      }
    };
  }

  /**
   * Set view constraints
   *
   * @param {number} minZoom - Minimum zoom level
   * @param {number} maxZoom - Maximum zoom level
   * @param {Object} bounds - Constraint bounds
   */
  setConstraints(minZoom, maxZoom, bounds) {
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.constraintBounds = bounds;
  }

  /**
   * Zoom in/out
   *
   * @param {number} factor - Zoom factor (>1 = zoom in, <1 = zoom out)
   * @param {number} centerX - Canvas X coordinate of zoom center
   * @param {number} centerY - Canvas Y coordinate of zoom center
   */
  zoom(factor, centerX, centerY) {
    const newScale = this.scale * factor;

    // Constrain zoom
    if (newScale < this.minZoom || newScale > this.maxZoom) {
      return;
    }

    // Zoom towards mouse position
    const transform = this.getTransform();
    const geoPoint = transform.canvasToGeo(centerX, centerY);

    this.scale = newScale;

    // Adjust offset to keep geoPoint at same canvas position
    this.offset.x = centerX - geoPoint.x * this.scale;
    this.offset.y = centerY + geoPoint.y * this.scale;

    this.emit('viewchange', this.getTransform());
  }

  /**
   * Pan the view
   *
   * @param {number} dx - Delta X in canvas pixels
   * @param {number} dy - Delta Y in canvas pixels
   */
  pan(dx, dy) {
    this.offset.x += dx;
    this.offset.y += dy;

    this.emit('viewchange', this.getTransform());
  }

  /**
   * Reset view to initial state
   */
  reset() {
    this.bounds = { ...this.initialBounds };
    this.calculateInitialTransform();
    this.emit('viewchange', this.getTransform());
  }

  /**
   * Enable pan interactions
   */
  enablePan() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  /**
   * Disable pan interactions
   */
  disablePan() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  /**
   * Enable zoom interactions
   */
  enableZoom() {
    this.canvas.addEventListener('wheel', this.handleWheel);
  }

  /**
   * Disable zoom interactions
   */
  disableZoom() {
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  /**
   * Handle mouse down event
   */
  handleMouseDown(e) {
    this.isPanning = true;
    this.lastMousePos = this.getMousePos(e);
    this.canvas.style.cursor = 'grabbing';
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(e) {
    const mousePos = this.getMousePos(e);

    if (this.isPanning && this.lastMousePos) {
      const dx = mousePos.x - this.lastMousePos.x;
      const dy = mousePos.y - this.lastMousePos.y;

      this.pan(dx, dy);
      this.lastMousePos = mousePos;
    }

    // Emit hover event for coordinate display
    const transform = this.getTransform();
    const geoCoord = transform.canvasToGeo(mousePos.x, mousePos.y);
    this.emit('hover', { canvas: mousePos, geo: geoCoord });
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(e) {
    this.isPanning = false;
    this.lastMousePos = null;
    this.canvas.style.cursor = 'grab';
  }

  /**
   * Handle mouse leave event
   */
  handleMouseLeave(e) {
    this.isPanning = false;
    this.lastMousePos = null;
    this.canvas.style.cursor = 'default';
  }

  /**
   * Handle wheel event for zoom
   */
  handleWheel(e) {
    e.preventDefault();

    const mousePos = this.getMousePos(e);
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

    this.zoom(zoomFactor, mousePos.x, mousePos.y);
  }

  /**
   * Get mouse position relative to canvas
   *
   * @param {MouseEvent} e - Mouse event
   * @returns {Object} - {x, y}
   */
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * Set center and zoom
   *
   * @param {number} centerX - Geographic center X
   * @param {number} centerY - Geographic center Y
   * @param {number} zoom - Zoom level
   */
  setView(centerX, centerY, zoom) {
    this.scale = zoom;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    this.offset.x = canvasWidth / 2 - centerX * this.scale;
    this.offset.y = canvasHeight / 2 + centerY * this.scale;

    this.emit('viewchange', this.getTransform());
  }

  /**
   * Fit bounds in view
   *
   * @param {Object} bounds - Bounds to fit {minX, minY, maxX, maxY}
   * @param {number} padding - Padding factor (default 0.1 = 10%)
   */
  fitBounds(bounds, padding = 0.1) {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const geoWidth = bounds.maxX - bounds.minX;
    const geoHeight = bounds.maxY - bounds.minY;

    // Calculate scale to fit
    const scaleX = canvasWidth / geoWidth;
    const scaleY = canvasHeight / geoHeight;

    this.scale = Math.min(scaleX, scaleY) * (1 - padding);

    // Center on bounds
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    this.offset.x = canvasWidth / 2 - centerX * this.scale;
    this.offset.y = canvasHeight / 2 + centerY * this.scale;

    this.emit('viewchange', this.getTransform());
  }

  /**
   * Get current visible bounds
   *
   * @returns {Object} - {minX, minY, maxX, maxY}
   */
  getVisibleBounds() {
    const transform = this.getTransform();

    const topLeft = transform.canvasToGeo(0, 0);
    const bottomRight = transform.canvasToGeo(this.canvas.width, this.canvas.height);

    return {
      minX: topLeft.x,
      maxX: bottomRight.x,
      minY: bottomRight.y,
      maxY: topLeft.y
    };
  }

  /**
   * Destroy controller and remove event listeners
   */
  destroy() {
    this.disablePan();
    this.disableZoom();
    this.events = {};
  }
}
