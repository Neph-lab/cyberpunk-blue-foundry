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
      requiresLightMelee: !!system.requiresLightMelee,
      blockedOnPower: !!system.blockedOnPower,
      blockedOnSmart: !!system.blockedOnSmart,
      blockedOnTech: !!system.blockedOnTech,
      silenceDV: system.silenceDV ?? 0,
      destroyedByTech: !!system.destroyedByTech,
      destroyedByRof2: !!system.destroyedByRof2,
      reduceDmgPerDie: !!system.reduceDmgPerDie,
      damagePerDie: system.damagePerDie ?? 0,
      narrowConeShell: !!system.narrowConeShell,
      coneAttackBonus: system.coneAttackBonus ?? 0,
      coneDamageBonusDice: system.coneDamageBonusDice ?? '',
      activatable: !!system.activatable,
      activationIcon: system.activationIcon ?? 'power-off',
      activationBlocksMove: !!system.activationBlocksMove,
      activationSelfEffect: system.activationSelfEffect ?? '',
      activeDamageDice: system.activeDamageDice ?? '',
      activeAblateExtra: !!system.activeAblateExtra,
      activeAttackBonus: system.activeAttackBonus ?? 0,
      activeThermalBurn: !!system.activeThermalBurn,
      activeVibroStun: !!system.activeVibroStun,
      doubleMagazine: !!system.doubleMagazine,
      postHitAttackBonusAE: !!system.postHitAttackBonusAE,
      skachok: !!system.skachok,
      critTriplePick: !!system.critTriplePick,
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
      // ── Conditional attack / movement bonuses (situational) ──
      steady: !!system.steady,
      handlingComputer: !!system.handlingComputer,
      closeRangeBonus: !!system.closeRangeBonus,
      trajectoryCalculations: !!system.trajectoryCalculations,
      calibration: !!system.calibration,
      barrierPenetration: !!system.barrierPenetration,
      improvedRicochet: !!system.improvedRicochet,
      improvedCharge: !!system.improvedCharge,
      srCapacity: !!system.srCapacity,
      accidentalDischarge: !!system.accidentalDischarge,
      bayonet: !!system.bayonet,
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
  changes: changes.map((c) => ({ priority: 20, type: 'add', ...c })),
  flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
});

// ═══════════════════════════════════════════════════════════════════════════
//   SHORT SCOPES — pistols + SMGs
// ═══════════════════════════════════════════════════════════════════════════

const shortScopes = [
  modItem({ name: 'Militech CQO Kanone Mini Mk.72', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech-CQO-Kanone-MINI-Mk72.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2 },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as 2m closer.</p><p><strong>RUGGED:</strong> The scope has 10 HP and is immune to most scope-blocking tech.</p>') }),
  modItem({ name: 'Tsunami Hyakume', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_SCOPES, 'Tsunami-Arms-Hyakume.png'),
    system: { scopeType: 'short', digitalLink: true, thermalImaging: true },
    description: desc('<p><strong>DIGITAL LINK:</strong> A connected user may sacrifice their Move action to gain <strong>+1</strong> to attacks with this weapon that turn.</p><p><strong>THERMAL IMAGING:</strong> Darkness and smoke impose no worse than a <strong>-1</strong> penalty.</p>') }),
  modItem({ name: 'Budget Arms Add-Vantage', manufacturer: 'Budget Arms', cost: 'EV', imgPath: img(M_SCOPES, 'Budget-Arms-Add-Vantage.png'),
    system: { scopeType: 'short', beginnerFriendly: true },
    description: desc('<p><strong>BEGINNER FRIENDLY:</strong> A user with no <strong>Handgun</strong> ranks gains <strong>+1</strong> to attacks.</p>') }),
  modItem({ name: 'Kang Tao Type-2067', manufacturer: 'Kang Tao', cost: 'CO', imgPath: img(M_SCOPES, 'Kang-Tao-Type-2067.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2 },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as 2m closer.</p><p><strong>REFLECTOR GLASS:</strong> The user is protected against dazzle and glare while aiming.</p>') }),
  modItem({ name: 'Arasaka Kanetsugo', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_SCOPES, 'Arasaka-Kanetsugo.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 2, highlightedVitals: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as 2m closer.</p><p><strong>HIGHLIGHTED VITALS:</strong> Roll an extra <strong>1d6</strong> separately from damage. If that die comes up 6 and at least one damage die also comes up 6, the hit is an automatic critical injury.</p>') }),
  modItem({ name: 'SoftSys Handyman', manufacturer: 'SoftSys', cost: 'PR', imgPath: img(M_SCOPES, 'SoftSys-Handyman.png'),
    system: { scopeType: 'short', digitalLink: true },
    description: desc('<p><strong>DIGITAL LINK:</strong> A connected user may sacrifice their Move action to gain <strong>+1</strong> to attacks with this weapon that turn.</p>') }),
  modItem({ name: 'Kiroshi OS-1 Gimlet Eye', manufacturer: 'Kiroshi Opticals', cost: 'C', imgPath: img(M_SCOPES, 'Kiroshi-OS-1-GimletEye.png'),
    system: { scopeType: 'short', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 4m closer or farther.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   LONG SCOPES — shotguns, MGs, ARs, PRs
// ═══════════════════════════════════════════════════════════════════════════

const longScopes = [
  modItem({ name: 'Nokota E255 Percipient', manufacturer: 'Nokota', cost: 'PR', imgPath: img(M_SCOPES, 'Nokota-E255-Percipient.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true, thermalImaging: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 4m closer or farther.</p><p><strong>THERMAL IMAGING:</strong> Darkness and smoke impose no worse than a <strong>-1</strong> penalty.</p>') }),
  modItem({ name: 'Militech Mk.2X Grandstand', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech-Mk2x-Grandstand.png'),
    system: { scopeType: 'long', thermalImaging: true },
    description: desc('<p><strong>DIGITAL FEED:</strong> The user can access the scope&rsquo;s vision as a video feed, which is handled narratively. The scope also provides Thermal Imaging.</p>') }),
  modItem({ name: 'Arasaka SO-21 Saika', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_SCOPES, 'Arasaka-SO-21-Saika.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 6, rangeImprovementBidirectional: true, trajectoryCalculations: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 6m closer or farther.</p><p><strong>TRAJECTORY CALCULATIONS:</strong> The user gains <strong>+1</strong> to attacks against targets more than 40m away.</p>') }),
  modItem({ name: 'AmuTek Kairo SA-1', manufacturer: 'AmuTek', cost: 'C', imgPath: img(M_SCOPES, 'Amutek-Kairo-SA-1.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 4m closer or farther.</p>') }),
  modItem({ name: 'Militech ClearVue Mk.8', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech-ClearVue-Mk.8.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 4, rangeImprovementBidirectional: true, burstControlAmmoReduction: 2 },
    description: desc('<p><strong>BURST CONTROL:</strong> Autofire uses 2 fewer rounds of ammunition, to a minimum of 8.</p><p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 4m closer or farther.</p>') }),
  modItem({ name: 'Kang Tao Jue', manufacturer: 'Kang Tao', cost: 'CO', imgPath: img(M_SCOPES, 'Kang-tao-jue.png'),
    system: { scopeType: 'long', rangeImprovementMeters: 6, rangeImprovementBidirectional: true },
    description: desc('<p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 6m closer or farther.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SNIPER SCOPES — sniper rifle only
// ═══════════════════════════════════════════════════════════════════════════

const sniperScopes = [
  modItem({ name: 'Tsunami Gaki', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(M_SCOPES, 'Tsunami-Gaki.png'),
    system: { scopeType: 'sniper', requiresTechWeapon: true, improvedCharge: true, rangeImprovementMeters: 20, rangeImprovementBidirectional: true },
    description: desc('<p><strong>FITS:</strong> Tech Weapon sniper rifles only.</p><p><strong>IMPROVED CHARGE:</strong> While charging or maintaining a charge, the user may move up to 2m or their <strong>MOVE</strong>, whichever is lower, as a Move action.</p><p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 20m closer or farther.</p>') }),
  modItem({ name: 'Militech HPO Kanone Max Mk.77', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_SCOPES, 'Militech-HPO-Kanone-MAX-Mk77.png'),
    system: { scopeType: 'sniper', blockedOnSmart: true, blockedOnTech: true, rangeImprovementMeters: 10, rangeImprovementBidirectional: true },
    description: desc('<p><strong>FITS:</strong> Sniper rifles only, and not Smart or Tech Weapons.</p><p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 10m closer or farther.</p>') }),
  modItem({ name: 'Federated Arms Hawk Eye', manufacturer: 'Federated Arms', cost: 'CO', imgPath: img(M_SCOPES, 'Federated-Arms-Hawk-Eye.png'),
    system: { scopeType: 'sniper', blockedOnSmart: true, blockedOnTech: true, calibration: true },
    description: desc('<p><strong>FITS:</strong> Sniper rifles only, and not Smart or Tech Weapons.</p><p><strong>CALIBRATION:</strong> Take an Action and roll <strong>INT</strong>+<strong>Shoulder Arms</strong> against <strong style="color: var(--cpb-accent);">DV 15</strong>. On a success the user gains <strong>+8</strong> to attacks, or double their <strong>Shoulder Arms</strong> skill, whichever is lower, until they fire, Move, or take another action.</p>') }),
  modItem({ name: 'Nokota E305 Prospecta', manufacturer: 'Nokota', cost: 'PR', imgPath: img(M_SCOPES, 'Nokota-E305-Prospecta.png'),
    system: { scopeType: 'sniper', requiresTechWeapon: true, improvedCharge: true, rangeImprovementMeters: 10, rangeImprovementBidirectional: true },
    description: desc('<p><strong>FITS:</strong> Tech Weapon sniper rifles only.</p><p><strong>IMPROVED CHARGE:</strong> After the first round of charging, the user may move up to 2m or their <strong>MOVE</strong> as a Move action.</p><p><strong>RANGE IMPROVEMENT:</strong> The target is treated as up to 10m closer or farther.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   SILENCERS
// ═══════════════════════════════════════════════════════════════════════════

const silencers = [
  modItem({ name: 'AmuTek XC-10 Cetus', manufacturer: 'AmuTek', cost: 'CO', imgPath: img(M_MUZZLE, 'Amutek-XC-10-Cetus.png'),
    system: { silenceDV: 10, blockedOnTech: true, reduceDmgPerDie: true, compressRof: true, steady: true },
    description: desc('<p><strong>FITS:</strong> Pistols only, and not Tech Weapons.</p><p><strong>SILENCED:</strong> Hearing the shot requires an <strong>INT</strong>+<strong>Perception</strong> check against <strong style="color: var(--cpb-accent);">DV 10</strong>, and the <strong style="color: var(--cpb-accent);">DV</strong> rises by <strong>+1</strong> for every 4m of distance.</p><p><strong>REDUCED DAMAGE:</strong> The weapon loses <strong>-1</strong> per damage die and is forced to RoF 1.</p><p><strong>STEADY:</strong> The user gains <strong>+1</strong> to attacks on turns in which they do not Move.</p>') }),
  modItem({ name: 'AmuTek XC-10 Strix', manufacturer: 'AmuTek', cost: 'CO', imgPath: img(M_MUZZLE, 'Amutek-XC-10-Strix.png'),
    system: { silenceDV: 10, reduceDmgPerDie: true, destroyedByTech: true, destroyedByRof2: true, stealthAdvantage: true },
    description: desc('<p><strong>FITS:</strong> Pistols only.</p><p><strong>SILENCED:</strong> Hearing the shot requires a check against <strong style="color: var(--cpb-accent);">DV 10</strong>.</p><p><strong>REDUCED DAMAGE:</strong> The weapon loses <strong>-1</strong> per damage die, and the silencer is destroyed by Tech use or by firing at RoF 2 or higher. It grants <strong>Stealth</strong> Advantage.</p>') }),
  modItem({ name: 'Militech TSX Tocororo', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_MUZZLE, 'Militech-TSX-Tocororo.png'),
    system: { silenceDV: 8, reduceDmgPerDie: true, compressRof: true, destroyedByTech: true, stealthAdvantage: true },
    description: desc('<p><strong>FITS:</strong> Pistols and precision rifles only.</p><p><strong>SILENCED:</strong> Hearing the shot requires a check against <strong style="color: var(--cpb-accent);">DV 8</strong>.</p><p><strong>REDUCED DAMAGE:</strong> The weapon loses <strong>-1</strong> per damage die after SP and is forced to RoF 1. The silencer is destroyed by Tech use, and it grants <strong>Stealth</strong> Advantage.</p>') }),
  modItem({ name: 'Militech CS-1 Taipan', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_MUZZLE, 'Militech-CS-1-Taipan.png'),
    system: { silenceDV: 10, reduceDmgPerDie: true, compressRof: true, destroyedByTech: true, stealthAdvantage: true },
    description: desc('<p><strong>FITS:</strong> Pistols and precision rifles only.</p><p><strong>SILENCED:</strong> Hearing the shot requires a check against <strong style="color: var(--cpb-accent);">DV 10</strong>.</p><p><strong>REDUCED DAMAGE:</strong> The weapon loses <strong>-1</strong> per damage die and is forced to RoF 1. The silencer is destroyed by Tech use, and it grants <strong>Stealth</strong> Advantage.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   MUZZLE BREAKS — RC-7 Series (all share Lost Force)
// ═══════════════════════════════════════════════════════════════════════════

const pistolMuzzleBreaks = [
  modItem({ name: 'Arasaka RC-7 Yokai', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_MUZZLE, 'Arasaka-RC-7-Yokai.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Arasaka', synergyDiceThreshold: 4 },
    description: desc('<p><strong>FITS:</strong> Pistols only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks.</p><p><strong>SYNERGY:</strong> An Arasaka weapon deals <strong>+1</strong> damage, and <strong>+1</strong> more if it has 4 or more damage dice.</p>') }),
  modItem({ name: 'Tsunami RC-7 Kutrub', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_MUZZLE, 'Tsunami-RC-7-Kutrub.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Tsunami Arms', synergyDiceThreshold: 4 },
    description: desc('<p><strong>FITS:</strong> Pistols only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks.</p><p><strong>SYNERGY:</strong> A Tsunami Arms weapon deals <strong>+1</strong> damage, and <strong>+1</strong> more if it has 4 or more damage dice.</p>') }),
  modItem({ name: 'Militech RC-7 Liger', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_MUZZLE, 'Militech-RC-7-Liger.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1 },
    description: desc('<p><strong>FITS:</strong> Pistols only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks. If the attack d10 comes up 1, they may reroll it once and must use the new result.</p>') }),
  modItem({ name: 'Malorian RC-7 Dybbuk', manufacturer: 'Malorian Arms', cost: 'PR', imgPath: img(M_MUZZLE, 'Malorian-Arms-RC-7-Dybbuk.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Malorian Arms' },
    description: desc('<p><strong>FITS:</strong> Pistols only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks.</p><p><strong>SPECIALIZED:</strong> A revolver deals <strong>+1</strong> damage.</p>') }),
  modItem({ name: 'Militech RC-7 Babaroga', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_MUZZLE, 'Militech-RC-7-Babaroga.png'),
    system: { blockedOnTech: true, lostForce: true, directedRecoil: true },
    description: desc('<p><strong>FITS:</strong> Pistols only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>DIRECTED RECOIL:</strong> The Power Weapon ricochet penalty is reduced by 1. This mod grants no attack bonus.</p>') }),
];

const rifleMuzzleBreaks = [
  modItem({ name: 'Arasaka RC-7 Aswang', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_MUZZLE, 'Arasaka-RC-7-Aswang.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, synergyBrand: 'Arasaka', synergyDiceThreshold: 4 },
    description: desc('<p><strong>FITS:</strong> Assault rifles and SMGs only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks.</p><p><strong>SYNERGY:</strong> An Arasaka weapon deals <strong>+1</strong> damage, and <strong>+1</strong> more if it has 4 or more damage dice.</p>') }),
  modItem({ name: 'Rostovic RC-7 Strigoi', manufacturer: 'Rostović', cost: 'CO', imgPath: img(M_MUZZLE, 'Rostovic-RC-7-Strigoi.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, recoilAFOnly: true, accidentalDischarge: true },
    description: desc('<p><strong>FITS:</strong> Assault rifles and SMGs only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to autofire attacks only.</p><p><strong>ACCIDENTAL DISCHARGE:</strong> On a single shot with an odd attack die, the weapon uses twice the ammunition, if it is available, and deals <strong>+1</strong> damage per die.</p>') }),
  modItem({ name: 'Nokota RC-7 Zaar', manufacturer: 'Nokota', cost: 'CO', imgPath: img(M_MUZZLE, 'Nokota-RC-7-Zaar.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, recoilAFOnly: true },
    description: desc('<p><strong>FITS:</strong> Assault rifles and SMGs only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to autofire attacks only.</p>') }),
  modItem({ name: 'Militech RC-7 Varkolak', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_MUZZLE, 'Militech-RC-7-Varkolak.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, directedRecoil: true },
    description: desc('<p><strong>FITS:</strong> Assault rifles and SMGs only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks.</p><p><strong>DIRECTED RECOIL:</strong> The Power Weapon ricochet penalty is reduced by 1.</p>') }),
  modItem({ name: 'Techtronika RC-7 Ifrit', manufacturer: 'Techtronika', cost: 'EX', imgPath: img(M_MUZZLE, 'Techtronika-RC-7-Ifrit.png'),
    system: { blockedOnTech: true, lostForce: true, recoilBonus: 1, closeRangeBonus: true },
    description: desc('<p><strong>FITS:</strong> Assault rifles and SMGs only, as a muzzle brake, and not Tech Weapons.</p><p><strong>LOST FORCE:</strong> A critical injury now requires a 6 on an additional damage die.</p><p><strong>STABILIZED RECOIL:</strong> The user gains <strong>+1</strong> to attacks, and a further <strong>+1</strong> against targets within 20m.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   GENERAL ATTACHMENTS / WEAPON MODS
// ═══════════════════════════════════════════════════════════════════════════

const attachments = [
  modItem({ name: 'Fuyutsuki Action Cam', manufacturer: 'Fuyutsuki', cost: 'PR', imgPath: img(M_ROOT, 'Fuyutsuki-Action-Cam.png'),
    system: {},
    description: desc('<p><strong>CAMERA:</strong> The camera runs from an on/off switch or fires automatically with the trigger. Its battery and memory last 1 hour, and it takes 1 hour to recharge.</p>') }),
  modItem({ name: 'Arasaka Stability Calibrator', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_ROOT, 'Arasaka-Stability-Calibrator.png'),
    system: { handlingComputer: true },
    description: desc('<p><strong>FITS:</strong> Bullet-firing weapons only.</p><p><strong>HANDLING COMPUTER:</strong> The user gains <strong>+1</strong> to attacks if their last attack was in the same direction and they have taken no Move or physical action since.</p><p><strong>EMP SHIELDING:</strong> Only effects above <strong style="color: var(--cpb-accent);">DV 16</strong> can disable this mod.</p>') }),
  modItem({ name: 'Militech MF Selector', manufacturer: 'Militech', cost: 'CO', imgPath: img(M_ROOT, 'Militech-MF-Selector.png'),
    system: {},
    description: desc('<p><strong>FITS:</strong> Bullet-firing weapons only.</p><p><strong>MAGAZINE FEED:</strong> The user can switch to the next ammunition type in the magazine as a free action. On Militech weapons they can switch to any loaded round.</p>') }),
  modItem({ name: 'Budget Arms Depot Grip', manufacturer: 'Budget Arms', cost: 'EV', imgPath: img(M_ROOT, 'Budget-Arms-Depot-Grip.png'),
    system: {},
    description: desc('<p>This mod replaces the weapon&rsquo;s grip.</p><p><strong>HIDDEN COMPARTMENT:</strong> The user gains <strong>+2</strong> to conceal anything stored in the grip.</p><p><strong>NOTE:</strong> Weapons priced at &euro;$500 or more suffer <strong>-1</strong> to attacks compared to their default grip.</p>') }),
  modItem({ name: 'Militech Type II Grip', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech-Type-II-Grip.png'),
    system: { recoilBonus: 1, recoilAFOnly: true, steady: true,
      weaponChanges: [
        { id: '', key: 'hands',       mode: 'override', value: '2'     },
        { id: '', key: 'concealable', mode: 'override', value: 'false' },
      ] },
    description: desc('<p><strong>FITS:</strong> 1-handed firearms only.</p><p>This forward grip means the weapon now requires 2 hands, and it improves <strong>Autofire</strong> by granting <strong>+1</strong> to autofire attacks.</p><p><strong>STEADY:</strong> The user gains <strong>+1</strong> to attacks if they fired only once this turn.</p>') }),
  modItem({ name: 'Militech SR Capacity', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech-SR-Capacity.png'),
    system: { requiresTechWeapon: true, srCapacity: true },
    description: desc('<p><strong>FITS:</strong> Tech Weapon shotguns, assault rifles, precision rifles, and sniper rifles only.</p><p><strong>HIGH-CAPACITY BATTERY:</strong> The user can still Move while charging, at half their <strong>MOVE</strong>, and a hit that gets past SP deals <strong>+2</strong> electrical damage to HP.</p><p><strong>CUMBERSOME:</strong> The weapon takes <strong>-1</strong> to all attacks compared to a standard stock, and it cannot be concealed.</p>') }),
  modItem({ name: 'Tsunami Hakatome', manufacturer: 'Tsunami Arms', cost: 'EX', imgPath: img(M_ROOT, 'Tsunami-Hakatome.png'),
    system: {
      steady: true,
      weaponChanges: [
        { id: 'hakatome-skill', key: 'skill', mode: 'override', value: 'shoulderArms' },
        { id: 'hakatome-hands', key: 'hands', mode: 'override', value: '2' },
        { id: 'hakatome-conceal', key: 'concealable', mode: 'override', value: 'false' },
      ],
    },
    description: desc('<p><strong>FITS:</strong> 1-handed firearms only, as a stock mod.</p><p><strong>STEADY:</strong> The user gains <strong>+1</strong> to attacks if they did not Move this turn.</p><p><strong>SHOULDER STOCK:</strong> The weapon now requires 2 hands, cannot be concealed, and uses the <strong>Shoulder Arms</strong> skill.</p>') }),
  modItem({ name: 'Malorian Critical Ricochet', manufacturer: 'Malorian Arms', cost: 'PR', imgPath: img(M_ROOT, 'Malorian-Critical-Ricochet.png'),
    system: { requiresPowerWeapon: true, improvedRicochet: true },
    description: desc('<p><strong>FITS:</strong> Power Weapons only. It is fitted with an Action Assembly.</p><p><strong>IMPROVED RICOCHET:</strong> A successful ricochet hit deals <strong>+1</strong> damage per die of the base weapon damage.</p>') }),
  modItem({ name: 'Militech TWA Boomerang', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech-TWA-Boomerang.png'),
    system: { requiresLightMelee: true },
    description: desc('<p><strong>FITS:</strong> Light Melee weapons designed to be thrown only.</p><p><strong>RETURN THRUSTER:</strong> The weapon silently returns to the thrower&rsquo;s wireless hand-signal at the start of their next turn, provided it is within 50m and unobstructed. Holding on to it still requires a <strong style="color: var(--cpb-accent);">DV 12</strong> <strong>BODY</strong>+<strong>Athletics</strong> check.</p>') }),
  modItem({ name: 'Militech 4X Action Repeater', manufacturer: 'Militech', cost: 'PR', imgPath: img(M_ROOT, 'Militech-4x-Action-Repeater.png'),
    system: {},
    description: desc('<p><strong>FITS:</strong> Bullet-firing weapons only.</p><p><strong>RECOIL ACTION:</strong> On a single-shot attack, also roll <strong>1d6</strong>. On a 6 the user immediately makes an additional attack against the same target with no recoil penalty.</p>') }),
  modItem({ name: 'Tsunami Ketsuretsu', manufacturer: 'Tsunami Arms', cost: 'PR', imgPath: img(M_ROOT, 'Tsunami-Ketsuretsu.png'),
    system: { requiresTechWeapon: true, barrierPenetration: true },
    description: desc('<p><strong>FITS:</strong> Tech Weapons only, as a Tech Barrel Mod.</p><p><strong>BARRIER PENETRATION:</strong> For each damage die showing 5 or 6, one extra point of damage ignores SP and barrier HP.</p>') }),
  modItem({ name: 'Kang Tao Zhànshǒu', manufacturer: 'Kang Tao', cost: 'PR', imgPath: img(M_ROOT, 'Kang-Tao-Zhanshou.png'),
    system: { requiresSmartWeapon: true, targetVitalsPenaltyReduction: 1 },
    description: desc('<p><strong>FITS:</strong> Smart Weapons only, as Smart Targeting.</p><p><strong>TARGET VITALS:</strong> The head and vitals penalty is reduced by 1. Smart ammunition using guidance reduces it by 1 more and always targets the vitals.</p>') }),
  modItem({ name: 'Kendachi Shi Bayonet', manufacturer: 'Kendachi', cost: 'C', imgPath: img(M_ROOT, 'Kendachi-bayonet.png'),
    system: { bayonet: true },
    description: desc('<p><strong>FITS:</strong> Any long weapon, which excludes most pistols and SMGs.</p><p><strong>MELEE WEAPON ATTACHED:</strong> The bayonet ignores half of the target&rsquo;s SP.</p><p><strong>BAYONET STATS:</strong> It deals <strong>1d6</strong> damage at RoF 2.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   UNDER-BARREL SUB-WEAPONS (2 modification slots)
// ═══════════════════════════════════════════════════════════════════════════

const underBarrels = [
  modItem({ name: 'Rostovic BP-2 Plujka', manufacturer: 'Rostović', cost: 'PR', imgPath: img(M_ROOT, 'Rostovic-BP-2-Plujka.png'),
    system: { modSlots: 2 },
    description: desc('<p><strong>FITS:</strong> Assault rifles and shotguns, as an under-barrel shotgun taking 2 mod slots.</p><p><strong>STATS:</strong> It deals <strong>5d6</strong> at RoF 1 on 1 round of ammunition, with RCL 2 and ranges of 13, 15, 20, 25, 30, and 35m.</p><p>It is a Power Weapon and it jams.</p><p><strong>SHELL MODE:</strong> At <strong style="color: var(--cpb-accent);">DV 11</strong> it deals <strong>3d6</strong> in an 8/8m cone.</p>') }),
  modItem({ name: 'Constitutional Arms Cavalry', manufacturer: 'Constitutional Arms', cost: 'EX', imgPath: img(M_ROOT, 'Constitutional-Arms-Cavalry.png'),
    system: { modSlots: 2 },
    description: desc('<p><strong>FITS:</strong> Assault rifles and shotguns, as an under-barrel shotgun taking 2 mod slots.</p><p><strong>STATS:</strong> It deals <strong>5d6</strong> at RoF 1 on 1 round of ammunition, with RCL 2 and ranges of 13, 15, 20, 25, 30, and 35m.</p><p>It is a Power Weapon.</p><p><strong>SHELL MODE:</strong> At <strong style="color: var(--cpb-accent);">DV 13</strong> it deals <strong>3d6</strong> in an 8/8m cone.</p>') }),
  modItem({ name: 'Militech EFMO2 Boulder', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_ROOT, 'Militech-EFMO2-Boulder.png'),
    system: { modSlots: 2 },
    description: desc('<p><strong>FITS:</strong> Assault rifles and shotguns, as an under-barrel grenade launcher taking 2 mod slots.</p><p><strong>STATS:</strong> It deals <strong>6d6</strong> at RoF 1 on 1 round of ammunition, with RCL 1 and ranges of 10, 15, 18, 25, and 35m.</p><p><strong>EXPLOSIVES:</strong> Basic grenades deal <strong>6d6</strong> in a 4/8m sphere. On a miss the grenade lands <strong>2d6</strong>m away in a random direction.</p>') }),
  modItem({ name: 'Midnight Arms WA20 GL', manufacturer: 'Midnight Arms', cost: 'PR', imgPath: img(M_ROOT, 'Midnight-Arms-WA20-GL1.png'),
    system: { modSlots: 2 },
    description: desc('<p><strong>FITS:</strong> Assault rifles and shotguns, as an under-barrel grenade launcher taking 2 mod slots.</p><p>It performs exactly as the Militech EFMO2 Boulder does.</p><p><strong>POOR BALANCE:</strong> The user takes <strong>-1</strong> to attacks with the main weapon.</p>') }),
];

// ═══════════════════════════════════════════════════════════════════════════
//   ACCESSORIES (magazines)
// ═══════════════════════════════════════════════════════════════════════════

const accessories = [
  modItem({ name: 'Extended Magazine', manufacturer: '', cost: 'CO', imgPath: img(M_ROOT, 'Extended-mag.png'),
    system: {},
    description: desc('<p>This magazine doubles the weapon&rsquo;s ammunition capacity, or raises it to the cap below, whichever is lower. The weapon cannot be concealed.</p><p><strong>CAPS:</strong> Medium pistol 18, heavy and very heavy pistol 14, SMG 40, heavy SMG 50, shotgun 8, assault rifle 35, precision rifle 20, sniper rifle 8, grenade launcher 4, rocket launcher 2.</p>') }),
  modItem({ name: 'Drum Magazine', manufacturer: '', cost: 'PR', imgPath: img(M_ROOT, 'Drum-mag.png'),
    system: {},
    description: desc('<p>This magazine quadruples the weapon&rsquo;s ammunition capacity, or raises it to the cap below, whichever is lower. The weapon cannot be concealed.</p><p><strong>CAPS:</strong> Medium pistol 36, heavy and very heavy pistol 28, SMG 50, heavy SMG 60, shotgun 16, assault rifle 45, precision rifle 35, sniper rifle 12, grenade launcher 6, rocket launcher 3.</p>') }),
  modItem({ name: 'Federated Arms Sling', manufacturer: 'Federated Arms', cost: 'CO', imgPath: img(M_ROOT, 'Federated-Arms-Sling.png'),
    system: {},
    description: desc('This sling is part of Federated Arms&rsquo; Righteous Series, and it fits any gear. Dropping the gear leaves it hanging by a strap at the user&rsquo;s side instead of falling to the ground.') }),
  modItem({ name: 'Arasaka SPU Tsubasa', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_ROOT, 'Arasaka-SPU-Tsubasa.png'),
    system: { requiresSmartWeapon: true },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Smart Weapons only.</strong></p><p>Smart ammunition can side-load a Quickhack program that uploads to the target's cyberware, with an effective skill of <strong>+14</strong> to breach their COS.</p>") }),
  modItem({ name: 'Constitutional Arms Delaware', manufacturer: 'Constitutional Arms', cost: 'PR', imgPath: img(M_ROOT, 'Constitutional-arms-Delaware.png'),
    system: { narrowConeShell: true, coneAttackBonus: 3, coneDamageBonusDice: '1d6' },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Shotguns with a cone (shell) attack only.</strong></p><p>A tighter pellet spread halves the cone width, and grants <strong>+3</strong> to the attack and <strong>+1d6</strong> damage when firing a shell.</p>") }),

  // ── Activatable mods (toggle button on the weapon row) ──────────────────────
  modItem({ name: 'Arasaka Inazuma', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_ROOT, 'Arasaka-Inazuma.png'),
    system: { activatable: true, activationIcon: 'bolt', damagePerDie: 1, requiresLightMelee: false },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Melee weapons only.</strong></p><p>Takes an Action to turn on or off. While active, the electric edge deals <strong>+1 damage per die</strong>. Striking non-insulated cyberware (an Aimed shot, at least <strong>-4</strong>) forces a <strong style=\"color: var(--cpb-accent);\">DV15</strong> <strong>TECH</strong>+<strong>Endurance</strong> check or that device is disabled for 1 minute.</p>") }),
  modItem({ name: 'Arasaka Thermal Advantage', manufacturer: 'Arasaka', cost: 'PR', imgPath: img(M_ROOT, 'Arasaka-Thermal-Advantage.png'),
    system: { activatable: true, activationIcon: 'fire', activeThermalBurn: true },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Melee weapons only.</strong></p><p>The heating coil is switched on or off as an Action. While active, a hit dealing at least <strong>2</strong> HP applies <strong>Burning</strong> (2 HP at the start of each turn) for <strong>1d6</strong> rounds; the condition can be ended as an Action. Flammable objects ignite even without initial damage. A battery lasts 8 hours and takes ten minutes to recharge.</p>") }),
  modItem({ name: 'Budget Arms Riptide', manufacturer: 'Budget Arms', cost: 'PR', imgPath: img(M_ROOT, 'Budget-Arms-Riptide.png'),
    system: { activatable: true, activationIcon: 'gears', activeDamageDice: '1d6', activeAblateExtra: true },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Non-motorized melee weapons only.</strong></p><p>The rippers are turned on or off as an Action. While active the weapon is noisy, but deals <strong>+1d6</strong> damage and ablates <strong>2</strong> SP instead of 1. €$10 (Everyday) of fuel lasts 8 hours.</p>") }),
  modItem({ name: 'Militech CS-63 Bipod', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_ROOT, 'Militech-CS-63-Bipod.png'),
    system: { activatable: true, activationIcon: 'anchor', activationBlocksMove: true, activeAttackBonus: 1 },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Two-handed weapons only.</strong></p><p>Deploys a gyroscopic stand against any surface. During a turn in which the user does not move, attacks gain <strong>+1</strong>. Deploying follows the same no-move restriction as a Tech Weapon charge.</p>") }),
  modItem({ name: 'Militech Vibro-Stun', manufacturer: 'Militech', cost: 'EX', imgPath: img(M_ROOT, 'Militech-Vibro-Stun.png'),
    system: { activatable: true, activationIcon: 'wave-square', activeVibroStun: true, activationSelfEffect: 'Vibrations' },
    effects: [{
      name: 'Vibrations', disabled: true, transfer: false,
      changes: [{ key: 'system.skills.meleeWeapons.bonus', type: 'add', value: '-1' }],
    }],
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Non-motorized, non-bladed melee weapons only.</strong></p><p>Activating or stopping the vibrations takes an Action. While active, an attack die showing <strong>10</strong> that also deals damage leaves the target <strong>Stunned</strong> until the end of their next turn.</p><p>The vibrations make precision difficult: while active — and for one turn after — the user's attacks are at <strong>-1</strong>.</p><p>The battery lasts 8 hours and takes 10 minutes to recharge.</p>") }),

  // ── Passive mechanical mods ─────────────────────────────────────────────────
  modItem({ name: 'Large Fuel Tank', manufacturer: 'Petrochem', cost: 'PR', imgPath: img(M_ROOT, 'Large-fuel-tank.png'),
    system: { doubleMagazine: true, modSlots: 1 },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Flamethrowers only.</strong></p><p>Doubles the ammunition the weapon can hold. While the tank holds more than <strong>10 + BODY</strong> units of fuel, the user's <strong>MOVE</strong> is reduced by 1.</p>") }),
  modItem({ name: 'Rostović Smart-targeting', manufacturer: 'Rostović', cost: 'EX', imgPath: img(M_ROOT, 'Rostovic-smart-targeting.png'),
    system: { postHitAttackBonusAE: true },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Pistols, SMGs, Assault Rifles, Machine Guns, Precision/Sniper Rifles, and Bows/Crossbows only.</strong></p><p>Ammunition is lightly irradiated and previous hits feed back to the user. Attacks against a target already hit by this weapon since the start of your last turn gain <strong>+1</strong>.</p>") }),
  modItem({ name: 'Rostović Skachok', manufacturer: 'Rostović', cost: 'PR', imgPath: img(M_ROOT, 'Rostovic-Skachok.png'),
    system: { skachok: true, requiresTechWeapon: true },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Tech Weapons only.</strong></p><p>While Charged, the weapon can be swung as a stun baton using the <strong>Melee Weapons</strong> skill. A pistol or SMG becomes a Medium Melee Weapon (<strong>2d6</strong>, RoF 2, 1 hand); anything else a Heavy Melee Weapon (<strong>3d6</strong>, RoF 1, 2 hands). Either ignores ½ SP. Using it ends the Charge.</p><p><strong>STUN:</strong> a target brought to 0 HP or lower is left at 1 HP and unconscious instead.</p>") }),
  modItem({ name: 'Kendachi Permanent Edge', manufacturer: 'Kendachi', cost: 'PR', imgPath: img(M_ROOT, 'Kendachi-Permanent-Edge.png'),
    system: { critTriplePick: true },
    description: desc("<p style=\"color: var(--cpb-error);\"><strong>Bladed melee weapons only.</strong></p><p>When the weapon causes a Critical Injury, roll <strong>three</strong> dice instead of two; any combination of two may be chosen to determine the result on the Critical Injury table.</p>") }),
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
    description: desc('This Architecture Hardware add-on runs nitrogen cooling throughout the system. The device becomes immune to fire-inducing program effects and gains <strong>+1</strong> active program slot.'),
  }),
  modItem({
    name: 'Insulation',
    cost: 'VEX',
    system: { modType: 'computerMod' },
    description: desc('This Architecture Hardware add-on makes the device immune to EMP and microwave radiation.'),
  }),
  modItem({
    name: 'Memory Upgrade',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('This Architecture Hardware add-on adds <strong>+1</strong> DATA node to the device. It can be purchased multiple times, but only for servers.'),
  }),
  modItem({
    name: 'Backup Drive',
    cost: 'PR',
    system: { modType: 'computerMod', modSlots: 2 },
    description: desc('This hardware MOD takes 2 hardware slots. Non-Black ICE programs deleted from the host device are saved separately, and they can be retrieved as a full Action.'),
  }),
  modItem({
    name: 'DNA Lock',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('This hardware MOD takes 1 hardware slot and applies a biometric lock. Bypassing it requires a <strong>TECH</strong>+<strong>Electronics</strong> (Security) check against <strong style="color: var(--cpb-accent);">DV 17</strong>.'),
  }),
  modItem({
    name: 'Hardened Circuitry',
    cost: 'EX',
    imgPath: `systems/cyberpunk-blue/assets/items/mods/hardware-mod-hardened-circuitry.png`,
    system: { modType: 'computerMod' },
    description: desc('This hardware MOD takes 1 hardware slot. The host device becomes immune to EMP, microwave pulses, and non-Black ICE programs.'),
  }),
  modItem({
    name: 'Insulated Wiring',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('This hardware MOD takes 1 hardware slot. The host device, its user, and their clothes will not catch fire from program effects.'),
  }),
  modItem({
    name: 'KRASH-Barrier',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('This hardware MOD takes 1 hardware slot, and it makes unsafe disconnections safe.'),
  }),
  modItem({
    name: 'Range Upgrade',
    cost: 'PR',
    system: { modType: 'computerMod' },
    description: desc('This hardware MOD takes 1 hardware slot, and it doubles the host device&rsquo;s wireless connection range.'),
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
    imgPath: img(M_ROOT, 'toxin.png'),
    system: {
      modType: 'weaponMod',
      appliesAffliction: true,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13,
      afflictionDamageFormula: '2d6', afflictionResistDamage: '1d6',
      afflictionDurationFormula: '40 - 2 * body',
    },
    effects: [toxinAE('Toxin', [{ key: 'system.stats.body.rollMod', value: '-1' }])],
    description: desc('<p>This toxin is used to coat a weapon. On a hit that draws blood, the target rolls <strong>BODY</strong>+<strong>Endurance</strong> against <strong style="color: var(--cpb-accent);">DV 13</strong> or takes <strong>2d6</strong> HP and <strong>&minus;1</strong> to <strong>BODY</strong> checks for 40 &minus; (2 &times; <strong>BODY</strong>) minutes. On a successful resist they still take <strong>1d6</strong> HP.</p>'),
  }),
  modItem({
    name: 'Toxin, Strong',
    cost: 'EX',
    imgPath: img(M_ROOT, 'toxin.png'),
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
    description: desc('<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This toxin is used to coat a weapon. On a hit that draws blood, the target rolls <strong>BODY</strong>+<strong>Endurance</strong> against <strong style="color: var(--cpb-accent);">DV 15</strong> or takes <strong>3d6</strong> HP and <strong>&minus;1</strong> to both <strong>BODY</strong> and <strong>RFLX</strong> checks for 40 &minus; (2 &times; <strong>BODY</strong>) minutes. On a successful resist they still take <strong>1d6</strong> HP.</p>'),
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
