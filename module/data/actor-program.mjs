import CyberBlueDataModel from "./base-model.mjs";

export default class CyberBlueProgram extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };

    return {
      stats: new fields.SchemaField({
        act: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        atk: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        def: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        net: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
        per: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
      }),
      resources: new fields.SchemaField({
        rez: new fields.SchemaField({
          value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
          max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        }),
      }),
      programType: new fields.StringField({ required: true, blank: false, initial: 'antipersonnel' }),
      // Full UUID of the linked Program Executable item. Two link modes share
      // this single field:
      //   • Referenced (Mode A): a UUID pointing at an exe living elsewhere
      //     (e.g. installed on a Netrunner's cyberdeck) — `Actor.x.Item.y`.
      //   • Attached (Mode B): a UUID pointing at an exe embedded on THIS
      //     program actor — resolves to an item whose parent is this actor.
      // While the UUID resolves, all corresponding fields are kept in two-way
      // sync between the actor and the executable (see netrunning.mjs).
      executableUuid: new fields.StringField({ required: false, nullable: true, blank: true, initial: null }),
      description: new fields.HTMLField({ initial: '' }),
      notes: new fields.HTMLField({ initial: '' }),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    if (!this.resources?.rez) return;
    this.resources.rez.value = Math.min(Math.max(this.resources.rez.value, 0), this.resources.rez.max);
  }

  getRollData() {
    return {
      stats: foundry.utils.deepClone(this.stats),
      resources: foundry.utils.deepClone(this.resources),
    };
  }
}
