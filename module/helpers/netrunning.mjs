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

const NET_CONNECTION_FLAG = 'netConnection';
const PROGRAM_ACTOR_FLAG  = 'programActorId';

// ── Accessors ──────────────────────────────────────────────────────────────────

/** Return the actor's current net connection data, or null if not connected. */
export function getNetConnection(actor) {
  return actor.getFlag('cyberpunk-blue', NET_CONNECTION_FLAG) ?? null;
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
 * Only considers regions that have a `cyberpunk-blue.accessPoint` behavior.
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

/** Extract the `cyberpunk-blue.accessPoint` behavior from a region, or null. */
export function _getApBehavior(region) {
  for (const b of (region.behaviors ?? [])) {
    if (b.type === 'cyberpunk-blue.accessPoint') return b;
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
 * @param {Actor}          actor    - The Netrunner character
 * @param {RegionDocument} apRegion - The Access Point region in the current scene
 */
export async function connectToArchitecture(actor, apRegion) {
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

  // Determine spawn position from the ACC_node region
  const accNodeUuid = apBehavior.system?.accNodeRegionUuid;
  const gridSize    = archScene.grid?.size ?? 100;
  let spawnX = 0, spawnY = 0;

  if (accNodeUuid) {
    try {
      const accNodeRegion = await fromUuid(accNodeUuid);
      if (accNodeRegion) {
        const centre = _regionCentre(accNodeRegion);
        if (centre) {
          // Snap to grid, offset by half a token to top-left corner
          spawnX = Math.floor((centre.x - gridSize / 2) / gridSize) * gridSize;
          spawnY = Math.floor((centre.y - gridSize / 2) / gridSize) * gridSize;
        }
      }
    } catch { /* UUID not yet configured — use default */ }
  }

  // Create the actor's token in the architecture scene
  const protoData = actor.prototypeToken.toObject();
  delete protoData._id;
  protoData.actorId   = actor.id;
  protoData.actorLink = true;
  protoData.x         = spawnX;
  protoData.y         = spawnY;

  const [tokenDoc] = await archScene.createEmbeddedDocuments('Token', [protoData]);

  const deck = getPrimaryCyberdeck(actor);
  await actor.setFlag('cyberpunk-blue', NET_CONNECTION_FLAG, {
    apSceneId:   canvas.scene?.id ?? '',
    apRegionId:  apRegion.id,
    archSceneId: archScene.id,
    archTokenId: tokenDoc.id,
    cyberdeckId: deck?.id ?? '',
  });

  // Switch the current user's active scene to the architecture
  await archScene.view();

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-plug"></i> ${game.i18n.format('CYBER_BLUE.Netrunning.ConnectedMsg', { name: actor.name, scene: archScene.name })}</p></div>`,
  });
}

/**
 * Disconnect the actor from the current architecture.
 *
 * @param {Actor}   actor - The Netrunner
 * @param {boolean} safe  - true for a graceful disconnect; false triggers trauma
 */
export async function disconnectFromArchitecture(actor, safe = true) {
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

  // Switch the current user back to the AP scene
  const apScene = game.scenes.get(conn.apSceneId);
  if (apScene) await apScene.view();

  // Clear connection flag
  await actor.unsetFlag('cyberpunk-blue', NET_CONNECTION_FLAG);

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

  // Apply a pending AE on the target (lasts 1 round — fires at end of hacker's next turn)
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
        quickhackPending:  true,
        quickhackName:     chosenExe.name,
        quickhackEffect:   qhDesc,
        quickhackUploadBy: actor.id,
      },
    },
  }]);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Netrunning.QuickhackUploaded')}</h3><p>${game.i18n.format('CYBER_BLUE.Netrunning.QuickhackUploadedMsg', { qh: chosenExe.name, target: targetActor.name })}</p>${qhDesc ? `<p><em>${qhDesc}</em></p>` : ''}</div>`,
  });
}
