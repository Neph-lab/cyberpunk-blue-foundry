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
}) {
  return {
    name,
    type: 'ammo',
    img: img || `${ASSET_BASE}/Basic Rifle.png`,
    _folder: 'Ammo',
    system: {
      quantity,
      cost,
      note,
      attackBonus,
      smartWeaponOnly,
      smartMissReroll,
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
    img: `${ASSET_BASE}/Basic Pistol.png`,
    note: '9mm',
  }),
  ammoItem({
    name: 'Basic Heavy Pistol Ammo',
    ammoTypes: { heavyPistol: true },
    img: `${ASSET_BASE}/Basic Pistol.png`,
    note: '.44',
  }),
  ammoItem({
    name: 'Basic Very Heavy Pistol Ammo',
    ammoTypes: { veryHeavyPistol: true },
    img: `${ASSET_BASE}/Basic Pistol.png`,
    note: '.50',
  }),
  ammoItem({
    name: 'Basic SMG Ammo',
    ammoTypes: { smg: true },
    img: `${ASSET_BASE}/Basic Pistol.png`,
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
    img: `${ASSET_BASE}/Basic Rifle.png`,
    note: '5.56mm, fits Assault Rifle, Precision Rifle, and Machine Gun',
  }),
  ammoItem({
    name: 'Basic Sniper Ammo',
    ammoTypes: { sniper: true },
    img: `${ASSET_BASE}/Basic Rifle.png`,
    note: '.308',
  }),
  ammoItem({
    name: 'Basic Arrows',
    ammoTypes: { bow: true },
    img: `${ASSET_BASE}/Basic arrows.png`,
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
    img: `${ASSET_BASE}/Basic rockets.png`,
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
];
