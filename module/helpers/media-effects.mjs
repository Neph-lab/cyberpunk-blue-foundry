/**
 * Canvas video effects for area attacks.
 *
 * Renders webm media on the canvas above the tokens:
 *   - One-shot explosion / cone videos that play once and self-remove.
 *   - Looping smoke / cloud videos bound to a persistent Region (see region rendering).
 *
 * All effects can be tinted (multiply) and are clipped by walls using a
 * ClockwiseSweepPolygon computed from the effect origin.
 */

const EFFECTS_PATH = 'systems/cyberpunk-blue/assets/effects';
export const DEFAULT_EXPLOSION_MEDIA = `${EFFECTS_PATH}/explosion.webm`;
export const DEFAULT_SMOKE_MEDIA = `${EFFECTS_PATH}/smoke.webm`;

/** Resolve Foundry's loadTexture across possible namespaces. */
function _loadTexture(src) {
  const fn = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
  return fn(src);
}

function _SpriteMeshClass() {
  return foundry.canvas?.containers?.SpriteMesh ?? globalThis.SpriteMesh ?? null;
}

function _ColorClass() {
  return foundry.utils?.Color ?? globalThis.Color ?? null;
}

/**
 * Compute a wall-clipped polygon from an origin, optionally limited to a cone.
 *
 * @param {{x:number,y:number}} origin     Pixel origin of the effect.
 * @param {number} radiusPx                Maximum reach in pixels.
 * @param {object} [opts]
 * @param {number} [opts.angleDeg=360]     Cone width in degrees (360 = full circle).
 * @param {number} [opts.directionRad=0]   Cone centre direction (screen radians, 0 = +x).
 * @returns {PIXI.Polygon|null}
 */
export function computeWallClip(origin, radiusPx, { angleDeg = 360, directionRad = 0 } = {}) {
  try {
    const backend = CONFIG.Canvas?.polygonBackends?.move
      ?? CONFIG.Canvas?.polygonBackends?.sight
      ?? foundry.canvas?.geometry?.ClockwiseSweepPolygon;
    if (!backend) return null;
    const cfg = { type: 'move', radius: radiusPx };
    if (angleDeg > 0 && angleDeg < 360) {
      cfg.angle = angleDeg;
      // LimitedAnglePolygon centres emission on (rotation + 90)°; convert our
      // screen-radian direction accordingly.
      cfg.rotation = (directionRad * 180 / Math.PI) - 90;
    }
    return backend.create(origin, cfg);
  } catch (err) {
    console.warn('cyberpunk-blue | computeWallClip failed', err);
    return null;
  }
}

/** Build a PIXI.Graphics mask from a polygon (or null for no mask). */
function _buildMask(polygon) {
  if (!polygon?.points || polygon.points.length < 6) return null;
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff, 1);
  g.drawPolygon(polygon.points);
  g.endFill();
  return g;
}

/** Start playback on the video backing a texture. Returns the HTMLVideoElement or null. */
function _startVideo(texture, { loop }) {
  try {
    const video = game.video?.getVideoSource?.(texture);
    if (!video) return null;
    video.loop = loop;
    video.currentTime = 0;
    game.video.play(video, { volume: 0, loop });
    return video;
  } catch {
    return null;
  }
}

function _applyTint(sprite, tint) {
  if (!tint) return;
  try {
    const Color = _ColorClass();
    sprite.tint = Color ? Color.from(tint) : tint;
  } catch { /* leave untinted */ }
}

/**
 * Play a one-shot media effect on the canvas (explosion or cone), clipped by walls.
 * The sprite self-removes when the video ends (or after a fallback timeout).
 *
 * @param {string} src                     Video path.
 * @param {object} opts
 * @param {{x:number,y:number}} opts.origin  Explosion centre, or cone origin point.
 * @param {number} opts.radiusPx           Blast radius / cone spread in pixels.
 * @param {'explosion'|'cone'} [opts.mode='explosion']
 * @param {number} [opts.angleDeg]         Cone width (cone mode only).
 * @param {number} [opts.directionRad]     Cone direction in screen radians (cone mode only).
 * @param {string|number} [opts.tint]      Multiply tint.
 * @param {number} [opts.fallbackSec=8]    Max lifetime if the video never fires 'ended'.
 * @returns {Promise<void>}
 */
export async function playMediaEffect(src, {
  origin,
  radiusPx,
  mode = 'explosion',
  angleDeg = 360,
  directionRad = 0,
  tint = null,
  fallbackSec = 8,
} = {}) {
  if (!src || !canvas?.stage || !origin || !(radiusPx > 0)) return;

  let texture;
  try { texture = await _loadTexture(src); } catch { return; }
  const MeshCls = _SpriteMeshClass();
  if (!texture || !MeshCls) return;

  const container = new PIXI.Container();
  container.eventMode = 'none';
  container.zIndex = 100000; // above tokens

  const sprite = new MeshCls(texture);
  _applyTint(sprite, tint);

  if (mode === 'cone') {
    // Bottom-centre of the video sits at the origin; the video points "up" by
    // default, so rotate it to face the cone direction. Scale proportionally so
    // its height equals the spread.
    sprite.anchor?.set?.(0.5, 1.0);
    const natH = texture.height || 1;
    const scale = radiusPx / natH;
    sprite.scale?.set?.(scale, scale);
    sprite.position?.set?.(origin.x, origin.y);
    sprite.rotation = directionRad + (Math.PI / 2);
  } else {
    // Explosion: centre the video and stretch it to the blast diameter.
    sprite.anchor?.set?.(0.5, 0.5);
    sprite.width = radiusPx * 2;
    sprite.height = radiusPx * 2;
    sprite.position?.set?.(origin.x, origin.y);
  }

  container.addChild(sprite);

  // Wall clip.
  const poly = computeWallClip(origin, radiusPx, { angleDeg, directionRad });
  const mask = _buildMask(poly);
  if (mask) {
    container.addChild(mask);
    sprite.mask = mask;
  }

  canvas.stage.addChild(container);
  canvas.stage.sortableChildren = true;

  const cleanup = () => {
    try {
      canvas.stage.removeChild(container);
      container.destroy({ children: true });
    } catch { /* already gone */ }
  };

  const video = _startVideo(texture, { loop: false });
  if (video) {
    const onEnded = () => { video.removeEventListener('ended', onEnded); cleanup(); };
    video.addEventListener('ended', onEnded);
    // Fallback in case 'ended' never fires (looping disabled but stalled).
    setTimeout(() => { video.removeEventListener('ended', onEnded); cleanup(); }, fallbackSec * 1000);
  } else {
    setTimeout(cleanup, fallbackSec * 1000);
  }
}

// ── Persistent residue smoke (Tile linked to a Region) ───────────────────────
//
// The residue Region drives the visibility mechanics; a linked Tile renders the
// looping smoke/cloud video. The Tile uses RADIAL occlusion so it fades to 0.5
// opacity around controlled tokens (Foundry's default radius), and its elevation
// sits at the centre of the Region's elevation range.

const _OCCLUSION_RADIAL = globalThis.CONST?.OCCLUSION_MODES?.RADIAL
  ?? foundry.CONST?.OCCLUSION_MODES?.RADIAL ?? 4;

/**
 * Best-effort sample of the ground elevation at a point: the highest top of any
 * Region that contains the point. Falls back to 0.
 */
export function sampleGroundElevation(point) {
  let base = 0;
  try {
    for (const region of canvas.scene?.regions ?? []) {
      const top = region.elevation?.top;
      if (top == null) continue;
      const contains = region.object?.testPoint?.(point, top)
        ?? region.polygonTree?.testPoint?.(point);
      if (contains && top > base) base = top;
    }
  } catch { /* default */ }
  return base;
}

/**
 * Create a Tile that renders looping smoke media for a residue Region.
 * GM-only (creates an embedded document).
 *
 * @param {RegionDocument} regionDoc
 * @param {object} opts
 * @param {string} opts.src
 * @param {string|number|null} [opts.tint]
 * @param {{x:number,y:number}} opts.center
 * @param {number} opts.radiusX
 * @param {number} opts.radiusY
 * @param {number} [opts.bottom]
 * @param {number} [opts.top]
 */
export async function createResidueMediaTile(regionDoc, { src, tint, center, radiusX, radiusY, bottom = 0, top = 0 } = {}) {
  if (!src || !regionDoc) return;
  if (game.user !== game.users.activeGM) return;
  const scene = regionDoc.parent;
  if (!scene) return;

  const x = Math.round(center.x - radiusX);
  const y = Math.round(center.y - radiusY);
  const width = Math.max(1, Math.round(radiusX * 2));
  const height = Math.max(1, Math.round(radiusY * 2));
  const elevation = ((bottom ?? 0) + (top ?? bottom ?? 0)) / 2;

  const [tile] = await scene.createEmbeddedDocuments('Tile', [{
    texture: { src, tint: tint || null },
    x, y, width, height,
    elevation,
    occlusion: { modes: [_OCCLUSION_RADIAL], alpha: 0.5 },
    video: { loop: true, autoplay: true, volume: 0 },
    flags: { 'cyberpunk-blue': { residueRegionId: regionDoc.id } },
  }]);
  if (tile) await regionDoc.setFlag('cyberpunk-blue', 'residueTileId', tile.id);
}

/** Compute the bounding box {x,y,width,height} of a region's first ellipse shape. */
function _regionEllipseBounds(regionDoc) {
  const s = regionDoc?.shapes?.[0];
  if (!s || s.type !== 'ellipse') return null;
  return {
    x: Math.round(s.x - s.radiusX),
    y: Math.round(s.y - s.radiusY),
    width: Math.max(1, Math.round(s.radiusX * 2)),
    height: Math.max(1, Math.round(s.radiusY * 2)),
  };
}

/**
 * Register hooks that keep the residue smoke Tile in sync with its Region:
 * the Tile resizes when the Region shrinks/moves and is deleted with it.
 * Call once at ready.
 */
export function initResidueMediaSync() {
  Hooks.on('updateRegion', async (regionDoc, changes) => {
    if (game.user !== game.users.activeGM) return;
    const tileId = regionDoc.getFlag('cyberpunk-blue', 'residueTileId');
    if (!tileId) return;
    if (!('shapes' in changes) && !('elevation' in changes)) return;
    const tile = regionDoc.parent?.tiles?.get(tileId);
    if (!tile) return;
    const bounds = _regionEllipseBounds(regionDoc);
    const update = { _id: tileId };
    if (bounds) Object.assign(update, bounds);
    if ('elevation' in changes) {
      const b = regionDoc.elevation?.bottom ?? 0;
      const t = regionDoc.elevation?.top ?? b;
      update.elevation = (b + t) / 2;
    }
    await regionDoc.parent.updateEmbeddedDocuments('Tile', [update]).catch(() => {});
  });

  Hooks.on('deleteRegion', async (regionDoc) => {
    if (game.user !== game.users.activeGM) return;
    const tileId = regionDoc.getFlag('cyberpunk-blue', 'residueTileId');
    if (!tileId) return;
    const tile = regionDoc.parent?.tiles?.get(tileId);
    if (tile) await tile.delete().catch(() => {});
  });
}
