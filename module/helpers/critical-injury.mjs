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

// ─── Helper builders ──────────────────────────────────────────────────────────

const add = (stat, val) => ({ key: `system.stats.${stat}.rollMod`, type: 'add', value: String(val) });
const addAll = (val) => ['body', 'rflx', 'int', 'tech', 'cool'].map((s) => add(s, val));
const overrideMove = { key: 'system.stats.move.value', type: 'override', value: '1' };

// ─── Body Critical Injury Table (2d6) ────────────────────────────────────────

export const CRITICAL_INJURY_TABLE = {
  2: {
    key: 'dismembered-arm',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedArm',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedArmDesc',
    mortal: true,
    changes: [add('rflx', -4), add('tech', -4)],
  },
  3: {
    key: 'dismembered-leg',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedLeg',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.DismemberedLegDesc',
    mortal: true,
    changes: [add('body', -4), overrideMove],
  },
  4: {
    key: 'collapsed-lung',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.CollapsedLung',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.CollapsedLungDesc',
    mortal: true,
    changes: addAll(-4),
  },
  5: {
    key: 'broken-arm',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenArm',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenArmDesc',
    mortal: false,
    changes: [add('rflx', -4), add('tech', -4)],
  },
  6: {
    key: 'broken-ribs',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenRibs',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenRibsDesc',
    mortal: false,
    changes: addAll(-2),
  },
  7: {
    key: 'broken-leg',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenLeg',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.BrokenLegDesc',
    mortal: false,
    changes: [add('body', -4), overrideMove],
  },
  8: {
    key: 'torn-muscle',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.TornMuscle',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.TornMuscleDesc',
    mortal: false,
    changes: [add('body', -2), add('rflx', -2)],
  },
  9: {
    key: 'spinal-injury',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.SpinalInjury',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.SpinalInjuryDesc',
    mortal: false,
    changes: addAll(-4),
  },
  10: {
    key: 'crushed-windpipe',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.CrushedWindpipe',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.CrushedWindpipeDesc',
    mortal: true,
    changes: [add('body', -4), add('cool', -4)],
  },
  11: {
    key: 'foreign-object',
    nameKey: 'CYBER_BLUE.CriticalInjury.Body.ForeignObject',
    descKey: 'CYBER_BLUE.CriticalInjury.Body.ForeignObjectDesc',
    mortal: false,
    changes: addAll(-2),
  },
  12: {
    key: 'instant-death',
    nameKey: 'CYBER_BLUE.CriticalInjury.InstantDeath',
    descKey: 'CYBER_BLUE.CriticalInjury.InstantDeathDesc',
    mortal: false,
    instantDeath: true,
    changes: [],
  },
};

// ─── Head Critical Injury Table (2d6) ────────────────────────────────────────

export const CRITICAL_HEAD_INJURY_TABLE = {
  2: {
    key: 'lost-eye',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.LostEye',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.LostEyeDesc',
    mortal: false,
    changes: [add('rflx', -4), add('int', -2)],
  },
  3: {
    key: 'brain-injury',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.BrainInjury',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.BrainInjuryDesc',
    mortal: false,
    changes: [add('int', -2), add('cool', -2)],
  },
  4: {
    key: 'concussion',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.Concussion',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.ConcussionDesc',
    mortal: false,
    changes: addAll(-2),
  },
  5: {
    key: 'broken-nose',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.BrokenNose',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.BrokenNoseDesc',
    mortal: false,
    changes: [add('cool', -2)],
  },
  6: {
    key: 'lost-ear',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.LostEar',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.LostEarDesc',
    mortal: false,
    changes: [add('int', -2)],
  },
  7: {
    key: 'cracked-skull',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.CrackedSkull',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.CrackedSkullDesc',
    mortal: true,
    changes: addAll(-4),
  },
  8: {
    key: 'damaged-eye',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEye',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEyeDesc',
    mortal: false,
    changes: [add('rflx', -2)],
  },
  9: {
    key: 'damaged-ear',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEar',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.DamagedEarDesc',
    mortal: false,
    changes: [add('int', -1)],
  },
  10: {
    key: 'foreign-object-head',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.ForeignObject',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.ForeignObjectDesc',
    mortal: false,
    changes: addAll(-2),
  },
  11: {
    key: 'whiplash',
    nameKey: 'CYBER_BLUE.CriticalInjury.Head.Whiplash',
    descKey: 'CYBER_BLUE.CriticalInjury.Head.WhiplashDesc',
    mortal: false,
    changes: [add('body', -2), add('rflx', -2)],
  },
  12: {
    key: 'instant-death',
    nameKey: 'CYBER_BLUE.CriticalInjury.InstantDeath',
    descKey: 'CYBER_BLUE.CriticalInjury.InstantDeathDesc',
    mortal: false,
    instantDeath: true,
    changes: [],
  },
};

// ─── Compendium table data builders ──────────────────────────────────────────

function buildResultsFromTable(jsTable, tableType) {
  return Object.entries(jsTable).map(([roll, entry]) => ({
    type: 0, // CONST.TABLE_RESULT_TYPES.TEXT
    text: game.i18n?.localize(entry.nameKey) ?? entry.key,
    weight: 1,
    range: [Number(roll), Number(roll)],
    drawn: false,
    flags: {
      'cyberpunk-blue': {
        critKey: entry.key,
        instantDeath: entry.instantDeath ?? false,
        tableType,
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
 * When a critical hit is detected a note is shown but the table type is
 * determined externally (target vitals → head, everything else → body).
 *
 * @param {object} opts
 * @param {Actor}   opts.targetActor
 * @param {number}  opts.finalDamage  - Pre-SP damage including all bonuses
 * @param {number}  opts.sp           - Target SP at time of roll
 * @param {number}  opts.netDamage    - HP loss after SP
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

  // 1. World tables (GM may have imported / customised them)
  const worldTable = game.tables.find((t) => t.getFlag('cyberpunk-blue', 'critTableType') === tableType)
    ?? game.tables.getName(name);
  if (worldTable) return worldTable;

  // 2. Compendium pack
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
 * @param {Actor}  [opts.attackerActor]  - Used as chat speaker if provided
 */
export async function rollCriticalInjury(targetActor, tableType = 'body', { attackerActor } = {}) {
  const hardcodedTable = tableType === 'head' ? CRITICAL_HEAD_INJURY_TABLE : CRITICAL_INJURY_TABLE;
  const tableLabel = tableType === 'head'
    ? game.i18n.localize('CYBER_BLUE.CriticalInjury.Head.Title')
    : game.i18n.localize('CYBER_BLUE.CriticalInjury.Body.Title');

  const speaker = attackerActor
    ? ChatMessage.getSpeaker({ actor: attackerActor })
    : ChatMessage.getSpeaker({ actor: targetActor });

  // ── Try Foundry RollTable ──
  const rollTable = await findRollTable(tableType);

  let total, entry, name, description;

  if (rollTable) {
    const drawResult = await rollTable.draw({ displayChat: false });
    total = drawResult.roll.total;
    const tableResult = drawResult.results[0];

    // Prefer critKey from flags for AE lookup; fall back to roll-total keying
    const critKey = tableResult?.getFlag('cyberpunk-blue', 'critKey');
    entry = critKey
      ? Object.values(hardcodedTable).find((e) => e.key === critKey)
      : (hardcodedTable[total] ?? hardcodedTable[12]);

    name = tableResult?.text || (entry ? game.i18n.localize(entry.nameKey) : String(total));
    description = entry ? game.i18n.localize(entry.descKey) : '';
  } else {
    // ── Pure-JS fallback ──
    const roll = await new Roll('2d6').evaluate();
    total = roll.total;
    entry = hardcodedTable[total] ?? hardcodedTable[12];
    name = game.i18n.localize(entry.nameKey);
    description = game.i18n.localize(entry.descKey);
  }

  // ── Instant Death ──
  if (entry?.instantDeath) {
    await targetActor.update({ 'system.resources.hp.value': 0 });
    const content = buildInjuryChatHtml({
      tableLabel, roll: total, targetName: targetActor.name,
      name, description, mortal: false, instantDeath: true,
      actorId: null, effectId: null,
    });
    await ChatMessage.create({ speaker, content });
    return;
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
        },
      },
    },
  };

  const [createdAE] = await targetActor.createEmbeddedDocuments('ActiveEffect', [aeData]);

  // ── Post chat card ──
  const content = buildInjuryChatHtml({
    tableLabel, roll: total, targetName: targetActor.name,
    name, description, mortal: entry?.mortal ?? false, instantDeath: false,
    actorId: targetActor.id, effectId: createdAE?.id ?? null,
  });

  await ChatMessage.create({
    speaker,
    content,
    flags: { 'cyberpunk-blue': { criticalInjuryCard: true } },
  });
}

// ─── Chat HTML builder ────────────────────────────────────────────────────────

function buildInjuryChatHtml({ tableLabel, roll, targetName, name, description, mortal, instantDeath, actorId, effectId }) {
  const mortalBlock = mortal
    ? `<p class="crit-mortal-warning"><i class="fas fa-heart-pulse"></i> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.MortalWound')}</p>`
    : '';
  const deathBlock = instantDeath
    ? `<p class="crit-instant-death"><i class="fas fa-skull"></i> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.InstantDeathMessage')}</p>`
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
      ${mortalBlock}${deathBlock}
      <div class="critical-injury-actions">${removeBtn}</div>
    </div>`;
}
