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
