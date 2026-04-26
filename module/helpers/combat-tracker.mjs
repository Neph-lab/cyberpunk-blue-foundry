/**
 * Per-turn combat state tracker.
 *
 * Tracks which weapon each combatant has attacked with this turn and how many times,
 * enabling Rate-of-Fire enforcement. Also tracks movement used per token so the
 * preUpdateToken hook can enforce the 2×MOVE limit.
 *
 * Data lives in-memory (Maps) — intentionally ephemeral; a page reload or scene
 * change effectively starts a fresh turn, which is acceptable behaviour.
 */

// tokenId → { itemId, weaponIndex, count }
export const combatAttackTracker = new Map();

/**
 * Record that the given token made an attack with a specific item+weapon.
 * Returns the new attack count for that weapon this turn.
 */
export function recordCombatAttack(tokenId, itemId, weaponIndex) {
  const existing = combatAttackTracker.get(tokenId);
  if (existing && existing.itemId === itemId && existing.weaponIndex === weaponIndex) {
    existing.count += 1;
    return existing.count;
  }
  combatAttackTracker.set(tokenId, { itemId, weaponIndex, count: 1 });
  return 1;
}

/**
 * Returns the current attack state for a token, or null if no attack was made.
 * Shape: { itemId, weaponIndex, count }
 */
export function getCombatAttackState(tokenId) {
  return combatAttackTracker.get(tokenId) ?? null;
}

// tokenId → meters moved this turn
export const combatMovementTracker = new Map();

export function recordMovement(tokenId, meters) {
  const prev = combatMovementTracker.get(tokenId) ?? 0;
  combatMovementTracker.set(tokenId, prev + meters);
  return prev + meters;
}

export function getMovementUsed(tokenId) {
  return combatMovementTracker.get(tokenId) ?? 0;
}

export function resetTurnTracking(tokenId) {
  combatAttackTracker.delete(tokenId);
  combatMovementTracker.delete(tokenId);
}

export function resetAllTracking() {
  combatAttackTracker.clear();
  combatMovementTracker.clear();
}
