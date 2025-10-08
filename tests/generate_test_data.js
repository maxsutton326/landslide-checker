/**
 * Test Data Generator for Landslide Data Quality Assessment System
 *
 * Generates mock data files for testing:
 * - 4D NumPy array (2×100×100×3) with random values 0-1
 * - 10 polygon geometries in GeoJSON format
 * - Sample GeoTIFF metadata
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

// Ensure data directory exists
try {
  mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  // Directory already exists
}

/**
 * Generate a 4D NumPy array with shape (2, 100, 100, 3)
 * Values are random floats between 0 and 1
 *
 * Note: This creates a simplified JSON representation of NumPy array structure
 * In production, use actual NumPy binary format (.npy)
 *
 * @returns {Object} - Array data and metadata
 */
function generateNumpyStack() {
  const shape = [2, 100, 100, 3];
  const totalElements = shape.reduce((a, b) => a * b, 1);

  // Generate random data
  const data = new Float32Array(totalElements);
  for (let i = 0; i < totalElements; i++) {
    data[i] = Math.random();
  }

  return {
    dtype: 'float32',
    shape: shape,
    data: Array.from(data),
    description: '4D array: [time, height, width, bands]'
  };
}

/**
 * Generate random polygon coordinates within a bounding box
 * @param {number} minX - Minimum X coordinate
 * @param {number} minY - Minimum Y coordinate
 * @param {number} maxSize - Maximum polygon size
 * @returns {Array} - Array of coordinate pairs
 */
function generateRandomPolygon(minX, minY, maxSize) {
  const numPoints = 4 + Math.floor(Math.random() * 6); // 4-10 points
  const centerX = minX + Math.random() * maxSize;
  const centerY = minY + Math.random() * maxSize;
  const radius = 50 + Math.random() * 100; // 50-150m radius

  const coords = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const r = radius * (0.7 + Math.random() * 0.3); // Vary radius
    coords.push([
      centerX + r * Math.cos(angle),
      centerY + r * Math.sin(angle)
    ]);
  }

  // Close the polygon
  coords.push([...coords[0]]);

  return coords;
}

/**
 * Generate 10 landslide polygon geometries in GeoJSON format
 * @returns {Object} - GeoJSON FeatureCollection
 */
function generateLandslidePolygons() {
  const features = [];
  const baseX = 500000;
  const baseY = 4200000;

  for (let i = 0; i < 10; i++) {
    const feature = {
      type: 'Feature',
      id: i,
      properties: {
        FID: i,
        area: 1000 + Math.random() * 5000,
        confidence: Math.random(),
        date_mapped: '2025-01-01'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [generateRandomPolygon(
          baseX + (i % 5) * 200,
          baseY + Math.floor(i / 5) * 200,
          150
        )]
      }
    };
    features.push(feature);
  }

  return {
    type: 'FeatureCollection',
    crs: {
      type: 'name',
      properties: {
        name: 'EPSG:32610'
      }
    },
    features: features
  };
}

/**
 * Generate mock predictions array (2D array: 100×100)
 * @returns {Object} - Predictions data and metadata
 */
function generatePredictions() {
  const shape = [100, 100, 2]; // Height, Width, Classes
  const totalElements = shape.reduce((a, b) => a * b, 1);

  const data = new Float32Array(totalElements);
  for (let i = 0; i < totalElements; i++) {
    data[i] = Math.random();
  }

  return {
    dtype: 'float32',
    shape: shape,
    data: Array.from(data),
    description: 'Prediction probabilities: [height, width, classes]'
  };
}

/**
 * Generate GeoTIFF metadata
 * @param {string} filename - Name of the GeoTIFF
 * @param {string} type - Image type ('before' or 'after')
 * @returns {Object} - GeoTIFF metadata
 */
function generateGeoTiffMetadata(filename, type) {
  return {
    filename: filename,
    type: type,
    width: 1000,
    height: 1000,
    bands: 3,
    dataType: 'uint16',
    projection: 'EPSG:32610',
    geoTransform: [
      500000,  // Top left X
      10,      // Pixel width
      0,       // Rotation (0 for north-up)
      4200000, // Top left Y
      0,       // Rotation (0 for north-up)
      -10      // Pixel height (negative for north-up)
    ],
    noDataValue: 0,
    metadata: {
      acquisition_date: type === 'before' ? '2024-12-01' : '2025-01-15',
      satellite: 'Landsat-8',
      cloud_cover: Math.random() * 10
    }
  };
}

/**
 * Main function to generate all test data
 */
function generateAllTestData() {
  console.log('Generating test data...\n');

  // 1. Generate NumPy stack
  console.log('1. Generating NumPy stack (2×100×100×3)...');
  const numpyStack = generateNumpyStack();
  const stackPath = join(DATA_DIR, 'test_stack.json');
  writeFileSync(stackPath, JSON.stringify(numpyStack, null, 2));
  console.log(`   ✓ Saved to: ${stackPath}`);
  console.log(`   Size: ${numpyStack.data.length} elements\n`);

  // 2. Generate landslide polygons
  console.log('2. Generating landslide polygons (10 features)...');
  const polygons = generateLandslidePolygons();
  const polygonPath = join(DATA_DIR, 'landslides.geojson');
  writeFileSync(polygonPath, JSON.stringify(polygons, null, 2));
  console.log(`   ✓ Saved to: ${polygonPath}`);
  console.log(`   Features: ${polygons.features.length}\n`);

  // 3. Generate predictions
  console.log('3. Generating predictions array (100×100×2)...');
  const predictions = generatePredictions();
  const predPath = join(DATA_DIR, 'predictions.json');
  writeFileSync(predPath, JSON.stringify(predictions, null, 2));
  console.log(`   ✓ Saved to: ${predPath}`);
  console.log(`   Size: ${predictions.data.length} elements\n`);

  // 4. Generate GeoTIFF metadata
  console.log('4. Generating GeoTIFF metadata...');
  const source1Meta = generateGeoTiffMetadata('source1.tif', 'before');
  const source2Meta = generateGeoTiffMetadata('source2.tif', 'after');

  const metaPath1 = join(DATA_DIR, 'source1_metadata.json');
  const metaPath2 = join(DATA_DIR, 'source2_metadata.json');

  writeFileSync(metaPath1, JSON.stringify(source1Meta, null, 2));
  writeFileSync(metaPath2, JSON.stringify(source2Meta, null, 2));

  console.log(`   ✓ Saved to: ${metaPath1}`);
  console.log(`   ✓ Saved to: ${metaPath2}\n`);

  // 5. Generate summary
  const summary = {
    generated_date: new Date().toISOString(),
    files: {
      numpy_stack: {
        path: 'data/test_stack.json',
        shape: numpyStack.shape,
        size_mb: (numpyStack.data.length * 4 / 1024 / 1024).toFixed(2)
      },
      polygons: {
        path: 'data/landslides.geojson',
        count: polygons.features.length,
        crs: 'EPSG:32610'
      },
      predictions: {
        path: 'data/predictions.json',
        shape: predictions.shape,
        size_mb: (predictions.data.length * 4 / 1024 / 1024).toFixed(2)
      },
      geotiff_metadata: {
        source1: 'data/source1_metadata.json',
        source2: 'data/source2_metadata.json'
      }
    },
    notes: [
      'NumPy arrays are stored as JSON for testing (use .npy in production)',
      'GeoJSON used instead of shapefile for easier testing',
      'GeoTIFF metadata only (actual raster data not generated)'
    ]
  };

  const summaryPath = join(DATA_DIR, 'test_data_summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('═══════════════════════════════════════════════');
  console.log('Test data generation complete!');
  console.log('═══════════════════════════════════════════════');
  console.log(`\nSummary saved to: ${summaryPath}\n`);
  console.log('Generated files:');
  console.log('  - test_stack.json (4D array)');
  console.log('  - landslides.geojson (10 polygons)');
  console.log('  - predictions.json (predictions)');
  console.log('  - source1_metadata.json (before image)');
  console.log('  - source2_metadata.json (after image)');
  console.log('  - test_data_summary.json (summary)');
  console.log('\nNote: Using JSON format for arrays. In production, use .npy format.');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllTestData();
}

export { generateNumpyStack, generateLandslidePolygons, generatePredictions, generateGeoTiffMetadata };
