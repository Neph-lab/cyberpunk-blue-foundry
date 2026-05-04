/**
 * Ricochet canvas overlay for Power Weapons.
 *
 * Provides visual placement of a ricochet point on the canvas:
 *  - Draw a green line: attacker token → ricochet point → target token.
 *  - Segment 2 turns red if the target is more than 4m from the ricochet point.
 *  - The ricochet point is stored as an actor flag: 'ricochetPoint' → { x, y }
 *    (canvas pixel coordinates in the stage coordinate system).
 */

/** Singleton PIXI.Graphics used for the persistent ricochet line visualisation. */
let _lineGraphics = null;

function getPixelsPerMeter() {
  const gridSize = canvas.grid.size;
  const gridDistance = canvas.scene.grid?.distance ?? 1;
  const gridUnits = (canvas.scene.grid?.units ?? '').toLowerCase().trim();
  const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
  return gridSize / metersPerUnit;
}

function getTokenCenter(tokenDoc) {
  const gridSize = canvas.grid.size;
  return {
    x: tokenDoc.x + (tokenDoc.width * gridSize) / 2,
    y: tokenDoc.y + (tokenDoc.height * gridSize) / 2,
  };
}

/**
 * Remove the current ricochet line graphic from the canvas.
 */
export function clearRicochetLine() {
  if (_lineGraphics) {
    try { canvas.controls?.removeChild(_lineGraphics); } catch { /* already removed */ }
    try { _lineGraphics.destroy(); } catch { /* already destroyed */ }
    _lineGraphics = null;
  }
}

/**
 * Redraw all ricochet lines for actors that have a ricochetPoint flag set.
 * Call this whenever tokens move, targets change, or the canvas is refreshed.
 */
export function refreshAllRicochetLines() {
  clearRicochetLine();

  if (!canvas?.controls || !canvas?.tokens) return;

  const ppm = getPixelsPerMeter();
  const maxRicochetPx = 4 * ppm; // 4 metres in pixels

  // Current user's target token centre (null if no target)
  const targetToken = game.user.targets.first() ?? null;
  const targetCenter = targetToken ? getTokenCenter(targetToken.document) : null;

  /** @type {Array<{from:{x,y}, via:{x,y}, to:{x,y}|null, inRange:boolean}>} */
  const segments = [];

  for (const tokenPl of canvas.tokens.placeables) {
    const actor = tokenPl.actor;
    if (!actor) continue;
    const rp = actor.getFlag('cyberpunk-blue', 'ricochetPoint');
    if (!rp) continue;

    const from = getTokenCenter(tokenPl.document);
    const via = { x: rp.x, y: rp.y };
    let inRange = false;
    if (targetCenter) {
      const dist = Math.hypot(via.x - targetCenter.x, via.y - targetCenter.y);
      inRange = dist <= maxRicochetPx;
    }
    segments.push({ from, via, to: targetCenter, inRange });
  }

  if (segments.length === 0) return;

  const g = new PIXI.Graphics();
  for (const { from, via, to, inRange } of segments) {
    // Segment 1: attacker → ricochet point (always green)
    g.lineStyle(3, 0x00ff44, 0.85);
    g.moveTo(from.x, from.y);
    g.lineTo(via.x, via.y);

    // X marker at the ricochet point
    const r = 8;
    g.lineStyle(3, 0x00ff44, 0.85);
    g.moveTo(via.x - r, via.y - r); g.lineTo(via.x + r, via.y + r);
    g.moveTo(via.x + r, via.y - r); g.lineTo(via.x - r, via.y + r);

    // Segment 2: ricochet point → target (green if in range, red otherwise)
    if (to) {
      g.lineStyle(3, inRange ? 0x00ff44 : 0xff2222, 0.85);
      g.moveTo(via.x, via.y);
      g.lineTo(to.x, to.y);
    }
  }

  canvas.controls.addChild(g);
  _lineGraphics = g;
}

/**
 * Enter ricochet-placement mode: show an info notification and wait for the
 * user to left-click a point on the canvas.  Right-click cancels.
 *
 * @param {Actor} actor  The actor whose ricochetPoint flag will be set.
 * @returns {Promise<{x:number,y:number}|null>}  The chosen point, or null if cancelled.
 */
export async function startRicochetPlacement(actor) {
  ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.RicochetClickToPlace'));

  return new Promise((resolve) => {
    const overlay = new PIXI.Graphics();
    overlay.eventMode = 'static';
    overlay.hitArea = new PIXI.Rectangle(-1e6, -1e6, 2e6, 2e6);
    canvas.stage.addChild(overlay);

    async function onDown(event) {
      if (event.button === 0) {
        const pos = event.getLocalPosition(canvas.stage);
        cleanup();
        await actor.setFlag('cyberpunk-blue', 'ricochetPoint', { x: pos.x, y: pos.y });
        refreshAllRicochetLines();
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-circle-dot"></i> ${game.i18n.format('CYBER_BLUE.Combat.RicochetArmed', { name: actor.name })}</p></div>`,
        });
        resolve({ x: pos.x, y: pos.y });
      } else if (event.button === 2) {
        cleanup();
        resolve(null);
      }
    }

    function cleanup() {
      overlay.off('pointerdown', onDown);
      canvas.stage.removeChild(overlay);
      overlay.destroy();
    }

    overlay.on('pointerdown', onDown);
  });
}

/**
 * Clear the actor's ricochet point flag and remove the canvas visualisation.
 *
 * @param {Actor} actor
 */
export async function clearRicochetPoint(actor) {
  await actor.unsetFlag('cyberpunk-blue', 'ricochetPoint');
  refreshAllRicochetLines();
}
