import { COMBAT_CONFIG } from './combat.mjs';

export const MOD_TYPES = [
  { value: 'gearMod', label: 'Gear Mod' },
  { value: 'cyberwareMod', label: 'Cyberware Mod' },
  { value: 'weaponMod', label: 'Weapon Mod' },
  { value: 'hardwareMod', label: 'Hardware Mod' },
];

export const WEAPON_MOD_MODES = [
  { value: 'add', label: 'Add / Subtract' },
  { value: 'override', label: 'Set' },
  { value: 'downgrade', label: 'Lower Of' },
  { value: 'upgrade', label: 'Higher Of' },
];

const BASE_WEAPON_MOD_FIELDS = [
  { value: 'skill', label: 'Attack Skill', kind: 'string' },
  { value: 'damage', label: 'Damage', kind: 'string' },
  { value: 'rateOfFire', label: 'RoF', kind: 'number' },
  { value: 'magazine', label: 'Magazine', kind: 'number' },
  { value: 'ammoCurrent', label: 'Current Ammo', kind: 'number' },
  { value: 'shots', label: 'Shots', kind: 'number' },
  { value: 'hands', label: 'Hands', kind: 'number' },
  { value: 'concealable', label: 'Concealable', kind: 'boolean' },
];

export const WEAPON_MOD_FIELDS = [
  ...BASE_WEAPON_MOD_FIELDS,
  ...COMBAT_CONFIG.rangeBands.map((band) => ({
    value: `rangeTable.${band.index}`,
    label: `Range DV ${band.label}m`,
    kind: 'number',
  })),
];

export function createWeaponChangeData() {
  return {
    id: foundry.utils.randomID(),
    key: 'damage',
    mode: 'override',
    value: '',
  };
}

function getWeaponModFieldDefinition(key) {
  return WEAPON_MOD_FIELDS.find((field) => field.value === key) ?? null;
}

function parseBooleanValue(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const text = `${value}`.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(text)) {
    return false;
  }
  return null;
}

function getNestedWeaponValue(weapon, key) {
  return foundry.utils.getProperty(weapon, key);
}

function setNestedWeaponValue(weapon, key, value) {
  foundry.utils.setProperty(weapon, key, value);
}

function applyWeaponChange(weapon, change) {
  const field = getWeaponModFieldDefinition(change.key);
  if (!field) {
    return;
  }

  const currentValue = getNestedWeaponValue(weapon, change.key);
  if (field.kind === 'string') {
    if (change.mode === 'override') {
      setNestedWeaponValue(weapon, change.key, `${change.value ?? ''}`);
    }
    return;
  }

  if (field.kind === 'boolean') {
    if (change.mode === 'override') {
      const booleanValue = parseBooleanValue(change.value);
      if (booleanValue !== null) {
        setNestedWeaponValue(weapon, change.key, booleanValue);
      }
    }
    return;
  }

  const numericValue = Number(change.value);
  if (!Number.isFinite(numericValue)) {
    return;
  }

  const currentNumber = Number(currentValue) || 0;
  switch (change.mode) {
    case 'add':
      setNestedWeaponValue(weapon, change.key, currentNumber + numericValue);
      break;
    case 'override':
      setNestedWeaponValue(weapon, change.key, numericValue);
      break;
    case 'downgrade':
      setNestedWeaponValue(weapon, change.key, Math.min(currentNumber, numericValue));
      break;
    case 'upgrade':
      setNestedWeaponValue(weapon, change.key, Math.max(currentNumber, numericValue));
      break;
  }
}

/**
 * Returns the array of installed mod system-data objects for a specific weapon
 * slot on a given actor-owned item.  The actor argument is optional; if absent
 * (e.g. compendium items), an empty array is returned.
 *
 * @param {Item}   item         - The gear/cyberware item the mods are installed on.
 * @param {number} weaponIndex  - Index of the weapon within item.system.weapons.
 * @param {Actor}  [actor]      - The owning actor (item.parent in practice).
 * @returns {object[]}          - Array of mod system objects.
 */
/**
 * Returns plain-object representations of all installed weapon-mod system data
 * for a specific weapon slot.  Each object includes a `_docId` field with the
 * mod Item's Foundry id so callers can delete the mod if needed (e.g. silencer
 * destroyed by Tech discharge or RoF2+).
 */
export function getInstalledWeaponMods(item, weaponIndex, actor) {
  if (!actor || !item?.id) return [];
  return actor.items
    .filter(
      (modDoc) =>
        modDoc.type === 'mod' &&
        modDoc.system.modType === 'weaponMod' &&
        modDoc.system.installedOnId === item.id &&
        Number(modDoc.system.targetWeaponIndex) === weaponIndex,
    )
    .map((modDoc) => Object.assign(
      modDoc.system.toObject?.() ?? { ...modDoc.system },
      // `_active` reflects the activation toggle (see toggleModActivation); the
      // `active*` effect fields only apply when this is true.
      { _docId: modDoc.id, _active: !!modDoc.getFlag?.('cyberpunk-blue', 'modActive') },
    ));
}

export function getEffectiveItemWeapons(itemLike, actor = null) {
  const weapons = foundry.utils.deepClone(itemLike?.system?.weapons ?? []);

  // Apply embedded mods (stored directly on the item — works even without an actor)
  for (const mod of itemLike?.system?.embeddedMods ?? []) {
    if (mod.modType !== 'weaponMod') continue;
    const targetIndex = Number(mod.targetWeaponIndex);
    const weapon = weapons[targetIndex];
    if (!weapon) continue;
    for (const change of mod.weaponChanges ?? []) {
      applyWeaponChange(weapon, change);
    }
  }

  // Apply weaponChanges from actor-installed mod Items (e.g. Hakatome skill/hands override)
  if (actor && itemLike?.id) {
    for (const modDoc of actor.items ?? []) {
      if (modDoc.type !== 'mod' || modDoc.system.modType !== 'weaponMod') continue;
      if (modDoc.system.installedOnId !== itemLike.id) continue;
      const targetIndex = Number(modDoc.system.targetWeaponIndex);
      const weapon = weapons[targetIndex];
      if (!weapon) continue;
      for (const change of modDoc.system.weaponChanges ?? []) {
        applyWeaponChange(weapon, change);
      }
    }
  }

  // ── Large Fuel Tank: double the magazine of each weapon entry ─────────────
  const modSystems = [
    ...(itemLike?.system?.embeddedMods ?? []),
    ...((actor && itemLike?.id)
      ? (actor.items ?? []).filter(
        (d) => d.type === 'mod' && d.system.modType === 'weaponMod'
          && d.system.installedOnId === itemLike.id).map((d) => d.system)
      : []),
  ];
  if (modSystems.some((m) => m.doubleMagazine)) {
    for (const w of weapons) {
      if ((w.magazine ?? 0) > 0) w.magazine *= 2;
    }
  }

  // ── Rostović Skachok injection ───────────────────────────────────────────
  // Adds a stun-baton melee mode to the host weapon. Pistols and SMGs become a
  // Medium Melee Weapon (2d6, RoF 2, 1 hand); anything else a Heavy Melee Weapon
  // (3d6, RoF 1, 2 hands). Both ignore ½ SP and are non-lethal. Usable only while
  // the host weapon is charged (a Tech Weapon requirement of the mod).
  if (modSystems.some((m) => m.skachok)) {
    const baseType = weapons[0]?.type ?? '';
    const isLight = ['mediumPistol', 'heavyPistol', 'veryHeavyPistol', 'smg', 'heavySmg'].includes(baseType);
    weapons.push({
      type: isLight ? 'mediumMelee' : 'heavyMelee', skill: 'meleeWeapons',
      damage: isLight ? '2d6' : '3d6',
      autofireDamage: '', rateOfFire: isLight ? 2 : 1, magazine: 0, ammoCurrent: 0, shots: 0,
      hands: isLight ? 1 : 2, concealable: false, damageType: '', autofireMultiplier: 1,
      autofireRangeTable: Array(8).fill(0), coneSpread: 0, coneAngle: 45,
      coneHalfDamageDistance: 0, rangeTable: [15, 20, 0, 0, 0, 0, 0, 0], ammoTypeUuid: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false,
      isExcellentQuality: false, chargeType: '', cs3: false, cs3FallbackDamage: '',
      chargeKeepsRof: false, silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, targetedShotDamageDice: '', armorPiercing: false,
      scatter: false, shatteredProjectiles: false, shortAmmoFallbackDamage: '',
      critOnBodyReq: 0, critSlicing: false, critBlunt: false, critCrushing: false,
      critStun: false, vicious: false, heavyRecoil: false, shockwave: false,
      burningEdge: false, chargedAttackBonus: 0,
      halveSP: true, nonLethal: true,
      autoFireOn10: false, doubleLock: false, electricCharge: false,
      electricChargeMax: 0, chompAmmo: false,
      afflictionPrimary: 'body', afflictionSkill: '', afflictionDv: 13,
      afflictionEffectId: '',
      _isSkachok: true,
    });
  }

  // ── Bayonet injection ────────────────────────────────────────────────────
  // If any installed mod has bayonet:true, append a synthetic lightMelee entry
  // (1d6, RoF 2, halveSP) so the actor sheet shows a bayonet attack row.
  const hasBayonet =
    (itemLike?.system?.embeddedMods ?? []).some(m => m.bayonet) ||
    (actor && itemLike?.id && (actor.items ?? []).some(
      d => d.type === 'mod' && d.system.modType === 'weaponMod' &&
           d.system.installedOnId === itemLike.id && d.system.bayonet
    ));
  if (hasBayonet) {
    weapons.push({
      type: 'lightMelee', skill: 'meleeWeapons', damage: '1d6',
      autofireDamage: '', rateOfFire: 2, magazine: 0, ammoCurrent: 0, shots: 0,
      hands: 1, concealable: false, damageType: '', autofireMultiplier: 1,
      autofireRangeTable: Array(8).fill(0), coneSpread: 0, coneAngle: 45,
      coneHalfDamageDistance: 0, rangeTable: Array(8).fill(0), ammoTypeUuid: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false,
      isExcellentQuality: false, chargeType: '', cs3: false, cs3FallbackDamage: '',
      chargeKeepsRof: false, silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, targetedShotDamageDice: '', armorPiercing: false,
      scatter: false, shatteredProjectiles: false, shortAmmoFallbackDamage: '',
      critOnBodyReq: 0, critSlicing: false, critBlunt: false, critCrushing: false,
      critStun: false, vicious: false, heavyRecoil: false, shockwave: false,
      burningEdge: false, chargedAttackBonus: 0,
      halveSP: true,
      autoFireOn10: false, doubleLock: false, electricCharge: false,
      electricChargeMax: 0, chompAmmo: false,
      afflictionPrimary: 'body', afflictionSkill: '', afflictionDv: 13,
      afflictionEffectId: '',
      _isBayonet: true,
    });
  }

  return weapons;
}

