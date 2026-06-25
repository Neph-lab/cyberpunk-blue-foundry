/**
 * Netrunning system — connection, program lifecycle, and quickhacking.
 *
 * Flag layout on Actor:
 *   flags['cyberpunk-blue'].netConnection = {
 *     apSceneId:   string,  // Scene ID containing the Access Point region
 *     apRegionId:  string,  // Region ID of the Access Point
 *     archSceneId: string,  // Architecture scene ID (where the runner is jacked in)
 *     archTokenId: string,  // Token ID in the architecture scene
 *     cyberdeckId: string,  // Item ID of the Cyberdeck used
 *   } | null
 *
 * Flag layout on programExecutable items:
 *   flags['cyberpunk-blue'].programActorId = string | null
 *
 * RAM tracking per cyberdeck on Actor:
 *   flags['cyberpunk-blue'][`netRam.${cyberdeckId}`] = number
 */

import { playSfx } from './audio.mjs';

const NET_CONNECTION_FLAG  = 'netConnection';
const JACKED_IN_AE_FLAG    = 'jackedInEffect';

// Default sight range (in scene distance units) given to a jacked-in netrunner's
// architecture token when their prototype token has no vision enabled. Keeps
// fog-of-war exploration: the runner reveals the architecture as they move.
const NET_ARCH_SIGHT_RANGE = 10;
export const PROGRAM_ACTOR_FLAG  = 'programActorId';

function _actorOwnerUserId(actor) {
  return game.users.find(
    (u) => !u.isGM && actor.getUserLevel(u) === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
  )?.id ?? null;
}

// ── Accessors ──────────────────────────────────────────────────────────────────

/** Return the actor's current net connection data, or null if not connected. */
export function getNetConnection(actor) {
  return actor.getFlag('cyberpunk-blue', NET_CONNECTION_FLAG) ?? null;
}

/**
 * Return true if the given Scene is an active Architecture scene — i.e. at
 * least one Netrunner is currently jacked into it.
 */
export function isNetArchitectureScene(scene) {
  if (!scene) return false;
  const sid = scene.id ?? scene;
  return game.actors.some((a) => getNetConnection(a)?.archSceneId === sid);
}

/** Return true if the actor is currently connected to an architecture. */
export function isNetConnected(actor) {
  return Boolean(getNetConnection(actor));
}

/**
 * Return all installed/equipped cyberdeck items on an actor.
 * gear: must be equipped; cyberware: must be installed (not false).
 */
export function getCyberdecks(actor) {
  return actor.items.filter((item) => {
    if (!item.system.isComputer) return false;
    if (!item.system.computer?.isCyberdeck) return false;
    if (item.type === 'gear') return item.system.equipped;
    if (item.type === 'cyberware') return item.system.installed !== false;
    return false;
  });
}

/** Return the primary (first equipped/installed) cyberdeck, or null. */
export function getPrimaryCyberdeck(actor) {
  return getCyberdecks(actor)[0] ?? null;
}

// ── AP region detection ────────────────────────────────────────────────────────

/**
 * Find all Access Point regions in `scene` within `rangeMeters` of `point`.
 * Only considers regions that have an `accessPoint` behavior.
 *
 * @param {Scene}                  scene       - Foundry Scene document
 * @param {{x: number, y: number}} point       - Canvas pixel coordinates
 * @param {number}                 rangeMeters - Maximum distance in meters
 * @returns {RegionDocument[]}
 */
export function getAccessPointsInRange(scene, point, rangeMeters) {
  if (!scene || !point) return [];
  const gridSize = scene.grid?.size   ?? 100;
  const gridDist = scene.grid?.distance ?? 1;
  const mpp      = gridDist / gridSize; // meters per pixel
  const rangePx  = rangeMeters / mpp;

  const results = [];
  for (const region of (scene.regions ?? [])) {
    if (!_getApBehavior(region)) continue;
    const centre = _regionCentre(region);
    if (!centre) continue;
    if (Math.hypot(centre.x - point.x, centre.y - point.y) <= rangePx) {
      results.push(region);
    }
  }
  return results;
}

/** Extract the `accessPoint` behavior from a region, or null. */
export function _getApBehavior(region) {
  for (const b of (region.behaviors ?? [])) {
    if (b.type === 'accessPoint') return b;
  }
  return null;
}

/** Compute the pixel-space centre of a region from its shape list. */
export function _regionCentre(region) {
  const shapes = region.shapes;
  if (!shapes?.length) return null;
  let tx = 0, ty = 0, n = 0;
  for (const s of shapes) {
    switch (s.type) {
      case 'rectangle':
        tx += (s.x ?? 0) + (s.width  ?? 0) / 2;
        ty += (s.y ?? 0) + (s.height ?? 0) / 2;
        n++;
        break;
      case 'circle':
      case 'ellipse':
        tx += s.x ?? 0;
        ty += s.y ?? 0;
        n++;
        break;
      case 'polygon': {
        const pts = s.points ?? [];
        if (pts.length < 2) break;
        let px = 0, py = 0;
        for (let i = 0; i < pts.length; i += 2) { px += pts[i]; py += pts[i + 1]; }
        tx += px / (pts.length / 2);
        ty += py / (pts.length / 2);
        n++;
        break;
      }
    }
  }
  return n ? { x: tx / n, y: ty / n } : null;
}

// ── RAM tracking ───────────────────────────────────────────────────────────────

const _ramKey = (id) => `netRam.${id}`;

/** Get current RAM for a cyberdeck. Falls back to max if flag is unset. */
export function getCyberdeckRam(actor, cyberdeckId) {
  const stored = actor.getFlag('cyberpunk-blue', _ramKey(cyberdeckId));
  if (stored !== undefined && stored !== null) return Number(stored);
  const deck = actor.items.get(cyberdeckId);
  return Number(deck?.system?.computer?.ram) || 0;
}

/** Set current RAM for a cyberdeck (clamped to [0, max]). */
export async function setCyberdeckRam(actor, cyberdeckId, value) {
  const deck   = actor.items.get(cyberdeckId);
  const maxRam = Number(deck?.system?.computer?.ram) || 0;
  await actor.setFlag('cyberpunk-blue', _ramKey(cyberdeckId), Math.max(0, Math.min(value, maxRam)));
}

/**
 * Defrag — reset all cyberdeck RAM to max.
 * Does NOT consume a NET action by itself; the caller is responsible.
 */
export async function defrag(actor) {
  const decks = getCyberdecks(actor);
  if (!decks.length) { ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NoCyberdeck')); return; }
  for (const deck of decks) {
    const max = Number(deck.system.computer?.ram) || 0;
    await actor.setFlag('cyberpunk-blue', _ramKey(deck.id), max);
  }
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><p>${game.i18n.format('CYBER_BLUE.Netrunning.DefragDone', { name: actor.name })}</p></div>`,
  });
}

// ── Connect / Disconnect ───────────────────────────────────────────────────────

/**
 * Connect the actor to an architecture via the given Access Point region.
 *
 * When called from a non-GM client the work is delegated to the active GM via
 * the system socket (token creation requires GM permission). The GM then emits
 * a netSwitchScene message back so the player's view updates.
 *
 * @param {Actor}          actor           - The Netrunner character
 * @param {RegionDocument} apRegion        - The Access Point region in the current scene
 * @param {object}         [opts]
 * @param {string}         [opts.forUserId] - When called by the GM on behalf of a player,
 *                                            the ID of the user whose scene should be switched.
 */
export async function connectToArchitecture(actor, apRegion, { forUserId } = {}) {
  // Non-GM clients cannot create tokens in remote scenes. Delegate to the GM,
  // who will run the full logic and then tell this user to switch scene.
  if (!game.user.isGM) {
    const { emitToGM } = await import('./socket.mjs');
    emitToGM('netConnect', {
      actorUuid:  actor.uuid,
      apSceneId:  canvas.scene?.id ?? '',
      apRegionId: apRegion.id,
      userId:     game.user.id,
    });
    return;
  }

  if (isNetConnected(actor)) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.AlreadyConnected'));
    return;
  }

  const apBehavior = _getApBehavior(apRegion);
  if (!apBehavior) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NoAccessPointBehavior'));
    return;
  }

  const archSceneUuid = apBehavior.system?.architectureSceneUuid;
  if (!archSceneUuid) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NoBehaviorScene'));
    return;
  }

  // Load the architecture scene
  const archScene = await fromUuid(archSceneUuid);
  if (!(archScene instanceof Scene)) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.SceneNotFound'));
    return;
  }

  // The user whose view should move into the architecture. Prefer an explicit
  // delegating player (set when a player jacks in via the socket), then the
  // netrunner's own player-owner (so a GM clicking Jack In on a player's sheet
  // switches the PLAYER's view, not the GM's), and finally the acting user.
  const connectingUserId = forUserId ?? _actorOwnerUserId(actor) ?? game.user.id;
  // Permission to view the architecture scene is granted further below, AFTER
  // the runner's token has been created, so that the scene snapshot first sent
  // to the player already contains their token (see comment at the grant site).

  // Add it to the scene navigation if not already there
  if (!archScene.navigation) {
    const maxOrder = Math.max(0, ...game.scenes.filter((s) => s.navigation).map((s) => s.navOrder ?? 0));
    await archScene.update({ navigation: true, navOrder: maxOrder + 1 });
  }

  // Determine spawn position from the ACC_node region.
  // First try the UUID explicitly stored on the behavior; if that isn't set or
  // can't be resolved, fall back to the first accNode region in the arch scene.
  const accNodeUuid = apBehavior.system?.accNodeRegionUuid;
  const gridSize    = archScene.grid?.size ?? 100;
  let spawnX = 0, spawnY = 0;

  let accNodeRegion = null;
  if (accNodeUuid) {
    try {
      const resolved = await fromUuid(accNodeUuid);
      // The UUID picker in Foundry sometimes selects the RegionBehavior document
      // rather than the Region itself.  Walk up to the parent Region if needed.
      if (resolved?.documentName === 'RegionBehavior') {
        accNodeRegion = resolved.parent ?? null;
      } else if (resolved?.documentName === 'Region') {
        accNodeRegion = resolved;
      }
    } catch { /* bad UUID */ }
  }
  if (!accNodeRegion) {
    // Auto-discover: use the first region in the arch scene that has an accNode behavior.
    accNodeRegion = archScene.regions?.find?.((r) =>
      r.behaviors?.some?.((b) => b.type === 'accNode'),
    ) ?? null;
  }
  if (accNodeRegion) {
    const centre = _regionCentre(accNodeRegion);
    if (centre) {
      // Snap to grid; place token's top-left corner on the nearest grid cell.
      spawnX = Math.floor((centre.x - gridSize / 2) / gridSize) * gridSize;
      spawnY = Math.floor((centre.y - gridSize / 2) / gridSize) * gridSize;
    }
  }

  // Build token data explicitly from the prototype token rather than using
  // toObject() wholesale — V14's stricter validation can reject stale embedded
  // sub-document fields returned by toObject(), causing silent creation failure.
  const proto = actor.prototypeToken;
  const tokenData = {
    actorId:     actor.id,
    actorLink:   true,
    name:        proto.name || actor.name,
    x:           spawnX,
    y:           spawnY,
    width:       proto.width  ?? 1,
    height:      proto.height ?? 1,
    disposition: proto.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    texture:     { src: proto.texture?.src ?? actor.img ?? '' },
    // Match the character's own rotation behaviour. Architecture scenes are
    // gridless, where tokens rotate to face movement by default; inherit the
    // prototype's lock so a portrait token stays upright if it does normally.
    lockRotation: proto.lockRotation ?? false,
    displayName: proto.displayName ?? CONST.TOKEN_DISPLAY_MODES.OWNER,
    displayBars: proto.displayBars ?? CONST.TOKEN_DISPLAY_MODES.OWNER,
    bar1:        { attribute: proto.bar1?.attribute ?? 'resources.hp' },
    bar2:        { attribute: proto.bar2?.attribute ?? '' },
    // Architecture scenes use token vision + fog of war. A character's
    // prototype token vision is tuned for physical maps (here, range 1), which
    // would leave the jacked-in runner blind under the architecture fog. Always
    // enable sight and guarantee at least the architecture exploration range,
    // while honouring a deliberately larger prototype range. This keeps
    // fog-of-war exploration: the runner reveals the architecture as they move.
    sight: { enabled: true, range: Math.max(Number(proto.sight?.range) || 0, NET_ARCH_SIGHT_RANGE) },
  };

  let tokenDoc;
  try {
    ([tokenDoc] = await archScene.createEmbeddedDocuments('Token', [tokenData]));
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to create netrunner architecture token:', err, tokenData);
    ui.notifications.error(game.i18n.localize('CYBER_BLUE.Netrunning.TokenCreateFailed'));
    return;
  }
  if (!tokenDoc) {
    console.error('Cyberpunk Blue | createEmbeddedDocuments returned no token. Data was:', tokenData);
    ui.notifications.error(game.i18n.localize('CYBER_BLUE.Netrunning.TokenCreateFailed'));
    return;
  }

  // Grant the connecting user permission to view the architecture scene. Foundry
  // never syncs a Scene to a client that has NONE permission on it (unless it is
  // the active scene), so without this the scene never reaches the player's
  // client and the scene-switch below silently no-ops. Doing this AFTER the
  // token is created means the first scene snapshot Foundry pushes to the player
  // already contains their token. Track whether we elevated access so disconnect
  // can revert it.
  let archViewGranted = false;
  const connectingUser = game.users.get(connectingUserId);
  if (connectingUser && !connectingUser.isGM
    && archScene.getUserLevel(connectingUser) < CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) {
    await archScene.update({ [`ownership.${connectingUserId}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER });
    archViewGranted = true;
  }

  const deck = getPrimaryCyberdeck(actor);
  await actor.setFlag('cyberpunk-blue', NET_CONNECTION_FLAG, {
    apSceneId:    apRegion.parent?.id ?? canvas.scene?.id ?? '',
    apRegionId:   apRegion.id,
    archSceneId:  archScene.id,
    archTokenId:  tokenDoc.id,
    cyberdeckId:  deck?.id ?? '',
    // Remember who we gave architecture-scene view access to, so the matching
    // disconnect can revoke exactly that grant (and nobody else's).
    archViewGrantedUserId: archViewGranted ? connectingUserId : null,
  });

  // Create a "Jacked In" Active Effect so all tokens across scenes show the
  // connected status, and the actor sheet reliably rerenders on connect/disconnect.
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name:     game.i18n.localize('CYBER_BLUE.Netrunning.Connected'),
    img:      'systems/cyberpunk-blue/assets/icons/bk_Netrunning.svg',
    disabled: false,
    transfer: false,
    statuses: ['jackedIn'],
    flags:    { 'cyberpunk-blue': { [JACKED_IN_AE_FLAG]: true } },
  }]);

  // Switch the netrunner's active scene to the architecture.
  // If the GM is acting on behalf of a player, emit a socket message so that
  // the player's client (not the GM's) performs the scene switch.
  if (connectingUserId === game.user.id) {
    await archScene.view();
  } else {
    const { emitSceneSwitchForUser } = await import('./socket.mjs');
    emitSceneSwitchForUser(archScene.id, connectingUserId);
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-plug"></i> ${game.i18n.format('CYBER_BLUE.Netrunning.ConnectedMsg', { name: actor.name, scene: archScene.name })}</p></div>`,
  });
}

/**
 * Disconnect the actor from the current architecture.
 *
 * Token deletion and program-actor cleanup require GM permission. Non-GM
 * clients delegate to the active GM via the system socket; the GM then
 * emits a netSwitchScene message so the right user's view updates.
 *
 * For forced disconnects triggered by GM-side hooks (token out-of-range,
 * HP=0), the actor's player-owner is automatically identified so their
 * scene is switched, not the GM's.
 *
 * @param {Actor}   actor           - The Netrunner
 * @param {boolean} safe            - true for a graceful disconnect; false triggers trauma
 * @param {object}  [opts]
 * @param {string}  [opts.forUserId] - Explicit user whose scene should switch;
 *                                     defaults to the actor's non-GM owner, or the calling user.
 */
export async function disconnectFromArchitecture(actor, safe = true, { forUserId } = {}) {
  // Non-GM clients cannot delete tokens in remote scenes. Delegate to the GM.
  if (!game.user.isGM) {
    const { emitToGM } = await import('./socket.mjs');
    emitToGM('netDisconnect', { actorUuid: actor.uuid, safe, userId: game.user.id });
    return;
  }

  // Guard against multi-GM double-execution.
  if (game.user !== game.users.activeGM) return;

  const conn = getNetConnection(actor);
  if (!conn) return;

  // Node lock (N3 — Superglue, Kraken): a locked Netrunner cannot disconnect
  // safely. (KRASH-Barrier below may still convert the unsafe disconnect.)
  if (safe && actor.effects.some((e) => e.getFlag('cyberpunk-blue', 'nodeLocked'))) {
    safe = false;
  }

  const archScene = game.scenes.get(conn.archSceneId);

  // Stop all running executables (despawn their program tokens).
  // skipBackupDrive: voluntary disconnect is not a destruction — no Backup Drive save.
  const runningExes = actor.items.filter((i) => i.type === 'programExecutable' && i.system.running);
  for (const exe of runningExes) {
    await _despawnProgramActor(actor, exe, { skipRunningUpdate: true, skipBackupDrive: true });
    await exe.update({ 'system.running': false });
  }

  // Remove the netrunner's token from the architecture scene
  if (archScene && conn.archTokenId) {
    const tok = archScene.tokens.get(conn.archTokenId);
    if (tok) await tok.delete();
  }

  // Switch the netrunner's view back to the AP scene.
  // For forced GM-side disconnects (out-of-range, HP=0) identify the player
  // who owns the actor so their scene switches, not the GM's.
  const apScene = game.scenes.get(conn.apSceneId);
  const disconnectingUserId = forUserId ?? _actorOwnerUserId(actor) ?? game.user.id;
  if (disconnectingUserId === game.user.id) {
    if (apScene) await apScene.view();
  } else {
    const { emitSceneSwitchForUser } = await import('./socket.mjs');
    if (apScene) emitSceneSwitchForUser(apScene.id, disconnectingUserId);
  }

  // Revoke the temporary architecture-scene view access granted on connect, so
  // the player can no longer browse the (GM-secret) architecture once jacked
  // out. Only revoke the exact user we elevated. Done after the scene-switch
  // emit above so the player has already been moved back to the AP scene.
  if (conn.archViewGrantedUserId && archScene) {
    const grantedUser = game.users.get(conn.archViewGrantedUserId);
    if (grantedUser && !grantedUser.isGM) {
      await archScene.update({ [`ownership.${conn.archViewGrantedUserId}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE });
    }
  }

  // Clear connection flag and remove "Jacked In" AE
  await actor.unsetFlag('cyberpunk-blue', NET_CONNECTION_FLAG);
  const jackedInAe = actor.effects.find((e) => e.getFlag('cyberpunk-blue', JACKED_IN_AE_FLAG));
  if (jackedInAe) await jackedInAe.delete();

  // Clear NET-combat rider AEs that end on disconnect (NET-action penalty
  // 'untilDisconnect', node lock).
  const onDisconnect = actor.effects.filter((e) => e.getFlag('cyberpunk-blue', 'clearOnDisconnect'));
  for (const ae of onDisconnect) await ae.delete();

  // KRASH-Barrier hardware mod: converts unsafe disconnects to safe ones.
  // Pass cyberdeckId explicitly — connection flag is already cleared above.
  if (!safe && _hasKrashBarrier(actor, conn.cyberdeckId)) {
    safe = true;
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-shield-halved"></i> ${game.i18n.format('CYBER_BLUE.Netrunning.KrashBarrierMsg', { name: actor.name })}</p></div>`,
    });
  }

  if (!safe) {
    // Unsafe disconnect: 1d6 direct HP damage
    const roll = await new Roll('1d6').evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-triangle-exclamation"></i> ${game.i18n.localize('CYBER_BLUE.Netrunning.UnsafeDisconnect')}</h3><p>${game.i18n.format('CYBER_BLUE.Netrunning.UnsafeDisconnectDmg', { name: actor.name, dmg: roll.total })}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    const currentHp = actor.system.resources?.hp?.value ?? 0;
    await actor.update({ 'system.resources.hp.value': Math.max(currentHp - roll.total, -99) });
  } else {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-plug-circle-minus"></i> ${game.i18n.format('CYBER_BLUE.Netrunning.DisconnectedMsg', { name: actor.name })}</p></div>`,
    });
  }
}

/**
 * Permanently destroy a Program-actor target. Prefers deleting its linked
 * executable item (so the `deleteItem` hook despawns the actor + tokens AND the
 * Backup Drive save in despawnProgramActor can preserve a non-Black-ICE program); falls back
 * to removing tokens + the actor directly when there is no parent exe.
 * @param {Actor} programActor
 */
async function destroyProgramTarget(programActor) {
  if (!programActor) return;
  const exe = await getLinkedExecutable(programActor);
  if (exe?.id && exe?.parent) {
    await maliciouslyDeleteProgram(exe);
    return;
  }
  for (const scene of game.scenes) {
    const tIds = scene.tokens.filter((t) => t.actorId === programActor.id).map((t) => t.id);
    if (tIds.length) await scene.deleteEmbeddedDocuments('Token', tIds);
  }
  await programActor.delete();
}

/**
 * Maliciously delete a program executable (from an attack — N4 / N5). Honors the
 * two defensive saves before deleting:
 *   • Restore (N10): a running Restore on the owner rolls 1d10 (spending all its
 *     REZ); on ≥ its DV the target is closed (running:false) instead of deleted.
 *   • Backup Drive: a non-Black-ICE program is preserved rather than deleted
 *     (closing a running one routes through the despawn-path save + message).
 * @param {Item} exe - the program executable being deleted
 */
export async function maliciouslyDeleteProgram(exe) {
  if (!exe?.id) return;
  const owner = exe.parent;

  if (owner) {
    // Restore (N10).
    const restore = owner.items.find((i) => i.type === 'programExecutable'
      && i.system.running && i.system.netCombat?.defense?.restore?.enabled);
    if (restore) {
      const dv = Number(restore.system.netCombat.defense.restore.dv) || 7;
      const roll = await new Roll('1d10').evaluate();
      await restore.update({ 'system.rez.value': 0 });
      const saved = roll.total >= dv;
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: owner }),
        flavor: `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-shield-halved"></i> ${restore.name}</h3>
          <p>${game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.RestoreRoll', { name: exe.name, dv, result: saved ? game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.RestoreSaved') : game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.RestoreFailed') })}</p></div>`,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      if (saved) {
        if (exe.system.running) await exe.update({ 'system.running': false });
        return;
      }
    }

    // Backup Drive: non-Black-ICE programs are preserved (not deleted).
    if (exe.system.category !== 'black-ice' && _hasBackupDrive(owner)) {
      if (exe.system.running) {
        // The despawn-path Backup-Drive branch posts the save message + keeps it.
        await exe.update({ 'system.running': false });
      } else {
        await ChatMessage.create({
          content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-hard-drive"></i>
            <strong>Backup Drive</strong>: ${game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.BackupDriveSaved', { name: exe.name })}</p></div>`,
        });
      }
      return;
    }
  }

  // No save applies — permanent deletion (the deleteItem hook despawns the actor).
  await exe.delete();
}

// ── Program actor lifecycle ────────────────────────────────────────────────────

/**
 * Spawn a temporary Program actor + token for a running executable.
 * Called when `system.running` is set to true while the actor is connected.
 *
 * @param {Actor} actor   - The Netrunner
 * @param {Item}  exeItem - The programExecutable item now set to Running
 */
export async function spawnProgramActor(actor, exeItem) {
  const conn = getNetConnection(actor);
  if (!conn) return;

  const archScene = game.scenes.get(conn.archSceneId);
  if (!archScene) return;

  // Skip if already linked to a live actor
  const existingId = exeItem.getFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
  if (existingId && game.actors.get(existingId)) return;

  const sys = exeItem.system;

  // Build limited ownership: owners of the actor get Limited on the program
  const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
  for (const [userId, level] of Object.entries(actor.ownership ?? {})) {
    if (level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
      ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;
    }
  }

  const [programActor] = await Actor.createDocuments([{
    name:  exeItem.name,
    type:  'program',
    img:   exeItem.img,
    prototypeToken: {
      name:        exeItem.name,
      texture:     { src: exeItem.img },
      width:       0.5,
      height:      0.5,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    },
    system: {
      stats: {
        act: { value: sys.act ?? 0 },
        atk: { value: sys.atk ?? 0 },
        def: { value: sys.def ?? 0 },
        net: { value: sys.net ?? 0 },
        per: { value: sys.per ?? 0 },
      },
      resources: { rez: { value: sys.rez?.value ?? 0, max: sys.rez?.max ?? 0 } },
      programType:  sys.programType ?? 'antipersonnel',
      // Referenced-mode link to the running exe on the netrunner's cyberdeck.
      // The general two-way sync (updateActor/updateItem hooks) keeps the spawned
      // actor and the source exe in lockstep from here on.
      executableUuid: exeItem.uuid,
      description:  sys.description ?? '',
      notes:        sys.notes ?? '',
      // Copy the exe's NET Combat config so the spawned actor can attack/defend
      // immediately (the two-way sync keeps it current afterwards).
      netCombat:    foundry.utils.deepClone(sys.netCombat ?? {}),
    },
    // Copy the exe's Active Effects (preserving _id) so affliction templates
    // referenced by netCombat.attack.affliction.effectId resolve on this actor.
    effects: exeItem.effects.map((e) => e.toObject()),
    ownership,
    flags: {
      'cyberpunk-blue': {
        isTemporaryProgramActor:    true,
        programActorFor:            actor.id,
        programExecutableId:        exeItem.id,
      },
    },
  }], { renderSheet: false });

  if (!programActor) return;

  // Determine token position next to the netrunner's architecture token
  const netTok  = archScene.tokens.get(conn.archTokenId);
  const gridSize = archScene.grid?.size ?? 100;
  const runningCount = actor.items.filter((i) =>
    i.type === 'programExecutable' && i.system.running && i.id !== exeItem.id
  ).length;
  const offsetX = (1 + runningCount) * Math.ceil(gridSize * 0.5);

  // Use the program actor's own image for the token (Task 4: always own image)
  await archScene.createEmbeddedDocuments('Token', [{
    actorId:    programActor.id,
    actorLink:  true,
    name:       programActor.name,
    texture:    { src: programActor.img },
    x:          (netTok?.x ?? 0) + offsetX,
    y:          netTok?.y  ?? 0,
    width:      0.5,
    height:     0.5,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
  }]);

  await exeItem.setFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG, programActor.id);

  // Apply this program's passive aura (N8 — Skunk, Flack) while it runs.
  await applyProgramAura(actor, exeItem);
}

/**
 * Apply a program's passive aura (N8): copy its `aura.effectId` template AE onto
 * the resolved target set. Records the applied AE ids on the exe so the matching
 * despawn can remove them. Targets: 'self' = the running Netrunner; otherwise a
 * best-effort set of other actors connected to the same architecture (no
 * detection model exists — the GM prunes; see plan Part E).
 */
async function applyProgramAura(actor, exeItem) {
  const aura = exeItem.system.netCombat?.aura;
  if (!aura?.enabled || !aura.effectId) return;
  const tpl = exeItem.effects.get(aura.effectId);
  if (!tpl) return;

  let targets = [];
  if (aura.target === 'self') {
    targets = [actor];
  } else {
    const archSceneId = getNetConnection(actor)?.archSceneId;
    for (const a of game.actors) {
      if (a.id === actor.id) continue;
      const c = a.getFlag('cyberpunk-blue', NET_CONNECTION_FLAG);
      if (c?.archSceneId && c.archSceneId === archSceneId) targets.push(a);
    }
  }
  if (!targets.length) return;

  const effectData = tpl.toObject();
  delete effectData._id;
  effectData.disabled = false;
  effectData.transfer = false;
  effectData.flags = effectData.flags ?? {};
  effectData.flags['cyberpunk-blue'] = { ...(effectData.flags['cyberpunk-blue'] ?? {}), programAuraSource: exeItem.id };

  const applied = [];
  for (const t of targets) {
    const [ae] = await t.createEmbeddedDocuments('ActiveEffect', [effectData]);
    if (ae) applied.push({ actorId: t.id, effectId: ae.id });
  }
  await exeItem.setFlag('cyberpunk-blue', 'auraApplied', applied);
}

/** Remove any aura AEs this program applied (N8), reversing applyProgramAura. */
async function removeProgramAura(exeItem) {
  const applied = exeItem.getFlag('cyberpunk-blue', 'auraApplied') ?? [];
  for (const { actorId, effectId } of applied) {
    const ae = game.actors.get(actorId)?.effects.get(effectId);
    if (ae) await ae.delete();
  }
  if (applied.length) await exeItem.unsetFlag('cyberpunk-blue', 'auraApplied');
}

/**
 * Despawn the Program actor + token linked to an executable.
 * Also resets current REZ to max (so the program is "fresh" on next run).
 *
 * @param {Actor} actor
 * @param {Item}  exeItem
 * @param {{skipRunningUpdate?: boolean, skipBackupDrive?: boolean}} [opts]
 */
export async function despawnProgramActor(actor, exeItem, opts = {}) {
  return _despawnProgramActor(actor, exeItem, opts);
}

/**
 * Return true if the cyberdeck identified by `cyberdeckId` (or the primary
 * cyberdeck when omitted) has a KRASH-Barrier hardware mod embedded in it.
 * KRASH-Barrier converts unsafe disconnects to safe ones.
 *
 * @param {Actor}       actor        - The Netrunner
 * @param {string|null} [cyberdeckId] - Specific cyberdeck item ID; falls back
 *                                      to the primary cyberdeck.
 */
function _hasKrashBarrier(actor, cyberdeckId = null) {
  const deckId = cyberdeckId ?? getNetConnection(actor)?.cyberdeckId;
  if (!deckId) return false;
  const deck = actor.items.get(deckId);
  if (!deck) return false;
  return (deck.system.embeddedMods ?? []).some((m) => m.name === 'KRASH-Barrier');
}

/**
 * Return true if the cyberdeck the actor is connected through (or its primary
 * cyberdeck when omitted) has a Backup Drive hardware mod embedded in it.
 * Backup Drive is a computerMod that saves non-Black-ICE programs from deletion.
 *
 * @param {Actor}       actor        - The Netrunner
 * @param {string|null} [cyberdeckId] - Specific cyberdeck item ID; falls back
 *                                      to the connected cyberdeck.
 */
function _hasBackupDrive(actor, cyberdeckId = null) {
  const deckId = cyberdeckId ?? getNetConnection(actor)?.cyberdeckId;
  if (!deckId) return false;
  const deck = actor.items.get(deckId);
  if (!deck) return false;
  return (deck.system.embeddedMods ?? []).some((m) => m.name === 'Backup Drive');
}

async function _despawnProgramActor(
  actor, exeItem, { skipRunningUpdate = false, skipBackupDrive = false } = {},
) {
  const programActorId = exeItem.getFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
  if (!programActorId) return;

  // Remove this program's passive aura (N8). (The once-per-source
  // forceDisconnect guard lives on the program actor, which is deleted below.)
  await removeProgramAura(exeItem);

  // ── Backup Drive: save non-Black ICE programs instead of deleting them ────
  // If the Netrunner has a Backup Drive installed and the program being
  // destroyed is not Black ICE, cancel the deletion and mark it as not running
  // (REZ still resets so it can be retrieved on the next connection).
  const isBlackIce = exeItem.system.category === 'black-ice';
  if (!skipBackupDrive && !isBlackIce && _hasBackupDrive(actor)) {
    await exeItem.unsetFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);

    const rezUpdate = skipRunningUpdate ? {} : { 'system.rez.value': exeItem.system.rez?.max ?? 0 };
    await exeItem.update({ 'system.running': false, ...rezUpdate });

    // Remove tokens without permanently deleting the program actor.
    // The actor remains in the world so the player can re-run it next session.
    for (const scene of game.scenes) {
      const tIds = scene.tokens
        .filter((t) => t.actorId === programActorId)
        .map((t) => t.id);
      if (tIds.length) await scene.deleteEmbeddedDocuments('Token', tIds);
    }

    await ChatMessage.create({
      content: `<div class="cyberpunk-blue chat-card">
        <p><i class="fas fa-hard-drive"></i>
        <strong>Backup Drive</strong>: ${exeItem.name} was saved to the backup drive instead of being deleted. It can be retrieved as a full Action on the next connection.</p>
      </div>`,
    });
    return;
  }

  await exeItem.unsetFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);

  const programActor = game.actors.get(programActorId);
  if (programActor) {
    // Remove all tokens for this actor across all scenes
    for (const scene of game.scenes) {
      const tIds = scene.tokens
        .filter((t) => t.actorId === programActorId)
        .map((t) => t.id);
      if (tIds.length) await scene.deleteEmbeddedDocuments('Token', tIds);
    }
    await programActor.delete({ renderSheet: false });
  }

  // Reset REZ to max so the executable is restored on next run
  if (!skipRunningUpdate) {
    const max = exeItem.system.rez?.max ?? 0;
    await exeItem.update({ 'system.rez.value': max });
  }
}

// ── Quickhacking ───────────────────────────────────────────────────────────────

/**
 * Check all quickhacking prerequisites for an actor against the current target.
 *
 * @param {Actor}       actor
 * @param {TokenDocument|null} [targetToken] - Override; defaults to first user target
 * @returns {{ ok: boolean, reason: string|null, targetActor: Actor|null, targetToken: Token|null }}
 */
export function checkQuickhackPrereqs(actor, targetToken = null) {
  const deck = getPrimaryCyberdeck(actor);
  if (!deck?.system.computer?.canQuickhack) {
    return { ok: false, reason: 'noCyberdeck', targetActor: null, targetToken: null };
  }

  const qhRank = actor.system.components?.quickhacking?.rank ?? 0;
  if (qhRank < 1) {
    return { ok: false, reason: 'noQuickhacking', targetActor: null, targetToken: null };
  }

  const quickhacks = actor.items.filter((i) =>
    i.type === 'programExecutable'
    && i.system.category === 'quickhack'
    && i.system.installedOnId === deck.id
  );
  if (!quickhacks.length) {
    return { ok: false, reason: 'noQuickhacks', targetActor: null, targetToken: null };
  }

  // Resolve target from canvas (safe — context prep guards with canvas?.ready)
  const resolvedToken = targetToken
    ?? [...(game.user?.targets ?? [])][0]
    ?? null;
  if (!resolvedToken?.actor) {
    return { ok: false, reason: 'noTarget', targetActor: null, targetToken: null };
  }

  const targetActor = resolvedToken.actor;
  const targetDoc   = resolvedToken.document ?? resolvedToken;

  // Range check
  const rangeMeters = Number(deck.system.computer?.range) || 0;
  if (rangeMeters > 0 && canvas?.ready) {
    const actorTok = canvas.tokens.placeables.find((t) => t.actor?.id === actor.id);
    if (actorTok) {
      const scene    = canvas.scene;
      const gridSize = scene?.grid?.size     ?? 100;
      const gridDist = scene?.grid?.distance ?? 1;
      const mpp      = gridDist / gridSize;
      const ax       = actorTok.document.x + actorTok.document.width  * gridSize / 2;
      const ay       = actorTok.document.y + actorTok.document.height * gridSize / 2;
      const tx       = targetDoc.x          + targetDoc.width          * gridSize / 2;
      const ty       = targetDoc.y          + targetDoc.height          * gridSize / 2;
      const dist     = Math.hypot(tx - ax, ty - ay) * mpp;
      if (dist > rangeMeters) {
        return { ok: false, reason: 'outOfRange', targetActor, targetToken: resolvedToken };
      }
    }
  }

  // Target must have an installed neuralware platform
  const hasNeuralPlatform = targetActor.items?.some((i) =>
    i.type === 'cyberware'
    && i.system.cyberwareType === 'neuralware'
    && i.system.integration   === 'platform'
    && i.system.installed     !== false
  );
  if (!hasNeuralPlatform) {
    return { ok: false, reason: 'noNeuralware', targetActor, targetToken: resolvedToken };
  }

  return { ok: true, reason: null, targetActor, targetToken: resolvedToken };
}

/**
 * Attempt to breach a target's ICE.
 * Rolls NET(Quickhacking) vs DV 18 + 2 per Self-ICE install.
 * On success, applies a "Breached" AE to the target (1 minute).
 *
 * @param {Actor} actor
 * @param {Actor} targetActor
 * @returns {Promise<boolean>} true if breach succeeded
 */
export async function performQuickhackBreach(actor, targetActor) {
  const sys            = actor.system;
  const networkerRole  = actor.items.find((i) => i.type === 'role' && i.system.category === 'networker' && (Number(i.system.rank) || 0) >= 1);
  const networkerRank  = Number(networkerRole?.system?.rank) || 0;
  const intVal         = Number(sys.stats?.int?.value)          || 0;
  const netrunningRank = Number(sys.skills?.netrunning?.rank)   || 0;
  const qhRank         = Number(sys.components?.quickhacking?.rank) || 0;
  const modifier       = intVal + networkerRank + Math.min(netrunningRank, qhRank);

  const selfIceCount = targetActor.items?.filter((i) =>
    i.type === 'cyberware'
    && i.system.installed !== false
    && i.name.toLowerCase().includes('self-ice')
  ).length ?? 0;
  const dv = 18 + 2 * selfIceCount;

  const formula = modifier >= 0 ? `1d10+${modifier}` : `1d10${modifier}`;
  const roll    = await new Roll(formula).evaluate();
  const success = roll.total >= dv;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Netrunning.Breach')}</h3><p>${game.i18n.format('CYBER_BLUE.Netrunning.BreachVsTarget', { target: targetActor.name, dv })}</p><p><strong>${success ? game.i18n.localize('CYBER_BLUE.Combat.Hit') : game.i18n.localize('CYBER_BLUE.Combat.Miss')}</strong></p></div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  if (!success) return false;

  // Apply / refresh Breached AE on target (1 minute)
  const existing = targetActor.effects.find((e) => e.getFlag('cyberpunk-blue', 'breachedBy') === actor.id);
  if (existing) {
    await existing.update({ duration: { seconds: 60 } }); // refresh timer
  } else {
    await targetActor.createEmbeddedDocuments('ActiveEffect', [{
      name:     game.i18n.format('CYBER_BLUE.Netrunning.BreachedAEName', { name: actor.name }),
      icon:     'icons/svg/regen.svg',
      origin:   actor.uuid,
      disabled: false,
      transfer: false,
      duration: { seconds: 60 },
      changes:  [],
      flags: { 'cyberpunk-blue': { breachedBy: actor.id } },
    }]);
  }

  return true;
}

/**
 * Upload a quickhack to a breached target.
 * Shows a picker if multiple quickhacks are eligible, then applies a pending AE.
 *
 * @param {Actor} actor
 * @param {Actor} targetActor
 */
export async function performQuickhackUpload(actor, targetActor) {
  const deck = getPrimaryCyberdeck(actor);
  if (!deck) return;

  const currentRam = getCyberdeckRam(actor, deck.id);

  const quickhacks = actor.items.filter((i) =>
    i.type === 'programExecutable'
    && i.system.category === 'quickhack'
    && i.system.installedOnId === deck.id
    && (i.system.ram ?? 0) <= currentRam
  );

  if (!quickhacks.length) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NoEligibleQuickhacks'));
    return;
  }

  let chosenExe = quickhacks[0];

  if (quickhacks.length > 1) {
    const { promise, resolve } = Promise.withResolvers();
    const buttons = quickhacks.map((exe) => ({
      action:   exe.id,
      label:    `${exe.name} (RAM: ${exe.system.ram ?? 0})`,
      callback: () => resolve(exe),
    }));
    buttons.push({
      action:   'cancel',
      label:    game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
      icon:     'fas fa-times',
      callback: () => resolve(null),
    });
    const dialog = new foundry.applications.api.DialogV2({
      window:  { title: game.i18n.localize('CYBER_BLUE.Netrunning.ChooseQuickhack') },
      content: `<div class="cyberpunk-blue"><p>${game.i18n.format('CYBER_BLUE.Netrunning.ChooseQuickhackHint', { target: targetActor.name, ram: currentRam })}</p></div>`,
      buttons,
      submit: (result) => resolve(result ?? null),
    });
    dialog.addEventListener('close', () => resolve(null), { once: true });
    dialog.render(true);
    const result = await promise;
    if (!result) return;
    chosenExe = result;
  }

  // Deduct RAM
  await setCyberdeckRam(actor, deck.id, currentRam - (chosenExe.system.ram ?? 0));

  // Apply a pending AE on the target (activates at the start of the hacker's next turn).
  // Store round + target so the combatTurn hook can fire completion.
  const qhDesc = (chosenExe.system.note ?? '') || (chosenExe.system.notes ?? '');
  await targetActor.createEmbeddedDocuments('ActiveEffect', [{
    name:     game.i18n.format('CYBER_BLUE.Netrunning.QuickhackUploading', { name: chosenExe.name }),
    icon:     chosenExe.img || 'icons/svg/degen.svg',
    origin:   actor.uuid,
    disabled: false,
    transfer: false,
    duration: { rounds: 1 },
    changes:  [],
    flags: {
      'cyberpunk-blue': {
        quickhackPending:    true,
        quickhackName:       chosenExe.name,
        quickhackEffect:     qhDesc,
        quickhackUploadBy:   actor.id,
        quickhackTargetId:   targetActor.id,
        quickhackRound:      game.combat?.round ?? 0,
      },
    },
  }]);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Netrunning.QuickhackUploaded')}</h3><p>${game.i18n.format('CYBER_BLUE.Netrunning.QuickhackUploadedMsg', { qh: chosenExe.name, target: targetActor.name })}</p>${qhDesc ? `<p><em>${qhDesc}</em></p>` : ''}</div>`,
  });
}

// ── NET Timer resolution ───────────────────────────────────────────────────────

/**
 * Called from the `combatTurn` hook each time a new combatant's turn begins.
 * Fires any pending quickhack AEs whose upload round is earlier than the
 * current combat round, and resolves pending Encrypt/Decrypt operations for
 * the active combatant.
 *
 * @param {Combat} combat      - The active Combat document
 * @param {number} roundNumber - The round number that just became active
 */
export async function resolveNetTimers(combat, roundNumber) {
  if (!game.user.isGM) return;

  // ── Quickhack activation ──────────────────────────────────────────────────
  // Scan every actor for pending quickhack AEs whose creation round is
  // strictly earlier than the current round.
  for (const actor of game.actors) {
    const toFire = actor.effects.filter(
      (e) => e.getFlag('cyberpunk-blue', 'quickhackPending')
        && (e.getFlag('cyberpunk-blue', 'quickhackRound') ?? 0) < roundNumber,
    );
    for (const ae of toFire) {
      const qhName    = ae.getFlag('cyberpunk-blue', 'quickhackName')    ?? '(unknown)';
      const qhEffect  = ae.getFlag('cyberpunk-blue', 'quickhackEffect')  ?? '';
      const uploadBy  = ae.getFlag('cyberpunk-blue', 'quickhackUploadBy') ?? '';
      const hacker    = game.actors.get(uploadBy);
      ChatMessage.create({
        speaker: hacker ? ChatMessage.getSpeaker({ actor: hacker }) : {},
        content: `<div class="cyberpunk-blue chat-card">
          <h3><i class="fas fa-microchip"></i> ${game.i18n.format('CYBER_BLUE.Netrunning.QuickhackActivated', { qh: qhName, target: actor.name })}</h3>
          ${qhEffect ? `<p><em>${qhEffect}</em></p>` : ''}
        </div>`,
      });
      await ae.delete();
    }
  }

  // ── Encrypt/Decrypt completion ────────────────────────────────────────────
  // Each combatant's turn-start: check if they have a pending Encrypt/Decrypt
  // AE from a previous round — if so, announce completion.
  for (const combatant of combat.combatants) {
    const actor = combatant.actor;
    if (!actor) continue;
    const toComplete = actor.effects.filter(
      (e) => e.getFlag('cyberpunk-blue', 'encryptDecryptPending')
        && (e.getFlag('cyberpunk-blue', 'encryptDecryptRound') ?? 0) < roundNumber,
    );
    for (const ae of toComplete) {
      const opLabel = ae.getFlag('cyberpunk-blue', 'encryptDecryptLabel') ?? 'Encrypt/Decrypt';
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="cyberpunk-blue chat-card">
          <p><i class="fas fa-lock"></i> <strong>${actor.name}</strong>: ${game.i18n.format('CYBER_BLUE.Netrunning.EncryptDecryptComplete', { op: opLabel })}</p>
        </div>`,
      });
      await ae.delete();
    }
  }

  // ── Expiring NET-combat rider AEs (NET-action penalty, node lock) ──────────
  // Any rider AE flagged with `netExpiresRound` is removed once that round is
  // reached. ('untilDisconnect' riders carry a null round and are skipped here.)
  for (const actor of game.actors) {
    const expired = actor.effects.filter((e) => {
      const r = e.getFlag('cyberpunk-blue', 'netExpiresRound');
      return typeof r === 'number' && r <= roundNumber;
    });
    for (const ae of expired) await ae.delete();
  }
}

/**
 * Create a pending Encrypt/Decrypt AE on the Netrunner that resolves on the
 * next combat round.  Call this when the Netrunner uses the encryptDecrypt
 * component action.
 *
 * @param {Actor}  actor    - The Netrunner
 * @param {string} opLabel  - "Encrypt" or "Decrypt" (display label)
 */
export async function startEncryptDecryptTimer(actor, opLabel) {
  const currentRound = game.combat?.round ?? 0;
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name:     game.i18n.format('CYBER_BLUE.Netrunning.EncryptDecryptPending', { op: opLabel }),
    icon:     'icons/svg/padlock.svg',
    disabled: false,
    transfer: false,
    duration: { rounds: 1 },
    changes:  [],
    flags: {
      'cyberpunk-blue': {
        encryptDecryptPending: true,
        encryptDecryptLabel:   opLabel,
        encryptDecryptRound:   currentRound,
      },
    },
  }]);
}

// ── NET Combat helpers ─────────────────────────────────────────────────────────

/**
 * Resolve a NET combat attack: roll vs DEF (program) or a GM-supplied DV (human/NPC).
 * Applies damage on hit and posts the result to chat.
 *
 * @param {Actor}  attackerActor  - Actor making the attack (Netrunner or Program)
 * @param {Actor}  targetActor    - Target (program actor, character, NPC, or mook)
 * @param {number} atkModifier    - Flat modifier added to 1d10 attack roll
 * @param {string} attackerLabel  - Display label for the attacker action (e.g. "Zap", "Sword")
 * @param {string} damageFormula  - Legacy flat damage roll formula (used only when
 *                                   `opts.effectsConfig` is absent, e.g. Zap "1d6").
 * @param {object|number} [opts]   - Options (a bare number is treated as the legacy
 *                                   positional `dvOverride`):
 *   @param {number}      [opts.dvOverride]       Skip the DV dialog, use this value.
 *   @param {object}      [opts.effectsConfig]    `system.netCombat.attack` — when present,
 *                                                on-hit damage/affliction/effectText come from here.
 *   @param {Actor|Item}  [opts.effectsSourceDoc] Document owning the affliction template AE
 *                                                (program actor for Attack, exe for Support).
 *   @param {Item}        [opts.sourceExe]        Executable to set not-running when
 *                                                `effectsConfig.stopRunningAfter`.
 *   @param {number}      [opts.boostContext]     Booster modifier added to the attack roll.
 * @returns {Promise<{hit: boolean, roll: Roll, damage: number}|null>}
 *   null if the action was cancelled / refused.
 */
export async function resolveNetAttack(attackerActor, targetActor, atkModifier, attackerLabel, damageFormula, opts = {}) {
  if (typeof opts === 'number' || opts === null) opts = { dvOverride: opts };
  const {
    dvOverride = null, effectsConfig = null, effectsSourceDoc = null,
    sourceExe = null, boostContext = 0,
  } = opts;

  const npc = await import('./net-program-combat.mjs');

  // Inert / non-combatant attacker guard (programs only confer benefit when
  // running, in combat, and not in ##ERROR##).
  if (attackerActor?.type === 'program'
    && (npc.isNonCombatant(attackerActor) || npc.programActorInError(attackerActor))) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.AttackerInert'));
    return null;
  }

  if (attackerActor?.type === 'program' && attackerActor?.system?.programType === 'blackice') {
    playSfx('black-ICE-attack');
  } else {
    playSfx('NET-action-zap');
  }

  // Determine DV
  let dv;
  if (dvOverride !== null) {
    dv = Number(dvOverride);
  } else if (targetActor.type === 'program') {
    dv = Number(targetActor.system.stats?.def?.value) || 0;
  } else {
    // Human/NPC target — ask for their NET(Cracker) roll or a flat DV
    const result = await _promptNetDv(targetActor.name);
    if (result === null) return null;
    dv = result;
  }

  // Attack roll (+ booster boost). Flack (N8) halves an ICE attacker's ATK
  // against a target carrying the netHalveIceAtk aura.
  let atk = Number(atkModifier) || 0;
  const attackerIsIce = ['ice', 'blackice'].includes(attackerActor?.system?.programType);
  if (attackerIsIce && targetActor.effects?.some((e) => !e.disabled && e.getFlag('cyberpunk-blue', 'netHalveIceAtk'))) {
    atk = Math.floor(atk / 2);
  }
  const totalMod = atk + (Number(boostContext) || 0);
  const formula = totalMod >= 0 ? `1d10+${totalMod}` : `1d10${totalMod}`;
  const roll = await new Roll(formula).evaluate();
  const hit = roll.total >= dv;

  const resolution = { damage: 0, affliction: null, conditions: [] };
  let effectText = '';
  let defNotes = [];
  if (hit) {
    // Build the incoming damage / affliction either from the program's
    // configured NET Combat effects, or the legacy flat damage formula.
    if (effectsConfig) {
      const built = await npc.buildAttackResolution(effectsSourceDoc ?? attackerActor, effectsConfig, targetActor);
      resolution.damage = built.damage;
      resolution.affliction = built.affliction;
      resolution.conditions = built.conditions ?? [];
      effectText = built.effectText;
    } else if (damageFormula) {
      const dmgRoll = await new Roll(damageFormula).evaluate();
      resolution.damage = dmgRoll.total;
    }

    // Defensive interjection (Defender / personnel / program), random order.
    const defenders = await npc.gatherDefenders(targetActor);
    const attackerIsBlackIce = attackerActor?.system?.programType === 'blackice';
    const result = await npc.applyDefensePipeline(resolution, defenders, { attackerIsBlackIce });
    defNotes = result.notes;

    // Apply final damage (program → REZ, character/NPC → HP, armour ignored).
    if (resolution.damage > 0) {
      if (targetActor.type === 'program') {
        const curRez = npc.progRez(targetActor);
        const newRez = Math.max(curRez - resolution.damage, 0);
        await targetActor.update({ 'system.resources.rez.value': newRez });
        // deleteOnKill (N5 — Dragon, Killer): destroy rather than derez at REZ 0.
        if (newRez <= 0 && effectsConfig?.deleteOnKill) {
          await destroyProgramTarget(targetActor);
        }
      } else {
        await targetActor.applyDamage(resolution.damage, { ignoreArmor: true });
      }
    }

    // Force an unsafe disconnect on a Netrunner target (N2 — Deckkrash, Giant).
    const fd = effectsConfig?.forceDisconnect;
    if (fd?.enabled && (targetActor.type === 'character' || targetActor.type === 'npc')) {
      const src = effectsSourceDoc ?? attackerActor;
      const alreadyUsed = fd.oncePerSource && src?.getFlag?.('cyberpunk-blue', 'forceDisconnectUsed');
      if (!alreadyUsed) {
        if (fd.oncePerSource && src) await src.setFlag('cyberpunk-blue', 'forceDisconnectUsed', true);
        await disconnectFromArchitecture(targetActor, false);
      }
    }

    // Affliction (if not Cooled away) — rolls the target's defence + applies AE.
    if (resolution.affliction) {
      await npc.applyAfflictionFromConfig(resolution.affliction, targetActor);
    }

    // On-hit riders: surviving Conditions (fire), stat penalty, NET-action
    // penalty, node lock (N13 / N7 / N1 / N3).
    if (effectsConfig) {
      await npc.applyAttackRiders(effectsConfig, targetActor, resolution.conditions ?? []);
    }

    // Post-resolution defender effects (MemHandler / JunkData).
    await npc.runDefensePostEffects(result.postEffects);

    // Attacker self-disables after a configured attack.
    if (effectsConfig?.stopRunningAfter && sourceExe?.system?.running) {
      await sourceExe.update({ 'system.running': false });
    }
  }

  // Headline chat
  const dvLabel = targetActor.type === 'program'
    ? game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DefLabel', { dv })
    : game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DvLabel', { dv });
  const hitStr  = hit ? game.i18n.localize('CYBER_BLUE.Combat.Hit') : game.i18n.localize('CYBER_BLUE.Combat.Miss');
  const dmgStr  = (hit && resolution.damage > 0)
    ? ` — ${resolution.damage} ${targetActor.type === 'program' ? 'REZ' : 'HP'}`
    : '';
  const effectLine = (hit && effectText) ? `<p><em>${effectText}</em></p>` : '';
  const defLine = (hit && defNotes.length)
    ? `<div class="net-defense-notes"><p><i class="fas fa-shield-halved"></i> ${game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.DefenseHeader')}</p>${defNotes.map((n) => `<p>${n}</p>`).join('')}</div>`
    : '';

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attackerActor }),
    flavor: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-bolt"></i> ${attackerLabel}: ${targetActor.name}</h3>
      <p>${game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.RollVs', { formula, dvLabel })}</p>
      <p><strong>${hitStr}</strong>${dmgStr}</p>
      ${effectLine}${defLine}
    </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  return { hit, roll, damage: resolution.damage };
}

/**
 * Show a dialog prompting for the target's NET(Cracker) roll or a flat DV.
 * Returns the numeric value, or null if cancelled.
 */
async function _promptNetDv(targetName) {
  const { promise, resolve } = Promise.withResolvers();
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.DvDialogTitle') },
    content: `<div class="cyberpunk-blue">
      <p>${game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DvDialogHint', { target: targetName })}</p>
      <label>${game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.DvDialogLabel')}
        <input type="number" name="net-dv-input" id="net-dv-input" value="15" min="0" style="width:4rem;margin-left:.4rem;" />
      </label>
    </div>`,
    buttons: [
      {
        action: 'ok',
        label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Confirm'),
        icon: 'fas fa-bolt',
        default: true,
        // DialogV2 button callbacks receive (event, button, dialog) — read the
        // value from button.form, not a non-existent html element.
        callback: (event, button) => resolve(Number(button.form?.elements['net-dv-input']?.value) || 0),
      },
      {
        action: 'cancel',
        label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
        icon: 'fas fa-times',
        callback: () => resolve(null),
      },
    ],
    submit: (result) => resolve(result),
  });
  dialog.addEventListener('close', () => resolve(null), { once: true });
  dialog.render(true);
  return promise;
}

// ─── Program Actor ↔ Executable link ─────────────────────────────────────────
//
// A Program Actor links to exactly one Program Executable item via
// `system.executableUuid`. Two modes share that field: "referenced" (the exe
// lives elsewhere, e.g. on a Netrunner's cyberdeck) and "attached" (the exe is
// embedded on the program actor itself). While the UUID resolves, every
// corresponding field is mirrored both ways.
//
// Updates pushed by the sync carry the `cyberblueProgramSync` option so the
// hooks on the receiving side skip re-syncing (echo suppression / loop break).

/**
 * Field correspondence between a Program Actor and its Executable item.
 * `actor` = dotted path on the Actor document; `exe` = dotted path on the Item.
 * This single table drives both copy-on-link and the two-way live sync.
 */
export const PROGRAM_LINK_FIELDS = [
  { actor: 'name',                       exe: 'name' },
  { actor: 'img',                        exe: 'img' },
  { actor: 'system.programType',         exe: 'system.programType' },
  { actor: 'system.stats.act.value',     exe: 'system.act' },
  { actor: 'system.stats.atk.value',     exe: 'system.atk' },
  { actor: 'system.stats.def.value',     exe: 'system.def' },
  { actor: 'system.stats.net.value',     exe: 'system.net' },
  { actor: 'system.stats.per.value',     exe: 'system.per' },
  { actor: 'system.resources.rez.value', exe: 'system.rez.value' },
  { actor: 'system.resources.rez.max',   exe: 'system.rez.max' },
  { actor: 'system.description',         exe: 'system.description' },
  { actor: 'system.notes',               exe: 'system.notes' },
  // NET Combat config is synced as a whole sub-object (see _netCombatPayload):
  // the leaf-by-leaf delta approach can't faithfully carry the booster array or
  // a multi-field toggle, so we copy the entire current `system.netCombat` from
  // the source document whenever the change touches it.
  { actor: 'system.netCombat',           exe: 'system.netCombat', whole: true },
];

/**
 * Build the whole-object payload for a `netCombat` sync from a source document
 * (Program actor OR Executable item — the path is identical on both). The
 * affliction template AE `_id` is document-local (AEs aren't synced and their
 * ids differ between copies), so it is stripped from the payload, leaving the
 * receiving document's own `effectId` intact through Foundry's recursive merge.
 */
function _netCombatPayload(srcDoc) {
  const nc = srcDoc?.system?.toObject?.().netCombat;
  if (!nc) return null;
  if (nc.attack?.affliction) delete nc.attack.affliction.effectId;
  return nc;
}

/**
 * Resolve the Executable item a Program Actor is linked to (or null).
 * @returns {Promise<Item|null>}
 */
export async function getLinkedExecutable(programActor) {
  const uuid = programActor?.system?.executableUuid;
  if (!uuid) return null;
  const doc = await fromUuid(uuid).catch(() => null);
  return doc?.type === 'programExecutable' ? doc : null;
}

/** True when the resolved executable is embedded on the program actor itself. */
export function isExecutableAttached(programActor, exeItem) {
  return Boolean(exeItem && exeItem.parent?.id === programActor.id);
}

/**
 * Copy every corresponding field from an Executable into a Program Actor,
 * replacing whatever is there. Used when a link is first established.
 */
export async function copyExecutableToProgram(programActor, exeItem) {
  const update = {};
  for (const { actor, exe, whole } of PROGRAM_LINK_FIELDS) {
    if (whole) {
      const payload = _netCombatPayload(exeItem);
      if (payload) foundry.utils.setProperty(update, actor, payload);
      continue;
    }
    const value = foundry.utils.getProperty(exeItem, exe);
    if (value !== undefined) foundry.utils.setProperty(update, actor, value);
  }
  if (Object.keys(update).length) {
    await programActor.update(update, { cyberblueProgramSync: true });
  }
}

/**
 * Push changed fields from a Program Actor to its linked Executable.
 * Only the actor-side paths present in `changes` are mapped and forwarded.
 * @param {Actor}  programActor
 * @param {object} changes - the updateActor change delta
 */
export async function syncProgramActorToExecutable(programActor, changes) {
  const exeItem = await getLinkedExecutable(programActor);
  if (!exeItem) return;

  const update = {};
  for (const { actor, exe, whole } of PROGRAM_LINK_FIELDS) {
    if (whole) {
      // The delta only needs to *touch* the path; copy the full current value.
      if (foundry.utils.getProperty(changes, actor) !== undefined) {
        const payload = _netCombatPayload(programActor);
        if (payload) foundry.utils.setProperty(update, exe, payload);
      }
      continue;
    }
    const value = foundry.utils.getProperty(changes, actor);
    if (value !== undefined) foundry.utils.setProperty(update, exe, value);
  }
  if (Object.keys(update).length) {
    await exeItem.update(update, { cyberblueProgramSync: true });
  }
}

/**
 * Push changed fields from an Executable to every Program Actor linked to it.
 * Attached mode: the exe's parent is the program actor. Referenced mode: search
 * world program actors whose executableUuid matches.
 * @param {Item}   exeItem
 * @param {object} changes - the updateItem change delta
 */
export async function syncExecutableToProgramActors(exeItem, changes) {
  const uuid = exeItem.uuid;
  const targets = [];
  if (exeItem.parent?.type === 'program'
    && exeItem.parent.system?.executableUuid === uuid) {
    targets.push(exeItem.parent);
  }
  for (const candidate of game.actors) {
    if (candidate.type !== 'program') continue;
    if (candidate.system?.executableUuid !== uuid) continue;
    if (!targets.includes(candidate)) targets.push(candidate);
  }
  if (!targets.length) return;

  const update = {};
  for (const { actor, exe, whole } of PROGRAM_LINK_FIELDS) {
    if (whole) {
      if (foundry.utils.getProperty(changes, exe) !== undefined) {
        const payload = _netCombatPayload(exeItem);
        if (payload) foundry.utils.setProperty(update, actor, payload);
      }
      continue;
    }
    const value = foundry.utils.getProperty(changes, exe);
    if (value !== undefined) foundry.utils.setProperty(update, actor, value);
  }
  if (!Object.keys(update).length) return;

  for (const programActor of targets) {
    await programActor.update(update, { cyberblueProgramSync: true });
  }
}

/**
 * Apply the ##ERROR## state to a Program Actor whose REZ has reached 0.
 * Idempotent — safe to call if the state is already applied.
 */
export async function applyErrorState(programActor) {
  if (!programActor) return;
  const existing = programActor.effects.find(
    (e) => e.getFlag('cyberpunk-blue', 'isErrorState'),
  );
  if (existing) return;

  await programActor.createEmbeddedDocuments('ActiveEffect', [{
    name: '##ERROR##',
    icon: 'icons/svg/skull.svg',
    disabled: false,
    transfer: false,
    changes: [],
    statuses: ['dead'],
    flags: { 'cyberpunk-blue': { isErrorState: true } },
  }]);

  // Tint the token red in any scene it appears in
  for (const scene of game.scenes) {
    const tok = scene.tokens.find((t) => t.actorId === programActor.id);
    if (tok) await tok.update({ 'light.color': '#ff0000', 'light.alpha': 0.4, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
  }

  ChatMessage.create({
    content: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-triangle-exclamation"></i> ##ERROR##</h3>
      <p><strong>${programActor.name}</strong> ${game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.ErrorStateMsg')}</p>
    </div>`,
  });
}
