/**
 * Vehicle combat helpers.
 *
 * ── Initiative model ──────────────────────────────────────────────────────────
 * Vehicle initiative is always below all non-vehicle combatants:
 *   initiative = (effectiveHandling − 100) + tiebreak
 *
 * tiebreak is a random value [0, 1) generated once per combat and stored in
 * `combatant.flags.cyberpunk-blue.initTiebreak`.  It is sticky for the whole
 * combat (N11 / P19).
 *
 * Character minimum roll ≈ 2 (1d10=1 + RFLX=1).  Vehicle max ≈ −94.0
 * (Handling +5 + tiebreak 0.999…).  The gap ensures no vehicle can
 * accidentally beat a character on initiative.
 *
 * ── Pending Maneuver ─────────────────────────────────────────────────────────
 * Pending Maneuver data lives on the VEHICLE combatant's flags so it survives
 * driver changes between declaration and execution.  Execution logic lives in
 * `module/helpers/vehicle-maneuvers.mjs` and is called from `executeVehicleTurn`.
 *
 *   combatant.flags['cyberpunk-blue'].pendingManeuver: {
 *     type:                  string,   // 'sharpTurn'|'hardBrakes'|…
 *     declaredByDriverId:    string,   // actor id of the declaring driver
 *     rollResult:            number,   // Drive check result at declaration
 *     vectors:               [{from,to}, {from,to}],
 *     speedDelta:            number,
 *     hardBrakeTier:         2|3|null,
 *     rammingTargetTokenId:  string|null,
 *   }
 *
 * ── Driver tracking ───────────────────────────────────────────────────────────
 * The vehicle ACTOR carries `flags.cyberpunk-blue.currentDriverTokenId` — the
 * scene token id of whoever is currently in the driver seat.  Set by the
 * driver-seat region TOKEN_ENTER event, cleared on TOKEN_EXIT.  Read here for
 * drift / coast logic and tracker display.
 */

import { rollLostControl } from './vehicle-lost-control.mjs';

const FLAG_SCOPE            = 'cyberpunk-blue';
const INIT_TIEBREAK_FLAG    = 'initTiebreak';
export const PENDING_MANEUVER_FLAG = 'pendingManeuver';
export const DRIVER_TOKEN_FLAG     = 'currentDriverTokenId';
export const SWERVE_RESULT_FLAG    = 'swerveResult';

// ── Initiative ───────────────────────────────────────────────────────────────

/**
 * Compute effective Handling (base + bonus, positive capped at +4 by
 * prepareDerivedData) for a vehicle actor.
 *
 * @param {Actor} vehicleActor
 * @returns {number}
 */
export function getVehicleHandling(vehicleActor) {
  const stats = vehicleActor.system?.stats?.handling ?? {};
  return (stats.base ?? 0) + (stats.bonus ?? 0);
}

/**
 * Set the initiative value for a vehicle combatant.
 *
 * Uses a sticky tiebreak stored in combatant flags — generated once the first
 * time initiative is rolled and reused for the rest of the combat (P19/N11).
 *
 * @param {Combatant} combatant
 */
export async function rollVehicleInitiative(combatant) {
  const actor = combatant.actor;
  if (!actor || actor.type !== 'vehicle') return;

  const handling = getVehicleHandling(actor);

  // Sticky tiebreak — kept for the entire combat, never re-randomised.
  let tiebreak = combatant.getFlag(FLAG_SCOPE, INIT_TIEBREAK_FLAG);
  if (tiebreak == null) {
    tiebreak = Math.random(); // [0, 1)
    await combatant.setFlag(FLAG_SCOPE, INIT_TIEBREAK_FLAG, tiebreak);
  }

  // Vehicles always land below character range (chars: min ≈2, vehicles: max ≈-94).
  const initiative = (handling - 100) + tiebreak;
  await combatant.update({ initiative });
}

/**
 * Clear the sticky tiebreak so the next `rollVehicleInitiative` call generates
 * a fresh one.  Call this when the GM explicitly re-rolls all initiative at the
 * start of a new combat.
 *
 * @param {Combatant} combatant
 */
export async function clearInitTiebreak(combatant) {
  await combatant.unsetFlag(FLAG_SCOPE, INIT_TIEBREAK_FLAG);
}

// ── Pending Maneuver flags ────────────────────────────────────────────────────

/**
 * @param {Combatant} vehicleCombatant
 * @returns {object|null}
 */
export function getPendingManeuver(vehicleCombatant) {
  return vehicleCombatant?.getFlag(FLAG_SCOPE, PENDING_MANEUVER_FLAG) ?? null;
}

/**
 * @param {Combatant}   vehicleCombatant
 * @param {object}      data
 */
export async function setPendingManeuver(vehicleCombatant, data) {
  if (!vehicleCombatant) return;
  await vehicleCombatant.setFlag(FLAG_SCOPE, PENDING_MANEUVER_FLAG, data);
}

/**
 * @param {Combatant} vehicleCombatant
 */
export async function clearPendingManeuver(vehicleCombatant) {
  if (!vehicleCombatant) return;
  await vehicleCombatant.unsetFlag(FLAG_SCOPE, PENDING_MANEUVER_FLAG);
}

// ── Driver delay ──────────────────────────────────────────────────────────────

/**
 * Delay the driver combatant to just before the vehicle's turn.
 *
 * Sets the driver's initiative to (vehicleInit − 0.001).  This is a one-way
 * operation: the driver remains at the new slot for the rest of the combat.
 *
 * @param {Combatant} driverCombatant
 * @param {Combatant} vehicleCombatant
 */
export async function delayDriverToVehicle(driverCombatant, vehicleCombatant) {
  if (!driverCombatant || !vehicleCombatant) return;
  const vehicleInit = vehicleCombatant.initiative ?? -100;
  const newInit = vehicleInit - 0.001;
  await driverCombatant.update({ initiative: newInit });
}

// ── Vehicle turn execution ────────────────────────────────────────────────────

/**
 * Execute a vehicle's combat turn.
 *
 * Phase 4 logic:
 *   - If a driver is present AND no pending Maneuver → vehicle coasts
 *     (maintains speed and heading; posts an informational chat message).
 *   - If no driver → drift (calculate angle/direction; reduce speed by half-ACC;
 *     post drift report to chat; check for Lost Control escalation).
 *
 * Phase 5 will add Maneuver execution on top.
 *
 * @param {Combatant} vehicleCombatant
 */
export async function executeVehicleTurn(vehicleCombatant) {
  if (!game.user.isGM) return;
  const actor = vehicleCombatant.actor;
  if (!actor || actor.type !== 'vehicle') return;

  const scene = canvas.scene;
  const vehicleToken = scene?.tokens.get(vehicleCombatant.tokenId);

  // Clear any Swerve result from the PREVIOUS turn — it protects until the
  // vehicle's next turn, so we wipe it at the START of that next turn.
  if (actor.getFlag(FLAG_SCOPE, SWERVE_RESULT_FLAG) != null) {
    await actor.unsetFlag(FLAG_SCOPE, SWERVE_RESULT_FLAG).catch(() => {});
  }

  const driverTokenId = actor.getFlag(FLAG_SCOPE, DRIVER_TOKEN_FLAG);
  const hasDriver = Boolean(driverTokenId && scene?.tokens.has(driverTokenId));

  const pendingManeuver = getPendingManeuver(vehicleCombatant);

  if (pendingManeuver) {
    // Lazy import breaks the vehicle-combat ↔ vehicle-maneuvers circular dep.
    const { executeManeuver } = await import('./vehicle-maneuvers.mjs');
    await executeManeuver(vehicleCombatant, actor, vehicleToken);
    return;
  }

  if (hasDriver) {
    await _executeCoast(vehicleCombatant, actor, vehicleToken);
  } else {
    await _executeDrift(vehicleCombatant, actor, vehicleToken);
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function _executeCoast(vehicleCombatant, actor, vehicleToken) {
  const speed = actor.system?.stats?.currentSpeed?.value ?? 0;
  await ChatMessage.create({
    speaker: vehicleToken
      ? ChatMessage.getSpeaker({ token: vehicleToken })
      : { alias: actor.name },
    content: `
      <div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-car"></i> ${actor.name} — Coasting</h3>
        <p>No Maneuver declared. Vehicle maintains heading at speed
           <strong>${speed}</strong>.</p>
      </div>
    `,
  });
}

/**
 * Calculate and apply drift for an unmanned vehicle.
 *
 * Drift formula (from design notes):
 *   angle = (1d10 + 5 − Handling) × 15°, minimum 0°
 *   direction: 1d2 → left or right
 *   speed reduction: floor(ACC / 2), minimum 1
 *   if angle > 30°: roll 1d6; if ≤ (angle − 30) / 15 → Lost Control
 *
 * Phase 4: posts result to chat and updates currentSpeed.
 * Phase 7 will add Lost Control table lookup.
 *
 * @param {Combatant} vehicleCombatant
 * @param {Actor}     actor
 * @param {TokenDocument|null} vehicleToken
 */
async function _executeDrift(vehicleCombatant, actor, vehicleToken) {
  const handling    = getVehicleHandling(actor);
  const acc         = (actor.system?.stats?.acc?.value ?? 0)
                    + (actor.system?.stats?.acc?.bonus ?? 0);
  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;

  if (currentSpeed === 0) {
    await ChatMessage.create({
      speaker: vehicleToken
        ? ChatMessage.getSpeaker({ token: vehicleToken })
        : { alias: actor.name },
      content: `
        <div class="cyberpunk-blue chat-card">
          <h3><i class="fas fa-car"></i> ${actor.name} — No Driver</h3>
          <p>Vehicle is stationary with no driver. No drift.</p>
        </div>
      `,
    });
    return;
  }

  // Veer angle roll: (1d10 + 5 − Handling) × 15°, clamped to [0, 360]
  const angleRoll = await new Roll('1d10').evaluate();
  const rawAngle  = Math.max(0, (angleRoll.total + 5 - handling)) * 15;
  const angle     = Math.min(rawAngle, 360);

  // Direction: 1d2
  const dirRoll = await new Roll('1d2').evaluate();
  const direction = dirRoll.total === 1 ? 'Left' : 'Right';

  // Speed reduction: half-ACC per turn (minimum 1, floor towards 0)
  const speedReduction = Math.max(1, Math.floor(acc / 2));
  const newSpeed       = currentSpeed > 0
    ? Math.max(0, currentSpeed - speedReduction)
    : Math.min(0, currentSpeed + speedReduction);

  // Lost Control check if veer > 30°
  let lostControlResult = null;
  if (angle > 30) {
    const threshold = Math.floor((angle - 30) / 15);
    const lcRoll    = await new Roll('1d6').evaluate();
    if (lcRoll.total <= threshold) {
      lostControlResult = { roll: lcRoll.total, threshold };
    }
  }

  // Apply speed update to actor
  await actor.update({ 'system.stats.currentSpeed.value': newSpeed });

  await ChatMessage.create({
    speaker: vehicleToken
      ? ChatMessage.getSpeaker({ token: vehicleToken })
      : { alias: actor.name },
    content: `
      <div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-car-burst"></i> ${actor.name} — Drifting (No Driver)</h3>
        <p>
          Veer: <strong>${angle}°</strong> to the <strong>${direction}</strong>
          (1d10=${angleRoll.total}, Handling=${handling})
        </p>
        <p>Speed: ${currentSpeed} → <strong>${newSpeed}</strong>
           (−${speedReduction} from half-ACC)
        </p>
        ${lostControlResult ? `<p>⚠️ Drift overshoot — Lost Control triggered
          (1d6 = ${lostControlResult.roll} ≤ threshold ${lostControlResult.threshold}).</p>` : ''}
      </div>
    `,
  });

  // Roll on the Lost Control table if the drift overshoot check triggered.
  if (lostControlResult) {
    await rollLostControl(
      actor,
      vehicleToken,
      `Drift overshoot: veer ${angle}° (1d6 = ${lostControlResult.roll} ≤ threshold ${lostControlResult.threshold})`,
    );
  }
}
