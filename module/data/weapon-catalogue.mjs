/**
 * Weapon catalogue — full Cyberpunk Blue weapon list, ready to drop into
 * the `cyberpunk-blue.weapons` compendium.
 *
 * Each entry returns Foundry Item create-data ready for `Item.createDocuments`.
 * The accompanying mod catalogue lives in `mod-catalogue.mjs`.
 *
 * Excluded by design (per memory/weapon-cards-excluded.md):
 *   - Arasaka Onibi Plasma Caster (non-standard)
 *   - Softsys Microwaver-55 (EMP, not a weapon)
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

const desc = (html) => `<p>${html}</p>`;

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
    smg: 'shoulderArms', heavySmg: 'shoulderArms',
    shotgun: 'shoulderArms', assaultRifle: 'shoulderArms',
    machineGun: 'heavyWeapons', precisionRifle: 'shoulderArms',
    sniperRifle: 'shoulderArms', grenadeLauncher: 'heavyWeapons',
    rocketLauncher: 'heavyWeapons', flamethrower: 'heavyWeapons',
    bowCrossbow: 'archery',
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
  };
}

/** Build a 'gear' Item with type=weapon, equipped state. */
function weaponItem({ name, manufacturer = '', cost = '', minBody = 0, weapons = [], description = '', notes = '', imgPath = '' }) {
  return {
    name,
    type: 'gear',
    img: imgPath,
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
const smgAF  = (overrides = {}) => entry({ type: 'smg', damage: '3d6', autofireDamage: '2d6', rateOfFire: 1, magazine: 30, hands: 1, concealable: true, damageType: 'autofire', autofireMultiplier: 3, autofireRangeTable: R.smgAF, rangeTable: R.smgAF, shots: 3, ...overrides });
const arAF   = (overrides = {}) => entry({ type: 'assaultRifle', damage: '5d6', autofireDamage: '2d6', rateOfFire: 1, magazine: 24, hands: 2, damageType: 'autofire', autofireMultiplier: 4, autofireRangeTable: R.arAF, rangeTable: R.arAF, shots: 3, ...overrides });
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
    description: desc('Tech Weapon (KEEP charge). Charged Shot: ROF1, sees through thin cover, ignores ½ SP. Broken Arm critical injury if fired without Muscle+Bone Lace or Cyberarm.') }),
  weaponItem({ name: 'Arasaka Tamayura', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_PISTOL, 'Arasaka Tamayura.png'),
    weapons: [entry({ ...VHP_BASE, excellent: true, power: true })],
    description: desc('Excellent Quality (+1 attack) and Power Weapon (+5 crit damage; ricochet at -4).') }),
  weaponItem({ name: 'Constitutional Arms Liberty', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Constitutional Arms Liberty.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 12, power: true, targetVitalsPenalty: 6 })],
    description: desc('Power Weapon. Targeted Shot: vital-area penalty reduced by 2.') }),
  weaponItem({ name: 'Techtronika Metel', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_PISTOL, 'Techtronika Metel.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 8, power: true, jamOnRoll: 1, jamFiresFirst: false })],
    description: desc('Power Weapon. Cheap (jams on attack die = 1). Shattered Projectiles: roll damage even on miss; if total would exceed 15, deals 2d6 to everything within 2m of target instead.') }),
  weaponItem({ name: 'Malorian Overture', manufacturer: 'Malorian Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Malorian Overture.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 6, power: true })],
    description: desc('Power Weapon. Aimed Shot: Handgun-5 to deal 5d6 instead of 4d6.') }),
  weaponItem({ name: 'Tsunami Nue', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Tsunami Nue.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 8, power: true })],
    description: desc('Power Weapon.') }),

  // ── HP ──
  weaponItem({ name: 'Constitutional Arms Unity', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Constitutional Arms Unity.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, power: true })],
    description: desc('Power Weapon. Aimed Shot: Handgun-4 to deal 4d6 instead of 3d6.') }),
  weaponItem({ name: 'Militech M-10AF Lexington', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech M-10AF Lexington.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Militech M-76e Omaha', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech M-76e  Omaha.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold' })],
    description: desc('Tech Weapon (HOLD charge). Charged: stays RoF2 but uses 3 rounds per attack; sees through thin cover; ignores ½ SP (unique — not ROF1).') }),
  weaponItem({ name: 'Arasaka JKE-X2 Kenshin', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_PISTOL, 'Arasaka JKE-X2 Kenshin.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, excellent: true, tech: true, chargeType: 'keep' })],
    description: desc('Excellent Quality + Tech Weapon (KEEP charge). Charged Shot: ROF1, thin cover, ignores ½ SP.') }),
  weaponItem({ name: 'Militech Ticon', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech Ticon.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold' })],
    description: desc('Tech Weapon (HOLD charge). Charged Shot 3 (CS3): ROF1, 3 rounds per attack, thin cover, ignores ½ SP.') }),
  weaponItem({ name: 'Darra Polytechnic DR-12 Quasar', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra Polytechnic DR-12 Quasar.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', jamOnRoll: 1, jamFiresFirst: false })],
    description: desc('Tech Weapon (HOLD charge), Cheap. Charged Shot 3 (CS3).') }),
  weaponItem({ name: 'Malorian Arms Sonnet', manufacturer: 'Malorian Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Maloran Arms Sonnet.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, smart: true })],
    description: desc('Smart Weapon. Experimental: alternate mode fires a tracker dart (1d6, ammo 2). ISA shots that miss by ≤5 vs a beacon-tagged target: roll 1d10+15 to redirect onto them.') }),
  weaponItem({ name: 'Sanroo Hello Cutie+', manufacturer: 'Sanroo', cost: 'VEX', imgPath: img(W_PISTOL, 'Sanroo-Hello-Cutie.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold' })],
    description: desc('Tech Weapon (HOLD charge). Charged Shot 3. Stabilizers: +2 attacks while charged.') }),

  // ── MP ──
  weaponItem({ name: 'Darra Polytechnic DR-5 Nova', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra Polytechnic DR-5 Nova.png'),
    weapons: [entry({ ...MP_BASE, magazine: 8, power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Tsunami Kappa', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_SMG, 'Tsunami Kappa.png'),
    weapons: [entry({ ...MP_BASE, smart: true })],
    description: desc('Smart Weapon. Double Lock: spend 4 ammo for 1 attack against 2 targets within 6m of each other. Muzzle cannot be modified.') }),
  weaponItem({ name: 'Darra Polytechnic DS-1 Tenebra', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra Polychenic Tenebra.png'),
    weapons: [entry({ ...MP_BASE, silenceBuiltIn: true, silenceBuiltInDV: 8 })],
    description: desc('Silenced (built-in): DV8 INT+Perception to hear (DV +1 per 4m away). Muzzle cannot be modified.') }),
  weaponItem({ name: 'Tsunami Yanari', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Tsunami Yanari.png'),
    weapons: [entry({ ...MP_BASE, silenceBuiltIn: true, silenceBuiltInDV: 10, payloadDmgBonus: 2 })],
    description: desc('Accurate: +1 attacks. Payload: toxic rounds deal +2 damage if they pierce SP. Silenced (built-in): DV10. Muzzle cannot be modified.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SHOTGUNS
// ═══════════════════════════════════════════════════════════════════════════

const shotguns = [
  weaponItem({ name: 'Budget Arms Carnage', manufacturer: 'Budget Arms', cost: 'PR', minBody: 10, imgPath: img(W_SHOTGUN, 'Budget Arms Carnage.png'),
    weapons: [
      sgSlug({ magazine: 5, power: true, jamOnRoll: 1, jamFiresFirst: true }),
      sgShell({ magazine: 5, jamOnRoll: 1, jamFiresFirst: true }),
    ],
    description: desc('Power Weapon. Poor Quality (jams on 1, but the shot still lands). BODY 10+ to wield without injury or you suffer a Torn Muscle critical.') }),
  weaponItem({ name: 'Kang Tao L-69 Zhuo', manufacturer: 'Kang Tao', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Kang Tao L-69 Zhuo.png'),
    weapons: [
      sgShell({ damage: '4d6', magazine: 32, shots: 8, smart: true }),
    ],
    description: desc('Smart Weapon. Shell-only: 4d6 in 8/8m cone; consumes 8 shells per attack; will not fire with fewer than 8 loaded. No slug mode. Muzzle cannot be modified.') }),
  weaponItem({ name: 'Rostovic DB-2 Satara', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic DB-2 Satara.png'),
    weapons: [
      sgSlug({ magazine: 2, tech: true, chargeType: 'keep' }),
      sgShell({ magazine: 2, tech: true, chargeType: 'keep' }),
    ],
    description: desc('Tech Weapon (KEEP charge). Charged Shot: ROF1, thin cover, ignores ½ SP.') }),
  weaponItem({ name: 'Techtronika VST-37 Pozhar', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_SHOTGUN, 'Techtronika VST-37 Pozhar.png'),
    weapons: [
      sgSlug({ magazine: 3, power: true }),
      sgShell({ magazine: 3 }),
    ],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Militech Crusher', manufacturer: 'Militech', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Militech Crusher.png'),
    weapons: [
      sgShell({ magazine: 12, power: true }),
    ],
    description: desc('Power Weapon. Shell-only — no slug mode.') }),
  weaponItem({ name: 'Constitutional Arms M2038 Tactician', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_SHOTGUN, 'Constitutional Arms M2038 Tactician.png'),
    weapons: [
      sgSlug({ magazine: 2, power: true }),
      sgShell({ magazine: 2 }),
    ],
    description: desc('Power Weapon. Armor Piercing: when this attack would ablate 1 SP, ablates 2 instead.') }),
  weaponItem({ name: 'Rostovic DB-2 Testera', manufacturer: 'Rostovic', cost: 'PR', imgPath: img(W_SHOTGUN, 'Rostovic DB-2 Testera.png'),
    weapons: [
      sgSlug({ damage: '5d6+3', magazine: 2, power: true }),
      sgShell({ magazine: 2, shellDvModifier: -1 }),
    ],
    description: desc('Power Weapon. Inaccurate: -1 to all attacks (apply manually). Shell mode DV = Attack-1.') }),
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
    description: desc('Power Weapon. Shell mode DV = Attack-1.') }),
  weaponItem({ name: 'Rostovic BT-1 Pelrun', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic BT-1 Perun.png'),
    weapons: [
      sgSlug({ magazine: 5, tech: true, chargeType: 'hold' }),
      sgShell({ magazine: 5, tech: true, chargeType: 'hold' }),
    ],
    description: desc('Tech Weapon (HOLD charge). Charged: ROF1, 3 rounds per attack, thin cover, ignores ½ SP. Charged shell mode: DV-5.') }),
  weaponItem({ name: 'Constitutional Arms Hurricane', manufacturer: 'Constitutional Arms', cost: 'LUX', minBody: 11, imgPath: img(W_SHOTGUN, 'Constitutional Arms Hurricane.png'),
    weapons: [
      sgSlug({ damage: '5d6', rateOfFire: 2, magazine: 16 }),
    ],
    description: desc('Heavy / Mounted: BODY 11+ or properly mounted. Heavy Reload: replacing the drum costs 2 actions. Cannot make aimed shots.') }),
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
    description: desc('Smart Weapon. Single Shot: 3d6, 2 rounds/atk; if insufficient → fires all remaining at 1d6. Autofire capped at ×2.') }),
  weaponItem({ name: 'KTech Terrier', manufacturer: 'KTech', cost: 'EX', imgPath: img(W_ROOT, 'KTech Terrier.png'),
    weapons: [smgAF()],
    description: desc('KTech Chomp ammo: sticks to target on hit (or autofire miss by ≤5); deals 1d6 to everyone within 2m of the target at the end of the user\'s next turn.') }),
  weaponItem({ name: 'Hansen Arms HA-4 Grit', manufacturer: 'Hansen Arms', cost: 'PR', imgPath: img(W_SMG, 'Hansen Arms HA-4 Grit.png'),
    weapons: [smgAF()],
    description: desc('Single shot fires a three-round burst dealing 3d6 (despite a 2d6 base). Charged (HOLD): next attack is ROF1 with thin cover and ignores ½ SP.') }),
  weaponItem({ name: 'Arasaka HJRE-9 Asuka', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_ROOT, 'Arasaka Asuka.png'),
    weapons: [smgAF({ power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Kang Tao S9 Daishi Tang', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_SMG, 'Kang Tao Daishi-Tang.png'),
    weapons: [smgAF({ smart: true })],
    description: desc('Smart Weapon. Single-shot rule: if attack die = 10 and the weapon has enough ammo, treat the shot as autofire instead.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   ASSAULT RIFLES
// ═══════════════════════════════════════════════════════════════════════════

const ars = [
  weaponItem({ name: 'Arasaka HJSH-18 Masamune', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_ROOT, 'Arasaka HJSH-18 Masamune.png'),
    weapons: [arAF({ excellent: true, power: true, autofireMultiplier: 3 })],
    description: desc('Excellent Quality + Power Weapon. Autofire capped at ×3.') }),
  weaponItem({ name: 'Tsunami Kyubi', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_AR, 'Tsunami Kyubi.png'),
    weapons: [arAF({ smart: true })],
    description: desc('Smart Weapon. Precise: when the attack die rolls a 1 on a single-shot, you may reroll once (must use the new result).') }),
  weaponItem({ name: 'Nokota D5 Sidewinder', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_ROOT, 'Nokota D5 Sidewinder.png'),
    weapons: [arAF({ smart: true })],
    description: desc('Smart Weapon. Repairs: lower repair cost by 1 price category.') }),
  weaponItem({ name: 'Arasaka Nowaki', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_AR, 'Arasaka Nowaki.png'),
    weapons: [arAF({ power: true })],
    description: desc('Power Weapon.') }),
  weaponItem({ name: 'Darra Polytechnic DA8 Umbra', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_ROOT, 'Darra Polytechnic DA8 Umbra.png'),
    weapons: [arAF({ power: true, jamOnRoll: 1, autofireMultiplier: 5 })],
    description: desc('Power Weapon, Cheap. Autofire capped at ×5.') }),
  weaponItem({ name: 'Militech Hercules 3AX', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech Hercules 3AX.png'),
    weapons: [arAF({ smart: true, payloadDmgBonus: 2 })],
    description: desc('Smart Weapon. Payload: toxic rounds piercing SP deal +2 damage.') }),
  weaponItem({ name: 'Militech M251s Ajax', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_AR, 'Militech M251s Ajax.png'),
    weapons: [arAF({ power: true })],
    description: desc('Power Weapon. Sturdy: 20 HP to break.') }),
  weaponItem({ name: 'Militech AR-9 Brunswick', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech AR-9 Brunswick.png'),
    weapons: [
      // Single shot: 4d6, 5 rounds/atk. Autofire: standard 2d6 ×4.
      arAF({ damage: '4d6', shots: 5, power: true }),
    ],
    description: desc('Power Weapon. Single shot: 4d6, 5 rounds/atk; if insufficient → fires all remaining at 3d6. Scatter: anything in 2m to either side of target takes ½ damage. Muzzle cannot be modified.') }),
  weaponItem({ name: 'Nokota D5 Copperhead', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_AR, 'Nokota D5 Copperhead.png'),
    weapons: [arAF({ power: true })],
    description: desc('Power Weapon. Repairs: lower repair cost by 1 price category.') }),
  weaponItem({ name: 'Techtronika AK-68 Vologda', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_AR, 'Techtronika AT-9 Vologda.png'),
    weapons: [
      // Single shot: 5d6, 5 rounds/atk. Magazine locked at 100. Autofire capped at ×5.
      arAF({ shots: 5, magazine: 100, power: true, autofireMultiplier: 5 }),
    ],
    description: desc('Power Weapon. Single shot: 5d6, 5 rounds/atk; if insufficient → fires all remaining at 3d6. Magazine cannot be modified. Autofire capped at ×5.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MACHINE GUNS
// ═══════════════════════════════════════════════════════════════════════════

const mgs = [
  weaponItem({ name: 'Tsunami RMS Helix', manufacturer: 'Tsunami Arms', cost: 'LUX', minBody: 11, imgPath: img(W_ROOT, 'Tsunami Heelilx.png'),
    weapons: [
      mgAF({ damage: '5d6', magazine: 40, autofireMultiplier: 4, autofireRangeTable: R.helixAF, rangeTable: R.helixAF, shots: 10 }),
    ],
    description: desc('Heavy Mounted weapon. Autofire-only, no single shot. Bandfed: extra 40-round bands cost €$50 each, added in sequence. BODY 11+ or properly mounted.') }),
  weaponItem({ name: 'Constitutional Arms M2067 Defender', manufacturer: 'Constitutional Arms', cost: 'VEX', minBody: 8, imgPath: img(W_ROOT, 'Constitutional Arms Defender.png'),
    weapons: [
      // Autofire deals 3d6 per hit (not the standard 2d6).
      mgAF({ power: true, autofireDamage: '3d6', autofireMultiplier: 3 }),
    ],
    description: desc('Power Weapon. Heavy Mounted weapon: BODY 8+. Autofire deals 3d6 per hit (not 2d6).') }),
  weaponItem({ name: 'Midnight Arms MA70 HB', manufacturer: 'Midnight Arms', cost: 'VEX', minBody: 8, imgPath: img(W_ROOT, 'Midnight Arms MA70 HB.png'),
    weapons: [mgAF({ power: true })],
    description: desc('Power Weapon. Heavy Mounted: BODY 8+. Concussive: explosive rounds deal +2 damage.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SNIPER RIFLES & PRECISION RIFLES
// ═══════════════════════════════════════════════════════════════════════════

const SR_BASE = { type: 'sniperRifle', damage: '5d6', rateOfFire: 1, magazine: 24, hands: 2, rangeTable: R.sr, shots: 1 };
const PR_BASE = { type: 'precisionRifle', damage: '5d6', rateOfFire: 1, magazine: 24, hands: 2, rangeTable: R.pr, shots: 1 };

const snipers = [
  weaponItem({ name: 'Tsunami Nekomata', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_SNIPER, 'Tsunami Nekomata.png'),
    weapons: [entry({ ...SR_BASE, tech: true, chargeType: 'keep' })],
    description: desc('Tech Weapon (KEEP charge). Charged Shot: ROF1, thin cover, ignores ½ SP.') }),
  weaponItem({ name: 'Nokota Osprey', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_ROOT, 'Nokota Osprey.png'),
    weapons: [
      entry({ ...SR_BASE, power: true }),
      entry({ ...SR_BASE, damage: '6d6', shots: 3, power: true }),
    ],
    description: desc('Power Weapon. Burn: incendiary rounds deal +2 damage past SP. Burst: 6d6, 3 rounds/atk; if insufficient → fires all remaining at 3d6.') }),
  weaponItem({ name: 'Techtronika SPT32 Grad', manufacturer: 'Techtronika', cost: 'VEX', imgPath: img(W_SNIPER, 'Techtronika SPT32 Grad.png'),
    weapons: [entry({ ...SR_BASE, magazine: 1, excellent: true, power: true })],
    description: desc('Excellent Quality + Power Weapon. Single-shot bolt-action.') }),
  weaponItem({ name: 'Tsunami Ashura', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_SNIPER, 'Tsunami Ashura.png'),
    weapons: [
      entry({ ...SR_BASE, magazine: 5, smart: true }),
      entry({ ...SR_BASE, damage: '4d6', magazine: 5, smart: true, payloadDmgBonus: 2 }),
    ],
    description: desc('Smart Weapon. Dart mode: silent smart dart, 4d6 + toxin payload. Replacement darts €$50 per 10.') }),

  weaponItem({ name: 'Rostovic Kolac', manufacturer: 'Rostovic', cost: 'EX', imgPath: img(W_ROOT, 'Rostovic Kolac.png'),
    weapons: [entry({ ...PR_BASE, damage: '6d6', power: true })],
    description: desc('Power Weapon. Heavy Recoil: a user with BODY < 8 takes 1d6 directly to HP when firing.') }),
  weaponItem({ name: 'Militech M-179 Achilles', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech M-179 Achilles.png'),
    weapons: [entry({ ...PR_BASE, tech: true, chargeType: 'hold' })],
    description: desc('Tech Weapon (HOLD charge). Charged Shot 3 (CS3): ROF1, 3 rounds per attack, thin cover, ignores ½ SP.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SPECIAL RANGED — RL, Stun, Flamethrowers
// ═══════════════════════════════════════════════════════════════════════════

const special = [
  weaponItem({ name: 'Arasaka Dojigiri Yasutsuna', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_ROOT, 'Arasaka Dojigiri Yasutsuna.png'),
    weapons: [entry({ type: 'rocketLauncher', damage: '10d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, smart: true, damageType: 'explosion', coneSpread: 4, coneHalfDamageDistance: 4 })],
    description: desc('Smart Weapon. Explosive 4/10m. Homing Guidance: ISA rockets are homing — when the only moving target is 50+m away vs unmoving background, a miss of ≤7 means the rocket guides itself onto the target.') }),
  weaponItem({ name: 'Kang Tao TKI-20 Mámù', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_ROOT, 'Kang Tao Mámù.png'),
    weapons: [entry({ type: 'mediumPistol', damage: '3d6', rateOfFire: 2, magazine: 12, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1 })],
    description: desc('Stun Gun. Shockwave: a standing target with BODY < 8 is pushed 2m away. Stun: target reduced to 0 HP becomes stable (criticals still trigger normally). Battery: no ammo slot — €$50 battery, 1h to recharge from empty.') }),
  weaponItem({ name: 'Sanroo Hotness', manufacturer: 'Sanroo', cost: 'EX', imgPath: img(W_ROOT, 'Sanroo hotness.png'),
    weapons: [entry({ type: 'flamethrower', damage: '4d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 4, coneAngle: 53, coneHalfDamageDistance: 6 })],
    description: desc('Flamethrower. Spray: liquid in 4/6m cone, DV15 RFLX+Evade; pass=2d6, fail=4d6. Ignores ½ SP. Tank: 15 HP; if destroyed by fire/thermal → 2/4m explosion 4d6. CHOOH² fuel deals +1 toxic damage.') }),
  weaponItem({ name: 'Militech IP-13 Provo', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech IP-13 Provo.png'),
    weapons: [entry({ type: 'flamethrower', damage: '4d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 4, coneAngle: 53, coneHalfDamageDistance: 6 })],
    description: desc('Flamethrower. Same baseline as Hotness; tank has 25 HP. CHOOH²: roll 1d10; if result > user\'s BODY → 1d6 directly to HP.') }),
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
    weapons: [lmw()],
    description: desc('Light Melee, throwable. Electric Charge (battery: 10 uses, 15 min to charge): a target taking any damage must DV15 TECH+Endurance or take 2d6 directly to HP. A direct hit on an uninsulated electrical device disables it.') }),
  weaponItem({ name: 'Militech M2 Combat Knife', manufacturer: 'Militech', cost: 'C', imgPath: img(W_MELEE, 'militech combat knife.png'),
    weapons: [lmw()],
    description: desc('Standard combat knife.') }),

  weaponItem({ name: 'Throwing Axe', manufacturer: 'Kaukaz', cost: 'CO', imgPath: img(W_MELEE, 'Kaukaz axe.png'),
    weapons: [mmw()],
    description: desc('Medium Melee, throwable (15/20m).') }),
  weaponItem({ name: 'Baseball Bat', manufacturer: '', cost: 'CO', imgPath: img(W_MELEE, 'Baseball bat.png'),
    weapons: [mmw()],
    description: desc('Blunt: cannot cause dismembering criticals. A would-be dismembering crit becomes the Broken version instead and deals +5 bonus damage.') }),

  weaponItem({ name: 'Kendachi Mono-Three', manufacturer: 'Kendachi', cost: 'LUX', imgPath: img(W_MELEE, 'Kendachi Mono-Three.png'),
    weapons: [hmw()],
    description: desc('Slicing: on Broken Arm/Leg, roll 1d6 — 2+ becomes Dismembered. Burning Edge: register biometrics (Action to activate); while active the blade ignores any SP below 11.') }),
  weaponItem({ name: 'Katana', manufacturer: '', cost: 'EX', imgPath: img(W_MELEE, 'Katana.png'),
    weapons: [hmw()],
    description: desc('Slicing: on Broken Arm/Leg, roll 1d6 — 2+ becomes Dismembered.') }),
  weaponItem({ name: 'Militech Stun Baton', manufacturer: 'Militech', cost: 'PR', imgPath: img(W_MELEE, 'Militech Stun Baton.png'),
    weapons: [hmw()],
    description: desc('Stun: when damage would reduce a target to 0 HP but no more than 10 past it, the target is left at 1 HP, stable and unconscious instead.') }),
  weaponItem({ name: 'Sledgehammer', manufacturer: 'Kaukaz', cost: 'PR', imgPath: img(W_MELEE, 'Kaukaz sledgehammer.png'),
    weapons: [hmw({ hands: 2 })],
    description: desc('Crushing: Collapsed Lung/Spinal Injury also causes Broken Ribs; would-be Broken Ribs also causes Collapsed Lung; any Critical Head Injury also causes Concussion; would-be Concussion also causes Cracked Skull.') }),

  weaponItem({ name: 'Budget Arms Cut-O-Matic', manufacturer: 'Budget Arms', cost: 'EX', imgPath: img(W_MELEE, 'Budget Arms Cut-o-Matic.png'),
    weapons: [vhmw()],
    description: desc('Vicious: while powered on, criticals deal +5 damage. Noisy: stealth impossible while on (toggle as part of another action — but not both same round). Unpowered: if off or out of CHOOH², deals only 3d6.') }),
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
