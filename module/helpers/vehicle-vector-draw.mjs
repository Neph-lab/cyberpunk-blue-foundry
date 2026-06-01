/**
 * Vehicle vector-draw declaration overlay.
 *
 * Lets a driver draw a Sharp-Turn path on the canvas as two segments:
 *   1. a forward run along the vehicle's current heading (sets `forward1`), then
 *   2. a turn + run (sets the signed `turnAngle`, quantised to 15°, and `forward2`).
 *
 * The result is stored RELATIVE — "forward X, turn Y°, forward Z" — not as
 * absolute scene coordinates, so on execution it replays from the vehicle's
 * actual position/heading at that time (see `_executeSharpTurn`).
 *
 * Interaction:
 *   • A faint ray shows the current heading and the maximum forward extent
 *     (= current speed in grid spaces).
 *   • Move the mouse, then LEFT-CLICK once to lock the turn point (forward1).
 *   • Move again to aim the turn, LEFT-CLICK again to lock the turn + run.
 *   • RIGHT-CLICK or ESC cancels.
 *
 * Mirrors the PIXI overlay pattern in ricochet-canvas.mjs (stage overlay for
 * input, canvas.controls for the visualisation, world coords via
 * getLocalPosition(canvas.stage)).
 */

import { forwardUnit, turnAngleBetween, quantiseHeading } from './vehicle-vector.mjs';

const GREEN = 0x00ff44;
const AMBER = 0xffb000;
const RED   = 0xff2222;
const FAINT = 0x88aacc;

function _tokenCentre(tokenDoc) {
  const gridSize = canvas.grid.size;
  return {
    x: (tokenDoc.x ?? 0) + ((tokenDoc.width ?? 1) * gridSize) / 2,
    y: (tokenDoc.y ?? 0) + ((tokenDoc.height ?? 1) * gridSize) / 2,
  };
}

/**
 * Enter vector-draw mode for a vehicle token and resolve with the drawn,
 * relative path or null if cancelled.
 *
 * @param {TokenDocument} vehicleToken
 * @param {object} [opts]
 * @param {number} [opts.maxSpaces]  Max total forward grid spaces (default =
 *   |current speed| of the vehicle actor, min 1).
 * @returns {Promise<{forward1:number, turnAngle:number, forward2:number}|null>}
 *   forward1/forward2 in grid spaces; turnAngle signed degrees (+ = right).
 */
export async function startVectorDraw(vehicleToken, opts = {}) {
  if (!canvas?.ready || !vehicleToken) return null;

  const gridSize = canvas.grid.size;
  const speed = Math.abs(vehicleToken.actor?.system?.stats?.currentSpeed?.value ?? 0);
  const maxSpaces = Math.max(1, opts.maxSpaces ?? speed);
  const maxPx = maxSpaces * gridSize;

  const centre = _tokenCentre(vehicleToken);
  const heading = vehicleToken.rotation ?? 0;
  const u = forwardUnit(heading); // nose-forward unit vector

  ui.notifications?.info(game.i18n?.localize?.('CYBER_BLUE.VehicleCombat.VectorDrawHint')
    ?? 'Click to set the turn point, click again to set the turn. Right-click / Esc to cancel.');

  return new Promise((resolve) => {
    const g = new PIXI.Graphics();
    const label = new PIXI.Text('', {
      fontFamily: 'Signika, sans-serif', fontSize: 14, fill: '#ffffff',
      stroke: '#000000', strokeThickness: 3, align: 'left',
    });
    canvas.controls.addChild(g);
    canvas.controls.addChild(label);

    const overlay = new PIXI.Graphics();
    overlay.eventMode = 'static';
    overlay.hitArea = new PIXI.Rectangle(-1e6, -1e6, 2e6, 2e6);
    canvas.stage.addChild(overlay);

    // Drawing state
    let phase = 1;            // 1 = setting forward1, 2 = setting turn + forward2
    let forward1 = 0;         // grid spaces (locked after click 1)
    let turnPoint = { ...centre };

    const cleanup = () => {
      overlay.off('pointerdown', onDown);
      overlay.off('pointermove', onMove);
      window.removeEventListener('keydown', onKey, true);
      try { canvas.stage.removeChild(overlay); overlay.destroy(); } catch { /* noop */ }
      try { canvas.controls.removeChild(g); g.destroy(); } catch { /* noop */ }
      try { canvas.controls.removeChild(label); label.destroy(); } catch { /* noop */ }
    };

    // Project a world point onto the forward ray; returns clamped distance (px).
    const projectForward = (p) => {
      const t = (p.x - centre.x) * u.x + (p.y - centre.y) * u.y;
      return Math.max(0, Math.min(maxPx, t));
    };

    const drawRay = () => {
      g.lineStyle(2, FAINT, 0.5);
      g.moveTo(centre.x, centre.y);
      g.lineTo(centre.x + u.x * maxPx, centre.y + u.y * maxPx);
    };

    const xMarker = (p, colour) => {
      const r = 7;
      g.lineStyle(3, colour, 0.95);
      g.moveTo(p.x - r, p.y - r); g.lineTo(p.x + r, p.y + r);
      g.moveTo(p.x + r, p.y - r); g.lineTo(p.x - r, p.y + r);
    };

    const onMove = (event) => {
      const p = event.getLocalPosition(canvas.stage);
      g.clear();
      drawRay();

      if (phase === 1) {
        const t = projectForward(p);
        turnPoint = { x: centre.x + u.x * t, y: centre.y + u.y * t };
        forward1 = t / gridSize;
        // seg1
        g.lineStyle(4, GREEN, 0.9);
        g.moveTo(centre.x, centre.y);
        g.lineTo(turnPoint.x, turnPoint.y);
        xMarker(turnPoint, GREEN);
        label.text = `Forward ${forward1.toFixed(1)}`;
        label.position.set(turnPoint.x + 10, turnPoint.y + 10);
      } else {
        // seg1 (locked, green)
        g.lineStyle(4, GREEN, 0.9);
        g.moveTo(centre.x, centre.y);
        g.lineTo(turnPoint.x, turnPoint.y);
        xMarker(turnPoint, GREEN);

        // seg2: snapped turn angle + clamped length, drawn along the snapped heading
        const seg = { x: p.x - turnPoint.x, y: p.y - turnPoint.y };
        const rawAngle = turnAngleBetween(u, seg);
        const turnAngle = Math.round(rawAngle / 15) * 15;
        const remainingPx = Math.max(0, maxPx - forward1 * gridSize);
        const len = Math.min(Math.hypot(seg.x, seg.y), remainingPx);
        const newU = forwardUnit(heading + turnAngle);
        const end = { x: turnPoint.x + newU.x * len, y: turnPoint.y + newU.y * len };
        const forward2 = len / gridSize;
        const overBudget = (Math.hypot(seg.x, seg.y) > remainingPx + 0.5);

        g.lineStyle(4, overBudget ? AMBER : GREEN, 0.9);
        g.moveTo(turnPoint.x, turnPoint.y);
        g.lineTo(end.x, end.y);
        xMarker(end, overBudget ? AMBER : GREEN);

        label.text = `Forward ${forward1.toFixed(1)} → turn ${Math.abs(turnAngle)}° `
          + `${turnAngle >= 0 ? 'right' : 'left'} → forward ${forward2.toFixed(1)}`
          + (overBudget ? '  (capped by speed)' : '');
        label.position.set(end.x + 10, end.y + 10);
      }
    };

    const commit = (p) => {
      const seg = { x: p.x - turnPoint.x, y: p.y - turnPoint.y };
      const rawAngle = turnAngleBetween(u, seg);
      const turnAngle = Math.round(rawAngle / 15) * 15;
      const remainingPx = Math.max(0, maxPx - forward1 * gridSize);
      const len = Math.min(Math.hypot(seg.x, seg.y), remainingPx);
      const forward2 = len / gridSize;
      cleanup();
      resolve({
        forward1: Math.round(forward1 * 10) / 10,
        turnAngle,
        forward2: Math.round(forward2 * 10) / 10,
      });
    };

    const onDown = (event) => {
      if (event.button === 2) { cleanup(); resolve(null); return; }
      if (event.button !== 0) return;
      const p = event.getLocalPosition(canvas.stage);
      if (phase === 1) {
        forward1 = projectForward(p) / gridSize;
        turnPoint = { x: centre.x + u.x * forward1 * gridSize, y: centre.y + u.y * forward1 * gridSize };
        phase = 2;
        onMove(event); // redraw in phase 2
      } else {
        commit(p);
      }
    };

    const onKey = (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cleanup(); resolve(null); }
    };

    overlay.on('pointerdown', onDown);
    overlay.on('pointermove', onMove);
    window.addEventListener('keydown', onKey, true);

    // Initial draw (ray only).
    g.clear();
    drawRay();
  });
}
