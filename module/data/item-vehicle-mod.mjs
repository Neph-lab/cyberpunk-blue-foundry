import CyberBlueItemBase from "./base-item.mjs";

/**
 * Data model for vehicle-mod Items.
 *
 * A vehicle modification that can be installed on a Vehicle actor.
 * Modifications may:
 *   - grant ongoing AE changes (defined in the item's embedded ActiveEffects)
 *   - occupy a specific slot on the vehicle
 *   - optionally materialise a companion vehicle-subsystem Item on installation
 *
 * AE changes inside a vehicle-mod item should target the vehicle actor's
 * system paths (e.g. system.stats.handling.bonus, system.stats.acc.bonus).
 */
export default class CyberBlueVehicleMod extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // ── Slot & compatibility ──────────────────────────────────────────────────
    // Which vehicle slot this mod occupies.
    // Examples: 'engine', 'armor', 'weaponMount', 'sensor', 'cosmetic', 'general'
    schema.slot = new fields.StringField({
      required: true,
      blank: true,
      initial: 'general',
    });

    // Vehicle category compatibility filter (empty = all categories).
    // Examples: ['land'], ['land','sea'], ['air']
    schema.mountType = new fields.ArrayField(
      new fields.StringField({ required: true, blank: false }),
      { initial: [] }
    );

    // Broad weight/size class of the mod (flavour / future rules hook).
    // Examples: 'light', 'standard', 'heavy'
    schema.weightClass = new fields.StringField({
      required: true,
      blank: true,
      initial: '',
    });

    // ── Cost ─────────────────────────────────────────────────────────────────
    schema.cost = new fields.StringField({ required: true, blank: true });

    // ── Optional subsystem spawn ──────────────────────────────────────────────
    // If set: installing this mod materialises the referenced vehicle-subsystem
    // Item onto the vehicle actor (Phase 2+ installation flow).
    // Stores the world-item or compendium UUID of the subsystem template to use.
    schema.grantsSubsystemUuid = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: null,
    });

    // ── Installation tracking ─────────────────────────────────────────────────
    // Id of the vehicle actor this mod is currently installed on.
    // Blank if not installed.
    schema.installedOnId = new fields.StringField({
      required: true,
      blank: true,
      initial: '',
    });

    return schema;
  }
}
