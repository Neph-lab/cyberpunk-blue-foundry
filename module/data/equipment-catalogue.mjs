/**
 * Equipment catalogue — all non-weapon gear from the Cyberpunk Blue source.
 *
 * Includes: Clothing, Grenades, Media Gear, Survival & Exploration, Scientific &
 * Medical, Computer Hardware, Cyberdeck Hardware MODs, Clandestine Gear,
 * Miscellaneous, Chipware, and Architecture Hardware.
 *
 * Each entry is Foundry Item create-data ready for `Item.createDocuments`.
 * The `_folder` property is stripped before the item is written to the pack.
 */

const COST = {
  CH:  '€$10 (Cheap)',
  EV:  '€$20 (Everyday)',
  CO:  '€$50 (Costly)',
  PR:  '€$100 (Premium)',
  EX:  '€$500 (Expensive)',
  VEX: '€$1,000 (Very Expensive)',
  LUX: '€$5,000 (Luxury)',
  SLX: '€$10,000 (Super Luxury)',
};

const h = (text) => `<p>${text}</p>`;

// ── Asset paths ───────────────────────────────────────────────────────────────
const ASSET_BASE = 'systems/cyberpunk-blue/assets/items';
const A_GEAR     = `${ASSET_BASE}/gear`;
const A_AMMO     = `${ASSET_BASE}/ammo`;
const A_ARMOR    = `${ASSET_BASE}/armor`;
const A_CHIPWARE = `${ASSET_BASE}/chipware`;
const A_CLOTHES  = `${ASSET_BASE}/clothes`;

const CLOTHING_IMG = {
  'Bottoms/Entropism': `${A_CLOTHES}/entropism-bottoms.png`,
  'Top/Entropism':     `${A_CLOTHES}/entropism-vest.png`,
  'Jacket/Entropism':  `${A_CLOTHES}/entropism-jacket.png`,
  'Footwear/Kitch':    `${A_CLOTHES}/kitsch-footwear.png`,
  'Jacket/Kitch':      `${A_CLOTHES}/kitsch-jacket.png`,
  'Top/Kitch':         `${A_CLOTHES}/kitsch-vest.png`,
  'Jewelry/Neokitch':  `${A_CLOTHES}/neokitsch-jewelery.png`,
  '_/Entropism':       `${A_CLOTHES}/Entropism.png`,
  '_/Kitch':           `${A_CLOTHES}/Kitsch.png`,
  '_/Neomilitarism':   `${A_CLOTHES}/Neomilitarism.png`,
  '_/Neokitch':        `${A_CLOTHES}/Neokitsch.png`,
};


// ── AE helpers ─────────────────────────────────────────────────────────────
const ae      = (name, changes) => ({ name, disabled: false, transfer: true, changes });
const aeOff   = (name, changes) => ({ name, disabled: true,  transfer: true, changes, flags: { 'cyberpunk-blue': { noGearStateSync: true } } });
const reminder = (name)         => ({ name, disabled: false, transfer: true, changes: [] });
const stat    = (slug, val) => ({ key: `system.stats.${slug}.value`,    mode: 2, value: String(val) });
const statOvr = (slug, val) => ({ key: `system.stats.${slug}.value`,    mode: 5, value: String(val) });
const statMod = (slug, val) => ({ key: `system.stats.${slug}.rollMod`,  mode: 2, value: String(val) });
// Skill/component AEs target `.bonus` (a check bonus), never `.rank` — modifying
// `.rank` corrupts the player-set rank. See module/data/actor-character.mjs.
const skill   = (slug, val) => ({ key: `system.skills.${slug}.bonus`,    mode: 2, value: String(val) });
const comp    = (slug, val) => ({ key: `system.components.${slug}.bonus`, mode: 2, value: String(val) });

// ── Instruction step helpers ───────────────────────────────────────────────
const S = {
  message: (content, { name = 'Message', terminates = false, whisperGm = false } = {}) => ({
    type: 'message', name, message: content, terminates, whisperGm,
  }),
  pause: (name = 'Pause') => ({ type: 'pause', name }),
  effect: ({ name = 'Effect', effectName = '', effectEnabled = true, permanent = false, terminates = false } = {}) => ({
    type: 'effect', name, effectName, effectEnabled, permanent, terminates,
  }),
};

/**
 * Build a standard Gear item.
 */
function gear({
  name, manufacturer = '', cost, folder, description = '', imgPath = '',
  isArmor = false, maxSp = 0, quantity = 1,
  isComputer = false, computer = {},
  isWeapon = false, weapons = [],
  effects = [], instructions = [], flags = {},
}) {
  return {
    _folder: folder,
    name,
    type: 'gear',
    img: imgPath,
    effects,
    flags,
    system: {
      manufacturer,
      cost: COST[cost] ?? cost,
      note: '',
      notes: '',
      isArmor,
      isWeapon,
      isComputer,
      minBodyReq: 0,
      armor: { maxSp, currentSp: maxSp },
      weapons,
      quantity,
      state: 'carried',
      carried: true,
      equipped: false,
      description: description ? h(description) : '',
      computer: {
        nodes:         computer.nodes         ?? 0,
        hardwareSlots: computer.hardwareSlots ?? 0,
        softwareSlots: computer.softwareSlots ?? 0,
        generalSlots:  computer.generalSlots  ?? 0,
        ram:           computer.ram           ?? 0,
        isCyberdeck:   !!computer.isCyberdeck,
        canQuickhack:  !!computer.canQuickhack,
      },
      instructions,
      instructionActive: false,
      instructionStep: -1,
    },
  };
}

// ─── Style descriptions (embedded in clothing item descriptions) ───────────────

const STYLE_DESC = {
  Entropism:
    'Entropism — Necessity over Style. Survival ethos born from the Time of the Red. ' +
    'Materials must be rough, durable, with pockets or attachment points for gear. ' +
    'Headgear protects from sun or acid rain; footwear handles rough terrain. ' +
    'Military surplus is a common source. Prevalent in Santo Domingo and the Northside Industrial District.',
  Kitch:
    'Kitch — Style over Substance. All about making a statement. More is more: bold colors, ' +
    'unique hairstyles, impressive jewelry or cyberware threading. Clothes and decorations ' +
    'often have embedded tech producing light effects. The default style across most of Night City.',
  Neomilitarism:
    'Neomilitarism — Substance over Style. Corporate cold show of power. Minimalism, strict lines, ' +
    'quality materials. One statement, perfectly executed. Popular among career corpos and high society ' +
    'throughout central Night City.',
  Neokitch:
    'Neokitch — Style and Substance. A statement perfectly tailored to its message, designed specifically ' +
    'for the wearer and context. Only the ultra-rich or those well-connected in fashion can maintain true ' +
    'neokitch style. Found mostly in Westbrook or Downtown.',
};

function clothing(type, style, cost) {
  const imgPath = CLOTHING_IMG[`${type}/${style}`] ?? CLOTHING_IMG[`_/${style}`] ?? '';
  return gear({
    name: `${type} (${style})`,
    folder: 'Outfit',
    cost,
    imgPath,
    description: `${type}. ${STYLE_DESC[style]}`,
  });
}

export const EQUIPMENT_CATALOGUE = [

  // ── Outfit / Clothing ─────────────────────────────────────────────────────

  clothing('Bottoms',  'Entropism',    'PR'),
  clothing('Bottoms',  'Kitch',        'CO'),
  clothing('Bottoms',  'Neomilitarism','EX'),
  clothing('Bottoms',  'Neokitch',     'VEX'),
  clothing('Top',      'Entropism',    'EV'),
  clothing('Top',      'Kitch',        'EV'),
  clothing('Top',      'Neomilitarism','CO'),
  clothing('Top',      'Neokitch',     'EX'),
  clothing('Jacket',   'Entropism',    'PR'),
  clothing('Jacket',   'Kitch',        'CO'),
  clothing('Jacket',   'Neomilitarism','EX'),
  clothing('Jacket',   'Neokitch',     'VEX'),
  clothing('Footwear', 'Entropism',    'PR'),
  clothing('Footwear', 'Kitch',        'CO'),
  clothing('Footwear', 'Neomilitarism','EX'),
  clothing('Footwear', 'Neokitch',     'LUX'),
  clothing('Jewelry',  'Entropism',    'CO'),
  clothing('Jewelry',  'Kitch',        'PR'),
  clothing('Jewelry',  'Neomilitarism','VEX'),
  clothing('Jewelry',  'Neokitch',     'LUX'),
  clothing('Shades',   'Entropism',    'CO'),
  clothing('Shades',   'Kitch',        'PR'),
  clothing('Shades',   'Neomilitarism','EX'),
  clothing('Shades',   'Neokitch',     'VEX'),
  clothing('Glasses',  'Entropism',    'CO'),
  clothing('Glasses',  'Kitch',        'PR'),
  clothing('Glasses',  'Neomilitarism','EX'),
  clothing('Glasses',  'Neokitch',     'VEX'),
  clothing('Headwear', 'Entropism',    'EV'),
  clothing('Headwear', 'Kitch',        'CO'),
  clothing('Headwear', 'Neomilitarism','EX'),
  clothing('Headwear', 'Neokitch',     'LUX'),

  // ── Grenades ──────────────────────────────────────────────────────────────

  gear({
    name: 'Knock-Out Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Knock-out Gas Grenade.png`, cost: 'EX',
    description: 'Deals no damage. AoE: 4m inner / 8m outer sphere; targets in outer zone get +5 to resist. DV13 BODY+Endurance or fall unconscious for a number of minutes equal to the margin of failure (waking from damage or an action taken to rouse them). No SP ablation. Both radii shrink by 2m after each subsequent turn; the cloud moves with the wind. Quality: Standard (EX), Poor (PR), Excellent (VEX).',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 8, coneAngle: 45, coneHalfDamageDistance: 4,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, afflictionEffectId: '',
      outerZoneResistBonus: 5,
    }],
    effects: [{
      name: 'Knocked Out',
      disabled: true, transfer: false, changes: [],
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Smoke Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Smoke Grenade.png`, cost: 'CO',
    description: 'Deals no damage. AoE: 16m inner / 22m outer sphere. DV13 BODY+Endurance or suffer Damaged Eye Critical Injury for 1 minute. Both radii shrink by 2m after each subsequent turn; the cloud moves with the wind. Quality: Standard (CO), Poor (EV), Excellent (PR).',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 22, coneAngle: 45, coneHalfDamageDistance: 16,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, afflictionEffectId: '',
      outerZoneResistBonus: 0,
    }],
    effects: [{
      name: 'Smoke: Damaged Eye',
      disabled: true, transfer: false, changes: [],
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Teargas Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Teargas Grenade.png`, cost: 'CO',
    description: 'Deals no damage. AoE: 10m inner / 12m outer sphere; targets in outer zone get +4 to resist. DV13 BODY+Endurance or suffer Damaged Eye Critical Injury for 1 minute. Both radii shrink by 2m after each subsequent turn; the cloud moves with the wind. Quality: Standard (CO), Poor (EV), Excellent (PR).',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 12, coneAngle: 45, coneHalfDamageDistance: 10,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, afflictionEffectId: '',
      outerZoneResistBonus: 4,
    }],
    effects: [{
      name: 'Teargas: Damaged Eye',
      disabled: true, transfer: false, changes: [],
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Flashbang Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Flasgbang Grenade.png`, cost: 'EX',
    description: 'Deals no damage. AoE: 10m inner / 12m outer sphere; targets in outer zone get +4 to resist. DV17 REFLEXES+Athletics or become Blinded and Deafened for 1 round. Both radii shrink by 2m after each subsequent turn.',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 12, coneAngle: 45, coneHalfDamageDistance: 10,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'reflexes', afflictionSkill: 'athletics', afflictionDv: 17, afflictionEffectId: '',
      outerZoneResistBonus: 4,
    }],
    effects: [{
      name: 'Flashbang: Blinded and Deafened',
      disabled: true, transfer: false, changes: [],
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Toxic Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Toxic Gas Grenade.png`, cost: 'EX',
    description: 'Deals no damage, no SP ablation, cannot cause Critical Injuries. AoE: 4m inner / 10m outer sphere; targets in outer zone get +2 to resist. DV15 BODY+Endurance or take 2d6 HP; on a successful resist, take half (rounded down). Both radii shrink by 2m after each subsequent turn; the cloud moves with the wind. Quality: Standard (EX), Poor (PR), Excellent (VEX).',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '2d6', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 10, coneAngle: 45, coneHalfDamageDistance: 4,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'body', afflictionSkill: '', afflictionDv: 13, afflictionEffectId: '',
      outerZoneResistBonus: 2,
    }],
  }),

  // ── Media Gear ────────────────────────────────────────────────────────────

  gear({
    name: 'Audio Recorder',
    folder: 'Media Gear', imgPath: `${A_GEAR}/audio-recorder.png`, cost: 'CO',
    description: '24-hour recording capacity per shard (1 shard included).',
  }),
  gear({
    name: 'Braindance',
    folder: 'Media Gear', imgPath: `${A_GEAR}/braindance.png`, cost: 'PR',
    description: 'Up to 4 hours of full-sensory recorded experience on a shard.',
  }),
  gear({
    name: 'Braindance Wreath',
    folder: 'Media Gear', imgPath: `${A_GEAR}/braindance-wreath.png`, cost: 'EX',
    description: 'Required to experience a Braindance recording.',
  }),
  gear({
    name: 'Drum Synthesizer',
    folder: 'Media Gear', imgPath: `${A_GEAR}/drum-synthesizer.png`, cost: 'EX',
    description: 'Plastic pads that simulate a drum kit; includes pre-programmed beats and loops. Requires a pocket amplifier or amp.',
  }),
  gear({
    name: 'Electric Guitar',
    folder: 'Media Gear', imgPath: `${A_GEAR}/electric-guitar.png`, cost: 'EX',
    description: 'Requires a pocket amplifier or amp.',
  }),
  gear({
    name: 'Movie (Shard)',
    folder: 'Media Gear', imgPath: `${A_GEAR}/movie.png`, cost: 'CO',
    description: '2–5 hours of screen-viewable content on a shard.',
  }),
  gear({
    name: 'Music Album (Shard)',
    folder: 'Media Gear', imgPath: `${A_GEAR}/music-album.png`, cost: 'CH',
    description: '10–20 songs on a shard or legacy format.',
  }),
  gear({
    name: 'Pocket Amplifier',
    folder: 'Media Gear', imgPath: `${A_GEAR}/pocket-amp.png`, cost: 'PR',
    description: 'Large-book sized amplifier. Connects up to 2 instruments; up to 90dB output.',
  }),
  gear({
    name: 'Radio / Music Player',
    folder: 'Media Gear', imgPath: `${A_GEAR}/music-player.png`, cost: 'CO',
    description: 'Can play audio from the Data Pool, memory chip, or radio broadcast.',
  }),
  gear({
    name: 'Video Camera',
    folder: 'Media Gear', imgPath: `${A_GEAR}/video-camera.png`, cost: 'PR',
    description: '10-hour recording capacity per shard (1 shard included).',
  }),

  // ── Survival & Exploration Gear ───────────────────────────────────────────

  gear({
    name: 'Anti-Smog Breathing Mask',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/amti-smog breathing mask.png`, cost: 'PR',
    description: 'Immune to airborne toxins that require inhalation while worn.',
    effects: [reminder('Immune to inhaled toxins while worn')],
  }),
  gear({
    name: 'Auto-Level Ear Protectors',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/auto-level-ear-protectors.png`, cost: 'PR',
    description: 'Immune to deafness effects and damage from loud noises while worn.',
    effects: [reminder('Immune to deafness / loud-noise damage while worn')],
  }),
  gear({
    name: 'Backpack',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/backpack.png`, cost: 'CO',
    description: 'Spacious and sturdy.',
  }),
  gear({
    name: 'Binoculars',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/binoculars.png`, cost: 'CO',
    description: 'Magnifies up to ×5.',
  }),
  gear({
    name: 'Duct Tape',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/duct-tape.png`, cost: 'EV',
    description: '100m roll. Available in glow-in-the-dark color options.',
  }),
  gear({
    name: 'Flashlight',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/flashlight.png`, cost: 'EV',
    description: '100m illumination beam.',
  }),
  gear({
    name: 'Food Stick',
    folder: 'Survival & Exploration', cost: 'CH',
    description: '1 meal. Available in various awful flavors.',
  }),
  gear({
    name: 'Grapple Gun',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/grappling-gun.png`, cost: 'PR',
    description: 'Rocket-propelled grapple that embeds in thick cover within 30m. Action to fire or fully retract. 30m rope, 2-person capacity, rope has 10 HP.',
  }),
  gear({
    name: 'Inflatable Bed & Sleeping Bag',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/inflatable-bed-and-sleeping-bag.png`, cost: 'EV',
    description: 'Folds down to a 15×15×10cm package.',
  }),
  gear({
    name: 'Personal Care Pack',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/personal-care-pack.png`, cost: 'EV',
    description: 'Toothbrush, towel, soap, and other basic hygiene items.',
  }),
  gear({
    name: 'Radar Detector',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/radar-detector.png`, cost: 'EX',
    description: 'Detects radar, ladar, and echo scan in the area; triangulates the source within a 10% margin.',
  }),
  gear({
    name: 'Road Flare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/road-flare.png`, cost: 'CH',
    description: '100m radius illumination, lasts 1 hour, single use. Available in various colors.',
  }),
  gear({
    name: 'Rope',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/rope.png`, cost: 'EV',
    description: '60m nylon rope with 400kg capacity.',
  }),
  gear({
    name: 'Tent & Camping Equipment',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/tent-and-camping-equipment.png`, cost: 'CO',
    description: 'Small tent, self-heating pot (2-hour use with 5-minute recharge), and basic utensils.',
  }),

  // ── Scientific & Medical Equipment ────────────────────────────────────────

  gear({
    name: 'Airhypo',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/airhypo.png`, cost: 'CO',
    description: 'Holds up to 3 drug ampules. Administers a dose as an Action. To inject an unwilling target, make a BODY+Melee Weapons attack instead of dealing damage on a hit.',
    isWeapon: true,
    weapons: [{
      type: 'lightMelee', skill: 'meleeWeapons', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'affliction', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 0, coneAngle: 53, coneHalfDamageDistance: 0,
      rangeTable: [15, 20, 0, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, afflictionEffectId: '',
    }],
    effects: [{
      name: 'Drugged',
      disabled: true, transfer: false, changes: [],
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Chemical Analyzer',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/chemical-analyzer.png`, cost: 'VEX',
    description: 'Action to insert a sample; identifies the compound on the following round.',
  }),
  gear({
    name: 'Cryopump',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/cryobag.png`, cost: 'LUX',
    description: 'Medtech only. Briefcase that unfolds into a body-bag and coolant pump (Action). DV12 TECH+Medicine (Cryotech) to place a person in stasis for up to 1 week (Action). The bag has 15 HP. Recharge costs CO.',
  }),
  gear({
    name: 'Cryotank',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/cryotank.png`, cost: 'LUX',
    description: 'Medtech only. DV15 TECH+Medicine (Cryotech) for indefinite stasis, or conscious suspension with 2× the natural healing rate.',
  }),
  gear({
    name: 'Medscanner',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/medscanner.png`, cost: 'VEX',
    description: 'Performs most medical tests. +2 to Medicine checks.',
    effects: [ae('Medicine +2', [skill('medicine', 2)])],
  }),
  gear({
    name: 'Medtech Bag',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/medtech-bag.png`, cost: 'PR',
    description: 'Complete set of basic medicine tools; equivalent to mall-level medical facilities.',
  }),
  gear({
    name: 'Tech Bag',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/tech-bag.png`, cost: 'EX',
    description: 'Contains: Techtool, hammer, 2 prybars, heat torch, voltmeter, and assorted screws, nuts, and wire.',
  }),
  gear({
    name: 'Techscanner',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/techscanner.png`, cost: 'VEX',
    description: '+2 to Electronics and Mechanics checks (hardware only).',
    effects: [ae('Electronics +2, Mechanics +2 (hardware)', [skill('electronics', 2), skill('mechanics', 2)])],
  }),
  gear({
    name: 'Techtool',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/techtool.png`, cost: 'PR',
    description: 'Multi-tool containing pliers, blade, screwdrivers, files, and clippers.',
  }),

  // ── Computer Hardware ─────────────────────────────────────────────────────

  gear({
    name: 'Cyberdeck, Poor', imgPath: `${A_GEAR}/poor-cyberdeck.png`,
    folder: 'Computer Hardware', cost: 'PR',
    isComputer: true,
    computer: { generalSlots: 5, ram: 4, isCyberdeck: true, canQuickhack: true },
    description: '5 program slots, 4 RAM, 10m wireless range. Requires a Neuroport Cyberdeck Port or Interface Plugs to use.',
  }),
  gear({
    name: 'Cyberdeck, Standard', imgPath: `${A_GEAR}/standard-cyberdeck.png`,
    folder: 'Computer Hardware', cost: 'EX',
    isComputer: true,
    computer: { generalSlots: 7, ram: 6, isCyberdeck: true, canQuickhack: true },
    description: '7 program slots, 6 RAM, 10m wireless range. Requires a Neuroport Cyberdeck Port or Interface Plugs to use.',
  }),
  gear({
    name: 'Cyberdeck, Excellent', imgPath: `${A_GEAR}/excellent-cyberdeck.png`,
    folder: 'Computer Hardware', cost: 'VEX',
    isComputer: true,
    computer: { generalSlots: 9, ram: 8, isCyberdeck: true, canQuickhack: true },
    description: '9 program slots, 8 RAM, 10m wireless range. Requires a Neuroport Cyberdeck Port or Interface Plugs to use.',
  }),
  gear({
    name: 'Memory Shard',
    folder: 'Computer Hardware', imgPath: `${A_GEAR}/memory-card.png`, cost: 'CH',
    description: 'Data storage wafer. Fits any standard shard socket.',
  }),
  gear({
    name: 'Netrunner Chair',
    folder: 'Computer Hardware', cost: 'VEX',
    isComputer: true,
    computer: { hardwareSlots: 1 },
    description: '1 hardware slot (functionally part of a connected cyberdeck). −2 to remote hack damage while seated. Requires a Neuroport Cyberdeck Port.',
  }),
  gear({
    name: 'Netrunner Chair, Advanced',
    folder: 'Computer Hardware', cost: 'LUX',
    isComputer: true,
    computer: { hardwareSlots: 2 },
    description: '+1 NET Action per turn and 2 hardware slots (functionally part of a connected cyberdeck). −3 to remote hack damage while seated. Requires a Neuroport Cyberdeck Port.',
  }),
  gear({
    name: 'Smart Visor',
    folder: 'Computer Hardware', imgPath: `${A_GEAR}/smart-visor.png`, cost: 'EX',
    description: 'Functions as a 2-slot cybereye with Virtuality pre-installed while worn. Note: interaction with installed cyberoptics may vary; consult your GM.',
  }),

  // ── Cyberdeck Hardware MODs ───────────────────────────────────────────────

  gear({
    name: 'Backup Drive',
    folder: 'Cyberdeck Hardware MODs', cost: 'PR',
    description: 'Cyberdeck MOD — 2 hardware slots. Non-Black ICE programs deleted from the connected deck are saved separately; they can be retrieved as a full Action.',
  }),
  gear({
    name: 'DNA Lock',
    folder: 'Cyberdeck Hardware MODs', cost: 'PR',
    description: 'Cyberdeck MOD — 1 hardware slot. Biometric lock. Bypass DV: 17 TECH+Electronics (Security).',
  }),
  gear({
    name: 'Hardened Circuitry',
    folder: 'Cyberdeck Hardware MODs', imgPath: `systems/cyberpunk-blue/assets/items/mods/hardware-mod-hardened-circuitry.png`, cost: 'EX',
    description: 'Cyberdeck MOD — 1 hardware slot. The device is immune to EMP, microwave pulses, and non-Black ICE programs.',
  }),
  gear({
    name: 'Insulated Wiring',
    folder: 'Cyberdeck Hardware MODs', cost: 'PR',
    description: 'Cyberdeck MOD — 1 hardware slot. The cyberdeck, runner, and their clothes will not catch fire from program effects.',
  }),
  gear({
    name: 'KRASH-Barrier',
    folder: 'Cyberdeck Hardware MODs', cost: 'PR',
    description: 'Cyberdeck MOD — 1 hardware slot. Unsafe disconnections are made safe.',
  }),
  gear({
    name: 'Range Upgrade',
    folder: 'Cyberdeck Hardware MODs', cost: 'PR',
    description: 'Cyberdeck MOD — 1 hardware slot. Doubles the cyberdeck\'s wireless connection range.',
  }),

  // ── Clandestine Gear ──────────────────────────────────────────────────────

  gear({
    name: 'Bug Detector',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/bug-detector.png`, cost: 'EX',
    description: 'Creates and detects resonance in microphones within 2m.',
  }),
  gear({
    name: 'Caltrops',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/caltrops.png`, cost: 'EV',
    description: 'Covers 2m². Any creature moving through must make a DV15 RFLX+Athletics check or take 1d6 damage per 2m of movement through the area. Shoes have SP 1 against this; army boots have SP 5. DV10 INT+Perception to detect.',
    // Deployed as an "affliction explosion" placement that drops a persistent
    // movement-hazard Region (see createHazardRegion / CyberBlueHazardRegionBehavior).
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 0, hands: 1, concealable: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 1, coneAngle: 45, coneHalfDamageDistance: 0,
      rangeTable: [13, 15, 0, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'rflx', afflictionSkill: 'athletics', afflictionDv: 15, afflictionEffectId: '',
      outerZoneResistBonus: 0,
    }],
    flags: {
      'cyberpunk-blue': {
        deploysHazardRegion: true,
        hazard: { label: 'Caltrops', dv: 15, savePrimary: 'rflx', saveSkill: 'athletics', damageDie: '1d6', metersPerStep: 2 },
      },
    },
  }),
  gear({
    name: 'Disposable Phone',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/disposable-phone.png`, cost: 'CO',
    description: 'Voice and holo-calls without a neuroport.',
  }),
  gear({
    name: 'Handcuffs',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/handcuffs.png`, cost: 'CO',
    description: 'Steel. A character with BODY 10+ can break free.',
  }),
  gear({
    name: 'Homing Tracer',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/homing-tracer.png`, cost: 'PR',
    description: '1 button beacon included; additional beacons cost CO each. City-street range of 1km.',
  }),
  gear({
    name: 'Lock-Picking Kit',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/lock-picking-kit.png`, cost: 'EV',
    description: 'Tools for bypassing mechanical locks.',
  }),
  gear({
    name: 'Radio Communicator',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/radio-communicator.png`, cost: 'CO',
    description: 'Discreet earpiece. 1-mile range; does not use public networks.',
  }),
  gear({
    name: 'Scrambler / Descrambler',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/scrambler-descramber.png`, cost: 'EX',
    description: 'Sold in pairs for encrypted communications. Can read additional encryption keys from a shard.',
  }),
  // Toxin and Toxin, Strong are implemented as weapon-coating Mods (any weapon)
  // — see toxinMods in mod-catalogue.mjs. They are no longer standalone gear.

  // ── Miscellaneous Gear ────────────────────────────────────────────────────

  gear({
    name: 'Glow Paint',
    folder: 'Miscellaneous', imgPath: `${A_GEAR}/glow-paint.png`, cost: 'EV',
    description: 'Rattling spray can of glow-in-the-dark paint.',
  }),
  gear({
    name: 'Glow Stick',
    folder: 'Miscellaneous', imgPath: `${A_GEAR}/glow-stick.png`, cost: 'CH',
    description: '4m radius illumination, lasts up to 10 hours. Single use.',
  }),
  gear({
    name: 'Linear Frame Sigma',
    folder: 'Miscellaneous', cost: 'VEX',
    description: 'Exoskeleton. Connect via Personal Link as an Action; regular limbs are unavailable until disconnected (also an Action). While connected, perform strength-based tasks as if BODY were 12.',
    effects: [aeOff('Linear Frame Sigma Connected (BODY 12)', [statOvr('body', 12)])],
    instructions: [
      S.message('<p><strong>Linear Frame Sigma connected</strong> — strength-based tasks as if BODY were 12. Regular limbs unavailable while connected.</p>', { name: 'Connect' }),
      S.effect({ name: 'Apply BODY Override', effectName: 'Linear Frame Sigma Connected (BODY 12)' }),
      S.message('<p>Linear Frame Sigma disconnected. Regular limbs restored.</p>', { name: 'Disconnect', terminates: true }),
    ],
  }),
  gear({
    name: 'Linear Frame Beta',
    folder: 'Miscellaneous', cost: 'LUX',
    description: 'Exoskeleton. Connect via Personal Link as an Action; regular limbs are unavailable until disconnected (also an Action). While connected, perform strength-based tasks as if BODY were 14.',
    effects: [aeOff('Linear Frame Beta Connected (BODY 14)', [statOvr('body', 14)])],
    instructions: [
      S.message('<p><strong>Linear Frame Beta connected</strong> — strength-based tasks as if BODY were 14. Regular limbs unavailable while connected.</p>', { name: 'Connect' }),
      S.effect({ name: 'Apply BODY Override', effectName: 'Linear Frame Beta Connected (BODY 14)' }),
      S.message('<p>Linear Frame Beta disconnected. Regular limbs restored.</p>', { name: 'Disconnect', terminates: true }),
    ],
  }),

  // ── Chipware ──────────────────────────────────────────────────────────────
  // Chipware is treated as Gear. Active while equipped in a shard socket.

  gear({
    name: 'Chemical Sniffer Chip', imgPath: `${A_CHIPWARE}/chemical-sniffer.png`,
    folder: 'Chipware', cost: 'EX',
    description: 'Chipware — equipped in a shard socket. Identifies most compounds by comparing smell and touch against an onboard database.',
  }),
  gear({
    name: 'Language Chip', imgPath: `${A_CHIPWARE}/language.png`,
    folder: 'Chipware', cost: 'EX',
    description: 'Chipware — equipped in a shard socket. Full language comprehension while installed; sub-second processing lag.',
  }),
  gear({
    name: 'Olfactory Boost Chip', imgPath: `${A_CHIPWARE}/olfactory-boost.png`,
    folder: 'Chipware', cost: 'PR',
    description: 'Chipware — equipped in a shard socket. Scent-based tracking using Survival; +2 to scent-based Perception checks.',
    effects: [reminder('Scent Perception +2 (situational)')],
  }),
  gear({
    name: 'Pain Editor Chip', imgPath: `${A_CHIPWARE}/pain-editor.png`,
    folder: 'Chipware', cost: 'EX',
    description: 'Chipware — equipped in a shard socket. Ignore Seriously Wounded penalties while installed.',
    effects: [{
      name: 'Pain Editor: Ignore Seriously Wounded',
      disabled: false, transfer: true, changes: [],
      flags: { 'cyberpunk-blue': { painEditor: true } },
    }],
  }),
  gear({
    name: 'Skill Chip', imgPath: `${A_CHIPWARE}/skill-chip.png`,
    folder: 'Chipware', cost: 'EX',
    description: 'Chipware — equipped in a shard socket. Covers one Skill or Component. While installed: if the user has fewer than 3 ranks in that Skill or Component, it is treated as 3.',
  }),
  gear({
    name: 'Tactile Boost Chip', imgPath: `${A_CHIPWARE}/tactile-boost.png`,
    folder: 'Chipware', cost: 'PR',
    description: 'Chipware — equipped in a shard socket. Detects motion within 20 units on any surface being touched.',
  }),

  // ── Architecture Hardware ─────────────────────────────────────────────────

  gear({
    name: 'MicroComp',
    folder: 'Architecture Hardware', cost: 'CO',
    isComputer: true,
    computer: { nodes: 2, softwareSlots: 4 },
    description: 'Architecture Hardware. 2 nodes, 4 active program slots.',
  }),
  gear({
    name: 'MicroComp, Advanced',
    folder: 'Architecture Hardware', cost: 'PR',
    isComputer: true,
    computer: { nodes: 3, softwareSlots: 5 },
    description: 'Architecture Hardware. 3 nodes, 5 active program slots.',
  }),
  gear({
    name: 'Laptop',
    folder: 'Architecture Hardware', cost: 'PR',
    isComputer: true,
    computer: { nodes: 4, softwareSlots: 5 },
    description: 'Architecture Hardware. 4 nodes, 5 active program slots.',
  }),
  gear({
    name: 'Laptop, Advanced',
    folder: 'Architecture Hardware', cost: 'EX',
    isComputer: true,
    computer: { nodes: 6, softwareSlots: 7 },
    description: 'Architecture Hardware. 6 nodes, 7 active program slots.',
  }),
  gear({
    name: 'Desktop',
    folder: 'Architecture Hardware', cost: 'EX',
    isComputer: true,
    computer: { nodes: 5, softwareSlots: 8 },
    description: 'Architecture Hardware. 5 nodes, 8 active program slots.',
  }),
  gear({
    name: 'Desktop, Advanced',
    folder: 'Architecture Hardware', cost: 'VEX',
    isComputer: true,
    computer: { nodes: 7, softwareSlots: 10 },
    description: 'Architecture Hardware. 7 nodes, 10 active program slots.',
  }),
  gear({
    name: 'Server',
    folder: 'Architecture Hardware', cost: 'VEX',
    isComputer: true,
    computer: { nodes: 8, softwareSlots: 11 },
    description: 'Architecture Hardware. 8 nodes, 11 active program slots.',
  }),
  gear({
    name: 'Server, High Capacity',
    folder: 'Architecture Hardware', cost: 'LUX',
    isComputer: true,
    computer: { nodes: 12, softwareSlots: 16 },
    description: 'Architecture Hardware. 12 nodes, 16 active program slots.',
  }),
  gear({
    name: 'Access Point',
    folder: 'Architecture Hardware', cost: 'CO',
    description: 'Architecture Hardware add-on. Provides a wired and wireless (10m; each toggled independently via circuitboard) connection to a node.',
  }),
  // Coolant, Insulation, and Memory Upgrade are computerMod items — see mod-catalogue.mjs

  // ── Body Armor ─────────────────────────────────────────────────────────────
  gear({
    name: 'Leather Armor',
    manufacturer: 'Aldecaldos',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/leather-armor.png`, cost: 'EV',
    isArmor: true, maxSp: 4,
    description: 'Favored by Nomads and \'punks on bikes.',
  }),
  gear({
    name: 'Kevlar',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/kevlar-armor.png`, cost: 'CO',
    isArmor: true, maxSp: 7,
    description: 'Woven into clothes; from business suits to bikinis.',
  }),
  gear({
    name: 'Heavy Armorjack',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/heavy-armorjack.png`, cost: 'EX',
    isArmor: true, maxSp: 13,
    description: 'Metal-supported heavy Kevlar with layered polymer meshes.',
    effects: [ae('Heavy Armorjack', [stat('rflx', -2), stat('move', -1)])],
  }),
  gear({
    name: 'Medium Armorjack',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/medium-armorjack.png`, cost: 'PR',
    isArmor: true, maxSp: 12,
    description: 'Solid polymer plating, reinforced by a Kevlar® mesh.',
    effects: [ae('Medium Armorjack', [stat('rflx', -2), stat('move', -1)])],
  }),
  gear({
    name: 'Light Armorjack',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/light-armorjack.png`, cost: 'PR',
    isArmor: true, maxSp: 11,
    description: 'Kevlar® and plastics woven into reinforced fabric fibers that can be part of, or under, clothes.',
  }),
  gear({
    name: 'Light Bodyweight Suit',
    manufacturer: 'Netwatch',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/light-bodyweight-suit.png`, cost: 'EX',
    isArmor: true, maxSp: 9,
    description: 'Skin-tight suit able to connect to a netrunning chair. Blocks programs from setting the wearer on fire. Reduces damage from Black ICE by 1.',
    effects: [
      reminder('Blocks programs from setting the wearer on fire'),
      reminder('Reduces damage from Black ICE by 1'),
    ],
  }),
  gear({
    name: 'Bodyweight Suit',
    manufacturer: 'Netwatch',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/bodyweight-suit.png`, cost: 'VEX',
    isArmor: true, maxSp: 11,
    description: 'Like the light version, sintered armor-gel layered in key areas. Reduces damage from both Black ICE and remote hacking by 1 and blocks programs from setting the wearer or their equipment on fire.',
    effects: [
      reminder('Reduces damage from Black ICE and remote hacking by 1'),
      reminder('Blocks programs from setting the wearer or their equipment on fire'),
    ],
  }),
  gear({
    name: 'Flak',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/flak-armor.png`, cost: 'EX',
    isArmor: true, maxSp: 15,
    description: 'Flack vest and pants. Inflexible, solid armor.',
    effects: [ae('Flak', [stat('rflx', -4), stat('move', -3)])],
  }),
  gear({
    name: 'Metalgear',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/metalgear-armor.png`, cost: 'LUX',
    isArmor: true, maxSp: 18,
    description: 'Thick armor-plating. Inflexible.',
    effects: [ae('Metalgear', [stat('rflx', -4), stat('move', -4)])],
  }),
  gear({
    name: 'Bulletproof Shield',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/bulletproof-shield.png`, cost: 'EX',
    isArmor: true, maxSp: 15,
    description: 'SP 15. Held in one hand; provides frontal cover. While held, cannot use a two-handed weapon or carry anything in that hand.',
  }),
];
