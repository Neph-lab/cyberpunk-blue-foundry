/**
 * Martial Arts combat resolution for Cyberpunk Blue.
 *
 * Martial Arts is the skill; Aikido / Brawling / Karate / Judo / Taekwondo
 * are its Components.  Each attack uses BODY + Martial Arts (Component).
 * Two attacks per turn (RoF 2), must be within 2 metres, can target vitals.
 *
 * Damage by attacker BODY:
 *   < 5  → 1d6     5–7 → 2d6     8–10 → 3d6     > 10 → 4d6
 *
 * SP handling:
 *   Standard MA / Aikido / Brawling / Judo   → full SP applies
 *   Karate / Taekwondo                        → effective SP = ceil(SP / 2)
 *   Brawling "Strong Attack"                  → effective SP = ceil(SP / 2), SP NOT ablated
 *   Taekwondo "Flying Kick"                   → effective SP = ceil(SP / 4)
 */

import {
  detectCriticalDice,
  confirmDamageDialog,
  CRITICAL_INJURY_TABLE,
  CRITICAL_HEAD_INJURY_TABLE,
} from './critical-injury.mjs';
import { recordCombatAttack } from './combat-tracker.mjs';
import { getSkillCheckPreview } from './roll-preview.mjs';
import {
  applyDamageWithPermission,
  rollCriticalInjuryWithPermission,
  toggleStatusEffectWithPermission,
  updateActorWithPermission,
  unsetFlagWithPermission,
  createActiveEffectWithPermission,
  applyForcedCriticalInjuryWithPermission,
} from './socket.mjs';
import { playSfx } from './audio.mjs';
import { getTarget, getDistanceMeters, rollTargetEvasion } from './targeting.mjs';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MA_COMPONENTS = ['aikido', 'brawling', 'karate', 'judo', 'taekwondo'];
const HALF_SP_COMPONENTS = new Set(['karate', 'taekwondo']); // ignore half SP
const GRAB_BONUS_COMPONENTS = new Set(['aikido', 'brawling', 'judo']); // +1 on grab contest

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Damage formula based on BODY stat. */
export function getMartialArtsDamage(bodyValue) {
  if (bodyValue >= 11) return '4d6';
  if (bodyValue >= 8) return '3d6';
  if (bodyValue >= 5) return '2d6';
  return '1d6';
}

/**
 * Extra MA damage dice from cyberware AEs (e.g. Big Knucks: +1d6).
 * Sums the `maExtraDamageDice` flag across all applied effects — including
 * item-transferred ones, which never appear in `actor.effects` now that
 * legacyTransferral is off.
 */
function getMaExtraDamageDice(actor) {
  let total = 0;
  for (const effect of actor.appliedEffects ?? []) {
    const val = effect.getFlag('cyberpunk-blue', 'maExtraDamageDice');
    if (typeof val === 'number' && val > 0) total += val;
  }
  return total;
}

/**
 * Full MA damage formula, including cyberware extra dice.
 * Use this everywhere a damage roll string is needed.
 */
export function buildMaDamageFormula(actor) {
  const bodyValue = actor.system?.stats?.body?.value ?? 0;
  const base = getMartialArtsDamage(bodyValue);
  const extra = getMaExtraDamageDice(actor);
  return extra > 0 ? `${base} + ${extra}d6` : base;
}

/** Return the component slug with the highest rank (or null if all are 0). */
function getBestComponent(actor) {
  let bestSlug = null;
  let bestRank = 0;
  for (const slug of MA_COMPONENTS) {
    const rank = actor.system.components?.[slug]?.rank ?? 0;
    if (rank > bestRank) { bestRank = rank; bestSlug = slug; }
  }
  return { slug: bestSlug, rank: bestRank };
}

/** Effective SP after martial arts SP modifiers. */
function effectiveSP(rawSP, spMode) {
  if (spMode === 'half') return Math.ceil(rawSP / 2);
  if (spMode === 'quarter') return Math.ceil(rawSP / 4);
  return rawSP;
}

/**
 * Roll a Grab/Counter-throw contest for one actor.
 * Formula: 1d10 + max(BODY, RFLX) + min(maRank, bestCompRank) + [rollMod] + [+1 bonus]
 */
async function rollGrabContest(actor, { displayChat = true, label = '' } = {}) {
  const maRank = actor.system.skills?.martialArts?.rank ?? 0;
  const { slug: bestSlug, rank: bestRank } = getBestComponent(actor);
  const usedRank = bestRank > 0 ? Math.min(maRank, bestRank) : maRank;
  const grabBonus = GRAB_BONUS_COMPONENTS.has(bestSlug) ? 1 : 0;

  const bodyVal = actor.system.stats?.body?.value ?? 0;
  const rflxVal = actor.system.stats?.rflx?.value ?? 0;
  const statVal = Math.max(bodyVal, rflxVal);
  const bodyMod = actor.system.stats?.body?.rollMod ?? 0;
  const rflxMod = actor.system.stats?.rflx?.rollMod ?? 0;
  const statMod = (bodyVal >= rflxVal ? bodyMod : rflxMod);

  const terms = ['1d10', `+ ${statVal}`, `+ ${usedRank}`];
  if (statMod) terms.push(statMod >= 0 ? `+ ${statMod}` : `- ${Math.abs(statMod)}`);
  if (grabBonus) terms.push(`+ ${grabBonus}`);
  const roll = await new Roll(terms.join(' ')).evaluate();

  if (displayChat) {
    const compLabel = bestSlug ? ` (${CONFIG.CYBER_BLUE.components?.[bestSlug]?.label ?? bestSlug})` : '';
    const statUsed = bodyVal >= rflxVal ? 'BODY' : 'RFLX';
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${label || actor.name} — Grab Contest</h3><p>${statUsed} ${statVal} + Martial Arts${compLabel} ${usedRank}${grabBonus ? ' +1 (component bonus)' : ''}${statMod ? ` + bonus ${statMod}` : ''} = <strong>${roll.total}</strong></p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }
  return roll;
}

/**
 * Post a damage result to chat and ask the GM to confirm application.
 * Mirrors the standard weapon damage flow.
 */
async function applyMartialArtsDamage({
  attacker, targetActor, damageFormula, spMode = 'normal',
  ablatesArmor: noAblation = false, targetVitals = false, label = 'Martial Arts',
  forcedCritKey = null,
}) {
  const rawSP = targetActor?.system?.resources?.armor?.value ?? null;
  const sp = rawSP !== null ? effectiveSP(rawSP, spMode) : null;

  const damageRoll = await new Roll(damageFormula).evaluate();
  const { count: critDiceCount } = detectCriticalDice(damageRoll);
  const penetratesWithoutBonus = sp === null ? damageRoll.total > 0 : damageRoll.total > sp;
  const isCritical = (forcedCritKey != null) || (critDiceCount >= 2 && penetratesWithoutBonus);

  const vitalsBonus = (targetVitals && penetratesWithoutBonus) ? 5 : 0;
  const critBonus = isCritical ? 5 : 0;
  const finalDamage = damageRoll.total + critBonus + vitalsBonus;

  const tableType = targetVitals ? 'head' : 'body';
  const netDamage = sp !== null ? Math.max(finalDamage - sp, 0) : finalDamage;
  const ablatesArmor = !noAblation && sp !== null && finalDamage >= sp;

  const bonusNotes = [];
  if (isCritical) bonusNotes.push(game.i18n.localize('CYBER_BLUE.CriticalInjury.CritBonus'));
  if (vitalsBonus) bonusNotes.push(game.i18n.localize('CYBER_BLUE.Combat.TargetVitalsBonus'));
  const totalBonus = critBonus + vitalsBonus;
  const critLine = bonusNotes.length
    ? `<p class="crit-roll-note"><i class="fas fa-skull"></i> ${bonusNotes.join(' · ')}</p>` : '';
  const spNote = sp !== null
    ? `${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp}${rawSP !== sp ? ` (raw ${rawSP})` : ''} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}${totalBonus ? ` (+${totalBonus})` : ''}`
    : `${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>`;
  const targetVitalsLine = targetVitals
    ? `<p class="target-vitals-note"><i class="fas fa-crosshairs"></i> ${game.i18n.localize('CYBER_BLUE.Combat.TargetVitalsActive')}</p>` : '';

  const damageFlavorHtml = `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Damage')}: ${label}</h3>${targetVitalsLine}<p>${spNote}</p>${critLine}</div>`;

  if (targetActor && (netDamage > 0 || ablatesArmor)) {
    const result = await confirmDamageDialog({
      targetActor, finalDamage, sp, netDamage, ablatesArmor,
      isCritical: isCritical && !forcedCritKey, critDiceCount,
    });
    if (result?.confirmed) {
      await damageRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor: damageFlavorHtml,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      await applyDamageWithPermission(targetActor, finalDamage);
      if (isCritical) {
        if (forcedCritKey) {
          await applyForcedCriticalInjuryWithPermission(targetActor, forcedCritKey, attacker);
        } else {
          await rollCriticalInjuryWithPermission(targetActor, tableType, { attackerActor: attacker });
        }
      }
    }
  } else {
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: damageFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }
  return { isCritical, netDamage, finalDamage };
}

// ─── Standard Martial Arts Attack ─────────────────────────────────────────────

/**
 * Resolve a standard MA attack.
 *
 * @param {Actor}  attacker
 * @param {string|null} componentSlug  e.g. 'karate', or null for generic MA
 * @param {object} opts
 * @param {boolean} opts.targetVitals
 * @param {number}  opts.maIndex       Index used for RoF tracking
 * @param {number}  opts.attackModifier Extra modifier (e.g. -4 for Bone Breaking)
 * @param {boolean} opts.noSpAblation  True for Brawling Strong Attack
 * @param {string}  opts.spMode        'normal' | 'half' | 'quarter'
 * @param {string|null} opts.forcedCritKey  Force a specific injury key
 * @param {boolean} opts.allowArmor    If false, no SP applied (Choke/Throw)
 */
export async function resolveMartialArtsAttack(attacker, componentSlug, {
  targetVitals = false,
  maIndex = 0,
  attackModifier = 0,
  noSpAblation = false,
  spMode = null,
  forcedCritKey = null,
  allowArmor = true,
} = {}) {
  const { token: targetToken, actor: targetActor } = getTarget();

  // Range check (must be within 2 m)
  const dist = getDistanceMeters(attacker, targetToken);
  if (dist !== null && dist > 2) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.OutOfRange', { dist: dist.toFixed(1) }));
    return;
  }

  const rawSP = allowArmor && targetActor ? (targetActor.system?.resources?.armor?.value ?? null) : null;

  // Determine SP mode from component if not overridden
  const resolvedSpMode = spMode ?? (HALF_SP_COMPONENTS.has(componentSlug) ? 'half' : 'normal');
  const sp = rawSP !== null ? effectiveSP(rawSP, resolvedSpMode) : null;

  // Target Vitals: -8 penalty
  const targetVitalsPenalty = targetVitals ? -(CONFIG.CYBER_BLUE?.targetVitalsPenalty ?? 8) : 0;
  const totalModifier = attackModifier + targetVitalsPenalty;

  const compLabel = componentSlug
    ? ` (${CONFIG.CYBER_BLUE.components?.[componentSlug]?.label ?? componentSlug})` : '';
  const attackTitle = `Martial Arts${compLabel}`;

  // Show attack dialog — no DV input or evasion checkbox; evasion is auto-rolled afterwards.
  const targetLine = targetActor
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Target')}: <strong>${targetActor.name}</strong>${sp !== null ? ` (SP ${sp}${rawSP !== sp ? `, raw ${rawSP}` : ''})` : ''}</p>` : '';
  const meleeEvasionNote = targetActor
    ? `<p><em><i class="fas fa-person-running"></i> ${game.i18n.localize('CYBER_BLUE.Combat.MeleeAutoEvasion')}</em></p>`
    : '';

  const dialogResult = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('CYBER_BLUE.Combat.Attack')}: ${attackTitle}` },
      content: `<div class="cyberpunk-blue" style="padding:.5rem;">${targetLine}${meleeEvasionNote}</div>`,
      buttons: [
        {
          action: 'roll', icon: 'fa-solid fa-dice-d10',
          label: game.i18n.localize('CYBER_BLUE.Combat.RollAttack'),
          default: true,
          callback: () => ({}),
        },
        {
          action: 'cancel', icon: 'fa-solid fa-xmark',
          label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
          callback: () => null,
        },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(null), { once: true });
    dialog.render(true);
  });
  if (!dialogResult) return;

  playSfx('martial-arts-attack');

  // Evasion: always auto-roll; evasion result IS the DV (no target = no DV, auto-hit).
  let resolvedDV = null;
  if (targetActor) {
    const evasionRoll = await rollTargetEvasion(targetActor);
    resolvedDV = evasionRoll.total;
  }

  // Attack roll
  const attackRoll = await attacker.rollSkill({
    skillSlug: 'martialArts',
    componentSlug,
    modifier: totalModifier,
    dv: resolvedDV,
  });

  // RoF tracking — key must match buildMartialArtsContext (`${actorId}::ma-N`, RoF 2).
  const attackerToken = attacker.getActiveTokens()[0];
  const attackerCombatant = (attackerToken && game.combat?.started)
    ? (game.combat.combatants.find((c) => c.tokenId === attackerToken.document.id) ?? null)
    : null;
  if (attackerCombatant) {
    await recordCombatAttack(attackerCombatant, attacker.id, `ma-${maIndex}`, 2);
  }

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;
  if (!hit) return;

  // Damage
  const damageFormula = buildMaDamageFormula(attacker);

  const damageResult = await applyMartialArtsDamage({
    attacker, targetActor,
    damageFormula,
    spMode: resolvedSpMode,
    ablatesArmor: !noSpAblation,
    targetVitals,
    label: attackTitle,
    forcedCritKey,
  });

  // Disarming Combination — offer to Aikido practitioners after a confirmed hit
  if (targetActor && componentSlug !== null && (attacker.system.components?.aikido?.rank ?? 0) > 0) {
    await offerDisarmingCombination(attacker, targetActor);
  }

  return { hit, attackRoll, targetActor, ...damageResult };
}

// ─── Special Moves — Universal ────────────────────────────────────────────────

/** Grab contest — Grapple or take something. */
export async function resolveGrab(attacker) {
  const { token: targetToken, actor: targetActor } = getTarget();
  if (!targetActor) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }
  const dist = getDistanceMeters(attacker, targetToken);
  if (dist !== null && dist > 2) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.OutOfRange', { dist: dist.toFixed(1) }));
    return;
  }

  const attackerRoll = await rollGrabContest(attacker, { label: `${attacker.name} — Grab` });
  const defenderRoll = await rollGrabContest(targetActor, { label: `${targetActor.name} — Grab (Defense)` });

  const success = attackerRoll.total >= defenderRoll.total;
  const resultMsg = success
    ? game.i18n.format('CYBER_BLUE.MartialArts.GrabSuccess', { attacker: attacker.name, target: targetActor.name })
    : game.i18n.format('CYBER_BLUE.MartialArts.GrabFailed', { attacker: attacker.name, target: targetActor.name });

  if (success) {
    // Apply Grappled condition to target (attacker stores flag for tracking)
    await toggleStatusEffectWithPermission(targetActor, 'grappled', true);
    await attacker.setFlag('cyberpunk-blue', `grapplingTarget-${targetActor.id}`, true);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.Grab')}</h3><p>${resultMsg}</p></div>`,
  });
}

/** Choke — BODY damage ignoring SP to a grappled target. */
export async function resolveChoke(attacker) {
  const { actor: targetActor } = getTarget();
  if (!targetActor) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }

  // Check: target is grappled by this attacker
  const isGrappling = attacker.getFlag('cyberpunk-blue', `grapplingTarget-${targetActor.id}`);
  if (!isGrappling) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.NotGrappling', { target: targetActor.name }));
    return;
  }

  const bodyValue = attacker.system?.stats?.body?.value ?? 0;
  const currentHp = targetActor.system?.resources?.hp?.value ?? 0;

  // Choke counter tracking via attacker flag
  const chokeKey = `chokeCount-${targetActor.id}`;
  const chokeCount = (attacker.getFlag('cyberpunk-blue', chokeKey) ?? 0) + 1;
  await attacker.setFlag('cyberpunk-blue', chokeKey, chokeCount);

  const wouldDropBelow1 = currentHp - bodyValue < 1;
  const threeConsecutive = chokeCount >= 3;

  let chatContent;
  if (wouldDropBelow1 || threeConsecutive) {
    // Force target to 1 HP and apply Unconscious
    await updateActorWithPermission(targetActor, { 'system.resources.hp.value': 1 });
    await toggleStatusEffectWithPermission(targetActor, 'unconscious', true);
    await attacker.setFlag('cyberpunk-blue', chokeKey, 0);
    chatContent = `<p><strong>${targetActor.name}</strong> is reduced to 1 HP and is now <strong>Unconscious</strong> (${threeConsecutive ? 'three consecutive chokes' : 'would drop below 1 HP'}).</p>`;
  } else {
    await applyDamageWithPermission(targetActor, bodyValue);
    chatContent = `<p>${game.i18n.format('CYBER_BLUE.MartialArts.ChokeDamage', { target: targetActor.name, damage: bodyValue })} (choke ${chokeCount}/3)</p>`;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.Choke')}</h3>${chatContent}</div>`,
  });
}

/** Recovery — DV 14 MA check to remove Prone. */
export async function resolveRecovery(attacker) {
  const DV = 14;
  const { slug: bestSlug } = getBestComponent(attacker);
  const roll = await attacker.rollSkill({ skillSlug: 'martialArts', componentSlug: bestSlug, dv: DV });
  if (roll.total >= DV) {
    await attacker.toggleStatusEffect('prone', { active: false });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.Recovery')}</h3><p>${game.i18n.format('CYBER_BLUE.MartialArts.RecoverySuccess', { actor: attacker.name })}</p></div>`,
    });
  } else {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.Recovery')}</h3><p>${game.i18n.format('CYBER_BLUE.MartialArts.RecoveryFailed', { actor: attacker.name })}</p></div>`,
    });
  }
}

/** Throw — BODY damage ignoring SP, applies Prone, ends grapple. */
export async function resolveThrow(attacker) {
  const { actor: targetActor } = getTarget();
  if (!targetActor) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }

  const isGrappling = attacker.getFlag('cyberpunk-blue', `grapplingTarget-${targetActor.id}`);
  if (!isGrappling) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.NotGrappling', { target: targetActor.name }));
    return;
  }

  const bodyValue = attacker.system?.stats?.body?.value ?? 0;
  await applyDamageWithPermission(targetActor, bodyValue); // ignores SP (direct HP)
  await toggleStatusEffectWithPermission(targetActor, 'prone', true);
  await toggleStatusEffectWithPermission(targetActor, 'grappled', false);
  await attacker.unsetFlag('cyberpunk-blue', `grapplingTarget-${targetActor.id}`);
  await attacker.unsetFlag('cyberpunk-blue', `chokeCount-${targetActor.id}`);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.Throw')}</h3><p>${game.i18n.format('CYBER_BLUE.MartialArts.ThrowSuccess', { target: targetActor.name, damage: bodyValue })}</p></div>`,
  });
}

// ─── Special Moves — Aikido ───────────────────────────────────────────────────

/** Iron Grip — apply -2 AE to escape attempts on grappled target. */
export async function resolveIronGrip(attacker) {
  const { actor: targetActor } = getTarget();
  if (!targetActor) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }

  const isGrappling = attacker.getFlag('cyberpunk-blue', `grapplingTarget-${targetActor.id}`);
  if (!isGrappling) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.NotGrappling', { target: targetActor.name }));
    return;
  }

  // -2 to escape attempts = -2 to BODY/RFLX rollMod for the target
  const existingIronGrip = targetActor.effects.find((e) => e.getFlag('cyberpunk-blue', 'ironGrip'));
  if (existingIronGrip) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.MartialArts.IronGripAlreadyActive'));
    return;
  }

  await createActiveEffectWithPermission(targetActor, {
    name: game.i18n.localize('CYBER_BLUE.MartialArts.IronGrip'),
    icon: 'icons/svg/net.svg',
    origin: attacker.uuid,
    disabled: false,
    transfer: false,
    system: { changes: [
      { key: 'system.stats.body.rollMod', type: 'add', value: '-2' },
      { key: 'system.stats.rflx.rollMod', type: 'add', value: '-2' },
    ] },
    flags: { 'cyberpunk-blue': { ironGrip: true } },
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.IronGrip')}</h3><p>${game.i18n.format('CYBER_BLUE.MartialArts.IronGripApplied', { target: targetActor.name })}</p></div>`,
  });
}

/**
 * Disarming Combination — offered automatically after a successful MA attack.
 * Call this from the attack resolver after a confirmed hit.
 */
export async function offerDisarmingCombination(attacker, targetActor) {
  const aikidoRank = attacker.system.components?.aikido?.rank ?? 0;
  if (aikidoRank <= 0) return;

  const wantsDisarm = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.MartialArts.DisarmingCombination') },
      content: `<div class="cyberpunk-blue" style="padding:.5rem;"><p>${game.i18n.localize('CYBER_BLUE.MartialArts.DisarmingCombinationPrompt')}</p></div>`,
      buttons: [
        { action: 'yes', icon: 'fa-solid fa-hand', label: game.i18n.localize('CYBER_BLUE.MartialArts.AttemptDisarm'), default: true, callback: () => true },
        { action: 'no', icon: 'fa-solid fa-xmark', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), callback: () => false },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(false), { once: true });
    dialog.render(true);
  });
  if (!wantsDisarm) return;

  const DV = 15;
  const roll = await attacker.rollSkill({ skillSlug: 'martialArts', componentSlug: 'aikido', dv: DV });
  const rflxVal = attacker.system?.stats?.rflx?.value ?? 0;
  const rflxMod = attacker.system?.stats?.rflx?.rollMod ?? 0;
  // Note: Disarming Combination uses RFLX, not BODY. Roll manually.
  const maRank = attacker.system.skills?.martialArts?.rank ?? 0;
  const aikRank = Math.min(maRank, aikidoRank);
  const formula = `1d10 + ${rflxVal} + ${aikRank}${rflxMod ? ` + ${rflxMod}` : ''}`;
  const disarmRoll = await new Roll(formula).evaluate();
  const success = disarmRoll.total >= DV;
  await disarmRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.DisarmingCombination')}</h3><p>RFLX ${rflxVal} + Martial Arts (Aikido) ${aikRank} vs DV ${DV}: <strong>${success ? game.i18n.localize('CYBER_BLUE.Sheet.Roll.Success') : game.i18n.localize('CYBER_BLUE.Sheet.Roll.Failure')}</strong></p>${success ? `<p>${game.i18n.format('CYBER_BLUE.MartialArts.DisarmSuccess', { target: targetActor?.name ?? '???' })}</p>` : ''}</div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}

// ─── Special Moves — Brawling ─────────────────────────────────────────────────

/** Strong Attack — Brawling attack ignoring half SP; SP is NOT ablated. */
export async function resolveStrongAttack(attacker, maIndex) {
  return resolveMartialArtsAttack(attacker, 'brawling', {
    targetVitals: attacker.getFlag('cyberpunk-blue', 'ma-targetVitals-0') ?? false,
    maIndex,
    spMode: 'half',
    noSpAblation: true,
  });
}

/** Improvised Weapon — choose melee type, use MA(Brawling). */
export async function resolveImprovisedWeapon(attacker, maIndex) {
  const brawlingRank = attacker.system.components?.brawling?.rank ?? 0;
  if (brawlingRank <= 0) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.BrawlingRequired')); return; }

  const choice = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.MartialArts.ImprovisedWeapon') },
      content: `<p>${game.i18n.localize('CYBER_BLUE.MartialArts.ImprovisedWeaponPrompt')}</p>`,
      buttons: [
        { action: 'light', label: `${game.i18n.localize('CYBER_BLUE.MartialArts.LightMelee')} (1d6)`, callback: () => ({ type: 'lightMelee', damage: '1d6' }) },
        { action: 'medium', label: `${game.i18n.localize('CYBER_BLUE.MartialArts.MediumMelee')} (2d6)`, default: true, callback: () => ({ type: 'mediumMelee', damage: '2d6' }) },
        { action: 'heavy', label: `${game.i18n.localize('CYBER_BLUE.MartialArts.HeavyMelee')} (3d6)`, callback: () => ({ type: 'heavyMelee', damage: '3d6' }) },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), callback: () => null },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(null), { once: true });
    dialog.render(true);
  });
  if (!choice) return;

  const { token: targetToken, actor: targetActor } = getTarget();
  const dist = getDistanceMeters(attacker, targetToken);
  if (dist !== null && dist > 2) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.OutOfRange', { dist: dist.toFixed(1) }));
    return;
  }

  const sp = targetActor ? (targetActor.system?.resources?.armor?.value ?? null) : null;
  const targetLine = targetActor ? `<p>Target: <strong>${targetActor.name}</strong>${sp !== null ? ` (SP ${sp})` : ''}</p>` : '';
  const dvLine = `<label style="display:flex;gap:.4rem;align-items:center;"><span>DV:</span><input type="number" id="attack-dv" value="" min="0" style="width:4rem;" placeholder="—" /></label>`;

  const dialogResult = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('CYBER_BLUE.MartialArts.ImprovisedWeapon')} — ${choice.type}` },
      content: `<div class="cyberpunk-blue" style="padding:.5rem;">${targetLine}<div style="margin-top:.4rem;">${dvLine}</div></div>`,
      buttons: [
        {
          action: 'roll', label: game.i18n.localize('CYBER_BLUE.Combat.RollAttack'), default: true,
          callback: (_e, btn) => Number(btn.form?.elements['attack-dv']?.value) || null,
        },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), callback: () => 'cancel' },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve('cancel'), { once: true });
    dialog.render(true);
  });
  if (dialogResult === 'cancel') return;

  const attackRoll = await attacker.rollSkill({ skillSlug: 'martialArts', componentSlug: 'brawling', dv: dialogResult });
  const attackerToken = attacker.getActiveTokens()[0];
  const attackerCombatant = (attackerToken && game.combat?.started)
    ? (game.combat.combatants.find((c) => c.tokenId === attackerToken.document.id) ?? null)
    : null;
  if (attackerCombatant) await recordCombatAttack(attackerCombatant, attacker.id, `ma-${maIndex}`, 2);
  const hit = dialogResult === null || attackRoll.total >= dialogResult;
  if (!hit) return;

  await applyMartialArtsDamage({
    attacker, targetActor,
    damageFormula: choice.damage,
    label: `${game.i18n.localize('CYBER_BLUE.MartialArts.ImprovisedWeapon')} (${choice.type})`,
  });
}

// ─── Special Moves — Karate ───────────────────────────────────────────────────

/** Bone Breaking Combination — -4 attack, guaranteed Broken Ribs (or Cracked Skull if vitals). */
export async function resolveBoneBreakingCombination(attacker, maIndex) {
  const targetVitals = await _askTargetVitals(game.i18n.localize('CYBER_BLUE.MartialArts.BoneBreakingCombination'));
  const forcedKey = targetVitals ? 'cracked-skull' : 'broken-ribs';
  return resolveMartialArtsAttack(attacker, 'karate', {
    targetVitals,
    maIndex,
    attackModifier: -4,
    forcedCritKey: forcedKey,
  });
}

async function _askTargetVitals(title) {
  return new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title },
      content: `<p>${game.i18n.localize('CYBER_BLUE.Combat.TargetVitalsHint')}</p>`,
      buttons: [
        { action: 'vitals', label: game.i18n.localize('CYBER_BLUE.Combat.TargetVitals'), callback: () => true },
        { action: 'body', label: game.i18n.localize('CYBER_BLUE.CriticalInjury.InjuryLocationBody'), default: true, callback: () => false },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(false), { once: true });
    dialog.render(true);
  });
}

/** Armor Breaking Combination — offered after a successful melee/MA attack; recorded externally. */
export async function resolveArmorBreakingCombination(attacker, targetActor) {
  if (!targetActor) return;
  const DV = 17;
  // First make a MA(Karate) attack against target
  const kaRoll = await attacker.rollSkill({ skillSlug: 'martialArts', componentSlug: 'karate' });
  // Then make a DV 17 check
  const dvRoll = await attacker.rollSkill({ skillSlug: 'martialArts', componentSlug: 'karate', dv: DV });
  if (dvRoll.total >= DV) {
    // Reduce target's SP by 1 extra
    const currentSP = targetActor.system?.resources?.armor?.value ?? 0;
    if (currentSP > 0) {
      await updateActorWithPermission(targetActor, { 'system.resources.armor.value': currentSP - 1 });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.ArmorBreakingCombination')}</h3><p>${game.i18n.format('CYBER_BLUE.MartialArts.ArmorBreakSuccess', { target: targetActor.name, sp: currentSP - 1 })}</p></div>`,
      });
    }
  }
}

// ─── Special Moves — Judo ────────────────────────────────────────────────────

/** Counter Throw — DV 17 RFLX+MA(Judo), target Prone, then offer MA attack. */
export async function resolveCounterThrow(attacker, maIndex) {
  const { token: targetToken, actor: targetActor } = getTarget();
  if (!targetActor) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }

  const dist = getDistanceMeters(attacker, targetToken);
  if (dist !== null && dist > 2) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.OutOfRange', { dist: dist.toFixed(1) }));
    return;
  }

  const DV = 17;
  const maRank = attacker.system.skills?.martialArts?.rank ?? 0;
  const judoRank = attacker.system.components?.judo?.rank ?? 0;
  const usedRank = Math.min(maRank, judoRank);
  const rflxVal = attacker.system?.stats?.rflx?.value ?? 0;
  const rflxMod = attacker.system?.stats?.rflx?.rollMod ?? 0;
  const formula = `1d10 + ${rflxVal} + ${usedRank}${rflxMod ? ` + ${rflxMod}` : ''}`;
  const roll = await new Roll(formula).evaluate();
  const success = roll.total >= DV;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.CounterThrow')}</h3><p>RFLX ${rflxVal} + Martial Arts (Judo) ${usedRank} vs DV ${DV}: <strong>${success ? game.i18n.localize('CYBER_BLUE.Sheet.Roll.Success') : game.i18n.localize('CYBER_BLUE.Sheet.Roll.Failure')}</strong></p></div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  if (!success) return;

  await toggleStatusEffectWithPermission(targetActor, 'prone', true);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><p>${game.i18n.format('CYBER_BLUE.MartialArts.CounterThrowSuccess', { target: targetActor.name })}</p></div>`,
  });

  // Offer follow-up MA attack
  const doAttack = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.MartialArts.CounterThrowFollowUp') },
      content: `<p>${game.i18n.localize('CYBER_BLUE.MartialArts.CounterThrowFollowUpPrompt')}</p>`,
      buttons: [
        { action: 'yes', label: game.i18n.localize('CYBER_BLUE.MartialArts.MakeAttack'), default: true, callback: () => true },
        { action: 'no', label: game.i18n.localize('CYBER_BLUE.MartialArts.Skip'), callback: () => false },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(false), { once: true });
    dialog.render(true);
  });

  if (doAttack) {
    // Pick component for follow-up
    const activeComps = MA_COMPONENTS.filter((c) => (attacker.system.components?.[c]?.rank ?? 0) > 0);
    const comp = activeComps.length > 0 ? activeComps[0] : null;
    await resolveMartialArtsAttack(attacker, comp, { maIndex });
  }
}

/** Grab Escape — DV 17 RFLX+MA(Judo), end grapple, apply Broken Arm to attacker. */
export async function resolveGrabEscape(escapee) {
  const { actor: grappler } = getTarget();
  if (!grappler) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }

  const DV = 17;
  const maRank = escapee.system.skills?.martialArts?.rank ?? 0;
  const judoRank = escapee.system.components?.judo?.rank ?? 0;
  const usedRank = Math.min(maRank, judoRank);
  const rflxVal = escapee.system?.stats?.rflx?.value ?? 0;
  const rflxMod = escapee.system?.stats?.rflx?.rollMod ?? 0;
  const formula = `1d10 + ${rflxVal} + ${usedRank}${rflxMod ? ` + ${rflxMod}` : ''}`;
  const roll = await new Roll(formula).evaluate();
  const success = roll.total >= DV;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: escapee }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.GrabEscape')}</h3><p>RFLX ${rflxVal} + Martial Arts (Judo) ${usedRank} vs DV ${DV}: <strong>${success ? game.i18n.localize('CYBER_BLUE.Sheet.Roll.Success') : game.i18n.localize('CYBER_BLUE.Sheet.Roll.Failure')}</strong></p></div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  if (!success) return;

  // End grapple
  await toggleStatusEffectWithPermission(escapee, 'grappled', false);
  await unsetFlagWithPermission(grappler, 'cyberpunk-blue', `grapplingTarget-${escapee.id}`);

  // Apply Broken Arm to grappler (player chooses side)
  const side = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.MartialArts.ChooseArm') },
      content: `<p>${game.i18n.format('CYBER_BLUE.MartialArts.BrokenArmPrompt', { target: grappler.name })}</p>`,
      buttons: [
        { action: 'left', label: game.i18n.localize('CYBER_BLUE.CriticalInjury.Side.Left'), callback: () => 'left' },
        { action: 'right', label: game.i18n.localize('CYBER_BLUE.CriticalInjury.Side.Right'), default: true, callback: () => 'right' },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve('right'), { once: true });
    dialog.render(true);
  });

  const injName = `${game.i18n.localize(`CYBER_BLUE.CriticalInjury.Side.${side === 'left' ? 'Left' : 'Right'}`)} ${game.i18n.localize('CYBER_BLUE.CriticalInjury.Body.BrokenArm')}`;
  const entry = Object.values(CRITICAL_INJURY_TABLE).find((e) => e.key === 'broken-arm');
  if (entry) {
    await createActiveEffectWithPermission(grappler, {
      name: injName,
      icon: 'icons/svg/bones.svg',
      origin: grappler.uuid,
      disabled: false,
      transfer: false,
      system: { changes: entry.changes ?? [] },
      flags: {
        'cyberpunk-blue': {
          criticalInjury: {
            key: 'broken-arm', tableType: 'body', mortal: false,
            descKey: entry.descKey, side, noQuickFix: false,
            quickFixDv: entry.quickFixDv, quickFixUsed: false,
            treatmentDv: entry.treatmentDv, surgeryRequired: entry.surgeryRequired,
            surgeryDv: entry.surgeryDv,
          },
        },
      },
    });
  }
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: escapee }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.MartialArts.GrabEscape')}</h3><p>${game.i18n.format('CYBER_BLUE.MartialArts.GrabEscapeSuccess', { escapee: escapee.name, grappler: grappler.name, injury: injName })}</p></div>`,
  });
}

// ─── Special Moves — Taekwondo ────────────────────────────────────────────────

/** Pressure Point Strike — -6 attack, guaranteed Spinal Injury (or Brain Injury if vitals). */
export async function resolvePressurePointStrike(attacker, maIndex) {
  const targetVitals = await _askTargetVitals(game.i18n.localize('CYBER_BLUE.MartialArts.PressurePointStrike'));
  const forcedKey = targetVitals ? 'brain-injury' : 'spinal-injury';
  return resolveMartialArtsAttack(attacker, 'taekwondo', {
    targetVitals,
    maIndex,
    attackModifier: -6,
    forcedCritKey: forcedKey,
  });
}

/** Flying Kick — target must be 4+ m away; SP/4; knockback if RFLX or BODY > target BODY. */
export async function resolveFlyingKick(attacker, maIndex) {
  const { token: targetToken, actor: targetActor } = getTarget();
  if (!targetActor) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.MartialArts.TargetRequired')); return; }

  const dist = getDistanceMeters(attacker, targetToken);
  if (dist !== null && dist < 4) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.MartialArts.FlyingKickTooClose', { dist: dist?.toFixed(1) ?? '?' }));
    return;
  }

  const rawSP = targetActor.system?.resources?.armor?.value ?? null;
  const sp = rawSP !== null ? Math.ceil(rawSP / 4) : null;

  const targetLine = `<p>Target: <strong>${targetActor.name}</strong>${sp !== null ? ` (SP ${sp}, raw ${rawSP})` : ''}</p>`;
  const dvLine = `<label style="display:flex;gap:.4rem;align-items:center;"><span>DV:</span><input type="number" id="attack-dv" value="" min="0" style="width:4rem;" placeholder="—" /></label>`;
  const dialogResult = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.MartialArts.FlyingKick') },
      content: `<div class="cyberpunk-blue" style="padding:.5rem;">${targetLine}<div style="margin-top:.4rem;">${dvLine}</div></div>`,
      buttons: [
        {
          action: 'roll', label: game.i18n.localize('CYBER_BLUE.Combat.RollAttack'), default: true,
          callback: (_e, btn) => Number(btn.form?.elements['attack-dv']?.value) || null,
        },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), callback: () => 'cancel' },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve('cancel'), { once: true });
    dialog.render(true);
  });
  if (dialogResult === 'cancel') return;

  const attackRoll = await attacker.rollSkill({ skillSlug: 'martialArts', componentSlug: 'taekwondo', dv: dialogResult });
  const attackerToken = attacker.getActiveTokens()[0];
  const attackerCombatant = (attackerToken && game.combat?.started)
    ? (game.combat.combatants.find((c) => c.tokenId === attackerToken.document.id) ?? null)
    : null;
  if (attackerCombatant) await recordCombatAttack(attackerCombatant, attacker.id, `ma-${maIndex}`, 2);

  const hit = dialogResult === null || attackRoll.total >= dialogResult;
  if (!hit) return;

  const damageFormula = buildMaDamageFormula(attacker);
  await applyMartialArtsDamage({
    attacker, targetActor,
    damageFormula,
    spMode: 'quarter',
    label: game.i18n.localize('CYBER_BLUE.MartialArts.FlyingKick'),
  });

  // Knockback check
  const atkRflx = attacker.system?.stats?.rflx?.value ?? 0;
  const atkBody = attacker.system?.stats?.body?.value ?? 0;
  const defBody = targetActor.system?.stats?.body?.value ?? 0;
  const knockbackDist = Math.max(atkRflx - defBody, atkBody - defBody, 0);
  if (knockbackDist > 0) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p>${game.i18n.format('CYBER_BLUE.MartialArts.FlyingKickKnockback', { target: targetActor.name, dist: knockbackDist })}</p></div>`,
    });
  }
}

// ─── Context builder (called from actor-sheet.mjs) ────────────────────────────

/**
 * Build the martial arts context object for the actor sheet.
 *
 * @param {Actor}  actor
 * @param {object} rofState  Result of getCombatAttackState() or null
 * @returns {{ martialArtsAttacks: object[], martialArtsSpecialMoves: object[] }}
 */
export function buildMartialArtsContext(actor, rofState) {
  const maSkillRank = actor.system.skills?.martialArts?.rank ?? 0;
  const activeComponents = MA_COMPONENTS.filter((c) => (actor.system.components?.[c]?.rank ?? 0) > 0);

  const martialArtsAttacks = [];
  const damage = buildMaDamageFormula(actor);

  const shouldShow = maSkillRank > 0 || activeComponents.length > 0;
  if (!shouldShow) return { martialArtsAttacks: [], martialArtsSpecialMoves: [] };

  // One attack entry per active component (or a generic entry if none)
  const components = activeComponents.length > 0 ? activeComponents : [null];
  components.forEach((compSlug, idx) => {
    const roll = getSkillCheckPreview(actor, 'martialArts', compSlug);
    const compLabel = compSlug
      ? (CONFIG.CYBER_BLUE.components?.[compSlug]?.label ?? compSlug) : null;
    const maKey = `ma-${idx}`;
    const rofKey = `${actor.id}::${maKey}`;
    const rofEntry = rofState?.rofAttacks?.[rofKey] ?? null;
    const sameAttack = rofEntry !== null;
    const rofExhausted = sameAttack && rofEntry.used >= 2;
    const rofLocked = !!(rofState?.actionUsed) && !sameAttack;
    const targetVitals = actor.getFlag('cyberpunk-blue', `ma-targetVitals-${idx}`) ?? false;

    martialArtsAttacks.push({
      componentSlug: compSlug,
      componentLabel: compLabel,
      attackLabel: roll.mod,
      attackTooltip: roll.tooltip,
      roll,
      damage,
      rateOfFire: 2,
      attacksUsed: rofEntry?.used ?? 0,
      rofExhausted,
      rofLocked,
      attackDisabled: rofExhausted || rofLocked,
      targetVitals,
      maIndex: idx,
    });
  });

  // Special moves
  const martialArtsSpecialMoves = [
    // Universal
    { id: 'grab',     nameKey: 'CYBER_BLUE.MartialArts.Grab',     descKey: 'CYBER_BLUE.MartialArts.GrabDesc',     requiresComponent: null },
    { id: 'choke',    nameKey: 'CYBER_BLUE.MartialArts.Choke',    descKey: 'CYBER_BLUE.MartialArts.ChokeDesc',    requiresComponent: null },
    { id: 'recovery', nameKey: 'CYBER_BLUE.MartialArts.Recovery', descKey: 'CYBER_BLUE.MartialArts.RecoveryDesc', requiresComponent: null },
    { id: 'throw',    nameKey: 'CYBER_BLUE.MartialArts.Throw',    descKey: 'CYBER_BLUE.MartialArts.ThrowDesc',    requiresComponent: null },
    // Aikido
    { id: 'disarming-combination', nameKey: 'CYBER_BLUE.MartialArts.DisarmingCombination', descKey: 'CYBER_BLUE.MartialArts.DisarmingCombinationDesc', requiresComponent: 'aikido' },
    { id: 'iron-grip',             nameKey: 'CYBER_BLUE.MartialArts.IronGrip',             descKey: 'CYBER_BLUE.MartialArts.IronGripDesc',             requiresComponent: 'aikido' },
    // Brawling
    { id: 'improvised-weapon', nameKey: 'CYBER_BLUE.MartialArts.ImprovisedWeapon', descKey: 'CYBER_BLUE.MartialArts.ImprovisedWeaponDesc', requiresComponent: 'brawling' },
    { id: 'strong-attack',     nameKey: 'CYBER_BLUE.MartialArts.StrongAttack',     descKey: 'CYBER_BLUE.MartialArts.StrongAttackDesc',     requiresComponent: 'brawling' },
    // Karate
    { id: 'armor-breaking-combination', nameKey: 'CYBER_BLUE.MartialArts.ArmorBreakingCombination', descKey: 'CYBER_BLUE.MartialArts.ArmorBreakingCombinationDesc', requiresComponent: 'karate' },
    { id: 'bone-breaking-combination',  nameKey: 'CYBER_BLUE.MartialArts.BoneBreakingCombination',  descKey: 'CYBER_BLUE.MartialArts.BoneBreakingCombinationDesc',  requiresComponent: 'karate' },
    // Judo
    { id: 'counter-throw', nameKey: 'CYBER_BLUE.MartialArts.CounterThrow', descKey: 'CYBER_BLUE.MartialArts.CounterThrowDesc', requiresComponent: 'judo' },
    { id: 'grab-escape',   nameKey: 'CYBER_BLUE.MartialArts.GrabEscape',   descKey: 'CYBER_BLUE.MartialArts.GrabEscapeDesc',   requiresComponent: 'judo' },
    // Taekwondo
    { id: 'pressure-point-strike', nameKey: 'CYBER_BLUE.MartialArts.PressurePointStrike', descKey: 'CYBER_BLUE.MartialArts.PressurePointStrikeDesc', requiresComponent: 'taekwondo' },
    { id: 'flying-kick',           nameKey: 'CYBER_BLUE.MartialArts.FlyingKick',           descKey: 'CYBER_BLUE.MartialArts.FlyingKickDesc',           requiresComponent: 'taekwondo' },
  ].filter((move) => {
    if (!move.requiresComponent) return true;
    return (actor.system.components?.[move.requiresComponent]?.rank ?? 0) > 0;
  }).map((move) => ({
    ...move,
    name: game.i18n.localize(move.nameKey),
    desc: game.i18n.localize(move.descKey),
  }));

  return { martialArtsAttacks, martialArtsSpecialMoves };
}
