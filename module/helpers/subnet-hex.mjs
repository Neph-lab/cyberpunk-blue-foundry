/**
 * Flat-top hexagon lattice geometry for the Subnet Builder.
 *
 * Pure, renderer-agnostic helpers (no Foundry API). Used by both the editor
 * canvas (`module/apps/subnet-builder.mjs`) and the scene materialiser
 * (`module/helpers/subnet-build.mjs`).
 *
 * Orientation: FLAT-TOP hexagons — flat horizontal top and bottom edges,
 * vertices pointing left and right. This matches the subnet node artwork
 * (400×400 tiles with the hexagon inscribed touching the left/right edges, and
 * a wide type-label banner meant to sit on the flat BOTTOM edge).
 *
 * Coordinates use axial (q, r):
 *   - q indexes the column (advances right + down-right),
 *   - r indexes the position within the sheared column.
 *
 * The six edges of a hex are numbered 0–5, edge i being the segment from
 * vertex i to vertex (i+1)%6. `NEIGHBOR_DELTAS[i]` is the axial step to the
 * hex that shares edge i. Because every vertex is derived from the same
 * lattice formula, a shared corner has byte-identical coordinates in both
 * adjacent hexes — so walls run along shared edges meet exactly with no gap.
 */

/** Distance from a hex centre to a vertex (px). Node tiles are 2*size wide. */
export const HEX_SIZE = 200;

/** Native node-tile / hex bounding-box width in px (vertex-to-vertex). */
export const TILE_SIZE = HEX_SIZE * 2;

/** √3 — reused constant. */
const SQRT3 = Math.sqrt(3);

/**
 * Axial step to the neighbour that shares edge i (i = 0..5), where edge i is
 * the segment (vertex i → vertex i+1) going clockwise from the right vertex.
 *   0: lower-right edge  → (+1,  0)
 *   1: bottom edge       → ( 0, +1)
 *   2: lower-left edge   → (-1, +1)
 *   3: upper-left edge   → (-1,  0)
 *   4: top edge          → ( 0, -1)
 *   5: upper-right edge  → (+1, -1)
 */
export const NEIGHBOR_DELTAS = [
  [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
];

/** Stable string key for an axial coordinate. */
export function axialKey(q, r) {
  return `${q},${r}`;
}

/** The neighbour axial coordinate across edge `edge` (0..5) from (q, r). */
export function neighborAxial(q, r, edge) {
  const [dq, dr] = NEIGHBOR_DELTAS[((edge % 6) + 6) % 6];
  return { q: q + dq, r: r + dr };
}

/** All six neighbour axial coordinates of (q, r), indexed by edge. */
export function neighbors(q, r) {
  return NEIGHBOR_DELTAS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

/**
 * Centre pixel of hex (q, r).
 * @returns {{x:number, y:number}}
 */
export function axialToPixel(q, r, size = HEX_SIZE) {
  return {
    x: size * 1.5 * q,
    y: size * SQRT3 * (r + q / 2),
  };
}

/**
 * Nearest hex axial to a pixel point (flat-top inverse + cube rounding).
 * @returns {{q:number, r:number}}
 */
export function pixelToAxial(x, y, size = HEX_SIZE) {
  const qf = (2 / 3) * (x / size);
  const rf = (-1 / 3) * (x / size) + (SQRT3 / 3) * (y / size);
  return cubeRound(qf, rf);
}

/** Round fractional axial (q, r) to the nearest integer hex via cube coords. */
function cubeRound(qf, rf) {
  const xf = qf;
  const zf = rf;
  const yf = -xf - zf;
  let rx = Math.round(xf);
  let ry = Math.round(yf);
  let rz = Math.round(zf);
  const dx = Math.abs(rx - xf);
  const dy = Math.abs(ry - yf);
  const dz = Math.abs(rz - zf);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

/**
 * The six vertices of the hex centred at (cx, cy), clockwise from the right
 * vertex (angles 0, 60, 120, 180, 240, 300 degrees).
 * @returns {{x:number, y:number}[]}
 */
export function hexVertices(cx, cy, size = HEX_SIZE) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i);
    verts.push({ x: cx + size * Math.cos(ang), y: cy + size * Math.sin(ang) });
  }
  return verts;
}

/** Flat [x0,y0,x1,y1,…] vertex list for a hex — for a Region polygon shape. */
export function hexPolygonPoints(cx, cy, size = HEX_SIZE) {
  const pts = [];
  for (const v of hexVertices(cx, cy, size)) pts.push(v.x, v.y);
  return pts;
}

/**
 * The segment for edge `edge` (0..5) of the hex at (cx, cy): vertex edge →
 * vertex (edge+1)%6.
 * @returns {{x0:number, y0:number, x1:number, y1:number}}
 */
export function edgeSegment(cx, cy, edge, size = HEX_SIZE) {
  const verts = hexVertices(cx, cy, size);
  const a = verts[((edge % 6) + 6) % 6];
  const b = verts[(((edge % 6) + 6) % 6 + 1) % 6];
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

/**
 * Canonical key for a hex edge (independent of which hex/direction names it),
 * so a shared edge between two nodes dedupes to one wall. Endpoints are rounded
 * and sorted.
 */
export function edgeKey(cx, cy, edge, size = HEX_SIZE) {
  const { x0, y0, x1, y1 } = edgeSegment(cx, cy, edge, size);
  const a = `${Math.round(x0)},${Math.round(y0)}`;
  const b = `${Math.round(x1)},${Math.round(y1)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Midpoint and length of the flat bottom edge (edge 1, vertex 1 → vertex 2),
 * where the type-label banner sits.
 * @returns {{x:number, y:number, length:number}}
 */
export function bottomEdge(cx, cy, size = HEX_SIZE) {
  const { x0, y0, x1, y1 } = edgeSegment(cx, cy, 1, size);
  return {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    length: Math.hypot(x1 - x0, y1 - y0),
  };
}

/** Ray-casting point-in-hex test (flat [x,y,…] polygon). */
export function pointInHex(px, py, cx, cy, size = HEX_SIZE) {
  const pts = hexPolygonPoints(cx, cy, size);
  let inside = false;
  const n = pts.length;
  let j = n - 2;
  for (let i = 0; i < n; i += 2) {
    const xi = pts[i]; const yi = pts[i + 1];
    const xj = pts[j]; const yj = pts[j + 1];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}

/**
 * Small solid-wall triangles hugging each of a hex's six vertices — a belt-and-
 * braces precaution against corner see-through. Returns an array of `c`
 * coordinate arrays (one per triangle edge). Normally unnecessary because
 * shared edges already meet exactly; provided for the materialiser to opt in.
 * @returns {number[][]} array of [x0,y0,x1,y1] segments
 */
export function cornerTriangles(cx, cy, size = HEX_SIZE, inset = 6) {
  const verts = hexVertices(cx, cy, size);
  const segs = [];
  for (const v of verts) {
    const dx = v.x - cx;
    const dy = v.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    // Two points inset from the vertex toward the centre, offset perpendicular.
    const px = -ny;
    const py = nx;
    const a = { x: v.x - nx * inset + px * inset, y: v.y - ny * inset + py * inset };
    const b = { x: v.x - nx * inset - px * inset, y: v.y - ny * inset - py * inset };
    segs.push([Math.round(a.x), Math.round(a.y), Math.round(v.x), Math.round(v.y)]);
    segs.push([Math.round(v.x), Math.round(v.y), Math.round(b.x), Math.round(b.y)]);
    segs.push([Math.round(b.x), Math.round(b.y), Math.round(a.x), Math.round(a.y)]);
  }
  return segs;
}

/**
 * Bounding box (min/max pixel) covering the hexes of all the given axial nodes.
 * @param {{q:number, r:number}[]} nodes
 * @returns {{minX:number, minY:number, maxX:number, maxY:number}}
 */
export function latticeBounds(nodes, size = HEX_SIZE) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const n of nodes) {
    const c = axialToPixel(n.q, n.r, size);
    for (const v of hexVertices(c.x, c.y, size)) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}
