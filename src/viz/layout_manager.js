/**
 * Layout Manager
 *
 * Handles responsive grid layout for panels, resizing, aspect ratios,
 * and fullscreen mode.
 */

/**
 * Create a grid layout in a container
 *
 * @param {HTMLElement} container - Container element
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @returns {Array<HTMLElement>} - Array of panel container elements
 */
export function createGrid(container, rows, cols) {
  if (!container) {
    throw new Error('Container element is required');
  }

  container.className = 'panel-grid';
  container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  const panels = [];
  for (let i = 0; i < rows * cols; i++) {
    const panelContainer = document.createElement('div');
    panelContainer.className = 'panel';
    panelContainer.dataset.panelIndex = i;

    // Add header
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = `Panel ${i + 1}`;
    panelContainer.appendChild(header);

    container.appendChild(panelContainer);
    panels.push(panelContainer);
  }

  return panels;
}

/**
 * LayoutManager class
 */
export class LayoutManager {
  constructor(container) {
    if (!container) {
      throw new Error('Container element is required');
    }

    this.container = container;
    this.panels = [];
    this.currentLayout = 'grid';
    this.fullscreenPanel = null;

    // Bind resize handler
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Initialize grid layout
   *
   * @param {number} rows - Number of rows
   * @param {number} cols - Number of columns
   * @returns {Array<HTMLElement>} - Panel containers
   */
  initializeGrid(rows, cols) {
    this.panels = createGrid(this.container, rows, cols);
    this.currentLayout = 'grid';
    this.resizePanels();
    return this.panels;
  }

  /**
   * Resize panels to fit container
   */
  resizePanels() {
    const containerRect = this.container.getBoundingClientRect();

    if (this.fullscreenPanel) {
      // Fullscreen mode
      this.fullscreenPanel.style.width = '100%';
      this.fullscreenPanel.style.height = '100%';
    } else if (this.currentLayout === 'grid') {
      // Grid layout - handled by CSS grid
      // Trigger resize event for canvas elements
      this.panels.forEach(panel => {
        const canvas = panel.querySelector('canvas');
        if (canvas) {
          const event = new Event('resize');
          window.dispatchEvent(event);
        }
      });
    }
  }

  /**
   * Handle window resize event
   */
  handleResize() {
    this.resizePanels();
  }

  /**
   * Toggle fullscreen mode for a panel
   *
   * @param {HTMLElement|null} panel - Panel to fullscreen, or null to exit
   */
  toggleFullscreen(panel = null) {
    if (this.fullscreenPanel) {
      // Exit fullscreen
      this.fullscreenPanel.classList.remove('fullscreen');
      this.panels.forEach(p => {
        p.style.display = 'block';
      });
      this.fullscreenPanel = null;
      this.currentLayout = 'grid';
    } else if (panel) {
      // Enter fullscreen
      this.panels.forEach(p => {
        if (p !== panel) {
          p.style.display = 'none';
        }
      });
      panel.classList.add('fullscreen');
      this.fullscreenPanel = panel;
      this.currentLayout = 'fullscreen';
    }

    this.resizePanels();
  }

  /**
   * Optimize layout for screen size
   *
   * @param {string} screenSize - 'small', 'medium', 'large'
   */
  optimizeLayout(screenSize) {
    const grid = this.container;

    switch (screenSize) {
      case 'small':
        // Mobile: 1 column
        grid.style.gridTemplateColumns = '1fr';
        grid.style.gridTemplateRows = 'repeat(5, 1fr)';
        break;

      case 'medium':
        // Tablet: 2 columns
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridTemplateRows = 'repeat(3, 1fr)';
        break;

      case 'large':
      default:
        // Desktop: 3 columns (or custom)
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        grid.style.gridTemplateRows = 'repeat(2, 1fr)';
        break;
    }

    this.resizePanels();
  }

  /**
   * Set custom grid template
   *
   * @param {string} rows - CSS grid-template-rows value
   * @param {string} cols - CSS grid-template-columns value
   */
  setGridTemplate(rows, cols) {
    this.container.style.gridTemplateRows = rows;
    this.container.style.gridTemplateColumns = cols;
    this.resizePanels();
  }

  /**
   * Show specific panels
   *
   * @param {Array<number>} indices - Indices of panels to show
   */
  showPanels(indices) {
    this.panels.forEach((panel, index) => {
      panel.style.display = indices.includes(index) ? 'block' : 'none';
    });
    this.resizePanels();
  }

  /**
   * Hide specific panels
   *
   * @param {Array<number>} indices - Indices of panels to hide
   */
  hidePanels(indices) {
    this.panels.forEach((panel, index) => {
      if (indices.includes(index)) {
        panel.style.display = 'none';
      }
    });
    this.resizePanels();
  }

  /**
   * Get panel at index
   *
   * @param {number} index - Panel index
   * @returns {HTMLElement|null} - Panel element
   */
  getPanel(index) {
    return this.panels[index] || null;
  }

  /**
   * Get all panel elements
   *
   * @returns {Array<HTMLElement>} - Panel elements
   */
  getAllPanels() {
    return this.panels;
  }

  /**
   * Set panel header text
   *
   * @param {number} index - Panel index
   * @param {string} text - Header text
   */
  setPanelHeader(index, text) {
    const panel = this.panels[index];
    if (panel) {
      const header = panel.querySelector('.panel-header');
      if (header) {
        header.textContent = text;
      }
    }
  }

  /**
   * Add class to panel
   *
   * @param {number} index - Panel index
   * @param {string} className - Class name to add
   */
  addPanelClass(index, className) {
    const panel = this.panels[index];
    if (panel) {
      panel.classList.add(className);
    }
  }

  /**
   * Remove class from panel
   *
   * @param {number} index - Panel index
   * @param {string} className - Class name to remove
   */
  removePanelClass(index, className) {
    const panel = this.panels[index];
    if (panel) {
      panel.classList.remove(className);
    }
  }

  /**
   * Get current layout info
   *
   * @returns {Object} - Layout information
   */
  getLayoutInfo() {
    return {
      layout: this.currentLayout,
      panelCount: this.panels.length,
      fullscreenPanel: this.fullscreenPanel ?
        this.panels.indexOf(this.fullscreenPanel) : null,
      containerSize: {
        width: this.container.clientWidth,
        height: this.container.clientHeight
      }
    };
  }

  /**
   * Destroy layout manager and clean up
   */
  destroy() {
    window.removeEventListener('resize', this.handleResize);
    this.panels = [];
    this.fullscreenPanel = null;
  }
}

/**
 * Detect screen size category
 *
 * @returns {string} - 'small', 'medium', or 'large'
 */
export function detectScreenSize() {
  const width = window.innerWidth;

  if (width < 768) {
    return 'small';
  } else if (width < 1200) {
    return 'medium';
  } else {
    return 'large';
  }
}

/**
 * Calculate optimal panel dimensions
 *
 * @param {number} containerWidth - Container width in pixels
 * @param {number} containerHeight - Container height in pixels
 * @param {number} panelCount - Number of panels
 * @param {number} aspectRatio - Desired aspect ratio (width/height)
 * @returns {Object} - Optimal rows and columns
 */
export function calculateOptimalGrid(containerWidth, containerHeight, panelCount, aspectRatio = 16/9) {
  let bestRows = 1;
  let bestCols = panelCount;
  let bestWaste = Infinity;

  // Try different configurations
  for (let rows = 1; rows <= panelCount; rows++) {
    const cols = Math.ceil(panelCount / rows);

    const panelWidth = containerWidth / cols;
    const panelHeight = containerHeight / rows;
    const actualRatio = panelWidth / panelHeight;

    // Calculate how far from desired aspect ratio
    const waste = Math.abs(actualRatio - aspectRatio);

    if (waste < bestWaste) {
      bestWaste = waste;
      bestRows = rows;
      bestCols = cols;
    }
  }

  return { rows: bestRows, cols: bestCols };
}
