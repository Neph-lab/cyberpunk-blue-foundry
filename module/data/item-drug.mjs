import CyberBlueItemBase from "./base-item.mjs";
import { buildInstructionStepField } from './weapon-schema.mjs';

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

    // ── Consumable / instruction fields ──────────────────────────────────────
    // quantity: how many doses are in the actor's possession
    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    // instructions: ordered sequence of steps executed when the drug is used
    schema.instructions = new fields.ArrayField(buildInstructionStepField());
    // instructionActive / instructionStep: execution state (mirrors gear/cyberware pattern)
    schema.instructionActive = new fields.BooleanField({ initial: false });
    schema.instructionStep   = new fields.NumberField({ ...requiredInteger, initial: -1 });
    // instructionReduceQuantity: consume one dose each time the sequence starts
    schema.instructionReduceQuantity = new fields.BooleanField({ initial: true });

    return schema;
  }
}
