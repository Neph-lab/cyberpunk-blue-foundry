/**
 * Program catalogue — all Program Executable items from the Cyberpunk Blue source.
 *
 * Categories: attack | black-ice | defender | booster | daemon | quickhack | malware
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

const FOLDER = {
  'attack':    'Attack',
  'black-ice': 'Black ICE',
  'defender':  'Defender',
  'booster':   'Booster',
  'daemon':    'Daemon',
  'quickhack': 'Quickhack',
  'malware':   'Malware',
};

const h = (text) => /^\s*<(p|ul|ol|div|h\d|table)\b/i.test(text) ? text : `<p>${text}</p>`;

// Map the display category to the program's mechanical `programType` (which
// drives the NET Combat capability gating). 'attack' covers Anti-Personnel and
// Anti-Program; it defaults to anti-personnel and can be overridden per entry.
const CATEGORY_TYPE = {
  'attack':    'antipersonnel',
  'black-ice': 'blackice',
  'defender':  'defender',
  'booster':   'booster',
  'daemon':    'daemon',
  'quickhack': 'quickhack',
  'malware':   'malware',
};
const ATTACKER_TYPES = ['antipersonnel', 'antiprogram', 'ice', 'blackice', 'daemon'];

/** Build a partial netCombat block; missing fields fall back to schema initials. */
export function progNetCombat(programType, damageFormula) {
  if (ATTACKER_TYPES.includes(programType) && (damageFormula ?? '').trim()) {
    return { attack: { mode: 'attack', damage: { enabled: true, formula: damageFormula.trim() } } };
  }
  return null;
}

function prog({ name, cost, category, img = '', act = 0, atk = 0, def = 0, net = 0, per = 0, rez = 0, ram = 0, damageFormula = '', programType, description, netCombat: netCombatOverride = null, effects = null }) {
  const type = programType ?? CATEGORY_TYPE[category] ?? 'antipersonnel';
  // An explicit `netCombat` block (for programs with riders/defense/boosts beyond
  // a plain damage formula) takes precedence; otherwise auto-generate the simple
  // damage-only config from `damageFormula`.
  const netCombat = netCombatOverride ?? progNetCombat(type, damageFormula);
  const system = {
    manufacturer: '',
    cost: COST[cost] ?? cost,
    note: '',
    category,
    programType: type,
    act,
    atk,
    def,
    net,
    per,
    rez: { value: rez, max: rez },
    ram,
    running: false,
    installedOnId: null,
    damageFormula,
    description: h(description),
    notes: '',
  };
  if (netCombat) system.netCombat = netCombat;
  const data = {
    _folder: FOLDER[category] ?? category,
    name,
    type: 'programExecutable',
    img,
    system,
  };
  if (effects) data.effects = effects;
  return data;
}

export const PROGRAM_CATALOGUE = [

  // ── Attack Programs ───────────────────────────────────────────────────────
  // Used by a Netrunner to attack enemy systems or runners.
  // Deactivate after use unless noted.

  prog({
    name: 'Deckkrash',
    img: `systems/cyberpunk-blue/assets/items/programs/DeckKRASH.png`,
    cost: 'PR', category: 'attack',
    atk: 0, def: 10, rez: 5,
    netCombat: { attack: { mode: 'attack', forceDisconnect: { enabled: true } } },
    description: 'Attack a netrunner with a connected cyberdeck. Deals no damage; instead unsafely disconnects the target.',
  }),
  prog({
    name: 'Hellbolt',
    img: `systems/cyberpunk-blue/assets/items/programs/hellbolt.png`,
    cost: 'PR', category: 'attack',
    atk: 1, def: 14, rez: 5, damageFormula: '2d6',
    netCombat: { attack: {
      mode: 'attack',
      damage: { enabled: true, formula: '2d6' },
      applyCondition: { enabled: true, conditionId: 'burning-embers' },
      netActionPenalty: { enabled: true, amount: 1, floor: 0, duration: 'nextTurn' },
    } },
    description: '<p>Attack a netrunner. Deals <strong>2d6</strong> HP directly; a non-insulated cyberdeck starts a small fire. Target has 1 fewer NET action (non-cumulative) on their next turn.</p>',
  }),
  prog({
    name: 'Nervescrub',
    img: `systems/cyberpunk-blue/assets/items/programs/nervescrub.png`,
    cost: 'EX', category: 'attack',
    atk: 0, def: 10, rez: 5,
    netCombat: { attack: {
      mode: 'attack',
      statPenalty: { enabled: true, stats: ['rflx', 'int'], formula: '1d6', floor: 1, durationLabel: '1 hour' },
    } },
    description: '<p>Attack a netrunner. No damage. Target\'s <strong>RFLX</strong> and <strong>INT</strong> are each reduced by <strong>1d6</strong> (minimum 1) for 1 hour. Effect is non-stacking and psychosomatic.</p>',
  }),
  prog({
    name: 'Poison Flatline',
    img: `systems/cyberpunk-blue/assets/items/programs/poison-flatline.png`,
    cost: 'EX', category: 'attack',
    atk: 0, def: 12, rez: 10,
    netCombat: { attack: {
      mode: 'attack',
      programStrike: { enabled: true, action: 'delete', count: 1, filter: 'any' },
    } },
    description: 'Attack a netrunner. No damage. Deletes one random program from the target\'s cyberdeck.',
  }),
  prog({
    name: 'Speed-Slice',
    img: `systems/cyberpunk-blue/assets/items/programs/speed-slice.png`,
    cost: 'PR', category: 'attack', programType: 'antiprogram',
    act: 1, atk: 2, def: 10, rez: 5, damageFormula: '2d6',
    description: '<p>Attack a program (as own action or as a NET action). Deals <strong>2d6</strong> damage. ACT 1. A single target can only be attacked once per turn per copy of this program.</p>',
  }),
  prog({
    name: 'Superglue',
    img: `systems/cyberpunk-blue/assets/items/programs/superglue.png`,
    cost: 'PR', category: 'attack',
    atk: 2, def: 14, rez: 10,
    netCombat: { attack: {
      mode: 'attack',
      nodeLock: { enabled: true, turns: '1d6', duration: 'turns' },
    } },
    description: '<p>Attack a netrunner. No damage. For <strong>1d6</strong> turns, or until closed, the target cannot move between nodes or safely disconnect. Must be closed and re-run to use again.</p>',
  }),
  prog({
    name: 'Sword',
    img: `systems/cyberpunk-blue/assets/items/programs/Sword-program.png`,
    cost: 'CO', category: 'attack', programType: 'antiprogram',
    atk: 2, def: 10, rez: 5, damageFormula: '2d6',
    netCombat: { attack: { mode: 'attack', damage: { enabled: true, formula: '2d6', bonusFormula: '1d6', vsType: 'blackice' } } },
    description: '<p>Attack a program. Deals <strong>2d6</strong> damage (<strong>+1d6</strong> extra against Black ICE).</p>',
  }),
  prog({
    name: 'Vrizzbolt',
    cost: 'CO', category: 'attack',
    atk: 2, def: 10, rez: 5, damageFormula: '1d6',
    netCombat: { attack: {
      mode: 'attack',
      damage: { enabled: true, formula: '1d6' },
      netActionPenalty: { enabled: true, amount: 1, floor: 2, duration: 'nextTurn' },
    } },
    description: '<p>Attack a netrunner. Deals <strong>1d6</strong> HP directly to the brain. Target\'s NET actions on their next turn are reduced by 1 (minimum 2).</p>',
  }),

  // ── Black ICE ─────────────────────────────────────────────────────────────
  // Protect the system they are on; can harm intruding netrunners.
  // ACT 1 each unless noted.

  prog({
    name: 'Asp',
    img: `systems/cyberpunk-blue/assets/items/programs/asp.png`,
    cost: 'PR', category: 'black-ice',
    act: 1, atk: 7, def: 17, net: 0, per: 12, rez: 15,
    damageFormula: '',   // no HP damage (destroys a program instead)
    netCombat: { attack: {
      mode: 'attack',
      programStrike: { enabled: true, action: 'delete', count: 1, filter: 'any' },
    } },
    description: 'Destroys a single program installed on the enemy\'s system.',
  }),
  prog({
    name: 'Dragon',
    img: `systems/cyberpunk-blue/assets/items/programs/dragon.png`,
    cost: 'VEX', category: 'black-ice',
    act: 1, atk: 11, def: 21, net: 2, per: 15, rez: 30,
    damageFormula: '6d6',
    netCombat: { attack: { mode: 'attack', damage: { enabled: true, formula: '6d6' }, deleteOnKill: true } },
    description: '<p>Deals <strong>6d6</strong> damage to a program. If the program\'s REZ reaches 0, the program is deleted rather than merely derezzed.</p>',
  }),
  prog({
    name: 'Giant',
    img: `systems/cyberpunk-blue/assets/items/programs/giant.png`,
    cost: 'VEX', category: 'black-ice',
    act: 1, atk: 13, def: 19, net: 2, per: 14, rez: 25,
    damageFormula: '3d6',
    netCombat: { attack: { mode: 'attack', damage: { enabled: true, formula: '3d6' }, forceDisconnect: { enabled: true, oncePerSource: true } } },
    description: '<p>Deals <strong>3d6</strong> HP directly to a netrunner and unsafely disconnects them. This disconnect effect can only happen once per Giant.</p>',
  }),
  prog({
    name: 'Hellhound',
    img: `systems/cyberpunk-blue/assets/items/programs/hellhound.png`,
    cost: 'EX', category: 'black-ice',
    act: 1, atk: 11, def: 17, net: 1, per: 15, rez: 20,
    damageFormula: '3d6',
    netCombat: { attack: {
      mode: 'attack',
      damage: { enabled: true, formula: '3d6' },
      applyCondition: { enabled: true, conditionId: 'burning-embers' },
    } },
    description: '<p>Deals <strong>3d6</strong> HP directly to a netrunner. The runner\'s non-insulated cyberdeck and clothes catch Fire (Mild).</p>',
  }),
  prog({
    name: 'Killer',
    img: `systems/cyberpunk-blue/assets/items/programs/killer.png`,
    cost: 'EX', category: 'black-ice',
    act: 1, atk: 11, def: 17, net: 1, per: 12, rez: 20,
    damageFormula: '4d6',
    netCombat: { attack: { mode: 'attack', damage: { enabled: true, formula: '4d6' }, deleteOnKill: true } },
    description: '<p>Deals <strong>4d6</strong> damage to a program. If the program\'s REZ reaches 0, it is deleted rather than merely derezzed.</p>',
  }),
  prog({
    name: 'Kraken',
    img: `systems/cyberpunk-blue/assets/items/programs/kraken.png`,
    cost: 'VEX', category: 'black-ice',
    act: 1, atk: 13, def: 19, net: 2, per: 14, rez: 30,
    damageFormula: '4d6',
    netCombat: { attack: {
      mode: 'attack',
      damage: { enabled: true, formula: '4d6' },
      nodeLock: { enabled: true, duration: 'endNextTurn' },
    } },
    description: '<p>Deals <strong>4d6</strong> HP directly to a netrunner. Until the end of their next turn, the target cannot connect to a different node or safely disconnect.</p>',
  }),
  prog({
    name: 'Liche',
    img: `systems/cyberpunk-blue/assets/items/programs/lich.png`,
    cost: 'EX', category: 'black-ice',
    act: 1, atk: 11, def: 17, net: 1, per: 13, rez: 25,
    damageFormula: '',   // no HP damage (stat reduction only)
    netCombat: { attack: {
      mode: 'attack',
      statPenalty: { enabled: true, stats: ['rflx', 'tech', 'int'], formula: '1d6', floor: 1, durationLabel: '1 hour' },
    } },
    description: '<p>Target netrunner\'s <strong>RFLX</strong>, <strong>TECH</strong>, and <strong>INT</strong> are each reduced by <strong>1d6</strong> (minimum 1) for 1 hour. Effect is non-stacking and psychosomatic.</p>',
  }),
  prog({
    name: 'Raven',
    img: `systems/cyberpunk-blue/assets/items/programs/raven.png`,
    cost: 'CO', category: 'black-ice',
    act: 1, atk: 9, def: 17, net: 0, per: 14, rez: 15,
    damageFormula: '1d6',
    netCombat: { attack: {
      mode: 'attack',
      damage: { enabled: true, formula: '1d6' },
      programStrike: { enabled: true, action: 'derez', count: 1, filter: 'defender' },
    } },
    description: '<p>Derezzes a random Defender program from a target netrunner, then deals <strong>1d6</strong> HP directly.</p>',
  }),
  prog({
    name: 'Sabertooth',
    img: `systems/cyberpunk-blue/assets/items/programs/sabretooth.png`,
    cost: 'EX', category: 'black-ice',
    act: 1, atk: 12, def: 17, net: 3, per: 10, rez: 25,
    damageFormula: '6d6',
    description: '<p>Deals <strong>6d6</strong> damage to a program.</p>',
  }),
  prog({
    name: 'Scorpion',
    img: `systems/cyberpunk-blue/assets/items/programs/scorpion.png`,
    cost: 'PR', category: 'black-ice',
    act: 1, atk: 8, def: 17, net: 0, per: 8, rez: 15,
    damageFormula: '',   // no HP damage (MOVE reduction only)
    netCombat: { attack: {
      mode: 'attack',
      statPenalty: { enabled: true, stats: ['move'], formula: '1d6', floor: 1, durationLabel: '1 hour' },
    } },
    description: '<p>Target netrunner\'s <strong>MOVE</strong> is reduced by <strong>1d6</strong> (minimum 1) for 1 hour. Effect is non-stacking and psychosomatic.</p>',
  }),
  prog({
    name: 'Skunk',
    img: `systems/cyberpunk-blue/assets/items/programs/skunk.png`,
    cost: 'PR', category: 'black-ice',
    act: 1, atk: 5, def: 17, net: 1, per: 10, rez: 10,
    damageFormula: '',   // no HP damage (penalty aura only)
    netCombat: { aura: { enabled: true, target: 'enemiesDetected', effectId: 'skunkAuraSlideC0' } },
    effects: [{
      _id: 'skunkAuraSlideC0',
      name: 'Skunk: Slide & Cloak −2',
      icon: 'icons/svg/daze.svg',
      disabled: true,
      transfer: false,
      changes: [
        { key: 'system.components.cloak.bonus', mode: 2, value: '-2' },
        { key: 'system.components.slide.bonus', mode: 2, value: '-2' },
      ],
      flags: { 'cyberpunk-blue': {} },
    }],
    description: '<p><strong>WHILE REZZED:</strong> any detected target runner makes all Slide and Cloak checks at <strong>−2</strong>. Follows one runner; penalties from multiple Skunks stack.</p>',
  }),
  prog({
    name: 'Wisp',
    img: `systems/cyberpunk-blue/assets/items/programs/wisp.png`,
    cost: 'CO', category: 'black-ice',
    act: 1, atk: 9, def: 19, net: 0, per: 9, rez: 15,
    damageFormula: '1d6',
    netCombat: { attack: {
      mode: 'attack',
      damage: { enabled: true, formula: '1d6' },
      netActionPenalty: { enabled: true, amount: 1, floor: 2, duration: 'untilDisconnect' },
    } },
    description: '<p>Deals <strong>1d6</strong> HP directly to a target netrunner. Reduces their NET actions by 1 (minimum 2) until they disconnect.</p>',
  }),

  // ── Defender Programs ─────────────────────────────────────────────────────

  prog({
    name: 'Armor',
    img: `systems/cyberpunk-blue/assets/items/programs/Armor-program.png`,
    cost: 'CO', category: 'defender',
    def: 12, rez: 5,
    netCombat: { defense: { mode: 'personnel', ablate: true } },
    description: 'Damage dealt to the netrunner from an attack is lowered by Armor\'s current REZ. If the netrunner still takes damage, Armor loses 1 REZ. Only one copy protects against any single attack.',
  }),
  prog({
    name: 'Flack',
    img: `systems/cyberpunk-blue/assets/items/programs/flak.png`,
    cost: 'PR', category: 'defender',
    def: 10, rez: 7,
    netCombat: { aura: { enabled: true, target: 'self', effectId: 'flackHalveIceAtk' } },
    effects: [{
      _id: 'flackHalveIceAtk',
      name: 'Flack: ICE ATK halved',
      icon: 'icons/svg/shield.svg',
      disabled: true,
      transfer: false,
      changes: [],
      flags: { 'cyberpunk-blue': { netHalveIceAtk: true } },
    }],
    description: 'Halves the ATK of all ICE against the user while Flack is rezzed. Only one copy can run on any given Architecture at a time.',
  }),
  prog({
    name: 'Restore',
    cost: 'PR', category: 'defender',
    def: 14, rez: 7,
    netCombat: { defense: { mode: 'program', restore: { enabled: true, dv: 7 } } },
    description: '<p>When a program in the same node as Restore would be maliciously deleted: roll <strong>1d10</strong> and reduce Restore to 0 REZ. On a result of 7 or higher, the program is closed instead of deleted.</p>',
  }),
  prog({
    name: 'Shield',
    img: `systems/cyberpunk-blue/assets/items/programs/shield.png`,
    cost: 'CO', category: 'defender',
    def: 10, rez: 7,
    netCombat: { defense: { mode: 'personnel', intercept: { enabled: true, exceptBlackIce: true } } },
    description: '<p>Intercepts the first non-Black ICE effect that would deal damage to the <strong>Netrunner</strong> or one of their programs, taking the damage instead. Deactivates if REZ > 0 after absorbing an effect.</p>',
  }),

  // ── Booster Programs ──────────────────────────────────────────────────────
  // Each provides +2 to a specific NET action type until the start of your
  // next turn. Only one copy of each may benefit you at a time. ACT 1.

  prog({
    name: 'Eraser',
    img: `systems/cyberpunk-blue/assets/items/programs/eraser.png`,
    cost: 'EV', category: 'booster',
    act: 1, def: 12, rez: 7,
    netCombat: { booster: { boosts: [{ component: 'ghost', use: 'cloak', value: 2, nonStacking: true }] } },
    description: '<p><strong>+2</strong> to Cloak checks until the start of your next turn. Only one copy may benefit you at a time.</p>',
  }),
  prog({
    name: 'See-Ya',
    img: `systems/cyberpunk-blue/assets/items/programs/see-ya.png`,
    cost: 'EV', category: 'booster',
    act: 1, def: 12, rez: 7,
    netCombat: { booster: { boosts: [{ component: 'spider', use: 'pathfinder', value: 2, nonStacking: true }] } },
    description: '<p><strong>+2</strong> to Pathfinder checks until the start of your next turn. Only one copy may benefit you at a time.</p>',
  }),
  prog({
    name: 'Worm',
    img: `systems/cyberpunk-blue/assets/items/programs/worm.png`,
    cost: 'CO', category: 'booster',
    act: 1, def: 12, rez: 7,
    netCombat: { booster: { boosts: [{ component: 'codebreak', use: 'breach', value: 2, nonStacking: true }] } },
    description: '<p><strong>+2</strong> to Breach checks until the start of your next turn. Only one copy may benefit you at a time.</p>',
  }),

  // ── Daemons ───────────────────────────────────────────────────────────────
  // Control programs for automated systems (turrets, doors, etc.).
  // Logic follows simple rules defined at install time.

  prog({
    name: 'Gremlin',
    img: `systems/cyberpunk-blue/assets/items/programs/gremin.png`,
    cost: 'EX', category: 'daemon',
    act: 2, atk: 10, def: 15, net: 2, per: 13, rez: 15,
    description: 'A control program for automated systems (turrets, doors, etc.). Logic follows simple if/then rules defined when installed.',
  }),
  prog({
    name: 'Imp',
    img: `systems/cyberpunk-blue/assets/items/programs/imp.png`,
    cost: 'VEX', category: 'daemon',
    act: 3, atk: 13, def: 18, net: 3, per: 15, rez: 20,
    description: 'A control program for automated systems (turrets, doors, etc.). Logic follows simple if/then rules defined when installed.',
  }),
  prog({
    name: 'Efreet',
    img: `systems/cyberpunk-blue/assets/items/programs/efreet.png`,
    cost: 'LUX', category: 'daemon',
    act: 4, atk: 14, def: 19, net: 4, per: 16, rez: 25,
    description: 'A control program for automated systems (turrets, doors, etc.). Logic follows simple if/then rules defined when installed.',
  }),
  prog({
    name: 'Balron',
    img: `systems/cyberpunk-blue/assets/items/programs/balron.png`,
    cost: 'SLX', category: 'daemon',
    act: 5, atk: 15, def: 20, net: 7, per: 18, rez: 30,
    description: 'A control program for automated systems (turrets, doors, etc.). Logic follows simple if/then rules defined when installed.',
  }),

  // ── Quickhacks ────────────────────────────────────────────────────────────
  // Uploaded to a target's neuroport to hack or disable their cyberware.
  // RAM = cyberdeck RAM consumed on upload.
  // Duration: 30 rounds − 1 per rank in TECH and Endurance the target has.

  prog({
    name: 'Cyberware Malfunction',
    cost: 'EX', category: 'quickhack',
    ram: 3, atk: 2, def: 14, rez: 20,
    description: 'Disable one selected piece of cyberware (not the neuroport, COS, or neuroport cyberdeck port). Cyberlimbs become inoperable as a Broken limb Critical Injury; subsystems (e.g. weapons in a cyberarm) also fail.',
  }),
  prog({
    name: 'Impair Movement',
    cost: 'EV', category: 'quickhack',
    ram: 1, atk: 6, def: 12, rez: 20,
    description: '<p><strong>MOVE</strong> <strong>−1</strong>. At 0 <strong>MOVE</strong>, the target cannot take a Move Action.</p>',
  }),
  prog({
    name: 'Lure',
    cost: 'EX', category: 'quickhack',
    ram: 3, atk: 2, def: 14, rez: 20,
    description: '<p>If the target knows they are being hacked, they may defend with <strong>TECH</strong>+<strong>Human Perception</strong>; otherwise it succeeds automatically. On their next turn, the <strong>Netrunner</strong> decides the target\'s Move (full Move if the target was unaware; the target cannot be Lured into obvious danger).</p>',
  }),
  prog({
    name: 'Overheat',
    cost: 'PR', category: 'quickhack',
    ram: 2, atk: 4, def: 13, rez: 20,
    description: 'Target ignites and takes 4 HP direct damage (bypasses and does not ablate armor) at the end of their turns for 1 minute (20 turns) or until the fire is extinguished as an Action.',
  }),
  prog({
    name: 'Puppet',
    cost: 'VEX', category: 'quickhack',
    ram: 4, atk: 0, def: 15, rez: 20,
    description: 'Control the target\'s Action and Move on their next turn, using the target\'s own stats.',
  }),
  prog({
    name: 'Shard Ejection',
    cost: 'EX', category: 'quickhack',
    ram: 4, atk: 0, def: 15, rez: 20,
    description: '<p>Forcibly uninstalls and ejects one slotted shard (<strong>Netrunner</strong>\'s choice, including chipware) into an adjacent space. A cover plate over the socket prevents ejection.</p>',
  }),
  prog({
    name: 'Short Circuit',
    cost: 'PR', category: 'quickhack',
    ram: 2, atk: 4, def: 13, rez: 20,
    description: 'GM selects 3 non-foundational cyberware pieces; all 3 are disabled for the duration.',
  }),
  prog({
    name: 'Slow',
    cost: 'EX', category: 'quickhack',
    ram: 3, atk: 2, def: 14, rez: 20,
    description: '<p><strong>MOVE</strong> <strong>−1d6</strong> (<strong>−2d6</strong> if the target has only cyberlegs). At 0 <strong>MOVE</strong>, the target cannot take a Move Action.</p>',
  }),
  prog({
    name: 'Sonic Shock',
    cost: 'CO', category: 'quickhack',
    ram: 1, atk: 6, def: 12, rez: 20,
    description: 'Target suffers a Damaged Ear Critical Injury (no bonus damage) for the duration.',
  }),
  prog({
    name: 'Synapse Burnout',
    cost: 'VEX', category: 'quickhack',
    ram: 3, atk: 2, def: 14, rez: 20,
    description: '<p>Deals <strong>3d6</strong> damage directly to the target\'s brain, ignoring and not ablating armor.</p>',
  }),
  prog({
    name: 'System Reset',
    cost: 'VEX', category: 'quickhack',
    ram: 4, atk: 0, def: 15, rez: 20,
    description: 'Target collapses unconscious for the duration, until they take damage, or until someone wakes them up.',
  }),

  // ── Malware ───────────────────────────────────────────────────────────────
  // Black ICE capabilities combined with precise programmed instructions.
  // All Malware is illegal without a permit (‡).

  prog({
    name: 'Corrupt',
    cost: 'PR', category: 'malware',
    act: 1, atk: 1, def: 10, net: 2, per: 3, rez: 15,
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Provided an encryption key before upload. Spreads randomly, giving all data it finds <strong style="color: var(--cpb-accent);">DV13</strong> encryption.</p>',
  }),
  prog({
    name: 'Download',
    cost: 'EX', category: 'malware',
    act: 1, atk: 2, def: 10, net: 1, per: 7, rez: 15,
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Searches for a named file (or any file if none specified) and sends it to a designated NET address.</p>',
  }),
  prog({
    name: 'Mapper',
    cost: 'PR', category: 'malware',
    act: 1, atk: 1, def: 14, net: 4, per: 5, rez: 10,
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Slides into every node it enters and runs Pathfinding; attempts to Breach any Passwalls it finds. Sends a complete Architecture map to a specified NET address.</p>',
  }),
  prog({
    name: 'WireTap',
    cost: 'PR', category: 'malware',
    act: 1, atk: 3, def: 10, net: 2, per: 10, rez: 10,
    description: '<p style="color: var(--cpb-error);"><strong>Illegal without a permit.</strong></p><p>Alternates between Sliding into nodes and Cloaking. The number of nodes to reach and Passwalls to Breach are set beforehand. Logs all activity and sends reports to a given NET address.</p>',
  }),
];
