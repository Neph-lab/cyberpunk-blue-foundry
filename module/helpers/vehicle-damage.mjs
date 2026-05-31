/**
 * Vehicle damage helpers — Phase 6.
 *
 * Handles:
 *   • Serious Damage AE  (HP ≤ ½ max → −2 Handling bonus)
 *   • Wreck transition   (HP = 0 → system.state: 'wreck', cancel pending Maneuver)
 *   • Critical Damage    (2+ sixes trigger → +5 damage already applied upstream;
 *                          this file rolls the vehicle's crit table and posts to chat)
 *   • Table seeding      (placeholder world RollTables for land / sea / air)
 *
 * The AE pattern mirrors CyberBlueActor.syncSeriousWoundEffect / shouldBeSeriouslyWounded.
 * The table-rolling pattern mirrors rollCriticalInjury in critical-injury.mjs.
 */

import { clearPendingManeuver } from './vehicle-combat.mjs';

const FLAG_SCOPE = 'cyberpunk-blue';

export const VEHICLE_SERIOUS_DAMAGE_FLAG = 'autoVehicleSeriousDamage';

export const VEHICLE_CRIT_TABLE_NAMES = {
  land: 'Vehicle Critical Damage: Land',
  sea:  'Vehicle Critical Damage: Sea',
  air:  'Vehicle Critical Damage: Air',
};

// ── Serious Damage AE ─────────────────────────────────────────────────────────

/**
 * True when the vehicle is alive (HP > 0) but at or below half its max HP.
 * Mirrors the character `shouldBeSeriouslyWounded` pattern.
 *
 * @param {Actor} vehicleActor
 * @returns {boolean}
 */
export function vehicleShouldHaveSeriousDamage(vehicleActor) {
  if (vehicleActor.type !== 'vehicle') return false;
  const hp  = vehicleActor.system?.resources?.hp?.value ?? 0;
  const max = vehicleActor.system?.resources?.hp?.max   ?? 0;
  return max > 0 && hp > 0 && hp <= Math.floor(max / 2);
}

/**
 * @param {Actor} vehicleActor
 * @returns {ActiveEffect|undefined}
 */
export function getVehicleSeriousDamageEffect(vehicleActor) {
  return vehicleActor.effects.find(
    (e) => e.getFlag(FLAG_SCOPE, VEHICLE_SERIOUS_DAMAGE_FLAG),
  );
}

/** Build the AE data for the vehicle Serious Damage penalty. */
function _buildVehicleSeriousDamageAE(vehicleActor) {
  return {
    name: game.i18n.localize('CYBER_BLUE.VehicleCombat.SeriousDamage'),
    icon: 'systems/cyberpunk-blue/assets/pummeled.svg',
    origin: vehicleActor.uuid,
    disabled: false,
    transfer: false,
    system: {
      changes: [{
        key:   'system.stats.handling.bonus',
        type:  'add',
        value: '-2',
      }],
    },
    flags: {
      [FLAG_SCOPE]: { [VEHICLE_SERIOUS_DAMAGE_FLAG]: true },
    },
  };
}

/**
 * Create / update / remove the Serious Damage AE on a vehicle actor so it
 * matches the current HP state.
 *
 * Call from the `updateActor` hook whenever a vehicle's HP changes.
 * Pass `{ cyberBlueSyncVehicleSeriousDamage: true }` in options to avoid
 * re-entrant calls.
 *
 * @param {Actor}  vehicleActor
 * @param {object} [options={}]
 */
export async function syncVehicleSeriousDamage(vehicleActor, options = {}) {
  if (vehicleActor.type !== 'vehicle') return;

  const existing    = getVehicleSeriousDamageEffect(vehicleActor);
  const shouldExist = vehicleShouldHaveSeriousDamage(vehicleActor);

  if (!shouldExist) {
    if (existing) {
      await existing.delete({ ...options, cyberBlueSyncVehicleSeriousDamage: true });
    }
    return;
  }

  const aeData = _buildVehicleSeriousDamageAE(vehicleActor);
  if (!existing) {
    await vehicleActor.createEmbeddedDocuments('ActiveEffect', [aeData], {
      ...options,
      cyberBlueSyncVehicleSeriousDamage: true,
    });
    return;
  }
  await existing.update(aeData, {
    ...options,
    cyberBlueSyncVehicleSeriousDamage: true,
  });
}

// ── Wreck transition ──────────────────────────────────────────────────────────

/**
 * If the vehicle's HP has just reached 0 and it is still operational, flip it
 * to `state: 'wreck'`, cancel any pending Maneuver, and post a chat message.
 *
 * Call from the `updateActor` hook on the GM client only, guarded by
 * `game.user === game.users.activeGM`.
 *
 * @param {Actor}          vehicleActor
 * @param {Combatant|null} [vehicleCombatant=null]  pass if already known
 */
export async function checkVehicleWreckTransition(vehicleActor, vehicleCombatant = null) {
  if (vehicleActor.type !== 'vehicle') return;
  if (vehicleActor.system.state !== 'operational') return;
  if ((vehicleActor.system.resources?.hp?.value ?? 1) > 0) return;

  // Transition to wreck.
  await vehicleActor.update(
    { 'system.state': 'wreck' },
    { cyberpunkBlueWreckTransition: true },
  );

  // Cancel any pending Maneuver so the vehicle doesn't act while wrecked.
  const combatant = vehicleCombatant
    ?? game.combat?.combatants.find((c) => c.actorId === vehicleActor.id)
    ?? null;
  if (combatant) {
    await clearPendingManeuver(combatant).catch(() => {});
  }

  const tokens = vehicleActor.getActiveTokens();
  const speaker = tokens.length
    ? ChatMessage.getSpeaker({ token: tokens[0].document })
    : { alias: vehicleActor.name };

  await ChatMessage.create({
    speaker,
    content: `
      <div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-car-burst"></i> ${vehicleActor.name} — Wrecked</h3>
        <p>HP reached 0. Vehicle is now a static obstacle.
           All combat stats zeroed; Size and remaining SP preserved.</p>
      </div>
    `,
  });
}

// ── Critical Damage ───────────────────────────────────────────────────────────

/**
 * Find the critical damage RollTable for a vehicle actor.
 * Checks `critTableId` first, then falls back to the name-based lookup.
 *
 * @param {Actor} vehicleActor
 * @returns {RollTable|null}
 */
function _getVehicleCritTable(vehicleActor) {
  const id = vehicleActor.system?.critTableId;
  if (id) {
    const byId = game.tables.get(id);
    if (byId) return byId;
  }
  const primary   = vehicleActor.system?.classification?.primary ?? 'land';
  const tableName = VEHICLE_CRIT_TABLE_NAMES[primary] ?? VEHICLE_CRIT_TABLE_NAMES.land;
  return game.tables.find((t) => t.name === tableName) ?? null;
}

/**
 * Roll on the vehicle's critical damage table (2d6) and post the result to
 * chat.  The upstream attack flow already added +5 to the damage total before
 * calling this.  GM resolves the mechanical effect from the table entry.
 *
 * When `vitalRegionId` is provided and the corresponding vital-area blueprint
 * region has a `criticalDamageEntryId`, that entry fires deterministically
 * instead of a random roll — the attacker targeted that specific component.
 *
 * @param {Actor}               vehicleActor
 * @param {TokenDocument|null}  [vehicleToken=null]
 * @param {string|null}         [vitalRegionId=null]  regionId of the targeted vital area
 */
export async function rollVehicleCritical(vehicleActor, vehicleToken = null, vitalRegionId = null) {
  const speaker = vehicleToken
    ? ChatMessage.getSpeaker({ token: vehicleToken })
    : { alias: vehicleActor.name };

  // ── Vital-area deterministic crit ─────────────────────────────────────────
  if (vitalRegionId !== null) {
    const regions   = vehicleActor.system?.blueprint?.regions ?? [];
    const vitalArea = regions.find(
      (r) => r.regionId === vitalRegionId && r.behaviorType === 'vitalArea',
    ) ?? null;
    const entryId   = vitalArea?.behaviorConfig?.criticalDamageEntryId ?? '';
    if (entryId) {
      // Find the table entry directly and post it without rolling.
      const table = _getVehicleCritTable(vehicleActor);
      const entry = table?.results?.get(entryId) ?? null;
      const resultText = entry?.text ?? '—';
      await ChatMessage.create({
        speaker,
        content: `
          <div class="cyberpunk-blue chat-card cpb-vehicle-crit">
            <h3><i class="fas fa-car-burst"></i> ${vehicleActor.name} — Critical Damage (Vital Area)!</h3>
            <p><em>Targeted vital area strike.</em></p>
            <p>
              <strong>${game.i18n.localize('CYBER_BLUE.VehicleCombat.CritRoll')}:</strong>
              <em>${resultText}</em>
            </p>
            <p class="cpb-gm-note">${game.i18n.localize('CYBER_BLUE.VehicleCombat.CritGmNote')}</p>
          </div>
        `,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return;
    }
    // If the vital area has no bound entry, fall through to random roll.
  }

  // ── Standard random crit ──────────────────────────────────────────────────
  const table = _getVehicleCritTable(vehicleActor);
  if (!table) {
    const primary   = vehicleActor.system?.classification?.primary ?? 'land';
    const tableName = VEHICLE_CRIT_TABLE_NAMES[primary] ?? VEHICLE_CRIT_TABLE_NAMES.land;
    await ChatMessage.create({
      speaker,
      content: `
        <div class="cyberpunk-blue chat-card cpb-vehicle-crit">
          <h3><i class="fas fa-car-burst"></i> ${vehicleActor.name} — Critical Damage!</h3>
          <p class="cpb-gm-note">
            No critical damage table found (<em>${tableName}</em>).
            GM resolves the effect.
          </p>
        </div>
      `,
    });
    return;
  }

  const rollResult = await table.roll();
  const entry      = rollResult.results?.[0];
  const resultText = entry?.text ?? '—';

  await ChatMessage.create({
    speaker,
    content: `
      <div class="cyberpunk-blue chat-card cpb-vehicle-crit">
        <h3><i class="fas fa-car-burst"></i> ${vehicleActor.name} — Critical Damage!</h3>
        <p>
          <strong>${game.i18n.localize('CYBER_BLUE.VehicleCombat.CritRoll')}:</strong>
          ${rollResult.roll?.total ?? '?'} — <em>${resultText}</em>
        </p>
        <p class="cpb-gm-note">${game.i18n.localize('CYBER_BLUE.VehicleCombat.CritGmNote')}</p>
      </div>
    `,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}

// ── Table seeding ─────────────────────────────────────────────────────────────

/**
 * Ensure placeholder critical damage tables exist in the world.
 * Called once from the `ready` hook (GM only).
 * Does NOT overwrite tables that already exist.
 */
export async function ensureVehicleCritTables() {
  if (!game.user.isGM) return;

  for (const [category, tableName] of Object.entries(VEHICLE_CRIT_TABLE_NAMES)) {
    if (game.tables.find((t) => t.name === tableName)) continue;

    await RollTable.create({
      name:        tableName,
      formula:     '2d6',
      replacement: true,
      displayRoll: true,
      description: `Critical Damage table for ${category} vehicles. Populate with entries for rolls 2–12.`,
      results: [{
        type:   'text',
        text:   `[Placeholder] Critical hit on a ${category} vehicle — GM resolves the effect. Populate this table with your critical damage entries.`,
        range:  [2, 12],
        drawn:  false,
        weight: 1,
      }],
    });

    console.log(`Cyberpunk Blue | Created placeholder vehicle critical damage table: "${tableName}"`);
  }
}
