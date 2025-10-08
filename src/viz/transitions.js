/**
 * Transition Effects
 *
 * Smooth transitions between landslides with loading indicators
 */

/**
 * Fade transition between canvases
 *
 * @param {HTMLCanvasElement} fromCanvas - Source canvas
 * @param {HTMLCanvasElement} toCanvas - Target canvas
 * @param {number} duration - Transition duration in ms
 * @returns {Promise} - Resolves when transition completes
 */
export function fadeTransition(fromCanvas, toCanvas, duration = 300) {
  return new Promise((resolve) => {
    if (!fromCanvas || !toCanvas) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const fromOpacity = parseFloat(getComputedStyle(fromCanvas).opacity) || 1;
    const toOpacity = 0;

    // Set initial states
    toCanvas.style.opacity = '0';
    toCanvas.style.display = 'block';

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out function
      const eased = progress < 0.5 ?
        2 * progress * progress :
        1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Update opacities
      fromCanvas.style.opacity = fromOpacity - (fromOpacity * eased);
      toCanvas.style.opacity = eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Transition complete
        fromCanvas.style.opacity = '0';
        fromCanvas.style.display = 'none';
        toCanvas.style.opacity = '1';
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Crossfade transition
 *
 * @param {HTMLCanvasElement} fromCanvas - Source canvas
 * @param {HTMLCanvasElement} toCanvas - Target canvas
 * @param {number} duration - Transition duration in ms
 * @returns {Promise} - Resolves when transition completes
 */
export function crossfadeTransition(fromCanvas, toCanvas, duration = 300) {
  return new Promise((resolve) => {
    if (!fromCanvas || !toCanvas) {
      resolve();
      return;
    }

    const startTime = performance.now();

    // Both canvases visible during crossfade
    fromCanvas.style.display = 'block';
    toCanvas.style.display = 'block';
    fromCanvas.style.opacity = '1';
    toCanvas.style.opacity = '0';

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out
      const eased = progress < 0.5 ?
        2 * progress * progress :
        1 - Math.pow(-2 * progress + 2, 2) / 2;

      fromCanvas.style.opacity = 1 - eased;
      toCanvas.style.opacity = eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        fromCanvas.style.display = 'none';
        toCanvas.style.opacity = '1';
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Show loading indicator on panel
 *
 * @param {HTMLElement} panel - Panel element
 * @param {string} message - Optional loading message
 * @returns {HTMLElement} - Loading element
 */
export function showLoading(panel, message = 'Loading...') {
  if (!panel) return null;

  // Remove existing loader
  hideLoading(panel);

  const loader = document.createElement('div');
  loader.className = 'loading-overlay';
  loader.dataset.transitionLoader = 'true';

  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';

  const messageDiv = document.createElement('div');
  messageDiv.className = 'loading-message';
  messageDiv.textContent = message;

  loader.appendChild(spinner);
  loader.appendChild(messageDiv);

  panel.appendChild(loader);

  // Fade in
  requestAnimationFrame(() => {
    loader.style.opacity = '1';
  });

  return loader;
}

/**
 * Hide loading indicator from panel
 *
 * @param {HTMLElement} panel - Panel element
 * @param {number} fadeOut - Fade out duration in ms
 * @returns {Promise} - Resolves when hidden
 */
export function hideLoading(panel, fadeOut = 200) {
  return new Promise((resolve) => {
    if (!panel) {
      resolve();
      return;
    }

    const loader = panel.querySelector('[data-transition-loader]');
    if (!loader) {
      resolve();
      return;
    }

    // Fade out
    loader.style.opacity = '0';

    setTimeout(() => {
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
      resolve();
    }, fadeOut);
  });
}

/**
 * Show progress animation during data loading
 *
 * @param {HTMLElement} panel - Panel element
 * @param {number} progress - Progress value 0-1
 */
export function showProgress(panel, progress) {
  if (!panel) return;

  let loader = panel.querySelector('[data-transition-loader]');
  if (!loader) {
    loader = showLoading(panel, 'Loading...');
  }

  let progressBar = loader.querySelector('.loading-progress-bar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.className = 'loading-progress-bar';

    const progressFill = document.createElement('div');
    progressFill.className = 'loading-progress-fill';
    progressBar.appendChild(progressFill);

    loader.appendChild(progressBar);
  }

  const progressFill = progressBar.querySelector('.loading-progress-fill');
  if (progressFill) {
    progressFill.style.width = `${progress * 100}%`;
  }

  // Update message
  const messageDiv = loader.querySelector('.loading-message');
  if (messageDiv) {
    messageDiv.textContent = `Loading... ${Math.round(progress * 100)}%`;
  }
}

/**
 * Slide transition between panels
 *
 * @param {HTMLElement} fromPanel - Source panel
 * @param {HTMLElement} toPanel - Target panel
 * @param {string} direction - 'left' or 'right'
 * @param {number} duration - Transition duration in ms
 * @returns {Promise} - Resolves when transition completes
 */
export function slideTransition(fromPanel, toPanel, direction = 'left', duration = 300) {
  return new Promise((resolve) => {
    if (!fromPanel || !toPanel) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const distance = fromPanel.offsetWidth;

    // Set initial positions
    toPanel.style.display = 'block';
    toPanel.style.position = 'absolute';
    toPanel.style.top = '0';
    toPanel.style.left = direction === 'left' ? `${distance}px` : `-${distance}px`;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      const offset = distance * eased;

      if (direction === 'left') {
        fromPanel.style.left = `-${offset}px`;
        toPanel.style.left = `${distance - offset}px`;
      } else {
        fromPanel.style.left = `${offset}px`;
        toPanel.style.left = `${-distance + offset}px`;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Reset positions
        fromPanel.style.display = 'none';
        fromPanel.style.position = '';
        fromPanel.style.left = '';
        toPanel.style.position = '';
        toPanel.style.left = '';
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Pulse animation for element
 *
 * @param {HTMLElement} element - Element to pulse
 * @param {number} duration - Pulse duration in ms
 * @param {number} scale - Scale factor
 * @returns {Promise} - Resolves when animation completes
 */
export function pulseAnimation(element, duration = 200, scale = 1.05) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const originalTransform = element.style.transform || '';

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Pulse up then down
      let currentScale;
      if (progress < 0.5) {
        currentScale = 1 + (scale - 1) * (progress * 2);
      } else {
        currentScale = scale - (scale - 1) * ((progress - 0.5) * 2);
      }

      element.style.transform = `${originalTransform} scale(${currentScale})`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.transform = originalTransform;
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Shake animation for error indication
 *
 * @param {HTMLElement} element - Element to shake
 * @param {number} duration - Shake duration in ms
 * @param {number} intensity - Shake intensity in pixels
 * @returns {Promise} - Resolves when animation completes
 */
export function shakeAnimation(element, duration = 400, intensity = 10) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const originalTransform = element.style.transform || '';

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Diminishing shake
      const currentIntensity = intensity * (1 - progress);
      const offset = Math.sin(progress * 10 * Math.PI) * currentIntensity;

      element.style.transform = `${originalTransform} translateX(${offset}px)`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.transform = originalTransform;
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Highlight animation
 *
 * @param {HTMLElement} element - Element to highlight
 * @param {string} color - Highlight color
 * @param {number} duration - Animation duration in ms
 * @returns {Promise} - Resolves when animation completes
 */
export function highlightAnimation(element, color = '#4a9eff', duration = 1000) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const originalBg = element.style.backgroundColor;

    element.style.backgroundColor = color;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Fade back to original
      element.style.backgroundColor = color;
      element.style.opacity = 1 - progress * 0.5;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.style.backgroundColor = originalBg;
        element.style.opacity = '1';
        resolve();
      }
    }

    setTimeout(() => {
      requestAnimationFrame(animate);
    }, 100);
  });
}

/**
 * Create ripple effect
 *
 * @param {HTMLElement} element - Element to add ripple to
 * @param {Event} event - Click event
 * @param {string} color - Ripple color
 * @param {number} duration - Ripple duration in ms
 */
export function rippleEffect(element, event, color = 'rgba(255,255,255,0.3)', duration = 600) {
  const rect = element.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const ripple = document.createElement('div');
  ripple.className = 'ripple-effect';
  ripple.style.position = 'absolute';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.style.width = '0';
  ripple.style.height = '0';
  ripple.style.borderRadius = '50%';
  ripple.style.backgroundColor = color;
  ripple.style.pointerEvents = 'none';
  ripple.style.transform = 'translate(-50%, -50%)';

  element.style.position = 'relative';
  element.style.overflow = 'hidden';
  element.appendChild(ripple);

  const size = Math.max(rect.width, rect.height) * 2;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const currentSize = size * progress;
    const opacity = 1 - progress;

    ripple.style.width = `${currentSize}px`;
    ripple.style.height = `${currentSize}px`;
    ripple.style.opacity = opacity;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      ripple.remove();
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Animate number counter
 *
 * @param {HTMLElement} element - Element to update
 * @param {number} from - Start value
 * @param {number} to - End value
 * @param {number} duration - Animation duration in ms
 * @param {Function} formatter - Optional number formatter
 * @returns {Promise} - Resolves when animation completes
 */
export function animateCounter(element, from, to, duration = 500, formatter = null) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const startTime = performance.now();
    const diff = to - from;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = from + diff * eased;
      const formatted = formatter ? formatter(current) : Math.round(current);

      element.textContent = formatted;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = formatter ? formatter(to) : to;
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}

/**
 * Smooth scroll to element
 *
 * @param {HTMLElement} element - Element to scroll to
 * @param {number} duration - Scroll duration in ms
 * @param {number} offset - Offset from top in pixels
 * @returns {Promise} - Resolves when scroll completes
 */
export function smoothScrollTo(element, duration = 500, offset = 0) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }

    const startPosition = window.pageYOffset;
    const targetPosition = element.getBoundingClientRect().top + startPosition - offset;
    const distance = targetPosition - startPosition;
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out
      const eased = progress < 0.5 ?
        2 * progress * progress :
        1 - Math.pow(-2 * progress + 2, 2) / 2;

      window.scrollTo(0, startPosition + distance * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}
