/**
 * Blind condition mechanics.
 *
 * A blinded character:
 *   • takes −10 on any attack made with Handgun, Shoulder Arms or Heavy Weapons
 *     (delivered by the condition's own AE changes on the skills' generalBonus
 *     channel, so it shows up in roll previews like every other bonus), and
 *   • automatically misses with those attacks past 5 m, which is what this
 *     module resolves — the roll still happens, but the result cannot hit.
 *
 * Everything else the condition implies (no task that requires sight) is left
 * to the GM; the condition description spells it out.
 *
 * Pure module — no Foundry globals at import time, so it is unit-testable.
 */

/** Skills whose attacks the Blind condition cripples. */
export const BLIND_ATTACK_SKILLS = Object.freeze(['handgun', 'shoulderArms', 'hvyWeapons']);

/**
 * Penalty applied to those attacks, on the skills' `generalBonus` channel.
 * Shared by the Blind condition itself (CONFIG.statusEffects) and by anything
 * that blinds a character as a side effect (Flashbang Grenade), so the two
 * never drift apart.
 */
export const BLIND_ATTACK_PENALTY = -10;

/** The AE change keys carrying that penalty, in BLIND_ATTACK_SKILLS order. */
export const BLIND_ATTACK_CHANGE_KEYS = Object.freeze(
  BLIND_ATTACK_SKILLS.map((slug) => `system.skills.${slug}.generalBonus`),
);

/** Beyond this distance (meters) those attacks always miss. */
export const BLIND_ATTACK_RANGE_M = 5;

/** True when `actor` currently has the Blind condition. */
export function isBlinded(actor) {
  return !!actor?.statuses?.has?.('blind');
}

/** True when `skillSlug` is one of the skills the Blind condition cripples. */
export function isBlindAttackSkill(skillSlug) {
  return BLIND_ATTACK_SKILLS.includes(skillSlug);
}

/**
 * Does this attack automatically miss because the attacker is blind?
 *
 * An unknown distance (no target token, off-canvas attack) is left to the GM:
 * the attack resolves normally rather than being force-missed on a guess.
 *
 * @param {Actor}       attacker
 * @param {string}      skillSlug        Skill the attack rolls.
 * @param {number|null} distanceMeters   Attacker → target distance in meters.
 * @returns {boolean}
 */
export function isBlindAutoMiss(attacker, skillSlug, distanceMeters) {
  if (!isBlinded(attacker)) return false;
  if (!isBlindAttackSkill(skillSlug)) return false;
  if (!Number.isFinite(distanceMeters)) return false;
  return distanceMeters > BLIND_ATTACK_RANGE_M;
}

/** Chat card announcing a blind attacker's automatic miss (whole attack). */
export async function postBlindAutoMiss(attacker, distanceMeters) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-eye-slash"></i> ${game.i18n.localize('CYBER_BLUE.Combat.BlindAutoMissTitle')}</h3>
      <p>${game.i18n.format('CYBER_BLUE.Combat.BlindAutoMiss', {
        dist: Number(distanceMeters).toFixed(1),
        range: BLIND_ATTACK_RANGE_M,
      })}</p>
    </div>`,
  });
}

/** Chat card announcing that one target of an area attack cannot be hit. */
export async function postBlindAutoMissTarget(attacker, targetName, distanceMeters) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-eye-slash"></i> <strong>${targetName}</strong>: ${
      game.i18n.format('CYBER_BLUE.Combat.BlindAutoMiss', {
        dist: Number(distanceMeters).toFixed(1),
        range: BLIND_ATTACK_RANGE_M,
      })}</p></div>`,
  });
}
