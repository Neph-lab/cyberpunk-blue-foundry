import CyberBlueDataModel from "./base-model.mjs";

export default class CyberBlueMook extends CyberBlueDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };

    // Mooks track which skills/components they are "listed" (trained) in via `active`.
    // The shape mirrors the character schema so roll-adjusting AEs (cyberware, gear,
    // tactics, etc.) can target `system.skills.<slug>.bonus` /
    // `system.components.<slug>.bonus` exactly as they do on characters.
    // `rank` is unused for mook checks — those resolve from the Combat Number
    // (see CyberBlueActor#getSkillRollContext) — but is kept for schema parity.
    const buildRankField = () =>
      new fields.SchemaField({
        active: new fields.BooleanField({ initial: false }),
        rank: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });

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
      skills: new fields.SchemaField(
        Object.keys(CONFIG.CYBER_BLUE.skills).reduce((accumulator, skillSlug) => {
          accumulator[skillSlug] = buildRankField();
          return accumulator;
        }, {})
      ),
      components: new fields.SchemaField(
        Object.keys(CONFIG.CYBER_BLUE.components).reduce((accumulator, componentSlug) => {
          accumulator[componentSlug] = buildRankField();
          return accumulator;
        }, {})
      ),
      description: new fields.HTMLField({ initial: '' }),
      notes: new fields.HTMLField({ initial: '' }),
      money: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    };
  }

  static migrateData(source) {
    // Legacy mooks stored skills/components as an ArrayField of {slug,label,rank}.
    // Convert any such array into the keyed object shape, marking each listed
    // entry active. Unknown slugs are dropped (the SchemaField only accepts
    // CONFIG-defined keys).
    for (const key of ['skills', 'components']) {
      if (Array.isArray(source?.[key])) {
        const converted = {};
        for (const entry of source[key]) {
          if (!entry?.slug) continue;
          converted[entry.slug] = { active: true, rank: Number(entry.rank) || 0, bonus: 0 };
        }
        source[key] = converted;
      }
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    if (!this.resources?.hp || !this.stats?.body) return;
    this.resources.hp.max = (5 * this.stats.body.value) + 10;
    this.resources.hp.value = Math.min(Math.max(this.resources.hp.value, 0), this.resources.hp.max);
    if (this.resources.armor) {
      this.resources.armor.value = Math.min(Math.max(this.resources.armor.value, 0), this.resources.armor.max);
    }
  }

  getRollData() {
    return {
      stats: foundry.utils.deepClone(this.stats),
      resources: foundry.utils.deepClone(this.resources),
      combatNumber: this.combatNumber,
      skills: foundry.utils.deepClone(this.skills),
      components: foundry.utils.deepClone(this.components),
    };
  }
}
