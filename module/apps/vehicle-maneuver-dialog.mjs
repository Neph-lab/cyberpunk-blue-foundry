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
} from '../helpers/vehicle-maneuvers.mjs';

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

    // Also update DV when angle bucket or hard-brake tier changes.
    root.addEventListener('change', (ev) => {
      const name = ev.target.name;
      if (name === 'angleBucket' || name === 'hardBrakeTier' || name === 'rammingTargetTokenId') {
        const type = root.querySelector('[name="type"]:checked')?.value ?? '';
        this._updateDvDisplay(root, type);
      }
    });

    updateParams(); // Initial state

    // ── Declare button ───────────────────────────────────────────────────────
    root.querySelector('[data-action="declare"]')?.addEventListener('click', () => {
      this._onDeclare(root);
    });
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

    return { type, angleBucket, hardBrakeTier, speedDelta, rammingTargetTokenId };
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
