/**
 * Canvas Renderer for Landslide Visualization
 *
 * Handles rendering of satellite imagery and overlays on HTML5 Canvas
 */

/**
 * Convert float array (0-1) to uint8 array (0-255)
 *
 * @param {Float32Array|Array<number>} floats - Array of float values
 * @returns {Uint8ClampedArray} - Clamped uint8 array
 */
export function floatToUint8(floats) {
  const uint8 = new Uint8ClampedArray(floats.length);
  for (let i = 0; i < floats.length; i++) {
    // Clamp to 0-1 range, then scale to 0-255
    const clamped = Math.max(0, Math.min(1, floats[i]));
    uint8[i] = Math.round(clamped * 255);
  }
  return uint8;
}

/**
 * Convert NumPy-style array to ImageData
 *
 * @param {Float32Array|Array<number>} array - Input array
 * @param {Array<number>} shape - Shape [height, width, bands]
 * @returns {ImageData} - Canvas ImageData object
 */
export function arrayToImageData(array, shape) {
  const [height, width, bands] = shape;

  // Create ImageData (handle Node.js environment)
  let imageData;
  if (typeof ImageData !== 'undefined') {
    imageData = new ImageData(width, height);
  } else {
    // Node.js environment - create mock ImageData
    imageData = {
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4)
    };
  }

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const pixelIndex = (row * width + col) * bands;
      const imageDataIndex = (row * width + col) * 4;

      if (bands === 1) {
        // Grayscale: replicate to RGB
        const value = Math.max(0, Math.min(1, array[pixelIndex]));
        const uint8Value = Math.round(value * 255);
        imageData.data[imageDataIndex] = uint8Value;
        imageData.data[imageDataIndex + 1] = uint8Value;
        imageData.data[imageDataIndex + 2] = uint8Value;
        imageData.data[imageDataIndex + 3] = 255; // Alpha
      } else if (bands >= 3) {
        // RGB or more
        const r = Math.max(0, Math.min(1, array[pixelIndex]));
        const g = Math.max(0, Math.min(1, array[pixelIndex + 1]));
        const b = Math.max(0, Math.min(1, array[pixelIndex + 2]));

        imageData.data[imageDataIndex] = Math.round(r * 255);
        imageData.data[imageDataIndex + 1] = Math.round(g * 255);
        imageData.data[imageDataIndex + 2] = Math.round(b * 255);
        imageData.data[imageDataIndex + 3] = 255; // Alpha
      }
    }
  }

  return imageData;
}

/**
 * CanvasRenderer class
 *
 * Manages rendering of satellite imagery and vector overlays
 */
export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvasElement - Canvas element to render to
   */
  constructor(canvasElement) {
    if (!canvasElement) {
      throw new Error('Canvas element is required');
    }

    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    if (!this.ctx) {
      throw new Error('Failed to get 2D context');
    }

    this.currentImageData = null;
    this.currentBounds = null;
    this.transform = null;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render a NumPy-style array as an image
   *
   * @param {Float32Array|Array<number>} array - Image data
   * @param {Array<number>} shape - Shape [height, width, bands]
   * @param {Object} bounds - Geographic bounds {minX, minY, maxX, maxY}
   * @param {Object} transform - Coordinate transform object
   */
  renderArray(array, shape, bounds, transform) {
    if (!array || !shape || shape.length !== 3) {
      throw new Error('Invalid array or shape');
    }

    this.currentBounds = bounds;
    this.transform = transform;

    // Convert to ImageData
    const imageData = arrayToImageData(array, shape);
    this.currentImageData = imageData;

    // Calculate where to draw the image on canvas
    const topLeft = transform.geoToCanvas(bounds.minX, bounds.maxY);
    const bottomRight = transform.geoToCanvas(bounds.maxX, bounds.minY);

    const canvasWidth = bottomRight.x - topLeft.x;
    const canvasHeight = bottomRight.y - topLeft.y;

    // Create temporary canvas for scaling
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(imageData, 0, 0);

    // Draw scaled image
    this.ctx.drawImage(
      tempCanvas,
      topLeft.x,
      topLeft.y,
      canvasWidth,
      canvasHeight
    );
  }

  /**
   * Render a GeoJSON polygon
   *
   * @param {Object} geometry - GeoJSON geometry object
   * @param {Object} style - Rendering style
   * @param {Object} transform - Coordinate transform object
   */
  renderPolygon(geometry, style, transform) {
    if (!geometry || geometry.type !== 'Polygon') {
      throw new Error('Invalid polygon geometry');
    }

    this.ctx.save();

    // Apply style
    this.ctx.fillStyle = style.fillColor || 'rgba(255, 255, 0, 0.3)';
    this.ctx.strokeStyle = style.strokeColor || '#FFFF00';
    this.ctx.lineWidth = style.lineWidth || 2;

    // Draw each ring (outer + holes)
    this.ctx.beginPath();

    geometry.coordinates.forEach((ring, ringIndex) => {
      ring.forEach((coord, i) => {
        const [x, y] = coord;
        const canvasCoord = transform.geoToCanvas(x, y);

        if (i === 0) {
          this.ctx.moveTo(canvasCoord.x, canvasCoord.y);
        } else {
          this.ctx.lineTo(canvasCoord.x, canvasCoord.y);
        }
      });
    });

    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render multiple polygons
   *
   * @param {Array<Object>} polygons - Array of polygon features
   * @param {Object} styleFunction - Function to get style for each polygon
   * @param {Object} transform - Coordinate transform object
   */
  renderPolygons(polygons, styleFunction, transform) {
    polygons.forEach(polygon => {
      const style = styleFunction ? styleFunction(polygon) : {};
      this.renderPolygon(polygon.geometry, style, transform);
    });
  }

  /**
   * Set view transformation
   *
   * @param {number} centerX - Geographic center X
   * @param {number} centerY - Geographic center Y
   * @param {number} zoom - Zoom level
   */
  setView(centerX, centerY, zoom) {
    // This is handled by the ViewController
    // This method exists for compatibility
    console.warn('Use ViewController.setView instead');
  }

  /**
   * Get canvas dimensions
   *
   * @returns {Object} - {width, height}
   */
  getDimensions() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    };
  }

  /**
   * Resize canvas
   *
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Draw text overlay
   *
   * @param {string} text - Text to draw
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} style - Text style
   */
  drawText(text, x, y, style = {}) {
    this.ctx.save();

    this.ctx.font = style.font || '14px sans-serif';
    this.ctx.fillStyle = style.fillColor || '#FFFFFF';
    this.ctx.strokeStyle = style.strokeColor || '#000000';
    this.ctx.lineWidth = style.lineWidth || 3;

    // Outline for better visibility
    if (style.outline !== false) {
      this.ctx.strokeText(text, x, y);
    }
    this.ctx.fillText(text, x, y);

    this.ctx.restore();
  }

  /**
   * Draw crosshair at position
   *
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} size - Crosshair size
   */
  drawCrosshair(x, y, size = 10) {
    this.ctx.save();

    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 1;

    this.ctx.beginPath();
    this.ctx.moveTo(x - size, y);
    this.ctx.lineTo(x + size, y);
    this.ctx.moveTo(x, y - size);
    this.ctx.lineTo(x, y + size);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Highlight a polygon
   *
   * @param {Object} geometry - GeoJSON geometry
   * @param {Object} transform - Coordinate transform
   */
  highlightPolygon(geometry, transform) {
    const highlightStyle = {
      fillColor: 'rgba(255, 255, 0, 0.5)',
      strokeColor: '#FFFF00',
      lineWidth: 3
    };

    this.renderPolygon(geometry, highlightStyle, transform);
  }

  /**
   * Get pixel value at canvas coordinate
   *
   * @param {number} x - Canvas X
   * @param {number} y - Canvas Y
   * @returns {Object|null} - {r, g, b, a} or null
   */
  getPixelValue(x, y) {
    if (!this.currentImageData) {
      return null;
    }

    const pixelData = this.ctx.getImageData(x, y, 1, 1);
    return {
      r: pixelData.data[0],
      g: pixelData.data[1],
      b: pixelData.data[2],
      a: pixelData.data[3]
    };
  }
}
