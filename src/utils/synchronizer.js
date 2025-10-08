/**
 * Data Synchronization Utilities
 *
 * Verify spatial alignment and compatibility across data sources
 * Generate alignment reports and cache transformation parameters
 */

import { transformBounds, getArrayExtent, isPointInBounds } from './coordinates.js';

/**
 * Verify all data sources cover the same area
 *
 * @param {Object} datasets - All loaded datasets
 * @param {Object} config - Configuration
 * @returns {Object} - Synchronization result
 */
export function verifySpatialCoverage(datasets, config) {
  const { numpy_stack, shapefile, source_images } = datasets;
  const errors = [];
  const warnings = [];

  // Get array extent
  const arrayMeta = numpy_stack.metadata;
  const arrayExtent = getArrayExtent(
    arrayMeta.shape[1], // rows
    arrayMeta.shape[2], // cols
    arrayMeta.origin,
    arrayMeta.pixelSize
  );

  // Check shapefile coverage
  if (shapefile) {
    const shpBounds = shapefile.bounds;

    // Check if shapefile is within array bounds
    const shpWithinArray = (
      shpBounds.minX >= arrayExtent.minX &&
      shpBounds.maxX <= arrayExtent.maxX &&
      shpBounds.minY >= arrayExtent.minY &&
      shpBounds.maxY <= arrayExtent.maxY
    );

    if (!shpWithinArray) {
      warnings.push(
        'Some shapefile features extend beyond array bounds. ' +
        'This may cause issues when extracting windows.'
      );
    }

    // Check for overlap
    const hasOverlap = !(
      shpBounds.maxX < arrayExtent.minX ||
      shpBounds.minX > arrayExtent.maxX ||
      shpBounds.maxY < arrayExtent.minY ||
      shpBounds.minY > arrayExtent.maxY
    );

    if (!hasOverlap) {
      errors.push('No spatial overlap between array and shapefile');
    }
  }

  // Check source images coverage (if present)
  if (source_images && Array.isArray(source_images)) {
    source_images.forEach((img, idx) => {
      if (img.metadata && img.metadata.geoTransform) {
        const imgExtent = {
          minX: img.metadata.geoTransform[0],
          maxX: img.metadata.geoTransform[0] + img.metadata.width * img.metadata.geoTransform[1],
          minY: img.metadata.geoTransform[3] + img.metadata.height * img.metadata.geoTransform[5],
          maxY: img.metadata.geoTransform[3]
        };

        const imgCoversArray = (
          imgExtent.minX <= arrayExtent.minX &&
          imgExtent.maxX >= arrayExtent.maxX &&
          imgExtent.minY <= arrayExtent.minY &&
          imgExtent.maxY >= arrayExtent.maxY
        );

        if (!imgCoversArray) {
          warnings.push(`Source image ${idx} does not fully cover array extent`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    arrayExtent
  };
}

/**
 * Check resolution compatibility across datasets
 *
 * @param {Object} datasets - All loaded datasets
 * @returns {Object} - Resolution compatibility result
 */
export function checkResolutionCompatibility(datasets) {
  const { numpy_stack, source_images, predictions } = datasets;
  const errors = [];
  const warnings = [];

  const arrayPixelSize = numpy_stack.metadata.pixelSize;
  const arrayShape = numpy_stack.metadata.shape;

  // Check predictions resolution
  if (predictions) {
    const predShape = predictions.metadata.shape;

    if (predShape[0] !== arrayShape[1] || predShape[1] !== arrayShape[2]) {
      errors.push(
        `Prediction array dimensions (${predShape[0]}×${predShape[1]}) ` +
        `do not match numpy array (${arrayShape[1]}×${arrayShape[2]})`
      );
    }
  }

  // Check source image resolutions
  if (source_images && Array.isArray(source_images)) {
    source_images.forEach((img, idx) => {
      if (img.metadata && img.metadata.geoTransform) {
        const imgPixelSize = Math.abs(img.metadata.geoTransform[1]);

        // Allow some tolerance (within 10%)
        const tolerance = arrayPixelSize * 0.1;
        if (Math.abs(imgPixelSize - arrayPixelSize) > tolerance) {
          warnings.push(
            `Source image ${idx} pixel size (${imgPixelSize}m) ` +
            `differs from array pixel size (${arrayPixelSize}m)`
          );
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Align data to common grid
 *
 * @param {Object} datasets - All loaded datasets
 * @param {Object} referenceGrid - Reference grid specification
 * @returns {Object} - Alignment parameters
 */
export function alignToCommonGrid(datasets, referenceGrid) {
  const { origin, pixelSize, epsg } = referenceGrid;

  const alignmentParams = {
    origin,
    pixelSize,
    epsg,
    transformations: {}
  };

  // For each dataset, calculate transformation to reference grid
  Object.keys(datasets).forEach(key => {
    const dataset = datasets[key];

    if (dataset.metadata) {
      const datasetOrigin = dataset.metadata.origin;
      const datasetPixelSize = dataset.metadata.pixelSize;

      // Calculate offset from reference
      const offsetX = datasetOrigin[0] - origin[0];
      const offsetY = datasetOrigin[1] - origin[1];

      const offsetRows = Math.round(offsetY / pixelSize);
      const offsetCols = Math.round(offsetX / pixelSize);

      alignmentParams.transformations[key] = {
        offsetRows,
        offsetCols,
        resampleFactor: datasetPixelSize / pixelSize,
        aligned: (Math.abs(offsetRows * pixelSize - offsetY) < 0.001 &&
                  Math.abs(offsetCols * pixelSize - offsetX) < 0.001)
      };
    }
  });

  return alignmentParams;
}

/**
 * Generate alignment report
 *
 * @param {Object} datasets - All loaded datasets
 * @param {Object} config - Configuration
 * @returns {Object} - Detailed alignment report
 */
export function generateAlignmentReport(datasets, config) {
  const coverage = verifySpatialCoverage(datasets, config);
  const resolution = checkResolutionCompatibility(datasets);

  const report = {
    timestamp: new Date().toISOString(),
    coverage,
    resolution,
    summary: {
      spatialCoverageValid: coverage.valid,
      resolutionCompatible: resolution.valid,
      totalErrors: coverage.errors.length + resolution.errors.length,
      totalWarnings: coverage.warnings.length + resolution.warnings.length
    }
  };

  // Add grid information
  if (datasets.numpy_stack) {
    const meta = datasets.numpy_stack.metadata;
    report.referenceGrid = {
      origin: meta.origin,
      pixelSize: meta.pixelSize,
      epsg: meta.epsg,
      shape: meta.shape
    };
  }

  return report;
}

/**
 * Cache transformation parameters for efficient access
 *
 * @param {Object} datasets - All loaded datasets
 * @returns {Object} - Cached transformation parameters
 */
export function cacheTransformParams(datasets) {
  const cache = {
    transformations: {},
    grids: {},
    projections: {}
  };

  // Cache numpy stack parameters
  if (datasets.numpy_stack) {
    const meta = datasets.numpy_stack.metadata;
    cache.grids.numpy_stack = {
      origin: meta.origin,
      pixelSize: meta.pixelSize,
      shape: meta.shape,
      epsg: meta.epsg
    };
    cache.projections.numpy_stack = meta.epsg;
  }

  // Cache shapefile parameters
  if (datasets.shapefile) {
    cache.projections.shapefile = datasets.shapefile.projection;
    cache.grids.shapefile = {
      bounds: datasets.shapefile.bounds
    };
  }

  // Cache source image parameters
  if (datasets.source_images && Array.isArray(datasets.source_images)) {
    datasets.source_images.forEach((img, idx) => {
      if (img.metadata) {
        cache.grids[`source_image_${idx}`] = {
          geoTransform: img.metadata.geoTransform,
          projection: img.metadata.projection,
          width: img.metadata.width,
          height: img.metadata.height
        };
      }
    });
  }

  return cache;
}

/**
 * Calculate overlap percentage between two bounds
 *
 * @param {Object} bounds1 - First bounds
 * @param {Object} bounds2 - Second bounds
 * @returns {number} - Overlap percentage (0-100)
 */
export function calculateOverlapPercentage(bounds1, bounds2) {
  // Calculate intersection
  const intersectMinX = Math.max(bounds1.minX, bounds2.minX);
  const intersectMinY = Math.max(bounds1.minY, bounds2.minY);
  const intersectMaxX = Math.min(bounds1.maxX, bounds2.maxX);
  const intersectMaxY = Math.min(bounds1.maxY, bounds2.maxY);

  // Check if there is overlap
  if (intersectMinX >= intersectMaxX || intersectMinY >= intersectMaxY) {
    return 0; // No overlap
  }

  const intersectArea = (intersectMaxX - intersectMinX) * (intersectMaxY - intersectMinY);

  // Calculate area of first bounds
  const bounds1Area = (bounds1.maxX - bounds1.minX) * (bounds1.maxY - bounds1.minY);

  return (intersectArea / bounds1Area) * 100;
}

/**
 * Verify pixel alignment between datasets
 *
 * @param {Object} grid1 - First grid specification
 * @param {Object} grid2 - Second grid specification
 * @param {number} tolerance - Tolerance in map units
 * @returns {Object} - Alignment status
 */
export function verifyPixelAlignment(grid1, grid2, tolerance = 0.001) {
  const offsetX = grid2.origin[0] - grid1.origin[0];
  const offsetY = grid2.origin[1] - grid1.origin[1];

  // Check if offset is a multiple of pixel size
  const offsetInPixelsX = offsetX / grid1.pixelSize;
  const offsetInPixelsY = offsetY / grid1.pixelSize;

  const alignedX = Math.abs(offsetInPixelsX - Math.round(offsetInPixelsX)) * grid1.pixelSize < tolerance;
  const alignedY = Math.abs(offsetInPixelsY - Math.round(offsetInPixelsY)) * grid1.pixelSize < tolerance;

  return {
    aligned: alignedX && alignedY,
    offsetPixels: {
      x: Math.round(offsetInPixelsX),
      y: Math.round(offsetInPixelsY)
    },
    offsetMapUnits: {
      x: offsetX,
      y: offsetY
    },
    pixelSizeMatch: Math.abs(grid1.pixelSize - grid2.pixelSize) < tolerance
  };
}

/**
 * Get synchronization recommendations
 *
 * @param {Object} alignmentReport - Alignment report from generateAlignmentReport
 * @returns {Array<string>} - Array of recommendations
 */
export function getRecommendations(alignmentReport) {
  const recommendations = [];

  if (!alignmentReport.coverage.valid) {
    recommendations.push(
      'Spatial coverage issues detected. Consider cropping datasets to common extent.'
    );
  }

  if (!alignmentReport.resolution.valid) {
    recommendations.push(
      'Resolution mismatch detected. Consider resampling datasets to common resolution.'
    );
  }

  if (alignmentReport.coverage.warnings.length > 0) {
    recommendations.push(
      'Some datasets extend beyond reference extent. Window extraction may fail for boundary features.'
    );
  }

  if (alignmentReport.resolution.warnings.length > 0) {
    recommendations.push(
      'Pixel size differences detected. Results may not align perfectly across datasets.'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('All datasets appear to be properly aligned and synchronized.');
  }

  return recommendations;
}
