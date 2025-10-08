/**
 * NumPy Array Loader
 *
 * Reads binary .npy files and parses the NumPy format
 * Supports validation of dimensions and data ranges
 */

import { readFileSync } from 'fs';

/**
 * Parse NumPy header to extract metadata
 * @param {Buffer} headerBuffer - Header portion of NPY file
 * @returns {Object} - Parsed header with descr, fortran_order, shape
 */
function parseNumpyHeader(headerBuffer) {
  const headerStr = headerBuffer.toString('ascii').trim();

  // Parse Python dictionary-like header
  // Example: {'descr': '<f4', 'fortran_order': False, 'shape': (2, 10, 10, 3), }

  const descrMatch = headerStr.match(/'descr':\s*'([^']+)'/);
  const fortranMatch = headerStr.match(/'fortran_order':\s*(True|False)/);
  const shapeMatch = headerStr.match(/'shape':\s*\(([^)]+)\)/);

  if (!descrMatch || !fortranMatch || !shapeMatch) {
    throw new Error('Invalid NPY header format');
  }

  const descr = descrMatch[1];
  const fortranOrder = fortranMatch[1] === 'True';
  const shapeStr = shapeMatch[1].replace(/,\s*$/, ''); // Remove trailing comma
  const shape = shapeStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

  return {
    descr,
    fortranOrder,
    shape
  };
}

/**
 * Get TypedArray constructor and element size from dtype
 * @param {string} dtype - NumPy dtype string (e.g., '<f4', '<f8')
 * @returns {Object} - { ArrayType, elementSize }
 */
function getDtypeInfo(dtype) {
  const dtypeMap = {
    '<f4': { ArrayType: Float32Array, elementSize: 4, name: 'float32' },
    '<f8': { ArrayType: Float64Array, elementSize: 8, name: 'float64' },
    '<i4': { ArrayType: Int32Array, elementSize: 4, name: 'int32' },
    '<i8': { ArrayType: BigInt64Array, elementSize: 8, name: 'int64' },
    '<u4': { ArrayType: Uint32Array, elementSize: 4, name: 'uint32' },
    '<u8': { ArrayType: BigUint64Array, elementSize: 8, name: 'uint64' }
  };

  const info = dtypeMap[dtype];
  if (!info) {
    throw new Error(`Unsupported dtype: ${dtype}`);
  }

  return info;
}

/**
 * Load and parse a NumPy .npy file
 *
 * @param {string} filepath - Path to .npy file
 * @param {Object} options - Loading options
 * @param {number} options.expectedDimensions - Expected number of dimensions
 * @param {boolean} options.validateRange - Validate data is in range 0-1
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} - Object with data array and metadata
 */
export async function loadNumpyArray(filepath, options = {}) {
  const {
    expectedDimensions = null,
    validateRange = false,
    onProgress = null
  } = options;

  if (onProgress) {
    onProgress({ stage: 'reading', progress: 0, message: 'Reading file...' });
  }

  try {
    // Read entire file
    const buffer = readFileSync(filepath);

    // Validate magic string
    const magic = buffer.slice(0, 6);
    const expectedMagic = Buffer.from([0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59]); // \x93NUMPY

    if (!magic.equals(expectedMagic)) {
      throw new Error('Invalid NPY file: magic string mismatch');
    }

    // Read version
    const versionMajor = buffer.readUInt8(6);
    const versionMinor = buffer.readUInt8(7);

    if (versionMajor !== 1) {
      throw new Error(`Unsupported NPY version: ${versionMajor}.${versionMinor}`);
    }

    if (onProgress) {
      onProgress({ stage: 'parsing', progress: 0.2, message: 'Parsing header...' });
    }

    // Read header length
    const headerLen = buffer.readUInt16LE(8);

    // Read header
    const headerBuffer = buffer.slice(10, 10 + headerLen);
    const header = parseNumpyHeader(headerBuffer);

    // Get dtype info
    const dtypeInfo = getDtypeInfo(header.descr);

    // Calculate expected data size
    const totalElements = header.shape.reduce((a, b) => a * b, 1);
    const expectedDataSize = totalElements * dtypeInfo.elementSize;

    // Read data
    const dataStart = 10 + headerLen;
    const dataBuffer = buffer.slice(dataStart);

    if (dataBuffer.length < expectedDataSize) {
      throw new Error(`Incomplete data: expected ${expectedDataSize} bytes, got ${dataBuffer.length}`);
    }

    if (onProgress) {
      onProgress({ stage: 'loading', progress: 0.5, message: 'Loading data...' });
    }

    // Create typed array from buffer
    const data = new dtypeInfo.ArrayType(
      dataBuffer.buffer,
      dataBuffer.byteOffset,
      totalElements
    );

    // Create metadata
    const metadata = {
      shape: header.shape,
      dtype: header.descr,
      dtypeName: dtypeInfo.name,
      dimensions: header.shape.length,
      totalElements,
      fortranOrder: header.fortranOrder,
      fileSize: buffer.length
    };

    if (onProgress) {
      onProgress({ stage: 'validating', progress: 0.7, message: 'Validating...' });
    }

    // Validate dimensions if specified
    if (expectedDimensions !== null && metadata.dimensions !== expectedDimensions) {
      throw new Error(
        `Invalid dimensions: expected ${expectedDimensions}D array, got ${metadata.dimensions}D array with shape ${JSON.stringify(header.shape)}`
      );
    }

    // Validate range if requested
    if (validateRange) {
      let minVal = Infinity;
      let maxVal = -Infinity;

      for (let i = 0; i < data.length; i++) {
        minVal = Math.min(minVal, data[i]);
        maxVal = Math.max(maxVal, data[i]);
      }

      metadata.dataRange = { min: minVal, max: maxVal };

      // Warn if data is outside typical range
      if (minVal < 0 || maxVal > 1) {
        console.warn(`Warning: Data range [${minVal}, ${maxVal}] is outside typical [0, 1] range`);
      }
    }

    if (onProgress) {
      onProgress({ stage: 'complete', progress: 1.0, message: 'Complete' });
    }

    return {
      data: Array.from(data), // Convert to regular array for easier manipulation
      metadata
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`NumPy file not found: ${filepath}`);
    }
    throw error;
  }
}

/**
 * Get array value at specific indices
 * @param {Array} data - Flattened array data
 * @param {Array} shape - Array shape
 * @param {Array} indices - Indices to access [time, row, col, band]
 * @returns {number} - Value at specified indices
 */
export function getArrayValue(data, shape, indices) {
  // Calculate flat index from multi-dimensional indices
  // Assumes C-order (row-major)
  let flatIndex = 0;
  let multiplier = 1;

  for (let i = shape.length - 1; i >= 0; i--) {
    flatIndex += indices[i] * multiplier;
    multiplier *= shape[i];
  }

  return data[flatIndex];
}

/**
 * Extract a slice from multi-dimensional array
 * @param {Array} data - Flattened array data
 * @param {Array} shape - Array shape
 * @param {Object} sliceSpec - Slice specification (e.g., { time: 0, band: 1 })
 * @returns {Object} - { data: sliced data, shape: new shape }
 */
export function sliceArray(data, shape, sliceSpec) {
  // For now, implement simple time-band slicing for 4D arrays
  if (shape.length !== 4) {
    throw new Error('sliceArray currently only supports 4D arrays');
  }

  const [timeSteps, rows, cols, bands] = shape;
  const timeIndex = sliceSpec.time ?? 0;
  const bandIndex = sliceSpec.band ?? 0;

  if (timeIndex >= timeSteps || bandIndex >= bands) {
    throw new Error('Slice indices out of bounds');
  }

  // Extract 2D slice at specific time and band
  const slicedData = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = getArrayValue(data, shape, [timeIndex, r, c, bandIndex]);
      slicedData.push(value);
    }
  }

  return {
    data: slicedData,
    shape: [rows, cols]
  };
}
