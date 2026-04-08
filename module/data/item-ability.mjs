import CyberBlueItemBase from "./base-item.mjs";

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

    return schema;
  }
}
