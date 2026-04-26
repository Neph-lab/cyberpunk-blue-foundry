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
  });
}
