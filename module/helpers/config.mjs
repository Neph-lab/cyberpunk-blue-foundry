import { COMBAT_CONFIG } from "./combat.mjs";
import { GEAR_STATES } from "./gear.mjs";
import { MOD_TYPES, WEAPON_MOD_FIELDS, WEAPON_MOD_MODES } from "./mods.mjs";
import { LEADER_PERMISSIONS, ROLE_CATEGORIES } from "./roles.mjs";

const STATS = {
  body: { label: 'Body', shortLabel: 'BODY' },
  rflx: { label: 'Reflexes', shortLabel: 'RFLX' },
  int: { label: 'Intelligence', shortLabel: 'INT' },
  tech: { label: 'Technological Ability', shortLabel: 'TECH' },
  cool: { label: 'Cool', shortLabel: 'COOL' },
  move: { label: 'Move', shortLabel: 'MOVE' },
};

const SKILLS = {
  acting: {
    label: 'Acting',
    stat: 'cool',
    components: [],
  },
  animals: {
    label: 'Animals',
    stat: 'cool',
    components: [],
  },
  archery: {
    label: 'Archery',
    stat: 'rflx',
    components: [],
  },
  athletics: {
    label: 'Athletics',
    stat: 'body',
    components: [],
  },
  autofire: {
    label: 'Autofire',
    stat: 'rflx',
    components: [],
  },
  business: {
    label: 'Business',
    stat: 'int',
    components: ['bureaucracy', 'businessStrategy', 'forgery'],
  },
  composition: {
    label: 'Composition',
    stat: 'cool',
    components: ['dancing', 'braindance', 'music', 'sculpting', 'visualArts', 'writing'],
  },
  conceal: {
    label: 'Conceal',
    stat: 'int',
    components: [],
  },
  contortionist: {
    label: 'Contortionist',
    stat: 'rflx',
    components: [],
  },
  criminology: {
    label: 'Criminology',
    stat: 'int',
    components: [],
  },
  deduction: {
    label: 'Deduction',
    stat: 'int',
    components: [],
  },
  demolition: {
    label: 'Demolition',
    stat: 'tech',
    components: [],
  },
  drive: {
    label: 'Drive',
    stat: 'rflx',
    components: ['airVehicles', 'landVehicles', 'seaVehicles'],
  },
  education: {
    label: 'Education',
    stat: 'int',
    components: [],
  },
  electronics: {
    label: 'Electronics',
    stat: 'tech',
    components: ['basicTech', 'cybernetics', 'media', 'security', 'weaponstech'],
  },
  endurance: {
    label: 'Endurance',
    stat: 'body',
    components: [],
  },
  evasion: {
    label: 'Evasion',
    stat: 'rflx',
    components: [],
  },
  gambling: {
    label: 'Gambling',
    stat: 'int',
    components: [],
  },
  government: {
    label: 'Government',
    stat: 'int',
    components: ['bureaucracy', 'businessStrategy', 'forgery', 'politics', 'publicInformation'],
  },
  handgun: {
    label: 'Handgun',
    stat: 'rflx',
    components: [],
  },
  hvyWeapons: {
    label: 'Heavy Weapons',
    stat: 'rflx',
    components: [],
  },
  humanPerc: {
    label: 'Human Perception',
    stat: 'cool',
    components: [],
  },
  influence: {
    label: 'Influence',
    stat: 'cool',
    components: [],
  },
  martialArts: {
    label: 'Martial Arts',
    stat: 'body',
    components: ['aikido', 'brawling', 'karate', 'judo', 'taekwondo'],
  },
  mechanics: {
    label: 'Mechanics',
    stat: 'tech',
    components: ['airVehicles', 'basicTech', 'cybernetics', 'landVehicles', 'robotics', 'seaVehicles', 'security', 'weaponstech'],
  },
  medicine: {
    label: 'Medicine',
    stat: 'tech',
    components: [],
  },
  meleeWeapons: {
    label: 'Melee Weapons',
    stat: 'body',
    components: [],
  },
  netrunning: {
    label: 'Netrunner',
    stat: 'tech',
    components: ['codebreak', 'cracker', 'dev', 'ghost', 'software', 'spider', 'quickhacking'],
  },
  performance: {
    label: 'Performance',
    stat: 'cool',
    components: ['dancing', 'braindance', 'forgery', 'music', 'visualArts', 'publicSpeaking'],
  },
  perception: {
    label: 'Perception',
    stat: 'int',
    components: [],
  },
  pickLock: {
    label: 'Pick Lock',
    stat: 'tech',
    components: [],
  },
  shoulderArms: {
    label: 'Shoulder Arms',
    stat: 'rflx',
    components: [],
  },
  sleightOfHand: {
    label: 'Sleight-of-Hand',
    stat: 'rflx',
    components: [],
  },
  stealth: {
    label: 'Stealth',
    stat: 'rflx',
    components: [],
  },
  streetwise: {
    label: 'Streetwise',
    stat: 'cool',
    components: [],
  },
  style: {
    label: 'Style',
    stat: 'cool',
    components: [],
  },
  survival: {
    label: 'Survival',
    stat: 'int',
    components: [],
  },
  tactics: {
    label: 'Tactics',
    stat: 'int',
    components: [],
  },
  trading: {
    label: 'Trading',
    stat: 'int',
    components: [],
  },
};

// Player-facing skill groupings for the Skills-tab overview. Object key order
// sets display order; each `skills` array sets the order within a group. Every
// skill slug should live in exactly one group — any skill missing from here is
// rendered under an "Other" fallback group rather than silently dropped.
const SKILL_CATEGORIES = {
  ranged:    { label: 'Ranged Combat',       skills: ['archery', 'autofire', 'handgun', 'hvyWeapons', 'shoulderArms'] },
  melee:     { label: 'Close Combat',         skills: ['martialArts', 'meleeWeapons', 'evasion'] },
  physical:  { label: 'Athletics & Agility',  skills: ['athletics', 'endurance', 'contortionist', 'drive'] },
  covert:    { label: 'Stealth & Larceny',    skills: ['stealth', 'conceal', 'pickLock', 'sleightOfHand'] },
  tech:      { label: 'Tech & Engineering',   skills: ['electronics', 'mechanics', 'demolition', 'netrunning', 'medicine'] },
  knowledge: { label: 'Investigation & Lore', skills: ['perception', 'deduction', 'criminology', 'education', 'tactics', 'survival', 'animals'] },
  social:    { label: 'Social & Influence',   skills: ['acting', 'influence', 'humanPerc', 'streetwise', 'style', 'performance', 'composition'] },
  trade:     { label: 'Trade & Society',      skills: ['business', 'trading', 'government', 'gambling'] },
};

const COMPONENT_LABELS = {
  aikido: 'Aikido',
  airVehicles: 'Air Vehicles',
  basicTech: 'Basic Tech',
  brawling: 'Brawling',
  bureaucracy: 'Bureaucracy',
  businessStrategy: 'Business Strategy',
  codebreak: 'Codebreak',
  cracker: 'Cracker',
  cybernetics: 'Cybernetics',
  dancing: 'Dancing',
  dev: 'Dev',
  braindance: 'Braindance',
  forgery: 'Forgery',
  ghost: 'Ghost',
  judo: 'Judo',
  karate: 'Karate',
  landVehicles: 'Land Vehicles',
  media: 'Media',
  music: 'Music',
  politics: 'Politics',
  publicInformation: 'Public Information',
  publicSpeaking: 'Public Speaking',
  quickhacking: 'Quickhacking',
  robotics: 'Robotics',
  sculpting: 'Sculpting',
  seaVehicles: 'Sea Vehicles',
  security: 'Security',
  software: 'Software',
  spider: 'Spider',
  taekwondo: 'Taekwondo',
  visualArts: 'Visual Arts',
  weaponstech: 'Weaponstech',
  writing: 'Writing',
};

function buildComponents(skills) {
  const components = {};

  for (const [skillSlug, skill] of Object.entries(skills)) {
    for (const componentSlug of skill.components) {
      if (!components[componentSlug]) {
        components[componentSlug] = {
          label: COMPONENT_LABELS[componentSlug] ?? componentSlug,
          skills: [],
        };
      }

      components[componentSlug].skills.push(skillSlug);
    }
  }

  return components;
}

const COST_LADDER = [
  '€$10 (Cheap)',
  '€$20 (Everyday)',
  '€$50 (Costly)',
  '€$100 (Premium)',
  '€$500 (Expensive)',
  '€$1,000 (Very Expensive)',
  '€$5,000 (Luxury)',
  '€$10,000 (Super Luxury)',
];

const MANUFACTURERS = [
  '2nd Amendment',
  '6th Street',
  'Aerondight',
  'Aldecaldos',
  'AllFoods',
  'All World Insurance',
  'AmuTek',
  'Animals',
  'Aoba',
  'Arasaka',
  'Archer',
  'AT-AK',
  'Attuned In',
  'Avante',
  'Below Deck',
  'Biotechnica',
  'Bolshevik',
  'Brain Wash',
  'Braingasm',
  'Brennan',
  'Brooklyn Barista',
  'Buck-A-Slice',
  'Budget Arms',
  'Bumelant',
  'BuryGer',
  'Cali',
  'Capitan Caliente',
  'Centzon Totochtin',
  'Channel 54',
  'Chevillon',
  'Chromanticore',
  'Combat Cab',
  'Constitutional Arms',
  'Corp-Bud',
  'Dakai',
  'Darra-Polytechnic',
  'Data Inc',
  'Ded Zed',
  'Delamain',
  'Dynalar',
  'EBM',
  'El Guapo',
  'El Pinche Pollo',
  'European Space Agency',
  'Everest VentureWare',
  'Federated Arms',
  'Fuyutsuki',
  'Gibson Battlegear',
  'Impala Automatics',
  'Kang-Tao',
  'Kaukaz',
  'Kendachi',
  'Kiroshi',
  'KTech',
  'Lizzy-Wizzy',
  'Love Hub',
  'Maelstrom',
  'Mahir',
  'Makigai',
  'Malorian Arms',
  'MAX-TAC',
  'MetaCorp',
  'Microtech',
  'Midnight Arms',
  'Midnight Lady',
  'Milfguard',
  'Militech',
  'Mizutani',
  'Moore',
  'Mr Stud',
  'NC Industries',
  'NCART',
  'NCPD',
  'Netwatch',
  'Nicola',
  'Night City',
  'NightCorp',
  'Nokota',
  'Orbital Air',
  'Petrochem',
  'Quadra',
  'Raven Microcybernetics',
  'RCS',
  'RealWater',
  'Rostović',
  'Samurai',
  'Sanroo',
  'SoftSys',
  'SovOil',
  'Spunky Monkey',
  'Sternmeyer Ballistics',
  'Techtronika',
  'Moxes',
  'Trauma Team',
  'Tsunami Arms',
  'Tyger Claws',
  'Valentinos',
  'Vargas',
  'Villefort',
  'Voodoo Boys',
  'Wet Dream',
  'WNS',
  'Yaiba',
  'Zetatech',
  'Ziggy Q',
];

const CYBERWARE_TYPES = [
  { value: 'neuralware',  label: 'CYBER_BLUE.Cyberware.Type.neuralware' },
  { value: 'cyberoptics', label: 'CYBER_BLUE.Cyberware.Type.cyberoptics' },
  { value: 'cyberaudio',  label: 'CYBER_BLUE.Cyberware.Type.cyberaudio' },
  { value: 'cyberarms',   label: 'CYBER_BLUE.Cyberware.Type.cyberarms' },
  { value: 'cyberlegs',   label: 'CYBER_BLUE.Cyberware.Type.cyberlegs' },
  { value: 'internal',    label: 'CYBER_BLUE.Cyberware.Type.internal' },
  { value: 'external',    label: 'CYBER_BLUE.Cyberware.Type.external' },
  { value: 'fashionware', label: 'CYBER_BLUE.Cyberware.Type.fashionware' },
  { value: 'borgware',    label: 'CYBER_BLUE.Cyberware.Type.borgware' },
];

const CYBERWARE_INTEGRATIONS = [
  { value: 'platform',   label: 'CYBER_BLUE.Cyberware.IntegrationType.platform' },
  { value: 'extension',  label: 'CYBER_BLUE.Cyberware.IntegrationType.extension' },
  { value: 'standalone', label: 'CYBER_BLUE.Cyberware.IntegrationType.standalone' },
];

const CYBERWARE_FACILITIES = [
  { value: 'mall',     label: 'CYBER_BLUE.Cyberware.FacilityType.mall' },
  { value: 'clinic',   label: 'CYBER_BLUE.Cyberware.FacilityType.clinic' },
  { value: 'hospital', label: 'CYBER_BLUE.Cyberware.FacilityType.hospital' },
];

export const CYBER_BLUE = {
  stats: STATS,
  skills: SKILLS,
  skillCategories: SKILL_CATEGORIES,
  components: buildComponents(SKILLS),
  costLadder: COST_LADDER,
  manufacturers: MANUFACTURERS,
  resources: {
    hp: { label: 'HP' },
    psyche: { label: 'PSYCHE' },
    luck: { label: 'LUCK' },
  },
  cyberware: {
    types: CYBERWARE_TYPES,
    integrations: CYBERWARE_INTEGRATIONS,
    facilities: CYBERWARE_FACILITIES,
  },
  roles: {
    categories: ROLE_CATEGORIES,
    leaderPermissions: LEADER_PERMISSIONS,
  },
  combat: COMBAT_CONFIG,
  gearStates: GEAR_STATES,
  modifications: {
    types: MOD_TYPES,
    weaponFields: WEAPON_MOD_FIELDS,
    weaponModes: WEAPON_MOD_MODES,
  },
  activeEffects: {
    cyberwareDisable: {
      name: 'cyberblue.disableCyberware.name',
      type: 'cyberblue.disableCyberware.type',
      random: 'cyberblue.disableCyberware.random',
      randomType: 'cyberblue.disableCyberware.randomType',
    },
  },
  itemTypes: {
    role:              { label: 'TYPES.Item.role' },
    ability:           { label: 'TYPES.Item.ability' },
    cyberware:         { label: 'TYPES.Item.cyberware' },
    gear:              { label: 'TYPES.Item.gear' },
    drug:              { label: 'TYPES.Item.drug' },
    programExecutable: { label: 'TYPES.Item.programExecutable' },
    mod:               { label: 'TYPES.Item.mod' },
  },
};
