/**
 * Tests for Label Persistence API
 *
 * Tests the server API endpoint for updating landslide labels in the shapefile
 */

import { strict as assert } from 'assert';

const API_BASE = 'http://localhost:3000';

/**
 * Test Suite: Label API Endpoint
 */
export async function runLabelApiTests() {
  console.log('\n=== Label API Tests ===\n');

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
  await new Promise(resolve => setTimeout(resolve, 100));

  // Test 1: Update label for a landslide
  await test('Should update label for a landslide', async () => {
    const labelData = {
      id: 0,
      label: 'landslide',
      confidence: 'high',
      notes: 'Clear landslide detection',
      timestamp: Date.now()
    };

    const response = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(response.status, 200, 'Should return 200 status');

    const result = await response.json();
    assert.ok(result.success, 'Should return success=true');
    assert.equal(result.id, 0, 'Should return the feature ID');
  });

  // Test 2: Verify label was persisted
  await test('Should retrieve updated label from shapefile', async () => {
    const response = await fetch(`${API_BASE}/api/landslides`);
    const landslides = await response.json();

    const feature = landslides.features.find(f => f.id === 0);
    assert.ok(feature, 'Feature should exist');
    assert.equal(feature.properties.label, 'landslide', 'Label should be updated');
    assert.equal(feature.properties.label_confidence, 'high', 'Confidence should be updated');
    assert.equal(feature.properties.label_notes, 'Clear landslide detection', 'Notes should be updated');
  });

  // Test 3: Update multiple landslides
  await test('Should update multiple landslides', async () => {
    const labels = [
      { id: 1, label: 'no-landslide', confidence: 'medium', notes: 'False positive' },
      { id: 2, label: 'uncertain', confidence: 'low', notes: 'Needs review' }
    ];

    for (const labelData of labels) {
      const response = await fetch(`${API_BASE}/api/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData)
      });
      assert.equal(response.status, 200);
    }

    // Verify both were updated
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const feature1 = landslides.features.find(f => f.id === 1);
    const feature2 = landslides.features.find(f => f.id === 2);

    assert.equal(feature1.properties.label, 'no-landslide');
    assert.equal(feature2.properties.label, 'uncertain');
  });

  // Test 4: Update label without confidence or notes (should use defaults)
  await test('Should handle partial label updates', async () => {
    const labelData = {
      id: 3,
      label: 'skip'
    };

    const response = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(response.status, 200);

    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const feature = landslides.features.find(f => f.id === 3);
    assert.equal(feature.properties.label, 'skip');
  });

  // Test 5: Clear a label (set to null)
  await test('Should clear label when set to null', async () => {
    const labelData = {
      id: 0,
      label: null
    };

    const response = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(response.status, 200);

    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const feature = landslides.features.find(f => f.id === 0);
    assert.ok(
      feature.properties.label === null || feature.properties.label === undefined,
      'Label should be cleared'
    );
  });

  // Test 6: Handle invalid feature ID
  await test('Should return error for invalid feature ID', async () => {
    const labelData = {
      id: 9999,
      label: 'landslide'
    };

    const response = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(response.status, 404, 'Should return 404 for invalid ID');

    const result = await response.json();
    assert.ok(result.error, 'Should return error message');
  });

  // Test 7: Handle missing ID
  await test('Should return error for missing ID', async () => {
    const labelData = {
      label: 'landslide'
    };

    const response = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(response.status, 400, 'Should return 400 for missing ID');

    const result = await response.json();
    assert.ok(result.error, 'Should return error message');
  });

  // Test 8: Test timestamp is saved
  await test('Should save timestamp with label', async () => {
    const now = Date.now();
    const labelData = {
      id: 4,
      label: 'flag',
      timestamp: now
    };

    const response = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(response.status, 200);

    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const feature = landslides.features.find(f => f.id === 4);
    assert.ok(feature.properties.label_timestamp, 'Timestamp should be saved');
  });

  // Test 9: Update same landslide multiple times
  await test('Should allow updating same landslide multiple times', async () => {
    const updates = [
      { id: 5, label: 'landslide', confidence: 'low' },
      { id: 5, label: 'uncertain', confidence: 'medium' },
      { id: 5, label: 'no-landslide', confidence: 'high' }
    ];

    for (const labelData of updates) {
      const response = await fetch(`${API_BASE}/api/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData)
      });
      assert.equal(response.status, 200);
    }

    // Verify final state
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const feature = landslides.features.find(f => f.id === 5);
    assert.equal(feature.properties.label, 'no-landslide', 'Should have latest label');
    assert.equal(feature.properties.label_confidence, 'high', 'Should have latest confidence');
  });

  // Test 10: Verify labels persist across data reloads
  await test('Should persist labels after data reload', async () => {
    // Set a label
    await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 6, label: 'landslide', confidence: 'high' })
    });

    // Reload data
    await fetch(`${API_BASE}/api/config?path=tests/test_configs/browser_test.yaml`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify label is still there
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const feature = landslides.features.find(f => f.id === 6);
    assert.equal(feature.properties.label, 'landslide', 'Label should persist after reload');
  });

  console.log(`\nLabel API Tests: ${passCount} passed, ${failCount} failed\n`);
  return { passCount, failCount };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLabelApiTests()
    .then(({ passCount, failCount }) => {
      process.exit(failCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}
