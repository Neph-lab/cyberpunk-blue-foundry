/**
 * Vehicle Blueprint Editor — standalone window where the vehicle's token art is
 * the canvas for authoring region zones (driver/gunner/passenger seats, vital
 * areas, roof).
 *
 * The token art is the drawing surface. Coordinates are token-local pixels at
 * `blueprint.referenceGrid` px per grid square; the footprint is the token's
 * grid footprint. Shapes are stored with `offset {0,0}` and absolute token-local
 * coordinates in the shape itself (so shape coords == token-local px), matching
 * the materialiser in `vehicle-regions.mjs`.
 *
 * Rendering substrate: a plain HTML5 Canvas 2D context (no PIXI — user-validated;
 * the editor only needs to represent, drag, size, and configure regions).
 *
 * Open via: CyberBlueVehicleBlueprintEditor.open(actor)  (GM only, one window
 * per actor).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { traceShapePath, pointInShape, behaviorColor } from '../helpers/vehicle-shapes.mjs';
import { captureRegionsFromToken } from '../helpers/vehicle-regions.mjs';
import { VEHICLE_CRIT_TABLE_NAMES } from '../helpers/vehicle-damage.mjs';

/** Human-readable label per registered behavior type. */
const BEHAVIOR_LABELS = {
  '':            'CYBER_BLUE.BlueprintEditor.TypeNone',
  driverSeat:    'CYBER_BLUE.RegionBehavior.DriverSeat.Label',
  gunnerSeat:    'CYBER_BLUE.RegionBehavior.GunnerSeat.Label',
  passengerSeat: 'CYBER_BLUE.RegionBehavior.PassengerSeat.Label',
  vitalArea:     'CYBER_BLUE.RegionBehavior.VitalArea.Label',
  vehicleRoof:   'CYBER_BLUE.RegionBehavior.VehicleRoof.Label',
};

const BEHAVIOR_ORDER = ['', 'driverSeat', 'gunnerSeat', 'passengerSeat', 'vitalArea', 'vehicleRoof'];

const CANVAS_PADDING = 24;   // px of breathing room around the footprint when fitting
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const ZOOM_STEP = 1.1;
const HANDLE = 9;            // on-screen handle size (px)
const HANDLE_HIT = 8;        // handle hit-test half-extent (px)
const MIN_DIM = 4;           // minimum drawn width/height/radius (token-local px) to commit

export class CyberBlueVehicleBlueprintEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {Map<string, CyberBlueVehicleBlueprintEditor>} actor.id → open instance */
  static _instances = new Map();

  static DEFAULT_OPTIONS = {
    classes: ['cyberpunk-blue', 'vehicle-blueprint-editor'],
    tag: 'div',
    window: {
      title: 'CYBER_BLUE.BlueprintEditor.Title',
      resizable: true,
    },
    position: { width: 1000, height: 720 },
    actions: {
      fit: CyberBlueVehicleBlueprintEditor._onFitAction,
      tool: CyberBlueVehicleBlueprintEditor._onToolAction,
      capture: CyberBlueVehicleBlueprintEditor._onCaptureAction,
      undo: CyberBlueVehicleBlueprintEditor._onUndoAction,
      redo: CyberBlueVehicleBlueprintEditor._onRedoAction,
      'delete-region': CyberBlueVehicleBlueprintEditor._onDeleteAction,
    },
  };

  static PARTS = {
    body: {
      template: 'systems/cyberpunk-blue/templates/apps/vehicle-blueprint-editor.hbs',
    },
  };

  /**
   * Open (or focus) the editor for a vehicle actor. GM only.
   * @param {Actor} actor
   * @returns {CyberBlueVehicleBlueprintEditor|null}
   */
  static open(actor) {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.BlueprintEditor.GMOnly'));
      return null;
    }
    if (!actor || actor.type !== 'vehicle') return null;

    const existing = CyberBlueVehicleBlueprintEditor._instances.get(actor.id);
    if (existing) {
      existing.bringToFront();
      return existing;
    }
    const app = new CyberBlueVehicleBlueprintEditor(actor);
    CyberBlueVehicleBlueprintEditor._instances.set(actor.id, app);
    app.render(true);
    return app;
  }

  /** @param {Actor} actor */
  constructor(actor) {
    super();
    this.actor = actor;
    /** world→screen transform: screen = world * scale + (x|y) */
    this._view = { scale: 1, x: 0, y: 0 };
    this._viewReady = false;
    this._selectedRegionId = null;
    /** Working copy of the blueprint regions (deep-cloned plain objects). */
    this._regions = foundry.utils.deepClone(actor.system?.blueprint?.regions ?? []);
    /** Undo / redo history — each entry is a deep-cloned `_regions` snapshot. */
    this._undoStack = [];
    this._redoStack = [];
    /** Pre-drag snapshot, captured at pointerdown for move/resize/vertex. */
    this._dragSnapshot = null;
    /** Active tool: 'select' | 'rectangle' | 'circle' | 'ellipse' | 'polygon'. */
    this._tool = 'select';
    /** In-progress shape during a draw gesture. */
    this._draft = null;
    /** Active manipulation state (move / resize / vertex / pan / draw). */
    this._drag = null;
    /** Last pointer position in world coords (polygon preview). */
    this._mouseWorld = null;
    /** @type {HTMLImageElement|null} */
    this._artImage = null;
    this._artLoaded = false;
    this._resizeObserver = null;
    this._onKeyDownBound = this._onKeyDown.bind(this);
  }

  get title() {
    return game.i18n.format('CYBER_BLUE.BlueprintEditor.TitleFor', { name: this.actor?.name ?? '' });
  }

  // ── Context ─────────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const bp = this.actor.system.blueprint ?? {};
    const proto = this.actor.prototypeToken ?? {};
    const artSrc = proto.texture?.src || this.actor.img || '';
    return {
      actor: this.actor,
      artSrc,
      hasArt: !!artSrc,
      footprintW: proto.width ?? 1,
      footprintH: proto.height ?? 1,
      referenceGrid: bp.referenceGrid ?? 100,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }

    this._canvas = root.querySelector('[data-be-canvas]');
    this._ctx = this._canvas?.getContext('2d') ?? null;
    this._statusEl = root.querySelector('[data-be-status]');

    this._ensureArtImage(context.artSrc);
    this._renderRail();

    if (this._canvas) {
      this._canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
      this._canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
      this._canvas.addEventListener('pointermove', this._onPointerMove.bind(this));
      this._canvas.addEventListener('pointerup', this._onPointerUp.bind(this));
      this._canvas.addEventListener('pointerleave', this._onPointerUp.bind(this));
      this._canvas.addEventListener('dblclick', this._onDblClick.bind(this));
    }
    window.addEventListener('keydown', this._onKeyDownBound);

    const wrap = root.querySelector('.cpb-be-canvas-wrap');
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
      this._updateToolUI();
      this._updateHistoryUI();
    });
  }

  async close(options) {
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    window.removeEventListener('keydown', this._onKeyDownBound);
    this._artImage = null;
    this._ctx = null;
    this._canvas = null;
    CyberBlueVehicleBlueprintEditor._instances.delete(this.actor?.id);
    return super.close(options);
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  async _persist() {
    try {
      await this.actor.update({ 'system.blueprint.regions': this._regions });
    } catch (err) {
      console.error('Cyberpunk Blue | Failed to save vehicle blueprint:', err);
      ui.notifications.error(game.i18n.localize('CYBER_BLUE.BlueprintEditor.SaveFailed'));
    }
  }

  _findRegion(regionId) {
    return this._regions.find((r) => r.regionId === regionId) ?? null;
  }

  // ── Undo / redo ──────────────────────────────────────────────────────────────

  static HISTORY_LIMIT = 50;

  _snapshot() {
    return foundry.utils.deepClone(this._regions);
  }

  /**
   * Record the given (pre-mutation) snapshot on the undo stack and clear the
   * redo stack. Call BEFORE mutating `_regions`, passing the state as it was.
   */
  _commitHistory(prevSnapshot) {
    this._undoStack.push(prevSnapshot);
    if (this._undoStack.length > CyberBlueVehicleBlueprintEditor.HISTORY_LIMIT) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
    this._updateHistoryUI();
  }

  /** Snapshot the current state onto the undo stack (convenience for callers). */
  _pushHistory() {
    this._commitHistory(this._snapshot());
  }

  _undo() {
    if (!this._undoStack.length) return;
    this._redoStack.push(this._snapshot());
    this._regions = this._undoStack.pop();
    this._afterHistorySwap();
  }

  _redo() {
    if (!this._redoStack.length) return;
    this._undoStack.push(this._snapshot());
    this._regions = this._redoStack.pop();
    this._afterHistorySwap();
  }

  _afterHistorySwap() {
    if (!this._findRegion(this._selectedRegionId)) this._selectedRegionId = null;
    this._draft = null;
    this._drag = null;
    this._persist();
    this._renderRail();
    this._draw();
    this._updateHistoryUI();
  }

  _updateHistoryUI() {
    const root = this.element;
    if (!root) return;
    const undoBtn = root.querySelector('[data-action="undo"]');
    const redoBtn = root.querySelector('[data-action="redo"]');
    if (undoBtn) undoBtn.disabled = this._undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = this._redoStack.length === 0;
  }

  // ── Rail (region list + property panel) ─────────────────────────────────────

  _renderRail() {
    const rail = this.element?.querySelector('[data-be-rail]');
    if (!rail) return;

    const L = (k) => game.i18n.localize(k);
    const rows = this._regions.map((r, i) => {
      const typeLabel = L(BEHAVIOR_LABELS[r.behaviorType] ?? BEHAVIOR_LABELS['']);
      const display = (r.label?.trim()) || `${typeLabel} ${i + 1}`;
      const sel = r.regionId === this._selectedRegionId ? ' selected' : '';
      return `
        <li class="cpb-be-region-row${sel}" data-region-id="${this._esc(r.regionId)}">
          <span class="cpb-be-swatch" style="background:${behaviorColor(r.behaviorType)}"></span>
          <span class="cpb-be-region-label">${this._esc(display)}</span>
          <span class="cpb-be-region-type">${this._esc(typeLabel)}</span>
        </li>`;
    }).join('');

    const listHtml = this._regions.length
      ? `<ul class="cpb-be-region-list">${rows}</ul>`
      : `<p class="cpb-be-empty">${L('CYBER_BLUE.BlueprintEditor.Empty')}</p>`;

    rail.innerHTML = `
      <h3 class="cpb-be-rail-title">${L('CYBER_BLUE.BlueprintEditor.Regions')}</h3>
      ${listHtml}
      <div class="cpb-be-props" data-be-props>${this._propsHtml()}</div>
    `;

    rail.querySelectorAll('.cpb-be-region-row').forEach((row) => {
      row.addEventListener('click', () => this._selectRegion(row.dataset.regionId));
    });
    this._wirePropInputs(rail);
  }

  _propsHtml() {
    const L = (k) => game.i18n.localize(k);
    const region = this._findRegion(this._selectedRegionId);
    if (!region) {
      return `<p class="cpb-be-props-hint">${L('CYBER_BLUE.BlueprintEditor.PropsHint')}</p>`;
    }

    const options = BEHAVIOR_ORDER.map((t) => {
      const sel = t === region.behaviorType ? ' selected' : '';
      return `<option value="${t}"${sel}>${this._esc(L(BEHAVIOR_LABELS[t]))}</option>`;
    }).join('');

    const cfg = region.behaviorConfig ?? {};
    let configFields = '';
    if (region.behaviorType === 'gunnerSeat') {
      configFields = `
        <div class="cpb-be-prop-field">
          <label>${L('CYBER_BLUE.RegionBehavior.GunnerSeat.SeatIndex')}</label>
          <input type="number" data-cfg="seatIndex" value="${Number(cfg.seatIndex ?? 0)}" min="0" step="1" />
        </div>`;
    } else if (region.behaviorType === 'vitalArea') {
      const linked = cfg.subsystemItemId ? this.actor.items.get(cfg.subsystemItemId) : null;
      const sub = linked?.type === 'vehicleSubsystem' ? linked : null;
      const subFields = sub ? `
        <div class="cpb-be-prop-field cpb-be-prop-row">
          <span class="cpb-be-prop-sub">
            <label>${L('CYBER_BLUE.BlueprintEditor.Vital.HP')}</label>
            <input type="number" data-sub="hp" min="1" step="1" value="${Number(sub.system.hp?.max ?? 10)}" />
          </span>
          <span class="cpb-be-prop-sub">
            <label>${L('CYBER_BLUE.BlueprintEditor.Vital.SP')}</label>
            <input type="number" data-sub="sp" min="0" step="1" value="${Number(sub.system.sp?.max ?? 0)}" />
          </span>
        </div>
        <div class="cpb-be-prop-field">
          <label>${L('CYBER_BLUE.BlueprintEditor.Vital.EnableEffect')}</label>
          <select data-sub="enableEffectId">${this._effectOptions(sub.system.enableEffectId)}</select>
        </div>
        <div class="cpb-be-prop-field">
          <label>${L('CYBER_BLUE.BlueprintEditor.Vital.DestroyCrit')}</label>
          <select data-sub="boundCriticalEntryId">${this._critOptions(sub.system.boundCriticalEntryId)}</select>
        </div>` : '';
      configFields = `
        <div class="cpb-be-prop-field">
          <label>${L('CYBER_BLUE.BlueprintEditor.Vital.Subsystem')}</label>
          <select data-vital="subsystemItemId">${this._subsystemOptions(cfg.subsystemItemId)}</select>
        </div>
        ${subFields}
        <div class="cpb-be-prop-field">
          <label>${L('CYBER_BLUE.BlueprintEditor.Vital.TargetedCrit')}</label>
          <select data-cfg="criticalDamageEntryId">${this._critOptions(cfg.criticalDamageEntryId)}</select>
        </div>`;
    }

    return `
      <h4 class="cpb-be-props-title">${L('CYBER_BLUE.BlueprintEditor.Properties')}</h4>
      <div class="cpb-be-prop-field">
        <label>${L('CYBER_BLUE.BlueprintEditor.LabelField')}</label>
        <input type="text" data-prop="label" value="${this._esc(region.label ?? '')}" />
      </div>
      <div class="cpb-be-prop-field">
        <label>${L('CYBER_BLUE.BlueprintEditor.TypeField')}</label>
        <select data-prop="behaviorType">${options}</select>
      </div>
      ${configFields}
      <div class="cpb-be-prop-shape">${this._esc(region.shape?.type ?? '—')}</div>
      <button type="button" class="button cpb-be-delete" data-action="delete-region">
        <i class="fa-solid fa-trash"></i> ${L('CYBER_BLUE.BlueprintEditor.DeleteRegion')}
      </button>`;
  }

  _wirePropInputs(rail) {
    const region = this._findRegion(this._selectedRegionId);
    if (!region) return;

    rail.querySelector('[data-prop="label"]')?.addEventListener('change', (ev) => {
      this._pushHistory();
      region.label = ev.currentTarget.value;
      this._persist();
      this._renderRail();
    });

    rail.querySelector('[data-prop="behaviorType"]')?.addEventListener('change', (ev) => {
      this._pushHistory();
      region.behaviorType = ev.currentTarget.value;
      region.behaviorConfig = this._defaultConfigFor(region.behaviorType);
      this._persist();
      this._renderRail();
      this._draw();
    });

    rail.querySelectorAll('[data-cfg]').forEach((input) => {
      input.addEventListener('change', (ev) => {
        const key = ev.currentTarget.dataset.cfg;
        const val = ev.currentTarget.type === 'number'
          ? Number(ev.currentTarget.value)
          : ev.currentTarget.value;
        this._pushHistory();
        if (!region.behaviorConfig || typeof region.behaviorConfig !== 'object') region.behaviorConfig = {};
        region.behaviorConfig[key] = val;
        this._persist();
      });
    });

    // Vital-area subsystem link (select existing or create a new subsystem item).
    rail.querySelector('[data-vital="subsystemItemId"]')?.addEventListener('change', async (ev) => {
      const val = ev.currentTarget.value;
      if (val === '__new__') {
        await this._createSubsystemFor(region);
      } else {
        this._pushHistory();
        if (!region.behaviorConfig || typeof region.behaviorConfig !== 'object') region.behaviorConfig = {};
        region.behaviorConfig.subsystemItemId = val || null;
        this._persist();
      }
      this._renderRail();
    });

    // Subsystem item fields (HP/SP pools + destruction triggers) — direct item writes.
    rail.querySelectorAll('[data-sub]').forEach((input) => {
      input.addEventListener('change', async (ev) => {
        const sub = this.actor.items.get(region.behaviorConfig?.subsystemItemId);
        if (sub?.type !== 'vehicleSubsystem') return;
        const key = ev.currentTarget.dataset.sub;
        let update = null;
        if (key === 'hp') {
          const n = Math.max(1, Math.floor(Number(ev.currentTarget.value) || 1));
          update = { 'system.hp.max': n, 'system.hp.value': n, 'system.destroyed': false };
        } else if (key === 'sp') {
          const n = Math.max(0, Math.floor(Number(ev.currentTarget.value) || 0));
          update = { 'system.sp.max': n, 'system.sp.value': n };
        } else if (key === 'enableEffectId') {
          update = { 'system.enableEffectId': ev.currentTarget.value || null };
        } else if (key === 'boundCriticalEntryId') {
          update = { 'system.boundCriticalEntryId': ev.currentTarget.value || null };
        }
        if (update) {
          await sub.update(update);
          this._renderRail();
        }
      });
    });
  }

  /**
   * Create a fresh vehicle-subsystem item on the actor (full HP, no SP) and link
   * it to the given vital-area region. Used by the "New subsystem" picker option.
   */
  async _createSubsystemFor(region) {
    const name = (region.label?.trim())
      || game.i18n.localize('CYBER_BLUE.BlueprintEditor.Vital.NewSubsystemName');
    const [item] = await this.actor.createEmbeddedDocuments('Item', [{
      name,
      type: 'vehicleSubsystem',
      system: { hp: { value: 10, max: 10 }, sp: { value: 0, max: 0 } },
    }]);
    if (!item) return;
    this._pushHistory();
    if (!region.behaviorConfig || typeof region.behaviorConfig !== 'object') region.behaviorConfig = {};
    region.behaviorConfig.subsystemItemId = item.id;
    this._persist();
  }

  // ── Vital-area option builders ───────────────────────────────────────────────

  /** Resolve the vehicle's critical damage RollTable (by id, else by category name). */
  _getCritTable() {
    const id = this.actor?.system?.critTableId;
    if (id) { const t = game.tables.get(id); if (t) return t; }
    const primary = this.actor?.system?.classification?.primary ?? 'land';
    const name = VEHICLE_CRIT_TABLE_NAMES[primary] ?? VEHICLE_CRIT_TABLE_NAMES.land;
    return game.tables.find((t) => t.name === name) ?? null;
  }

  _subsystemOptions(selectedId) {
    const L = (k) => game.i18n.localize(k);
    const subs = this.actor.items.filter((i) => i.type === 'vehicleSubsystem');
    const none = `<option value=""${!selectedId ? ' selected' : ''}>${this._esc(L('CYBER_BLUE.BlueprintEditor.Vital.NoneOption'))}</option>`;
    const opts = subs.map((s) =>
      `<option value="${s.id}"${s.id === selectedId ? ' selected' : ''}>${this._esc(s.name)}</option>`).join('');
    const create = `<option value="__new__">${this._esc(L('CYBER_BLUE.BlueprintEditor.Vital.NewSubsystem'))}</option>`;
    return none + opts + create;
  }

  _critOptions(selectedId) {
    const L = (k) => game.i18n.localize(k);
    const none = `<option value=""${!selectedId ? ' selected' : ''}>${this._esc(L('CYBER_BLUE.BlueprintEditor.Vital.RandomOption'))}</option>`;
    const table = this._getCritTable();
    if (!table) return none;
    const opts = [...table.results].map((r) => {
      const text = String(r.text ?? '').replace(/<[^>]+>/g, '').slice(0, 50);
      const rng  = Array.isArray(r.range) ? r.range.join('–') : '';
      const label = (rng ? `${rng}: ` : '') + text;
      return `<option value="${r.id}"${r.id === selectedId ? ' selected' : ''}>${this._esc(label)}</option>`;
    }).join('');
    return none + opts;
  }

  _effectOptions(selectedId) {
    const L = (k) => game.i18n.localize(k);
    const none = `<option value=""${!selectedId ? ' selected' : ''}>${this._esc(L('CYBER_BLUE.BlueprintEditor.Vital.NoneOption'))}</option>`;
    const opts = [...this.actor.effects].map((e) => {
      const tag = e.disabled ? '' : ` (${L('CYBER_BLUE.BlueprintEditor.Vital.ActiveTag')})`;
      return `<option value="${e.id}"${e.id === selectedId ? ' selected' : ''}>${this._esc((e.name ?? 'Effect') + tag)}</option>`;
    }).join('');
    return none + opts;
  }

  _defaultConfigFor(type) {
    if (type === 'gunnerSeat') return { seatIndex: 0 };
    if (type === 'vitalArea')  return { criticalDamageEntryId: '', subsystemItemId: null };
    return {};
  }

  _esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Art loading ─────────────────────────────────────────────────────────────

  _ensureArtImage(src) {
    if (!src) { this._artImage = null; this._artLoaded = false; return; }
    if (this._artImage && this._artImage.src.endsWith(src)) return;

    const img = new Image();
    this._artLoaded = false;
    img.onload = () => {
      if (this._artImage !== img) return;
      this._artLoaded = true;
      this._draw();
    };
    img.onerror = () => { this._artLoaded = false; };
    img.src = foundry.utils.getRoute(src);
    this._artImage = img;
  }

  // ── View transform ───────────────────────────────────────────────────────

  _footprintPx() {
    const bp = this.actor.system.blueprint ?? {};
    const proto = this.actor.prototypeToken ?? {};
    const grid = bp.referenceGrid ?? 100;
    return { w: (proto.width ?? 1) * grid, h: (proto.height ?? 1) * grid };
  }

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
    this._cssW = cw;
    this._cssH = ch;
    this._dpr = dpr;
  }

  _fitView() {
    const { w, h } = this._footprintPx();
    const vw = (this._cssW ?? 1) - CANVAS_PADDING * 2;
    const vh = (this._cssH ?? 1) - CANVAS_PADDING * 2;
    if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0) {
      this._view = { scale: 1, x: CANVAS_PADDING, y: CANVAS_PADDING };
      return;
    }
    const scale = Math.min(vw / w, vh / h);
    this._view = {
      scale,
      x: ((this._cssW ?? 1) - w * scale) / 2,
      y: ((this._cssH ?? 1) - h * scale) / 2,
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

    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, this._cssW ?? 0, this._cssH ?? 0);

    const { w, h } = this._footprintPx();
    const tl = this._worldToScreen(0, 0);
    const scale = this._view.scale;

    if (this._artLoaded && this._artImage) {
      try { ctx.drawImage(this._artImage, tl.x, tl.y, w * scale, h * scale); }
      catch { /* image not ready */ }
    } else {
      ctx.fillStyle = '#1a1f26';
      ctx.fillRect(tl.x, tl.y, w * scale, h * scale);
    }

    this._drawGrid(ctx, w, h, scale, tl);
    this._drawRegions(ctx, scale);
    this._drawFootprintBorder(ctx, w, h, scale, tl);
    this._drawDraft(ctx);
    this._drawHandles(ctx);
  }

  _drawFootprintBorder(ctx, w, h, scale, tl) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeRect(tl.x, tl.y, w * scale, h * scale);
  }

  _drawGrid(ctx, w, h, scale, tl) {
    const grid = (this.actor.system.blueprint?.referenceGrid ?? 100) * scale;
    if (grid < 6) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tl.x, tl.y, w * scale, h * scale);
    ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    for (let gx = 0; gx <= w * scale + 0.5; gx += grid) {
      ctx.moveTo(tl.x + gx, tl.y);
      ctx.lineTo(tl.x + gx, tl.y + h * scale);
    }
    for (let gy = 0; gy <= h * scale + 0.5; gy += grid) {
      ctx.moveTo(tl.x, tl.y + gy);
      ctx.lineTo(tl.x + w * scale, tl.y + gy);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawRegions(ctx, scale) {
    for (const region of this._regions) {
      const offset = region.offset ?? { x: 0, y: 0 };
      const origin = this._worldToScreen(offset.x ?? 0, offset.y ?? 0);
      const isSelected = region.regionId === this._selectedRegionId;
      const color = behaviorColor(region.behaviorType);

      ctx.save();
      ctx.setTransform(
        (this._dpr ?? 1) * scale, 0, 0, (this._dpr ?? 1) * scale,
        origin.x * (this._dpr ?? 1), origin.y * (this._dpr ?? 1),
      );
      ctx.beginPath();
      traceShapePath(ctx, region.shape ?? {});
      ctx.fillStyle = this._hexToRgba(color, isSelected ? 0.45 : 0.25);
      ctx.fill();
      ctx.lineWidth = (isSelected ? 3 : 2) / scale;
      ctx.strokeStyle = isSelected ? '#ffffff' : this._hexToRgba(color, 0.9);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawDraft(ctx) {
    const d = this._draft;
    if (!d) return;
    const dpr = this._dpr ?? 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd54a';
    ctx.beginPath();

    if (d.type === 'polygon') {
      const pts = d.points;
      if (pts.length >= 2) {
        const first = this._worldToScreen(pts[0], pts[1]);
        ctx.moveTo(first.x, first.y);
        for (let i = 2; i < pts.length; i += 2) {
          const p = this._worldToScreen(pts[i], pts[i + 1]);
          ctx.lineTo(p.x, p.y);
        }
        if (this._mouseWorld) {
          const m = this._worldToScreen(this._mouseWorld.x, this._mouseWorld.y);
          ctx.lineTo(m.x, m.y);
        }
      }
    } else if (d.start && d.end) {
      const scale = this._view.scale;
      if (d.type === 'rectangle') {
        const a = this._worldToScreen(d.start.x, d.start.y);
        const b = this._worldToScreen(d.end.x, d.end.y);
        ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      } else if (d.type === 'circle') {
        const c = this._worldToScreen(d.start.x, d.start.y);
        const r = Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y) * scale;
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      } else if (d.type === 'ellipse') {
        const cx = (d.start.x + d.end.x) / 2, cy = (d.start.y + d.end.y) / 2;
        const c = this._worldToScreen(cx, cy);
        const rx = Math.abs(d.end.x - d.start.x) / 2 * scale;
        const ry = Math.abs(d.end.y - d.start.y) / 2 * scale;
        ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawHandles(ctx) {
    const region = this._findRegion(this._selectedRegionId);
    if (!region) return;
    const dpr = this._dpr ?? 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 1;
    for (const h of this._getHandles(region)) {
      const s = this._worldToScreen(h.wx, h.wy);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0c0f13';
      ctx.beginPath();
      ctx.rect(s.x - HANDLE / 2, s.y - HANDLE / 2, HANDLE, HANDLE);
      ctx.fill();
      ctx.stroke();
    }
  }

  _hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Handles & geometry ───────────────────────────────────────────────────────

  _getHandles(region) {
    const off = region.offset ?? { x: 0, y: 0 };
    const ox = off.x ?? 0, oy = off.y ?? 0;
    const sh = region.shape ?? {};
    switch (sh.type) {
      case 'rectangle': {
        const x = sh.x ?? 0, y = sh.y ?? 0, w = sh.width ?? 0, h = sh.height ?? 0;
        return [
          { kind: 'corner', corner: 0, wx: ox + x,     wy: oy + y },
          { kind: 'corner', corner: 1, wx: ox + x + w, wy: oy + y },
          { kind: 'corner', corner: 2, wx: ox + x + w, wy: oy + y + h },
          { kind: 'corner', corner: 3, wx: ox + x,     wy: oy + y + h },
        ];
      }
      case 'circle': {
        const x = sh.x ?? 0, y = sh.y ?? 0, r = sh.radius ?? 0;
        return [{ kind: 'radius', wx: ox + x + r, wy: oy + y }];
      }
      case 'ellipse': {
        const x = sh.x ?? 0, y = sh.y ?? 0, rx = sh.radiusX ?? 0, ry = sh.radiusY ?? 0;
        return [
          { kind: 'radiusX', wx: ox + x + rx, wy: oy + y },
          { kind: 'radiusY', wx: ox + x,      wy: oy + y + ry },
        ];
      }
      case 'polygon': {
        const pts = sh.points ?? [];
        const out = [];
        for (let i = 0; i < pts.length; i += 2) {
          out.push({ kind: 'vertex', vertex: i / 2, wx: ox + pts[i], wy: oy + pts[i + 1] });
        }
        return out;
      }
      default: return [];
    }
  }

  _hitHandle(cssX, cssY) {
    const region = this._findRegion(this._selectedRegionId);
    if (!region) return null;
    for (const h of this._getHandles(region)) {
      const s = this._worldToScreen(h.wx, h.wy);
      if (Math.abs(s.x - cssX) <= HANDLE_HIT && Math.abs(s.y - cssY) <= HANDLE_HIT) return h;
    }
    return null;
  }

  _hitTestRegions(cssX, cssY) {
    const world = this._screenToWorld(cssX, cssY);
    for (let i = this._regions.length - 1; i >= 0; i--) {
      const region = this._regions[i];
      const offset = region.offset ?? { x: 0, y: 0 };
      const lx = world.x - (offset.x ?? 0);
      const ly = world.y - (offset.y ?? 0);
      if (pointInShape(region.shape ?? {}, lx, ly)) return region.regionId;
    }
    return null;
  }

  _translateRegion(region, dx, dy) {
    const sh = region.shape ?? {};
    if (sh.type === 'polygon') {
      const pts = sh.points ?? [];
      for (let i = 0; i < pts.length; i += 2) { pts[i] += dx; pts[i + 1] += dy; }
    } else if (sh.type === 'rectangle' || sh.type === 'circle' || sh.type === 'ellipse') {
      sh.x = (sh.x ?? 0) + dx;
      sh.y = (sh.y ?? 0) + dy;
    }
  }

  _applyHandleDrag(region, handle, world) {
    const off = region.offset ?? { x: 0, y: 0 };
    const lx = world.x - (off.x ?? 0);
    const ly = world.y - (off.y ?? 0);
    const sh = region.shape;
    switch (sh.type) {
      case 'rectangle': {
        const a = this._drag.anchor; // opposite corner, shape-local
        sh.x = Math.min(a.x, lx);
        sh.y = Math.min(a.y, ly);
        sh.width = Math.max(1, Math.abs(lx - a.x));
        sh.height = Math.max(1, Math.abs(ly - a.y));
        break;
      }
      case 'circle':
        sh.radius = Math.max(1, Math.hypot(lx - (sh.x ?? 0), ly - (sh.y ?? 0)));
        break;
      case 'ellipse':
        if (handle.kind === 'radiusX') sh.radiusX = Math.max(1, Math.abs(lx - (sh.x ?? 0)));
        else sh.radiusY = Math.max(1, Math.abs(ly - (sh.y ?? 0)));
        break;
      case 'polygon': {
        const i = handle.vertex * 2;
        sh.points[i] = lx;
        sh.points[i + 1] = ly;
        break;
      }
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  _selectRegion(regionId) {
    this._selectedRegionId = regionId ?? null;
    this._renderRail();
    this._draw();
  }

  _deleteSelected() {
    const id = this._selectedRegionId;
    if (!id) return;
    const idx = this._regions.findIndex((r) => r.regionId === id);
    if (idx === -1) return;
    this._pushHistory();
    this._regions.splice(idx, 1);
    this._selectedRegionId = null;
    this._persist();
    this._renderRail();
    this._draw();
  }

  // ── Tool selection ─────────────────────────────────────────────────────────

  _setTool(tool) {
    this._tool = tool;
    this._draft = null;
    this._drag = null;
    this._mouseWorld = null;
    this._updateToolUI();
    this._draw();
  }

  _updateToolUI() {
    const root = this.element;
    if (!root) return;
    root.querySelectorAll('.cpb-be-tool').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === this._tool);
    });
    if (this._canvas) {
      this._canvas.style.cursor = this._tool === 'select' ? 'grab' : 'crosshair';
    }
    if (this._statusEl) {
      this._statusEl.textContent = this._tool === 'polygon'
        ? game.i18n.localize('CYBER_BLUE.BlueprintEditor.PolygonHint')
        : '';
    }
  }

  // ── Region creation ─────────────────────────────────────────────────────────

  _addRegion(shape) {
    const region = {
      regionId: foundry.utils.randomID(),
      label: '',
      shape,
      offset: { x: 0, y: 0 },
      behaviorType: '',
      behaviorConfig: {},
    };
    this._pushHistory();
    this._regions.push(region);
    this._selectedRegionId = region.regionId;
    this._tool = 'select';
    this._draft = null;
    this._persist();
    this._renderRail();
    this._updateToolUI();
    this._draw();
  }

  _commitDraft() {
    const d = this._draft;
    this._draft = null;
    if (!d || !d.start || !d.end) { this._draw(); return; }

    let shape = null;
    if (d.type === 'rectangle') {
      const x = Math.min(d.start.x, d.end.x), y = Math.min(d.start.y, d.end.y);
      const w = Math.abs(d.end.x - d.start.x), h = Math.abs(d.end.y - d.start.y);
      if (w >= MIN_DIM && h >= MIN_DIM) shape = { type: 'rectangle', x, y, width: w, height: h };
    } else if (d.type === 'circle') {
      const r = Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y);
      if (r >= MIN_DIM) shape = { type: 'circle', x: d.start.x, y: d.start.y, radius: r };
    } else if (d.type === 'ellipse') {
      const rx = Math.abs(d.end.x - d.start.x) / 2, ry = Math.abs(d.end.y - d.start.y) / 2;
      if (rx >= MIN_DIM && ry >= MIN_DIM) {
        shape = {
          type: 'ellipse',
          x: (d.start.x + d.end.x) / 2,
          y: (d.start.y + d.end.y) / 2,
          radiusX: rx, radiusY: ry,
        };
      }
    }

    if (shape) this._addRegion(shape);
    else { this._setTool(this._tool); } // discard tiny shape, keep tool
  }

  _finishPolygon() {
    const d = this._draft;
    this._draft = null;
    if (!d || (d.points.length / 2) < 3) { this._draw(); return; }
    this._addRegion({ type: 'polygon', points: d.points.slice() });
  }

  // ── Pointer / wheel handlers ────────────────────────────────────────────────

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
    const world = this._screenToWorld(pos.x, pos.y);

    if (this._tool === 'polygon') {
      if (!this._draft) {
        this._draft = { type: 'polygon', points: [world.x, world.y] };
      } else {
        const pts = this._draft.points;
        // Close if clicking near the first vertex.
        const first = this._worldToScreen(pts[0], pts[1]);
        if (pts.length >= 6 && Math.abs(first.x - pos.x) <= HANDLE_HIT && Math.abs(first.y - pos.y) <= HANDLE_HIT) {
          this._finishPolygon();
          this._setTool('select');
          this._renderRail();
          return;
        }
        pts.push(world.x, world.y);
      }
      this._draw();
      return;
    }

    if (this._tool !== 'select') {
      // Begin a drag-to-draw gesture.
      this._draft = { type: this._tool, start: world, end: world };
      this._drag = { mode: 'draw' };
      this._canvas.setPointerCapture?.(ev.pointerId);
      this._draw();
      return;
    }

    // Select tool: handle → resize/vertex; body → select+move; empty → pan.
    const handle = this._hitHandle(pos.x, pos.y);
    if (handle) {
      const region = this._findRegion(this._selectedRegionId);
      this._dragSnapshot = this._snapshot();
      this._drag = { mode: handle.kind === 'vertex' ? 'vertex' : 'resize', handle };
      if (region?.shape?.type === 'rectangle') {
        // Capture opposite corner (shape-local) as the fixed anchor.
        const sh = region.shape;
        const corners = [
          { x: sh.x, y: sh.y },
          { x: sh.x + sh.width, y: sh.y },
          { x: sh.x + sh.width, y: sh.y + sh.height },
          { x: sh.x, y: sh.y + sh.height },
        ];
        this._drag.anchor = corners[(handle.corner + 2) % 4];
      }
      this._canvas.setPointerCapture?.(ev.pointerId);
      return;
    }

    const hit = this._hitTestRegions(pos.x, pos.y);
    if (hit) {
      this._selectRegion(hit);
      this._dragSnapshot = this._snapshot();
      this._drag = { mode: 'move', lastWorld: world };
      this._canvas.setPointerCapture?.(ev.pointerId);
      return;
    }

    this._drag = { mode: 'pan', lastX: pos.x, lastY: pos.y };
    this._canvas.setPointerCapture?.(ev.pointerId);
  }

  _onPointerMove(ev) {
    const pos = this._eventPos(ev);
    const world = this._screenToWorld(pos.x, pos.y);

    if (this._tool === 'polygon' && this._draft) {
      this._mouseWorld = world;
      this._draw();
      return;
    }

    const drag = this._drag;
    if (!drag) return;

    if (drag.mode === 'pan') {
      this._view.x += pos.x - drag.lastX;
      this._view.y += pos.y - drag.lastY;
      drag.lastX = pos.x;
      drag.lastY = pos.y;
      this._draw();
      return;
    }
    if (drag.mode === 'draw') {
      this._draft.end = world;
      this._draw();
      return;
    }
    if (drag.mode === 'move') {
      const region = this._findRegion(this._selectedRegionId);
      if (region) {
        this._translateRegion(region, world.x - drag.lastWorld.x, world.y - drag.lastWorld.y);
        drag.lastWorld = world;
        this._draw();
      }
      return;
    }
    if (drag.mode === 'resize' || drag.mode === 'vertex') {
      const region = this._findRegion(this._selectedRegionId);
      if (region) {
        this._applyHandleDrag(region, drag.handle, world);
        this._draw();
      }
    }
  }

  _onPointerUp(ev) {
    const drag = this._drag;
    if (!drag) return;
    this._drag = null;
    this._canvas?.releasePointerCapture?.(ev.pointerId);

    if (drag.mode === 'draw') {
      this._commitDraft();
      this._renderRail();
      return;
    }
    if (drag.mode === 'move' || drag.mode === 'resize' || drag.mode === 'vertex') {
      const snap = this._dragSnapshot;
      this._dragSnapshot = null;
      if (snap && JSON.stringify(this._regions) !== JSON.stringify(snap)) {
        this._commitHistory(snap);
        this._persist();
      }
    }
  }

  _onDblClick(ev) {
    if (this._tool === 'polygon' && this._draft) {
      ev.preventDefault();
      // The two pointerdowns of the dblclick pushed a duplicate final point.
      if (this._draft.points.length >= 8) this._draft.points.splice(-2, 2);
      this._finishPolygon();
      this._setTool('select');
      this._renderRail();
    }
  }

  _onKeyDown(ev) {
    // Only act when focus is inside this editor (avoids hijacking keys globally).
    if (!this.element?.contains(document.activeElement)) return;

    // Undo / redo — but let native text editing handle these inside fields.
    const tag = document.activeElement?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if ((ev.ctrlKey || ev.metaKey) && !inField) {
      const key = ev.key.toLowerCase();
      if (key === 'z' && !ev.shiftKey) { ev.preventDefault(); this._undo(); return; }
      if (key === 'y' || (key === 'z' && ev.shiftKey)) { ev.preventDefault(); this._redo(); return; }
    }

    if (this._tool === 'polygon' && this._draft) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this._finishPolygon();
        this._setTool('select');
        this._renderRail();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        this._draft = null;
        this._draw();
      }
      return;
    }

    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this._selectedRegionId && this._tool === 'select') {
      if (inField) return;
      ev.preventDefault();
      this._deleteSelected();
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  static _onFitAction() {
    this._fitView();
    this._draw();
  }

  static _onToolAction(_event, target) {
    this._setTool(target.dataset.tool ?? 'select');
  }

  static _onDeleteAction() {
    this._deleteSelected();
  }

  static _onCaptureAction() {
    this._captureFromScene();
  }

  static _onUndoAction() {
    this._undo();
  }

  static _onRedoAction() {
    this._redo();
  }

  // ── Capture-from-scene ───────────────────────────────────────────────────────

  /** Find a placed token for this actor on the active scene (controlled first). */
  _findActorToken() {
    const scene = canvas?.scene;
    if (!scene) return null;
    const controlled = canvas.tokens?.controlled?.find((t) => t.actor?.id === this.actor.id);
    if (controlled) return controlled.document;
    return scene.tokens.find((t) => t.actorId === this.actor.id) ?? null;
  }

  /**
   * Overwrite the blueprint from the vehicle token's linked scene Regions,
   * capturing any manual edits the GM made with Foundry's native region tools.
   */
  async _captureFromScene() {
    const token = this._findActorToken();
    if (!token) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.BlueprintEditor.CaptureNoToken'));
      return;
    }
    const refGrid = this.actor.system.blueprint?.referenceGrid ?? 100;
    const captured = captureRegionsFromToken(token, refGrid);
    if (!captured.length) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.BlueprintEditor.CaptureNoRegions'));
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CYBER_BLUE.BlueprintEditor.CaptureConfirmTitle') },
      content: `<p>${game.i18n.format('CYBER_BLUE.BlueprintEditor.CaptureConfirm', { n: captured.length })}</p>`,
    });
    if (!confirmed) return;

    this._pushHistory();
    this._regions = captured;
    this._selectedRegionId = null;
    this._draft = null;
    await this._persist();
    this._renderRail();
    this._draw();
    ui.notifications.info(
      game.i18n.format('CYBER_BLUE.BlueprintEditor.Captured', { n: captured.length }),
    );
  }
}
