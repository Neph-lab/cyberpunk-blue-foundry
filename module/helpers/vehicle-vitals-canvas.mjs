/**
 * Vehicle vital-area canvas picker.
 *
 * Draws the vehicle's blueprint.vitalAreas as interactive PIXI polygons on
 * `canvas.controls`.  Returns a Promise that resolves with the selected vital
 * area's index (number) when the attacker clicks one, or `null` if they cancel
 * (Escape key or right-click).
 *
 * Usage (from an actor-sheet handler):
 *
 *   const { pickVehicleVitalArea } = await import('./vehicle-vitals-canvas.mjs');
 *   const vitalIndex = await pickVehicleVitalArea(vehicleTokenDocument);
 *   if (vitalIndex !== null) {
 *     // store vitalIndex as a flag on the weapon item
 *   }
 *
 * Coordinate system: blueprint coordinates are token-local pixels (origin =
 * token top-left corner).  To transform to canvas space:
 *   canvasX = tokenDoc.x + areaOffset.x + shapePoint.x
 *   canvasY = tokenDoc.y + areaOffset.y + shapePoint.y
 *
 * Supported shape types: 'polygon' (points flat array), 'rectangle', 'circle'.
 * Unknown shape types are drawn as a 16×16 square at the offset origin.
 */

const FLAG_SCOPE        = 'cyberpunk-blue';
const FILL_NORMAL       = 0x22ccff;
const FILL_HOVER        = 0xffcc22;
const FILL_ALPHA_NORMAL = 0.30;
const FILL_ALPHA_HOVER  = 0.55;
const STROKE_COLOR      = 0xffffff;
const STROKE_ALPHA      = 0.70;
const STROKE_WIDTH      = 2;

/** Singleton state — only one picker active at a time. */
let _activePickerCleanup = null;

/**
 * Open the vital area picker for a vehicle token.
 *
 * @param {TokenDocument} vehicleTokenDoc
 * @returns {Promise<number|null>}  Index into blueprint.vitalAreas, or null on cancel.
 */
export function pickVehicleVitalArea(vehicleTokenDoc) {
  // If another picker is already open, cancel it.
  if (_activePickerCleanup) {
    _activePickerCleanup(null);
    _activePickerCleanup = null;
  }

  return new Promise((resolve) => {
    const actor       = vehicleTokenDoc?.actor;
    const vitalAreas  = actor?.system?.blueprint?.vitalAreas ?? [];

    if (vitalAreas.length === 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.VehicleVitals.NoAreas'));
      resolve(null);
      return;
    }

    if (!canvas?.controls) {
      resolve(null);
      return;
    }

    const graphics = new PIXI.Graphics();
    canvas.controls.addChild(graphics);

    // Build hit-area descriptors (used for hover + click testing).
    const hitAreas = vitalAreas.map((area, idx) => {
      const ox = (vehicleTokenDoc.x ?? 0) + (area.offset?.x ?? 0);
      const oy = (vehicleTokenDoc.y ?? 0) + (area.offset?.y ?? 0);
      return { idx, area, ox, oy };
    });

    let hoveredIdx = -1;

    function drawAll(hIdx) {
      graphics.clear();
      for (const { idx, area, ox, oy } of hitAreas) {
        const isHover = idx === hIdx;
        const fill  = isHover ? FILL_HOVER  : FILL_NORMAL;
        const alpha = isHover ? FILL_ALPHA_HOVER : FILL_ALPHA_NORMAL;
        _drawAreaShape(graphics, area.shape, ox, oy, fill, alpha);
      }
    }

    drawAll(-1);

    // ── Event handlers ──────────────────────────────────────────────────────

    function onMouseMove(event) {
      const pos   = event.getLocalPosition(canvas.controls);
      const newIdx = _hitTest(hitAreas, pos.x, pos.y);
      if (newIdx !== hoveredIdx) {
        hoveredIdx = newIdx;
        drawAll(hoveredIdx);
      }
    }

    function onLeftClick(event) {
      const pos = event.getLocalPosition(canvas.controls);
      const idx = _hitTest(hitAreas, pos.x, pos.y);
      if (idx >= 0) {
        cleanup(idx);
      }
    }

    function onRightClick() {
      cleanup(null);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        cleanup(null);
      }
    }

    // ── Attach / detach ─────────────────────────────────────────────────────

    canvas.app.renderer.on('mousemove', onMouseMove);
    canvas.controls.on('click',         onLeftClick);
    canvas.controls.on('rightdown',     onRightClick);
    window.addEventListener('keydown',  onKeydown, { once: false });

    // Store cleanup so another call can cancel us.
    _activePickerCleanup = cleanup;

    function cleanup(result) {
      canvas.app.renderer.off('mousemove', onMouseMove);
      canvas.controls.off('click',         onLeftClick);
      canvas.controls.off('rightdown',     onRightClick);
      window.removeEventListener('keydown', onKeydown);

      try { canvas.controls.removeChild(graphics); } catch { /* already removed */ }
      try { graphics.destroy();                    } catch { /* already destroyed */ }

      _activePickerCleanup = null;
      resolve(result);
    }
  });
}

// ── PIXI shape drawing ────────────────────────────────────────────────────────

function _drawAreaShape(g, shape, ox, oy, fillColor, fillAlpha) {
  g.lineStyle(STROKE_WIDTH, STROKE_COLOR, STROKE_ALPHA);
  g.beginFill(fillColor, fillAlpha);

  const type = shape?.type ?? '';

  if (type === 'polygon') {
    const pts = shape.points ?? [];
    if (pts.length < 4) {
      _drawFallbackSquare(g, ox, oy);
    } else {
      g.moveTo(ox + pts[0], oy + pts[1]);
      for (let i = 2; i < pts.length; i += 2) {
        g.lineTo(ox + pts[i], oy + pts[i + 1]);
      }
      g.closePath();
    }
  } else if (type === 'rectangle') {
    g.drawRect(ox + (shape.x ?? 0), oy + (shape.y ?? 0), shape.width ?? 32, shape.height ?? 32);
  } else if (type === 'circle') {
    g.drawCircle(ox + (shape.x ?? 0), oy + (shape.y ?? 0), shape.radius ?? 16);
  } else {
    _drawFallbackSquare(g, ox, oy);
  }

  g.endFill();
}

function _drawFallbackSquare(g, ox, oy) {
  g.drawRect(ox - 8, oy - 8, 16, 16);
}

// ── Point-in-shape hit testing ────────────────────────────────────────────────

function _hitTest(hitAreas, px, py) {
  for (const { idx, area, ox, oy } of hitAreas) {
    if (_pointInShape(area.shape, ox, oy, px, py)) return idx;
  }
  return -1;
}

function _pointInShape(shape, ox, oy, px, py) {
  const type = shape?.type ?? '';
  const lx = px - ox;
  const ly = py - oy;

  if (type === 'polygon') {
    const pts = shape.points ?? [];
    return _pointInPolygon(pts, lx, ly);
  }
  if (type === 'rectangle') {
    const rx = shape.x ?? 0, ry = shape.y ?? 0;
    const rw = shape.width ?? 32, rh = shape.height ?? 32;
    return lx >= rx && lx <= rx + rw && ly >= ry && ly <= ry + rh;
  }
  if (type === 'circle') {
    const cx = shape.x ?? 0, cy = shape.y ?? 0, r = shape.radius ?? 16;
    return (lx - cx) ** 2 + (ly - cy) ** 2 <= r ** 2;
  }
  // Fallback: 16×16 square at (ox, oy)
  return lx >= -8 && lx <= 8 && ly >= -8 && ly <= 8;
}

/** Ray-casting algorithm for point-in-polygon. pts = [x0,y0,x1,y1,...] */
function _pointInPolygon(pts, px, py) {
  const n = pts.length;
  if (n < 4) return false;
  let inside = false;
  let j = n - 2;
  for (let i = 0; i < n; i += 2) {
    const xi = pts[i], yi = pts[i + 1];
    const xj = pts[j], yj = pts[j + 1];
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}
