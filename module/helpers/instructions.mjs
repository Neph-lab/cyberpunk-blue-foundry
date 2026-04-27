/**
 * Instruction sequence execution for Gear and Cyberware items.
 *
 * An instruction sequence is an ordered array of steps on the item's data.
 * Each step is either:
 *
 *   type='effect'  — Temporarily applies an enabled/disabled state to a named
 *                    ActiveEffect on the item for one phase.  The AE reverts to
 *                    its previous state when the phase ends (next step starts or
 *                    sequence ends).  Execution PAUSES here; the actor-sheet
 *                    "⏭" button advances to the next phase.
 *
 *   type='check'   — Rolls 1d10 + Primary Stat + Skill (lower of Skill and
 *                    Component if both set) vs DV.  The progress flag determines
 *                    whether rolling ≥ DV advances or ends the sequence.
 *                    Execution continues automatically (no button click needed).
 *
 * Public API:
 *   startInstructions(item, actor)   — kick off the sequence from step 0
 *   advanceInstructions(item, actor) — called when the actor sheet "⏭" is clicked
 */

export const INSTRUCTION_SNAPSHOT_FLAG = 'instructionAeSnapshot';

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the instruction sequence for an item.
 * Reduces Gear quantity by 1 when instructionReduceQuantity is set.
 * No-ops if no steps are defined or sequence is already active.
 */
export async function startInstructions(item, actor) {
  const steps = item.system?.instructions ?? [];
  if (!steps.length) return;
  if (item.system?.instructionActive) return;

  // Gear: reduce quantity by 1 (floor 0, never delete)
  if (item.type === 'gear' && item.system.instructionReduceQuantity) {
    const newQty = Math.max((item.system.quantity ?? 1) - 1, 0);
    await item.update({ 'system.quantity': newQty });
  }

  await item.update({ 'system.instructionActive': true, 'system.instructionStep': -1 });
  await _runFrom(item, actor, 0);
}

/**
 * Advance from the current step to the next.
 * Called when the actor-sheet "⏭" button is clicked.
 * Reverts any active AE step, then runs from step+1 (or ends the sequence).
 */
export async function advanceInstructions(item, actor) {
  if (!item.system?.instructionActive) return;
  const steps = item.system?.instructions ?? [];
  const currentStep = item.system?.instructionStep ?? -1;

  // Revert AE state if current step was an effect step
  if (currentStep >= 0 && steps[currentStep]?.type === 'effect') {
    await _revertAeSnapshot(item);
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
 * Loops through check steps automatically; pauses on effect steps.
 */
async function _runFrom(item, actor, startIndex) {
  const steps = item.system?.instructions ?? [];
  let i = startIndex;

  while (i < steps.length) {
    const step = steps[i];

    if (step.type === 'effect') {
      // Apply AE state and pause — the button click will advance
      await _applyAeStep(item, step);
      await item.update({ 'system.instructionStep': i });
      return;
    }

    if (step.type === 'check') {
      const result = await _rollCheckStep(item, step, actor);
      await item.update({ 'system.instructionStep': i });
      if (result.advances) {
        i++;
        continue;
      } else {
        await _endInstructions(item);
        return;
      }
    }

    i++; // Unknown step type — skip
  }

  // All steps completed without pausing
  await _endInstructions(item);
}

/** Apply the AE state for an effect step and snapshot the previous state. */
async function _applyAeStep(item, step) {
  if (!step.effectId) return;
  const effect = item.effects.get(step.effectId);
  if (!effect) return;

  const snapshot = [{ id: effect.id, wasDisabled: effect.disabled }];
  await item.setFlag('cyberpunk-blue', INSTRUCTION_SNAPSHOT_FLAG, JSON.stringify(snapshot));
  await effect.update({ disabled: !step.effectEnabled });
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

/** End the sequence: revert any active AE step and clear active state. */
async function _endInstructions(item) {
  const currentStep = item.system?.instructionStep ?? -1;
  const steps = item.system?.instructions ?? [];
  if (currentStep >= 0 && steps[currentStep]?.type === 'effect') {
    await _revertAeSnapshot(item);
  }
  await item.update({ 'system.instructionActive': false, 'system.instructionStep': -1 });
}

/** Roll a check step and post the result to chat. Returns { advances: boolean }. */
async function _rollCheckStep(item, step, actor) {
  const statSlug      = step.primary || 'body';
  const skillSlug     = step.skill || '';
  const componentSlug = step.component || '';
  const dv            = step.dv ?? 13;
  const progress      = step.progress ?? true; // true = roll≥DV advances

  const statValue    = actor.system?.stats?.[statSlug]?.value ?? 0;
  const statRollMod  = actor.system?.stats?.[statSlug]?.rollMod ?? 0;
  const skillRank    = skillSlug ? (actor.system?.skills?.[skillSlug]?.rank ?? 0) : 0;
  const componentRank = componentSlug ? (actor.system?.components?.[componentSlug]?.rank ?? null) : null;

  // Auto-fail: requiresComponent is true and the actor doesn't have the component at all.
  if (step.requiresComponent && componentSlug && componentRank === null) {
    const stepName = step.name || game.i18n.localize('CYBER_BLUE.Instructions.Check');
    const compLabel = CONFIG.CYBER_BLUE.components?.[componentSlug]?.label ?? componentSlug;
    await ChatMessage.create({
      speaker:  ChatMessage.getSpeaker({ actor }),
      content:  `<div class="cyberpunk-blue chat-card"><h3>${stepName}: ${item.name}</h3><p>${game.i18n.format('CYBER_BLUE.Instructions.CheckRequiresComponent', { component: compLabel })}</p><p><strong>${game.i18n.localize('CYBER_BLUE.Instructions.CheckEnds')}</strong></p></div>`,
    });
    return { advances: false };
  }

  const effectiveSkill = componentRank !== null ? Math.min(skillRank, componentRank) : skillRank;
  const flatBonus    = statValue + effectiveSkill + (statRollMod || 0);

  const roll = await new Roll(`1d10 + ${flatBonus}`).evaluate();

  const statLabel      = CONFIG.CYBER_BLUE.stats?.[statSlug]?.shortLabel ?? statSlug.toUpperCase();
  const skillLabel     = skillSlug ? (CONFIG.CYBER_BLUE.skills?.[skillSlug]?.label ?? skillSlug) : null;
  const componentLabel = componentSlug ? (CONFIG.CYBER_BLUE.components?.[componentSlug]?.label ?? componentSlug) : null;

  const bonusParts = [
    `${statLabel} ${statValue}`,
    skillLabel ? `${skillLabel} ${skillRank}` : null,
    componentLabel ? `(${componentLabel} ${componentRank})` : null,
    statRollMod ? `Mod ${statRollMod}` : null,
  ].filter(Boolean).join(' + ');

  const advances   = progress ? (roll.total >= dv) : (roll.total < dv);
  const resultKey  = advances ? 'CYBER_BLUE.Instructions.CheckAdvances' : 'CYBER_BLUE.Instructions.CheckEnds';
  const stepName   = step.name || game.i18n.localize('CYBER_BLUE.Instructions.Check');

  await roll.toMessage({
    speaker:  ChatMessage.getSpeaker({ actor }),
    flavor:   `
      <div class="cyberpunk-blue chat-card">
        <h3>${stepName}: ${item.name}</h3>
        <p>${bonusParts} vs DV <strong>${dv}</strong></p>
        <p><strong>${game.i18n.localize(resultKey)}</strong></p>
      </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  return { advances };
}

// ─── Context helper (used by actor-sheet.mjs) ────────────────────────────────

/**
 * Compute the instruction display context for an item in the actor sheet.
 * Returns { hasInstructions, instructionActive, instructionNextLabel }.
 */
export function getInstructionContext(itemData) {
  const steps = itemData.system?.instructions ?? [];
  if (!steps.length) return { hasInstructions: false, instructionActive: false, instructionNextLabel: '' };

  const active      = itemData.system?.instructionActive ?? false;
  const currentStep = itemData.system?.instructionStep ?? -1;

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

  return { hasInstructions: true, instructionActive: active, instructionNextLabel: nextLabel };
}
