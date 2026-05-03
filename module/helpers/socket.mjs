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
 * Register the socket listener on the GM side.
 * Call this once from the 'ready' hook.
 */
export function registerSocketHandlers() {
  game.socket.on(SOCKET_NAME, async (message) => {
    if (!game.user.isGM) return;

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
