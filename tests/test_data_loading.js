import { test, describe } from 'node:test';
import assert from 'node:assert';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { loadNumpyArray } from '../src/data/numpy_loader.js';
import { loadShapefile } from '../src/data/shapefile_loader.js';
import { loadGeoTiff } from '../src/data/geotiff_loader.js';
import { loadPredictions } from '../src/data/prediction_loader.js';
import { validateDatasets } from '../src/data/validator.js';
import { DataManager } from '../src/data/data_manager.js';

const TEST_DATA_DIR = join(process.cwd(), 'tests', 'test_data');

describe('NumPy Array Loader Tests', () => {

  test('should load valid 4D NumPy array', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_4d_array.npy');
    const result = await loadNumpyArray(filepath);

    assert.ok(result.data);
    assert.ok(result.metadata);
    assert.deepStrictEqual(result.metadata.shape, [2, 10, 10, 3]);
    assert.strictEqual(result.metadata.dtype, '<f4');
    assert.strictEqual(result.metadata.dimensions, 4);
    assert.strictEqual(result.data.length, 2 * 10 * 10 * 3);
  });

  test('should validate 4D array dimensions', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_4d_array.npy');
    const result = await loadNumpyArray(filepath, { expectedDimensions: 4 });

    assert.strictEqual(result.metadata.dimensions, 4);
  });

  test('should fail on invalid dimensions', async () => {
    const filepath = join(TEST_DATA_DIR, 'invalid_2d_array.npy');

    await assert.rejects(
      async () => await loadNumpyArray(filepath, { expectedDimensions: 4 }),
      { message: /dimension/i }
    );
  });

  test('should fail on invalid magic string', async () => {
    const filepath = join(TEST_DATA_DIR, 'invalid_magic.npy');

    await assert.rejects(
      async () => await loadNumpyArray(filepath),
      { message: /magic|invalid|format/i }
    );
  });

  test('should handle float64 dtype', async () => {
    const filepath = join(TEST_DATA_DIR, 'float64_4d_array.npy');
    const result = await loadNumpyArray(filepath);

    assert.strictEqual(result.metadata.dtype, '<f8');
    assert.ok(result.data);
  });

  test('should validate data range for float32', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_4d_array.npy');
    const result = await loadNumpyArray(filepath, { validateRange: true });

    // All values should be between 0 and 1 (generated with Math.random())
    const allInRange = result.data.every(v => v >= 0 && v <= 1);
    assert.strictEqual(allInRange, true);
  });

  test('should handle large arrays efficiently', async () => {
    const filepath = join(TEST_DATA_DIR, 'large_4d_array.npy');
    const startTime = Date.now();
    const result = await loadNumpyArray(filepath);
    const loadTime = Date.now() - startTime;

    assert.ok(result.data);
    assert.strictEqual(result.data.length, 2 * 100 * 100 * 3);
    console.log(`   Large array loaded in ${loadTime}ms`);
  });

  test('should call progress callback during loading', async () => {
    const filepath = join(TEST_DATA_DIR, 'large_4d_array.npy');
    const progressUpdates = [];

    await loadNumpyArray(filepath, {
      onProgress: (progress) => {
        progressUpdates.push(progress);
      }
    });

    assert.ok(progressUpdates.length > 0);
    assert.ok(progressUpdates.some(p => p.stage === 'reading'));
    assert.ok(progressUpdates.some(p => p.stage === 'complete'));
  });

  test('should handle missing file gracefully', async () => {
    await assert.rejects(
      async () => await loadNumpyArray('nonexistent.npy'),
      { message: /ENOENT|not found/i }
    );
  });
});

describe('Shapefile Loader Tests', () => {

  test('should load GeoJSON shapefile data', async () => {
    // Use the existing landslides.geojson as test data
    const filepath = join(process.cwd(), 'data', 'landslides.geojson');
    const result = await loadShapefile(filepath);

    assert.ok(result.features);
    assert.ok(Array.isArray(result.features));
    assert.strictEqual(result.features.length, 10);
    assert.ok(result.projection);
  });

  test('should extract feature attributes', async () => {
    const filepath = join(process.cwd(), 'data', 'landslides.geojson');
    const result = await loadShapefile(filepath, { idField: 'FID' });

    const firstFeature = result.features[0];
    assert.ok(firstFeature.properties);
    assert.ok(firstFeature.properties.FID !== undefined);
    assert.ok(firstFeature.geometry);
  });

  test('should validate polygon geometries', async () => {
    const filepath = join(process.cwd(), 'data', 'landslides.geojson');
    const result = await loadShapefile(filepath);

    result.features.forEach(feature => {
      assert.strictEqual(feature.geometry.type, 'Polygon');
      assert.ok(Array.isArray(feature.geometry.coordinates));
      assert.ok(feature.geometry.coordinates[0].length >= 4); // At least 3 points + closing point
    });
  });

  test('should extract projection information', async () => {
    const filepath = join(process.cwd(), 'data', 'landslides.geojson');
    const result = await loadShapefile(filepath);

    assert.ok(result.projection);
    assert.ok(result.projection.includes('EPSG') || result.projection.includes('32610'));
  });

  test('should handle missing ID field gracefully', async () => {
    const filepath = join(process.cwd(), 'data', 'landslides.geojson');
    const result = await loadShapefile(filepath, { idField: 'NONEXISTENT' });

    // Should still load, but warn or use default ID
    assert.ok(result.features);
  });

  test('should call progress callback for large shapefiles', async () => {
    const filepath = join(process.cwd(), 'data', 'landslides.geojson');
    const progressUpdates = [];

    await loadShapefile(filepath, {
      onProgress: (progress) => {
        progressUpdates.push(progress);
      }
    });

    assert.ok(progressUpdates.length > 0);
  });
});

describe('GeoTIFF Loader Tests', () => {

  test('should load GeoTIFF metadata', async () => {
    // Since we don't have actual GeoTIFF files, we'll test with mock data
    // For now, test that the loader handles metadata files correctly
    const metadataPath = join(process.cwd(), 'data', 'source1_metadata.json');
    const result = await loadGeoTiff(metadataPath, { metadataOnly: true });

    assert.ok(result.metadata);
    assert.ok(result.metadata.width);
    assert.ok(result.metadata.height);
    assert.ok(result.metadata.geoTransform);
  });

  test('should extract georeference information', async () => {
    const metadataPath = join(process.cwd(), 'data', 'source1_metadata.json');
    const result = await loadGeoTiff(metadataPath, { metadataOnly: true });

    assert.ok(result.metadata.geoTransform);
    assert.strictEqual(result.metadata.geoTransform.length, 6);
    assert.ok(result.metadata.projection);
  });

  test('should validate multi-band images', async () => {
    const metadataPath = join(process.cwd(), 'data', 'source1_metadata.json');
    const result = await loadGeoTiff(metadataPath, { metadataOnly: true });

    assert.ok(result.metadata.bands);
    assert.ok(result.metadata.bands >= 1);
  });

  test('should handle missing GeoTIFF file', async () => {
    await assert.rejects(
      async () => await loadGeoTiff('nonexistent.tif'),
      { message: /ENOENT|not found/i }
    );
  });
});

describe('Prediction Loader Tests', () => {

  test('should load valid 3D prediction array', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_3d_predictions.npy');
    const result = await loadPredictions(filepath);

    assert.ok(result.data);
    assert.deepStrictEqual(result.metadata.shape, [10, 10, 2]);
    assert.strictEqual(result.metadata.dimensions, 3);
    assert.strictEqual(result.data.length, 10 * 10 * 2);
  });

  test('should validate prediction dimensions', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_3d_predictions.npy');
    const result = await loadPredictions(filepath, { expectedShape: [10, 10, 2] });

    assert.deepStrictEqual(result.metadata.shape, [10, 10, 2]);
  });

  test('should validate probability range', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_3d_predictions.npy');
    const result = await loadPredictions(filepath, { validateRange: true });

    // All values should be probabilities (0 to 1)
    const allInRange = result.data.every(v => v >= 0 && v <= 1);
    assert.strictEqual(allInRange, true);
  });

  test('should fail on wrong dimensions', async () => {
    const filepath = join(TEST_DATA_DIR, 'valid_4d_array.npy');

    await assert.rejects(
      async () => await loadPredictions(filepath),
      { message: /dimension/i }
    );
  });
});

describe('Data Validator Tests', () => {

  test('should validate projection consistency', async () => {
    const datasets = {
      numpy_stack: {
        metadata: { epsg: 32610, shape: [2, 10, 10, 3] }
      },
      shapefile: {
        projection: 'EPSG:32610',
        features: []
      },
      source_images: [
        { metadata: { projection: 'EPSG:32610' } }
      ]
    };

    const result = validateDatasets(datasets);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  test('should detect projection mismatch', async () => {
    const datasets = {
      numpy_stack: {
        metadata: { epsg: 32610, shape: [2, 10, 10, 3] }
      },
      shapefile: {
        projection: 'EPSG:4326', // Different projection!
        features: []
      }
    };

    const result = validateDatasets(datasets);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('projection') || err.includes('EPSG')));
  });

  test('should validate dimension compatibility', async () => {
    const datasets = {
      numpy_stack: {
        metadata: { shape: [2, 10, 10, 3], epsg: 32610 }
      },
      predictions: {
        metadata: { shape: [10, 10, 2] }
      }
    };

    const result = validateDatasets(datasets);
    assert.strictEqual(result.valid, true);
  });

  test('should detect dimension mismatch', async () => {
    const datasets = {
      numpy_stack: {
        metadata: { shape: [2, 10, 10, 3], epsg: 32610 }
      },
      predictions: {
        metadata: { shape: [20, 20, 2] } // Different dimensions!
      }
    };

    const result = validateDatasets(datasets);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(err => err.includes('dimension') || err.includes('shape')));
  });

  test('should generate validation report', async () => {
    const datasets = {
      numpy_stack: {
        metadata: { epsg: 32610, shape: [2, 10, 10, 3] }
      },
      shapefile: {
        projection: 'EPSG:32610',
        features: [1, 2, 3]
      }
    };

    const result = validateDatasets(datasets);
    assert.ok(result.report);
    assert.ok(result.report.projectionCheck);
    assert.ok(result.report.dimensionCheck);
  });
});

describe('Data Manager Tests', () => {

  test('should initialize data manager', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: join(TEST_DATA_DIR, 'valid_4d_array.npy'),
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
      }
    };

    const manager = new DataManager(config);
    assert.ok(manager);
  });

  test('should load all data sources', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: join(TEST_DATA_DIR, 'valid_4d_array.npy'),
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
      }
    };

    const manager = new DataManager(config);
    await manager.loadAll();

    assert.ok(manager.getData('numpy_stack'));
    assert.ok(manager.getData('shapefile'));
  });

  test('should run validation after loading', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: join(TEST_DATA_DIR, 'valid_4d_array.npy'),
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
      }
    };

    const manager = new DataManager(config);
    await manager.loadAll();

    const validation = manager.getValidationReport();
    assert.ok(validation);
  });

  test('should handle optional data sources gracefully', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: join(TEST_DATA_DIR, 'valid_4d_array.npy'),
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
        // predictions and source_images are optional
      }
    };

    const manager = new DataManager(config);
    await manager.loadAll();

    assert.ok(manager.getData('numpy_stack'));
    assert.ok(manager.getData('shapefile'));
    assert.strictEqual(manager.getData('predictions'), undefined);
  });

  test('should provide progress updates', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: join(TEST_DATA_DIR, 'large_4d_array.npy'),
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
      }
    };

    const progressUpdates = [];
    const manager = new DataManager(config);

    await manager.loadAll({
      onProgress: (progress) => {
        progressUpdates.push(progress);
      }
    });

    assert.ok(progressUpdates.length > 0);
    assert.ok(progressUpdates.some(p => p.source === 'numpy_stack'));
    assert.ok(progressUpdates.some(p => p.source === 'shapefile'));
  });

  test('should cache loaded data', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: join(TEST_DATA_DIR, 'valid_4d_array.npy'),
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
      }
    };

    const manager = new DataManager(config);
    await manager.loadAll();

    const data1 = manager.getData('numpy_stack');
    const data2 = manager.getData('numpy_stack');

    // Should return the same cached object
    assert.strictEqual(data1, data2);
  });

  test('should handle loading errors gracefully', async () => {
    const config = {
      project: { name: 'Test', date: '2025-01-01' },
      data_sources: {
        numpy_stack: {
          file: 'nonexistent.npy',
          epsg: 32610,
          origin: [500000, 4200000],
          pixel_size: 10,
          before_index: 0,
          after_index: 1
        },
        shapefile: {
          file: join(process.cwd(), 'data', 'landslides.geojson'),
          id_field: 'FID'
        }
      }
    };

    const manager = new DataManager(config);

    await assert.rejects(
      async () => await manager.loadAll(),
      { message: /not found|ENOENT/i }
    );
  });
});
