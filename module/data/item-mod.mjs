import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueMod extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.modType = new fields.StringField({ required: true, blank: false, initial: 'weaponMod' });
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

    return schema;
  }
}
