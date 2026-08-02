/**
 * Weapon catalogue — full Cyberpunk Blue weapon list, ready to drop into
 * the `cyberpunk-blue.weapons` compendium.
 *
 * Each entry returns Foundry Item create-data ready for `Item.createDocuments`.
 * The accompanying mod catalogue lives in `mod-catalogue.mjs`.
 *
 * Excluded by design (per memory/weapon-cards-excluded.md):
 *   - Arasaka Daikon NT Mantis Blades (cyberware, modeled separately)
 *
 * Previously excluded, now implemented from tmp/items-supplemental.md:
 *   - Arasaka Onibi Plasma Caster (flamethrower cone + self-cone malfunction)
 *   - Zetatech Microwaver-55 (affliction: disable random cyberware, bypasses armor)
 *   - Budget Arms Slaught-O-Matic (single-use SMG, noReload flag)
 *   - Kendachi Permanent Edge → a MOD (Phase 3), not a weapon
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
const W_HEAVY = `${ASSET_BASE}/Heavy Weapons`;
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
    // NB: the skill slug is 'hvyWeapons' (see config.mjs SKILLS / combat.mjs
    // defaultSkill). 'heavyWeapons' is not a real slug and made every heavy
    // weapon throw "Unknown skill slug" on attack.
    machineGun: 'hvyWeapons', precisionRifle: 'shoulderArms',
    sniperRifle: 'shoulderArms', grenadeLauncher: 'hvyWeapons',
    rocketLauncher: 'hvyWeapons', flamethrower: 'hvyWeapons',
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
    noReload: !!opts.noReload,
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
    selfConeMalfunction: !!opts.selfConeMalfunction,
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

// ─── Standardized firing-mode shorthands ──────────────────────────────────────

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
  weaponItem({ name: 'Techtronika RT-46 Burya', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_PISTOL, 'Techtronika-RT-46-Burya.png'),
    weapons: [entry({ ...VHP_BASE, damage: '4d6+2', tech: true, chargeType: 'keep' })],
    description: desc('<p>This is a Tech Weapon that keeps its charge once built up.</p><p><strong>CHARGED SHOT:</strong> A charged shot drops to ROF 1, but it sees through thin cover and ignores half of the target\'s SP. Firing it without Muscle and Bone Lace or a Cyberarm inflicts the Broken Arm critical injury on the shooter.</p><p><em>The Burya belongs in a museum as a benchmark for Soviet design. Is it pretty to look at? No. Convenient to use? Nope. Safe? Nuh-uh. But effective? Abso-fucking-lutely. The RT-46 is an electromag pistol that can blast through walls and is practically as dense as a neutron star. On top of that, it doesn\'t need to be charged &ndash; it can be fired at any time. To use it and survive, advanced musculoskeletal cyberware is advised. But even if someone without the recommended implants does manage to lift the Burya, pulling the trigger would almost guarantee a broken elbow... or worse.</em></p>') }),
  weaponItem({ name: 'Arasaka Tamayura', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_PISTOL, 'Arasaka-Tamayura.png'),
    weapons: [entry({ ...VHP_BASE, excellent: true, power: true })],
    description: desc('<p>This weapon is of Excellent Quality, granting <strong>+1</strong> to attacks, and it is a Power Weapon, which adds <strong>+5</strong> damage on a critical injury and allows ricochet shots at <strong>-4</strong>.</p><p><em>One of the oldest weapons made by Arasaka, dating from the early 2000s. These days it\'s a rare sight on the street, as it\'s a pistol that is &mdash; no point in sugarcoating it &mdash; outdated and difficult to maintain. Spare parts for it are no longer manufactured, and it\'s no longer compatible with most standard weapon mods. That being said, should it be held up to someone\'s head and have its trigger pulled, the end result will still be as conclusive as with any modern firearm.</em></p>') }),
  weaponItem({ name: 'Constitutional Arms Liberty', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Constitutional-Arms-Liberty.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 12, power: true, targetVitalsPenalty: 2, targetedShotDamageDice: '1d6' })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>TARGETED SHOT:</strong> You may take a <strong>-2</strong> penalty to the <strong>Handgun</strong> attack to target the vitals, dealing <strong>+1d6</strong> damage on a hit.</p><p><em>True amateur gearheads generally avoid automatic transmissions, claiming it takes away their control. The same goes for gun enthusiasts who think that modern pistols and rifles are too comfortable and convenient, not to mention target-tracing capabilities that mean any gonk can just pick up a gun and shoot on target.</em></p><p><em>The solution for purists and analog-minded gun owners is the Liberty from Constitutional Arms. Created at the dawn of the 21st century, this pistol was created with one main purpose in mind &ndash; to fire bullets. In the hands of an experienced shooter, it can be as lethal as the best Arasaka smartgun.</em></p>') }),
  weaponItem({ name: 'Techtronika Metel', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_PISTOL, 'Techtronika-Metel.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 8, power: true, jamOnRoll: 1, jamFiresFirst: false, shatteredProjectiles: true })],
    description: desc('<p>This is a Power Weapon of cheap make, so it jams whenever the attack die comes up 1.</p><p><strong>SHATTERED PROJECTILES:</strong> Roll damage even on a miss. If the total is greater than 15, the round shatters and deals <strong>2d6</strong> to everything within 2m of the target instead.</p><p><em>Cheap, ugly, but effective. If you\'re given a choice between a Metel and nothing at all, it may seem like a tough decision, but the Metel is the right call. It\'s most popular in slums and among those who put their faith in their skills, not their hardware. It can inflict some serious damage in the right hands, so if you like challenges and have a fondness for junk, this revolver from Techtronika is for you.</em></p>') }),
  weaponItem({ name: 'Malorian Overture', manufacturer: 'Malorian Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Malorian-Overture.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 6, power: true, targetVitalsPenalty: 4, targetedShotDamageDice: '2d6' })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>AIMED SHOT:</strong> You may take a <strong>-4</strong> penalty to the <strong>Handgun</strong> attack to target the vitals, dealing <strong>+2d6</strong> damage on a hit.</p><p><em>A .42 caliber, six-shot, semiautomatic, double-action, Power-class revolver crafted with the classic Malorian traits &ndash; heavy, reliable, and packed with firepower. Although Malorian has been faring worse on the market than its competitors in recent years, the Overture is still an iconic, high-quality weapon that can be found on the streets.</em></p>') }),
  weaponItem({ name: 'Tsunami Nue', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Tsunami-Nue.png'),
    weapons: [entry({ ...VHP_BASE, magazine: 8, power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><em>Tsunami Defense Systems is known best for its elite and dizzyingly expensive sniper rifles, but more of the Japanese company\'s products are beginning to gain traction on Night City\'s streets. Take their flagship pistol, the Nue, for example. Unlike the Ashura or Nekomata, the Nue\'s design is not founded on any bleeding-edge technologies. But what it lacks in innovation, it makes up for in workmanship. Elegant, reliable and deadly, the Nue is the unchallenged leader of the pistol market. The only debatable flaw is a size that can prove difficult to conceal. Still... who would ever want to hide such a masterpiece?</em></p>') }),

  // ── HP ──
  weaponItem({ name: 'Constitutional Arms Unity', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Constitutional-Arms-Unity.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, power: true, targetVitalsPenalty: 4, targetedShotDamageDice: '1d6' })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>AIMED SHOT:</strong> You may take a <strong>-4</strong> penalty to the <strong>Handgun</strong> attack to target the vitals, dealing <strong>+1d6</strong> damage on a hit.</p><p><em>Unity is often sought after, but difficult to achieve. After all, Night City is a city of individualists, anarchists and warring gangs. In order to unite under a shared banner, you\'ll need a persuasive argument &ndash; preferably cast from lead. The designers at Constitutional Arms responsible for the Unity understood this well. This universal, inexpensive pistol has resolved countless conflicts and put a stop to disputes. Dissatisfied customers, betrayed spouses, impatient drivers stuck in traffic &ndash; chances are they\'ll pull out a Unity. One well-aimed shot and you\'ve won the argument. Forever.</em></p>') }),
  weaponItem({ name: 'Militech M-10AF Lexington', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech-M-10AF-Lexington.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><em>The preferred pistol among Night City cops &ndash; light, wieldy and easy on the recoil, it\'s perfect for taking down enemies without necessarily killing them on the spot. Thanks to its relatively small dimensions, the gun has also found a loyal following among those who prefer a concealed carry: the Lexington easily fits in a coat pocket or purse. And for design lovers, its classic 2030s frame remains stunning as ever.</em></p>') }),
  weaponItem({ name: 'Militech M-76e Omaha', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech-M-76e-Omaha.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '2d6', chargeKeepsRof: true })],
    description: desc('<p>This is a Tech Weapon that must hold its charge to fire charged.</p><p><strong>CHARGED SHOT:</strong> Uniquely, this weapon keeps ROF 2 while charged rather than dropping to ROF 1, but it consumes 3 rounds per attack. The shot sees through thin cover and ignores half of the target\'s SP.</p><p><em>The Omaha looks like your classic lead-spitter, but don\'t let appearances fool you. This gem from Militech conceals its powerful electromag rail system, which launches solid-metal projectiles instead of firing ordinary pistol rounds. With each pull of the trigger, the Omaha quietly slings out three projectiles with tremendous force behind them. It\'s no wonder this firearm is commonly found in the holsters of corpos at the high end of the food chain. Its small size makes it a convenient fit in a briefcase or inside the company limo\'s glove compartment. And when the situation gets hot, the Omaha proves no less lethal than a heavy machine gun in the right hands.</em></p>') }),
  weaponItem({ name: 'Arasaka JKE-X2 Kenshin', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_PISTOL, 'Arasaka-JKE-X2-Kenshin.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, excellent: true, tech: true, chargeType: 'keep' })],
    description: desc('<p>This weapon is of Excellent Quality, granting <strong>+1</strong> to attacks, and it is a Tech Weapon that keeps its charge once built up.</p><p><strong>CHARGED SHOT:</strong> A charged shot drops to ROF 1, but it sees through thin cover and ignores half of the target\'s SP.</p><p><em>This simple, unpretentious pistol is the pride and joy of Arasaka engineers. Kenshin is one of the most cutting-edge &ndash; and deadliest &ndash; machine pistols available on the market.</em></p><p><em><strong>HARNESS THE POWER OF LIGHTNING.</strong> The Kenshin\'s brute power first comes from generating electromagnetic tension, before releasing a lethal, tungsten-tipped round that can penetrate the sturdiest armor. Like other guns of this class, it comes ready-equipped with a holographic scope.</em></p>') }),
  weaponItem({ name: 'Militech Ticon', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_PISTOL, 'Militech-Ticon.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '2d6' })],
    description: desc('<p>This is a Tech Weapon that must hold its charge to fire charged.</p><p><strong>CHARGED SHOT 3 (CS3):</strong> A charged shot drops to ROF 1 and consumes 3 rounds per attack. It sees through thin cover and ignores half of the target\'s SP.</p><p><em>Haters will say it looks antique; connoisseurs will claim it\'s a classic. Thanks to its simple construction, it rarely jams and is unlikely to fail you when you need it most. Its compact size guarantees it can remain hidden when tucked away behind your belt, which frankly makes it the ideal ally in heated arguments or when uninvited guests come knocking on your door. The best thing about it? It just works.</em></p>') }),
  weaponItem({ name: 'Darra Polytechnic DR-12 Quasar', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra-Polytechnic-DR-12-Quasar.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', jamOnRoll: 1, jamFiresFirst: false, cs3: true, cs3FallbackDamage: '2d6' })],
    description: desc('<p>This is a Tech Weapon of cheap make that must hold its charge to fire charged, so it jams whenever the attack die comes up 1.</p><p><strong>CHARGED SHOT 3 (CS3):</strong> A charged shot drops to ROF 1 and consumes 3 rounds per attack. It sees through thin cover and ignores half of the target\'s SP.</p><p><em>The Quasar is perhaps the most distinctive weapon you can find in Night City. It features an unusual, angular frame, a classic disc magazine and one-of-a-kind technology. After all, the Quasar is an electromagnetic gun. The barrel holds four electrically charged shafts, which, in combination with the bullet, form opposing electromagnetic poles. The resulting forces release the bullet &ndash; at lightning speed. A shot from the unassuming Quasar can even pierce armored vehicles and bulletproof vests.</em></p>') }),
  weaponItem({ name: 'Malorian Arms Sonnet', manufacturer: 'Malorian Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Malorian-Arms-Sonnet.png'),
    weapons: [
      entry({ ...HP_BASE, magazine: 12, smart: true }),
      entry({ type: 'heavyPistol', damage: '1d6', rateOfFire: 1, magazine: 2, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1, smart: true, isBeaconWeapon: true }),
    ],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>MODE 2 &mdash; TRACKER DART:</strong> The dart deals <strong>1d6</strong> and has an ammo capacity of 2. On a hit it applies a Beacon Tag to the target.</p><p><strong>ISA MODE:</strong> In mode 1, an attack that misses a Beacon Tagged target by 5 or less is automatically redirected into a hit.</p>') }),
  weaponItem({ name: 'Sanroo Hello Cutie+', manufacturer: 'Sanroo', cost: 'VEX', imgPath: img(W_PISTOL, 'Sanroo-Hello-Cutie.png'),
    weapons: [entry({ ...HP_BASE, magazine: 12, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '2d6', chargedAttackBonus: 2 })],
    description: desc('<p>This is a Tech Weapon that must hold its charge to fire charged.</p><p><strong>CHARGED SHOT 3 (CS3):</strong> A charged shot drops to ROF 1 and consumes 3 rounds per attack. It sees through thin cover and ignores half of the target\'s SP.</p><p><strong>STABILIZERS:</strong> The weapon grants <strong>+2</strong> to attacks while it is charged.</p>') }),

  // ── MP ──
  weaponItem({ name: 'Darra Polytechnic DR-5 Nova', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra-Polytechnic-DR-5-Nova.png'),
    weapons: [entry({ ...MP_BASE, magazine: 8, power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><em>The Nova is a traditional revolver that offers substantial firepower at a reasonable price. Its classic cylinder harkens back to the times of the Wild West. And while the Nova is prone to failure, it\'s also easy to fix thanks to its simple design and construction. It can be found in NCPD weapon lockers, in small-time corporate arsenals, tucked in the belts of gangoons and stowed in women\'s handbags. In other words, everyone uses it.</em></p>') }),
  weaponItem({ name: 'Tsunami Kappa', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_SMG, 'Tsunami-Kappa.png'),
    weapons: [entry({ ...MP_BASE, smart: true, doubleLock: true })],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>DOUBLE LOCK:</strong> You may spend 4 rounds of ammunition to make a single attack against 2 targets that are within 6m of each other. The muzzle cannot be modified.</p><p><em>Ready to change the landscape of smart weaponry, Tsunami Defense Systems crashed onto the scene with a force worthy of a, well... you know. But to compete with top competitors Arasaka and Kang Tao, you need a cutting-edge product. This is why Tsunami has poured tremendous resources into the AI-powered processors they use in their Kappa handgun. Tsunami\'s latest software update has brought the Kappa to the forefront of the smartgun debate. Add to that their strong reputation for quality craftsmanship, and you get a weapon that has raised eyebrows throughout the market &ndash; even if it hasn\'t dethroned the industry leaders just yet.</em></p>') }),
  weaponItem({ name: 'Darra Polytechnic DS-1 Tenebra', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_PISTOL, 'Darra-Polychenic-Tenebra.png'),
    weapons: [entry({ ...MP_BASE, silenceBuiltIn: true, silenceBuiltInDV: 8 })],
    description: desc('<p>This weapon is silenced by default. Hearing the shot requires an <strong>INT</strong>+<strong>Perception</strong> check against <strong style="color: var(--cpb-accent);">DV 8</strong>, and the <strong style="color: var(--cpb-accent);">DV</strong> rises by <strong>+1</strong> for every 4m of distance. The muzzle cannot be modified.</p>') }),
  weaponItem({ name: 'Tsunami Yanari', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(W_PISTOL, 'Tsunami-Yanari.png'),
    weapons: [entry({ ...MP_BASE, silenceBuiltIn: true, silenceBuiltInDV: 10, payloadDmgBonus: 2 })],
    description: desc('<p><strong>ACCURATE:</strong> This weapon grants <strong>+1</strong> to attacks.</p><p><strong>PAYLOAD:</strong> Toxic rounds deal <strong>+2</strong> damage if they pierce SP.</p><p>The weapon is silenced by default at <strong style="color: var(--cpb-accent);">DV 10</strong> to hear, and the muzzle cannot be modified.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SHOTGUNS
// ═══════════════════════════════════════════════════════════════════════════

const shotguns = [
  weaponItem({ name: 'Budget Arms Carnage', manufacturer: 'Budget Arms', cost: 'PR', minBody: 10, imgPath: img(W_SHOTGUN, 'Budget-Arms-Carnage.png'),
    weapons: [
      sgSlug({ magazine: 5, power: true, jamOnRoll: 1, jamFiresFirst: true, critOnBodyReq: 10 }),
      sgShell({ magazine: 5, jamOnRoll: 1, jamFiresFirst: true }),
    ],
    description: desc('<p>This is a Power Weapon of poor quality, so it jams whenever the attack die comes up 1 &mdash; though the shot still lands.</p><p><strong>UNWIELDY:</strong> A wielder needs <strong>BODY</strong> 10 or higher, or the attacker suffers the Torn Muscle critical injury.</p><p><em>There are weapons that are subtle, weapons that are elegant and weapons capable of hitting their targets with surgical precision. Budget Arms\' Carnage possesses none of those qualities. Its designers followed one simple rule: bigger is better. The result? The Carnage is massive, deals ridiculous amounts of damage and has a recoil that could pop your shoulder right out of its socket. Without the right cyberware, such as an endoskeleton or carbonweave muscle implants, you\'re better off choosing more conventional alternatives. It\'s worth remembering that the Carnage isn\'t a very reliable weapon &ndash; it likes to break, and what\'s more, it\'s not weighted properly. Then again, people who go for this kind of iron usually don\'t notice those little details.</em></p>') }),
  weaponItem({ name: 'Kang Tao L-69 Zhuo', manufacturer: 'Kang Tao', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Kang-Tao-L-69-Zhuo.png'),
    weapons: [
      sgShell({ damage: '4d6', magazine: 32, shots: 8, smart: true, minimumAmmoToFire: 8 }),
    ],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>SHELL-ONLY:</strong> The weapon fires <strong>4d6</strong> in an 8/8m cone and consumes 8 shells per attack. It will not fire with fewer than 8 shells loaded and has no slug mode. The muzzle cannot be modified.</p><p><em>Shotguns aren\'t exactly known for finesse: while undoubtedly powerful, they often suffer from clunkiness and imprecision. That is, except for the L-69 Zhuo by Kang Tao. Just like the other weapons manufactured by the Chinese corp, the L-69 Zhuo comes packed with top-of-the-line electronics. The ultra-sensitive radar scans the area for you, identifying targets all on its own. And one of the eight bullets in the below-barrel magazine is always ready and waiting to tear someone to shreds.</em></p>') }),
  weaponItem({ name: 'Rostovic DB-2 Satara', manufacturer: 'Rostović', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic-DB-2-Satara.png'),
    weapons: [
      sgSlug({ magazine: 2, tech: true, chargeType: 'keep' }),
      sgShell({ magazine: 2, tech: true, chargeType: 'keep' }),
    ],
    description: desc('<p>This is a Tech Weapon that keeps its charge once built up.</p><p><strong>CHARGED SHOT:</strong> A charged shot drops to ROF 1, but it sees through thin cover and ignores half of the target\'s SP.</p><p><em>The Satara is an unusual breed both because of its bizarre appearance and its unconventional technological foundation. Instead of firing ordinary buckshot, this electromag shotgun launches small, razor-sharp steel spikes. Critics argue the Satara\'s heaviness and bulkiness make it unreasonably inconvenient for practical use. Its advocates, however, point out that the Serbian shotgun is undeterred by walls. MaxTac officers belong to the latter group. After many trials in the field, the Satara has proved consistently effective at bringing down even the most heavily chromed cyberpsychos.</em></p>') }),
  weaponItem({ name: 'Techtronika VST-37 Pozhar', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_SHOTGUN, 'Techtronika-VST-37-Pozhar.png'),
    weapons: [
      sgSlug({ magazine: 3, power: true }),
      sgShell({ magazine: 3 }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><em>The engineers at Soviet arms giant Techtronika are driven by two core metrics: firepower and reliability. A simple design means fewer opportunities for breakage or jamming. And when you\'re fighting a heavily modified adversary, you need those high-caliber rounds to strike true &ndash; without risk of failure. Although Techtronika has not altered the Pozhar\'s design for decades, their sales have scarcely dipped. In fact, it has long remained a favorite among MaxTac\'s elite forces, which should say more about its merits than any ad campaign or user review ever could. The only knocks against this weapon are its relatively poor ergonomic design and extremely powerful kick. No matter your experience level, consider investing in cyberware to absorb the recoil. Techtronika will not be held liable for a user\'s shattered bones.</em></p>') }),
  weaponItem({ name: 'Arasaka Akumu Mk.II', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Arasaka-Akumu-Mk.II.png'),
    weapons: [
      sgSlug({ damage: '5d6', magazine: 25, smart: true, excellent: true }),
      sgShell({ magazine: 25, smart: true, excellent: true }),
      entry({ type: 'grenadeLauncher', damage: '6d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, excellent: true, damageType: 'explosion', coneSpread: 10, coneAngle: 360, coneHalfDamageDistance: 4 }),
    ],
    description: desc('<p>This is a Smart Weapon of Excellent Quality, granting <strong>+1</strong> to every attack it makes &mdash; slug, shell, and grenade alike. It can use Smart ammunition.</p><p><strong>SLUG:</strong> The slug mode deals <strong>5d6</strong> and holds 25 rounds.</p><p><strong>SHELL:</strong> The shell mode deals <strong>3d6</strong> in an 8/8m cone, exactly as the Techtronika VST-37 Pozhar does.</p><p><strong>UNDER-BARREL GRENADE LAUNCHER:</strong> The launcher holds 1 round and fires a fragmentation grenade for a <strong>6d6</strong> explosion with a 4m inner and 10m outer sphere.</p>') }),
  weaponItem({ name: 'Militech Crusher', manufacturer: 'Militech', cost: 'VEX', imgPath: img(W_SHOTGUN, 'Militech-Crusher.png'),
    weapons: [
      sgShell({ magazine: 12, power: true }),
    ],
    description: desc('<p>This is a Power Weapon. It fires shells only and has no slug mode.</p><p><em>The very sight of the Militech Crusher is enough to bring a tear to any gun lover\'s eye. This powerful shotgun, designed for short-range combat, was first created in the year 2020, soon becoming one of the period\'s most iconic weapons. The version currently available on the market has seen some updates from the original &mdash; including a new, modern sight &mdash; but its distinctive look remains the same. Once standard-issue among corporate guards, today the Crusher is more popular among mercs with a nostalgic streak.</em></p>') }),
  weaponItem({ name: 'Constitutional Arms M2038 Tactician', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(W_SHOTGUN, 'Constitutional-Arms-M2038-Tactician.png'),
    weapons: [
      sgSlug({ magazine: 2, power: true, armorPiercing: true }),
      sgShell({ magazine: 2 }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><strong>ARMOR PIERCING:</strong> Whenever an attack from this weapon would ablate 1 SP, it ablates 2 instead.</p><p><em>You\'ll meet plenty of these in Night City. Chances are even your next-door neighbor keeps one under their couch just in case. In spite of its age, it\'s still used by the NCPD, as well as a number of gangs. It\'s not hard to see why the Tactician is so widely admired. It\'s a cheap, simple and user-friendly weapon that can also deal an impressive amount of damage. Additional features? None. Sometimes simpler is better. Why have tagliatelle alla truffe when you can have mac \'n\' cheese?</em></p>') }),
  weaponItem({ name: 'Rostovic DB-2 Testera', manufacturer: 'Rostović', cost: 'PR', imgPath: img(W_SHOTGUN, 'Rostovic-DB-2-Testera.png'),
    weapons: [
      sgSlug({ damage: '5d6+3', magazine: 2, power: true }),
      sgShell({ magazine: 2, shellDvModifier: -1 }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><strong>INACCURATE:</strong> The weapon takes <strong>-1</strong> to all attacks, which must be applied manually. In shell mode the <strong style="color: var(--cpb-accent);">DV</strong> equals the attack <strong style="color: var(--cpb-accent);">DV</strong> minus 1.</p><p><em>The Testera is an improved version of the Igla, a shotgun that has a target market of combat forces on a budget. This Rostović product has only one function: it goes boom. Boom each barrel at a time or both together. Sometimes a powerful blast of simplicity is all you need in a narrow alley or hallway. Don\'t stress about aiming when the Testera\'s wide spread is there to guarantee you a hit.</em></p>') }),
  weaponItem({ name: 'Rostovic DB-4 Palica', manufacturer: 'Rostović', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic-DB-4-Palica.png'),
    weapons: [
      sgSlug({ magazine: 3, smart: true }),
    ],
    description: desc('<p>This is a Smart Weapon. It fires slugs only and has no shell mode.</p><p><em>The minds at Serbia-based Rostović set out to prove that "smart" doesn\'t have to mean "expensive." The fruit of their endeavor is the Palica, based on their time-tested Igla model. Was the experiment a success? Opinions are divided. The Palica\'s price is certainly lower than the competition, but its craftsmanship matches the price. This shotgun possesses the basic functionality of a Smart-class shotgun, but it\'s not worth the breath required to compare it to Arasaka or Tsunami weapons. Still, for those whose wallets are already squeezed, the Palica really is the "smart" choice.</em></p>') }),
  weaponItem({ name: 'Rostovic DB-4 Igla', manufacturer: 'Rostović', cost: 'PR', imgPath: img(W_SHOTGUN, 'Rostovic-DB-4-Igla.png'),
    weapons: [
      sgSlug({ magazine: 2, power: true }),
      sgShell({ magazine: 2, shellDvModifier: -1 }),
    ],
    description: desc('<p>This is a Power Weapon. In shell mode the <strong style="color: var(--cpb-accent);">DV</strong> equals the attack <strong style="color: var(--cpb-accent);">DV</strong> minus 1.</p><p><em>Fun fact: the Igla was conceived at the beginning of the 21st century as a hunting weapon. Specifically, it was engineered to hunt ducks (medium-sized waterfowl, somewhat similar to seagulls, now considered extinct). The Igla may have fared well against the ducks of Serbia\'s swamplands, but in 2077\'s Night City, this shotgun is considered an antique that not even the city\'s poor and desperate are willing to resort to. Many complain that it produces more noise than damage.</em></p>') }),
  weaponItem({ name: 'Rostovic BT-1 Pelrun', manufacturer: 'Rostović', cost: 'EX', imgPath: img(W_SHOTGUN, 'Rostovic-BT-1-Perun.png'),
    weapons: [
      sgSlug({ magazine: 5, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '4d6' }),
      sgShell({ magazine: 5, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '3d6' }),
    ],
    description: desc('<p>This is a Tech Weapon that must hold its charge to fire charged.</p><p><strong>CHARGED SHOT:</strong> A charged shot drops to ROF 1 and consumes 3 rounds per attack. It sees through thin cover and ignores half of the target\'s SP.</p><p><strong>CHARGED SHELL MODE:</strong> Firing shells while charged lowers the <strong style="color: var(--cpb-accent);">DV</strong> by 5.</p>') }),
  weaponItem({ name: 'Constitutional Arms Hurricane', manufacturer: 'Constitutional Arms', cost: 'LUX', minBody: 11, imgPath: img(W_SHOTGUN, 'Constitutional-Arms-Hurricane.png'),
    weapons: [
      sgSlug({ damage: '5d6', rateOfFire: 2, magazine: 16 }),
    ],
    description: desc('<p><strong>HEAVY / MOUNTED:</strong> A wielder needs <strong>BODY</strong> 11 or higher, or the weapon must be properly mounted.</p><p><strong>HEAVY RELOAD:</strong> Replacing the drum costs 2 actions, and the weapon cannot make aimed shots.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SMGs
// ═══════════════════════════════════════════════════════════════════════════

const smgs = [
  weaponItem({ name: 'Arasaka HJKE-11 Yukimura', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_SMG, 'Arasaka-HJKE-11-Yukimura.png'),
    weapons: [smgAF({ smart: true })],
    description: desc('<p>This is a Smart Weapon.</p><p><em>Back in the day, soldiers had to go through weeks of combat training. Crazy, right? Nowadays, Smart guns can automatically lock onto targets and fire homing rounds &ndash; all you need are the right implants. It was a pistol that started the smart revolution &ndash; the Yukimura, issued in the 2040s by Arasaka. With the Yukimura, you could shoot as poorly as the robots in a certain late 20th-century epic space opera and still hit your target with 100% accuracy. Even now, over thirty years later, the Yukimura is still considered one of the best handguns ever made. It boasts two firing modes &ndash; automatic and three-round burst &ndash; that allow its users to adapt to the situation, as well as an ample magazine for prolonged firefights.</em></p>') }),
  weaponItem({ name: 'Kang Tao A-22B Chao', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_SMG, 'Kang-Tao-A-22B-Chao.png'),
    weapons: [
      // Single shot: 3d6, uses 2 rounds. Autofire capped at ×2.
      smgAF({ shots: 2, smart: true, autofireMultiplier: 2 }),
    ],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>SINGLE SHOT:</strong> A single shot deals <strong>3d6</strong> and consumes 2 rounds per attack. If there is not enough ammunition left, the weapon fires everything remaining for <strong>1d6</strong> instead. <strong>Autofire</strong> is capped at &times;2.</p><p><em>The smartgun market used to be an Arasaka-only affair. But that all changed when Kang Tao stepped in. The A-22B Chao is the Chinese answer to Arasaka\'s Yukimura. As the gossip goes, both guns may have been designed by the same engineer, extracted from the Japanese corp on Kang Tao\'s orders. Whatever the case may be, you can be sure the A-22B Chao is easy to use and reload; once the last cartridge is used, the empty magazine is automatically discharged. Easy to use, practical... unless the empty mag hits an unsuspecting shooter in the foot, that is.</em></p>') }),
  weaponItem({ name: 'KTech Terrier', manufacturer: 'KTech', cost: 'EX', imgPath: img(W_ROOT, 'KTech-Terrier.png'),
    weapons: [smgAF({ chompAmmo: true })],
    description: desc('<p><strong>KTECH CHOMP AMMO:</strong> The round sticks to the target on a hit, or on an autofire attack that misses by 5 or less. At the end of the user\'s next turn it detonates, dealing <strong>1d6</strong> to everyone within 2m of the target.</p>') }),
  weaponItem({ name: 'Hansen Arms HA-4 Grit', manufacturer: 'Hansen Arms', cost: 'PR', imgPath: img(W_SMG, 'Hansen-Arms-HA-4-Grit.png'),
    weapons: [smgAF()],
    description: desc('<p>A single shot fires a three-round burst that deals <strong>3d6</strong>, despite the weapon\'s <strong>2d6</strong> base damage.</p><p><strong>CHARGED SHOT:</strong> This is a Tech Weapon that must hold its charge. The next attack after charging drops to ROF 1, sees through thin cover, and ignores half of the target\'s SP.</p><p><em>Produced from an amalgamation of various Militech weapon parts by Hansen Armory. The ideal compromise between quality and price &mdash; a weapon that won\'t fail during a firefight, nor drain your wallet.</em></p><p><em>Its short, compact barrel allows you to fire a quick and deadly salvo from the hip, while the long magazine lends the gun a balanced feel. With the HA-4 Grit, you can confidently leap into action.</em></p>') }),
  weaponItem({ name: 'Arasaka HJRE-9 Asuka', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_ROOT, 'Arasaka-Asuka.png'),
    weapons: [smgAF({ power: true })],
    description: desc('<p>This is a Power Weapon.</p>') }),
  weaponItem({ name: 'Kang Tao S9 Daishi Tang', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_SMG, 'Kang-Tao-Daishi-Tang.png'),
    weapons: [smgAF({ smart: true, autoFireOn10: true })],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>SINGLE-SHOT RULE:</strong> If the attack die comes up 10 and the weapon has enough ammunition, the shot is treated as autofire instead.</p>') }),
  weaponItem({ name: 'Budget Arms Slaught-O-Matic', manufacturer: 'Budget Arms', cost: 'CH', imgPath: img(W_SMG, 'Budget-Arms-Slaught-O-Matic.png'),
    weapons: [smgAF({ damage: '2d6', shots: 1, jamOnRoll: 1, noReload: true })],
    description: desc('<p>This is an extremely cheap SMG sold from vending machines. Being cheap, it jams whenever the attack die comes up 1. Its autofire multiplier is &times;3.</p><p><strong>FUSED MAGAZINE:</strong> The weapon is single-use and cannot be reloaded &mdash; once emptied, its components melt together.</p><p><em>Night Citizens disagree on a lot, but there\'s one common platform they share: a gun should be available for everyone, no matter the thickness of their wallet, their age, their criminal history, the time of day and, most importantly, no questions asked.</em></p><p><em>The Slaught-O-Matic is a real-life manifestation of that philosophy (if you can call it that). You can buy this single-use pistol from most vending machines for a price not much higher than a can of NiCola. At first glance, you can clearly see why. It\'s made from the cheapest plastic, liable to not only melt if left out in the sun, but also prone to jamming, breaking, and snapping inexperienced wrists with its high recoil. Still, a gun\'s primary purpose is to kill, and that\'s what it does. But when you\'ve fired the last round, don\'t bother reloading. Just toss it in the trash and buy a new one.</em></p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   ASSAULT RIFLES
// ═══════════════════════════════════════════════════════════════════════════

const ars = [
  weaponItem({ name: 'Arasaka HJSH-18 Masamune', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_ROOT, 'Arasaka-HJSH-18-Masamune.png'),
    weapons: [arAF({ excellent: true, power: true, autofireMultiplier: 3 })],
    description: desc('<p>This weapon is of Excellent Quality, granting <strong>+1</strong> to attacks, and it is a Power Weapon. Its <strong>Autofire</strong> is capped at &times;3.</p><p><em>The Masamune is not just a rifle but a work of fine art. Designed in the \'50s and manufactured from the best, most resilient materials, the Masamune is great for all conditions, while also being surprisingly light. Every single one of the Masamune\'s elements, down to the tiniest screws and bolts, was quality-ensured by a legion of Arasaka engineers &ndash; and you can feel it. Not only is it light to handle, but it\'s intuitive to use &ndash; even for first-time users. And to top it all off, it comes with state-of-the-art software, holographic sights and a three-round burst mode.</em></p>') }),
  weaponItem({ name: 'Tsunami Kyubi', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_AR, 'Tsunami-Kyubi.png'),
    weapons: [arAF({ smart: true })],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>PRECISE:</strong> When the attack die comes up 1 on a single shot, you may reroll it once. The new result must be used.</p><p><em>The name of this semi-automatic rifle refers to the nine-tailed fox of myth. No, the Kyubi doesn\'t have nine barrels, but with the way it rains bullets on your enemies, you wouldn\'t know. Tsunami Defense Systems strives for quality craftsmanship and unparalleled optics in all of its weapons. The Kyubi is no exception. Its factory-issue laser sight allows for precise marksmanship right out of the box. And while some scoff at the plastic casing, Tsunami\'s engineers stand by the design. They aren\'t cutting corners to save money &ndash; they\'re delivering one of the lightest, yet most reliable and powerful rifles on the market.</em></p>') }),
  weaponItem({ name: 'Nokota D5 Sidewinder', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_ROOT, 'Nokota-D5-Sidewinder.png'),
    weapons: [arAF({ smart: true })],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>REPAIRS:</strong> Repairing this weapon costs one price category less than normal.</p><p><em>The Sidewinder is the younger &ndash; but wiser &ndash; brother to the Copperhead. Based on the same frame, Nokota engineers finally crafted their own Smart-class rifle. But to say this gun is truly "smart" is a certain overreach. The Sidewinder doesn\'t try to hide what it is, and it\'s clear it can\'t stand toe to toe with its counterparts from Arasaka, Militech and Kang Tao. Yes, it offers aim-assist; yes, it aids in battlefield orientation; but anyone who\'s ever wielded a true top-shelf smart rifle can tell you the difference in quality is obvious. Still, despite its competitive shortcomings, the Sidewinder and its approachable price tag have chiseled out a stable niche for Nokota in the smart weaponry market.</em></p>') }),
  weaponItem({ name: 'Arasaka Nowaki', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_AR, 'Arasaka-Nowaki.png'),
    weapons: [arAF({ power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><em>This classic rifle, manufactured at the dawn of the 21st century, possesses a unique shape, design and color scheme that delivers one clear message to enemy targets and competitive rivals alike: I am Death incarnate. With its sharp angles, raw steel build and a trigger that just begs to be pulled, one look at it is often enough to send streetpunks running scared from Arasaka\'s agents (as if they didn\'t already have a good reason). Even today, more than a half-century after its conception, this rifle commands respect on the battlefield and on the city streets. Of course, flashier weapons with new features and higher rates of fire have been invented in that time, but, in skilled hands, the Nowaki remains a dominant force to be reckoned with.</em></p>') }),
  weaponItem({ name: 'Darra Polytechnic DA8 Umbra', manufacturer: 'Darra Polytechnic', cost: 'PR', imgPath: img(W_ROOT, 'Darra-Polytechnic-DA8-Umbra.png'),
    weapons: [arAF({ power: true, jamOnRoll: 1, autofireMultiplier: 5 })],
    description: desc('<p>This is a Power Weapon of cheap make, so it jams whenever the attack die comes up 1. Its <strong>Autofire</strong> is capped at &times;5.</p><p><em>Some things in Night City come ridiculously cheap &ndash; a bottle of booze, human life or the Umbra from Darra Polytechnic. Now, some might claim this India-manufactured Power AR is an unwieldy hunk of low-grade alloy that wouldn\'t last five minutes in a real Friday night firefight. Those people would be right. However, despite its drawbacks, the Umbra is growing in popularity &ndash; you can empty a few clips into a choom, then toss it in the sewer without a second thought.</em></p>') }),
  weaponItem({ name: 'Militech Hercules 3AX', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech-Hercules-3AX.png'),
    weapons: [arAF({ smart: true, payloadDmgBonus: 2 })],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>PAYLOAD:</strong> Toxic rounds that pierce SP deal <strong>+2</strong> damage.</p><p><em>A prototype model based on one of Militech\'s smart automatic rifles. What more could you want from a weapon spitting homing rounds without needing a Smart Link? Poison rounds, obviously. To turn an enemy into Swiss cheese is child\'s play, but to turn them into a bullet-ridden, steaming pile of liquefied remains... that\'s a job for the Hercules 3AX. 10/10 for style, 2/10 for eco-friendliness.</em></p>') }),
  weaponItem({ name: 'Militech M251s Ajax', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_AR, 'Militech-M251s-Ajax.png'),
    weapons: [arAF({ power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>STURDY:</strong> The weapon has 20 HP and must be reduced to 0 to break.</p><p><em>In less turbulent times, the name Ajax would more likely be associated with the Greek hero of legend, a European soccer club or a household cleaning product. For the residents of Night City, Ajax brings to mind only one thing: Militech\'s assault rifle. Its engineers made no attempt to reinvent the wheel, but only to design a durable, reliable weapon that wouldn\'t require months of training or high-end combat cyberware to use. Ultimately, the engineers\' vision has been realized. Their creation has become the assault rifle of choice for soldiers across the globe.</em></p>') }),
  weaponItem({ name: 'Militech AR-9 Brunswick', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech-AR-9-Brunswick.png'),
    weapons: [
      // Single shot: 4d6, 5 rounds/atk. Autofire: standard 2d6 ×4.
      arAF({ damage: '4d6', shots: 5, power: true, scatter: true, shortAmmoFallbackDamage: '3d6' }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><strong>SINGLE SHOT:</strong> A single shot deals <strong>4d6</strong> and consumes 5 rounds per attack. If there is not enough ammunition left, the weapon fires everything remaining for <strong>3d6</strong> instead.</p><p><strong>SCATTER:</strong> Anything within 2m to either side of the target takes half damage. The muzzle cannot be modified.</p>') }),
  weaponItem({ name: 'Nokota D5 Copperhead', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_AR, 'Nokota-D5-Copperhead.png'),
    weapons: [arAF({ power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>REPAIRS:</strong> Repairing this weapon costs one price category less than normal.</p><p><em>Once upon a time, in the second half of the 20th century, the world\'s most popular assault rifle was the AK-47 &ndash; also commonly known as the Kalashnikov, in honor of its inventor. Today, these rifles can only be found in museums, as their market niche was replaced by the Nokota Copperhead. This mass-produced assault rifle sticks to the basics of functionality and reliability. There\'s no finesse or ingenuity to fall in love with, but many people find its dependable stopping power an endearing trait.</em></p>') }),
  weaponItem({ name: 'Techtronika AK-68 Vologda', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(W_AR, 'Techtronika-AT-9-Vologda.png'),
    weapons: [
      // Single shot: 5d6, 5 rounds/atk. Magazine locked at 100. Autofire capped at ×5.
      arAF({ shots: 5, magazine: 100, power: true, autofireMultiplier: 5 }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><strong>SINGLE SHOT:</strong> A single shot deals <strong>5d6</strong> and consumes 5 rounds per attack. If there is not enough ammunition left, the weapon fires everything remaining for <strong>3d6</strong> instead. The magazine cannot be modified, and <strong>Autofire</strong> is capped at &times;5.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MACHINE GUNS
// ═══════════════════════════════════════════════════════════════════════════

const mgs = [
  weaponItem({ name: 'Tsunami RMS Helix', manufacturer: 'Tsunami Arms', cost: 'LUX', minBody: 11, imgPath: img(W_ROOT, 'Tsunami-Heelilx.png'),
    weapons: [
      mgAF({ damage: '5d6', magazine: 40, autofireMultiplier: 4, autofireRangeTable: R.helixAF, rangeTable: R.helixAF, shots: 10 }),
    ],
    description: desc('<p>This is a heavy mounted weapon that fires on <strong>Autofire</strong> only and has no single-shot mode.</p><p><strong>BAND-FED:</strong> Extra 40-round bands cost &euro;$50 each and are added in sequence.</p><p><strong>HEAVY / MOUNTED:</strong> A wielder needs <strong>BODY</strong> 11 or higher, or the weapon must be properly mounted.</p>') }),
  weaponItem({ name: 'Constitutional Arms M2067 Defender', manufacturer: 'Constitutional Arms', cost: 'VEX', minBody: 8, imgPath: img(W_ROOT, 'Constitutional-Arms-Defender.png'),
    weapons: [
      // Autofire deals 3d6 per hit (not the standard 2d6).
      mgAF({ power: true, autofireDamage: '3d6', autofireMultiplier: 3 }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><strong>HEAVY MOUNTED WEAPON:</strong> A wielder needs <strong>BODY</strong> 8 or higher. Its <strong>Autofire</strong> deals <strong>3d6</strong> per hit rather than <strong>2d6</strong>.</p><p><em>Sometimes all you need is a warning shot to scare off your attacker, but if that doesn\'t work, you\'ll need something more convincing. The M2067 Defender from Constitutional Arms will almost certainly do the trick. This light machine gun was designed for all the righteous, upstanding citizens living in dangerous neighborhoods. With a remarkably high firing rate, large magazine and automatic reload, in the right conditions someone holding one of these could take out a whole army. Of course, these characteristics make it popular among gangers &ndash; the very same people this gun was designed to protect against...</em></p>') }),
  weaponItem({ name: 'Midnight Arms MA70 HB', manufacturer: 'Midnight Arms', cost: 'VEX', minBody: 8, imgPath: img(W_ROOT, 'Midnight-Arms-MA70-HB.png'),
    weapons: [mgAF({ power: true })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>HEAVY MOUNTED:</strong> A wielder needs <strong>BODY</strong> 8 or higher.</p><p><strong>CONCUSSIVE:</strong> Explosive rounds deal <strong>+2</strong> damage.</p><p><em>Midnight Arms\' light machine gun is "light" in name only. The MA70 HB is a bona fide steel cannon for your personal arsenal. This American manufacturer built its reputation on supplying police departments and security agencies. While their designs aren\'t always the sleekest, they are undeniably solid and available at reasonable prices. Should you dare to shoulder their behemoth LMG, the MA70 HB, it\'s wise to first install cyberware to reinforce your upper body and spine. Wielding such a formidable weapon without the proper structural precautions will likely mean a trip to the ripperdoc for both you and your target. But if it\'s any consolation, your target will have to be taken there in a bucket.</em></p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SNIPER RIFLES & PRECISION RIFLES
// ═══════════════════════════════════════════════════════════════════════════

const SR_BASE = { type: 'sniperRifle', damage: '5d6', rateOfFire: 1, magazine: 24, hands: 2, rangeTable: R.sr, shots: 1 };
const PR_BASE = { type: 'precisionRifle', damage: '5d6', rateOfFire: 1, magazine: 24, hands: 2, rangeTable: R.pr, shots: 1 };

const snipers = [
  weaponItem({ name: 'Tsunami Nekomata', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_SNIPER, 'Tsunami-Nekomata.png'),
    weapons: [entry({ ...SR_BASE, tech: true, chargeType: 'keep' })],
    description: desc('<p>This is a Tech Weapon that keeps its charge once built up.</p><p><strong>CHARGED SHOT:</strong> A charged shot drops to ROF 1, but it sees through thin cover and ignores half of the target\'s SP.</p><p><em>The Nekomata is a demanding weapon. It requires care, regular service and time to learn how best to use it. But it\'s worth it. Really, really worth it. This electromag sniper rifle is a technological marvel. The tungsten spike it launches can pierce the thickest armor and walls, and shatter titanium bones. No one is safe from the Nekomata\'s destructive force, which is why the sale of this rifle is strictly regulated. It\'s almost impossible for mercenaries outside the employ of a government or major megacorp to get their hands on one... almost.</em></p>') }),
  weaponItem({ name: 'Nokota Osprey', manufacturer: 'Nokota', cost: 'EX', imgPath: img(W_ROOT, 'Nokota-Osprey.png'),
    weapons: [
      entry({ ...SR_BASE, power: true }),
      entry({ ...SR_BASE, damage: '6d6', shots: 3, power: true, shortAmmoFallbackDamage: '3d6' }),
    ],
    description: desc('<p>This is a Power Weapon.</p><p><strong>BURN:</strong> Incendiary rounds deal <strong>+2</strong> damage past SP.</p><p><strong>BURST:</strong> A burst deals <strong>6d6</strong> and consumes 3 rounds per attack. If there is not enough ammunition left, the weapon fires everything remaining for <strong>3d6</strong> instead.</p><p><em>A large-caliber, well-balanced rifle coveted by pros and wannabes alike. This hardware sells for top-shelf prices, but because it\'s a weapon of choice within multiple agencies, there\'s little doubt it\'s worth every enny. Once you get your hands on one, everything else will feel like clunky scrap metal by comparison.</em></p>') }),
  weaponItem({ name: 'Techtronika SPT32 Grad', manufacturer: 'Techtronika', cost: 'VEX', imgPath: img(W_SNIPER, 'Techtronika-SPT32-Grad.png'),
    weapons: [entry({ ...SR_BASE, magazine: 1, excellent: true, power: true })],
    description: desc('<p>This weapon is of Excellent Quality, granting <strong>+1</strong> to attacks, and it is a Power Weapon. It is single-shot bolt-action.</p><p><em>Around the turn of the 21st century, the arms industry faced a pressing challenge. Many popular sniper rifles were increasingly proving ineffective against people heavily modified with cyberware. A shot that would once kill an ordinary person now only makes a dent. The world required a new generation of sniper rifles. The first of this new wave was the Soviet-made SPT32 Grad, considered by many to be the most powerful sniper on the market. It may not possess the same dedication to detail as its counterparts from Arasaka or Militech, but in the hands of a well-trained sharpshooter who doesn\'t rely on weapon-assisted wind readings, the Grad is a truly devastating force. No wall will stop it from hitting its target.</em></p>') }),
  weaponItem({ name: 'Tsunami Ashura', manufacturer: 'Tsunami Arms', cost: 'VEX', imgPath: img(W_SNIPER, 'Tsunami-Ashura.png'),
    weapons: [
      entry({ ...SR_BASE, magazine: 5, smart: true }),
      entry({ ...SR_BASE, damage: '4d6', magazine: 5, smart: true, payloadDmgBonus: 2, silenceBuiltIn: true, silenceBuiltInDV: 10 }),
    ],
    description: desc('<p>This is a Smart Weapon.</p><p><strong>DART MODE:</strong> The silent smart dart requires <strong style="color: var(--cpb-accent);">DV 10</strong> to hear. It deals <strong>4d6</strong> plus a toxin payload worth <strong>+2</strong> damage on penetration. Replacement darts cost &euro;$50 per 10.</p><p><em>In the good old days, to be a sniper meant being an elite sharpshooter, the best of the best, with eagle eyes, nerves of steel and iron asses. To ensure their one and only shot didn\'t sail by the target, they had to consider dozens of factors that could affect the bullet\'s path. Today, anyone who has the right cyberware and a padded bank account can be a deadeye marksman. This Tsunami sniper rifle patches target intel and magnified images directly into optical cyberware, and it can automatically compensate for deviations in projectile trajectory. The Ashura has the spotter built directly into the hardware. Never miss again.</em></p>') }),

  weaponItem({ name: 'Rostovic Kolac', manufacturer: 'Rostović', cost: 'EX', imgPath: img(W_ROOT, 'Rostovic-Kolac.png'),
    weapons: [entry({ ...PR_BASE, damage: '6d6', power: true, heavyRecoil: true })],
    description: desc('<p>This is a Power Weapon.</p><p><strong>HEAVY RECOIL:</strong> A user with <strong>BODY</strong> lower than 8 takes <strong>1d6</strong> directly to HP when firing.</p><p><em>Rostović may not be considered a top-tier arms manufacturer, but their Kolac rifle is nothing to sneeze at. If you\'re shopping for reliable accuracy and dependable durability, look no further. And with such an affordable price tag, the Kolac feels like a steal. Unfortunately, ergonomics were not a top priority during development. While undeniably precise, this rifle feels heavy and unbalanced. From a quality-of-life standpoint, this is where Rostović falls behind competitors such as Arasaka, Kang Tao, Tsunami and Militech. Still, if the Kolac has earned a spot with Serbia\'s armed forces, there\'s no reason to doubt its effectiveness on the streets of Night City.</em></p>') }),
  weaponItem({ name: 'Militech M-179 Achilles', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech-M-179-Achilles.png'),
    weapons: [entry({ ...PR_BASE, tech: true, chargeType: 'hold', cs3: true, cs3FallbackDamage: '4d6' })],
    description: desc('<p>This is a Tech Weapon that must hold its charge to fire charged.</p><p><strong>CHARGED SHOT 3 (CS3):</strong> A charged shot drops to ROF 1 and consumes 3 rounds per attack. It sees through thin cover and ignores half of the target\'s SP.</p><p><em>Just like Achilles, the mythical, nearly invincible warrior of Ancient Greece, this Militech weapon is also unsurpassed in its class: the M-179 Achilles is truly the best electromagnetic precision rifle on the market. The Achilles features an ultra-long range alongside fierce power &ndash; meaning the bullets hit home just as hard, even at great distances. A sniper equipped with the Achilles can easily pierce through walls or armored vehicles.</em></p><p><em>Now, the mythical Achilles had one fatal weakness. What about his namesake? Well, perhaps one flaw would be its complicated, difficult-to-use construction, not to mention its steep price point. That\'s why the M-179 Achilles is hard to find on Night City\'s mean streets.</em></p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SPECIAL RANGED — RL, Stun, Flamethrowers
// ═══════════════════════════════════════════════════════════════════════════

const special = [
  weaponItem({ name: 'Arasaka Dojigiri Yasutsuna', manufacturer: 'Arasaka', cost: 'VEX', imgPath: img(W_ROOT, 'Arasaka-Dojigiri-Yasutsuna.png'),
    weapons: [entry({ type: 'rocketLauncher', damage: '10d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, smart: true, damageType: 'explosion', coneSpread: 4, coneHalfDamageDistance: 4 })],
    description: desc('<p>This is a Smart Weapon with an explosive 4m inner / 10m outer radius.</p><p><strong>HOMING GUIDANCE:</strong> ISA rockets home in on their target. When the only moving target is 50m or more away against an unmoving background, a miss by 7 or less means the rocket guides itself onto the target.</p>') }),
  weaponItem({ name: 'Kang Tao TKI-20 Mámù', manufacturer: 'Kang Tao', cost: 'EX', imgPath: img(W_ROOT, 'Kang-Tao-Mámù.png'),
    effects: [{ name: 'Stunned', disabled: true, transfer: false, changes: [], flags: { 'cyberpunk-blue': { isAfflictionEffect: true } } }],
    weapons: [entry({ type: 'stunGun', damage: '3d6', rateOfFire: 2, magazine: 12, hands: 1, concealable: true, rangeTable: R.pistol, shots: 1, damageType: 'affliction', afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, shockwave: true })],
    description: desc('<p>This is a Stun Gun.</p><p><strong>SHOCKWAVE:</strong> A standing target with <strong>BODY</strong> lower than 8 is pushed 2m away.</p><p><strong>STUN:</strong> A target reduced to 0 HP becomes stable, though criticals still trigger normally.</p><p><strong>BATTERY:</strong> The weapon has no ammunition slot. A replacement &euro;$50 battery takes 1 hour to recharge from empty.</p>') }),
  weaponItem({ name: 'Sanroo Hotness', manufacturer: 'Sanroo', cost: 'EX', imgPath: img(W_ROOT, 'Sanroo-hotness.png'),
    weapons: [entry({ type: 'flamethrower', damage: '4d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 4, coneAngle: 53, coneHalfDamageDistance: 6 })],
    description: desc('<p>This is a Flamethrower.</p><p><strong>SPRAY:</strong> The weapon sprays liquid in a 4/6m cone. Targets roll <strong>RFLX</strong>+<strong>Evade</strong> against <strong style="color: var(--cpb-accent);">DV 15</strong>, taking <strong>2d6</strong> on a success and <strong>4d6</strong> on a failure. It ignores half of the target\'s SP.</p><p><strong>TANK:</strong> The fuel tank has 15 HP. If it is destroyed by fire or thermal damage it explodes in a 2/4m radius for <strong>4d6</strong>. CHOOH&sup2; fuel deals <strong>+1</strong> toxic damage.</p>') }),
  weaponItem({ name: 'Militech IP-13 Provo', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_ROOT, 'Militech-IP-13-Provo.png'),
    weapons: [entry({ type: 'flamethrower', damage: '4d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 4, coneAngle: 53, coneHalfDamageDistance: 6 })],
    description: desc('<p>This is a Flamethrower with the same baseline as the Sanroo Hotness, except that its tank has 25 HP.</p><p><strong>CHOOH&sup2; FUEL:</strong> Roll <strong>1d10</strong>. If the result is higher than the user\'s <strong>BODY</strong>, the user takes <strong>1d6</strong> directly to HP.</p>') }),
  weaponItem({ name: 'Arasaka Onibi Plasma Caster', manufacturer: 'Arasaka', cost: 'EX', imgPath: img(W_SMG, 'Arasaka-Onibi.png'),
    weapons: [entry({ type: 'flamethrower', damage: '2d6', rateOfFire: 1, magazine: 10, shots: 1, hands: 2, damageType: 'cone', coneSpread: 6, coneAngle: 53, coneHalfDamageDistance: 4, selfConeMalfunction: true })],
    description: desc('<p>This is an experimental plasma caster, treated as a Flamethrower. It fires a 6/4m cone dealing <strong>2d6</strong>.</p><p><strong>MALFUNCTION:</strong> After firing, roll <strong>1d10</strong>. On a <strong>9&ndash;10</strong> the toxicity blasts a second 6/4m cone that also catches the user in its inner radius for <strong>2d6</strong>, bypassing SP without ablating it.</p><p><strong>EXPLOSION RISK:</strong> The tank has 5 HP. If it is broken while loaded, the weapon detonates in a 2/4m explosion for <strong>6d6</strong>, handled by the GM.</p>') }),
  // Standard launchers. Payload defaults to a fragmentation grenade / unguided
  // rocket; a loaded grenade/rocket Ammo will replace the payload once the
  // grenade-as-ammo slice lands.
  weaponItem({ name: 'Militech Grenade Launcher', manufacturer: 'Militech', cost: 'EX', imgPath: img(W_HEAVY, 'Grenade-Launcher.png'),
    weapons: [entry({ type: 'grenadeLauncher', damage: '6d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, damageType: 'explosion', coneSpread: 10, coneAngle: 360, coneHalfDamageDistance: 4 })],
    description: desc('<p>The problem with grenades is the range you can throw them, and a launcher removes that concern. It fires a fragmentation grenade for a <strong>6d6</strong> explosion with a 4m inner and 10m outer radius.</p>') }),
  weaponItem({ name: 'Militech Rocket Launcher', manufacturer: 'Militech', cost: 'VEX', imgPath: img(W_HEAVY, 'Rocket-launcher.png'),
    weapons: [entry({ type: 'rocketLauncher', damage: '10d6', rateOfFire: 1, magazine: 1, shots: 1, hands: 2, rangeTable: R.rl, damageType: 'explosion', coneSpread: 4, coneHalfDamageDistance: 4 })],
    description: desc('<p>This launcher fires self-propelled rockets that explode with a 4m inner and 10m outer radius.</p>') }),
  weaponItem({ name: 'Zetatech Microwaver-55', manufacturer: 'Zetatech', cost: 'VEX', imgPath: img(W_ROOT, 'Zetatech-Microwaver.png'),
    effects: [{
      name: 'Cyberware Disabled (Microwaver)', disabled: true, transfer: false,
      changes: [{ key: 'cyberblue.disableCyberware.random', type: 'add', value: '2' }],
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
    weapons: [entry({ type: 'veryHeavyPistol', damage: '0', rateOfFire: 1, magazine: 0, shots: 0, hands: 1, rangeTable: R.pistol, damageType: 'affliction', afflictionPrimary: 'tech', afflictionSkill: 'endurance', afflictionDv: 15 })],
    description: desc('<p>This weapon deals no damage. On a hit, the target must make a <strong>TECH</strong>+<strong>Endurance</strong> check against <strong style="color: var(--cpb-accent);">DV 15</strong> or have two random non-insulated pieces of cyberware disabled, since microwaves bypass physical armor.</p><p><strong>REBOOTING:</strong> Disabled cyberware can be restarted with a <strong>TECH</strong>+<strong>Electronics (Cybernetics)</strong> check against <strong style="color: var(--cpb-accent);">DV 15</strong> as an Action.</p><p><strong>BATTERY:</strong> The weapon is powered by a battery instead of ammunition.</p>') }),
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
  weaponItem({ name: 'Kendachi RA-5 Powered Knife', manufacturer: 'Kendachi', cost: 'PR', imgPath: img(W_MELEE, 'Kendachi-knife.png'),
    weapons: [lmw({ electricCharge: true, electricChargeMax: 10 })],
    description: desc('<p>This is a Light Melee weapon that can also be thrown.</p><p><strong>ELECTRIC CHARGE:</strong> The battery holds 10 uses and takes 15 minutes to charge. A target that takes any damage from the knife must make a <strong>TECH</strong>+<strong>Endurance</strong> check against <strong style="color: var(--cpb-accent);">DV 15</strong> or take <strong>2d6</strong> directly to HP. A direct hit on an uninsulated electrical device disables it.</p>') }),
  weaponItem({ name: 'Militech M2 Combat Knife', manufacturer: 'Militech', cost: 'C', imgPath: img(W_MELEE, 'militech-combat-knife.png'),
    weapons: [lmw()],
    description: desc('<p>This is a standard-issue combat knife.</p>') }),
  weaponItem({ name: 'Scalpel', manufacturer: '', cost: 'C', imgPath: img(W_MELEE, 'scalpel.png'),
    weapons: [lmw()],
    description: desc('<p>This is a small but very sharp surgical blade.</p>') }),

  weaponItem({ name: 'Throwing Axe', manufacturer: 'Kaukaz', cost: 'CO', imgPath: img(W_MELEE, 'Kaukaz-axe.png'),
    weapons: [mmw()],
    description: desc('<p>This is a Medium Melee weapon that can also be thrown, with a range of 15/20m.</p>') }),
  weaponItem({ name: 'Baseball Bat', manufacturer: '', cost: 'CO', imgPath: img(W_MELEE, 'Baseball-bat.png'),
    weapons: [mmw({ critBlunt: true })],
    description: desc('<p><strong>BLUNT:</strong> This weapon cannot cause dismembering criticals. A critical injury that would dismember becomes the Broken version instead and deals <strong>+5</strong> bonus damage.</p>') }),

  weaponItem({ name: 'Kendachi Mono-Three', manufacturer: 'Kendachi', cost: 'LUX', imgPath: img(W_MELEE, 'Kendachi-Mono-Three.png'),
    weapons: [hmw({ critSlicing: true, burningEdge: true })],
    description: desc('<p><strong>SLICING:</strong> When this weapon causes a Broken Arm or Broken Leg critical injury, roll <strong>1d6</strong>. On a 2 or higher the injury becomes Dismembered instead.</p><p><strong>BURNING EDGE:</strong> The blade must be registered to the user\'s biometrics and takes an Action to activate. While it is active, the blade ignores any SP below 11.</p>') }),
  weaponItem({ name: 'Katana', manufacturer: '', cost: 'EX', imgPath: img(W_MELEE, 'Katana.png'),
    weapons: [hmw({ critSlicing: true })],
    description: desc('<p><strong>SLICING:</strong> When this weapon causes a Broken Arm or Broken Leg critical injury, roll <strong>1d6</strong>. On a 2 or higher the injury becomes Dismembered instead.</p>') }),
  weaponItem({ name: 'Militech Stun Baton', manufacturer: 'Militech', cost: 'PR', imgPath: img(W_MELEE, 'Militech-Stun-Baton.png'),
    effects: [{ name: 'Stunned', disabled: true, transfer: false, changes: [], flags: { 'cyberpunk-blue': { isAfflictionEffect: true } } }],
    weapons: [hmw({ damageType: 'affliction', afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13 })],
    description: desc('<p><strong>STUN:</strong> On a hit that penetrates SP, the target rolls <strong>BODY</strong>+<strong>Endurance</strong> against <strong style="color: var(--cpb-accent);">DV 13</strong> or becomes Stunned.</p>') }),
  weaponItem({ name: 'Sledgehammer', manufacturer: 'Kaukaz', cost: 'PR', imgPath: img(W_MELEE, 'Kaukaz-sledgehammer.png'),
    weapons: [hmw({ hands: 2, critCrushing: true })],
    description: desc('<p><strong>CRUSHING:</strong> A Collapsed Lung or Spinal Injury from this weapon also causes Broken Ribs, and an injury that would be Broken Ribs also causes a Collapsed Lung. Any Critical Head Injury also causes a Concussion, and an injury that would be a Concussion also causes a Cracked Skull.</p>') }),

  weaponItem({ name: 'Budget Arms Cut-O-Matic', manufacturer: 'Budget Arms', cost: 'EX', imgPath: img(W_MELEE, 'Budget-Arms-Cut-o-Matic.png'),
    weapons: [vhmw({ vicious: true })],
    description: desc('<p><strong>VICIOUS:</strong> While the weapon is powered on, its criticals deal <strong>+5</strong> damage.</p><p><strong>NOISY:</strong> Stealth is impossible while the weapon is running. It can be toggled as part of another action, but it cannot be switched on and off in the same round.</p><p><strong>UNPOWERED:</strong> If the weapon is switched off or out of CHOOH&sup2;, it deals only <strong>3d6</strong>.</p><p><em>The Cut-o-Matic is the ultimate proof that weapons are nothing more than toys for adults. Its flashy design and the menacing whirr of its blade make every Night City maniac fall in love at first sight. This unique piece has all the makings of a cult classic, but there\'s a reason its manufacturer has the word "Budget" right there in its name: shoddy workmanship, cheap parts, awkward balancing, and most of all &ndash; a capricious motor that tends to choke at the worst possible moment. All of these relegate the Cut-o-Matic to the status of a curio, used only by the craziest NC thrill-seekers.</em></p>') }),

  weaponItem({ name: 'Bow', manufacturer: '', cost: 'PR', imgPath: img(W_ROOT, 'bow.png'),
    weapons: [entry({
      type: 'bowCrossbow', damage: '4d6', rateOfFire: 1, hands: 2,
      rangeTable: [17, 15, 13, 15, 20, 0, 0, 0],
    })],
    description: desc('<p>This is a standard recurve bow that fires arrows. It is two-handed and completely silent.</p>') }),
  weaponItem({ name: 'Eagletech Fletcher', manufacturer: 'Eagletech', cost: 'PR', imgPath: img(W_ROOT, 'crossbow.png'),
    weapons: [entry({
      type: 'bowCrossbow', damage: '4d6', rateOfFire: 1, hands: 2,
      rangeTable: [17, 15, 13, 15, 20, 0, 0, 0],
    })],
    description: desc('<p>This is a crossbow designed for sports &mdash; and taking down enemies can be a sport.</p>') }),
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
