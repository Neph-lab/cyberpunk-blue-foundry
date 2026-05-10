import CyberBlueItemBase from "./base-item.mjs";
import { buildInstructionStepField } from "./weapon-schema.mjs";

export default class CyberBlueAbility extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.rank = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.maxRank = new fields.NumberField({
      required: false,
      nullable: true,
      integer: true,
      initial: null,
      min: 0,
    });

    // ── Instruction sequence (same as cyberware / gear) ───────────────────────
    schema.instructions = new fields.ArrayField(buildInstructionStepField(), { initial: [] });
    schema.instructionActive = new fields.BooleanField({ initial: false });
    schema.instructionStep = new fields.NumberField({ required: true, nullable: false, integer: true, initial: -1 });

    return schema;
  }
}
