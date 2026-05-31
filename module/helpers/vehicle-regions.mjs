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

  // Free art-tracking: regions rotate with the token around its centre so the
  // vital areas / seats stay aligned with the rotated token artwork.
  const { angle, pivotX, pivotY } = tokenRotationPivot(tokenDoc, scene);

  const regionDataList = regions.map((entry, index) => {
    // Map the blueprint shape from token-local blueprint pixels to scene pixels:
    // scale by the grid ratio, then translate by token origin + scaled offset.
    const dx = tx + (entry.offset?.x ?? 0) * k;
    const dy = ty + (entry.offset?.y ?? 0) * k;
    const shape = rotateShape(transformShape(entry.shape, k, dx, dy), angle, pivotX, pivotY);

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

  // Free art-tracking: rotate region shapes with the token around its centre.
  const { angle, pivotX, pivotY } = tokenRotationPivot(tokenDoc, scene);

  const updates = linked.map((region) => {
    const flags = region.flags?.['cyberpunk-blue'] ?? {};
    const origShape = flags.blueprintShape ?? {};
    const refGrid = flags.blueprintReferenceGrid ?? 100;
    const k = gridScale(scene, refGrid);
    const dx = tx + (flags.blueprintOffsetX ?? 0) * k;
    const dy = ty + (flags.blueprintOffsetY ?? 0) * k;
    return {
      _id: region.id,
      shapes: [rotateShape(transformShape(origShape, k, dx, dy), angle, pivotX, pivotY)],
    };
  });

  await scene.updateEmbeddedDocuments('Region', updates, {
    cyberpunkBlueVehicleSync: true,
  });
}

/** Flag key holding a vehicle token's base (rotation-0) grid footprint. */
export const VEHICLE_BASE_FOOTPRINT_FLAG = 'vehicleBaseFootprint';

/**
 * Record a vehicle token's base (rotation-0) footprint so the 90° snap mode can
 * later restore/swap width & height correctly. Called from `createToken`.
 *
 * @param {TokenDocument} tokenDoc
 */
export async function recordVehicleBaseFootprint(tokenDoc) {
  if (tokenDoc?.actor?.type !== 'vehicle') return;
  if (tokenDoc.getFlag('cyberpunk-blue', VEHICLE_BASE_FOOTPRINT_FLAG)) return;
  // Only trust the current dims as "base" when the token is unrotated.
  if ((tokenDoc.rotation ?? 0) % 360 !== 0) return;
  await tokenDoc.setFlag('cyberpunk-blue', VEHICLE_BASE_FOOTPRINT_FLAG, {
    width: tokenDoc.width ?? 1,
    height: tokenDoc.height ?? 1,
  });
}

/**
 * Optional 90° snap mode: when enabled, snap a vehicle token's rotation to the
 * nearest quarter-turn and swap its grid footprint (width/height) at 90°/270°
 * so the occupied squares match the rotated artwork. The token centre is held
 * fixed across the swap.
 *
 * Performs the token update with the `cyberpunkBlueVehicleSnap` guard so the
 * re-entrant `updateToken` can detect and skip re-snapping (while still running
 * the region sync). Returns `true` when an update was issued.
 *
 * @param {TokenDocument} tokenDoc
 * @param {object} options  updateToken hook options
 * @returns {Promise<boolean>}
 */
export async function applyVehicleRotationSnap(tokenDoc, options = {}) {
  if (options?.cyberpunkBlueVehicleSnap) return false;
  if (!game.settings.get('cyberpunk-blue', 'vehicleRotationSnap')) return false;
  const scene = tokenDoc?.parent;
  if (!scene) return false;

  const base = tokenDoc.getFlag('cyberpunk-blue', VEHICLE_BASE_FOOTPRINT_FLAG)
            ?? { width: tokenDoc.width ?? 1, height: tokenDoc.height ?? 1 };
  const rotation = tokenDoc.rotation ?? 0;
  const snapped = (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
  const swap = snapped === 90 || snapped === 270;
  const newW = swap ? base.height : base.width;
  const newH = swap ? base.width : base.height;

  const needs = snapped !== rotation
             || newW !== tokenDoc.width
             || newH !== tokenDoc.height;
  if (!needs) return false;

  // Hold the token centre fixed across the footprint swap.
  const gridSize = scene.grid?.size ?? 100;
  const cx = (tokenDoc.x ?? 0) + (tokenDoc.width ?? 1) * gridSize / 2;
  const cy = (tokenDoc.y ?? 0) + (tokenDoc.height ?? 1) * gridSize / 2;
  const newX = cx - newW * gridSize / 2;
  const newY = cy - newH * gridSize / 2;

  await tokenDoc.update(
    { rotation: snapped, width: newW, height: newH, x: newX, y: newY },
    { cyberpunkBlueVehicleSnap: true },
  );
  return true;
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

  // Regions on the scene are rotated to track the token's art; undo that
  // rotation around the token centre before mapping back to blueprint space so
  // the captured blueprint is always stored at rotation 0.
  const { angle, pivotX, pivotY } = tokenRotationPivot(tokenDoc, scene);

  return linked.map((region) => {
    const src = region.toObject();
    const flags = src.flags?.['cyberpunk-blue'] ?? {};
    const behavior = Array.isArray(src.behaviors) ? src.behaviors[0] : undefined;
    const unrotated = rotateShape(src.shapes?.[0] ?? {}, -angle, pivotX, pivotY);
    return {
      regionId: flags.blueprintRegionId ?? foundry.utils.randomID(),
      label: flags.blueprintLabel ?? '',
      shape: inverseShape(unrotated, k, tx, ty),
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
 * Compute the rotation angle and scene-pixel pivot (token centre) used to make
 * linked regions track the token's rotated artwork.
 *
 * Foundry tokens rotate their artwork about the token centre; we rotate region
 * shapes about the same point so vital areas / seats stay aligned with the art.
 *
 * @param {TokenDocument} tokenDoc
 * @param {Scene} scene
 * @returns {{ angle: number, pivotX: number, pivotY: number }}
 */
function tokenRotationPivot(tokenDoc, scene) {
  const angle = tokenDoc?.rotation ?? 0;
  const gridSize = scene?.grid?.size ?? 100;
  const tx = tokenDoc?.x ?? 0;
  const ty = tokenDoc?.y ?? 0;
  const w = (tokenDoc?.width ?? 1) * gridSize;
  const h = (tokenDoc?.height ?? 1) * gridSize;
  return { angle, pivotX: tx + w / 2, pivotY: ty + h / 2 };
}

/**
 * Rotate a scene-pixel RegionShape clockwise by `angleDeg` about the pivot
 * (matching Foundry's clockwise token-rotation convention in y-down screen
 * coordinates). Returns a clone; the source is never mutated. A zero angle
 * returns the shape unchanged.
 *
 * Supports polygon / rectangle / circle / ellipse. Rectangle and ellipse carry
 * their own `rotation` field, so we rotate their centre about the pivot and add
 * the angle to that field; polygons rotate every vertex; circles only move.
 *
 * @param {object|null} shape
 * @param {number} angleDeg  clockwise degrees
 * @param {number} pivotX
 * @param {number} pivotY
 * @returns {object}
 */
function rotateShape(shape, angleDeg, pivotX, pivotY) {
  const a = (angleDeg ?? 0) % 360;
  if (!shape?.type || a === 0) return shape;

  const rad = (a * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x, y) => {
    const dx = (x ?? 0) - pivotX;
    const dy = (y ?? 0) - pivotY;
    return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
  };

  const s = foundry.utils.deepClone(shape);
  switch (s.type) {
    case 'polygon': {
      const pts = Array.isArray(s.points) ? s.points : [];
      const out = [];
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const p = rot(pts[i], pts[i + 1]);
        out.push(p.x, p.y);
      }
      s.points = out;
      break;
    }
    case 'rectangle': {
      const w = s.width ?? 0;
      const h = s.height ?? 0;
      const c = rot((s.x ?? 0) + w / 2, (s.y ?? 0) + h / 2);
      s.x = c.x - w / 2;
      s.y = c.y - h / 2;
      s.rotation = ((s.rotation ?? 0) + a) % 360;
      break;
    }
    case 'ellipse': {
      const c = rot(s.x, s.y);
      s.x = c.x; s.y = c.y;
      s.rotation = ((s.rotation ?? 0) + a) % 360;
      break;
    }
    case 'circle': {
      const c = rot(s.x, s.y);
      s.x = c.x; s.y = c.y;
      break;
    }
    default: {
      if ('x' in s && 'y' in s) {
        const c = rot(s.x, s.y);
        s.x = c.x; s.y = c.y;
      }
      break;
    }
  }
  return s;
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
