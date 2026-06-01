/**
 * Unit tests for module/helpers/vehicle-vector.mjs.
 * Run with:  node --test test/
 * (Pure module, no Foundry runtime needed.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalise360,
  normaliseSigned,
  forwardUnit,
  headingFromVector,
  displacementPx,
  advanceTokenPosition,
  turnAngleBetween,
  clampHeadingDelta,
  quantiseHeading,
  rotatePointAboutPivot,
} from '../module/helpers/vehicle-vector.mjs';

const EPS = 1e-9;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const nearVec = (v, x, y, eps = 1e-6) => near(v.x, x, eps) && near(v.y, y, eps);

test('normalise360 wraps into [0,360)', () => {
  assert.equal(normalise360(0), 0);
  assert.equal(normalise360(360), 0);
  assert.equal(normalise360(370), 10);
  assert.equal(normalise360(-10), 350);
  assert.equal(normalise360(-360), 0);
  assert.equal(normalise360(720 + 45), 45);
});

test('normaliseSigned wraps into (-180,180]', () => {
  assert.equal(normaliseSigned(0), 0);
  assert.equal(normaliseSigned(180), 180);
  assert.equal(normaliseSigned(-180), 180); // -180 maps to +180
  assert.equal(normaliseSigned(190), -170);
  assert.equal(normaliseSigned(-190), 170);
  assert.equal(normaliseSigned(360), 0);
});

test('forwardUnit cardinal headings (nose-up)', () => {
  assert.ok(nearVec(forwardUnit(0), 0, -1), 'up');
  assert.ok(nearVec(forwardUnit(90), 1, 0), 'right');
  assert.ok(nearVec(forwardUnit(180), 0, 1), 'down');
  assert.ok(nearVec(forwardUnit(270), -1, 0), 'left');
});

test('forwardUnit is always a unit vector', () => {
  for (const deg of [0, 15, 33, 90, 137, 180, 271, 359]) {
    const u = forwardUnit(deg);
    assert.ok(near(Math.hypot(u.x, u.y), 1), `|forwardUnit(${deg})| == 1`);
  }
});

test('headingFromVector inverts forwardUnit', () => {
  assert.equal(headingFromVector(0, -1), 0);
  assert.equal(headingFromVector(1, 0), 90);
  assert.equal(headingFromVector(0, 1), 180);
  assert.equal(headingFromVector(-1, 0), 270);
  // round-trip
  for (const deg of [0, 15, 47, 123, 200, 299, 345]) {
    const u = forwardUnit(deg);
    assert.ok(near(headingFromVector(u.x, u.y), deg, 1e-4), `round-trip ${deg}`);
  }
});

test('headingFromVector zero vector → 0', () => {
  assert.equal(headingFromVector(0, 0), 0);
});

test('displacementPx scales by grid size and respects reverse', () => {
  // heading up, 3 spaces, grid 100 → straight up 300px (−Y)
  assert.ok(nearVec(displacementPx(0, 3, 100), 0, -300));
  // heading right, 2 spaces, grid 50 → +X 100px
  assert.ok(nearVec(displacementPx(90, 2, 50), 100, 0));
  // negative gridSpaces = reverse (down when nose is up)
  assert.ok(nearVec(displacementPx(0, -2, 100), 0, 200));
});

test('advanceTokenPosition translates top-left (multi-square safe)', () => {
  const scene = { grid: { size: 100 } };
  // 2x2 token, nose up, advance 1 space → y decreases by 100, x unchanged
  const tok = { x: 500, y: 500, rotation: 0, width: 2, height: 2 };
  assert.deepEqual(advanceTokenPosition(tok, 1, scene), { x: 500, y: 400 });
  // heading right
  const tok2 = { x: 500, y: 500, rotation: 90 };
  const p = advanceTokenPosition(tok2, 1, scene);
  assert.ok(nearVec(p, 600, 500));
  // rotationOverride wins over tokenDoc.rotation
  const p2 = advanceTokenPosition({ x: 0, y: 0, rotation: 0 }, 1, scene, 180);
  assert.ok(nearVec(p2, 0, 100));
});

test('advanceTokenPosition defaults grid size to 100', () => {
  const p = advanceTokenPosition({ x: 0, y: 0, rotation: 0 }, 1, {});
  assert.ok(nearVec(p, 0, -100));
});

test('turnAngleBetween signed (clockwise positive)', () => {
  const right = { x: 1, y: 0 };
  const down = { x: 0, y: 1 };
  const up = { x: 0, y: -1 };
  const left = { x: -1, y: 0 };
  // right → down is a clockwise (right) turn in y-down space
  assert.ok(near(turnAngleBetween(right, down), 90));
  // right → up is counter-clockwise (left)
  assert.ok(near(turnAngleBetween(right, up), -90));
  // up → left is counter-clockwise
  assert.ok(near(turnAngleBetween(up, left), -90));
  // straight ahead = 0
  assert.ok(near(turnAngleBetween(up, up), 0));
  // 180° opposite normalises to +180
  assert.ok(near(Math.abs(turnAngleBetween(up, down)), 180));
});

test('turnAngleBetween zero vector → 0', () => {
  assert.equal(turnAngleBetween({ x: 0, y: 0 }, { x: 1, y: 0 }), 0);
  assert.equal(turnAngleBetween({ x: 1, y: 0 }, { x: 0, y: 0 }), 0);
});

test('clampHeadingDelta limits change to ±maxDeg, shortest path', () => {
  // within envelope: returns target
  assert.equal(clampHeadingDelta(0, 20, 30), 20);
  // beyond envelope clockwise: clamped to +30
  assert.equal(clampHeadingDelta(0, 90, 30), 30);
  // beyond envelope counter-clockwise: clamped to -30 → 330
  assert.equal(clampHeadingDelta(0, 270, 30), 330);
  // wrap-around shortest path: 350 → 10 is +20, within 30
  assert.equal(clampHeadingDelta(350, 10, 30), 10);
  // 350 → 100 desired (delta +110) clamps to +30 → 20
  assert.equal(clampHeadingDelta(350, 100, 30), 20);
});

test('quantiseHeading snaps to nearest step', () => {
  assert.equal(quantiseHeading(7.5), 15);   // .5 rounds up
  assert.equal(quantiseHeading(7.49), 0);
  assert.equal(quantiseHeading(352.6), 0);   // 360 wraps to 0
  assert.equal(quantiseHeading(22.4), 15);
  assert.equal(quantiseHeading(22.5), 30);
  assert.equal(quantiseHeading(-1), 0);      // 359 → 360 → 0
  assert.equal(quantiseHeading(44, 90), 0);
  assert.equal(quantiseHeading(46, 90), 90);
});

test('quantiseHeading is idempotent on grid values', () => {
  for (let d = 0; d < 360; d += 15) {
    assert.equal(quantiseHeading(d), d % 360);
  }
});

test('rotatePointAboutPivot rotates clockwise in y-down space', () => {
  const pivot = { x: 0, y: 0 };
  // +90° clockwise (y-down): (1,0) → (0,1)
  assert.ok(nearVec(rotatePointAboutPivot({ x: 1, y: 0 }, pivot, 90), 0, 1));
  // +90°: (0,1) → (-1,0)
  assert.ok(nearVec(rotatePointAboutPivot({ x: 0, y: 1 }, pivot, 90), -1, 0));
  // -90°: (1,0) → (0,-1)
  assert.ok(nearVec(rotatePointAboutPivot({ x: 1, y: 0 }, pivot, -90), 0, -1));
  // 180°: (1,2) → (-1,-2)
  assert.ok(nearVec(rotatePointAboutPivot({ x: 1, y: 2 }, pivot, 180), -1, -2));
});

test('rotatePointAboutPivot is identity at 0° and about its own pivot', () => {
  const p = { x: 5, y: 7 };
  const out = rotatePointAboutPivot({ x: 9, y: 3 }, p, 0);
  assert.deepEqual(out, { x: 9, y: 3 });
  // a point at the pivot never moves
  assert.ok(nearVec(rotatePointAboutPivot(p, p, 123), p.x, p.y));
});

test('rotatePointAboutPivot rotates about a non-origin pivot', () => {
  const pivot = { x: 10, y: 10 };
  // point (12,10) is 2 right of pivot; +90° cw → 2 below pivot → (10,12)
  assert.ok(nearVec(rotatePointAboutPivot({ x: 12, y: 10 }, pivot, 90), 10, 12));
});
