/**
 * Bulk Operations
 *
 * Perform bulk labeling operations on multiple landslides
 */

/**
 * Apply label to range of landslides
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @param {string} labelCode - Label code to apply
 * @param {string} confidence - Confidence level
 * @param {string} notes - Notes
 * @returns {Object} - Result object
 */
export function applyToRange(labelManager, landslides, startIndex, endIndex, labelCode, confidence = 'medium', notes = '') {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  if (startIndex < 0 || endIndex >= landslides.length || startIndex > endIndex) {
    throw new Error('Invalid range');
  }

  const applied = [];
  const errors = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);

    try {
      labelManager.setLabel(id, labelCode, confidence, notes);
      applied.push({ index: i, id });
    } catch (error) {
      errors.push({ index: i, id, error: error.message });
    }
  }

  return {
    success: errors.length === 0,
    applied: applied.length,
    errors: errors.length,
    details: { applied, errors }
  };
}

/**
 * Copy previous label forward
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} currentIndex - Current index
 * @returns {Object|null} - Label data or null
 */
export function copyPrevious(labelManager, landslides, currentIndex) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  if (currentIndex <= 0) {
    return null;
  }

  // Find previous labeled landslide
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevLandslide = landslides[i];
    const prevId = String(prevLandslide.properties?.FID || prevLandslide.id);
    const prevLabel = labelManager.getLabel(prevId);

    if (prevLabel) {
      // Copy to current
      const currentLandslide = landslides[currentIndex];
      const currentId = String(currentLandslide.properties?.FID || currentLandslide.id);

      return labelManager.setLabel(
        currentId,
        prevLabel.label,
        prevLabel.confidence,
        prevLabel.notes ? `[Copied] ${prevLabel.notes}` : '[Copied from previous]'
      );
    }
  }

  return null;
}

/**
 * Clear labels for range
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @returns {Object} - Result object
 */
export function clearRange(labelManager, landslides, startIndex, endIndex) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  if (startIndex < 0 || endIndex >= landslides.length || startIndex > endIndex) {
    throw new Error('Invalid range');
  }

  const cleared = [];
  const notFound = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);

    if (labelManager.removeLabel(id)) {
      cleared.push({ index: i, id });
    } else {
      notFound.push({ index: i, id });
    }
  }

  return {
    cleared: cleared.length,
    notFound: notFound.length,
    details: { cleared, notFound }
  };
}

/**
 * Clear all labels
 *
 * @param {LabelManager} labelManager - Label manager
 * @returns {number} - Number of labels cleared
 */
export function clearAll(labelManager) {
  if (!labelManager) {
    throw new Error('LabelManager is required');
  }

  const count = labelManager.labels.size;
  labelManager.clearAll();

  return count;
}

/**
 * Apply label to filtered landslides
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {Function} filterFn - Filter function
 * @param {string} labelCode - Label code to apply
 * @param {string} confidence - Confidence level
 * @param {string} notes - Notes
 * @returns {Object} - Result object
 */
export function applyToFiltered(labelManager, landslides, filterFn, labelCode, confidence = 'medium', notes = '') {
  if (!labelManager || !landslides || !filterFn) {
    throw new Error('LabelManager, landslides, and filterFn are required');
  }

  const applied = [];
  const skipped = [];

  landslides.forEach((landslide, index) => {
    const id = String(landslide.properties?.FID || landslide.id);

    if (filterFn(landslide, index)) {
      try {
        labelManager.setLabel(id, labelCode, confidence, notes);
        applied.push({ index, id });
      } catch (error) {
        skipped.push({ index, id, error: error.message });
      }
    }
  });

  return {
    applied: applied.length,
    skipped: skipped.length,
    details: { applied, skipped }
  };
}

/**
 * Update confidence for range
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @param {string} confidence - New confidence level
 * @returns {Object} - Result object
 */
export function updateConfidenceRange(labelManager, landslides, startIndex, endIndex, confidence) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  if (startIndex < 0 || endIndex >= landslides.length || startIndex > endIndex) {
    throw new Error('Invalid range');
  }

  const validConfidence = ['low', 'medium', 'high'];
  if (!validConfidence.includes(confidence)) {
    throw new Error('Invalid confidence level');
  }

  const updated = [];
  const notFound = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);
    const existingLabel = labelManager.getLabel(id);

    if (existingLabel) {
      labelManager.setLabel(
        id,
        existingLabel.label,
        confidence,
        existingLabel.notes
      );
      updated.push({ index: i, id });
    } else {
      notFound.push({ index: i, id });
    }
  }

  return {
    updated: updated.length,
    notFound: notFound.length,
    details: { updated, notFound }
  };
}

/**
 * Append notes to range
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @param {string} notes - Notes to append
 * @param {string} separator - Separator between old and new notes
 * @returns {Object} - Result object
 */
export function appendNotesRange(labelManager, landslides, startIndex, endIndex, notes, separator = '\n') {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  if (startIndex < 0 || endIndex >= landslides.length || startIndex > endIndex) {
    throw new Error('Invalid range');
  }

  const updated = [];
  const notFound = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);
    const existingLabel = labelManager.getLabel(id);

    if (existingLabel) {
      const newNotes = existingLabel.notes ?
        `${existingLabel.notes}${separator}${notes}` : notes;

      labelManager.setLabel(
        id,
        existingLabel.label,
        existingLabel.confidence,
        newNotes
      );
      updated.push({ index: i, id });
    } else {
      notFound.push({ index: i, id });
    }
  }

  return {
    updated: updated.length,
    notFound: notFound.length,
    details: { updated, notFound }
  };
}

/**
 * Replace label code in range
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @param {string} oldCode - Old label code
 * @param {string} newCode - New label code
 * @returns {Object} - Result object
 */
export function replaceLabelRange(labelManager, landslides, startIndex, endIndex, oldCode, newCode) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  if (startIndex < 0 || endIndex >= landslides.length || startIndex > endIndex) {
    throw new Error('Invalid range');
  }

  const replaced = [];
  const skipped = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);
    const existingLabel = labelManager.getLabel(id);

    if (existingLabel && existingLabel.label === oldCode) {
      labelManager.setLabel(
        id,
        newCode,
        existingLabel.confidence,
        existingLabel.notes
      );
      replaced.push({ index: i, id });
    } else {
      skipped.push({ index: i, id });
    }
  }

  return {
    replaced: replaced.length,
    skipped: skipped.length,
    details: { replaced, skipped }
  };
}

/**
 * Get unlabeled landslides
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @returns {Array} - Unlabeled landslides
 */
export function getUnlabeled(labelManager, landslides) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  const unlabeled = [];

  landslides.forEach((landslide, index) => {
    const id = String(landslide.properties?.FID || landslide.id);

    if (!labelManager.hasLabel(id)) {
      unlabeled.push({ index, id, landslide });
    }
  });

  return unlabeled;
}

/**
 * Get labeled landslides
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @returns {Array} - Labeled landslides
 */
export function getLabeled(labelManager, landslides) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  const labeled = [];

  landslides.forEach((landslide, index) => {
    const id = String(landslide.properties?.FID || landslide.id);
    const label = labelManager.getLabel(id);

    if (label) {
      labeled.push({ index, id, landslide, label });
    }
  });

  return labeled;
}

/**
 * Jump to next unlabeled landslide
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} currentIndex - Current index
 * @returns {number|null} - Next unlabeled index or null
 */
export function findNextUnlabeled(labelManager, landslides, currentIndex) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  for (let i = currentIndex + 1; i < landslides.length; i++) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);

    if (!labelManager.hasLabel(id)) {
      return i;
    }
  }

  return null;
}

/**
 * Jump to previous unlabeled landslide
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} landslides - Array of landslides
 * @param {number} currentIndex - Current index
 * @returns {number|null} - Previous unlabeled index or null
 */
export function findPreviousUnlabeled(labelManager, landslides, currentIndex) {
  if (!labelManager || !landslides) {
    throw new Error('LabelManager and landslides are required');
  }

  for (let i = currentIndex - 1; i >= 0; i--) {
    const landslide = landslides[i];
    const id = String(landslide.properties?.FID || landslide.id);

    if (!labelManager.hasLabel(id)) {
      return i;
    }
  }

  return null;
}

/**
 * Batch import labels from array
 *
 * @param {LabelManager} labelManager - Label manager
 * @param {Array} labelArray - Array of label objects
 * @param {boolean} overwrite - Whether to overwrite existing labels
 * @returns {Object} - Result object
 */
export function batchImport(labelManager, labelArray, overwrite = false) {
  if (!labelManager || !labelArray) {
    throw new Error('LabelManager and labelArray are required');
  }

  const imported = [];
  const skipped = [];
  const errors = [];

  labelArray.forEach((labelData, index) => {
    try {
      const id = String(labelData.landslideId);

      // Check if should skip
      if (!overwrite && labelManager.hasLabel(id)) {
        skipped.push({ index, id });
        return;
      }

      labelManager.setLabel(
        id,
        labelData.label,
        labelData.confidence || 'medium',
        labelData.notes || ''
      );

      imported.push({ index, id });
    } catch (error) {
      errors.push({
        index,
        error: error.message,
        data: labelData
      });
    }
  });

  return {
    imported: imported.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { imported, skipped, errors }
  };
}
