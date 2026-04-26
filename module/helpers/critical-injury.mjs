/**
 * Critical Injury system for Cyberpunk Blue.
 *
 * Trigger condition: at least 2 damage dice show 6, AND at least 1 point of the
 * original roll (before the +5 bonus) would penetrate the target's SP.
 * Halved damage (outer AoE zone, successful evasion) suppresses the trigger.
 *
 * On trigger: damage +5, then roll 2d6 on the appropriate table and apply the
 * resulting Active Effect to the target actor.
 */

export const CRITICAL_INJURY_FLAG = 'criticalInjury';

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

// ─── Confirm dialog with optional crit options ────────────────────────────────

/**
 * Show the apply-damage confirm dialog.  When a critical hit is detected the
 * dialog also lets the GM pick which injury table (body / head) to use.
 *
 * @param {object} opts
 * @param {Actor}   opts.targetActor
 * @param {number}  opts.finalDamage  - Pre-SP damage including the +5 bonus if applicable
 * @param {number}  opts.sp           - Target SP at time of roll
 * @param {number}  opts.netDamage    - HP loss after SP
 * @param {boolean} opts.ablatesArmor
 * @param {boolean} opts.isCritical
 * @param {number}  opts.critDiceCount
 * @returns {Promise<{ confirmed: boolean, injuryTable: 'body'|'head' }|null>}
 */
export async function confirmDamageDialog({ targetActor, finalDamage, sp, netDamage, ablatesArmor, isCritical, critDiceCount }) {
  const spNote = sp !== null
    ? `${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}`
    : `${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>`;

  const critBlock = isCritical ? `
    <div class="crit-confirm-block">
      <p class="crit-dice-note"><i class="fas fa-skull"></i> ${game.i18n.format('CYBER_BLUE.CriticalInjury.CritDetected', { count: critDiceCount })}</p>
      <div class="crit-location-row">
        <span>${game.i18n.localize('CYBER_BLUE.CriticalInjury.InjuryLocation')}:</span>
        <label><input type="radio" name="crit-table" value="body" checked /> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.InjuryLocationBody')}</label>
        <label><input type="radio" name="crit-table" value="head" /> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.InjuryLocationHead')}</label>
      </div>
    </div>` : '';

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
          callback: (_event, button) => {
            const table = button.form?.elements['crit-table']?.value ?? 'body';
            return { confirmed: true, injuryTable: table };
          },
        },
        {
          action: 'cancel',
          icon: 'fa-solid fa-xmark',
          label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
          callback: () => ({ confirmed: false, injuryTable: 'body' }),
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
 * Roll on the appropriate critical injury table, apply the AE to targetActor,
 * and post a chat message.
 *
 * @param {Actor}  targetActor
 * @param {'body'|'head'} tableType
 * @param {object} opts
 * @param {Actor}  [opts.attackerActor]  - Used as chat speaker if provided
 */
export async function rollCriticalInjury(targetActor, tableType = 'body', { attackerActor } = {}) {
  const table = tableType === 'head' ? CRITICAL_HEAD_INJURY_TABLE : CRITICAL_INJURY_TABLE;
  const tableLabel = tableType === 'head'
    ? game.i18n.localize('CYBER_BLUE.CriticalInjury.Head.Title')
    : game.i18n.localize('CYBER_BLUE.CriticalInjury.Body.Title');

  const roll = await new Roll('2d6').evaluate();
  const total = roll.total;
  const entry = table[total] ?? table[12]; // fallback

  const name = game.i18n.localize(entry.nameKey);
  const description = game.i18n.localize(entry.descKey);

  // ── Instant Death ──
  if (entry.instantDeath) {
    await targetActor.update({ 'system.resources.hp.value': 0 });
    const content = buildInjuryChatHtml({
      tableLabel, roll: total, targetName: targetActor.name,
      name, description, mortal: false, instantDeath: true,
      actorId: null, effectId: null,
    });
    await ChatMessage.create({
      speaker: attackerActor
        ? ChatMessage.getSpeaker({ actor: attackerActor })
        : ChatMessage.getSpeaker({ actor: targetActor }),
      content,
    });
    return;
  }

  // ── Apply Active Effect ──
  const aeData = {
    name,
    icon: 'icons/svg/bones.svg',
    origin: targetActor.uuid,
    disabled: false,
    transfer: false,
    system: { changes: entry.changes },
    flags: {
      'cyberpunk-blue': {
        [CRITICAL_INJURY_FLAG]: {
          key: entry.key,
          tableType,
          mortal: entry.mortal,
          descKey: entry.descKey,
        },
      },
    },
  };

  const [createdAE] = await targetActor.createEmbeddedDocuments('ActiveEffect', [aeData]);

  // ── Post chat card ──
  const content = buildInjuryChatHtml({
    tableLabel, roll: total, targetName: targetActor.name,
    name, description, mortal: entry.mortal, instantDeath: false,
    actorId: targetActor.id, effectId: createdAE?.id ?? null,
  });

  await ChatMessage.create({
    speaker: attackerActor
      ? ChatMessage.getSpeaker({ actor: attackerActor })
      : ChatMessage.getSpeaker({ actor: targetActor }),
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

// ─── Actor-sheet context helper ───────────────────────────────────────────────

/**
 * Build the list of critical injury AEs for display on the actor sheet.
 * @param {Actor} actor
 * @returns {{ id: string, name: string, description: string, mortal: boolean }[]}
 */
export function getCriticalInjuries(actor) {
  return actor.effects
    .filter((e) => e.getFlag('cyberpunk-blue', CRITICAL_INJURY_FLAG))
    .map((e) => {
      const flag = e.getFlag('cyberpunk-blue', CRITICAL_INJURY_FLAG);
      return {
        id: e.id,
        name: e.name,
        description: flag?.descKey ? game.i18n.localize(flag.descKey) : '',
        mortal: flag?.mortal ?? false,
      };
    });
}
