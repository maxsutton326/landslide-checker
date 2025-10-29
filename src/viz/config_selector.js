/**
 * Config Selector
 *
 * Dropdown component for selecting and switching between different configs
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * ConfigSelector class
 */
export class ConfigSelector extends EventEmitter {
  /**
   * @param {HTMLElement} container - Container element
   * @param {string} initialConfigPath - Initial config path
   */
  constructor(container, initialConfigPath = null) {
    super();

    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.currentConfigPath = initialConfigPath;
    this.configs = [];

    this.initialize();
  }

  /**
   * Initialize UI elements
   */
  initialize() {
    this.container.innerHTML = '';
    this.container.className = 'config-selector';

    // Label
    const label = document.createElement('label');
    label.textContent = 'Location:';
    label.htmlFor = 'config-select';

    // Dropdown
    this.select = document.createElement('select');
    this.select.id = 'config-select';
    this.select.className = 'config-select';

    // Loading option
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = 'Loading configs...';
    loadingOption.disabled = true;
    loadingOption.selected = true;
    this.select.appendChild(loadingOption);

    this.select.addEventListener('change', (e) => {
      const selectedPath = e.target.value;
      console.log(`ConfigSelector: select changed to "${selectedPath}", current="${this.currentConfigPath}"`);
      if (selectedPath && selectedPath !== this.currentConfigPath) {
        console.log('ConfigSelector: calling selectConfig()');
        this.selectConfig(selectedPath);
      } else {
        console.log('ConfigSelector: skipping selectConfig (same as current or empty)');
      }
    });

    this.container.appendChild(label);
    this.container.appendChild(this.select);

    // Load available configs
    this.loadConfigs();
  }

  /**
   * Load available configs from server
   */
  async loadConfigs() {
    try {
      const response = await fetch('/api/configs');
      if (!response.ok) {
        throw new Error(`Failed to load configs: ${response.statusText}`);
      }

      const data = await response.json();
      this.configs = data.configs || [];

      this.updateOptions();
    } catch (error) {
      console.error('Failed to load configs:', error);
      this.showError();
    }
  }

  /**
   * Update dropdown options
   */
  updateOptions() {
    // Clear existing options
    this.select.innerHTML = '';

    if (this.configs.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'No configs found';
      emptyOption.disabled = true;
      emptyOption.selected = true;
      this.select.appendChild(emptyOption);
      this.select.disabled = true;
      return;
    }

    // Add config options
    this.configs.forEach(config => {
      const option = document.createElement('option');
      option.value = config.path;
      option.textContent = this.formatLocationName(config.name);

      if (config.path === this.currentConfigPath) {
        option.selected = true;
      }

      this.select.appendChild(option);
    });

    this.select.disabled = false;
  }

  /**
   * Format location name for display
   *
   * @param {string} name - Location name
   * @returns {string} - Formatted name
   */
  formatLocationName(name) {
    // Capitalize and replace underscores/hyphens with spaces
    return name
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Select a config
   *
   * @param {string} configPath - Config path
   */
  selectConfig(configPath) {
    const previousPath = this.currentConfigPath;
    this.currentConfigPath = configPath;

    console.log(`ConfigSelector: emitting 'change' event. path="${configPath}", previousPath="${previousPath}"`);
    console.log(`ConfigSelector: listener count for 'change' event: ${this.listenerCount('change')}`);

    this.emit('change', {
      path: configPath,
      previousPath: previousPath
    });
  }

  /**
   * Get current config path
   *
   * @returns {string|null} - Current config path
   */
  getCurrentConfig() {
    return this.currentConfigPath;
  }

  /**
   * Set current config path
   *
   * @param {string} configPath - Config path
   */
  setCurrentConfig(configPath) {
    this.currentConfigPath = configPath;
    if (this.select) {
      this.select.value = configPath;
    }
  }

  /**
   * Show error state
   */
  showError() {
    this.select.innerHTML = '';

    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = 'Failed to load configs';
    errorOption.disabled = true;
    errorOption.selected = true;
    this.select.appendChild(errorOption);
    this.select.disabled = true;
  }

  /**
   * Refresh config list
   */
  async refresh() {
    await this.loadConfigs();
  }

  /**
   * Enable/disable selector
   *
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled(enabled) {
    this.select.disabled = !enabled;

    if (!enabled) {
      this.container.classList.add('disabled');
    } else {
      this.container.classList.remove('disabled');
    }
  }

  /**
   * Register change callback
   *
   * @param {Function} callback - Callback function
   */
  onChange(callback) {
    this.on('change', callback);
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.container.innerHTML = '';
    this.removeAllListeners();
  }
}
