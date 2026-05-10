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
    // Per-bullet damage used only in autofire mode; '' means fall back to `damage`.
    autofireDamage: new fields.StringField({ required: true, blank: true, initial: '' }),
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
    // cs3: Charged Shot 3 — when charged, consumes 3 shots per attack.
    // If 1–2 shots remain, fires all using cs3FallbackDamage (1 die fewer) instead.
    cs3: new fields.BooleanField({ initial: false }),
    cs3FallbackDamage: new fields.StringField({ required: true, blank: true, initial: '' }),
    // chargeKeepsRof: don't force ROF1 while charged (Omaha HP: stays RoF2).
    chargeKeepsRof: new fields.BooleanField({ initial: false }),

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

    // ── Targeted Shot / Aimed Shot ────────────────────────────────────────
    // Extra damage dice rolled on a successful targeted-vitals hit; empty = none.
    // The targetVitalsPenalty value represents the attack penalty for this mode.
    // e.g. Liberty: penalty 2, bonus '1d6'; Unity: penalty 4, bonus '1d6';
    //      Overture: penalty 4, bonus '2d6'.
    targetedShotDamageDice: new fields.StringField({ required: true, blank: true, initial: '' }),

    // ── Armor Piercing ────────────────────────────────────────────────────
    // When this attack would ablate 1 SP, ablates 2 instead (Tactician slug).
    armorPiercing: new fields.BooleanField({ initial: false }),

    // ── Scatter ───────────────────────────────────────────────────────────
    // Targets within 2m to either side of the main target take ½ damage
    // (Brunswick AR single-shot mode).
    scatter: new fields.BooleanField({ initial: false }),

    // ── Shattered Projectiles ─────────────────────────────────────────────
    // Roll damage even on a miss; if total > 15, deal 2d6 to every token
    // within 2m of the target instead (Techtronika Metel VHP).
    shatteredProjectiles: new fields.BooleanField({ initial: false }),

    // ── Short-ammo fallback damage ────────────────────────────────────────
    // Weapons that consume multiple shots per attack (shots > 1) but have
    // fewer than that many left: fire all remaining and use this formula.
    // '' means no fallback — weapon cannot fire if ammo < shots.
    shortAmmoFallbackDamage: new fields.StringField({ required: true, blank: true, initial: '' }),

    // ── Carnage BODY requirement ──────────────────────────────────────────
    // When > 0: firing this mode while actor BODY < this value inflicts a
    // Torn Muscle critical on the attacker rather than blocking the attack.
    critOnBodyReq: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),

    // ── Melee critical injury modifiers ──────────────────────────────────────
    // critSlicing  (Mono-Three, Katana): Broken Arm/Leg → roll 1d6; 2+ = Dismembered.
    // critBlunt    (Baseball Bat): no dismember; would-be dismember → Broken + 5 dmg.
    // critCrushing (Sledgehammer): cascade secondary critical on certain body injuries.
    // critStun     (Stun Baton, Mámù): target at 0–(−10) HP left at 1 HP unconscious.
    // critDoublePick (Monowire): roll the crit table twice; attacker picks preferred result.
    critSlicing: new fields.BooleanField({ initial: false }),
    critBlunt: new fields.BooleanField({ initial: false }),
    critCrushing: new fields.BooleanField({ initial: false }),
    critStun: new fields.BooleanField({ initial: false }),
    critDoublePick: new fields.BooleanField({ initial: false }),

    // ── Vicious (Budget Arms Cut-O-Matic) ────────────────────────────────────
    // While powered on, critical hits deal +5 extra damage on top of the
    // standard critical bonus (i.e. +10 on a normal crit, +20 on vitals crit).
    vicious: new fields.BooleanField({ initial: false }),

    // ── Heavy Recoil (Rostovic Kolac PR) ─────────────────────────────────────
    // Attacker with BODY < 8 takes 1d6 directly to HP after firing.
    heavyRecoil: new fields.BooleanField({ initial: false }),

    // ── Shockwave (Kang Tao Mámù stun gun) ───────────────────────────────────
    // A standing target with BODY < 8 is pushed 2m away on a successful hit.
    shockwave: new fields.BooleanField({ initial: false }),

    // ── Burning Edge (Kendachi Mono-Three) ────────────────────────────────────
    // Assume always active. When true, the weapon ignores any target SP < 11
    // (effectiveSP = SP ≥ 11 ? SP : 0).
    burningEdge: new fields.BooleanField({ initial: false }),

    // ── Charged Attack Bonus (Sanroo Hello Cutie+) ───────────────────────────
    // Extra attack-roll modifier applied when the weapon is in a charged state.
    chargedAttackBonus: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),

    // ── Halve SP (Kendachi Shi Bayonet) ──────────────────────────────────────
    // This weapon entry treats the target's effective SP as Math.ceil(SP / 2).
    // Used for the injected bayonet weapon mode synthesised by mods.mjs.
    halveSP: new fields.BooleanField({ initial: false }),

    // ── Auto-fire-on-10 (Kang Tao S9 Daishi Tang) ────────────────────────────
    // On a single-shot attack where the raw d10 result = 10 and the weapon has
    // ≥ 10 rounds loaded, immediately redirect to autofire instead.
    autoFireOn10: new fields.BooleanField({ initial: false }),

    // ── Double Lock (Tsunami Kappa) ───────────────────────────────────────────
    // Spend 4 ammo for a single attack against 2 targets within 6m of each other.
    // Separate button in the attack column.
    doubleLock: new fields.BooleanField({ initial: false }),

    // ── Electric Charge (Kendachi RA-5 Powered Knife) ────────────────────────
    // The knife carries a battery with electricChargeMax uses. When charges > 0
    // and the weapon hits, the target must pass DV 15 TECH + Endurance or take
    // 2d6 directly to HP. A direct hit on an uninsulated electrical device
    // disables it (handled narratively). Charges tracked via item flags.
    electricCharge: new fields.BooleanField({ initial: false }),
    electricChargeMax: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),

    // ── Chomp Ammo (KTech Terrier SMG) ───────────────────────────────────────
    // On a hit (or autofire miss ≤ 5), the ammo sticks to the target; at the end
    // of the attacker's next turn it deals 1d6 to everyone within 2m of the
    // target. Tracked as a combat flag on the attacker.
    chompAmmo: new fields.BooleanField({ initial: false }),

    // ── Minimum Ammo To Fire (Kang Tao L-69 Zhuo) ────────────────────────────
    // If > 0, the weapon refuses to fire when ammoCurrent < this value.
    // Zhuo requires at least 8 shells loaded.
    minimumAmmoToFire: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),

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
    // Message step — post HTML content to chat and auto-advance
    message:           new fields.StringField({ required: true, blank: true, initial: '' }),
    whisperGm:         new fields.BooleanField({ initial: false }),
    // Flow control
    // failIndex: on a failed check, jump to this step index instead of ending the sequence.
    // -1 = end the sequence on failure (classic behaviour).
    failIndex:         new fields.NumberField({ required: true, nullable: false, integer: true, initial: -1 }),
    // terminates: after this step auto-advances, end the sequence immediately.
    terminates:        new fields.BooleanField({ initial: false }),
    // Effect step extras
    // effectName: look up the AE by name instead of by id (for catalogue items).
    effectName:        new fields.StringField({ required: true, blank: true, initial: '' }),
    // permanent: apply the AE without snapshotting; never revert it.
    permanent:         new fields.BooleanField({ initial: false }),
  });
}
