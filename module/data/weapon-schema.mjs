/**
 * Shared weapon-entry schema used by both Gear and Cyberware items.
 *
 * Anything inside `system.weapons[N]` lives here. Item-level fields (like
 * `minBodyReq`) stay in the per-item schemas — they describe the weapon as a
 * whole, not a single firing mode.
 */
export function buildWeaponField() {
  const fields = foundry.data.fields;
  const requiredInteger = { required: true, nullable: false, integer: true };

  return new fields.SchemaField({
    // ── Core firing-mode data ─────────────────────────────────────────────
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
    ammoTypeUuid: new fields.StringField({ required: true, blank: true, initial: '' }),

    // ── Weapon-type flags (drive AEs and mod compatibility) ───────────────
    isPowerWeapon: new fields.BooleanField({ initial: false }),
    isSmartWeapon: new fields.BooleanField({ initial: false }),
    isTechWeapon: new fields.BooleanField({ initial: false }),
    isExcellentQuality: new fields.BooleanField({ initial: false }),

    // ── Tech Weapon charge mechanic ───────────────────────────────────────
    // 'keep' (most TW): charges without consuming Move; holds 60s/20rnd
    // 'hold' (Omaha-variant): requires sacrificing Move; lasts only that turn
    chargeType: new fields.StringField({ required: true, blank: true, initial: '' }),

    // ── Built-in silencer (Tenebra, Yanari) ────────────────────────────────
    silenceBuiltIn: new fields.BooleanField({ initial: false }),
    silenceBuiltInDV: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),

    // ── Jam mechanics (Cheap, Poor Quality) ───────────────────────────────
    // jamOnRoll = 1 means "jams when attack die shows this value or lower"
    // jamFiresFirst = true → POQ (fires, then jams); false → JAM (jam blocks shot)
    jamOnRoll: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    jamFiresFirst: new fields.BooleanField({ initial: false }),

    // ── Shotgun shell-mode DV deviation (Testera, Igla → -1) ──────────────
    shellDvModifier: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),

    // ── Target-Vitals penalty override (default magnitude is 8) ───────────
    targetVitalsPenalty: new fields.NumberField({ ...requiredInteger, initial: 8, min: 0 }),

    // ── Toxic Payload bonus (Yanari MP, Hercules 3AX) ─────────────────────
    payloadDmgBonus: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),

    // ── Affliction ─────────────────────────────────────────────────────────
    // Used when damageType is 'affliction', 'affliction-cone', or
    // 'affliction-explosion'.  Damage is only rolled to check SP penetration;
    // no HP loss occurs.  On penetration the target rolls
    // 1d10 + afflictionPrimary + afflictionSkill vs afflictionDv.
    // On failure the referenced disabled AE is copied to them and enabled.
    afflictionPrimary: new fields.StringField({ required: true, blank: true, initial: 'body' }),
    afflictionSkill: new fields.StringField({ required: true, blank: true, initial: '' }),
    afflictionDv: new fields.NumberField({ ...requiredInteger, initial: 13, min: 0 }),
    // _id of a *disabled* ActiveEffect that lives on this Item
    afflictionEffectId: new fields.StringField({ required: true, blank: true, initial: '' }),
  });
}

/**
 * One step in an item's instruction sequence.
 * type='effect' — temporarily enables/disables a named AE on the item.
 * type='check'  — rolls 1d10 + stat + skill (+ component) vs DV; the progress
 *                 flag determines whether rolling ≥ DV advances or ends.
 */
export function buildInstructionStepField() {
  const fields = foundry.data.fields;
  const requiredInteger = { required: true, nullable: false, integer: true };
  return new fields.SchemaField({
    name:          new fields.StringField({ required: true, blank: true, initial: '' }),
    type:          new fields.StringField({ required: true, blank: false, initial: 'check' }),
    // Effect step
    effectId:      new fields.StringField({ required: true, blank: true, initial: '' }),
    effectEnabled: new fields.BooleanField({ initial: true }),
    // Check step
    primary:       new fields.StringField({ required: true, blank: true, initial: 'body' }),
    skill:         new fields.StringField({ required: true, blank: true, initial: '' }),
    component:     new fields.StringField({ required: true, blank: true, initial: '' }),
    dv:            new fields.NumberField({ ...requiredInteger, initial: 13, min: 0 }),
    progress:      new fields.BooleanField({ initial: true }),
    // When true, the check auto-fails if the actor doesn't have the component at all
    // (i.e. componentRank === null). Used for role-gated specialties like Cryotech.
    requiresComponent: new fields.BooleanField({ initial: false }),
  });
}
