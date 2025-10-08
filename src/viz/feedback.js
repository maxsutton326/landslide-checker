/**
 * Visual Feedback System
 *
 * Provides visual feedback for user actions and system states
 */

/**
 * Show success message
 *
 * @param {string} message - Success message
 * @param {number} duration - Duration in ms
 */
export function showSuccess(message, duration = 3000) {
  showNotification(message, 'success', duration);
}

/**
 * Show error message
 *
 * @param {string} message - Error message
 * @param {number} duration - Duration in ms
 */
export function showError(message, duration = 5000) {
  showNotification(message, 'error', duration);
}

/**
 * Show warning message
 *
 * @param {string} message - Warning message
 * @param {number} duration - Duration in ms
 */
export function showWarning(message, duration = 4000) {
  showNotification(message, 'warning', duration);
}

/**
 * Show info message
 *
 * @param {string} message - Info message
 * @param {number} duration - Duration in ms
 */
export function showInfo(message, duration = 3000) {
  showNotification(message, 'info', duration);
}

/**
 * Show notification
 *
 * @param {string} message - Message text
 * @param {string} type - Notification type
 * @param {number} duration - Duration in ms
 */
export function showNotification(message, type = 'info', duration = 3000) {
  // Create container if it doesn't exist
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;

  // Icon
  const icon = document.createElement('span');
  icon.className = 'notification-icon';
  icon.textContent = getIcon(type);

  // Message
  const messageSpan = document.createElement('span');
  messageSpan.className = 'notification-message';
  messageSpan.textContent = message;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    removeNotification(notification);
  });

  notification.appendChild(icon);
  notification.appendChild(messageSpan);
  notification.appendChild(closeBtn);

  // Add to container
  container.appendChild(notification);

  // Animate in
  requestAnimationFrame(() => {
    notification.classList.add('notification-show');
  });

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(notification);
    }, duration);
  }

  return notification;
}

/**
 * Remove notification
 *
 * @param {HTMLElement} notification - Notification element
 */
function removeNotification(notification) {
  notification.classList.remove('notification-show');
  notification.classList.add('notification-hide');

  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

/**
 * Get icon for notification type
 *
 * @param {string} type - Notification type
 * @returns {string} - Icon character
 */
function getIcon(type) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || icons.info;
}

/**
 * Highlight element with animation
 *
 * @param {HTMLElement} element - Element to highlight
 * @param {string} color - Highlight color
 * @param {number} duration - Duration in ms
 */
export function highlightElement(element, color = '#4a9eff', duration = 1000) {
  if (!element) return;

  const originalBg = element.style.backgroundColor;
  const originalTransition = element.style.transition;

  element.style.transition = 'background-color 0.3s ease';
  element.style.backgroundColor = color;

  setTimeout(() => {
    element.style.backgroundColor = originalBg;

    setTimeout(() => {
      element.style.transition = originalTransition;
    }, 300);
  }, duration);
}

/**
 * Flash element
 *
 * @param {HTMLElement} element - Element to flash
 * @param {number} count - Number of flashes
 * @param {number} duration - Flash duration in ms
 */
export function flashElement(element, count = 2, duration = 200) {
  if (!element) return;

  let flashes = 0;
  const originalOpacity = element.style.opacity || '1';

  const flash = () => {
    if (flashes >= count * 2) {
      element.style.opacity = originalOpacity;
      return;
    }

    element.style.opacity = flashes % 2 === 0 ? '0.3' : originalOpacity;
    flashes++;

    setTimeout(flash, duration);
  };

  flash();
}

/**
 * Update label indicator status
 *
 * @param {string} status - Status ('saved', 'unsaved', 'saving', 'error')
 */
export function updateLabelIndicator(status) {
  let indicator = document.getElementById('label-status-indicator');

  if (!indicator) {
    // Create indicator
    indicator = document.createElement('div');
    indicator.id = 'label-status-indicator';
    indicator.className = 'label-status-indicator';

    const statusBar = document.getElementById('status') || document.getElementById('header');
    if (statusBar) {
      statusBar.appendChild(indicator);
    } else {
      document.body.appendChild(indicator);
    }
  }

  // Update status
  indicator.className = `label-status-indicator status-${status}`;

  const statusText = {
    saved: '✓ Saved',
    unsaved: '• Unsaved',
    saving: '⟳ Saving...',
    error: '✕ Save Error'
  };

  indicator.textContent = statusText[status] || status;

  // Auto-hide 'saved' status after 2 seconds
  if (status === 'saved') {
    setTimeout(() => {
      indicator.classList.add('fade-out');
    }, 2000);
  } else {
    indicator.classList.remove('fade-out');
  }
}

/**
 * Show loading overlay on element
 *
 * @param {HTMLElement} element - Element to overlay
 * @param {string} message - Loading message
 * @returns {HTMLElement} - Overlay element
 */
export function showLoadingOverlay(element, message = 'Loading...') {
  if (!element) return null;

  // Remove existing overlay
  hideLoadingOverlay(element);

  const overlay = document.createElement('div');
  overlay.className = 'feedback-loading-overlay';
  overlay.dataset.feedbackOverlay = 'true';

  const spinner = document.createElement('div');
  spinner.className = 'feedback-spinner';

  const messageDiv = document.createElement('div');
  messageDiv.className = 'feedback-message';
  messageDiv.textContent = message;

  overlay.appendChild(spinner);
  overlay.appendChild(messageDiv);

  element.style.position = 'relative';
  element.appendChild(overlay);

  return overlay;
}

/**
 * Hide loading overlay from element
 *
 * @param {HTMLElement} element - Element with overlay
 */
export function hideLoadingOverlay(element) {
  if (!element) return;

  const overlay = element.querySelector('[data-feedback-overlay]');
  if (overlay) {
    overlay.remove();
  }
}

/**
 * Show confirmation dialog
 *
 * @param {string} message - Confirmation message
 * @param {Function} onConfirm - Callback for confirm
 * @param {Function} onCancel - Callback for cancel
 */
export function showConfirmDialog(message, onConfirm, onCancel) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'feedback-confirm-overlay';

  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'feedback-confirm-dialog';

  // Message
  const messageDiv = document.createElement('div');
  messageDiv.className = 'feedback-confirm-message';
  messageDiv.textContent = message;

  // Buttons
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'feedback-confirm-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'feedback-confirm-btn cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'feedback-confirm-btn confirm-btn';
  confirmBtn.textContent = 'Confirm';
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });

  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(confirmBtn);

  dialog.appendChild(messageDiv);
  dialog.appendChild(buttonsDiv);
  overlay.appendChild(dialog);

  document.body.appendChild(overlay);

  // Focus confirm button
  confirmBtn.focus();

  // Handle Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Update progress bar
 *
 * @param {string} elementId - Progress bar element ID
 * @param {number} percent - Progress percentage (0-100)
 */
export function updateProgressBar(elementId, percent) {
  const progressBar = document.getElementById(elementId);
  if (!progressBar) return;

  const fill = progressBar.querySelector('.progress-fill') ||
               progressBar.querySelector('[role="progressbar"]');

  if (fill) {
    fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    fill.setAttribute('aria-valuenow', percent);
  }
}

/**
 * Shake element to indicate error
 *
 * @param {HTMLElement} element - Element to shake
 * @param {number} intensity - Shake intensity
 */
export function shakeElement(element, intensity = 10) {
  if (!element) return;

  const originalTransform = element.style.transform;

  let position = 0;
  let direction = 1;
  let iterations = 0;
  const maxIterations = 6;

  const shake = () => {
    if (iterations >= maxIterations) {
      element.style.transform = originalTransform;
      return;
    }

    position += direction * intensity;
    direction *= -1;
    intensity *= 0.8;
    iterations++;

    element.style.transform = `translateX(${position}px)`;

    requestAnimationFrame(shake);
  };

  shake();
}

/**
 * Pulse element to draw attention
 *
 * @param {HTMLElement} element - Element to pulse
 * @param {number} scale - Scale factor
 * @param {number} duration - Pulse duration
 */
export function pulseElement(element, scale = 1.05, duration = 200) {
  if (!element) return;

  const originalTransform = element.style.transform;
  const originalTransition = element.style.transition;

  element.style.transition = `transform ${duration}ms ease-in-out`;
  element.style.transform = `scale(${scale})`;

  setTimeout(() => {
    element.style.transform = originalTransform;

    setTimeout(() => {
      element.style.transition = originalTransition;
    }, duration);
  }, duration);
}

/**
 * Add badge to element
 *
 * @param {HTMLElement} element - Element to badge
 * @param {string} text - Badge text
 * @param {string} type - Badge type
 * @returns {HTMLElement} - Badge element
 */
export function addBadge(element, text, type = 'info') {
  if (!element) return null;

  // Remove existing badge
  removeBadge(element);

  const badge = document.createElement('span');
  badge.className = `feedback-badge badge-${type}`;
  badge.textContent = text;
  badge.dataset.feedbackBadge = 'true';

  element.style.position = 'relative';
  element.appendChild(badge);

  return badge;
}

/**
 * Remove badge from element
 *
 * @param {HTMLElement} element - Element with badge
 */
export function removeBadge(element) {
  if (!element) return;

  const badge = element.querySelector('[data-feedback-badge]');
  if (badge) {
    badge.remove();
  }
}

/**
 * Show tooltip on element
 *
 * @param {HTMLElement} element - Element to show tooltip on
 * @param {string} text - Tooltip text
 * @param {string} position - Tooltip position ('top', 'bottom', 'left', 'right')
 */
export function showTooltip(element, text, position = 'top') {
  if (!element) return;

  const tooltip = document.createElement('div');
  tooltip.className = `feedback-tooltip tooltip-${position}`;
  tooltip.textContent = text;
  tooltip.dataset.feedbackTooltip = 'true';

  element.style.position = 'relative';
  element.appendChild(tooltip);

  // Position tooltip
  requestAnimationFrame(() => {
    tooltip.classList.add('show');
  });

  return tooltip;
}

/**
 * Hide tooltip from element
 *
 * @param {HTMLElement} element - Element with tooltip
 */
export function hideTooltip(element) {
  if (!element) return;

  const tooltip = element.querySelector('[data-feedback-tooltip]');
  if (tooltip) {
    tooltip.classList.remove('show');
    setTimeout(() => tooltip.remove(), 200);
  }
}
