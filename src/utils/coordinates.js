/**
 * Coordinate Transformation Utilities - Browser Version
 *
 * Handles conversion between pixel and geographic coordinates
 * Uses server API for projection transformations (no proj4 dependency in browser)
 */

const API_BASE = 'http://localhost:3000';

/**
 * Convert pixel coordinates to geographic coordinates
 *
 * @param {number} row - Row index (Y direction, 0 at top)
 * @param {number} col - Column index (X direction, 0 at left)
 * @param {Array<number>} origin - Geographic origin [x, y]
 * @param {number} pixelSize - Size of pixel in map units
 * @param {number} epsg - EPSG code for coordinate system
 * @returns {{x: number, y: number}} - Geographic coordinates
 */
export function pixelToGeo(row, col, origin, pixelSize, epsg = null) {
  if (!origin || origin.length !== 2) {
    throw new Error('Invalid origin: must be array of [x, y]');
  }

  if (pixelSize === undefined || pixelSize === null) {
    throw new Error('Invalid pixel size: must be a number');
  }

  // EPSG is optional - only required for projection transformations
  if (epsg !== null && !isValidEpsg(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg}`);
  }

  const [originX, originY] = origin;

  // Standard north-up image: Y increases downward in pixels but northward in geo
  // So we subtract row * pixelSize from originY
  const x = originX + col * pixelSize;
  const y = originY - row * pixelSize;

  return { x, y };
}

/**
 * Convert geographic coordinates to pixel coordinates
 *
 * @param {number} x - Geographic X coordinate
 * @param {number} y - Geographic Y coordinate
 * @param {Array<number>} origin - Geographic origin [x, y]
 * @param {number} pixelSize - Size of pixel in map units
 * @param {number} epsg - EPSG code for coordinate system
 * @returns {{row: number, col: number}} - Pixel coordinates
 */
export function geoToPixel(x, y, origin, pixelSize, epsg = null) {
  if (!origin || origin.length !== 2) {
    throw new Error('Invalid origin: must be array of [x, y]');
  }

  if (pixelSize === undefined || pixelSize === null || pixelSize === 0) {
    throw new Error('Invalid pixel size: must be non-zero number');
  }

  // EPSG is optional - only required for projection transformations
  if (epsg !== null && !isValidEpsg(epsg)) {
    throw new Error(`Invalid EPSG code: ${epsg}`);
  }

  const [originX, originY] = origin;

  // Inverse of pixelToGeo
  const col = (x - originX) / pixelSize[0];
  const row = (originY - y) / pixelSize[1];

  return { row, col };
}

/**
 * Transform bounds from one coordinate system to another using server API
 *
 * @param {Object} bounds - Bounding box {minX, minY, maxX, maxY}
 * @param {number} fromEpsg - Source EPSG code
 * @param {number} toEpsg - Target EPSG code
 * @returns {Promise<Object>} - Transformed bounds
 */
export async function transformBounds(bounds, fromEpsg, toEpsg) {
  if (!isValidEpsg(fromEpsg) || !isValidEpsg(toEpsg)) {
    throw new Error('Invalid EPSG codes');
  }

  // If same projection, return as-is
  if (fromEpsg === toEpsg) {
    return { ...bounds };
  }

  const params = new URLSearchParams({
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    from: fromEpsg,
    to: toEpsg
  });

  const response = await fetch(`${API_BASE}/api/transform-bounds?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Transformation failed');
  }

  return await response.json();
}

/**
 * Create affine transformation parameters
 *
 * @param {Array<number>} origin - Geographic origin [x, y]
 * @param {number} pixelSize - Pixel size in map units
 * @param {number} rotation - Rotation angle in degrees (default 0)
 * @returns {Object} - Transform parameters
 */
export function createTransform(origin, pixelSize, rotation = 0) {
  if (!origin || origin.length !== 2) {
    throw new Error('Invalid origin: must be array of [x, y]');
  }

  if (rotation !== 0) {
    // Convert rotation to radians and calculate transform components
    const radians = (rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return {
      originX: origin[0],
      originY: origin[1],
      pixelWidth: pixelSize * cos,
      pixelHeight: -pixelSize * cos, // Negative for north-up
      rotationX: pixelSize * sin,
      rotationY: pixelSize * sin
    };
  }

  // Standard north-up transform
  return {
    originX: origin[0],
    originY: origin[1],
    pixelWidth: pixelSize,
    pixelHeight: -pixelSize, // Negative for north-up images
    rotationX: 0,
    rotationY: 0
  };
}

/**
 * Apply affine transformation to pixel coordinates
 *
 * @param {number} row - Pixel row
 * @param {number} col - Pixel column
 * @param {Object} transform - Transform parameters
 * @returns {{x: number, y: number}} - Geographic coordinates
 */
export function applyTransform(row, col, transform) {
  const {
    originX,
    originY,
    pixelWidth,
    pixelHeight,
    rotationX,
    rotationY
  } = transform;

  // Affine transformation: [x, y] = [originX, originY] + col * [pixelWidth, rotationY] + row * [rotationX, pixelHeight]
  const x = originX + col * pixelWidth + row * rotationX;
  const y = originY + col * rotationY + row * pixelHeight;

  return { x, y };
}

/**
 * Apply inverse affine transformation from geographic to pixel
 *
 * @param {number} x - Geographic X coordinate
 * @param {number} y - Geographic Y coordinate
 * @param {Object} transform - Transform parameters
 * @returns {{row: number, col: number}} - Pixel coordinates
 */
export function inverseTransform(x, y, transform) {
  const {
    originX,
    originY,
    pixelWidth,
    pixelHeight,
    rotationX,
    rotationY
  } = transform;

  // Inverse affine transformation
  // Solve: x = originX + col * pixelWidth + row * rotationX
  //        y = originY + col * rotationY + row * pixelHeight

  const deltaX = x - originX;
  const deltaY = y - originY;

  // Determinant of transformation matrix
  const det = pixelWidth * pixelHeight - rotationX * rotationY;

  if (Math.abs(det) < 1e-10) {
    throw new Error('Singular transformation matrix');
  }

  // Inverse matrix multiplication
  const col = (pixelHeight * deltaX - rotationX * deltaY) / det;
  const row = (-rotationY * deltaX + pixelWidth * deltaY) / det;

  return { row, col };
}

/**
 * Validate EPSG code
 *
 * @param {number} epsg - EPSG code
 * @returns {boolean} - True if valid
 * @private
 */
function isValidEpsg(epsg) {
  if (typeof epsg !== 'number') {
    return false;
  }

  // Common EPSG codes
  const commonCodes = [4326, 32610, 32611, 32612, 3857, 2154, 27700];

  if (commonCodes.includes(epsg)) {
    return true;
  }

  // EPSG codes are typically 4-5 digits
  return epsg >= 1000 && epsg <= 99999;
}

/**
 * Convert point from one projection to another using server API
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} fromEpsg - Source EPSG code
 * @param {number} toEpsg - Target EPSG code
 * @returns {Promise<{x: number, y: number}>} - Transformed coordinates
 */
export async function transformPoint(x, y, fromEpsg, toEpsg) {
  if (fromEpsg === toEpsg) {
    return { x, y };
  }

  const params = new URLSearchParams({
    x,
    y,
    from: fromEpsg,
    to: toEpsg
  });

  const response = await fetch(`${API_BASE}/api/transform?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Transformation failed');
  }

  return await response.json();
}

/**
 * Calculate pixel size at a geographic location
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoomLevel - Zoom level (for web maps)
 * @returns {number} - Pixel size in meters
 */
export function calculatePixelSize(lat, lon, zoomLevel) {
  // Earth circumference at equator: ~40,075 km
  const earthCircumference = 40075000; // meters

  // At zoom level z, there are 2^z tiles of 256 pixels each
  const tilesAtZoom = Math.pow(2, zoomLevel);
  const pixelsAtZoom = tilesAtZoom * 256;

  // Pixel size at equator
  const pixelSizeEquator = earthCircumference / pixelsAtZoom;

  // Adjust for latitude (pixels are smaller at higher latitudes)
  const pixelSize = pixelSizeEquator * Math.cos((lat * Math.PI) / 180);

  return pixelSize;
}

/**
 * Get extent from pixel array and georeference info
 *
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {Array<number>} origin - Geographic origin
 * @param {number} pixelSize - Pixel size
 * @returns {Object} - Extent {minX, minY, maxX, maxY}
 */
export function getArrayExtent(rows, cols, origin, pixelSize) {
  const topLeft = pixelToGeo(0, 0, origin, pixelSize, null);
  const bottomRight = pixelToGeo(rows, cols, origin, pixelSize, null);

  return {
    minX: topLeft.x,
    maxX: bottomRight.x,
    minY: bottomRight.y,
    maxY: topLeft.y
  };
}

/**
 * Calculate distance between two points in same projection
 *
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} - Distance
 */
export function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if point is within bounds
 *
 * @param {number} x - Point X
 * @param {number} y - Point Y
 * @param {Object} bounds - Bounds {minX, minY, maxX, maxY}
 * @returns {boolean} - True if within bounds
 */
export function isPointInBounds(x, y, bounds) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
}
