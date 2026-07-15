/**
 * Weapon catalogue — full Cyberpunk Blue weapon list, ready to drop into
 * the `cyberpunk-blue.weapons` compendium.
 *
 * Each entry returns Foundry Item create-data ready for `Item.createDocuments`.
 * The accompanying mod catalogue lives in `mod-catalogue.mjs`.
 *
 * Excluded by design (per memory/weapon-cards-excluded.md):
 *   - Arasaka Onibi Plasma Caster (non-standard)
 *   - SoftSys Microwaver-55 (EMP, not a weapon)
 *   - Arasaka Daikon NT Mantis Blades (cyberware, modelled separately)
 *   - Kendachi Permanent Edge (truncated source data)
 *   - Budget Arms Slaught-O-Matic (can't reload + melts)
 */

// ─── Cost abbreviation → full COST_LADDER string ─────────────────────────────

const COST_EXPAND = {
  CH:  '€$10 (Cheap)',
  EV:  '€$20 (Everyday)',
  C:   '€$50 (Costly)',
  CO:  '€$50 (Costly)',
  PR:  '€$100 (Premium)',
  EX:  '€$500 (Expensive)',
  VEX: '€$1,000 (Very Expensive)',
  LUX: '€$5,000 (Luxury)',
  SLX: '€$10,000 (Super Luxury)',
};

const ASSET_BASE = 'systems/cyberpunk-blue/assets/items/weapons';
const W_MELEE = `${ASSET_BASE}/Melee`;
const W_PISTOL = `${ASSET_BASE}/Pisols`; // sic — that's the on-disk folder name
const W_SMG = `${ASSET_BASE}/SMGs`;
const W_SHOTGUN = `${ASSET_BASE}/Shotgun`;
const W_AR = `${ASSET_BASE}/Assault Rifle`;
const W_SNIPER = `${ASSET_BASE}/Sniper`;
const W_ROOT = ASSET_BASE; // MG, PR, RL, Stun, Flamethrower

// ─── Range tables (from weapon-cards-data RANGE DEFAULTS) ────────────────────

const R = {
  pistol:    [13, 15, 20, 25, 30, 30,  0,  0],
  sgSlug:    [13, 15, 20, 25, 30, 35,  0,  0],
  smgSingle: [15, 13, 15, 20, 25, 25, 30,  0],
  smgAF:     [22, 19, 22, 27, 32,  0,  0,  0],
  arSingle:  [17, 16, 15, 13, 15, 20, 25, 30],
  arAF:      [24, 22, 19, 22, 27,  0,  0,  0],
  mgSingle:  [30, 25, 25, 20, 25, 25, 30, 35],
  mgAF:      [22, 19, 22, 30, 35,  0,  0,  0],
  helixAF:   [24, 22, 19, 22, 27, 30,  0,  0], // RMS Helix exception
  sr:        [30, 25, 25, 20, 15, 16, 17, 20],
  pr:        [17, 16, 15, 13, 14, 18, 26, 32],
  rl:        [20, 25, 22, 18, 15, 20, 25,  0],
  melee:     [15, 20,  0,  0,  0,  0,  0,  0],
  zero:      [ 0,  0,  0,  0,  0,  0,  0,  0],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const desc = (html) => /^\s*<(p|ul|ol|div|h\d|table)\b/i.test(html) ? html : `<p>${html}</p>`;

function img(folder, file) {
  return `${folder}/${file}`;
}

/**
 * Build a single weapon firing-mode entry (one element of `system.weapons`).
 * Spreads sensibly defaulted fields and overlays whatever the caller passes.
 */
function entry(opts = {}) {
  const skillByType = {
    lightMelee: 'meleeWeapons', mediumMelee: 'meleeWeapons',
    heavyMelee: 'meleeWeapons', veryHeavyMelee: 'meleeWeapons',
    mediumPistol: 'handgun', heavyPistol: 'handgun', veryHeavyPistol: 'handgun',
    smg: 'handgun', heavySmg: 'handgun',
    shotgun: 'shoulderArms', assaultRifle: 'shoulderArms',
    machineGun: 'heavyWeapons', precisionRifle: 'shoulderArms',
    sniperRifle: 'shoulderArms', grenadeLauncher: 'heavyWeapons',
    rocketLauncher: 'heavyWeapons', flamethrower: 'heavyWeapons',
    bowCrossbow: 'archery', stunGun: 'handgun', thrown: 'athletics',
  };
  return {
    type: opts.type ?? 'mediumPistol',
    skill: opts.skill ?? skillByType[opts.type] ?? 'meleeWeapons',
    damage: opts.damage ?? '1d6',
    rateOfFire: opts.rateOfFire ?? 1,
    magazine: opts.magazine ?? 0,
    ammoCurrent: opts.ammoCurrent ?? opts.magazine ?? 0,
    shots: opts.shots ?? (opts.magazine > 0 ? 1 : 0),
    hands: opts.hands ?? 1,
    concealable: !!opts.concealable,
    damageType: opts.damageType ?? '',
    autofireMultiplier: opts.autofireMultiplier ?? 1,
    autofireRangeTable: opts.autofireRangeTable ?? Array(8).fill(0),
    coneSpread: opts.coneSpread ?? 0,
    coneAngle: opts.coneAngle ?? 53, // matches 8/8m default cone
    coneHalfDamageDistance: opts.coneHalfDamageDistance ?? 0,
    rangeTable: opts.rangeTable ?? Array(8).fill(0),
    ammoTypeUuid: '',
    autofireDamage: opts.autofireDamage ?? '',
    isPowerWeapon: !!opts.power,
    isSmartWeapon: !!opts.smart,
    isTechWeapon: !!opts.tech,
    isExcellentQuality: !!opts.excellent,
    chargeType: opts.chargeType ?? '',
    silenceBuiltIn: !!opts.silenceBuiltIn,
    silenceBuiltInDV: opts.silenceBuiltInDV ?? 0,
    jamOnRoll: opts.jamOnRoll ?? 0,
    jamFiresFirst: !!opts.jamFiresFirst,
    shellDvModifier: opts.shellDvModifier ?? 0,
    targetVitalsPenalty: opts.targetVitalsPenalty ?? 8,
    payloadDmgBonus: opts.payloadDmgBonus ?? 0,
    critSlicing: !!opts.critSlicing,
    critBlunt: !!opts.critBlunt,
    critCrushing: !!opts.critCrushing,
    critStun: !!opts.critStun,
    critDoublePick: !!opts.critDoublePick,
    // ── Batch 7+ flags (were missing from entry() — causing compendium items to have false) ──
    vicious: !!opts.vicious,
    heavyRecoil: !!opts.heavyRecoil,
    shockwave: !!opts.shockwave,
    burningEdge: !!opts.burningEdge,
    chargedAttackBonus: opts.chargedAttackBonus ?? 0,
    halveSP: !!opts.halveSP,
    autoFireOn10: !!opts.autoFireOn10,
    doubleLock: !!opts.doubleLock,
    electricCharge: !!opts.electricCharge,
    electricChargeMax: opts.electricChargeMax ?? 0,
    chompAmmo: !!opts.chompAmmo,
    minimumAmmoToFire: opts.minimumAmmoToFire ?? 0,
    cs3: !!opts.cs3,
    cs3FallbackDamage: opts.cs3FallbackDamage ?? '',
    chargeKeepsRof: !!opts.chargeKeepsRof,
    targetedShotDamageDice: opts.targetedShotDamageDice ?? '',
    armorPiercing: !!opts.armorPiercing,
    scatter: !!opts.scatter,
    shatteredProjectiles: !!opts.shatteredProjectiles,
    shortAmmoFallbackDamage: opts.shortAmmoFallbackDamage ?? '',
    critOnBodyReq: opts.critOnBodyReq ?? 0,
    afflictionPrimary: opts.afflictionPrimary ?? 'body',
    afflictionSkill: opts.afflictionSkill ?? '',
    afflictionDv: opts.afflictionDv ?? 13,
    afflictionEffectId: opts.afflictionEffectId ?? '',
    outerZoneResistBonus: opts.outerZoneResistBonus ?? 2,
    isBeaconWeapon: !!opts.isBeaconWeapon,
  };
}

/** Build a 'gear' Item with type=weapon, equipped state. */
function weaponItem({ name, manufacturer = '', cost = '', minBody = 0, weapons = [], effects = [], description = '', notes = '', imgPath = '' }) {
  return {
    name,
    type: 'gear',
    img: imgPath,
    effects,
    system: {
      manufacturer,
      cost: COST_EXPAND[cost] ?? cost,
      note: '',
      notes: notes || '',
      isArmor: false,
      isWeapon: true,
      isComputer: false,
      armor: { maxSp: 0, currentSp: 0 },
      minBodyReq: minBody,
      weapons,
      quantity: 1,
      state: 'carried',
      carried: true,
      equipped: false,
      description: description || '',
    },
  };
}

// ─── Standardised firing-mode shorthands ──────────────────────────────────────

// AF factories carry both attack modes in a single entry:
//   damage         = single-shot damage (used by the Attack button)
//   autofireDamage = per-bullet autofire damage (used by the Autofire button)
//   shots          = rounds consumed per single attack
//   rangeTable          = single-shot DVs (Attack button)
//   autofireRangeTable  = autofire DVs (Autofire button)
const smgAF  = (overrides = {}) => entry({ type: 'smg', damage: '3d6', autofireDamage: '2d6', rateOfFire: 1, magazine: 30, hands: 1, concealable: true, damageType: 'autofire', autofireMultiplier: 3, autofireRangeTable: R.smgAF, rangeTable: R.smgSingle, shots: 3, ...overrides });
const arAF   = (overrides = {}) => entry({ type: 'assaultRifle', damage: '5d6', autofireDamage: '2d6', rateOfFire: 1, magazine: 24, hands: 2, damageType: 'autofire', autofireMultiplier: 4, autofireRangeTable: R.arAF, rangeTable: R.arSingle, shots: 3, ...overrides });
const mgAF   = (overrides = {}) => entry({ type: 'machineGun', damage: '5d6', autofireDamage: '2d6', rateOfFire: 1, magazine: 40, hands: 2, damageType: 'autofire', autofireMultiplier: 3, autofireRangeTable: R.mgAF, rangeTable: R.mgAF, shots: 5, ...overrides });
const sgSlug = (overrides = {}) => entry({ type: 'shotgun', damage: '5d6', rateOfFire: 1, magazine: 5, hands: 2, rangeTable: R.sgSlug, shots: 1, ...overrides });
const sgShell = (overrides = {}) => entry({ type: 'shotgun', damage: '3d6', rateOfFire: 1, magazine: 5, hands: 2, damageType: 'cone', coneSpread: 8, coneAngle: 53, coneHalfDamageDistance: 3, shots: 1, ...overrides });

// ═══════════════════════════════════════════════════════════════════════════
//   PISTOLS
// ═══════════════════════════════════════════════════════════════════════════

const VHP_BASE = { type: 'veryHeavyPistol', damage: '4d6', rateOfFire: 1, magazine: 4, hands: 1, rangeTable: R.pistol, shots: 1 };
const HP_BASE  = { type: 'heavyPistol',  damage: '3d6', rateOfFire: 2, magazine: 8, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1 };
const MP_BASE  = { type: 'mediumPistol', damage: '2d6', rateOfFire: 2, magazine: 12, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1 };

const pistols = [
  // ── VHP ──
  weaponItem({ name: 'Techtronika RT-46 Burya', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_PISTOL, 'Techtronika RT-46 Burya.png'),
    weapons: [entry({ ...VHP_BASE, damage: '4d6+2', tech: true, chargeType: 'keep' })],
    description: desc('<p>Tech Weapon (KEEP charge).</p><p><strong>CHARGED SHOT:</strong> ROF1, sees through thin cover, ignores ½ SP. Broken Arm critical injury if fired without Muscle+Bone Lace or Cyberarm.</p>') }),
  weaponItem({ name: 'Arasaka Tamayura', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_PISTOL, 'Arasaka Tamayura.png'),
    weapons: [entry({ ...VHP_BASE, excellent: true, power: true })],
    description: desc('<p>Excellent Quality (<strong>+1</strong> attack) and Power Weapon (<strong>+5</strong> crit damage; ricochet at <strong>-4</strong>).</p>') }),
  weaponItem({ name: 'Constitutional Arms Liberty', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Constitutional Arms Liberty.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 12, power: true, targetVitalsPenalty: 2, targetedShotDamageDice: '1d6' })],
    description: desc('<p>Power Weapon.</p><p><strong>TARGETED SHOT:</strong> <strong>Handgun</strong>-2 penalty; deals <strong>+1d6</strong> damage when targeting vitals.</p>') }),
  weaponItem({ name: 'Techtronika Metel', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_PISTOL, 'Techtronika Metel.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 8, power: true, jamOnRoll: 1, jamFiresFirst: false, shatteredProjectiles: true })],
    description: desc('<p>Power Weapon. Cheap (jams on attack die = 1).</p><p><strong>SHATTERED PROJECTILES:</strong> roll damage even on miss; if total > 15, deals <strong>2d6</strong> to everything within 2m of target instead.</p>') }),
  weaponItem({ name: 'Malorian Overture', manufacturer: 'Malorian Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Malorian Overture.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 6, power: true, targetVitalsPenalty: 4, targetedShotDamageDice: '2d6' })],
    description: desc('<p>Power Weapon.</p><p><strong>AIMED SHOT:</strong> <strong>Handgun</strong>-4 penalty; deals <strong>+2d6</strong> damage when targeting vitals.</p>') }),
  weaponItem({ name: 'Tsunami Nue', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Tsunami Nue.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 8, power: true })],
    description: desc('Power Weapon.') }),

  // ── HP ──
  weaponItem({ name: 'Constitutional Arms Unity', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Constitutional Arms Unity.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, power: true, targetVitalsPenalty: 4, targetedShotDamageDice: '1d6' })],
    description: desc('<p>Power Weapon.</p><p><strong>AIMED SHOT:</strong> <strong>Handgun</strong>-4 penalty; deals <strong>+1d6</strong> damage when targeting vitals.</p>') }),
  weaponItem({ name: 'Militech M-10AF Lexington', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech M-10AF Lexington.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Militech M-76e Omaha', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech M-76e  Omaha.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '2d6', chargeKeepsRof: true })],
    description: desc('<p>Tech Weapon (HOLD charge).</p><p><strong>CHARGED:</strong> stays RoF2 but uses 3 rounds per attack; sees through thin cover; ignores ½ SP (unique — not ROF1).</p>') }),
  weaponItem({ name: 'Arasaka JKE-X2 Kenshin', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_PISTOL, 'Arasaka JKE-X2 Kenshin.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, excellent: true, tech: true, chargeType: 'keep' })],
    description: desc('<p>Excellent Quality + Tech Weapon (KEEP charge).</p><p><strong>CHARGED SHOT:</strong> ROF1, thin cover, ignores ½ SP.</p>') }),
  weaponItem({ name: 'Militech Ticon', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech Ticon.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '2d6' })],
    description: desc('Tech Weapon (HOLD charge). Charged Shot 3 (CS3): ROF1, 3 rounds per attack, thin cover, ignores ½ SP.') }),
  weaponItem({ name: 'Darra Polytechnic DR-12 Quasar', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra Polytechnic DR-12 Quasar.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', jamOnRoll: 1, jamFiresFirst: false, cs3: true, cs3FallbackDamage: '2d6' })],
    description: desc('Tech Weapon (HOLD charge), Cheap. Charged Shot 3 (CS3).') }),
  weaponItem({ name: 'Malorian Arms Sonnet', manufacturer: 'Malorian Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Malorian Arms Sonnet.png'),
    weapons: [
      entry({ ...HP_BASE, magazine: 12, smart: true }),
      entry({ type: 'heavyPistol', damage: '1d6', rateOfFire: 1, magazine: 2, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1, smart: true, isBeaconWeapon: true }),
    ],
    description: desc('<p>Smart Weapon.</p><p><strong>MODE 2:</strong> Tracker Dart (<strong>1d6</strong>, ammo 2) — on hit, applies Beacon Tag to target. ISA mode (mode 1): misses by ≤5 vs a Beacon Tagged target automatically redirect to hit.</p>') }),
  weaponItem({ name: 'Sanroo Hello Cutie+', manufacturer: 'Sanroo', cost: 'VEX', imgPath: img(W_PISTOL, 'Sanroo-Hello-Cutie.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '2d6', chargedAttackBonus: 2 })],
    description: desc('<p>Tech Weapon (HOLD charge). Charged Shot 3.</p><p><strong>STABILIZERS:</strong> <strong>+2</strong> attacks while charged.</p>') }),

  // ── MP ──
  weaponItem({ name: 'Darra Polytechnic DR-5 Nova', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra Polytechnic DR-5 Nova.png'),
    weapons: [entry({ ...MP_BASE, magazine: 8, power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Tsunami Kappa', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_SMG, 'Tsunami Kappa.png'),
    weapons: [entry({ ...MP_BASE, smart: true, doubleLock: true })],
    description: desc('<p>Smart Weapon.</p><p><strong>DOUBLE LOCK:</strong> spend 4 ammo for 1 attack against 2 targets within 6m of each other. Muzzle cannot be modified.</p>') }),
  weaponItem({ name: 'Darra Polytechnic DS-1 Tenebra', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra Polychenic Tenebra.png'),
    weapons: [entry({ ...MP_BASE, silenceBuiltIn: true, silenceBuiltInDV: 8 })],
    description: desc('<p>Silenced (built-in): <strong style="color: var(--cpb-accent);">DV8</strong> <strong>INT</strong>+<strong>Perception</strong> to hear (<strong style="color: var(--cpb-accent);">DV</strong> <strong>+1</strong> per 4m away). Muzzle cannot be modified.</p>') }),
  weaponItem({ name: 'Tsunami Yanari', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Tsunami Yanari.png'),
    weapons: [entry({ ...MP_BASE, silenceBuiltIn: true, silenceBuiltInDV: 10, payloadDmgBonus: 2 })],
    description: desc('<p><strong>ACCURATE:</strong> <strong>+1</strong> attacks.</p><p><strong>PAYLOAD:</strong> toxic rounds deal <strong>+2</strong> damage if they pierce SP. Silenced (built-in): <strong style="color: var(--cpb-accent);">DV10</strong>. Muzzle cannot be modified.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SHOTGUNS
// ═══════════════════════════════════════════════════════════════════════════

const shotguns = [
  weaponItem({ name: 'Budget Arms Carnage', manufacturer: 'Budget Arms', cost: 'PR', minBody: 10, imgPath: img(W_SHOTGUN, 'Budget Arms Carnage.png'),
    weapons: [
      sgSlug({ magazine: 5, power: true, jamOnRoll: 1, jamFiresFirst: true, critOnBodyReq: 10 }),
      sgShell({ magazine: 5, jamOnRoll: 1, jamFiresFirst: true }),
    ],
    description: desc('<p>Power Weapon. Poor Quality (jams on 1, but the shot still lands). <strong>BODY</strong> 10+ to wield without Torn Muscle critical on the attacker.</p>') }),
  weaponItem({ name: 'Kang Tao L-69 Zhuo', manufacturer: 'Kang Tao', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Kang Tao L-69 Zhuo.png'),
    weapons: [
      sgShell({ damage: '4d6', magazine: 32, shots: 8, smart: true, minimumAmmoToFire: 8 }),
    ],
    description: desc('<p>Smart Weapon.</p><p><strong>SHELL-ONLY:</strong> <strong>4d6</strong> in 8/8m cone; consumes 8 shells per attack; will not fire with fewer than 8 loaded. No slug mode. Muzzle cannot be modified.</p>') }),
  weaponItem({ name: 'Rostovic DB-2 Satara', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic DB-2 Satara.png'),
    weapons: [
      sgSlug({ magazine: 2, tech: true, chargeType: 'keep' }),
      sgShell({ magazine: 2, tech: true, chargeType: 'keep' }),
    ],
    description: desc('<p>Tech Weapon (KEEP charge).</p><p><strong>CHARGED SHOT:</strong> ROF1, thin cover, ignores ½ SP.</p>') }),
  weaponItem({ name: 'Techtronika VST-37 Pozhar', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_SHOTGUN, 'Techtronika VST-37 Pozhar.png'),
    weapons: [
      sgSlug({ magazine: 3, power: true }),
      sgShell({ magazine: 3 }),
    ],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Arasaka Akumu Mk.II', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Arasaka Akumu Mk.II.png'),
    weapons: [
      sgSlug({ damage: '5d6', magazine: 25, smart: true, excellent: true }),
      sgShell({ magazine: 25, smart: true, excellent: true }),
      entry({ type: 'grenadeLauncher', damage: '6d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, excellent: true, damageType: 'explosion', coneSpread: 10, coneAngle: 360, coneHalfDamageDistance: 4 }),
    ],
    description: desc('<p>Smart Weapon, Excellent Quality (<strong>+1</strong> to all attacks: slug, shell, and grenade). Can use Smart ammo.</p><p><strong>SLUG:</strong> <strong>5d6</strong>, ammo 25.</p><p><strong>SHELL:</strong> <strong>3d6</strong> in an 8/8m cone (as the Techtronika VST-37 Pozhar).</p><p><strong>UNDER-BARREL GRENADE LAUNCHER:</strong> Ammo 1, fires a fragmentation grenade for <strong>6d6</strong> explosion (4m inner / 10m outer sphere).</p>') }),
  weaponItem({ name: 'Militech Crusher', manufacturer: 'Militech', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Militech Crusher.png'),
    weapons: [
      sgShell({ magazine: 12, power: true }),
    ],
    description: desc('Power Weapon. Shell-only — no slug mode.') }),
  weaponItem({ name: 'Constitutional Arms M2038 Tactician', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_SHOTGUN, 'Constitutional Arms M2038 Tactician.png'),
    weapons: [
      sgSlug({ magazine: 2, power: true, armorPiercing: true }),
      sgShell({ magazine: 2 }),
    ],
    description: desc('<p>Power Weapon.</p><p><strong>ARMOR PIERCING:</strong> when this attack would ablate 1 SP, ablates 2 instead.</p>') }),
  weaponItem({ name: 'Rostovic DB-2 Testera', manufacturer: 'Rostovic', cost: 'PR', imgPath: img(W_SHOTGUN, 'Rostovic DB-2 Testera.png'),
    weapons: [
      sgSlug({ damage: '5d6+3', magazine: 2, power: true }),
      sgShell({ magazine: 2, shellDvModifier: -1 }),
    ],
    description: desc('<p>Power Weapon.</p><p><strong>INACCURATE:</strong> <strong>-1</strong> to all attacks (apply manually). Shell mode <strong style="color: var(--cpb-accent);">DV = Attack-1</strong>.</p>') }),
  weaponItem({ name: 'Rostovic DB-4 Palica', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic DB-4 Palica.png'),
    weapons: [
      sgSlug({ magazine: 3, smart: true }),
    ],
    description: desc('Smart Weapon. Slug-only (no shell mode).') }),
  weaponItem({ name: 'Rostovic DB-4 Igla', manufacturer: 'Rostovic', cost: 'PR', imgPath: img(W_SHOTGUN, 'Rostovic DB-4 Igla.png'),
    weapons: [
      sgSlug({ magazine: 2, power: true }),
      sgShell({ magazine: 2, shellDvModifier: -1 }),
    ],
    description: desc('<p>Power Weapon. Shell mode <strong style="color: var(--cpb-accent);">DV = Attack-1</strong>.</p>') }),
  weaponItem({ name: 'Rostovic BT-1 Pelrun', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic BT-1 Perun.png'),
    weapons: [
      sgSlug({ magazine: 5, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '4d6' }),
      sgShell({ magazine: 5, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '3d6' }),
    ],
    description: desc('<p>Tech Weapon (HOLD charge).</p><p><strong>CHARGED:</strong> ROF1, 3 rounds per attack, thin cover, ignores ½ SP.</p><p><strong>CHARGED SHELL MODE:</strong> <strong style="color: var(--cpb-accent);">DV</strong>-5.</p>') }),
  weaponItem({ name: 'Constitutional Arms Hurricane', manufacturer: 'Constitutional Arms', cost: 'LUX', minBody: 11, imgPath: img(W_SHOTGUN, 'Constitutional Arms Hurricane.png'),
    weapons: [
      sgSlug({ damage: '5d6', rateOfFire: 2, magazine: 16 }),
    ],
    description: desc('<p><strong>HEAVY / MOUNTED:</strong> <strong>BODY</strong> 11+ or properly mounted.</p><p><strong>HEAVY RELOAD:</strong> replacing the drum costs 2 actions. Cannot make aimed shots.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SMGs
// ═══════════════════════════════════════════════════════════════════════════

const smgs = [
  weaponItem({ name: 'Arasaka HJKE-11 Yukimura', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_SMG, 'Arasaka HJKE-11 Yukimura.png'),
    weapons: [smgAF({ smart: true })],
    description: desc('Smart Weapon.') }),
  weaponItem({ name: 'Kang Tao A-22B Chao', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_SMG, 'Kang Tao A-22B Chao.png'),
    weapons: [
      // Single shot: 3d6, uses 2 rounds. Autofire capped at ×2.
      smgAF({ shots: 2, smart: true, autofireMultiplier: 2 }),
    ],
    description: desc('<p>Smart Weapon.</p><p><strong>SINGLE SHOT:</strong> <strong>3d6</strong>, 2 rounds/atk; if insufficient → fires all remaining at <strong>1d6</strong>. <strong>Autofire</strong> capped at ×2.</p>') }),
  weaponItem({ name: 'KTech Terrier', manufacturer: 'KTech', cost: 'EX', imgPath: img(W_ROOT, 'KTech Terrier.png'),
    weapons: [smgAF({ chompAmmo: true })],
    description: desc('<p><strong>KTECH CHOMP AMMO:</strong> sticks to target on hit (or autofire miss by ≤5); deals <strong>1d6</strong> to everyone within 2m of the target at the end of the user\'s next turn.</p>') }),
  weaponItem({ name: 'Hansen Arms HA-4 Grit', manufacturer: 'Hansen Arms', cost: 'PR', imgPath: img(W_SMG, 'Hansen Arms HA-4 Grit.png'),
    weapons: [smgAF()],
    description: desc('<p>Single shot fires a three-round burst dealing <strong>3d6</strong> (despite a <strong>2d6</strong> base). Charged (HOLD): next attack is ROF1 with thin cover and ignores ½ SP.</p>') }),
  weaponItem({ name: 'Arasaka HJRE-9 Asuka', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_ROOT, 'Arasaka Asuka.png'),
    weapons: [smgAF({ power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Kang Tao S9 Daishi Tang', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_SMG, 'Kang Tao Daishi-Tang.png'),
    weapons: [smgAF({ smart: true, autoFireOn10: true })],
    description: desc('<p>Smart Weapon.</p><p><strong>SINGLE-SHOT RULE:</strong> if attack die = 10 and the weapon has enough ammo, treat the shot as autofire instead.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   ASSAULT RIFLES
// ═══════════════════════════════════════════════════════════════════════════

const ars = [
  weaponItem({ name: 'Arasaka HJSH-18 Masamune', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_ROOT, 'Arasaka HJSH-18 Masamune.png'),
    weapons: [arAF({ excellent: true, power: true, autofireMultiplier: 3 })],
    description: desc('<p>Excellent Quality + Power Weapon. <strong>Autofire</strong> capped at ×3.</p>') }),
  weaponItem({ name: 'Tsunami Kyubi', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_AR, 'Tsunami Kyubi.png'),
    weapons: [arAF({ smart: true })],
    description: desc('<p>Smart Weapon.</p><p><strong>PRECISE:</strong> when the attack die rolls a 1 on a single-shot, you may reroll once (must use the new result).</p>') }),
  weaponItem({ name: 'Nokota D5 Sidewinder', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_ROOT, 'Nokota D5 Sidewinder.png'),
    weapons: [arAF({ smart: true })],
    description: desc('<p>Smart Weapon.</p><p><strong>REPAIRS:</strong> lower repair cost by 1 price category.</p>') }),
  weaponItem({ name: 'Arasaka Nowaki', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_AR, 'Arasaka Nowaki.png'),
    weapons: [arAF({ power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Darra Polytechnic DA8 Umbra', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_ROOT, 'Darra Polytechnic DA8 Umbra.png'),
    weapons: [arAF({ power: true, jamOnRoll: 1, autofireMultiplier: 5 })],
    description: desc('<p>Power Weapon, Cheap. <strong>Autofire</strong> capped at ×5.</p>') }),
  weaponItem({ name: 'Militech Hercules 3AX', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech Hercules 3AX.png'),
    weapons: [arAF({ smart: true, payloadDmgBonus: 2 })],
    description: desc('<p>Smart Weapon.</p><p><strong>PAYLOAD:</strong> toxic rounds piercing SP deal <strong>+2</strong> damage.</p>') }),
  weaponItem({ name: 'Militech M251s Ajax', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_AR, 'Militech M251s Ajax.png'),
    weapons: [arAF({ power: true })],
    description: desc('<p>Power Weapon.</p><p><strong>STURDY:</strong> 20 HP to break.</p>') }),
  weaponItem({ name: 'Militech AR-9 Brunswick', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech AR-9 Brunswick.png'),
    weapons: [
      // Single shot: 4d6, 5 rounds/atk. Autofire: standard 2d6 ×4.
      arAF({ damage: '4d6', shots: 5, power: true, scatter: true, shortAmmoFallbackDamage: '3d6' }),
    ],
    description: desc('<p>Power Weapon.</p><p><strong>SINGLE SHOT:</strong> <strong>4d6</strong>, 5 rounds/atk; if insufficient → fires all remaining at <strong>3d6</strong>.</p><p><strong>SCATTER:</strong> anything in 2m to either side of target takes ½ damage. Muzzle cannot be modified.</p>') }),
  weaponItem({ name: 'Nokota D5 Copperhead', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_AR, 'Nokota D5 Copperhead.png'),
    weapons: [arAF({ power: true })],
    description: desc('<p>Power Weapon.</p><p><strong>REPAIRS:</strong> lower repair cost by 1 price category.</p>') }),
  weaponItem({ name: 'Techtronika AK-68 Vologda', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_AR, 'Techtronika AT-9 Vologda.png'),
    weapons: [
      // Single shot: 5d6, 5 rounds/atk. Magazine locked at 100. Autofire capped at ×5.
      arAF({ shots: 5, magazine: 100, power: true, autofireMultiplier: 5 }),
    ],
    description: desc('<p>Power Weapon.</p><p><strong>SINGLE SHOT:</strong> <strong>5d6</strong>, 5 rounds/atk; if insufficient → fires all remaining at <strong>3d6</strong>. Magazine cannot be modified. <strong>Autofire</strong> capped at ×5.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MACHINE GUNS
// ═══════════════════════════════════════════════════════════════════════════

const mgs = [
  weaponItem({ name: 'Tsunami RMS Helix', manufacturer: 'Tsunami Arms', cost: 'LUX', minBody: 11, imgPath: img(W_ROOT, 'Tsunami Heelilx.png'),
    weapons: [
      mgAF({ damage: '5d6', magazine: 40, autofireMultiplier: 4, autofireRangeTable: R.helixAF, rangeTable: R.helixAF, shots: 10 }),
    ],
    description: desc('<p>Heavy Mounted weapon. <strong>Autofire</strong>-only, no single shot.</p><p><strong>BANDFED:</strong> extra 40-round bands cost €$50 each, added in sequence. <strong>BODY</strong> 11+ or properly mounted.</p>') }),
  weaponItem({ name: 'Constitutional Arms M2067 Defender', manufacturer: 'Constitutional Arms', cost: 'VEX', minBody: 8, imgPath: img(W_ROOT, 'Constitutional Arms Defender.png'),
    weapons: [
      // Autofire deals 3d6 per hit (not the standard 2d6).
      mgAF({ power: true, autofireDamage: '3d6', autofireMultiplier: 3 }),
    ],
    description: desc('<p>Power Weapon.</p><p><strong>HEAVY MOUNTED WEAPON:</strong> <strong>BODY</strong> 8+. <strong>Autofire</strong> deals <strong>3d6</strong> per hit (not <strong>2d6</strong>).</p>') }),
  weaponItem({ name: 'Midnight Arms MA70 HB', manufacturer: 'Midnight Arms', cost: 'VEX', minBody: 8, imgPath: img(W_ROOT, 'Midnight Arms MA70 HB.png'),
    weapons: [mgAF({ power: true })],
    description: desc('<p>Power Weapon.</p><p><strong>HEAVY MOUNTED:</strong> <strong>BODY</strong> 8+.</p><p><strong>CONCUSSIVE:</strong> explosive rounds deal <strong>+2</strong> damage.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SNIPER RIFLES & PRECISION RIFLES
// ═══════════════════════════════════════════════════════════════════════════

const SR_BASE = { type: 'sniperRifle', damage: '5d6', rateOfFire: 1, magazine: 24, hands: 2, rangeTable: R.sr, shots: 1 };
const PR_BASE = { type: 'precisionRifle', damage: '5d6', rateOfFire: 1, magazine: 24, hands: 2, rangeTable: R.pr, shots: 1 };

const snipers = [
  weaponItem({ name: 'Tsunami Nekomata', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_SNIPER, 'Tsunami Nekomata.png'),
    weapons: [entry({ ...SR_BASE, tech: true, chargeType: 'keep' })],
    description: desc('<p>Tech Weapon (KEEP charge).</p><p><strong>CHARGED SHOT:</strong> ROF1, thin cover, ignores ½ SP.</p>') }),
  weaponItem({ name: 'Nokota Osprey', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_ROOT, 'Nokota Osprey.png'),
    weapons: [
      entry({ ...SR_BASE, power: true }),
      entry({ ...SR_BASE, damage: '6d6', shots: 3, power: true, shortAmmoFallbackDamage: '3d6' }),
    ],
    description: desc('<p>Power Weapon.</p><p><strong>BURN:</strong> incendiary rounds deal <strong>+2</strong> damage past SP.</p><p><strong>BURST:</strong> <strong>6d6</strong>, 3 rounds/atk; if insufficient → fires all remaining at <strong>3d6</strong>.</p>') }),
  weaponItem({ name: 'Techtronika SPT32 Grad', manufacturer: 'Techtronika', cost: 'VEX', imgPath: img(W_SNIPER, 'Techtronika SPT32 Grad.png'),
    weapons: [entry({ ...SR_BASE, magazine: 1, excellent: true, power: true })],
    description: desc('Excellent Quality + Power Weapon. Single-shot bolt-action.') }),
  weaponItem({ name: 'Tsunami Ashura', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_SNIPER, 'Tsunami Ashura.png'),
    weapons: [
      entry({ ...SR_BASE, magazine: 5, smart: true }),
      entry({ ...SR_BASE, damage: '4d6', magazine: 5, smart: true, payloadDmgBonus: 2, silenceBuiltIn: true, silenceBuiltInDV: 10 }),
    ],
    description: desc('<p>Smart Weapon.</p><p><strong>DART MODE:</strong> silent smart dart (<strong style="color: var(--cpb-accent);">DV10</strong> to hear), <strong>4d6</strong> + toxin payload (<strong>+2</strong> dmg on penetration). Replacement darts €$50 per 10.</p>') }),

  weaponItem({ name: 'Rostovic Kolac', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_ROOT, 'Rostovic Kolac.png'),
    weapons: [entry({ ...PR_BASE, damage: '6d6', power: true, heavyRecoil: true })],
    description: desc('<p>Power Weapon.</p><p><strong>HEAVY RECOIL:</strong> a user with <strong>BODY</strong> < 8 takes <strong>1d6</strong> directly to HP when firing.</p>') }),
  weaponItem({ name: 'Militech M-179 Achilles', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech M-179 Achilles.png'),
    weapons: [entry({ ...PR_BASE, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '4d6' })],
    description: desc('Tech Weapon (HOLD charge). Charged Shot 3 (CS3): ROF1, 3 rounds per attack, thin cover, ignores ½ SP.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SPECIAL RANGED — RL, Stun, Flamethrowers
// ═══════════════════════════════════════════════════════════════════════════

const special = [
  weaponItem({ name: 'Arasaka Dojigiri Yasutsuna', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_ROOT, 'Arasaka Dojigiri Yasutsuna.png'),
    weapons: [entry({ type: 'rocketLauncher', damage: '10d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, smart: true, damageType: 'explosion', coneSpread: 4, coneHalfDamageDistance: 4 })],
    description: desc('<p>Smart Weapon. Explosive 4/10m.</p><p><strong>HOMING GUIDANCE:</strong> ISA rockets are homing — when the only moving target is 50+m away vs unmoving background, a miss of ≤7 means the rocket guides itself onto the target.</p>') }),
  weaponItem({ name: 'Kang Tao TKI-20 Mámù', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_ROOT, 'Kang Tao Mámù.png'),
    effects: [{ name: 'Stunned', disabled: true, transfer: false, changes: [], flags: { 'cyberpunk-blue': { isAfflictionEffect: true } } }],
    weapons: [entry({ type: 'stunGun', damage: '3d6', rateOfFire: 2, magazine: 12, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1, damageType: 'affliction', afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, shockwave: true })],
    description: desc('<p>Stun Gun.</p><p><strong>SHOCKWAVE:</strong> a standing target with <strong>BODY</strong> < 8 is pushed 2m away.</p><p><strong>STUN:</strong> target reduced to 0 HP becomes stable (criticals still trigger normally).</p><p><strong>BATTERY:</strong> no ammo slot — €$50 battery, 1h to recharge from empty.</p>') }),
  weaponItem({ name: 'Sanroo Hotness', manufacturer: 'Sanroo', cost: 'EX', imgPath: img(W_ROOT, 'Sanroo hotness.png'),
    weapons: [entry({ type: 'flamethrower', damage: '4d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 4, coneAngle: 53, coneHalfDamageDistance: 6 })],
    description: desc('<p>Flamethrower.</p><p><strong>SPRAY:</strong> liquid in 4/6m cone, <strong style="color: var(--cpb-accent);">DV15</strong> <strong>RFLX</strong>+Evade; pass=<strong>2d6</strong>, fail=<strong>4d6</strong>. Ignores ½ SP.</p><p><strong>TANK:</strong> 15 HP; if destroyed by fire/thermal → 2/4m explosion <strong>4d6</strong>. CHOOH² fuel deals <strong>+1</strong> toxic damage.</p>') }),
  weaponItem({ name: 'Militech IP-13 Provo', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech IP-13 Provo.png'),
    weapons: [entry({ type: 'flamethrower', damage: '4d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 4, coneAngle: 53, coneHalfDamageDistance: 6 })],
    description: desc('<p>Flamethrower. Same baseline as Hotness; tank has 25 HP. CHOOH²: roll <strong>1d10</strong>; if result > user\'s <strong>BODY</strong> → <strong>1d6</strong> directly to HP.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MELEE WEAPONS
// ═══════════════════════════════════════════════════════════════════════════

const meleeRange = R.melee;
const lmw = (overrides = {}) => entry({ type: 'lightMelee',  damage: '1d6', rateOfFire: 2, hands: 1, concealable: true, rangeTable: meleeRange, ...overrides });
const mmw = (overrides = {}) => entry({ type: 'mediumMelee', damage: '2d6', rateOfFire: 2, hands: 1, rangeTable: meleeRange, ...overrides });
const hmw = (overrides = {}) => entry({ type: 'heavyMelee',  damage: '3d6', rateOfFire: 2, hands: 1, rangeTable: meleeRange, ...overrides });
const vhmw = (overrides = {}) => entry({ type: 'veryHeavyMelee', damage: '4d6', rateOfFire: 1, hands: 2, rangeTable: meleeRange, ...overrides });

const melee = [
  weaponItem({ name: 'Kendachi RA-5 Powered Knife', manufacturer: 'Kendachi', cost: 'PR', imgPath: img(W_MELEE, 'Kendachi knife.png'),
    weapons: [lmw({ electricCharge: true, electricChargeMax: 10 })],
    description: desc('<p>Light Melee, throwable. Electric Charge (battery: 10 uses, 15 min to charge): a target taking any damage must <strong style="color: var(--cpb-accent);">DV15</strong> <strong>TECH</strong>+<strong>Endurance</strong> or take <strong>2d6</strong> directly to HP. A direct hit on an uninsulated electrical device disables it.</p>') }),
  weaponItem({ name: 'Militech M2 Combat Knife', manufacturer: 'Militech', cost: 'C', imgPath: img(W_MELEE, 'militech combat knife.png'),
    weapons: [lmw()],
    description: desc('Standard combat knife.') }),
  weaponItem({ name: 'Scalpel', manufacturer: '', cost: 'C', imgPath: img(W_MELEE, 'scalpel.png'),
    weapons: [lmw()],
    description: desc('Small but very sharp.') }),

  weaponItem({ name: 'Throwing Axe', manufacturer: 'Kaukaz', cost: 'CO', imgPath: img(W_MELEE, 'Kaukaz axe.png'),
    weapons: [mmw()],
    description: desc('Medium Melee, throwable (15/20m).') }),
  weaponItem({ name: 'Baseball Bat', manufacturer: '', cost: 'CO', imgPath: img(W_MELEE, 'Baseball bat.png'),
    weapons: [mmw({ critBlunt: true })],
    description: desc('<p><strong>BLUNT:</strong> cannot cause dismembering criticals. A would-be dismembering crit becomes the Broken version instead and deals <strong>+5</strong> bonus damage.</p>') }),

  weaponItem({ name: 'Kendachi Mono-Three', manufacturer: 'Kendachi', cost: 'LUX', imgPath: img(W_MELEE, 'Kendachi Mono-Three.png'),
    weapons: [hmw({ critSlicing: true, burningEdge: true })],
    description: desc('<p><strong>SLICING:</strong> on Broken Arm/Leg, roll <strong>1d6</strong> — 2+ becomes Dismembered.</p><p><strong>BURNING EDGE:</strong> register biometrics (Action to activate); while active the blade ignores any SP below 11.</p>') }),
  weaponItem({ name: 'Katana', manufacturer: '', cost: 'EX', imgPath: img(W_MELEE, 'Katana.png'),
    weapons: [hmw({ critSlicing: true })],
    description: desc('<p><strong>SLICING:</strong> on Broken Arm/Leg, roll <strong>1d6</strong> — 2+ becomes Dismembered.</p>') }),
  weaponItem({ name: 'Militech Stun Baton', manufacturer: 'Militech', cost: 'PR', imgPath: img(W_MELEE, 'Militech Stun Baton.png'),
    effects: [{ name: 'Stunned', disabled: true, transfer: false, changes: [], flags: { 'cyberpunk-blue': { isAfflictionEffect: true } } }],
    weapons: [hmw({ damageType: 'affliction', afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13 })],
    description: desc('<p><strong>STUN:</strong> on a hit that penetrates SP, the target rolls <strong>BODY</strong>+<strong>Endurance</strong> vs <strong style="color: var(--cpb-accent);">DV 13</strong> or becomes Stunned.</p>') }),
  weaponItem({ name: 'Sledgehammer', manufacturer: 'Kaukaz', cost: 'PR', imgPath: img(W_MELEE, 'Kaukaz sledgehammer.png'),
    weapons: [hmw({ hands: 2, critCrushing: true })],
    description: desc('<p><strong>CRUSHING:</strong> Collapsed Lung/Spinal Injury also causes Broken Ribs; would-be Broken Ribs also causes Collapsed Lung; any Critical Head Injury also causes Concussion; would-be Concussion also causes Cracked Skull.</p>') }),

  weaponItem({ name: 'Budget Arms Cut-O-Matic', manufacturer: 'Budget Arms', cost: 'EX', imgPath: img(W_MELEE, 'Budget Arms Cut-o-Matic.png'),
    weapons: [vhmw({ vicious: true })],
    description: desc('<p><strong>VICIOUS:</strong> while powered on, criticals deal <strong>+5</strong> damage.</p><p><strong>NOISY:</strong> stealth impossible while on (toggle as part of another action — but not both same round).</p><p><strong>UNPOWERED:</strong> if off or out of CHOOH², deals only <strong>3d6</strong>.</p>') }),

  weaponItem({ name: 'Bow', manufacturer: '', cost: 'PR', imgPath: img(W_ROOT, 'bow.png'),
    weapons: [entry({
      type: 'bowCrossbow', damage: '4d6', rateOfFire: 1, hands: 2,
      rangeTable: [17, 15, 13, 15, 20, 0, 0, 0],
    })],
    description: desc('Standard recurve bow. Uses arrows. Two-handed; silent.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const WEAPON_CATALOGUE = [
  ...pistols,
  ...shotguns,
  ...smgs,
  ...ars,
  ...mgs,
  ...snipers,
  ...special,
  ...melee,
];
