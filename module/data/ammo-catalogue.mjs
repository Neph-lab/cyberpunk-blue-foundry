/**
 * Ammo catalogue — basic ammunition for every weapon type.
 * Added to the Weapons compendium under an "Ammo" folder.
 *
 * All basic ammo costs €$10 (Cheap). Default quantity is 10, except
 * rockets and grenades which come in quantities of 1.
 */

const ASSET_BASE = 'systems/cyberpunk-blue/assets/items/ammo';

function ammoItem({
  name, ammoTypes = {}, quantity = 10, note = '', img = '', cost = '€$10 (Cheap)',
  attackBonus = 0, smartWeaponOnly = false, smartMissReroll = false,
  nonTechOnly = false, armorPiercing = false, noAblate = false, nonLethal = false,
  critRerollForeignObject = false, damageOverride = '', toxicDv = 0, toxicDamage = '',
}) {
  return {
    name,
    type: 'ammo',
    img: img || `${ASSET_BASE}/Basic-Rifle.png`,
    _folder: 'Ammo',
    system: {
      quantity,
      cost,
      note,
      attackBonus,
      smartWeaponOnly,
      smartMissReroll,
      nonTechOnly,
      armorPiercing,
      noAblate,
      nonLethal,
      critRerollForeignObject,
      damageOverride,
      toxicDv,
      toxicDamage,
      ammoTypes: {
        mediumPistol:  !!ammoTypes.mediumPistol,
        heavyPistol:   !!ammoTypes.heavyPistol,
        veryHeavyPistol: !!ammoTypes.veryHeavyPistol,
        smg:           !!ammoTypes.smg,
        shotgunSlug:   !!ammoTypes.shotgunSlug,
        shotgunShell:  !!ammoTypes.shotgunShell,
        assault:       !!ammoTypes.assault,
        sniper:        !!ammoTypes.sniper,
        bow:           !!ammoTypes.bow,
        grenade:       !!ammoTypes.grenade,
        rocket:        !!ammoTypes.rocket,
        flamethrower:  !!ammoTypes.flamethrower,
        battery:       !!ammoTypes.battery,
      },
    },
  };
}

export const AMMO_CATALOGUE = [
  ammoItem({
    name: 'Basic Medium Pistol Ammo',
    ammoTypes: { mediumPistol: true },
    img: `${ASSET_BASE}/Basic-Pistol.png`,
    note: '9mm',
  }),
  ammoItem({
    name: 'Basic Heavy Pistol Ammo',
    ammoTypes: { heavyPistol: true },
    img: `${ASSET_BASE}/Basic-Pistol.png`,
    note: '.44',
  }),
  ammoItem({
    name: 'Basic Very Heavy Pistol Ammo',
    ammoTypes: { veryHeavyPistol: true },
    img: `${ASSET_BASE}/Basic-Pistol.png`,
    note: '.50',
  }),
  ammoItem({
    name: 'Basic SMG Ammo',
    ammoTypes: { smg: true },
    img: `${ASSET_BASE}/Basic-Pistol.png`,
    note: '9mm, fits SMG and Heavy SMG',
  }),
  ammoItem({
    name: 'Basic Shotgun Slugs',
    ammoTypes: { shotgunSlug: true },
    img: `${ASSET_BASE}/shotgun-slug.png`,
    note: '12-gauge slug',
  }),
  ammoItem({
    name: 'Basic Shotgun Shells',
    ammoTypes: { shotgunShell: true },
    img: `${ASSET_BASE}/basic-shotgun-shells.png`,
    note: '12-gauge shot',
  }),
  ammoItem({
    name: 'Basic Rifle Ammo',
    ammoTypes: { assault: true },
    img: `${ASSET_BASE}/Basic-Rifle.png`,
    note: '5.56mm, fits Assault Rifle, Precision Rifle, and Machine Gun',
  }),
  ammoItem({
    name: 'Basic Sniper Ammo',
    ammoTypes: { sniper: true },
    img: `${ASSET_BASE}/Basic-Rifle.png`,
    note: '.308',
  }),
  ammoItem({
    name: 'Basic Arrows',
    ammoTypes: { bow: true },
    img: `${ASSET_BASE}/Basic-arrows.png`,
    note: 'Standard field point',
  }),
  ammoItem({
    name: 'Basic Grenade',
    ammoTypes: { grenade: true },
    quantity: 1,
    img: `${ASSET_BASE}/Grenade.png`,
    note: 'Fragmentation',
  }),
  ammoItem({
    name: 'Basic Rocket',
    ammoTypes: { rocket: true },
    quantity: 1,
    img: `${ASSET_BASE}/Basic-rockets.png`,
    note: 'Unguided warhead',
  }),
  ammoItem({
    name: 'Basic Fuel',
    ammoTypes: { flamethrower: true },
    img: `${ASSET_BASE}/fuel.png`,
    note: 'Standard accelerant',
  }),
  ammoItem({
    name: 'Basic Battery',
    ammoTypes: { battery: true },
    quantity: 1,
    img: `${ASSET_BASE}/battery.png`,
    note: '€$50; fully recharges a stun gun (12 shots); 1 hour to recharge from empty',
  }),
  ammoItem({
    name: 'Incendiary Shotgun Shells',
    ammoTypes: { shotgunShell: true },
    img: `${ASSET_BASE}/Incendiary.png`,
    cost: '€$500 (Expensive)',
    note: '+2 damage past SP; target and adjacent objects may catch fire on a hit.',
  }),
  ammoItem({
    name: 'Incendiary Rifle Ammo',
    ammoTypes: { assault: true },
    img: `${ASSET_BASE}/Incendiary.png`,
    cost: '€$500 (Expensive)',
    note: '+2 damage past SP; target and adjacent objects may catch fire on a hit.',
  }),

  // ── Smart Ammo (Arasaka) ────────────────────────────────────────────────────
  // Requires a Smart Weapon to function. Grants +1 to attack rolls.
  // Near-miss re-roll: if the attack misses by ≤5, roll 1d10+14 as a replacement
  // attack total (cannot chain-trigger another re-roll).

  ammoItem({
    name: 'Smart Medium Pistol Ammo',
    ammoTypes: { mediumPistol: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided rounds. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Heavy Pistol Ammo',
    ammoTypes: { heavyPistol: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided rounds. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Very Heavy Pistol Ammo',
    ammoTypes: { veryHeavyPistol: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided rounds. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart SMG Ammo',
    ammoTypes: { smg: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided rounds. Fits SMG and Heavy SMG. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Shotgun Slugs',
    ammoTypes: { shotgunSlug: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided slugs. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Shotgun Shells',
    ammoTypes: { shotgunShell: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided shot. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Rifle Ammo',
    ammoTypes: { assault: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided rounds. Fits Assault Rifle, Precision Rifle, and Machine Gun. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Sniper Ammo',
    ammoTypes: { sniper: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided rounds. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Rocket',
    ammoTypes: { rocket: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka smart-guided warhead. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Fuel',
    ammoTypes: { flamethrower: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka precision-injected accelerant. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),
  ammoItem({
    name: 'Smart Battery',
    ammoTypes: { battery: true },
    img: `${ASSET_BASE}/Smart.png`,
    cost: '€$500 (Expensive)',
    quantity: 10,
    note: 'Arasaka precision-charge cell. Smart Weapons only. +1 attack; miss by ≤5: roll 1d10+14 as replacement (no re-roll chain).',
    attackBonus: 1, smartWeaponOnly: true, smartMissReroll: true,
  }),

  // ── Special ammo families (all non-Tech weapons only, €$100 Premium) ────────
  // Each family covers the same six weapon types; the `smg` type serves both SMG
  // and Heavy SMG (as with Basic SMG Ammo), and Rifle serves AR / PR / MG.
  ...(() => {
    const CALIBERS = [
      ['Medium Pistol Ammo',     { mediumPistol: true },    '9mm.'],
      ['Heavy Pistol Ammo',      { heavyPistol: true },     '.44.'],
      ['Very Heavy Pistol Ammo', { veryHeavyPistol: true }, '.50.'],
      ['SMG Ammo',               { smg: true },             'Fits SMG and Heavy SMG.'],
      ['Rifle Ammo',             { assault: true },         'Fits Assault Rifle, Precision Rifle, and Machine Gun.'],
      ['Shotgun Slugs',          { shotgunSlug: true },     '12-gauge slug.'],
    ];
    const family = (prefix, img, effectNote, extra) => CALIBERS.map(([label, ammoTypes, caliber]) => ammoItem({
      name: `${prefix} ${label}`, ammoTypes, cost: '€$100 (Premium)', img,
      nonTechOnly: true, note: `${caliber} ${effectNote}`, ...extra,
    }));
    return [
      ...family('Armor-Piercing', `${ASSET_BASE}/Armor-Piercing.png`,
        'Ablates 2 SP instead of 1, and the target\'s SP counts as 2 lower against this shot. Non-Tech weapons only.',
        { armorPiercing: true }),
      ...family('Hollow-Point', `${ASSET_BASE}/Hollow-Point.png`,
        'A Foreign Object critical injury tumbles into a second injury (re-rolled if it would be another Foreign Object). Non-Tech weapons only.',
        { critRerollForeignObject: true }),
      ...family('Rubber', `${ASSET_BASE}/Rubber.png`,
        'Degrades no armor. A target dropped to 0 HP or below is left at 1 HP and unconscious instead. Non-Tech weapons only.',
        { noAblate: true, nonLethal: true }),
      ...family('Toxic', `${ASSET_BASE}/Toxic.png`,
        'Deals no wound damage: on a hit that breaks SP the target rolls BODY+Endurance vs DV15 or takes 3d6 straight to HP (half on a success). Cannot cause a critical injury. Non-Tech weapons only.',
        { toxicDv: 15, toxicDamage: '3d6' }),
    ];
  })(),

  // ── Grenade-launcher payloads ───────────────────────────────────────────────
  // Mirror the thrown Gear versions; loaded into a Grenade Launcher they replace
  // the launcher's own payload. Quantity 1, as with the basic grenade.
  ammoItem({
    name: 'EMP Grenade',
    ammoTypes: { grenade: true },
    quantity: 1,
    img: `${ASSET_BASE}/EMP-Grenade.png`,
    cost: '€$500 (Expensive)',
    note: 'Zetatech. 4m inner / 8m outer, no damage. DV15 TECH+Endurance (+2 in the outer zone) or two random non-insulated pieces of cyberware are disabled for a minute. No SP ablation.',
  }),
  ammoItem({
    name: 'Incendiary Grenade',
    ammoTypes: { grenade: true },
    quantity: 1,
    img: `${ASSET_BASE}/Incendiary-Grenade.png`,
    cost: '€$100 (Premium)',
    note: 'Militech. 6m inner / 10m outer for 6d6; RFLX 8+ may roll Evasion to halve it. Anyone taking HP damage catches fire (Burning) until put out.',
  }),

  ammoItem({
    name: 'Toxic Shotgun Shells',
    ammoTypes: { shotgunShell: true },
    img: `${ASSET_BASE}/toxic-shotgun-shells.png`,
    cost: '€$100 (Premium)',
    nonTechOnly: true, toxicDv: 12, toxicDamage: '3d6',
    note: '12-gauge shot. Deals no wound damage: on a hit that breaks SP the target rolls BODY+Endurance vs DV12 or takes 3d6 straight to HP (half on a success). Cannot cause a critical injury. Non-Tech weapons only.',
  }),
];
