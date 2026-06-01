/**
 * Vehicle movement helpers: token attachment, position sync, and the shared
 * ramming collision handler.
 *
 * ── Attachment model ─────────────────────────────────────────────────────────
 * Tokens occupying any seat region (driver, gunner, passenger) are "attached"
 * to the vehicle token.  Attachment is stored as an array of records on the
 * vehicle token's flags:
 *
 *   token.flags['cyberpunk-blue'].attachedTokens: [
 *     { tokenId, offsetX, offsetY, localX, localY, rotAtAttach, passRotAtAttach },
 *     …
 *   ]
 *
 * `localX` / `localY` are the passenger token's *centre* relative to the vehicle
 * *centre*, expressed in the vehicle's un-rotated (body-local) frame, captured
 * at attach time. On every sync the offset is rotated by the vehicle's current
 * rotation, so passengers stay in their seats as the vehicle turns (no drift —
 * the offset is absolute, re-derived from the current rotation each move). The
 * passenger's own facing is rotated by the vehicle's rotation delta since attach.
 *
 * `offsetX` / `offsetY` (legacy, top-left axis-aligned offset) are retained as a
 * fallback for records attached before the rotation-aware model existed; those
 * follow translation only.
 *
 * ── Collision model ──────────────────────────────────────────────────────────
 * `resolveRammingCollision` is the shared service used by:
 *   Phase 3 — basic bounding-box collision after vehicle moves
 *   Phase 5 — Ram Maneuver (passes marginOfSuccess for rammer damage reduction)
 *   Phase 7 — Lost Control table outcomes involving impacts
 *
 * Damage formula: max(1, size × floor(speed / 5)) × d6
 * Both parties take the rolled damage.
 * Ram Maneuver bonus: rammer's damage reduced by marginOfSuccess *before* SP.
 */

import { applyDamageWithPermission } from './socket.mjs';
import { rotatePointAboutPivot, normalise360 } from './vehicle-vector.mjs';

/**
 * Centre of a token in scene pixels.
 * @param {TokenDocument} tokenDoc
 * @param {number} gridSize
 * @returns {{x: number, y: number}}
 */
function _tokenCentre(tokenDoc, gridSize) {
  const w = (tokenDoc.width ?? 1) * gridSize;
  const h = (tokenDoc.height ?? 1) * gridSize;
  return { x: (tokenDoc.x ?? 0) + w / 2, y: (tokenDoc.y ?? 0) + h / 2 };
}

/** Flag key used to store the list of tokens attached to a vehicle. */
export const ATTACHED_TOKENS_FLAG = 'attachedTokens';

// ── Attachment management ────────────────────────────────────────────────────

/**
 * Return the attachment records stored on a vehicle token.
 *
 * @param {TokenDocument} vehicleTokenDoc
 * @returns {{ tokenId: string, offsetX: number, offsetY: number }[]}
 */
export function getAttachedTokens(vehicleTokenDoc) {
  return vehicleTokenDoc.getFlag('cyberpunk-blue', ATTACHED_TOKENS_FLAG) ?? [];
}

/**
 * Attach a passenger token to a vehicle token, recording the current offset
 * between them so the passenger follows the vehicle's movement exactly.
 *
 * Safe to call if the token is already attached (no-op).
 *
 * @param {TokenDocument} vehicleTokenDoc
 * @param {TokenDocument} passengerTokenDoc
 */
export async function attachTokenToVehicle(vehicleTokenDoc, passengerTokenDoc) {
  const existing = getAttachedTokens(vehicleTokenDoc);
  if (existing.some((r) => r.tokenId === passengerTokenDoc.id)) return;

  const gridSize = vehicleTokenDoc.parent?.grid?.size ?? 100;

  // Legacy axis-aligned top-left offset (kept as a fallback).
  const offsetX = (passengerTokenDoc.x ?? 0) - (vehicleTokenDoc.x ?? 0);
  const offsetY = (passengerTokenDoc.y ?? 0) - (vehicleTokenDoc.y ?? 0);

  // Rotation-aware model: passenger centre relative to vehicle centre, expressed
  // in the vehicle's un-rotated body frame.
  const vC = _tokenCentre(vehicleTokenDoc, gridSize);
  const pC = _tokenCentre(passengerTokenDoc, gridSize);
  const rotAtAttach = vehicleTokenDoc.rotation ?? 0;
  const local = rotatePointAboutPivot(
    { x: pC.x - vC.x, y: pC.y - vC.y },
    { x: 0, y: 0 },
    -rotAtAttach,
  );

  await vehicleTokenDoc.setFlag('cyberpunk-blue', ATTACHED_TOKENS_FLAG, [
    ...existing,
    {
      tokenId: passengerTokenDoc.id,
      offsetX,
      offsetY,
      localX: local.x,
      localY: local.y,
      rotAtAttach,
      passRotAtAttach: passengerTokenDoc.rotation ?? 0,
    },
  ]);
}

/**
 * Detach a passenger token from a vehicle token.
 *
 * Safe to call if the token is not currently attached (no-op).
 *
 * @param {TokenDocument} vehicleTokenDoc
 * @param {TokenDocument} passengerTokenDoc
 */
export async function detachTokenFromVehicle(vehicleTokenDoc, passengerTokenDoc) {
  const existing = getAttachedTokens(vehicleTokenDoc);
  const updated = existing.filter((r) => r.tokenId !== passengerTokenDoc.id);
  if (updated.length === existing.length) return; // nothing changed

  if (updated.length === 0) {
    await vehicleTokenDoc.unsetFlag('cyberpunk-blue', ATTACHED_TOKENS_FLAG);
  } else {
    await vehicleTokenDoc.setFlag('cyberpunk-blue', ATTACHED_TOKENS_FLAG, updated);
  }
}

/**
 * Move all tokens currently attached to a vehicle to their recorded offsets
 * relative to the vehicle's current position.
 *
 * Called from the `updateToken` hook after the vehicle token has moved.
 * Uses the `cyberpunkBlueVehicleSync` option guard to prevent recursive hooks.
 *
 * @param {TokenDocument} vehicleTokenDoc
 */
export async function syncAttachedTokenPositions(vehicleTokenDoc) {
  const scene = vehicleTokenDoc.parent;
  if (!scene) return;

  const attached = getAttachedTokens(vehicleTokenDoc);
  if (!attached.length) return;

  const gridSize = scene.grid?.size ?? 100;
  const vx = vehicleTokenDoc.x ?? 0;
  const vy = vehicleTokenDoc.y ?? 0;
  const vC = _tokenCentre(vehicleTokenDoc, gridSize);
  const vRot = vehicleTokenDoc.rotation ?? 0;

  const updates = [];
  for (const record of attached) {
    const tokenDoc = scene.tokens.get(record.tokenId);
    if (!tokenDoc) continue;

    // Rotation-aware model: rotate the stored body-local offset by the vehicle's
    // current rotation and place the passenger centre relative to the vehicle
    // centre. Also rotate the passenger's facing by the vehicle's rotation delta.
    if (record.localX !== undefined && record.localY !== undefined) {
      const world = rotatePointAboutPivot(
        { x: record.localX, y: record.localY },
        { x: 0, y: 0 },
        vRot,
      );
      const pw = (tokenDoc.width ?? 1) * gridSize;
      const ph = (tokenDoc.height ?? 1) * gridSize;
      const update = {
        _id: record.tokenId,
        x: vC.x + world.x - pw / 2,
        y: vC.y + world.y - ph / 2,
      };
      const rotDelta = vRot - (record.rotAtAttach ?? 0);
      if (rotDelta !== 0) {
        update.rotation = normalise360((record.passRotAtAttach ?? 0) + rotDelta);
      }
      updates.push(update);
      continue;
    }

    // Legacy fallback: translation only (no rotation).
    updates.push({
      _id: record.tokenId,
      x: vx + (record.offsetX ?? 0),
      y: vy + (record.offsetY ?? 0),
    });
  }

  if (updates.length) {
    await scene.updateEmbeddedDocuments('Token', updates, {
      cyberpunkBlueVehicleSync: true,
    });
  }
}

/**
 * Prune stale token IDs from the attached-token list (tokens that no longer
 * exist in the scene, e.g. after a character token is deleted mid-session).
 *
 * @param {TokenDocument} vehicleTokenDoc
 */
export async function pruneAttachedTokens(vehicleTokenDoc) {
  const scene = vehicleTokenDoc.parent;
  if (!scene) return;

  const existing = getAttachedTokens(vehicleTokenDoc);
  const valid = existing.filter((r) => scene.tokens.has(r.tokenId));
  if (valid.length === existing.length) return;

  if (valid.length === 0) {
    await vehicleTokenDoc.unsetFlag('cyberpunk-blue', ATTACHED_TOKENS_FLAG);
  } else {
    await vehicleTokenDoc.setFlag('cyberpunk-blue', ATTACHED_TOKENS_FLAG, valid);
  }
}

// ── Collision (ramming damage) ────────────────────────────────────────────────

/**
 * Apply base ramming damage to both the vehicle and a target that has been
 * struck.  This is the *shared service* called from:
 *
 *   Phase 3  — bounding-box overlap detected after a move
 *   Phase 5  — Ram Maneuver execution (passes marginOfSuccess)
 *   Phase 7  — Lost Control table collision outcomes
 *
 * Damage formula (N19 / design notes):
 *   dice = max(1, size × floor(speed / 5))   (at speed 0–4: always 1 die)
 *   damage = roll(dice × d6)
 *
 * Ram Maneuver bonus (N20):
 *   If marginOfSuccess > 0, subtract it from the rammer's damage BEFORE SP.
 *   The target always takes the full rolled damage.
 *
 * Both parties take damage via `applyDamageWithPermission` (delegates to GM
 * if the current user lacks write permission).
 *
 * @param {TokenDocument} vehicleTokenDoc   The ramming vehicle's token
 * @param {TokenDocument} targetTokenDoc    The struck token (vehicle, foot, etc.)
 * @param {object}        [options]
 * @param {number}        [options.marginOfSuccess=0]  Ram Maneuver margin
 * @param {boolean}       [options.postToChat=true]    Emit a chat message
 */
export async function resolveRammingCollision(vehicleTokenDoc, targetTokenDoc, options = {}) {
  const { marginOfSuccess = 0, postToChat = true } = options;

  const vehicleActor = vehicleTokenDoc.actor;
  const targetActor  = targetTokenDoc.actor;
  if (!vehicleActor || !targetActor) return;

  // Resolve vehicle stats needed for the damage formula.
  const size  = (vehicleActor.system?.stats?.size?.value ?? 1)
              + (vehicleActor.system?.stats?.size?.bonus ?? 0);
  const speed = Math.abs(vehicleActor.system?.stats?.currentSpeed?.value ?? 1);
  const dice  = Math.max(1, size * Math.floor(speed / 5));

  const roll = await new Roll(`${dice}d6`).evaluate();
  const rawDamage = roll.total;

  // Rammer's damage is reduced by the margin of success (Ram Maneuver benefit).
  const vehicleDamage = Math.max(0, rawDamage - marginOfSuccess);
  // Target always takes the full rolled damage.
  const targetDamage  = rawDamage;

  if (postToChat) {
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: vehicleActor }),
      flavor: `
        <div class="cyberpunk-blue chat-card">
          <h3><i class="fas fa-car-burst"></i> Ramming Collision</h3>
          <p>
            <strong>${vehicleTokenDoc.name}</strong> hits <strong>${targetTokenDoc.name}</strong>
            (Size ${size}, Speed ${speed} → ${dice}d6)
          </p>
          ${marginOfSuccess > 0
            ? `<p>Ram Maneuver — rammer damage reduced by ${marginOfSuccess}</p>`
            : ''}
          <p>
            ${vehicleTokenDoc.name} takes <strong>${vehicleDamage}</strong> damage,
            ${targetTokenDoc.name} takes <strong>${targetDamage}</strong> damage.
          </p>
        </div>
      `,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  // Apply damage — both parties receive it simultaneously.
  await Promise.all([
    applyDamageWithPermission(vehicleActor, vehicleDamage),
    applyDamageWithPermission(targetActor,  targetDamage),
  ]);
}

// ── Swept-path collision check ───────────────────────────────────────────────

/**
 * After a vehicle token moves, check whether the vehicle's bounding box swept
 * from its previous position to its new position overlaps any non-vehicle,
 * non-attached token on the same scene. Vector moves can be long enough to skip
 * over a token between frames, so a final-position-only test would miss them.
 *
 * Method (exact for axis-aligned rects under translation): expand each other
 * token's rect by the vehicle's half-extents (Minkowski sum), then test whether
 * the segment traced by the vehicle CENTRE (from → to) intersects that expanded
 * rect. If `fromPos` is omitted, falls back to a final-position overlap test.
 *
 * When a hit is found, `resolveRammingCollision` is called. Each pair is handled
 * at most once per move event (per token.update). A multi-segment maneuver fires
 * one move per segment, so each leg is swept independently.
 *
 * @param {TokenDocument} vehicleTokenDoc
 * @param {{x:number,y:number}} [fromPos]  Vehicle top-left before the move.
 */
export async function checkVehicleCollisions(vehicleTokenDoc, fromPos = null) {
  const scene = vehicleTokenDoc.parent;
  if (!scene) return;

  const gridSize = scene.grid?.size ?? 100;
  const vw = (vehicleTokenDoc.width  ?? 1) * gridSize;
  const vh = (vehicleTokenDoc.height ?? 1) * gridSize;
  const halfW = vw / 2;
  const halfH = vh / 2;

  // Centre path: from → to. Size is assumed constant across a single move.
  const toX = vehicleTokenDoc.x ?? 0;
  const toY = vehicleTokenDoc.y ?? 0;
  const fromX = fromPos?.x ?? toX;
  const fromY = fromPos?.y ?? toY;
  const cAx = fromX + halfW, cAy = fromY + halfH;
  const cBx = toX + halfW,   cBy = toY + halfH;

  const attachedIds = new Set(
    getAttachedTokens(vehicleTokenDoc).map((r) => r.tokenId),
  );

  for (const otherToken of scene.tokens) {
    if (otherToken.id === vehicleTokenDoc.id) continue;
    if (attachedIds.has(otherToken.id)) continue;
    if (!otherToken.actor) continue;

    const ox = otherToken.x ?? 0;
    const oy = otherToken.y ?? 0;
    const ow = (otherToken.width  ?? 1) * gridSize;
    const oh = (otherToken.height ?? 1) * gridSize;

    // Minkowski-expanded rect: vehicle (rect) overlaps the other token iff the
    // vehicle centre lies inside [ox-halfW, ox+ow+halfW] × [oy-halfH, oy+oh+halfH].
    const minX = ox - halfW, maxX = ox + ow + halfW;
    const minY = oy - halfH, maxY = oy + oh + halfH;

    if (segmentIntersectsAABB(cAx, cAy, cBx, cBy, minX, minY, maxX, maxY)) {
      await resolveRammingCollision(vehicleTokenDoc, otherToken, { postToChat: true });
    }
  }
}

/**
 * Segment ↔ axis-aligned box intersection (Liang–Barsky slab clip). Returns
 * true if the segment (ax,ay)→(bx,by) touches or enters the box, including when
 * either endpoint is inside.
 * @private
 */
function segmentIntersectsAABB(ax, ay, bx, by, minX, minY, maxX, maxY) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const clip = (p, q) => {
    // p·t <= q for the slab edge; tighten [t0,t1].
    if (p === 0) return q >= 0;           // parallel: inside slab iff q>=0
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else       { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - minX)
      && clip( dx, maxX - ax)
      && clip(-dy, ay - minY)
      && clip( dy, maxY - ay)
      && t0 <= t1;
}
