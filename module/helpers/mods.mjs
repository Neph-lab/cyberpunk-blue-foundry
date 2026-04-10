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

export function createItemModificationData(type = 'gearMod') {
  return {
    id: foundry.utils.randomID(),
    type,
    name: 'New Mod',
    cost: '',
    description: '',
    targetWeaponIndex: -1,
    weaponChanges: [],
  };
}

export function createWeaponChangeData() {
  return {
    id: foundry.utils.randomID(),
    key: 'damage',
    mode: 'override',
    value: '',
  };
}

function getWeaponAtIndex(system = {}, index) {
  return Array.isArray(system.weapons) ? system.weapons[index] ?? null : null;
}

export function getModificationValidation(itemLike, mod) {
  const itemType = itemLike?.type ?? null;
  const system = itemLike?.system ?? {};

  switch (mod.type) {
    case 'gearMod':
      return itemType === 'gear'
        ? { valid: true, reason: '' }
        : { valid: false, reason: 'Only valid on gear.' };
    case 'cyberwareMod':
      return itemType === 'cyberware'
        ? { valid: true, reason: '' }
        : { valid: false, reason: 'Only valid on cyberware.' };
    case 'hardwareMod':
      return system.isComputer
        ? { valid: true, reason: '' }
        : { valid: false, reason: 'Requires the item to be flagged as a Computer.' };
    case 'weaponMod': {
      if (!system.isWeapon || !Array.isArray(system.weapons) || !system.weapons.length) {
        return { valid: false, reason: 'Requires at least one weapon on the item.' };
      }

      const targetWeapon = getWeaponAtIndex(system, Number(mod.targetWeaponIndex));
      if (!targetWeapon) {
        return { valid: false, reason: 'Requires a specific weapon selection.' };
      }

      return { valid: true, reason: '' };
    }
    default:
      return { valid: false, reason: 'Unknown modification type.' };
  }
}

export function getModificationEffects(item, modId) {
  return item.effects.contents.filter((effect) => effect.getFlag('cyberpunk-blue', 'modId') === modId);
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

export function getEffectiveItemWeapons(itemLike) {
  const weapons = foundry.utils.deepClone(itemLike?.system?.weapons ?? []);
  const mods = itemLike?.system?.mods ?? [];

  for (const mod of mods) {
    const validation = getModificationValidation(itemLike, mod);
    if (!validation.valid || mod.type !== 'weaponMod') {
      continue;
    }

    const targetIndex = Number(mod.targetWeaponIndex);
    const weapon = weapons[targetIndex];
    if (!weapon) {
      continue;
    }

    for (const change of mod.weaponChanges ?? []) {
      applyWeaponChange(weapon, change);
    }
  }

  return weapons;
}

export async function syncItemModificationEffects(item, options = {}) {
  if (!['gear', 'cyberware'].includes(item.type)) {
    return;
  }

  const mods = item.system.mods ?? [];
  const validationMap = new Map(mods.map((mod) => [mod.id, getModificationValidation(item, mod)]));
  const updates = [];

  for (const effect of item.effects.contents) {
    const modId = effect.getFlag('cyberpunk-blue', 'modId');
    if (!modId) {
      continue;
    }

    const validation = validationMap.get(modId);
    const autoState = effect.getFlag('cyberpunk-blue', 'autoModEffectState') ?? null;
    if (!validation?.valid) {
      if (!effect.disabled || autoState?.active !== true) {
        updates.push({
          _id: effect.id,
          disabled: true,
          'flags.cyberpunk-blue.autoModEffectState': {
            active: true,
            previousDisabled: effect.disabled === true,
          },
        });
      }
      continue;
    }

    if (autoState?.active === true) {
      updates.push({
        _id: effect.id,
        disabled: autoState.previousDisabled === true,
        'flags.cyberpunk-blue.autoModEffectState': null,
      });
    }
  }

  if (!updates.length) {
    return;
  }

  await item.updateEmbeddedDocuments('ActiveEffect', updates, {
    ...options,
    cyberBlueSyncModEffects: true,
  });
}
