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
      // NET Combat configuration. Identical shape on the Program Executable item
      // (item-program-executable.mjs); kept in lockstep by the whole-object sync
      // in netrunning.mjs. See net-program-combat.mjs for the resolution logic.
      netCombat: CyberBlueProgram.defineNetCombatSchema(),
    };
  }

  /**
   * Shared NET Combat sub-schema. Defined once here and re-used verbatim by the
   * Program Executable item so the two documents stay byte-for-byte compatible
   * and the whole-object sync can copy `system.netCombat` between them.
   */
  static defineNetCombatSchema() {
    const fields = foundry.data.fields;
    const int = (initial = 0) => new fields.NumberField({ required: true, nullable: false, integer: true, initial });
    const str = (initial = '') => new fields.StringField({ required: true, blank: true, initial });
    const bool = (initial = false) => new fields.BooleanField({ initial });

    return new fields.SchemaField({
      attack: new fields.SchemaField({
        // 'none' | 'attack' | 'support'
        mode: new fields.StringField({ required: true, blank: false, initial: 'none' }),
        supportModifier: int(0),
        stopRunningAfter: bool(false),
        damage: new fields.SchemaField({
          enabled: bool(false),
          formula: str(''),
        }),
        affliction: new fields.SchemaField({
          enabled: bool(false),
          primary: new fields.StringField({ required: true, blank: false, initial: 'body' }),
          skill: str(''),
          component: str(''),
          dv: int(13),
          // Document-local AE _id (NOT synced — see netrunning.mjs).
          effectId: str(''),
        }),
        effectText: new fields.SchemaField({
          enabled: bool(false),
          text: str(''),
        }),
      }),
      defense: new fields.SchemaField({
        // 'standard' | 'defender' | 'personnel' | 'program'
        mode: new fields.StringField({ required: true, blank: false, initial: 'standard' }),
        ablate: bool(false),
        cool: bool(false),
        reduce: new fields.SchemaField({ enabled: bool(false), formula: str('') }),
        strengthen: new fields.SchemaField({ enabled: bool(false), amount: int(0) }),
        block: new fields.SchemaField({ enabled: bool(false), amount: int(0) }),
        memHandler: bool(false),
        junkData: bool(false),
        effectText: str(''),
      }),
      booster: new fields.SchemaField({
        boosts: new fields.ArrayField(new fields.SchemaField({
          component: str(''),
          use: str(''),
          value: int(0),
        })),
      }),
    });
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
