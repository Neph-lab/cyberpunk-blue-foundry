/**
 * Combat turn/round lifecycle workflows, driven by CyberBlueCombat's
 * `_onEndTurn` / `_onStartRound` / `_onStartTurn` overrides.
 *
 * Core runs those after the Combat update, for the one active GM only, and
 * passes the combatant whose turn ended or began — including across a round
 * wrap and for every turn passed over when the combat jumps ahead. A skipped
 * turn (`context.skipped`) still represents time passing with no actions
 * taken, so every per-turn effect here applies to it too. Rewinding a turn or
 * round fires none of these.
 *
 * Previously this lived in `combatTurn` / `combatRound` hooks, which fire
 * before the update and found the ending combatant via `combat.previous` — a
 * different combatant once 14.369 restored its conditional assignment.
 */

import { resetTurnState } from './combat-tracker.mjs';
import { resolveNetTimers } from './netrunning.mjs';
import { executeVehicleTurn } from './vehicle-combat.mjs';
import { clearWeaponCharge } from './tech-charge.mjs';
import { getPixelsPerMeter, getTokenCenter } from './targeting.mjs';
import { applyDamageWithPermission } from './socket.mjs';

/** Re-render the tracker and the given actor's open sheet so RoF buttons and the movement bar refresh. */
function refreshTurnUi(actor) {
  ui.combat?.render(false);
  actor?.sheet?.render(false);
}

/**
 * End of a combatant's turn: reset their turn state, then resolve the
 * Mortally Wounded death save and Burning damage-over-time.
 * @param {Combat} combat
 * @param {Combatant} combatant
 */
export async function onCombatTurnEnd(combat, combatant) {
  await resetTurnState(combatant);
  const actor = combatant.actor;
  refreshTurnUi(actor);
  if (!actor) return;

  // ── Mortally Wounded: 1d10 vs Death Save (conscious→unconscious→Dead) ──────
  if (actor.getMortallyWoundedEffect?.()) {
    await actor.rollMortalDeathSave();
  }

  // ── Burning condition damage-over-time ───────────────────────────────────
  // Each active Burning condition deals its per-turn HP (ignoring armor).
  // Driven here because the statusEffect's `burnDamage` flag is otherwise inert.
  if (['character', 'npc', 'mook'].includes(actor.type)) {
    let burn = 0;
    for (const e of actor.effects) {
      if (e.disabled) continue;
      const d = e.getFlag('cyberpunk-blue', 'burnDamage');
      if (typeof d === 'number') burn += d;
    }
    if (burn > 0) {
      await actor.applyDamage(burn, { ignoreArmor: true });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-fire"></i> ${game.i18n.format('CYBER_BLUE.Condition.BurningDamage', { name: actor.name, dmg: burn })}</p></div>`,
      });
    }
  }
}

/**
 * Start of a round: reset every combatant's turn state.
 * @param {Combat} combat
 */
export async function onCombatRoundStart(combat) {
  for (const combatant of combat.combatants.contents) {
    await resetTurnState(combatant);
  }
  ui.combat?.render(false);
  for (const combatant of combat.combatants.contents) {
    combatant.actor?.sheet?.render(false);
  }
}

/**
 * Start of a combatant's turn: reset their turn state, resolve NET timers,
 * Tech Weapon charge housekeeping, Chomp Ammo detonation, and the vehicle's
 * automatic turn.
 * @param {Combat} combat
 * @param {Combatant} combatant
 * @param {{round: number, turn: number}} context
 */
export async function onCombatTurnStart(combat, combatant, { round, turn }) {
  await resetTurnState(combatant);
  const actor = combatant.actor;
  refreshTurnUi(actor);

  // Resolve pending NET timers (quickhack activation, encrypt/decrypt completion)
  await resolveNetTimers(combat, round);

  if (actor) {
    await techWeaponTurnStart(actor, round);
    await detonateChompAmmo(actor, combatant, round, turn);
  }

  // ── Vehicle turn execution ───────────────────────────────────────────────
  // Coast if a driver is present, drift if unmanned, or acknowledge a pending
  // Maneuver. Runs after the reset so the combatant's state is clean.
  if (actor?.type === 'vehicle') {
    try {
      await executeVehicleTurn(combatant);
    } catch (err) {
      console.error('cyberpunk-blue | vehicle turn execution failed:', err);
    }
  }
}

/**
 * Tech Weapon charge: clear cooldown flags, expire charges after 20 rounds, and
 * move the charge MOVE AE from 0 to half on the second and later turns.
 */
async function techWeaponTurnStart(actor, roundNumber) {
  for (const item of actor.items) {
    const weapons = item.system?.weapons;
    if (!weapons?.length) continue;

    for (let wi = 0; wi < weapons.length; wi++) {
      // Always clear charge cooldown at start of turn.
      if (item.getFlag('cyberpunk-blue', `chargeCooldown-${wi}`)) {
        await item.unsetFlag('cyberpunk-blue', `chargeCooldown-${wi}`);
      }

      if (!item.getFlag('cyberpunk-blue', `charged-${wi}`)) continue;

      const startRound   = item.getFlag('cyberpunk-blue', `chargeStartRound-${wi}`) ?? roundNumber;
      const roundsElapsed = roundNumber - startRound;

      // Expire charge after 20 rounds.
      if (roundsElapsed >= 20) {
        await clearWeaponCharge(actor, item, wi, false);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeExpired', { weapon: item.name })}</p></div>`,
        });
        continue;
      }

      // After first round: update AE for regular TW (0 → half MOVE).
      // ImprovedCharge and SR Capacity already start at their ongoing value.
      if (roundsElapsed >= 1) {
        const aeId = item.getFlag('cyberpunk-blue', `chargeAeId-${wi}`);
        const ae   = aeId ? actor.effects?.get(aeId) : null;
        if (ae && ae.system?.changes?.[0]?.value === '0') {
          const origMove = item.getFlag('cyberpunk-blue', `chargeOrigMove-${wi}`) ?? 0;
          const halfMove = String(Math.max(1, Math.ceil(origMove / 2)));
          await ae.update({ 'system.changes': [{ key: 'system.stats.move.value', type: 'override', value: halfMove }] });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeMoveRestored', { weapon: item.name, move: halfMove })}</p></div>`,
          });
        }
      }
    }
  }
}

/**
 * Chomp Ammo (KTech Terrier): at the START of the attacker's NEXT turn,
 * detonate any pending chomp flags — roll 1d6 and deal damage to every token
 * within 2m of the stuck target.
 */
async function detonateChompAmmo(actor, combatant, roundNumber, turnIdx) {
  const chompEntries = Object.entries(actor.flags?.['cyberpunk-blue'] ?? {})
    .filter(([k]) => k.startsWith('chompPending-'));
  for (const [key, value] of chompEntries) {
    const { targetTokenId, setAtRound, setAtTurnIdx, attackerCombatantId } = value ?? {};
    // Only the attacking combatant's own turn detonates (an actor may hold several
    // combatants). Flags from before this field existed match any of them.
    if (attackerCombatantId && attackerCombatantId !== combatant.id) continue;
    if (!(roundNumber > setAtRound || (roundNumber === setAtRound && turnIdx > setAtTurnIdx))) continue;

    await actor.unsetFlag('cyberpunk-blue', key);

    const targetToken = canvas.tokens?.get(targetTokenId);
    if (!targetToken) continue;

    const chompRoll = await new Roll('1d6').evaluate();
    await chompRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-bone"></i> ${game.i18n.localize('CYBER_BLUE.Combat.ChompAmmoDetonate')}</h3><p>${game.i18n.format('CYBER_BLUE.Combat.ChompAmmoDmg', { target: targetToken.name, dmg: chompRoll.total })}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Find all tokens within 2m of the target
    const blastRadiusPx = 2 * getPixelsPerMeter();
    const { x: tx, y: ty } = getTokenCenter(targetToken.document);

    for (const token of canvas.tokens.objects?.children ?? []) {
      if (!token.actor) continue;
      const { x: cx, y: cy } = getTokenCenter(token.document);
      if (Math.hypot(cx - tx, cy - ty) > blastRadiusPx) continue;
      await applyDamageWithPermission(token.actor, chompRoll.total);
    }
  }
}
