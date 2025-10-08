/**
 * Shapefile Loader
 *
 * Loads shapefile data (including GeoJSON format)
 * Extracts geometries, attributes, and projection information
 */

import shapefile from 'shapefile';
import { readFileSync } from 'fs';

/**
 * Load shapefile or GeoJSON file
 *
 * @param {string} filepath - Path to shapefile (.shp) or GeoJSON (.geojson, .json)
 * @param {Object} options - Loading options
 * @param {string} options.idField - Field name to use as feature ID
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} - Object with features array and projection info
 */
export async function loadShapefile(filepath, options = {}) {
  const {
    idField = 'FID',
    onProgress = null
  } = options;

  if (onProgress) {
    onProgress({ stage: 'reading', progress: 0, message: 'Reading shapefile...' });
  }

  try {
    // Check file extension to determine format
    const isGeoJSON = filepath.endsWith('.geojson') || filepath.endsWith('.json');

    let features = [];
    let projection = null;

    if (isGeoJSON) {
      // Load GeoJSON file
      const geojsonData = JSON.parse(readFileSync(filepath, 'utf8'));

      // Extract projection from CRS
      if (geojsonData.crs && geojsonData.crs.properties) {
        projection = geojsonData.crs.properties.name;
      }

      if (onProgress) {
        onProgress({ stage: 'parsing', progress: 0.3, message: 'Parsing features...' });
      }

      // Process features
      if (geojsonData.type === 'FeatureCollection') {
        features = geojsonData.features;
      } else if (geojsonData.type === 'Feature') {
        features = [geojsonData];
      } else {
        throw new Error('Invalid GeoJSON: expected FeatureCollection or Feature');
      }

    } else {
      // Load shapefile using shapefile library
      if (onProgress) {
        onProgress({ stage: 'parsing', progress: 0.3, message: 'Reading shapefile...' });
      }

      const source = await shapefile.open(filepath);
      features = [];

      let result = await source.read();
      let count = 0;

      while (!result.done) {
        if (result.value) {
          features.push(result.value);
          count++;

          if (onProgress && count % 100 === 0) {
            onProgress({
              stage: 'loading',
              progress: 0.3 + (count / 1000) * 0.4, // Rough progress estimate
              message: `Loaded ${count} features...`
            });
          }
        }
        result = await source.read();
      }

      // Try to read projection from .prj file
      try {
        const prjPath = filepath.replace(/\.shp$/, '.prj');
        projection = readFileSync(prjPath, 'utf8').trim();
      } catch (err) {
        console.warn('Could not read .prj file, projection information unavailable');
        projection = 'Unknown';
      }
    }

    if (onProgress) {
      onProgress({ stage: 'validating', progress: 0.7, message: 'Validating geometries...' });
    }

    // Validate and process features
    const processedFeatures = features.map((feature, index) => {
      // Ensure feature has required structure
      if (!feature.geometry) {
        throw new Error(`Feature at index ${index} is missing geometry`);
      }

      // Ensure properties exist
      if (!feature.properties) {
        feature.properties = {};
      }

      // Extract or assign ID
      let featureId;
      if (idField && feature.properties[idField] !== undefined) {
        featureId = feature.properties[idField];
      } else if (feature.id !== undefined) {
        featureId = feature.id;
      } else {
        featureId = index;
        if (idField && feature.properties[idField] === undefined) {
          console.warn(`Feature ${index}: ID field '${idField}' not found, using index`);
        }
      }

      return {
        id: featureId,
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.properties
      };
    });

    // Validate geometries
    validateGeometries(processedFeatures);

    if (onProgress) {
      onProgress({ stage: 'complete', progress: 1.0, message: 'Complete' });
    }

    return {
      features: processedFeatures,
      projection: projection || 'Unknown',
      count: processedFeatures.length,
      bounds: calculateBounds(processedFeatures)
    };

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Shapefile not found: ${filepath}`);
    }
    throw error;
  }
}

/**
 * Validate polygon geometries
 * @param {Array} features - Array of features
 * @throws {Error} - If geometries are invalid
 */
function validateGeometries(features) {
  features.forEach((feature, index) => {
    const geom = feature.geometry;

    if (!geom || !geom.type) {
      throw new Error(`Feature ${index}: Invalid geometry`);
    }

    // For now, we primarily support Polygons and MultiPolygons
    if (geom.type === 'Polygon') {
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
        throw new Error(`Feature ${index}: Invalid Polygon coordinates`);
      }

      // Validate exterior ring
      const exteriorRing = geom.coordinates[0];
      if (!Array.isArray(exteriorRing) || exteriorRing.length < 4) {
        throw new Error(`Feature ${index}: Polygon must have at least 4 points (including closing point)`);
      }

      // Check if polygon is closed
      const first = exteriorRing[0];
      const last = exteriorRing[exteriorRing.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error(`Feature ${index}: Polygon is not closed`);
      }

    } else if (geom.type === 'MultiPolygon') {
      if (!Array.isArray(geom.coordinates) || geom.coordinates.length === 0) {
        throw new Error(`Feature ${index}: Invalid MultiPolygon coordinates`);
      }
    }
  });
}

/**
 * Calculate bounding box for all features
 * @param {Array} features - Array of features
 * @returns {Object} - Bounding box { minX, minY, maxX, maxY }
 */
function calculateBounds(features) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  features.forEach(feature => {
    const coords = extractCoordinates(feature.geometry);
    coords.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });
  });

  return {
    minX: isFinite(minX) ? minX : null,
    minY: isFinite(minY) ? minY : null,
    maxX: isFinite(maxX) ? maxX : null,
    maxY: isFinite(maxY) ? maxY : null
  };
}

/**
 * Extract all coordinates from a geometry
 * @param {Object} geometry - GeoJSON geometry
 * @returns {Array} - Array of [x, y] coordinate pairs
 */
function extractCoordinates(geometry) {
  const coords = [];

  function recurse(geom) {
    if (geom.type === 'Polygon') {
      geom.coordinates.forEach(ring => {
        ring.forEach(coord => coords.push(coord));
      });
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(polygon => {
        polygon.forEach(ring => {
          ring.forEach(coord => coords.push(coord));
        });
      });
    } else if (geom.type === 'Point') {
      coords.push(geom.coordinates);
    } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
      geom.coordinates.forEach(coord => coords.push(coord));
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates.forEach(line => {
        line.forEach(coord => coords.push(coord));
      });
    }
  }

  recurse(geometry);
  return coords;
}

/**
 * Filter features by bounding box
 * @param {Array} features - Array of features
 * @param {Object} bbox - Bounding box { minX, minY, maxX, maxY }
 * @returns {Array} - Filtered features
 */
export function filterByBounds(features, bbox) {
  return features.filter(feature => {
    const featureBounds = calculateBounds([feature]);

    // Check if feature bounds intersect with query bounds
    return !(
      featureBounds.maxX < bbox.minX ||
      featureBounds.minX > bbox.maxX ||
      featureBounds.maxY < bbox.minY ||
      featureBounds.minY > bbox.maxY
    );
  });
}

/**
 * Get feature by ID
 * @param {Array} features - Array of features
 * @param {number|string} id - Feature ID
 * @returns {Object|null} - Feature or null if not found
 */
export function getFeatureById(features, id) {
  return features.find(f => f.id === id) || null;
}
