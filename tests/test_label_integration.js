/**
 * End-to-End Integration Test for Label Panel
 *
 * Tests the complete flow from UI to server and back
 */

import { strict as assert } from 'assert';

const API_BASE = 'http://localhost:3000';

/**
 * Test Suite: Label Integration
 */
export async function runLabelIntegrationTests() {
  console.log('\n=== Label Integration Tests ===\n');

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

  // Test 1: Complete labeling workflow
  await test('Should complete full labeling workflow', async () => {
    // Step 1: Apply a label
    const labelData = {
      id: 7,
      label: 'landslide',
      confidence: 'high',
      notes: 'Integration test label',
      timestamp: Date.now()
    };

    const saveResponse = await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(labelData)
    });

    assert.equal(saveResponse.status, 200, 'Label should be saved');

    // Step 2: Retrieve and verify
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const labeled = landslides.features.find(f => f.id === 7);

    assert.ok(labeled, 'Landslide should exist');
    assert.equal(labeled.properties.label, 'landslide', 'Label should match');
    assert.equal(labeled.properties.label_confidence, 'high', 'Confidence should match');
    assert.equal(labeled.properties.label_notes, 'Integration test label', 'Notes should match');
  });

  // Test 2: Update existing label
  await test('Should update existing label', async () => {
    // First label
    await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 8,
        label: 'uncertain',
        confidence: 'low'
      })
    });

    // Update label
    await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 8,
        label: 'landslide',
        confidence: 'high',
        notes: 'Updated after review'
      })
    });

    // Verify
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const updated = landslides.features.find(f => f.id === 8);

    assert.equal(updated.properties.label, 'landslide', 'Should have updated label');
    assert.equal(updated.properties.label_confidence, 'high', 'Should have updated confidence');
  });

  // Test 3: Label persistence across sessions
  await test('Should persist labels across data reloads', async () => {
    // Set a label
    await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 9,
        label: 'no-landslide',
        confidence: 'medium',
        notes: 'Persistence test'
      })
    });

    // Reload data
    await fetch(`${API_BASE}/api/config?path=tests/test_configs/browser_test.yaml`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify label persisted
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const persisted = landslides.features.find(f => f.id === 9);

    assert.equal(persisted.properties.label, 'no-landslide', 'Label should persist');
    assert.equal(persisted.properties.label_notes, 'Persistence test', 'Notes should persist');
  });

  // Test 4: Multiple labels in sequence
  await test('Should handle multiple labels in sequence', async () => {
    const labels = [
      { id: 0, label: 'landslide', confidence: 'high' },
      { id: 1, label: 'no-landslide', confidence: 'high' },
      { id: 2, label: 'uncertain', confidence: 'low' }
    ];

    for (const labelData of labels) {
      const response = await fetch(`${API_BASE}/api/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(labelData)
      });
      assert.equal(response.status, 200, `Label ${labelData.id} should save`);
    }

    // Verify all
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const labeled0 = landslides.features.find(f => f.id === 0);
    const labeled1 = landslides.features.find(f => f.id === 1);
    const labeled2 = landslides.features.find(f => f.id === 2);

    assert.equal(labeled0.properties.label, 'landslide');
    assert.equal(labeled1.properties.label, 'no-landslide');
    assert.equal(labeled2.properties.label, 'uncertain');
  });

  // Test 5: Verify shapefile is written to disk
  await test('Should write labels to shapefile on disk', async () => {
    // Set a unique label
    const uniqueLabel = {
      id: 3,
      label: 'flag',
      confidence: 'high',
      notes: `File write test ${Date.now()}`
    };

    await fetch(`${API_BASE}/api/label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uniqueLabel)
    });

    // Reload from disk
    await fetch(`${API_BASE}/api/config?path=tests/test_configs/browser_test.yaml`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify from fresh load
    const landslides = await fetch(`${API_BASE}/api/landslides`).then(r => r.json());
    const fromDisk = landslides.features.find(f => f.id === 3);

    assert.equal(fromDisk.properties.label, 'flag', 'Should read from disk');
    assert.ok(
      fromDisk.properties.label_notes.includes('File write test'),
      'Notes should be from disk'
    );
  });

  console.log(`\nLabel Integration Tests: ${passCount} passed, ${failCount} failed\n`);
  return { passCount, failCount };
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLabelIntegrationTests()
    .then(({ passCount, failCount }) => {
      process.exit(failCount > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}
