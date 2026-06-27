/**
 * Instruction sequence execution for Gear, Cyberware, and Drug items.
 *
 * Step types:
 *   type='effect'  — Enables/disables a named AE on the item.  Pauses (shows the
 *                    "⏭" button) unless `permanent` is set, in which case the AE is
 *                    applied and execution continues automatically without reverting.
 *
 *   type='check'   — Rolls 1d10 + Primary Stat + Skill (lower of Skill and Component
 *                    if both set) vs DV.  Auto-advances on success.  On failure,
 *                    jumps to `failIndex` if set (≥ 0), otherwise ends the sequence.
 *
 *   type='message' — Posts `message` HTML to chat (optionally whispered to GM).
 *                    Auto-advances.  If `terminates` is set, ends the sequence after.
 *
 *   type='pause'   — Pauses execution with no AE change; the "⏭" button resumes.
 *
 * Effect steps: `effectId` takes priority over `effectName`.  Use `effectName` for
 * catalogue items whose AE _ids are not known at authoring time.
 *
 * Public API:
 *   startInstructions(item, actor)   — kick off the sequence from step 0
 *   advanceInstructions(item, actor) — called when the "⏭" button is clicked
 *   getInstructionContext(itemData)  — context object for the actor sheet
 */

export const INSTRUCTION_SNAPSHOT_FLAG = 'instructionAeSnapshot';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the instruction sequence for an item.
 * Reduces quantity by 1 when instructionReduceQuantity is set; warns and no-ops
 * if quantity is already 0.
 * No-ops if no steps are defined or the sequence is already active.
 */
export async function startInstructions(item, actor) {
  const steps = item.system?.instructions ?? [];
  if (!steps.length) return;
  if (item.system?.instructionActive) return;

  // Reduce quantity by 1 if configured (works for gear, drug, or any item type)
  if (item.system.instructionReduceQuantity) {
    const qty = Number(item.system.quantity) ?? 0;
    if (qty <= 0) {
      ui.notifications.warn(`${item.name}: ${game.i18n.localize('CYBER_BLUE.Instructions.EmptyQuantity')}`);
      return;
    }
    await item.update({ 'system.quantity': Math.max(qty - 1, 0) });
  }

  await item.update({ 'system.instructionActive': true, 'system.instructionStep': -1 });
  await _runFrom(item, actor, 0);
}

/**
 * Advance from the current step to the next.
 * Called when the actor-sheet "⏭" button is clicked.
 * Reverts any non-permanent AE step, then runs from step+1 (or ends the sequence).
 */
export async function advanceInstructions(item, actor) {
  if (!item.system?.instructionActive) return;
  const steps = item.system?.instructions ?? [];
  const currentStep = item.system?.instructionStep ?? -1;

  // Revert AE state only if the current step was a non-permanent effect step
  if (currentStep >= 0) {
    const step = steps[currentStep];
    if (step?.type === 'effect' && !step.permanent) {
      await _revertAeSnapshot(item);
    }
    // pause and permanent-effect steps have nothing to revert
  }

  const nextIndex = currentStep + 1;
  if (nextIndex >= steps.length) {
    await _endInstructions(item);
    return;
  }
  await _runFrom(item, actor, nextIndex);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Execute from startIndex onwards.
 * Loops through auto-advancing steps; pauses on effect/pause steps.
 */
async function _runFrom(item, actor, startIndex) {
  const steps = item.system?.instructions ?? [];
  let i = startIndex;

  while (i < steps.length) {
    const step = steps[i];

    if (step.type === 'effect') {
      if (step.permanent) {
        // Apply AE permanently — no snapshot, auto-advance (never reverted)
        await _applyPermanentAeStep(item, step);
        await item.update({ 'system.instructionStep': i });
        if (step.terminates) {
          await _endInstructions(item, false);
          return;
        }
        i++;
        continue;
      } else {
        // Apply AE and pause — the "⏭" button will advance
        await _applyAeStep(item, step);
        await item.update({ 'system.instructionStep': i });
        return;
      }
    }

    if (step.type === 'pause') {
      // No AE change — just pause; "⏭" button resumes
      await item.update({ 'system.instructionStep': i });
      return;
    }

    if (step.type === 'check') {
      const result = await _rollCheckStep(item, step, actor);
      await item.update({ 'system.instructionStep': i });
      if (result.advances) {
        if (step.terminates) {
          await _endInstructions(item);
          return;
        }
        i++;
        continue;
      } else {
        // Check failed — jump to failIndex, or end if none set
        const failIndex = step.failIndex ?? -1;
        if (failIndex >= 0 && failIndex < steps.length) {
          i = failIndex;
          continue;
        }
        await _endInstructions(item);
        return;
      }
    }

    if (step.type === 'message') {
      await _postMessageStep(item, step, actor);
      await item.update({ 'system.instructionStep': i });
      if (step.terminates) {
        await _endInstructions(item);
        return;
      }
      i++;
      continue;
    }

    i++; // Unknown step type — skip
  }

  // All steps completed without pausing
  await _endInstructions(item);
}

/**
 * Resolve the AE for a step by effectId (priority) or effectName.
 */
function _resolveStepEffect(item, step) {
  if (step.effectId) return item.effects.get(step.effectId) ?? null;
  if (step.effectName) return item.effects.find((e) => e.name === step.effectName) ?? null;
  return null;
}

/**
 * Apply the AE state for an effect step and snapshot the previous state so it
 * can be reverted when the step ends.
 */
async function _applyAeStep(item, step) {
  const effect = _resolveStepEffect(item, step);
  if (!effect) return;
  const snapshot = [{ id: effect.id, wasDisabled: effect.disabled }];
  await item.setFlag('cyberpunk-blue', INSTRUCTION_SNAPSHOT_FLAG, JSON.stringify(snapshot));
  await effect.update({ disabled: !step.effectEnabled });
}

/**
 * Apply an AE permanently — no snapshot, never reverted automatically.
 * Used for addiction penalties and other long-term consequences.
 */
async function _applyPermanentAeStep(item, step) {
  const effect = _resolveStepEffect(item, step);
  if (!effect) return;
  await effect.update({ disabled: !step.effectEnabled });
}

/**
 * Post a message step's HTML content to chat, optionally whispering to GM.
 */
async function _postMessageStep(item, step, actor) {
  const content = step.message ?? '';
  if (!content) return;
  const msgData = {
    content: `<div class="cyberpunk-blue chat-card">${content}</div>`,
    speaker: ChatMessage.getSpeaker({ actor }),
  };
  if (step.whisperGm) {
    msgData.whisper = ChatMessage.getWhisperRecipients('GM');
  }
  await ChatMessage.create(msgData);
}

/** Restore AE states from the snapshot stored in flags. */
async function _revertAeSnapshot(item) {
  const snapshotJson = item.getFlag('cyberpunk-blue', INSTRUCTION_SNAPSHOT_FLAG);
  if (!snapshotJson) return;
  try {
    const snapshot = JSON.parse(snapshotJson);
    for (const { id, wasDisabled } of snapshot) {
      const effect = item.effects.get(id);
      if (effect) await effect.update({ disabled: wasDisabled });
    }
  } catch { /* Ignore malformed snapshot */ }
  await item.unsetFlag('cyberpunk-blue', INSTRUCTION_SNAPSHOT_FLAG);
}

/**
 * End the sequence: revert any non-permanent active AE step and clear active state.
 * @param {boolean} [revert=true] — pass false when a permanent step just fired
 */
async function _endInstructions(item, revert = true) {
  if (revert) {
    const currentStep = item.system?.instructionStep ?? -1;
    const steps = item.system?.instructions ?? [];
    const step = currentStep >= 0 ? steps[currentStep] : null;
    if (step?.type === 'effect' && !step.permanent) {
      await _revertAeSnapshot(item);
    }
  }
  await item.update({ 'system.instructionActive': false, 'system.instructionStep': -1 });
}

/** Roll a check step and post the result to chat. Returns { advances: boolean }. */
async function _rollCheckStep(item, step, actor) {
  const statSlug      = step.primary || 'body';
  const skillSlug     = step.skill || '';
  const componentSlug = step.component || '';
  const dv            = step.dv ?? 13;
  const progress      = step.progress ?? true; // true = roll ≥ DV advances

  const statValue     = actor.system?.stats?.[statSlug]?.value ?? 0;
  const statRollMod   = actor.system?.stats?.[statSlug]?.rollMod ?? 0;
  const skillRank     = skillSlug ? (actor.system?.skills?.[skillSlug]?.rank ?? 0) : 0;
  const skillBonus    = skillSlug ? (actor.system?.skills?.[skillSlug]?.bonus ?? 0) : 0;
  const skillGeneral  = skillSlug ? (actor.system?.skills?.[skillSlug]?.generalBonus ?? 0) : 0;
  const componentRank = componentSlug ? (actor.system?.components?.[componentSlug]?.rank ?? null) : null;
  const componentBonus    = componentSlug ? (actor.system?.components?.[componentSlug]?.bonus ?? 0) : 0;
  const componentGeneral  = componentSlug ? (actor.system?.components?.[componentSlug]?.generalBonus ?? 0) : 0;

  // Auto-fail: requiresComponent is true and the actor doesn't have the component at all.
  if (step.requiresComponent && componentSlug && componentRank === null) {
    const stepName  = step.name || game.i18n.localize('CYBER_BLUE.Instructions.Check');
    const compLabel = CONFIG.CYBER_BLUE.components?.[componentSlug]?.label ?? componentSlug;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card"><h3>${stepName}: ${item.name}</h3><p>${game.i18n.format('CYBER_BLUE.Instructions.CheckRequiresComponent', { component: compLabel })}</p><p><strong>${game.i18n.localize('CYBER_BLUE.Instructions.CheckFails')}</strong></p></div>`,
    });
    return { advances: false };
  }

  // Universal model: stat + min(skill+skillBonus, component+componentBonus) +
  // general bonuses (skill/component general channels) + stat roll mod.
  const effectiveSkill = componentRank !== null
    ? Math.min(skillRank + skillBonus, componentRank + componentBonus)
    : (skillRank + skillBonus);
  const generalBonus   = skillGeneral + (componentRank !== null ? componentGeneral : 0);
  const flatBonus      = statValue + effectiveSkill + generalBonus + (statRollMod || 0);

  const roll = await new Roll(`1d10 + ${flatBonus}`).evaluate();

  const statLabel      = CONFIG.CYBER_BLUE.stats?.[statSlug]?.shortLabel ?? statSlug.toUpperCase();
  const skillLabel     = skillSlug ? (CONFIG.CYBER_BLUE.skills?.[skillSlug]?.label ?? skillSlug) : null;
  const componentLabel = componentSlug ? (CONFIG.CYBER_BLUE.components?.[componentSlug]?.label ?? componentSlug) : null;

  const bonusParts = [
    `${statLabel} ${statValue}`,
    skillLabel   ? `${skillLabel} ${skillRank}`         : null,
    componentLabel ? `(${componentLabel} ${componentRank})` : null,
    generalBonus ? `Bonus ${generalBonus >= 0 ? '+' : ''}${generalBonus}` : null,
    statRollMod  ? `Mod ${statRollMod}`                 : null,
  ].filter(Boolean).join(' + ');

  const advances  = progress ? (roll.total >= dv) : (roll.total < dv);
  // Use CheckFails when there's a failIndex jump (sequence continues), CheckEnds when it stops.
  const resultKey = advances
    ? 'CYBER_BLUE.Instructions.CheckAdvances'
    : ((step.failIndex ?? -1) >= 0
        ? 'CYBER_BLUE.Instructions.CheckFails'
        : 'CYBER_BLUE.Instructions.CheckEnds');
  const stepName  = step.name || game.i18n.localize('CYBER_BLUE.Instructions.Check');

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3>${stepName}: ${item.name}</h3>
        <p>${bonusParts} vs DV <strong>${dv}</strong></p>
        <p><strong>${game.i18n.localize(resultKey)}</strong></p>
      </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  return { advances };
}

// ─── Context helper (used by actor-sheet.mjs) ─────────────────────────────────

/**
 * Compute the instruction display context for an item in the actor sheet.
 * Returns fields consumed by the instruction button area in HBS templates.
 */
export function getInstructionContext(itemData) {
  const steps = itemData.system?.instructions ?? [];
  if (!steps.length) {
    return { hasInstructions: false, instructionActive: false, instructionNextLabel: '', canStart: false, quantityEmpty: false };
  }

  const active        = itemData.system?.instructionActive ?? false;
  const currentStep   = itemData.system?.instructionStep ?? -1;
  const quantity      = itemData.system?.quantity ?? null;
  const quantityEmpty = quantity !== null && Number(quantity) <= 0;
  const canStart      = !active && !quantityEmpty;

  let nextLabel;
  if (!active) {
    nextLabel = steps[0]?.name || game.i18n.localize('CYBER_BLUE.Instructions.Step');
  } else {
    const nextIndex = currentStep + 1;
    if (nextIndex >= steps.length) {
      nextLabel = game.i18n.localize('CYBER_BLUE.Instructions.End');
    } else {
      const nextStep = steps[nextIndex];
      nextLabel = nextStep?.name || `${game.i18n.localize('CYBER_BLUE.Instructions.Step')} ${nextIndex + 1}`;
    }
  }

  return { hasInstructions: true, instructionActive: active, instructionNextLabel: nextLabel, canStart, quantityEmpty };
}
