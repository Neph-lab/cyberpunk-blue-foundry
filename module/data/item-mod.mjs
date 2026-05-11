import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueMod extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    // modType: 'weaponMod' | 'cyberwareMod' | 'computerMod'
    schema.modType = new fields.StringField({ required: true, blank: false, initial: 'weaponMod' });
    // For computerMod: which slot type to consume first ('hardware' | 'general')
    schema.computerSlotType = new fields.StringField({ required: true, blank: false, initial: 'hardware' });
    schema.installedOnId = new fields.StringField({ required: true, blank: true });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    schema.targetWeaponIndex = new fields.NumberField({ required: true, nullable: false, integer: true, initial: -1 });
    schema.weaponChanges = new fields.ArrayField(
      new fields.SchemaField({
        id: new fields.StringField({ required: true, blank: true }),
        key: new fields.StringField({ required: true, blank: false, initial: 'damage' }),
        mode: new fields.StringField({ required: true, blank: false, initial: 'override' }),
        value: new fields.StringField({ required: true, blank: true }),
      }),
      { initial: [] }
    );

    // ── Slot count ─────────────────────────────────────────────────────────
    // Most mods occupy 1 slot. Under-barrel attachments (BP-2 Plujka, Cavalry,
    // EFMO2 Boulder, WA20 GL) occupy 2.
    schema.modSlots = new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 });

    // ── Scope categorisation ──────────────────────────────────────────────
    // 'short' (pistols + SMGs), 'long' (SG/MG/AR/PR), 'sniper' (SR-only),
    // or '' for non-scope mods.
    schema.scopeType = new fields.StringField({ required: true, blank: true, initial: '' });
    // Range-improvement scopes: target appears N meters closer or farther.
    schema.rangeImprovementMeters = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 });
    // Bidirectional range improvement (closer or farther).
    schema.rangeImprovementBidirectional = new fields.BooleanField({ initial: false });
    // Thermal-imaging scopes (Hyakume short, Percipient long, Grandstand long).
    schema.thermalImaging = new fields.BooleanField({ initial: false });
    // Digital-link scopes (Hyakume + Handyman): connected user sacrifices Move
    // → +1 attacks with this weapon that turn.
    schema.digitalLink = new fields.BooleanField({ initial: false });
    // Highlighted Vitals: extra die → if 6 + at least one dmg die = 6 → auto crit.
    schema.highlightedVitals = new fields.BooleanField({ initial: false });

    // ── Compatibility flags ────────────────────────────────────────────────
    schema.requiresPowerWeapon = new fields.BooleanField({ initial: false });
    schema.requiresSmartWeapon = new fields.BooleanField({ initial: false });
    schema.requiresTechWeapon = new fields.BooleanField({ initial: false });
    schema.requiresLightMelee = new fields.BooleanField({ initial: false });
    schema.blockedOnPower = new fields.BooleanField({ initial: false });
    schema.blockedOnSmart = new fields.BooleanField({ initial: false });
    schema.blockedOnTech = new fields.BooleanField({ initial: false });

    // ── Silencer family (RC-7 silencers) ──────────────────────────────────
    schema.silenceDV = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.destroyedByTech = new fields.BooleanField({ initial: false });
    schema.destroyedByRof2 = new fields.BooleanField({ initial: false });
    schema.reduceDmgPerDie = new fields.BooleanField({ initial: false });
    schema.compressRof = new fields.BooleanField({ initial: false });
    schema.stealthAdvantage = new fields.BooleanField({ initial: false });

    // ── Muzzle-break family (RC-7 muzzle breaks) ──────────────────────────
    // All muzzle breaks have "Lost Force" (crit needs 6 on extra die).
    schema.lostForce = new fields.BooleanField({ initial: false });
    // Stabilised Recoil: +recoilBonus to attack rolls. recoilAFOnly ⇒ autofire only.
    schema.recoilBonus = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 });
    schema.recoilAFOnly = new fields.BooleanField({ initial: false });
    // Directed Recoil: PW ricochet penalty becomes -1 instead of -4.
    schema.directedRecoil = new fields.BooleanField({ initial: false });
    // Brand synergy: +1 dmg with weapons of `synergyBrand`; +1 more if ≥ synergyDiceThreshold.
    schema.synergyBrand = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.synergyDiceThreshold = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    // ── At-attack-time bonuses ─────────────────────────────────────────────────
    // Burst Control (ClearVue Mk.8): reduce autofire ammo cost by N (minimum 8).
    schema.burstControlAmmoReduction = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    // Beginner Friendly (Add-Vantage): +1 attack if user has 0 Handgun ranks.
    schema.beginnerFriendly = new fields.BooleanField({ initial: false });
    // Target Vitals penalty reduction (Zhanshou): reduces the "target vitals" penalty by N.
    schema.targetVitalsPenaltyReduction = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    // ── Distance-conditional attack bonuses ────────────────────────────────────
    // Trajectory Calculations: +1 attack vs targets >40m (Arasaka SO-21 Saika).
    schema.trajectoryCalculations = new fields.BooleanField({ initial: false });
    // Close Range Bonus: +1 attack vs targets ≤20m (Techtronika RC-7 Ifrit).
    schema.closeRangeBonus = new fields.BooleanField({ initial: false });

    // ── Movement-conditional attack bonuses ────────────────────────────────────
    // Steady: +1 attack if user did not Move this turn.
    schema.steady = new fields.BooleanField({ initial: false });
    // Handling Computer: +1 attack if same target as last attack and no movement.
    schema.handlingComputer = new fields.BooleanField({ initial: false });

    // ── Calibration (Federated Arms Hawk Eye) ─────────────────────────────────
    // DV15 INT+Shoulder Arms action: gain +8 or ×2 skill until fired/moved/acted.
    schema.calibration = new fields.BooleanField({ initial: false });

    // ── Barrier Penetration (Tsunami Ketsuretsu) ──────────────────────────────
    // Each damage die showing 5 or 6 deals 1 extra point of damage bypassing SP.
    schema.barrierPenetration = new fields.BooleanField({ initial: false });

    // ── Improved Ricochet (Malorian Critical Ricochet) ────────────────────────
    // A successful ricochet hit deals +1 damage per die of base weapon damage.
    schema.improvedRicochet = new fields.BooleanField({ initial: false });

    // ── Tech Weapon charge movement mods ─────────────────────────────────────
    // improvedCharge (Tsunami Gaki, Nokota E305 Prospecta): TW sniper scopes.
    // While charging or maintaining charge, MOVE becomes 1 (2m) instead of 0.
    schema.improvedCharge = new fields.BooleanField({ initial: false });
    // srCapacity (Militech SR Capacity): TW-only mod for SG/AR/PR/SR.
    // Can still move at half-MOVE while charging (instead of MOVE 0 on turn 1).
    schema.srCapacity = new fields.BooleanField({ initial: false });

    // ── SR Capacity damage bonus ──────────────────────────────────────────────
    // srCapacity also grants +2 electrical damage on a charged TW hit that
    // bypasses SP. Tracked via the same srCapacity boolean.

    // ── Accidental Discharge (Rostovic RC-7 Strigoi) ─────────────────────────
    // On a single-shot (SS) attack, if the raw d10 attack die result is odd,
    // the weapon consumes 2× ammo (if available) and deals +1 damage per die.
    schema.accidentalDischarge = new fields.BooleanField({ initial: false });

    // ── Bayonet (Kendachi Shi Bayonet) ────────────────────────────────────────
    // When this mod is installed on a weapon, getEffectiveItemWeapons injects a
    // synthetic lightMelee weapon entry (1d6, RoF 2, halveSP: true) so the actor
    // sheet shows a bayonet attack row.
    schema.bayonet = new fields.BooleanField({ initial: false });

    return schema;
  }
}
