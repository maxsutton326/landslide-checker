/**
 * Landslide Navigator
 *
 * Manages navigation between landslides with preloading support
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * LandslideNavigator class
 */
export class LandslideNavigator extends EventEmitter {
  /**
   * @param {Array} landslides - Array of landslide features
   * @param {DataManager} dataManager - Data manager instance
   */
  constructor(landslides, dataManager) {
    super();

    if (!landslides || !Array.isArray(landslides)) {
      throw new Error('Landslides array is required');
    }

    this.landslides = landslides;
    this.dataManager = dataManager;
    this.currentIndex = 0;
    this.preloadCache = new Map();
    this.maxCacheSize = 5;
    this.isPreloading = false;

    // Build ID lookup map
    this.idMap = new Map();
    this.landslides.forEach((landslide, index) => {
      const id = landslide.properties?.FID || landslide.id;
      if (id !== undefined) {
        this.idMap.set(String(id), index);
      }
    });
  }

  /**
   * Get current landslide
   *
   * @returns {Object} - Current landslide feature
   */
  getCurrent() {
    return this.landslides[this.currentIndex];
  }

  /**
   * Get current index
   *
   * @returns {number} - Current index
   */
  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Get total count
   *
   * @returns {number} - Total landslide count
   */
  getTotalCount() {
    return this.landslides.length;
  }

  /**
   * Navigate to next landslide
   *
   * @returns {Object|null} - Next landslide or null if at end
   */
  async next() {
    if (this.currentIndex >= this.landslides.length - 1) {
      // Already at last item
      this.emit('boundary', { type: 'last', index: this.currentIndex });
      return null;
    }

    this.currentIndex++;
    const landslide = this.getCurrent();

    this.emit('change', {
      landslide,
      index: this.currentIndex,
      total: this.landslides.length
    });

    // Preload next
    if (!this.isPreloading) {
      this.preloadAdjacent();
    }

    return landslide;
  }

  /**
   * Navigate to previous landslide
   *
   * @returns {Object|null} - Previous landslide or null if at start
   */
  async previous() {
    if (this.currentIndex <= 0) {
      // Already at first item
      this.emit('boundary', { type: 'first', index: this.currentIndex });
      return null;
    }

    this.currentIndex--;
    const landslide = this.getCurrent();

    this.emit('change', {
      landslide,
      index: this.currentIndex,
      total: this.landslides.length
    });

    // Preload previous
    if (!this.isPreloading) {
      this.preloadAdjacent();
    }

    return landslide;
  }

  /**
   * Go to specific index
   *
   * @param {number} index - Target index
   * @returns {Object|null} - Landslide at index or null if invalid
   */
  async goTo(index) {
    if (index < 0 || index >= this.landslides.length) {
      console.warn(`Invalid index: ${index}`);
      return null;
    }

    if (index === this.currentIndex) {
      return this.getCurrent();
    }

    this.currentIndex = index;
    const landslide = this.getCurrent();

    this.emit('change', {
      landslide,
      index: this.currentIndex,
      total: this.landslides.length
    });

    // Preload adjacent
    if (!this.isPreloading) {
      this.preloadAdjacent();
    }

    return landslide;
  }

  /**
   * Go to landslide by ID
   *
   * @param {string|number} id - Landslide ID
   * @returns {Object|null} - Landslide with ID or null if not found
   */
  async goToId(id) {
    const index = this.idMap.get(String(id));

    if (index === undefined) {
      console.warn(`Landslide not found: ${id}`);
      this.emit('notfound', { id });
      return null;
    }

    return await this.goTo(index);
  }

  /**
   * Go to first landslide
   *
   * @returns {Object} - First landslide
   */
  async first() {
    return await this.goTo(0);
  }

  /**
   * Go to last landslide
   *
   * @returns {Object} - Last landslide
   */
  async last() {
    return await this.goTo(this.landslides.length - 1);
  }

  /**
   * Preload adjacent landslides
   */
  async preloadAdjacent() {
    if (this.isPreloading || !this.dataManager) {
      return;
    }

    this.isPreloading = true;

    try {
      const toPreload = [];

      // Preload next
      if (this.currentIndex < this.landslides.length - 1) {
        toPreload.push(this.currentIndex + 1);
      }

      // Preload previous
      if (this.currentIndex > 0) {
        toPreload.push(this.currentIndex - 1);
      }

      // Preload next 2
      if (this.currentIndex < this.landslides.length - 2) {
        toPreload.push(this.currentIndex + 2);
      }

      // Filter out already cached
      const needsPreload = toPreload.filter(index => !this.preloadCache.has(index));

      // Preload in background
      for (const index of needsPreload) {
        const landslide = this.landslides[index];
        // Store reference to indicate it's been considered
        this.preloadCache.set(index, { landslide, timestamp: Date.now() });

        // Limit cache size
        if (this.preloadCache.size > this.maxCacheSize) {
          // Remove oldest
          const oldestIndex = Array.from(this.preloadCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
          this.preloadCache.delete(oldestIndex);
        }
      }

      this.emit('preloaded', { indices: needsPreload });
    } catch (error) {
      console.error('Preload error:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Check if at first landslide
   *
   * @returns {boolean}
   */
  isFirst() {
    return this.currentIndex === 0;
  }

  /**
   * Check if at last landslide
   *
   * @returns {boolean}
   */
  isLast() {
    return this.currentIndex === this.landslides.length - 1;
  }

  /**
   * Get navigation info
   *
   * @returns {Object} - Navigation state info
   */
  getNavigationInfo() {
    return {
      currentIndex: this.currentIndex,
      total: this.landslides.length,
      isFirst: this.isFirst(),
      isLast: this.isLast(),
      currentId: this.getCurrent()?.properties?.FID || this.getCurrent()?.id,
      progress: (this.currentIndex + 1) / this.landslides.length
    };
  }

  /**
   * Search landslides by query
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - Matching landslide indices
   */
  search(query, options = {}) {
    const {
      fields = ['FID', 'id'],
      maxResults = 10,
      caseSensitive = false
    } = options;

    const normalizedQuery = caseSensitive ? query : query.toLowerCase();
    const results = [];

    for (let i = 0; i < this.landslides.length; i++) {
      const landslide = this.landslides[i];

      for (const field of fields) {
        let value;
        if (field === 'id') {
          value = landslide.id;
        } else {
          value = landslide.properties?.[field];
        }

        if (value === undefined || value === null) continue;

        const normalizedValue = caseSensitive ?
          String(value) : String(value).toLowerCase();

        if (normalizedValue.includes(normalizedQuery)) {
          results.push({
            index: i,
            landslide,
            field,
            value
          });
          break;
        }
      }

      if (results.length >= maxResults) {
        break;
      }
    }

    return results;
  }

  /**
   * Filter landslides by predicate
   *
   * @param {Function} predicate - Filter function
   * @returns {Array} - Matching landslide indices
   */
  filter(predicate) {
    const results = [];

    for (let i = 0; i < this.landslides.length; i++) {
      if (predicate(this.landslides[i], i)) {
        results.push(i);
      }
    }

    return results;
  }

  /**
   * Clear preload cache
   */
  clearCache() {
    this.preloadCache.clear();
  }

  /**
   * Get cache stats
   *
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      size: this.preloadCache.size,
      maxSize: this.maxCacheSize,
      indices: Array.from(this.preloadCache.keys())
    };
  }

  /**
   * Reset to first landslide
   */
  reset() {
    this.currentIndex = 0;
    this.clearCache();
  }
}
