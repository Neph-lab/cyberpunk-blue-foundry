import CyberBlueItemBase from "./base-item.mjs";

/**
 * Data model for vehicle-subsystem Items.
 *
 * Subsystems are embedded items on a Vehicle actor representing discrete
 * mechanical components (engine, wheels, weapons array, etc.).  Each has
 * its own HP and SP pool, separate from the vehicle's main pools.
 *
 * Damage routing (design model (b) from notes):
 *   - If a vital-area Region is linked to a subsystem, incoming damage routes
 *     to the subsystem's HP/SP, not the vehicle's main HP.
 *   - Damage overflow is absorbed (does NOT cascade to vehicle main HP).
 *   - Subsystem SP ablates like all SP.
 *   - When HP reaches 0, `destroyed` is set true, the destruction AE template
 *     is instantiated on the vehicle actor, and the subsystem becomes
 *     non-targetable until repaired by the GM.
 *
 * Phase 1: schema only.  Destruction logic is Phase 6.
 */
export default class CyberBlueVehicleSubsystem extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // ── Hit Points ────────────────────────────────────────────────────────────
    schema.hp = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
      max:   new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
    });

    // ── Stopping Power ────────────────────────────────────────────────────────
    // Ablates like character armor (value decrements; max is the starting value).
    schema.sp = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max:   new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    // ── Destruction state ─────────────────────────────────────────────────────
    // Set true when hp.value reaches 0.  Cleared by GM repair.
    // While true: not targetable; destruction AE remains on vehicle; subsystem
    // item stays embedded so the GM can inspect/repair it.
    schema.destroyed = new fields.BooleanField({ initial: false });

    // ── Destruction effect template ───────────────────────────────────────────
    // Raw ActiveEffect data (sans _id/origin) applied to the parent vehicle actor
    // when this subsystem is destroyed.  Phase 6 destruction logic reads this.
    // Example: { name: 'Engine Destroyed', changes: [{ key: 'system.stats.maxMove.value', mode: 2, value: '0' }] }
    schema.destructionEffect = new fields.ObjectField({ initial: {} });

    // ── Deterministic crit override ───────────────────────────────────────────
    // If set: destroying this subsystem fires this Critical Damage table entry
    // deterministically rather than a random roll.
    // Stores the RollTable result _id (string) or null for random roll.
    schema.boundCriticalEntryId = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: null,
    });

    // ── Enable-effect on destruction ───────────────────────────────────────────
    // ActiveEffect _id of an existing (typically disabled) effect on the parent
    // vehicle actor.  When this subsystem is destroyed, that effect is enabled.
    // null / blank = no effect toggled.
    schema.enableEffectId = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: null,
    });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Keep HP and SP within their bounds.
    this.hp.value = Math.min(Math.max(this.hp.value, 0), this.hp.max);
    this.sp.value = Math.min(Math.max(this.sp.value, 0), this.sp.max);
  }
}
