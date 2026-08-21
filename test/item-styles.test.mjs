/**
 * Unit tests for the Style helpers in module/data/style-schema.mjs.
 * Run with:  node --test test/
 *
 * The invariant under test is the ArrayField trap: Foundry's
 * ArrayField._cleanElement forces `partial: false`, so any style field missing
 * from a submit is reset to its schema `initial`. buildStylesSubmitData must
 * therefore emit EVERY field of EVERY style, no matter how little the form sent
 * — otherwise a ProseMirror save silently wipes the style's name, cost and
 * bonus, and a player's form (which never contains the GM-only bonus) wipes it
 * on every single submit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildStylesSubmitData, getSelectedStyle } from '../module/data/style-schema.mjs';

const STYLES = [
  { id: 'aaa', name: 'Chrome Noir', img: 'chrome.png', description: '<p>Old</p>', manufacturer: 'MaxiWear', cost: 'LX', bonus: 1 },
  { id: 'bbb', name: 'Kitsch', img: 'kitsch.png', description: '<p>Loud</p>', manufacturer: '', cost: '', bonus: -1 },
];

// ── getSelectedStyle ────────────────────────────────────────────────────────

test('no selection resolves to Default (null)', () => {
  assert.equal(getSelectedStyle({ styles: STYLES, selectedStyle: '' }), null);
});

test('a dangling selection resolves to Default rather than throwing', () => {
  assert.equal(getSelectedStyle({ styles: STYLES, selectedStyle: 'deleted' }), null);
});

test('a live selection resolves to that style', () => {
  assert.equal(getSelectedStyle({ styles: STYLES, selectedStyle: 'bbb' }).name, 'Kitsch');
});

test('missing system data is tolerated', () => {
  assert.equal(getSelectedStyle(undefined), null);
  assert.equal(getSelectedStyle({ selectedStyle: 'aaa' }), null);
});

// ── buildStylesSubmitData ───────────────────────────────────────────────────

test('a ProseMirror-only save preserves every other field of every style', () => {
  const update = buildStylesSubmitData(STYLES, {
    'system.styles.0.description': '<p>New blurb</p>',
  });

  // The edited field lands…
  assert.equal(update['system.styles.0.description'], '<p>New blurb</p>');
  // …and nothing else on that style is left undefined for cleanData to reset.
  assert.equal(update['system.styles.0.name'], 'Chrome Noir');
  assert.equal(update['system.styles.0.cost'], 'LX');
  assert.equal(update['system.styles.0.manufacturer'], 'MaxiWear');
  assert.equal(update['system.styles.0.bonus'], 1);
  assert.equal(update['system.styles.0.id'], 'aaa');
  assert.equal(update['system.styles.0.img'], 'chrome.png');

  // The untouched style is emitted in full too, or it would be reset wholesale.
  assert.equal(update['system.styles.1.name'], 'Kitsch');
  assert.equal(update['system.styles.1.bonus'], -1);
  assert.equal(update['system.styles.1.description'], '<p>Loud</p>');
});

test("a player's submit (no bonus field in their form) never zeroes the bonus", () => {
  const update = buildStylesSubmitData(STYLES, {
    'system.styles.0.description': '<p>Edited</p>',
    // note: no system.styles.0.bonus — players never render that input
  });
  assert.equal(update['system.styles.0.bonus'], 1);
  assert.equal(update['system.styles.1.bonus'], -1);
});

test('every emitted key is a flat dot-path, never a nested object', () => {
  const update = buildStylesSubmitData(STYLES, { 'system.styles.1.name': 'Neokitsch' });
  for (const [key, value] of Object.entries(update)) {
    assert.match(key, /^system\.styles\.\d+\.[a-zA-Z]+$/, `not a flat path: ${key}`);
    assert.notEqual(typeof value, 'object', `nested object under ${key}`);
  }
  assert.equal(update['system.styles.1.name'], 'Neokitsch');
  assert.equal(update['system.styles.0.name'], 'Chrome Noir');
});

test('a submit touching no style field returns null (nothing to write)', () => {
  assert.equal(buildStylesSubmitData(STYLES, { name: 'Renamed item', 'system.cost': 'PR' }), null);
  assert.equal(buildStylesSubmitData(STYLES, {}), null);
});

test('an item type with no styles schema is left alone', () => {
  assert.equal(buildStylesSubmitData(undefined, { 'system.styles.0.name': 'X' }), null);
});

test('an empty styles array yields no keys even when the form claims an index', () => {
  // Stale form data must not resurrect a deleted style.
  assert.deepEqual(buildStylesSubmitData([], { 'system.styles.0.name': 'Ghost' }), {});
});

test('form values win over stored values on the fields actually submitted', () => {
  const update = buildStylesSubmitData(STYLES, {
    'system.styles.0.name': 'Chrome Noir II',
    'system.styles.0.bonus': 3,
    'system.styles.0.cost': 'SLX',
  });
  assert.equal(update['system.styles.0.name'], 'Chrome Noir II');
  assert.equal(update['system.styles.0.bonus'], 3);
  assert.equal(update['system.styles.0.cost'], 'SLX');
  assert.equal(update['system.styles.0.manufacturer'], 'MaxiWear'); // untouched, preserved
});

test('the source array is never mutated', () => {
  const before = JSON.stringify(STYLES);
  buildStylesSubmitData(STYLES, { 'system.styles.0.name': 'Mutated?' });
  assert.equal(JSON.stringify(STYLES), before);
});
