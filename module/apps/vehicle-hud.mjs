/**
 * Vehicle Status HUD — compact read-only ApplicationV2 overlay.
 *
 * Shows: name, state, current/max speed (in the user's preferred units),
 * HP, SP (armor), effective handling, and the current driver's name.
 *
 * Usage:
 *   VehicleHud.openForActor(vehicleActor);   // idempotent: re-renders if already open
 *
 * Opened via Token HUD button on vehicle tokens (see renderTokenHUD hook in
 * cyberpunk-blue.mjs).  One HUD per vehicle actor is enforced by using the
 * actor id as part of the ApplicationV2 id.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class VehicleHud extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {Actor} vehicleActor */
  constructor(vehicleActor) {
    super();
    this._vehicleActor = vehicleActor;
  }

  // ── Static ─────────────────────────────────────────────────────────────────

  static DEFAULT_OPTIONS = {
    id:      '',           // set per-instance in constructor override
    tag:     'div',
    classes: ['cyberpunk-blue', 'vehicle-hud'],
    window: {
      title:     'CYBER_BLUE.VehicleHUD.Title',
      resizable: false,
      minimizable: true,
    },
    position: { width: 240, height: 'auto' },
  };

  static PARTS = {
    hud: {
      template: 'systems/cyberpunk-blue/templates/apps/vehicle-hud.hbs',
    },
  };

  /**
   * Track open HUD instances by actor id so we can re-render rather than
   * open a second window.
   * @type {Map<string, VehicleHud>}
   */
  static _instances = new Map();

  /**
   * Open (or re-render) the HUD for a vehicle actor.
   *
   * @param {Actor} vehicleActor
   */
  static openForActor(vehicleActor) {
    if (!vehicleActor || vehicleActor.type !== 'vehicle') return;

    const existing = VehicleHud._instances.get(vehicleActor.id);
    if (existing && !existing.rendered) {
      VehicleHud._instances.delete(vehicleActor.id);
    }
    if (existing?.rendered) {
      existing.render({ force: true });
      existing.bringToTop?.();
      return;
    }

    const hud = new VehicleHud(vehicleActor);
    VehicleHud._instances.set(vehicleActor.id, hud);
    hud.render(true);
  }

  // ── ApplicationV2 overrides ───────────────────────────────────────────────

  get id() {
    return `vehicle-hud-${this._vehicleActor?.id ?? 'unknown'}`;
  }

  get title() {
    return this._vehicleActor?.name ?? game.i18n.localize('CYBER_BLUE.VehicleHUD.Title');
  }

  async _prepareContext(_options) {
    const actor  = this._vehicleActor;
    const system = actor?.system;
    if (!actor || !system) return {};

    const handling  = system.stats.handling;
    const handlingEffective = (handling.base ?? 0) + (handling.bonus ?? 0);

    const maxMove = (system.stats.maxMove.value ?? 0) + (system.stats.maxMove.bonus ?? 0);
    const currentSpeed = system.stats.currentSpeed?.value ?? 0;

    // Speed formatting using the vehicleSpeedUnits client setting.
    const speedMaxFormatted     = formatVehicleSpeed(maxMove);
    const speedCurrentFormatted = formatVehicleSpeed(Math.abs(currentSpeed));
    const isReverse = currentSpeed < 0;

    // Driver name — read from the vehicle actor flag.
    const scene = canvas?.scene;
    const driverTokenId = actor.getFlag('cyberpunk-blue', 'currentDriverTokenId');
    let driverName = game.i18n.localize('CYBER_BLUE.VehicleHUD.NoDriver');
    if (driverTokenId && scene) {
      const driverToken = scene.tokens.get(driverTokenId);
      if (driverToken?.name) driverName = driverToken.name;
    }

    const handlingDisplay = handlingEffective >= 0 ? `+${handlingEffective}` : `${handlingEffective}`;

    return {
      actor:  actor.toPlainObject(),
      system,
      handlingEffective,
      handlingDisplay,
      speedMaxFormatted,
      speedCurrentFormatted,
      isReverse,
      driverName,
    };
  }

  _onClose(_options) {
    VehicleHud._instances.delete(this._vehicleActor?.id);
    super._onClose?.(_options);
  }
}

// ── Speed formatting helper ───────────────────────────────────────────────────

/**
 * Format a vehicle speed value using the user's preferred speed units.
 * Reads the `vehicleSpeedUnits` client setting.
 *
 * Formula: 1 MV (grid space) = 2 m/s (game convention — see vehicle-sheet.mjs).
 *
 * @param {number} mv
 * @returns {string}
 */
export function formatVehicleSpeed(mv) {
  const unit = game.settings.get('cyberpunk-blue', 'vehicleSpeedUnits') ?? 'kmh';
  switch (unit) {
    case 'mps': return `${(mv * 2).toFixed(0)} m/s`;
    case 'kmh': return `${(mv * 2 * 3.6).toFixed(0)} km/h`;
    case 'mph': return `${(mv * 2 * 2.237).toFixed(0)} mph`;
    default:    return `MV ${mv}`;
  }
}
