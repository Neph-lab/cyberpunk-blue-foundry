/**
 * Socket delegation for actions that require GM permissions.
 *
 * Players may attack actors they don't own (e.g. NPCs). The resulting
 * applyDamage / rollCriticalInjury calls require update permission on the
 * target actor. This module delegates those operations to the GM via the
 * system socket when the current user lacks the necessary permission.
 */

export const SOCKET_NAME = 'system.cyberpunk-blue';

/**
 * Tell a specific user to switch their active scene.
 * Emits to all clients; only the targeted user acts.
 *
 * @param {string} sceneId      - ID of the Scene to view
 * @param {string} targetUserId - ID of the User who should switch
 */
export function emitSceneSwitchForUser(sceneId, targetUserId) {
  game.socket.emit(SOCKET_NAME, { type: 'netSwitchScene', sceneId, targetUserId });
}

/**
 * Register the socket listener on the GM side.
 * Call this once from the 'ready' hook.
 */
export function registerSocketHandlers() {
  game.socket.on(SOCKET_NAME, async (message) => {
    // playSfx: every client plays the sound at their own interface volume.
    if (message.type === 'playSfx') {
      const { playSfxLocal } = await import('./audio.mjs');
      playSfxLocal(message.sound);
      return;
    }

    // netSwitchScene is handled by every client (not GM-only) — the handler
    // guards against acting on messages not addressed to this user.
    if (message.type === 'netSwitchScene') {
      if (message.targetUserId !== game.user.id) return;
      // The GM may have just granted this user view permission on the target
      // scene. That document arrives via a separate broadcast that can land
      // AFTER this message, so the scene may not be in the collection yet.
      // Poll briefly for it before giving up.
      let scene = game.scenes.get(message.sceneId);
      for (let i = 0; i < 20 && !scene; i++) {
        await new Promise((r) => setTimeout(r, 250));
        scene = game.scenes.get(message.sceneId);
      }
      if (scene) await scene.view();
      else console.warn(`Cyberpunk Blue | netSwitchScene: scene ${message.sceneId} never became available to ${game.user.name}`);
      return;
    }

    // Only the ACTIVE GM executes the mutating requests below — running them on
    // every GM client would double-apply damage/crits/effects whenever a second
    // (or stale) GM session is connected.
    if (game.user !== game.users.activeGM) return;

    switch (message.type) {
      case 'applyDamage': {
        const { targetUuid, finalDamage } = message;
        const actor = await fromUuid(targetUuid);
        if (!actor) return;
        await actor.applyDamage(finalDamage);
        break;
      }
      case 'rollCriticalInjury': {
        const { targetUuid, tableType, attackerUuid, weaponFlags } = message;
        const { rollCriticalInjury } = await import('./critical-injury.mjs');
        const actor = await fromUuid(targetUuid);
        const attacker = attackerUuid ? await fromUuid(attackerUuid) : null;
        if (!actor) return;
        await rollCriticalInjury(actor, tableType, { attackerActor: attacker, weaponFlags: weaponFlags ?? {} });
        break;
      }
      case 'rollVehicleCritical': {
        const { targetUuid, vitalRegionId = null } = message;
        const { rollVehicleCritical } = await import('./vehicle-damage.mjs');
        const actor = await fromUuid(targetUuid);
        if (!actor) return;
        await rollVehicleCritical(actor, null, vitalRegionId);
        break;
      }
      case 'applyDamageToSubsystem': {
        const { vehicleUuid, subsystemItemId, rawDamage } = message;
        const { applyDamageToSubsystem } = await import('./vehicle-damage.mjs');
        const vehicle = await fromUuid(vehicleUuid);
        const sub = vehicle?.items?.get(subsystemItemId);
        if (sub?.type !== 'vehicleSubsystem') return;
        await applyDamageToSubsystem(sub, rawDamage);
        break;
      }
      case 'applyForcedCriticalInjury': {
        const { targetUuid, injuryKey, attackerUuid } = message;
        // Import lazily to avoid circular reference
        const { applyForcedCriticalInjuryGM } = await import('./socket-injury.mjs');
        const actor = await fromUuid(targetUuid);
        const attacker = attackerUuid ? await fromUuid(attackerUuid) : null;
        if (!actor) return;
        await applyForcedCriticalInjuryGM(actor, injuryKey, attacker);
        break;
      }
      case 'toggleStatusEffect': {
        const { actorUuid, statusId, active } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        await actor.toggleStatusEffect(statusId, { active });
        break;
      }
      case 'setFlag': {
        const { actorUuid, scope, key, value } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        await actor.setFlag(scope, key, value);
        break;
      }
      case 'updateActor': {
        const { actorUuid, updateData } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        await actor.update(updateData);
        break;
      }
      case 'unsetFlag': {
        const { actorUuid, scope, key } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        await actor.unsetFlag(scope, key);
        break;
      }
      case 'createActiveEffect': {
        const { actorUuid, aeData } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        await actor.createEmbeddedDocuments('ActiveEffect', [aeData]);
        break;
      }
      case 'deleteActorItem': {
        const { actorUuid, itemId } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        await actor.deleteEmbeddedDocuments('Item', [itemId]);
        break;
      }
      case 'ablateArmorExtra': {
        // Armor Piercing: ablate 1 additional SP point after normal damage application.
        const { actorUuid } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        const armor = actor.getActiveArmorItem?.();
        if (!armor) return;
        const currentSp = Math.max(Math.min(armor.system.armor?.currentSp ?? 0, armor.system.armor?.maxSp ?? 0), 0);
        if (currentSp > 0) await armor.update({ 'system.armor.currentSp': currentSp - 1 });
        break;
      }
      case 'netConnect': {
        // A player asked the GM to execute the architecture connection on their behalf.
        // (Multi-GM double-execution is already excluded by the activeGM gate above.)
        const { actorUuid, apSceneId, apRegionId, userId } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        const apScene = game.scenes.get(apSceneId);
        const apRegion = apScene?.regions?.get(apRegionId);
        if (!apRegion) return;
        const { connectToArchitecture } = await import('./netrunning.mjs');
        await connectToArchitecture(actor, apRegion, { forUserId: userId });
        break;
      }
      case 'netDisconnect': {
        // A player asked the GM to execute the architecture disconnect on their behalf.
        const { actorUuid, safe, userId } = message;
        const actor = await fromUuid(actorUuid);
        if (!actor) return;
        const { disconnectFromArchitecture } = await import('./netrunning.mjs');
        await disconnectFromArchitecture(actor, safe ?? true, { forUserId: userId });
        break;
      }
      // ── Guide Role: native Cards operations (players are Observers of the
      //    deck/pile and cannot move cards, so they delegate to the GM). ──
      case 'guideProvision':
      case 'guideDeal':
      case 'guideMeditate':
      case 'guidePlay': {
        const guide = await import('./guide-tarot.mjs');
        const actor = message.actorId
          ? game.actors.get(message.actorId)
          : (message.actorUuid ? await fromUuid(message.actorUuid) : null);
        if (!(actor instanceof Actor)) return;
        if (message.type === 'guideProvision') await guide.ensureGuideCards(actor);
        else if (message.type === 'guideDeal') await guide.dealGuideReading(actor);
        else if (message.type === 'guideMeditate') await guide.meditateGuideReading(actor);
        else await guide.playGuideCard(actor, message.cardId);
        break;
      }
      default:
        console.warn(`Cyberpunk Blue | Unknown socket message type: ${message.type}`);
    }
  });
}

/**
 * Emit a socket message to the GM.
 * Resolves immediately (fire-and-forget, no acknowledgement).
 */
export function emitToGM(type, data = {}) {
  game.socket.emit(SOCKET_NAME, { type, ...data });
}

/**
 * Apply damage to an actor, delegating to the GM if the current user lacks permission.
 *
 * @param {Actor} targetActor
 * @param {number} finalDamage
 */
export async function applyDamageWithPermission(targetActor, finalDamage) {
  if (targetActor.isOwner || game.user.isGM) {
    await targetActor.applyDamage(finalDamage);
  } else {
    emitToGM('applyDamage', { targetUuid: targetActor.uuid, finalDamage });
  }
}

/**
 * Roll a critical injury on an actor, delegating to the GM if needed.
 * @param {Actor}  targetActor
 * @param {string} tableType   'body' | 'head'
 * @param {object} opts
 * @param {Actor}  [opts.attackerActor]
 * @param {object} [opts.weaponFlags]  { critSlicing, critBlunt, critCrushing }
 */
export async function rollCriticalInjuryWithPermission(targetActor, tableType, { attackerActor = null, weaponFlags = {} } = {}) {
  const { rollCriticalInjury } = await import('./critical-injury.mjs');
  if (targetActor.isOwner || game.user.isGM) {
    await rollCriticalInjury(targetActor, tableType, { attackerActor, weaponFlags });
  } else {
    emitToGM('rollCriticalInjury', {
      targetUuid: targetActor.uuid,
      tableType,
      attackerUuid: attackerActor?.uuid ?? null,
      weaponFlags,
    });
  }
}

/**
 * Apply damage to a vehicle subsystem's own HP/SP pool, delegating to the GM if
 * needed.  Destruction (HP→0) is handled by the activeGM's updateItem hook.
 *
 * @param {Actor}  vehicleActor
 * @param {string} subsystemItemId
 * @param {number} rawDamage         pre-SP damage total
 */
export async function applyDamageToSubsystemWithPermission(vehicleActor, subsystemItemId, rawDamage) {
  const sub = vehicleActor.items?.get(subsystemItemId);
  if (sub?.type !== 'vehicleSubsystem') return;
  if (vehicleActor.isOwner || game.user.isGM) {
    const { applyDamageToSubsystem } = await import('./vehicle-damage.mjs');
    await applyDamageToSubsystem(sub, rawDamage);
  } else {
    emitToGM('applyDamageToSubsystem', {
      vehicleUuid: vehicleActor.uuid,
      subsystemItemId,
      rawDamage,
    });
  }
}

/**
 * Roll on a vehicle's critical damage table, delegating to the GM if needed.
 *
 * @param {Actor}              vehicleActor
 * @param {TokenDocument|null} vehicleToken
 * @param {string|null}        [vitalRegionId=null]  regionId of the targeted vital area
 */
export async function rollVehicleCriticalWithPermission(vehicleActor, vehicleToken, vitalRegionId = null) {
  const { rollVehicleCritical } = await import('./vehicle-damage.mjs');
  if (vehicleActor.isOwner || game.user.isGM) {
    await rollVehicleCritical(vehicleActor, vehicleToken?.document ?? vehicleToken ?? null, vitalRegionId);
  } else {
    emitToGM('rollVehicleCritical', { targetUuid: vehicleActor.uuid, vitalRegionId });
  }
}

/**
 * Toggle a status effect on an actor, delegating to the GM if needed.
 */
export async function toggleStatusEffectWithPermission(actor, statusId, active) {
  if (actor.isOwner || game.user.isGM) {
    await actor.toggleStatusEffect(statusId, { active });
  } else {
    emitToGM('toggleStatusEffect', { actorUuid: actor.uuid, statusId, active });
  }
}

/**
 * Update an actor, delegating to the GM if needed.
 */
export async function updateActorWithPermission(actor, updateData) {
  if (actor.isOwner || game.user.isGM) {
    await actor.update(updateData);
  } else {
    emitToGM('updateActor', { actorUuid: actor.uuid, updateData });
  }
}

/**
 * Unset a flag on an actor, delegating to the GM if needed.
 */
export async function unsetFlagWithPermission(actor, scope, key) {
  if (actor.isOwner || game.user.isGM) {
    await actor.unsetFlag(scope, key);
  } else {
    emitToGM('unsetFlag', { actorUuid: actor.uuid, scope, key });
  }
}

/**
 * Create an ActiveEffect on an actor, delegating to the GM if needed.
 *
 * @param {Actor}  actor
 * @param {object} aeData  Plain object (serialisable) passed to createEmbeddedDocuments.
 */
export async function createActiveEffectWithPermission(actor, aeData) {
  if (actor.isOwner || game.user.isGM) {
    await actor.createEmbeddedDocuments('ActiveEffect', [aeData]);
  } else {
    emitToGM('createActiveEffect', { actorUuid: actor.uuid, aeData });
  }
}

/**
 * Delete an embedded Item from an actor, delegating to the GM if needed.
 * Used for silencer destruction (destroyedByTech / destroyedByRof2).
 */
export async function deleteActorItemWithPermission(actor, itemId) {
  if (actor.isOwner || game.user.isGM) {
    await actor.deleteEmbeddedDocuments('Item', [itemId]);
  } else {
    emitToGM('deleteActorItem', { actorUuid: actor.uuid, itemId });
  }
}

/**
 * Armor Piercing: ablate 1 extra SP from the target's active armor,
 * delegating to the GM if the current user lacks permission.
 */
export async function ablateArmorExtraWithPermission(targetActor) {
  if (targetActor.isOwner || game.user.isGM) {
    const armor = targetActor.getActiveArmorItem?.();
    if (!armor) return;
    const currentSp = Math.max(Math.min(armor.system.armor?.currentSp ?? 0, armor.system.armor?.maxSp ?? 0), 0);
    if (currentSp > 0) await armor.update({ 'system.armor.currentSp': currentSp - 1 });
  } else {
    emitToGM('ablateArmorExtra', { actorUuid: targetActor.uuid });
  }
}

// ─── Guide Role card operations ───────────────────────────────────────────────
// The player owns only their Hand (Observer on Deck/Pile), so every card move —
// provisioning, dealing, meditating, and playing — runs on the GM.

export async function ensureGuideCardsWithPermission(actor) {
  if (game.user.isGM) {
    const { ensureGuideCards } = await import('./guide-tarot.mjs');
    await ensureGuideCards(actor);
  } else {
    emitToGM('guideProvision', { actorId: actor.id });
  }
}

export async function dealGuideReadingWithPermission(actor) {
  if (game.user.isGM) {
    const { dealGuideReading } = await import('./guide-tarot.mjs');
    await dealGuideReading(actor);
  } else {
    emitToGM('guideDeal', { actorId: actor.id });
  }
}

export async function meditateGuideReadingWithPermission(actor) {
  if (game.user.isGM) {
    const { meditateGuideReading } = await import('./guide-tarot.mjs');
    await meditateGuideReading(actor);
  } else {
    emitToGM('guideMeditate', { actorId: actor.id });
  }
}

/**
 * Apply a forced critical injury on an actor, delegating to the GM if needed.
 */
export async function applyForcedCriticalInjuryWithPermission(targetActor, injuryKey, attackerActor) {
  if (targetActor.isOwner || game.user.isGM) {
    const { applyForcedCriticalInjuryGM } = await import('./socket-injury.mjs');
    await applyForcedCriticalInjuryGM(targetActor, injuryKey, attackerActor);
  } else {
    emitToGM('applyForcedCriticalInjury', {
      targetUuid: targetActor.uuid,
      injuryKey,
      attackerUuid: attackerActor?.uuid ?? null,
    });
  }
}
