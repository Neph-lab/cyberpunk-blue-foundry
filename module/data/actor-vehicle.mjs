import CyberBlueDataModel from "./base-model.mjs";

export default class CyberBlueVehicle extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };

    return {
      stats: new fields.SchemaField({
        move: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 20, min: 0 }),
        }),
        acc: new fields.SchemaField({
          accel: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
        }),
      }),
      resources: new fields.SchemaField({
        hp: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 50, min: 0 }),
          max: new fields.NumberField({ ...requiredInteger, initial: 50, min: 0 }),
        }),
        armor: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
          max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
      }),
      vehicleType: new fields.StringField({ required: true, blank: false, initial: 'land' }),
      description: new fields.HTMLField({ initial: '' }),
      notes: new fields.HTMLField({ initial: '' }),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.resources.hp.value = Math.min(Math.max(this.resources.hp.value, 0), this.resources.hp.max);
    this.resources.armor.value = Math.min(Math.max(this.resources.armor.value, 0), this.resources.armor.max);
  }

  getRollData() {
    return {
      stats: foundry.utils.deepClone(this.stats),
      resources: foundry.utils.deepClone(this.resources),
      vehicleType: this.vehicleType,
    };
  }
}
