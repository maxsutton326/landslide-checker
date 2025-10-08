/**
 * Performance Monitor and Optimizer
 *
 * Tracks FPS, memory usage, and provides optimization suggestions
 */

import { EventEmitter } from './event_emitter.js';

/**
 * PerformanceMonitor class
 */
export class PerformanceMonitor extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();

    this.options = {
      fpsTarget: 30,
      memoryWarningThreshold: 0.8, // 80% of available memory
      sampleInterval: 1000, // 1 second
      maxSamples: 60, // 1 minute of samples
      autoOptimize: false,
      ...options
    };

    this.fps = 0;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.lastSampleTime = performance.now();

    this.samples = {
      fps: [],
      memory: [],
      renderTime: []
    };

    this.isMonitoring = false;
    this.rafId = null;

    this.stats = {
      avgFPS: 0,
      minFPS: Infinity,
      maxFPS: 0,
      avgMemory: 0,
      peakMemory: 0,
      avgRenderTime: 0,
      droppedFrames: 0
    };

    // Cache management
    this.caches = new Map();
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastFrameTime = performance.now();
    this.lastSampleTime = performance.now();

    this.monitorFrame();
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isMonitoring = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Monitor frame
   */
  monitorFrame() {
    if (!this.isMonitoring) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;

    this.frameCount++;

    // Calculate FPS every sample interval
    if (now - this.lastSampleTime >= this.options.sampleInterval) {
      const elapsed = (now - this.lastSampleTime) / 1000;
      this.fps = this.frameCount / elapsed;

      // Record sample
      this.recordSample('fps', this.fps);

      // Check for dropped frames
      if (this.fps < this.options.fpsTarget * 0.8) {
        this.stats.droppedFrames++;
        this.emit('performance-warning', {
          type: 'low-fps',
          fps: this.fps,
          target: this.options.fpsTarget
        });
      }

      // Track memory if available
      if (performance.memory) {
        const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        this.recordSample('memory', memoryUsage);

        if (memoryUsage > this.options.memoryWarningThreshold) {
          this.emit('performance-warning', {
            type: 'high-memory',
            usage: memoryUsage,
            threshold: this.options.memoryWarningThreshold
          });

          if (this.options.autoOptimize) {
            this.autoOptimize();
          }
        }
      }

      // Update statistics
      this.updateStatistics();

      // Reset counters
      this.frameCount = 0;
      this.lastSampleTime = now;
    }

    this.lastFrameTime = now;
    this.rafId = requestAnimationFrame(() => this.monitorFrame());
  }

  /**
   * Record a performance sample
   *
   * @param {string} metric - Metric name
   * @param {number} value - Sample value
   */
  recordSample(metric, value) {
    if (!this.samples[metric]) {
      this.samples[metric] = [];
    }

    this.samples[metric].push({
      value,
      timestamp: Date.now()
    });

    // Limit sample size
    if (this.samples[metric].length > this.options.maxSamples) {
      this.samples[metric].shift();
    }
  }

  /**
   * Track render time
   *
   * @param {number} renderTime - Render time in ms
   */
  trackRenderTime(renderTime) {
    this.recordSample('renderTime', renderTime);
  }

  /**
   * Update statistics
   */
  updateStatistics() {
    // FPS statistics
    if (this.samples.fps.length > 0) {
      const fpsValues = this.samples.fps.map(s => s.value);
      this.stats.avgFPS = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;
      this.stats.minFPS = Math.min(...fpsValues);
      this.stats.maxFPS = Math.max(...fpsValues);
    }

    // Memory statistics
    if (this.samples.memory.length > 0) {
      const memoryValues = this.samples.memory.map(s => s.value);
      this.stats.avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
      this.stats.peakMemory = Math.max(...memoryValues);
    }

    // Render time statistics
    if (this.samples.renderTime.length > 0) {
      const renderValues = this.samples.renderTime.map(s => s.value);
      this.stats.avgRenderTime = renderValues.reduce((a, b) => a + b, 0) / renderValues.length;
    }
  }

  /**
   * Get current FPS
   *
   * @returns {number} - Current FPS
   */
  trackFPS() {
    return this.fps;
  }

  /**
   * Get memory usage
   *
   * @returns {Object} - Memory usage info
   */
  trackMemory() {
    if (!performance.memory) {
      return {
        supported: false,
        used: 0,
        total: 0,
        percentage: 0
      };
    }

    return {
      supported: true,
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.jsHeapSizeLimit,
      percentage: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
    };
  }

  /**
   * Get performance statistics
   *
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Suggest optimizations based on current performance
   *
   * @returns {Array} - Array of suggestions
   */
  suggestOptimizations() {
    const suggestions = [];

    // Low FPS
    if (this.stats.avgFPS < this.options.fpsTarget * 0.8) {
      suggestions.push({
        type: 'low-fps',
        severity: 'high',
        message: 'Frame rate is below target. Consider reducing panel count or image quality.',
        actions: ['reduce-quality', 'disable-effects', 'limit-panels']
      });
    }

    // High memory usage
    if (this.stats.avgMemory > 0.7) {
      suggestions.push({
        type: 'high-memory',
        severity: this.stats.avgMemory > 0.85 ? 'critical' : 'medium',
        message: 'Memory usage is high. Consider clearing caches or reducing data retention.',
        actions: ['clear-cache', 'reduce-history', 'dispose-unused']
      });
    }

    // Slow render times
    if (this.stats.avgRenderTime > 33) { // > 30 FPS
      suggestions.push({
        type: 'slow-render',
        severity: 'medium',
        message: 'Render times are slow. Consider optimizing canvas operations.',
        actions: ['optimize-canvas', 'reduce-resolution', 'use-offscreen']
      });
    }

    // High dropped frame count
    if (this.stats.droppedFrames > 10) {
      suggestions.push({
        type: 'dropped-frames',
        severity: 'medium',
        message: `${this.stats.droppedFrames} frames dropped. Performance may be degraded.`,
        actions: ['reduce-complexity', 'throttle-updates']
      });
    }

    return suggestions;
  }

  /**
   * Auto-optimize based on suggestions
   */
  autoOptimize() {
    const suggestions = this.suggestOptimizations();

    suggestions.forEach(suggestion => {
      suggestion.actions.forEach(action => {
        switch (action) {
          case 'clear-cache':
            this.clearAllCaches();
            break;

          case 'reduce-history':
            this.emit('optimize-action', { action: 'reduce-history' });
            break;

          case 'dispose-unused':
            this.disposeUnusedData();
            break;

          default:
            this.emit('optimize-action', { action });
        }
      });
    });
  }

  /**
   * Register a cache for management
   *
   * @param {string} name - Cache name
   * @param {Object} cache - Cache object (must have clear() method)
   */
  registerCache(name, cache) {
    this.caches.set(name, cache);
  }

  /**
   * Unregister a cache
   *
   * @param {string} name - Cache name
   */
  unregisterCache(name) {
    this.caches.delete(name);
  }

  /**
   * Clear specific cache
   *
   * @param {string} name - Cache name
   */
  clearCache(name) {
    const cache = this.caches.get(name);
    if (cache && typeof cache.clear === 'function') {
      cache.clear();
      this.emit('cache-cleared', { cache: name });
    }
  }

  /**
   * Clear all registered caches
   */
  clearAllCaches() {
    let cleared = 0;

    this.caches.forEach((cache, name) => {
      if (typeof cache.clear === 'function') {
        cache.clear();
        cleared++;
      }
    });

    this.emit('caches-cleared', { count: cleared });
  }

  /**
   * Dispose unused data (placeholder for implementation)
   */
  disposeUnusedData() {
    // Implementation depends on application structure
    this.emit('optimize-action', { action: 'dispose-unused' });
  }

  /**
   * Get performance report
   *
   * @returns {Object} - Performance report
   */
  getReport() {
    const memory = this.trackMemory();
    const suggestions = this.suggestOptimizations();

    return {
      timestamp: Date.now(),
      fps: {
        current: this.fps,
        average: this.stats.avgFPS,
        min: this.stats.minFPS,
        max: this.stats.maxFPS,
        target: this.options.fpsTarget
      },
      memory: {
        ...memory,
        average: this.stats.avgMemory,
        peak: this.stats.peakMemory
      },
      rendering: {
        averageTime: this.stats.avgRenderTime,
        droppedFrames: this.stats.droppedFrames
      },
      caches: {
        registered: this.caches.size,
        names: Array.from(this.caches.keys())
      },
      suggestions
    };
  }

  /**
   * Export performance data as JSON
   *
   * @returns {string} - JSON string
   */
  exportData() {
    return JSON.stringify({
      samples: this.samples,
      statistics: this.stats,
      report: this.getReport()
    }, null, 2);
  }

  /**
   * Create performance overlay
   *
   * @returns {HTMLElement} - Overlay element
   */
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'performance-overlay';
    overlay.className = 'performance-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      min-width: 200px;
    `;

    const updateOverlay = () => {
      const memory = this.trackMemory();

      overlay.innerHTML = `
        <div><strong>Performance Monitor</strong></div>
        <div>FPS: ${this.fps.toFixed(1)} / ${this.options.fpsTarget}</div>
        <div>Avg: ${this.stats.avgFPS.toFixed(1)}</div>
        ${memory.supported ? `
          <div>Memory: ${(memory.percentage * 100).toFixed(1)}%</div>
          <div>Used: ${(memory.used / 1024 / 1024).toFixed(1)} MB</div>
        ` : ''}
        <div>Render: ${this.stats.avgRenderTime.toFixed(1)} ms</div>
        <div>Dropped: ${this.stats.droppedFrames}</div>
      `;
    };

    // Update every second
    const intervalId = setInterval(updateOverlay, 1000);
    overlay.dataset.intervalId = intervalId;

    updateOverlay();

    return overlay;
  }

  /**
   * Show performance overlay
   */
  showOverlay() {
    if (document.getElementById('performance-overlay')) {
      return;
    }

    const overlay = this.createOverlay();
    document.body.appendChild(overlay);
  }

  /**
   * Hide performance overlay
   */
  hideOverlay() {
    const overlay = document.getElementById('performance-overlay');
    if (overlay) {
      clearInterval(parseInt(overlay.dataset.intervalId));
      overlay.remove();
    }
  }

  /**
   * Reset statistics
   */
  reset() {
    this.samples = {
      fps: [],
      memory: [],
      renderTime: []
    };

    this.stats = {
      avgFPS: 0,
      minFPS: Infinity,
      maxFPS: 0,
      avgMemory: 0,
      peakMemory: 0,
      avgRenderTime: 0,
      droppedFrames: 0
    };

    this.frameCount = 0;
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.stop();
    this.hideOverlay();
    this.clearAllCaches();
    this.caches.clear();
    this.reset();
    this.off('performance-warning');
    this.off('optimize-action');
    this.off('cache-cleared');
    this.off('caches-cleared');
  }
}

/**
 * Simple FPS counter utility
 *
 * @returns {Object} - FPS counter with update() and getFPS() methods
 */
export function createFPSCounter() {
  let fps = 0;
  let frameCount = 0;
  let lastTime = performance.now();

  return {
    update() {
      frameCount++;
      const now = performance.now();

      if (now - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime));
        frameCount = 0;
        lastTime = now;
      }
    },

    getFPS() {
      return fps;
    },

    reset() {
      fps = 0;
      frameCount = 0;
      lastTime = performance.now();
    }
  };
}

/**
 * Measure function execution time
 *
 * @param {Function} fn - Function to measure
 * @param {string} label - Optional label
 * @returns {Object} - Result and duration
 */
export async function measureExecutionTime(fn, label = 'Function') {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`${label} took ${duration.toFixed(2)} ms`);

  return { result, duration };
}

/**
 * Debounce function calls
 *
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} - Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function calls
 *
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} - Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;

  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
