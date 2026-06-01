/**
 * Vehicle Maneuver helpers — Phase 5.
 *
 * ── Maneuver lifecycle ─────────────────────────────────────────────────────────
 * 1. Driver's turn: driver clicks "Declare Maneuver" in the combat tracker.
 * 2. VehicleManeuverDialog opens; driver picks type + parameters.
 * 3. `declareManeuver` rolls the Drive check (1d10 + RFLX + drive.rank + bonuses),
 *    posts a chat card, and stores the result in
 *    `combatant.flags.cyberpunk-blue.pendingManeuver`.
 * 4. Vehicle's turn: `executeManeuver` reads the locked pendingManeuver and
 *    applies its effects.  The roll result never changes between declaration and
 *    execution — that is the cost of not delaying.
 *
 * ── Drive check formula ────────────────────────────────────────────────────────
 *   1d10 + RFLX + drive.rank + driveCheckBonus (AE) + maneuverBonus.<type> (AE)
 *
 * ── DV table (Sharp Turn / Dive–Rise) ─────────────────────────────────────────
 * Rows   = speed bands:  parked (0), 1–5, 6–15, 16–30, 31+
 * Cols   = angle buckets: 31–45°, 46–90°, 91–180°, 181–360°
 * Anchors confirmed: DV 10 "normal", DV 15 "city tight", DV 25 "360° daring".
 * Remaining values are designer-reasonable extrapolations from those anchors —
 * adjust in SHARP_TURN_DV_TABLE without changing any other code.
 *
 * ── Lost Control ──────────────────────────────────────────────────────────────
 * When a Drive check fails on a check-required Maneuver, the vehicle rolls on
 * the appropriate Lost Control table (vehicle-lost-control.mjs).
 */

import { getPendingManeuver, clearPendingManeuver, getVehicleHandling } from './vehicle-combat.mjs';
import { resolveRammingCollision } from './vehicle-movement.mjs';
import { rollLostControl } from './vehicle-lost-control.mjs';
import {
  advanceTokenPosition,
  quantiseHeading,
  clampHeadingDelta,
  displacementPx,
  rotatePointAboutPivot,
} from './vehicle-vector.mjs';

const FLAG_SCOPE = 'cyberpunk-blue';

// ── Cruise envelope ────────────────────────────────────────────────────────────

/** Cruise heading-adjust envelope: ± this many degrees, no Drive check. */
export const CRUISE_MAX_HEADING_DELTA = 30;

/**
 * Cruise speed-adjust envelope (grid spaces / round, ±):
 *   max(floor(ACC / 2), floor(|currentSpeed| / 4), 1)
 *
 * @param {Actor} vehicleActor
 * @returns {number}
 */
export function getCruiseSpeedEnvelope(vehicleActor) {
  const acc = (vehicleActor?.system?.stats?.acc?.value ?? 0)
            + (vehicleActor?.system?.stats?.acc?.bonus ?? 0);
  const speed = Math.abs(vehicleActor?.system?.stats?.currentSpeed?.value ?? 0);
  return Math.max(Math.floor(acc / 2), Math.floor(speed / 4), 1);
}

// ── Maneuver type catalogue ────────────────────────────────────────────────────

/**
 * Canonical list of all Maneuver types.
 *
 * `dv`         — static DV when fixed (null = computed at declaration time).
 * `airOnly`    — only available when classification.primary === 'air'.
 * `narrative`  — no system automation; GM resolves.
 */
export const MANEUVER_TYPES = {
  sharpTurn:    { label: 'Sharp Turn',     dv: null, airOnly: false, narrative: false },
  hardBrakes:   { label: 'Hard Brakes',    dv: null, airOnly: false, narrative: false },
  accelerate:   { label: 'Accelerate',     dv: null, airOnly: false, narrative: false },
  decelerate:   { label: 'Decelerate',     dv: null, airOnly: false, narrative: false },
  ram:          { label: 'Ram',            dv: null, airOnly: false, narrative: false },
  swerve:       { label: 'Swerve',         dv: null, airOnly: false, narrative: false },
  aerobatics:   { label: 'Aerobatics',     dv: 17,   airOnly: true,  narrative: false },
  diveRise:     { label: 'Dive / Rise',    dv: null, airOnly: true,  narrative: false },
  useEquipment: { label: 'Use Equipment',  dv: null, airOnly: false, narrative: true  },
};

// ── Sharp Turn / Dive-Rise DV table ───────────────────────────────────────────

// Angle bucket index → label
export const ANGLE_BUCKETS = [
  { label: '31–45° (gradual)',  min: 31,  max: 45  },
  { label: '46–90° (standard)', min: 46,  max: 90  },
  { label: '91–180° (sharp)',   min: 91,  max: 180 },
  { label: '181–360° (U-turn)', min: 181, max: 360 },
];

/**
 * DV table: rows = speed bands, cols = angle bucket indices (0–3).
 * Speed bands: [parked=0, 1–5, 6–15, 16–30, 31+]
 * Anchors: DV 10 (normal), DV 15 (city tight), DV 25 (360° daring).
 */
const SHARP_TURN_DV_TABLE = [
  //  31-45  46-90  91-180  181-360
  [     0,     0,      0,       0  ],  // parked
  [    10,    13,     15,      20  ],  // 1–5
  [    10,    15,     20,      24  ],  // 6–15
  [    13,    15,     22,      25  ],  // 16–30
  [    15,    18,     22,      25  ],  // 31+
];

/**
 * Return the Sharp Turn DV for a given current speed and angle bucket index.
 *
 * @param {number} currentSpeed   absolute value of currentSpeed
 * @param {number} angleBucket    0–3 (index into ANGLE_BUCKETS)
 * @returns {number}
 */
export function getSharpTurnDV(currentSpeed, angleBucket) {
  const speed = Math.abs(currentSpeed);
  let row;
  if (speed === 0)          row = 0;
  else if (speed <= 5)      row = 1;
  else if (speed <= 15)     row = 2;
  else if (speed <= 30)     row = 3;
  else                      row = 4;
  const col = Math.max(0, Math.min(3, angleBucket));
  return SHARP_TURN_DV_TABLE[row][col];
}

// ── Drive check helpers ───────────────────────────────────────────────────────

/**
 * Sum all drive-check bonuses from AEs and maneuver-specific bonuses.
 *
 * AE paths:
 *   flags.cyberpunk-blue.driveCheckBonus       — general Drive check modifier
 *   flags.cyberpunk-blue.maneuverBonus.<type>  — maneuver-specific modifier
 *
 * @param {Actor}  driverActor
 * @param {string} maneuverType
 * @returns {number}
 */
function _getDriveBonus(driverActor, maneuverType) {
  const flags = driverActor.flags?.[FLAG_SCOPE] ?? {};
  const base    = Number(flags.driveCheckBonus)             || 0;
  const specific = Number(flags.maneuverBonus?.[maneuverType]) || 0;
  return base + specific;
}

/**
 * Build the Drive check roll formula for a given driver.
 *
 * @param {Actor}  driverActor
 * @param {string} maneuverType
 * @returns {string}  Foundry Roll formula
 */
function _driveFormula(driverActor, maneuverType) {
  const rflx  = driverActor.system?.stats?.rflx?.value    ?? 0;
  const drive = driverActor.system?.skills?.drive?.rank   ?? 0;
  const bonus = _getDriveBonus(driverActor, maneuverType);
  const parts = ['1d10', String(rflx), String(drive)];
  if (bonus !== 0) parts.push(String(bonus));
  return parts.join(' + ');
}

// ── Maneuver DV computation ───────────────────────────────────────────────────

/**
 * Return the DV for a given maneuver type and parameters.
 *
 * For Sharp Turn / Dive-Rise: DV is looked up from the table.
 * For Hard Brakes: DV depends on the declared tier.
 * For Ram: DV = 13 + target's effective Handling (or target's current
 *   swerveResult if higher, handled at execution time).
 * For Swerve/Aerobatics: fixed DVs.
 * For types with no roll: returns null.
 *
 * @param {string}        type
 * @param {object}        params         Maneuver parameters from the dialog
 * @param {Actor}         vehicleActor
 * @param {TokenDocument} [targetToken]  For Ram maneuvers
 * @returns {number|null}
 */
export function getManeuverDV(type, params, vehicleActor, targetToken = null) {
  const speed = Math.abs(vehicleActor.system?.stats?.currentSpeed?.value ?? 0);

  switch (type) {
    case 'sharpTurn':
    case 'diveRise':
      return getSharpTurnDV(speed, params.angleBucket ?? 0);

    case 'hardBrakes':
      return params.hardBrakeTier === 3 ? 25 : 15;

    case 'swerve':
      // DV for Swerve is irrelevant at declaration (result becomes the evasion
      // DV for incoming attacks).  Use DV 0 — the roll itself is what matters.
      return 0;

    case 'aerobatics':
      return 17;

    case 'ram': {
      if (!targetToken?.actor) return 13;
      const tHandling = getVehicleHandling(targetToken.actor);
      return 13 + tHandling;
    }

    // No check required:
    case 'accelerate':
    case 'decelerate':
    case 'useEquipment':
      return null;

    default:
      return null;
  }
}

// ── Declaration ───────────────────────────────────────────────────────────────

/**
 * Roll the Drive check, post a chat card, and store the result as a pending
 * Maneuver on the vehicle combatant.
 *
 * @param {Combatant} vehicleCombatant  The vehicle's combatant
 * @param {Actor}     driverActor       The declaring driver
 * @param {object}    params            { type, angleBucket?, hardBrakeTier?, speedDelta?, rammingTargetTokenId? }
 */
export async function declareManeuver(vehicleCombatant, driverActor, params) {
  const { type } = params;
  const vehicleActor = vehicleCombatant.actor;
  if (!vehicleActor) return;

  const scene = canvas?.scene;

  // Resolve target token for Ram DV computation.
  const targetToken = params.rammingTargetTokenId && scene
    ? scene.tokens.get(params.rammingTargetTokenId) ?? null
    : null;

  const dv = getManeuverDV(type, params, vehicleActor, targetToken);

  // Some Maneuvers need no roll — store without one.
  if (dv === null) {
    const maneuverData = {
      type,
      declaredByDriverId: driverActor.id,
      rollResult:         null,
      dv:                 null,
      angleBucket:        params.angleBucket         ?? null,
      speedDelta:         params.speedDelta          ?? null,
      hardBrakeTier:      params.hardBrakeTier       ?? null,
      rammingTargetTokenId: params.rammingTargetTokenId ?? null,
    };
    await vehicleCombatant.setFlag(FLAG_SCOPE, 'pendingManeuver', maneuverData);

    const typeLabel = MANEUVER_TYPES[type]?.label ?? type;
    const vehicleToken = scene?.tokens.get(vehicleCombatant.tokenId);
    await ChatMessage.create({
      speaker: vehicleToken
        ? ChatMessage.getSpeaker({ token: vehicleToken })
        : { alias: vehicleActor.name },
      content: `
        <div class="cyberpunk-blue chat-card">
          <h3><i class="fas fa-car"></i> ${vehicleActor.name} — Maneuver Declared</h3>
          <p><strong>${driverActor.name}</strong> declares
             <strong>${typeLabel}</strong>.
             No Drive check required.</p>
        </div>
      `,
    });
    return;
  }

  // Roll the Drive check.
  const formula = _driveFormula(driverActor, type);
  const roll = await new Roll(formula).evaluate();
  const rollResult = roll.total;
  const success = rollResult >= dv;
  const typeLabel = MANEUVER_TYPES[type]?.label ?? type;

  const maneuverData = {
    type,
    declaredByDriverId:   driverActor.id,
    rollResult,
    dv,
    success,
    angleBucket:          params.angleBucket         ?? null,
    turnDirection:        params.turnDirection        ?? 'right',
    speedDelta:           params.speedDelta          ?? null,
    hardBrakeTier:        params.hardBrakeTier        ?? null,
    rammingTargetTokenId: params.rammingTargetTokenId ?? null,
  };
  await vehicleCombatant.setFlag(FLAG_SCOPE, 'pendingManeuver', maneuverData);

  // Post roll to chat.
  const vehicleToken = scene?.tokens.get(vehicleCombatant.tokenId);
  await roll.toMessage({
    speaker: vehicleToken
      ? ChatMessage.getSpeaker({ token: vehicleToken })
      : { alias: vehicleActor.name },
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-car"></i> ${vehicleActor.name} — Maneuver Declared</h3>
        <p><strong>${driverActor.name}</strong> declares
           <strong>${typeLabel}</strong>
           (DV ${dv}).</p>
        <p class="${success ? 'cpb-success' : 'cpb-failure'}">
          ${success
            ? `<i class="fas fa-check"></i> Drive check succeeded (${rollResult} ≥ ${dv}).`
            : `<i class="fas fa-times"></i> Drive check failed (${rollResult} < ${dv}) — will lose control at execution.`}
        </p>
      </div>
    `,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}

/**
 * Declare a Cruise adjustment — a free (no Drive check) heading/speed tweak
 * within the cruise envelope. Stored as a `pendingManeuver` of type 'cruise'
 * and executed on the vehicle's turn by `_executeCruise`. Cruise is NOT in
 * MANEUVER_TYPES (it isn't roll-based); the dialog exposes it on its own tab.
 *
 * @param {Combatant} vehicleCombatant
 * @param {Actor}     driverActor
 * @param {{headingDelta: number, speedDelta: number}} params
 *   headingDelta: signed degrees (+ = right/clockwise, − = left); quantised to
 *     15° and clamped to ±CRUISE_MAX_HEADING_DELTA.
 *   speedDelta: signed grid spaces; clamped to ±getCruiseSpeedEnvelope.
 */
export async function declareCruise(vehicleCombatant, driverActor, params) {
  const vehicleActor = vehicleCombatant.actor;
  if (!vehicleActor) return;

  const scene = canvas?.scene;
  const speedEnvelope = getCruiseSpeedEnvelope(vehicleActor);

  // Clamp inputs to the legal envelope.
  const headingDelta = Math.max(
    -CRUISE_MAX_HEADING_DELTA,
    Math.min(CRUISE_MAX_HEADING_DELTA, Math.round((Number(params.headingDelta) || 0) / 15) * 15),
  );
  const speedDelta = Math.max(
    -speedEnvelope,
    Math.min(speedEnvelope, Math.trunc(Number(params.speedDelta) || 0)),
  );

  await vehicleCombatant.setFlag(FLAG_SCOPE, 'pendingManeuver', {
    type: 'cruise',
    declaredByDriverId: driverActor.id,
    rollResult: null,
    dv: null,
    headingDelta,
    speedDelta,
  });

  const vehicleToken = scene?.tokens.get(vehicleCombatant.tokenId);
  const dirLabel = headingDelta === 0
    ? 'straight ahead'
    : `${Math.abs(headingDelta)}° ${headingDelta > 0 ? 'right' : 'left'}`;
  const spdLabel = speedDelta === 0
    ? 'holding speed'
    : `speed ${speedDelta > 0 ? '+' : ''}${speedDelta}`;
  await ChatMessage.create({
    speaker: vehicleToken
      ? ChatMessage.getSpeaker({ token: vehicleToken })
      : { alias: vehicleActor.name },
    content: `
      <div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-gauge-high"></i> ${vehicleActor.name} — Cruise</h3>
        <p><strong>${driverActor.name}</strong> cruises: ${dirLabel}, ${spdLabel}.
           No Drive check required.</p>
      </div>
    `,
  });
}

// ── Execution ─────────────────────────────────────────────────────────────────

/**
 * Execute the pending Maneuver stored on a vehicle combatant.
 * Called from `executeVehicleTurn` when a pendingManeuver exists.
 *
 * @param {Combatant}       vehicleCombatant
 * @param {Actor}           actor
 * @param {TokenDocument|null} vehicleToken
 */
export async function executeManeuver(vehicleCombatant, actor, vehicleToken) {
  const maneuver = getPendingManeuver(vehicleCombatant);
  if (!maneuver) return;

  switch (maneuver.type) {
    case 'sharpTurn':   await _executeSharpTurn   (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'hardBrakes':  await _executeHardBrakes   (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'accelerate':  await _executeAccelerate   (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'decelerate':  await _executeDecelerate   (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'swerve':      await _executeSwerve        (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'ram':         await _executeRam           (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'aerobatics':  await _executeAerobatics    (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'diveRise':    await _executeDiveRise      (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'useEquipment': await _executeUseEquipment (vehicleCombatant, actor, vehicleToken, maneuver); break;
    case 'cruise':      await _executeCruise        (vehicleCombatant, actor, vehicleToken, maneuver); break;
    default:
      await _postManeuverChat(actor, vehicleToken, maneuver.type, 'Unknown Maneuver type — GM resolves.');
  }

  await clearPendingManeuver(vehicleCombatant);
}

// ── Private: per-type execution ───────────────────────────────────────────────

async function _executeSharpTurn(vehicleCombatant, actor, vehicleToken, maneuver) {
  const typeDef = MANEUVER_TYPES.sharpTurn;
  const bucket = ANGLE_BUCKETS[maneuver.angleBucket ?? 0];
  const bucketLabel = bucket?.label ?? `Angle ${maneuver.angleBucket ?? 0}`;

  if (!maneuver.success) {
    await _postManeuverChat(actor, vehicleToken, typeDef.label,
      `<p>Declared: <strong>${bucketLabel}</strong></p>
       <p>Drive check failed (${maneuver.rollResult} &lt; ${maneuver.dv}).</p>`
    );
    await rollLostControl(actor, vehicleToken, `Sharp Turn drive check failed (${maneuver.rollResult} < ${maneuver.dv})`);
    return;
  }

  // Rotate to the new heading about the pivot, then advance.
  const direction = maneuver.turnDirection === 'left' ? -1 : 1;
  const turnAngle = _bucketTurnAngle(maneuver.angleBucket ?? 0);
  const curRot = vehicleToken?.rotation ?? 0;
  const newHeading = quantiseHeading(curRot + direction * turnAngle);
  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;

  await _moveVehicleToHeading(vehicleToken, actor, newHeading);

  const spaces = Math.abs(currentSpeed);
  await _postManeuverChat(actor, vehicleToken, typeDef.label,
    `<p>Declared: <strong>${bucketLabel}</strong>,
        ${maneuver.turnDirection === 'left' ? 'left' : 'right'}.</p>
     <p>Drive check succeeded (${maneuver.rollResult} ≥ ${maneuver.dv}).</p>
     <p>Heading → <strong>${newHeading}°</strong>. Advanced
        <strong>${spaces}</strong> ${spaces === 1 ? 'space' : 'spaces'}${currentSpeed < 0 ? ' in reverse' : ''}.</p>`
  );
}

async function _executeHardBrakes(vehicleCombatant, actor, vehicleToken, maneuver) {
  const typeDef = MANEUVER_TYPES.hardBrakes;
  const tier = maneuver.hardBrakeTier ?? 2;
  const acc  = (actor.system?.stats?.acc?.value ?? 0)
             + (actor.system?.stats?.acc?.bonus ?? 0);

  if (!maneuver.success) {
    await _postManeuverChat(actor, vehicleToken, typeDef.label,
      `<p>Tier ×${tier} (DV ${maneuver.dv}) — Drive check failed
          (${maneuver.rollResult} &lt; ${maneuver.dv}).</p>`
    );
    await rollLostControl(actor, vehicleToken, `Hard Brakes drive check failed (${maneuver.rollResult} < ${maneuver.dv})`);
    return;
  }

  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;
  const reduction    = acc * tier;
  const newSpeed     = currentSpeed >= 0
    ? Math.max(0, currentSpeed - reduction)
    : Math.min(0, currentSpeed + reduction);

  await actor.update({ 'system.stats.currentSpeed.value': newSpeed });

  await _postManeuverChat(actor, vehicleToken, typeDef.label,
    `<p>Tier ×${tier} (DV ${maneuver.dv}) — Drive check succeeded
        (${maneuver.rollResult} ≥ ${maneuver.dv}).</p>
     <p>Speed: ${currentSpeed} → <strong>${newSpeed}</strong>
        (−${Math.abs(currentSpeed - newSpeed)} from ACC×${tier})</p>`
  );
}

async function _executeAccelerate(vehicleCombatant, actor, vehicleToken, maneuver) {
  const delta      = Math.abs(maneuver.speedDelta ?? 1);
  const maxMove    = (actor.system?.stats?.maxMove?.value ?? 0)
                   + (actor.system?.stats?.maxMove?.bonus ?? 0);
  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;
  const newSpeed   = Math.min(currentSpeed + delta, maxMove);

  await actor.update({ 'system.stats.currentSpeed.value': newSpeed });

  await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.accelerate.label,
    `<p>Speed: ${currentSpeed} → <strong>${newSpeed}</strong> (+${newSpeed - currentSpeed})</p>`
  );
}

async function _executeDecelerate(vehicleCombatant, actor, vehicleToken, maneuver) {
  const delta      = Math.abs(maneuver.speedDelta ?? 1);
  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;
  const newSpeed   = currentSpeed >= 0
    ? Math.max(0, currentSpeed - delta)
    : Math.min(0, currentSpeed + delta);

  await actor.update({ 'system.stats.currentSpeed.value': newSpeed });

  await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.decelerate.label,
    `<p>Speed: ${currentSpeed} → <strong>${newSpeed}</strong> (−${Math.abs(currentSpeed - newSpeed)})</p>`
  );
}

async function _executeSwerve(vehicleCombatant, actor, vehicleToken, maneuver) {
  // The Swerve result becomes the effective Evasion DV for this vehicle and
  // all occupants until the vehicle's next turn.  Store it on the actor so
  // Phase 6 damage routing can read it.  It is cleared at the start of the
  // next vehicle turn in executeVehicleTurn.
  const rollResult = maneuver.rollResult ?? 0;
  await actor.setFlag(FLAG_SCOPE, 'swerveResult', rollResult);

  await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.swerve.label,
    `<p>Drive check result: <strong>${rollResult}</strong></p>
     <p>This vehicle and all occupants have an effective Evasion DV of
        <strong>${rollResult}</strong> until the vehicle's next turn.</p>`
  );
}

async function _executeRam(vehicleCombatant, actor, vehicleToken, maneuver) {
  const scene = vehicleToken?.parent ?? canvas.scene;
  const targetToken = maneuver.rammingTargetTokenId && scene
    ? scene.tokens.get(maneuver.rammingTargetTokenId) ?? null
    : null;

  if (!targetToken) {
    await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.ram.label,
      `<p>Target no longer present on the scene — Ram aborted.</p>`
    );
    return;
  }

  // Compute DV: 13 + target Handling, or current target swerveResult if higher.
  const baseHandling  = getVehicleHandling(targetToken.actor);
  const baseDv        = 13 + baseHandling;
  const swerveResult  = Number(targetToken.actor?.getFlag(FLAG_SCOPE, 'swerveResult')) || 0;
  const effectiveDv   = Math.max(baseDv, swerveResult);

  // For non-vehicle / low-RFLX targets, the margin is computed from 10 (auto-hit baseline).
  const canEvade   = targetToken.actor?.system?.stats?.rflx?.value >= 8;
  const rollResult = maneuver.rollResult ?? 0;
  const margin     = canEvade
    ? Math.max(0, rollResult - effectiveDv)
    : Math.max(0, rollResult - 10);

  // Evasion prompt for eligible targets (RFLX ≥ 8).
  if (canEvade) {
    await ChatMessage.create({
      speaker: vehicleToken
        ? ChatMessage.getSpeaker({ token: vehicleToken })
        : { alias: actor.name },
      content: `
        <div class="cyberpunk-blue chat-card">
          <h3><i class="fas fa-car-burst"></i> ${actor.name} — Ram Maneuver</h3>
          <p><strong>${targetToken.name}</strong> has RFLX ≥ 8 and may attempt Evasion
             (DV ${effectiveDv}).</p>
          <p class="cpb-gm-note">GM: have the target roll Evasion vs DV ${effectiveDv}.
             If successful, the target avoids the ram. Otherwise, resolve collision below.</p>
        </div>
      `,
    });
  }

  await resolveRammingCollision(vehicleToken, targetToken, {
    marginOfSuccess: margin,
    postToChat: true,
  });
}

async function _executeAerobatics(vehicleCombatant, actor, vehicleToken, maneuver) {
  if (!maneuver.success) {
    await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.aerobatics.label,
      `<p>Drive check failed (${maneuver.rollResult} &lt; ${maneuver.dv}).</p>`
    );
    await rollLostControl(actor, vehicleToken, `Aerobatics drive check failed (${maneuver.rollResult} < ${maneuver.dv})`);
    return;
  }
  await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.aerobatics.label,
    `<p>Drive check succeeded (${maneuver.rollResult} ≥ ${maneuver.dv}).</p>
     <p>Narrative: GM describes the maneuver outcome.</p>`
  );
}

async function _executeDiveRise(vehicleCombatant, actor, vehicleToken, maneuver) {
  // Dive/Rise uses the same DV table as Sharp Turn.
  const bucket = ANGLE_BUCKETS[maneuver.angleBucket ?? 0];
  const bucketLabel = bucket?.label ?? `Pitch ${maneuver.angleBucket ?? 0}`;
  const speedDelta  = maneuver.speedDelta ?? 0;

  if (!maneuver.success) {
    await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.diveRise.label,
      `<p>Declared: <strong>${bucketLabel}</strong>, elevation delta ${speedDelta} m.</p>
       <p>Drive check failed (${maneuver.rollResult} &lt; ${maneuver.dv}).</p>`
    );
    await rollLostControl(actor, vehicleToken, `Dive/Rise drive check failed (${maneuver.rollResult} < ${maneuver.dv})`);
    return;
  }

  // Apply vertical speed delta (capped to min(ACC, |currentSpeed|)).
  const acc = (actor.system?.stats?.acc?.value ?? 0)
            + (actor.system?.stats?.acc?.bonus ?? 0);
  const currentSpeed   = actor.system?.stats?.currentSpeed?.value ?? 0;
  const maxDelta       = Math.min(acc, Math.abs(currentSpeed));
  const clampedDelta   = Math.min(Math.abs(speedDelta), maxDelta) * Math.sign(speedDelta || 1);

  // Dive/Rise does not change horizontal heading (pitch only); the vehicle still
  // advances forward along its current heading and its elevation changes by the
  // clamped delta (scene distance units).
  const curRot = quantiseHeading(vehicleToken?.rotation ?? 0);
  const curElevation = vehicleToken?.elevation ?? 0;
  await _moveVehicleToHeading(vehicleToken, actor, curRot, { elevation: curElevation + clampedDelta });

  const spaces = Math.abs(currentSpeed);
  await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.diveRise.label,
    `<p>Declared: <strong>${bucketLabel}</strong></p>
     <p>Drive check succeeded (${maneuver.rollResult} ≥ ${maneuver.dv}).</p>
     <p>Elevation: ${curElevation} → <strong>${curElevation + clampedDelta}</strong>
        (${clampedDelta > 0 ? '+' : ''}${clampedDelta}). Advanced
        <strong>${spaces}</strong> ${spaces === 1 ? 'space' : 'spaces'}.</p>`
  );
}

async function _executeUseEquipment(vehicleCombatant, actor, vehicleToken, maneuver) {
  await _postManeuverChat(actor, vehicleToken, MANEUVER_TYPES.useEquipment.label,
    `<p>Mounted weapon fire / equipment activation — handled by the gunner or driver.</p>
     <p class="cpb-gm-note">Resolve weapon attack or item effect normally. (Phase 6 will automate this.)</p>`
  );
}

async function _executeCruise(vehicleCombatant, actor, vehicleToken, maneuver) {
  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;
  const maxMove = (actor.system?.stats?.maxMove?.value ?? 0)
                + (actor.system?.stats?.maxMove?.bonus ?? 0);

  // Apply the speed delta, clamped to the vehicle's max move in both directions.
  const speedDelta = maneuver.speedDelta ?? 0;
  let newSpeed = currentSpeed + speedDelta;
  if (maxMove > 0) newSpeed = Math.max(-maxMove, Math.min(maxMove, newSpeed));
  await actor.update({ 'system.stats.currentSpeed.value': newSpeed });

  // Heading: clamp the requested delta to the ±30° envelope, then re-snap to the
  // nearest 15° world-space heading immediately before moving (anti-drift).
  const curRot = vehicleToken?.rotation ?? 0;
  const headingDelta = maneuver.headingDelta ?? 0;
  const newHeading = quantiseHeading(
    clampHeadingDelta(curRot, curRot + headingDelta, CRUISE_MAX_HEADING_DELTA),
  );

  if (vehicleToken) {
    const scene = vehicleToken.parent ?? canvas.scene;
    const dest = advanceTokenPosition(vehicleToken, newSpeed, scene, newHeading);
    // Skip the 90° footprint snap so the art rotates freely to the exact (already
    // quantised) heading; region / passenger / collision sync still runs via the
    // updateToken hook.
    await vehicleToken.update(
      { x: dest.x, y: dest.y, rotation: newHeading },
      { cyberpunkBlueVehicleSnap: true },
    );
  }

  const spaces = Math.abs(newSpeed);
  await _postManeuverChat(actor, vehicleToken, 'Cruise',
    `<p>Heading → <strong>${newHeading}°</strong>${headingDelta !== 0
        ? ` (${Math.abs(headingDelta)}° ${headingDelta > 0 ? 'right' : 'left'})` : ''}.</p>
     <p>Speed: ${currentSpeed} → <strong>${newSpeed}</strong>. Advanced
        <strong>${spaces}</strong> ${spaces === 1 ? 'space' : 'spaces'}${newSpeed < 0 ? ' in reverse' : ''}.</p>`,
  );
}

// ── Shared utilities ──────────────────────────────────────────────────────────

/**
 * Representative turn angle (degrees) for an angle bucket — the bucket midpoint.
 * Used to pick a concrete rotation for Sharp Turn from the declared bucket. The
 * final heading is re-quantised to 15° before the move, so the exact midpoint
 * value only needs to be inside the bucket.
 *
 * @param {number} bucketIndex
 * @returns {number}
 */
function _bucketTurnAngle(bucketIndex) {
  const b = ANGLE_BUCKETS[bucketIndex] ?? ANGLE_BUCKETS[0];
  return (b.min + b.max) / 2;
}

/**
 * Resolve the vehicle's rotation pivot in scene pixels. Uses the authored
 * `system.pivot` (token-local pixels at the blueprint reference grid) when set
 * to a non-zero point (e.g. the rear axle for arc-correct turns); otherwise
 * falls back to the token centre (rotate-in-place).
 *
 * @param {TokenDocument} vehicleToken
 * @param {Actor}         actor
 * @param {Scene}         scene
 * @returns {{x: number, y: number}}
 */
function _resolvePivotWorld(vehicleToken, actor, scene) {
  const gridSize = scene?.grid?.size ?? 100;
  const w = (vehicleToken.width ?? 1) * gridSize;
  const h = (vehicleToken.height ?? 1) * gridSize;
  const tx = vehicleToken.x ?? 0;
  const ty = vehicleToken.y ?? 0;
  const centre = { x: tx + w / 2, y: ty + h / 2 };

  const pivot = actor?.system?.pivot;
  if (!pivot || ((pivot.x ?? 0) === 0 && (pivot.y ?? 0) === 0)) return centre;

  const referenceGrid = actor?.system?.blueprint?.referenceGrid ?? 100;
  const k = gridSize / referenceGrid;
  return { x: tx + (pivot.x ?? 0) * k, y: ty + (pivot.y ?? 0) * k };
}

/**
 * Rotate the vehicle to `newHeading` about its pivot, then advance forward by
 * its current speed along that heading, in a single token update. Skips the 90°
 * footprint snap (free art rotation); region / passenger / collision sync runs
 * via the `updateToken` hook. No-op (returns) when there is no token.
 *
 * @param {TokenDocument|null} vehicleToken
 * @param {Actor}              actor
 * @param {number}             newHeading  Final heading (already quantised).
 * @param {object}             [extraUpdate]  Extra token fields to set in the
 *   same update (e.g. `{ elevation }` for Dive/Rise).
 */
async function _moveVehicleToHeading(vehicleToken, actor, newHeading, extraUpdate = {}) {
  if (!vehicleToken) return;
  const scene = vehicleToken.parent ?? canvas.scene;
  const gridSize = scene?.grid?.size ?? 100;
  const w = (vehicleToken.width ?? 1) * gridSize;
  const h = (vehicleToken.height ?? 1) * gridSize;
  const curRot = vehicleToken.rotation ?? 0;
  const currentSpeed = actor.system?.stats?.currentSpeed?.value ?? 0;

  // 1. Arc the token centre about the pivot by the applied rotation delta.
  const oldCentre = { x: (vehicleToken.x ?? 0) + w / 2, y: (vehicleToken.y ?? 0) + h / 2 };
  const pivotWorld = _resolvePivotWorld(vehicleToken, actor, scene);
  const arced = rotatePointAboutPivot(oldCentre, pivotWorld, newHeading - curRot);

  // 2. Advance forward along the new heading by the current speed.
  const disp = displacementPx(newHeading, currentSpeed, gridSize);
  const newCentre = { x: arced.x + disp.x, y: arced.y + disp.y };

  await vehicleToken.update(
    { x: newCentre.x - w / 2, y: newCentre.y - h / 2, rotation: newHeading, ...extraUpdate },
    { cyberpunkBlueVehicleSnap: true },
  );
}

/**
 * Post a standardised Maneuver execution chat card.
 *
 * @param {Actor}           actor
 * @param {TokenDocument|null} vehicleToken
 * @param {string}          typeLabel
 * @param {string}          bodyHtml
 */
async function _postManeuverChat(actor, vehicleToken, typeLabel, bodyHtml) {
  await ChatMessage.create({
    speaker: vehicleToken
      ? ChatMessage.getSpeaker({ token: vehicleToken })
      : { alias: actor.name },
    content: `
      <div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-car"></i> ${actor.name} — ${typeLabel}</h3>
        ${bodyHtml}
      </div>
    `,
  });
}

