import CyberBlueActorBase from "./base-actor.mjs";

export default class CyberBlueCharacter extends CyberBlueActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    const buildRankField = () =>
      new fields.SchemaField({
        active: new fields.BooleanField({ initial: false }),
        rank: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        // AE target: system.skills.<slug>.bonus or system.components.<slug>.bonus
        // Use this for cyberware/gear/tactic bonuses — never modify rank via AE.
        // `bonus` is the SKILL/COMPONENT-scoped channel: it is folded INTO the
        // min(skill+skillBonus, component+componentBonus) resolution, so on a
        // skill+component check it can be capped by the lower side.
        bonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        // `generalBonus` is the GENERAL channel: added on top of the min, never
        // capped. Use for aids that should always apply in full (speedware,
        // tech tools, drugs). See CyberBlueActor#getSkillRollContext.
        generalBonus: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      });

    schema.skills = new fields.SchemaField(
      Object.keys(CONFIG.CYBER_BLUE.skills).reduce((accumulator, skillSlug) => {
        accumulator[skillSlug] = buildRankField();
        return accumulator;
      }, {})
    );

    schema.components = new fields.SchemaField(
      Object.keys(CONFIG.CYBER_BLUE.components).reduce((accumulator, componentSlug) => {
        accumulator[componentSlug] = buildRankField();
        return accumulator;
      }, {})
    );

    schema.roleState = new fields.SchemaField({
      activeLowRankRoleId: new fields.StringField({
        required: false,
        nullable: true,
        blank: true,
        initial: null,
      }),
    });

    schema.characterCreation = new fields.SchemaField({
      active: new fields.BooleanField({ initial: false }),
      step: new fields.StringField({ initial: 'welcome', blank: false }),
      extraLanguage: new fields.StringField({ initial: '', blank: true }),
    });

    schema.ip = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.totIP = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
  }

  getRollData() {
    return {
      stats: foundry.utils.deepClone(this.stats),
      resources: foundry.utils.deepClone(this.resources),
      combat: foundry.utils.deepClone(this.combat),
      skills: foundry.utils.deepClone(this.skills),
      components: foundry.utils.deepClone(this.components),
      roleState: foundry.utils.deepClone(this.roleState),
      ip: this.ip,
      totIP: this.totIP,
    };
  }
}
