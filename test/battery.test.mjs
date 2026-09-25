/**
 * Unit tests for the battery pool (helpers/battery.mjs).
 * Run with:  node --test test/*.test.mjs
 *
 * Gear/Cyberware carry `system.battery`; installed Mods (embedded or actor
 * mod Items with installedOnId) add their `batteryCapacity` to the pool. A
 * weapon using its battery as Ammo keeps that battery in the magazine, out of
 * the general pool.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  getBatteryPool, hasChargedBattery, isChargedBattery, isSpentBattery,
  spentBatteryName, usesBatteryAsAmmo,
} = await import('../module/helpers/battery.mjs');

const gear = (system, id = 'g1') => ({ id, type: 'gear', system });
const actorWith = (items) => ({ items });
const battery = (system = {}) => ({ type: 'ammo', system: { ammoTypes: { battery: true }, ...system } });

test('an item without a battery field has no pool', () => {
  assert.deepEqual(getBatteryPool(gear({})), { capacity: 0, installed: 0, life: '', asAmmo: false });
  assert.equal(hasChargedBattery(gear({})), true, 'no pool never gates behavior');
});

test('own capacity, installed and life', () => {
  const pool = getBatteryPool(gear({ battery: { capacity: 2, installed: 1, life: '8 hours' } }));
  assert.deepEqual(pool, { capacity: 2, installed: 1, life: '8 hours', asAmmo: false });
});

test('embedded and actor-installed mods add capacity to the pool', () => {
  const item = gear({
    battery: { capacity: 1, installed: 2, life: '' },
    embeddedMods: [{ name: 'Cam', batteryCapacity: 1, batteryLife: '1 hour' }, { name: 'Grip', batteryCapacity: 0 }],
  });
  const actor = actorWith([
    item,
    { type: 'mod', name: 'Coil', system: { installedOnId: 'g1', batteryCapacity: 1, batteryLife: '8 hours' } },
    { type: 'mod', name: 'Elsewhere', system: { installedOnId: 'g2', batteryCapacity: 5 } },
  ]);
  const pool = getBatteryPool(item, actor);
  assert.equal(pool.capacity, 3);
  assert.equal(pool.installed, 2);
  assert.equal(pool.life, 'Cam: 1 hour; Coil: 8 hours');
});

test('installed is clamped to capacity (e.g. after a mod is removed)', () => {
  assert.equal(getBatteryPool(gear({ battery: { capacity: 1, installed: 3 } })).installed, 1);
});

test('a battery-as-Ammo weapon keeps its own battery out of the pool', () => {
  const item = gear({ isWeapon: true, battery: { capacity: 1, asAmmo: true }, embeddedMods: [{ name: 'Cam', batteryCapacity: 1 }] });
  const pool = getBatteryPool(item);
  assert.equal(pool.asAmmo, true);
  assert.equal(pool.capacity, 1, 'only the mod contributes');
});

test('asAmmo only counts on weapons; stun guns always use batteries', () => {
  assert.equal(usesBatteryAsAmmo(gear({ isWeapon: false, battery: { asAmmo: true } })), false);
  assert.equal(usesBatteryAsAmmo(gear({ isWeapon: true, battery: { asAmmo: true } })), true);
  assert.equal(usesBatteryAsAmmo(gear({ isWeapon: true, weapons: [{ type: 'stunGun' }] })), true);
  assert.equal(usesBatteryAsAmmo(gear({ isWeapon: true, weapons: [{ type: 'heavyPistol' }] })), false);
});

test('battery-gated behavior stops at 0 installed', () => {
  assert.equal(hasChargedBattery(gear({ battery: { capacity: 1, installed: 0 } })), false);
  assert.equal(hasChargedBattery(gear({ battery: { capacity: 1, installed: 1 } })), true);
});

test('charged vs spent batteries', () => {
  assert.equal(isChargedBattery(battery()), true);
  assert.equal(isSpentBattery(battery()), false);
  assert.equal(isChargedBattery(battery({ spent: true })), false);
  assert.equal(isSpentBattery(battery({ spent: true })), true);
  assert.equal(isChargedBattery({ type: 'ammo', system: { ammoTypes: { assault: true } } }), false);
});

test('spent naming', () => {
  assert.equal(spentBatteryName('Battery'), 'Spent Battery');
  assert.equal(spentBatteryName(''), 'Spent Battery');
});
