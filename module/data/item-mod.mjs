import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueMod extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    schema.modType = new fields.StringField({ required: true, blank: false, initial: 'weaponMod' });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.targetWeaponIndex = new fields.NumberField({ required: true, nullable: false, integer: true, initial: -1 });
    schema.weaponChanges = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true, blank: true }),
        key: new fields.StringField({ required: true, blank: false, initial: 'damage' }),
        mode: new fields.StringField({ required: true, blank: false, initial: 'override' }),
        value: new fields.StringField({ required: true, blank: true }),
      }),
      { initial: [] }
    );
    return schema;
  }
}
