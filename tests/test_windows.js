import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  calculateDisplayWindow,
  calculatePolygonBounds,
  calculateCentroid,
  applyContextBuffer,
  enforceWindowConstraints,
  createWindowSpec
} from '../src/utils/window_calculator.js';
import {
  cropArray4D,
  cropGeoTiff,
  cropPredictions,
  padArray,
  calculateCropIndices
} from '../src/utils/image_cropper.js';
import { buildSpatialIndex, queryIndex, getPolygonById, getTotalBounds } from '../src/utils/spatial_index.js';

// Test polygon data
const smallPolygon = {
  id: 1,
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [500050, 4200050],
      [500060, 4200050],
      [500060, 4200060],
      [500050, 4200060],
      [500050, 4200050]
    ]]
  },
  properties: { name: 'small' }
};

const mediumPolygon = {
  id: 2,
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [500000, 4200000],
      [500100, 4200000],
      [500100, 4200100],
      [500000, 4200100],
      [500000, 4200000]
    ]]
  },
  properties: { name: 'medium' }
};

const largePolygon = {
  id: 3,
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [500000, 4200000],
      [500500, 4200000],
      [500500, 4200500],
      [500000, 4200500],
      [500000, 4200000]
    ]]
  },
  properties: { name: 'large' }
};

describe('Window Calculator Tests', () => {

  test('should calculate polygon bounds correctly', () => {
    const bounds = calculatePolygonBounds(mediumPolygon);

    assert.strictEqual(bounds.minX, 500000);
    assert.strictEqual(bounds.maxX, 500100);
    assert.strictEqual(bounds.minY, 4200000);
    assert.strictEqual(bounds.maxY, 4200100);
  });

  test('should calculate polygon centroid', () => {
    const centroid = calculateCentroid(mediumPolygon);

    // Centroid of square should be at center
    assert.strictEqual(centroid.x, 500050);
    assert.strictEqual(centroid.y, 4200050);
  });

  test('should apply context buffer to bounds', () => {
    const bounds = {
      minX: 500000,
      maxX: 500100,
      minY: 4200000,
      maxY: 4200100
    };

    const buffered = applyContextBuffer(bounds, 1.5);

    // Width/height = 100, with 1.5x buffer should add 25 on each side
    const expectedWidth = 100 * 1.5;
    const expectedPadding = (expectedWidth - 100) / 2;

    assert.strictEqual(buffered.minX, 500000 - expectedPadding);
    assert.strictEqual(buffered.maxX, 500100 + expectedPadding);
    assert.strictEqual(buffered.minY, 4200000 - expectedPadding);
    assert.strictEqual(buffered.maxY, 4200100 + expectedPadding);
  });

  test('should enforce minimum window size', () => {
    const smallBounds = {
      minX: 500000,
      maxX: 500010, // Only 10m wide
      minY: 4200000,
      maxY: 4200010
    };

    const config = {
      context_buffer: 1.0,
      min_window: 128,
      max_window: 512
    };

    const origin = [500000, 4200000];
    const pixelSize = 10;

    const constrained = enforceWindowConstraints(
      smallBounds,
      config,
      origin,
      pixelSize
    );

    // Should expand to at least min_window pixels
    const width = (constrained.maxX - constrained.minX) / pixelSize;
    assert.ok(width >= config.min_window);
  });

  test('should enforce maximum window size', () => {
    const largeBounds = {
      minX: 500000,
      maxX: 510000, // 10km wide
      minY: 4200000,
      maxY: 4210000
    };

    const config = {
      context_buffer: 1.0,
      min_window: 128,
      max_window: 512
    };

    const origin = [500000, 4200000];
    const pixelSize = 10;

    const constrained = enforceWindowConstraints(
      largeBounds,
      config,
      origin,
      pixelSize
    );

    // Should shrink to at most max_window pixels
    const width = (constrained.maxX - constrained.minX) / pixelSize;
    assert.ok(width <= config.max_window);
  });

  test('should create complete window specification', () => {
    const config = {
      context_buffer: 1.5,
      min_window: 128,
      max_window: 512
    };

    const origin = [500000, 4200000];
    const pixelSize = 10;

    const window = createWindowSpec(
      mediumPolygon,
      config,
      origin,
      pixelSize,
      32610
    );

    assert.ok(window.centerX);
    assert.ok(window.centerY);
    assert.ok(window.width > 0);
    assert.ok(window.height > 0);
    assert.strictEqual(window.pixelSize, pixelSize);
    assert.ok(window.bounds);
    assert.ok(window.bounds.minX < window.bounds.maxX);
    assert.ok(window.bounds.minY < window.bounds.maxY);
  });

  test('should handle polygon at image boundary', () => {
    // Polygon at top-left corner of image
    const boundaryPolygon = {
      id: 4,
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [499990, 4200990], // Extends beyond origin
          [500010, 4200990],
          [500010, 4201010],
          [499990, 4201010],
          [499990, 4200990]
        ]]
      },
      properties: { name: 'boundary' }
    };

    const config = {
      context_buffer: 1.5,
      min_window: 128,
      max_window: 512
    };

    const origin = [500000, 4200000];
    const pixelSize = 10;

    const window = createWindowSpec(
      boundaryPolygon,
      config,
      origin,
      pixelSize,
      32610
    );

    // Should still create valid window
    assert.ok(window.width > 0);
    assert.ok(window.height > 0);
  });

  test('should calculate display window for small polygon', () => {
    const config = {
      context_buffer: 2.0,
      min_window: 128,
      max_window: 512
    };

    const window = calculateDisplayWindow(
      smallPolygon,
      config,
      [500000, 4200000],
      10,
      32610
    );

    // Small polygon should be expanded to min_window
    assert.ok(window.width >= config.min_window);
    assert.ok(window.height >= config.min_window);
  });

  test('should calculate display window for large polygon', () => {
    const config = {
      context_buffer: 1.2,
      min_window: 128,
      max_window: 512
    };

    const window = calculateDisplayWindow(
      largePolygon,
      config,
      [500000, 4200000],
      10,
      32610
    );

    // Large polygon should be constrained to max_window
    assert.ok(window.width <= config.max_window);
    assert.ok(window.height <= config.max_window);
  });
});

describe('Image Cropper Tests', () => {

  test('should calculate crop indices from bounds', () => {
    const bounds = {
      minX: 500100,
      maxX: 500300,
      minY: 4199800,
      maxY: 4200000
    };

    const origin = [500000, 4200000];
    const pixelSize = 10;

    const indices = calculateCropIndices(bounds, origin, pixelSize);

    // minX = 500100 -> col = 10
    // maxX = 500300 -> col = 30
    // minY = 4199800 -> row = 20 (south of origin)
    // maxY = 4200000 -> row = 0 (at origin)

    assert.strictEqual(indices.colStart, 10);
    assert.strictEqual(indices.colEnd, 30);
    assert.strictEqual(indices.rowStart, 0);
    assert.strictEqual(indices.rowEnd, 20);
  });

  test('should crop 4D array correctly', () => {
    // Create test array: 2×10×10×3
    const testData = [];
    for (let t = 0; t < 2; t++) {
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          for (let b = 0; b < 3; b++) {
            // Value = t*1000 + r*100 + c*10 + b
            testData.push(t * 1000 + r * 100 + c * 10 + b);
          }
        }
      }
    }

    const shape = [2, 10, 10, 3];
    const cropped = cropArray4D(
      testData,
      shape,
      2, // rowStart
      5, // rowEnd
      3, // colStart
      7, // colEnd
      0  // timeIndex
    );

    // Should be 3 rows × 4 cols × 3 bands = 36 elements
    assert.strictEqual(cropped.data.length, 3 * 4 * 3);
    assert.deepStrictEqual(cropped.shape, [3, 4, 3]);

    // Verify first value: row=2, col=3, band=0
    assert.strictEqual(cropped.data[0], 230);
  });

  test('should crop predictions array correctly', () => {
    // Create test predictions: 10×10×2
    const testData = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        for (let cls = 0; cls < 2; cls++) {
          testData.push(r * 100 + c * 10 + cls);
        }
      }
    }

    const shape = [10, 10, 2];
    const cropped = cropPredictions(
      testData,
      shape,
      2, // rowStart
      5, // rowEnd
      3, // colStart
      7  // colEnd
    );

    // Should be 3 rows × 4 cols × 2 classes = 24 elements
    assert.strictEqual(cropped.data.length, 3 * 4 * 2);
    assert.deepStrictEqual(cropped.shape, [3, 4, 2]);
  });

  test('should pad array when out of bounds', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const shape = [3, 3]; // 3×3 array

    const padded = padArray(data, shape, { top: 1, bottom: 1, left: 1, right: 1 }, 0);

    // Should be 5×5 = 25 elements
    assert.strictEqual(padded.data.length, 25);
    assert.deepStrictEqual(padded.shape, [5, 5]);

    // Center should contain original data
    // Original data at padded indices [1,1] to [3,3]
    const centerValue = padded.data[1 * 5 + 1]; // Row 1, col 1
    assert.strictEqual(centerValue, 1); // Original data[0]
  });

  test('should handle crop extending beyond array bounds', () => {
    const testData = Array(100).fill(1); // 10×10 array
    const shape = [10, 10];

    // Try to crop beyond bounds
    const cropped = cropArray4D(
      testData,
      [1, 10, 10, 1],
      -2, // Negative row (beyond top)
      12, // Beyond bottom
      -1, // Beyond left
      11, // Beyond right
      0
    );

    // Should handle gracefully with padding or clipping
    assert.ok(cropped.data.length > 0);
    assert.ok(Array.isArray(cropped.data));
  });

  test('should preserve data values during crop', () => {
    // Create array with known pattern
    const testData = [];
    for (let i = 0; i < 100; i++) {
      testData.push(i);
    }

    const cropped = cropArray4D(
      testData,
      [1, 10, 10, 1],
      0,
      5,
      0,
      5,
      0
    );

    // Verify specific values are preserved
    // Index 0 should be original index 0
    assert.strictEqual(cropped.data[0], 0);
    // Index at row 1, col 1 should be original index 11
    assert.strictEqual(cropped.data[6], 11); // New index: 1*5 + 1
  });
});

describe('Spatial Index Tests', () => {

  test('should build spatial index from polygons', () => {
    const polygons = [smallPolygon, mediumPolygon, largePolygon];
    const index = buildSpatialIndex(polygons);

    assert.ok(index);
    assert.ok(index.data);
  });

  test('should query index by bounds', () => {
    const polygons = [smallPolygon, mediumPolygon, largePolygon];
    const index = buildSpatialIndex(polygons);

    // Query area that overlaps with mediumPolygon
    const queryBounds = {
      minX: 500025,
      maxX: 500075,
      minY: 4200025,
      maxY: 4200075
    };

    const results = queryIndex(index, queryBounds);

    // Should find mediumPolygon
    assert.ok(results.length > 0);
    assert.ok(results.some(p => p.id === 2));
  });

  test('should get polygon by ID', () => {
    const polygons = [smallPolygon, mediumPolygon, largePolygon];
    const index = buildSpatialIndex(polygons);

    const polygon = getPolygonById(index, 2);

    assert.ok(polygon);
    assert.strictEqual(polygon.id, 2);
    assert.strictEqual(polygon.properties.name, 'medium');
  });

  test('should return empty results for non-overlapping query', () => {
    const polygons = [smallPolygon, mediumPolygon, largePolygon];
    const index = buildSpatialIndex(polygons);

    // Query area far from any polygons
    const queryBounds = {
      minX: 600000,
      maxX: 600100,
      minY: 4300000,
      maxY: 4300100
    };

    const results = queryIndex(index, queryBounds);

    assert.strictEqual(results.length, 0);
  });

  test('should handle index with single polygon', () => {
    const index = buildSpatialIndex([smallPolygon]);

    const results = queryIndex(index, {
      minX: 500045,
      maxX: 500065,
      minY: 4200045,
      maxY: 4200065
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 1);
  });

  test('should calculate total bounds of all polygons', () => {
    const polygons = [smallPolygon, mediumPolygon, largePolygon];
    const index = buildSpatialIndex(polygons);

    const totalBounds = getTotalBounds(index);

    // Should encompass all polygons
    assert.ok(totalBounds.minX <= 500000);
    assert.ok(totalBounds.maxX >= 500500);
    assert.ok(totalBounds.minY <= 4200000);
    assert.ok(totalBounds.maxY >= 4200500);
  });

  test('should efficiently query large number of polygons', () => {
    // Create 100 random polygons
    const polygons = [];
    for (let i = 0; i < 100; i++) {
      const x = 500000 + i * 100;
      const y = 4200000 + i * 100;
      polygons.push({
        id: i,
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [x, y],
            [x + 50, y],
            [x + 50, y + 50],
            [x, y + 50],
            [x, y]
          ]]
        },
        properties: { index: i }
      });
    }

    const index = buildSpatialIndex(polygons);

    // Query should be fast even with many polygons
    const startTime = Date.now();
    const results = queryIndex(index, {
      minX: 500000,
      maxX: 500200,
      minY: 4200000,
      maxY: 4200200
    });
    const queryTime = Date.now() - startTime;

    // Should find multiple polygons
    assert.ok(results.length > 0);
    // Should be fast (under 10ms for 100 polygons)
    assert.ok(queryTime < 10);
  });
});
