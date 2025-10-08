import { test, describe } from 'node:test';
import assert from 'node:assert';
import { loadConfig, validateConfig } from '../src/config/config_loader.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// Test data directory
const TEST_DIR = join(process.cwd(), 'tests', 'test_configs');

// Setup test directory
try {
  mkdirSync(TEST_DIR, { recursive: true });
} catch (err) {
  // Directory already exists
}

/**
 * Helper function to create a test config file
 * @param {string} filename - Name of the config file
 * @param {Object} config - Configuration object
 * @returns {string} - Path to created file
 */
function createTestConfig(filename, config) {
  const filepath = join(TEST_DIR, filename);
  writeFileSync(filepath, yaml.dump(config));
  return filepath;
}

/**
 * Valid configuration for testing
 */
const validConfig = {
  project: {
    name: "Test_Project",
    date: "2025-01-01"
  },
  data_sources: {
    numpy_stack: {
      file: "data/test.npy",
      epsg: 32610,
      origin: [500000, 4200000],
      pixel_size: 10,
      before_index: 0,
      after_index: 1
    },
    shapefile: {
      file: "data/test.shp",
      id_field: "FID"
    },
    source_images: [
      { file: "data/img1.tif", type: "after" },
      { file: "data/img2.tif", type: "before" }
    ],
    predictions: {
      file: "data/pred.npy",
      default_index: 1
    }
  },
  display: {
    context_buffer: 1.5,
    min_window: 128,
    max_window: 512
  },
  labels: [
    { code: 0, name: "Not Evaluated", color: "#808080" },
    { code: 1, name: "Correct", color: "#00FF00" },
    { code: 2, name: "Error", color: "#FF0000" }
  ]
};

describe('Configuration Loader Tests', () => {

  test('should load valid configuration file', async () => {
    const configPath = createTestConfig('valid_config.yaml', validConfig);
    const config = await loadConfig(configPath);

    assert.strictEqual(config.project.name, "Test_Project");
    assert.strictEqual(config.project.date, "2025-01-01");
    assert.strictEqual(config.data_sources.numpy_stack.epsg, 32610);
    assert.strictEqual(config.data_sources.shapefile.id_field, "FID");
    assert.strictEqual(config.labels.length, 3);
  });

  test('should validate all required fields are present', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('should fail when project name is missing', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.project.name;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('project.name')));
  });

  test('should fail when project date is missing', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.project.date;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('project.date')));
  });

  test('should fail when numpy_stack file is missing', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.data_sources.numpy_stack.file;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('numpy_stack.file')));
  });

  test('should fail when numpy_stack epsg is missing', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.data_sources.numpy_stack.epsg;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('epsg')));
  });

  test('should fail when shapefile file is missing', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.data_sources.shapefile.file;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('shapefile.file')));
  });

  test('should fail when shapefile id_field is missing', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.data_sources.shapefile.id_field;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('id_field')));
  });

  test('should validate epsg is a number', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.data_sources.numpy_stack.epsg = "not-a-number";

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('epsg') && err.includes('number')));
  });

  test('should validate origin is an array of two numbers', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.data_sources.numpy_stack.origin = [500000];

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('origin')));
  });

  test('should validate pixel_size is a positive number', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.data_sources.numpy_stack.pixel_size = -10;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('pixel_size')));
  });

  test('should apply default values for optional fields', async () => {
    const minimalConfig = {
      project: {
        name: "Test",
        date: "2025-01-01"
      },
      data_sources: {
        numpy_stack: {
          file: "data/test.npy",
          epsg: 32610,
          origin: [0, 0],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: "data/test.shp",
          id_field: "FID"
        }
      }
    };

    const configPath = createTestConfig('minimal_config.yaml', minimalConfig);
    const config = await loadConfig(configPath);

    // Check default display values
    assert.strictEqual(config.display.context_buffer, 1.5);
    assert.strictEqual(config.display.min_window, 128);
    assert.strictEqual(config.display.max_window, 512);

    // Check default labels
    assert.ok(Array.isArray(config.labels));
    assert.strictEqual(config.labels.length, 3);
    assert.strictEqual(config.labels[0].code, 0);
    assert.strictEqual(config.labels[0].name, "Not Evaluated");
  });

  test('should validate source_images array structure', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.data_sources.source_images = [
      { file: "test.tif" } // missing 'type'
    ];

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('type')));
  });

  test('should validate source_images type values', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.data_sources.source_images = [
      { file: "test.tif", type: "invalid" }
    ];

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('before') || err.includes('after')));
  });

  test('should validate labels have required fields', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.labels = [
      { code: 0, name: "Test" } // missing color
    ];

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('color')));
  });

  test('should validate label codes are unique', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.labels = [
      { code: 0, name: "Test1", color: "#FF0000" },
      { code: 0, name: "Test2", color: "#00FF00" }
    ];

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('unique') || err.includes('duplicate')));
  });

  test('should validate color format', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.labels[0].color = "red"; // invalid format

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('color') && err.includes('#')));
  });

  test('should handle missing config file gracefully', async () => {
    await assert.rejects(
      async () => await loadConfig('nonexistent.yaml'),
      { message: /ENOENT|not found/i }
    );
  });

  test('should handle invalid YAML syntax', async () => {
    const badYaml = join(TEST_DIR, 'bad_syntax.yaml');
    writeFileSync(badYaml, '{ invalid: yaml: syntax }');

    await assert.rejects(
      async () => await loadConfig(badYaml),
      { message: /parse|syntax/i }
    );
  });

  test('should validate display buffer is positive', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.display.context_buffer = -1;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('context_buffer') && err.includes('positive')));
  });

  test('should validate min_window is less than max_window', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    config.display.min_window = 512;
    config.display.max_window = 128;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('min_window') || err.includes('max_window')));
  });

  test('should allow optional predictions field', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.data_sources.predictions;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });

  test('should allow optional source_images field', async () => {
    const config = JSON.parse(JSON.stringify(validConfig));
    delete config.data_sources.source_images;

    const result = validateConfig(config);
    assert.strictEqual(result.valid, true);
  });
});
