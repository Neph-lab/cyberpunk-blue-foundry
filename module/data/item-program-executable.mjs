import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueProgramExecutable extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.programType = new fields.StringField({ required: true, blank: false, initial: 'antipersonnel' });
    // Category used for compendium organisation and display
    // Values: 'attack' | 'black-ice' | 'defender' | 'booster' | 'daemon' | 'quickhack' | 'malware'
    schema.category = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.ram = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });
    schema.act = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.atk = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.def = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.net = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.per = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.rez = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.running = new fields.BooleanField({ initial: false });
    schema.installedOnId = new fields.StringField({ required: false, nullable: true, blank: true, initial: null });
    // Optional override for the dice formula used when this program auto-attacks
    // (Black ICE node-entry attacks). Leave blank to use the ATK-based default.
    schema.damageFormula = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.notes = new fields.HTMLField({ initial: '' });

    return schema;
  }
}
