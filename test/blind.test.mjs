/**
 * Unit tests for module/helpers/blind.mjs.
 * Run with:  node --test test/
 * (Pure module, no Foundry runtime needed — the chat-card helpers are not
 * exercised here since they need ChatMessage/game.i18n.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BLIND_ATTACK_SKILLS,
  BLIND_ATTACK_RANGE_M,
  isBlinded,
  isBlindAttackSkill,
  isBlindAutoMiss,
} from '../module/helpers/blind.mjs';

const actorWith = (...statuses) => ({ statuses: new Set(statuses) });
const blindActor = actorWith('blind');
const sightedActor = actorWith('prone');

test('isBlinded reads the blind status', () => {
  assert.equal(isBlinded(blindActor), true);
  assert.equal(isBlinded(actorWith('blind', 'deaf')), true);
  assert.equal(isBlinded(sightedActor), false);
  assert.equal(isBlinded({}), false);
  assert.equal(isBlinded(null), false);
});

test('isBlindAttackSkill covers exactly the three ranged-weapon skills', () => {
  assert.deepEqual([...BLIND_ATTACK_SKILLS], ['handgun', 'shoulderArms', 'hvyWeapons']);
  for (const slug of BLIND_ATTACK_SKILLS) assert.equal(isBlindAttackSkill(slug), true);
  for (const slug of ['archery', 'martialArts', 'meleeWeapons', 'autofire', '']) {
    assert.equal(isBlindAttackSkill(slug), false);
  }
});

test('isBlindAutoMiss only fires for a blind attacker beyond 5 m', () => {
  assert.equal(BLIND_ATTACK_RANGE_M, 5);

  // Blind + affected skill + past the limit.
  assert.equal(isBlindAutoMiss(blindActor, 'handgun', 5.1), true);
  assert.equal(isBlindAutoMiss(blindActor, 'shoulderArms', 40), true);
  assert.equal(isBlindAutoMiss(blindActor, 'hvyWeapons', 12), true);

  // At or inside 5 m the attack resolves normally.
  assert.equal(isBlindAutoMiss(blindActor, 'handgun', 5), false);
  assert.equal(isBlindAutoMiss(blindActor, 'handgun', 0), false);

  // Other skills are untouched, even for a blind attacker.
  assert.equal(isBlindAutoMiss(blindActor, 'archery', 40), false);
  assert.equal(isBlindAutoMiss(blindActor, 'martialArts', 40), false);

  // A sighted attacker never auto-misses.
  assert.equal(isBlindAutoMiss(sightedActor, 'handgun', 40), false);
});

test('isBlindAutoMiss leaves an unknown distance to the GM', () => {
  for (const dist of [null, undefined, NaN, Infinity]) {
    assert.equal(isBlindAutoMiss(blindActor, 'handgun', dist), false);
  }
});
