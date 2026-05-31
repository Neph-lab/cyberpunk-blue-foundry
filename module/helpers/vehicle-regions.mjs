/**
 * Vehicle blueprint materialisation and linked Region management.
 *
 * When a vehicle Token is placed on a Scene, `materialiseVehicleBlueprint`
 * reads the actor's `system.blueprint.regions` array and creates Scene-level
 * Regions for each entry, linking them back to the token via a flag.
 *
 * Linked Regions are cleaned up by `cleanupVehicleRegions` when the token
 * is deleted.
 *
 * Position sync (moving Regions when the Token moves) is Phase 3.
 */

/** Flag key used on Scene Regions to identify the vehicle token they belong to. */
export const VEHICLE_TOKEN_FLAG = 'vehicleTokenId';

/**
 * Materialise Scene Regions from a vehicle actor's blueprint when its token
 * is placed on a scene.
 *
 * Called from a `createToken` hook (activeGM only).
 *
 * @param {TokenDocument} tokenDoc
 */
export async function materialiseVehicleBlueprint(tokenDoc) {
  const actor = tokenDoc.actor;
  if (!actor || actor.type !== 'vehicle') return;

  const regions = actor.system?.blueprint?.regions ?? [];
  if (!regions.length) return;

  const scene = tokenDoc.parent;
  if (!scene) return;

  const tx = tokenDoc.x ?? 0;
  const ty = tokenDoc.y ?? 0;

  // Blueprint shapes are authored at `referenceGrid` px/square; rescale them to
  // the destination scene's grid so a blueprint looks right on any grid size.
  const refGrid = actor.system?.blueprint?.referenceGrid ?? 100;
  const k = gridScale(scene, refGrid);

  const regionDataList = regions.map((entry, index) => {
    // Map the blueprint shape from token-local blueprint pixels to scene pixels:
    // scale by the grid ratio, then translate by token origin + scaled offset.
    const dx = tx + (entry.offset?.x ?? 0) * k;
    const dy = ty + (entry.offset?.y ?? 0) * k;
    const shape = transformShape(entry.shape, k, dx, dy);

    /** @type {object} */
    const regionData = {
      name: `${tokenDoc.name} — ${entry.behaviorType || `Region ${index + 1}`}`,
      // Muted blue tint so vehicle regions are visually distinct.
      color: '#3a7abf',
      visibility: CONST.REGION_VISIBILITY.LAYER,
      shapes: [shape],
      flags: {
        'cyberpunk-blue': {
          [VEHICLE_TOKEN_FLAG]: tokenDoc.id,
          vehicleActorId: actor.id,
          blueprintIndex: index,
          // Store the original untranslated shape and offset so the region can
          // be repositioned correctly whenever the vehicle token moves, plus the
          // identity needed to capture edits back into the blueprint (Phase 3).
          blueprintShape: foundry.utils.deepClone(entry.shape ?? {}),
          blueprintOffsetX: entry.offset?.x ?? 0,
          blueprintOffsetY: entry.offset?.y ?? 0,
          blueprintReferenceGrid: refGrid,
          blueprintRegionId: entry.regionId ?? null,
          blueprintLabel: entry.label ?? '',
        },
      },
    };

    // Attach the behavior if a recognised type is provided.
    if (entry.behaviorType) {
      regionData.behaviors = [{
        type: entry.behaviorType,
        system: foundry.utils.deepClone(entry.behaviorConfig ?? {}),
      }];
    }

    return regionData;
  });

  await scene.createEmbeddedDocuments('Region', regionDataList);
}

/**
 * Delete all Scene Regions that are linked to the given vehicle token.
 *
 * Called from a `deleteToken` hook (activeGM only).
 *
 * @param {TokenDocument} tokenDoc
 */
export async function cleanupVehicleRegions(tokenDoc) {
  const scene = tokenDoc.parent;
  if (!scene) return;

  const linkedIds = scene.regions
    .filter((r) => r.flags?.['cyberpunk-blue']?.[VEHICLE_TOKEN_FLAG] === tokenDoc.id)
    .map((r) => r.id);

  if (linkedIds.length) {
    await scene.deleteEmbeddedDocuments('Region', linkedIds);
  }
}

/**
 * Return all Scene Regions linked to the given vehicle token document.
 *
 * @param {TokenDocument} tokenDoc
 * @returns {RegionDocument[]}
 */
export function getLinkedRegions(tokenDoc) {
  const scene = tokenDoc.parent;
  if (!scene) return [];
  return scene.regions.filter(
    (r) => r.flags?.['cyberpunk-blue']?.[VEHICLE_TOKEN_FLAG] === tokenDoc.id,
  );
}

/**
 * Reposition all Scene Regions linked to a vehicle token after that token has
 * moved.  Each region recomputes its shape from the stored blueprint data
 * (original untranslated shape + offset) and the token's current position,
 * avoiding accumulated floating-point drift.
 *
 * Called from the `updateToken` hook (activeGM only, with the
 * `cyberpunkBlueVehicleSync` guard to prevent recursion).
 *
 * Note: rotation-around-pivot sync is deferred to Phase 5.
 *
 * @param {TokenDocument} tokenDoc
 */
export async function syncVehicleRegionPositions(tokenDoc) {
  const scene = tokenDoc.parent;
  if (!scene) return;

  const linked = getLinkedRegions(tokenDoc);
  if (!linked.length) return;

  const tx = tokenDoc.x ?? 0;
  const ty = tokenDoc.y ?? 0;

  const updates = linked.map((region) => {
    const flags = region.flags?.['cyberpunk-blue'] ?? {};
    const origShape = flags.blueprintShape ?? {};
    const refGrid = flags.blueprintReferenceGrid ?? 100;
    const k = gridScale(scene, refGrid);
    const dx = tx + (flags.blueprintOffsetX ?? 0) * k;
    const dy = ty + (flags.blueprintOffsetY ?? 0) * k;
    return {
      _id: region.id,
      shapes: [transformShape(origShape, k, dx, dy)],
    };
  });

  await scene.updateEmbeddedDocuments('Region', updates, {
    cyberpunkBlueVehicleSync: true,
  });
}

/**
 * Capture the current scene Regions linked to a vehicle token back into
 * blueprint-region entries (the reverse of materialisation).
 *
 * Each linked Region's *current* scene shape is mapped back to token-local
 * blueprint pixels (subtract token origin, divide by the grid ratio) and stored
 * with `offset {0,0}`. Behavior type/config are read from the Region's own
 * behavior; identity (regionId/label) is recovered from the materialisation
 * flags so vital-area targeting stays stable across a round-trip.
 *
 * Pure — performs no DB write. The caller decides what to do with the result
 * (e.g. the blueprint editor overwrites its working set and persists).
 *
 * @param {TokenDocument} tokenDoc
 * @param {number} referenceGrid  px/square the blueprint is authored at
 * @returns {object[]}  array of `blueprint.regions` entries
 */
export function captureRegionsFromToken(tokenDoc, referenceGrid = 100) {
  const scene = tokenDoc?.parent;
  if (!scene) return [];

  const linked = getLinkedRegions(tokenDoc).slice().sort((a, b) => {
    const ai = a.flags?.['cyberpunk-blue']?.blueprintIndex ?? 0;
    const bi = b.flags?.['cyberpunk-blue']?.blueprintIndex ?? 0;
    return ai - bi;
  });
  if (!linked.length) return [];

  const k = gridScale(scene, referenceGrid);
  const tx = tokenDoc.x ?? 0;
  const ty = tokenDoc.y ?? 0;

  return linked.map((region) => {
    const src = region.toObject();
    const flags = src.flags?.['cyberpunk-blue'] ?? {};
    const behavior = Array.isArray(src.behaviors) ? src.behaviors[0] : undefined;
    return {
      regionId: flags.blueprintRegionId ?? foundry.utils.randomID(),
      label: flags.blueprintLabel ?? '',
      shape: inverseShape(src.shapes?.[0] ?? {}, k, tx, ty),
      offset: { x: 0, y: 0 },
      behaviorType: behavior?.type ?? '',
      behaviorConfig: behavior?.system ? foundry.utils.deepClone(behavior.system) : {},
    };
  });
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Grid ratio: destination scene px-per-square ÷ blueprint reference px-per-square. */
function gridScale(scene, referenceGrid) {
  const ref = referenceGrid > 0 ? referenceGrid : 100;
  const size = scene?.grid?.size ?? ref;
  return size / ref;
}

/**
 * Map a Foundry RegionShape descriptor from token-local blueprint pixels to
 * scene pixels: scale every coordinate by `k`, then translate origins by
 * (dx, dy). Returns a clone; the source is never mutated.
 *
 * Supports polygon / rectangle / circle / ellipse.
 *
 * @param {object|null} shape
 * @param {number} k   grid ratio (scene px / blueprint px)
 * @param {number} dx
 * @param {number} dy
 * @returns {object}
 */
function transformShape(shape, k, dx, dy) {
  if (!shape?.type) {
    return { type: 'rectangle', x: dx, y: dy, width: 100 * k, height: 100 * k };
  }

  const s = foundry.utils.deepClone(shape);

  switch (s.type) {
    case 'polygon': {
      const pts = Array.isArray(s.points) ? s.points : [];
      s.points = pts.map((v, i) => (i % 2 === 0 ? v * k + dx : v * k + dy));
      break;
    }
    case 'rectangle':
      s.x = (s.x ?? 0) * k + dx; s.y = (s.y ?? 0) * k + dy;
      s.width = (s.width ?? 0) * k; s.height = (s.height ?? 0) * k;
      break;
    case 'circle':
      s.x = (s.x ?? 0) * k + dx; s.y = (s.y ?? 0) * k + dy;
      s.radius = (s.radius ?? 0) * k;
      break;
    case 'ellipse':
      s.x = (s.x ?? 0) * k + dx; s.y = (s.y ?? 0) * k + dy;
      s.radiusX = (s.radiusX ?? 0) * k; s.radiusY = (s.radiusY ?? 0) * k;
      break;
    default:
      if ('x' in s) s.x = (s.x ?? 0) * k + dx;
      if ('y' in s) s.y = (s.y ?? 0) * k + dy;
      break;
  }

  return s;
}

/**
 * Inverse of {@link transformShape}: map a scene-pixel shape back to token-local
 * blueprint pixels (subtract token origin, divide by the grid ratio). Builds a
 * clean shape with only the canonical fields so editor round-trips stay tidy.
 *
 * @param {object|null} shape
 * @param {number} k   grid ratio (scene px / blueprint px)
 * @param {number} tx  token origin x (scene px)
 * @param {number} ty  token origin y (scene px)
 * @returns {object}
 */
function inverseShape(shape, k, tx, ty) {
  const ix = (v) => ((v ?? 0) - tx) / k;
  const iy = (v) => ((v ?? 0) - ty) / k;
  const d  = (v) => (v ?? 0) / k;

  switch (shape?.type) {
    case 'polygon': {
      const pts = Array.isArray(shape.points) ? shape.points : [];
      return { type: 'polygon', points: pts.map((v, i) => (i % 2 === 0 ? ix(v) : iy(v))) };
    }
    case 'rectangle':
      return { type: 'rectangle', x: ix(shape.x), y: iy(shape.y), width: d(shape.width), height: d(shape.height) };
    case 'circle':
      return { type: 'circle', x: ix(shape.x), y: iy(shape.y), radius: d(shape.radius) };
    case 'ellipse':
      return { type: 'ellipse', x: ix(shape.x), y: iy(shape.y), radiusX: d(shape.radiusX), radiusY: d(shape.radiusY) };
    default:
      return { type: 'rectangle', x: 0, y: 0, width: 100, height: 100 };
  }
}
