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

import {
  BLIND_ATTACK_SKILLS as BLIND_SKILLS,
  BLIND_ATTACK_PENALTY as BLIND_PENALTY,
} from '../helpers/blind.mjs';
import { stylesFor } from './style-catalogue.mjs';

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

const h = (text) => /^\s*<(p|ul|ol|div|h\d|table)\b/i.test(text) ? text : `<p>${text}</p>`;

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
  'Footwear/Entropism': `${A_CLOTHES}/entropism-footwear-old-style-western-boots.png`,
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
// v14: AE changes live under `system.changes`, not at the top level. A top-level
// `changes` array survives only through a deprecated creation-data migration
// that is removed in v16, so effect create-data is authored nested here.
const ae      = (name, changes) => ({ name, disabled: false, transfer: true, system: { changes } });
const aeOff   = (name, changes) => ({ name, disabled: true,  transfer: true, system: { changes }, flags: { 'cyberpunk-blue': { noGearStateSync: true } } });
const reminder = (name)         => ({ name, disabled: false, transfer: true, system: { changes: [] } });
const stat    = (slug, val) => ({ key: `system.stats.${slug}.value`,          type: 'add',      value: String(val) });
const statOvr = (slug, val) => ({ key: `system.stats.${slug}.value`,          type: 'override', value: String(val) });
const statMod = (slug, val) => ({ key: `system.stats.${slug}.rollMod`,        type: 'add',      value: String(val) });
// Skill/component AEs target `.bonus` (a check bonus), never `.rank` — modifying
// `.rank` corrupts the player-set rank. See module/data/actor-character.mjs.
const skill   = (slug, val) => ({ key: `system.skills.${slug}.bonus`,         type: 'add',      value: String(val) });
const comp    = (slug, val) => ({ key: `system.components.${slug}.bonus`,     type: 'add',      value: String(val) });
// General channel: added on top of the min, never capped (tools that always help).
const skillGen = (slug, val) => ({ key: `system.skills.${slug}.generalBonus`, type: 'add',      value: String(val) });

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
      styles: stylesFor(name),
      selectedStyle: '',
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
    '<strong>ENTROPISM — NECESSITY OVER STYLE:</strong> This is the survival ethos born from the Time of the Red. ' +
    'Materials must be rough and durable, with pockets or attachment points for gear. ' +
    'Headgear protects from sun and acid rain, and footwear handles rough terrain. ' +
    'Military surplus is a common source. The style is prevalent in Santo Domingo and the Northside Industrial District.',
  Kitch:
    '<strong>KITCH — STYLE OVER SUBSTANCE:</strong> This style is all about making a statement, and more is more: ' +
    'bold colors, unique hairstyles, and impressive jewelry or cyberware threading. Clothes and decorations ' +
    'often have embedded tech that produces light effects. It is the default style across most of Night City.',
  Neomilitarism:
    '<strong>NEOMILITARISM — SUBSTANCE OVER STYLE:</strong> This is the corporate cold show of power, built on minimalism, ' +
    'strict lines, and quality materials. It makes one statement, perfectly executed. The style is popular among career ' +
    'corpos and high society throughout central Night City.',
  Neokitch:
    '<strong>NEOKITCH — STYLE AND SUBSTANCE:</strong> This is a statement perfectly tailored to its message, designed ' +
    'specifically for the wearer and the context. Only the ultra-rich, or those well connected in fashion, can maintain ' +
    'true Neokitch style. It is found mostly in Westbrook and Downtown.',
};

// Lead-in sentence per garment type, so each clothing description opens with a
// complete sentence rather than a bare noun label.
const CLOTHING_LEAD = {
  Bottoms:  'A pair of bottoms cut in the {style} style.',
  Top:      'A top cut in the {style} style.',
  Jacket:   'A jacket cut in the {style} style.',
  Footwear: 'A pair of shoes made in the {style} style.',
  Jewelry:  'A piece of jewelry made in the {style} style.',
  Shades:   'A pair of shades made in the {style} style.',
  Glasses:  'A pair of glasses made in the {style} style.',
  Headwear: 'A piece of headwear made in the {style} style.',
};

// Clothing type → Outfit subfolder. Keeps the compendium browsable as more
// specific garments are added; CLOTHING_SUBFOLDERS below lists every subfolder
// that should exist, including ones with no items yet.
const CLOTHING_FOLDER = {
  Bottoms: 'Bottoms', Top: 'Tops', Jacket: 'Jackets', Footwear: 'Footwear',
  Jewelry: 'Jewelry', Shades: 'Shades', Glasses: 'Glasses', Headwear: 'Headwear',
};
export const CLOTHING_SUBFOLDERS = [
  'Bottoms', 'Tops', 'Jackets', 'Footwear', 'Jewelry', 'Shades', 'Glasses',
  'Headwear', 'Full body', 'Dresses', 'Skirts',
];

function clothing(type, style, cost) {
  const imgPath = CLOTHING_IMG[`${type}/${style}`] ?? CLOTHING_IMG[`_/${style}`] ?? '';
  return gear({
    name: `${type} (${style})`,
    folder: `Outfit/${CLOTHING_FOLDER[type] ?? type}`,
    cost,
    imgPath,
    description: `<p>${(CLOTHING_LEAD[type] ?? `A piece of ${type.toLowerCase()} made in the {style} style.`).replace('{style}', style)}</p>`
      + `<p>${STYLE_DESC[style]}</p>`,
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

  // Named one-off garments — specific pieces rather than a type/style combo.
  gear({
    name: 'Wraith Jacket',
    folder: 'Outfit/Jackets', imgPath: `${A_CLOTHES}/entropism-jacket-wraith-jacket.png`, cost: 'CO',
    description: 'A tough leather jacket made for style and races through the desert. Colors appropriate to the Wraith clan of nomads.',
  }),
  gear({
    name: 'King of Pentacles Coat',
    folder: 'Outfit/Jackets', imgPath: `${A_CLOTHES}/neomilitarism-coat-king-of-pentacles.png`, cost: 'PR',
    description: 'A heavy leather coat that sends a message. That message is &ldquo;stay away, I&rsquo;m brooding.&rdquo;',
  }),

  // ── Grenades ──────────────────────────────────────────────────────────────

  gear({
    name: 'EMP Grenade', manufacturer: 'Zetatech',
    folder: 'Grenades', imgPath: `${A_AMMO}/EMP-Grenade.png`, cost: 'EX',
    description: '<p>This grenade deals no damage and ablates no SP, because nothing physical touches the armor.</p><p><strong>AOE:</strong> The blast fills a 4m inner / 8m outer sphere, and targets in the outer zone get <strong>+2</strong> to resist. A target must pass a <strong style="color: var(--cpb-accent);">DV 15</strong> <strong>TECH</strong>+<strong>Endurance</strong> check or have two random non-insulated pieces of cyberware (or other electronics) disabled for the next minute.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 8, coneAngle: 45, coneHalfDamageDistance: 4,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'tech', afflictionSkill: 'endurance', afflictionDv: 15, afflictionEffectId: '',
      outerZoneResistBonus: 2,
    }],
    effects: [{
      name: 'Cyberware Disabled (EMP)',
      disabled: true, transfer: false,
      system: { changes: [{ key: 'cyberblue.disableCyberware.random', type: 'add', value: '2' }] },
      duration: { value: 60, units: 'seconds' },
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Incendiary Grenade', manufacturer: 'Militech',
    folder: 'Grenades', imgPath: `${A_AMMO}/Incendiary-Grenade.png`, cost: 'PR',
    description: '<p><strong>AOE:</strong> 6m inner / 10m outer sphere dealing <strong>6d6</strong>. A target with <strong>RFLX</strong> 8+ may roll <strong>Evasion</strong> to halve the damage they would have taken.</p><p><strong>IGNITION:</strong> anyone who takes HP damage catches fire — <strong>Burning</strong> (2 points at the end of each turn) until put out with an Action. It burns for twenty rounds after the last ignition if never extinguished. Multiple instances don\'t stack.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '6d6', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
      damageType: 'explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 10, coneAngle: 45, coneHalfDamageDistance: 6,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'body', afflictionSkill: 'endurance', afflictionDv: 13, afflictionEffectId: '',
      outerZoneResistBonus: 2, ignitesOnDamage: true,
    }],
  }),
  gear({
    name: 'Knock-Out Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Knock-out-Gas-Grenade.png`, cost: 'EX',
    description: '<p>This grenade deals no damage and ablates no SP.</p><p><strong>AOE:</strong> The cloud fills a 4m inner / 8m outer sphere, and targets in the outer zone get <strong>+5</strong> to resist. A target must pass a <strong style="color: var(--cpb-accent);">DV 13</strong> <strong>BODY</strong>+<strong>Endurance</strong> check or fall unconscious for a number of minutes equal to the margin of failure, waking early from damage or from an Action taken to rouse them.</p><p><strong>DISPERSAL:</strong> Both radii shrink by 2m after each subsequent turn, and the cloud drifts with the wind.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
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
      disabled: true, transfer: false, system: { changes: [] },
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Smoke Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Smoke-Grenade.png`, cost: 'CO',
    description: '<p>This grenade deals no damage.</p><p><strong>AOE:</strong> The cloud fills a 16m inner / 22m outer sphere. A target must pass a <strong style="color: var(--cpb-accent);">DV 13</strong> <strong>BODY</strong>+<strong>Endurance</strong> check or suffer the Damaged Eye critical injury for 1 minute.</p><p><strong>DISPERSAL:</strong> Both radii shrink by 2m after each subsequent turn, and the cloud drifts with the wind.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
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
      disabled: true, transfer: false, system: { changes: [] },
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Teargas Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Teargas-Grenade.png`, cost: 'CO',
    description: '<p>This grenade deals no damage.</p><p><strong>AOE:</strong> The cloud fills a 10m inner / 12m outer sphere, and targets in the outer zone get <strong>+4</strong> to resist. A target must pass a <strong style="color: var(--cpb-accent);">DV 13</strong> <strong>BODY</strong>+<strong>Endurance</strong> check or suffer the Damaged Eye critical injury for 1 minute.</p><p><strong>DISPERSAL:</strong> Both radii shrink by 2m after each subsequent turn, and the cloud drifts with the wind.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
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
      disabled: true, transfer: false, system: { changes: [] },
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Flashbang Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Flasgbang-Grenade.png`, cost: 'EX',
    description: '<p>This grenade deals no damage.</p><p><strong>AOE:</strong> The blast fills a 10m inner / 12m outer sphere, and targets in the outer zone get <strong>+4</strong> to resist. A target must pass a <strong style="color: var(--cpb-accent);">DV 17</strong> <strong>RFLX</strong>+<strong>Athletics</strong> check or become Blinded and Deafened for 1 round.</p><p><strong>DISPERSAL:</strong> Both radii shrink by 2m after each subsequent turn.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '0', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
      damageType: 'affliction-explosion', autofireMultiplier: 1, autofireRangeTable: Array(8).fill(0),
      coneSpread: 12, coneAngle: 45, coneHalfDamageDistance: 10,
      rangeTable: [15, 13, 25, 0, 0, 0, 0, 0],
      ammoTypeUuid: '', autofireDamage: '',
      isPowerWeapon: false, isSmartWeapon: false, isTechWeapon: false, isExcellentQuality: false,
      chargeType: '', silenceBuiltIn: false, silenceBuiltInDV: 0,
      jamOnRoll: 0, jamFiresFirst: false, shellDvModifier: 0, targetVitalsPenalty: 8,
      payloadDmgBonus: 0, critSlicing: false, critBlunt: false, critCrushing: false, critStun: false,
      afflictionPrimary: 'rflx', afflictionSkill: 'athletics', afflictionDv: 17, afflictionEffectId: '',
      outerZoneResistBonus: 4,
    }],
    // Failing the DV17 check applies the Blind and Deaf conditions for 1 round:
    // `statuses` marks the token and drives the Blind attack rules in
    // helpers/blind.mjs, the changes carry Blind's −10, and afflictionRounds
    // has the combat sweep remove the whole thing a round later.
    effects: [{
      name: 'Flashbang: Blinded and Deafened',
      description: 'Blinded and Deafened for 1 round: no task that requires sight, −10 to Handgun / Shoulder Arms / Heavy Weapons attacks, and those attacks automatically miss past 5 m.',
      disabled: true, transfer: false,
      statuses: ['blind', 'deaf'],
      duration: { value: 1, units: 'rounds' },
      system: { changes: BLIND_SKILLS.map((slug) => skillGen(slug, BLIND_PENALTY)) },
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true, afflictionRounds: 1 } },
    }],
  }),
  gear({
    name: 'Toxic Grenade',
    folder: 'Grenades', imgPath: `${A_AMMO}/Toxic-Gas-Grenade.png`, cost: 'EX',
    description: '<p>This grenade deals no damage, ablates no SP, and cannot cause critical injuries.</p><p><strong>AOE:</strong> The cloud fills a 4m inner / 10m outer sphere, and targets in the outer zone get <strong>+2</strong> to resist. A target must pass a <strong style="color: var(--cpb-accent);">DV 15</strong> <strong>BODY</strong>+<strong>Endurance</strong> check or take <strong>2d6</strong> to HP, taking half that damage, rounded down, on a successful resist.</p><p><strong>DISPERSAL:</strong> Both radii shrink by 2m after each subsequent turn, and the cloud drifts with the wind.</p>',
    isWeapon: true,
    weapons: [{
      type: 'thrown', skill: 'athletics', damage: '2d6', rateOfFire: 1,
      magazine: 0, ammoCurrent: 0, shots: 1, hands: 1, concealable: true, consumableThrown: true,
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
    name: 'Audio Recorder', manufacturer: 'Fuyutsuki',
    folder: 'Media Gear', imgPath: `${A_GEAR}/audio-recorder.png`, cost: 'CO',
    description: 'This recorder holds up to 24 hours of audio per shard, and one shard is included.',
  }),
  gear({
    name: 'Braindance',
    folder: 'Media Gear', imgPath: `${A_GEAR}/braindance.png`, cost: 'PR',
    description: 'This shard holds up to 4 hours of full-sensory recorded experience.',
  }),
  gear({
    name: 'Braindance Wreath', manufacturer: 'Segotari',
    folder: 'Media Gear', imgPath: `${A_GEAR}/braindance-wreath.png`, cost: 'EX',
    description: 'This headset is required in order to experience a Braindance recording.',
  }),
  gear({
    name: 'IR-Flashlight', manufacturer: 'EBM',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/EBM-IR-Flashlight.png`, cost: 'PR',
    description: 'Turned on or off with little effort. While on it casts either a narrow column of bright light or a wide cone of dim light — entirely in the infrared, and so invisible to anyone without the ability to see that part of the spectrum.',
  }),
  gear({
    name: 'The Snitcher', manufacturer: 'Fourth Wall',
    folder: 'Media Gear', imgPath: `${A_GEAR}/BD-TheSnitcher.png`, cost: 'CO',
    description: '<p>This Braindance is a historical police drama set in 1992. Three hardened detectives are hunting a group of robbers, one of whom keeps leaving clues for them. Meanwhile, the robbers always seem to have insider info on the cops&hellip;</p>',
  }),
  gear({
    name: 'Drum Synthesizer', manufacturer: 'Fuyutsuki',
    folder: 'Media Gear', imgPath: `${A_GEAR}/drum-synthesizer.png`, cost: 'EX',
    description: 'This instrument is a set of plastic pads that simulate a drum kit, and it comes with pre-programmed beats and loops. It requires a pocket amplifier or a full amp.',
  }),
  gear({
    name: 'Electric Guitar', manufacturer: 'Fuyutsuki',
    folder: 'Media Gear', imgPath: `${A_GEAR}/electric-guitar.png`, cost: 'EX',
    description: 'This is a standard electric guitar. It requires a pocket amplifier or a full amp.',
  }),
  gear({
    name: 'Movie (Shard)',
    folder: 'Media Gear', imgPath: `${A_GEAR}/movie.png`, cost: 'CO',
    description: 'This shard holds between 2 and 5 hours of screen-viewable content.',
  }),
  gear({
    name: 'Music Album (Shard)',
    folder: 'Media Gear', imgPath: `${A_GEAR}/music-album.png`, cost: 'CH',
    description: 'This album holds 10 to 20 songs on a shard or a legacy format.',
  }),
  gear({
    name: 'Pocket Amplifier', manufacturer: 'Fuyutsuki',
    folder: 'Media Gear', imgPath: `${A_GEAR}/pocket-amp.png`, cost: 'PR',
    description: 'This amplifier is roughly the size of a large book. It connects up to 2 instruments and puts out up to 90dB.',
  }),
  gear({
    name: 'Radio / Music Player', manufacturer: 'Fuyutsuki',
    folder: 'Media Gear', imgPath: `${A_GEAR}/music-player.png`, cost: 'CO',
    description: 'This player can play audio from the Data Pool, a memory chip, or a radio broadcast.',
  }),
  gear({
    name: 'Video Camera', manufacturer: 'Fuyutsuki',
    folder: 'Media Gear', imgPath: `${A_GEAR}/video-camera.png`, cost: 'PR',
    description: 'This camera holds up to 10 hours of footage per shard, and one shard is included.',
  }),

  // ── Survival & Exploration Gear ───────────────────────────────────────────

  gear({
    name: 'Anti-Smog Breathing Mask',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/amti-smog-breathing-mask.png`, cost: 'PR',
    description: 'The wearer is immune to airborne toxins that require inhalation while this mask is worn.',
    effects: [reminder('Immune to inhaled toxins while worn')],
  }),
  gear({
    name: 'Auto-Level Ear Protectors', manufacturer: 'Fuyutsuki',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/auto-level-ear-protectors.png`, cost: 'PR',
    description: 'The wearer is immune to deafness effects and to damage from loud noises while these protectors are worn.',
    effects: [reminder('Immune to deafness / loud-noise damage while worn')],
  }),
  gear({
    name: 'Backpack', manufacturer: 'Everest VentureWare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/backpack.png`, cost: 'CO',
    description: 'This backpack is spacious and sturdy enough for a long haul.',
  }),
  gear({
    name: 'Binoculars', manufacturer: 'Militech',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/binoculars.png`, cost: 'CO',
    description: 'These binoculars magnify up to &times;5.',
  }),
  gear({
    name: 'Duct Tape',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/duct-tape.png`, cost: 'EV',
    description: 'This is a 100m roll of duct tape, available in glow-in-the-dark color options.',
  }),
  gear({
    name: 'Flashlight', manufacturer: 'Everest VentureWare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/flashlight.png`, cost: 'EV',
    description: 'This flashlight throws an illumination beam up to 100m.',
  }),
  gear({
    name: 'Food Stick', manufacturer: 'AllFoods',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/food-stick.png`, cost: 'CH',
    description: 'This stick is one full meal, and it comes in various awful flavors.',
  }),
  gear({
    name: 'Grapple Gun', manufacturer: 'Everest VentureWare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/grappling-gun.png`, cost: 'PR',
    description: 'This gun fires a rocket-propelled grapple that embeds in thick cover within 30m. Firing or fully retracting it takes an Action. The 30m rope carries 2 people and has 10 HP.',
  }),
  gear({
    name: 'Inflatable Bed & Sleeping Bag', manufacturer: 'Everest VentureWare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/inflatable-bed-and-sleeping-bag.png`, cost: 'EV',
    description: 'This bedroll folds down to a 15&times;15&times;10cm package.',
  }),
  gear({
    name: 'Personal Care Pack',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/personal-care-pack.png`, cost: 'EV',
    description: 'This pack holds a toothbrush, a towel, soap, and other basic hygiene items.',
  }),
  gear({
    name: 'Radar Detector',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/radar-detector.png`, cost: 'EX',
    description: 'This detector picks up radar, ladar, and echo scans in the area, and it triangulates the source to within a 10% margin.',
  }),
  gear({
    name: 'Road Flare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/road-flare.png`, cost: 'CH',
    description: 'This flare lights a 100m radius for 1 hour and is single use. It is available in various colors.',
  }),
  gear({
    name: 'Rope', manufacturer: 'Everest VentureWare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/rope.png`, cost: 'EV',
    description: 'This is 60m of nylon rope with a 400kg capacity.',
  }),
  gear({
    name: 'Tent & Camping Equipment', manufacturer: 'Everest VentureWare',
    folder: 'Survival & Exploration', imgPath: `${A_GEAR}/tent-and-camping-equipment.png`, cost: 'CO',
    description: 'This kit holds a small tent, a self-heating pot that runs for 2 hours on a 5-minute recharge, and basic utensils.',
  }),

  // ── Scientific & Medical Equipment ────────────────────────────────────────

  gear({
    name: 'Airhypo',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/airhypo.png`, cost: 'CO',
    description: '<p>Holds up to 3 drug ampules. Administers a dose as an Action. To inject an unwilling target, make a <strong>BODY</strong>+<strong>Melee Weapons</strong> attack instead of dealing damage on a hit.</p>',
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
      disabled: true, transfer: false, system: { changes: [] },
      flags: { 'cyberpunk-blue': { isAfflictionEffect: true } },
    }],
  }),
  gear({
    name: 'Chemical Analyzer', manufacturer: 'Tanson',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/chemical-analyzer.png`, cost: 'VEX',
    description: 'Inserting a sample takes an Action, and the analyzer identifies the compound on the following round.',
  }),
  gear({
    name: 'Cryopump',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/cryobag.png`, cost: 'LUX',
    description: '<p>This briefcase unfolds into a body bag and coolant pump as an Action, and the bag has 15 HP. A <strong style="color: var(--cpb-accent);">DV 12</strong> <strong>TECH</strong>+<strong>Medicine</strong> (Cryotech) check as an Action places a person in stasis for up to 1 week.</p><p><strong>PREREQUISITE:</strong> Only a Medtech can operate this device. Recharging it costs &euro;$50 (Costly).</p>',
  }),
  gear({
    name: 'Cryotank',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/cryotank.png`, cost: 'LUX',
    description: '<p>A <strong style="color: var(--cpb-accent);">DV 15</strong> <strong>TECH</strong>+<strong>Medicine</strong> (Cryotech) check places a person in indefinite stasis, or in conscious suspension at twice the natural healing rate.</p><p><strong>PREREQUISITE:</strong> Only a Medtech can operate this device.</p>',
  }),
  gear({
    name: 'Medscanner', manufacturer: 'Trauma Team',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/medscanner.png`, cost: 'VEX',
    description: 'This scanner performs most medical tests and grants <strong>+2</strong> to <strong>Medicine</strong> checks.',
    effects: [ae('Medicine +2', [skill('medicine', 2)])],
  }),
  gear({
    name: 'Medtech Bag',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/medtech-bag.png`, cost: 'PR',
    description: 'Complete set of basic medicine tools; equivalent to mall-level medical facilities.',
  }),
  gear({
    name: 'Tech Bag', manufacturer: 'Tanson',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/tech-bag.png`, cost: 'EX',
    description: '<p><strong>CONTAINS:</strong></p><ul><li>Techtool</li><li>Hammer</li><li>2 prybars</li><li>Heat torch</li><li>Voltmeter</li><li>Assorted screws, nuts, and wire</li></ul>',
  }),
  gear({
    name: 'Techscanner',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/techscanner.png`, cost: 'VEX',
    description: '<p><strong>+2</strong> to <strong>Electronics</strong> and <strong>Mechanics</strong> checks (hardware only).</p>',
    effects: [ae('Electronics +2, Mechanics +2 (hardware)', [skillGen('electronics', 2), skillGen('mechanics', 2)])],
  }),
  gear({
    name: 'Techtool', manufacturer: 'Tanson',
    folder: 'Scientific & Medical', imgPath: `${A_GEAR}/techtool.png`, cost: 'PR',
    description: 'Multi-tool containing pliers, blade, screwdrivers, files, and clippers.',
  }),

  // ── Computer Hardware ─────────────────────────────────────────────────────

  gear({
    name: 'Cyberdeck, Poor', manufacturer: 'SoftSys', imgPath: `${A_GEAR}/poor-cyberdeck.png`,
    folder: 'Computer Hardware', cost: 'PR',
    isComputer: true,
    computer: { generalSlots: 5, ram: 4, isCyberdeck: true, canQuickhack: true },
    description: '5 general slots (hardware Mods or software Executables), 4 RAM, 10m wireless range. Requires a Neuroport Cyberdeck Port or Interface Plugs to use.',
  }),
  gear({
    name: 'Cyberdeck, Standard', manufacturer: 'Zetatech', imgPath: `${A_GEAR}/standard-cyberdeck.png`,
    folder: 'Computer Hardware', cost: 'EX',
    isComputer: true,
    computer: { generalSlots: 7, ram: 6, isCyberdeck: true, canQuickhack: true },
    description: '7 general slots (hardware Mods or software Executables), 6 RAM, 10m wireless range. Requires a Neuroport Cyberdeck Port or Interface Plugs to use.',
  }),
  gear({
    name: 'Cyberdeck, Excellent', manufacturer: 'Arasaka', imgPath: `${A_GEAR}/excellent-cyberdeck.png`,
    folder: 'Computer Hardware', cost: 'VEX',
    isComputer: true,
    computer: { generalSlots: 9, ram: 8, isCyberdeck: true, canQuickhack: true },
    description: 'This deck has 9 general slots for hardware Mods or software Executables, 8 RAM, and a 10m wireless range. It requires a Neuroport Cyberdeck Port or Interface Plugs to use.',
  }),
  gear({
    name: 'Memory Shard',
    folder: 'Computer Hardware', imgPath: `${A_GEAR}/memory-card.png`, cost: 'CH',
    description: 'This data storage wafer fits any standard shard socket.',
  }),
  gear({
    name: 'Netrunner Chair',
    folder: 'Computer Hardware', imgPath: `${A_GEAR}/netrunning-chair.png`, cost: 'VEX',
    isComputer: true,
    computer: { hardwareSlots: 1 },
    description: 'This chair provides 1 hardware slot, which functions as part of a connected cyberdeck, and grants <strong>&minus;2</strong> to remote hack damage while the netrunner is seated. It requires a Neuroport Cyberdeck Port.',
  }),
  gear({
    name: 'Netrunner Chair, Advanced',
    folder: 'Computer Hardware', imgPath: `${A_GEAR}/netrunning-chair-advanced.png`, cost: 'LUX',
    isComputer: true,
    computer: { hardwareSlots: 2 },
    description: 'This chair grants <strong>+1</strong> NET Action per turn and provides 2 hardware slots, which function as part of a connected cyberdeck. It also grants <strong>&minus;3</strong> to remote hack damage while the netrunner is seated. It requires a Neuroport Cyberdeck Port.',
  }),
  gear({
    name: 'Smart Visor', manufacturer: 'Tanson',
    folder: 'Computer Hardware', imgPath: `${A_GEAR}/smart-visor.png`, cost: 'EX',
    description: '<p>Functions as a 2-slot cybereye with Virtuality pre-installed while worn.</p><p><strong>NOTE:</strong> interaction with installed cyberoptics may vary; consult your GM.</p>',
  }),

  // ── Cyberdeck Hardware MODs ───────────────────────────────────────────────
  // Backup Drive, DNA Lock, Hardened Circuitry, Insulated Wiring, KRASH-Barrier,
  // and Range Upgrade are computerMod items — see mod-catalogue.mjs.

  // ── Clandestine Gear ──────────────────────────────────────────────────────

  gear({
    name: 'Bug Detector', manufacturer: 'SecSystems',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/bug-detector.png`, cost: 'EX',
    description: 'Creates and detects resonance in microphones within 2m.',
  }),
  gear({
    name: 'Caltrops',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/caltrops.png`, cost: 'EV',
    description: '<p>A scattering of caltrops covers 2m&sup2;. Any creature moving through the area must pass a <strong style="color: var(--cpb-accent);">DV 15</strong> <strong>RFLX</strong>+<strong>Athletics</strong> check or take <strong>1d6</strong> damage per 2m of movement through it. Shoes count as SP 1 against this, and army boots as SP 5.</p><p><strong>SPOTTING:</strong> Noticing the caltrops requires a <strong style="color: var(--cpb-accent);">DV 10</strong> <strong>INT</strong>+<strong>Perception</strong> check.</p>',
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
    name: 'Disposable Phone', manufacturer: 'Zetatech',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/disposable-phone.png`, cost: 'CO',
    description: 'This phone handles voice and holo-calls without needing a neuroport.',
  }),
  gear({
    name: 'Handcuffs',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/handcuffs.png`, cost: 'CO',
    description: 'These cuffs are solid steel. A character with <strong>BODY</strong> 10 or higher can break free of them.',
  }),
  gear({
    name: 'Homing Tracer', manufacturer: 'SecSystems',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/homing-tracer.png`, cost: 'PR',
    description: 'This tracer comes with 1 button beacon, and additional beacons cost &euro;$50 (Costly) each. It has a city-street range of 1km.',
  }),
  gear({
    name: 'Lock-Picking Kit',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/lock-picking-kit.png`, cost: 'EV',
    description: 'This kit holds the tools needed to bypass mechanical locks.',
  }),
  gear({
    name: 'Radio Communicator', manufacturer: 'Zetatech',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/radio-communicator.png`, cost: 'CO',
    description: 'This discreet earpiece has a 1-mile range and does not use public networks.',
  }),
  gear({
    name: 'Scrambler / Descrambler', manufacturer: 'SecSystems',
    folder: 'Clandestine Gear', imgPath: `${A_GEAR}/scrambler-descramber.png`, cost: 'EX',
    description: 'These units are sold in pairs for encrypted communications, and they can read additional encryption keys from a shard.',
  }),
  // Toxin and Toxin, Strong are implemented as weapon-coating Mods (any weapon)
  // — see toxinMods in mod-catalogue.mjs. They are no longer standalone gear.

  // ── Miscellaneous Gear ────────────────────────────────────────────────────

  gear({
    name: 'Glow Paint', manufacturer: 'Spectra Underground',
    folder: 'Miscellaneous', imgPath: `${A_GEAR}/glow-paint.png`, cost: 'EV',
    description: 'This is a rattling spray can of glow-in-the-dark paint.',
  }),
  gear({
    name: 'Glow Stick', manufacturer: 'Spectra Underground',
    folder: 'Miscellaneous', imgPath: `${A_GEAR}/glow-stick.png`, cost: 'CH',
    description: 'This stick lights a 4m radius for up to 10 hours, and it is single use.',
  }),
  gear({
    name: 'Linear Frame Sigma',
    folder: 'Miscellaneous', imgPath: `${A_GEAR}/frame-sigma.png`, cost: 'VEX',
    description: 'This exoskeleton is connected via Personal Link as an Action, and the wearer&rsquo;s own limbs are unavailable until it is disconnected, which is also an Action. While connected, the wearer performs strength-based tasks as if their <strong>BODY</strong> were 12.',
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
    description: 'This exoskeleton is connected via Personal Link as an Action, and the wearer&rsquo;s own limbs are unavailable until it is disconnected, which is also an Action. While connected, the wearer performs strength-based tasks as if their <strong>BODY</strong> were 14.',
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
    name: 'Chemical Sniffer Chip', manufacturer: 'Tanson', imgPath: `${A_CHIPWARE}/chemical-sniffer.png`,
    folder: 'Chipware', cost: 'EX',
    description: '<p>This chipware is equipped in a shard socket. It identifies most compounds by comparing smell and touch against an onboard database.</p>',
  }),
  gear({
    name: 'Language Chip', imgPath: `${A_CHIPWARE}/language.png`,
    folder: 'Chipware', cost: 'EX',
    description: '<p>This chipware is equipped in a shard socket. It grants full comprehension of one language while installed, with a sub-second processing lag.</p>',
  }),
  gear({
    name: 'Olfactory Boost Chip', manufacturer: 'Zetatech', imgPath: `${A_CHIPWARE}/olfactory-boost.png`,
    folder: 'Chipware', cost: 'PR',
    description: '<p>This chipware is equipped in a shard socket. It enables scent-based tracking using <strong>Survival</strong> and grants <strong>+2</strong> to scent-based <strong>Perception</strong> checks.</p>',
    effects: [reminder('Scent Perception +2 (situational)')],
  }),
  gear({
    name: 'Pain Editor Chip', manufacturer: 'Militech', imgPath: `${A_CHIPWARE}/pain-editor.png`,
    folder: 'Chipware', cost: 'EX',
    description: '<p>This chipware is equipped in a shard socket. The user ignores <strong>Seriously Wounded</strong> penalties while it is installed.</p>',
    effects: [{
      name: 'Pain Editor: Ignore Seriously Wounded',
      disabled: false, transfer: true, system: { changes: [] },
      flags: { 'cyberpunk-blue': { painEditor: true } },
    }],
  }),
  gear({
    name: 'Skill Chip', imgPath: `${A_CHIPWARE}/skill-chip.png`,
    folder: 'Chipware', cost: 'EX',
    description: '<p>This chipware is equipped in a shard socket and covers one Skill or Component.</p><p><strong>WHILE INSTALLED:</strong> If the user has fewer than 3 ranks in that Skill or Component, it is treated as 3.</p>',
  }),
  gear({
    name: 'Tactile Boost Chip', manufacturer: 'Zetatech', imgPath: `${A_CHIPWARE}/tactile-boost.png`,
    folder: 'Chipware', cost: 'PR',
    description: '<p>This chipware is equipped in a shard socket. It detects motion within 20 units on any surface the user is touching.</p>',
  }),

  // ── Architecture Hardware ─────────────────────────────────────────────────

  gear({
    name: 'MicroComp',
    imgPath: `${A_GEAR}/MicroComp.png`,
    folder: 'Architecture Hardware', cost: 'CO',
    isComputer: true,
    computer: { nodes: 2, softwareSlots: 4 },
    description: 'This Architecture Hardware supports 2 nodes and 4 active program slots.',
  }),
  gear({
    name: 'MicroComp, Advanced',
    folder: 'Architecture Hardware', cost: 'PR',
    isComputer: true,
    computer: { nodes: 3, softwareSlots: 5 },
    description: 'This Architecture Hardware supports 3 nodes and 5 active program slots.',
  }),
  gear({
    name: 'Laptop', manufacturer: 'SoftSys',
    folder: 'Architecture Hardware', imgPath: `${A_GEAR}/laptop.png`, cost: 'PR',
    isComputer: true,
    computer: { nodes: 4, softwareSlots: 5 },
    description: 'This Architecture Hardware supports 4 nodes and 5 active program slots.',
  }),
  gear({
    name: 'Laptop, Advanced', manufacturer: 'SoftSys',
    folder: 'Architecture Hardware', cost: 'EX',
    isComputer: true,
    computer: { nodes: 6, softwareSlots: 7 },
    description: 'This Architecture Hardware supports 6 nodes and 7 active program slots.',
  }),
  gear({
    name: 'Desktop', manufacturer: 'Data Inc',
    folder: 'Architecture Hardware', cost: 'EX',
    isComputer: true,
    computer: { nodes: 5, softwareSlots: 8 },
    description: 'This Architecture Hardware supports 5 nodes and 8 active program slots.',
  }),
  gear({
    name: 'Desktop, Advanced', manufacturer: 'Data Inc',
    folder: 'Architecture Hardware', cost: 'VEX',
    isComputer: true,
    computer: { nodes: 7, softwareSlots: 10 },
    description: 'This Architecture Hardware supports 7 nodes and 10 active program slots.',
  }),
  gear({
    name: 'Server', manufacturer: 'Microtech',
    folder: 'Architecture Hardware', imgPath: `${A_GEAR}/server.png`, cost: 'VEX',
    isComputer: true,
    computer: { nodes: 8, softwareSlots: 11 },
    description: 'This Architecture Hardware supports 8 nodes and 11 active program slots.',
  }),
  gear({
    name: 'Server, High Capacity', manufacturer: 'Microtech',
    folder: 'Architecture Hardware', imgPath: `${A_GEAR}/server-advanced.png`, cost: 'LUX',
    isComputer: true,
    computer: { nodes: 12, softwareSlots: 16 },
    description: 'This Architecture Hardware supports 12 nodes and 16 active program slots.',
  }),
  gear({
    name: 'Access Point',
    folder: 'Architecture Hardware', cost: 'CO',
    description: 'This Architecture Hardware add-on provides a wired and a wireless connection to a node. The wireless link reaches 10m, and each connection is toggled independently via the circuitboard.',
  }),
  // Coolant, Insulation, and Memory Upgrade are computerMod items — see mod-catalogue.mjs

  // ── Body Armor ─────────────────────────────────────────────────────────────
  gear({
    name: 'Leather Armor',
    manufacturer: 'Aldecaldos',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/leather-armor.png`, cost: 'EV',
    isArmor: true, maxSp: 4,
    description: 'This armor is favored by Nomads and by &rsquo;punks on bikes.',
  }),
  gear({
    name: 'Kevlar',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/kevlar-armor.png`, cost: 'CO',
    isArmor: true, maxSp: 7,
    description: 'This armor is Kevlar woven into clothes, from business suits to bikinis.',
  }),
  gear({
    name: 'Heavy Armorjack',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/heavy-armorjack.png`, cost: 'EX',
    isArmor: true, maxSp: 13,
    description: 'This armor is metal-supported heavy Kevlar with layered polymer meshes.',
    effects: [ae('Heavy Armorjack', [stat('rflx', -2), stat('move', -1)])],
  }),
  gear({
    name: 'Medium Armorjack',
    manufacturer: 'Militech',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/medium-armorjack.png`, cost: 'PR',
    isArmor: true, maxSp: 12,
    description: 'This armor is solid polymer plating reinforced by a Kevlar&reg; mesh.',
    effects: [ae('Medium Armorjack', [stat('rflx', -2), stat('move', -1)])],
  }),
  gear({
    name: 'Light Armorjack',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/light-armorjack.png`, cost: 'PR',
    isArmor: true, maxSp: 11,
    description: 'This armor is Kevlar&reg; and plastics woven into reinforced fabric fibers, which can be worn as part of clothing or underneath it.',
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
    name: 'Flak', manufacturer: 'Gibson Battlegear',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/flak-armor.png`, cost: 'EX',
    isArmor: true, maxSp: 15,
    description: 'This armor is a flak vest and pants. It is inflexible, solid protection.',
    effects: [ae('Flak', [stat('rflx', -4), stat('move', -3)])],
  }),
  gear({
    name: 'Metalgear',
    manufacturer: 'Gibson Battlegear',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/metalgear-armor.png`, cost: 'LUX',
    isArmor: true, maxSp: 18,
    description: 'This armor is thick plating, and it is completely inflexible.',
    effects: [ae('Metalgear', [stat('rflx', -4), stat('move', -4)])],
  }),
  gear({
    name: 'Bulletproof Shield',
    folder: 'Body Armor', imgPath: `${A_ARMOR}/bulletproof-shield.png`, cost: 'EX',
    isArmor: true, maxSp: 15,
    description: 'This shield has SP 15 and is held in one hand, providing frontal cover. While it is held, the user cannot wield a two-handed weapon or carry anything else in that hand.',
  }),
];
