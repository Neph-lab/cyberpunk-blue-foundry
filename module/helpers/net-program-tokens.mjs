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
 *   • The `updateToken` hook in cyberpunk-blue.mjs calls it again on every
 *     Netrunner move, so the programs trail along. When the move crosses into
 *     a different node the programs teleport rather than drift across the
 *     architecture.
 *
 * Architecture scenes are gridless (see subnet-build.mjs), so positions are
 * free pixel coordinates and nothing snaps.
 */

import { getNetConnection, PROGRAM_ACTOR_FLAG } from './netrunning.mjs';

/** Clearance left between token bounding boxes, in pixels. */
const TOKEN_GAP = 8;

/** Candidate directions tried per ring, and how many rings out we search. */
const RING_STEPS = 16;
const RING_COUNT = 8;

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
 * The node Region a token currently sits in, or null.
 *
 * Tests the token's center point rather than reading `region.tokens`: this runs
 * from the `updateToken` hook, where Foundry's region-containment bookkeeping
 * for the move may not have caught up yet, and a point test against the
 * document's own geometry always reflects the position we can see.
 *
 * @param {TokenDocument} tokenDoc
 * @returns {RegionDocument|null}
 */
export function nodeRegionFor(tokenDoc) {
  const scene = tokenDoc?.parent;
  if (!scene) return null;
  const box = tokenRect(tokenDoc);
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

/**
 * Search for a free spot for a `w`×`h` token beside the Netrunner.
 *
 * Candidates sit on rings of increasing radius around the Netrunner's center,
 * starting just clear of their token. A spot is taken when it lies wholly
 * inside `node` and clears every rect in `blockers`. If nothing qualifies the
 * innermost candidate is returned anyway — being visible in the right node
 * beats being pushed somewhere else.
 *
 * @param {object}   args
 * @param {object}   args.netBox      - the Netrunner token's rect
 * @param {?object}  args.node        - node Region to stay inside, or null
 * @param {number}   args.w
 * @param {number}   args.h
 * @param {object[]} args.blockers    - rects to avoid
 * @param {number}   [args.angleOffset] - rotate the ring so siblings fan out
 * @returns {{x: number, y: number}}
 */
function findFreeSpot({ netBox, node, w, h, blockers, angleOffset = 0 }) {
  const cx = netBox.x + netBox.w / 2;
  const cy = netBox.y + netBox.h / 2;
  // Innermost ring clears both tokens' half-extents plus the gap.
  const baseRadius = Math.max(netBox.w, netBox.h) / 2 + Math.max(w, h) / 2 + TOKEN_GAP;
  const ringStep = Math.max(w, h) / 2 + TOKEN_GAP;

  let fallback = null;
  for (let ring = 0; ring < RING_COUNT; ring++) {
    const radius = baseRadius + ring * ringStep;
    for (let step = 0; step < RING_STEPS; step++) {
      const angle = angleOffset + (step / RING_STEPS) * Math.PI * 2;
      const at = {
        x: Math.round(cx + Math.cos(angle) * radius - w / 2),
        y: Math.round(cy + Math.sin(angle) * radius - h / 2),
      };
      const candidate = { ...at, w, h };
      fallback ??= at;
      if (!rectCorners(candidate).every((p) => pointInRegion(node, p))) continue;
      if (blockers.some((b) => rectsOverlap(candidate, b))) continue;
      return at;
    }
  }
  return fallback ?? { x: netBox.x, y: netBox.y };
}

/**
 * Position every running program token of `actor` beside their architecture
 * token, inside the same node and without overlapping anything — including the
 * programs placed earlier in this same pass.
 *
 * When the Netrunner has changed node, the programs jump rather than sliding
 * across the architecture: they are not travelling, they are running on a deck
 * that went with them. Detected by comparing each program's current node with
 * the Netrunner's, so no pre-move state has to be carried around.
 *
 * @param {Actor} actor
 * @param {object} [opts]
 * @param {boolean|null} [opts.teleport] - force/forbid the jump; null = decide
 *   from whether the programs are still in the Netrunner's node.
 */
export async function placeProgramTokens(actor, { teleport = null } = {}) {
  const conn = getNetConnection(actor);
  if (!conn) return;
  const scene = game.scenes.get(conn.archSceneId);
  if (!scene) return;

  const netTok = scene.tokens.get(conn.archTokenId);
  if (!netTok) return;

  const programTokens = runningProgramTokens(actor, scene);
  if (!programTokens.length) return;

  const node = nodeRegionFor(netTok);
  const netBox = tokenRect(netTok);

  const changedNode = programTokens.some((t) => (nodeRegionFor(t)?.id ?? null) !== (node?.id ?? null));
  const jump = teleport ?? changedNode;

  // Tokens that must be avoided: everything in the scene except the programs
  // this pass is (re)placing, which are added back as they get positions.
  const moving = new Set(programTokens.map((t) => t.id));
  const blockers = scene.tokens
    .filter((t) => !moving.has(t.id))
    .map((t) => tokenRect(t));

  const updates = [];
  for (const [index, progTok] of programTokens.entries()) {
    const box = tokenRect(progTok);
    const at = findFreeSpot({
      netBox,
      node,
      w: box.w,
      h: box.h,
      blockers,
      // Stagger each program's starting angle so they fan out instead of
      // queueing along one side.
      angleOffset: (index / programTokens.length) * Math.PI * 2,
    });
    blockers.push({ ...at, w: box.w, h: box.h });
    if (progTok.x === at.x && progTok.y === at.y) continue;
    updates.push({ _id: progTok.id, x: at.x, y: at.y });
  }

  if (!updates.length) return;
  await scene.updateEmbeddedDocuments('Token', updates, { animate: !jump, teleport: jump });
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
