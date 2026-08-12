/**
 * NPC Quick Creation catalogue — the building blocks a GM combines into an NPC.
 *
 * Source of truth: docs/NPC-Quick-Creation.md. An NPC is one Base type + one
 * Background + one Purpose, plus any number of the four Extras.
 *
 * Base types set the five Primary Stats absolutely (the schema initial is 6 for
 * all of them, so these overwrite rather than add). Backgrounds and Purposes
 * contribute `statDeltas` on top.
 *
 * Skill and component keys are the slugs from `CONFIG.CYBER_BLUE.skills` /
 * `.components` — see module/helpers/config.mjs. The ones that don't match their
 * display label: `netrunning` ("Netrunner"), `hvyWeapons`, `humanPerc`,
 * `sleightOfHand`, `meleeWeapons`, `martialArts`, `pickLock`, `shoulderArms`,
 * and `codebreak` (not "codebreaker").
 *
 * Item names are resolved at build time by `resolveItemUuidByName`, so they must
 * match the catalogue entries exactly. Where the spec doc abbreviated a name the
 * full catalogue name is used here instead:
 *   Toxing Binders          → Toxin Binders
 *   Voice Stress Analyser   → Voice Stress Analyzer   (the system is US English)
 *   Cyberdeck Standard      → Cyberdeck, Standard
 *   MicroComp Advanced      → MicroComp, Advanced
 *   Lockpicks               → Lock-Picking Kit
 *   Cybereye                → Standard Cybereye
 *   Anti-Smog Mask          → Anti-Smog Breathing Mask
 *   Role (Nomad gear)       → Rope
 * The plain names "Radio / Music Player", "Bug Detector", "Homing Tracer",
 * "Scrambler / Descrambler", "Techscanner" and "Medscanner" are all `gear`; the
 * "(Cyberaudio)" / "(Cyberarm)" suffixed variants are the cyberware ones. The
 * spec doc's Artist entry lists the plain name under Cyberware — it means the
 * (Cyberaudio) variant, and that is what is used below.
 *
 * Two spec entries had no value and are deliberately absent: Street's Heavy
 * Weapons and the Netrunner purpose's Forgery component.
 */

/** Cyberware request. `count` copies of one catalogue entry. */
const cw = (name, count = 1) => ({ name, count });

/** Gear request. Covers `gear`, `drug` and weapon items — all resolved by name. */
const g = (name, qty = 1) => ({ name, qty });

/** Language ability. Cloned from the `Language` catalogue item, renamed, ranked. */
const lang = (language, rank = 1) => ({ base: 'Language', name: `Language: ${language}`, rank });

// ─── Base types ───────────────────────────────────────────────────────────────

export const BASE_TYPES = [
  {
    key: 'brains',
    label: 'Brains',
    stats: { body: 4, rflx: 5, int: 6, tech: 6, cool: 5 },
    cyberware: [cw('Neuroport')],
    abilities: [lang('English', 2)],
  },
  {
    key: 'brute',
    label: 'Brute',
    stats: { body: 6, rflx: 6, int: 4, tech: 5, cool: 5 },
    cyberware: [cw('Neuroport')],
    abilities: [lang('English', 2)],
  },
  {
    key: 'social',
    label: 'Social',
    stats: { body: 5, rflx: 6, int: 4, tech: 5, cool: 6 },
    cyberware: [cw('Neuroport')],
    abilities: [lang('English', 2)],
  },
];

// ─── Backgrounds ──────────────────────────────────────────────────────────────

export const BACKGROUNDS = [
  {
    key: 'corpo',
    label: 'Corpo',
    // NOT the Role of the same name.
    note: 'Not to be confused with the Role of the same name.',
    statDeltas: { int: 1 },
    skills: { acting: 2, business: 3, education: 1, humanPerc: 3, influence: 2, perception: 1, trading: 2 },
    components: { bureaucracy: 2, businessStrategy: 3 },
    cyberware: [cw('Toxin Binders'), cw('Standard Cyberaudio Suite'), cw('Voice Stress Analyzer'), cw('Skin-Weave')],
    gear: [g('MicroComp'), g('Synthcoke', 2), g('Boost', 5)],
    abilities: [lang('Japanese')],
  },
  {
    key: 'gang',
    label: 'Gang',
    statDeltas: { body: 1 },
    skills: { athletics: 1, drive: 1, evasion: 2, gambling: 1, handgun: 3, martialArts: 1, meleeWeapons: 2, shoulderArms: 2, streetwise: 2 },
    components: { brawling: 1, landVehicles: 1 },
    cyberware: [cw('Standard Cyberarm'), cw('Hidden Holster')],
    gear: [g('Malorian Overture'), g('Duct Tape'), g('Synthcoke')],
    abilities: [{ base: 'Reaction Speed', name: 'Reaction Speed', rank: 1 }],
  },
  {
    key: 'industrial',
    label: 'Industrial',
    statDeltas: { body: 1 },
    skills: { athletics: 1, deduction: 1, drive: 2, electronics: 2, evasion: 2, mechanics: 3, perception: 3, sleightOfHand: 1 },
    components: { basicTech: 3, landVehicles: 2, robotics: 2 },
    cyberware: [cw('Standard Cyberarm'), cw('Tool Hand')],
    gear: [g('Techtool'), g('Duct Tape'), g('Anti-Smog Breathing Mask'), g('Road Flare'), g('Rope')],
    abilities: [lang('Spanish')],
  },
  {
    key: 'investigator',
    label: 'Investigator',
    statDeltas: { int: 1 },
    skills: { deduction: 2, government: 1, humanPerc: 3, perception: 3, pickLock: 2, stealth: 2, streetwise: 2 },
    components: { publicInformation: 1 },
    cyberware: [cw('Standard Cybereye', 2), cw('Image Enhance'), cw('MicroVideo')],
    gear: [g('Flashlight'), g('Grapple Gun'), g('Audio Recorder'), g('Disposable Phone'), g('Scrambler / Descrambler'), g('Lock-Picking Kit')],
    abilities: [lang('Russian')],
  },
  {
    key: 'joytoy',
    label: 'Joytoy',
    statDeltas: { cool: 1 },
    skills: { acting: 3, athletics: 2, martialArts: 1, meleeWeapons: 1, performance: 3, streetwise: 2, style: 3 },
    components: { aikido: 1, dancing: 3 },
    cyberware: [
      cw('Tech Hair'), cw('Light Tattoo'), cw('Shift Tacts'), cw('Braindance Recorder'),
      cw('Contraceptive Implant'), cw('MidnightLady™'), cw('Standard Cyberhand'), cw('Scratchers'),
    ],
    gear: [g('Baseball Bat'), g('Glow Stick', 2)],
    abilities: [lang('Japanese')],
  },
  {
    key: 'military',
    label: 'Military',
    statDeltas: { rflx: 1 },
    skills: { autofire: 2, endurance: 1, evasion: 1, handgun: 3, hvyWeapons: 2, meleeWeapons: 1, shoulderArms: 3, tactics: 2 },
    cyberware: [cw('Sandevistan'), cw('Standard Cyberarm'), cw('Embedded Firearm')],
    gear: [g('Militech M-10AF Lexington'), g('Militech M251s Ajax'), g('Black Lace', 2)],
    abilities: [{ base: 'Reaction Speed', name: 'Reaction Speed', rank: 1 }],
  },
  {
    key: 'mundane',
    label: 'Mundane',
    // One randomly chosen Primary Stat gets the +1.
    randomStatDelta: 1,
    skills: {
      acting: 1, deduction: 1, drive: 1, education: 1, evasion: 1, handgun: 1, humanPerc: 1,
      influence: 1, mechanics: 1, meleeWeapons: 1, perception: 2, sleightOfHand: 1, stealth: 1, streetwise: 1,
    },
    components: { basicTech: 1, landVehicles: 1 },
    cyberware: [cw('Shard Socket'), cw('Threading')],
    gear: [g('Rope'), g('Glow Stick'), g('Personal Care Pack'), g('Memory Shard'), g('Smash', 2)],
    abilities: [lang('Spanish')],
  },
  {
    key: 'nomad',
    label: 'Nomad',
    // A Background, not a Role — Blue has no Nomad Role.
    statDeltas: { rflx: 1 },
    skills: { drive: 3, electronics: 2, evasion: 2, handgun: 1, mechanics: 3, shoulderArms: 2, survival: 2 },
    components: { airVehicles: 2, basicTech: 2, landVehicles: 3, seaVehicles: 2 },
    cyberware: [cw('Standard Cyberarm'), cw('Subdermal Grip'), cw('Tool Hand'), cw('Nasal Filters')],
    gear: [g('Rope'), g('Road Flare'), g('Flashlight'), g('Duct Tape'), g('Binoculars'), g('Auto-Level Ear Protectors'), g('Techtool')],
    abilities: [lang('Spanish')],
  },
  {
    key: 'street',
    label: 'Street',
    statDeltas: { cool: 1 },
    skills: { conceal: 2, endurance: 1, evasion: 1, gambling: 2, handgun: 2, humanPerc: 1, perception: 2, streetwise: 3, style: 1 },
    cyberware: [cw('Tech Hair'), cw('Threading'), cw('Subdermal Pocket')],
    gear: [g('Braindance Wreath'), g('Food Stick'), g('Glow Paint'), g('Music Album (Shard)'), g('Blue Glass', 2), g('Smash', 4)],
    abilities: [lang('Spanish')],
  },
  {
    key: 'thief',
    label: 'Thief',
    statDeltas: { rflx: 1 },
    skills: { conceal: 1, electronics: 2, evasion: 1, perception: 2, pickLock: 3, sleightOfHand: 3, stealth: 3 },
    components: { security: 2 },
    cyberware: [cw('Standard Cyberhand'), cw('Tool Hand'), cw('Standard Cyberaudio Suite'), cw('Amplified Hearing')],
    gear: [g('Bug Detector'), g('Lock-Picking Kit')],
    abilities: [{ base: 'Reaction Speed', name: 'Reaction Speed', rank: 1 }],
  },
  {
    key: 'tinkerer',
    label: 'Tinkerer',
    statDeltas: { tech: 1 },
    skills: { demolition: 1, drive: 2, electronics: 3, mechanics: 3, perception: 2, pickLock: 1 },
    components: { basicTech: 3, cybernetics: 1, landVehicles: 2, media: 1, robotics: 3, security: 2, weaponstech: 2 },
    cyberware: [cw('Standard Cyberhand'), cw('Tool Hand'), cw('Standard Cyberaudio Suite'), cw('Level Dampener')],
    gear: [g('Anti-Smog Breathing Mask'), g('Duct Tape'), g('Techscanner'), g('Techtool')],
    abilities: [lang('Spanish')],
  },
];

// ─── Purposes ─────────────────────────────────────────────────────────────────
//
// Role sub-allocations the spec doc left open are filled in here. Corpo and Law
// need none — their leaderFeatures unlock at rank 3 and both are granted at
// rank 2. Bandit, Fixer and Rocker have no sub-structures at all.
//
// The budget rules the sheet enforces: total specialty ranks ≤ role rank × 2 and
// each specialty ≤ role rank (actor-sheet.mjs); protean focus points ≤ role rank;
// componentTraining gets one pick per role rank (repeats allowed).

export const PURPOSES = [
  {
    key: 'artist',
    label: 'Artist',
    statDeltas: { cool: 1 },
    skills: { acting: 2, composition: 2, gambling: 1, handgun: 1, humanPerc: 2, influence: 2, perception: 1, performance: 3, streetwise: 1, style: 2 },
    components: { music: 3, writing: 2 },
    cyberware: [
      cw('Light Tattoo'), cw('Shift Tacts'), cw('Tech Hair'), cw('AudioVox'), cw('Mr. Studd™'),
      cw('Standard Cyberaudio Suite'), cw('Level Dampener'), cw('Radio / Music Player (Cyberaudio)'),
    ],
    gear: [
      g('Darra Polytechnic DR-5 Nova'), g('Duct Tape'), g('Glow Paint'), g('Glow Stick', 10),
      g('Audio Recorder'), g('Drum Synthesizer'), g('Electric Guitar'), g('Music Album (Shard)'),
      g('Pocket Amplifier'), g('Radio / Music Player'), g('Leather Armor'),
    ],
    role: { name: 'Rocker', rank: 2 },
  },
  {
    key: 'connections',
    label: 'Connections',
    statDeltas: { int: 1 },
    skills: { business: 1, government: 1, handgun: 1, humanPerc: 3, influence: 3, perception: 2, streetwise: 2, style: 1, trading: 1 },
    components: { businessStrategy: 1, politics: 1 },
    cyberware: [cw('Self-ICE'), cw('Skin-Weave'), cw('Dermal Display'), cw('Standard Cyberaudio Suite'), cw('Voice Stress Analyzer')],
    gear: [
      g('Malorian Arms Sonnet'), g('Smoke Grenade', 2), g('Disposable Phone', 2),
      g('Scrambler / Descrambler'), g('Homing Tracer'), g('Bug Detector'),
    ],
    role: { name: 'Fixer', rank: 2 },
  },
  {
    key: 'cop',
    label: 'Cop',
    statDeltas: { rflx: 1 },
    skills: { criminology: 3, deduction: 2, evasion: 2, government: 1, handgun: 2, humanPerc: 2, shoulderArms: 1, streetwise: 1, tactics: 1 },
    components: { bureaucracy: 1 },
    cyberware: [cw('Standard Cyberaudio Suite'), cw('Voice Stress Analyzer'), cw('Amplified Hearing')],
    gear: [
      g('Militech M-10AF Lexington'), g('Constitutional Arms M2038 Tactician'), g('Road Flare', 2),
      g('Flashlight'), g('Chemical Analyzer'), g('Radio Communicator'), g('Handcuffs', 2), g('Medium Armorjack'),
    ],
    role: { name: 'Law', rank: 2 },
  },
  {
    key: 'cyberpsycho',
    label: 'Cyberpsycho',
    statDeltas: { body: 1, rflx: 1 },
    skills: { athletics: 2, autofire: 3, demolition: 1, endurance: 2, handgun: 3, hvyWeapons: 1, meleeWeapons: 2, perception: 1, shoulderArms: 3 },
    cyberware: [
      // MultiOptic Mount lifts the two-eye cap, so all four eyes are kept.
      cw('MultiOptic Mount'), cw('Standard Cybereye', 4), cw('Wide Spectrum Optics'),
      cw('Radiation Detector'), cw('Targeting Scope'), cw('Sandevistan'), cw('Self-ICE', 2),
      cw('Grafted Muscle & Bone Lace'), cw('Toxin Binders'), cw('Nasal Filters'), cw('Subdermal Armor'),
      cw('Standard Cyberleg', 2), cw('Jump Booster'), cw('Standard Cyberarm', 2),
      cw('Projectile Launch System'), cw('Mantis Blades', 2), cw('Wolvers'),
    ],
    gear: [g('Techtronika RT-46 Burya'), g('Rostovic DB-2 Satara'), g('Nokota D5 Copperhead'), g('Black Lace', 2)],
    // Solo is Protean: 4 focus points at rank 4. Hits harder every round and
    // shrugs off the first hit it takes.
    role: { name: 'Solo', rank: 4, foci: { 'Spot Weakness': 2, 'Damage Deflection': 2 } },
  },
  {
    key: 'engineer',
    label: 'Engineer',
    statDeltas: { tech: 1 },
    skills: { demolition: 2, drive: 2, electronics: 3, mechanics: 3, medicine: 1, shoulderArms: 2 },
    components: { basicTech: 2, cybernetics: 2, landVehicles: 2, robotics: 2, security: 2, weaponstech: 2 },
    cyberware: [
      cw('Standard Cyberarm'), cw('Techscanner (Cyberarm)'), cw('Tool Hand'),
      cw('Subdermal Grip'), cw('Standard Cybereye'), cw('MicroOptics'),
    ],
    gear: [
      g('Rostovic DB-4 Palica'), g('EMP Grenade', 2), g('Techtool'), g('Road Flare'), g('Flashlight'),
      g('Duct Tape'), g('Backpack'), g('Radio Communicator'), g('Kevlar'),
    ],
    // Repairs in the field, improves what's already there.
    role: { name: 'Techie', rank: 2, specialties: { 'Field Expertise': 2, 'Upgrade Expertise': 2 } },
  },
  {
    key: 'fun',
    label: 'Fun',
    statDeltas: { cool: 1 },
    skills: { acting: 2, endurance: 2, gambling: 2, humanPerc: 2, influence: 2, perception: 2, streetwise: 1, style: 2 },
    cyberware: [cw('Tech Hair'), cw('Chemskin'), cw('Light Tattoo'), cw('Subdermal Pocket')],
    gear: [g('Glow Stick', 3), g('Glow Paint'), g('Braindance Wreath'), g('Blue Glass', 5), g('RPM', 4), g('Smash', 4)],
    role: null,
  },
  {
    key: 'grunt',
    label: 'Grunt',
    statDeltas: { body: 1, int: -1, tech: -1 },
    skills: { autofire: 2, evasion: 1, handgun: 3, hvyWeapons: 2, martialArts: 2, meleeWeapons: 1, shoulderArms: 3 },
    components: { taekwondo: 2 },
    cyberware: [cw('Gorilla Arm', 2), cw('Big Knucks'), cw('Enhanced Antibodies'), cw('Grafted Muscle & Bone Lace')],
    gear: [
      g('Constitutional Arms M2038 Tactician'), g('Budget Arms Cut-O-Matic'), g('KTech Terrier'),
      g('Medium Armorjack'), g('The Snitcher'), g('PDGF Injection', 2), g('Synthcoke', 2),
    ],
    role: { name: 'Bandit', rank: 2 },
  },
  {
    key: 'infiltrator',
    label: 'Infiltrator',
    statDeltas: { cool: 1 },
    skills: { acting: 3, conceal: 1, humanPerc: 3, influence: 2, perception: 2, sleightOfHand: 2, stealth: 1 },
    cyberware: [
      cw('Tech Hair'), cw('Chemskin'), cw('Skin-Weave'), cw('Subdermal Pocket'), cw('Hidden Holster'),
      cw('Standard Cybereye'), cw('MicroVideo'), cw('TeleOptics'),
      // Sensor Array + a Cyberaudio Suite ⇒ the suite is built with 7 slots.
      cw('Sensor Array'), cw('Standard Cyberaudio Suite'), cw('Amplified Hearing'),
      cw('Bug Detector (Cyberaudio)'), cw('Homing Tracer (Cyberaudio)'),
      cw('Scrambler / Descrambler (Cyberaudio)'), cw('Voice Stress Analyzer'),
    ],
    gear: [
      g('Tsunami Yanari'), g('Leather Armor'), g('Homing Tracer'), g('IR-Flashlight'),
      g('EMP Grenade', 2), g('Knock-Out Grenade', 2),
    ],
    role: { name: 'Operative', rank: 2, specialties: { Analysis: 1, Infiltration: 1, Preparation: 2 } },
  },
  {
    key: 'netrunner',
    label: 'Netrunner',
    statDeltas: { int: 1 },
    skills: { electronics: 2, evasion: 2, handgun: 2, netrunning: 4, perception: 2 },
    components: { codebreak: 2, cracker: 3, dev: 2, ghost: 1, security: 2, spider: 1 },
    cyberware: [
      cw('Neuroport Cyberdeck Port'), cw('Ex-Disk'), cw('Self-ICE', 2),
      cw('Standard Cybereye', 2), cw('Virtuality'), cw('Threading'),
    ],
    gear: [
      g('Militech M-76e Omaha'), g('Braindance Wreath'), g('Braindance'),
      g('Cyberdeck, Standard'), g('Scrambler / Descrambler'),
    ],
    programs: ['Vrizzbolt', 'Speed-Slice', 'Armor', 'Shield'],
    // One componentTraining pick per role rank. Mirrors the highest component
    // ranks above: Cracker +3, Codebreak +2.
    role: { name: 'Netrunner', rank: 2, componentPicks: ['cracker', 'codebreak'] },
  },
  {
    key: 'racer',
    label: 'Racer',
    statDeltas: { rflx: 1 },
    skills: { autofire: 1, drive: 3, evasion: 2, handgun: 1, mechanics: 3, perception: 1, shoulderArms: 2, tactics: 1 },
    components: { airVehicles: 3, landVehicles: 3, seaVehicles: 2 },
    cyberware: [
      cw('Kerenzikov'), cw('Enhanced Antibodies'), cw('Standard Cyberleg', 2), cw('Rocket Boost'),
      cw('Standard Cyberaudio Suite'), cw('Radio / Music Player (Cyberaudio)'),
      // The Cyberhand is the platform the Tool Hand needs — without it the Tool
      // Hand is orphaned for every background that supplies no arm or hand.
      cw('Standard Cyberhand'), cw('Tool Hand'),
    ],
    gear: [
      g('Arasaka Nowaki'), g('Arasaka HJRE-9 Asuka'), g('Road Flare', 4), g('Radar Detector'),
      g('Duct Tape'), g('Anti-Smog Breathing Mask'), g('Auto-Level Ear Protectors'),
      g('Techscanner'), g('Tech Bag'), g('Radio Communicator'),
    ],
    role: null,
  },
  {
    key: 'scientist',
    label: 'Scientist',
    statDeltas: { tech: 1 },
    skills: { deduction: 3, education: 2, electronics: 1, government: 1, humanPerc: 1, influence: 1, medicine: 3, perception: 3 },
    components: { basicTech: 1, bureaucracy: 1 },
    cyberware: [
      cw('Nasal Filters'), cw('Toxin Binders'), cw('Standard Cybereye', 2), cw('Wide Spectrum Optics'),
      cw('Standard Cyberarm'), cw('Techscanner (Cyberarm)'), cw('Medscanner (Cyberarm)'),
    ],
    gear: [
      g('Militech Stun Baton'), g('Food Stick'), g('Techtool'), g('Tech Bag'), g('Medtech Bag'),
      g('Cryopump'), g('Chemical Analyzer'), g('Airhypo'), g('MicroComp'), g('Laptop'),
    ],
    // "Cryotech" in the spec doc — the catalogue specialty is Cryosystem Operation.
    role: { name: 'Medtech', rank: 2, specialties: { 'Battle Medic': 2, Surgery: 1, 'Cryosystem Operation': 1 } },
  },
  {
    key: 'sneaky',
    label: 'Sneaky',
    statDeltas: { rflx: 1 },
    skills: { archery: 2, conceal: 2, evasion: 1, meleeWeapons: 3, perception: 2, sleightOfHand: 2, stealth: 3 },
    cyberware: [
      cw('Kerenzikov'), cw('Nasal Filters'), cw('Hidden Holster'), cw('Standard Cybereye', 2),
      cw('Targeting Scope'), cw('TeleOptics'), cw('Wide Spectrum Optics'),
      cw('Standard Cyberarm'), cw('Monowire'), cw('Subdermal Grip'),
    ],
    gear: [
      g('Katana'), g('Bow'), g('Rope'), g('Grapple Gun'), g('Smoke Grenade', 2),
      g('IR-Flashlight'), g('Caltrops'), g('Light Armorjack'),
    ],
    // Ninja is Protean: 2 focus points at rank 2, spent to match Stealth +3.
    role: { name: 'Ninja', rank: 2, foci: { 'Silent Death': 2 } },
  },
  {
    key: 'snob',
    label: 'Snob',
    statDeltas: { int: 1 },
    skills: { business: 2, drive: 1, education: 2, gambling: 1, government: 1, humanPerc: 2, influence: 2, style: 2, trading: 2 },
    components: { businessStrategy: 2, politics: 1 },
    cyberware: [
      cw('Contraceptive Implant'), cw('Toxin Binders'), cw('Skin-Weave'), cw('Standard Cybereye', 2),
      cw('Virtuality'), cw('Standard Cyberaudio Suite'), cw('Voice Stress Analyzer'),
      cw('Bug Detector (Cyberaudio)'), cw('Amplified Hearing'),
    ],
    gear: [g('Darra Polytechnic DS-1 Tenebra'), g('MicroComp, Advanced'), g('Laptop'), g('Boost', 3), g('RPM', 5)],
    role: { name: 'Corpo', rank: 2 },
  },
  {
    key: 'sweet',
    label: 'Sweet',
    skills: { acting: 2, animals: 1, deduction: 3, evasion: 2, humanPerc: 3, influence: 2, perception: 2 },
    cyberware: [cw('Standard Cyberaudio Suite')],
    gear: [g('Personal Care Pack'), g('Food Stick'), g('Radio / Music Player')],
    role: null,
  },
];

// ─── Extras ───────────────────────────────────────────────────────────────────
//
// Applied in this order, each as many times as chosen. Every single +1 re-checks
// the rank/stat cap, but the *pool* Skilled and Hobbies draw from is frozen at
// the pre-Extras state — see buildNpcRecipe in helpers/npc-builder.mjs.

export const EXTRAS = [
  {
    key: 'focused',
    label: 'Focused boost',
    hint: '+1 to one of the highest Primary Stats below 8.',
  },
  {
    key: 'scattered',
    label: 'Scattered boost',
    hint: '+1 to any Primary Stat below 8.',
  },
  {
    key: 'skilled',
    label: 'Skilled',
    hint: '+1 to a Skill that already has ranks, plus one of its trained Components.',
  },
  {
    key: 'hobbies',
    label: 'Hobbies',
    hint: '+1 to a Skill with no ranks, plus one of its Components.',
  },
];

/** The five Primary Stats. MOVE is a Blue stat but not a Primary Stat. */
export const PRIMARY_STATS = ['body', 'rflx', 'int', 'tech', 'cool'];

/** Hard ceiling for stats, skills and components in a quick-built NPC. */
export const QUICK_MAX = 8;

const GROUPS = { baseType: BASE_TYPES, background: BACKGROUNDS, purpose: PURPOSES };

/**
 * Look up one catalogue entry.
 * @param {'baseType'|'background'|'purpose'} group
 * @param {string} key
 * @returns {object|null}
 */
export function getQuickEntry(group, key) {
  return GROUPS[group]?.find((entry) => entry.key === key) ?? null;
}
