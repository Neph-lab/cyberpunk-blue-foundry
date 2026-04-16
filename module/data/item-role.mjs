import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueRole extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    const buildGrantedItemField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      uuid: new fields.StringField({ required: true, blank: true }),
      name: new fields.StringField({ required: true, blank: true }),
      type: new fields.StringField({ required: true, blank: true, initial: 'item' }),
      img: new fields.StringField({ required: true, blank: true }),
    });
    const buildGrantedItemGroupField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      label: new fields.StringField({ required: true, blank: true }),
      mode: new fields.StringField({ required: true, blank: false, initial: 'all' }),
      count: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      items: new fields.ArrayField(buildGrantedItemField(), { initial: [] }),
    });
    const buildLeaderFeatureField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      unlockRank: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0, max: 10 }),
      name: new fields.StringField({ required: true, blank: true }),
      description: new fields.StringField({ required: true, blank: true }),
      selectionCount: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      permission: new fields.StringField({ required: true, blank: false, initial: 'observer' }),
      options: new fields.ArrayField(buildGrantedItemField(), { initial: [] }),
      selectedUuids: new fields.ArrayField(new fields.StringField({ required: true, blank: true }), { initial: [] }),
    });
    const buildProteanFocusField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      name: new fields.StringField({ required: true, blank: true }),
      description: new fields.StringField({ required: true, blank: true }),
      unlockRank: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0, max: 10 }),
      minPoints: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      maxPoints: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 }),
      step: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      points: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    const buildSpecialtyOptionField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      name: new fields.StringField({ required: true, blank: true }),
      description: new fields.StringField({ required: true, blank: true }),
    });
    const buildSpecialtyOptionGroupField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      unlockRank: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0, max: 10 }),
      choices: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      options: new fields.ArrayField(buildSpecialtyOptionField(), { initial: [] }),
      selectedOptionIds: new fields.ArrayField(new fields.StringField({ required: true, blank: true }), { initial: [] }),
    });
    const buildSpecialtySectionField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      unlockRank: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0, max: 10 }),
      content: new fields.HTMLField({ initial: '' }),
    });
    const buildSpecialtyField = () => new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      name: new fields.StringField({ required: true, blank: true }),
      description: new fields.StringField({ required: true, blank: true }),
      rank: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 }),
      unlockSections: new fields.ArrayField(buildSpecialtySectionField(), { initial: [] }),
      optionGroups: new fields.ArrayField(buildSpecialtyOptionGroupField(), { initial: [] }),
    });

    schema.rank = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 10 });
    schema.category = new fields.StringField({ required: true, blank: false, initial: 'sundry' });
    schema.lifepathLinks = new fields.HTMLField({ initial: "" });
    schema.lifepathQuestions = new fields.HTMLField({ initial: "" });
    schema.abilityOverview = new fields.HTMLField({ initial: "" });
    schema.abilitySections = new fields.ArrayField(new fields.SchemaField({
      id: new fields.StringField({ required: true, blank: false, initial: '' }),
      unlockRank: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0, max: 10 }),
      content: new fields.HTMLField({ initial: "" }),
    }), { initial: [] });
    schema.grantedItemGroups = new fields.ArrayField(buildGrantedItemGroupField(), { initial: [] });
    schema.leaderFeatures = new fields.ArrayField(buildLeaderFeatureField(), { initial: [] });
    schema.proteanFoci = new fields.ArrayField(buildProteanFocusField(), { initial: [] });
    schema.specialties = new fields.ArrayField(buildSpecialtyField(), { initial: [] });
    schema.notes = new fields.HTMLField({ initial: "" });

    return schema;
  }
}
