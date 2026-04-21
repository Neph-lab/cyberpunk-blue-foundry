import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueProgramExecutable extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.programType = new fields.StringField({ required: true, blank: false, initial: 'antipersonnel' });
    schema.act = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.atk = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.def = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.net = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.per = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.rez = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.installedOnId = new fields.StringField({ required: false, nullable: true, blank: true, initial: null });
    schema.notes = new fields.HTMLField({ initial: '' });

    return schema;
  }
}
