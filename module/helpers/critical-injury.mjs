/**
 * Critical Injury system for Cyberpunk Blue.
 *
 * Trigger condition: at least 2 damage dice show 6, AND at least 1 point of the
 * original roll (before the +5 bonus) would penetrate the target's SP.
 * Halved damage (outer AoE zone, successful evasion) suppresses the trigger.
 *
 * On trigger: damage +5, then roll 2d6 on the appropriate table and apply the
 * resulting Active Effect to the target actor.
 *
 * Table selection: if the attacker was targeting vitals the Head table is used;
 * cone / explosion / autofire attacks always use the Body table.
 *
 * Foundry RollTables: the two tables are shipped as a compendium pack and
 * auto-created in the pack the first time a GM loads the world.  The rolling
 * code looks for them in the world first (in case the GM imported them), then
 * in the compendium, and falls back to a pure-JS roll if neither is found.
 */

export const CRITICAL_INJURY_FLAG = 'criticalInjury';

export const CRITICAL_BODY_TABLE_NAME = 'Critical Body Injuries';
export const CRITICAL_HEAD_TABLE_NAME = 'Critical Head Injuries';

// ─── AE change helpers ────────────────────────────────────────────────────────

/** Modify a primary stat's roll modifier (affects checks using that stat). */
const add = (stat, val) => ({ key: `system.stats.${stat}.rollMod`, type: 'add', value: String(val) });

/** Modify MOVE directly (displayed value; minimum enforced by game rules). */
const addMove = (val) => ({ key: 'system.stats.move.value', type: 'add', value: String(val) });

/** Modify Death Save bonus (Death Save = BODY + bonus; minimum 1 per rules). */
const addDeathSave = (val) => ({ key: 'system.resources.deathSave.bonus', type: 'add', value: String(val) });

/** Modify a single skill rank. */
const addSkill = (skill, val) => ({ key: `system.skills.${skill}.rank`, type: 'add', value: String(val) });

/** Apply a modifier to every primary stat (all checks). */
const addAll = (val) => ['body', 'rflx', 'int', 'tech', 'cool'].map((s) => add(s, val));

// ─── Body Critical Injury Table (2d6) ────────────────────────────────────────
//
// Entry metadata:
//   key           - unique stable identifier used in AE flags and macro lookup
//   nameKey       - i18n key for the injury name
//   descKey       - i18n key for the flavour description
//   mortal        - true → Mortal Wound note in chat card
//   changes       - Foundry AE changes array (applied immediately)
//   lateralize    - 'arm'|'hand'|'leg'|'eye'|'ear' → randomise L/R side
//   noQuickFix    - true → quick fix not possible for this injury
//   quickFixDv    - DV for the Medicine quick-fix check (null if noQuickFix)
//   treatmentDv   - DV for the standard Medicine treatment check
//   surgeryRequired - true → treatment requires Medtech role + Surgery specialisation
//   surgeryDv     - DV when treating with Surgery (lower DV option; null if not applicable)
//   deathSavePenalty - true → -1 to Death Save stat (encoded in changes via addDeathSave)

export const CRITICAL_INJURY_TABLE = {
  2: {
    key: 'dismembered-arm',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedArm',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedArmDesc',
    mortal: true,
    changes: [addDeathSave(-1)],
    lateralize: 'arm',
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
  3: {
    key: 'dismembered-hand',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedHand',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedHandDesc',
    mortal: true,
    changes: [addDeathSave(-1)],
    lateralize: 'hand',
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
  4: {
    key: 'collapsed-lung',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.CollapsedLung',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.CollapsedLungDesc',
    mortal: true,
    changes: [addMove(-2), addDeathSave(-1)],
    lateralize: null,
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
  5: {
    key: 'broken-ribs',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenRibs',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenRibsDesc',
    mortal: false,
    changes: [],
    lateralize: null,
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 18,
    surgeryRequired: false,
    surgeryDv: 15,
  },
  6: {
    key: 'broken-arm',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenArm',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenArmDesc',
    mortal: false,
    changes: [],
    lateralize: 'arm',
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 18,
    surgeryRequired: false,
    surgeryDv: 15,
  },
  7: {
    key: 'foreign-object',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.ForeignObject',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.ForeignObjectDesc',
    mortal: false,
    changes: [],
    lateralize: null,
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 14,
    surgeryRequired: false,
    surgeryDv: null,
  },
  8: {
    key: 'broken-leg',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenLeg',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenLegDesc',
    mortal: false,
    changes: [addMove(-2)],
    lateralize: 'leg',
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 18,
    surgeryRequired: false,
    surgeryDv: 15,
  },
  9: {
    key: 'torn-muscle',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.TornMuscle',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.TornMuscleDesc',
    mortal: false,
    changes: [addSkill('athletics', -2), addSkill('martialArts', -2), addSkill('meleeWeapons', -2)],
    lateralize: null,
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 13,
    surgeryRequired: false,
    surgeryDv: null,
  },
  10: {
    key: 'spinal-injury',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.SpinalInjury',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.SpinalInjuryDesc',
    mortal: false,
    changes: [addDeathSave(-1)],
    lateralize: null,
    noQuickFix: false,
    quickFixDv: 17,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
  11: {
    key: 'crushed-fingers',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.CrushedFingers',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.CrushedFingersDesc',
    mortal: false,
    changes: [],
    lateralize: 'hand',
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 15,
    surgeryRequired: true,
    surgeryDv: null,
  },
  12: {
    key: 'dismembered-leg',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedLeg',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedLegDesc',
    mortal: true,
    changes: [addMove(-6), addDeathSave(-1)],
    lateralize: 'leg',
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
    evasionPrompt: true,
  },
};

// ─── Head Critical Injury Table (2d6) ────────────────────────────────────────

export const CRITICAL_HEAD_INJURY_TABLE = {
  2: {
    key: 'lost-eye',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.LostEye',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.LostEyeDesc',
    mortal: false,
    changes: [add('rflx', -4), addDeathSave(-1)],
    lateralize: 'eye',
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
  3: {
    key: 'brain-injury',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.BrainInjury',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.BrainInjuryDesc',
    mortal: false,
    changes: [...addAll(-2), addDeathSave(-1)],
    lateralize: null,
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
  4: {
    key: 'damaged-eye',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEye',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEyeDesc',
    mortal: false,
    changes: [add('rflx', -2)],
    lateralize: 'eye',
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 15,
    surgeryRequired: true,
    surgeryDv: null,
  },
  5: {
    key: 'concussion',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.Concussion',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.ConcussionDesc',
    mortal: false,
    changes: addAll(-2),
    lateralize: null,
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 13,
    surgeryRequired: false,
    surgeryDv: null,
  },
  6: {
    key: 'broken-jaw',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.BrokenJaw',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.BrokenJawDesc',
    mortal: false,
    changes: [],
    lateralize: null,
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 18,
    surgeryRequired: false,
    surgeryDv: 15,
  },
  7: {
    key: 'foreign-object-head',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.ForeignObject',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.ForeignObjectDesc',
    mortal: false,
    changes: [],
    lateralize: null,
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 13,
    surgeryRequired: false,
    surgeryDv: null,
  },
  8: {
    key: 'whiplash',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.Whiplash',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.WhiplashDesc',
    mortal: false,
    changes: [add('rflx', -1), addDeathSave(-1)],
    lateralize: null,
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 15,
    surgeryRequired: false,
    surgeryDv: 13,
  },
  9: {
    key: 'cracked-skull',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.CrackedSkull',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.CrackedSkullDesc',
    mortal: true,
    changes: [addDeathSave(-1)],
    lateralize: null,
    noQuickFix: false,
    quickFixDv: 17,
    treatmentDv: 18,
    surgeryRequired: false,
    surgeryDv: 15,
  },
  10: {
    key: 'damaged-ear',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEar',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEarDesc',
    mortal: false,
    changes: [],
    lateralize: 'ear',
    noQuickFix: false,
    quickFixDv: 15,
    treatmentDv: 15,
    surgeryRequired: true,
    surgeryDv: null,
  },
  11: {
    key: 'crushed-windpipe',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.CrushedWindpipe',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.CrushedWindpipeDesc',
    mortal: true,
    changes: [addDeathSave(-1)],
    lateralize: null,
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 15,
    surgeryRequired: true,
    surgeryDv: null,
  },
  12: {
    key: 'lost-ear',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.LostEar',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.LostEarDesc',
    mortal: false,
    changes: [addDeathSave(-1)],
    lateralize: 'ear',
    noQuickFix: true,
    quickFixDv: null,
    treatmentDv: 17,
    surgeryRequired: true,
    surgeryDv: null,
  },
};

// ─── Lateralization ───────────────────────────────────────────────────────────

/**
 * Body-part keyword lists used to find matching installed cyberware.
 */
const PART_KEYWORDS = {
  arm:  ['arm', 'limb'],
  hand: ['hand', 'claw', 'grip', 'finger'],
  leg:  ['leg', 'foot'],
  eye:  ['eye', 'optical', 'cybereye'],
  ear:  ['ear', 'audio', 'cyberaudio'],
};

/**
 * Determine which side (or which cyberware variant) is affected.
 *
 * Rules:
 *  - If the actor has MORE THAN TWO installed cyberware items matching the
 *    body part, pick one at random from those cyberware names.
 *  - Otherwise randomly choose "Left" or "Right".
 *
 * @param {object} entry         - Injury table entry
 * @param {Actor|null} targetActor
 * @returns {{ side: 'left'|'right'|null, cywareName: string|null }}
 */
function lateralizeInjury(entry, targetActor) {
  if (!entry.lateralize) return { side: null, cywareName: null };

  const keywords = PART_KEYWORDS[entry.lateralize] ?? [entry.lateralize];

  const matching = (targetActor?.items?.contents ?? []).filter((item) => {
    if (item.type !== 'cyberware') return false;
    const n = item.name.toLowerCase();
    return keywords.some((kw) => n.includes(kw));
  });

  if (matching.length > 2) {
    const pick = matching[Math.floor(Math.random() * matching.length)];
    return { side: null, cywareName: pick.name };
  }

  const side = Math.random() < 0.5 ? 'left' : 'right';
  return { side, cywareName: null };
}

// ─── Compendium table data builders ──────────────────────────────────────────

function buildResultsFromTable(jsTable, tableType) {
  return Object.entries(jsTable).map(([roll, entry]) => ({
    type: 'text',
    text: game.i18n?.localize(entry.nameKey) ?? entry.key,
    weight: 1,
    range: [Number(roll), Number(roll)],
    drawn: false,
    flags: {
      'cyberpunk-blue': {
        critKey: entry.key,
        tableType,
        noQuickFix: entry.noQuickFix ?? false,
        quickFixDv: entry.quickFixDv ?? null,
        treatmentDv: entry.treatmentDv ?? null,
        surgeryRequired: entry.surgeryRequired ?? false,
        surgeryDv: entry.surgeryDv ?? null,
        lateralize: entry.lateralize ?? null,
        evasionPrompt: entry.evasionPrompt ?? false,
      },
    },
  }));
}

export function buildCritBodyTableData() {
  return {
    name: CRITICAL_BODY_TABLE_NAME,
    formula: '2d6',
    replacement: true,
    displayRoll: true,
    description: 'Roll when a critical hit strikes the body (2+ damage dice show 6, damage penetrates SP). Used by the Cyberpunk Blue system.',
    results: buildResultsFromTable(CRITICAL_INJURY_TABLE, 'body'),
    flags: { 'cyberpunk-blue': { critTableType: 'body' } },
  };
}

export function buildCritHeadTableData() {
  return {
    name: CRITICAL_HEAD_TABLE_NAME,
    formula: '2d6',
    replacement: true,
    displayRoll: true,
    description: 'Roll when a critical hit strikes the head (Target Vitals active, 2+ damage dice show 6, damage penetrates SP). Used by the Cyberpunk Blue system.',
    results: buildResultsFromTable(CRITICAL_HEAD_INJURY_TABLE, 'head'),
    flags: { 'cyberpunk-blue': { critTableType: 'head' } },
  };
}

// ─── Detection ────────────────────────────────────────────────────────────────

/**
 * Count how many active d6 results in the evaluated roll show a 6.
 * @param {Roll} roll - An already-evaluated Foundry Roll.
 * @returns {{ count: number, isCritical: boolean }}
 */
export function detectCriticalDice(roll) {
  let count = 0;
  for (const term of roll.terms) {
    if (!(term instanceof foundry.dice.terms.Die)) continue;
    if (term.faces !== 6) continue;
    for (const r of term.results) {
      if (r.active && r.result === 6) count++;
    }
  }
  return { count, isCritical: count >= 2 };
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

/**
 * Show the apply-damage confirm dialog.
 *
 * @param {object} opts
 * @param {Actor}   opts.targetActor
 * @param {number}  opts.finalDamage
 * @param {number}  opts.sp
 * @param {number}  opts.netDamage
 * @param {boolean} opts.ablatesArmor
 * @param {boolean} opts.isCritical
 * @param {number}  opts.critDiceCount
 * @returns {Promise<{ confirmed: boolean }|null>}
 */
export async function confirmDamageDialog({ targetActor, finalDamage, sp, netDamage, ablatesArmor, isCritical, critDiceCount }) {
  const spNote = sp !== null
    ? `${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}`
    : `${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>`;

  const critBlock = isCritical
    ? `<p class="crit-dice-note" style="margin-top:0.4rem;"><i class="fas fa-skull"></i> ${game.i18n.format('CYBER_BLUE.CriticalInjury.CritDetected', { count: critDiceCount })}</p>`
    : '';

  const content = `
    <div class="cyberpunk-blue" style="padding:0.5rem;">
      <p>${game.i18n.format('CYBER_BLUE.Combat.ApplyDamageWithSP', { damage: finalDamage, hp: netDamage, target: targetActor.name })}</p>
      <p>${spNote}</p>
      ${critBlock}
    </div>`;

  return new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Combat.ApplyDamage') },
      content,
      buttons: [
        {
          action: 'confirm',
          icon: 'fa-solid fa-check',
          label: game.i18n.localize('CYBER_BLUE.Combat.ApplyDamage'),
          default: true,
          callback: () => ({ confirmed: true }),
        },
        {
          action: 'cancel',
          icon: 'fa-solid fa-xmark',
          label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
          callback: () => ({ confirmed: false }),
        },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(null), { once: true });
    dialog.render(true);
  });
}

// ─── Rolling & application ────────────────────────────────────────────────────

/**
 * Locate a Foundry RollTable for the given injury type.
 * Searches the world first, then the compendium pack.
 *
 * @param {'body'|'head'} tableType
 * @returns {Promise<RollTable|null>}
 */
async function findRollTable(tableType) {
  const name = tableType === 'head' ? CRITICAL_HEAD_TABLE_NAME : CRITICAL_BODY_TABLE_NAME;

  const worldTable = game.tables.find((t) => t.getFlag('cyberpunk-blue', 'critTableType') === tableType)
    ?? game.tables.getName(name);
  if (worldTable) return worldTable;

  const pack = game.packs.get('cyberpunk-blue.critical-injury-tables');
  if (!pack) return null;
  const index = await pack.getIndex();
  const entry = index.find((e) => e.name === name);
  if (!entry) return null;
  return pack.getDocument(entry._id);
}

/**
 * Roll on the appropriate critical injury table, apply the AE to targetActor,
 * and post a chat message.
 *
 * @param {Actor}  targetActor
 * @param {'body'|'head'} tableType
 * @param {object} opts
 * @param {Actor}  [opts.attackerActor]
 */
export async function rollCriticalInjury(targetActor, tableType = 'body', { attackerActor } = {}) {
  const hardcodedTable = tableType === 'head' ? CRITICAL_HEAD_INJURY_TABLE : CRITICAL_INJURY_TABLE;
  const tableLabel = tableType === 'head'
    ? game.i18n.localize('CYBER_BLUE.CriticalInjury.Head.Title')
    : game.i18n.localize('CYBER_BLUE.CriticalInjury.Body.Title');

  const speaker = attackerActor
    ? ChatMessage.getSpeaker({ actor: attackerActor })
    : ChatMessage.getSpeaker({ actor: targetActor });

  const rollTable = await findRollTable(tableType);

  let total, entry, baseName, description;

  if (rollTable) {
    const drawResult = await rollTable.draw({ displayChat: false });
    total = drawResult.roll.total;
    const tableResult = drawResult.results[0];

    const critKey = tableResult?.getFlag('cyberpunk-blue', 'critKey');
    entry = critKey
      ? Object.values(hardcodedTable).find((e) => e.key === critKey)
      : (hardcodedTable[total] ?? hardcodedTable[12]);

    baseName = entry ? game.i18n.localize(entry.nameKey) : (tableResult?.text || String(total));
    description = entry ? game.i18n.localize(entry.descKey) : '';
  } else {
    const roll = await new Roll('2d6').evaluate();
    total = roll.total;
    entry = hardcodedTable[total] ?? hardcodedTable[12];
    baseName = game.i18n.localize(entry.nameKey);
    description = game.i18n.localize(entry.descKey);
  }

  // ── Lateralization ──
  const { side, cywareName } = lateralizeInjury(entry, targetActor);
  let name = baseName;
  if (cywareName) {
    name = `${baseName} (${cywareName})`;
  } else if (side) {
    const sideLabel = game.i18n.localize(`CYBER_BLUE.CriticalInjury.Side.${side === 'left' ? 'Left' : 'Right'}`);
    name = `${sideLabel} ${baseName}`;
  }

  // ── Apply Active Effect ──
  const aeData = {
    name,
    icon: 'icons/svg/bones.svg',
    origin: targetActor.uuid,
    disabled: false,
    transfer: false,
    system: { changes: entry?.changes ?? [] },
    flags: {
      'cyberpunk-blue': {
        [CRITICAL_INJURY_FLAG]: {
          key: entry?.key ?? 'unknown',
          tableType,
          mortal: entry?.mortal ?? false,
          descKey: entry?.descKey ?? '',
          side: side ?? null,
          cywareName: cywareName ?? null,
          lateralize: entry?.lateralize ?? null,
          noQuickFix: entry?.noQuickFix ?? false,
          quickFixDv: entry?.quickFixDv ?? null,
          quickFixUsed: false,
          treatmentDv: entry?.treatmentDv ?? null,
          surgeryRequired: entry?.surgeryRequired ?? false,
          surgeryDv: entry?.surgeryDv ?? null,
          evasionPrompt: entry?.evasionPrompt ?? false,
          stabilized: false,
        },
      },
    },
  };

  const [createdAE] = await targetActor.createEmbeddedDocuments('ActiveEffect', [aeData]);

  // ── Post chat card ──
  const content = buildInjuryChatHtml({
    tableLabel, roll: total, targetName: targetActor.name,
    name, description,
    mortal: entry?.mortal ?? false,
    noQuickFix: entry?.noQuickFix ?? false,
    quickFixDv: entry?.quickFixDv ?? null,
    treatmentDv: entry?.treatmentDv ?? null,
    surgeryRequired: entry?.surgeryRequired ?? false,
    surgeryDv: entry?.surgeryDv ?? null,
    actorId: targetActor.id, effectId: createdAE?.id ?? null,
  });

  await ChatMessage.create({
    speaker,
    content,
    flags: { 'cyberpunk-blue': { criticalInjuryCard: true } },
  });
}

// ─── Chat HTML builder ────────────────────────────────────────────────────────

function buildInjuryChatHtml({
  tableLabel, roll, targetName, name, description,
  mortal, noQuickFix, quickFixDv, treatmentDv, surgeryRequired, surgeryDv,
  actorId, effectId,
}) {
  const mortalBlock = mortal
    ? `<p class="crit-mortal-warning"><i class="fas fa-heart-pulse"></i> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.MortalWound')}</p>`
    : '';

  const qfText = noQuickFix
    ? game.i18n.localize('CYBER_BLUE.CriticalInjury.NoQuickFix')
    : quickFixDv != null
      ? game.i18n.format('CYBER_BLUE.CriticalInjury.QuickFixDv', { dv: quickFixDv })
      : '';

  const surgeryNote = surgeryRequired
    ? ` (${game.i18n.localize('CYBER_BLUE.CriticalInjury.SurgeryRequired')})`
    : surgeryDv != null
      ? ` (DV ${surgeryDv} ${game.i18n.localize('CYBER_BLUE.CriticalInjury.WithSurgery')})`
      : '';

  const txText = treatmentDv != null
    ? `${game.i18n.format('CYBER_BLUE.CriticalInjury.TreatmentDv', { dv: treatmentDv })}${surgeryNote}`
    : '';

  const infoBlock = (qfText || txText)
    ? `<div class="crit-treatment-info" style="font-size:0.85em;margin-top:0.3rem;">${qfText ? `<span>${qfText}</span>` : ''}${qfText && txText ? ' &bull; ' : ''}${txText ? `<span>${txText}</span>` : ''}</div>`
    : '';

  const removeBtn = (actorId && effectId)
    ? `<button type="button" class="remove-critical-injury" data-actor-id="${actorId}" data-effect-id="${effectId}">
        <i class="fas fa-trash"></i> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.Remove')}
       </button>`
    : '';

  return `
    <div class="cyberpunk-blue chat-card critical-injury-card">
      <div class="critical-injury-header">
        <i class="fas fa-skull-crossbones"></i>
        <span class="crit-table-label">${tableLabel}</span>
        <span class="crit-target-name">${targetName}</span>
      </div>
      <div class="critical-injury-roll">${game.i18n.format('CYBER_BLUE.CriticalInjury.RollResult', { roll })}</div>
      <div class="critical-injury-name">${name}</div>
      <div class="critical-injury-desc">${description}</div>
      ${mortalBlock}${infoBlock}
      <div class="critical-injury-actions">${removeBtn}</div>
    </div>`;
}
