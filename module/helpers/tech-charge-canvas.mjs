/**
 * Tech Weapon charge canvas helpers.
 *
 * While a Tech Weapon is charged the system highlights all tokens within 15 m
 * of the armed actor, regardless of walls or elevation (thin-cover vision).
 * The highlights are drawn on canvas.controls as PIXI.Graphics objects so they
 * sit above the token layer and are removed cleanly when the charge ends.
 *
 * clearTechChargeHighlights() — remove every highlight graphic added by us.
 * refreshTechChargeHighlights() — rebuild all highlights from current charge state.
 */

const CHARGE_HIGHLIGHT_KEY = '_twChargeHighlight';
const CHARGE_RANGE_METERS  = 15;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMetersPerPixel() {
  if (!canvas?.scene || !canvas?.grid) return null;
  const gridSize     = canvas.grid.size;
  const gridDistance = canvas.scene.grid?.distance ?? 1;
  const gridUnits    = (canvas.scene.grid?.units ?? '').toLowerCase().trim();
  const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
  return metersPerUnit / gridSize;
}

/** Distance in canvas-pixels between two token centers. */
function tokenDistancePx(tokA, tokB) {
  const ax = tokA.center.x; const ay = tokA.center.y;
  const bx = tokB.center.x; const by = tokB.center.y;
  return Math.hypot(ax - bx, ay - by);
}

/** Return true when at least one of this actor's items has a charged TW weapon slot. */
function actorHasCharge(actor) {
  for (const item of actor.items) {
    const weapons = item.system?.weapons;
    if (!weapons?.length) continue;
    for (let wi = 0; wi < weapons.length; wi++) {
      if (item.getFlag?.('cyberpunk-blue', `charged-${wi}`)) return true;
    }
  }
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Remove every TW-charge highlight graphic from canvas.controls. */
export function clearTechChargeHighlights() {
  if (!canvas?.controls) return;
  const toRemove = canvas.controls.children.filter((c) => c[CHARGE_HIGHLIGHT_KEY]);
  for (const g of toRemove) {
    canvas.controls.removeChild(g);
    g.destroy();
  }
}

/**
 * Rebuild all TW-charge highlights.
 * For each actor with at least one charged TW, highlight every other token
 * within CHARGE_RANGE_METERS — regardless of walls (thin-cover vision).
 */
export function refreshTechChargeHighlights() {
  clearTechChargeHighlights();

  if (!canvas?.tokens?.placeables || !canvas?.controls) return;

  const mpp = getMetersPerPixel();
  if (!mpp) return;
  const rangePx = CHARGE_RANGE_METERS / mpp;

  for (const sourceToken of canvas.tokens.placeables) {
    const actor = sourceToken.actor;
    if (!actor || !actorHasCharge(actor)) continue;

    // Highlight all other tokens within range.
    for (const target of canvas.tokens.placeables) {
      if (target === sourceToken) continue;
      const dist = tokenDistancePx(sourceToken, target);
      if (dist > rangePx) continue;

      // Draw a pulsing cyan outline around the target token.
      const g = new PIXI.Graphics();
      g[CHARGE_HIGHLIGHT_KEY] = true;

      const cx = target.center.x;
      const cy = target.center.y;
      const r  = Math.max(target.w, target.h) / 2 + 6;

      g.lineStyle(3, 0x00d4ff, 0.85);
      g.drawCircle(cx, cy, r);
      g.lineStyle(1, 0xffffff, 0.5);
      g.drawCircle(cx, cy, r + 4);

      canvas.controls.addChild(g);
    }
  }
}
