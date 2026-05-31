/**
 * Vehicle Blueprint Editor — standalone window where the vehicle's token art is
 * the canvas for authoring region zones (driver/gunner/passenger seats, vital
 * areas, roof).
 *
 * Phase 1 (this file): read-only projection. Renders the token art, the grid
 * footprint, and the existing `system.blueprint.regions` as overlays, with
 * fit / pan / zoom and a region list that cross-selects with the canvas.
 * Drawing + editing tools arrive in Phase 2.
 *
 * Rendering substrate: a plain HTML5 Canvas 2D context (no second PIXI
 * Application). Coordinates are token-local pixels at `blueprint.referenceGrid`
 * px per grid square; the footprint is the token's grid footprint.
 *
 * Open via: CyberBlueVehicleBlueprintEditor.open(actor)  (GM only, one window
 * per actor).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import { traceShapePath, pointInShape, behaviorColor } from '../helpers/vehicle-shapes.mjs';

/** Human-readable label per registered behavior type. */
const BEHAVIOR_LABELS = {
  '':              'CYBER_BLUE.BlueprintEditor.TypeNone',
  driverSeat:      'CYBER_BLUE.RegionBehavior.DriverSeat.Label',
  gunnerSeat:      'CYBER_BLUE.RegionBehavior.GunnerSeat.Label',
  passengerSeat:   'CYBER_BLUE.RegionBehavior.PassengerSeat.Label',
  vitalArea:       'CYBER_BLUE.RegionBehavior.VitalArea.Label',
  vehicleRoof:     'CYBER_BLUE.RegionBehavior.VehicleRoof.Label',
};

const CANVAS_PADDING = 24;   // px of breathing room around the footprint when fitting
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
const ZOOM_STEP = 1.1;

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
    this._selectedRegionId = null;
    /** @type {HTMLImageElement|null} */
    this._artImage = null;
    this._artLoaded = false;
    // Bound handlers so we can detach them on close.
    this._boundDraw = this._draw.bind(this);
    this._resizeObserver = null;
    this._pointer = { panning: false, lastX: 0, lastY: 0 };
  }

  get title() {
    return game.i18n.format('CYBER_BLUE.BlueprintEditor.TitleFor', { name: this.actor?.name ?? '' });
  }

  // ── Context ─────────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const system = this.actor.system;
    const bp = system.blueprint ?? {};
    const proto = this.actor.prototypeToken ?? {};

    const footprintW = (proto.width  ?? 1);
    const footprintH = (proto.height ?? 1);
    const artSrc = proto.texture?.src || this.actor.img || '';

    const regions = (bp.regions ?? []).map((r, i) => ({
      regionId: r.regionId,
      index: i,
      displayLabel: r.label?.trim()
        || `${game.i18n.localize(BEHAVIOR_LABELS[r.behaviorType] ?? BEHAVIOR_LABELS[''])} ${i + 1}`,
      typeLabel: game.i18n.localize(BEHAVIOR_LABELS[r.behaviorType] ?? BEHAVIOR_LABELS['']),
      color: behaviorColor(r.behaviorType),
      shapeType: r.shape?.type ?? '—',
    }));

    return {
      actor: this.actor,
      artSrc,
      hasArt: !!artSrc,
      footprintW,
      footprintH,
      referenceGrid: bp.referenceGrid ?? 100,
      regions,
      hasRegions: regions.length > 0,
      selectedRegionId: this._selectedRegionId,
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async _onRender(context, options) {
    await super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    this._canvas = root.querySelector('[data-be-canvas]');
    this._ctx = this._canvas?.getContext('2d') ?? null;

    // Load (or reuse) the token art image.
    this._ensureArtImage(context.artSrc);

    // Region-list row selection.
    root.querySelectorAll('.cpb-be-region-row').forEach((row) => {
      row.addEventListener('click', () => {
        this._selectRegion(row.dataset.regionId);
      });
    });

    // Canvas interaction (read-only: select / pan / zoom).
    if (this._canvas) {
      this._canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
      this._canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
      this._canvas.addEventListener('pointermove', this._onPointerMove.bind(this));
      this._canvas.addEventListener('pointerup', this._onPointerUp.bind(this));
      this._canvas.addEventListener('pointerleave', this._onPointerUp.bind(this));
    }

    // Keep the backing store sized to the element; refit + redraw on resize.
    const wrap = root.querySelector('.cpb-be-canvas-wrap');
    if (wrap && 'ResizeObserver' in window) {
      this._resizeObserver = new ResizeObserver(() => {
        this._resizeCanvas();
        this._fitView();
        this._draw();
      });
      this._resizeObserver.observe(wrap);
    }

    // Initial sizing happens after layout settles.
    requestAnimationFrame(() => {
      this._resizeCanvas();
      this._fitView();
      this._draw();
    });
  }

  async close(options) {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    this._artImage = null;
    this._ctx = null;
    this._canvas = null;
    CyberBlueVehicleBlueprintEditor._instances.delete(this.actor?.id);
    return super.close(options);
  }

  // ── Art loading ─────────────────────────────────────────────────────────────

  _ensureArtImage(src) {
    if (!src) { this._artImage = null; this._artLoaded = false; return; }
    if (this._artImage && this._artImage.src.endsWith(src)) return; // already loading/loaded

    const img = new Image();
    this._artLoaded = false;
    img.onload = () => {
      // Guard: window may have closed before the image finished loading.
      if (this._artImage !== img) return;
      this._artLoaded = true;
      this._draw();
    };
    img.onerror = () => { this._artLoaded = false; };
    // Foundry serves assets relative to the host root.
    img.src = foundry.utils.getRoute(src);
    this._artImage = img;
  }

  // ── View transform ───────────────────────────────────────────────────────

  _footprintPx() {
    const bp = this.actor.system.blueprint ?? {};
    const proto = this.actor.prototypeToken ?? {};
    const grid = bp.referenceGrid ?? 100;
    return {
      w: (proto.width  ?? 1) * grid,
      h: (proto.height ?? 1) * grid,
    };
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

  /** Fit the footprint into the canvas viewport, centred, with padding. */
  _fitView() {
    const { w, h } = this._footprintPx();
    const vw = (this._cssW ?? 1) - CANVAS_PADDING * 2;
    const vh = (this._cssH ?? 1) - CANVAS_PADDING * 2;
    if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0) {
      this._view = { scale: 1, x: CANVAS_PADDING, y: CANVAS_PADDING };
      return;
    }
    const scale = Math.min(vw / w, vh / h);
    const x = ((this._cssW ?? 1) - w * scale) / 2;
    const y = ((this._cssH ?? 1) - h * scale) / 2;
    this._view = { scale, x, y };
  }

  _worldToScreen(wx, wy) {
    return { x: wx * this._view.scale + this._view.x, y: wy * this._view.scale + this._view.y };
  }

  _screenToWorld(sx, sy) {
    return { x: (sx - this._view.x) / this._view.scale, y: (sy - this._view.y) / this._view.scale };
  }

  /** Convert a pointer event to CSS-pixel coordinates within the canvas. */
  _eventPos(ev) {
    const rect = this._canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  // ── Drawing ─────────────────────────────────────────────────────────────────

  _draw() {
    const ctx = this._ctx;
    if (!ctx || !this._canvas) return;

    const dpr = this._dpr ?? 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // work in CSS pixels
    ctx.clearRect(0, 0, this._cssW ?? 0, this._cssH ?? 0);

    // Backdrop.
    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, this._cssW ?? 0, this._cssH ?? 0);

    const { w, h } = this._footprintPx();
    const tl = this._worldToScreen(0, 0);
    const scale = this._view.scale;

    // Token art, drawn to fill the footprint rect exactly (token art is
    // authored to fill its grid footprint).
    if (this._artLoaded && this._artImage) {
      try {
        ctx.drawImage(this._artImage, tl.x, tl.y, w * scale, h * scale);
      } catch { /* image not ready */ }
    } else {
      ctx.fillStyle = '#1a1f26';
      ctx.fillRect(tl.x, tl.y, w * scale, h * scale);
    }

    this._drawGrid(ctx, w, h, scale, tl);
    this._drawRegions(ctx, scale);
    this._drawFootprintBorder(ctx, w, h, scale, tl);
  }

  _drawFootprintBorder(ctx, w, h, scale, tl) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeRect(tl.x, tl.y, w * scale, h * scale);
  }

  _drawGrid(ctx, w, h, scale, tl) {
    const grid = (this.actor.system.blueprint?.referenceGrid ?? 100) * scale;
    if (grid < 6) return; // too dense to be useful
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
    const regions = this.actor.system.blueprint?.regions ?? [];
    for (const region of regions) {
      const offset = region.offset ?? { x: 0, y: 0 };
      const origin = this._worldToScreen(offset.x ?? 0, offset.y ?? 0);
      const isSelected = region.regionId === this._selectedRegionId;
      const color = behaviorColor(region.behaviorType);

      ctx.save();
      // Map shape-local coords → screen: translate to region origin, scale.
      ctx.setTransform(
        (this._dpr ?? 1) * scale, 0, 0, (this._dpr ?? 1) * scale,
        origin.x * (this._dpr ?? 1), origin.y * (this._dpr ?? 1),
      );

      ctx.beginPath();
      traceShapePath(ctx, region.shape ?? {});
      // Fill (alpha) — line widths divided by scale so they render at a
      // constant on-screen thickness regardless of zoom.
      ctx.fillStyle = this._hexToRgba(color, isSelected ? 0.45 : 0.25);
      ctx.fill();
      ctx.lineWidth = (isSelected ? 3 : 2) / scale;
      ctx.strokeStyle = isSelected ? '#ffffff' : this._hexToRgba(color, 0.9);
      ctx.stroke();
      ctx.restore();
    }
  }

  _hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  _selectRegion(regionId) {
    this._selectedRegionId = regionId ?? null;
    // Update list highlight without a full re-render.
    this.element?.querySelectorAll('.cpb-be-region-row').forEach((row) => {
      row.classList.toggle('selected', row.dataset.regionId === this._selectedRegionId);
    });
    this._draw();
  }

  /** Hit-test all regions at a CSS-pixel point; return regionId or null. */
  _hitTestRegions(cssX, cssY) {
    const world = this._screenToWorld(cssX, cssY);
    const regions = this.actor.system.blueprint?.regions ?? [];
    // Topmost (last drawn) wins.
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];
      const offset = region.offset ?? { x: 0, y: 0 };
      const lx = world.x - (offset.x ?? 0);
      const ly = world.y - (offset.y ?? 0);
      if (pointInShape(region.shape ?? {}, lx, ly)) return region.regionId;
    }
    return null;
  }

  // ── Pointer / wheel handlers ────────────────────────────────────────────────

  _onWheel(ev) {
    ev.preventDefault();
    const pos = this._eventPos(ev);
    const factor = ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this._view.scale * factor));
    if (newScale === this._view.scale) return;
    // Keep the world point under the cursor fixed.
    const worldAt = this._screenToWorld(pos.x, pos.y);
    this._view.scale = newScale;
    this._view.x = pos.x - worldAt.x * newScale;
    this._view.y = pos.y - worldAt.y * newScale;
    this._draw();
  }

  _onPointerDown(ev) {
    const pos = this._eventPos(ev);
    const hit = this._hitTestRegions(pos.x, pos.y);
    if (hit) {
      this._selectRegion(hit);
      return;
    }
    // Empty space → start panning.
    this._pointer.panning = true;
    this._pointer.lastX = pos.x;
    this._pointer.lastY = pos.y;
    this._canvas.setPointerCapture?.(ev.pointerId);
  }

  _onPointerMove(ev) {
    if (!this._pointer.panning) return;
    const pos = this._eventPos(ev);
    this._view.x += pos.x - this._pointer.lastX;
    this._view.y += pos.y - this._pointer.lastY;
    this._pointer.lastX = pos.x;
    this._pointer.lastY = pos.y;
    this._draw();
  }

  _onPointerUp(ev) {
    if (this._pointer.panning) {
      this._pointer.panning = false;
      this._canvas?.releasePointerCapture?.(ev.pointerId);
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  static _onFitAction() {
    this._fitView();
    this._draw();
  }
}
