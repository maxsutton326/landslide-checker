import { test, describe } from 'node:test';
import assert from 'node:assert';

/**
 * Mock Canvas Context for testing
 */
class MockCanvasContext {
  constructor() {
    this.operations = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this._transform = [1, 0, 0, 1, 0, 0];
  }

  beginPath() {
    this.operations.push({ type: 'beginPath' });
  }

  moveTo(x, y) {
    this.operations.push({ type: 'moveTo', x, y });
  }

  lineTo(x, y) {
    this.operations.push({ type: 'lineTo', x, y });
  }

  closePath() {
    this.operations.push({ type: 'closePath' });
  }

  fill() {
    this.operations.push({ type: 'fill' });
  }

  stroke() {
    this.operations.push({ type: 'stroke' });
  }

  clearRect(x, y, width, height) {
    this.operations.push({ type: 'clearRect', x, y, width, height });
  }

  putImageData(imageData, x, y) {
    this.operations.push({ type: 'putImageData', imageData, x, y });
  }

  setTransform(a, b, c, d, e, f) {
    this._transform = [a, b, c, d, e, f];
    this.operations.push({ type: 'setTransform', transform: [a, b, c, d, e, f] });
  }

  save() {
    this.operations.push({ type: 'save' });
  }

  restore() {
    this.operations.push({ type: 'restore' });
  }

  getOperations() {
    return this.operations;
  }

  reset() {
    this.operations = [];
  }
}

/**
 * Mock Canvas Element
 */
class MockCanvas {
  constructor(width = 800, height = 600) {
    this.width = width;
    this.height = height;
    this.ctx = new MockCanvasContext();
    this.eventListeners = {};
  }

  getContext(type) {
    if (type === '2d') {
      return this.ctx;
    }
    return null;
  }

  addEventListener(event, handler) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
    }
  }

  dispatchEvent(event) {
    if (this.eventListeners[event.type]) {
      this.eventListeners[event.type].forEach(handler => handler(event));
    }
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      right: this.width,
      bottom: this.height,
      x: 0,
      y: 0
    };
  }
}

// Import modules to test
import { arrayToImageData, floatToUint8 } from '../src/viz/canvas_renderer.js';
import { drawPolygon, polygonToPath, applyStyle } from '../src/viz/polygon_renderer.js';
import { ViewController } from '../src/viz/view_controller.js';

describe('Canvas Renderer Tests', () => {
  test('should convert float array to uint8', () => {
    const floats = [0.0, 0.5, 1.0, 0.25, 0.75];
    const uint8 = floatToUint8(floats);

    assert.strictEqual(uint8[0], 0);
    assert.strictEqual(uint8[1], 128); // 0.5 * 255 = 127.5, rounds to 128
    assert.strictEqual(uint8[2], 255);
    assert.strictEqual(uint8[3], 64); // 0.25 * 255 = 63.75, rounds to 64
    assert.strictEqual(uint8[4], 191); // 0.75 * 255 = 191.25, rounds to 191
  });

  test('should handle out of range float values', () => {
    const floats = [-0.5, 1.5, 2.0, -1.0];
    const uint8 = floatToUint8(floats);

    // Should clamp to 0-255
    assert.strictEqual(uint8[0], 0);
    assert.strictEqual(uint8[1], 255);
    assert.strictEqual(uint8[2], 255);
    assert.strictEqual(uint8[3], 0);
  });

  test('should convert 3-band array to ImageData format', () => {
    // Create a small 2x2x3 array
    const array = new Float32Array([
      // Pixel (0,0): R=1.0, G=0.5, B=0.0
      1.0, 0.5, 0.0,
      // Pixel (1,0): R=0.0, G=1.0, B=0.5
      0.0, 1.0, 0.5,
      // Pixel (0,1): R=0.5, G=0.0, B=1.0
      0.5, 0.0, 1.0,
      // Pixel (1,1): R=0.25, G=0.75, B=0.5
      0.25, 0.75, 0.5
    ]);

    const shape = [2, 2, 3];
    const imageData = arrayToImageData(array, shape);

    assert.strictEqual(imageData.width, 2);
    assert.strictEqual(imageData.height, 2);
    assert.strictEqual(imageData.data.length, 16); // 2x2 pixels * 4 channels

    // Check first pixel (0,0): R=255, G=128, B=0, A=255
    assert.strictEqual(imageData.data[0], 255);
    assert.strictEqual(imageData.data[1], 128); // 0.5 * 255 rounds to 128
    assert.strictEqual(imageData.data[2], 0);
    assert.strictEqual(imageData.data[3], 255);

    // Check second pixel (1,0): R=0, G=255, B=128, A=255
    assert.strictEqual(imageData.data[4], 0);
    assert.strictEqual(imageData.data[5], 255);
    assert.strictEqual(imageData.data[6], 128); // 0.5 * 255 rounds to 128
    assert.strictEqual(imageData.data[7], 255);
  });

  test('should handle grayscale (single band) arrays', () => {
    const array = new Float32Array([0.0, 0.5, 1.0, 0.25]);
    const shape = [2, 2, 1];
    const imageData = arrayToImageData(array, shape);

    // Grayscale should replicate to RGB
    assert.strictEqual(imageData.data[0], 0);
    assert.strictEqual(imageData.data[1], 0);
    assert.strictEqual(imageData.data[2], 0);
    assert.strictEqual(imageData.data[3], 255);
  });
});

describe('Polygon Renderer Tests', () => {
  test('should convert simple polygon to path', () => {
    const coordinates = [
      [
        [100, 100],
        [200, 100],
        [200, 200],
        [100, 200],
        [100, 100]
      ]
    ];

    const transform = {
      geoToCanvas: (x, y) => ({ x: x - 50, y: y - 50 })
    };

    const ctx = new MockCanvasContext();
    drawPolygon(ctx, coordinates, transform, {});

    const ops = ctx.getOperations();

    // Should have beginPath, moveTo, lineTo x3, closePath, fill, stroke
    assert.ok(ops.some(op => op.type === 'beginPath'));
    assert.ok(ops.some(op => op.type === 'moveTo'));
    assert.ok(ops.filter(op => op.type === 'lineTo').length >= 3);
    assert.ok(ops.some(op => op.type === 'closePath'));
    assert.ok(ops.some(op => op.type === 'fill'));
    assert.ok(ops.some(op => op.type === 'stroke'));
  });

  test('should apply style correctly', () => {
    const ctx = new MockCanvasContext();
    const style = {
      fillColor: 'rgba(255, 0, 0, 0.5)',
      strokeColor: '#00FF00',
      lineWidth: 2
    };

    applyStyle(ctx, style);

    assert.strictEqual(ctx.fillStyle, 'rgba(255, 0, 0, 0.5)');
    assert.strictEqual(ctx.strokeStyle, '#00FF00');
    assert.strictEqual(ctx.lineWidth, 2);
  });

  test('should use default style when not provided', () => {
    const ctx = new MockCanvasContext();
    applyStyle(ctx, {});

    // Should have some default values
    assert.ok(ctx.fillStyle !== undefined);
    assert.ok(ctx.strokeStyle !== undefined);
  });

  test('should handle polygons with holes', () => {
    const coordinates = [
      // Outer ring
      [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
        [0, 0]
      ],
      // Hole
      [
        [25, 25],
        [75, 25],
        [75, 75],
        [25, 75],
        [25, 25]
      ]
    ];

    const transform = {
      geoToCanvas: (x, y) => ({ x, y })
    };

    const ctx = new MockCanvasContext();
    drawPolygon(ctx, coordinates, transform, {});

    // Should draw both rings
    const moveToOps = ctx.getOperations().filter(op => op.type === 'moveTo');
    assert.strictEqual(moveToOps.length, 2); // One for outer, one for hole
  });
});

describe('View Controller Tests', () => {
  test('should initialize with default view', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);
    const transform = controller.getTransform();

    assert.ok(transform !== null);
    assert.ok(typeof transform.geoToCanvas === 'function');
    assert.ok(typeof transform.canvasToGeo === 'function');
  });

  test('should transform geographic to canvas coordinates', () => {
    const canvas = new MockCanvas(800, 600);
    const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };

    const controller = new ViewController(canvas, bounds);
    const transform = controller.getTransform();

    const canvasCoord = transform.geoToCanvas(400, 300);

    // Center of geographic bounds should map near center of canvas
    assert.ok(canvasCoord.x >= 300 && canvasCoord.x <= 500);
    assert.ok(canvasCoord.y >= 200 && canvasCoord.y <= 400);
  });

  test('should handle zoom in', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);
    const initialTransform = controller.getTransform();
    const initialScale = initialTransform.scale;

    controller.zoom(1.5, 400, 300);
    const newTransform = controller.getTransform();

    assert.ok(newTransform.scale > initialScale);
  });

  test('should handle zoom out', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);
    const initialTransform = controller.getTransform();
    const initialScale = initialTransform.scale;

    controller.zoom(0.5, 400, 300);
    const newTransform = controller.getTransform();

    assert.ok(newTransform.scale < initialScale);
  });

  test('should constrain zoom to min/max limits', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);
    controller.setConstraints(0.5, 4.0, bounds);

    // Try to zoom way in
    controller.zoom(100, 400, 300);
    let transform = controller.getTransform();
    assert.ok(transform.scale <= 4.0);

    // Reset and try to zoom way out
    controller.reset();
    controller.zoom(0.01, 400, 300);
    transform = controller.getTransform();
    assert.ok(transform.scale >= 0.5);
  });

  test('should handle pan events', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);
    controller.enablePan();

    const initialTransform = controller.getTransform();
    const initialOffset = { ...initialTransform.offset };

    controller.pan(50, -30);
    const newTransform = controller.getTransform();

    // Offset should have changed
    assert.ok(
      newTransform.offset.x !== initialOffset.x ||
      newTransform.offset.y !== initialOffset.y
    );
  });

  test('should reset view to initial state', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);
    const initialTransform = controller.getTransform();
    const initialScale = initialTransform.scale;

    // Modify view
    controller.zoom(2, 400, 300);
    controller.pan(100, 100);

    // Reset
    controller.reset();
    const resetTransform = controller.getTransform();

    assert.strictEqual(resetTransform.scale, initialScale);
  });

  test('should emit view change events', () => {
    const canvas = new MockCanvas();
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

    const controller = new ViewController(canvas, bounds);

    let eventFired = false;
    controller.on('viewchange', () => {
      eventFired = true;
    });

    controller.zoom(2, 400, 300);
    assert.ok(eventFired);
  });
});

describe('Integration Tests', () => {
  test('should render complete scene with image and polygon', () => {
    const canvas = new MockCanvas(800, 600);
    const ctx = canvas.getContext('2d');

    // Create test image data
    const imageArray = new Float32Array(100 * 100 * 3);
    for (let i = 0; i < imageArray.length; i++) {
      imageArray[i] = Math.random();
    }

    const imageData = arrayToImageData(imageArray, [100, 100, 3]);
    ctx.putImageData(imageData, 0, 0);

    // Draw polygon
    const polygon = [[[50, 50], [150, 50], [150, 150], [50, 150], [50, 50]]];
    const transform = {
      geoToCanvas: (x, y) => ({ x, y })
    };
    drawPolygon(ctx, polygon, transform, {
      fillColor: 'rgba(255, 0, 0, 0.3)',
      strokeColor: '#FF0000',
      lineWidth: 2
    });

    const ops = ctx.getOperations();

    // Should have both putImageData and polygon drawing operations
    assert.ok(ops.some(op => op.type === 'putImageData'));
    assert.ok(ops.some(op => op.type === 'beginPath'));
    assert.ok(ops.some(op => op.type === 'fill'));
  });
});

export { MockCanvas, MockCanvasContext };
