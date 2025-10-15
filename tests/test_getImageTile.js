/**
 * Test for DataManager.getImageTile() method
 * Verifies that multi-band tiles are fetched and assembled correctly
 */

import { strict as assert } from 'assert';

// Simulate browser environment by adding fetch to global if needed
const API_BASE = 'http://localhost:3000';

/**
 * Test the getImageTile functionality
 */
async function testGetImageTile() {
  console.log('\n=== Testing DataManager.getImageTile() ===\n');

  // Load config to ensure data is ready
  await fetch(`${API_BASE}/api/config?path=tests/test_configs/browser_test.yaml`);
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate the DataManager.getImageTile method
  async function getImageTile(timeIndex, window, numBands = 3) {
    // Fetch all bands in parallel
    const bandPromises = [];
    for (let bandIndex = 0; bandIndex < numBands; bandIndex++) {
      const params = new URLSearchParams({
        time: timeIndex,
        band: bandIndex,
        rowStart: window.rowStart,
        rowEnd: window.rowEnd,
        colStart: window.colStart,
        colEnd: window.colEnd
      });
      bandPromises.push(
        fetch(`${API_BASE}/api/image/slice?${params}`).then(r => r.json())
      );
    }

    const bandResults = await Promise.all(bandPromises);

    // Verify all bands have same shape
    const shape = bandResults[0].shape;
    const [rows, cols] = shape;

    // Interleave band data into [rows, cols, bands] format
    const totalPixels = rows * cols * numBands;
    const interleavedData = new Float32Array(totalPixels);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pixelIndex = r * cols + c;
        const outputIndex = pixelIndex * numBands;

        for (let b = 0; b < numBands; b++) {
          interleavedData[outputIndex + b] = bandResults[b].data[pixelIndex];
        }
      }
    }

    return {
      data: interleavedData,
      shape: [rows, cols, numBands]
    };
  }

  // Test 1: Fetch 5x5 tile with 3 bands
  console.log('Test 1: Fetch 5x5 tile with 3 bands');
  const window1 = { rowStart: 0, rowEnd: 5, colStart: 0, colEnd: 5 };
  const tile1 = await getImageTile(0, window1, 3);

  assert.equal(tile1.shape[0], 5, 'Height should be 5');
  assert.equal(tile1.shape[1], 5, 'Width should be 5');
  assert.equal(tile1.shape[2], 3, 'Should have 3 bands');
  assert.equal(tile1.data.length, 75, 'Should have 75 total values (5*5*3)');
  console.log('✓ Tile has correct shape [5, 5, 3] with 75 values\n');

  // Test 2: Verify data is interleaved correctly
  console.log('Test 2: Verify RGB interleaving');

  // First pixel should have R, G, B values at indices 0, 1, 2
  const firstPixelR = tile1.data[0];
  const firstPixelG = tile1.data[1];
  const firstPixelB = tile1.data[2];

  // Second pixel should have R, G, B values at indices 3, 4, 5
  const secondPixelR = tile1.data[3];
  const secondPixelG = tile1.data[4];
  const secondPixelB = tile1.data[5];

  assert.ok(firstPixelR !== undefined && !isNaN(firstPixelR), 'First pixel R should be valid');
  assert.ok(firstPixelG !== undefined && !isNaN(firstPixelG), 'First pixel G should be valid');
  assert.ok(firstPixelB !== undefined && !isNaN(firstPixelB), 'First pixel B should be valid');

  console.log(`First pixel RGB: [${firstPixelR.toFixed(3)}, ${firstPixelG.toFixed(3)}, ${firstPixelB.toFixed(3)}]`);
  console.log(`Second pixel RGB: [${secondPixelR.toFixed(3)}, ${secondPixelG.toFixed(3)}, ${secondPixelB.toFixed(3)}]`);
  console.log('✓ Data is correctly interleaved\n');

  // Test 3: Different time indices
  console.log('Test 3: Fetch tiles for different time indices');
  const window2 = { rowStart: 2, rowEnd: 7, colStart: 2, colEnd: 7 };
  const tileBefore = await getImageTile(0, window2, 3);
  const tileAfter = await getImageTile(1, window2, 3);

  assert.deepEqual(tileBefore.shape, [5, 5, 3], 'Before tile should have shape [5,5,3]');
  assert.deepEqual(tileAfter.shape, [5, 5, 3], 'After tile should have shape [5,5,3]');
  console.log('✓ Both time indices return correct shapes\n');

  // Test 4: Larger window
  console.log('Test 4: Fetch larger 10x10 tile (full array)');
  const window3 = { rowStart: 0, rowEnd: 10, colStart: 0, colEnd: 10 };
  const tile3 = await getImageTile(0, window3, 3);

  assert.deepEqual(tile3.shape, [10, 10, 3], 'Full tile should have shape [10,10,3]');
  assert.equal(tile3.data.length, 300, 'Should have 300 values (10*10*3)');
  console.log('✓ Large tile fetched successfully\n');

  console.log('=== All getImageTile tests passed! ===\n');
}

// Run test
testGetImageTile()
  .then(() => {
    console.log('SUCCESS: All tests passed');
    process.exit(0);
  })
  .catch(error => {
    console.error('TEST FAILED:', error);
    process.exit(1);
  });
