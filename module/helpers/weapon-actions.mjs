/**
 * Reusable weapon-action layer.
 *
 * These functions contain the reload / charge / ricochet logic that used to
 * live inline in the actor sheet handlers. They take plain (actor, item,
 * weaponIndex) arguments instead of DOM events, so they can be driven by both
 * the sheet and by auto-generated macros via `actor.runWeaponAction(...)`.
 */
import { getInstalledWeaponMods } from './mods.mjs';
import { buildWeaponUpdate, getWeaponAmmoTypes } from './combat.mjs';
import { getTurnState } from './combat-tracker.mjs';
import { playUiSound } from './audio.mjs';
import { clearWeaponCharge } from './tech-charge.mjs';
import { startRicochetPlacement, clearRicochetPoint } from './ricochet-canvas.mjs';

/**
 * Reload a magazine-fed weapon, prompting for ammo choice when several
 * compatible ammo stacks are present. Unloads any differing ammo type first.
 *
 * @param {Actor}  actor
 * @param {Item}   item
 * @param {number} weaponIndex
 */
export async function reloadWeapon(actor, item, weaponIndex) {
  if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) return;

  const sourceWeapon = item._source?.system?.weapons?.[weaponIndex] ?? {};
  if (sourceWeapon.noReload) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.WeaponNoReload'));
    return;
  }
  const magazine = Math.max(Number(sourceWeapon.magazine) || 0, 0);
  const ammoCurrent = Math.max(Number(sourceWeapon.ammoCurrent) || 0, 0);
  const ammoNeededFull = magazine - ammoCurrent;

  if (ammoNeededFull <= 0) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.WeaponAlreadyFull'));
    return;
  }

  // Find compatible ammo types for this weapon type
  const compatibleAmmoKeys = getWeaponAmmoTypes(sourceWeapon.type ?? '');
  if (compatibleAmmoKeys.length === 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoAmmoType'));
    return;
  }

  // Filter actor's ammo items to those compatible with this weapon.
  // Smart-weapon-only ammo (e.g. Smart Ammo) is excluded for non-smart weapons.
  const isSmartWeapon = !!(sourceWeapon.isSmartWeapon);
  const isTechWeapon = !!(sourceWeapon.isTechWeapon);
  const actorAmmoDocs = actor.items.filter((i) => {
    if (i.type !== 'ammo') return false;
    if (i.system.smartWeaponOnly && !isSmartWeapon) return false;
    if (i.system.nonTechOnly && isTechWeapon) return false; // AP/Hollow/Rubber/Toxic: non-Tech only
    return compatibleAmmoKeys.some((key) => i.system.ammoTypes?.[key]);
  });

  if (actorAmmoDocs.length === 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoCompatibleAmmo'));
    return;
  }

  // If multiple compatible ammo available, prompt player to choose
  let chosenAmmoDoc = actorAmmoDocs[0];
  if (actorAmmoDocs.length > 1) {
    const { promise, resolve } = Promise.withResolvers();
    const buttons = actorAmmoDocs.map((ammoDoc) => ({
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
    if (!chosenId) return;
    chosenAmmoDoc = actorAmmoDocs.find((a) => a.id === chosenId);
    if (!chosenAmmoDoc) return;
  }

  // Determine how many rounds we can load
  let ammoNeeded = ammoNeededFull;
  let currentAfterUnload = ammoCurrent;

  // If loading a different ammo type than currently loaded → unload existing rounds first
  const prevUuid = sourceWeapon.ammoTypeUuid ?? '';
  const sameAmmo = prevUuid && prevUuid === chosenAmmoDoc.uuid;
  if (!sameAmmo && prevUuid && ammoCurrent > 0) {
    // Try to resolve the previously loaded ammo
    let prevAmmoItem = null;
    try { prevAmmoItem = await fromUuid(prevUuid); } catch { /* not found */ }

    // Search for a matching item on the actor (by uuid, then by name)
    let prevOnActor = actor.items.find((i) => i.type === 'ammo' && i.uuid === prevUuid);
    if (!prevOnActor && prevAmmoItem?.name) {
      prevOnActor = actor.items.find((i) => i.type === 'ammo' && i.name === prevAmmoItem.name);
    }
    if (!prevOnActor && !prevAmmoItem) {
      // Try searching world items by name fallback (from world Items directory)
      const worldMatch = game.items.find((i) => i.type === 'ammo' && i.uuid === prevUuid);
      if (worldMatch) prevAmmoItem = worldMatch;
    }

    if (prevOnActor) {
      // Return rounds to existing stack on actor
      await prevOnActor.update({ 'system.quantity': prevOnActor.system.quantity + ammoCurrent });
    } else if (prevAmmoItem) {
      // Create a new ammo entry on the actor with the returned rounds
      const createdData = prevAmmoItem.toObject();
      createdData.system.quantity = ammoCurrent;
      await actor.createEmbeddedDocuments('Item', [createdData]);
    }
    // Empty the mag before reloading with new ammo
    currentAfterUnload = 0;
    ammoNeeded = magazine;
  }

  // Load as many rounds as we have
  const toLoad = Math.min(ammoNeeded, Math.max(Number(chosenAmmoDoc.system.quantity) || 0, 0));
  if (toLoad <= 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoCompatibleAmmo'));
    return;
  }

  const newAmmoCurrent = currentAfterUnload + toLoad;
  const newAmmoQty = chosenAmmoDoc.system.quantity - toLoad;

  playUiSound('reload');
  // Update weapon: new ammo count + record which ammo was used
  await item.update(buildWeaponUpdate(item, weaponIndex, {
    ammoCurrent: newAmmoCurrent,
    ammoTypeUuid: chosenAmmoDoc.uuid,
  }));

  // Update or delete the ammo item
  if (newAmmoQty <= 0) {
    await chosenAmmoDoc.delete();
  } else {
    await chosenAmmoDoc.update({ 'system.quantity': newAmmoQty });
  }
}

/**
 * Toggle the Tech Weapon charge state.
 * If currently charged: manually cancel (set cooldown, remove MOVE AE).
 * Otherwise: charge the weapon (apply MOVE AE, set flags).
 *
 * @param {Actor}  actor
 * @param {Item}   item
 * @param {number} weaponIndex
 */
export async function toggleWeaponCharge(actor, item, weaponIndex) {
  if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) return;

  const isCharged  = !!(item.getFlag('cyberpunk-blue', `charged-${weaponIndex}`));
  const isCooldown = !!(item.getFlag('cyberpunk-blue', `chargeCooldown-${weaponIndex}`));

  if (isCharged) {
    // ── Manual cancel: end charge, set cooldown ──────────────────────────
    await clearWeaponCharge(actor, item, weaponIndex, true /* setCooldown */);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeCancelled', { weapon: item.name })}</p></div>`,
    });
    return;
  }

  if (isCooldown) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.ChargeOnCooldown'));
    return;
  }

  // ── Check if actor has moved this turn ──────────────────────────────────
  const chargeCombatant = game.combat?.started
    ? game.combat.combatants.find((c) => c.actorId === actor.id)
    : null;
  const chargeTurnState = chargeCombatant ? getTurnState(chargeCombatant) : null;
  const moved = (chargeTurnState?.movementUsed ?? 0) > 0;
  if (moved) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.ChargeBlockedByMovement'));
    return;
  }

  // ── Determine MOVE override value ────────────────────────────────────────
  const installedMods    = getInstalledWeaponMods(item, weaponIndex, actor);
  const hasImprovedCharge = installedMods.some((m) => m.improvedCharge);
  const hasSRCapacity    = installedMods.some((m) => m.srCapacity);
  const origMove         = Number(actor.system?.stats?.move?.value) || 0;
  let aeValue;
  if (hasImprovedCharge) {
    aeValue = '1'; // may move 2 m (1 Move unit @ 2 m/unit)
  } else if (hasSRCapacity) {
    aeValue = String(Math.max(1, Math.ceil(origMove / 2)));
  } else {
    aeValue = '0'; // MOVE = 0 this turn
  }

  // ── Create Active Effect on actor ────────────────────────────────────────
  const aeData = {
    name: game.i18n.format('CYBER_BLUE.Combat.ChargeAELabel', { weapon: item.name }),
    icon: 'icons/svg/lightning.svg',
    changes: [{ key: 'system.stats.move.value', mode: 5, value: aeValue }],
    flags: { 'cyberpunk-blue': { twCharge: true, weaponItemId: item.id, weaponIndex } },
  };
  const [ae] = await actor.createEmbeddedDocuments('ActiveEffect', [aeData]);

  // ── Set item charge flags ────────────────────────────────────────────────
  const currentRound = game.combat?.round ?? 0;
  await item.setFlag('cyberpunk-blue', `charged-${weaponIndex}`,        true);
  await item.setFlag('cyberpunk-blue', `chargeStartRound-${weaponIndex}`, currentRound);
  await item.setFlag('cyberpunk-blue', `chargeOrigMove-${weaponIndex}`, origMove);
  await item.setFlag('cyberpunk-blue', `chargeAeId-${weaponIndex}`,     ae.id);

  const moveNote = aeValue === '0'
    ? game.i18n.localize('CYBER_BLUE.Combat.ChargeMoveZero')
    : game.i18n.format('CYBER_BLUE.Combat.ChargeMoveReduced', { move: aeValue });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeBegun', { weapon: item.name })} ${moveNote}</p></div>`,
  });
}

/**
 * Toggle an activatable weapon mod on or off (Thermal Advantage, Riptide,
 * Bipod, Vibro-Stun). Generic counterpart to toggleWeaponCharge: the state lives
 * on the mod Item as flag `cyberpunk-blue.modActive`, and the mod's `active*`
 * fields only take effect while it is set.
 *
 * Mods with `activationBlocksMove` follow the Charge restriction — they cannot be
 * activated after moving this turn, and drop the actor's MOVE to 0 while active.
 * Mods with `activationSelfEffect` copy that named ActiveEffect from the mod onto
 * the actor while active.
 *
 * @param {Actor}  actor
 * @param {string} modDocId  Id of the installed mod Item.
 */
export async function toggleModActivation(actor, modDocId) {
  const modDoc = actor?.items?.get(modDocId);
  if (!modDoc || modDoc.type !== 'mod' || !modDoc.system.activatable) return;

  const isActive = !!modDoc.getFlag('cyberpunk-blue', 'modActive');

  if (isActive) {
    // ── Deactivate: drop the self-AE and the MOVE lock ──────────────────────
    const aeId = modDoc.getFlag('cyberpunk-blue', 'modActiveAeId');
    if (aeId) {
      const ae = actor.effects?.get(aeId);
      if (ae) { try { await ae.delete(); } catch { /* already gone */ } }
      try { await modDoc.unsetFlag('cyberpunk-blue', 'modActiveAeId'); } catch { }
    }
    const moveAeId = modDoc.getFlag('cyberpunk-blue', 'modActiveMoveAeId');
    if (moveAeId) {
      const ae = actor.effects?.get(moveAeId);
      if (ae) { try { await ae.delete(); } catch { /* already gone */ } }
      try { await modDoc.unsetFlag('cyberpunk-blue', 'modActiveMoveAeId'); } catch { }
    }
    await modDoc.setFlag('cyberpunk-blue', 'modActive', false);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-power-off"></i> ${game.i18n.format('CYBER_BLUE.Combat.ModDeactivated', { mod: modDoc.name })}</p></div>`,
    });
    return;
  }

  // ── Activate ─────────────────────────────────────────────────────────────
  if (modDoc.system.activationBlocksMove) {
    const combatant = game.combat?.started
      ? game.combat.combatants.find((c) => c.actorId === actor.id)
      : null;
    const turnState = combatant ? getTurnState(combatant) : null;
    if ((turnState?.movementUsed ?? 0) > 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.ModBlockedByMovement'));
      return;
    }
    const [moveAe] = await actor.createEmbeddedDocuments('ActiveEffect', [{
      name: game.i18n.format('CYBER_BLUE.Combat.ModDeployedAELabel', { mod: modDoc.name }),
      icon: 'icons/svg/anchor.svg',
      changes: [{ key: 'system.stats.move.value', mode: 5, value: '0' }],
      flags: { 'cyberpunk-blue': { modActivation: true, modDocId } },
    }]);
    await modDoc.setFlag('cyberpunk-blue', 'modActiveMoveAeId', moveAe.id);
  }

  const selfEffectName = modDoc.system.activationSelfEffect;
  if (selfEffectName) {
    const source = modDoc.effects.find((e) => e.name === selfEffectName);
    if (source) {
      const aeData = source.toObject();
      aeData.disabled = false;
      delete aeData._id;
      foundry.utils.setProperty(aeData, 'flags.cyberpunk-blue.modActivation', true);
      const [ae] = await actor.createEmbeddedDocuments('ActiveEffect', [aeData]);
      await modDoc.setFlag('cyberpunk-blue', 'modActiveAeId', ae.id);
    }
  }

  await modDoc.setFlag('cyberpunk-blue', 'modActive', true);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-power-off"></i> ${game.i18n.format('CYBER_BLUE.Combat.ModActivated', { mod: modDoc.name })}</p></div>`,
  });
}

/**
 * Toggle the Power Weapon ricochet point.
 * If a point is already set: clear it.
 * Otherwise: enter placement mode and wait for a canvas click.
 *
 * @param {Actor} actor
 */
export async function toggleWeaponRicochet(actor) {
  const existing = actor.getFlag?.('cyberpunk-blue', 'ricochetPoint');
  if (existing) {
    await clearRicochetPoint(actor);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-circle-xmark"></i> ${game.i18n.format('CYBER_BLUE.Combat.RicochetCleared', { name: actor.name })}</p></div>`,
    });
  } else {
    await startRicochetPlacement(actor);
  }
}
