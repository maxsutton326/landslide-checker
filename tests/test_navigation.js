/**
 * Tests for Navigation Components
 */

import assert from 'assert';
import { LandslideNavigator } from '../src/viz/landslide_navigator.js';
import { ProgressTracker } from '../src/viz/progress_tracker.js';
import { QuickJump } from '../src/viz/quick_jump.js';
import { KeyboardHandler } from '../src/viz/keyboard_handler.js';
import { NavigationState } from '../src/state/navigation_state.js';

/**
 * Create mock landslides for testing
 */
function createMockLandslides(count = 10) {
  const landslides = [];
  for (let i = 0; i < count; i++) {
    landslides.push({
      id: `L${i}`,
      properties: {
        FID: `L${i}`,
        area: 100 + i * 10,
        confidence: 0.5 + i * 0.05,
        date_mapped: `2024-01-${String(i + 1).padStart(2, '0')}`
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      }
    });
  }
  return landslides;
}

/**
 * Create mock DOM element
 */
function createMockElement() {
  const mockElement = {
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    classList: {
      add: function() {},
      remove: function() {},
      toggle: function() {},
      contains: function() { return false; }
    },
    appendChild: function(child) {
      // Store children
      if (!this._children) this._children = [];
      this._children.push(child);
    },
    querySelector: function() { return createMockElement(); },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    removeEventListener: function() {},
    remove: function() {},
    dataset: {},
    _children: []
  };
  return mockElement;
}

/**
 * Mock document.createElement
 */
function mockCreateElement(tag) {
  return createMockElement();
}

// Setup global document mock for tests that need DOM
if (typeof document === 'undefined') {
  global.document = {
    createElement: mockCreateElement,
    addEventListener: function() {},
    removeEventListener: function() {},
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; }
  };
}

// Mock localStorage
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: function() { return null; },
    setItem: function() {},
    removeItem: function() {},
    clear: function() {}
  };
}

// Mock sessionStorage
if (typeof sessionStorage === 'undefined') {
  global.sessionStorage = {
    getItem: function() { return null; },
    setItem: function() {},
    removeItem: function() {},
    clear: function() {}
  };
}

/**
 * Run all tests
 */
async function runTests() {

/**
 * LandslideNavigator Tests
 */
console.log('Testing LandslideNavigator...');

// Test: Constructor
{
  const landslides = createMockLandslides(5);
  const navigator = new LandslideNavigator(landslides, null);
  assert.strictEqual(navigator.getTotalCount(), 5);
  assert.strictEqual(navigator.getCurrentIndex(), 0);
  assert.ok(navigator.getCurrent());
  console.log('✓ Navigator constructor works');
}

// Test: Next navigation
{
  const landslides = createMockLandslides(5);
  const navigator = new LandslideNavigator(landslides, null);

  await navigator.next();
  assert.strictEqual(navigator.getCurrentIndex(), 1);
  assert.strictEqual(navigator.getCurrent().id, 'L1');
  console.log('✓ Navigator next() works');
}

// Test: Previous navigation
{
  const landslides = createMockLandslides(5);
  const navigator = new LandslideNavigator(landslides, null);

  await navigator.next();
  await navigator.previous();
  assert.strictEqual(navigator.getCurrentIndex(), 0);
  console.log('✓ Navigator previous() works');
}

// Test: Boundary handling
{
  const landslides = createMockLandslides(5);
  const navigator = new LandslideNavigator(landslides, null);

  const result = await navigator.previous(); // Already at first
  assert.strictEqual(result, null);
  assert.strictEqual(navigator.getCurrentIndex(), 0);
  console.log('✓ Navigator handles first boundary');
}

// Test: Go to index
{
  const landslides = createMockLandslides(10);
  const navigator = new LandslideNavigator(landslides, null);

  await navigator.goTo(5);
  assert.strictEqual(navigator.getCurrentIndex(), 5);
  assert.strictEqual(navigator.getCurrent().id, 'L5');
  console.log('✓ Navigator goTo() works');
}

// Test: Go to ID
{
  const landslides = createMockLandslides(10);
  const navigator = new LandslideNavigator(landslides, null);

  await navigator.goToId('L7');
  assert.strictEqual(navigator.getCurrentIndex(), 7);
  console.log('✓ Navigator goToId() works');
}

// Test: First and Last
{
  const landslides = createMockLandslides(10);
  const navigator = new LandslideNavigator(landslides, null);

  await navigator.goTo(5);
  await navigator.first();
  assert.strictEqual(navigator.getCurrentIndex(), 0);

  await navigator.last();
  assert.strictEqual(navigator.getCurrentIndex(), 9);
  console.log('✓ Navigator first() and last() work');
}

// Test: isFirst and isLast
{
  const landslides = createMockLandslides(5);
  const navigator = new LandslideNavigator(landslides, null);

  assert.ok(navigator.isFirst());
  assert.ok(!navigator.isLast());

  await navigator.last();
  assert.ok(!navigator.isFirst());
  assert.ok(navigator.isLast());
  console.log('✓ Navigator isFirst() and isLast() work');
}

// Test: Search
{
  const landslides = createMockLandslides(10);
  const navigator = new LandslideNavigator(landslides, null);

  const results = navigator.search('L3');
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].landslide.id, 'L3');
  console.log('✓ Navigator search() works');
}

// Test: Filter
{
  const landslides = createMockLandslides(10);
  const navigator = new LandslideNavigator(landslides, null);

  const results = navigator.filter(ls => ls.properties.area > 150);
  assert.ok(results.length > 0);
  console.log('✓ Navigator filter() works');
}

/**
 * ProgressTracker Tests
 */
console.log('\nTesting ProgressTracker...');

// Test: Constructor
{
  const container = createMockElement();
  const tracker = new ProgressTracker(container, 100);
  const stats = tracker.getStats();
  assert.strictEqual(stats.total, 100);
  assert.strictEqual(stats.current, 0);
  console.log('✓ ProgressTracker constructor works');
}

// Test: Update position
{
  const container = createMockElement();
  const tracker = new ProgressTracker(container, 100);

  tracker.update(50, 25);
  const stats = tracker.getStats();
  assert.strictEqual(stats.current, 50);
  assert.strictEqual(stats.labeled, 25);
  assert.strictEqual(stats.percentage, 25);
  console.log('✓ ProgressTracker update() works');
}

// Test: Increment stat
{
  const container = createMockElement();
  const tracker = new ProgressTracker(container, 100);

  tracker.incrementStat('labeled');
  tracker.incrementStat('labeled');
  const stats = tracker.getStats();
  assert.strictEqual(stats.labeled, 2);
  console.log('✓ ProgressTracker incrementStat() works');
}

// Test: Set stat
{
  const container = createMockElement();
  const tracker = new ProgressTracker(container, 100);

  tracker.setStat('labeled', 50);
  const stats = tracker.getStats();
  assert.strictEqual(stats.labeled, 50);
  console.log('✓ ProgressTracker setStat() works');
}

// Test: Reset
{
  const container = createMockElement();
  const tracker = new ProgressTracker(container, 100);

  tracker.update(50, 25);
  tracker.reset();
  const stats = tracker.getStats();
  assert.strictEqual(stats.current, 0);
  assert.strictEqual(stats.labeled, 0);
  console.log('✓ ProgressTracker reset() works');
}

// Test: Export/Import
{
  const container = createMockElement();
  const tracker = new ProgressTracker(container, 100);

  tracker.update(25, 10);
  const exported = tracker.exportStats();

  const tracker2 = new ProgressTracker(container, 100);
  tracker2.importStats(exported);
  const stats = tracker2.getStats();
  assert.strictEqual(stats.current, 25);
  assert.strictEqual(stats.labeled, 10);
  console.log('✓ ProgressTracker export/import works');
}

/**
 * QuickJump Tests
 */
console.log('\nTesting QuickJump...');

// Test: Constructor
{
  const container = createMockElement();
  const landslides = createMockLandslides(10);
  const quickJump = new QuickJump(container, landslides);
  assert.ok(quickJump);
  console.log('✓ QuickJump constructor works');
}

// Test: Search
{
  const container = createMockElement();
  const landslides = createMockLandslides(10);
  const quickJump = new QuickJump(container, landslides);

  const results = quickJump.search('L5');
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].id, 'L5');
  console.log('✓ QuickJump search() works');
}

// Test: Add to history
{
  const container = createMockElement();
  const landslides = createMockLandslides(10);
  const quickJump = new QuickJump(container, landslides);

  quickJump.addToHistory('L3');
  quickJump.addToHistory('L5');
  assert.strictEqual(quickJump.history[0], 'L5'); // Most recent first
  assert.strictEqual(quickJump.history[1], 'L3');
  console.log('✓ QuickJump addToHistory() works');
}

// Test: Bookmarks
{
  const container = createMockElement();
  const landslides = createMockLandslides(10);
  const quickJump = new QuickJump(container, landslides);

  quickJump.addBookmark('L3');
  assert.ok(quickJump.isBookmarked('L3'));

  quickJump.removeBookmark('L3');
  assert.ok(!quickJump.isBookmarked('L3'));
  console.log('✓ QuickJump bookmark methods work');
}

// Test: Toggle bookmark
{
  const container = createMockElement();
  const landslides = createMockLandslides(10);
  const quickJump = new QuickJump(container, landslides);

  quickJump.toggleBookmark('L5');
  assert.ok(quickJump.isBookmarked('L5'));

  quickJump.toggleBookmark('L5');
  assert.ok(!quickJump.isBookmarked('L5'));
  console.log('✓ QuickJump toggleBookmark() works');
}

/**
 * KeyboardHandler Tests
 */
console.log('\nTesting KeyboardHandler...');

// Test: Constructor
{
  const handler = new KeyboardHandler({ enableDefaults: false });
  assert.ok(handler);
  console.log('✓ KeyboardHandler constructor works');
}

// Test: Register binding
{
  const handler = new KeyboardHandler({ enableDefaults: false });

  handler.register('a', 'Test action', 'test-action');
  const bindings = handler.getBindings();
  assert.ok(bindings.has('a'));
  console.log('✓ KeyboardHandler register() works');
}

// Test: Unregister binding
{
  const handler = new KeyboardHandler({ enableDefaults: false });

  handler.register('a', 'Test action', 'test-action');
  handler.unregister('a');
  const bindings = handler.getBindings();
  assert.ok(!bindings.has('a'));
  console.log('✓ KeyboardHandler unregister() works');
}

// Test: Binding key creation
{
  const handler = new KeyboardHandler({ enableDefaults: false });

  const key1 = handler.createBindingKey('a', {});
  const key2 = handler.createBindingKey('a', { ctrl: true });
  const key3 = handler.createBindingKey('a', { ctrl: true, shift: true });

  assert.strictEqual(key1, 'a');
  assert.strictEqual(key2, 'Ctrl+a');
  assert.strictEqual(key3, 'Ctrl+Shift+a');
  console.log('✓ KeyboardHandler createBindingKey() works');
}

// Test: Enable/disable
{
  const handler = new KeyboardHandler({ enableDefaults: false });

  assert.ok(handler.isEnabled);

  handler.disable();
  assert.ok(!handler.isEnabled);

  handler.enable();
  assert.ok(handler.isEnabled);
  console.log('✓ KeyboardHandler enable/disable works');
}

// Test: Export/import bindings
{
  const handler = new KeyboardHandler({ enableDefaults: false });

  handler.register('a', 'Action A', 'action-a');
  handler.register('b', 'Action B', 'action-b');

  const exported = handler.exportBindings();

  const handler2 = new KeyboardHandler({ enableDefaults: false });
  handler2.importBindings(exported);

  const bindings = handler2.getBindings();
  assert.ok(bindings.has('a'));
  assert.ok(bindings.has('b'));
  console.log('✓ KeyboardHandler export/import works');
}

/**
 * NavigationState Tests
 */
console.log('\nTesting NavigationState...');

// Test: Constructor
{
  const state = new NavigationState({ autosave: false });
  assert.ok(state);
  assert.strictEqual(state.currentIndex, -1);
  console.log('✓ NavigationState constructor works');
}

// Test: Push state
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  assert.strictEqual(state.currentIndex, 0);
  assert.strictEqual(state.history.length, 1);
  console.log('✓ NavigationState pushState() works');
}

// Test: Undo/Redo
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');
  state.pushState('L3');

  assert.ok(state.canUndo());
  assert.ok(!state.canRedo());

  const undoState = state.undo();
  assert.strictEqual(undoState.landslideId, 'L2');
  assert.ok(state.canRedo());

  const redoState = state.redo();
  assert.strictEqual(redoState.landslideId, 'L3');
  console.log('✓ NavigationState undo/redo works');
}

// Test: Get current state
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');

  const current = state.getCurrentState();
  assert.strictEqual(current.landslideId, 'L2');
  console.log('✓ NavigationState getCurrentState() works');
}

// Test: Jump to state
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');
  state.pushState('L3');

  state.jumpToState(1);
  const current = state.getCurrentState();
  assert.strictEqual(current.landslideId, 'L2');
  console.log('✓ NavigationState jumpToState() works');
}

// Test: Find by ID
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');
  state.pushState('L3');

  const found = state.findStateByLandslideId('L2');
  assert.ok(found);
  assert.strictEqual(found.index, 1);
  console.log('✓ NavigationState findStateByLandslideId() works');
}

// Test: Get visited
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');
  state.pushState('L1'); // Revisit

  const visited = state.getVisitedLandslides();
  assert.strictEqual(visited.size, 2); // Unique IDs
  console.log('✓ NavigationState getVisitedLandslides() works');
}

// Test: Clear history
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');
  state.clearHistory();

  assert.strictEqual(state.history.length, 0);
  assert.strictEqual(state.currentIndex, -1);
  console.log('✓ NavigationState clearHistory() works');
}

// Test: Export/Import
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');

  const exported = state.exportHistory();

  const state2 = new NavigationState({ autosave: false });
  state2.importHistory(exported);

  assert.strictEqual(state2.history.length, 2);
  assert.strictEqual(state2.currentIndex, 1);
  console.log('✓ NavigationState export/import works');
}

// Test: Statistics
{
  const state = new NavigationState({ autosave: false });

  state.pushState('L1');
  state.pushState('L2');
  state.pushState('L3');

  const stats = state.getStatistics();
  assert.strictEqual(stats.totalStates, 3);
  assert.strictEqual(stats.uniqueLandslides, 3);
  console.log('✓ NavigationState getStatistics() works');
}

console.log('\n✅ All navigation tests passed!');

}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
