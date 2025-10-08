/**
 * Quick Jump Interface
 *
 * Search and autocomplete for jumping to specific landslides
 */

import { EventEmitter } from '../utils/event_emitter.js';

/**
 * QuickJump class
 */
export class QuickJump extends EventEmitter {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Array} landslides - Array of landslide features
   */
  constructor(container, landslides) {
    super();

    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.landslides = landslides;
    this.history = [];
    this.bookmarks = new Set();
    this.maxHistorySize = 20;
    this.maxSuggestions = 10;
    this.isOpen = false;

    // Build search index
    this.buildSearchIndex();

    this.initialize();
  }

  /**
   * Build search index for fast lookups
   */
  buildSearchIndex() {
    this.searchIndex = [];

    this.landslides.forEach((landslide, index) => {
      const id = landslide.properties?.FID || landslide.id;
      const area = landslide.properties?.area;
      const confidence = landslide.properties?.confidence;
      const dateMapped = landslide.properties?.date_mapped;

      this.searchIndex.push({
        index,
        id: String(id),
        area,
        confidence,
        dateMapped,
        landslide
      });
    });
  }

  /**
   * Initialize UI elements
   */
  initialize() {
    this.container.innerHTML = '';
    this.container.className = 'quick-jump';

    // Input field
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'quick-jump-input';
    this.input.placeholder = 'Jump to ID... (Ctrl+J)';
    this.input.autocomplete = 'off';

    // Suggestions dropdown
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'quick-jump-dropdown hidden';

    this.container.appendChild(this.input);
    this.container.appendChild(this.dropdown);

    // Event listeners
    this.input.addEventListener('input', (e) => this.handleInput(e));
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
    this.input.addEventListener('focus', () => this.handleFocus());
    this.input.addEventListener('blur', () => this.handleBlur());

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.closeSuggestions();
      }
    });
  }

  /**
   * Handle input event
   *
   * @param {Event} e - Input event
   */
  handleInput(e) {
    const query = e.target.value.trim();

    if (query.length === 0) {
      this.showRecentHistory();
    } else {
      this.showSuggestions(query);
    }
  }

  /**
   * Handle keydown event
   *
   * @param {Event} e - Keydown event
   */
  handleKeydown(e) {
    const items = this.dropdown.querySelectorAll('.suggestion-item');

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        const selected = this.dropdown.querySelector('.suggestion-item.selected');
        if (selected) {
          this.selectSuggestion(selected);
        } else if (this.input.value.trim()) {
          // Try direct ID lookup
          this.jumpToId(this.input.value.trim());
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.closeSuggestions();
        this.input.blur();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.selectNext(items);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectPrevious(items);
        break;
    }
  }

  /**
   * Handle focus event
   */
  handleFocus() {
    this.isOpen = true;
    if (this.input.value.trim().length === 0) {
      this.showRecentHistory();
    } else {
      this.showSuggestions(this.input.value.trim());
    }
  }

  /**
   * Handle blur event
   */
  handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      this.isOpen = false;
      this.closeSuggestions();
    }, 200);
  }

  /**
   * Show suggestions based on query
   *
   * @param {string} query - Search query
   */
  showSuggestions(query) {
    const results = this.search(query);

    if (results.length === 0) {
      this.dropdown.innerHTML = '<div class="no-results">No results found</div>';
      this.dropdown.classList.remove('hidden');
      return;
    }

    this.dropdown.innerHTML = '';

    results.slice(0, this.maxSuggestions).forEach((result, i) => {
      const item = this.createSuggestionItem(result, i === 0);
      this.dropdown.appendChild(item);
    });

    this.dropdown.classList.remove('hidden');
  }

  /**
   * Show recent history
   */
  showRecentHistory() {
    if (this.history.length === 0 && this.bookmarks.size === 0) {
      this.dropdown.classList.add('hidden');
      return;
    }

    this.dropdown.innerHTML = '';

    // Show bookmarks first
    if (this.bookmarks.size > 0) {
      const bookmarksHeader = document.createElement('div');
      bookmarksHeader.className = 'suggestions-header';
      bookmarksHeader.textContent = 'Bookmarks';
      this.dropdown.appendChild(bookmarksHeader);

      Array.from(this.bookmarks).slice(0, 5).forEach((id, i) => {
        const entry = this.searchIndex.find(e => e.id === id);
        if (entry) {
          const item = this.createSuggestionItem(entry, i === 0, true);
          this.dropdown.appendChild(item);
        }
      });
    }

    // Show recent history
    if (this.history.length > 0) {
      const historyHeader = document.createElement('div');
      historyHeader.className = 'suggestions-header';
      historyHeader.textContent = 'Recent';
      this.dropdown.appendChild(historyHeader);

      this.history.slice(0, 5).forEach((id, i) => {
        const entry = this.searchIndex.find(e => e.id === id);
        if (entry) {
          const item = this.createSuggestionItem(entry, i === 0 && this.bookmarks.size === 0);
          this.dropdown.appendChild(item);
        }
      });
    }

    this.dropdown.classList.remove('hidden');
  }

  /**
   * Create suggestion item element
   *
   * @param {Object} result - Search result
   * @param {boolean} selected - Whether to select by default
   * @param {boolean} isBookmark - Whether this is a bookmark
   * @returns {HTMLElement} - Suggestion item
   */
  createSuggestionItem(result, selected = false, isBookmark = false) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    if (selected) {
      item.classList.add('selected');
    }

    const idSpan = document.createElement('span');
    idSpan.className = 'suggestion-id';
    idSpan.textContent = `#${result.id}`;

    const detailsSpan = document.createElement('span');
    detailsSpan.className = 'suggestion-details';

    const details = [];
    if (result.area !== undefined) {
      details.push(`${result.area.toFixed(0)} m²`);
    }
    if (result.confidence !== undefined) {
      details.push(`${(result.confidence * 100).toFixed(0)}%`);
    }

    detailsSpan.textContent = details.join(' · ');

    item.appendChild(idSpan);
    item.appendChild(detailsSpan);

    if (isBookmark) {
      const bookmarkIcon = document.createElement('span');
      bookmarkIcon.className = 'bookmark-icon';
      bookmarkIcon.textContent = '★';
      item.appendChild(bookmarkIcon);
    }

    item.dataset.index = result.index;
    item.dataset.id = result.id;

    item.addEventListener('click', () => this.selectSuggestion(item));

    return item;
  }

  /**
   * Select next suggestion
   *
   * @param {NodeList} items - Suggestion items
   */
  selectNext(items) {
    if (items.length === 0) return;

    const currentIndex = Array.from(items).findIndex(item =>
      item.classList.contains('selected'));

    items.forEach(item => item.classList.remove('selected'));

    const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    items[nextIndex].classList.add('selected');
    items[nextIndex].scrollIntoView({ block: 'nearest' });
  }

  /**
   * Select previous suggestion
   *
   * @param {NodeList} items - Suggestion items
   */
  selectPrevious(items) {
    if (items.length === 0) return;

    const currentIndex = Array.from(items).findIndex(item =>
      item.classList.contains('selected'));

    items.forEach(item => item.classList.remove('selected'));

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    items[prevIndex].classList.add('selected');
    items[prevIndex].scrollIntoView({ block: 'nearest' });
  }

  /**
   * Select a suggestion
   *
   * @param {HTMLElement} item - Suggestion item
   */
  selectSuggestion(item) {
    const index = parseInt(item.dataset.index, 10);
    const id = item.dataset.id;

    this.addToHistory(id);
    this.closeSuggestions();
    this.input.value = '';
    this.input.blur();

    this.emit('select', { index, id });
  }

  /**
   * Jump directly to ID
   *
   * @param {string} id - Landslide ID
   */
  jumpToId(id) {
    const entry = this.searchIndex.find(e => e.id === id);

    if (entry) {
      this.addToHistory(id);
      this.closeSuggestions();
      this.input.value = '';
      this.input.blur();

      this.emit('select', { index: entry.index, id: entry.id });
    } else {
      this.showError(`Landslide #${id} not found`);
    }
  }

  /**
   * Search for landslides
   *
   * @param {string} query - Search query
   * @returns {Array} - Search results
   */
  search(query) {
    const normalizedQuery = query.toLowerCase();
    const results = [];

    for (const entry of this.searchIndex) {
      // Match by ID
      if (entry.id.toLowerCase().includes(normalizedQuery)) {
        results.push({ ...entry, score: 10 });
        continue;
      }

      // Match by area (if numeric query)
      const numericQuery = parseFloat(query);
      if (!isNaN(numericQuery) && entry.area !== undefined) {
        const areaDiff = Math.abs(entry.area - numericQuery);
        if (areaDiff < entry.area * 0.1) { // Within 10%
          results.push({ ...entry, score: 5 });
          continue;
        }
      }

      // Match by date
      if (entry.dateMapped && entry.dateMapped.includes(normalizedQuery)) {
        results.push({ ...entry, score: 3 });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Add ID to history
   *
   * @param {string} id - Landslide ID
   */
  addToHistory(id) {
    // Remove if already exists
    this.history = this.history.filter(historyId => historyId !== id);

    // Add to front
    this.history.unshift(id);

    // Limit size
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    this.saveHistory();
  }

  /**
   * Add bookmark
   *
   * @param {string} id - Landslide ID
   */
  addBookmark(id) {
    this.bookmarks.add(id);
    this.saveBookmarks();
    this.emit('bookmark-added', { id });
  }

  /**
   * Remove bookmark
   *
   * @param {string} id - Landslide ID
   */
  removeBookmark(id) {
    this.bookmarks.delete(id);
    this.saveBookmarks();
    this.emit('bookmark-removed', { id });
  }

  /**
   * Toggle bookmark
   *
   * @param {string} id - Landslide ID
   */
  toggleBookmark(id) {
    if (this.bookmarks.has(id)) {
      this.removeBookmark(id);
    } else {
      this.addBookmark(id);
    }
  }

  /**
   * Check if ID is bookmarked
   *
   * @param {string} id - Landslide ID
   * @returns {boolean}
   */
  isBookmarked(id) {
    return this.bookmarks.has(id);
  }

  /**
   * Close suggestions dropdown
   */
  closeSuggestions() {
    this.dropdown.classList.add('hidden');
  }

  /**
   * Show error message
   *
   * @param {string} message - Error message
   */
  showError(message) {
    this.dropdown.innerHTML = `<div class="error-message">${message}</div>`;
    this.dropdown.classList.remove('hidden');

    setTimeout(() => {
      this.closeSuggestions();
    }, 2000);
  }

  /**
   * Focus input
   */
  focus() {
    this.input.focus();
  }

  /**
   * Clear input
   */
  clear() {
    this.input.value = '';
    this.closeSuggestions();
  }

  /**
   * Save history to localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem('landslide-jump-history', JSON.stringify(this.history));
    } catch (error) {
      console.warn('Failed to save history:', error);
    }
  }

  /**
   * Load history from localStorage
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem('landslide-jump-history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load history:', error);
    }
  }

  /**
   * Save bookmarks to localStorage
   */
  saveBookmarks() {
    try {
      localStorage.setItem('landslide-bookmarks', JSON.stringify(Array.from(this.bookmarks)));
    } catch (error) {
      console.warn('Failed to save bookmarks:', error);
    }
  }

  /**
   * Load bookmarks from localStorage
   */
  loadBookmarks() {
    try {
      const saved = localStorage.getItem('landslide-bookmarks');
      if (saved) {
        this.bookmarks = new Set(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Failed to load bookmarks:', error);
    }
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  /**
   * Clear bookmarks
   */
  clearBookmarks() {
    this.bookmarks.clear();
    this.saveBookmarks();
  }

  /**
   * Register select callback
   *
   * @param {Function} callback - Callback function
   */
  onSelect(callback) {
    this.on('select', callback);
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.container.innerHTML = '';
    this.off('select');
    this.off('bookmark-added');
    this.off('bookmark-removed');
  }
}
