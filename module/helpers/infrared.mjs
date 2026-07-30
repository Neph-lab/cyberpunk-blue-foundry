/**
 * Infrared (IR) sense subsystem.
 *
 * Cyberware / gear items (and installed-and-active weapon Mods) can carry
 * `system.irEnabled` + `system.irRange` (meters). A charged Tech Weapon
 * contributes a transient 30 m source. The LONGEST range across all sources is
 * written onto the actor's prototype token (and live tokens) as a custom
 * DetectionMode so the controlling player can see warm bodies in the dark.
 *
 * IR characteristics:
 *   - Detects only tokens whose actor is character / npc / mook (and, later, a
 *     Tile flagged `flags['cyberpunk-blue'].irDetectable` — see isInfraredDetectable).
 *   - Bypasses darkness and obscuration entirely (never light-gated).
 *   - Attenuates through cover instead of hard-blocking: each wall that blocks
 *     Light or Sight halves the REMAINING range beyond it; a Region with a
 *     light/sight-affecting behavior counts as a single wall.
 *   - IR-only detections are drawn monochrome red (getDetectionFilter).
 *
 * Public API:
 *   INFRARED_ID                                     — detection-mode id (bare key)
 *   DetectionModeInfrared                           — the DetectionMode subclass
 *   isInfraredDetectable(target)                    — target predicate (token/tile)
 *   countInfraredBlockers(origin, dest)             — walls + regions crossed
 *   infraredEffectiveRange(baseMeters, origin, dest)— attenuated range in meters
 *   isWithinInfrared(origin, dest, baseMeters)      — true when dest is in range
 *   getActorInfraredRange(actor)                    — longest IR range (meters)
 *   syncActorInfrared(actor)                        — write IR onto proto + tokens
 *
 * Points passed to the geometry helpers are `{x, y}` in canvas pixels
 * (elevation optional). The helpers are written object-agnostic so a future
 * Tile-detection feature can reuse them unchanged.
 */

import { getPixelsPerMeter } from './targeting.mjs';

/** Detection-mode id. Bare key — systems do NOT auto-prefix (see cyberpunk-blue.mjs). */
export const INFRARED_ID = 'cyberpunkBlueInfrared';

/** Transient IR range (m) granted while a Tech Weapon is charged. */
const CHARGED_TW_IR_RANGE = 30;

/** Actor types a bare IR sense can pick out (warm bodies). */
const IR_ACTOR_TYPES = new Set(['character', 'npc', 'mook']);

// ── Target predicate ────────────────────────────────────────────────────────

/**
 * Is `target` something IR can detect?
 * Accepts a Token placeable now; a Tile placeable is supported for the future
 * "IR-detectable tiles" feature (checks a document flag) so callers need no change.
 * @param {PlaceableObject} target
 * @returns {boolean}
 */
export function isInfraredDetectable(target) {
  if (!target) return false;

  // Future tile support: a Tile flagged irDetectable in its Appearance tab.
  const TileCls = foundry.canvas?.placeables?.Tile;
  if (TileCls && target instanceof TileCls) {
    return !!(target.document?.getFlag?.('cyberpunk-blue', 'irDetectable'));
  }

  return IR_ACTOR_TYPES.has(target.actor?.type);
}

// ── Cover / attenuation geometry ────────────────────────────────────────────

/** Count light/sight-blocking WALLS whose segment the origin→dest ray crosses. */
function countWallBlockers(origin, dest) {
  const NONE = CONST.WALL_SENSE_TYPES.NONE;
  const a = { x: origin.x, y: origin.y };
  const b = { x: dest.x, y: dest.y };
  let count = 0;
  for (const wall of canvas.walls?.placeables ?? []) {
    const d = wall.document;
    if (d.sight === NONE && d.light === NONE) continue; // neither light nor sight blocked
    const [x0, y0, x1, y1] = d.c;
    if (foundry.utils.lineSegmentIntersects(a, b, { x: x0, y: y0 }, { x: x1, y: y1 })) count++;
  }
  return count;
}

/** True when a Region has a non-disabled behavior that affects light/sight. */
function regionBlocksLightOrSight(regionDoc) {
  for (const beh of regionDoc.behaviors ?? []) {
    if (beh.disabled) continue;
    if (beh.type === 'visibility') return true; // darkness / obscuration regions
  }
  return false;
}

/** Count qualifying REGIONS the origin→dest ray enters (one wall each, deduped). */
function countRegionBlockers(origin, dest) {
  const MOVE = CONST.REGION_MOVEMENT_SEGMENT_TYPES?.MOVE ?? 1;
  const aPt = { x: origin.x, y: origin.y, elevation: origin.elevation ?? 0 };
  const tPt = { x: dest.x, y: dest.y, elevation: dest.elevation ?? 0 };
  let count = 0;
  for (const regionDoc of canvas.scene?.regions ?? []) {
    if (!regionBlocksLightOrSight(regionDoc)) continue;
    try {
      const segs = regionDoc.segmentizeMovementPath([aPt, tPt], [{ x: 0, y: 0 }]);
      let hasIn = false;
      let hasOut = false;
      for (const seg of segs) {
        if (seg.type === MOVE) hasIn = true;
        else hasOut = true;
      }
      if (hasIn && hasOut) count++; // boundary crossed → counts as one wall
    } catch {
      // region not ready / missing polygon data
    }
  }
  return count;
}

/**
 * Number of "walls" (light/sight walls + light/sight regions) the straight
 * origin→dest ray crosses. A region counts as at most one wall.
 * @param {{x:number,y:number,elevation?:number}} origin
 * @param {{x:number,y:number,elevation?:number}} dest
 * @returns {number}
 */
export function countInfraredBlockers(origin, dest) {
  if (!canvas?.ready) return 0;
  return countWallBlockers(origin, dest) + countRegionBlockers(origin, dest);
}

/** Region behavior types that make a Region fully opaque to IR (subnet nodes). */
const IR_BLOCKING_REGION_BEHAVIORS = new Set(['accNode', 'netNode']);

/** True when a Region carries a non-disabled subnet-node behavior. */
function regionBlocksInfrared(regionDoc) {
  for (const beh of regionDoc.behaviors ?? []) {
    if (beh.disabled) continue;
    if (IR_BLOCKING_REGION_BEHAVIORS.has(beh.type)) return true;
  }
  return false;
}

/**
 * True when the origin→dest segment touches any subnet-node Region — "NET: ACC Node"
 * (accNode) or "NET: Network Node" (netNode). Such regions HARD-block IR entirely
 * (IR does not work inside a subnet Architecture), overriding the range/attenuation
 * model. Any interior overlap counts: observer inside, target inside, or passing
 * through all block.
 * @param {{x:number,y:number,elevation?:number}} origin
 * @param {{x:number,y:number,elevation?:number}} dest
 * @returns {boolean}
 */
export function isInfraredNetBlocked(origin, dest) {
  const regions = canvas?.scene?.regions;
  if (!regions?.size) return false;
  const MOVE = CONST.REGION_MOVEMENT_SEGMENT_TYPES?.MOVE ?? 1;
  const aPt = { x: origin.x, y: origin.y, elevation: origin.elevation ?? 0 };
  const tPt = { x: dest.x, y: dest.y, elevation: dest.elevation ?? 0 };
  for (const regionDoc of regions) {
    if (!regionBlocksInfrared(regionDoc)) continue;
    try {
      const segs = regionDoc.segmentizeMovementPath([aPt, tPt], [{ x: 0, y: 0 }]);
      if (segs.some((s) => s.type === MOVE)) return true; // any interior overlap → blocked
    } catch {
      // region not ready / missing polygon data
    }
  }
  return false;
}

/**
 * Effective IR range after attenuation: each blocker halves the remaining range.
 * @returns {number} effective range in meters
 */
export function infraredEffectiveRange(baseRangeMeters, origin, dest) {
  const base = Number(baseRangeMeters) || 0;
  if (base <= 0) return 0;
  return base * (0.5 ** countInfraredBlockers(origin, dest));
}

/**
 * Is `dest` within the attacker's effective IR range from `origin`?
 * @returns {boolean}
 */
export function isWithinInfrared(origin, dest, baseRangeMeters) {
  if (isInfraredNetBlocked(origin, dest)) return false; // subnet Architecture blocks IR
  const effMeters = infraredEffectiveRange(baseRangeMeters, origin, dest);
  if (effMeters <= 0) return false;
  const ppm = getPixelsPerMeter();
  if (!ppm) return false;
  const rangePx = effMeters * ppm;
  const dx = dest.x - origin.x;
  const dy = dest.y - origin.y;
  return (dx * dx + dy * dy) <= rangePx * rangePx;
}

// ── Range aggregation ───────────────────────────────────────────────────────

/**
 * Longest IR range (meters) the actor currently projects, across:
 *   - cyberware / gear items with system.irEnabled
 *   - weapon Mods with system.irEnabled that are installed on an owned weapon
 *   - a transient 30 m while any owned Tech Weapon slot is charged
 * @param {Actor} actor
 * @returns {number} 0 when the actor has no IR source
 */
export function getActorInfraredRange(actor) {
  if (!actor?.items) return 0;
  let best = 0;

  for (const item of actor.items) {
    const sys = item.system ?? {};

    // Always-on cyberware / gear sources.
    if ((item.type === 'cyberware' || item.type === 'gear') && sys.irEnabled) {
      best = Math.max(best, Number(sys.irRange) || 0);
    }

    // Weapon mods count only while installed on an owned weapon (active).
    if (item.type === 'mod' && sys.modType === 'weaponMod' && sys.irEnabled && sys.installedOnId) {
      if (actor.items.get(sys.installedOnId)) best = Math.max(best, Number(sys.irRange) || 0);
    }

    // A charged Tech Weapon contributes a transient IR source.
    const weapons = sys.weapons;
    if (Array.isArray(weapons) && weapons.length) {
      for (let wi = 0; wi < weapons.length; wi++) {
        if (item.getFlag?.('cyberpunk-blue', `charged-${wi}`)) {
          best = Math.max(best, CHARGED_TW_IR_RANGE);
          break;
        }
      }
    }
  }

  return best;
}

// ── Token sync ──────────────────────────────────────────────────────────────

/**
 * Build the update that brings `doc`'s detectionModes in line with `range`, with
 * keys prefixed for the target document ('' for a TokenDocument,
 * 'prototypeToken.' for an Actor's prototype). In v14 `detectionModes` is a
 * TypedObjectField keyed by mode id — `{ basicSight: {enabled, range}, ... }` —
 * so we set/remove a single keyed entry rather than rewrite an array. Returns
 * null when nothing needs changing; this diff-guard keeps sync from looping when
 * its own writes re-fire the update hooks.
 * @returns {object|null} an update object, or null for a no-op
 */
function computeInfraredUpdate(doc, range, prefix = '') {
  const current  = doc.detectionModes ?? {};
  const existing = current[INFRARED_ID] ?? null;
  const sightOn  = doc.sight?.enabled ?? false;

  if (range > 0) {
    const same = !!existing && existing.enabled === true && Number(existing.range) === range;
    const needSight = !sightOn;
    if (same && !needSight) return null;
    const update = { [`${prefix}detectionModes.${INFRARED_ID}`]: { enabled: true, range } };
    if (needSight) update[`${prefix}sight.enabled`] = true; // a sense implies vision
    return update;
  }

  // range 0 → remove any IR entry (leave the token's sight setting untouched).
  if (!existing) return null;
  return { [`${prefix}detectionModes.-=${INFRARED_ID}`]: null };
}

/**
 * Write the actor's current IR range onto its prototype token and every live
 * token it has in the CURRENT scene. Idempotent (no-op when nothing changed).
 * Callers MUST gate this on the active GM so only one client writes.
 * @param {Actor} actor
 */
export async function syncActorInfrared(actor) {
  if (!actor?.prototypeToken) return;
  const range = getActorInfraredRange(actor);

  // Prototype token — source of truth for newly-placed tokens.
  const protoUpdate = computeInfraredUpdate(actor.prototypeToken, range, 'prototypeToken.');
  if (protoUpdate) {
    try { await actor.update(protoUpdate); } catch (err) { console.warn('cyberpunk-blue | IR prototype sync failed', err); }
  }

  // Live tokens in the current scene (cross-scene tokens are re-placed manually).
  for (const token of actor.getActiveTokens?.(false, true) ?? []) {
    const update = computeInfraredUpdate(token, range, '');
    if (!update) continue;
    try { await token.update(update); } catch (err) { console.warn('cyberpunk-blue | IR token sync failed', err); }
  }
}

// ── DetectionMode ───────────────────────────────────────────────────────────

const DetectionModeBase = foundry.canvas?.perception?.DetectionMode
  ?? globalThis.DetectionMode; // deprecated global alias fallback

export class DetectionModeInfrared extends DetectionModeBase {
  /** @override Only warm actor tokens (and, later, IR-flagged tiles). */
  _canDetect(visionSource, target) {
    return isInfraredDetectable(target);
  }

  /**
   * @override Attenuated range: each blocking wall/region halves the remaining
   * range. Never hard-blocks (the mode is registered with walls:false, so the
   * base LOS test is skipped and only this range test gates detection).
   */
  _testRange(visionSource, mode, target, test) {
    if (mode.range <= 0) return false;
    const origin = { x: visionSource.x, y: visionSource.y };
    const point = test.point;
    if (isInfraredNetBlocked(origin, point)) return false; // subnet Architecture blocks IR
    const effMeters = infraredEffectiveRange(mode.range, origin, point);
    if (effMeters <= 0) return false;
    const ppm = getPixelsPerMeter();
    if (!ppm) return false;
    const rangePx = effMeters * ppm;
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return (dx * dx + dy * dy) <= (rangePx * rangePx);
  }

  /** @override Monochrome-red recolour for tokens detected only via IR. */
  static getDetectionFilter() {
    if (this._detectionFilter) return this._detectionFilter;
    const filter = new PIXI.ColorMatrixFilter();
    // Map luminance → red channel, zero green/blue: a red-scale silhouette.
    const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
    filter.matrix = [
      lr, lg, lb, 0, 0,
      0,  0,  0,  0, 0,
      0,  0,  0,  0, 0,
      0,  0,  0,  1, 0,
    ];
    this._detectionFilter = filter;
    return filter;
  }
}
