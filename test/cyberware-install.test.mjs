/**
 * Unit tests for the "attempt install on creation" rule.
 * Run with:  node --test test/*.test.mjs
 *
 * The rule (author, 2026-08-21): cyberware attempts to install when created.
 * Whatever the platform/slot system won't accept lands `installed: false`, and
 * uninstalled chrome reduces NEITHER max PSYCHE (its AE is disabled) nor
 * current PSYCHE (the prompt bails). Installing it later charges both.
 *
 * CyberBlueItem#_preCreate makes that decision with exactly one expression —
 * `installed = isExtensionFullyConnected(system)` — so these tests pin that
 * predicate and the slot accounting that feeds it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// getCyberwareEntries() reaches for foundry.utils.deepClone. Nothing else in
// the code under test touches the global, so a structural clone is enough.
globalThis.foundry ??= { utils: { deepClone: (v) => structuredClone(v) } };

const { isExtensionFullyConnected, getEligiblePlatforms, getPlatformUsage } =
  await import('../module/helpers/cyberware.mjs');

/** What _preCreate computes for a freshly created cyberware item. */
const installsOnCreate = (system) => isExtensionFullyConnected(system);

/** Minimal stand-in for an Actor: getCyberwareEntries only reads items.contents. */
const actorWith = (items) => ({ items: { contents: items } });
const cw = (id, name, system) => ({ id, name, type: 'cyberware', system });

// ── What installs on creation ───────────────────────────────────────────────

test('standalone cyberware installs on creation', () => {
  assert.equal(installsOnCreate({ integration: 'standalone' }), true);
});

test('a platform installs on creation', () => {
  assert.equal(installsOnCreate({ integration: 'platform', slotsProvided: 3 }), true);
});

test('an extension that found a platform installs', () => {
  assert.equal(installsOnCreate({ integration: 'extension', parentCyberwareId: 'p1' }), true);
});

test('an extension with no platform does NOT install', () => {
  assert.equal(installsOnCreate({ integration: 'extension', parentCyberwareId: null }), false);
});

test('a paired extension needs BOTH platforms to install', () => {
  const half = { integration: 'extension', paired: true, parentCyberwareId: 'p1', parentCyberwareId2: null };
  const full = { ...half, parentCyberwareId2: 'p2' };
  assert.equal(installsOnCreate(half), false, 'one eye is not enough');
  assert.equal(installsOnCreate(full), true);
});

// ── Slot accounting: why an extension fails to find a platform ──────────────

test('a platform with room is eligible; the same platform full is not', () => {
  const suite = cw('suite', 'Cyberaudio Suite', {
    integration: 'platform', cyberwareType: 'cyberaudio', slotsProvided: 3,
  });
  const incoming = { integration: 'extension', cyberwareType: 'cyberaudio', slotsUsed: 1 };

  assert.equal(getEligiblePlatforms(actorWith([suite]), null, incoming).length, 1);

  // Three 1-slot extensions already in it → no room for a fourth.
  const occupied = [1, 2, 3].map((n) => cw(`e${n}`, `Ext ${n}`, {
    integration: 'extension', cyberwareType: 'cyberaudio', slotsUsed: 1, parentCyberwareId: 'suite',
  }));
  const eligible = getEligiblePlatforms(actorWith([suite, ...occupied]), null, incoming);
  assert.equal(eligible.length, 0, 'a full platform must not be offered');

  // ...and that is what makes the new item land uninstalled.
  assert.equal(installsOnCreate({ ...incoming, parentCyberwareId: eligible[0]?.id ?? null }), false);
});

test('platform type must match — a cyberaudio slot is no use to a cyberoptic', () => {
  const suite = cw('suite', 'Cyberaudio Suite', {
    integration: 'platform', cyberwareType: 'cyberaudio', slotsProvided: 3,
  });
  const optic = { integration: 'extension', cyberwareType: 'cyberoptic', slotsUsed: 1 };
  assert.equal(getEligiblePlatforms(actorWith([suite]), null, optic).length, 0);
});

test('an extension too large for the remaining slots is not offered', () => {
  const suite = cw('suite', 'Suite', {
    integration: 'platform', cyberwareType: 'cyberaudio', slotsProvided: 3,
  });
  const taken = cw('e1', 'Ext', {
    integration: 'extension', cyberwareType: 'cyberaudio', slotsUsed: 2, parentCyberwareId: 'suite',
  });
  const big = { integration: 'extension', cyberwareType: 'cyberaudio', slotsUsed: 2 };
  assert.equal(getEligiblePlatforms(actorWith([suite, taken]), null, big).length, 0,
    '1 free slot cannot take a 2-slot extension');
});

test('a paired extension consumes a slot on BOTH its platforms', () => {
  const entries = [
    { id: 'eyeL', system: { integration: 'platform', cyberwareType: 'cyberoptic', slotsProvided: 3 } },
    { id: 'eyeR', system: { integration: 'platform', cyberwareType: 'cyberoptic', slotsProvided: 3 } },
    { id: 'tele', system: {
      integration: 'extension', cyberwareType: 'cyberoptic', slotsUsed: 1,
      paired: true, parentCyberwareId: 'eyeL', parentCyberwareId2: 'eyeR',
    } },
  ];
  const usage = getPlatformUsage(entries);
  assert.equal(usage.get('eyeL'), 1);
  assert.equal(usage.get('eyeR'), 1, 'the pair must charge the second eye too');
});

test("the item being re-assigned does not block its own platform", () => {
  // Its current platform stays eligible (isSelected), so re-installing an item
  // into the slot it already occupies is never refused.
  const suite = cw('suite', 'Suite', {
    integration: 'platform', cyberwareType: 'cyberaudio', slotsProvided: 1,
  });
  const mine = cw('mine', 'Mine', {
    integration: 'extension', cyberwareType: 'cyberaudio', slotsUsed: 1, parentCyberwareId: 'suite',
  });
  const eligible = getEligiblePlatforms(actorWith([suite, mine]), 'mine', mine.system);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'suite');
});
