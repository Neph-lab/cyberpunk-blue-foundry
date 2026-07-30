import CyberBlueItemBase from "./base-item.mjs";

export default class CyberBlueAmmo extends CyberBlueItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.cost = new fields.StringField({ required: true, blank: true });
    schema.note = new fields.StringField({ required: true, blank: true });
    // Flat bonus added to the attack roll when this ammo is fired.
    // For smart-weapon-only ammo the bonus only applies when weapon.isSmartWeapon.
    schema.attackBonus = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    // When true, the ammo can only be loaded into Smart Weapons.
    schema.smartWeaponOnly = new fields.BooleanField({ initial: false });
    // When true and fired by a Smart Weapon: if the attack misses by ≤5, roll
    // 1d10+14 and treat that as the attack total instead (no chain re-roll).
    schema.smartMissReroll = new fields.BooleanField({ initial: false });

    // ── Special-ammo effect payload (projected onto the fired weapon) ─────────
    // These let an ammo Item grant weapon-entry behavior at resolve time. See
    // projectAmmoOntoWeapon() in combat-resolution.mjs. Ammo wins where it sets a
    // value; nonTechOnly ammo is inert on Tech Weapons (and can't be loaded).
    // nonTechOnly: loading/effect gate — this ammo is for non-Tech weapons only.
    schema.nonTechOnly = new fields.BooleanField({ initial: false });
    // armorPiercing: ablate 2 SP instead of 1 (Armor-Piercing ammo).
    schema.armorPiercing = new fields.BooleanField({ initial: false });
    // noAblate: the shot degrades no armor at all (Rubber ammo).
    schema.noAblate = new fields.BooleanField({ initial: false });
    // nonLethal: a blow to ≤0 HP leaves the target at 1 HP + Unconscious (Rubber).
    schema.nonLethal = new fields.BooleanField({ initial: false });
    // critRerollForeignObject: on a Foreign Object crit, roll one extra crit
    // result (skipping another Foreign Object) — Hollow-Point ammo.
    schema.critRerollForeignObject = new fields.BooleanField({ initial: false });
    // damageOverride: when set, replaces the weapon's damage formula for the shot.
    schema.damageOverride = new fields.StringField({ required: true, blank: true, initial: '' });
    // Toxic ammo: when toxicDv > 0 the round's own damage only establishes SP
    // penetration; the target then rolls BODY+Endurance vs toxicDv, taking
    // toxicDamage (halved on a success) directly to HP. Cannot crit.
    schema.toxicDv = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.toxicDamage = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.ammoTypes = new fields.SchemaField({
      mediumPistol: new fields.BooleanField({ initial: false }),
      heavyPistol: new fields.BooleanField({ initial: false }),
      veryHeavyPistol: new fields.BooleanField({ initial: false }),
      smg: new fields.BooleanField({ initial: false }),
      shotgunSlug: new fields.BooleanField({ initial: false }),
      shotgunShell: new fields.BooleanField({ initial: false }),
      assault: new fields.BooleanField({ initial: false }),
      sniper: new fields.BooleanField({ initial: false }),
      bow: new fields.BooleanField({ initial: false }),
      grenade: new fields.BooleanField({ initial: false }),
      rocket: new fields.BooleanField({ initial: false }),
      flamethrower: new fields.BooleanField({ initial: false }),
      battery: new fields.BooleanField({ initial: false }),
    });

    return schema;
  }
}
