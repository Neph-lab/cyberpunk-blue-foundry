/**
 * Battery pool shared by Gear and Cyberware.
 *
 * capacity   — how many batteries the item holds (0 = the item uses none).
 *              Installed Mods add their `batteryCapacity` on top of this
 *              (see getBatteryPool in helpers/battery.mjs).
 * installed  — how many charged batteries are currently in the pool.
 * life       — free text describing how long a battery lasts ("8 hours").
 * asAmmo     — weapons only: the weapon's magazine IS a battery. One battery
 *              fills the magazine; when the magazine runs dry the battery is
 *              spent. This battery is separate from the general pool.
 * loadedUuid — source Battery of the most recent insert; used to name and
 *              create the matching "Spent …" item when the battery runs out.
 */
export function buildBatteryField() {
  const fields = foundry.data.fields;
  const requiredInteger = { required: true, nullable: false, integer: true };
  return new fields.SchemaField({
    capacity: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    installed: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    life: new fields.StringField({ required: true, blank: true, initial: '' }),
    asAmmo: new fields.BooleanField({ initial: false }),
    loadedUuid: new fields.StringField({ required: true, blank: true, initial: '' }),
  });
}

/** Embedded-mod battery fields (mirrors CyberBlueMod.batteryCapacity/batteryLife). */
export function buildModBatteryFields() {
  const fields = foundry.data.fields;
  return {
    batteryCapacity: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 }),
    batteryLife: new fields.StringField({ required: true, blank: true, initial: '' }),
  };
}
