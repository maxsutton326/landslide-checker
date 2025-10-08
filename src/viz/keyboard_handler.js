/**
 * Keyboard Handler
 *
 * Maps keyboard shortcuts to actions with help overlay
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * KeyboardHandler class
 */
export class KeyboardHandler extends EventEmitter {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();

    this.options = {
      enableDefaults: true,
      preventConflicts: true,
      ...options
    };

    this.bindings = new Map();
    this.activeModifiers = new Set();
    this.helpOverlay = null;
    this.isEnabled = true;
    this.preventedKeys = new Set();

    if (this.options.enableDefaults) {
      this.registerDefaultBindings();
    }

    this.attachEventListeners();
  }

  /**
   * Register default key bindings
   */
  registerDefaultBindings() {
    // Navigation
    this.register('ArrowRight', 'Navigate to next landslide', 'next');
    this.register('ArrowLeft', 'Navigate to previous landslide', 'previous');
    this.register('n', 'Navigate to next landslide', 'next');
    this.register('p', 'Navigate to previous landslide', 'previous');
    this.register('Home', 'Go to first landslide', 'first');
    this.register('End', 'Go to last landslide', 'last');

    // View controls
    this.register('r', 'Reset view', 'reset-view');
    this.register('R', 'Reset view', 'reset-view');
    this.register('+', 'Zoom in', 'zoom-in');
    this.register('=', 'Zoom in', 'zoom-in'); // Same key without shift
    this.register('-', 'Zoom out', 'zoom-out');
    this.register('f', 'Toggle fullscreen', 'fullscreen');
    this.register('F', 'Toggle fullscreen', 'fullscreen');

    // Synchronization
    this.register('s', 'Toggle sync', 'toggle-sync');
    this.register('S', 'Toggle sync', 'toggle-sync');

    // Temporal controls
    this.register(' ', 'Play/pause time animation', 'toggle-play');
    this.register('[', 'Previous time step', 'time-previous');
    this.register(']', 'Next time step', 'time-next');

    // Labeling (quick labels)
    this.register('1', 'Label: Landslide', 'label-1');
    this.register('2', 'Label: No landslide', 'label-2');
    this.register('3', 'Label: Uncertain', 'label-3');
    this.register('4', 'Label: Skip', 'label-4');
    this.register('5', 'Label: Flag for review', 'label-5');
    this.register('6', 'Label: Clear label', 'label-6');

    // Interface
    this.register('h', 'Show help', 'show-help');
    this.register('H', 'Show help', 'show-help');
    this.register('?', 'Show help', 'show-help');
    this.register('Escape', 'Close overlay/deselect', 'escape');

    // Jump
    this.register('j', 'Jump to ID', 'jump', { ctrl: true });
    this.register('J', 'Jump to ID', 'jump', { ctrl: true });

    // Bookmarks
    this.register('b', 'Toggle bookmark', 'toggle-bookmark');
    this.register('B', 'Show bookmarks', 'show-bookmarks');

    // Data controls
    this.register('t', 'Increase threshold', 'threshold-up');
    this.register('T', 'Decrease threshold', 'threshold-down');
  }

  /**
   * Register a key binding
   *
   * @param {string} key - Key name
   * @param {string} description - Action description
   * @param {string} action - Action name
   * @param {Object} modifiers - Modifier keys (ctrl, shift, alt, meta)
   */
  register(key, description, action, modifiers = {}) {
    const binding = {
      key,
      description,
      action,
      ctrl: modifiers.ctrl || false,
      shift: modifiers.shift || false,
      alt: modifiers.alt || false,
      meta: modifiers.meta || false
    };

    const bindingKey = this.createBindingKey(key, modifiers);
    this.bindings.set(bindingKey, binding);
  }

  /**
   * Unregister a key binding
   *
   * @param {string} key - Key name
   * @param {Object} modifiers - Modifier keys
   */
  unregister(key, modifiers = {}) {
    const bindingKey = this.createBindingKey(key, modifiers);
    this.bindings.delete(bindingKey);
  }

  /**
   * Create binding key from key and modifiers
   *
   * @param {string} key - Key name
   * @param {Object} modifiers - Modifier keys
   * @returns {string} - Binding key
   */
  createBindingKey(key, modifiers = {}) {
    const parts = [];
    if (modifiers.ctrl) parts.push('Ctrl');
    if (modifiers.shift) parts.push('Shift');
    if (modifiers.alt) parts.push('Alt');
    if (modifiers.meta) parts.push('Meta');
    parts.push(key);
    return parts.join('+');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Handle keydown event
   *
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    if (!this.isEnabled) return;

    // Ignore if typing in input field (unless it's Escape or Ctrl+J)
    if (this.isTypingInInput(e.target) &&
        e.key !== 'Escape' &&
        !(e.ctrlKey && (e.key === 'j' || e.key === 'J'))) {
      return;
    }

    // Track modifiers
    if (e.ctrlKey) this.activeModifiers.add('ctrl');
    if (e.shiftKey) this.activeModifiers.add('shift');
    if (e.altKey) this.activeModifiers.add('alt');
    if (e.metaKey) this.activeModifiers.add('meta');

    // Find matching binding
    const binding = this.findBinding(e);

    if (binding) {
      // Prevent default if configured
      if (this.options.preventConflicts || this.preventedKeys.has(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Emit action
      this.emit('action', {
        action: binding.action,
        key: binding.key,
        event: e
      });

      // Emit specific action
      this.emit(binding.action, { event: e });
    }
  }

  /**
   * Handle keyup event
   *
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyUp(e) {
    // Clear modifiers
    if (!e.ctrlKey) this.activeModifiers.delete('ctrl');
    if (!e.shiftKey) this.activeModifiers.delete('shift');
    if (!e.altKey) this.activeModifiers.delete('alt');
    if (!e.metaKey) this.activeModifiers.delete('meta');
  }

  /**
   * Find matching binding for event
   *
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {Object|null} - Matching binding or null
   */
  findBinding(e) {
    const modifiers = {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
      meta: e.metaKey
    };

    const bindingKey = this.createBindingKey(e.key, modifiers);
    return this.bindings.get(bindingKey) || null;
  }

  /**
   * Check if typing in input element
   *
   * @param {HTMLElement} target - Event target
   * @returns {boolean}
   */
  isTypingInInput(target) {
    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' ||
           tagName === 'textarea' ||
           tagName === 'select' ||
           target.isContentEditable;
  }

  /**
   * Show help overlay
   */
  showHelp() {
    if (this.helpOverlay) {
      this.helpOverlay.classList.remove('hidden');
      return;
    }

    // Create help overlay
    this.helpOverlay = document.createElement('div');
    this.helpOverlay.id = 'keyboard-help-overlay';
    this.helpOverlay.className = 'keyboard-help-overlay';

    const content = document.createElement('div');
    content.className = 'keyboard-help-content';

    const header = document.createElement('h3');
    header.textContent = 'Keyboard Shortcuts';
    content.appendChild(header);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'help-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hideHelp());
    content.appendChild(closeBtn);

    // Group bindings by category
    const categories = this.categorizeBindings();

    Object.entries(categories).forEach(([category, bindings]) => {
      const categorySection = document.createElement('div');
      categorySection.className = 'help-category';

      const categoryHeader = document.createElement('h4');
      categoryHeader.textContent = category;
      categorySection.appendChild(categoryHeader);

      const dl = document.createElement('dl');
      dl.className = 'shortcuts-list';

      bindings.forEach(binding => {
        const dt = document.createElement('dt');
        dt.className = 'shortcut-key';
        dt.textContent = this.formatKeyBinding(binding);

        const dd = document.createElement('dd');
        dd.className = 'shortcut-description';
        dd.textContent = binding.description;

        dl.appendChild(dt);
        dl.appendChild(dd);
      });

      categorySection.appendChild(dl);
      content.appendChild(categorySection);
    });

    this.helpOverlay.appendChild(content);
    document.body.appendChild(this.helpOverlay);

    // Close on click outside
    this.helpOverlay.addEventListener('click', (e) => {
      if (e.target === this.helpOverlay) {
        this.hideHelp();
      }
    });
  }

  /**
   * Hide help overlay
   */
  hideHelp() {
    if (this.helpOverlay) {
      this.helpOverlay.classList.add('hidden');
    }
  }

  /**
   * Categorize bindings
   *
   * @returns {Object} - Categorized bindings
   */
  categorizeBindings() {
    const categories = {
      'Navigation': [],
      'View Controls': [],
      'Temporal Controls': [],
      'Labeling': [],
      'Interface': []
    };

    this.bindings.forEach(binding => {
      // Skip duplicate descriptions
      const categoryKey = this.getCategoryForAction(binding.action);
      const category = categories[categoryKey];

      if (category && !category.find(b => b.description === binding.description)) {
        category.push(binding);
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  /**
   * Get category for action
   *
   * @param {string} action - Action name
   * @returns {string} - Category name
   */
  getCategoryForAction(action) {
    if (action.includes('next') || action.includes('previous') ||
        action.includes('first') || action.includes('last') ||
        action.includes('jump')) {
      return 'Navigation';
    } else if (action.includes('zoom') || action.includes('reset') ||
               action.includes('fullscreen')) {
      return 'View Controls';
    } else if (action.includes('time') || action.includes('play')) {
      return 'Temporal Controls';
    } else if (action.includes('label')) {
      return 'Labeling';
    } else {
      return 'Interface';
    }
  }

  /**
   * Format key binding for display
   *
   * @param {Object} binding - Key binding
   * @returns {string} - Formatted string
   */
  formatKeyBinding(binding) {
    const parts = [];

    if (binding.ctrl) parts.push('Ctrl');
    if (binding.alt) parts.push('Alt');
    if (binding.shift) parts.push('Shift');
    if (binding.meta) parts.push('Cmd');

    // Format key name
    let keyName = binding.key;
    if (keyName === ' ') keyName = 'Space';
    if (keyName === 'ArrowRight') keyName = '→';
    if (keyName === 'ArrowLeft') keyName = '←';
    if (keyName === 'ArrowUp') keyName = '↑';
    if (keyName === 'ArrowDown') keyName = '↓';

    parts.push(keyName);

    return parts.join(' + ');
  }

  /**
   * Enable keyboard handler
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * Disable keyboard handler
   */
  disable() {
    this.isEnabled = false;
  }

  /**
   * Toggle enabled state
   */
  toggle() {
    this.isEnabled = !this.isEnabled;
  }

  /**
   * Add key to prevent defaults
   *
   * @param {string} key - Key name
   */
  preventKey(key) {
    this.preventedKeys.add(key);
  }

  /**
   * Remove key from prevent defaults
   *
   * @param {string} key - Key name
   */
  allowKey(key) {
    this.preventedKeys.delete(key);
  }

  /**
   * Get all bindings
   *
   * @returns {Map} - Bindings map
   */
  getBindings() {
    return new Map(this.bindings);
  }

  /**
   * Clear all bindings
   */
  clearBindings() {
    this.bindings.clear();
  }

  /**
   * Export bindings as JSON
   *
   * @returns {string} - JSON string
   */
  exportBindings() {
    const bindings = Array.from(this.bindings.values());
    return JSON.stringify(bindings, null, 2);
  }

  /**
   * Import bindings from JSON
   *
   * @param {string} jsonString - JSON string
   */
  importBindings(jsonString) {
    try {
      const bindings = JSON.parse(jsonString);
      this.clearBindings();

      bindings.forEach(binding => {
        this.register(
          binding.key,
          binding.description,
          binding.action,
          {
            ctrl: binding.ctrl,
            shift: binding.shift,
            alt: binding.alt,
            meta: binding.meta
          }
        );
      });
    } catch (error) {
      console.error('Failed to import bindings:', error);
    }
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);

    if (this.helpOverlay && this.helpOverlay.parentNode) {
      this.helpOverlay.parentNode.removeChild(this.helpOverlay);
    }

    this.bindings.clear();
    this.activeModifiers.clear();
    this.preventedKeys.clear();
  }
}
