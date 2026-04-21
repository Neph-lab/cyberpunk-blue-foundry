import CyberBlueDataModel from "./base-model.mjs";

export default class CyberBlueMook extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };

    return {
      stats: new fields.SchemaField({
        body: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 5, min: 0 }),
        }),
      }),
      combatNumber: new fields.NumberField({ ...requiredInteger, initial: 10, min: 0 }),
      resources: new fields.SchemaField({
        hp: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 25, min: 0 }),
          max: new fields.NumberField({ ...requiredInteger, initial: 25, min: 0 }),
        }),
        armor: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
          max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
      }),
      skills: new fields.ArrayField(
        new fields.SchemaField({
          slug: new fields.StringField({ required: true, blank: true }),
          label: new fields.StringField({ required: true, blank: true }),
          rank: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        { initial: [] }
      ),
      components: new fields.ArrayField(
        new fields.SchemaField({
          slug: new fields.StringField({ required: true, blank: true }),
          label: new fields.StringField({ required: true, blank: true }),
          rank: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        { initial: [] }
      ),
      description: new fields.HTMLField({ initial: '' }),
      notes: new fields.HTMLField({ initial: '' }),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.resources.hp.max = (5 * this.stats.body.value) + 10;
    this.resources.hp.value = Math.min(Math.max(this.resources.hp.value, 0), this.resources.hp.max);
    this.resources.armor.value = Math.min(Math.max(this.resources.armor.value, 0), this.resources.armor.max);
  }

  getRollData() {
    return {
      stats: foundry.utils.deepClone(this.stats),
      resources: foundry.utils.deepClone(this.resources),
      combatNumber: this.combatNumber,
    };
  }
}
