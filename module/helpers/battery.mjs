/**
 * Battery layer.
 *
 * A Battery is an Ammo Item with `ammoTypes.battery`. Gear and Cyberware carry
 * a battery pool (`system.battery`, see data/battery-schema.mjs) that installed
 * Mods add capacity to. A weapon on such an item can instead use the battery
 * as its Ammo (`battery.asAmmo`): one battery fills the magazine, and the
 * battery is spent when the magazine runs dry (or is swapped out early).
 *
 * A used-up battery becomes a "Spent <name>" Ammo stack on the owning actor
 * (`system.spent`, `system.spentOf`), which is recharged back from the sheet.
 */

export const SPENT_PREFIX = 'Spent ';
export const DEFAULT_BATTERY_NAME = 'Battery';
const BATTERY_PACK_ID = 'cyberpunk-blue.weapons';

/** True for an Ammo item (doc or plain data) that is a battery of any charge state. */
export function isBattery(ammo) {
  return ammo?.type === 'ammo' && !!ammo.system?.ammoTypes?.battery;
}

/** True for a charged (loadable / insertable) battery. */
export function isChargedBattery(ammo) {
  return isBattery(ammo) && !ammo.system?.spent;
}

/** True for a spent battery stack. */
export function isSpentBattery(ammo) {
  return isBattery(ammo) && !!ammo.system?.spent;
}

export function spentBatteryName(name) {
  return `${SPENT_PREFIX}${name || DEFAULT_BATTERY_NAME}`;
}

/**
 * True when the item's weapons use its battery as their Ammo. Stun guns only
 * accept batteries, so they always count.
 */
export function usesBatteryAsAmmo(itemLike) {
  const system = itemLike?.system ?? {};
  if (!system.isWeapon) return false;
  if (system.battery?.asAmmo) return true;
  return (system.weapons ?? []).some((w) => w?.type === 'stunGun');
}

/**
 * Mods contributing to an item's battery pool: its embedded mods plus the
 * actor's mod Items installed on it. Returns `{ name, batteryCapacity, batteryLife }`.
 */
function getBatteryMods(itemLike, actor) {
  const mods = (itemLike?.system?.embeddedMods ?? []).map((m) => ({
    name: m.name ?? '',
    batteryCapacity: Number(m.batteryCapacity) || 0,
    batteryLife: m.batteryLife ?? '',
  }));
  if (actor && itemLike?.id) {
    for (const modDoc of actor.items ?? []) {
      if (modDoc.type !== 'mod' || modDoc.system?.installedOnId !== itemLike.id) continue;
      mods.push({
        name: modDoc.name ?? '',
        batteryCapacity: Number(modDoc.system.batteryCapacity) || 0,
        batteryLife: modDoc.system.batteryLife ?? '',
      });
    }
  }
  return mods.filter((m) => m.batteryCapacity > 0);
}

/**
 * The item's general battery pool.
 *
 * capacity = the item's own capacity (unless that battery is the weapon's
 * Ammo, which is tracked by the magazine instead) + every installed Mod's
 * batteryCapacity. `life` joins the item's own life text with each mod's.
 *
 * @returns {{ capacity: number, installed: number, life: string, asAmmo: boolean }}
 */
export function getBatteryPool(itemLike, actor = null) {
  const own = itemLike?.system?.battery ?? {};
  const asAmmo = usesBatteryAsAmmo(itemLike);
  const mods = getBatteryMods(itemLike, actor);
  const capacity = (asAmmo ? 0 : (Number(own.capacity) || 0))
    + mods.reduce((sum, m) => sum + m.batteryCapacity, 0);
  const lives = [];
  if (!asAmmo && (Number(own.capacity) || 0) > 0 && own.life) lives.push(own.life);
  for (const m of mods) if (m.batteryLife) lives.push(`${m.name}: ${m.batteryLife}`);
  return {
    capacity,
    installed: Math.min(Math.max(Number(own.installed) || 0, 0), capacity),
    life: lives.join('; '),
    asAmmo,
  };
}

/**
 * A stable reference to a battery's source, for naming its Spent copy later.
 * Actor-owned stacks are deleted when emptied, so prefer the compendium /
 * world source the stack was created from.
 */
export function batterySourceRef(doc) {
  return doc?._stats?.compendiumSource || doc?.flags?.core?.sourceId || doc?.uuid || '';
}

async function resolveBatterySource(actor, ref) {
  if (ref && typeof ref === 'object') return ref;
  if (ref) {
    try {
      const doc = await fromUuid(ref);
      if (isBattery(doc)) return doc;
    } catch { /* not found */ }
  }
  const own = actor?.items?.find((i) => isChargedBattery(i));
  if (own) return own;
  const pack = game.packs.get(BATTERY_PACK_ID);
  if (pack) {
    await pack.getIndex({ fields: ['name', 'type'] });
    const entry = pack.index.find((e) => e.type === 'ammo' && e.name === DEFAULT_BATTERY_NAME);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}

/** Plain Item data for a new battery stack of the given charge state. */
function batteryStackData(source, name, spent) {
  const data = source?.toObject?.() ?? foundry.utils.deepClone(source ?? {});
  delete data._id;
  data.folder = null;
  data.type = 'ammo';
  data.name = spent ? spentBatteryName(name) : name;
  data.system ??= {};
  data.system.ammoTypes = { ...(data.system.ammoTypes ?? {}), battery: true };
  data.system.quantity = 1;
  data.system.spent = spent;
  data.system.spentOf = spent ? name : '';
  return data;
}

/**
 * Add one Spent battery to `actor`, merging into an existing Spent stack of
 * the same battery. `ref` is the used-up battery (doc, uuid or source ref).
 */
export async function createSpentBattery(actor, ref) {
  if (!actor) return;
  const source = await resolveBatterySource(actor, ref);
  const name = (source?.system?.spent ? source.system.spentOf : source?.name) || DEFAULT_BATTERY_NAME;
  const existing = actor.items.find((i) => isSpentBattery(i) && i.system.spentOf === name);
  if (existing) {
    await existing.update({ 'system.quantity': (Number(existing.system.quantity) || 0) + 1 });
    return;
  }
  const data = source
    ? batteryStackData(source, name, true)
    : { name: spentBatteryName(name), type: 'ammo', system: { quantity: 1, spent: true, spentOf: name, ammoTypes: { battery: true } } };
  await actor.createEmbeddedDocuments('Item', [data]);
}

/** Recharge one battery from a Spent stack back into its charged stack. */
export async function rechargeBattery(actor, spentDoc) {
  if (!actor || !isSpentBattery(spentDoc)) return;
  const name = spentDoc.system.spentOf || DEFAULT_BATTERY_NAME;
  const qty = Number(spentDoc.system.quantity) || 0;
  if (qty <= 0) return;

  const charged = actor.items.find((i) => isChargedBattery(i) && i.name === name);
  if (charged) {
    await charged.update({ 'system.quantity': (Number(charged.system.quantity) || 0) + 1 });
  } else {
    await actor.createEmbeddedDocuments('Item', [batteryStackData(spentDoc, name, false)]);
  }
  if (qty - 1 <= 0) await spentDoc.delete();
  else await spentDoc.update({ 'system.quantity': qty - 1 });
}

/**
 * Let the player choose one of several ammo stacks. Resolves to the chosen
 * doc, or null when cancelled. A single stack is returned without a prompt.
 */
export async function promptChooseAmmo(ammoDocs) {
  if (ammoDocs.length <= 1) return ammoDocs[0] ?? null;
  const { promise, resolve } = Promise.withResolvers();
  const buttons = ammoDocs.map((ammoDoc) => ({
    action: ammoDoc.id,
    label: `${ammoDoc.name} (×${ammoDoc.system.quantity})`,
    icon: 'fas fa-box-open',
    callback: () => resolve(ammoDoc.id),
  }));
  buttons.push({ action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fas fa-times', callback: () => resolve(null) });
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: game.i18n.localize('CYBER_BLUE.Combat.ChooseAmmo') },
    content: `<div class="cyberpunk-blue"><p>${game.i18n.localize('CYBER_BLUE.Combat.ChooseAmmoHint')}</p></div>`,
    buttons,
    submit: (result) => resolve(result),
  });
  dialog.addEventListener('close', () => resolve(null), { once: true });
  dialog.render(true);
  const chosenId = await promise;
  return chosenId ? (ammoDocs.find((a) => a.id === chosenId) ?? null) : null;
}

/** Take one charged battery from the actor's inventory into the item's pool. */
export async function insertBattery(actor, item) {
  if (!actor || !item) return;
  const pool = getBatteryPool(item, actor);
  if (pool.capacity <= 0) return;
  if (pool.installed >= pool.capacity) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Battery.PoolFull'));
    return;
  }
  const candidates = actor.items.filter((i) => isChargedBattery(i) && (Number(i.system.quantity) || 0) > 0);
  if (!candidates.length) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Battery.NoneAvailable'));
    return;
  }
  const chosen = await promptChooseAmmo(candidates);
  if (!chosen) return;

  await item.update({
    'system.battery.installed': pool.installed + 1,
    'system.battery.loadedUuid': batterySourceRef(chosen),
  });
  // A fresh battery restores electric-charge uses (Kendachi RA-5).
  for (const key of Object.keys(item.flags?.['cyberpunk-blue'] ?? {})) {
    if (key.startsWith('electricCharge-')) await item.unsetFlag('cyberpunk-blue', key);
  }

  const qty = (Number(chosen.system.quantity) || 0) - 1;
  if (qty <= 0) await chosen.delete();
  else await chosen.update({ 'system.quantity': qty });
}

/** Mark one installed battery in the item's pool as used up. */
export async function useBattery(actor, item) {
  if (!actor || !item) return;
  const pool = getBatteryPool(item, actor);
  if (pool.installed <= 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Battery.NoneInstalled'));
    return;
  }
  await item.update({ 'system.battery.installed': pool.installed - 1 });
  await createSpentBattery(actor, item.system.battery?.loadedUuid);

  // With the pool empty, battery-powered mods on the item switch off.
  if (pool.installed - 1 > 0) return;
  const activeMods = actor.items.filter((m) => m.type === 'mod'
    && m.system.installedOnId === item.id
    && (Number(m.system.batteryCapacity) || 0) > 0
    && m.getFlag('cyberpunk-blue', 'modActive'));
  if (!activeMods.length) return;
  const { toggleModActivation } = await import('./weapon-actions.mjs');
  for (const mod of activeMods) await toggleModActivation(actor, mod.id);
}

/**
 * True when battery-gated behavior on the item may run: either the item has
 * no battery pool at all (legacy / not battery-powered) or one is installed.
 */
export function hasChargedBattery(itemLike, actor = null) {
  const pool = getBatteryPool(itemLike, actor);
  return pool.capacity <= 0 || pool.installed > 0;
}
