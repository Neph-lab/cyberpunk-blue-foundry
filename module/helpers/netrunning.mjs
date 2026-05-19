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

const NET_CONNECTION_FLAG  = 'netConnection';
const JACKED_IN_AE_FLAG    = 'jackedInEffect';
export const PROGRAM_ACTOR_FLAG  = 'programActorId';

/**
 * Return the ID of the first non-GM user who has Owner-level permission on
 * the actor, or null if the actor is only owned by GMs.
 *
 * @param {Actor} actor
 * @returns {string|null}
 */
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
    displayName: proto.displayName ?? CONST.TOKEN_DISPLAY_MODES.OWNER,
    displayBars: proto.displayBars ?? CONST.TOKEN_DISPLAY_MODES.OWNER,
    bar1:        { attribute: proto.bar1?.attribute ?? 'resources.hp' },
    bar2:        { attribute: proto.bar2?.attribute ?? '' },
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

  const deck = getPrimaryCyberdeck(actor);
  await actor.setFlag('cyberpunk-blue', NET_CONNECTION_FLAG, {
    apSceneId:   apRegion.parent?.id ?? canvas.scene?.id ?? '',
    apRegionId:  apRegion.id,
    archSceneId: archScene.id,
    archTokenId: tokenDoc.id,
    cyberdeckId: deck?.id ?? '',
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
  const connectingUserId = forUserId ?? game.user.id;
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

  // Clear connection flag and remove "Jacked In" AE
  await actor.unsetFlag('cyberpunk-blue', NET_CONNECTION_FLAG);
  const jackedInAe = actor.effects.find((e) => e.getFlag('cyberpunk-blue', JACKED_IN_AE_FLAG));
  if (jackedInAe) await jackedInAe.delete();

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
      img:         exeItem.img,
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
      executableId: exeItem.id,
      description:  sys.notes ?? '',
    },
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

  await archScene.createEmbeddedDocuments('Token', [{
    actorId:    programActor.id,
    actorLink:  true,
    name:       exeItem.name,
    img:        exeItem.img,
    x:          (netTok?.x ?? 0) + offsetX,
    y:          netTok?.y  ?? 0,
    width:      0.5,
    height:     0.5,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
  }]);

  await exeItem.setFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG, programActor.id);
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
 * Return true if the actor has an equipped Backup Drive gear item.
 * Backup Drive is a Cyberdeck Hardware MOD (gear type, equipped state).
 */
function _hasBackupDrive(actor) {
  return actor.items.some(
    (item) => item.type === 'gear' && item.name === 'Backup Drive' && item.system.equipped,
  );
}

async function _despawnProgramActor(
  actor, exeItem, { skipRunningUpdate = false, skipBackupDrive = false } = {},
) {
  const programActorId = exeItem.getFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
  if (!programActorId) return;

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
 * @param {string} damageFormula  - Damage roll formula (e.g. "1d6", "2d6+1")
 * @param {string} [dvOverride]   - If set, skip the DV dialog and use this value directly
 * @returns {Promise<{hit: boolean, roll: Roll, damage: Roll|null}|null>}
 *   null if the action was cancelled.
 */
export async function resolveNetAttack(attackerActor, targetActor, atkModifier, attackerLabel, damageFormula, dvOverride = null) {
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

  // Attack roll
  const formula = atkModifier >= 0 ? `1d10+${atkModifier}` : `1d10${atkModifier}`;
  const roll = await new Roll(formula).evaluate();
  const hit = roll.total >= dv;

  // Damage
  let damage = null;
  if (hit) {
    damage = await new Roll(damageFormula).evaluate();
    const isProgram = targetActor.type === 'program';
    if (isProgram) {
      const curRez = Number(targetActor.system.resources?.rez?.value) || 0;
      await targetActor.update({ 'system.resources.rez.value': Math.max(curRez - damage.total, 0) });
    } else {
      await targetActor.applyDamage(damage.total, { ignoreArmor: true });
    }
  }

  // Chat
  const dvLabel = targetActor.type === 'program'
    ? game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DefLabel', { dv })
    : game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DvLabel', { dv });
  const hitStr  = hit ? game.i18n.localize('CYBER_BLUE.Combat.Hit') : game.i18n.localize('CYBER_BLUE.Combat.Miss');
  const dmgStr  = damage
    ? ` — ${damage.total} ${targetActor.type === 'program' ? 'REZ' : 'HP'}`
    : '';

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attackerActor }),
    flavor: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-bolt"></i> ${attackerLabel}: ${targetActor.name}</h3>
      <p>${game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.RollVs', { formula, dvLabel })}</p>
      <p><strong>${hitStr}</strong>${dmgStr}</p>
    </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  return { hit, roll, damage };
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
        <input type="number" id="net-dv-input" value="15" min="0" style="width:4rem;margin-left:.4rem;" />
      </label>
    </div>`,
    buttons: [
      {
        action: 'ok',
        label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Confirm'),
        icon: 'fas fa-bolt',
        default: true,
        callback: (event, button, html) => resolve(Number(html.querySelector('#net-dv-input')?.value) || 0),
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

/**
 * Sync the REZ value from a temporary Program Actor back to its source Executable item.
 * Returns false if the actor is not a temp program actor.
 */
export async function syncRezToExecutable(programActor, newRezValue) {
  const netrunnerActorId = programActor.getFlag('cyberpunk-blue', 'programActorFor');
  const exeItemId        = programActor.getFlag('cyberpunk-blue', 'programExecutableId');
  if (!netrunnerActorId || !exeItemId) return false;

  const netrunnerActor = game.actors.get(netrunnerActorId);
  const exeItem        = netrunnerActor?.items.get(exeItemId);
  if (!exeItem || exeItem.type !== 'programExecutable') return false;

  await exeItem.update({ 'system.rez.value': Math.max(Number(newRezValue) || 0, 0) });
  return true;
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
