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

  const regionDataList = regions.map((entry, index) => {
    // Translate the blueprint shape from token-local coordinates to scene
    // coordinates: token origin + the per-region offset.
    const dx = tx + (entry.offset?.x ?? 0);
    const dy = ty + (entry.offset?.y ?? 0);
    const shape = translateShape(entry.shape, dx, dy);

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

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Translate a Foundry v14 RegionShape descriptor from token-local coordinates
 * to scene coordinates by adding (dx, dy) to the relevant origin fields.
 *
 * Supports all four standard shape types:
 *   polygon   — points: [x1, y1, x2, y2, …]  (flat alternating array)
 *   rectangle — x, y, width, height
 *   circle    — x, y, radius
 *   ellipse   — x, y, radiusX, radiusY
 *
 * Returns a shallow-cloned shape with translated coordinates so the original
 * blueprint data is never mutated.
 *
 * @param {object|null} shape
 * @param {number} dx
 * @param {number} dy
 * @returns {object}
 */
function translateShape(shape, dx, dy) {
  if (!shape?.type) {
    // No valid shape defined — fall back to a small rectangle at the offset.
    return { type: 'rectangle', x: dx, y: dy, width: 100, height: 100 };
  }

  const s = foundry.utils.deepClone(shape);

  switch (s.type) {
    case 'polygon': {
      // points is a flat [x, y, x, y, …] array.
      const pts = Array.isArray(s.points) ? s.points : [];
      s.points = pts.map((v, i) => (i % 2 === 0 ? v + dx : v + dy));
      break;
    }
    case 'rectangle':
    case 'circle':
    case 'ellipse':
      s.x = (s.x ?? 0) + dx;
      s.y = (s.y ?? 0) + dy;
      break;
    default:
      // Unknown shape type — translate x/y if they exist.
      if ('x' in s) s.x = (s.x ?? 0) + dx;
      if ('y' in s) s.y = (s.y ?? 0) + dy;
      break;
  }

  return s;
}
