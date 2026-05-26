import CyberBlueDataModel from "./base-model.mjs";

/**
 * Data model for Vehicle actors.
 *
 * AE-modifiable keys:
 *   system.stats.handling.bonus   — aggregate capped at +4 (positives only; see prepareDerivedData)
 *   system.stats.acc.bonus        — uncapped
 *   system.stats.maxMove.bonus    — uncapped
 *   system.stats.size.bonus       — uncapped
 *   flags.cyberpunk-blue.driveCheckBonus          — per-roll bonus on Drive checks
 *   flags.cyberpunk-blue.maneuverBonus.<key>       — per-Maneuver overrides
 *   flags.cyberpunk-blue.mountedWeaponAttackBonus  — attack bonus for mounted-weapon rolls
 */
export default class CyberBlueVehicle extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const coord = () =>
      new fields.SchemaField({
        x: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
        y: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
      });

    return {
      // ── Combat stats ─────────────────────────────────────────────────────────
      stats: new fields.SchemaField({
        // Maximum Move: grid spaces per combat round at full speed.
        maxMove: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 20, min: 0 }),
          // AE-modifiable bonus (uncapped). Effective maxMove = value + bonus.
          bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        }),
        // Acceleration: max speed-change per turn (Accelerate/Decelerate/Hard Brakes).
        acc: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
          // AE-modifiable bonus (uncapped).
          bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        }),
        // Handling: base set by GM, bonus modified by AEs (aggregate cap +4 positive).
        // Effective Handling = base + bonus (bonus clamped to ≤ +4 in prepareDerivedData).
        handling: new fields.SchemaField({
          base: new fields.NumberField({ ...requiredInteger, initial: 0, min: -5, max: 5 }),
          // AE target. Positive contributions are clamped to aggregate ≤ +4; negatives uncapped.
          bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        }),
        // Size: integer (affects to-hit) with a human-readable label ("Small", "Medium", etc.).
        // UI displays as "2 (Medium)".
        size: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 }),
          label: new fields.StringField({ required: true, blank: true, initial: '' }),
          // AE-modifiable bonus (uncapped).
          bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        }),
        // Current Speed: grid spaces per round the vehicle is currently moving.
        // Can be negative when in reverse. Updated each combat turn.
        currentSpeed: new fields.SchemaField({
          value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
        }),
      }),

      // ── Resources ────────────────────────────────────────────────────────────
      resources: new fields.SchemaField({
        hp: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 50, min: 0 }),
          max:   new fields.NumberField({ ...requiredInteger, initial: 50, min: 0 }),
        }),
        // "SP" in user-facing copy — DO NOT RENAME this key; the rest of the system
        // uses resources.armor as the canonical structural-protection pool name.
        armor: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
          max:   new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
      }),

      // ── Classification ───────────────────────────────────────────────────────
      classification: new fields.SchemaField({
        // Primary element for crit-table selection and drift/LoC table lookup.
        primary: new fields.StringField({
          required: true,
          blank: false,
          initial: 'land',
          choices: ['land', 'sea', 'air'],
        }),
        // Full category set (e.g. ['land','sea'] for an amphibious vehicle).
        categories: new fields.ArrayField(
          new fields.StringField({ required: true, blank: false }),
          { initial: ['land'] }
        ),
        // Sea/amphibious only: enables the Dive/Rise Maneuver.
        submersible: new fields.BooleanField({ initial: false }),
        // Whether the vehicle body encloses its riders (affects cover/SP routing).
        // Roof-type vital-area regions can locally override this per-region.
        enclosesRiders: new fields.BooleanField({ initial: true }),
      }),

      // ── Seats ────────────────────────────────────────────────────────────────
      seats: new fields.SchemaField({
        driver:     new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 }),
        }),
        gunners:    new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        passengers: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
      }),

      // ── Vehicle state ────────────────────────────────────────────────────────
      // 'operational' → normal operation.
      // 'wreck'       → HP reached 0; most stats zeroed (see prepareDerivedData),
      //                 becomes a static obstacle.
      state: new fields.StringField({
        required: true,
        blank: false,
        initial: 'operational',
        choices: ['operational', 'wreck'],
      }),

      // ── Rotation pivot (token-relative, in pixels) ───────────────────────────
      // Used by Phase 5 Maneuver execution for arc-correct rotation.
      pivot: coord(),

      // ── Crit table reference ─────────────────────────────────────────────────
      // World-level RollTable document id for vehicle critical damage.
      // Convention: use the matching category table
      //   vehicle-criticals-land / vehicle-criticals-sea / vehicle-criticals-air.
      critTableId: new fields.StringField({ required: true, blank: true, initial: '' }),

      // ── Blueprint ────────────────────────────────────────────────────────────
      // Scene-independent template used to materialise Regions and optional Tiles
      // when the vehicle Token is dropped onto a Scene (Phase 2).
      // All coordinates are token-local (origin = token top-left, pixels).
      blueprint: new fields.SchemaField({
        // Behavior Regions to spawn around the vehicle token.
        regions: new fields.ArrayField(
          new fields.SchemaField({
            // Foundry Region shape descriptor (e.g. { type:'polygon', points:[…] }).
            shape: new fields.ObjectField({ initial: {} }),
            // Offset from token origin (pixels).
            offset: coord(),
            // Registered RegionBehaviorType key (e.g. 'driverSeat', 'gunnerSeat').
            behaviorType: new fields.StringField({ required: true, blank: true, initial: '' }),
            // Arbitrary config object passed to the behavior on construction.
            behaviorConfig: new fields.ObjectField({ initial: {} }),
          }),
          { initial: [] }
        ),
        // Optional decorative Tiles (Phase 2+, e.g. multi-piece vehicles).
        tiles: new fields.ArrayField(
          new fields.SchemaField({
            texture: new fields.StringField({ required: true, blank: true, initial: '' }),
            offset: coord(),
            layer: new fields.StringField({ required: true, blank: true, initial: '' }),
          }),
          { initial: [] }
        ),
        // Vital-area hit-zones for targeted attacks (Phase 6 targeting UX).
        // Model (b): optional subsystem link — see design notes.
        vitalAreas: new fields.ArrayField(
          new fields.SchemaField({
            shape: new fields.ObjectField({ initial: {} }),
            offset: coord(),
            // When this vital area is hit on a crit, this RollTable entry fires
            // deterministically instead of a random roll.
            criticalDamageEntryId: new fields.StringField({ required: true, blank: true, initial: '' }),
            // If linked to a subsystem Item: damage routes to that subsystem's
            // HP/SP pool. Null = route to vehicle main HP.
            subsystemItemId: new fields.StringField({ required: false, nullable: true, blank: true, initial: null }),
          }),
          { initial: [] }
        ),
        // Spawn positions for seat Regions, token-local (pixels).
        seatPositions: new fields.SchemaField({
          driver: coord(),
          gunners:    new fields.ArrayField(coord(), { initial: [] }),
          passengers: new fields.ArrayField(coord(), { initial: [] }),
        }),
      }),

      // ── Narrative ────────────────────────────────────────────────────────────
      description: new fields.HTMLField({ initial: '' }),
      notes:       new fields.HTMLField({ initial: '' }),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // ── Handling bonus cap (P13/P14) ─────────────────────────────────────────
    // Aggregate positive AE contributions to handling.bonus may not exceed +4.
    // Penalties are uncapped.
    if (this.stats.handling.bonus > 4) {
      this.stats.handling.bonus = 4;
    }

    // ── Resource bounds ───────────────────────────────────────────────────────
    this.resources.hp.value = Math.min(
      Math.max(this.resources.hp.value, 0),
      this.resources.hp.max
    );
    this.resources.armor.value = Math.min(
      Math.max(this.resources.armor.value, 0),
      this.resources.armor.max
    );

    // ── Wreck state (P15) ─────────────────────────────────────────────────────
    // When HP hits 0 the state flag should be set externally (combat code sets it).
    // Once in wreck state, zero out all combat-relevant stats except size and armor.
    if (this.state === 'wreck') {
      this.stats.maxMove.value    = 0;
      this.stats.maxMove.bonus    = 0;
      this.stats.acc.value        = 0;
      this.stats.acc.bonus        = 0;
      this.stats.currentSpeed.value = 0;
      this.resources.hp.value     = 0;
      // armor (SP) and size are deliberately NOT zeroed — see design notes P15.
    }
  }

  getRollData() {
    return {
      stats: foundry.utils.deepClone(this.stats),
      resources: foundry.utils.deepClone(this.resources),
      classification: foundry.utils.deepClone(this.classification),
      seats: foundry.utils.deepClone(this.seats),
      state: this.state,
    };
  }
}
