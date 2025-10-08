import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  pixelToGeo,
  geoToPixel,
  transformBounds,
  createTransform,
  applyTransform,
  inverseTransform
} from '../src/utils/coordinates.js';

describe('Coordinate Transformation Tests', () => {

  test('should convert pixel to geographic coordinates (simple case)', () => {
    const origin = [500000, 4200000]; // UTM Zone 10N
    const pixelSize = 10;
    const epsg = 32610;

    // Pixel (0, 0) should be at origin
    const coord1 = pixelToGeo(0, 0, origin, pixelSize, epsg);
    assert.strictEqual(coord1.x, 500000);
    assert.strictEqual(coord1.y, 4200000);

    // Pixel (10, 10) should be 100m east and 100m south (negative Y)
    const coord2 = pixelToGeo(10, 10, origin, pixelSize, epsg);
    assert.strictEqual(coord2.x, 500100);
    assert.strictEqual(coord2.y, 4199900);
  });

  test('should convert geographic to pixel coordinates (simple case)', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;
    const epsg = 32610;

    // Origin should map to (0, 0)
    const pixel1 = geoToPixel(500000, 4200000, origin, pixelSize, epsg);
    assert.strictEqual(pixel1.row, 0);
    assert.strictEqual(pixel1.col, 0);

    // 100m east, 100m south should be (10, 10)
    const pixel2 = geoToPixel(500100, 4199900, origin, pixelSize, epsg);
    assert.strictEqual(pixel2.row, 10);
    assert.strictEqual(pixel2.col, 10);
  });

  test('should be invertible (pixel -> geo -> pixel)', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;
    const epsg = 32610;

    const testCases = [
      { row: 0, col: 0 },
      { row: 50, col: 100 },
      { row: 123, col: 456 }
    ];

    testCases.forEach(({ row, col }) => {
      const geo = pixelToGeo(row, col, origin, pixelSize, epsg);
      const pixel = geoToPixel(geo.x, geo.y, origin, pixelSize, epsg);

      assert.strictEqual(pixel.row, row);
      assert.strictEqual(pixel.col, col);
    });
  });

  test('should handle fractional pixel coordinates', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;
    const epsg = 32610;

    // Test with coordinates between pixels
    const pixel = geoToPixel(500005, 4199995, origin, pixelSize, epsg);

    // 5m east / 10m per pixel = 0.5 columns
    // 5m south / 10m per pixel = 0.5 rows
    assert.strictEqual(pixel.col, 0.5);
    assert.strictEqual(pixel.row, 0.5);
  });

  test('should create affine transform matrix', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;

    const transform = createTransform(origin, pixelSize, 0);

    assert.deepStrictEqual(transform, {
      originX: 500000,
      originY: 4200000,
      pixelWidth: 10,
      pixelHeight: -10, // Negative for north-up images
      rotationX: 0,
      rotationY: 0
    });
  });

  test('should apply affine transform to pixel coordinates', () => {
    const transform = {
      originX: 500000,
      originY: 4200000,
      pixelWidth: 10,
      pixelHeight: -10,
      rotationX: 0,
      rotationY: 0
    };

    const result = applyTransform(10, 10, transform);
    assert.strictEqual(result.x, 500100);
    assert.strictEqual(result.y, 4199900);
  });

  test('should inverse affine transform from geo to pixel', () => {
    const transform = {
      originX: 500000,
      originY: 4200000,
      pixelWidth: 10,
      pixelHeight: -10,
      rotationX: 0,
      rotationY: 0
    };

    const result = inverseTransform(500100, 4199900, transform);
    assert.strictEqual(result.row, 10);
    assert.strictEqual(result.col, 10);
  });

  test('should handle negative coordinates', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;
    const epsg = 32610;

    // Point west and north of origin
    const pixel = geoToPixel(499900, 4200100, origin, pixelSize, epsg);
    assert.strictEqual(pixel.col, -10);
    assert.strictEqual(pixel.row, -10);
  });

  test('should maintain precision to 6 decimal places', () => {
    const origin = [500000.123456, 4200000.654321];
    const pixelSize = 10.5;
    const epsg = 32610;

    const geo = pixelToGeo(100, 50, origin, pixelSize, epsg);

    // Should maintain precision
    assert.ok(Math.abs(geo.x - (500000.123456 + 50 * 10.5)) < 0.000001);
    assert.ok(Math.abs(geo.y - (4200000.654321 - 100 * 10.5)) < 0.000001);
  });

  test('should transform bounds between coordinate systems', () => {
    // Simple test: transform bounds within same projection
    const bounds = {
      minX: 500000,
      minY: 4200000,
      maxX: 501000,
      maxY: 4201000
    };

    const transformed = transformBounds(bounds, 32610, 32610);

    // Should be identical for same projection
    assert.strictEqual(transformed.minX, bounds.minX);
    assert.strictEqual(transformed.minY, bounds.minY);
    assert.strictEqual(transformed.maxX, bounds.maxX);
    assert.strictEqual(transformed.maxY, bounds.maxY);
  });

  test('should handle bounds transformation to WGS84', () => {
    // UTM Zone 10N bounds
    const bounds = {
      minX: 500000,
      minY: 4200000,
      maxX: 501000,
      maxY: 4201000
    };

    const transformed = transformBounds(bounds, 32610, 4326);

    // Rough validation: WGS84 coordinates should be in reasonable range
    // UTM Zone 10N, ~37.9°N, ~123°W
    assert.ok(transformed.minX <= -122 && transformed.minX >= -124);
    assert.ok(transformed.minY > 37 && transformed.minY < 38);
    assert.ok(transformed.maxX <= -122 && transformed.maxX >= -124);
    assert.ok(transformed.maxY > 37 && transformed.maxY < 38);
  });

  test('should handle edge case with zero pixel size', () => {
    const origin = [500000, 4200000];
    const pixelSize = 0;
    const epsg = 32610;

    // Should throw error for invalid pixel size
    assert.throws(() => {
      geoToPixel(500100, 4200000, origin, pixelSize, epsg);
    }, /pixel.*size|invalid|zero/i);
  });

  test('should handle very large coordinate values', () => {
    const origin = [1000000, 9000000];
    const pixelSize = 30;
    const epsg = 32610;

    const geo = pixelToGeo(10000, 5000, origin, pixelSize, epsg);
    assert.strictEqual(geo.x, 1000000 + 5000 * 30);
    assert.strictEqual(geo.y, 9000000 - 10000 * 30);
  });

  test('should handle sub-pixel precision', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;
    const epsg = 32610;

    // Convert coordinates that fall between pixels
    // x is 0.5 pixels right, y is 0.5 pixels down from origin
    const geo = { x: 500005, y: 4199995 };
    const pixel = geoToPixel(geo.x, geo.y, origin, pixelSize, epsg);

    // Should have fractional row/col values
    assert.ok(pixel.col > 0 && pixel.col < 1);
    assert.ok(pixel.row > 0 && pixel.row < 1);

    // Round trip should preserve precision
    const geo2 = pixelToGeo(pixel.row, pixel.col, origin, pixelSize, epsg);
    assert.ok(Math.abs(geo2.x - geo.x) < 0.000001);
    assert.ok(Math.abs(geo2.y - geo.y) < 0.000001);
  });

  test('should handle different pixel sizes for X and Y', () => {
    const transform = {
      originX: 500000,
      originY: 4200000,
      pixelWidth: 10,
      pixelHeight: -15, // Different from pixelWidth
      rotationX: 0,
      rotationY: 0
    };

    const result = applyTransform(10, 10, transform);
    assert.strictEqual(result.x, 500100); // 10 * 10
    assert.strictEqual(result.y, 4199850); // 4200000 + 10 * (-15)
  });

  test('should validate coordinate reference system', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;

    // Test with invalid EPSG code
    assert.throws(() => {
      pixelToGeo(0, 0, origin, pixelSize, 999999);
    }, /epsg|projection|coordinate.*system/i);
  });

  test('should handle rotated coordinate systems', () => {
    // Test with 45-degree rotation (rarely used but should be supported)
    const transform = {
      originX: 0,
      originY: 0,
      pixelWidth: 10,
      pixelHeight: -10,
      rotationX: 10, // 45-degree rotation components
      rotationY: 10
    };

    const result = applyTransform(1, 1, transform);

    // With rotation, both X and Y components contribute
    const expectedX = 0 + 1 * 10 + 1 * 10;
    const expectedY = 0 + 1 * 10 + 1 * (-10);

    assert.strictEqual(result.x, expectedX);
    assert.strictEqual(result.y, expectedY);
  });

  test('should convert array bounds to geographic bounds', () => {
    const origin = [500000, 4200000];
    const pixelSize = 10;
    const rows = 100;
    const cols = 100;

    // Top-left corner
    const topLeft = pixelToGeo(0, 0, origin, pixelSize, 32610);
    // Bottom-right corner
    const bottomRight = pixelToGeo(rows, cols, origin, pixelSize, 32610);

    const bounds = {
      minX: topLeft.x,
      maxX: bottomRight.x,
      minY: bottomRight.y,
      maxY: topLeft.y
    };

    assert.strictEqual(bounds.minX, 500000);
    assert.strictEqual(bounds.maxX, 501000);
    assert.strictEqual(bounds.minY, 4199000);
    assert.strictEqual(bounds.maxY, 4200000);
  });
});
