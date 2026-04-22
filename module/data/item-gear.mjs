import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueGear extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    const buildWeaponField = () => new fields.SchemaField({
      type: new fields.StringField({ required: true, blank: false, initial: 'lightMelee' }),
      skill: new fields.StringField({ required: true, blank: false, initial: 'meleeWeapons' }),
      damage: new fields.StringField({ required: true, blank: true, initial: '1d6' }),
      rateOfFire: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      magazine: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      ammoCurrent: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      shots: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      hands: new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 }),
      concealable: new fields.BooleanField({ initial: false }),
      damageType: new fields.StringField({ required: true, blank: true, initial: '' }),
      autofireMultiplier: new fields.NumberField({ required: true, nullable: false, initial: 1 }),
      autofireRangeTable: new fields.ArrayField(
        new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        { initial: Array(8).fill(0) }
      ),
      coneSpread: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      coneAngle: new fields.NumberField({ ...requiredInteger, initial: 45, min: 0 }),
      coneHalfDamageDistance: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      rangeTable: new fields.ArrayField(
        new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        { initial: Array(8).fill(0) }
      ),
    });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.notes = new fields.HTMLField({ initial: '' });
    schema.isArmor = new fields.BooleanField({ initial: false });
    schema.isWeapon = new fields.BooleanField({ initial: false });
    schema.isComputer = new fields.BooleanField({ initial: false });
    schema.armor = new fields.SchemaField({
      maxSp: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      currentSp: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.weapons = new fields.ArrayField(buildWeaponField(), { initial: [] });
    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.state = new fields.StringField({ required: true, blank: false, initial: 'carried' });
    schema.carried = new fields.BooleanField({ initial: true });
    schema.equipped = new fields.BooleanField({ initial: false });

    return schema;
  }
}
