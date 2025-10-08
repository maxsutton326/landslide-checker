/**
 * Display Window Calculator
 *
 * Calculates optimal display windows for landslide polygons
 * Applies context buffers and enforces size constraints
 */

import { pixelToGeo, geoToPixel } from './coordinates.js';

/**
 * Calculate bounding box for polygon
 *
 * @param {Object} polygon - GeoJSON polygon feature
 * @returns {Object} - Bounds {minX, minY, maxX, maxY}
 */
export function calculatePolygonBounds(polygon) {
  const coordinates = polygon.geometry.coordinates[0]; // Exterior ring

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  coordinates.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Calculate polygon centroid
 *
 * @param {Object} polygon - GeoJSON polygon feature
 * @returns {{x: number, y: number}} - Centroid coordinates
 */
export function calculateCentroid(polygon) {
  const coordinates = polygon.geometry.coordinates[0];

  // Use all points except the closing point
  const points = coordinates.slice(0, -1);

  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);

  return {
    x: sumX / points.length,
    y: sumY / points.length
  };
}

/**
 * Apply context buffer to bounds
 *
 * @param {Object} bounds - Original bounds
 * @param {number} bufferFactor - Multiplicative buffer (e.g., 1.5 = 150%)
 * @returns {Object} - Buffered bounds
 */
export function applyContextBuffer(bounds, bufferFactor) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  // Calculate amount to expand
  const newWidth = width * bufferFactor;
  const newHeight = height * bufferFactor;

  const paddingX = (newWidth - width) / 2;
  const paddingY = (newHeight - height) / 2;

  return {
    minX: bounds.minX - paddingX,
    maxX: bounds.maxX + paddingX,
    minY: bounds.minY - paddingY,
    maxY: bounds.maxY + paddingY
  };
}

/**
 * Enforce minimum and maximum window size constraints
 *
 * @param {Object} bounds - Current bounds
 * @param {Object} config - Configuration with min_window and max_window
 * @param {Array<number>} origin - Geographic origin
 * @param {number} pixelSize - Pixel size in map units
 * @returns {Object} - Constrained bounds
 */
export function enforceWindowConstraints(bounds, config, origin, pixelSize) {
  const { min_window, max_window } = config;

  // Convert bounds to pixel dimensions
  const topLeft = geoToPixel(bounds.minX, bounds.maxY, origin, pixelSize, null);
  const bottomRight = geoToPixel(bounds.maxX, bounds.minY, origin, pixelSize, null);

  let widthPixels = Math.abs(bottomRight.col - topLeft.col);
  let heightPixels = Math.abs(bottomRight.row - topLeft.row);

  // Calculate center
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  // Enforce constraints
  let constrainedWidth = widthPixels;
  let constrainedHeight = heightPixels;

  if (widthPixels < min_window) {
    constrainedWidth = min_window;
  } else if (widthPixels > max_window) {
    constrainedWidth = max_window;
  }

  if (heightPixels < min_window) {
    constrainedHeight = min_window;
  } else if (heightPixels > max_window) {
    constrainedHeight = max_window;
  }

  // Convert back to geographic bounds, centered on polygon
  const halfWidth = (constrainedWidth * pixelSize) / 2;
  const halfHeight = (constrainedHeight * pixelSize) / 2;

  return {
    minX: centerX - halfWidth,
    maxX: centerX + halfWidth,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight
  };
}

/**
 * Create complete window specification
 *
 * @param {Object} polygon - GeoJSON polygon feature
 * @param {Object} config - Display configuration
 * @param {Array<number>} origin - Geographic origin
 * @param {number} pixelSize - Pixel size in map units
 * @param {number} epsg - EPSG code
 * @returns {Object} - Window specification
 */
export function createWindowSpec(polygon, config, origin, pixelSize, epsg) {
  // 1. Calculate polygon bounds
  const polygonBounds = calculatePolygonBounds(polygon);

  // 2. Apply context buffer
  const bufferedBounds = applyContextBuffer(
    polygonBounds,
    config.context_buffer
  );

  // 3. Enforce size constraints
  const constrainedBounds = enforceWindowConstraints(
    bufferedBounds,
    config,
    origin,
    pixelSize
  );

  // 4. Calculate centroid
  const centroid = calculateCentroid(polygon);

  // 5. Calculate pixel dimensions
  const topLeft = geoToPixel(
    constrainedBounds.minX,
    constrainedBounds.maxY,
    origin,
    pixelSize,
    epsg
  );

  const bottomRight = geoToPixel(
    constrainedBounds.maxX,
    constrainedBounds.minY,
    origin,
    pixelSize,
    epsg
  );

  const width = Math.abs(bottomRight.col - topLeft.col);
  const height = Math.abs(bottomRight.row - topLeft.row);

  return {
    polygonId: polygon.id,
    centerX: centroid.x,
    centerY: centroid.y,
    width: Math.round(width),
    height: Math.round(height),
    pixelSize: pixelSize,
    bounds: constrainedBounds,
    geoBounds: {
      rowStart: Math.floor(topLeft.row),
      rowEnd: Math.ceil(bottomRight.row),
      colStart: Math.floor(topLeft.col),
      colEnd: Math.ceil(bottomRight.col)
    },
    epsg: epsg
  };
}

/**
 * Calculate display window for a polygon
 * (Convenience wrapper for createWindowSpec)
 *
 * @param {Object} polygon - GeoJSON polygon feature
 * @param {Object} config - Display configuration
 * @param {Array<number>} origin - Geographic origin
 * @param {number} pixelSize - Pixel size in map units
 * @param {number} epsg - EPSG code
 * @returns {Object} - Window specification
 */
export function calculateDisplayWindow(polygon, config, origin, pixelSize, epsg) {
  return createWindowSpec(polygon, config, origin, pixelSize, epsg);
}

/**
 * Calculate windows for multiple polygons
 *
 * @param {Array<Object>} polygons - Array of polygon features
 * @param {Object} config - Display configuration
 * @param {Array<number>} origin - Geographic origin
 * @param {number} pixelSize - Pixel size in map units
 * @param {number} epsg - EPSG code
 * @returns {Array<Object>} - Array of window specifications
 */
export function calculateMultipleWindows(polygons, config, origin, pixelSize, epsg) {
  return polygons.map(polygon =>
    createWindowSpec(polygon, config, origin, pixelSize, epsg)
  );
}

/**
 * Check if window is valid (within array bounds)
 *
 * @param {Object} window - Window specification
 * @param {number} arrayRows - Total rows in array
 * @param {number} arrayCols - Total columns in array
 * @returns {boolean} - True if window is fully within array
 */
export function isWindowValid(window, arrayRows, arrayCols) {
  const { pixelBounds } = window;

  return (
    pixelBounds.rowStart >= 0 &&
    pixelBounds.rowEnd <= arrayRows &&
    pixelBounds.colStart >= 0 &&
    pixelBounds.colEnd <= arrayCols
  );
}

/**
 * Clip window to array bounds
 *
 * @param {Object} window - Window specification
 * @param {number} arrayRows - Total rows in array
 * @param {number} arrayCols - Total columns in array
 * @returns {Object} - Clipped window specification
 */
export function clipWindowToArray(window, arrayRows, arrayCols) {
  const clippedPixelBounds = {
    rowStart: Math.max(0, window.pixelBounds.rowStart),
    rowEnd: Math.min(arrayRows, window.pixelBounds.rowEnd),
    colStart: Math.max(0, window.pixelBounds.colStart),
    colEnd: Math.min(arrayCols, window.pixelBounds.colEnd)
  };

  // Recalculate geographic bounds
  const topLeft = pixelToGeo(
    clippedPixelBounds.rowStart,
    clippedPixelBounds.colStart,
    [window.bounds.minX, window.bounds.maxY], // Use original origin context
    window.pixelSize,
    window.epsg
  );

  const bottomRight = pixelToGeo(
    clippedPixelBounds.rowEnd,
    clippedPixelBounds.colEnd,
    [window.bounds.minX, window.bounds.maxY],
    window.pixelSize,
    window.epsg
  );

  return {
    ...window,
    pixelBounds: clippedPixelBounds,
    width: clippedPixelBounds.colEnd - clippedPixelBounds.colStart,
    height: clippedPixelBounds.rowEnd - clippedPixelBounds.rowStart,
    clipped: true
  };
}

/**
 * Get window statistics
 *
 * @param {Object} window - Window specification
 * @returns {Object} - Statistics about the window
 */
export function getWindowStats(window) {
  const area = window.width * window.height;
  const aspectRatio = window.width / window.height;
  const geographicArea = (
    (window.bounds.maxX - window.bounds.minX) *
    (window.bounds.maxY - window.bounds.minY)
  );

  return {
    pixelArea: area,
    geographicArea: geographicArea,
    aspectRatio: aspectRatio,
    width: window.width,
    height: window.height,
    pixelSize: window.pixelSize
  };
}
