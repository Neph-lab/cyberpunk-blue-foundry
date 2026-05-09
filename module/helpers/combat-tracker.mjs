/**
 * Per-turn combat state tracker — Combatant flag-based.
 *
 * All turn state is stored in a Foundry Combatant flag so it persists across
 * page reloads and is synced to every connected client via the document socket.
 *
 * Flag path: cyberpunk-blue → turnState
 *
 * Structure:
 * {
 *   movementUsed:    number,   // cost-adjusted meters consumed this turn
 *   movementBonus:   number,   // extra meters granted by Sprint
 *   actionUsed:      boolean,  // true once the Action is committed to any use
 *   actionSprint:    boolean,  // true if Action was spent on Sprint
 *   rofAttacks:      object,   // keyed `${itemId}::${weaponIndex}` → { rof, used }
 *   netActionsTotal: number,   // NET actions unlocked this turn
 *   netActionsUsed:  number,   // NET actions consumed this turn
 * }
 *
 * Write discipline: flag writes are gated so only one client writes per event.
 *   - movementCost:      the user who initiated the move (moveToken hook userId)
 *   - turn/round resets: GM only (combatTurn / combatRound hooks)
 *   - sprint / attack:   the owning player or GM (direct button/action handler)
 */

const FLAG_SCOPE = 'cyberpunk-blue';
const TURN_STATE_KEY = 'turnState';

export const DEFAULT_TURN_STATE = Object.freeze({
  movementUsed:    0,
  movementBonus:   0,
  actionUsed:      false,
  actionSprint:    false,
  rofAttacks:      {},
  netActionsTotal: 0,
  netActionsUsed:  0,
});

// ── Read helpers ──────────────────────────────────────────────────────────────

/** Find the active combatant in the current combat. */
export function getActiveCombatant() {
  return game.combat?.combatants.get(game.combat?.current?.combatantId) ?? null;
}

/** Find the combatant whose token matches tokenId in the current combat. */
export function getCombatantForToken(tokenId) {
  return game.combat?.combatants.find((c) => c.tokenId === tokenId) ?? null;
}

/**
 * Read the turn state for a combatant, merging with defaults so all fields
 * are always present even if the flag was written by an older version.
 * This is a synchronous read from the already-fetched document flags.
 */
export function getTurnState(combatant) {
  const saved = combatant?.getFlag(FLAG_SCOPE, TURN_STATE_KEY);
  if (!saved) return { ...DEFAULT_TURN_STATE, rofAttacks: {} };
  return {
    ...DEFAULT_TURN_STATE,
    ...saved,
    rofAttacks: { ...(saved.rofAttacks ?? {}) },
  };
}

/**
 * Total movement budget in meters for a combatant this turn.
 * Base = MOVE stat × 2.  Sprint adds movementBonus from the flag.
 */
export function getMovementBudget(combatant, actor) {
  const moveValue = Math.max(Number(actor?.system?.stats?.move?.value) || 0, 0);
  const state = getTurnState(combatant);
  return moveValue * 2 + (state.movementBonus ?? 0);
}

// ── Write helpers ─────────────────────────────────────────────────────────────

/** Overwrite the full turn state for a combatant. */
export async function setTurnState(combatant, state) {
  if (!combatant) return;
  return combatant.setFlag(FLAG_SCOPE, TURN_STATE_KEY, state);
}

/** Reset a combatant's turn state to defaults (call at turn start/end). */
export async function resetTurnState(combatant) {
  if (!combatant) return;
  return combatant.setFlag(FLAG_SCOPE, TURN_STATE_KEY, { ...DEFAULT_TURN_STATE, rofAttacks: {} });
}

/**
 * Add cost-adjusted meters to movementUsed.
 * Call from the moveToken hook on the initiating client only.
 */
export async function addMovementCost(combatant, cost) {
  if (!combatant || !(cost > 0)) return;
  const state = getTurnState(combatant);
  return setTurnState(combatant, {
    ...state,
    movementUsed: (state.movementUsed ?? 0) + cost,
  });
}

/**
 * Spend the Action on Sprint, granting extra movement meters this turn.
 */
export async function grantSprint(combatant, extraMeters) {
  if (!combatant) return;
  const state = getTurnState(combatant);
  return setTurnState(combatant, {
    ...state,
    actionUsed:    true,
    actionSprint:  true,
    movementBonus: extraMeters,
  });
}

/**
 * Record an attack with a specific item+weapon and mark the Action as used.
 * rof — the weapon's Rate of Fire (max attacks per Action with this weapon).
 * Returns the new used-count for this weapon slot.
 */
export async function recordCombatAttack(combatant, itemId, weaponIndex, rof) {
  if (!combatant) return 1;
  const state = getTurnState(combatant);
  const key = `${itemId}::${weaponIndex}`;
  const existing = state.rofAttacks[key];
  const entry = existing
    ? { rof: Math.max(existing.rof, rof ?? 1), used: existing.used + 1 }
    : { rof: rof ?? 1, used: 1 };
  await setTurnState(combatant, {
    ...state,
    actionUsed:  true,
    rofAttacks:  { ...state.rofAttacks, [key]: entry },
  });
  return entry.used;
}

/**
 * Mark the Action as used without recording a specific weapon attack.
 * Use for non-attack actions that consume the Action slot.
 */
export async function markActionUsed(combatant) {
  if (!combatant) return;
  const state = getTurnState(combatant);
  if (state.actionUsed) return;
  return setTurnState(combatant, { ...state, actionUsed: true });
}

/**
 * Unlock a number of NET actions by spending the main Action.
 */
export async function unlockNetActions(combatant, count) {
  if (!combatant || !(count > 0)) return;
  const state = getTurnState(combatant);
  return setTurnState(combatant, {
    ...state,
    actionUsed:      true,
    netActionsTotal: count,
    netActionsUsed:  0,
  });
}

/**
 * Consume one NET action.
 */
export async function consumeNetAction(combatant) {
  if (!combatant) return;
  const state = getTurnState(combatant);
  if (state.netActionsUsed >= state.netActionsTotal) return;
  return setTurnState(combatant, {
    ...state,
    netActionsUsed: state.netActionsUsed + 1,
  });
}
