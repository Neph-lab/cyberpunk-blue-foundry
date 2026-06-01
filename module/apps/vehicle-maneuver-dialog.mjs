/**
 * Vehicle Maneuver Declaration Dialog.
 *
 * An ApplicationV2 + Handlebars dialog that lets the driver pick a Maneuver
 * type, fill in parameters, and commit to a Drive check.
 *
 * Usage:
 *   const declared = await VehicleManeuverDialog.show(vehicleCombatant, driverActor);
 *
 * Returns `true` when the driver successfully declared a Maneuver, `false` if
 * they closed the dialog without declaring.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

import {
  MANEUVER_TYPES,
  ANGLE_BUCKETS,
  getManeuverDV,
  declareManeuver,
  declareCruise,
  getCruiseSpeedEnvelope,
  CRUISE_MAX_HEADING_DELTA,
  angleToBucket,
} from '../helpers/vehicle-maneuvers.mjs';
import { startVectorDraw } from '../helpers/vehicle-vector-draw.mjs';

export class VehicleManeuverDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id:      'vehicle-maneuver-dialog',
    tag:     'div',
    classes: ['cyberpunk-blue', 'vehicle-maneuver-dialog'],
    window: {
      title:     'CYBER_BLUE.VehicleCombat.DeclareManeuver',
      resizable: false,
    },
    position: { width: 420, height: 'auto' },
  };

  static PARTS = {
    form: {
      template: 'systems/cyberpunk-blue/templates/dialogs/vehicle-maneuver-picker.hbs',
    },
  };

  /**
   * @param {Combatant} vehicleCombatant
   * @param {Actor}     driverActor
   */
  constructor(vehicleCombatant, driverActor) {
    super();
    this._vehicleCombatant = vehicleCombatant;
    this._driverActor      = driverActor;
    this._resolve          = null;
  }

  /**
   * Show the dialog and return a Promise that resolves when the driver either
   * declares a Maneuver (true) or closes without declaring (false).
   *
   * @param {Combatant} vehicleCombatant
   * @param {Actor}     driverActor
   * @returns {Promise<boolean>}
   */
  static async show(vehicleCombatant, driverActor) {
    return new Promise((resolve) => {
      const dialog = new VehicleManeuverDialog(vehicleCombatant, driverActor);
      dialog._resolve = resolve;
      dialog.render(true);
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async _prepareContext(_options) {
    const actor  = this._vehicleCombatant.actor;
    const driver = this._driverActor;
    const isAir  = actor?.system?.classification?.primary === 'air';

    const acc = (actor?.system?.stats?.acc?.value ?? 0)
              + (actor?.system?.stats?.acc?.bonus ?? 0);

    // Build the list of target tokens for Ram
    const rammableTargets = this._getRammableTargets();

    return {
      vehicle:        actor,
      driver,
      driveRank:      driver?.system?.skills?.drive?.rank  ?? 0,
      rflx:           driver?.system?.stats?.rflx?.value   ?? 0,
      currentSpeed:   actor?.system?.stats?.currentSpeed?.value ?? 0,
      acc,
      maneuverTypes:  MANEUVER_TYPES,
      angleBuckets:   ANGLE_BUCKETS,
      isAir,
      rammableTargets,
      // Cruise tab
      cruiseSpeedEnvelope:    getCruiseSpeedEnvelope(actor),
      cruiseMaxHeadingDelta:  CRUISE_MAX_HEADING_DELTA,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const root = this.element;
    if (!root) return;

    // ── Show/hide parameter sections when type changes ──────────────────────
    const updateParams = () => {
      const type = root.querySelector('[name="type"]:checked')?.value ?? '';
      root.querySelectorAll('.cpb-mp-params').forEach((el) => {
        el.hidden = (el.dataset.type !== type);
      });
      this._updateDvDisplay(root, type);
    };

    root.querySelectorAll('[name="type"]').forEach((radio) => {
      radio.addEventListener('change', updateParams);
    });

    // Also update DV when angle bucket or hard-brake tier changes. Manually
    // editing the angle/direction discards any drawn path (the manual values win).
    root.addEventListener('change', (ev) => {
      const name = ev.target.name;
      if (name === 'angleBucket' || name === 'turnDirection') {
        this._drawnPath = null;
        this._updateDrawSummary(root);
      }
      if (name === 'angleBucket' || name === 'hardBrakeTier' || name === 'rammingTargetTokenId' || name === 'turnDirection') {
        const type = root.querySelector('[name="type"]:checked')?.value ?? '';
        this._updateDvDisplay(root, type);
      }
    });

    updateParams(); // Initial state

    // ── Tab switching (Maneuver / Cruise) ──────────────────────────────────────
    const selectTab = (tab) => {
      root.querySelectorAll('.cpb-mp-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
      root.querySelectorAll('.cpb-mp-panel').forEach((panel) => {
        panel.hidden = (panel.dataset.tab !== tab);
      });
    };
    root.querySelectorAll('.cpb-mp-tab').forEach((btn) => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
    });
    selectTab('maneuver'); // Default tab

    // ── Live cruise summary ────────────────────────────────────────────────────
    const updateCruiseSummary = () => this._updateCruiseSummary(root);
    root.querySelectorAll('[name="cruiseHeadingDelta"], [name="cruiseSpeedDelta"]').forEach((el) => {
      el.addEventListener('change', updateCruiseSummary);
      el.addEventListener('input', updateCruiseSummary);
    });
    updateCruiseSummary();

    // ── Declare button (maneuver) ──────────────────────────────────────────────
    root.querySelector('[data-action="declare"]')?.addEventListener('click', () => {
      this._onDeclare(root);
    });

    // ── Cruise button ──────────────────────────────────────────────────────────
    root.querySelector('[data-action="cruise"]')?.addEventListener('click', () => {
      this._onCruise(root);
    });

    // ── Draw path on canvas (Sharp Turn) ───────────────────────────────────────
    root.querySelector('[data-action="drawPath"]')?.addEventListener('click', () => {
      this._onDrawPath(root);
    });
    this._updateDrawSummary(root);
  }

  async close(options) {
    this._resolve?.(false);
    this._resolve = null;
    return super.close(options);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Update the live DV display based on the currently selected type + params.
   */
  _updateDvDisplay(root, type) {
    const dvEl = root.querySelector('#cpb-mp-dv');
    if (!dvEl) return;

    const actor = this._vehicleCombatant.actor;
    const params = this._readParams(root, type);

    // Resolve target token for Ram DV.
    const targetTokenId = params.rammingTargetTokenId;
    const targetToken   = targetTokenId && canvas.scene
      ? canvas.scene.tokens.get(targetTokenId) ?? null
      : null;

    const dv = getManeuverDV(type, params, actor, targetToken);
    dvEl.textContent = dv !== null ? String(dv) : '—';
  }

  /**
   * Read the current form parameter values into a params object.
   */
  _readParams(root, type) {
    const angleBucket    = parseInt(root.querySelector('[name="angleBucket"]')?.value ?? 0);
    const hardBrakeTier  = parseInt(root.querySelector('[name="hardBrakeTier"]')?.value ?? 2);
    const speedDelta     = parseInt(root.querySelector('[name="speedDelta"]')?.value ?? 1);
    const rammingTargetTokenId = root.querySelector('[name="rammingTargetTokenId"]')?.value ?? null;
    const turnDirection  = root.querySelector('[name="turnDirection"]:checked')?.value ?? 'right';

    return {
      type, angleBucket, turnDirection, hardBrakeTier, speedDelta, rammingTargetTokenId,
      drawnPath: (type === 'sharpTurn' ? (this._drawnPath ?? null) : null),
    };
  }

  /**
   * Enter canvas vector-draw mode, then apply the drawn relative path:
   * set the angle bucket + direction from the drawn turn and store the path so
   * `_readParams` carries it into the declaration. Minimises the dialog while
   * drawing so the canvas is clear.
   */
  async _onDrawPath(root) {
    const scene = canvas?.scene;
    const vehicleToken = scene?.tokens.get(this._vehicleCombatant.tokenId) ?? null;
    if (!vehicleToken) {
      ui.notifications?.warn('Vehicle token not found on the canvas.');
      return;
    }

    await this.minimize();
    let path = null;
    try {
      path = await startVectorDraw(vehicleToken);
    } finally {
      await this.maximize();
    }
    if (!path) return; // cancelled

    this._drawnPath = path;

    // Reflect the drawn turn in the angle bucket + direction controls.
    const bucket = angleToBucket(Math.abs(path.turnAngle));
    const bucketSel = root.querySelector('[name="angleBucket"]');
    if (bucketSel) bucketSel.value = String(bucket);
    const dir = path.turnAngle < 0 ? 'left' : 'right';
    const dirRadio = root.querySelector(`[name="turnDirection"][value="${dir}"]`);
    if (dirRadio) dirRadio.checked = true;

    this._updateDrawSummary(root);
    this._updateDvDisplay(root, 'sharpTurn');
  }

  /**
   * Update the small "drawn path" summary next to the Draw button.
   */
  _updateDrawSummary(root) {
    const el = root.querySelector('#cpb-mp-draw-summary');
    if (!el) return;
    const p = this._drawnPath;
    el.textContent = p
      ? `Forward ${p.forward1} → ${Math.abs(p.turnAngle)}° ${p.turnAngle < 0 ? 'left' : 'right'} → forward ${p.forward2}`
      : '';
  }

  /**
   * Called when the driver clicks "Declare & Roll Drive".
   */
  async _onDeclare(root) {
    const type = root.querySelector('[name="type"]:checked')?.value;
    if (!type) return;

    const params = this._readParams(root, type);

    await declareManeuver(this._vehicleCombatant, this._driverActor, params);

    // Resolve the external promise and close.
    this._resolve?.(true);
    this._resolve = null;
    await this.close({ force: true });
  }

  /**
   * Update the live cruise summary (resulting heading + speed) as the driver
   * adjusts the cruise controls.
   */
  _updateCruiseSummary(root) {
    const el = root.querySelector('#cpb-cruise-summary');
    if (!el) return;
    const actor = this._vehicleCombatant.actor;
    const headingDelta = parseInt(root.querySelector('[name="cruiseHeadingDelta"]')?.value ?? 0) || 0;
    const speedDelta = parseInt(root.querySelector('[name="cruiseSpeedDelta"]')?.value ?? 0) || 0;
    const dir = headingDelta === 0 ? 'straight' : `${Math.abs(headingDelta)}° ${headingDelta > 0 ? 'right' : 'left'}`;
    const curSpeed = actor?.system?.stats?.currentSpeed?.value ?? 0;
    const newSpeed = curSpeed + speedDelta;
    el.textContent = `${dir}, speed ${curSpeed} → ${newSpeed}`;
  }

  /**
   * Called when the driver clicks "Cruise" — applies a no-roll heading/speed
   * adjustment within the cruise envelope.
   */
  async _onCruise(root) {
    const headingDelta = parseInt(root.querySelector('[name="cruiseHeadingDelta"]')?.value ?? 0) || 0;
    const speedDelta = parseInt(root.querySelector('[name="cruiseSpeedDelta"]')?.value ?? 0) || 0;

    await declareCruise(this._vehicleCombatant, this._driverActor, { headingDelta, speedDelta });

    this._resolve?.(true);
    this._resolve = null;
    await this.close({ force: true });
  }

  /**
   * Collect tokens in the scene that could be rammed (excludes the vehicle).
   */
  _getRammableTargets() {
    const scene = canvas?.scene;
    if (!scene) return [];
    const vehicleTokenId = this._vehicleCombatant.tokenId;
    return scene.tokens.contents
      .filter((t) => t.id !== vehicleTokenId && t.actor)
      .map((t) => ({ id: t.id, name: t.name }));
  }
}
