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
