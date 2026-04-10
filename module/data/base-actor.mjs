import CyberBlueDataModel from "./base-model.mjs";

export default class CyberBlueActorBase extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const buildStatField = (initial = 0) =>
      new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
        rollMod: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });
    const buildValueField = (initial = 0) =>
      new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
      });
    const buildResourceField = (initial = 0) =>
      new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
        max: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
      });
    const buildBonusResourceField = (initial = 0) =>
      new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
        max: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
        maxBonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });
    const buildDerivedValueField = (initial = 0) =>
      new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial, min: 0 }),
        bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });

    return {
      stats: new fields.SchemaField({
        body: buildStatField(6),
        rflx: buildStatField(6),
        int: buildStatField(6),
        tech: buildStatField(6),
        cool: buildStatField(6),
        move: buildStatField(5),
      }),
      resources: new fields.SchemaField({
        hp: buildResourceField(40),
        armor: buildResourceField(0),
        psyche: buildBonusResourceField(60),
        luck: buildResourceField(5),
        seriousWoundThreshold: buildValueField(20),
        deathSave: buildDerivedValueField(6),
      }),
      combat: new fields.SchemaField({
        activeArmorItemId: new fields.StringField({
          required: false,
          nullable: true,
          blank: true,
          initial: null,
        }),
      }),
      details: new fields.SchemaField({
        background: new fields.HTMLField({ initial: "" }),
        appearance: new fields.HTMLField({ initial: "" }),
        personality: new fields.HTMLField({ initial: "" }),
        style: new fields.HTMLField({ initial: "" }),
      }),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.resources.hp.max = (5 * this.stats.body.value) + 10;
    this.resources.armor.max = Math.max(this.resources.armor.max ?? 0, 0);
    this.resources.psyche.max = Math.max(60 + (this.resources.psyche.maxBonus ?? 0), 0);
    this.resources.luck.max = 5;
    this.resources.seriousWoundThreshold.value = Math.floor(this.resources.hp.max / 2);
    this.resources.deathSave.value = Math.max(this.stats.body.value + (this.resources.deathSave.bonus ?? 0), 0);

    for (const [key, resource] of Object.entries(this.resources)) {
      if ((key === 'deathSave') || (key === 'seriousWoundThreshold')) {
        continue;
      }
      resource.value = Math.min(Math.max(resource.value, 0), resource.max);
    }
  }
}
