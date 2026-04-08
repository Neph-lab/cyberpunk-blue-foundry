import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueRole extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.rank = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 });
    schema.lifepathLinks = new fields.HTMLField({ initial: "" });
    schema.lifepathQuestions = new fields.HTMLField({ initial: "" });
    schema.abilityOverview = new fields.HTMLField({ initial: "" });
    schema.abilitySections = new fields.ArrayField(new fields.SchemaField({
      unlockRank: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0, max: 10 }),
      content: new fields.HTMLField({ initial: "" }),
    }), { initial: [] });
    schema.notes = new fields.HTMLField({ initial: "" });

    return schema;
  }
}
