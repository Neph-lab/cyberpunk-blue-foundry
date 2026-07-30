/**
 * Cyberware catalogue — all cyberware from the Cyberpunk Blue source.
 *
 * Each entry is Foundry Item create-data ready for `Item.createDocuments`.
 * The `_folder` property is stripped before the item is written to the pack.
 *
 * Field notes:
 *   integration: 'platform' | 'extension' | 'standalone'
 *   slotsProvided: number of extension slots this platform provides
 *   slotsUsed: number of platform slots consumed by this extension
 *   psycheLossFormula: roll formula string ('1d6', '2d6', '1d6/2', etc.) or '' for N/A
 *   useCyberneticsComponent: true → DV uses TECH+Medicine(Cybernetics) instead of Surgery
 *   facilities: 'mall' | 'clinic' | 'hospital'
 *   installationCost: cost tier of the installation procedure
 *   installationDv: DV for the installation check
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

const h = (text) => /^\s*<(p|ul|ol|div|h\d|table)\b/i.test(text) ? text : `<p>${text}</p>`;

// ── AE helpers ─────────────────────────────────────────────────────────────
const ae      = (name, changes) => ({ name, disabled: false, transfer: true, changes });
const aeOff   = (name, changes) => ({ name, disabled: true,  transfer: true, changes });
const reminder = (name)         => ({ name, disabled: false, transfer: true, changes: [] });
/** AE with no stat changes but a cyberpunk-blue flag — used for combat-code hooks (TeleOptics, etc.). */
const aeFlag  = (name, flagKey, flagVal = true) => ({
  name, disabled: false, transfer: true, changes: [],
  flags: { 'cyberpunk-blue': { [flagKey]: flagVal } },
});
const stat    = (slug, val) => ({ key: `system.stats.${slug}.value`,    mode: 2, value: String(val) });
const statOvr = (slug, val) => ({ key: `system.stats.${slug}.value`,    mode: 5, value: String(val) });
const statMod = (slug, val) => ({ key: `system.stats.${slug}.rollMod`,  mode: 2, value: String(val) });
// Skill/component AEs target `.bonus` (a check bonus), never `.rank`. Modifying
// `.rank` corrupts the player-set rank and stacks if the AE is applied more than
// once; `.bonus` adds to the roll only. See module/data/actor-character.mjs.
const skill   = (slug, val) => ({ key: `system.skills.${slug}.bonus`,    mode: 2, value: String(val) });
const comp    = (slug, val) => ({ key: `system.components.${slug}.bonus`, mode: 2, value: String(val) });
// General channel: added on top of min(skill+skillBonus, component+componentBonus),
// never capped. Use for aids that always apply in full (speedware, tech tools).
const skillGen = (slug, val) => ({ key: `system.skills.${slug}.generalBonus`, mode: 2, value: String(val) });

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

const CW_ASSET = 'systems/cyberpunk-blue/assets/items/cyberware';

/**
 * Build a cyberware item record.
 *
 * @param {object} opts
 * @param {string}  opts.name
 * @param {string}  [opts.manufacturer]
 * @param {string}  opts.cost               - COST key (implant / hardware purchase price)
 * @param {string}  opts.folder             - compendium folder name
 * @param {string}  opts.cyberwareType      - neuralware | cyberoptics | cyberaudio | cyberarms | cyberlegs | internal | external | fashionware | borgware
 * @param {string}  [opts.integration]      - platform | extension | standalone (default standalone)
 * @param {number}  [opts.slotsUsed]        - slots consumed in host platform
 * @param {number}  [opts.slotsProvided]    - slots this platform provides
 * @param {string}  [opts.psycheLoss]       - psyche-loss dice formula or '' for N/A
 * @param {string}  opts.facilities         - mall | clinic | hospital
 * @param {string}  opts.installationCost   - COST key
 * @param {number}  opts.installationDv
 * @param {boolean} [opts.useCyberneticsComponent] - true → DV uses Cybernetics component
 * @param {boolean} [opts.multipleInstalls] - can be installed more than once
 * @param {boolean} [opts.isArmor]
 * @param {number}  [opts.maxSp]
 * @param {string}  [opts.description]
 * @param {string}  [opts.img]
 */
function cw({
  name, manufacturer = '', cost, folder, cyberwareType,
  integration = 'standalone', slotsUsed = 0, slotsProvided = 0,
  psycheLoss = '', facilities, installationCost, installationDv,
  useCyberneticsComponent = false, multipleInstalls = false, paired = false,
  isArmor = false, maxSp = 0, isWeapon = false, weapons = [],
  irEnabled = false, irRange = 0,
  description = '', img = '',
  effects = [], instructions = [],
}) {
  const c = COST[cost] ?? cost;
  return {
    _folder: folder,
    name,
    type: 'cyberware',
    img,
    effects,
    system: {
      manufacturer,
      cost: c,
      hardwareCost: c,
      cyberwareType,
      integration,
      slotsUsed,
      slotsProvided,
      psycheLossFormula: psycheLoss,
      facilities,
      installationCost: COST[installationCost] ?? installationCost,
      installationDv,
      useCyberneticsComponent,
      multipleInstalls,
      paired,
      isArmor,
      isWeapon,
      isComputer: false,
      irEnabled,
      irRange,
      minBodyReq: 0,
      armor: { maxSp, currentSp: maxSp },
      weapons,
      installed: false,
      parentCyberwareId: null,
      description: description ? h(description) : '',
      notes: '',
      instructions,
      instructionActive: false,
      instructionStep: -1,
    },
  };
}

export const CYBERWARE_CATALOGUE = [

  // ── Neuroport ─────────────────────────────────────────────────────────────

  cw({
    name: 'Neuroport',
    img: `systems/cyberpunk-blue/assets/items/cyberware/neuroport.png`,
    folder: 'Neuroport',
    cyberwareType: 'neuralware', integration: 'platform', slotsProvided: 5,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    psycheLoss: '',
    description: '<p>The Neuroport is the platform for all Neuralware. It provides:</p><ul><li>5 neural link slots</li><li>2 shard sockets</li><li>COS</li><li>Holophone</li><li>Biomonitor</li><li>HUD</li><li>Personal Link (wrist cable)</li><li>Wireless Connector (4m)</li><li>Digital Wallet</li><li>Hardened circuitry, which is EMP-protected but still vulnerable to software attacks and direct connections</li></ul><p>COS and the other default functions do not consume slots.</p>',
  }),

  // ── Neuralware ────────────────────────────────────────────────────────────

  cw({
    name: 'Braindance Recorder',
    img: `systems/cyberpunk-blue/assets/items/cyberware/braindance-recorder.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    psycheLoss: '2d6',
    description: 'This implant records the user&rsquo;s experiences to an external system or to a slotted shard, at 1 hour per shard. The raw data requires editing before it plays back smoothly.',
  }),
  cw({
    name: 'Ex-Disk', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/ex-disk.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'VEX', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    description: 'This implant adds 1 hardware or software slot to an installed cyberdeck. Installing 2 or more Ex-Disks grants <strong>+1</strong> NET Action over a wired connection. It requires a Neuroport Cyberdeck Port.',
  }),
  cw({
    name: 'Neuroport Cyberdeck Port',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cyberdeck-port.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 19,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'This port installs a cyberdeck internally, with a large jack at the back of the neck. The deck integrates with a bodyweight suit, and its wireless range becomes 20m. Only one cyberdeck may be installed at a time.',
  }),
  cw({
    name: 'Self-ICE', manufacturer: 'Netwatch',
    img: `systems/cyberpunk-blue/assets/items/cyberware/self-ice.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 13,
    psycheLoss: '', multipleInstalls: true,
    description: 'This implant adds a Passwall that protects the user&rsquo;s neuroport against <strong>Quickhacking</strong>. Its <strong style="color: var(--cpb-accent);">DV = 15 + (2 &times; total number of Self-ICE installs)</strong>, so a second Self-ICE raises the <strong style="color: var(--cpb-accent);">DV</strong> to 19, a third to 21, and so on. It can be installed by a <strong>Netrunner</strong> using <strong>Electronics</strong>/<strong>Cybernetics</strong>, or by a Medtech.',
  }),
  cw({
    name: 'Shard Socket',
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1',
    description: 'This implant adds 2 shard sockets per neuralware slot used, rounding up. The Neuroport already provides 2 sockets as standard.',
  }),
  cw({
    name: 'Kerenzikov',
    img: `systems/cyberpunk-blue/assets/items/cyberware/kereznikov.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    psycheLoss: '4d6',
    description: 'This speedware grants <strong>+1</strong> to Initiative, to vehicle Swerve checks, and to <strong>Evasion</strong>. Only one speedware may be installed at a time.',
    effects: [ae('Speedware: +1 Initiative, Evasion, Swerve', [statMod('rflx', 1), skillGen('evasion', 1), skillGen('drive', 1)])],
  }),
  cw({
    name: 'Sandevistan', manufacturer: 'Arasaka',
    img: `systems/cyberpunk-blue/assets/items/cyberware/sandevistan.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'hospital', installationCost: 'VEX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p>This speedware also replaces the COS. It is activated as an Action and lasts 10 minutes, granting <strong>+3</strong> Initiative, <strong>+3</strong> <strong>Evasion</strong>, <strong>+3</strong> <strong>Martial Arts</strong>, and <strong>+3</strong> <strong>Melee Weapons</strong>. Drive and <strong>Sleight-of-Hand</strong> may also benefit at the GM&rsquo;s discretion.</p><p><strong>BURNOUT:</strong> Using it again within 1 hour deals <strong>3d6</strong> HP damage before the effect applies. Only one speedware and one COS may be installed at a time.</p>',
    effects: [aeOff('Sandevistan Active', [statMod('rflx', 3), skillGen('evasion', 3), skillGen('martialArts', 3), skillGen('meleeWeapons', 3)])],
    instructions: [
      S.message('<p><strong>Sandevistan activated</strong> — +3 Initiative, Evasion, Martial Arts, and Melee Weapons for 10 minutes.</p><p><em>Warning: reactivating within 1 hour deals 3d6 HP damage first.</em></p>', { name: 'Activate' }),
      S.effect({ name: 'Apply Sandevistan AE', effectName: 'Sandevistan Active' }),
      S.message('<p>Sandevistan deactivated.</p>', { name: 'Deactivate', terminates: true }),
    ],
  }),

  // ── Cyberoptics ───────────────────────────────────────────────────────────

  cw({
    name: 'Standard Cybereye',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cybereye.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'platform', slotsProvided: 3,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6', multipleInstalls: true,
    description: 'This implant replaces one eye and can be made to look however the user wants. It gives perfect 20/20 vision and provides 3 cyberoptic slots for extensions. It can be installed a second time for the other eye, and the pair is renamed to Left and Right automatically.',
  }),
  cw({
    name: 'Anti-Dazzle', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/anti-dazzle.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both eyes. The user is immune to flash effects such as flashbang grenades.',
  }),
  cw({
    name: 'Color Shift',
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'The user can change their eye color and pattern as an Action, or set it to react automatically to hormone levels or HUD data.',
  }),
  cw({
    name: 'Dartgun',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cybereye-dartgun.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 3,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This is a single-shot exotic weapon concealed in the eye. Reloading it takes 1 minute.</p>',
  }),
  cw({
    name: 'Image Enhance', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/image-enchance.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'mall', installationCost: 'CO', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both eyes. It grants <strong>+2</strong> to sight-based <strong>Perception</strong> checks.',
    effects: [reminder('Sight Perception +2 (situational)')],
  }),
  cw({
    name: 'MicroOptics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/micro-optics.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 14,
    psycheLoss: '1d6/2',
    description: 'This is a built-in microscope capable of up to 500&times; magnification.',
  }),
  cw({
    name: 'MicroVideo',
    img: `systems/cyberpunk-blue/assets/items/cyberware/microvideo.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 2,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'This is a built-in camera that records to an external system or to a slotted shard.',
  }),
  cw({
    name: 'Radiation Detector',
    img: `systems/cyberpunk-blue/assets/items/cyberware/radiation-detector.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'VEX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both eyes. Alpha, beta, and gamma radiation are visualized as green, teal, and blue glows respectively, and partial x-ray detection is included.',
  }),
  cw({
    name: 'Targeting Scope',
    img: `systems/cyberpunk-blue/assets/items/cyberware/targeting-scope.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This scope grants <strong>+1</strong> to Aimed attacks. It does not stack, so only one scope benefit applies at a time.</p>',
    effects: [aeFlag('Targeting Scope: +1 Aimed Attack', 'targetingScope')],
  }),
  cw({
    name: 'TeleOptics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/teleoptics.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: 'This implant gives detailed vision up to 800m and grants <strong>+1</strong> to attack rolls at ranges greater than 50m. The bonus does not apply to <strong>Autofire</strong>.',
    effects: [aeFlag('TeleOptics: +1 attack >50m', 'teleOptics')],
  }),
  cw({
    name: 'Virtuality',
    img: `systems/cyberpunk-blue/assets/items/cyberware/virtuality.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both eyes. It overlays a multi-sensory MeatSpace AR display, and it is used by netrunners, gamers, and corpos alike.',
  }),
  cw({
    name: 'Wide Spectrum Optics', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/wide-spectrum-optics.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    paired: true,
    // Infrared sense (50 m) — grants the token an IR DetectionMode. Darkness /
    // obscuration attack penalties are ignored against any target within
    // effective IR range (see infrared.mjs + visibility.mjs), replacing the old
    // unconditional ignore-penalty flags.
    irEnabled: true,
    irRange: 50,
    description: 'This implant is PAIRED and must be installed in both eyes. Infrared and UV light become visible, so the user ignores darkness and fog penalties. They can also distinguish warm flesh from cold metal, though not through cover.',
  }),

  // ── Cyberaudio ────────────────────────────────────────────────────────────

  cw({
    name: 'Standard Cyberaudio Suite', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cyberaudio-suite.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'platform', slotsProvided: 3,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: 'This suite is a set of sub-dermal microphones connected to the auditory nerve via the neuroport. It provides 3 cyberaudio slots for extensions.',
  }),
  cw({
    name: 'Amplified Hearing',
    img: `systems/cyberpunk-blue/assets/items/cyberware/hearing-amplifier.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: 'This implant grants <strong>+2</strong> to hearing-based <strong>Perception</strong> checks.',
    effects: [reminder('Hearing Perception +2 (situational)')],
  }),
  cw({
    name: 'Bug Detector (Cyberaudio)',
    img: `systems/cyberpunk-blue/assets/items/cyberware/bug-detector.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 15,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This implant creates resonance in order to detect microphones within 2m.</p>',
  }),
  cw({
    name: 'Homing Tracer (Cyberaudio)',
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'This implant comes with 1 button beacon, and additional beacons cost &euro;$50 (Costly) each. It has a city-street range of 1km.',
  }),
  cw({
    name: 'Level Dampener',
    img: `systems/cyberpunk-blue/assets/items/cyberware/level-dampener-cyberware.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '1d6/2',
    description: 'The user is immune to deafness effects and to damage from loud noises.',
  }),
  cw({
    name: 'Radio / Music Player (Cyberaudio)',
    img: `systems/cyberpunk-blue/assets/items/cyberware/music-player-cyberware.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 14,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'This implant can play audio from the Data Pool, a memory chip, or a radio broadcast.',
  }),
  cw({
    name: 'Radar Detector (Cyberaudio)',
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'This implant detects radar, ladar, and echo scans, and it triangulates the source to within a 10% margin.',
  }),
  cw({
    name: 'Scrambler / Descrambler (Cyberaudio)', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/scrambler-descrambler.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This implant handles encrypted communications. It is sold as a pair, so the other party needs a matching unit, and additional encryption keys can be read from a shard.</p>',
  }),
  cw({
    name: 'Voice Stress Analyzer', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/voice-stress-analyzer.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 12,
    psycheLoss: '1d6',
    description: 'This implant grants <strong>+2</strong> to <strong>Human Perception</strong> and <strong>+1</strong> to <strong>Influence</strong>.',
    effects: [ae('Human Perception +2, Influence +1', [skill('humanPerc', 2), skill('influence', 1)])],
  }),

  // ── Cyberarms ─────────────────────────────────────────────────────────────

  cw({
    name: 'Standard Cyberarm', manufacturer: 'Moore',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cyberarm.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'platform', slotsProvided: 4,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 19,
    psycheLoss: '2d6',
    description: 'This implant is a full arm replacement, and it provides 4 cyberarm slots for extensions.',
  }),
  cw({
    name: 'Gorilla Arm', manufacturer: 'Militech',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'platform', slotsProvided: 3,
    cost: 'VEX', facilities: 'hospital', installationCost: 'EX', installationDv: 19,
    psycheLoss: '2d6',
    description: '<p>Fist counts as an Excellent Quality Heavy Melee Weapon. Wield weapons and gear as if <strong>BODY</strong> were 11.</p><p><strong>WITH TWO GORILLA ARMS:</strong> Grapple, Choke, Slam, and pry open as if <strong>BODY</strong> were 11.</p>',
  }),
  cw({
    name: 'Standard Cyberhand', manufacturer: 'Moore',
    img: `systems/cyberpunk-blue/assets/items/cyberware/standard-cyberhand.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'platform', slotsProvided: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: 'This implant is a full hand replacement, and it provides 1 cyberarm slot for an extension.',
  }),
  cw({
    name: 'Big Knucks',
    img: `systems/cyberpunk-blue/assets/items/cyberware/big-knucks.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: 'These knuckles add <strong>+1d6</strong> to <strong>Martial Arts</strong> punch damage.',
    effects: [aeFlag('Big Knucks: +1d6 MA damage', 'maExtraDamageDice', 1)],
  }),
  cw({
    name: 'Embedded Firearm',
    img: `systems/cyberpunk-blue/assets/items/cyberware/embedded-firearm-cyberarm.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'A 1-handed firearm, purchased separately and then modified to fit, is built into the arm. It is concealable and needs no Action to draw or stow. The arm is unavailable for other tasks while the weapon is deployed.',
  }),
  cw({
    name: 'Grapple Hand',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'This hand fires a rocket-propelled grapple that embeds in thick cover within 30m. Firing it takes an Action, and retracting it is a free Action. The 30m rope has 10 HP and supports 2 people.',
  }),
  cw({
    name: 'Mantis Blades',
    folder: 'Cyberarms', manufacturer: 'Arasaka',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '3d6',
    img: `${CW_ASSET}/arasaka-mantis-blades.png`,
    isWeapon: true,
    weapons: [
      // Single blade (default attack — one blade, RoF 2)
      {
        type: 'heavyMelee', damage: '3d6', rateOfFire: 2, hands: 1,
        concealable: true, isExcellentQuality: true,
      },
      // Combined strike — both blades attack the same target; all dice at once (RoF 1)
      {
        type: 'heavyMelee', damage: '6d6', rateOfFire: 1, hands: 2,
        concealable: true, isExcellentQuality: true,
      },
    ],
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>These are Excellent Quality Heavy Melee Weapons concealed in the forearm. They are free to draw and stow, and the hand is unavailable while they are deployed.</p><p><strong>PAIRED ATTACK:</strong> When two Mantis Blades both attack the same target in a single Attack action, roll all damage dice at once, which increases the chance of a critical injury.</p>',
  }),
  cw({
    name: 'Medscanner (Cyberarm)', manufacturer: 'Trauma Team',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'This scanner performs most medical tests and grants <strong>+2</strong> to <strong>Medicine</strong> checks.',
    effects: [ae('Medicine +2', [skill('medicine', 2)])],
  }),
  cw({
    name: 'Monowire',
    img: `systems/cyberpunk-blue/assets/items/cyberware/monowire.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '2d6',
    isWeapon: true,
    weapons: [{
      type: 'heavyMelee', damage: '3d6', rateOfFire: 2, hands: 1,
      concealable: true, critDoublePick: true,
    }],
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This is a mono-filament whip housed in the hand or forearm.</p><p><strong>1-HANDED MELEE WEAPON:</strong> It deals <strong>3d6</strong> damage at RoF 2 with a 6m reach, and it has no mod slots. On a critical injury, roll the table twice and pick the preferred result.</p>',
  }),
  cw({
    name: 'Projectile Launch System', manufacturer: 'Militech',
    img: `systems/cyberpunk-blue/assets/items/cyberware/projectile-launch-system.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'VEX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '3d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p><strong>MINIATURE ROCKET LAUNCHER:</strong> The launcher holds 1 round and deals <strong>7d6</strong> explosive damage at <strong>&minus;10</strong>/14, at RoF 1. It is only compatible with the Smart Rebuild mod. It is free to draw and stow, and the arm is unavailable while it is deployed.</p>',
  }),
  cw({
    name: 'Rippers',
    img: `systems/cyberpunk-blue/assets/items/cyberware/Rippers.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>These are carbon-glass fingernails that count as a Medium Melee Weapon, and they are concealable. They can be installed in a meat arm without needing a platform, which is the only install allowed. The hand is unavailable while they are deployed as a weapon.</p>',
  }),
  cw({
    name: 'Scratchers',
    img: `systems/cyberpunk-blue/assets/items/cyberware/scratchers.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 13,
    psycheLoss: '1d6',
    description: 'These are extendable carbon-glass nails that count as a Light Melee Weapon, and they are concealable. They can be installed in a meat arm without needing a platform, which is the only install allowed. The hand is unavailable while they are deployed.',
  }),
  cw({
    name: 'Shoulder Cam',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'This is a concealable video camera mounted in the shoulder, and it records to a memory chip or an external system.',
  }),
  cw({
    name: 'Subdermal Grip', manufacturer: 'Arasaka',
    img: `systems/cyberpunk-blue/assets/items/cyberware/subdermal-grip.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'This is a subdermal smartgun connector that allows smartgun use without interface plugs. It can be installed in a meat arm without needing a platform, which is the only install allowed.',
  }),
  cw({
    name: 'Techscanner (Cyberarm)',
    img: `systems/cyberpunk-blue/assets/items/cyberware/techscanner-cyberware.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'This scanner grants <strong>+2</strong> to <strong>Electronics</strong> and <strong>Mechanics</strong> checks on hardware only.',
    effects: [ae('Electronics +2, Mechanics +2 (hardware)', [skillGen('electronics', 2), skillGen('mechanics', 2)])],
  }),
  cw({
    name: 'Tool Hand',
    img: `systems/cyberpunk-blue/assets/items/cyberware/tool-hand.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: 'The fingers and palm contain screwdrivers, a wrench, a small drill, and other configurable tool heads.',
  }),
  cw({
    name: 'Wolvers',
    img: `systems/cyberpunk-blue/assets/items/cyberware/wolvers.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '2d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>These are Heavy Melee Weapon claws that extend between the knuckles, and they are concealable. The hand is unavailable while they are deployed.</p>',
  }),

  // ── Cyberlegs ─────────────────────────────────────────────────────────────

  cw({
    name: 'Standard Cyberleg', manufacturer: 'Dynalar',
    img: `systems/cyberpunk-blue/assets/items/cyberware/standard-cyberleg.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'platform', slotsProvided: 3,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 18,
    psycheLoss: '3d6',
    description: 'This implant is a full leg replacement, and it provides 3 cyberleg slots for extensions.',
  }),
  cw({
    name: 'Standard Cyberfoot', manufacturer: 'Dynalar',
    img: `systems/cyberpunk-blue/assets/items/cyberware/standard-cyberfoot.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'platform', slotsProvided: 1,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 16,
    psycheLoss: '1d6',
    description: 'This implant is a full foot replacement, and it provides 1 cyberleg slot for an extension.',
  }),
  cw({
    name: 'Gripfoot',
    img: `systems/cyberpunk-blue/assets/items/cyberware/gripfoot.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both legs or feet. The user suffers no movement penalties for climbing.',
    effects: [reminder('No climbing movement penalties (GM-handled)')],
  }),
  cw({
    name: 'Jump Booster',
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 2,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both legs or feet. The user suffers no movement penalties for jumping.',
    effects: [reminder('No jumping movement penalties (GM-handled)')],
  }),
  cw({
    name: 'Rocket Boost',
    img: `systems/cyberpunk-blue/assets/items/cyberware/rocket-boost.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 3,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both legs or feet. It doubles jump height and lets the user ignore an additional 6m of falling distance.',
    effects: [reminder('Rocket Boost: doubled jump height; ignore extra 6m fall distance (GM-handled)')],
  }),
  cw({
    name: 'Skate Foot',
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both legs or feet. These are inline skates that extend and retract at will, adding <strong>+6</strong>m of movement distance per turn. They do not raise the <strong>MOVE</strong> stat.',
    effects: [aeOff('Skate Foot Active (+6m movement)', [stat('move', 3)])],
    instructions: [
      S.message('<p><strong>Skate Foot deployed</strong> — movement distance +6m per turn.</p>', { name: 'Deploy' }),
      S.effect({ name: 'Apply Movement AE', effectName: 'Skate Foot Active (+6m movement)' }),
      S.message('<p>Skate Foot retracted.</p>', { name: 'Retract', terminates: true }),
    ],
  }),
  cw({
    name: 'Talon Foot',
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'This is a Light Melee Weapon blade in the foot that extends and retracts at will. It can be installed in a meat foot without a platform, which is the only install allowed.',
  }),
  cw({
    name: 'Webbed Foot', manufacturer: 'MetaCorp',
    img: `systems/cyberpunk-blue/assets/items/cyberware/webbed-feet.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    paired: true,
    description: 'This implant is PAIRED and must be installed in both legs or feet, or in both meat feet. The user suffers no movement penalties for swimming.',
    effects: [reminder('No swimming movement penalties (GM-handled)')],
  }),

  // ── Internal Cyberware ────────────────────────────────────────────────────

  cw({
    name: 'Contraceptive Implant', manufacturer: 'Mr Stud',
    img: `systems/cyberpunk-blue/assets/items/cyberware/contraceptive-implant.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'CH', facilities: 'mall', installationCost: 'CO', installationDv: 10,
    psycheLoss: '',
    description: 'This implant prevents pregnancy, and it also administers STI vaccines and treatments.',
  }),
  cw({
    name: 'Cybersnake',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    description: 'This is a Very Heavy Melee Weapon dealing <strong>4d6</strong> at RoF 1, concealed in the esophagus.',
  }),
  cw({
    name: 'Enhanced Antibodies',
    img: `systems/cyberpunk-blue/assets/items/cyberware/enhanced-antibodies.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'mall', installationCost: 'CO', installationDv: 15,
    psycheLoss: '1d6/2',
    description: 'Once the user has been stabilized, they heal <strong>BODY</strong>&times;2 HP per day with light activity, rather than at the standard recovery rate.',
    effects: [reminder('Heals BODY×2 HP/day when stabilized (GM-handled)')],
  }),
  cw({
    name: 'Gills',
    img: `systems/cyberpunk-blue/assets/items/cyberware/gills.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '2d6',
    description: 'The user can breathe underwater without restriction.',
  }),
  cw({
    name: 'Grafted Muscle & Bone Lace',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6', multipleInstalls: true,
    description: '<p>This implant grants <strong>BODY</strong> <strong>+2</strong>, though it cannot push <strong>BODY</strong> past 10. The IP cost to improve <strong>BODY</strong> is calculated as if this bonus did not exist, and the implant can be installed multiple times.</p>',
    effects: [ae('BODY +2 (max 10 from this cyberware)', [stat('body', 2)])],
  }),
  cw({
    name: 'Independent Air Supply',
    img: `systems/cyberpunk-blue/assets/items/cyberware/independent-air-supply.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 18,
    psycheLoss: '1d6',
    description: '<p>The user can hold their breath for 30 minutes, and the reservoir replenishes in 1 hour at 1 atm.</p><p><strong>REPLACEMENT TANK:</strong> A fresh tank costs &euro;$50 (Costly) and is swapped in as an Action.</p>',
  }),
  cw({
    name: 'Nasal Filters',
    img: `systems/cyberpunk-blue/assets/items/cyberware/nasal-filters.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'The user is immune to inhaled gases, smoke, and toxins. The filters can be toggled on or off without an Action.',
  }),
  cw({
    name: 'Radar / Sonar',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'VEX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'This implant scans 50m of terrain, including underwater, though not through cover. It displays on the HUD or in cybereyes, with optional motion highlighting.',
    effects: [reminder('50m terrain/underwater scan (GM-handled)')],
  }),
  cw({
    name: 'Toxin Binders', manufacturer: 'Biotechnica',
    img: `systems/cyberpunk-blue/assets/items/cyberware/toxin-binders.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'These grant <strong>+2</strong> to <strong>Endurance</strong> checks made to resist blood-borne toxins and drugs. They do not stack.',
    effects: [ae('Endurance +2 vs blood-borne toxins/drugs', [skill('endurance', 2)])],
  }),
  cw({
    name: 'Vampyres',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '3d6',
    description: 'These are Excellent Quality Light Melee Weapons dealing <strong>1d6</strong> at RoF 2, concealed as fangs. They can safely inject 1 dose of toxin.',
  }),

  // ── Fashionware ───────────────────────────────────────────────────────────

  cw({
    name: 'AudioVox',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p>This is a voice synthesizer that grants <strong>+2</strong> to <strong>Acting</strong> and to Music (singing).</p><p><strong>WITH A VOICE-ANALYSIS SHARD:</strong> An <strong>Acting</strong> roll lets the user perfectly imitate someone&rsquo;s voice.</p>',
    effects: [ae('Acting +2, Music +2', [skill('acting', 2), comp('music', 2)])],
  }),
  cw({
    name: 'Chemskin',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: 'This treatment permanently changes skin color and pattern, and it can optionally react to temperature or hormone levels. Chemskin combined with Tech Hair grants <strong>+2</strong> Style, which is not additive with other bonuses.',
    effects: [reminder('If both Chemskin AND Tech Hair installed: +2 Style')],
  }),
  cw({
    name: 'Light Tattoo',
    img: `systems/cyberpunk-blue/assets/items/cyberware/light-tattoo.png`,
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '', multipleInstalls: true,
    description: 'This is a subdermal display that projects a colored tattoo through the skin. Having 3 or more Light Tattoos installed grants <strong>+2</strong> Style in total.',
    effects: [reminder('3+ Light Tattoos installed: +2 Style total')],
  }),
  cw({
    name: 'Shift Tacts',
    img: `systems/cyberpunk-blue/assets/items/cyberware/shift-tacts.png`,
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '',
    description: 'These are replacement corneas and irises that allow appearance changes on demand. The cost covers one or both eyes.',
  }),
  cw({
    name: 'Tech Hair',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 14,
    psycheLoss: '',
    description: 'This is artificial hair that can emit light, and it can optionally react to temperature or hormone levels. Tech Hair combined with Chemskin grants <strong>+2</strong> Style, which is not additive with other bonuses.',
    effects: [reminder('If both Chemskin AND Tech Hair installed: +2 Style')],
  }),
  cw({
    name: 'Threading',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'EV', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '',
    description: 'These are lines or small metal segments embedded in the skin. Most fashion-conscious people have at least some.',
  }),

  // ── External Cyberware ────────────────────────────────────────────────────

  cw({
    name: 'Dermal Display',
    img: `systems/cyberpunk-blue/assets/items/cyberware/subdermal-display.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '',
    description: 'This is a 5&times;10cm subdermal screen controlled by the COS.',
  }),
  cw({
    name: 'Hidden Holster',
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '2d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>This is a small body cavity for concealing a concealable weapon.</p>',
  }),
  cw({
    name: 'MidnightLady™', manufacturer: 'Midnight Lady',
    img: `systems/cyberpunk-blue/assets/items/cyberware/midnight-lady.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 14,
    psycheLoss: '',
    description: 'This implant provides a vagina, a vulva, and optional breasts, and it maximizes pleasure for both the user and their partners.',
  }),
  cw({
    name: 'Mr. Studd™', manufacturer: 'Mr Stud',
    img: `systems/cyberpunk-blue/assets/items/cyberware/mr-stud.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 14,
    psycheLoss: '',
    description: 'This implant provides a penis and scrotum, and it delivers optimal pleasure for both the user and their partners.',
  }),
  cw({
    name: 'Skin-Weave',
    img: `systems/cyberpunk-blue/assets/items/cyberware/skin-weave.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    isArmor: true, maxSp: 7,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '2d6',
    description: 'This is SP 7 polymer skin reinforcement. It only counts if it is the highest SP source available. It ablates from damage and heals 1 SP per day of rest.',
  }),
  cw({
    name: 'Subdermal Armor',
    folder: 'External Cyberware', manufacturer: 'Dynalar',
    cyberwareType: 'external', integration: 'standalone',
    isArmor: true, maxSp: 11,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    img: `${CW_ASSET}/Dynalar-subdermal-armor.png`,
    description: 'These are SP 11 armor micro-plates under the skin. They only count if they are the highest SP source available. They ablate from damage and heal 1 SP per day of rest.',
  }),
  cw({
    name: 'Subdermal Pocket',
    img: `systems/cyberpunk-blue/assets/items/cyberware/skin-pocket.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: 'This is a 5&times;10cm storage space under the skin, sealed with a RealSkinn&reg; zipper.',
  }),

  // ── Borgware ──────────────────────────────────────────────────────────────

  cw({
    name: 'Artificial Shoulder Mount',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 22,
    psycheLoss: '4d6',
    description: 'This mount carries up to 2 additional cyberarms below the regular arms. A user with <strong>BODY</strong> 10 or higher can take a second Artificial Shoulder Mount, for a total of 6 arms.',
  }),
  cw({
    name: 'Implanted Linear Frame Beta',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone',
    cost: 'LUX', facilities: 'hospital', installationCost: 'EX', installationDv: 22,
    psycheLoss: '4d6',
    description: '<p>The user&rsquo;s <strong>BODY</strong> becomes 14, and it cannot be improved further with IP.</p><p><strong>PREREQUISITE:</strong> <strong>BODY</strong> 8 or higher and two Grafted Muscle &amp; Bone Lace implants.</p>',
    effects: [ae('BODY becomes 14', [statOvr('body', 14)])],
  }),
  cw({
    name: 'Implanted Linear Frame Sigma',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone',
    cost: 'VEX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p>The user&rsquo;s <strong>BODY</strong> becomes 12, and it cannot be improved further with IP.</p><p><strong>PREREQUISITE:</strong> <strong>BODY</strong> 6 or higher and one Grafted Muscle &amp; Bone Lace implant.</p>',
    effects: [ae('BODY becomes 12', [statOvr('body', 12)])],
  }),
  cw({
    name: 'MultiOptic Mount', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/MultiOptic-Mount.png`,
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone', slotsProvided: 5,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p>This mount splits the optic nerves, making up to 5 additional cybereye installations possible.</p><p><strong>PREREQUISITE:</strong> 2 cybereyes already installed.</p>',
  }),
  cw({
    name: 'Sensor Array',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone', slotsProvided: 7,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 18,
    psycheLoss: '3d6',
    description: '<p>This array provides multiple antenna and sensor attachment points, granting <strong>+7</strong> additional cyberaudio slots.</p><p><strong>PREREQUISITE:</strong> A Cyberaudio Suite must already be installed.</p>',
  }),
];
