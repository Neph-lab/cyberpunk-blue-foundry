/**
 * Vehicle Lost Control helpers — Phase 7.
 *
 * Handles rolling on the Lost Control table for land / sea / air vehicles and
 * seeding placeholder world RollTables for each category.
 *
 * ── Triggers (all call rollLostControl) ──────────────────────────────────────
 *  • Sharp Turn Drive check fail
 *  • Hard Brakes Drive check fail
 *  • Aerobatics Drive check fail
 *  • Dive / Rise Drive check fail
 *  • Drift overshoot: angle > 30°, 1d6 ≤ floor((angle − 30) / 15)
 *  • GM fiat (future: button on the combat tracker / actor sheet)
 *
 * ── Recovery ──────────────────────────────────────────────────────────────────
 * No recovery roll — the driver uses subsequent Maneuvers to fix the situation.
 */

export const LOC_TABLE_NAMES = {
  land: 'Vehicle Lost Control: Land',
  sea:  'Vehicle Lost Control: Sea',
  air:  'Vehicle Lost Control: Air',
};

// ── Table lookup ──────────────────────────────────────────────────────────────

/**
 * Find the Lost Control RollTable for a vehicle actor.
 *
 * @param {Actor} vehicleActor
 * @returns {RollTable|null}
 */
function _getLostControlTable(vehicleActor) {
  const primary   = vehicleActor.system?.classification?.primary ?? 'land';
  const tableName = LOC_TABLE_NAMES[primary] ?? LOC_TABLE_NAMES.land;
  return game.tables.find((t) => t.name === tableName) ?? null;
}

// ── Rolling ───────────────────────────────────────────────────────────────────

/**
 * Roll on the vehicle's Lost Control table and post the result to chat.
 * GM resolves the mechanical consequence from the table entry.
 *
 * All call sites run on the GM client only (executeVehicleTurn is GM-guarded),
 * so no socket delegation is required.
 *
 * @param {Actor}               vehicleActor
 * @param {TokenDocument|null}  [vehicleToken=null]
 * @param {string}              [reason='']   Short description of the trigger
 */
export async function rollLostControl(vehicleActor, vehicleToken = null, reason = '') {
  const table   = _getLostControlTable(vehicleActor);
  const speaker = vehicleToken
    ? ChatMessage.getSpeaker({ token: vehicleToken })
    : { alias: vehicleActor.name };

  const reasonLine = reason
    ? `<p><em>Cause: ${reason}</em></p>`
    : '';

  if (!table) {
    const primary   = vehicleActor.system?.classification?.primary ?? 'land';
    const tableName = LOC_TABLE_NAMES[primary] ?? LOC_TABLE_NAMES.land;
    await ChatMessage.create({
      speaker,
      content: `
        <div class="cyberpunk-blue chat-card cpb-lost-control">
          <h3><i class="fas fa-car-burst"></i> ${vehicleActor.name} — Lost Control!</h3>
          ${reasonLine}
          <p class="cpb-gm-note">
            No Lost Control table found (<em>${tableName}</em>).
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
      <div class="cyberpunk-blue chat-card cpb-lost-control">
        <h3><i class="fas fa-car-burst"></i> ${vehicleActor.name} — Lost Control!</h3>
        ${reasonLine}
        <p>
          <strong>${game.i18n.localize('CYBER_BLUE.VehicleCombat.LostControlRoll')}:</strong>
          ${rollResult.roll?.total ?? '?'} — <em>${resultText}</em>
        </p>
        <p class="cpb-gm-note">${game.i18n.localize('CYBER_BLUE.VehicleCombat.LostControlGmNote')}</p>
      </div>
    `,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}

// ── Table seeding ─────────────────────────────────────────────────────────────

/**
 * Ensure placeholder Lost Control tables exist in the world.
 * Called once from the `ready` hook (GM only).
 * Does NOT overwrite tables that already exist.
 */
export async function ensureLostControlTables() {
  if (!game.user.isGM) return;

  for (const [category, tableName] of Object.entries(LOC_TABLE_NAMES)) {
    if (game.tables.find((t) => t.name === tableName)) continue;

    await RollTable.create({
      name:        tableName,
      formula:     '1d6',
      replacement: true,
      displayRoll: true,
      description: `Lost Control table for ${category} vehicles. Populate with entries for rolls 1–6.`,
      results: [{
        type:   'text',
        text:   `[Placeholder] Vehicle out of control (${category}) — GM resolves the consequence. Populate this table with your Lost Control entries.`,
        range:  [1, 6],
        drawn:  false,
        weight: 1,
      }],
    });

    console.log(`Cyberpunk Blue | Created placeholder vehicle Lost Control table: "${tableName}"`);
  }
}
