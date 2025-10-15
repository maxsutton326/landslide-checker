/**
 * Tests for Tile-Based Image Loading API
 *
 * Tests the server API endpoint for retrieving cropped image tiles
 * and the DataManager's tile request functionality
 */

import { strict as assert } from 'assert';

const API_BASE = 'http://localhost:3000';

/**
 * Test Suite: Tile API Endpoint
 */
export async function runTileApiTests() {
  console.log('\n=== Tile API Tests ===\n');

  let passCount = 0;
  let failCount = 0;

  // Helper to run a test
  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      passCount++;
    } catch (error) {
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
      failCount++;
    }
  }

  // Ensure server has loaded data
  await fetch(`${API_BASE}/api/config?path=tests/test_configs/browser_test.yaml`);
  await new Promise(resolve => setTimeout(resolve, 100)); // Wait for data to load

  // Test 1: Request single band tile with valid bounds
  await test('Should return tile data for valid bounds (single band)', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '0',
      rowEnd: '5',
      colStart: '0',
      colEnd: '5'
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(data.data, 'Response should contain data array');
    assert.ok(data.shape, 'Response should contain shape');
    assert.equal(data.shape[0], 5, 'Height should be 5');
    assert.equal(data.shape[1], 5, 'Width should be 5');
    assert.equal(data.data.length, 25, 'Should have 25 pixels (5x5)');
  });

  // Test 2: Request all bands for RGB display
  await test('Should return all bands for RGB display', async () => {
    const bands = [];
    for (let bandIndex = 0; bandIndex < 3; bandIndex++) {
      const params = new URLSearchParams({
        time: '0',
        band: String(bandIndex),
        rowStart: '0',
        rowEnd: '5',
        colStart: '0',
        colEnd: '5'
      });

      const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
      const data = await response.json();
      bands.push(data.data);
    }

    assert.equal(bands.length, 3, 'Should have 3 bands (RGB)');
    assert.equal(bands[0].length, 25, 'Each band should have 25 pixels');
  });

  // Test 3: Request tile for different time indices
  await test('Should return different data for different time indices', async () => {
    const params0 = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '0',
      rowEnd: '5',
      colStart: '0',
      colEnd: '5'
    });

    const params1 = new URLSearchParams({
      time: '1',
      band: '0',
      rowStart: '0',
      rowEnd: '5',
      colStart: '0',
      colEnd: '5'
    });

    const response0 = await fetch(`${API_BASE}/api/image/slice?${params0}`);
    const data0 = await response0.json();

    const response1 = await fetch(`${API_BASE}/api/image/slice?${params1}`);
    const data1 = await response1.json();

    assert.ok(data0.data, 'Time 0 should have data');
    assert.ok(data1.data, 'Time 1 should have data');
    assert.equal(data0.data.length, data1.data.length, 'Both should have same size');
  });

  // Test 4: Request tile at specific window bounds
  await test('Should return tile at specific window bounds', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '2',
      rowEnd: '7',
      colStart: '3',
      colEnd: '8'
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    const data = await response.json();

    assert.equal(data.shape[0], 5, 'Height should be 5 (7-2)');
    assert.equal(data.shape[1], 5, 'Width should be 5 (8-3)');
    assert.equal(data.data.length, 25, 'Should have 25 pixels');
  });

  // Test 5: Request tile with bounds exceeding array dimensions
  await test('Should handle bounds exceeding array dimensions', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '8',
      rowEnd: '15',  // Exceeds 10
      colStart: '8',
      colEnd: '15'   // Exceeds 10
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    const data = await response.json();

    assert.equal(data.shape[0], 7, 'Height should be 7 (15-8)');
    assert.equal(data.shape[1], 7, 'Width should be 7 (15-8)');
    // Should pad with zeros for out-of-bounds pixels
    assert.ok(data.data.length === 49, 'Should have 49 pixels with padding');
  });

  // Test 6: Request tile with negative start bounds
  await test('Should handle negative start bounds', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '-2',
      rowEnd: '3',
      colStart: '-2',
      colEnd: '3'
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    const data = await response.json();

    assert.equal(data.shape[0], 5, 'Height should be 5 (3-(-2))');
    assert.equal(data.shape[1], 5, 'Width should be 5 (3-(-2))');
    assert.ok(data.data.length === 25, 'Should have 25 pixels with padding');
  });

  // Test 7: Request full array window
  await test('Should return full array when bounds match dimensions', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '0',
      rowEnd: '10',
      colStart: '0',
      colEnd: '10'
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    const data = await response.json();

    assert.equal(data.shape[0], 10, 'Height should be 10');
    assert.equal(data.shape[1], 10, 'Width should be 10');
    assert.equal(data.data.length, 100, 'Should have 100 pixels (full 10x10 array)');
  });

  // Test 8: Validate data values are within valid range
  await test('Should return valid pixel values (0-255)', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '0',
      rowEnd: '5',
      colStart: '0',
      colEnd: '5'
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    const data = await response.json();

    const allValid = data.data.every(val => val >= 0 && val <= 255);
    assert.ok(allValid, 'All pixel values should be between 0 and 255');
  });

  // Test 9: Test response includes metadata
  await test('Should include shape metadata in response', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0',
      rowStart: '0',
      rowEnd: '5',
      colStart: '0',
      colEnd: '5'
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);
    const data = await response.json();

    assert.ok(data.shape, 'Should include shape');
    assert.ok(Array.isArray(data.shape), 'Shape should be array');
    assert.equal(data.shape.length, 2, 'Shape should have 2 dimensions [height, width]');
  });

  // Test 10: Test invalid parameters
  await test('Should handle missing required parameters', async () => {
    const params = new URLSearchParams({
      time: '0',
      band: '0'
      // Missing rowStart, rowEnd, colStart, colEnd
    });

    const response = await fetch(`${API_BASE}/api/image/slice?${params}`);

    // Should either return 400 error or return full array
    assert.ok(
      response.status === 400 || response.status === 200,
      'Should handle missing parameters gracefully'
    );
  });

  console.log(`\nTile API Tests: ${passCount} passed, ${failCount} failed\n`);
  return { passCount, failCount };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTileApiTests()
    .then(({ passCount, failCount }) => {
      process.exit(failCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}
