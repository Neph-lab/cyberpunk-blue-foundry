const RANGE_BREAKPOINTS = [0, 6, 12, 25, 50, 100, 200, 400, 800];

const RAW_WEAPON_TYPES = [
  {
    value: 'lightMelee',
    label: 'Light Melee Weapon',
    category: 'melee',
    skillOptions: ['meleeWeapons', 'martialArts'],
    defaultSkill: 'meleeWeapons',
    damage: '1d6',
    rateOfFire: 2,
    magazine: 0,
    shots: 0,
    hands: 1,
    concealable: true,
  },
  {
    value: 'mediumMelee',
    label: 'Medium Melee Weapon',
    category: 'melee',
    skillOptions: ['meleeWeapons', 'martialArts'],
    defaultSkill: 'meleeWeapons',
    damage: '2d6',
    rateOfFire: 2,
    magazine: 0,
    shots: 0,
    hands: 1,
    concealable: false,
  },
  {
    value: 'heavyMelee',
    label: 'Heavy Melee Weapon',
    category: 'melee',
    skillOptions: ['meleeWeapons', 'martialArts'],
    defaultSkill: 'meleeWeapons',
    damage: '3d6',
    rateOfFire: 2,
    magazine: 0,
    shots: 0,
    hands: 1,
    concealable: false,
  },
  {
    value: 'veryHeavyMelee',
    label: 'Very Heavy Melee Weapon',
    category: 'melee',
    skillOptions: ['meleeWeapons', 'martialArts'],
    defaultSkill: 'meleeWeapons',
    damage: '4d6',
    rateOfFire: 1,
    magazine: 0,
    shots: 0,
    hands: 2,
    concealable: false,
  },
  {
    value: 'mediumPistol',
    label: 'Medium Pistol',
    category: 'ranged',
    skillOptions: ['handgun'],
    defaultSkill: 'handgun',
    damage: '2d6',
    rateOfFire: 2,
    magazine: 12,
    shots: 1,
    hands: 1,
    concealable: true,
    rangeTable: [13, 15, 20, 25, 30, 30, 0, 0],
  },
  {
    value: 'heavyPistol',
    label: 'Heavy Pistol',
    category: 'ranged',
    skillOptions: ['handgun'],
    defaultSkill: 'handgun',
    damage: '3d6',
    rateOfFire: 2,
    magazine: 8,
    shots: 1,
    hands: 1,
    concealable: true,
    rangeTable: [13, 15, 20, 25, 30, 30, 0, 0],
  },
  {
    value: 'veryHeavyPistol',
    label: 'Very Heavy Pistol',
    category: 'ranged',
    skillOptions: ['handgun'],
    defaultSkill: 'handgun',
    damage: '4d6',
    rateOfFire: 1,
    magazine: 8,
    shots: 1,
    hands: 1,
    concealable: false,
    rangeTable: [13, 15, 20, 25, 30, 30, 0, 0],
  },
  {
    value: 'smg',
    label: 'SMG',
    category: 'ranged',
    skillOptions: ['handgun'],
    defaultSkill: 'handgun',
    damage: '2d6',
    rateOfFire: 2,
    magazine: 30,
    shots: 3,
    hands: 1,
    concealable: false,
    rangeTable: [15, 13, 15, 20, 25, 25, 30, 0],
    defaultAutofireRangeTable: [22, 19, 22, 27, 32, 0, 0, 0],
  },
  {
    value: 'heavySmg',
    label: 'Heavy SMG',
    category: 'ranged',
    skillOptions: ['handgun'],
    defaultSkill: 'handgun',
    damage: '3d6',
    rateOfFire: 1,
    magazine: 40,
    shots: 4,
    hands: 1,
    concealable: false,
    rangeTable: [15, 13, 15, 20, 25, 25, 30, 0],
    defaultAutofireRangeTable: [22, 19, 22, 27, 32, 0, 0, 0],
  },
  {
    value: 'shotgun',
    label: 'Shotgun',
    category: 'ranged',
    skillOptions: ['shoulderArms'],
    defaultSkill: 'shoulderArms',
    damage: '5d6',
    rateOfFire: 1,
    magazine: 4,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [13, 15, 20, 25, 30, 35, 0, 0],
  },
  {
    value: 'assaultRifle',
    label: 'Assault Rifle',
    category: 'ranged',
    skillOptions: ['shoulderArms'],
    defaultSkill: 'shoulderArms',
    damage: '5d6',
    rateOfFire: 1,
    magazine: 25,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [17, 16, 15, 13, 15, 20, 25, 30],
    defaultAutofireRangeTable: [24, 22, 19, 22, 27, 0, 0, 0],
  },
  {
    value: 'precisionRifle',
    label: 'Precision Rifle',
    category: 'ranged',
    skillOptions: ['shoulderArms'],
    defaultSkill: 'shoulderArms',
    damage: '5d6',
    rateOfFire: 1,
    magazine: 5,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [30, 25, 17, 15, 17, 18, 25],
  },
  {
    value: 'sniperRifle',
    label: 'Sniper Rifle',
    category: 'ranged',
    skillOptions: ['shoulderArms'],
    defaultSkill: 'shoulderArms',
    damage: '5d6',
    rateOfFire: 1,
    magazine: 4,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [30, 25, 25, 20, 15, 16, 17, 20],
  },
  {
    value: 'machineGun',
    label: 'Machine Gun',
    category: 'ranged',
    skillOptions: ['hvyWeapons'],
    defaultSkill: 'hvyWeapons',
    damage: '5d6',
    rateOfFire: 1,
    magazine: 50,
    shots: 10,
    hands: 2,
    concealable: false,
    rangeTable: [25, 20, 17, 15, 17, 20, 20, 25],
    defaultAutofireRangeTable: [22, 19, 22, 30, 35, 0, 0, 0],
  },
  {
    value: 'flamethrower',
    label: 'Flamethrower',
    category: 'ranged',
    skillOptions: ['hvyWeapons'],
    defaultSkill: 'hvyWeapons',
    damage: '5d6',
    rateOfFire: 1,
    magazine: 10,
    shots: 1,
    hands: 2,
    concealable: false,
  },
  {
    value: 'grenadeLauncher',
    label: 'Grenade Launcher',
    category: 'ranged',
    skillOptions: ['hvyWeapons'],
    defaultSkill: 'hvyWeapons',
    damage: '6d6',
    rateOfFire: 1,
    magazine: 2,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [16, 15, 15, 17, 20, 22, 25, 0],
  },
  {
    value: 'rocketLauncher',
    label: 'Rocket Launcher',
    category: 'ranged',
    skillOptions: ['hvyWeapons'],
    defaultSkill: 'hvyWeapons',
    damage: '6d6',
    rateOfFire: 1,
    magazine: 1,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [17, 16, 15, 15, 20, 20, 25, 30],
  },
  {
    value: 'bowCrossbow',
    label: 'Bow/Crossbow',
    category: 'ranged',
    skillOptions: ['archery'],
    defaultSkill: 'archery',
    damage: '2d6',
    rateOfFire: 1,
    magazine: 1,
    shots: 1,
    hands: 2,
    concealable: false,
    rangeTable: [15, 13, 15, 17, 20, 22],
  },
  {
    value: 'thrown',
    label: 'Thrown Weapon',
    category: 'thrown',
    skillOptions: ['athletics'],
    defaultSkill: 'athletics',
    damage: '1d6',
    rateOfFire: 1,
    magazine: 1,
    shots: 1,
    hands: 1,
    concealable: true,
    rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
  },
];

const CATEGORY_LABELS = {
  melee: 'Melee',
  ranged: 'Ranged',
  thrown: 'Thrown',
};

function normalizeRangeTable(rangeTable = []) {
  return Array.from({ length: RANGE_BREAKPOINTS.length - 1 }, (_entry, index) => Number(rangeTable[index] ?? 0) || 0);
}

function enrichWeaponType(definition) {
  const rangeTable = normalizeRangeTable(definition.rangeTable ?? []);
  const usesMagazine = definition.category !== 'melee' && definition.value !== 'thrown';
  const usesShots = usesMagazine;
  const usesRangeTable = definition.category === 'thrown'
    || (definition.category === 'ranged' && definition.value !== 'flamethrower');

  return {
    ...definition,
    rangeTable,
    usesMagazine,
    usesShots,
    usesRangeTable,
    showRateOfFire: definition.value !== 'thrown',
    showMagazine: usesMagazine,
    showAmmoCurrent: usesMagazine,
    showShots: usesShots,
  };
}

const WEAPON_TYPE_MAP = Object.fromEntries(RAW_WEAPON_TYPES.map((definition) => {
  const enriched = enrichWeaponType(definition);
  return [enriched.value, enriched];
}));

const WEAPON_TYPE_GROUPS = Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
  category,
  label,
  options: Object.values(WEAPON_TYPE_MAP).filter((entry) => entry.category === category),
}));

const RANGE_BANDS = RANGE_BREAKPOINTS.slice(0, -1).map((start, index) => ({
  index,
  start,
  end: RANGE_BREAKPOINTS[index + 1],
  label: `${start}-${RANGE_BREAKPOINTS[index + 1]}`,
}));

export const COMBAT_CONFIG = {
  rangeBands: RANGE_BANDS,
  rangeBreakpoints: RANGE_BREAKPOINTS,
  weaponTypes: Object.values(WEAPON_TYPE_MAP),
  weaponTypeGroups: WEAPON_TYPE_GROUPS,
  weaponTypeMap: WEAPON_TYPE_MAP,
};

export function getWeaponTypeDefinition(type) {
  return COMBAT_CONFIG.weaponTypeMap[type] ?? COMBAT_CONFIG.weaponTypeMap.lightMelee;
}

export function createWeaponData(type = 'lightMelee') {
  const definition = getWeaponTypeDefinition(type);

  return {
    type: definition.value,
    skill: definition.defaultSkill,
    damage: definition.damage,
    rateOfFire: definition.rateOfFire,
    magazine: definition.magazine,
    ammoCurrent: definition.magazine,
    shots: definition.shots,
    hands: definition.hands,
    concealable: definition.concealable,
    rangeTable: definition.rangeTable.slice(),
  };
}

/**
 * Build a weapon update payload that emits ALL fields of the weapon as flat dot-paths.
 *
 * Why this is necessary: Foundry's ArrayField cleanData (foundry.mjs:10907) forces
 * `partial: false` when cleaning each array element. Under partial:false, any field
 * MISSING from the incoming element is reset to its schema `initial` value
 * (e.g. type → 'lightMelee', rangeTable → [0,...,0]). So updating a single weapon
 * field with `{ 'system.weapons.0.X': value }` causes every other field on that
 * weapon to revert to its schema default. The only safe pattern is to always emit
 * every field of the existing weapon, with the change overlaid.
 *
 * @param {Item|object} itemOrSource  An Item document or a raw _source object containing system.weapons
 * @param {number} weaponIndex        Index in system.weapons
 * @param {object} changes            Partial weapon fields to overlay on the existing weapon
 * @param {object} [extra]            Additional flat-path keys to merge (non-weapon)
 * @returns {object}                  Update payload suitable for document.update()
 */
export function buildWeaponUpdate(itemOrSource, weaponIndex, changes = {}, extra = {}) {
  const source = itemOrSource?._source ?? itemOrSource;
  const rawWeapons = source?.system?.weapons ?? [];
  const existing = rawWeapons[weaponIndex] ?? {};
  const merged = { ...existing, ...changes };
  const updates = { ...extra };
  for (const [field, value] of Object.entries(merged)) {
    updates[`system.weapons.${weaponIndex}.${field}`] = value;
  }
  return updates;
}

export function applyWeaponTypeDefaults(existingWeapon = {}, type = 'lightMelee') {
  const defaults = createWeaponData(type);
  // Only preserve the existing range table when: (a) a damage type is already configured AND
  // (b) the range table has at least one non-zero value (i.e. the user has set it up).
  // If the range table is all zeros (e.g. came from a melee weapon or was never configured)
  // we always apply the new type's default range table, even when a damage type is set.
  const existingRangeTable = existingWeapon.rangeTable ?? [];
  const hasCustomRangeTable = existingRangeTable.some((v) => Number(v) > 0);
  if (existingWeapon.damageType && existingWeapon.damageType !== '' && hasCustomRangeTable) {
    delete defaults.rangeTable;
  }
  return { ...existingWeapon, ...defaults };
}
