/**
 * Subnet scene materialiser.
 *
 * `buildSubnetScene(design, name)` turns a Subnet Builder design (a flat-top
 * hex node graph — see `module/apps/subnet-builder.mjs`) into a fully
 * configured netrunning Architecture Scene:
 *   - a Scene in the "Subnets" folder (off-navigation, black, gridless
 *     100px/20ms, glitch transition, subnet background + unexplored image),
 *   - node video Tiles (randomised per type) with type-label banner Tiles,
 *   - hexagon Regions carrying the accNode / netNode behaviors,
 *   - walls along every edge (solid / door / locked door per connection state),
 *   - bidirectional Access-Point links for ACC nodes,
 *   - Program actors (with embedded Executables) + non-overlapping Tokens.
 *
 * GM-only. This is the codebase's first programmatic Scene + Wall creation, and
 * it targets Foundry v14.365 (Scene backgrounds live on a `levels` entry).
 */

import {
  HEX_SIZE, TILE_SIZE, axialToPixel, hexPolygonPoints, edgeSegment, edgeKey,
  bottomEdge, latticeBounds, neighborAxial,
} from './subnet-hex.mjs';
import { copyExecutableToProgram } from './netrunning.mjs';

const ASSET_BASE = 'systems/cyberpunk-blue/assets/subnet/';
const BACKGROUND = `${ASSET_BASE}background.png`;
const MARGIN = 320;            // px of scene padding around the node bounding box
const LABEL_RATIO = 720 / 1680; // type-banner videos are 1680×720
const NODE_VIDEO_COUNT = 9;    // subnet-<type>1..9.webm

/** Node type → node-video filename prefix and type-label banner. */
const TYPE_ASSETS = {
  root: { prefix: 'subnet-root', label: 'ROOT.webm' },
  acc:  { prefix: 'subnet-acc',  label: 'ACC.webm' },
  data: { prefix: 'subnet-data', label: 'DATA.webm' },
  exe:  { prefix: 'subnet-exe',  label: 'EXE.webm' },
  ctrl: { prefix: 'subnet-ctrl', label: 'CTRL.webm' },
};

/**
 * @param {object} design  { version, nodes:[…], connections:[…] }
 * @param {string} name    subnet / scene name
 * @returns {Promise<Scene|null>}
 */
export async function buildSubnetScene(design, name) {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.SubnetBuilder.GMOnly'));
    return null;
  }
  const nodes = design?.nodes ?? [];
  if (!nodes.length) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.SubnetBuilder.NoNodes'));
    return null;
  }

  // ── Layout: normalise node pixel coords into a positive scene rectangle ──
  const bounds = latticeBounds(nodes);
  const offX = MARGIN - bounds.minX;
  const offY = MARGIN - bounds.minY;
  const width = Math.max(TILE_SIZE, Math.round(bounds.maxX - bounds.minX + MARGIN * 2));
  const height = Math.max(TILE_SIZE, Math.round(bounds.maxY - bounds.minY + MARGIN * 2));

  /** Placed (scene-space) centre of a node. */
  const centreOf = (n) => {
    const c = axialToPixel(n.q, n.r);
    return { x: c.x + offX, y: c.y + offY };
  };

  // ── Scene ──────────────────────────────────────────────────────────────
  const sceneFolder = await ensureSceneFolder('Subnets');

  const [scene] = await Scene.createDocuments([{
    name,
    folder: sceneFolder.id,
    navigation: false,
    width,
    height,
    padding: 0,
    tokenVision: true,
    grid: { type: CONST.GRID_TYPES.GRIDLESS, size: 100, distance: 20, units: 'ms' },
    transition: { type: 'glitch', duration: 500 },
    // v14.365: background / unexplored image / background colour live on a Level.
    levels: [{
      name: game.i18n.localize('CYBER_BLUE.SubnetBuilder.LevelName'),
      elevation: { bottom: 0, top: 20 },
      background: { color: '#000000', src: BACKGROUND },
      fog: { src: BACKGROUND },
    }],
    flags: { 'cyberpunk-blue': { subnetDesign: foundry.utils.deepClone(design) } },
  }]);
  if (!scene) return null;

  // ── Tiles: node video + type-label banner ────────────────────────────────
  const tileData = [];
  for (const n of nodes) {
    const assets = TYPE_ASSETS[n.type] ?? TYPE_ASSETS.data;
    const c = centreOf(n);
    const variant = 1 + Math.floor(Math.random() * NODE_VIDEO_COUNT);
    // Node hexagon video.
    tileData.push({
      texture: { src: `${ASSET_BASE}${assets.prefix}${variant}.webm` },
      x: Math.round(c.x - HEX_SIZE),
      y: Math.round(c.y - HEX_SIZE),
      width: TILE_SIZE,
      height: TILE_SIZE,
      elevation: 0,
      sort: 0,
      video: { loop: true, autoplay: true, volume: 0 },
      flags: { 'cyberpunk-blue': { subnetNodeId: n.id, subnetTile: 'node' } },
    });
    // Type-label banner, scaled to the flat bottom edge and sat on it.
    const be = bottomEdge(c.x, c.y);
    const lw = Math.round(be.length);
    const lh = Math.max(1, Math.round(lw * LABEL_RATIO));
    tileData.push({
      texture: { src: `${ASSET_BASE}${assets.label}` },
      x: Math.round(be.x - lw / 2),
      y: Math.round(be.y - lh),
      width: lw,
      height: lh,
      elevation: 0,
      sort: 100,
      video: { loop: true, autoplay: true, volume: 0 },
      flags: { 'cyberpunk-blue': { subnetNodeId: n.id, subnetTile: 'label' } },
    });
  }
  await scene.createEmbeddedDocuments('Tile', tileData);

  // ── Regions: hexagon per node + node behavior ─────────────────────────────
  const regionData = nodes.map((n) => {
    const c = centreOf(n);
    const points = hexPolygonPoints(c.x, c.y).map((v) => Math.round(v));
    const behavior = n.type === 'acc'
      ? { type: 'accNode', name: 'ACC Node', system: { accessPointRegionUuid: '' } }
      : { type: 'netNode', name: `${n.type.toUpperCase()} Node`, system: { nodeType: n.type, nodeLabel: n.label ?? '' } };
    return {
      name: (n.label?.trim()) || `${n.type.toUpperCase()} — ${name}`,
      color: nodeRegionColor(n.type),
      visibility: CONST.REGION_VISIBILITY.ALWAYS,
      shapes: [{ type: 'polygon', points, hole: false }],
      behaviors: [behavior],
      flags: { 'cyberpunk-blue': { subnetNodeId: n.id } },
    };
  });
  const createdRegions = await scene.createEmbeddedDocuments('Region', regionData);
  // Map node id → created RegionDocument (creation order matches regionData/nodes).
  const regionByNode = new Map();
  nodes.forEach((n, i) => regionByNode.set(n.id, createdRegions[i]));

  // ── Walls: one per hex edge, deduped across shared edges ──────────────────
  const connState = buildConnLookup(design);
  const nodeByAxial = new Map(nodes.map((n) => [`${n.q},${n.r}`, n]));
  const doneEdges = new Set();
  const wallData = [];
  for (const n of nodes) {
    const c = centreOf(n);
    for (let edge = 0; edge < 6; edge++) {
      const key = edgeKey(c.x, c.y, edge);
      if (doneEdges.has(key)) continue;
      doneEdges.add(key);

      const nb = neighborAxial(n.q, n.r, edge);
      const neighbourNode = nodeByAxial.get(`${nb.q},${nb.r}`) ?? null;
      const state = neighbourNode ? connState(n.id, neighbourNode.id) : 'none';

      const seg = edgeSegment(c.x, c.y, edge);
      const c4 = [Math.round(seg.x0), Math.round(seg.y0), Math.round(seg.x1), Math.round(seg.y1)];

      if (state === 'connected') wallData.push({ c: c4, door: CONST.WALL_DOOR_TYPES.DOOR, ds: CONST.WALL_DOOR_STATES.CLOSED });
      else if (state === 'passwall') wallData.push({ c: c4, door: CONST.WALL_DOOR_TYPES.DOOR, ds: CONST.WALL_DOOR_STATES.LOCKED });
      else wallData.push({ c: c4 }); // solid wall (defaults block all senses)
    }
  }
  if (wallData.length) await scene.createEmbeddedDocuments('Wall', wallData);

  // ── Access-Point linking (bidirectional) for ACC nodes ────────────────────
  for (const n of nodes) {
    if (n.type !== 'acc' || !n.accessPointUuid?.trim()) continue;
    const accRegion = regionByNode.get(n.id);
    try {
      await linkAccessPoint(scene, accRegion, n.accessPointUuid.trim());
    } catch (err) {
      console.error('Cyberpunk Blue | Subnet AP link failed:', err);
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.SubnetBuilder.ApLinkFailed', { uuid: n.accessPointUuid }));
    }
  }

  // ── Program actors + tokens ───────────────────────────────────────────────
  await buildProgramActors(scene, nodes, name, centreOf);

  return scene;
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Region overlay tint per node type (the videos carry the real look). */
function nodeRegionColor(type) {
  switch (type) {
    case 'root': return '#f0c000';
    case 'acc':  return '#00e0d0';
    case 'exe':  return '#ff3b6b';
    case 'ctrl': return '#38d66b';
    default:     return '#3a7abf';
  }
}

/** A lookup (aId, bId) → connection state, defaulting to 'none'. */
function buildConnLookup(design) {
  const map = new Map();
  for (const c of design?.connections ?? []) {
    const k = c.a < c.b ? `${c.a}|${c.b}` : `${c.b}|${c.a}`;
    map.set(k, c.state);
  }
  return (a, b) => map.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 'none';
}

async function ensureSceneFolder(name) {
  let f = game.folders.find((x) => x.type === 'Scene' && !x.folder && x.name === name);
  if (!f) f = await Folder.create({ name, type: 'Scene' });
  return f;
}

async function ensureActorSubfolder(rootName, childName) {
  let root = game.folders.find((x) => x.type === 'Actor' && !x.folder && x.name === rootName);
  if (!root) root = await Folder.create({ name: rootName, type: 'Actor' });
  let child = game.folders.find((x) => x.type === 'Actor' && x.folder?.id === root.id && x.name === childName);
  if (!child) child = await Folder.create({ name: childName, type: 'Actor', folder: root.id });
  return child;
}

/**
 * Resolve a pasted Access-Point UUID to its Region, then wire the link both
 * directions: the new ACC region points at the AP region, and the AP region's
 * accessPoint behavior points at the new scene + ACC region.
 */
async function linkAccessPoint(scene, accRegion, uuid) {
  if (!accRegion) return;
  const doc = await fromUuid(uuid).catch(() => null);
  let apRegion = null;
  if (doc?.documentName === 'Region') apRegion = doc;
  else if (doc?.documentName === 'RegionBehavior') apRegion = doc.parent;
  else if (doc?.parent?.documentName === 'Region') apRegion = doc.parent;
  if (!apRegion) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.SubnetBuilder.ApNotRegion', { uuid }));
    return;
  }

  // ACC side: back-reference to the AP region.
  const accBehavior = accRegion.behaviors.find((b) => b.type === 'accNode');
  if (accBehavior) await accBehavior.update({ 'system.accessPointRegionUuid': apRegion.uuid });

  // AP side: point the accessPoint behavior at this scene + ACC region.
  let apBehavior = apRegion.behaviors.find((b) => b.type === 'accessPoint');
  const apSystem = { architectureSceneUuid: scene.uuid, accNodeRegionUuid: accRegion.uuid };
  if (apBehavior) {
    await apBehavior.update({ system: apSystem });
  } else {
    await apRegion.createEmbeddedDocuments('RegionBehavior', [{
      type: 'accessPoint', name: 'Access Point', system: apSystem,
    }]);
  }
}

/**
 * For every node with assigned Program Executable UUIDs, create a permanent
 * Program actor (with an embedded copy of the executable, as if dragged) in the
 * subnet's actor folder, and place a non-overlapping token in that node.
 */
async function buildProgramActors(scene, nodes, name, centreOf) {
  const withPrograms = nodes.filter((n) => (n.programs ?? []).length);
  if (!withPrograms.length) return;

  const folder = await ensureActorSubfolder('subnets', name);
  const tokenData = [];

  for (const n of withPrograms) {
    const c = centreOf(n);
    const placed = [];
    for (const uuid of n.programs) {
      const exe = await fromUuid(uuid).catch(() => null);
      if (exe?.type !== 'programExecutable') {
        ui.notifications.warn(game.i18n.format('CYBER_BLUE.SubnetBuilder.NotExecutable', { uuid }));
        continue;
      }

      // Permanent program actor.
      const [actor] = await Actor.createDocuments([{
        name: exe.name,
        type: 'program',
        img: exe.img,
        folder: folder.id,
        prototypeToken: {
          name: exe.name,
          texture: { src: exe.img },
          width: 0.5,
          height: 0.5,
          disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
        },
      }]);
      if (!actor) continue;

      // Embed a copy of the executable and link to it (mirror ProgramSheet._onDropItem).
      const data = exe.inCompendium ? game.items.fromCompendium(exe, { clearFolder: true }) : exe.toObject();
      delete data._id;
      const [created] = await actor.createEmbeddedDocuments('Item', [data]);
      if (created) {
        await actor.update({ 'system.executableUuid': created.uuid }, { cyberblueProgramSync: true });
        await copyExecutableToProgram(actor, created);
      }

      placed.push(actor);
    }

    // Position tokens non-overlapping within the node hex.
    const count = placed.length;
    placed.forEach((actor, i) => {
      const proto = actor.prototypeToken;
      const half = (proto.width ?? 0.5) * 50; // 0.5 grid * 100px / 2
      const radius = count > 1 ? 72 : 0;
      const angle = count > 1 ? (i / count) * Math.PI * 2 : 0;
      const px = c.x + Math.cos(angle) * radius;
      const py = c.y + Math.sin(angle) * radius;
      tokenData.push({
        actorId: actor.id,
        actorLink: true,
        name: proto.name || actor.name,
        texture: { src: proto.texture?.src ?? actor.img ?? '' },
        x: Math.round(px - half),
        y: Math.round(py - half),
        width: proto.width ?? 0.5,
        height: proto.height ?? 0.5,
        disposition: proto.disposition ?? CONST.TOKEN_DISPOSITIONS.HOSTILE,
      });
    });
  }

  if (tokenData.length) await scene.createEmbeddedDocuments('Token', tokenData);
}
