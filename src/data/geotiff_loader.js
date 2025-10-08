/**
 * GeoTIFF Loader
 *
 * Loads GeoTIFF files and extracts image data with georeferencing
 * Supports multi-band images and data normalization
 */

import { fromFile, fromArrayBuffer } from 'geotiff';
import { readFileSync } from 'fs';

/**
 * Load GeoTIFF file
 *
 * @param {string} filepath - Path to GeoTIFF file or metadata JSON
 * @param {Object} options - Loading options
 * @param {boolean} options.metadataOnly - Only load metadata, not pixel data
 * @param {boolean} options.normalize - Normalize pixel values to 0-1 range
 * @param {Array} options.bands - Specific bands to load (null = all bands)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} - Object with image data and metadata
 */
export async function loadGeoTiff(filepath, options = {}) {
  const {
    metadataOnly = false,
    normalize = false,
    bands = null,
    onProgress = null
  } = options;

  if (onProgress) {
    onProgress({ stage: 'reading', progress: 0, message: 'Reading GeoTIFF...' });
  }

  try {
    // Check if this is a metadata JSON file (for testing)
    if (filepath.endsWith('.json')) {
      return await loadGeoTiffMetadata(filepath);
    }

    // Load actual GeoTIFF file
    const tiff = await fromFile(filepath);

    if (onProgress) {
      onProgress({ stage: 'parsing', progress: 0.2, message: 'Parsing metadata...' });
    }

    // Get first image (most GeoTIFFs have single image)
    const image = await tiff.getImage();

    // Extract metadata
    const width = image.getWidth();
    const height = image.getHeight();
    const samplesPerPixel = image.getSamplesPerPixel();
    const tileWidth = image.getTileWidth();
    const tileHeight = image.getTileHeight();
    const origin = image.getOrigin(); // [x_origin, y_origin]
    const resolution = image.getResolution(); // [x_resolution, y_resolution]
    const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]

    // Get georeference information
    const geoKeys = image.getGeoKeys();
    const fileDirectory = image.getFileDirectory();

    // Extract geo transform (affine transformation parameters)
    let geoTransform = null;
    if (origin && bbox) {
      // Calculate geo transform from tiepoints and pixel scale
      // const tiepoint = fileDirectory.ModelTiepoint;
      const pixelScale = fileDirectory.ModelPixelScale;

      geoTransform = [
        bbox[0], // Top left X
        resolution[0], // Pixel width
        0, // Rotation (usually 0)
        bbox[1], // Top left Y
        0, // Rotation (usually 0)
        -resolution[1] // Pixel height (negative for north-up)
      ];
    } else if (fileDirectory.ModelTransformation) {
      geoTransform = fileDirectory.ModelTransformation.slice(0, 6);
    }

    // Get projection
    let projection = 'Unknown';
    if (geoKeys && geoKeys.ProjectedCSTypeGeoKey) {
      projection = `EPSG:${geoKeys.ProjectedCSTypeGeoKey}`;
    } else if (geoKeys && geoKeys.GeographicTypeGeoKey) {
      projection = `EPSG:${geoKeys.GeographicTypeGeoKey}`;
    }

    const metadata = {
      width,
      height,
      bands: samplesPerPixel,
      tileWidth,
      tileHeight,
      geoTransform,
      projection,
      dataType: getSampleFormatName(image.getSampleFormat()),
      bitsPerSample: image.getBitsPerSample()[0],
      fileDirectory,
      origin,
      resolution
    };

    if (onProgress) {
      onProgress({ stage: 'metadata', progress: 0.4, message: 'Metadata extracted' });
    }

    // Return early if only metadata requested
    if (metadataOnly) {
      if (onProgress) {
        onProgress({ stage: 'complete', progress: 1.0, message: 'Complete' });
      }

      return {
        metadata,
        data: null
      };
    }

    // Load pixel data
    if (onProgress) {
      onProgress({ stage: 'loading', progress: 0.5, message: 'Loading pixel data...' });
    }

    // Determine which bands to load
    const bandsToLoad = bands || Array.from({ length: samplesPerPixel }, (_, i) => i);

    // Read raster data
    const rasters = await image.readRasters({
      samples: bandsToLoad,
      interleave: false // Return separate arrays for each band
    });

    if (onProgress) {
      onProgress({ stage: 'processing', progress: 0.8, message: 'Processing data...' });
    }

    // Process and optionally normalize data
    const imageData = {};

    bandsToLoad.forEach((bandIndex, i) => {
      let bandData = Array.from(rasters[i]);

      if (normalize) {
        const min = Math.min(...bandData);
        const max = Math.max(...bandData);
        const range = max - min;

        if (range > 0) {
          bandData = bandData.map(v => (v - min) / range);
        }
      }

      imageData[`band_${bandIndex}`] = bandData;
    });

    if (onProgress) {
      onProgress({ stage: 'complete', progress: 1.0, message: 'Complete' });
    }

    return {
      data: imageData,
      metadata,
      shape: [height, width, bandsToLoad.length]
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`GeoTIFF file not found: ${filepath}`);
    }
    throw error;
  }
}

/**
 * Load GeoTIFF metadata from JSON file (for testing)
 * @param {string} filepath - Path to metadata JSON file
 * @returns {Promise<Object>} - Metadata object
 */
async function loadGeoTiffMetadata(filepath) {
  try {
    const metadata = JSON.parse(readFileSync(filepath, 'utf8'));

    // Ensure required fields are present
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid metadata: missing width or height');
    }

    return {
      metadata,
      data: null
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Metadata file not found: ${filepath}`);
    }
    throw error;
  }
}

/**
 * Get sample format name from code
 * @param {number} format - Sample format code
 * @returns {string} - Format name
 */
function getSampleFormatName(format) {
  const formats = {
    1: 'uint',
    2: 'int',
    3: 'float',
    4: 'undefined'
  };
  return formats[format] || 'unknown';
}

/**
 * Extract pixel value at specific coordinates
 * @param {Object} imageData - Image data object
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {number} width - Image width
 * @returns {Object} - Object with values for each band
 */
export function getPixelValue(imageData, row, col, width) {
  const index = row * width + col;
  const values = {};

  Object.keys(imageData).forEach(bandKey => {
    values[bandKey] = imageData[bandKey][index];
  });

  return values;
}

/**
 * Convert geographic coordinates to pixel coordinates
 * @param {number} x - X coordinate (longitude or easting)
 * @param {number} y - Y coordinate (latitude or northing)
 * @param {Array} geoTransform - Geo transform array
 * @returns {Object} - { row, col } pixel coordinates
 */
export function geoToPixel(x, y, geoTransform) {
  const [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight] = geoTransform;

  // Handle rotation if present (rare)
  if (rotationX !== 0 || rotationY !== 0) {
    throw new Error('Rotated images not yet supported');
  }

  const col = Math.floor((x - originX) / pixelWidth);
  const row = Math.floor((y - originY) / pixelHeight);

  return { row, col };
}

/**
 * Convert pixel coordinates to geographic coordinates
 * @param {number} row - Row index
 * @param {number} col - Column index
 * @param {Array} geoTransform - Geo transform array
 * @returns {Object} - { x, y } geographic coordinates
 */
export function pixelToGeo(row, col, geoTransform) {
  const [originX, pixelWidth, rotationX, originY, rotationY, pixelHeight] = geoTransform;

  // Handle rotation if present (rare)
  if (rotationX !== 0 || rotationY !== 0) {
    throw new Error('Rotated images not yet supported');
  }

  const x = originX + col * pixelWidth + row * rotationX;
  const y = originY + col * rotationY + row * pixelHeight;

  return { x, y };
}

/**
 * Extract a window of pixels from image data
 * @param {Object} imageData - Image data object
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} window - Window specification { rowStart, rowEnd, colStart, colEnd }
 * @returns {Object} - Windowed image data
 */
export function extractWindow(imageData, width, height, window) {
  const { rowStart, rowEnd, colStart, colEnd } = window;

  // Validate window bounds
  if (rowStart < 0 || rowEnd > height || colStart < 0 || colEnd > width) {
    throw new Error('Window bounds exceed image dimensions');
  }

  const windowWidth = colEnd - colStart;
  const windowHeight = rowEnd - rowStart;
  const windowData = {};

  Object.keys(imageData).forEach(bandKey => {
    const bandArray = [];

    for (let r = rowStart; r < rowEnd; r++) {
      for (let c = colStart; c < colEnd; c++) {
        const index = r * width + c;
        bandArray.push(imageData[bandKey][index]);
      }
    }

    windowData[bandKey] = bandArray;
  });

  return {
    data: windowData,
    shape: [windowHeight, windowWidth, Object.keys(imageData).length]
  };
}
