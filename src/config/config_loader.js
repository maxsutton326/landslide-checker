import yaml from 'js-yaml';
import { readFileSync } from 'fs';

/**
 * Default configuration values
 */
const DEFAULTS = {
  display: {
    context_buffer: 1.5,
    min_window: 128,
    max_window: 512
  },
  labels: [
    { code: 0, name: "Not Evaluated", color: "#808080" },
    { code: 1, name: "Correct Mapping", color: "#00FF00" },
    { code: 2, name: "Mapping Error", color: "#FF0000" }
  ]
};

/**
 * Validates a configuration object
 * @param {Object} config - Configuration object to validate
 * @returns {{valid: boolean, errors: string[]}} - Validation result
 */
export function validateConfig(config) {
  const errors = [];

  // Validate project section
  if (!config.project) {
    errors.push('Missing required section: project');
    return { valid: false, errors };
  }

  if (!config.project.name) {
    errors.push('Missing required field: project.name');
  }

  if (!config.project.date) {
    errors.push('Missing required field: project.date');
  }

  // Validate data_sources section
  if (!config.data_sources) {
    errors.push('Missing required section: data_sources');
    return { valid: false, errors };
  }

  // Validate numpy_stack
  if (!config.data_sources.numpy_stack) {
    errors.push('Missing required section: data_sources.numpy_stack');
  } else {
    const stack = config.data_sources.numpy_stack;

    if (!stack.file) {
      errors.push('Missing required field: data_sources.numpy_stack.file');
    }

    if (stack.epsg === undefined) {
      errors.push('Missing required field: data_sources.numpy_stack.epsg');
    } else if (typeof stack.epsg !== 'number') {
      errors.push('Invalid type for data_sources.numpy_stack.epsg: must be a number');
    }

    if (stack.origin !== undefined) {
      if (!Array.isArray(stack.origin) || stack.origin.length !== 2 ||
          !stack.origin.every(v => typeof v === 'number')) {
        errors.push('Invalid data_sources.numpy_stack.origin: must be array of two numbers');
      }
    }

    if (stack.pixel_size !== undefined) {
      if (typeof stack.pixel_size !== 'number' || stack.pixel_size <= 0) {
        errors.push('Invalid data_sources.numpy_stack.pixel_size: must be positive number');
      }
    }
  }

  // Validate shapefile
  if (!config.data_sources.shapefile) {
    errors.push('Missing required section: data_sources.shapefile');
  } else {
    const shapefile = config.data_sources.shapefile;

    if (!shapefile.file) {
      errors.push('Missing required field: data_sources.shapefile.file');
    }

    if (!shapefile.id_field) {
      errors.push('Missing required field: data_sources.shapefile.id_field');
    }
  }

  // Validate source_images (optional)
  if (config.data_sources.source_images) {
    if (!Array.isArray(config.data_sources.source_images)) {
      errors.push('data_sources.source_images must be an array');
    } else {
      config.data_sources.source_images.forEach((img, idx) => {
        if (!img.file) {
          errors.push(`Missing file field in source_images[${idx}]`);
        }
        if (!img.type) {
          errors.push(`Missing type field in source_images[${idx}]`);
        } else if (!['before', 'after'].includes(img.type)) {
          errors.push(`Invalid type in source_images[${idx}]: must be 'before' or 'after'`);
        }
      });
    }
  }

  // Validate display settings (if provided)
  if (config.display) {
    if (config.display.context_buffer !== undefined) {
      if (typeof config.display.context_buffer !== 'number' || config.display.context_buffer <= 0) {
        errors.push('display.context_buffer must be a positive number');
      }
    }

    if (config.display.min_window !== undefined && config.display.max_window !== undefined) {
      if (config.display.min_window >= config.display.max_window) {
        errors.push('display.min_window must be less than display.max_window');
      }
    }
  }

  // Validate labels (if provided)
  if (config.labels) {
    if (!Array.isArray(config.labels)) {
      errors.push('labels must be an array');
    } else {
      const codes = new Set();
      config.labels.forEach((label, idx) => {
        if (label.code === undefined) {
          errors.push(`Missing code field in labels[${idx}]`);
        } else {
          if (codes.has(label.code)) {
            errors.push(`Duplicate label code: ${label.code}. Label codes must be unique`);
          }
          codes.add(label.code);
        }

        if (!label.name) {
          errors.push(`Missing name field in labels[${idx}]`);
        }

        if (!label.color) {
          errors.push(`Missing color field in labels[${idx}]`);
        } else if (!/^#[0-9A-Fa-f]{6}$/.test(label.color)) {
          errors.push(`Invalid color format in labels[${idx}]: must be hex format like #RRGGBB`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Applies default values to configuration
 * @param {Object} config - Configuration object
 * @returns {Object} - Configuration with defaults applied
 */
function applyDefaults(config) {
  const result = { ...config };

  // Apply display defaults
  if (!result.display) {
    result.display = { ...DEFAULTS.display };
  } else {
    result.display = {
      ...DEFAULTS.display,
      ...result.display
    };
  }

  // Apply label defaults
  if (!result.labels || result.labels.length === 0) {
    result.labels = [...DEFAULTS.labels];
  }

  return result;
}

/**
 * Loads and validates a configuration file
 * @param {string} configPath - Path to YAML configuration file
 * @returns {Promise<Object>} - Validated configuration object
 * @throws {Error} - If file cannot be read or configuration is invalid
 */
export async function loadConfig(configPath) {
  try {
    // Read and parse YAML file
    const fileContents = readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents);

    if (!config || typeof config !== 'object') {
      throw new Error('Configuration file must contain a valid YAML object');
    }

    // Apply defaults
    const configWithDefaults = applyDefaults(config);

    // Validate configuration
    const validation = validateConfig(configWithDefaults);

    if (!validation.valid) {
      const errorMsg = 'Configuration validation failed:\n' +
        validation.errors.map(err => `  - ${err}`).join('\n');
      throw new Error(errorMsg);
    }

    return configWithDefaults;

  } catch (error) {
    // Re-throw with more context
    if (error.code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    throw error;
  }
}

/**
 * Gets the default configuration values
 * @returns {Object} - Default configuration values
 */
export function getDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}
