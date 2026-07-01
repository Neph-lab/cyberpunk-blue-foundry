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

const desc = (html) => /^\s*<(p|ul|ol|div|h\d|table)\b/i.test(html) ? html : `<p>${html}</p>`;
const img = (folder, file) => `${folder}/${file}`;

/**
 * Build a Foundry Item create-data record for a mod.
 * Sensible defaults for unused fields; override only what matters.
 */
function modItem({ name, manufacturer = '', cost = '', description = '', imgPath = '', system = {}, effects = [] }) {
  return {
    name,
    type: 'mod',
    img: imgPath,
    effects,
    system: {
      manufacturer,
      cost: COST_EXPAND[cost] ?? cost,
      note: '',
      modType: system.modType ?? 'weaponMod',
      installedOnId: '',
      targetWeaponIndex: -1,
      weaponChanges: system.weaponChanges ?? [],
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
      burstControlAmmoReduction: system.burstControlAmmoReduction ?? 0,
      beginnerFriendly: !!system.beginnerFriendly,
      targetVitalsPenaltyReduction: system.targetVitalsPenaltyReduction ?? 0,
      // ── Applied affliction (coated toxins) ──
      appliesAffliction: !!system.appliesAffliction,
      afflictionPrimary: system.afflictionPrimary ?? 'body',
      afflictionSkill: system.afflictionSkill ?? 'endurance',
      afflictionDv: system.afflictionDv ?? 13,
      afflictionDamageFormula: system.afflictionDamageFormula ?? '2d6',
      afflictionResistDamage: system.afflictionResistDamage ?? '1d6',
      afflictionEffectId: system.afflictionEffectId ?? '',
      afflictionDurationFormula: system.afflictionDurationFormula ?? '40 - 2 * body',
      description: description || '',
    },
  };
}

/** Active Effect template for a coated toxin: stat-check penalties, applied to
 *  the struck target on a failed save (copied by applyAfflictionEffect). */
const toxinAE = (name, changes) => ({
  name,
  disabled: true,
  transfer: false,
  changes: changes.map((c) => ({ priority: 20, mode: 2, ...c })),
  flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
});

// ═══════════════════════════════════════════════════════════════════════════
//   SHORT SCOPES — pistols + SMGs
// ═══════════════════════════════════════════════════════════════════════════

const shortScopes = [
  modItem({ name: 'Militech CQO Kanone Mini Mk.72', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech CQO Kanone MINI Mk72.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2 },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> target is treated as 2m closer.</p><p><strong>RUGGED:</strong> 10 HP, immune to most scope-blocking tech.</p>') }),
  modItem({ name: 'Tsunami Hyakume', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_SCOPES, 'Tsunami Arms Hyakume.png'),
    system: { scopeType: 'short', digitalLink: true, thermalImaging: true },
    description: desc('<p><strong>DIGITAL LINK:</strong> connected user sacrifices Move action → <strong>+1</strong> attacks with this weapon that turn.</p><p><strong>THERMAL IMAGING:</strong> darkness/smoke imposes no worse than <strong>-1</strong> penalty.</p>') }),
  modItem({ name: 'Budget Arms Add-Vantage', manufacturer: 'Budget Arms', cost: 'EV', imgPath: img(M_SCOPES, 'Budget Arms Add-Vantage.png'),
    system: { scopeType: 'short', beginnerFriendly: true },
    description: desc('<p><strong>BEGINNER FRIENDLY:</strong> if user has no <strong>Handgun</strong> ranks → <strong>+1</strong> attack.</p>') }),
  modItem({ name: 'Kang Tao Type-2067', manufacturer: 'Kang Tao', cost: 'CO', imgPath: img(M_SCOPES, 'Kang Tao Type-2067.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2 },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> 2m closer.</p><p><strong>REFLECTOR GLASS:</strong> anti-dazzle / anti-glare while aiming.</p>') }),
  modItem({ name: 'Arasaka Kanetsugo', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_SCOPES, 'Arasaka Kanetsugo.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2, highlightedVitals: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> 2m closer.</p><p><strong>HIGHLIGHTED VITALS:</strong> roll an extra <strong>1d6</strong> separately from damage; if that die = 6 AND at least one damage die = 6 → automatic critical injury.</p>') }),
  modItem({ name: 'Softsys Handyman', manufacturer: 'Softsys', cost: 'PR', imgPath: img(M_SCOPES, 'SoftSys Handyman.png'),
    system: { scopeType: 'short', digitalLink: true },
    description: desc('<p><strong>DIGITAL LINK:</strong> connected user sacrifices Move action → <strong>+1</strong> attacks with this weapon that turn.</p>') }),
  modItem({ name: 'Kiroshi OS-1 Gimlet Eye', manufacturer: 'Kiroshi Optics', cost: 'C', imgPath: img(M_SCOPES, 'Kiroshi OS-1 GimletEye.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> target up to 4m closer or farther.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   LONG SCOPES — shotguns, MGs, ARs, PRs
// ═══════════════════════════════════════════════════════════════════════════

const longScopes = [
  modItem({ name: 'Nokota E255 Percipient', manufacturer: 'Nokota', cost: 'PR', imgPath: img(M_SCOPES, 'Nokota E255 Percipient.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true, thermalImaging: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> 4m closer or farther.</p><p><strong>THERMAL IMAGING:</strong> darkness/smoke imposes no worse than <strong>-1</strong> penalty.</p>') }),
  modItem({ name: 'Militech Mk.2X Grandstand', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech Mk2x Grandstand.png'),
    system: { scopeType: 'long', thermalImaging: true },
    description: desc('<p><strong>DIGITAL FEED:</strong> user can access the scope\'s vision as a video feed (narrative). Thermal Imaging.</p>') }),
  modItem({ name: 'Arasaka SO-21 Saika', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_SCOPES, 'Arasaka SO-21 Saika.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 6, rangeImprovementBidirectional: true, trajectoryCalculations: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> 6m closer or farther.</p><p><strong>TRAJECTORY CALCULATIONS:</strong> <strong>+1</strong> attacks against targets more than 40m away.</p>') }),
  modItem({ name: 'Amutek Kairo SA-1', manufacturer: 'Amutek', cost: 'C', imgPath: img(M_SCOPES, 'Amutek Kairo SA-1.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> 4m closer or farther.</p>') }),
  modItem({ name: 'Militech ClearVue Mk.8', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech ClearVue Mk.8.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true, burstControlAmmoReduction: 2 },
    description: desc('<p><strong>BURST CONTROL:</strong> autofire uses 2 fewer ammo (minimum 8).</p><p><strong>RANGE IMPROVEMENT:</strong> 4m closer or farther.</p>') }),
  modItem({ name: 'Kang Tao Jue', manufacturer: 'Kang Tao', cost: 'CO', imgPath: img(M_SCOPES, 'Kang tao jue.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 6, rangeImprovementBidirectional: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> 6m closer or farther.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SNIPER SCOPES — sniper rifle only
// ═══════════════════════════════════════════════════════════════════════════

const sniperScopes = [
  modItem({ name: 'Tsunami Gaki', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(M_SCOPES, 'Tsunami Gaki.png'),
    system: { scopeType: 'sniper', requiresTechWeapon: true, improvedCharge: true, rangeImprovementMeters: 20, rangeImprovementBidirectional: true },
    description: desc('<p>TW sniper rifle only.</p><p><strong>IMPROVED CHARGE:</strong> while charging or maintaining charge, user may move up to 2m or <strong>MOVE</strong> (whichever is lower) as a Move action.</p><p><strong>RANGE IMPROVEMENT:</strong> up to 20m closer or farther.</p>') }),
  modItem({ name: 'Militech HPO Kanone Max Mk.77', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech HPO Kanone MAX Mk77.png'),
    system: { scopeType: 'sniper', blockedOnSmart: true, blockedOnTech: true, rangeImprovementMeters: 10, rangeImprovementBidirectional: true },
    description: desc('<p>SR only; not Smart or Tech.</p><p><strong>RANGE IMPROVEMENT:</strong> up to 10m closer or farther.</p>') }),
  modItem({ name: 'Federated Arms Hawk Eye', manufacturer: 'Federated Arms', cost: 'CO', imgPath: img(M_SCOPES, 'Federated Arms Hawk Eye.png'),
    system: { scopeType: 'sniper', blockedOnSmart: true, blockedOnTech: true, calibration: true },
    description: desc('<p>SR only; not Smart or Tech.</p><p><strong>CALIBRATION:</strong> Action <strong style="color: var(--cpb-accent);">DV15</strong> <strong>INT</strong>+<strong>Shoulder Arms</strong>; on success, gain <strong>+8</strong> attack OR double <strong>Shoulder Arms</strong> skill (whichever lower) until you fire, Move, or take another action.</p>') }),
  modItem({ name: 'Nokota E305 Prospecta', manufacturer: 'Nokota', cost: 'PR', imgPath: img(M_SCOPES, 'Nokota E305 Prospecta.png'),
    system: { scopeType: 'sniper', requiresTechWeapon: true, improvedCharge: true, rangeImprovementMeters: 10, rangeImprovementBidirectional: true },
    description: desc('<p>TW sniper rifle only.</p><p><strong>IMPROVED CHARGE:</strong> after the first round of charging, may move up to 2m or <strong>MOVE</strong> as a Move action.</p><p><strong>RANGE IMPROVEMENT:</strong> up to 10m closer or farther.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SILENCERS
// ═══════════════════════════════════════════════════════════════════════════

const silencers = [
  modItem({ name: 'Amutek XC-10 Cetus', manufacturer: 'Amutek', cost: 'CO', imgPath: img(M_MUZZLE, 'Amutek XC-10 Cetus.png'),
    system: { silenceDV: 10, blockedOnTech: true, reduceDmgPerDie: true, compressRof: true, steady: true },
    description: desc('<p>Pistol only (not Tech).</p><p><strong>SILENCED:</strong> <strong style="color: var(--cpb-accent);">DV10</strong> <strong>INT</strong>+<strong>Perception</strong> to hear (<strong style="color: var(--cpb-accent);">DV</strong> <strong>+1</strong> per 4m).</p><p><strong>REDUCED DAMAGE:</strong> <strong>-1</strong> per damage die. Forces RoF1.</p><p><strong>STEADY:</strong> <strong>+1</strong> attacks on turns the user does not Move.</p>') }),
  modItem({ name: 'Amutek XC-10 Strix', manufacturer: 'Amutek', cost: 'CO', imgPath: img(M_MUZZLE, 'Amutek XC-10 Strix.png'),
    system: { silenceDV: 10, reduceDmgPerDie: true, destroyedByTech: true, destroyedByRof2: true, stealthAdvantage: true },
    description: desc('<p>Pistol.</p><p><strong>SILENCED:</strong> <strong style="color: var(--cpb-accent);">DV10</strong>.</p><p><strong>REDUCED DAMAGE:</strong> <strong>-1</strong> per damage die. Destroyed by Tech use or RoF2+ firing. <strong>Stealth</strong> Advantage.</p>') }),
  modItem({ name: 'Militech TSX Tocororo', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_MUZZLE, 'Militech TSX Tocororo.png'),
    system: { silenceDV: 8, reduceDmgPerDie: true, compressRof: true, destroyedByTech: true, stealthAdvantage: true },
    description: desc('<p>Pistol or PR.</p><p><strong>SILENCED:</strong> <strong style="color: var(--cpb-accent);">DV8</strong>.</p><p><strong>REDUCED DAMAGE:</strong> <strong>-1</strong> per damage die after SP. Forces RoF1. Destroyed by Tech use. <strong>Stealth</strong> Advantage.</p>') }),
  modItem({ name: 'Militech CS-1 Taipan', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_MUZZLE, 'Militech CS-1 Taipan.png'),
    system: { silenceDV: 10, reduceDmgPerDie: true, compressRof: true, destroyedByTech: true, stealthAdvantage: true },
    description: desc('<p>Pistol or PR.</p><p><strong>SILENCED:</strong> <strong style="color: var(--cpb-accent);">DV10</strong>.</p><p><strong>REDUCED DAMAGE:</strong> <strong>-1</strong> per damage die. Forces RoF1. Destroyed by Tech use. <strong>Stealth</strong> Advantage.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MUZZLE BREAKS — RC-7 Series (all share Lost Force)
// ═══════════════════════════════════════════════════════════════════════════

const pistolMuzzleBreaks = [
  modItem({ name: 'Arasaka RC-7 Yokai', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_MUZZLE, 'Arasaka RC-7 Yokai.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Arasaka', synergyDiceThreshold: 4 },
    description: desc('<p>Pistol muzzle break (not Tech).</p><p><strong>LOST FORCE:</strong> critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILISED RECOIL:</strong> <strong>+1</strong> attacks.</p><p><strong>SYNERGY:</strong> <strong>+1</strong> dmg from Arasaka weapon; <strong>+1</strong> more if the weapon has ≥4 damage dice.</p>') }),
  modItem({ name: 'Tsunami RC-7 Kutrub', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_MUZZLE, 'Tsunami RC-7 Kutrub.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Tsunami Arms', synergyDiceThreshold: 4 },
    description: desc('<p>Pistol muzzle break (not Tech). Lost Force.</p><p><strong>STABILISED RECOIL:</strong> <strong>+1</strong> attacks.</p><p><strong>SYNERGY:</strong> <strong>+1</strong> dmg from Tsunami Arms weapon; <strong>+1</strong> more if ≥4 damage dice.</p>') }),
  modItem({ name: 'Militech RC-7 Liger', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_MUZZLE, 'Militech RC-7 Liger.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1 },
    description: desc('<p>Pistol muzzle break (not Tech). Lost Force. <strong>+1</strong> attacks. If the attack d10 rolls 1, may reroll once (must use the new result).</p>') }),
  modItem({ name: 'Malorian RC-7 Dybbuk', manufacturer: 'Malorian Arms', cost: 'PR', imgPath: img(M_MUZZLE, 'Maloran Arms RC-7 Dybbuk.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Malorian Arms' },
    description: desc('<p>Pistol muzzle break (not Tech). Lost Force. <strong>+1</strong> attacks.</p><p><strong>SPECIALIZED:</strong> <strong>+1</strong> damage from revolver weapons.</p>') }),
  modItem({ name: 'Militech RC-7 Babaroga', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_MUZZLE, 'Militech RC-7 Babaroga.png'),
    system: { blockedOnTech: true, lostForce: true, directedRecoil: true },
    description: desc('<p>Pistol muzzle break (not Tech). Lost Force.</p><p><strong>DIRECTED RECOIL:</strong> PW ricochet penalty reduced by 1 (no attack bonus).</p>') }),
];

const rifleMuzzleBreaks = [
  modItem({ name: 'Arasaka RC-7 Aswang', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_MUZZLE, 'Arasaka RC-7 Aswang.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Arasaka', synergyDiceThreshold: 4 },
    description: desc('<p>AR/SMG muzzle break (not Tech). Lost Force. <strong>+1</strong> attacks.</p><p><strong>SYNERGY:</strong> <strong>+1</strong> dmg from Arasaka weapon; <strong>+1</strong> more if ≥4 damage dice.</p>') }),
  modItem({ name: 'Rostovic RC-7 Strigoi', manufacturer: 'Rostovic', cost: 'CO', imgPath: img(M_MUZZLE, 'Rostovic RC-7 Strigoi.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, recoilAFOnly: true, accidentalDischarge: true },
    description: desc('<p>AR/SMG muzzle break (not Tech). Lost Force. <strong>+1</strong> on autofire attacks only.</p><p><strong>ACCIDENTAL DISCHARGE:</strong> on a single shot with an odd attack die, the weapon uses 2× ammo (if available) and deals <strong>+1</strong> damage per die.</p>') }),
  modItem({ name: 'Nokota RC-7 Zaar', manufacturer: 'Nokota', cost: 'CO', imgPath: img(M_MUZZLE, 'Nokota RC-7 Zaar.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, recoilAFOnly: true },
    description: desc('<p>AR/SMG muzzle break (not Tech). Lost Force. <strong>+1</strong> on autofire attacks only.</p>') }),
  modItem({ name: 'Militech RC-7 Varkolak', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_MUZZLE, 'Militech RC-7 Varkolak.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, directedRecoil: true },
    description: desc('<p>AR/SMG muzzle break (not Tech). Lost Force. <strong>+1</strong> attacks.</p><p><strong>DIRECTED RECOIL:</strong> PW ricochet penalty reduced by 1.</p>') }),
  modItem({ name: 'Techtronika RC-7 Ifrit', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(M_MUZZLE, 'Techtronika RC-7 Ifrit.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, closeRangeBonus: true },
    description: desc('<p>AR/SMG muzzle break (not Tech). Lost Force. <strong>+1</strong> attacks. Extra <strong>+1</strong> attacks against targets within 20m.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   GENERAL ATTACHMENTS / WEAPON MODS
// ═══════════════════════════════════════════════════════════════════════════

const attachments = [
  modItem({ name: 'Fuyutsuki Action Cam', manufacturer: 'Fuyutsuki', cost: 'PR', imgPath: img(M_ROOT, 'Fuyutsuki Action Cam.png'),
    system: {},
    description: desc('<p><strong>CAMERA:</strong> on/off switch or trigger-auto. Battery + memory last 1 hour; 1h to recharge.</p>') }),
  modItem({ name: 'Arasaka Stability Calibrator', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_ROOT, 'Arasaka Stability Calibrator.png'),
    system: { handlingComputer: true },
    description: desc('<p>Bullet-firing weapons only.</p><p><strong>HANDLING COMPUTER:</strong> <strong>+1</strong> attacks if last attack was in same direction and the user took no Move/physical action since.</p><p><strong>EMP SHIELDING:</strong> only <strong style="color: var(--cpb-accent);">DV</strong>>16 effects can disable.</p>') }),
  modItem({ name: 'Militech MF Selector', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_ROOT, 'Militech MF Selector.png'),
    system: {},
    description: desc('<p>Bullet-firing weapons only.</p><p><strong>MAGAZINE FEED:</strong> switch to next ammo type in magazine as a free action; on Militech weapons can switch to any loaded round.</p>') }),
  modItem({ name: 'Budget Arms Depot Grip', manufacturer: 'Budget Arms', cost: 'EV', imgPath: img(M_ROOT, 'Budget Arms Depot Grip.png'),
    system: {},
    description: desc('<p>Replaces grip.</p><p><strong>HIDDEN COMPARTMENT:</strong> <strong>+2</strong> to conceal anything in the grip.</p><p><strong>NOTE:</strong> weapons priced €$500+ suffer <strong>-1</strong> attacks vs their default grip.</p>') }),
  modItem({ name: 'Militech Type II Grip', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech Type II Grip.png'),
    system: { recoilBonus: 1, recoilAFOnly: true, steady: true,
      weaponChanges: [
        { id: '', key: 'hands',       mode: 'override', value: '2'     },
        { id: '', key: 'concealable', mode: 'override', value: 'false' },
      ] },
    description: desc('<p>1-hand firearm only. Forward grip (now requires 2 hands). Improved <strong>Autofire</strong>: <strong>+1</strong> autofire attacks.</p><p><strong>STEADY:</strong> <strong>+1</strong> attack if only fired once this turn.</p>') }),
  modItem({ name: 'Militech SR Capacity', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech SR Capacity.png'),
    system: { requiresTechWeapon: true, srCapacity: true },
    description: desc('<p>Tech weapon only (SG/AR/PR/SR).</p><p><strong>HIGH-CAPACITY BATTERY:</strong> can still Move while charging (at half <strong>MOVE</strong>); a hit past SP deals <strong>+2</strong> damage to HP (electrical).</p><p><strong>CUMBERSOME:</strong> <strong>-1</strong> all attacks vs standard stock; cannot conceal.</p>') }),
  modItem({ name: 'Tsunami Hakatome', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(M_ROOT, 'Tsunami Hakatome.png'),
    system: {
      steady: true,
      weaponChanges: [
        { id: 'hakatome-skill', key: 'skill', mode: 'override', value: 'shoulderArms' },
        { id: 'hakatome-hands', key: 'hands', mode: 'override', value: '2' },
        { id: 'hakatome-conceal', key: 'concealable', mode: 'override', value: 'false' },
      ],
    },
    description: desc('<p>Stock Mod for 1-hand firearms.</p><p><strong>STEADY:</strong> <strong>+1</strong> attack if user did not Move this turn.</p><p><strong>SHOULDER STOCK:</strong> now requires 2 hands; cannot conceal; uses <strong>Shoulder Arms</strong> skill.</p>') }),
  modItem({ name: 'Malorian Critical Ricochet', manufacturer: 'Malorian Arms', cost: 'PR', imgPath: img(M_ROOT, 'Malorian Critical Ricochet.png'),
    system: { requiresPowerWeapon: true, improvedRicochet: true },
    description: desc('<p>Power weapon only. Action Assembly.</p><p><strong>IMPROVED RICOCHET:</strong> a successful ricochet hit deals <strong>+1</strong> damage per die of base weapon damage.</p>') }),
  modItem({ name: 'Militech TWA Boomerang', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech TWA Boomerang.png'),
    system: { requiresLightMelee: true },
    description: desc('<p>Light Melee weapons designed to be thrown only.</p><p><strong>RETURN THRUSTER:</strong> silently returns to thrower\'s wireless hand-signal at start of next turn if within 50m and no obstacles. Holding it still requires <strong style="color: var(--cpb-accent);">DV12</strong> <strong>BODY</strong>+<strong>Athletics</strong>.</p>') }),
  modItem({ name: 'Militech 4X Action Repeater', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech 4x Action Repeater.png'),
    system: {},
    description: desc('<p>Bullet-firing weapons.</p><p><strong>RECOIL ACTION:</strong> on a single-shot attack, also roll <strong>1d6</strong>; on 6 → make an additional attack immediately vs the same target with no recoil penalty.</p>') }),
  modItem({ name: 'Tsunami Ketsuretsu', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_ROOT, 'Tsunami Ketsuretsu.png'),
    system: { requiresTechWeapon: true, barrierPenetration: true },
    description: desc('<p>Tech weapon only. Tech Barrel Mod.</p><p><strong>BARRIER PENETRATION:</strong> for each damage die showing 5 or 6, one extra point of damage ignores SP / barrier HP.</p>') }),
  modItem({ name: 'Kang Tao Zhànshǒu', manufacturer: 'Kang Tao', cost: 'PR', imgPath: img(M_ROOT, 'Kang Tao Zhanshou.png'),
    system: { requiresSmartWeapon: true, targetVitalsPenaltyReduction: 1 },
    description: desc('<p>Smart weapon only. Smart Targeting.</p><p><strong>TARGET VITALS:</strong> head/vital penalty reduced by 1; smart ammo using guidance reduces by 1 more and always targets vitals.</p>') }),
  modItem({ name: 'Kendachi Shi Bayonet', manufacturer: 'Kendachi', cost: 'C', imgPath: img(M_ROOT, 'Kendachi bayonet.png'),
    system: { bayonet: true },
    description: desc('<p>Any long weapon (not most pistols/SMGs).</p><p><strong>MELEE WEAPON ATTACHED:</strong> ignores ½ SP.</p><p><strong>BAYONET STATS:</strong> DMG <strong>1d6</strong>, RoF 2.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   UNDER-BARREL SUB-WEAPONS (2 modification slots)
// ═══════════════════════════════════════════════════════════════════════════

const underBarrels = [
  modItem({ name: 'Rostovic BP-2 Plujka', manufacturer: 'Rostovic', cost: 'PR', imgPath: img(M_ROOT, 'Rostovic BP-2 Plujka.png'),
    system: { modSlots: 2 },
    description: desc('<p>Under-Barrel Shotgun (AR or SG host, 2 mod slots).</p><p><strong>STATS:</strong> <strong>5d6</strong> / RoF 1 / 1 ammo / RCL 2 / range 13,15,20,25,30,35. PW + JAM.</p><p><strong>SHELL MODE:</strong> <strong style="color: var(--cpb-accent);">DV11</strong>, <strong>3d6</strong> in 8/8m cone.</p>') }),
  modItem({ name: 'Constitutional Arms Cavalry', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(M_ROOT, 'Constitutional Arms Cavalry.png'),
    system: { modSlots: 2 },
    description: desc('<p>Under-Barrel Shotgun (AR or SG host, 2 mod slots). <strong>5d6</strong> / RoF 1 / 1 ammo / RCL 2 / range 13,15,20,25,30,35. PW.</p><p><strong>SHELL MODE:</strong> <strong style="color: var(--cpb-accent);">DV13</strong>, <strong>3d6</strong> in 8/8m cone.</p>') }),
  modItem({ name: 'Militech EFMO2 Boulder', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_ROOT, 'Militech EFMO2 Boulder.png'),
    system: { modSlots: 2 },
    description: desc('<p>Under-Barrel Grenade Launcher (AR or SG host, 2 mod slots). <strong>6d6</strong> / RoF 1 / 1 ammo / RCL 1 / range 10,15,18,25,35.</p><p><strong>EXPLOSIVES:</strong> basic grenades <strong>6d6</strong> in 4/8m sphere; miss → lands <strong>2d6</strong>m off in a random direction.</p>') }),
  modItem({ name: 'Midnight Arms WA20 GL', manufacturer: 'Midnight Arms', cost: 'PR', imgPath: img(M_ROOT, 'Midnight Arms WA20 GL1.png'),
    system: { modSlots: 2 },
    description: desc('<p>Under-Barrel Grenade Launcher (AR or SG host, 2 mod slots). Same as Boulder.</p><p><strong>POOR BALANCE:</strong> <strong>-1</strong> attacks with main weapon.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   ACCESSORIES (magazines)
// ═══════════════════════════════════════════════════════════════════════════

const accessories = [
  modItem({ name: 'Extended Magazine', manufacturer: '', cost: 'CO', imgPath: img(M_ROOT, 'Extended mag.png'),
    system: {},
    description: desc('<p>Doubles ammo capacity (or cap below, whichever is lower). Cannot conceal.</p><p><strong>CAPS:</strong> MP 18, HP/VHP 14, SMG 40, HvySMG 50, SG 8, AR 35, PR 20, SR 8, GL 4, RL 2.</p>') }),
  modItem({ name: 'Drum Magazine', manufacturer: '', cost: 'PR', imgPath: img(M_ROOT, 'Drum mag.png'),
    system: {},
    description: desc('<p>Quadruples ammo capacity (or cap below, whichever is lower). Cannot conceal.</p><p><strong>CAPS:</strong> MP 36, HP/VHP 28, SMG 50, HvySMG 60, SG 16, AR 45, PR 35, SR 12, GL 6, RL 3.</p>') }),
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
    description: desc('<p>Architecture Hardware add-on. Nitrogen cooling throughout the system. Device is immune to fire-inducing program effects. <strong>+1</strong> active program slot.</p>'),
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
    description: desc('<p>Architecture Hardware add-on. Adds <strong>+1</strong> DATA node to the device. Can be purchased multiple times (servers only).</p>'),
  }),
  modItem({
    name: 'Backup Drive',
    cost: 'PR',
    system: { modType: 'computerMod', modSlots: 2 },
    description: desc('Hardware MOD — 2 hardware slots. Non-Black ICE programs deleted from the host device are saved separately; they can be retrieved as a full Action.'),
  }),
  modItem({
    name: 'DNA Lock',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('<p>Hardware MOD — 1 hardware slot. Biometric lock. Bypass <strong style="color: var(--cpb-accent);">DV</strong>: 17 <strong>TECH</strong>+<strong>Electronics</strong> (Security).</p>'),
  }),
  modItem({
    name: 'Hardened Circuitry',
    cost: 'EX',
    imgPath: `systems/cyberpunk-blue/assets/items/mods/hardware-mod-hardened-circuitry.png`,
    system: { modType: 'computerMod' },
    description: desc('Hardware MOD — 1 hardware slot. The host device is immune to EMP, microwave pulses, and non-Black ICE programs.'),
  }),
  modItem({
    name: 'Insulated Wiring',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('Hardware MOD — 1 hardware slot. The host device, its user, and their clothes will not catch fire from program effects.'),
  }),
  modItem({
    name: 'KRASH-Barrier',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('Hardware MOD — 1 hardware slot. Unsafe disconnections are made safe.'),
  }),
  modItem({
    name: 'Range Upgrade',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('Hardware MOD — 1 hardware slot. Doubles the host device\'s wireless connection range.'),
  }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   APPLIED TOXINS — weapon-coating mods (any weapon)
// ═══════════════════════════════════════════════════════════════════════════
//
// A coated toxin is a weaponMod that, on a hit drawing blood (net damage > 0),
// forces the target to save (BODY + Endurance) or suffer HP damage and a
// lingering stat-check penalty for 40 − 2×BODY minutes. Even a successful resist
// still does a little HP. Resolution lives in affliction-attack.mjs
// (resolveAppliedAffliction), triggered from combat-resolution.mjs.

const toxinMods = [
  modItem({
    name: 'Toxin',
    cost: 'PR',
    system: {
      modType: 'weaponMod',
      appliesAffliction: true,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13,
      afflictionDamageFormula: '2d6', afflictionResistDamage: '1d6',
      afflictionDurationFormula: '40 - 2 * body',
    },
    effects: [toxinAE('Toxin', [{ key: 'system.stats.body.rollMod', value: '-1' }])],
    description: desc('<p>Coat a weapon. On a hit that draws blood, target rolls <strong>BODY</strong> + <strong>Endurance</strong> vs <strong style="color: var(--cpb-accent);">DV13</strong> or takes <strong>2d6</strong> HP and <strong>−1</strong> to <strong>BODY</strong> checks for 40 − (2 × <strong>BODY</strong>) minutes. On a successful resist, still take <strong>1d6</strong> HP.</p>'),
  }),
  modItem({
    name: 'Toxin, Strong',
    cost: 'EX',
    system: {
      modType: 'weaponMod',
      appliesAffliction: true,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 15,
      afflictionDamageFormula: '3d6', afflictionResistDamage: '1d6',
      afflictionDurationFormula: '40 - 2 * body',
    },
    effects: [toxinAE('Toxin, Strong', [
      { key: 'system.stats.body.rollMod', value: '-1' },
      { key: 'system.stats.rflx.rollMod', value: '-1' },
    ])],
    description: desc('<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Coat a weapon. On a hit that draws blood, target rolls <strong>BODY</strong> + <strong>Endurance</strong> vs <strong style="color: var(--cpb-accent);">DV15</strong> or takes <strong>3d6</strong> HP and <strong>−1</strong> to both <strong>BODY</strong> and <strong>RFLX</strong> checks for 40 − (2 × <strong>BODY</strong>) minutes. On a successful resist, still take <strong>1d6</strong> HP.</p>'),
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
  ...toxinMods,
];
