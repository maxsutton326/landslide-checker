/**
 * Label Panel
 *
 * UI component for labeling landslides with classification, confidence, and notes
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * LabelPanel class
 */
export class LabelPanel extends EventEmitter {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} labelConfig - Label configuration
   * @param {string} mode - Interface mode ('basic' or 'advanced')
   */
  constructor(container, labelConfig, mode = 'advanced') {
    super();

    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.labelConfig = labelConfig || this.getDefaultConfig();
    this.mode = mode;
    this.currentValue = null;
    this.currentConfidence = 'medium';
    this.currentNotes = '';
    this.keyboardEnabled = false;

    this.initialize();
  }

  /**
   * Get default label configuration
   *
   * @returns {Object} - Default configuration
   */
  getDefaultConfig() {
    return {
      labels: [
        { code: 'landslide', label: 'Landslide', color: '#dc3545', key: '1' },
        { code: 'no-landslide', label: 'No Landslide', color: '#28a745', key: '2' },
        { code: 'uncertain', label: 'Uncertain', color: '#ffc107', key: '3' },
        { code: 'skip', label: 'Skip', color: '#6c757d', key: '4' },
        { code: 'flag', label: 'Flag for Review', color: '#ff6b6b', key: '5' }
      ]
    };
  }

  /**
   * Initialize UI elements
   */
  initialize() {
    this.container.innerHTML = '';
    this.container.className = `label-panel label-panel-${this.mode}`;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Classification';
    this.container.appendChild(title);

    // Label options
    this.labelOptionsContainer = document.createElement('div');
    this.labelOptionsContainer.className = 'label-options';
    this.createLabelOptions();
    this.container.appendChild(this.labelOptionsContainer);

    // Only show confidence, notes, and action buttons in advanced mode
    if (this.mode === 'advanced') {
      // Confidence selector
      this.confidenceContainer = document.createElement('div');
      this.confidenceContainer.className = 'confidence-selector';
      this.createConfidenceSelector();
      this.container.appendChild(this.confidenceContainer);

      // Notes section
      this.notesContainer = document.createElement('div');
      this.notesContainer.className = 'notes-section';
      this.createNotesSection();
      this.container.appendChild(this.notesContainer);

      // Actions
      this.actionsContainer = document.createElement('div');
      this.actionsContainer.className = 'label-actions';
      this.createActions();
      this.container.appendChild(this.actionsContainer);
    }
  }

  /**
   * Create label option buttons
   */
  createLabelOptions() {
    this.labelOptionsContainer.innerHTML = '';

    // Filter labels for basic mode (only landslide and no-landslide)
    const labelsToShow = this.mode === 'basic'
      ? this.labelConfig.labels.filter(l => l.code === 'landslide' || l.code === 'no-landslide')
      : this.labelConfig.labels;

    labelsToShow.forEach(labelDef => {
      const option = document.createElement('button');
      option.className = 'label-option';
      option.dataset.code = labelDef.code;
      option.style.borderLeftColor = labelDef.color;

      const keySpan = document.createElement('span');
      keySpan.className = 'label-key';
      keySpan.textContent = labelDef.key;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'label-text';
      labelSpan.textContent = labelDef.label;

      option.appendChild(keySpan);
      option.appendChild(labelSpan);

      option.addEventListener('click', () => {
        this.selectLabel(labelDef.code);

        // Auto-apply in basic mode
        if (this.mode === 'basic') {
          setTimeout(() => this.apply(), 100);
        }
      });

      this.labelOptionsContainer.appendChild(option);
    });
  }

  /**
   * Create confidence selector
   */
  createConfidenceSelector() {
    this.confidenceContainer.innerHTML = '';

    const label = document.createElement('label');
    label.textContent = 'Confidence:';
    label.htmlFor = 'confidence-select';

    this.confidenceSelect = document.createElement('select');
    this.confidenceSelect.id = 'confidence-select';
    this.confidenceSelect.className = 'confidence-select';

    const confidenceLevels = [
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' }
    ];

    confidenceLevels.forEach(level => {
      const option = document.createElement('option');
      option.value = level.value;
      option.textContent = level.label;
      if (level.value === this.currentConfidence) {
        option.selected = true;
      }
      this.confidenceSelect.appendChild(option);
    });

    this.confidenceSelect.addEventListener('change', (e) => {
      this.currentConfidence = e.target.value;
      this.emit('change', this.getState());
    });

    this.confidenceContainer.appendChild(label);
    this.confidenceContainer.appendChild(this.confidenceSelect);
  }

  /**
   * Create notes section
   */
  createNotesSection() {
    this.notesContainer.innerHTML = '';

    const label = document.createElement('label');
    label.textContent = 'Notes:';
    label.htmlFor = 'notes-textarea';

    this.notesTextarea = document.createElement('textarea');
    this.notesTextarea.id = 'notes-textarea';
    this.notesTextarea.className = 'notes-textarea';
    this.notesTextarea.rows = 3;
    this.notesTextarea.placeholder = 'Add any notes or observations...';
    this.notesTextarea.value = this.currentNotes;

    this.notesTextarea.addEventListener('input', (e) => {
      this.currentNotes = e.target.value;
      this.emit('change', this.getState());
    });

    this.notesContainer.appendChild(label);
    this.notesContainer.appendChild(this.notesTextarea);
  }

  /**
   * Create action buttons
   */
  createActions() {
    this.actionsContainer.innerHTML = '';

    // Clear button
    this.clearButton = document.createElement('button');
    this.clearButton.className = 'label-action-btn clear-btn';
    this.clearButton.textContent = 'Clear';
    this.clearButton.addEventListener('click', () => {
      this.clear();
    });

    // Apply button
    this.applyButton = document.createElement('button');
    this.applyButton.className = 'label-action-btn apply-btn';
    this.applyButton.textContent = 'Apply & Next';
    this.applyButton.disabled = true;
    this.applyButton.addEventListener('click', () => {
      this.apply();
    });

    this.actionsContainer.appendChild(this.clearButton);
    this.actionsContainer.appendChild(this.applyButton);
  }

  /**
   * Select a label
   *
   * @param {string} code - Label code
   */
  selectLabel(code) {
    this.currentValue = code;

    // Update UI
    const options = this.labelOptionsContainer.querySelectorAll('.label-option');
    options.forEach(option => {
      if (option.dataset.code === code) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });

    if (this.mode === 'advanced') {
      // Enable apply button
      this.applyButton.disabled = false;
    }

    this.emit('select', { code, state: this.getState() });
  }

  /**
   * Get current value
   *
   * @returns {string|null} - Current label code
   */
  getValue() {
    return this.currentValue;
  }

  /**
   * Set value
   *
   * @param {string|null} code - Label code
   */
  setValue(code) {
    if (code === null) {
      this.clear();
      return;
    }

    this.selectLabel(code);
  }

  /**
   * Get confidence level
   *
   * @returns {string} - Confidence level
   */
  getConfidence() {
    return this.currentConfidence;
  }

  /**
   * Set confidence level
   *
   * @param {string} confidence - Confidence level
   */
  setConfidence(confidence) {
    this.currentConfidence = confidence;
    if (this.confidenceSelect) {
      this.confidenceSelect.value = confidence;
    }
  }

  /**
   * Get notes
   *
   * @returns {string} - Notes text
   */
  getNotes() {
    return this.currentNotes;
  }

  /**
   * Set notes
   *
   * @param {string} notes - Notes text
   */
  setNotes(notes) {
    this.currentNotes = notes;
    if (this.notesTextarea) {
      this.notesTextarea.value = notes;
    }
  }

  /**
   * Get complete state
   *
   * @returns {Object} - Current state
   */
  getState() {
    return {
      label: this.currentValue,
      confidence: this.currentConfidence,
      notes: this.currentNotes,
      timestamp: Date.now()
    };
  }

  /**
   * Set complete state
   *
   * @param {Object} state - State to set
   */
  setState(state) {
    if (state.label !== undefined) {
      this.setValue(state.label);
    }
    if (state.confidence !== undefined) {
      this.setConfidence(state.confidence);
    }
    if (state.notes !== undefined) {
      this.setNotes(state.notes);
    }
  }

  /**
   * Clear all selections
   */
  clear() {
    this.currentValue = null;
    this.currentConfidence = 'medium';
    this.currentNotes = '';

    // Update UI
    const options = this.labelOptionsContainer.querySelectorAll('.label-option');
    options.forEach(option => option.classList.remove('active'));

    if (this.confidenceSelect) {
      this.confidenceSelect.value = 'medium';
    }

    if (this.notesTextarea) {
      this.notesTextarea.value = '';
    }

    if (this.mode === 'advanced') {
      this.applyButton.disabled = true;
    }

    this.emit('clear');
  }

  /**
   * Apply current label
   */
  apply() {
    if (!this.currentValue) return;

    const state = this.getState();
    this.emit('apply', state);
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
   * Register apply callback
   *
   * @param {Function} callback - Callback function
   */
  onApply(callback) {
    this.on('apply', callback);
  }

  /**
   * Enable keyboard shortcuts
   */
  enableKeyboardShortcuts() {
    if (this.keyboardEnabled) return;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
    this.keyboardEnabled = true;
  }

  /**
   * Disable keyboard shortcuts
   */
  disableKeyboardShortcuts() {
    if (!this.keyboardEnabled) return;

    document.removeEventListener('keydown', this.handleKeyDown);
    this.keyboardEnabled = false;
  }

  /**
   * Handle keyboard events
   *
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    // Ignore if typing in textarea
    if (e.target === this.notesTextarea) {
      // Allow Tab to cycle confidence
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        this.cycleConfidence();
      }
      return;
    }

    // Number keys for label selection
    if (e.key >= '1' && e.key <= '9') {
      const labelDef = this.labelConfig.labels.find(l => l.key === e.key);
      if (labelDef) {
        e.preventDefault();
        this.selectLabel(labelDef.code);
      }
    }

    // Enter to apply
    if (e.key === 'Enter' && this.currentValue) {
      e.preventDefault();
      this.apply();
    }

    // Backspace/Delete to clear
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.target.matches('input, textarea')) {
      e.preventDefault();
      this.clear();
    }

    // Tab to cycle confidence
    if (e.key === 'Tab' && !e.shiftKey && !e.target.matches('input, textarea, select')) {
      e.preventDefault();
      this.cycleConfidence();
    }
  }

  /**
   * Cycle through confidence levels
   */
  cycleConfidence() {
    const levels = ['low', 'medium', 'high'];
    const currentIndex = levels.indexOf(this.currentConfidence);
    const nextIndex = (currentIndex + 1) % levels.length;
    this.setConfidence(levels[nextIndex]);
    this.emit('change', this.getState());
  }

  /**
   * Get label definition by code
   *
   * @param {string} code - Label code
   * @returns {Object|null} - Label definition
   */
  getLabelDef(code) {
    return this.labelConfig.labels.find(l => l.code === code) || null;
  }

  /**
   * Show validation error
   *
   * @param {string} message - Error message
   */
  showError(message) {
    // Remove existing error
    const existingError = this.container.querySelector('.label-error');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'label-error';
    errorDiv.textContent = message;

    this.container.insertBefore(errorDiv, this.actionsContainer);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 3000);
  }

  /**
   * Enable/disable panel
   *
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled(enabled) {
    const buttons = this.container.querySelectorAll('button, select, textarea');
    buttons.forEach(button => {
      button.disabled = !enabled;
    });

    if (!enabled) {
      this.container.classList.add('disabled');
    } else {
      this.container.classList.remove('disabled');
    }
  }

  /**
   * Set interface mode
   *
   * @param {string} mode - Mode to set ('basic' or 'advanced')
   */
  setMode(mode) {
    if (mode !== 'basic' && mode !== 'advanced') {
      console.warn('Invalid mode:', mode);
      return;
    }

    this.mode = mode;
    this.initialize();
  }

  /**
   * Get current mode
   *
   * @returns {string} - Current mode
   */
  getMode() {
    return this.mode;
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.disableKeyboardShortcuts();
    this.container.innerHTML = '';
    this.removeAllListeners();
  }
}
