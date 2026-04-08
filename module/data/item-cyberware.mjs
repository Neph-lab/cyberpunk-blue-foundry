import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueCyberware extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.cyberwareType = new fields.StringField({ required: true, blank: false, initial: 'internal' });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.multipleInstalls = new fields.BooleanField({ initial: false });
    schema.integration = new fields.StringField({ required: true, blank: false, initial: 'standalone' });
    schema.slotsUsed = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.slotsProvided = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.parentCyberwareId = new fields.StringField({
      required: false,
      nullable: true,
      blank: true,
      initial: null,
    });
    schema.installed = new fields.BooleanField({ initial: true });
    schema.psycheLossFormula = new fields.StringField({ required: true, blank: true });
    schema.hardwareCost = new fields.StringField({ required: true, blank: true });
    schema.facilities = new fields.StringField({ required: true, blank: false, initial: 'clinic' });
    schema.installationCost = new fields.StringField({ required: true, blank: true });
    schema.installationDv = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.useCyberneticsComponent = new fields.BooleanField({ initial: false });
    schema.notes = new fields.HTMLField({ initial: '' });

    return schema;
  }
}
