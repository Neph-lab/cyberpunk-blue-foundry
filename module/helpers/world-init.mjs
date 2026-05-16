/**
 * World-initialization utilities.
 *
 * Provides:
 *  - resolveItemUuidByName(name, { itemType })  — finds an item by name,
 *    importing it from the first matching compendium if not already in the world
 *  - syncRoleGrantedItemGroups()  — resolves all role starting-gear item names
 *    to UUIDs and writes them back to the roles compendium
 */

import { ROLE_STARTING_GEAR } from '../data/role-starting-gear.mjs';

const ROLES_PACK_ID = 'cyberpunk-blue.roles';

/**
 * Resolve an item by name to a UUID.  Checks world items first, then all
 * item-type compendium packs.  Returns the UUID of the first match (exact
 * name first, case-insensitive fallback).
 *
 * The returned UUID may point to a world item or a compendium entry;
 * both work with `fromUuid()`.
 *
 * @param {string} name
 * @param {{ itemType?: string }} [opts]
 * @returns {Promise<string|null>}
 */
export async function resolveItemUuidByName(name, { itemType } = {}) {
  // 1. World items — fastest, already loaded
  const worldItems = itemType
    ? game.items.contents.filter((i) => i.type === itemType)
    : game.items.contents;
  const worldMatch = worldItems.find((i) => i.name === name)
    ?? worldItems.find((i) => i.name.toLowerCase() === name.toLowerCase());
  if (worldMatch) return worldMatch.uuid;

  // 2. Compendium packs — return the compendium UUID directly (no import needed;
  //    fromUuid() can resolve compendium UUIDs at runtime)
  const itemPacks = game.packs.filter((p) => p.documentName === 'Item');
  for (const pack of itemPacks) {
    await pack.getIndex({ fields: ['name', 'type'] });
    const entry = pack.index.find((e) => e.name === name)
      ?? pack.index.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (!entry) continue;
    if (itemType && entry.type !== itemType) continue;
    return `Compendium.${pack.collection}.${entry._id}`;
  }

  console.warn(`Cyberpunk Blue | resolveItemUuidByName: "${name}" not found in world or any compendium.`);
  return null;
}

/**
 * For every role in ROLE_STARTING_GEAR, resolve item names → UUIDs and update
 * the grantedItemGroups on the role in the roles compendium.
 *
 * Safe to call multiple times (idempotent: UUIDs are only written / updated,
 * never duplicated).
 */
export async function syncRoleGrantedItemGroups() {
  if (!game.user.isGM) return;

  const pack = game.packs.get(ROLES_PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | syncRoleGrantedItemGroups: roles compendium not found.');
    return;
  }

  await pack.getIndex({ fields: ['name'] });

  const toUpdate = [];

  for (const [roleName, groupDefs] of Object.entries(ROLE_STARTING_GEAR)) {
    const entry = pack.index.find((e) => e.name === roleName);
    if (!entry) {
      console.warn(`Cyberpunk Blue | syncRoleGrantedItemGroups: role "${roleName}" not in compendium.`);
      continue;
    }

    const grantedItemGroups = [];

    for (const groupDef of groupDefs) {
      const resolvedItems = [];
      for (const itemDef of groupDef.items) {
        const uuid = await resolveItemUuidByName(itemDef.name);
        resolvedItems.push({
          id:       itemDef.id,
          uuid:     uuid ?? '',
          name:     itemDef.name,
          type:     'item',
          img:      '',
          quantity: itemDef.quantity ?? 1,
        });
      }

      grantedItemGroups.push({
        id:    groupDef.id,
        label: groupDef.label,
        mode:  groupDef.mode,
        count: groupDef.count,
        items: resolvedItems,
      });
    }

    toUpdate.push({
      _id: entry._id,
      'system.grantedItemGroups': grantedItemGroups,
    });
  }

  if (!toUpdate.length) {
    console.log('Cyberpunk Blue | syncRoleGrantedItemGroups: nothing to update.');
    return;
  }

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(toUpdate, { pack: ROLES_PACK_ID });
    console.log(`Cyberpunk Blue | Role starting gear synced for ${toUpdate.length} roles.`);
    ui.notifications.info(`Cyberpunk Blue: Role starting gear synced (${toUpdate.length} roles).`);
  } catch (err) {
    console.error('Cyberpunk Blue | syncRoleGrantedItemGroups failed:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}
