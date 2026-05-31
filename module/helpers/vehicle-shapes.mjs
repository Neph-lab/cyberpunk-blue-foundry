/**
 * Renderer-agnostic geometry helpers for vehicle blueprint region shapes.
 *
 * A "shape" is a Foundry v14 Region shape descriptor in token-local pixel
 * coordinates:
 *   polygon   — { type:'polygon',   points:[x0,y0,x1,y1,…] }
 *   rectangle — { type:'rectangle', x, y, width, height }
 *   circle    — { type:'circle',    x, y, radius }
 *   ellipse   — { type:'ellipse',   x, y, radiusX, radiusY }
 *
 * All coordinates here are relative to the shape's own origin (the region
 * offset is applied by the caller, e.g. via a canvas transform). This keeps
 * the helpers usable by both the 2D-canvas blueprint editor and any other
 * consumer that needs hit-testing or bounds.
 */

/** Default extents used when a shape is missing or malformed. */
const FALLBACK_HALF = 8;

/**
 * Test whether a point (in shape-local coordinates) lies inside the shape.
 *
 * @param {object} shape
 * @param {number} lx  point x, shape-local
 * @param {number} ly  point y, shape-local
 * @returns {boolean}
 */
export function pointInShape(shape, lx, ly) {
  const type = shape?.type ?? '';

  if (type === 'polygon') {
    return pointInPolygon(shape.points ?? [], lx, ly);
  }
  if (type === 'rectangle') {
    const rx = shape.x ?? 0, ry = shape.y ?? 0;
    const rw = shape.width ?? 32, rh = shape.height ?? 32;
    return lx >= rx && lx <= rx + rw && ly >= ry && ly <= ry + rh;
  }
  if (type === 'circle') {
    const cx = shape.x ?? 0, cy = shape.y ?? 0, r = shape.radius ?? 16;
    return (lx - cx) ** 2 + (ly - cy) ** 2 <= r ** 2;
  }
  if (type === 'ellipse') {
    const cx = shape.x ?? 0, cy = shape.y ?? 0;
    const rx = shape.radiusX ?? 16, ry = shape.radiusY ?? 16;
    if (rx <= 0 || ry <= 0) return false;
    return ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1;
  }
  // Fallback: small square centred on the origin.
  return lx >= -FALLBACK_HALF && lx <= FALLBACK_HALF
      && ly >= -FALLBACK_HALF && ly <= FALLBACK_HALF;
}

/** Ray-casting point-in-polygon. points = [x0,y0,x1,y1,…] (shape-local). */
export function pointInPolygon(points, px, py) {
  const n = points.length;
  if (n < 6) return false; // need at least 3 vertices
  let inside = false;
  let j = n - 2;
  for (let i = 0; i < n; i += 2) {
    const xi = points[i], yi = points[i + 1];
    const xj = points[j], yj = points[j + 1];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

/**
 * Axis-aligned bounding box of a shape, in shape-local coordinates.
 *
 * @param {object} shape
 * @returns {{minX:number, minY:number, maxX:number, maxY:number}}
 */
export function getShapeLocalBounds(shape) {
  const type = shape?.type ?? '';

  if (type === 'polygon') {
    const pts = shape.points ?? [];
    if (pts.length < 2) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]);     maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
    }
    return { minX, minY, maxX, maxY };
  }
  if (type === 'rectangle') {
    const x = shape.x ?? 0, y = shape.y ?? 0;
    return { minX: x, minY: y, maxX: x + (shape.width ?? 0), maxY: y + (shape.height ?? 0) };
  }
  if (type === 'circle') {
    const x = shape.x ?? 0, y = shape.y ?? 0, r = shape.radius ?? 0;
    return { minX: x - r, minY: y - r, maxX: x + r, maxY: y + r };
  }
  if (type === 'ellipse') {
    const x = shape.x ?? 0, y = shape.y ?? 0;
    const rx = shape.radiusX ?? 0, ry = shape.radiusY ?? 0;
    return { minX: x - rx, minY: y - ry, maxX: x + rx, maxY: y + ry };
  }
  return { minX: -FALLBACK_HALF, minY: -FALLBACK_HALF, maxX: FALLBACK_HALF, maxY: FALLBACK_HALF };
}

/**
 * Trace a shape onto a 2D canvas path, in shape-local coordinates.
 *
 * The caller is responsible for the canvas transform (region offset, view
 * scale/pan) and for calling beginPath()/fill()/stroke() around this.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} shape
 */
export function traceShapePath(ctx, shape) {
  const type = shape?.type ?? '';

  if (type === 'polygon') {
    const pts = shape.points ?? [];
    if (pts.length < 6) { traceFallback(ctx); return; }
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    return;
  }
  if (type === 'rectangle') {
    ctx.rect(shape.x ?? 0, shape.y ?? 0, shape.width ?? 32, shape.height ?? 32);
    return;
  }
  if (type === 'circle') {
    ctx.arc(shape.x ?? 0, shape.y ?? 0, shape.radius ?? 16, 0, Math.PI * 2);
    return;
  }
  if (type === 'ellipse') {
    ctx.ellipse(shape.x ?? 0, shape.y ?? 0, shape.radiusX ?? 16, shape.radiusY ?? 16, 0, 0, Math.PI * 2);
    return;
  }
  traceFallback(ctx);
}

function traceFallback(ctx) {
  ctx.rect(-FALLBACK_HALF, -FALLBACK_HALF, FALLBACK_HALF * 2, FALLBACK_HALF * 2);
}

/**
 * Per-behaviorType display colour (hex string) for the editor + region list.
 * Used as fill/stroke tint and the list swatch.
 *
 * @param {string} behaviorType
 * @returns {string}
 */
export function behaviorColor(behaviorType) {
  switch (behaviorType) {
    case 'driverSeat':    return '#3a7abf'; // blue
    case 'gunnerSeat':    return '#c0392b'; // red
    case 'passengerSeat': return '#27ae60'; // green
    case 'vitalArea':     return '#e67e22'; // orange
    case 'vehicleRoof':   return '#8e44ad'; // purple
    default:              return '#7f8c8d'; // grey (untyped)
  }
}
