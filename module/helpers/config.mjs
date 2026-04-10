import { COMBAT_CONFIG } from "./combat.mjs";
import { GEAR_STATES } from "./gear.mjs";
import { MOD_TYPES, WEAPON_MOD_FIELDS, WEAPON_MOD_MODES } from "./mods.mjs";

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
  'Aerondight',
  'Aldecaldos',
  'All-Foods',
  'AmuTek',
  'Animals',
  'Arasaka',
  'Archer',
  'AT-AK',
  'Avante',
  'Biotechnica',
  'Bolshevik',
  'Brain Wash',
  'Braingasm',
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
  'Federated Arms',
  'Fuyutsuki',
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
  'Netwatch',
  'Nicola',
  'Night City',
  'Nokota',
  'Orbital Air',
  'Petrochem',
  'Quadra',
  'RCS',
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
  { value: 'neuralware', label: 'Neuralware' },
  { value: 'cyberoptics', label: 'Cyberoptics' },
  { value: 'cyberaudio', label: 'Cyberaudio' },
  { value: 'cyberarms', label: 'Cyberarms' },
  { value: 'cyberlegs', label: 'Cyberlegs' },
  { value: 'internal', label: 'Internal' },
  { value: 'external', label: 'External' },
  { value: 'fashionware', label: 'Fashionware' },
  { value: 'borgware', label: 'Borgware' },
];

const CYBERWARE_INTEGRATIONS = [
  { value: 'platform', label: 'Platform' },
  { value: 'extension', label: 'Extension' },
  { value: 'standalone', label: 'Stand-Alone' },
];

const CYBERWARE_FACILITIES = [
  { value: 'mall', label: 'Mall' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'hospital', label: 'Hospital' },
];

export const CYBER_BLUE = {
  stats: STATS,
  skills: SKILLS,
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
    role: { label: 'Role' },
    ability: { label: 'Ability' },
    cyberware: { label: 'Cyberware' },
    gear: { label: 'Gear' },
  },
};
