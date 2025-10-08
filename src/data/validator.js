/**
 * Data Validator
 *
 * Validates consistency across multiple datasets
 * Checks projection alignment, dimension compatibility, and spatial alignment
 */

/**
 * Extract EPSG code from various projection string formats
 * @param {string} projection - Projection string
 * @returns {number|null} - EPSG code or null if not found
 */
function extractEpsgCode(projection) {
  if (!projection) return null;

  // Handle various formats:
  // "EPSG:32610"
  // "32610"
  // "urn:ogc:def:crs:EPSG::32610"

  const epsgMatch = projection.match(/EPSG[:\s]*(\d+)/i) ||
                    projection.match(/^(\d{4,5})$/) ||
                    projection.match(/::(\d+)$/);

  return epsgMatch ? parseInt(epsgMatch[1]) : null;
}

/**
 * Validate consistency across all loaded datasets
 *
 * @param {Object} datasets - Object containing all loaded datasets
 * @param {Object} datasets.numpy_stack - NumPy stack data
 * @param {Object} datasets.shapefile - Shapefile data
 * @param {Array} datasets.source_images - Source image data (optional)
 * @param {Object} datasets.predictions - Prediction data (optional)
 * @returns {Object} - Validation result { valid, errors, warnings, report }
 */
export function validateDatasets(datasets) {
  const errors = [];
  const warnings = [];
  const report = {
    projectionCheck: {},
    dimensionCheck: {},
    spatialAlignment: {},
    dataQuality: {}
  };

  // Extract datasets
  const { numpy_stack, shapefile, source_images, predictions } = datasets;

  // 1. Validate projection consistency
  if (numpy_stack && shapefile) {
    const stackEpsg = numpy_stack.metadata?.epsg;
    const shpProjection = shapefile.projection;
    const shpEpsg = extractEpsgCode(shpProjection);

    report.projectionCheck.numpy_epsg = stackEpsg;
    report.projectionCheck.shapefile_epsg = shpEpsg;
    report.projectionCheck.shapefile_projection = shpProjection;

    if (stackEpsg && shpEpsg && stackEpsg !== shpEpsg) {
      errors.push(
        `Projection mismatch: NumPy stack uses EPSG:${stackEpsg}, ` +
        `shapefile uses EPSG:${shpEpsg}`
      );
    } else if (!shpEpsg) {
      warnings.push('Could not determine shapefile projection - validation skipped');
    }
  }

  // Validate source images projection (if present)
  if (numpy_stack && source_images && Array.isArray(source_images)) {
    const stackEpsg = numpy_stack.metadata?.epsg;

    source_images.forEach((img, index) => {
      const imgProjection = img.metadata?.projection;
      const imgEpsg = extractEpsgCode(imgProjection);

      if (stackEpsg && imgEpsg && stackEpsg !== imgEpsg) {
        errors.push(
          `Projection mismatch in source image ${index}: ` +
          `Expected EPSG:${stackEpsg}, got EPSG:${imgEpsg}`
        );
      }
    });
  }

  // 2. Validate dimension compatibility
  if (numpy_stack && predictions) {
    const stackShape = numpy_stack.metadata?.shape;
    const predShape = predictions.metadata?.shape;

    report.dimensionCheck.numpy_shape = stackShape;
    report.dimensionCheck.prediction_shape = predShape;

    if (stackShape && predShape) {
      // For 4D stack [time, rows, cols, bands] and 3D predictions [rows, cols, classes]
      // rows and cols must match
      if (stackShape.length >= 3 && predShape.length >= 2) {
        const stackRows = stackShape[1];
        const stackCols = stackShape[2];
        const predRows = predShape[0];
        const predCols = predShape[1];

        if (stackRows !== predRows || stackCols !== predCols) {
          errors.push(
            `Dimension mismatch: NumPy stack has shape (${stackRows}, ${stackCols}), ` +
            `predictions have shape (${predRows}, ${predCols})`
          );
        }
      }
    }
  }

  // 3. Validate spatial alignment
  if (numpy_stack && shapefile) {
    const stackMeta = numpy_stack.metadata;
    const shpBounds = shapefile.bounds;

    if (stackMeta?.origin && stackMeta?.shape && shpBounds) {
      // Calculate NumPy stack bounds
      const [originX, originY] = stackMeta.origin;
      const pixelSize = stackMeta.pixelSize || 10; // Default if not specified
      const [, rows, cols] = stackMeta.shape;

      const stackBounds = {
        minX: originX,
        minY: originY,
        maxX: originX + cols * pixelSize,
        maxY: originY + rows * pixelSize
      };

      report.spatialAlignment.numpy_bounds = stackBounds;
      report.spatialAlignment.shapefile_bounds = shpBounds;

      // Check if shapefile features are within or overlap NumPy stack bounds
      const hasOverlap = !(
        shpBounds.maxX < stackBounds.minX ||
        shpBounds.minX > stackBounds.maxX ||
        shpBounds.maxY < stackBounds.minY ||
        shpBounds.minY > stackBounds.maxY
      );

      if (!hasOverlap) {
        errors.push(
          'No spatial overlap between NumPy stack and shapefile features. ' +
          'Check coordinate systems and bounds.'
        );
      } else {
        // Check if shapefile is fully contained
        const fullyContained = (
          shpBounds.minX >= stackBounds.minX &&
          shpBounds.maxX <= stackBounds.maxX &&
          shpBounds.minY >= stackBounds.minY &&
          shpBounds.maxY <= stackBounds.maxY
        );

        if (!fullyContained) {
          warnings.push(
            'Some shapefile features may extend beyond NumPy stack bounds'
          );
        }

        report.spatialAlignment.overlap = hasOverlap;
        report.spatialAlignment.fully_contained = fullyContained;
      }
    }
  }

  // 4. Data quality checks
  if (numpy_stack?.metadata?.dataRange) {
    const { min, max } = numpy_stack.metadata.dataRange;
    report.dataQuality.numpy_range = { min, max };

    if (min < 0 || max > 1) {
      warnings.push(
        `NumPy data range [${min.toFixed(4)}, ${max.toFixed(4)}] ` +
        'is outside expected [0, 1] range'
      );
    }
  }

  if (predictions?.metadata?.dataRange) {
    const { min, max } = predictions.metadata.dataRange;
    report.dataQuality.prediction_range = { min, max };

    if (min < 0 || max > 1) {
      errors.push(
        `Prediction data range [${min.toFixed(4)}, ${max.toFixed(4)}] ` +
        'is invalid for probabilities (must be 0-1)'
      );
    }
  }

  if (shapefile?.count !== undefined) {
    report.dataQuality.shapefile_feature_count = shapefile.count;

    if (shapefile.count === 0) {
      warnings.push('Shapefile contains no features');
    }
  }

  // Compile validation result
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    report
  };
}

/**
 * Validate pixel alignment between two rasters
 * @param {Object} raster1 - First raster metadata
 * @param {Object} raster2 - Second raster metadata
 * @returns {Object} - { aligned, offset, message }
 */
export function validatePixelAlignment(raster1, raster2) {
  // Check if both rasters have same pixel size
  const pixelSize1 = raster1.pixelSize || raster1.pixel_size;
  const pixelSize2 = raster2.pixelSize || raster2.pixel_size;

  if (Math.abs(pixelSize1 - pixelSize2) > 0.0001) {
    return {
      aligned: false,
      offset: null,
      message: `Pixel size mismatch: ${pixelSize1} vs ${pixelSize2}`
    };
  }

  // Check origin alignment
  const origin1 = raster1.origin;
  const origin2 = raster2.origin;

  if (!origin1 || !origin2) {
    return {
      aligned: false,
      offset: null,
      message: 'Missing origin information'
    };
  }

  // Calculate offset in pixels
  const offsetX = (origin2[0] - origin1[0]) / pixelSize1;
  const offsetY = (origin2[1] - origin1[1]) / pixelSize1;

  // Check if offset is integer (aligned to pixel grid)
  const isAligned = (
    Math.abs(offsetX - Math.round(offsetX)) < 0.0001 &&
    Math.abs(offsetY - Math.round(offsetY)) < 0.0001
  );

  return {
    aligned: isAligned,
    offset: { x: offsetX, y: offsetY },
    message: isAligned
      ? 'Rasters are pixel-aligned'
      : `Rasters have sub-pixel offset: (${offsetX.toFixed(4)}, ${offsetY.toFixed(4)})`
  };
}

/**
 * Check if a point is within bounds
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} bounds - Bounding box { minX, minY, maxX, maxY }
 * @returns {boolean} - True if point is within bounds
 */
export function isPointInBounds(x, y, bounds) {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
}

/**
 * Calculate intersection of two bounding boxes
 * @param {Object} bounds1 - First bounding box
 * @param {Object} bounds2 - Second bounding box
 * @returns {Object|null} - Intersection bounds or null if no overlap
 */
export function calculateIntersection(bounds1, bounds2) {
  const minX = Math.max(bounds1.minX, bounds2.minX);
  const minY = Math.max(bounds1.minY, bounds2.minY);
  const maxX = Math.min(bounds1.maxX, bounds2.maxX);
  const maxY = Math.min(bounds1.maxY, bounds2.maxY);

  // Check if there's overlap
  if (minX >= maxX || minY >= maxY) {
    return null; // No intersection
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Generate validation summary report
 * @param {Object} validationResult - Result from validateDatasets
 * @returns {string} - Formatted text report
 */
export function generateValidationReport(validationResult) {
  const { valid, errors, warnings, report } = validationResult;

  let output = '=== Data Validation Report ===\n\n';

  // Overall status
  output += `Status: ${valid ? '✓ PASSED' : '✗ FAILED'}\n`;
  output += `Errors: ${errors.length}\n`;
  output += `Warnings: ${warnings.length}\n\n`;

  // Errors
  if (errors.length > 0) {
    output += 'ERRORS:\n';
    errors.forEach((err, i) => {
      output += `  ${i + 1}. ${err}\n`;
    });
    output += '\n';
  }

  // Warnings
  if (warnings.length > 0) {
    output += 'WARNINGS:\n';
    warnings.forEach((warn, i) => {
      output += `  ${i + 1}. ${warn}\n`;
    });
    output += '\n';
  }

  // Detailed report
  output += 'DETAILED CHECKS:\n\n';

  // Projection check
  if (report.projectionCheck.numpy_epsg) {
    output += `Projection:\n`;
    output += `  NumPy Stack: EPSG:${report.projectionCheck.numpy_epsg}\n`;
    output += `  Shapefile: ${report.projectionCheck.shapefile_projection}\n\n`;
  }

  // Dimension check
  if (report.dimensionCheck.numpy_shape) {
    output += `Dimensions:\n`;
    output += `  NumPy Stack: [${report.dimensionCheck.numpy_shape.join(', ')}]\n`;
    if (report.dimensionCheck.prediction_shape) {
      output += `  Predictions: [${report.dimensionCheck.prediction_shape.join(', ')}]\n`;
    }
    output += '\n';
  }

  // Spatial alignment
  if (report.spatialAlignment.numpy_bounds) {
    output += `Spatial Alignment:\n`;
    const nb = report.spatialAlignment.numpy_bounds;
    output += `  NumPy Bounds: [${nb.minX}, ${nb.minY}] to [${nb.maxX}, ${nb.maxY}]\n`;
    if (report.spatialAlignment.shapefile_bounds) {
      const sb = report.spatialAlignment.shapefile_bounds;
      output += `  Shapefile Bounds: [${sb.minX}, ${sb.minY}] to [${sb.maxX}, ${sb.maxY}]\n`;
    }
    if (report.spatialAlignment.overlap !== undefined) {
      output += `  Overlap: ${report.spatialAlignment.overlap ? 'Yes' : 'No'}\n`;
      output += `  Fully Contained: ${report.spatialAlignment.fully_contained ? 'Yes' : 'No'}\n`;
    }
    output += '\n';
  }

  output += '=== End of Report ===\n';

  return output;
}
