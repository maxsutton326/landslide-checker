/**
 * Polygon Rendering Utilities
 *
 * Functions for drawing GeoJSON polygons on canvas
 */

/**
 * Apply rendering style to canvas context
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} style - Style object
 */
export function applyStyle(ctx, style) {
  ctx.fillStyle = style.fillColor || 'rgba(255, 255, 0, 0.3)';
  ctx.strokeStyle = style.strokeColor || '#FFFF00';
  ctx.lineWidth = style.lineWidth || 2;
  ctx.globalAlpha = style.opacity !== undefined ? style.opacity : 1.0;
}

/**
 * Convert polygon coordinates to canvas path
 *
 * @param {Array<Array<Array<number>>>} coordinates - GeoJSON coordinates
 * @param {Object} transform - Transform with geoToCanvas function
 * @returns {Path2D} - Canvas Path2D object
 */
export function polygonToPath(coordinates, transform) {
  const path = new Path2D();

  coordinates.forEach((ring, ringIndex) => {
    ring.forEach((coord, i) => {
      const [x, y] = coord;
      const canvasCoord = transform.geoToCanvas(x, y);

      if (i === 0) {
        path.moveTo(canvasCoord.x, canvasCoord.y);
      } else {
        path.lineTo(canvasCoord.x, canvasCoord.y);
      }
    });
    path.closePath();
  });

  return path;
}

/**
 * Draw a GeoJSON polygon on canvas
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<Array<Array<number>>>} coordinates - GeoJSON polygon coordinates
 * @param {Object} transform - Transform object with geoToCanvas function
 * @param {Object} style - Rendering style
 */
export function drawPolygon(ctx, coordinates, transform, style = {}) {
  ctx.save();

  applyStyle(ctx, style);

  ctx.beginPath();

  // Draw each ring (first is outer, rest are holes)
  coordinates.forEach((ring, ringIndex) => {
    ring.forEach((coord, i) => {
      const [x, y] = coord;
      const canvasCoord = transform.geoToCanvas(x, y);

      if (i === 0) {
        ctx.moveTo(canvasCoord.x, canvasCoord.y);
      } else {
        ctx.lineTo(canvasCoord.x, canvasCoord.y);
      }
    });
    ctx.closePath();
  });

  // Fill and stroke
  if (style.fillColor || style.fillColor === undefined) {
    ctx.fill();
  }

  if (style.strokeColor || style.strokeColor === undefined) {
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw multiple polygons
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<Object>} polygons - Array of GeoJSON features
 * @param {Object} transform - Transform object
 * @param {Function} styleFunction - Function to get style for each polygon
 */
export function drawPolygons(ctx, polygons, transform, styleFunction) {
  polygons.forEach(polygon => {
    if (polygon.geometry.type !== 'Polygon') {
      console.warn('Skipping non-polygon geometry:', polygon.geometry.type);
      return;
    }

    const style = styleFunction ? styleFunction(polygon) : {};
    drawPolygon(ctx, polygon.geometry.coordinates, transform, style);
  });
}

/**
 * Draw polygon with label
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<Array<Array<number>>>} coordinates - Polygon coordinates
 * @param {Object} transform - Transform object
 * @param {Object} style - Rendering style
 * @param {string} label - Label text
 */
export function drawPolygonWithLabel(ctx, coordinates, transform, style, label) {
  // Draw polygon
  drawPolygon(ctx, coordinates, transform, style);

  // Calculate centroid for label placement
  const centroid = calculateCentroid(coordinates[0]);
  const canvasCoord = transform.geoToCanvas(centroid.x, centroid.y);

  // Draw label
  ctx.save();
  ctx.font = style.labelFont || '12px sans-serif';
  ctx.fillStyle = style.labelColor || '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.strokeText(label, canvasCoord.x, canvasCoord.y);
  ctx.fillText(label, canvasCoord.x, canvasCoord.y);

  ctx.restore();
}

/**
 * Calculate centroid of polygon ring
 *
 * @param {Array<Array<number>>} ring - Polygon ring coordinates
 * @returns {Object} - {x, y}
 */
function calculateCentroid(ring) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  // Exclude last point (same as first)
  for (let i = 0; i < ring.length - 1; i++) {
    sumX += ring[i][0];
    sumY += ring[i][1];
    count++;
  }

  return {
    x: sumX / count,
    y: sumY / count
  };
}

/**
 * Check if point is inside polygon (for hit testing)
 *
 * @param {number} x - Point X
 * @param {number} y - Point Y
 * @param {Array<Array<Array<number>>>} coordinates - Polygon coordinates
 * @returns {boolean} - True if inside
 */
export function pointInPolygon(x, y, coordinates) {
  const ring = coordinates[0]; // Outer ring only for now
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Highlight polygon with animation effect
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<Array<Array<number>>>} coordinates - Polygon coordinates
 * @param {Object} transform - Transform object
 * @param {number} frame - Animation frame (0-1)
 */
export function highlightPolygon(ctx, coordinates, transform, frame = 0) {
  const pulseAlpha = 0.3 + 0.2 * Math.sin(frame * Math.PI * 2);

  const highlightStyle = {
    fillColor: `rgba(255, 255, 0, ${pulseAlpha})`,
    strokeColor: '#FFFF00',
    lineWidth: 3
  };

  drawPolygon(ctx, coordinates, transform, highlightStyle);
}

/**
 * Draw polygon outline only
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<Array<Array<number>>>} coordinates - Polygon coordinates
 * @param {Object} transform - Transform object
 * @param {Object} style - Rendering style
 */
export function drawPolygonOutline(ctx, coordinates, transform, style = {}) {
  ctx.save();

  ctx.strokeStyle = style.strokeColor || '#FFFF00';
  ctx.lineWidth = style.lineWidth || 2;

  ctx.beginPath();

  coordinates.forEach((ring) => {
    ring.forEach((coord, i) => {
      const [x, y] = coord;
      const canvasCoord = transform.geoToCanvas(x, y);

      if (i === 0) {
        ctx.moveTo(canvasCoord.x, canvasCoord.y);
      } else {
        ctx.lineTo(canvasCoord.x, canvasCoord.y);
      }
    });
    ctx.closePath();
  });

  ctx.stroke();

  ctx.restore();
}

/**
 * Get polygon bounds
 *
 * @param {Array<Array<Array<number>>>} coordinates - Polygon coordinates
 * @returns {Object} - {minX, minY, maxX, maxY}
 */
export function getPolygonBounds(coordinates) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  coordinates.forEach(ring => {
    ring.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });

  return { minX, minY, maxX, maxY };
}

/**
 * Create default style for confidence-based coloring
 *
 * @param {number} confidence - Confidence value (0-1)
 * @returns {Object} - Style object
 */
export function confidenceStyle(confidence) {
  // High confidence: green, low confidence: red
  const hue = confidence * 120; // 0 = red, 120 = green
  const alpha = 0.3 + confidence * 0.2; // More confident = slightly more opaque

  return {
    fillColor: `hsla(${hue}, 70%, 50%, ${alpha})`,
    strokeColor: `hsl(${hue}, 70%, 40%)`,
    lineWidth: 2
  };
}
