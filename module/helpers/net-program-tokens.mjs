/**
 * Placement and following for the temporary Program actor tokens a Netrunner
 * spawns when they set an installed executable to Running.
 *
 * A program token is an extension of its Netrunner, not an independent piece:
 * it belongs in the same node, beside them rather than under them, and it goes
 * where they go. This module owns that behavior:
 *
 *   • `placeProgramTokens` picks a free spot inside the Netrunner's current
 *     node for every running program, falling back to overlapping only when
 *     the node has genuinely run out of room.
 *   • The `updateToken` hook in cyberpunk-blue.mjs calls it again once each
 *     Netrunner move settles, so the programs keep station beside them —
 *     within a node and across nodes alike. They always jump rather than
 *     travel; see `placeProgramTokens` for why that is not just flavor.
 *
 * Architecture scenes are gridless (see subnet-build.mjs), so positions are
 * free pixel coordinates and nothing snaps.
 */

import { getNetConnection, PROGRAM_ACTOR_FLAG } from './netrunning.mjs';

/** Clearance preferred between token bounding boxes, in pixels. */
const TOKEN_GAP = 8;

/** Candidate lattice spacing, as a fraction of the placed token's size. */
const LATTICE_FRACTION = 0.5;

/** Half-extent of the search area when there is no node to search within. */
const NODE_LESS_RADIUS = 300;

/**
 * Pixel bounding box of a token, optionally at a hypothetical position.
 * @param {TokenDocument} tokenDoc
 * @param {{x: number, y: number}} [at] - top-left override
 */
function tokenRect(tokenDoc, at = null) {
  const scene = tokenDoc.parent;
  const gridSize = scene?.grid?.size ?? 100;
  const w = (tokenDoc.width ?? 1) * gridSize;
  const h = (tokenDoc.height ?? 1) * gridSize;
  const x = at ? at.x : tokenDoc.x;
  const y = at ? at.y : tokenDoc.y;
  return { x, y, w, h };
}

/** True when two rects overlap, treating `gap` as part of each rect. */
function rectsOverlap(a, b, gap = TOKEN_GAP) {
  return a.x - gap < b.x + b.w
    && a.x + a.w + gap > b.x
    && a.y - gap < b.y + b.h
    && a.y + a.h + gap > b.y;
}

/**
 * True when `point` lies inside `region`. Region geometry is derived on the
 * document, so this works on the GM's client whether or not the architecture
 * scene is the one currently drawn on canvas. With no region to test against
 * (a node-less architecture) everywhere is fair game.
 */
function pointInRegion(region, point) {
  if (!region) return true;
  try {
    const tree = region.polygonTree;
    if (tree?.testPoint) return Boolean(tree.testPoint(point));
    if (region.object?.testPoint) return Boolean(region.object.testPoint(point));
  } catch { /* fall through */ }
  return true;
}

/**
 * The node Region a token sits in, or null.
 *
 * Tests the token's center point rather than reading `region.tokens`: this runs
 * from the `updateToken` hook, where Foundry's region-containment bookkeeping
 * for the move may not have caught up yet, and a point test against the
 * document's own geometry always reflects the position we ask about.
 *
 * @param {TokenDocument} tokenDoc
 * @param {{x: number, y: number}} [at] - test this position instead of the
 *   document's own, which lags behind during a movement animation.
 * @returns {RegionDocument|null}
 */
export function nodeRegionFor(tokenDoc, at = null) {
  const scene = tokenDoc?.parent;
  if (!scene) return null;
  const box = tokenRect(tokenDoc, at);
  const centre = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  for (const region of scene.regions) {
    if (!region.behaviors?.some((b) => b.type === 'netNode' || b.type === 'accNode')) continue;
    if (pointInRegion(region, centre)) return region;
  }
  return null;
}

/** All four corners of a rect, inset slightly so edge-hugging still counts. */
function rectCorners({ x, y, w, h }, inset = 2) {
  return [
    { x: x + inset,     y: y + inset },
    { x: x + w - inset, y: y + inset },
    { x: x + inset,     y: y + h - inset },
    { x: x + w - inset, y: y + h - inset },
  ];
}

/**
 * Every Program actor token in `scene` belonging to a running executable on
 * `actor`, in a stable order so repeated placement passes don't shuffle them.
 *
 * @param {Actor} actor  - the Netrunner
 * @param {Scene} scene  - the architecture scene
 * @returns {TokenDocument[]}
 */
export function runningProgramTokens(actor, scene) {
  if (!actor || !scene) return [];
  const exes = actor.items
    .filter((i) => i.type === 'programExecutable' && i.system.running)
    .sort((a, b) => a.id.localeCompare(b.id));

  const tokens = [];
  for (const exe of exes) {
    const programActorId = exe.getFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
    if (!programActorId) continue;
    const tok = scene.tokens.find((t) => t.actorId === programActorId);
    if (tok) tokens.push(tok);
  }
  return tokens;
}

/** Pixel bounding box of a Region, from its derived polygons. */
function regionBounds(region) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const poly of (region?.polygons ?? [])) {
    const pts = poly.points ?? [];
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] < minX) minX = pts[i];
      if (pts[i] > maxX) maxX = pts[i];
      if (pts[i + 1] < minY) minY = pts[i + 1];
      if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/**
 * Find where to put a `w`×`h` token near the Netrunner, inside their node.
 *
 * Candidates are a lattice over the node's bounding box, tried nearest-first
 * from the Netrunner's center, under progressively weaker requirements:
 *
 *   1. wholly inside the node, clear of everything by TOKEN_GAP
 *   2. wholly inside the node, merely not overlapping
 *   3. center inside the node (so Foundry counts it as in the node), not
 *      overlapping — it may hang over the node's edge
 *   4. center inside the node, overlapping — the node is genuinely full
 *
 * A ring search was the obvious shape for this and it was wrong: rings are
 * anchored to a radius that clears the *corners* of the Netrunner's token, so
 * in a node only twice the Netrunner's width every candidate landed outside the
 * node and every program fell through to the overlap fallback. Searching the
 * node itself has no such blind spot.
 *
 * @param {object}   args
 * @param {object}   args.netBox   - the Netrunner token's rect
 * @param {?object}  args.node     - node Region to stay inside, or null
 * @param {number}   args.w
 * @param {number}   args.h
 * @param {object[]} args.blockers - rects to avoid
 * @returns {{x: number, y: number}}
 */
function findFreeSpot({ netBox, node, w, h, blockers }) {
  const cx = netBox.x + netBox.w / 2;
  const cy = netBox.y + netBox.h / 2;

  // Without a node, search a generous box around the Netrunner instead.
  const bounds = (node && regionBounds(node)) ?? {
    minX: cx - NODE_LESS_RADIUS, minY: cy - NODE_LESS_RADIUS,
    maxX: cx + NODE_LESS_RADIUS, maxY: cy + NODE_LESS_RADIUS,
  };

  const step = Math.max(Math.round(Math.min(w, h) * LATTICE_FRACTION), 8);
  const candidates = [];
  for (let x = bounds.minX; x <= bounds.maxX - w; x += step) {
    for (let y = bounds.minY; y <= bounds.maxY - h; y += step) {
      const at = { x: Math.round(x), y: Math.round(y) };
      const dx = at.x + w / 2 - cx;
      const dy = at.y + h / 2 - cy;
      candidates.push({ at, d2: dx * dx + dy * dy });
    }
  }
  // Always include the edge-aligned column/row, which the stride can skip.
  candidates.sort((a, b) => a.d2 - b.d2);

  const fullyInside = (r) => rectCorners(r).every((p) => pointInRegion(node, p));
  const centreInside = (r) => pointInRegion(node, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const clear = (r, gap) => !blockers.some((b) => rectsOverlap(r, b, gap));

  const passes = [
    (r) => fullyInside(r) && clear(r, TOKEN_GAP),
    (r) => fullyInside(r) && clear(r, 0),
    (r) => centreInside(r) && clear(r, 0),
    (r) => centreInside(r),
  ];
  for (const accepts of passes) {
    for (const { at } of candidates) {
      if (accepts({ ...at, w, h })) return at;
    }
  }
  // Nothing at all fits the node: sit on the Netrunner rather than leave the node.
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
}

/**
 * Position every running program token of `actor` beside their architecture
 * token, inside the same node and without overlapping anything — including the
 * programs placed earlier in this same pass.
 *
 * Programs are repositioned as teleports, never as travel. They are not walking
 * the architecture — they run on a deck that went with the Netrunner — and,
 * practically, a plain x/y update in v14 is a *movement*: the token is pathed
 * through generated waypoints, each committed to the document in turn. Issue a
 * second one while the first is in flight (which a Netrunner crossing several
 * nodes reliably does) and the token settles on some waypoint of the abandoned
 * path instead of where it was sent. Verified live on 14.365, where a program
 * ended a move stranded in a node the Netrunner had only passed through.
 *
 * @param {Actor} actor
 * @param {object} [opts]
 * @param {{x: number, y: number}} [opts.netAt] - where the Netrunner token is
 *   going. Required from the movement hook: during an animation the document's
 *   own x/y are an interpolated, already-stale value.
 */
export async function placeProgramTokens(actor, { netAt = null } = {}) {
  const conn = getNetConnection(actor);
  if (!conn) return;
  const scene = game.scenes.get(conn.archSceneId);
  if (!scene) return;

  const netTok = scene.tokens.get(conn.archTokenId);
  if (!netTok) return;

  const programTokens = runningProgramTokens(actor, scene);
  if (!programTokens.length) return;

  const node = nodeRegionFor(netTok, netAt);
  const netBox = tokenRect(netTok, netAt);

  // Tokens that must be avoided: everything in the scene except the programs
  // this pass is (re)placing, which are added back as they get positions.
  const moving = new Set(programTokens.map((t) => t.id));
  const blockers = scene.tokens
    .filter((t) => !moving.has(t.id))
    .map((t) => tokenRect(t, t.id === netTok.id ? netAt : null));

  const updates = [];
  for (const progTok of programTokens) {
    const box = tokenRect(progTok);
    const at = findFreeSpot({ netBox, node, w: box.w, h: box.h, blockers });
    // Each placed program becomes an obstacle for the next, so a second one
    // takes the next-nearest spot rather than the same one.
    blockers.push({ ...at, w: box.w, h: box.h });
    if (progTok.x === at.x && progTok.y === at.y) continue;
    updates.push({ _id: progTok.id, x: at.x, y: at.y });
  }

  if (!updates.length) return;
  // Displace rather than update: a bare x/y update is a *movement* (see above),
  // and the `teleport` operation flag that used to suppress that is deprecated
  // (removed in v15) — its own shim just rewrites it to this waypoint action.
  // Measured on 14.365: one updateToken fire, lands exactly on target.
  for (const { _id, x, y } of updates) {
    await scene.tokens.get(_id)?.move([{ x, y, action: 'displace' }], { showRuler: false });
  }
}

/** Per-Netrunner placement queues, keyed by actor id. */
const _placementQueues = new Map();

/**
 * Run `placeProgramTokens` serialized per Netrunner, collapsing bursts.
 *
 * A single drag across the architecture arrives as a sequence of `updateToken`
 * events, so unserialized runs would overlap and an earlier one could easily
 * write its (already stale) positions last. Requests arriving while a run is in
 * flight collapse into exactly one follow-up run, which starts after it and
 * therefore reads the settled state.
 *
 * @param {Actor} actor
 * @param {object} [opts] - forwarded to placeProgramTokens
 * @returns {Promise<void>}
 */
export function schedulePlaceProgramTokens(actor, opts = {}) {
  if (!actor?.id) return Promise.resolve();
  const entry = _placementQueues.get(actor.id) ?? { chain: Promise.resolve(), queued: false };
  _placementQueues.set(actor.id, entry);

  // A run is already waiting to start; it will pick up this request's state too.
  if (entry.queued) {
    entry.opts = opts;
    return entry.chain;
  }
  entry.queued = true;
  entry.opts = opts;
  entry.chain = entry.chain.then(async () => {
    entry.queued = false;
    const runOpts = entry.opts;
    try {
      await placeProgramTokens(actor, runOpts);
    } catch (err) {
      console.error('Cyberpunk Blue | Program token placement failed:', err);
    }
  });
  return entry.chain;
}

/**
 * Placement for a program token that does not exist yet: same search, but
 * returning coordinates instead of writing them, so the spawn can create the
 * token already in the right place rather than moving it a frame later.
 *
 * @param {Actor} actor
 * @param {Scene} scene
 * @param {number} size - the new token's width/height in grid units
 * @returns {{x: number, y: number}}
 */
export function initialProgramTokenPosition(actor, scene, size = 0.5) {
  const conn = getNetConnection(actor);
  const netTok = conn ? scene.tokens.get(conn.archTokenId) : null;
  if (!netTok) return { x: 0, y: 0 };

  const gridSize = scene.grid?.size ?? 100;
  const netBox = tokenRect(netTok);
  return findFreeSpot({
    netBox,
    node: nodeRegionFor(netTok),
    w: size * gridSize,
    h: size * gridSize,
    // Everything already on the scene, the Netrunner included.
    blockers: scene.tokens.map((t) => tokenRect(t)),
  });
}
