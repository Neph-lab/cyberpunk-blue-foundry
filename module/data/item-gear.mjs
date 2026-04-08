import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueGear extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.carried = new fields.BooleanField({ initial: true });
    schema.equipped = new fields.BooleanField({ initial: false });

    return schema;
  }
}
