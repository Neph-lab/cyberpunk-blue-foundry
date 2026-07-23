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
    description: '<p>Platform for all Neuralware. Provides:</p><ul><li>5 neural link slots</li><li>2 shard sockets</li><li>COS</li><li>Holophone</li><li>Biomonitor</li><li>HUD</li><li>Personal Link (wrist cable)</li><li>Wireless Connector (4m)</li><li>Digital Wallet</li><li>Hardened circuitry (EMP-protected; still vulnerable to software attacks and direct connections)</li></ul><p>COS and other default functions do not consume slots.</p>',
  }),

  // ── Neuralware ────────────────────────────────────────────────────────────

  cw({
    name: 'Braindance Recorder',
    img: `systems/cyberpunk-blue/assets/items/cyberware/braindance-recorder.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    psycheLoss: '2d6',
    description: 'Records user experiences to an external system or a slotted shard (1 hour per shard). Raw data requires editing for smooth playback.',
  }),
  cw({
    name: 'Ex-Disk', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/ex-disk.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'VEX', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    description: '<p>Adds 1 hardware or software slot to an installed cyberdeck. Installing 2 or more Ex-Disks grants <strong>+1</strong> NET Action via wired connection. Requires a Neuroport Cyberdeck Port.</p>',
  }),
  cw({
    name: 'Neuroport Cyberdeck Port',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cyberdeck-port.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 19,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'Installs a cyberdeck internally with a large jack at the back of the neck. The deck integrates with a bodyweight suit. Deck wireless range becomes 20m. Only one cyberdeck may be installed at a time.',
  }),
  cw({
    name: 'Self-ICE', manufacturer: 'Netwatch',
    img: `systems/cyberpunk-blue/assets/items/cyberware/self-ice.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 13,
    psycheLoss: '', multipleInstalls: true,
    description: '<p>Adds a Passwall protecting your neuroport against <strong>Quickhacking</strong>. The Passwall <strong style="color: var(--cpb-accent);">DV = 15 + (2 × total number of Self-ICE installs)</strong>. Installing a second Self-ICE raises the <strong style="color: var(--cpb-accent);">DV</strong> to 19, a third to 21, and so on. Can be installed by a <strong>Netrunner</strong> (<strong>Electronics</strong>/<strong>Cybernetics</strong>) or a Medtech.</p>',
  }),
  cw({
    name: 'Shard Socket',
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1',
    description: 'Adds 2 shard sockets per neuralware slot used (round up). The Neuroport already provides 2 sockets as standard.',
  }),
  cw({
    name: 'Kerenzikov',
    img: `systems/cyberpunk-blue/assets/items/cyberware/kereznikov.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 17,
    psycheLoss: '4d6',
    description: '<p>Speedware. <strong>+1</strong> to Initiative, vehicle Swerve checks, and <strong>Evasion</strong>. Only one speedware may be installed at a time.</p>',
    effects: [ae('Speedware: +1 Initiative, Evasion, Swerve', [statMod('rflx', 1), skillGen('evasion', 1), skillGen('drive', 1)])],
  }),
  cw({
    name: 'Sandevistan', manufacturer: 'Arasaka',
    img: `systems/cyberpunk-blue/assets/items/cyberware/sandevistan.png`,
    folder: 'Neuralware',
    cyberwareType: 'neuralware', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'hospital', installationCost: 'VEX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p>Speedware and COS replacement. Activated as an Action, lasts 10 minutes: <strong>+3</strong> Initiative, <strong>+3</strong> <strong>Evasion</strong>, <strong>+3</strong> <strong>Martial Arts</strong>, <strong>+3</strong> <strong>Melee Weapons</strong> (Drive and <strong>Sleight-of-Hand</strong> at GM discretion). Using it again within 1 hour deals <strong>3d6</strong> HP damage before the effect applies. Only one speedware and one COS may be installed at a time.</p>',
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
    description: 'Replaces one eye. Can appear as desired. Perfect 20/20 vision. Provides 3 cyberoptic slots for extensions. Can be installed a second time (second eye) — the pair is renamed to Left/Right automatically.',
  }),
  cw({
    name: 'Anti-Dazzle', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/anti-dazzle.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    paired: true,
    description: 'PAIRED (must be installed in both eyes). Immune to flash effects such as flashbang grenades.',
  }),
  cw({
    name: 'Color Shift',
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'Eye color and pattern can be changed as an Action, or set to react automatically to hormone levels or HUD data.',
  }),
  cw({
    name: 'Dartgun',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cybereye-dartgun.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 3,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Single-shot exotic weapon concealed in the eye. Takes 1 minute to reload.</p>',
  }),
  cw({
    name: 'Image Enhance', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/image-enchance.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'mall', installationCost: 'CO', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: '<p>PAIRED (must be installed in both eyes). <strong>+2</strong> to sight-based <strong>Perception</strong> checks.</p>',
    effects: [reminder('Sight Perception +2 (situational)')],
  }),
  cw({
    name: 'MicroOptics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/micro-optics.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 14,
    psycheLoss: '1d6/2',
    description: 'Built-in microscope capable of up to 500× magnification.',
  }),
  cw({
    name: 'MicroVideo',
    img: `systems/cyberpunk-blue/assets/items/cyberware/microvideo.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 2,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'Built-in camera; records to an external system or a slotted shard.',
  }),
  cw({
    name: 'Radiation Detector',
    img: `systems/cyberpunk-blue/assets/items/cyberware/radiation-detector.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'VEX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'PAIRED (must be installed in both eyes). Alpha, beta, and gamma radiation are visualized as green, teal, and blue glows respectively. Partial x-ray detection included.',
  }),
  cw({
    name: 'Targeting Scope',
    img: `systems/cyberpunk-blue/assets/items/cyberware/targeting-scope.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p><strong>+1</strong> to Aimed attacks. Does not stack; only one scope benefit applies at a time.</p>',
    effects: [aeFlag('Targeting Scope: +1 Aimed Attack', 'targetingScope')],
  }),
  cw({
    name: 'TeleOptics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/teleoptics.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p>Detailed vision up to 800m. <strong>+1</strong> to attack rolls at ranges greater than 50m (does not apply to <strong>Autofire</strong>).</p>',
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
    description: 'PAIRED (must be installed in both eyes). Multi-sensory MeatSpace AR overlay. Used by Netrunners, gamers, and corpos.',
  }),
  cw({
    name: 'Wide Spectrum Optics', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/wide-spectrum-optics.png`,
    folder: 'Cyberoptics',
    cyberwareType: 'cyberoptics', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    paired: true,
    description: 'PAIRED (must be installed in both eyes). Infrared and UV light are visible. Ignore darkness and fog penalties. Can distinguish warm flesh from cold metal (not through cover).',
    // "Ignore darkness and fog penalties" → penalty-only bypass; NOT_VISIBLE still blocks.
    effects: [
      aeFlag('Ignore Darkness Attack Penalty',    'ignoreDarknessPenalty'),
      aeFlag('Ignore Obscuration Attack Penalty', 'ignoreObscurationPenalty'),
    ],
  }),

  // ── Cyberaudio ────────────────────────────────────────────────────────────

  cw({
    name: 'Standard Cyberaudio Suite', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/cyberaudio-suite.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'platform', slotsProvided: 3,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: 'Sub-dermal microphones connected to the auditory nerve via neuroport. Provides 3 cyberaudio slots for extensions.',
  }),
  cw({
    name: 'Amplified Hearing',
    img: `systems/cyberpunk-blue/assets/items/cyberware/hearing-amplifier.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: '<p><strong>+2</strong> to hearing-based <strong>Perception</strong> checks.</p>',
    effects: [reminder('Hearing Perception +2 (situational)')],
  }),
  cw({
    name: 'Bug Detector (Cyberaudio)',
    img: `systems/cyberpunk-blue/assets/items/cyberware/bug-detector.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 15,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Creates resonance to detect microphones within 2m.</p>',
  }),
  cw({
    name: 'Homing Tracer (Cyberaudio)',
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: '1 button beacon included; additional beacons cost CO each. City-street range 1km.',
  }),
  cw({
    name: 'Level Dampener',
    img: `systems/cyberpunk-blue/assets/items/cyberware/level-dampener-cyberware.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '1d6/2',
    description: 'Immune to deafness effects and damage from loud noises.',
  }),
  cw({
    name: 'Radio / Music Player (Cyberaudio)',
    img: `systems/cyberpunk-blue/assets/items/cyberware/music-player-cyberware.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 14,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'Can play audio from the Data Pool, a memory chip, or radio broadcast.',
  }),
  cw({
    name: 'Radar Detector (Cyberaudio)',
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: 'Detects radar, ladar, and echo scan; triangulates the source within a 10% margin.',
  }),
  cw({
    name: 'Scrambler / Descrambler (Cyberaudio)', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/scrambler-descrambler.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    useCyberneticsComponent: true, psycheLoss: '1d6/2',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Encrypted communications (sold as a pair; matching unit required for the other party). Additional encryption keys can be read from a shard.</p>',
  }),
  cw({
    name: 'Voice Stress Analyzer', manufacturer: 'Raven Microcybernetics',
    img: `systems/cyberpunk-blue/assets/items/cyberware/voice-stress-analyzer.png`,
    folder: 'Cyberaudio',
    cyberwareType: 'cyberaudio', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 12,
    psycheLoss: '1d6',
    description: '<p><strong>+2</strong> to <strong>Human Perception</strong> and <strong>+1</strong> to <strong>Influence</strong>.</p>',
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
    description: 'Full arm replacement. Provides 4 cyberarm slots for extensions.',
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
    description: 'Full hand replacement. Provides 1 cyberarm slot for an extension.',
  }),
  cw({
    name: 'Big Knucks',
    img: `systems/cyberpunk-blue/assets/items/cyberware/big-knucks.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: '<p><strong>+1d6</strong> to <strong>Martial Arts</strong> punch damage.</p>',
    effects: [aeFlag('Big Knucks: +1d6 MA damage', 'maExtraDamageDice', 1)],
  }),
  cw({
    name: 'Embedded Firearm',
    img: `systems/cyberpunk-blue/assets/items/cyberware/embedded-firearm-cyberarm.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'A 1-handed firearm (purchased separately, then modified to fit) is built into the arm. Concealable. No Action required to draw or stow. The arm is unavailable for other tasks while the weapon is deployed.',
  }),
  cw({
    name: 'Grapple Hand',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: 'Rocket-propelled grapple hand. Embeds in thick cover within 30m. Action to fire; free Action to retract. 30m rope (10 HP, supports 2 people).',
  }),
  cw({
    name: 'Mantis Blades',
    folder: 'Cyberarms', manufacturer: 'Arasaka',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '3d6',
    img: `${CW_ASSET}/arasaka mantis blades.png`,
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
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Excellent Quality Heavy Melee Weapon concealed in the forearm. Free to draw and stow. The hand is unavailable while the blades are deployed. When two Mantis Blades both attack the same target in a single Attack action, roll all damage dice at once (increasing Critical Injury probability).</p>',
  }),
  cw({
    name: 'Medscanner (Cyberarm)', manufacturer: 'Trauma Team',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: '<p>Performs most medical tests. <strong>+2</strong> to <strong>Medicine</strong> checks.</p>',
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
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Mono-filament whip housed in the hand or forearm.</p><p><strong>1-HANDED MELEE WEAPON:</strong> <strong>3d6</strong> damage, RoF 2, no mod slots, 6m range. On a Critical Injury, roll the table twice and pick the preferred result.</p>',
  }),
  cw({
    name: 'Projectile Launch System', manufacturer: 'Militech',
    img: `systems/cyberpunk-blue/assets/items/cyberware/projectile-launch-system.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'VEX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '3d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p><strong>MINIATURE ROCKET LAUNCHER:</strong> magazine 1, <strong>7d6</strong> <strong>−10</strong>/14 Explosive, RoF 1. Only compatible with the Smart Rebuild mod. Free to draw and stow; the arm is unavailable while deployed.</p>',
  }),
  cw({
    name: 'Rippers',
    img: `systems/cyberpunk-blue/assets/items/cyberware/Rippers.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Carbon-glass fingernails. Medium Melee Weapon, concealable. Can be installed in a meat arm without needing a platform (only install allowed). The hand is unavailable while deployed as a weapon.</p>',
  }),
  cw({
    name: 'Scratchers',
    img: `systems/cyberpunk-blue/assets/items/cyberware/scratchers.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 13,
    psycheLoss: '1d6',
    description: 'Extendable carbon-glass nails. Light Melee Weapon, concealable. Can be installed in a meat arm without needing a platform (only install allowed). The hand is unavailable while deployed.',
  }),
  cw({
    name: 'Shoulder Cam',
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'Concealable video camera mounted in the shoulder. Records to a memory chip or external system.',
  }),
  cw({
    name: 'Subdermal Grip', manufacturer: 'Arasaka',
    img: `systems/cyberpunk-blue/assets/items/cyberware/subdermal-grip.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'Subdermal smartgun connector allowing smartgun use without interface plugs. Can be installed in a meat arm without needing a platform (only install allowed).',
  }),
  cw({
    name: 'Techscanner (Cyberarm)',
    img: `systems/cyberpunk-blue/assets/items/cyberware/techscanner-cyberware.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 2,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: '<p><strong>+2</strong> to <strong>Electronics</strong> and <strong>Mechanics</strong> checks (hardware only).</p>',
    effects: [ae('Electronics +2, Mechanics +2 (hardware)', [skillGen('electronics', 2), skillGen('mechanics', 2)])],
  }),
  cw({
    name: 'Tool Hand',
    img: `systems/cyberpunk-blue/assets/items/cyberware/tool-hand.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: 'Fingers and palm contain screwdrivers, wrench, small drill, and other configurable tool heads.',
  }),
  cw({
    name: 'Wolvers',
    img: `systems/cyberpunk-blue/assets/items/cyberware/wolvers.png`,
    folder: 'Cyberarms',
    cyberwareType: 'cyberarms', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '2d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Heavy Melee Weapon claws extending between the knuckles. Concealable. The hand is unavailable while deployed.</p>',
  }),

  // ── Cyberlegs ─────────────────────────────────────────────────────────────

  cw({
    name: 'Standard Cyberleg', manufacturer: 'Dynalar',
    img: `systems/cyberpunk-blue/assets/items/cyberware/standard-cyberleg.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'platform', slotsProvided: 3,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 18,
    psycheLoss: '3d6',
    description: 'Full leg replacement. Provides 3 cyberleg slots for extensions.',
  }),
  cw({
    name: 'Standard Cyberfoot', manufacturer: 'Dynalar',
    img: `systems/cyberpunk-blue/assets/items/cyberware/standard-cyberfoot.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'platform', slotsProvided: 1,
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 16,
    psycheLoss: '1d6',
    description: 'Full foot replacement. Provides 1 cyberleg slot for an extension.',
  }),
  cw({
    name: 'Gripfoot',
    img: `systems/cyberpunk-blue/assets/items/cyberware/gripfoot.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'PAIRED (must be installed in both legs/feet). No movement penalties for climbing.',
    effects: [reminder('No climbing movement penalties (GM-handled)')],
  }),
  cw({
    name: 'Jump Booster',
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 2,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: 'PAIRED (must be installed in both legs/feet). No movement penalties for jumping.',
    effects: [reminder('No jumping movement penalties (GM-handled)')],
  }),
  cw({
    name: 'Rocket Boost',
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 3,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    paired: true,
    description: 'PAIRED (must be installed in both legs/feet). Doubles jump height. Ignore an additional 6m of falling distance.',
    effects: [reminder('Rocket Boost: doubled jump height; ignore extra 6m fall distance (GM-handled)')],
  }),
  cw({
    name: 'Skate Foot',
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    useCyberneticsComponent: true, psycheLoss: '1d6',
    paired: true,
    description: '<p>PAIRED (must be installed in both legs/feet). Inline skates that extend and retract at will. Movement distance <strong>+6</strong>m per turn (not <strong>MOVE</strong> stat).</p>',
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
    description: 'Light Melee Weapon blade in the foot. Extends and retracts at will. Can be installed in a meat foot without a platform (only install allowed).',
  }),
  cw({
    name: 'Webbed Foot', manufacturer: 'MetaCorp',
    img: `systems/cyberpunk-blue/assets/items/cyberware/webbed-feet.png`,
    folder: 'Cyberlegs',
    cyberwareType: 'cyberlegs', integration: 'extension', slotsUsed: 1,
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    paired: true,
    description: 'PAIRED (must be installed in both legs/feet, or in meat feet). No movement penalties for swimming.',
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
    description: 'Prevents pregnancy. Also administers STI vaccines and treatments.',
  }),
  cw({
    name: 'Cybersnake',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p>Very Heavy Melee Weapon (<strong>4d6</strong>, RoF 1) concealed in the esophagus.</p>',
  }),
  cw({
    name: 'Enhanced Antibodies',
    img: `systems/cyberpunk-blue/assets/items/cyberware/enhanced-antibodies.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'mall', installationCost: 'CO', installationDv: 15,
    psycheLoss: '1d6/2',
    description: '<p>After being stabilised, heals <strong>BODY</strong>×2 HP per day with light activity (versus the standard recovery rate).</p>',
    effects: [reminder('Heals BODY×2 HP/day when stabilised (GM-handled)')],
  }),
  cw({
    name: 'Gills',
    img: `systems/cyberpunk-blue/assets/items/cyberware/gills.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '2d6',
    description: 'Breathe underwater without restriction.',
  }),
  cw({
    name: 'Grafted Muscle & Bone Lace',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6', multipleInstalls: true,
    description: '<p><strong>BODY</strong> <strong>+2</strong> (cannot push <strong>BODY</strong> past 10 through this cyberware). IP cost to improve <strong>BODY</strong> is calculated as if this bonus did not exist. Can be installed multiple times.</p>',
    effects: [ae('BODY +2 (max 10 from this cyberware)', [stat('body', 2)])],
  }),
  cw({
    name: 'Independent Air Supply',
    img: `systems/cyberpunk-blue/assets/items/cyberware/independent-air-supply.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 18,
    psycheLoss: '1d6',
    description: '<p>Hold breath for 30 minutes; the reservoir replenishes in 1 hour at 1 atm.</p><p><strong>REPLACEMENT TANK:</strong> €$50 (Costly) as an Action.</p>',
  }),
  cw({
    name: 'Nasal Filters',
    img: `systems/cyberpunk-blue/assets/items/cyberware/nasal-filters.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: 'Immune to inhaled gases, smoke, and toxins. Can be toggled on or off without an Action.',
  }),
  cw({
    name: 'Radar / Sonar',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'VEX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    useCyberneticsComponent: true, psycheLoss: '2d6',
    description: '50m terrain scan, including underwater (not through cover). Displays on HUD or cybereyes. Optional motion highlighting.',
    effects: [reminder('50m terrain/underwater scan (GM-handled)')],
  }),
  cw({
    name: 'Toxin Binders', manufacturer: 'Biotechnica',
    img: `systems/cyberpunk-blue/assets/items/cyberware/toxin-binders.png`,
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6/2',
    description: '<p><strong>+2</strong> to <strong>Endurance</strong> checks to resist blood-borne toxins and drugs. Does not stack.</p>',
    effects: [ae('Endurance +2 vs blood-borne toxins/drugs', [skill('endurance', 2)])],
  }),
  cw({
    name: 'Vampyres',
    folder: 'Internal Cyberware',
    cyberwareType: 'internal', integration: 'standalone',
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '3d6',
    description: '<p>Excellent Quality Light Melee Weapon (<strong>1d6</strong>, RoF 2) concealed as fangs. Can safely inject 1 toxin dose via the fangs.</p>',
  }),

  // ── Fashionware ───────────────────────────────────────────────────────────

  cw({
    name: 'AudioVox',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: '<p>Voice synthesizer. <strong>+2</strong> to <strong>Acting</strong> and Music (singing).</p><p><strong>WITH A VOICE-ANALYSIS SHARD:</strong> an <strong>Acting</strong> roll lets you perfectly imitate someone\'s voice.</p>',
    effects: [ae('Acting +2, Music +2', [skill('acting', 2), comp('music', 2)])],
  }),
  cw({
    name: 'Chemskin',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 15,
    psycheLoss: '1d6',
    description: '<p>Permanent skin color and pattern change; optionally reactive to temperature or hormone levels. Chemskin combined with Tech Hair grants <strong>+2</strong> Style (not additive with other bonuses).</p>',
    effects: [reminder('If both Chemskin AND Tech Hair installed: +2 Style')],
  }),
  cw({
    name: 'Light Tattoo',
    img: `systems/cyberpunk-blue/assets/items/cyberware/light-tattoo.png`,
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '', multipleInstalls: true,
    description: '<p>Subdermal display projecting a colored tattoo through the skin. Having 3 or more Light Tattoos installed grants <strong>+2</strong> Style total.</p>',
    effects: [reminder('3+ Light Tattoos installed: +2 Style total')],
  }),
  cw({
    name: 'Shift Tacts',
    img: `systems/cyberpunk-blue/assets/items/cyberware/shift-tacts.png`,
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '',
    description: 'Replacement cornea and iris allowing appearance changes on demand. Cost covers one or both eyes.',
  }),
  cw({
    name: 'Tech Hair',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 14,
    psycheLoss: '',
    description: '<p>Artificial hair that can emit light; optionally reactive to temperature or hormone levels. Tech Hair combined with Chemskin grants <strong>+2</strong> Style (not additive with other bonuses).</p>',
    effects: [reminder('If both Chemskin AND Tech Hair installed: +2 Style')],
  }),
  cw({
    name: 'Threading',
    folder: 'Fashionware',
    cyberwareType: 'fashionware', integration: 'standalone',
    cost: 'EV', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '',
    description: 'Lines or small metal segments embedded in the skin. Most fashion-conscious people have at least some.',
  }),

  // ── External Cyberware ────────────────────────────────────────────────────

  cw({
    name: 'Dermal Display',
    img: `systems/cyberpunk-blue/assets/items/cyberware/subdermal-display.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'CO', facilities: 'mall', installationCost: 'CO', installationDv: 12,
    psycheLoss: '',
    description: 'A 5×10cm subdermal screen controlled by the COS.',
  }),
  cw({
    name: 'Hidden Holster',
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'EX', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '2d6',
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>A small body cavity for concealing a concealable weapon.</p>',
  }),
  cw({
    name: 'MidnightLady™', manufacturer: 'Midnight Lady',
    img: `systems/cyberpunk-blue/assets/items/cyberware/midnight-lady.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 14,
    psycheLoss: '',
    description: 'Vagina, vulva, and optional breasts. Maximizes pleasure for both the user and partners.',
  }),
  cw({
    name: 'Mr. Studd™', manufacturer: 'Mr Stud',
    img: `systems/cyberpunk-blue/assets/items/cyberware/mr-stud.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'PR', facilities: 'clinic', installationCost: 'PR', installationDv: 14,
    psycheLoss: '',
    description: 'Penis and scrotum. Optimal pleasure for both the user and partners.',
  }),
  cw({
    name: 'Skin-Weave',
    img: `systems/cyberpunk-blue/assets/items/cyberware/skin-weave.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    isArmor: true, maxSp: 7,
    cost: 'PR', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '2d6',
    description: 'SP 7 polymer skin reinforcement. Only counts if it is the highest SP source available. Ablates from damage; heals 1 SP per day of rest.',
  }),
  cw({
    name: 'Subdermal Armor',
    folder: 'External Cyberware', manufacturer: 'Dynalar',
    cyberwareType: 'external', integration: 'standalone',
    isArmor: true, maxSp: 11,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    img: `${CW_ASSET}/Dynalar subdermal armor.png`,
    description: 'SP 11 armor micro-plates under the skin. Only counts if it is the highest SP source available. Ablates from damage; heals 1 SP per day of rest.',
  }),
  cw({
    name: 'Subdermal Pocket',
    img: `systems/cyberpunk-blue/assets/items/cyberware/skin-pocket.png`,
    folder: 'External Cyberware',
    cyberwareType: 'external', integration: 'standalone',
    cost: 'CO', facilities: 'clinic', installationCost: 'PR', installationDv: 17,
    psycheLoss: '1d6',
    description: 'A 5×10cm storage space under the skin, sealed with a RealSkinn® zipper.',
  }),

  // ── Borgware ──────────────────────────────────────────────────────────────

  cw({
    name: 'Artificial Shoulder Mount',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone',
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 22,
    psycheLoss: '4d6',
    description: '<p>Up to 2 additional cyberarms can be mounted below the regular arms. <strong>BODY</strong> 10+ allows a second Artificial Shoulder Mount for a total of 6 arms.</p>',
  }),
  cw({
    name: 'Implanted Linear Frame Beta',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone',
    cost: 'LUX', facilities: 'hospital', installationCost: 'EX', installationDv: 22,
    psycheLoss: '4d6',
    description: '<p><strong>PREREQUISITE:</strong> <strong>BODY</strong> 8+, two Grafted Muscle & Bone Lace implants. <strong>BODY</strong> becomes 14 (cannot be further improved with IP).</p>',
    effects: [ae('BODY becomes 14', [statOvr('body', 14)])],
  }),
  cw({
    name: 'Implanted Linear Frame Sigma',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone',
    cost: 'VEX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p><strong>PREREQUISITE:</strong> <strong>BODY</strong> 6+, one Grafted Muscle & Bone Lace implant. <strong>BODY</strong> becomes 12 (cannot be further improved with IP).</p>',
    effects: [ae('BODY becomes 12', [statOvr('body', 12)])],
  }),
  cw({
    name: 'MultiOptic Mount', manufacturer: 'Kiroshi Opticals',
    img: `systems/cyberpunk-blue/assets/items/cyberware/MultiOptic-Mount.png`,
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone', slotsProvided: 5,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 20,
    psycheLoss: '4d6',
    description: '<p><strong>PREREQUISITE:</strong> 2 cybereyes already installed. Splits the optic nerves; up to 5 additional cybereye installations become possible.</p>',
  }),
  cw({
    name: 'Sensor Array',
    folder: 'Borgware',
    cyberwareType: 'borgware', integration: 'standalone', slotsProvided: 7,
    cost: 'EX', facilities: 'hospital', installationCost: 'EX', installationDv: 18,
    psycheLoss: '3d6',
    description: '<p><strong>PREREQUISITE:</strong> Cyberaudio Suite installed. Multiple antenna and sensor attachment points; provides <strong>+7</strong> additional cyberaudio slots.</p>',
  }),
];
