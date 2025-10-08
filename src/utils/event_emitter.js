/**
 * Simple Event Emitter
 *
 * Provides event handling functionality for classes
 */

/**
 * EventEmitter class
 */
export class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Register event listener
   *
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  /**
   * Unregister event listener
   *
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function (optional)
   */
  off(event, listener) {
    if (!this.events[event]) return;

    if (listener) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    } else {
      // Remove all listeners for this event
      delete this.events[event];
    }
  }

  /**
   * Emit event
   *
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to listeners
   */
  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }

  /**
   * Register one-time event listener
   *
   * @param {string} event - Event name
   * @param {Function} listener - Event handler function
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    this.events = {};
  }

  /**
   * Get listener count for event
   *
   * @param {string} event - Event name
   * @returns {number} - Number of listeners
   */
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }
}
