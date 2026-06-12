/**
 * Drug catalogue — all drugs from the Cyberpunk Blue source.
 *
 * Each entry is Foundry Item create-data ready for `Item.createDocuments`.
 * The `_folder` property is stripped before the item is written to the pack.
 *
 * AE design:
 *   - All AEs start disabled:true so they have no effect until activated.
 *   - transfer:true so the AE moves to the parent actor when the item is owned.
 *   - Usage AEs are enabled by an 'effect' instruction step and reverted when that
 *     step ends (drug wears off).
 *   - Addiction AEs are enabled by a permanent 'effect' step and never reverted.
 *
 * Instruction sequence structure (each drug may vary):
 *   Step 0 — effect (Usage AE) OR pause — PAUSE, labelled "[Wear off]"
 *   Step 1 — message — narrative text describing the drug's effect (auto-advance)
 *   Step 2 — check   — BODY + Endurance vs DV (auto-rolls; failIndex → step 4)
 *   Step 3 — message — success text, terminates=true → END
 *   Step 4 — message — failure text (auto-advance)
 *   Step 5 — effect (permanent, Addiction AE) OR pause — auto-advance → END
 *     [only for drugs with addiction or a second-phase pause]
 *   Step 6 — message — long-term effects text, terminates=true → END (addiction drugs)
 */

// ─── Constants ────────────────────────────────────────────────────────────────

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

/** ADD mode for ActiveEffect changes. */
const ADD = 2;

// ─── Effect helpers ───────────────────────────────────────────────────────────

/**
 * Build a disabled, transferable ActiveEffect with one or more stat/skill changes.
 * @param {string} name — must match the `effectName` used in instruction steps
 * @param {Array<{key:string, value:string|number}>} changes — each uses ADD mode
 */
function ae(name, changes, extraFlags = {}) {
  return {
    name,
    disabled: true,
    transfer: true,
    changes: changes.map(({ key, value }) => ({ key, mode: ADD, value: String(value) })),
    flags: { 'cyberpunk-blue': { noGearStateSync: true, ...extraFlags } },
  };
}

// Common AE change builders.
// Drugs are temporary, so they modify the roll channels (`stat.rollMod`,
// `skill.bonus`) rather than the base `.value`/`.rank` — that keeps the
// player-set stat/skill numbers intact and avoids corrupting derived values
// (e.g. HP from BODY) for the drug's duration.
const stat  = (slug, val) => ({ key: `system.stats.${slug}.rollMod`, value: val });
const skill = (slug, val) => ({ key: `system.skills.${slug}.bonus`,  value: val });

// ─── Step helpers ─────────────────────────────────────────────────────────────

/** Instruction step factories */
const S = {
  /** Pause with no AE (for drugs whose primary effect can't be AE-encoded). */
  pause(name = '') {
    return { name, type: 'pause' };
  },
  /** Enable/disable an AE by name; pauses unless permanent. */
  effect({ name = '', effectName, effectEnabled = true, permanent = false, terminates = false }) {
    return { name, type: 'effect', effectName, effectEnabled, permanent, terminates };
  },
  /** Post HTML content to chat; auto-advances. */
  message(content, { name = '', terminates = false, whisperGm = false } = {}) {
    return { name, type: 'message', message: content, terminates, whisperGm };
  },
  /** Roll BODY + Endurance vs DV; on failure jump to failIndex. */
  wearOffCheck(dv, failIndex = -1) {
    return {
      name:     'Wear-off Check',
      type:     'check',
      primary:  'body',
      skill:    'endurance',
      dv,
      progress: true,   // roll ≥ DV → success (advances)
      failIndex,
    };
  },
};

// ─── Drug factory ─────────────────────────────────────────────────────────────

/**
 * Build a full drug item create-data entry.
 *
 * @param {object} opts
 * @param {string}   opts.name
 * @param {string}   opts.cost        — COST key or raw string
 * @param {string}   opts.duration    — human-readable duration
 * @param {string}   opts.primary     — primaryEffect HTML
 * @param {number}   opts.secDv       — BODY+Endurance DV
 * @param {string}   opts.secondary   — secondaryEffect HTML
 * @param {string}   [opts.addiction] — addictionPenalty HTML
 * @param {string}   [opts.description]
 * @param {Array}    [opts.effects]   — ActiveEffect create-data
 * @param {Array}    [opts.instructions] — instruction step sequence
 */
function drug({ name, cost, duration, img = '', primary, secDv, secondary, addiction = '', description = '', effects = [], instructions = [] }) {
  return {
    // No _folder — Foundry creates a world folder named after the compendium on
    // import, so nesting items inside a subfolder would create unnecessary depth.
    name,
    type: 'drug',
    img,
    system: {
      manufacturer: '',
      cost:              COST[cost] ?? cost,
      duration,
      primaryEffect:     `<p>${primary}</p>`,
      secondaryDv:       secDv,
      secondaryEffect:   `<p>${secondary}</p>`,
      addictionPenalty:  addiction   ? `<p>${addiction}</p>`   : '',
      description:       description ? `<p>${description}</p>` : '',
      notes: '',
      quantity:          1,
      instructionReduceQuantity: true,
      instructionActive: false,
      instructionStep:   -1,
      instructions,
    },
    effects,
  };
}

// ─── Drug catalogue ───────────────────────────────────────────────────────────

export const DRUG_CATALOGUE = [

  // ── Antibiotics ─────────────────────────────────────────────────────────────
  // Has a clean AE (BODY −1 while active). No addiction.
  drug({
    name:        'Antibiotics', img: `systems/cyberpunk-blue/assets/items/drugs/antibiotics.png`,
    cost:        'CO',
    description: 'Sold in packs of 10 doses.',
    duration:    '24 hours',
    primary:     '−1 to BODY checks. If the secondary effect is avoided, gain +2 to natural healing for the day.',
    secDv:       10,
    secondary:   'Full day of nausea; no natural healing for the day.',
    effects: [
      // BODY −1 while active, and +2 to Natural Healing for the day (read by the
      // Natural Healing macro via the naturalHealingBonus flag).
      ae('Antibiotics - Usage', [stat('body', -1)], { naturalHealingBonus: 2 }),
    ],
    instructions: [
      // Step 0 — take the drug; enable BODY −1 AE; pause until drug wears off
      S.effect({ name: '[Wear off]', effectName: 'Antibiotics - Usage', effectEnabled: true }),
      // Step 1 — narrative (auto-advances)
      S.message('<p><strong>Antibiotics taken.</strong> BODY −1 while the drug is active. Effects last 24 hours.</p>'),
      // Step 2 — wear-off check; failure → step 4
      S.wearOffCheck(10, 4),
      // Step 3 — success; AE has already been reverted by advanceInstructions; end
      S.message('<p>Good recovery. No nausea today. You gain <strong>+2 to natural healing</strong> for the day.</p>', { terminates: true }),
      // Step 4 — failure
      S.message('<p>Full day of nausea. <strong>No natural healing</strong> today.</p>'),
    ],
  }),

  // ── Black Lace ──────────────────────────────────────────────────────────────
  // Complex primary (2d6 PSYCHE, crit immunity — handled narratively).
  // Addiction: RFLX −2 (permanent AE).
  drug({
    name:      'Black Lace',
    cost:      'CO',
    duration:  '24 hours',
    primary:   'Lose 2d6 PSYCHE temporarily (regained if secondary is avoided). Ignore Seriously Wounded, Broken Arm/Leg/Ribs/Jaw, and Torn Muscle/Foreign Object Critical Injury effects; each turn you benefit from this immunity costs 1d6 HP.',
    secDv:     17,
    secondary: 'PSYCHE loss becomes permanent. If not already addicted, you are now addicted.',
    addiction: 'RFLX −2 while addicted but not actively using.',
    effects: [
      ae('Black Lace - Addiction', [stat('rflx', -2)]),
    ],
    instructions: [
      // Step 0 — pause (no AE; GM tracks PSYCHE loss and crit immunity manually)
      S.pause('[Wear off]'),
      // Step 1 — narrative
      S.message('<p><strong>Black Lace taken.</strong> Lose 2d6 PSYCHE temporarily. While active, ignore Seriously Wounded and certain critical injury effects (1d6 HP per turn you benefit). Effects last 24 hours.</p>'),
      // Step 2 — wear-off check; failure → step 4
      S.wearOffCheck(17, 4),
      // Step 3 — success
      S.message('<p>PSYCHE loss restored. No addiction. No lasting effects.</p>', { terminates: true }),
      // Step 4 — failure: PSYCHE loss permanent + addiction
      S.message('<p>PSYCHE loss is now <strong>permanent</strong>. If not already addicted, you are now addicted.</p>'),
      // Step 5 — permanent addiction AE (RFLX −2); auto-advances → end
      S.effect({ name: 'Addiction', effectName: 'Black Lace - Addiction', effectEnabled: true, permanent: true, terminates: true }),
    ],
  }),

  // ── Blue Glass ──────────────────────────────────────────────────────────────
  // Complex primary (+1 PSYCHE once/week + hallucinations — handled narratively).
  // Addiction: narrative only (no clean AE — "hallucinations" can't be encoded).
  drug({
    name:      'Blue Glass', img: `systems/cyberpunk-blue/assets/items/drugs/blue-glass.png`,
    cost:      'EV',
    duration:  '4 hours',
    primary:   'Restore 1 temporary PSYCHE (this benefit can only be gained once per week). Frequent minor hallucinations and synesthesia occur throughout; you cannot take normal actions during these episodes.',
    secDv:     15,
    secondary: 'The restored PSYCHE is lost. If not already addicted, you are now addicted.',
    addiction: 'Debilitating hallucinations roughly once per hour while addicted but not actively using; these episodes prevent regular actions. The drug only suppresses these episodes.',
    instructions: [
      S.pause('[Wear off]'),
      S.message('<p><strong>Blue Glass taken.</strong> If this is your first dose this week, restore 1 temporary PSYCHE. Expect minor hallucinations and synesthesia throughout — you cannot act during these episodes. Effects last 4 hours.</p>'),
      S.wearOffCheck(15, 4),
      S.message('<p>Temporary PSYCHE retained. No addiction.</p>', { terminates: true }),
      S.message('<p>Temporary PSYCHE lost. If not already addicted, you are now addicted. Expect debilitating hallucinations roughly once per hour while not using.</p>'),
    ],
  }),

  // ── Boost ───────────────────────────────────────────────────────────────────
  // Clean AE: INT +2. Addiction AE: INT −2.
  drug({
    name:      'Boost', img: `systems/cyberpunk-blue/assets/items/drugs/boost.png`,
    cost:      'CO',
    duration:  '20 hours',
    primary:   'INT +2 (maximum of 8 total).',
    secDv:     17,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: 'INT −2 while addicted but not actively using.',
    effects: [
      ae('Boost - Usage',    [stat('int', +2)]),
      ae('Boost - Addiction',[stat('int', -2)]),
    ],
    instructions: [
      S.effect({ name: '[Wear off]', effectName: 'Boost - Usage', effectEnabled: true }),
      S.message('<p><strong>Boost taken.</strong> INT +2 (max 8 total). Effects last 20 hours.</p>'),
      S.wearOffCheck(17, 4),
      S.message('<p>No addiction. INT returns to normal.</p>', { terminates: true }),
      S.message('<p>If not already addicted, you are now addicted. INT −2 while not using.</p>'),
      S.effect({ name: 'Addiction', effectName: 'Boost - Addiction', effectEnabled: true, permanent: true, terminates: true }),
    ],
  }),

  // ── Immunoblockers ──────────────────────────────────────────────────────────
  // Complex primary (2d6 PSYCHE restore) and complex secondary (rescue window).
  // No addiction.
  drug({
    name:      'Immunoblockers',
    cost:      'PR',
    duration:  'Wears off at a stressful moment (likelihood increases over time); maximum 1 month.',
    primary:   'Immediately restore 2d6 PSYCHE. Characters in full cyberpsychosis may require multiple doses before any benefit is possible.',
    secDv:     21,
    secondary: 'The PSYCHE gained is lost. −2 to all checks for the next 1 minute (20 rounds). If the user does not take 2 doses (which can be a combined Action) within that 1-minute window, they lose 4d6 PSYCHE.',
    instructions: [
      S.pause('[Wear off]'),
      S.message('<p><strong>Immunoblockers taken.</strong> Restore 2d6 PSYCHE immediately. Effects wear off at a stressful moment (max 1 month).</p>'),
      S.wearOffCheck(21, 4),
      S.message('<p>No ill effects.</p>', { terminates: true }),
      S.message('<p>PSYCHE regained is lost. −2 to all checks for 1 minute (20 rounds). Two more doses must be taken within that window or the user loses 4d6 PSYCHE.</p>'),
    ],
  }),

  // ── PDGF Injection ──────────────────────────────────────────────────────────
  // Complex primary (1d6 HP restore). No addiction.
  drug({
    name:      'PDGF Injection', img: `systems/cyberpunk-blue/assets/items/drugs/pdgf-injection.png`,
    cost:      'CO',
    duration:  '4 hours',
    primary:   'Instantly regain 1d6 HP. Additional doses within 24 hours leave the user merely hungry, thirsty, and lightly anaemic.',
    secDv:     15,
    secondary: 'Tissues grow into each other abnormally. The user takes 1d6÷2 damage each time they move more than half their MOVE, Evade, use Athletics, or perform similar advanced movement. Fix: DV13 TECH+Medicine (Surgery) at a ripperdoc, or CO for the treatment.',
    instructions: [
      S.pause('[Wear off]'),
      S.message('<p><strong>PDGF Injection taken.</strong> Regain 1d6 HP immediately. Effects last 4 hours.</p>'),
      S.wearOffCheck(15, 4),
      S.message('<p>No ill effects.</p>', { terminates: true }),
      S.message('<p>Tissues grow abnormally. Take 1d6÷2 damage whenever you move more than half your MOVE, evade, use Athletics, or perform similar advanced movement. Fix: DV 13 TECH+Medicine (Surgery), or €$50 for treatment.</p>'),
    ],
  }),

  // ── RPM ─────────────────────────────────────────────────────────────────────
  // Complex primary (fatigue step). Addiction: narrative only.
  drug({
    name:      'RPM',
    cost:      'EV',
    duration:  '20 hours',
    primary:   'Reduce your current Fatigue level by one step (if merely Fatigued, you suffer no ill effects). If taken within the previous 24 hours, also lose 1d6÷2 PSYCHE (round down).',
    secDv:     13,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: 'Always at least Fatigued while addicted but not actively using.',
    instructions: [
      S.pause('[Wear off]'),
      S.message('<p><strong>RPM taken.</strong> Fatigue reduced by one step. If taken within the last 24 hours, also lose 1d6÷2 PSYCHE. Effects last 20 hours.</p>'),
      S.wearOffCheck(13, 4),
      S.message('<p>No addiction.</p>', { terminates: true }),
      S.message('<p>If not already addicted, you are now addicted. Always at least Fatigued while not using.</p>'),
    ],
  }),

  // ── Smash ───────────────────────────────────────────────────────────────────
  // Clean AE: +2 to 5 social skills. Addiction AE: −2 to those same skills.
  drug({
    name:      'Smash', img: `systems/cyberpunk-blue/assets/items/drugs/smash.png`,
    cost:      'CH',
    duration:  '4 hours',
    primary:   'Euphoria and confidence; +2 to Acting, Contortionist, Human Perception, Influence, and Performance.',
    secDv:     15,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: '−2 to Acting, Contortionist, Human Perception, Influence, and Performance while addicted but not using. Intense occasional cravings.',
    effects: [
      ae('Smash - Usage', [
        skill('acting',      +2),
        skill('contortionist', +2),
        skill('humanPerc',   +2),
        skill('influence',   +2),
        skill('performance', +2),
      ]),
      ae('Smash - Addiction', [
        skill('acting',      -2),
        skill('contortionist', -2),
        skill('humanPerc',   -2),
        skill('influence',   -2),
        skill('performance', -2),
      ]),
    ],
    instructions: [
      S.effect({ name: '[Wear off]', effectName: 'Smash - Usage', effectEnabled: true }),
      S.message('<p><strong>Smash taken.</strong> +2 to Acting, Contortionist, Human Perception, Influence, and Performance. Euphoria and confidence. Effects last 4 hours.</p>'),
      S.wearOffCheck(15, 4),
      S.message('<p>No addiction. Bonuses fade.</p>', { terminates: true }),
      S.message('<p>If not already addicted, you are now addicted. −2 to Acting, Contortionist, Human Perception, Influence, and Performance while not using.</p>'),
      S.effect({ name: 'Addiction', effectName: 'Smash - Addiction', effectEnabled: true, permanent: true, terminates: true }),
    ],
  }),

  // ── Speed ───────────────────────────────────────────────────────────────────
  // Complex primary (suppresses hunger/fatigue — narrative only). Addiction: narrative.
  drug({
    name:      'Speed',
    cost:      'EV',
    duration:  '8 hours',
    primary:   'No sense of hunger (the physical need persists). Fatigue penalties reduced by 1.',
    secDv:     15,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: '−2 on tasks requiring extended focus while addicted but not using.',
    instructions: [
      S.pause('[Wear off]'),
      S.message('<p><strong>Speed taken.</strong> No sense of hunger (physical need persists). Fatigue penalties reduced by 1. Effects last 8 hours.</p>'),
      S.wearOffCheck(15, 4),
      S.message('<p>No addiction.</p>', { terminates: true }),
      S.message('<p>If not already addicted, you are now addicted. −2 on tasks requiring extended focus while not using.</p>'),
    ],
  }),

  // ── Synthcoke ───────────────────────────────────────────────────────────────
  // Clean AE: RFLX +1. Addiction AE: RFLX −2.
  drug({
    name:      'Synthcoke', img: `systems/cyberpunk-blue/assets/items/drugs/synth-coke.png`,
    cost:      'EV',
    duration:  '4 hours',
    primary:   'RFLX +1. Constant sense of paranoia and being watched.',
    secDv:     15,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: 'RFLX −2 while addicted but not using. Intense, near-uncontrollable cravings.',
    effects: [
      ae('Synthcoke - Usage',    [stat('rflx', +1)]),
      ae('Synthcoke - Addiction',[stat('rflx', -2)]),
    ],
    instructions: [
      S.effect({ name: '[Wear off]', effectName: 'Synthcoke - Usage', effectEnabled: true }),
      S.message('<p><strong>Synthcoke taken.</strong> RFLX +1. Constant sense of paranoia and being watched. Effects last 4 hours.</p>'),
      S.wearOffCheck(15, 4),
      S.message('<p>No addiction. RFLX returns to normal.</p>', { terminates: true }),
      S.message('<p>If not already addicted, you are now addicted. RFLX −2 while not using.</p>'),
      S.effect({ name: 'Addiction', effectName: 'Synthcoke - Addiction', effectEnabled: true, permanent: true, terminates: true }),
    ],
  }),

];
