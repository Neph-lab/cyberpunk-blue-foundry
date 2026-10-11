/**
 * CyberBlueCombat — custom Combat document class.
 *
 * Overrides `rollInitiative` so that vehicle combatants receive Handling-based
 * initiative (always below all character combatants) while all other combatants
 * continue to use the standard formula configured in CONFIG.Combat.initiative.
 *
 * Vehicle initiative formula: (effectiveHandling − 100) + stickyTiebreak
 *   max ≈ −94.0   (Handling +5, tiebreak 0.999…)
 *   char min ≈ 2  (1d10=1 + RFLX=1)
 * The gap is sufficient to prevent any vehicle from landing above a character.
 *
 * The sticky tiebreak is generated once per combat and stored in
 * `combatant.flags.cyberpunk-blue.initTiebreak` so re-rolls from the GM do not
 * shuffle vehicle order relative to each other (N11 / P19).
 */

import { rollVehicleInitiative } from '../helpers/vehicle-combat.mjs';
import { onCombatTurnEnd, onCombatRoundStart, onCombatTurnStart } from '../helpers/turn-events.mjs';

export class CyberBlueCombat extends Combat {
  /* Turn lifecycle — core runs these after the update, on the active GM only.
     See helpers/turn-events.mjs for why they replace the combatTurn hooks. */

  /** @inheritDoc */
  async _onEndTurn(combatant, context) {
    await super._onEndTurn(combatant, context);
    await onCombatTurnEnd(this, combatant, context);
  }

  /** @inheritDoc */
  async _onStartRound(context) {
    await super._onStartRound(context);
    await onCombatRoundStart(this, context);
  }

  /** @inheritDoc */
  async _onStartTurn(combatant, context) {
    await super._onStartTurn(combatant, context);
    await onCombatTurnStart(this, combatant, context);
  }

  /**
   * Override initiative rolling to intercept vehicle combatants and assign
   * Handling-based initiative, then delegate the rest to the base class.
   *
   * @param {string|string[]} ids   Combatant ids to roll initiative for.
   * @param {object}          [options]
   * @returns {Promise<Combat>}
   */
  async rollInitiative(ids, options = {}) {
    const idArray = Array.isArray(ids) ? ids : [ids];

    // Partition combatants into vehicles and everyone else.
    const vehicleIds  = [];
    const normalIds   = [];

    for (const id of idArray) {
      const combatant = this.combatants.get(id);
      if (combatant?.actor?.type === 'vehicle') {
        vehicleIds.push(id);
      } else {
        normalIds.push(id);
      }
    }

    // Roll Handling-based initiative for each vehicle combatant.
    for (const id of vehicleIds) {
      const combatant = this.combatants.get(id);
      if (combatant) {
        await rollVehicleInitiative(combatant);
      }
    }

    // Delegate standard initiative to the base class for all non-vehicles.
    if (normalIds.length) {
      await super.rollInitiative(normalIds, options);
    }

    return this;
  }
}
