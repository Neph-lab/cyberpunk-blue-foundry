import CyberBlueItemBase from "./base-item.mjs";
import { buildWeaponField } from "./weapon-schema.mjs";

export default class CyberBlueCyberware extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();
    schema.cyberwareType = new fields.StringField({ required: true, blank: false, initial: 'internal' });
    // BODY minimum to wield without a mount (mostly relevant to MG/HMG cyberware)
    schema.minBodyReq = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.isArmor = new fields.BooleanField({ initial: false });
    schema.isWeapon = new fields.BooleanField({ initial: false });
    schema.isComputer = new fields.BooleanField({ initial: false });
    schema.armor = new fields.SchemaField({
      maxSp: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      currentSp: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });
    schema.weapons = new fields.ArrayField(buildWeaponField(), { initial: [] });
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
    schema.computer = new fields.SchemaField({
      nodes: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      hardwareSlots: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      softwareSlots: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      generalSlots: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      ram: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      isCyberdeck: new fields.BooleanField({ initial: false }),
      canQuickhack: new fields.BooleanField({ initial: false }),
      running: new fields.BooleanField({ initial: false }),
    });
    schema.embeddedMods = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true, blank: true }),
        sourceUuid: new fields.StringField({ required: true, blank: true }),
        modType: new fields.StringField({ required: true, blank: false, initial: 'weaponMod' }),
        name: new fields.StringField({ required: true, blank: true }),
        cost: new fields.StringField({ required: true, blank: true }),
        note: new fields.StringField({ required: true, blank: true }),
        description: new fields.HTMLField({ initial: '' }),
        importedEffects: new fields.ArrayField(
          new fields.SchemaField({
            label: new fields.StringField({ required: true, blank: true }),
            icon: new fields.StringField({ required: true, blank: true }),
            changes: new fields.ArrayField(
              new fields.SchemaField({
                key: new fields.StringField({ required: true, blank: true }),
                mode: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
                value: new fields.StringField({ required: true, blank: true }),
              }),
              { initial: [] }
            ),
          }),
          { initial: [] }
        ),
        targetWeaponIndex: new fields.NumberField({ required: true, nullable: false, integer: true, initial: -1 }),
        weaponChanges: new fields.ArrayField(
          new fields.SchemaField({
            id: new fields.StringField({ required: true, blank: true }),
            key: new fields.StringField({ required: true, blank: false, initial: 'damage' }),
            mode: new fields.StringField({ required: true, blank: false, initial: 'override' }),
            value: new fields.StringField({ required: true, blank: true }),
          }),
          { initial: [] }
        ),
      }),
      { initial: [] }
    );

    return schema;
  }
}
