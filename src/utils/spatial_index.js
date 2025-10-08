/**
 * Spatial Index Builder
 *
 * Build and query R-tree spatial index for efficient polygon lookups
 * Uses RBush library for R-tree implementation
 */

import RBush from 'rbush';

/**
 * Build spatial index from polygon features
 *
 * @param {Array<Object>} polygons - Array of GeoJSON polygon features
 * @returns {Object} - Spatial index with methods
 */
export function buildSpatialIndex(polygons) {
  const tree = new RBush();

  // Convert polygons to R-tree items
  const items = polygons.map(polygon => {
    const bounds = calculateBounds(polygon);

    return {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      polygon: polygon // Store reference to original polygon
    };
  });

  // Bulk load for better performance
  tree.load(items);

  // Create index object with utility methods
  return {
    data: tree,
    polygons: polygons,
    count: polygons.length
  };
}

/**
 * Calculate bounding box for polygon
 *
 * @param {Object} polygon - GeoJSON polygon feature
 * @returns {Object} - Bounds {minX, minY, maxX, maxY}
 * @private
 */
function calculateBounds(polygon) {
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
 * Query spatial index by bounding box
 *
 * @param {Object} index - Spatial index from buildSpatialIndex
 * @param {Object} bounds - Query bounds {minX, minY, maxX, maxY}
 * @returns {Array<Object>} - Array of matching polygons
 */
export function queryIndex(index, bounds) {
  const results = index.data.search({
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY
  });

  // Extract original polygons from results
  return results.map(item => item.polygon);
}

/**
 * Get polygon by ID from index
 *
 * @param {Object} index - Spatial index
 * @param {number|string} id - Polygon ID
 * @returns {Object|null} - Polygon feature or null if not found
 */
export function getPolygonById(index, id) {
  return index.polygons.find(p => p.id === id) || null;
}

/**
 * Get polygon by index position
 *
 * @param {Object} index - Spatial index
 * @param {number} idx - Array index
 * @returns {Object|null} - Polygon feature or null if out of range
 */
export function getPolygonByIndex(index, idx) {
  if (idx < 0 || idx >= index.polygons.length) {
    return null;
  }
  return index.polygons[idx];
}

/**
 * Find nearest polygon to a point
 *
 * @param {Object} index - Spatial index
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} maxDistance - Maximum search distance
 * @returns {Object|null} - Nearest polygon or null
 */
export function findNearestPolygon(index, x, y, maxDistance = Infinity) {
  // Query area around point
  const queryBounds = {
    minX: x - maxDistance,
    maxX: x + maxDistance,
    minY: y - maxDistance,
    maxY: y + maxDistance
  };

  const candidates = queryIndex(index, queryBounds);

  if (candidates.length === 0) {
    return null;
  }

  // Find closest polygon by calculating distance to centroid
  let nearest = null;
  let minDist = Infinity;

  candidates.forEach(polygon => {
    const centroid = calculateCentroid(polygon);
    const dist = calculateDistance(x, y, centroid.x, centroid.y);

    if (dist < minDist) {
      minDist = dist;
      nearest = polygon;
    }
  });

  if (minDist > maxDistance) {
    return null;
  }

  return {
    polygon: nearest,
    distance: minDist
  };
}

/**
 * Calculate polygon centroid (simple average of coordinates)
 *
 * @param {Object} polygon - GeoJSON polygon
 * @returns {{x: number, y: number}} - Centroid coordinates
 * @private
 */
function calculateCentroid(polygon) {
  const coordinates = polygon.geometry.coordinates[0];
  const points = coordinates.slice(0, -1); // Exclude closing point

  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);

  return {
    x: sumX / points.length,
    y: sumY / points.length
  };
}

/**
 * Calculate distance between two points
 *
 * @param {number} x1 - First point X
 * @param {number} y1 - First point Y
 * @param {number} x2 - Second point X
 * @param {number} y2 - Second point Y
 * @returns {number} - Euclidean distance
 * @private
 */
function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get total bounds of all polygons in index
 *
 * @param {Object} index - Spatial index
 * @returns {Object} - Total bounds {minX, minY, maxX, maxY}
 */
export function getTotalBounds(index) {
  if (index.polygons.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  index.polygons.forEach(polygon => {
    const bounds = calculateBounds(polygon);
    minX = Math.min(minX, bounds.minX);
    maxX = Math.max(maxX, bounds.maxX);
    minY = Math.min(minY, bounds.minY);
    maxY = Math.max(maxY, bounds.maxY);
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Check if point is within any polygon (bounding box test only)
 *
 * @param {Object} index - Spatial index
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Array<Object>} - Array of polygons whose bounds contain point
 */
export function findPolygonsContainingPoint(index, x, y) {
  const queryBounds = {
    minX: x,
    maxX: x,
    minY: y,
    maxY: y
  };

  return queryIndex(index, queryBounds);
}

/**
 * Update index when polygons are added
 *
 * @param {Object} index - Spatial index
 * @param {Object} polygon - New polygon to add
 * @returns {Object} - Updated index
 */
export function addPolygonToIndex(index, polygon) {
  const bounds = calculateBounds(polygon);

  const item = {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    polygon: polygon
  };

  index.data.insert(item);
  index.polygons.push(polygon);
  index.count++;

  return index;
}

/**
 * Remove polygon from index
 *
 * @param {Object} index - Spatial index
 * @param {number|string} id - Polygon ID to remove
 * @returns {Object} - Updated index
 */
export function removePolygonFromIndex(index, id) {
  const polygonIdx = index.polygons.findIndex(p => p.id === id);

  if (polygonIdx === -1) {
    return index; // Not found
  }

  const polygon = index.polygons[polygonIdx];
  const bounds = calculateBounds(polygon);

  // Find and remove from R-tree
  const item = {
    minX: bounds.minX,
    minY: bounds.minY,
    maxX: bounds.maxX,
    maxY: bounds.maxY,
    polygon: polygon
  };

  index.data.remove(item, (a, b) => a.polygon.id === b.polygon.id);

  // Remove from polygons array
  index.polygons.splice(polygonIdx, 1);
  index.count--;

  return index;
}

/**
 * Get index statistics
 *
 * @param {Object} index - Spatial index
 * @returns {Object} - Statistics about the index
 */
export function getIndexStats(index) {
  const totalBounds = getTotalBounds(index);
  const area = (totalBounds.maxX - totalBounds.minX) *
               (totalBounds.maxY - totalBounds.minY);

  return {
    polygonCount: index.count,
    totalBounds: totalBounds,
    totalArea: area,
    treeHeight: index.data.data ? calculateTreeHeight(index.data.data) : 0
  };
}

/**
 * Calculate R-tree height (for performance analysis)
 *
 * @param {Object} node - R-tree node
 * @returns {number} - Tree height
 * @private
 */
function calculateTreeHeight(node) {
  if (!node.children || node.children.length === 0) {
    return 1;
  }

  const childHeights = node.children.map(child => calculateTreeHeight(child));
  return 1 + Math.max(...childHeights);
}

/**
 * Clear and rebuild index
 *
 * @param {Object} index - Spatial index
 * @returns {Object} - Rebuilt index
 */
export function rebuildIndex(index) {
  return buildSpatialIndex(index.polygons);
}
