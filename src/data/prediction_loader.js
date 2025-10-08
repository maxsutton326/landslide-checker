/**
 * Prediction Array Loader
 *
 * Loads 3D NumPy arrays containing model predictions
 * Validates dimensions and probability ranges
 */

import { loadNumpyArray } from './numpy_loader.js';

/**
 * Load prediction array from NumPy file
 *
 * @param {string} filepath - Path to .npy file
 * @param {Object} options - Loading options
 * @param {Array} options.expectedShape - Expected array shape [rows, cols, classes]
 * @param {boolean} options.validateRange - Validate values are probabilities (0-1)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} - Object with prediction data and metadata
 */
export async function loadPredictions(filepath, options = {}) {
  const {
    expectedShape = null,
    validateRange = true,
    onProgress = null
  } = options;

  if (onProgress) {
    onProgress({ stage: 'reading', progress: 0, message: 'Loading predictions...' });
  }

  // Load using NumPy loader with 3D dimension requirement
  const result = await loadNumpyArray(filepath, {
    expectedDimensions: 3,
    validateRange,
    onProgress: (progress) => {
      if (onProgress) {
        onProgress({
          ...progress,
          message: progress.stage === 'reading' ? 'Loading predictions...' : progress.message
        });
      }
    }
  });

  // Validate shape if specified
  if (expectedShape) {
    const matches = result.metadata.shape.length === expectedShape.length &&
                    result.metadata.shape.every((dim, i) => dim === expectedShape[i]);

    if (!matches) {
      throw new Error(
        `Prediction shape mismatch: expected [${expectedShape.join(', ')}], ` +
        `got [${result.metadata.shape.join(', ')}]`
      );
    }
  }

  // Additional validation for prediction arrays
  const [rows, cols, classes] = result.metadata.shape;

  if (classes < 2) {
    throw new Error(`Invalid number of classes: ${classes}. Expected at least 2 classes.`);
  }

  // Validate probabilities if requested
  if (validateRange) {
    const hasInvalidValues = result.data.some(v => v < 0 || v > 1);

    if (hasInvalidValues) {
      throw new Error('Prediction values must be probabilities in range [0, 1]');
    }

    // Optionally check if probabilities sum to 1 for each pixel
    // (this is expensive, so only do it if explicitly requested)
    if (options.validateProbabilitySum) {
      validateProbabilitySums(result.data, rows, cols, classes);
    }
  }

  return {
    data: result.data,
    metadata: {
      ...result.metadata,
      rows,
      cols,
      classes
    }
  };
}

/**
 * Validate that prediction probabilities sum to 1 for each pixel
 * @param {Array} data - Flattened prediction array
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} classes - Number of classes
 * @throws {Error} - If probabilities don't sum to 1 (within tolerance)
 */
function validateProbabilitySums(data, rows, cols, classes) {
  const tolerance = 0.01; // Allow 1% deviation

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;

      for (let cls = 0; cls < classes; cls++) {
        const index = (r * cols + c) * classes + cls;
        sum += data[index];
      }

      if (Math.abs(sum - 1.0) > tolerance) {
        throw new Error(
          `Invalid probability sum at pixel (${r}, ${c}): ${sum.toFixed(4)} ` +
          `(expected 1.0 ± ${tolerance})`
        );
      }
    }
  }
}

/**
 * Get predicted class for a specific pixel
 * @param {Array} data - Flattened prediction array
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} cols - Total number of columns
 * @param {number} classes - Number of classes
 * @returns {Object} - { classIndex, probability, probabilities }
 */
export function getPredictedClass(data, row, col, cols, classes) {
  const probabilities = [];
  let maxProb = -1;
  let maxClass = -1;

  for (let cls = 0; cls < classes; cls++) {
    const index = (row * cols + col) * classes + cls;
    const prob = data[index];
    probabilities.push(prob);

    if (prob > maxProb) {
      maxProb = prob;
      maxClass = cls;
    }
  }

  return {
    classIndex: maxClass,
    probability: maxProb,
    probabilities
  };
}

/**
 * Extract prediction probabilities for a specific class
 * @param {Array} data - Flattened prediction array
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} classes - Number of classes
 * @param {number} classIndex - Class index to extract
 * @returns {Array} - 2D array of probabilities for the specified class
 */
export function extractClassProbabilities(data, rows, cols, classes, classIndex) {
  if (classIndex < 0 || classIndex >= classes) {
    throw new Error(`Invalid class index: ${classIndex} (must be 0-${classes - 1})`);
  }

  const classProbabilities = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = (r * cols + c) * classes + classIndex;
      classProbabilities.push(data[index]);
    }
  }

  return classProbabilities;
}

/**
 * Generate class map (most probable class for each pixel)
 * @param {Array} data - Flattened prediction array
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} classes - Number of classes
 * @returns {Object} - { classMap, confidenceMap }
 */
export function generateClassMap(data, rows, cols, classes) {
  const classMap = [];
  const confidenceMap = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const prediction = getPredictedClass(data, r, c, cols, classes);
      classMap.push(prediction.classIndex);
      confidenceMap.push(prediction.probability);
    }
  }

  return {
    classMap,
    confidenceMap,
    shape: [rows, cols]
  };
}

/**
 * Apply threshold to predictions
 * @param {Array} data - Flattened prediction array
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} classes - Number of classes
 * @param {number} classIndex - Class index to threshold
 * @param {number} threshold - Probability threshold (0-1)
 * @returns {Array} - Binary mask (1 where probability >= threshold, 0 otherwise)
 */
export function applyThreshold(data, rows, cols, classes, classIndex, threshold = 0.5) {
  if (threshold < 0 || threshold > 1) {
    throw new Error('Threshold must be between 0 and 1');
  }

  const mask = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const index = (r * cols + c) * classes + classIndex;
      const prob = data[index];
      mask.push(prob >= threshold ? 1 : 0);
    }
  }

  return mask;
}

/**
 * Calculate prediction statistics
 * @param {Array} data - Flattened prediction array
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @param {number} classes - Number of classes
 * @returns {Object} - Statistics for each class
 */
export function calculatePredictionStats(data, rows, cols, classes) {
  const stats = {};

  for (let cls = 0; cls < classes; cls++) {
    const probabilities = extractClassProbabilities(data, rows, cols, classes, cls);

    const sum = probabilities.reduce((a, b) => a + b, 0);
    const mean = sum / probabilities.length;
    const sortedProbs = [...probabilities].sort((a, b) => a - b);
    const min = sortedProbs[0];
    const max = sortedProbs[sortedProbs.length - 1];
    const median = sortedProbs[Math.floor(sortedProbs.length / 2)];

    // Count pixels where this class is most probable
    const classMap = generateClassMap(data, rows, cols, classes);
    const pixelCount = classMap.classMap.filter(c => c === cls).length;

    stats[`class_${cls}`] = {
      mean,
      median,
      min,
      max,
      pixelCount,
      pixelPercentage: (pixelCount / (rows * cols)) * 100
    };
  }

  return stats;
}
