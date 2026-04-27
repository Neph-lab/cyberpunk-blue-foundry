import CyberBlueItemBase from "./base-item.mjs";

/**
 * Data model for Drug items.
 *
 * Drugs have a primary effect, a duration, a secondary DV (BODY+Endurance check when
 * they wear off), a secondary effect on failure, and an addiction penalty while
 * addicted but not actively using.
 *
 * Complex automation (lifecycle tracking, stacking, immunoblockers rescue window) is
 * intentionally handled manually / via description text.
 */
export default class CyberBlueDrug extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.cost = new fields.StringField({ required: true, blank: true });
    // Human-readable duration string, e.g. "24h", "4h", "Until a stressful moment"
    schema.duration = new fields.StringField({ required: true, blank: true });
    // Rich-text fields for each drug phase
    schema.primaryEffect = new fields.HTMLField({ initial: '' });
    schema.secondaryDv = new fields.NumberField({ ...requiredInteger, initial: 13, min: 0 });
    schema.secondaryEffect = new fields.HTMLField({ initial: '' });
    schema.addictionPenalty = new fields.HTMLField({ initial: '' });
    schema.notes = new fields.HTMLField({ initial: '' });

    return schema;
  }
}
