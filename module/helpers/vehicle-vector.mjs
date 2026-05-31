/**
 * Vehicle vector-movement maths.
 *
 * Pure, dependency-free helpers shared by the vehicle movement subsystem.
 * Movement is modelled as a vector = magnitude (grid spaces / round) × heading
 * (the direction the artwork faces). The forward axis is nose-up: at
 * `token.rotation === 0` the nose points up / north (−Y). Foundry rotation is
 * clockwise in y-down screen space, matching `rotateShape` in
 * vehicle-regions.mjs.
 *
 * Everything here is a pure function of its arguments — no Foundry globals, no
 * side effects — so the file imports cleanly under Node for unit testing
 * (see test/vehicle-vector.test.mjs).
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Normalise an angle to the half-open range [0, 360).
 * @param {number} deg
 * @returns {number}
 */
export function normalise360(deg) {
  const r = deg % 360;
  // `+ 0` collapses the -0 that `(-360) % 360` produces into +0.
  return r < 0 ? r + 360 : r + 0;
}

/**
 * Normalise an angle to the signed range (−180, 180]. Useful for "shortest
 * turn" deltas where direction (left/right) matters.
 * @param {number} deg
 * @returns {number}
 */
export function normaliseSigned(deg) {
  let r = deg % 360;
  if (r > 180) r -= 360;
  if (r <= -180) r += 360;
  return r;
}

/**
 * Unit forward vector for a heading. Nose-up convention:
 *   θ=0   → (0, −1)  up / north
 *   θ=90  → (1, 0)   right / east
 *   θ=180 → (0, 1)   down / south
 *   θ=270 → (−1, 0)  left / west
 * @param {number} rotationDeg Clockwise degrees (Foundry native).
 * @returns {{x: number, y: number}} Unit vector in screen (y-down) space.
 */
export function forwardUnit(rotationDeg) {
  const rad = (rotationDeg ?? 0) * DEG2RAD;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

/**
 * Inverse of {@link forwardUnit}: the heading whose forward vector points along
 * (dx, dy). Returned normalised to [0, 360). A zero vector returns 0.
 * @param {number} dx
 * @param {number} dy
 * @returns {number} Clockwise degrees.
 */
export function headingFromVector(dx, dy) {
  if (dx === 0 && dy === 0) return 0;
  return normalise360(Math.atan2(dx, -dy) * RAD2DEG);
}

/**
 * Pixel displacement for travelling `gridSpaces` along a heading. Negative
 * `gridSpaces` reverses (travel along −forwardUnit).
 * @param {number} rotationDeg
 * @param {number} gridSpaces
 * @param {number} gridSize Scene grid size in pixels.
 * @returns {{x: number, y: number}}
 */
export function displacementPx(rotationDeg, gridSpaces, gridSize) {
  const u = forwardUnit(rotationDeg);
  const dist = gridSpaces * gridSize;
  return { x: u.x * dist, y: u.y * dist };
}

/**
 * New top-left position for a token after advancing `gridSpaces` along its
 * heading. Because the move is a pure translation, the displacement applies
 * equally to the top-left and the centre, so multi-square tokens advance
 * correctly without extra centre maths.
 *
 * @param {{x: number, y: number, rotation?: number}} tokenDoc Token document
 *   (or any object exposing x/y and optionally rotation).
 * @param {number} gridSpaces Grid spaces to advance; negative = reverse.
 * @param {{grid?: {size?: number}}} scene Scene (for grid.size).
 * @param {number} [rotationOverride] Heading to use instead of tokenDoc.rotation
 *   (e.g. when rotating then advancing in the same update).
 * @returns {{x: number, y: number}} New top-left in scene pixels.
 */
export function advanceTokenPosition(tokenDoc, gridSpaces, scene, rotationOverride) {
  const gridSize = scene?.grid?.size ?? 100;
  const rot = rotationOverride ?? tokenDoc?.rotation ?? 0;
  const d = displacementPx(rot, gridSpaces, gridSize);
  return { x: (tokenDoc?.x ?? 0) + d.x, y: (tokenDoc?.y ?? 0) + d.y };
}

/**
 * Signed turn angle from drawn segment v1 to v2. Positive = clockwise (a right
 * turn in y-down screen space, consistent with Foundry rotation); negative =
 * counter-clockwise (left). Magnitude feeds the angle buckets; sign gives L/R.
 * Either zero-length vector returns 0.
 * @param {{x: number, y: number}} v1
 * @param {{x: number, y: number}} v2
 * @returns {number} Signed degrees in (−180, 180].
 */
export function turnAngleBetween(v1, v2) {
  if (!v1 || !v2) return 0;
  if ((v1.x === 0 && v1.y === 0) || (v2.x === 0 && v2.y === 0)) return 0;
  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;
  return normaliseSigned(Math.atan2(cross, dot) * RAD2DEG);
}

/**
 * Clamp a heading change to within ±maxDeg of the current heading, taking the
 * shortest path. Used by Cruise (±30° envelope). Returns the resulting absolute
 * heading, normalised to [0, 360).
 * @param {number} curRot Current heading.
 * @param {number} targetRot Desired heading.
 * @param {number} maxDeg Maximum allowed change magnitude.
 * @returns {number}
 */
export function clampHeadingDelta(curRot, targetRot, maxDeg) {
  let delta = normaliseSigned(targetRot - curRot);
  const m = Math.abs(maxDeg);
  if (delta > m) delta = m;
  if (delta < -m) delta = -m;
  return normalise360(curRot + delta);
}

/**
 * Snap a heading to the nearest `step`° in world space. CRITICAL: every
 * auto-move must call this on the final heading immediately before writing it,
 * otherwise accumulated fractional error permanently offsets the vehicle
 * relative to the 15° grid players reason about. Returned normalised to
 * [0, 360).
 * @param {number} rotationDeg
 * @param {number} [step=15]
 * @returns {number}
 */
export function quantiseHeading(rotationDeg, step = 15) {
  const s = step || 15;
  const snapped = Math.round(normalise360(rotationDeg) / s) * s;
  return normalise360(snapped);
}
