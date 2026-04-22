import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueAmmo extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.ammoTypes = new fields.SchemaField({
      pistol: new fields.BooleanField({ initial: false }),
      smg: new fields.BooleanField({ initial: false }),
      shotgunSlug: new fields.BooleanField({ initial: false }),
      shotgunShell: new fields.BooleanField({ initial: false }),
      assault: new fields.BooleanField({ initial: false }),
      sniper: new fields.BooleanField({ initial: false }),
      bow: new fields.BooleanField({ initial: false }),
      grenade: new fields.BooleanField({ initial: false }),
      rocket: new fields.BooleanField({ initial: false }),
      flamethrower: new fields.BooleanField({ initial: false }),
    });

    return schema;
  }
}
