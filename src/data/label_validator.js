/**
 * Label Validator
 *
 * Validates label data for completeness and consistency
 */

/**
 * Validate a single label
 *
 * @param {Object} label - Label data
 * @param {Array} validCodes - Valid label codes
 * @returns {Object} - Validation result
 */
export function validateLabel(label, validCodes = []) {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!label.landslideId) {
    errors.push('Missing landslide ID');
  }

  if (!label.label) {
    errors.push('Missing label code');
  }

  // Validate label code
  if (label.label && validCodes.length > 0 && !validCodes.includes(label.label)) {
    errors.push(`Invalid label code: ${label.label}`);
  }

  // Validate confidence
  const validConfidence = ['low', 'medium', 'high'];
  if (label.confidence && !validConfidence.includes(label.confidence)) {
    errors.push(`Invalid confidence level: ${label.confidence}`);
  }

  // Check for notes when confidence is low
  if (label.confidence === 'low' && (!label.notes || label.notes.trim().length === 0)) {
    warnings.push('Low confidence labels should include notes');
  }

  // Validate timestamp
  if (label.timestamp && (typeof label.timestamp !== 'number' || label.timestamp <= 0)) {
    errors.push('Invalid timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check completeness of labels
 *
 * @param {Map|Array} labels - Labels to check
 * @param {Array} landslides - All landslides
 * @returns {Object} - Completeness report
 */
export function checkCompleteness(labels, landslides) {
  const labelMap = labels instanceof Map ? labels : new Map(labels);
  const totalLandslides = landslides.length;
  const labeledCount = labelMap.size;
  const unlabeledCount = totalLandslides - labeledCount;

  // Find unlabeled landslides
  const unlabeled = [];
  landslides.forEach((landslide, index) => {
    const id = landslide.properties?.FID || landslide.id;
    if (!labelMap.has(String(id))) {
      unlabeled.push({
        index,
        id,
        landslide
      });
    }
  });

  // Calculate percentage
  const percentComplete = totalLandslides > 0 ?
    (labeledCount / totalLandslides) * 100 : 0;

  return {
    total: totalLandslides,
    labeled: labeledCount,
    unlabeled: unlabeledCount,
    percentComplete,
    unlabeledList: unlabeled,
    isComplete: unlabeledCount === 0
  };
}

/**
 * Find inconsistencies in labels
 *
 * @param {Map|Array} labels - Labels to check
 * @returns {Object} - Inconsistencies report
 */
export function findInconsistencies(labels) {
  const labelMap = labels instanceof Map ? labels : new Map(labels);
  const inconsistencies = [];

  labelMap.forEach((label, landslideId) => {
    const validation = validateLabel(label);

    if (!validation.valid) {
      inconsistencies.push({
        landslideId,
        type: 'validation-error',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Check for suspicious patterns
    // Empty notes with 'uncertain' label
    if (label.label === 'uncertain' &&
        (!label.notes || label.notes.trim().length === 0)) {
      inconsistencies.push({
        landslideId,
        type: 'missing-justification',
        message: 'Uncertain labels should include notes explaining why'
      });
    }

    // High confidence with flag
    if (label.label === 'flag' && label.confidence === 'high') {
      inconsistencies.push({
        landslideId,
        type: 'confidence-mismatch',
        message: 'Flagged items should not have high confidence'
      });
    }

    // Skip with notes
    if (label.label === 'skip' &&
        label.notes && label.notes.trim().length > 0) {
      inconsistencies.push({
        landslideId,
        type: 'unnecessary-notes',
        message: 'Skipped items typically don\'t need notes'
      });
    }
  });

  return {
    count: inconsistencies.length,
    inconsistencies
  };
}

/**
 * Generate validation report
 *
 * @param {Map|Array} labels - Labels to validate
 * @param {Array} landslides - All landslides
 * @param {Array} validCodes - Valid label codes
 * @returns {Object} - Complete validation report
 */
export function generateReport(labels, landslides, validCodes = []) {
  const labelMap = labels instanceof Map ? labels : new Map(labels);

  // Completeness check
  const completeness = checkCompleteness(labelMap, landslides);

  // Inconsistency check
  const inconsistencies = findInconsistencies(labelMap);

  // Statistics by label
  const byLabel = {};
  labelMap.forEach(label => {
    if (!byLabel[label.label]) {
      byLabel[label.label] = 0;
    }
    byLabel[label.label]++;
  });

  // Statistics by confidence
  const byConfidence = {
    high: 0,
    medium: 0,
    low: 0
  };
  labelMap.forEach(label => {
    if (label.confidence) {
      byConfidence[label.confidence]++;
    }
  });

  // Count labels with notes
  const withNotes = Array.from(labelMap.values()).filter(
    label => label.notes && label.notes.trim().length > 0
  ).length;

  // Overall validation status
  const isValid = inconsistencies.count === 0;
  const isComplete = completeness.isComplete;

  return {
    timestamp: Date.now(),
    valid: isValid,
    complete: isComplete,
    completeness,
    inconsistencies,
    statistics: {
      total: labelMap.size,
      byLabel,
      byConfidence,
      withNotes
    },
    summary: {
      totalLandslides: landslides.length,
      labeledCount: labelMap.size,
      unlabeledCount: completeness.unlabeled,
      percentComplete: completeness.percentComplete,
      errorCount: inconsistencies.count,
      warningCount: inconsistencies.inconsistencies.filter(
        i => i.type !== 'validation-error'
      ).length
    }
  };
}

/**
 * Validate label consistency across similar landslides
 *
 * @param {Map|Array} labels - Labels to check
 * @param {Array} landslides - All landslides
 * @param {Function} similarityFn - Function to determine if landslides are similar
 * @returns {Array} - Potential inconsistencies
 */
export function checkSpatialConsistency(labels, landslides, similarityFn) {
  const labelMap = labels instanceof Map ? labels : new Map(labels);
  const potentialIssues = [];

  // Check each pair of nearby landslides
  for (let i = 0; i < landslides.length; i++) {
    for (let j = i + 1; j < landslides.length; j++) {
      const ls1 = landslides[i];
      const ls2 = landslides[j];

      // Check if similar
      if (similarityFn && !similarityFn(ls1, ls2)) {
        continue;
      }

      const id1 = String(ls1.properties?.FID || ls1.id);
      const id2 = String(ls2.properties?.FID || ls2.id);

      const label1 = labelMap.get(id1);
      const label2 = labelMap.get(id2);

      // If both labeled but different
      if (label1 && label2 && label1.label !== label2.label) {
        potentialIssues.push({
          landslide1: id1,
          landslide2: id2,
          label1: label1.label,
          label2: label2.label,
          message: 'Similar landslides have different labels'
        });
      }
    }
  }

  return potentialIssues;
}

/**
 * Get recommendations for improving label quality
 *
 * @param {Object} validationReport - Validation report
 * @returns {Array} - Recommendations
 */
export function getRecommendations(validationReport) {
  const recommendations = [];

  // Check completeness
  if (validationReport.completeness.percentComplete < 100) {
    recommendations.push({
      priority: 'high',
      category: 'completeness',
      message: `${validationReport.completeness.unlabeled} landslides remain unlabeled`,
      action: 'Label remaining landslides to complete the dataset'
    });
  }

  // Check for high number of uncertain labels
  const uncertainCount = validationReport.statistics.byLabel['uncertain'] || 0;
  const uncertainPercent = (uncertainCount / validationReport.statistics.total) * 100;

  if (uncertainPercent > 20) {
    recommendations.push({
      priority: 'medium',
      category: 'quality',
      message: `${uncertainPercent.toFixed(1)}% of labels are marked as uncertain`,
      action: 'Review uncertain labels and try to make definitive classifications'
    });
  }

  // Check for low confidence labels
  const lowConfCount = validationReport.statistics.byConfidence.low || 0;
  const lowConfPercent = (lowConfCount / validationReport.statistics.total) * 100;

  if (lowConfPercent > 15) {
    recommendations.push({
      priority: 'medium',
      category: 'quality',
      message: `${lowConfPercent.toFixed(1)}% of labels have low confidence`,
      action: 'Review low confidence labels and add detailed notes'
    });
  }

  // Check for labels without notes
  const notesPercent = (validationReport.statistics.withNotes / validationReport.statistics.total) * 100;

  if (notesPercent < 10) {
    recommendations.push({
      priority: 'low',
      category: 'documentation',
      message: 'Very few labels include notes',
      action: 'Consider adding notes to difficult or uncertain cases'
    });
  }

  // Check for inconsistencies
  if (validationReport.inconsistencies.count > 0) {
    recommendations.push({
      priority: 'high',
      category: 'validation',
      message: `${validationReport.inconsistencies.count} inconsistencies found`,
      action: 'Review and fix validation errors'
    });
  }

  return recommendations;
}

/**
 * Check if labels meet quality thresholds
 *
 * @param {Object} validationReport - Validation report
 * @param {Object} thresholds - Quality thresholds
 * @returns {Object} - Quality check result
 */
export function checkQualityThresholds(validationReport, thresholds = {}) {
  const defaultThresholds = {
    minCompleteness: 95, // Percent
    maxUncertain: 15, // Percent
    maxLowConfidence: 10, // Percent
    minWithNotes: 5, // Percent
    maxInconsistencies: 0 // Count
  };

  const t = { ...defaultThresholds, ...thresholds };
  const passed = {};
  const failed = {};

  // Check completeness
  if (validationReport.completeness.percentComplete >= t.minCompleteness) {
    passed.completeness = true;
  } else {
    failed.completeness = {
      actual: validationReport.completeness.percentComplete,
      threshold: t.minCompleteness
    };
  }

  // Check uncertain percentage
  const uncertainCount = validationReport.statistics.byLabel['uncertain'] || 0;
  const uncertainPercent = (uncertainCount / validationReport.statistics.total) * 100;

  if (uncertainPercent <= t.maxUncertain) {
    passed.uncertain = true;
  } else {
    failed.uncertain = {
      actual: uncertainPercent,
      threshold: t.maxUncertain
    };
  }

  // Check low confidence percentage
  const lowConfCount = validationReport.statistics.byConfidence.low || 0;
  const lowConfPercent = validationReport.statistics.total > 0 ?
    (lowConfCount / validationReport.statistics.total) * 100 : 0;

  if (lowConfPercent <= t.maxLowConfidence) {
    passed.lowConfidence = true;
  } else {
    failed.lowConfidence = {
      actual: lowConfPercent,
      threshold: t.maxLowConfidence
    };
  }

  // Check notes percentage
  const notesPercent = validationReport.statistics.total > 0 ?
    (validationReport.statistics.withNotes / validationReport.statistics.total) * 100 : 0;

  if (notesPercent >= t.minWithNotes) {
    passed.notes = true;
  } else {
    failed.notes = {
      actual: notesPercent,
      threshold: t.minWithNotes
    };
  }

  // Check inconsistencies
  if (validationReport.inconsistencies.count <= t.maxInconsistencies) {
    passed.inconsistencies = true;
  } else {
    failed.inconsistencies = {
      actual: validationReport.inconsistencies.count,
      threshold: t.maxInconsistencies
    };
  }

  return {
    passedAll: Object.keys(failed).length === 0,
    passed,
    failed,
    score: (Object.keys(passed).length / (Object.keys(passed).length + Object.keys(failed).length)) * 100
  };
}
