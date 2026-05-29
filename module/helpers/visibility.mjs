/**
 * Visibility penalty subsystem.
 *
 * Every attack gets a penalty = worst of two independent components:
 *   Darkness    — evaluated at the target point.
 *   Obscuration — evaluated along the attacker→target line.
 *
 * Levels: NONE(0) | DIM(1) | DARK(2) | NOT_VISIBLE(3)
 * NOT_VISIBLE arises only from a region's no-visibility core. Ambient lighting
 * caps at DARK and is always attackable.
 *
 * Two-tier bypass per component (read from attacker's active AEs):
 *   ignoreDarknessPenalty / ignoreObscurationPenalty — cancels −2/−4 but NOT NOT_VISIBLE.
 *   bypassDarkness / bypassObscuration               — clears component entirely incl. NOT_VISIBLE.
 */

import { getActiveAEFlag } from './effects.mjs';

export const VIS = Object.freeze({ NONE: 0, DIM: 1, DARK: 2, NOT_VISIBLE: 3 });

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Build an ElevatedPoint {x, y, elevation} from a TokenDocument centre. */
function tokenPoint(tokenDoc) {
  const gridSize = canvas.grid.size;
  return {
    x: tokenDoc.x + (tokenDoc.width  * gridSize) / 2,
    y: tokenDoc.y + (tokenDoc.height * gridSize) / 2,
    elevation: tokenDoc.elevation ?? 0,
  };
}

/**
 * Determine lighting level at a point from ambient darkness and point/area sources.
 * Returns VIS.NONE, VIS.DIM, or VIS.DARK (never NOT_VISIBLE).
 *
 * Algorithm:
 *  1. Inside a darkness source → DARK
 *  2. Inside a light source's bright radius → NONE
 *  3. Inside any light source's dim zone (or scene global light) → DIM
 *  4. Fall back to scene ambient darkness level vs thresholds.
 */
function lightingBandAtPoint(point) {
  const ce = canvas.effects;

  if (ce.testInsideDarkness(point)) return VIS.DARK;

  let brightLit = false;
  let dimLit    = false;

  for (const src of ce.lightSources) {
    try {
      if (!src.active)   continue;
      if (!src.document) continue; // skip GlobalLightSource (no backing document)
      if (!src.testPoint(point)) continue; // wall- and elevation-aware
      dimLit = true;
      // bright radius in pixels: bright (scene-distance units) × px-per-unit
      const brightPx = (src.data?.bright ?? 0) * canvas.dimensions.distancePixels;
      if (brightPx > 0) {
        const dx = point.x - src.x;
        const dy = point.y - src.y;
        if (Math.hypot(dx, dy) <= brightPx) brightLit = true;
      }
    } catch {
      // malformed source — skip
    }
  }

  if (brightLit) return VIS.NONE;

  // testInsideLight also covers global ambient light
  if (dimLit || ce.testInsideLight(point)) return VIS.DIM;

  const dimThreshold  = game.settings.get('cyberpunk-blue', 'visibilityDimThreshold')  ?? 0.25;
  const darkThreshold = game.settings.get('cyberpunk-blue', 'visibilityDarkThreshold') ?? 0.50;

  const ambient = ce.getDarknessLevel(point); // folds scene darkness + AdjustDarknessLevel regions
  if (ambient <= dimThreshold)  return VIS.NONE;
  if (ambient <= darkThreshold) return VIS.DIM;
  return VIS.DARK;
}

/**
 * Worst VIS level at `point` from all active visibility regions of the given kind
 * that contain the point (calls `behavior.system.classifyPoint`).
 */
function regionBandAtPoint(point, kind) {
  let worst = VIS.NONE;
  for (const regionDoc of canvas.scene?.regions ?? []) {
    for (const beh of regionDoc.behaviors) {
      if (beh.disabled) continue;
      if (beh.type !== 'visibility') continue;
      if (beh.system?.kind !== kind) continue;
      try {
        const level = beh.system.classifyPoint(point);
        if (level > worst) worst = level;
      } catch {
        // region not yet loaded or missing polygon data
      }
    }
  }
  return worst;
}

/** Darkness component at targetPt: max(ambient lighting, darkness-region bands). */
function darknessComponent(targetPt) {
  return Math.max(lightingBandAtPoint(targetPt), regionBandAtPoint(targetPt, 'darkness'));
}

/**
 * Obscuration component along attacker→target LOS.
 * Uses segmentizeMovementPath to find the portions of the line that are inside
 * each active obscuration-kind visibility region, then samples those segments.
 */
function obscurationComponent(aPt, tPt) {
  const MOVE_SEGMENT = CONST.REGION_MOVEMENT_SEGMENT_TYPES?.MOVE ?? 1;

  let worst = VIS.NONE;
  for (const regionDoc of canvas.scene?.regions ?? []) {
    for (const beh of regionDoc.behaviors) {
      if (beh.disabled) continue;
      if (beh.type !== 'visibility') continue;
      if (beh.system?.kind !== 'obscuration') continue;
      try {
        const segs = regionDoc.segmentizeMovementPath([aPt, tPt], [{ x: 0, y: 0 }]);
        for (const seg of segs) {
          if (seg.type !== MOVE_SEGMENT) continue;
          // Sample 5 points along the inside-region segment
          for (let t = 0; t <= 1; t += 0.25) {
            const sample = {
              x:         seg.from.x + (seg.to.x - seg.from.x) * t,
              y:         seg.from.y + (seg.to.y - seg.from.y) * t,
              elevation: seg.from.elevation ?? aPt.elevation,
            };
            const level = beh.system.classifyPoint(sample);
            if (level > worst) worst = level;
          }
        }
      } catch {
        // region not ready
      }
    }
  }
  return worst;
}

/**
 * Apply attacker AE bypasses to a raw component level.
 * @param {number}  raw     VIS level before bypass
 * @param {string}  kind    'Darkness' or 'Obscuration' (matches AE flag suffix)
 * @param {Actor}   attacker
 * @returns {number} effective VIS level
 */
function applyBypass(raw, kind, attacker) {
  if (getActiveAEFlag(attacker, `bypass${kind}`))              return VIS.NONE; // full bypass
  if (raw < VIS.NOT_VISIBLE && getActiveAEFlag(attacker, `ignore${kind}Penalty`)) return VIS.NONE; // penalty bypass
  return raw;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute the visibility penalty for an attack.
 *
 * @param {Actor}         attacker
 * @param {Token}         attackerToken   Token canvas object (not document)
 * @param {Token|null}    targetToken     Token canvas object; omit for point-target
 * @param {{x,y,elevation}|null} targetPtOverride  Pass for AoE aim-point tests (pixels)
 *
 * @returns {{
 *   blocked: boolean,
 *   penalty: number,
 *   darkEff: number,
 *   obscEff: number,
 *   notes:   string[],
 * }}
 */
export function computeVisibilityPenalty(attacker, attackerToken, targetToken, targetPtOverride = null) {
  if (!game.settings.get('cyberpunk-blue', 'visibilityEnabled')) {
    return { blocked: false, penalty: 0, darkEff: VIS.NONE, obscEff: VIS.NONE, notes: [] };
  }

  if (!attackerToken) return { blocked: false, penalty: 0, darkEff: VIS.NONE, obscEff: VIS.NONE, notes: [] };

  const aPt = tokenPoint(attackerToken.document);
  const tPt = targetPtOverride ?? (targetToken ? tokenPoint(targetToken.document) : null);
  if (!tPt) return { blocked: false, penalty: 0, darkEff: VIS.NONE, obscEff: VIS.NONE, notes: [] };

  const darkRaw = darknessComponent(tPt);
  const obscRaw = obscurationComponent(aPt, tPt);

  const darkEff = applyBypass(darkRaw, 'Darkness',    attacker);
  const obscEff = applyBypass(obscRaw, 'Obscuration',  attacker);

  const notes = [];

  if (darkEff === VIS.NOT_VISIBLE || obscEff === VIS.NOT_VISIBLE) {
    if (darkEff === VIS.NOT_VISIBLE) notes.push(game.i18n.localize('CYBER_BLUE.Visibility.NotVisibleDark'));
    if (obscEff === VIS.NOT_VISIBLE) notes.push(game.i18n.localize('CYBER_BLUE.Visibility.NotVisibleObscured'));
    return { blocked: true, penalty: 0, darkEff, obscEff, notes };
  }

  const level = Math.max(darkEff, obscEff);
  const dimPenalty  = game.settings.get('cyberpunk-blue', 'visibilityDimPenalty')  ?? -2;
  const darkPenalty = game.settings.get('cyberpunk-blue', 'visibilityDarkPenalty') ?? -4;
  const penalty = level === VIS.DIM ? dimPenalty : level === VIS.DARK ? darkPenalty : 0;

  if (penalty !== 0) {
    notes.push(game.i18n.format('CYBER_BLUE.Visibility.PenaltyNote', { n: penalty }));
  }

  return { blocked: false, penalty, darkEff, obscEff, notes };
}

/** Helper used by Phase 4 explosion residue: build an ElevatedPoint from pixel coords. */
export function makeElevatedPoint(x, y, elevation = 0) {
  return { x, y, elevation };
}
