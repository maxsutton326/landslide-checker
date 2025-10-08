/**
 * Image Cropping Utilities
 *
 * Extract subsets from multi-dimensional arrays
 * Handle out-of-bounds with padding and resampling
 */

import { geoToPixel } from './coordinates.js';

/**
 * Calculate crop indices from geographic bounds
 *
 * @param {Object} bounds - Geographic bounds {minX, minY, maxX, maxY}
 * @param {Array<number>} origin - Geographic origin
 * @param {number} pixelSize - Pixel size in map units
 * @returns {Object} - Pixel indices {rowStart, rowEnd, colStart, colEnd}
 */
export function calculateCropIndices(bounds, origin, pixelSize) {
  // Top-left corner (minX, maxY)
  const topLeft = geoToPixel(bounds.minX, bounds.maxY, origin, pixelSize, null);

  // Bottom-right corner (maxX, minY)
  const bottomRight = geoToPixel(bounds.maxX, bounds.minY, origin, pixelSize, null);

  return {
    rowStart: Math.floor(topLeft.row),
    rowEnd: Math.ceil(bottomRight.row),
    colStart: Math.floor(topLeft.col),
    colEnd: Math.ceil(bottomRight.col)
  };
}

/**
 * Crop 4D array (time × rows × cols × bands)
 *
 * @param {Array} data - Flattened array data
 * @param {Array<number>} shape - Array shape [time, rows, cols, bands]
 * @param {number} rowStart - Start row index
 * @param {number} rowEnd - End row index (exclusive)
 * @param {number} colStart - Start column index
 * @param {number} colEnd - End column index (exclusive)
 * @param {number} timeIndex - Time slice to extract
 * @returns {Object} - {data, shape} cropped array
 */
export function cropArray4D(data, shape, rowStart, rowEnd, colStart, colEnd, timeIndex) {
  const [timeSteps, totalRows, totalCols, bands] = shape;

  // Validate time index
  if (timeIndex < 0 || timeIndex >= timeSteps) {
    throw new Error(`Time index ${timeIndex} out of range [0, ${timeSteps})`);
  }

  // Handle out of bounds with clipping
  const actualRowStart = Math.max(0, Math.min(totalRows, rowStart));
  const actualRowEnd = Math.max(0, Math.min(totalRows, rowEnd));
  const actualColStart = Math.max(0, Math.min(totalCols, colStart));
  const actualColEnd = Math.max(0, Math.min(totalCols, colEnd));

  const cropRows = actualRowEnd - actualRowStart;
  const cropCols = actualColEnd - actualColStart;

  if (cropRows <= 0 || cropCols <= 0) {
    throw new Error('Invalid crop dimensions: crop results in zero-size array');
  }

  const croppedData = [];

  // Extract data for specified time slice
  for (let r = actualRowStart; r < actualRowEnd; r++) {
    for (let c = actualColStart; c < actualColEnd; c++) {
      for (let b = 0; b < bands; b++) {
        // Calculate index in flattened array
        // Index = timeIndex * (rows * cols * bands) + r * (cols * bands) + c * bands + b
        const idx = timeIndex * (totalRows * totalCols * bands) +
                    r * (totalCols * bands) +
                    c * bands +
                    b;

        croppedData.push(data[idx]);
      }
    }
  }

  return {
    data: croppedData,
    shape: [cropRows, cropCols, bands]
  };
}

/**
 * Crop 3D prediction array (rows × cols × classes)
 *
 * @param {Array} data - Flattened array data
 * @param {Array<number>} shape - Array shape [rows, cols, classes]
 * @param {number} rowStart - Start row index
 * @param {number} rowEnd - End row index (exclusive)
 * @param {number} colStart - Start column index
 * @param {number} colEnd - End column index (exclusive)
 * @returns {Object} - {data, shape} cropped array
 */
export function cropPredictions(data, shape, rowStart, rowEnd, colStart, colEnd) {
  const [totalRows, totalCols, classes] = shape;

  // Handle out of bounds with clipping
  const actualRowStart = Math.max(0, Math.min(totalRows, rowStart));
  const actualRowEnd = Math.max(0, Math.min(totalRows, rowEnd));
  const actualColStart = Math.max(0, Math.min(totalCols, colStart));
  const actualColEnd = Math.max(0, Math.min(totalCols, colEnd));

  const cropRows = actualRowEnd - actualRowStart;
  const cropCols = actualColEnd - actualColStart;

  if (cropRows <= 0 || cropCols <= 0) {
    throw new Error('Invalid crop dimensions');
  }

  const croppedData = [];

  for (let r = actualRowStart; r < actualRowEnd; r++) {
    for (let c = actualColStart; c < actualColEnd; c++) {
      for (let cls = 0; cls < classes; cls++) {
        // Index = r * (cols * classes) + c * classes + cls
        const idx = r * (totalCols * classes) + c * classes + cls;
        croppedData.push(data[idx]);
      }
    }
  }

  return {
    data: croppedData,
    shape: [cropRows, cropCols, classes]
  };
}

/**
 * Crop GeoTIFF data
 *
 * @param {Object} tiffData - GeoTIFF data object
 * @param {Object} bounds - Geographic bounds
 * @param {number} targetSize - Target size in pixels (max dimension)
 * @returns {Object} - Cropped image data
 */
export function cropGeoTiff(tiffData, bounds, targetSize = null) {
  // For now, this is a placeholder
  // In practice, would extract window from tiffData.data based on bounds
  // and potentially resample to targetSize

  if (!tiffData || !tiffData.metadata) {
    throw new Error('Invalid GeoTIFF data');
  }

  // Calculate pixel bounds from geographic bounds
  // This would use the tiffData.metadata.geoTransform

  return {
    data: tiffData.data,
    metadata: { ...tiffData.metadata },
    bounds: bounds
  };
}

/**
 * Pad array with constant value
 *
 * @param {Array} data - Flattened array data
 * @param {Array<number>} shape - Array shape [rows, cols] or [rows, cols, bands]
 * @param {Object} padding - Padding amounts {top, bottom, left, right}
 * @param {number} padValue - Value to use for padding
 * @returns {Object} - {data, shape} padded array
 */
export function padArray(data, shape, padding, padValue = 0) {
  const { top, bottom, left, right } = padding;

  if (shape.length === 2) {
    // 2D array
    const [rows, cols] = shape;
    const newRows = rows + top + bottom;
    const newCols = cols + left + right;

    const paddedData = new Array(newRows * newCols).fill(padValue);

    // Copy original data to center
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const srcIdx = r * cols + c;
        const dstIdx = (r + top) * newCols + (c + left);
        paddedData[dstIdx] = data[srcIdx];
      }
    }

    return {
      data: paddedData,
      shape: [newRows, newCols]
    };

  } else if (shape.length === 3) {
    // 3D array [rows, cols, bands]
    const [rows, cols, bands] = shape;
    const newRows = rows + top + bottom;
    const newCols = cols + left + right;

    const paddedData = new Array(newRows * newCols * bands).fill(padValue);

    // Copy original data to center
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (let b = 0; b < bands; b++) {
          const srcIdx = r * (cols * bands) + c * bands + b;
          const dstIdx = (r + top) * (newCols * bands) + (c + left) * bands + b;
          paddedData[dstIdx] = data[srcIdx];
        }
      }
    }

    return {
      data: paddedData,
      shape: [newRows, newCols, bands]
    };

  } else {
    throw new Error('Unsupported array dimensions for padding');
  }
}

/**
 * Resample array to target size (simple nearest-neighbor)
 *
 * @param {Array} data - Flattened array data
 * @param {Array<number>} shape - Array shape [rows, cols] or [rows, cols, bands]
 * @param {number} targetRows - Target number of rows
 * @param {number} targetCols - Target number of columns
 * @returns {Object} - {data, shape} resampled array
 */
export function resampleArray(data, shape, targetRows, targetCols) {
  if (shape.length === 2) {
    // 2D array
    const [srcRows, srcCols] = shape;
    const resampledData = [];

    const rowRatio = srcRows / targetRows;
    const colRatio = srcCols / targetCols;

    for (let r = 0; r < targetRows; r++) {
      for (let c = 0; c < targetCols; c++) {
        // Nearest neighbor
        const srcRow = Math.floor(r * rowRatio);
        const srcCol = Math.floor(c * colRatio);
        const srcIdx = srcRow * srcCols + srcCol;
        resampledData.push(data[srcIdx]);
      }
    }

    return {
      data: resampledData,
      shape: [targetRows, targetCols]
    };

  } else if (shape.length === 3) {
    // 3D array [rows, cols, bands]
    const [srcRows, srcCols, bands] = shape;
    const resampledData = [];

    const rowRatio = srcRows / targetRows;
    const colRatio = srcCols / targetCols;

    for (let r = 0; r < targetRows; r++) {
      for (let c = 0; c < targetCols; c++) {
        for (let b = 0; b < bands; b++) {
          const srcRow = Math.floor(r * rowRatio);
          const srcCol = Math.floor(c * colRatio);
          const srcIdx = srcRow * (srcCols * bands) + srcCol * bands + b;
          resampledData.push(data[srcIdx]);
        }
      }
    }

    return {
      data: resampledData,
      shape: [targetRows, targetCols, bands]
    };

  } else {
    throw new Error('Unsupported array dimensions for resampling');
  }
}

/**
 * Extract window with padding if needed
 *
 * @param {Array} data - Flattened array data
 * @param {Array<number>} shape - Array shape
 * @param {Object} window - Window specification
 * @param {number} padValue - Value for padding
 * @returns {Object} - Extracted and potentially padded data
 */
export function extractWindowWithPadding(data, shape, window, padValue = 0) {
  const { rowStart, rowEnd, colStart, colEnd } = window;
  const [, totalRows, totalCols] = shape; // Assuming 4D: [time, rows, cols, bands]

  // Calculate how much padding is needed
  const padTop = Math.max(0, -rowStart);
  const padBottom = Math.max(0, rowEnd - totalRows);
  const padLeft = Math.max(0, -colStart);
  const padRight = Math.max(0, colEnd - totalCols);

  // Adjust indices to valid range
  const validRowStart = Math.max(0, rowStart);
  const validRowEnd = Math.min(totalRows, rowEnd);
  const validColStart = Math.max(0, colStart);
  const validColEnd = Math.min(totalCols, colEnd);

  // Extract valid portion
  const extracted = cropArray4D(
    data,
    shape,
    validRowStart,
    validRowEnd,
    validColStart,
    validColEnd,
    window.timeIndex || 0
  );

  // Apply padding if needed
  if (padTop > 0 || padBottom > 0 || padLeft > 0 || padRight > 0) {
    return padArray(
      extracted.data,
      extracted.shape,
      { top: padTop, bottom: padBottom, left: padLeft, right: padRight },
      padValue
    );
  }

  return extracted;
}

/**
 * Normalize array values to 0-1 range
 *
 * @param {Array} data - Array data
 * @returns {Object} - {data, min, max} normalized data and original range
 */
export function normalizeArray(data) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) {
    return {
      data: data.map(() => 0),
      min,
      max
    };
  }

  const normalized = data.map(v => (v - min) / range);

  return {
    data: normalized,
    min,
    max
  };
}

/**
 * Create image chip for a specific window
 *
 * @param {Array} data - Source array data
 * @param {Array<number>} shape - Array shape
 * @param {Object} windowSpec - Window specification from window_calculator
 * @param {Object} options - Additional options {normalize, resampleTo, padValue}
 * @returns {Object} - Image chip {data, shape, bounds, metadata}
 */
export function createImageChip(data, shape, windowSpec, options = {}) {
  const {
    normalize = false,
    resampleTo = null,
    padValue = 0,
    timeIndex = 0
  } = options;

  const { pixelBounds, bounds } = windowSpec;

  // Extract window
  let chipData = cropArray4D(
    data,
    shape,
    pixelBounds.rowStart,
    pixelBounds.rowEnd,
    pixelBounds.colStart,
    pixelBounds.colEnd,
    timeIndex
  );

  // Normalize if requested
  if (normalize) {
    const normalized = normalizeArray(chipData.data);
    chipData.data = normalized.data;
    chipData.metadata = {
      ...chipData.metadata,
      originalRange: { min: normalized.min, max: normalized.max }
    };
  }

  // Resample if requested
  if (resampleTo) {
    chipData = resampleArray(chipData.data, chipData.shape, resampleTo, resampleTo);
  }

  return {
    ...chipData,
    bounds,
    windowSpec
  };
}
