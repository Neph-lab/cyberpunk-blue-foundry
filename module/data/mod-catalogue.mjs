/**
 * Mod catalogue — Scopes, Muzzle attachments, weapon mods, under-barrel
 * sub-weapons, and accessories. Imported alongside weapon-catalogue.mjs.
 *
 * Each entry returns Foundry create-data for an Item of type 'mod'.
 * The accompanying weapon catalogue lives in `weapon-catalogue.mjs`.
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

const ASSET_BASE = 'systems/cyberpunk-blue/assets/items/mods';
const M_SCOPES = `${ASSET_BASE}/Scopes`;
const M_MUZZLE = `${ASSET_BASE}/Muzzle`;
const M_ROOT = ASSET_BASE;

const desc = (html) => `<p>${html}</p>`;
const img = (folder, file) => `${folder}/${file}`;

/**
 * Build a Foundry Item create-data record for a mod.
 * Sensible defaults for unused fields; override only what matters.
 */
function modItem({ name, manufacturer = '', cost = '', description = '', imgPath = '', system = {} }) {
  return {
    name,
    type: 'mod',
    img: imgPath,
    system: {
      manufacturer,
      cost: COST_EXPAND[cost] ?? cost,
      note: '',
      modType: system.modType ?? 'weaponMod',
      installedOnId: '',
      targetWeaponIndex: -1,
      weaponChanges: [],
      // ── Mod-specific fields (default zeros; override below) ──
      modSlots: system.modSlots ?? 1,
      scopeType: system.scopeType ?? '',
      rangeImprovementMeters: system.rangeImprovementMeters ?? 0,
      rangeImprovementBidirectional: !!system.rangeImprovementBidirectional,
      thermalImaging: !!system.thermalImaging,
      digitalLink: !!system.digitalLink,
      highlightedVitals: !!system.highlightedVitals,
      requiresPowerWeapon: !!system.requiresPowerWeapon,
      requiresSmartWeapon: !!system.requiresSmartWeapon,
      requiresTechWeapon: !!system.requiresTechWeapon,
      blockedOnPower: !!system.blockedOnPower,
      blockedOnSmart: !!system.blockedOnSmart,
      blockedOnTech: !!system.blockedOnTech,
      silenceDV: system.silenceDV ?? 0,
      destroyedByTech: !!system.destroyedByTech,
      destroyedByRof2: !!system.destroyedByRof2,
      reduceDmgPerDie: !!system.reduceDmgPerDie,
      compressRof: !!system.compressRof,
      stealthAdvantage: !!system.stealthAdvantage,
      lostForce: !!system.lostForce,
      recoilBonus: system.recoilBonus ?? 0,
      recoilAFOnly: !!system.recoilAFOnly,
      directedRecoil: !!system.directedRecoil,
      synergyBrand: system.synergyBrand ?? '',
      synergyDiceThreshold: system.synergyDiceThreshold ?? 0,
      description: description || '',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//   SHORT SCOPES — pistols + SMGs
// ═══════════════════════════════════════════════════════════════════════════

const shortScopes = [
  modItem({ name: 'Militech CQO Kanone Mini Mk.72', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech CQO Kanone MINI Mk72.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2 },
    description: desc('Range Improvement: target is treated as 2m closer. Rugged: 10 HP, immune to most scope-blocking tech.') }),
  modItem({ name: 'Tsunami Hyakume', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_SCOPES, 'Tsunami Arms Hyakume.png'),
    system: { scopeType: 'short', digitalLink: true, thermalImaging: true },
    description: desc('Digital Link: connected user sacrifices Move action → +1 attacks with this weapon that turn. Thermal Imaging: darkness/smoke imposes no worse than -1 penalty.') }),
  modItem({ name: 'Budget Arms Add-Vantage', manufacturer: 'Budget Arms', cost: 'EV', imgPath: img(M_SCOPES, 'Budget Arms Add-Vantage.png'),
    system: { scopeType: 'short' },
    description: desc('Beginner Friendly: if user has no Handgun ranks → +1 attack.') }),
  modItem({ name: 'Kang Tao Type-2067', manufacturer: 'Kang Tao', cost: 'CO', imgPath: img(M_SCOPES, 'Kang Tao Type-2067.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2 },
    description: desc('Range Improvement: 2m closer. Reflector Glass: anti-dazzle / anti-glare while aiming.') }),
  modItem({ name: 'Arasaka Kanetsugo', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_SCOPES, 'Arasaka Kanetsugo.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2, highlightedVitals: true },
    description: desc('Range Improvement: 2m closer. Highlighted Vitals: roll an extra 1d6 separately from damage; if that die = 6 AND at least one damage die = 6 → automatic critical injury.') }),
  modItem({ name: 'Softsys Handyman', manufacturer: 'Softsys', cost: 'PR', imgPath: img(M_SCOPES, 'SoftSys Handyman.png'),
    system: { scopeType: 'short', digitalLink: true },
    description: desc('Digital Link: connected user sacrifices Move action → +1 attacks with this weapon that turn.') }),
  modItem({ name: 'Kiroshi OS-1 Gimlet Eye', manufacturer: 'Kiroshi Optics', cost: 'C', imgPath: img(M_SCOPES, 'Kiroshi OS-1 GimletEye.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('Range Improvement: target up to 4m closer or farther.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   LONG SCOPES — shotguns, MGs, ARs, PRs
// ═══════════════════════════════════════════════════════════════════════════

const longScopes = [
  modItem({ name: 'Nokota E255 Percipient', manufacturer: 'Nokota', cost: 'PR', imgPath: img(M_SCOPES, 'Nokota E255 Percipient.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true, thermalImaging: true },
    description: desc('Range Improvement: 4m closer or farther. Thermal Imaging: darkness/smoke imposes no worse than -1 penalty.') }),
  modItem({ name: 'Militech Mk.2X Grandstand', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech Mk2x Grandstand.png'),
    system: { scopeType: 'long', thermalImaging: true },
    description: desc('Digital Feed: user can access the scope\'s vision as a video feed (narrative). Thermal Imaging.') }),
  modItem({ name: 'Arasaka SO-21 Saika', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_SCOPES, 'Arasaka SO-21 Saika.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 6, rangeImprovementBidirectional: true },
    description: desc('Range Improvement: 6m closer or farther. Trajectory Calculations: +1 attacks against targets more than 40m away.') }),
  modItem({ name: 'Amutek Kairo SA-1', manufacturer: 'Amutek', cost: 'C', imgPath: img(M_SCOPES, 'Amutek Kairo SA-1.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('Range Improvement: 4m closer or farther.') }),
  modItem({ name: 'Militech ClearVue Mk.8', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech ClearVue Mk.8.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('Burst Control: autofire uses 2 fewer ammo (minimum 8). Range Improvement: 4m closer or farther.') }),
  modItem({ name: 'Kang Tao Jue', manufacturer: 'Kang Tao', cost: 'CO', imgPath: img(M_SCOPES, 'Kang tao jue.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 6, rangeImprovementBidirectional: true },
    description: desc('Range Improvement: 6m closer or farther.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SNIPER SCOPES — sniper rifle only
// ═══════════════════════════════════════════════════════════════════════════

const sniperScopes = [
  modItem({ name: 'Tsunami Gaki', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(M_SCOPES, 'Tsunami Gaki.png'),
    system: { scopeType: 'sniper', requiresTechWeapon: true, rangeImprovementMeters: 20, rangeImprovementBidirectional: true },
    description: desc('TW sniper rifle only. Improved Charge: while charging or maintaining charge, user may move up to 2m or MOVE (whichever is lower) as a Move action. Range Improvement: up to 20m closer or farther.') }),
  modItem({ name: 'Militech HPO Kanone Max Mk.77', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech HPO Kanone MAX Mk77.png'),
    system: { scopeType: 'sniper', blockedOnSmart: true, blockedOnTech: true, rangeImprovementMeters: 10, rangeImprovementBidirectional: true },
    description: desc('SR only; not Smart or Tech. Range Improvement: up to 10m closer or farther.') }),
  modItem({ name: 'Federated Arms Hawk Eye', manufacturer: 'Federated Arms', cost: 'CO', imgPath: img(M_SCOPES, 'Federated Arms Hawk Eye.png'),
    system: { scopeType: 'sniper', blockedOnSmart: true, blockedOnTech: true },
    description: desc('SR only; not Smart or Tech. Calibration: Action DV15 INT+Shoulder Arms; on success, gain +8 attack OR double Shoulder Arms skill (whichever lower) until you fire, Move, or take another action.') }),
  modItem({ name: 'Nokota E305 Prospecta', manufacturer: 'Nokota', cost: 'PR', imgPath: img(M_SCOPES, 'Nokota E305 Prospecta.png'),
    system: { scopeType: 'sniper', requiresTechWeapon: true, rangeImprovementMeters: 10, rangeImprovementBidirectional: true },
    description: desc('TW sniper rifle only. Improved Charge: after the first round of charging, may move up to 2m or MOVE as a Move action. Range Improvement: up to 10m closer or farther.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SILENCERS
// ═══════════════════════════════════════════════════════════════════════════

const silencers = [
  modItem({ name: 'Amutek XC-10 Cetus', manufacturer: 'Amutek', cost: 'CO', imgPath: img(M_MUZZLE, 'Amutek XC-10 Cetus.png'),
    system: { silenceDV: 10, blockedOnTech: true, reduceDmgPerDie: true, compressRof: true },
    description: desc('Pistol only (not Tech). Silenced: DV10 INT+Perception to hear (DV +1 per 4m). Reduced damage: -1 per damage die. Forces RoF1. Steady: +1 attacks on turns the user does not Move.') }),
  modItem({ name: 'Amutek XC-10 Strix', manufacturer: 'Amutek', cost: 'CO', imgPath: img(M_MUZZLE, 'Amutek XC-10 Strix.png'),
    system: { silenceDV: 10, reduceDmgPerDie: true, destroyedByTech: true, destroyedByRof2: true, stealthAdvantage: true },
    description: desc('Pistol. Silenced: DV10. Reduced damage: -1 per damage die. Destroyed by Tech use or RoF2+ firing. Stealth Advantage.') }),
  modItem({ name: 'Militech TSX Tocororo', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_MUZZLE, 'Militech TSX Tocororo.png'),
    system: { silenceDV: 8, reduceDmgPerDie: true, compressRof: true, destroyedByTech: true, stealthAdvantage: true },
    description: desc('Pistol or PR. Silenced: DV8. Reduced damage: -1 per damage die after SP. Forces RoF1. Destroyed by Tech use. Stealth Advantage.') }),
  modItem({ name: 'Militech CS-1 Taipan', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_MUZZLE, 'Militech CS-1 Taipan.png'),
    system: { silenceDV: 10, reduceDmgPerDie: true, compressRof: true, destroyedByTech: true, stealthAdvantage: true },
    description: desc('Pistol or PR. Silenced: DV10. Reduced damage: -1 per damage die. Forces RoF1. Destroyed by Tech use. Stealth Advantage.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MUZZLE BREAKS — RC-7 Series (all share Lost Force)
// ═══════════════════════════════════════════════════════════════════════════

const pistolMuzzleBreaks = [
  modItem({ name: 'Arasaka RC-7 Yokai', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_MUZZLE, 'Arasaka RC-7 Yokai.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Arasaka', synergyDiceThreshold: 4 },
    description: desc('Pistol muzzle break (not Tech). Lost Force: critical injury now requires a 6 on an additional damage die. Stabilised Recoil: +1 attacks. Synergy: +1 dmg from Arasaka weapon; +1 more if the weapon has ≥4 damage dice.') }),
  modItem({ name: 'Tsunami RC-7 Kutrub', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_MUZZLE, 'Tsunami RC-7 Kutrub.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Tsunami Arms', synergyDiceThreshold: 4 },
    description: desc('Pistol muzzle break (not Tech). Lost Force. Stabilised Recoil: +1 attacks. Synergy: +1 dmg from Tsunami Arms weapon; +1 more if ≥4 damage dice.') }),
  modItem({ name: 'Militech RC-7 Liger', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_MUZZLE, 'Militech RC-7 Liger.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1 },
    description: desc('Pistol muzzle break (not Tech). Lost Force. +1 attacks. If the attack d10 rolls 1, may reroll once (must use the new result).') }),
  modItem({ name: 'Malorian RC-7 Dybbuk', manufacturer: 'Malorian Arms', cost: 'PR', imgPath: img(M_MUZZLE, 'Maloran Arms RC-7 Dybbuk.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Malorian Arms' },
    description: desc('Pistol muzzle break (not Tech). Lost Force. +1 attacks. Specialized: +1 damage from revolver weapons.') }),
  modItem({ name: 'Militech RC-7 Babaroga', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_MUZZLE, 'Militech RC-7 Babaroga.png'),
    system: { blockedOnTech: true, lostForce: true, directedRecoil: true },
    description: desc('Pistol muzzle break (not Tech). Lost Force. Directed Recoil: PW ricochet penalty reduced by 1 (no attack bonus).') }),
];

const rifleMuzzleBreaks = [
  modItem({ name: 'Arasaka RC-7 Aswang', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_MUZZLE, 'Arasaka RC-7 Aswang.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Arasaka', synergyDiceThreshold: 4 },
    description: desc('AR/SMG muzzle break (not Tech). Lost Force. +1 attacks. Synergy: +1 dmg from Arasaka weapon; +1 more if ≥4 damage dice.') }),
  modItem({ name: 'Rostovic RC-7 Strigoi', manufacturer: 'Rostovic', cost: 'CO', imgPath: img(M_MUZZLE, 'Rostovic RC-7 Strigoi.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, recoilAFOnly: true },
    description: desc('AR/SMG muzzle break (not Tech). Lost Force. +1 on autofire attacks only. Accidental Discharge: on a single shot with an odd attack die, the weapon uses 2× ammo (if available) and deals +1 damage per die.') }),
  modItem({ name: 'Nokota RC-7 Zaar', manufacturer: 'Nokota', cost: 'CO', imgPath: img(M_MUZZLE, 'Nokota RC-7 Zaar.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, recoilAFOnly: true },
    description: desc('AR/SMG muzzle break (not Tech). Lost Force. +1 on autofire attacks only.') }),
  modItem({ name: 'Militech RC-7 Varkolak', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_MUZZLE, 'Militech RC-7 Varkolak.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, directedRecoil: true },
    description: desc('AR/SMG muzzle break (not Tech). Lost Force. +1 attacks. Directed Recoil: PW ricochet penalty reduced by 1.') }),
  modItem({ name: 'Techtronika RC-7 Ifrit', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(M_MUZZLE, 'Techtronika RC-7 Ifrit.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1 },
    description: desc('AR/SMG muzzle break (not Tech). Lost Force. +1 attacks. Extra +1 attacks against targets within 20m.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   GENERAL ATTACHMENTS / WEAPON MODS
// ═══════════════════════════════════════════════════════════════════════════

const attachments = [
  modItem({ name: 'Fuyutsuki Action Cam', manufacturer: 'Fuyutsuki', cost: 'PR', imgPath: img(M_ROOT, 'Fuyutsuki Action Cam.png'),
    system: {},
    description: desc('Camera: on/off switch or trigger-auto. Battery + memory last 1 hour; 1h to recharge.') }),
  modItem({ name: 'Arasaka Stability Calibrator', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_ROOT, 'Arasaka Stability Calibrator.png'),
    system: {},
    description: desc('Bullet-firing weapons only. Handling Computer: +1 attacks if last attack was in same direction and the user took no Move/physical action since. EMP Shielding: only DV>16 effects can disable.') }),
  modItem({ name: 'Militech MF Selector', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_ROOT, 'Militech MF Selector.png'),
    system: {},
    description: desc('Bullet-firing weapons only. Magazine Feed: switch to next ammo type in magazine as a free action; on Militech weapons can switch to any loaded round.') }),
  modItem({ name: 'Budget Arms Depot Grip', manufacturer: 'Budget Arms', cost: 'EV', imgPath: img(M_ROOT, 'Budget Arms Depot Grip.png'),
    system: {},
    description: desc('Replaces grip. Hidden compartment: +2 to conceal anything in the grip. Note: weapons priced €$500+ suffer -1 attacks vs their default grip.') }),
  modItem({ name: 'Militech Type II Grip', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech Type II Grip.png'),
    system: {},
    description: desc('1-hand firearm only. Forward grip (now requires 2 hands). Improved Autofire: +1 autofire attacks. Steady: +1 attack if only fired once this turn.') }),
  modItem({ name: 'Militech SR Capacity', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech SR Capacity.png'),
    system: { requiresTechWeapon: true },
    description: desc('Tech weapon only (SG/AR/PR/SR). High-Capacity Battery: can still Move while charging (at half MOVE); a hit past SP deals +2 damage to HP (electrical). Cumbersome: -1 all attacks vs standard stock; cannot conceal.') }),
  modItem({ name: 'Tsunami Hakatome', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(M_ROOT, 'Tsunami Hakatome.png'),
    system: {},
    description: desc('Stock Mod for 1-hand firearms. Support: +1 attacks. Shoulder Stock: now requires 2 hands; cannot conceal; uses Shoulder Arms skill.') }),
  modItem({ name: 'Malorian Critical Ricochet', manufacturer: 'Malorian Arms', cost: 'PR', imgPath: img(M_ROOT, 'Malorian Critical Ricochet.png'),
    system: { requiresPowerWeapon: true },
    description: desc('Power weapon only. Action Assembly. Improved Ricochet: a successful ricochet hit deals +1 damage per die of base weapon damage.') }),
  modItem({ name: 'Militech TWA Boomerang', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech TWA Boomerang.png'),
    system: {},
    description: desc('Light Melee weapons designed to be thrown only. Return Thruster: silently returns to thrower\'s wireless hand-signal at start of next turn if within 50m and no obstacles. Holding it still requires DV12 BODY+Athletics.') }),
  modItem({ name: 'Militech 4X Action Repeater', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech 4x Action Repeater.png'),
    system: {},
    description: desc('Bullet-firing weapons. Recoil Action: on a single-shot attack, also roll 1d6; on 6 → make an additional attack immediately vs the same target with no recoil penalty.') }),
  modItem({ name: 'Tsunami Ketsuretsu', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_ROOT, 'Tsunami Ketsuretsu.png'),
    system: { requiresTechWeapon: true },
    description: desc('Tech weapon only. Tech Barrel Mod. Barrier Penetration: for each damage die showing 5 or 6, one extra point of damage ignores SP / barrier HP.') }),
  modItem({ name: 'Kang Tao Zhànshǒu', manufacturer: 'Kang Tao', cost: 'PR', imgPath: img(M_ROOT, 'Kang Tao Zhanshou.png'),
    system: { requiresSmartWeapon: true },
    description: desc('Smart weapon only. Smart Targeting. Target Vitals: head/vital penalty reduced by 1; smart ammo using guidance reduces by 1 more and always targets vitals.') }),
  modItem({ name: 'Kendachi Shi Bayonet', manufacturer: 'Kendachi', cost: 'C', imgPath: img(M_ROOT, 'Kendachi bayonet.png'),
    system: {},
    description: desc('Any long weapon (not most pistols/SMGs). Melee weapon attached: ignores ½ SP. Bayonet stats: DMG 1d6, RoF 2.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   UNDER-BARREL SUB-WEAPONS (2 modification slots)
// ═══════════════════════════════════════════════════════════════════════════

const underBarrels = [
  modItem({ name: 'Rostovic BP-2 Plujka', manufacturer: 'Rostovic', cost: 'PR', imgPath: img(M_ROOT, 'Rostovic BP-2 Plujka.png'),
    system: { modSlots: 2 },
    description: desc('Under-Barrel Shotgun (AR or SG host, 2 mod slots). Stats: 5d6 / RoF 1 / 1 ammo / RCL 2 / range 13,15,20,25,30,35. PW + JAM. Shell mode: DV11, 3d6 in 8/8m cone.') }),
  modItem({ name: 'Constitutional Arms Cavalry', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(M_ROOT, 'Constitutional Arms Cavalry.png'),
    system: { modSlots: 2 },
    description: desc('Under-Barrel Shotgun (AR or SG host, 2 mod slots). 5d6 / RoF 1 / 1 ammo / RCL 2 / range 13,15,20,25,30,35. PW. Shell mode: DV13, 3d6 in 8/8m cone.') }),
  modItem({ name: 'Militech EFMO2 Boulder', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_ROOT, 'Militech EFMO2 Boulder.png'),
    system: { modSlots: 2 },
    description: desc('Under-Barrel Grenade Launcher (AR or SG host, 2 mod slots). 6d6 / RoF 1 / 1 ammo / RCL 1 / range 10,15,18,25,35. Explosives: basic grenades 6d6 in 4/8m sphere; miss → lands 2d6m off in a random direction.') }),
  modItem({ name: 'Midnight Arms WA20 GL', manufacturer: 'Midnight Arms', cost: 'PR', imgPath: img(M_ROOT, 'Midnight Arms WA20 GL1.png'),
    system: { modSlots: 2 },
    description: desc('Under-Barrel Grenade Launcher (AR or SG host, 2 mod slots). Same as Boulder. Poor Balance: -1 attacks with main weapon.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   ACCESSORIES (magazines)
// ═══════════════════════════════════════════════════════════════════════════

const accessories = [
  modItem({ name: 'Extended Magazine', manufacturer: '', cost: 'CO', imgPath: img(M_ROOT, 'Extended mag.png'),
    system: {},
    description: desc('Doubles ammo capacity (or cap below, whichever is lower). Cannot conceal. Caps: MP 18, HP/VHP 14, SMG 40, HvySMG 50, SG 8, AR 35, PR 20, SR 8, GL 4, RL 2.') }),
  modItem({ name: 'Drum Magazine', manufacturer: '', cost: 'PR', imgPath: img(M_ROOT, 'Drum mag.png'),
    system: {},
    description: desc('Quadruples ammo capacity (or cap below, whichever is lower). Cannot conceal. Caps: MP 36, HP/VHP 28, SMG 50, HvySMG 60, SG 16, AR 45, PR 35, SR 12, GL 6, RL 3.') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   EXPORT
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
//   COMPUTER HARDWARE MODS
// ═══════════════════════════════════════════════════════════════════════════

const computerMods = [
  modItem({
    name: 'Coolant',
    cost: 'CO',
    system: { modType: 'computerMod' },
    description: desc('Architecture Hardware add-on. Nitrogen cooling throughout the system. Device is immune to fire-inducing program effects. +1 active program slot.'),
  }),
  modItem({
    name: 'Insulation',
    cost: 'VEX',
    system: { modType: 'computerMod' },
    description: desc('Architecture Hardware add-on. Device is immune to EMP and microwave radiation.'),
  }),
  modItem({
    name: 'Memory Upgrade',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('Architecture Hardware add-on. Adds +1 DATA node to the device. Can be purchased multiple times (servers only).'),
  }),
];

export const MOD_CATALOGUE = [
  ...shortScopes,
  ...longScopes,
  ...sniperScopes,
  ...silencers,
  ...pistolMuzzleBreaks,
  ...rifleMuzzleBreaks,
  ...attachments,
  ...underBarrels,
  ...accessories,
  ...computerMods,
];
