/**
 * Shared targeting & grid-measurement helpers.
 *
 * Single home for the target/distance/range-DV/evasion logic that every attack
 * resolver needs, and for the grid-unit → meters conversion. Scenes whose grid
 * units are not meters are assumed to use 2 m per grid-distance unit (the
 * system's standard square).
 */

import { COMBAT_CONFIG } from './combat.mjs';

/** Meters per grid-distance unit for a scene (2 m/unit when units aren't metric). */
export function getMetersPerGridUnit(scene = canvas?.scene) {
  const gridDistance = scene?.grid?.distance ?? 1;
  const gridUnits = (scene?.grid?.units ?? '').toLowerCase().trim();
  return ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
}

/** Canvas pixels per meter for the current scene. */
export function getPixelsPerMeter(scene = canvas?.scene) {
  const gridSize = scene?.grid?.size ?? canvas?.grid?.size ?? 100;
  return gridSize / getMetersPerGridUnit(scene);
}

/** Meters per canvas pixel, or null when no scene/grid is ready. */
export function getMetersPerPixel() {
  if (!canvas?.scene || !canvas?.grid) return null;
  return getMetersPerGridUnit(canvas.scene) / canvas.grid.size;
}

/** Pixel centre of a TokenDocument (also accepts create-data-like objects). */
export function getTokenCenter(tokenDoc) {
  const gridSize = canvas.grid.size;
  return {
    x: tokenDoc.x + ((tokenDoc.width ?? 1) * gridSize) / 2,
    y: tokenDoc.y + ((tokenDoc.height ?? 1) * gridSize) / 2,
  };
}

/** The user's first targeted token + its actor. */
export function getTarget() {
  const token = game.user.targets.first() ?? null;
  return { token, actor: token?.actor ?? null };
}

/** Distance in meters between two token documents' centres, or null off-canvas. */
export function getTokenDistanceMeters(tokenDocA, tokenDocB) {
  if (!canvas?.scene || !canvas?.grid || !tokenDocA || !tokenDocB) return null;
  const a = getTokenCenter(tokenDocA);
  const b = getTokenCenter(tokenDocB);
  const gridUnitDist = Math.hypot(a.x - b.x, a.y - b.y) / canvas.grid.size;
  return gridUnitDist * getMetersPerGridUnit(canvas.scene);
}

/** Distance in meters between the attacker's first active token and a target token. */
export function getDistanceMeters(attacker, targetToken) {
  if (!targetToken) return null;
  const attackerToken = attacker.getActiveTokens()[0];
  if (!attackerToken) return null;
  return getTokenDistanceMeters(attackerToken.document, targetToken.document);
}

/**
 * DV from a weapon's range table for a given distance.
 * Returns null when the weapon has no range table, 0 beyond maximum range.
 */
export function getDvForRange(definition, distanceMeters, rangeTableOverride = null) {
  if (!definition.usesRangeTable && !rangeTableOverride) return null;

  const breakpoints = COMBAT_CONFIG.rangeBreakpoints; // [0, 6, 12, 25, 50, 100, 200, 400, 800]
  const bandIndex = breakpoints.slice(1).findIndex((bp) => distanceMeters < bp);
  if (bandIndex === -1) return 0; // beyond maximum range

  const table = rangeTableOverride ?? definition.rangeTable;
  return table[bandIndex] ?? 0;
}

/**
 * Roll the target's Evasion check and post it to chat.
 *
 * Routes through Actor#getSkillRollContext so all the normal check machinery
 * applies: AE bonus/generalBonus channels, skill-chip floors, and — for mooks —
 * the Combat Number in place of stat + rank.
 */
export async function rollTargetEvasion(targetActor) {
  const ctx = targetActor.getSkillRollContext('evasion');
  const terms = [ctx.statValue, ctx.usedRank, ctx.statRollMod ?? 0, ctx.generalBonus ?? 0]
    .filter((term) => term !== 0);
  const formula = [
    '1d10',
    ...terms.map((term) => (term >= 0 ? `+ ${term}` : `- ${Math.abs(term)}`)),
  ].join(' ');
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Combat.EvasionRoll')}: ${targetActor.name}</h3>
        <p>${ctx.statShortLabel} ${ctx.statValue} + ${game.i18n.localize('CYBER_BLUE.Combat.EvasionSkill')} ${ctx.usedRank}</p>
      </div>
    `,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return roll;
}

/**
 * Whether a target may roll Evasion against this attack.
 * Melee: within 2 m. Ranged: RFLX ≥ 8 — mooks have no RFLX, so a mook is
 * eligible when its Evasion skill is listed (trained).
 */
export function isEvasionEligible(targetActor, { isMelee, isRanged, distanceMeters }) {
  if (!targetActor) return false;
  if (isMelee) return distanceMeters !== null && distanceMeters <= 2;
  if (!isRanged) return false;
  if (targetActor.type === 'mook') return !!targetActor.system?.skills?.evasion?.active;
  return (targetActor.system?.stats?.rflx?.value ?? 0) >= 8;
}
