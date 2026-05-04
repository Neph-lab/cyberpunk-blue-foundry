/**
 * Shared helpers for the Tech Weapon charge state.
 *
 * clearWeaponCharge(actor, item, weaponIndex, setCooldown)
 *   Removes the MOVE Active-Effect created on charge, unsets all charge flags,
 *   and optionally sets the cooldown flag (manual cancel only — not for fired shots).
 *
 * countWallsBetweenTokens(tokenA, tokenB)
 *   Returns how many wall intersections a ray from tokenA to tokenB crosses.
 *   Each wall crossing reduces a charged shot's damage by 10.
 */

/**
 * Remove charge state for one weapon slot.
 * @param {Actor}   actor        The actor who owns the charged weapon.
 * @param {Item}    item         The gear/cyberware item that holds the weapon entry.
 * @param {number}  weaponIndex  Index into item.system.weapons.
 * @param {boolean} setCooldown  If true, sets chargeCooldown so the weapon can't
 *                               re-charge until the actor's next turn starts.
 */
export async function clearWeaponCharge(actor, item, weaponIndex, setCooldown = false) {
  // Remove the MOVE Active-Effect.
  const aeId = item.getFlag?.('cyberpunk-blue', `chargeAeId-${weaponIndex}`);
  if (aeId) {
    const ae = actor.effects?.get(aeId);
    if (ae) {
      try { await ae.delete(); } catch { /* already deleted */ }
    }
    try { await item.unsetFlag('cyberpunk-blue', `chargeAeId-${weaponIndex}`); } catch { }
  }

  // Clear all charge flags.
  for (const key of [`charged-${weaponIndex}`, `chargeStartRound-${weaponIndex}`, `chargeOrigMove-${weaponIndex}`]) {
    try { await item.unsetFlag('cyberpunk-blue', key); } catch { }
  }

  // Optionally mark cooldown.
  if (setCooldown) {
    try { await item.setFlag('cyberpunk-blue', `chargeCooldown-${weaponIndex}`, true); } catch { }
  }
}

/**
 * Count how many walls a ray from the center of tokenA to the center of tokenB
 * intersects.  Each intersection represents one "thin cover" wall.
 * @param {Token} tokenA
 * @param {Token} tokenB
 * @returns {number}
 */
export function countWallsBetweenTokens(tokenA, tokenB) {
  if (!canvas?.walls || !tokenA || !tokenB) return 0;
  try {
    const origin = { x: tokenA.center.x, y: tokenA.center.y };
    const dest   = { x: tokenB.center.x, y: tokenB.center.y };
    const ray    = new Ray(origin, dest);
    // mode:'all' returns every intersection; one entry per wall crossed.
    const hits   = canvas.walls.checkCollision(ray, { type: 'move', mode: 'all' });
    return Array.isArray(hits) ? hits.length : (hits ? 1 : 0);
  } catch {
    return 0;
  }
}
