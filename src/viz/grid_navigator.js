/**
 * Grid Navigator
 *
 * Manages navigation through a grid-based sampling system
 * with pseudo-random tile selection and polygon presence detection
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * Seeded pseudo-random number generator (Mulberry32)
 */
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * GridNavigator class
 */
export class GridNavigator extends EventEmitter {
  /**
   * @param {Object} config - Configuration object
   * @param {Object} dataManager - Data manager instance
   * @param {Object} polygons - GeoJSON feature collection of polygons
   */
  constructor(config, dataManager, polygons) {
    super();

    this.config = config;
    this.dataManager = dataManager;
    this.polygons = polygons.features || [];

    // Grid configuration
    this.tileSize = config.grid_sampling?.tile_size || 256;
    this.randomSeed = config.grid_sampling?.random_seed || 42;
    this.requirePolygons = config.grid_sampling?.require_polygons !== false;

    // Initialize grid
    this.gridTiles = [];
    this.shuffledIndices = [];
    this.currentIndex = 0;
    this.currentTile = null;

    // Random number generator
    this.rng = new SeededRandom(this.randomSeed);
  }

  /**
   * Initialize the grid system
   */
  async initialize() {
    // Get data dimensions
    const metadata = await this.dataManager.getData('numpy_stack').metadata;
    const shape = metadata.shape; // [time, rows, cols, bands]

    this.origin = metadata.origin;
    this.pixelSize = metadata.pixelSize;
    this.rows = shape[1];
    this.cols = shape[2];

    // Create grid tiles
    this.createGrid();

    // Filter tiles with polygons if required
    if (this.requirePolygons) {
      await this.filterTilesWithPolygons();
    }

    // Shuffle indices with seeded random
    this.shuffleIndices();

    console.log(`Grid initialized: ${this.gridTiles.length} tiles, ${this.shuffledIndices.length} available tiles`);
  }

  /**
   * Create grid of tiles covering the full area
   */
  createGrid() {
    this.gridTiles = [];

    const numRows = Math.ceil(this.rows / this.tileSize);
    const numCols = Math.ceil(this.cols / this.tileSize);

    for (let gridRow = 0; gridRow < numRows; gridRow++) {
      for (let gridCol = 0; gridCol < numCols; gridCol++) {
        const rowStart = gridRow * this.tileSize;
        const rowEnd = Math.min(rowStart + this.tileSize, this.rows);
        const colStart = gridCol * this.tileSize;
        const colEnd = Math.min(colStart + this.tileSize, this.cols);

        // Calculate geographic bounds
        const geoBounds = {
          rowStart,
          rowEnd,
          colStart,
          colEnd,
          // Geographic coordinates (top-left and bottom-right)
          minX: this.origin[0] + colStart * this.pixelSize[0],
          maxX: this.origin[0] + colEnd * this.pixelSize[0],
          minY: this.origin[1] - rowEnd * this.pixelSize[1],
          maxY: this.origin[1] - rowStart * this.pixelSize[1]
        };

        this.gridTiles.push({
          id: `tile_${gridRow}_${gridCol}`,
          gridRow,
          gridCol,
          bounds: geoBounds,
          hasPolygons: false,
          polygonIds: []
        });
      }
    }
  }

  /**
   * Filter tiles that contain polygons
   */
  async filterTilesWithPolygons() {
    // Check each tile for polygon presence
    for (const tile of this.gridTiles) {
      const polygonsInTile = this.findPolygonsInTile(tile);
      tile.hasPolygons = polygonsInTile.length > 0;
      tile.polygonIds = polygonsInTile.map(p => p.properties?.FID || p.id);
      tile.polygons = polygonsInTile;

      // Calculate time indices from polygon months
      if (polygonsInTile.length > 0) {
        this.calculateTimeIndices(tile, polygonsInTile);
      } else {
        // Default time indices if no polygons
        tile.beforeMonth = 0;
        tile.afterMonth = 1;
      }
    }

    // Keep only tiles with polygons if required
    if (this.requirePolygons) {
      const originalCount = this.gridTiles.length;
      this.gridTiles = this.gridTiles.filter(t => t.hasPolygons);
      console.log(`Filtered tiles: ${this.gridTiles.length}/${originalCount} have polygons`);
    }
  }

  /**
   * Calculate time indices for a tile based on polygon months
   *
   * @param {Object} tile - Grid tile
   * @param {Array} polygons - Polygons in the tile
   */
  calculateTimeIndices(tile, polygons) {
    // Get all months from polygons in this tile
    const months = polygons
      .map(p => p.properties?.month)
      .filter(m => m !== undefined && m !== null);

    if (months.length === 0) {
      // No month information, use defaults
      tile.beforeMonth = 0;
      tile.afterMonth = 1;
      tile.month = null;
      return;
    }

    // Use the most common month, or the first one if all different
    const monthCounts = {};
    months.forEach(m => {
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    });

    const mostCommonMonth = Object.entries(monthCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    const month = parseInt(mostCommonMonth);

    // Calculate before and after months (same logic as original)
    tile.month = month;
    tile.beforeMonth = month - 2;
    tile.afterMonth = month - 1;

    // console.log(`Tile ${tile.id}: month=${month}, before=${tile.beforeMonth}, after=${tile.afterMonth}`);
  }

  /**
   * Find polygons that intersect with a tile
   *
   * @param {Object} tile - Grid tile
   * @returns {Array} - Array of polygon features
   */
  findPolygonsInTile(tile) {
    const { minX, maxX, minY, maxY } = tile.bounds;

    return this.polygons.filter(polygon => {
      const geom = polygon.geometry;

      if (geom.type === 'Polygon') {
        return this.polygonIntersectsBounds(geom.coordinates[0], minX, maxX, minY, maxY);
      } else if (geom.type === 'MultiPolygon') {
        return geom.coordinates.some(poly =>
          this.polygonIntersectsBounds(poly[0], minX, maxX, minY, maxY)
        );
      }

      return false;
    });
  }

  /**
   * Check if polygon coordinates intersect with bounds
   *
   * @param {Array} coords - Polygon coordinates [[x, y], ...]
   * @param {number} minX - Minimum X bound
   * @param {number} maxX - Maximum X bound
   * @param {number} minY - Minimum Y bound
   * @param {number} maxY - Maximum Y bound
   * @returns {boolean}
   */
  polygonIntersectsBounds(coords, minX, maxX, minY, maxY) {
    // Check if any point is inside bounds
    for (const [x, y] of coords) {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return true;
      }
    }

    // Check if bounds are completely inside polygon (simple approximation)
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return this.pointInPolygon([centerX, centerY], coords);
  }

  /**
   * Point in polygon test (ray casting algorithm)
   *
   * @param {Array} point - [x, y]
   * @param {Array} polygon - [[x, y], ...]
   * @returns {boolean}
   */
  pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Shuffle tile indices using seeded random
   */
  shuffleIndices() {
    // Fisher-Yates shuffle with seeded random
    this.shuffledIndices = Array.from({ length: this.gridTiles.length }, (_, i) => i);

    for (let i = this.shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] =
        [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
  }

  /**
   * Get current tile
   *
   * @returns {Object} - Current tile
   */
  getCurrent() {
    if (this.currentIndex >= 0 && this.currentIndex < this.shuffledIndices.length) {
      const tileIndex = this.shuffledIndices[this.currentIndex];
      return this.gridTiles[tileIndex];
    }
    return null;
  }

  /**
   * Go to specific index
   *
   * @param {number} index - Index to navigate to
   */
  async goTo(index) {
    if (index < 0 || index >= this.shuffledIndices.length) {
      console.warn('Invalid index:', index);
      return;
    }

    this.currentIndex = index;
    const tileIndex = this.shuffledIndices[index];
    this.currentTile = this.gridTiles[tileIndex];

    this.emit('change', {
      tile: this.currentTile,
      index: this.currentIndex,
      total: this.shuffledIndices.length
    });
  }

  /**
   * Navigate to next tile
   */
  async next() {
    if (this.currentIndex < this.shuffledIndices.length - 1) {
      await this.goTo(this.currentIndex + 1);
    }
  }

  /**
   * Navigate to previous tile
   */
  async previous() {
    if (this.currentIndex > 0) {
      await this.goTo(this.currentIndex - 1);
    }
  }

  /**
   * Navigate to first tile
   */
  async first() {
    await this.goTo(0);
  }

  /**
   * Navigate to last tile
   */
  async last() {
    await this.goTo(this.shuffledIndices.length - 1);
  }

  /**
   * Check if at first tile
   *
   * @returns {boolean}
   */
  isFirst() {
    return this.currentIndex === 0;
  }

  /**
   * Check if at last tile
   *
   * @returns {boolean}
   */
  isLast() {
    return this.currentIndex === this.shuffledIndices.length - 1;
  }

  /**
   * Get total number of tiles
   *
   * @returns {number}
   */
  getTotalTiles() {
    return this.shuffledIndices.length;
  }

  /**
   * Get current index
   *
   * @returns {number}
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Get grid statistics
   *
   * @returns {Object}
   */
  getStats() {
    return {
      totalTiles: this.gridTiles.length,
      tilesWithPolygons: this.gridTiles.filter(t => t.hasPolygons).length,
      availableTiles: this.shuffledIndices.length,
      currentIndex: this.currentIndex,
      tileSize: this.tileSize,
      randomSeed: this.randomSeed
    };
  }
}
