/**
 * Subnet Builder — standalone GM window for laying out a netrunning
 * Architecture as a flat-top hexagon node graph, then generating a fully
 * configured Scene (tiles, hexagon Regions with node behaviors, walls/doors,
 * Access-Point links, and Program actors + tokens).
 *
 * Rendering substrate: a plain HTML5 Canvas 2D context (mirrors the vehicle
 * blueprint editor — no PIXI). The graph is edited in memory; JSON export/import
 * round-trips a design, and "Save" builds the Scene via `subnet-build.mjs`.
 *
 * Open via: CyberBlueSubnetBuilder.open()  (GM only, single instance).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import {
  HEX_SIZE, axialToPixel, hexVertices, hexPolygonPoints, pixelToAxial,
  pointInHex, neighbors, latticeBounds, axialKey, NEIGHBOR_DELTAS,
} from '../helpers/subnet-hex.mjs';
import { buildSubnetScene } from '../helpers/subnet-build.mjs';

/** Node types the GM can assign. ROOT is seeded; others added freely. */
export const NODE_TYPES = ['root', 'acc', 'data', 'exe', 'ctrl'];

/** Editor preview color per node type (the real scene uses the node videos). */
export const NODE_COLORS = {
  root: '#f0c000', // amber/gold
  acc:  '#00e0d0', // cyan
  data: '#3a7abf', // blue
  exe:  '#ff3b6b', // magenta/red
  ctrl: '#38d66b', // green
};

const NODE_TYPE_LABELS = {
  root: 'CYBER_BLUE.SubnetBuilder.Type.Root',
  acc:  'CYBER_BLUE.SubnetBuilder.Type.Acc',
  data: 'CYBER_BLUE.SubnetBuilder.Type.Data',
  exe:  'CYBER_BLUE.SubnetBuilder.Type.Exe',
  ctrl: 'CYBER_BLUE.SubnetBuilder.Type.Ctrl',
};

/** Connection states in cycle order. Absent connection == 'none' (solid wall). */
const CONN_CYCLE = ['none', 'connected', 'passwall'];

const CANVAS_PADDING = 40;
const MIN_SCALE = 0.03;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.1;
const DRAW_FRAC = 0.9;   // hexes drawn at 90% so a visible gap sits between them
const GAP_HIT = 26;      // screen-px radius for clicking a shared-edge connection

export class CyberBlueSubnetBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {CyberBlueSubnetBuilder|null} single open instance */
  static _instance = null;

  static DEFAULT_OPTIONS = {
    id: 'cpb-subnet-builder',
    classes: ['cyberpunk-blue', 'subnet-builder'],
    tag: 'div',
    window: {
      title: 'CYBER_BLUE.SubnetBuilder.Title',
      resizable: true,
    },
    position: { width: 1100, height: 760 },
    actions: {
      fit:    CyberBlueSubnetBuilder._onFitAction,
      undo:   CyberBlueSubnetBuilder._onUndoAction,
      redo:   CyberBlueSubnetBuilder._onRedoAction,
      export: CyberBlueSubnetBuilder._onExportAction,
      import: CyberBlueSubnetBuilder._onImportAction,
      save:   CyberBlueSubnetBuilder._onSaveAction,
    },
  };

  static PARTS = {
    body: { template: 'systems/cyberpunk-blue/templates/apps/subnet-builder.hbs' },
  };

  /**
   * Open (or focus) the single Subnet Builder window. GM only.
   * @param {object} [design]  optional seed design (e.g. an imported one)
   * @returns {CyberBlueSubnetBuilder|null}
   */
  static open(design = null) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.SubnetBuilder.GMOnly'));
      return null;
    }
    if (CyberBlueSubnetBuilder._instance) {
      CyberBlueSubnetBuilder._instance.bringToFront();
      return CyberBlueSubnetBuilder._instance;
    }
    const app = new CyberBlueSubnetBuilder(design);
    CyberBlueSubnetBuilder._instance = app;
    app.render(true);
    return app;
  }

  constructor(design = null, options = {}) {
    super(options);
    /** world→screen transform: screen = world * scale + (x|y) */
    this._view = { scale: 1, x: 0, y: 0 };
    this._viewReady = false;
    /** design working copy */
    this._design = this._normalizeDesign(design) ?? this._newDesign();
    this._selectedNodeId = null;
    this._undoStack = [];
    this._redoStack = [];
    /** active drag state */
    this._drag = null;
    this._onKeyDownBound = this._onKeyDown.bind(this);
  }

  get title() {
    return game.i18n.localize('CYBER_BLUE.SubnetBuilder.Title');
  }

  // ── Design model ─────────────────────────────────────────────────────────

  _newDesign() {
    return {
      version: 1,
      nodes: [{ id: foundry.utils.randomID(), q: 0, r: 0, type: 'root', label: '', programs: [], accessPointUuid: '' }],
      connections: [],
    };
  }

  /** Validate/normalize an arbitrary imported object into a design. */
  _normalizeDesign(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.nodes)) return null;
    const seen = new Set();
    const nodes = raw.nodes
      .filter((n) => n && Number.isInteger(n.q) && Number.isInteger(n.r))
      .map((n) => {
        let id = typeof n.id === 'string' && n.id ? n.id : foundry.utils.randomID();
        while (seen.has(id)) id = foundry.utils.randomID();
        seen.add(id);
        return {
          id,
          q: n.q,
          r: n.r,
          type: NODE_TYPES.includes(n.type) ? n.type : 'data',
          label: typeof n.label === 'string' ? n.label : '',
          programs: Array.isArray(n.programs) ? n.programs.filter((u) => typeof u === 'string' && u) : [],
          accessPointUuid: typeof n.accessPointUuid === 'string' ? n.accessPointUuid : '',
        };
      });
    if (!nodes.length) return null;
    // Drop duplicate coordinates (keep first).
    const occ = new Set();
    const deduped = [];
    for (const n of nodes) {
      const k = axialKey(n.q, n.r);
      if (occ.has(k)) continue;
      occ.add(k);
      deduped.push(n);
    }
    const idSet = new Set(deduped.map((n) => n.id));
    const connections = (Array.isArray(raw.connections) ? raw.connections : [])
      .filter((c) => c && idSet.has(c.a) && idSet.has(c.b) && c.a !== c.b)
      .map((c) => ({ a: c.a, b: c.b, state: CONN_CYCLE.includes(c.state) ? c.state : 'connected' }));
    return { version: 1, nodes: deduped, connections };
  }

  _node(id) { return this._design.nodes.find((n) => n.id === id) ?? null; }

  _nodeAtAxial(q, r) {
    return this._design.nodes.find((n) => n.q === q && n.r === r) ?? null;
  }

  _areAdjacent(a, b) {
    return NEIGHBOR_DELTAS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
  }

  /** Unique adjacent node pairs (both placed) — the connection-eligible edges. */
  _adjacentPairs() {
    const pairs = [];
    const nodes = this._design.nodes;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (this._areAdjacent(nodes[i], nodes[j])) pairs.push([nodes[i], nodes[j]]);
      }
    }
    return pairs;
  }

  _connState(aId, bId) {
    const c = this._design.connections.find(
      (x) => (x.a === aId && x.b === bId) || (x.a === bId && x.b === aId),
    );
    return c ? c.state : 'none';
  }

  _setConnState(aId, bId, state) {
    const idx = this._design.connections.findIndex(
      (x) => (x.a === aId && x.b === bId) || (x.a === bId && x.b === aId),
    );
    if (state === 'none') {
      if (idx !== -1) this._design.connections.splice(idx, 1);
      return;
    }
    if (idx === -1) this._design.connections.push({ a: aId, b: bId, state });
    else this._design.connections[idx].state = state;
  }

  /** Remove connections whose endpoints are missing or no longer adjacent. */
  _pruneConnections() {
    this._design.connections = this._design.connections.filter((c) => {
      const a = this._node(c.a); const b = this._node(c.b);
      return a && b && this._areAdjacent(a, b);
    });
  }

  /** Empty cells adjacent to at least one placed node (candidate ghost slots). */
  _ghostCells() {
    const occ = new Set(this._design.nodes.map((n) => axialKey(n.q, n.r)));
    const out = new Map();
    for (const n of this._design.nodes) {
      for (const nb of neighbors(n.q, n.r)) {
        const k = axialKey(nb.q, nb.r);
        if (!occ.has(k) && !out.has(k)) out.set(k, nb);
      }
    }
    return [...out.values()];
  }

  // ── Context / lifecycle ────────────────────────────────────────────────────

  async _prepareContext() { return {}; }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }

    this._canvas = root.querySelector('[data-sb-canvas]');
    this._ctx = this._canvas?.getContext('2d') ?? null;
    this._statusEl = root.querySelector('[data-sb-status]');

    this._renderRail();

    if (this._canvas) {
      this._canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
      this._canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
      this._canvas.addEventListener('pointermove', this._onPointerMove.bind(this));
      this._canvas.addEventListener('pointerup', this._onPointerUp.bind(this));
      this._canvas.addEventListener('pointerleave', this._onPointerUp.bind(this));
    }
    window.addEventListener('keydown', this._onKeyDownBound);

    const wrap = root.querySelector('.cpb-sb-canvas-wrap');
    if (wrap && 'ResizeObserver' in window) {
      this._resizeObserver = new ResizeObserver(() => {
        this._resizeCanvas();
        if (!this._viewReady) { this._fitView(); this._viewReady = true; }
        this._draw();
      });
      this._resizeObserver.observe(wrap);
    }

    requestAnimationFrame(() => {
      this._resizeCanvas();
      if (!this._viewReady) { this._fitView(); this._viewReady = true; }
      this._draw();
      this._updateHistoryUI();
    });
  }

  async close(options) {
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    window.removeEventListener('keydown', this._onKeyDownBound);
    this._ctx = null;
    this._canvas = null;
    if (CyberBlueSubnetBuilder._instance === this) CyberBlueSubnetBuilder._instance = null;
    return super.close(options);
  }

  // ── Undo / redo ─────────────────────────────────────────────────────────────

  static HISTORY_LIMIT = 50;

  _snapshot() { return foundry.utils.deepClone(this._design); }

  _commitHistory(prev) {
    this._undoStack.push(prev);
    if (this._undoStack.length > CyberBlueSubnetBuilder.HISTORY_LIMIT) this._undoStack.shift();
    this._redoStack.length = 0;
    this._updateHistoryUI();
  }

  _pushHistory() { this._commitHistory(this._snapshot()); }

  _undo() {
    if (!this._undoStack.length) return;
    this._redoStack.push(this._snapshot());
    this._design = this._undoStack.pop();
    this._afterHistorySwap();
  }

  _redo() {
    if (!this._redoStack.length) return;
    this._undoStack.push(this._snapshot());
    this._design = this._redoStack.pop();
    this._afterHistorySwap();
  }

  _afterHistorySwap() {
    if (!this._node(this._selectedNodeId)) this._selectedNodeId = null;
    this._drag = null;
    this._renderRail();
    this._draw();
    this._updateHistoryUI();
  }

  _updateHistoryUI() {
    const root = this.element;
    if (!root) return;
    const u = root.querySelector('[data-action="undo"]');
    const r = root.querySelector('[data-action="redo"]');
    if (u) u.disabled = this._undoStack.length === 0;
    if (r) r.disabled = this._redoStack.length === 0;
  }

  // ── Side rail (node list + node options) ────────────────────────────────────

  _esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  _renderRail() {
    const rail = this.element?.querySelector('[data-sb-rail]');
    if (!rail) return;
    const L = (k) => game.i18n.localize(k);

    const rows = this._design.nodes.map((n, i) => {
      const typeLabel = L(NODE_TYPE_LABELS[n.type]);
      const display = (n.label?.trim()) || `${typeLabel} ${i + 1}`;
      const sel = n.id === this._selectedNodeId ? ' selected' : '';
      return `
        <li class="cpb-sb-node-row${sel}" data-node-id="${this._esc(n.id)}">
          <span class="cpb-sb-swatch" style="background:${NODE_COLORS[n.type]}"></span>
          <span class="cpb-sb-node-label">${this._esc(display)}</span>
          <span class="cpb-sb-node-type">${this._esc(typeLabel)}</span>
        </li>`;
    }).join('');

    rail.innerHTML = `
      <h3 class="cpb-sb-rail-title">${L('CYBER_BLUE.SubnetBuilder.Nodes')} (${this._design.nodes.length})</h3>
      <ul class="cpb-sb-node-list">${rows}</ul>
      <div class="cpb-sb-props" data-sb-props>${this._nodePropsHtml()}</div>
    `;

    rail.querySelectorAll('.cpb-sb-node-row').forEach((row) => {
      row.addEventListener('click', () => this._selectNode(row.dataset.nodeId));
    });
    this._wireRailInputs(rail);
  }

  _nodePropsHtml() {
    const L = (k) => game.i18n.localize(k);
    const node = this._node(this._selectedNodeId);
    if (!node) return `<p class="cpb-sb-props-hint">${L('CYBER_BLUE.SubnetBuilder.PropsHint')}</p>`;

    const typeOptions = NODE_TYPES.map((t) =>
      `<option value="${t}"${t === node.type ? ' selected' : ''}>${this._esc(L(NODE_TYPE_LABELS[t]))}</option>`,
    ).join('');

    const accBlock = node.type === 'acc' ? `
      <div class="cpb-sb-prop-field">
        <label>${L('CYBER_BLUE.SubnetBuilder.AccessPointUuid')}</label>
        <input type="text" data-prop="accessPointUuid" placeholder="Scene.x.Region.y"
               value="${this._esc(node.accessPointUuid ?? '')}" />
        <p class="cpb-sb-hint">${L('CYBER_BLUE.SubnetBuilder.AccessPointHint')}</p>
      </div>` : '';

    const programRows = (node.programs ?? []).map((uuid, i) => `
      <li class="cpb-sb-prog-row">
        <span class="cpb-sb-prog-uuid" title="${this._esc(uuid)}">${this._esc(uuid)}</span>
        <button type="button" class="cpb-sb-prog-remove" data-prog-index="${i}" title="${L('CYBER_BLUE.SubnetBuilder.RemoveProgram')}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </li>`).join('');

    return `
      <h4 class="cpb-sb-props-title">${L('CYBER_BLUE.SubnetBuilder.NodeOptions')}</h4>
      <div class="cpb-sb-prop-field">
        <label>${L('CYBER_BLUE.SubnetBuilder.TypeField')}</label>
        <select data-prop="type">${typeOptions}</select>
      </div>
      <div class="cpb-sb-prop-field">
        <label>${L('CYBER_BLUE.SubnetBuilder.LabelField')}</label>
        <input type="text" data-prop="label" value="${this._esc(node.label ?? '')}" />
      </div>
      ${accBlock}
      <div class="cpb-sb-prop-field">
        <label>${L('CYBER_BLUE.SubnetBuilder.Programs')}</label>
        <ul class="cpb-sb-prog-list">${programRows}</ul>
        <div class="cpb-sb-prog-add">
          <input type="text" data-sb-prog-input placeholder="Actor.x.Item.y" />
          <button type="button" data-sb-prog-add title="${L('CYBER_BLUE.SubnetBuilder.AddProgram')}">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
        <p class="cpb-sb-hint">${L('CYBER_BLUE.SubnetBuilder.ProgramsHint')}</p>
      </div>
      <button type="button" class="button cpb-sb-delete" data-sb-delete-node>
        <i class="fa-solid fa-trash"></i> ${L('CYBER_BLUE.SubnetBuilder.DeleteNode')}
      </button>`;
  }

  _wireRailInputs(rail) {
    const node = this._node(this._selectedNodeId);
    if (!node) return;

    rail.querySelector('[data-prop="type"]')?.addEventListener('change', (ev) => {
      this._pushHistory();
      node.type = ev.currentTarget.value;
      this._renderRail();
      this._draw();
    });
    rail.querySelector('[data-prop="label"]')?.addEventListener('change', (ev) => {
      this._pushHistory();
      node.label = ev.currentTarget.value;
      this._renderRail();
      this._draw();
    });
    rail.querySelector('[data-prop="accessPointUuid"]')?.addEventListener('change', (ev) => {
      this._pushHistory();
      node.accessPointUuid = ev.currentTarget.value.trim();
    });

    const addProg = () => {
      const input = rail.querySelector('[data-sb-prog-input]');
      const uuid = (input?.value ?? '').trim();
      if (!uuid) return;
      this._pushHistory();
      if (!Array.isArray(node.programs)) node.programs = [];
      node.programs.push(uuid);
      this._renderRail();
    };
    rail.querySelector('[data-sb-prog-add]')?.addEventListener('click', addProg);
    rail.querySelector('[data-sb-prog-input]')?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); addProg(); }
    });
    rail.querySelectorAll('.cpb-sb-prog-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.progIndex);
        if (!Number.isInteger(idx)) return;
        this._pushHistory();
        node.programs.splice(idx, 1);
        this._renderRail();
      });
    });
    rail.querySelector('[data-sb-delete-node]')?.addEventListener('click', () => this._deleteNode(node.id));
  }

  // ── View transform ───────────────────────────────────────────────────────

  _resizeCanvas() {
    if (!this._canvas) return;
    const wrap = this._canvas.parentElement;
    if (!wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, wrap.clientWidth);
    const ch = Math.max(1, wrap.clientHeight);
    this._canvas.width = Math.round(cw * dpr);
    this._canvas.height = Math.round(ch * dpr);
    this._canvas.style.width = `${cw}px`;
    this._canvas.style.height = `${ch}px`;
    this._cssW = cw; this._cssH = ch; this._dpr = dpr;
  }

  _fitView() {
    const b = latticeBounds(this._design.nodes);
    const w = (b.maxX - b.minX) || HEX_SIZE;
    const h = (b.maxY - b.minY) || HEX_SIZE;
    const vw = (this._cssW ?? 1) - CANVAS_PADDING * 2;
    const vh = (this._cssH ?? 1) - CANVAS_PADDING * 2;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(vw / w, vh / h)));
    this._view = {
      scale,
      x: ((this._cssW ?? 1) - w * scale) / 2 - b.minX * scale,
      y: ((this._cssH ?? 1) - h * scale) / 2 - b.minY * scale,
    };
  }

  _worldToScreen(wx, wy) {
    return { x: wx * this._view.scale + this._view.x, y: wy * this._view.scale + this._view.y };
  }

  _screenToWorld(sx, sy) {
    return { x: (sx - this._view.x) / this._view.scale, y: (sy - this._view.y) / this._view.scale };
  }

  _eventPos(ev) {
    const rect = this._canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    if (!ctx || !this._canvas) return;
    const dpr = this._dpr ?? 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this._cssW ?? 0, this._cssH ?? 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this._cssW ?? 0, this._cssH ?? 0);

    this._drawGhosts(ctx);
    this._drawConnections(ctx);
    this._drawNodes(ctx);
  }

  _tracePolygonScreen(ctx, pts) {
    ctx.beginPath();
    const first = this._worldToScreen(pts[0], pts[1]);
    ctx.moveTo(first.x, first.y);
    for (let i = 2; i < pts.length; i += 2) {
      const p = this._worldToScreen(pts[i], pts[i + 1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  _drawGhosts(ctx) {
    for (const cell of this._ghostCells()) {
      const c = axialToPixel(cell.q, cell.r);
      const pts = hexPolygonPoints(c.x, c.y, HEX_SIZE * DRAW_FRAC);
      this._tracePolygonScreen(ctx, pts);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(120,200,255,0.35)';
      ctx.stroke();
      ctx.setLineDash([]);
      // plus glyph
      const s = this._worldToScreen(c.x, c.y);
      const g = Math.max(6, 26 * this._view.scale);
      ctx.strokeStyle = 'rgba(120,200,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - g, s.y); ctx.lineTo(s.x + g, s.y);
      ctx.moveTo(s.x, s.y - g); ctx.lineTo(s.x, s.y + g);
      ctx.stroke();
    }
  }

  _drawConnections(ctx) {
    for (const [a, b] of this._adjacentPairs()) {
      const ca = axialToPixel(a.q, a.r);
      const cb = axialToPixel(b.q, b.r);
      const sa = this._worldToScreen(ca.x, ca.y);
      const sb = this._worldToScreen(cb.x, cb.y);
      const mid = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };
      const state = this._connState(a.id, b.id);

      let color; let dash = [];
      if (state === 'connected') color = '#38d66b';
      else if (state === 'passwall') color = '#f0a020';
      else { color = '#c0392b'; dash = [4, 4]; }

      ctx.save();
      ctx.setLineDash(dash);
      ctx.lineWidth = state === 'none' ? 2 : 4;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Glyph chip at midpoint.
      const rad = 11;
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0e13';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Vector glyph (no font dependency).
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      if (state === 'none') {
        ctx.fillRect(mid.x - 4, mid.y - 4, 8, 8);                 // solid wall
      } else if (state === 'connected') {
        ctx.beginPath();                                          // open door (uprights)
        ctx.moveTo(mid.x - 4, mid.y - 5); ctx.lineTo(mid.x - 4, mid.y + 5);
        ctx.moveTo(mid.x + 4, mid.y - 5); ctx.lineTo(mid.x + 4, mid.y + 5);
        ctx.stroke();
      } else {
        ctx.fillRect(mid.x - 4, mid.y - 1, 8, 6);                 // padlock body
        ctx.beginPath();
        ctx.arc(mid.x, mid.y - 1, 3, Math.PI, 0);                 // shackle
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawNodes(ctx) {
    for (const n of this._design.nodes) {
      const c = axialToPixel(n.q, n.r);
      const pts = hexPolygonPoints(c.x, c.y, HEX_SIZE * DRAW_FRAC);
      const color = NODE_COLORS[n.type] ?? '#7f8c8d';
      const isSel = n.id === this._selectedNodeId;

      this._tracePolygonScreen(ctx, pts);
      ctx.fillStyle = this._hexToRgba(color, isSel ? 0.4 : 0.22);
      ctx.fill();
      ctx.lineWidth = isSel ? 4 : 2.5;
      ctx.strokeStyle = isSel ? '#ffffff' : color;
      ctx.stroke();

      // Type text + label.
      const s = this._worldToScreen(c.x, c.y);
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const big = Math.max(10, 46 * this._view.scale);
      ctx.font = `700 ${big}px sans-serif`;
      ctx.fillText(n.type.toUpperCase(), s.x, s.y - (n.label ? big * 0.35 : 0));
      if (n.label) {
        const small = Math.max(8, 26 * this._view.scale);
        ctx.font = `${small}px sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(n.label, s.x, s.y + big * 0.55);
      }
      // Program count badge.
      const pc = (n.programs ?? []).length;
      if (pc) {
        const bs = this._worldToScreen(c.x + HEX_SIZE * DRAW_FRAC * 0.45, c.y - HEX_SIZE * DRAW_FRAC * 0.45);
        ctx.beginPath();
        ctx.arc(bs.x, bs.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#111820';
        ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText(String(pc), bs.x, bs.y + 0.5);
      }
    }
  }

  _hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Hit testing ──────────────────────────────────────────────────────────

  _gapAt(cssX, cssY) {
    for (const [a, b] of this._adjacentPairs()) {
      const pa = axialToPixel(a.q, a.r);
      const pb = axialToPixel(b.q, b.r);
      const ca = this._worldToScreen(pa.x, pa.y);
      const cb = this._worldToScreen(pb.x, pb.y);
      const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
      if (Math.hypot(mid.x - cssX, mid.y - cssY) <= GAP_HIT) return [a, b];
    }
    return null;
  }

  _nodeAt(cssX, cssY) {
    const w = this._screenToWorld(cssX, cssY);
    // Nearest hex by pixel→axial, then confirm point is inside a placed hex.
    const ax = pixelToAxial(w.x, w.y);
    const node = this._nodeAtAxial(ax.q, ax.r);
    if (node) {
      const c = axialToPixel(node.q, node.r);
      if (pointInHex(w.x, w.y, c.x, c.y, HEX_SIZE)) return node;
    }
    return null;
  }

  _ghostAt(cssX, cssY) {
    const w = this._screenToWorld(cssX, cssY);
    const ax = pixelToAxial(w.x, w.y);
    for (const cell of this._ghostCells()) {
      if (cell.q === ax.q && cell.r === ax.r) {
        const c = axialToPixel(cell.q, cell.r);
        if (pointInHex(w.x, w.y, c.x, c.y, HEX_SIZE)) return cell;
      }
    }
    return null;
  }

  // ── Interactions ─────────────────────────────────────────────────────────

  _onWheel(ev) {
    ev.preventDefault();
    const pos = this._eventPos(ev);
    const factor = ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this._view.scale * factor));
    if (newScale === this._view.scale) return;
    const worldAt = this._screenToWorld(pos.x, pos.y);
    this._view.scale = newScale;
    this._view.x = pos.x - worldAt.x * newScale;
    this._view.y = pos.y - worldAt.y * newScale;
    this._draw();
  }

  _onPointerDown(ev) {
    this._canvas?.focus?.();
    const pos = this._eventPos(ev);

    // 1) Connection toggle (shared-edge midpoint chip).
    const gap = this._gapAt(pos.x, pos.y);
    if (gap) {
      const [a, b] = gap;
      const cur = this._connState(a.id, b.id);
      const next = CONN_CYCLE[(CONN_CYCLE.indexOf(cur) + 1) % CONN_CYCLE.length];
      this._pushHistory();
      this._setConnState(a.id, b.id, next);
      this._draw();
      return;
    }

    // 2) Node body → select; begin possible drag.
    const node = this._nodeAt(pos.x, pos.y);
    if (node) {
      this._selectNode(node.id);
      this._drag = {
        mode: 'node', nodeId: node.id,
        startX: pos.x, startY: pos.y, moved: false,
        origin: { q: node.q, r: node.r },
        snapshot: this._snapshot(),
      };
      this._canvas.setPointerCapture?.(ev.pointerId);
      return;
    }

    // 3) Ghost slot → add a node.
    const ghost = this._ghostAt(pos.x, pos.y);
    if (ghost) { this._addNode(ghost.q, ghost.r); return; }

    // 4) Empty space → pan.
    this._drag = { mode: 'pan', lastX: pos.x, lastY: pos.y };
    this._canvas.setPointerCapture?.(ev.pointerId);
  }

  _onPointerMove(ev) {
    const drag = this._drag;
    if (!drag) return;
    const pos = this._eventPos(ev);

    if (drag.mode === 'pan') {
      this._view.x += pos.x - drag.lastX;
      this._view.y += pos.y - drag.lastY;
      drag.lastX = pos.x; drag.lastY = pos.y;
      this._draw();
      return;
    }
    if (drag.mode === 'node') {
      if (Math.hypot(pos.x - drag.startX, pos.y - drag.startY) > 5) drag.moved = true;
      if (drag.moved) {
        // Live preview: move node to the hovered axial if valid, else keep origin.
        const w = this._screenToWorld(pos.x, pos.y);
        const ax = pixelToAxial(w.x, w.y);
        drag.hover = ax;
        this._draw();
        this._drawDropPreview(ax, drag.nodeId);
      }
    }
  }

  _drawDropPreview(ax, nodeId) {
    const ctx = this._ctx;
    if (!ctx) return;
    const valid = this._isValidDrop(ax.q, ax.r, nodeId);
    const c = axialToPixel(ax.q, ax.r);
    const pts = hexPolygonPoints(c.x, c.y, HEX_SIZE * DRAW_FRAC);
    this._tracePolygonScreen(ctx, pts);
    ctx.lineWidth = 3;
    ctx.strokeStyle = valid ? 'rgba(56,214,107,0.9)' : 'rgba(192,57,43,0.9)';
    ctx.stroke();
  }

  /** A drop is valid if the target cell is empty (or unchanged) and shares an
   *  edge with at least one OTHER placed node. */
  _isValidDrop(q, r, nodeId) {
    const node = this._node(nodeId);
    if (!node) return false;
    if (node.q === q && node.r === r) return true; // no-op
    if (this._nodeAtAxial(q, r)) return false;      // occupied
    return this._design.nodes.some((o) =>
      o.id !== nodeId && this._areAdjacent({ q, r }, o));
  }

  _onPointerUp(ev) {
    const drag = this._drag;
    if (!drag) return;
    this._drag = null;
    this._canvas?.releasePointerCapture?.(ev.pointerId);

    if (drag.mode !== 'node') return;
    if (!drag.moved) return; // a click (selection already handled)

    const pos = this._eventPos(ev);
    const w = this._screenToWorld(pos.x, pos.y);
    const ax = pixelToAxial(w.x, w.y);
    const node = this._node(drag.nodeId);
    if (!node) { this._draw(); return; }
    if (node.q === ax.q && node.r === ax.r) { this._draw(); return; }
    if (!this._isValidDrop(ax.q, ax.r, drag.nodeId)) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.SubnetBuilder.InvalidDrop'));
      this._draw();
      return;
    }
    this._commitHistory(drag.snapshot);
    node.q = ax.q; node.r = ax.r;
    this._pruneConnections();
    this._renderRail();
    this._draw();
  }

  _onKeyDown(ev) {
    if (!this.element?.contains(document.activeElement)) return;
    const tag = document.activeElement?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if ((ev.ctrlKey || ev.metaKey) && !inField) {
      const key = ev.key.toLowerCase();
      if (key === 'z' && !ev.shiftKey) { ev.preventDefault(); this._undo(); return; }
      if (key === 'y' || (key === 'z' && ev.shiftKey)) { ev.preventDefault(); this._redo(); return; }
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this._selectedNodeId && !inField) {
      ev.preventDefault();
      this._deleteNode(this._selectedNodeId);
    }
  }

  // ── Node ops ───────────────────────────────────────────────────────────────

  _addNode(q, r) {
    if (this._nodeAtAxial(q, r)) return;
    this._pushHistory();
    const node = { id: foundry.utils.randomID(), q, r, type: 'data', label: '', programs: [], accessPointUuid: '' };
    this._design.nodes.push(node);
    // Auto-connect (as doors) to every currently-placed neighbor, so the graph
    // stays traversable; the GM downgrades to walls/passwalls by clicking.
    for (const o of this._design.nodes) {
      if (o.id !== node.id && this._areAdjacent(node, o)) this._setConnState(node.id, o.id, 'connected');
    }
    this._selectedNodeId = node.id;
    this._renderRail();
    this._draw();
  }

  _selectNode(id) {
    this._selectedNodeId = id ?? null;
    this._renderRail();
    this._draw();
  }

  _deleteNode(id) {
    const idx = this._design.nodes.findIndex((n) => n.id === id);
    if (idx === -1) return;
    if (this._design.nodes.length <= 1) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.SubnetBuilder.CannotDeleteLast'));
      return;
    }
    this._pushHistory();
    this._design.nodes.splice(idx, 1);
    this._design.connections = this._design.connections.filter((c) => c.a !== id && c.b !== id);
    if (this._selectedNodeId === id) this._selectedNodeId = null;
    this._renderRail();
    this._draw();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  static _onFitAction() { this._fitView(); this._draw(); }
  static _onUndoAction() { this._undo(); }
  static _onRedoAction() { this._redo(); }

  static _onExportAction() {
    const data = JSON.stringify(this._design, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subnet-design.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  static _onImportAction() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let parsed = null;
        try { parsed = JSON.parse(String(reader.result)); }
        catch { ui.notifications.error(game.i18n.localize('CYBER_BLUE.SubnetBuilder.ImportInvalid')); return; }
        const design = this._normalizeDesign(parsed);
        if (!design) { ui.notifications.error(game.i18n.localize('CYBER_BLUE.SubnetBuilder.ImportInvalid')); return; }
        const hasContent = this._design.nodes.length > 1 || this._design.connections.length;
        if (hasContent) {
          const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize('CYBER_BLUE.SubnetBuilder.ImportConfirmTitle') },
            content: `<p>${game.i18n.localize('CYBER_BLUE.SubnetBuilder.ImportConfirm')}</p>`,
          });
          if (!ok) return;
        }
        this._pushHistory();
        this._design = design;
        this._selectedNodeId = null;
        this._viewReady = false;
        this._resizeCanvas();
        this._fitView();
        this._viewReady = true;
        this._renderRail();
        this._draw();
        ui.notifications.info(game.i18n.localize('CYBER_BLUE.SubnetBuilder.Imported'));
      };
      reader.readAsText(file);
    });
    input.click();
  }

  static async _onSaveAction() {
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('CYBER_BLUE.SubnetBuilder.SaveTitle') },
      content: `<div class="form-group">
        <label>${game.i18n.localize('CYBER_BLUE.SubnetBuilder.SubnetName')}</label>
        <input type="text" name="subnetName" autofocus placeholder="${game.i18n.localize('CYBER_BLUE.SubnetBuilder.SubnetNamePlaceholder')}" />
      </div>`,
      ok: {
        label: game.i18n.localize('CYBER_BLUE.SubnetBuilder.Build'),
        callback: (_ev, button) => button.form.elements.subnetName?.value?.trim() ?? '',
      },
    }).catch(() => null);
    if (!name) return;

    let scene = null;
    try {
      scene = await buildSubnetScene(foundry.utils.deepClone(this._design), name);
    } catch (err) {
      console.error('Cyberpunk Blue | Subnet build failed:', err);
      ui.notifications.error(game.i18n.format('CYBER_BLUE.SubnetBuilder.BuildFailed', { error: err.message }));
      return;
    }
    if (!scene) return;
    ui.notifications.info(game.i18n.format('CYBER_BLUE.SubnetBuilder.Built', { name }));

    const view = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CYBER_BLUE.SubnetBuilder.ViewTitle') },
      content: `<p>${game.i18n.format('CYBER_BLUE.SubnetBuilder.ViewPrompt', { name })}</p>`,
    });
    if (view) await scene.view();
  }
}
