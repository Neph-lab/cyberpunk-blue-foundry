/**
 * Custom Region Behavior Types for Cyberpunk Blue.
 *
 * Registered in `cyberpunk-blue.mjs` under `CONFIG.RegionBehavior.dataModels`.
 *
 * Netrunning behaviors:
 *   CyberBlueAccessPointBehavior — meat-world AP linking to an Architecture scene.
 *   CyberBlueAccNodeBehavior     — entry-point region inside an Architecture scene.
 *   CyberBlueNetNodeBehavior     — generic EXE/DATA/CTRL/ROOT node with Black ICE.
 *
 * Vehicle behaviors:
 *   CyberBlueDriverSeatBehavior    — marks the driver seat zone; sets/clears actor
 *                                    currentDriverTokenId flag on enter/exit (Phase 4).
 *   CyberBlueGunnerSeatBehavior    — marks a gunner seat; carries seatIndex.
 *   CyberBluePassengerSeatBehavior — marks a passenger area.
 *   CyberBlueVitalAreaBehavior     — targetable vital zone; carries crit & subsystem refs.
 *   CyberBlueVehicleRoofBehavior   — roof zone; destruction toggles enclosesRiders.
 */

import { getNetConnection, resolveNetAttack } from './netrunning.mjs';
import { attachTokenToVehicle, detachTokenFromVehicle } from './vehicle-movement.mjs';
import { DRIVER_TOKEN_FLAG } from './vehicle-combat.mjs';
import { VIS } from './visibility.mjs';
import { applyDamageWithPermission } from './socket.mjs';

/**
 * Access Point — placed in a meat-world scene.
 * References the Architecture scene that a Netrunner can jack into from here,
 * and the specific ACC_node Region in that Architecture where they will spawn.
 */
export class CyberBlueAccessPointBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      architectureSceneUuid: new fields.StringField({
        required: true, blank: true, initial: '',
        label: 'CYBER_BLUE.RegionBehavior.AccessPoint.ArchitectureScene',
        hint: 'CYBER_BLUE.RegionBehavior.AccessPoint.ArchitectureSceneHint',
      }),
      accNodeRegionUuid: new fields.StringField({
        required: true, blank: true, initial: '',
        label: 'CYBER_BLUE.RegionBehavior.AccessPoint.AccNodeRegion',
        hint: 'CYBER_BLUE.RegionBehavior.AccessPoint.AccNodeRegionHint',
      }),
    };
  }
}

/**
 * ACC Node — placed inside an Architecture scene.
 * Marks the entry-point region where connecting Netrunners spawn their tokens.
 * References the Access Point in the physical world.
 */
export class CyberBlueAccNodeBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      accessPointRegionUuid: new fields.StringField({
        required: true, blank: true, initial: '',
        label: 'CYBER_BLUE.RegionBehavior.AccNode.AccessPointRegion',
        hint: 'CYBER_BLUE.RegionBehavior.AccNode.AccessPointRegionHint',
      }),
    };
  }
}

/**
 * NET Node — generic architecture node (EXE / DATA / CTRL / ROOT).
 * Placed inside Architecture scenes to mark node type and label.
 *
 * Also handles Black ICE auto-attack: when a Netrunner's Architecture token
 * enters this region, any Black ICE program actor tokens inside the same
 * region auto-attack the entering Netrunner.
 */
export class CyberBlueNetNodeBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      nodeType: new fields.StringField({
        required: true, blank: false, initial: 'data',
        label: 'CYBER_BLUE.RegionBehavior.NetNode.NodeType',
        choices: {
          exe:  'EXE',
          data: 'DATA',
          ctrl: 'CTRL',
          root: 'ROOT',
        },
      }),
      nodeLabel: new fields.StringField({
        required: true, blank: true, initial: '',
        label: 'CYBER_BLUE.RegionBehavior.NetNode.NodeLabel',
      }),
    };
  }

  // ── Black ICE auto-attack on token entry ────────────────────────────────

  // Handler registered as a wrapper so the class name is resolved at call time
  // (not at class-field initialisation time, when the binding may still be in TDZ).
  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: async function _tokenEnterProxy(event) {
      return CyberBlueNetNodeBehavior._onNetrunnerEntersNode.call(this, event);
    },
  };

  /**
   * When any token enters this region, check if it is a Netrunner's
   * Architecture token. If so, find Black ICE program actor tokens already
   * present in this region and have each one auto-attack the Netrunner.
   *
   * @param {RegionTokenEnterEvent} event
   * @this {CyberBlueNetNodeBehavior}
   */
  static async _onNetrunnerEntersNode(event) {
    // Only the active GM client handles Black ICE attacks (guards against
    // multiple simultaneous GM-level users both processing the hook).
    if (game.user !== game.users.activeGM) return;

    const enteringToken = event.data.token;
    if (!enteringToken?.actor) return;

    // Is this token the Architecture token of a connected Netrunner?
    const netrunnerActor = game.actors.find(
      (a) => getNetConnection(a)?.archTokenId === enteringToken.id,
    );
    if (!netrunnerActor) return;

    // Find Black ICE program actor tokens in this region (excluding the entering token).
    // `this.region.tokens` is the live set of tokens contained by the region.
    const blackIceTokens = [...(this.region?.tokens ?? [])].filter((tok) => {
      if (tok.id === enteringToken.id) return false;
      const actor = tok.actor;
      if (!actor || actor.type !== 'program') return false;
      if (actor.system.programType !== 'blackice') return false;
      // Skip Black ICE in ##ERROR## state (derezed / destroyed)
      if (actor.effects.some((e) => e.getFlag('cyberpunk-blue', 'isErrorState'))) return false;
      return true;
    });

    if (!blackIceTokens.length) return;

    // Announce the encounter
    ChatMessage.create({
      content: `<div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-skull"></i> ${game.i18n.format('CYBER_BLUE.Netrunning.BlackIceEncounter', {
          name: netrunnerActor.name,
          node: this.nodeLabel || game.i18n.localize('CYBER_BLUE.RegionBehavior.NetNode.UnnamedNode'),
        })}</h3>
        <p>${game.i18n.format('CYBER_BLUE.Netrunning.BlackIceEncounterCount', { count: blackIceTokens.length })}</p>
      </div>`,
    });

    // Each Black ICE makes its auto-attack
    for (const iceTok of blackIceTokens) {
      const iceActor = iceTok.actor;
      const atk = Number(iceActor.system.stats?.atk?.value) || 0;
      const atkLabel = `${iceActor.name} ${game.i18n.localize('CYBER_BLUE.Netrunning.BlackIceAutoAttack')}`;

      // Damage formula: use the program's damageFormula field if set, otherwise
      // approximate from ATK modifier (ceil(atk/2))d6 — e.g. ATK 4 → 2d6, ATK 6 → 3d6.
      // The GM can set an exact formula via the damageFormula field on the item.
      const customFormula = iceActor.system.damageFormula;
      const atkVal = atk;
      const damageFormula = customFormula?.trim()
        ? customFormula.trim()
        : `${Math.max(1, Math.ceil(atkVal / 2))}d6`;

      await resolveNetAttack(iceActor, netrunnerActor, atk, atkLabel, damageFormula);
    }
  }
}

// ── Vehicle Region Behavior Types ─────────────────────────────────────────────
//
// These are data-store types registered so the GM can assign them to Regions
// via the standard Foundry Region config UI.  Functional logic (occupancy
// tracking, targeted-attack routing, enclosesRiders toggling) is wired up in
// later phases.  Phase 2 registers them as valid types with minimal schemas.

// ── Shared seat event helpers ─────────────────────────────────────────────────

/**
 * Resolve the vehicle TokenDocument that owns this seat region.
 * Returns null if the region isn't linked to a vehicle token.
 *
 * @param {RegionBehavior} behavior
 * @returns {TokenDocument|null}
 */
function _vehicleTokenForBehavior(behavior) {
  const region = behavior.region;
  if (!region) return null;
  const scene  = region.parent;
  if (!scene) return null;
  const tokenId = region.flags?.['cyberpunk-blue']?.vehicleTokenId;
  if (!tokenId) return null;
  return scene.tokens.get(tokenId) ?? null;
}

/**
 * Handle TOKEN_ENTER on any seat region: attach the entering token to the
 * vehicle so it moves with it.
 *
 * Runs only on the activeGM client to prevent duplicate operations.
 */
async function _onSeatTokenEnter(event) {
  if (game.user !== game.users.activeGM) return;
  const vehicleToken = _vehicleTokenForBehavior(this);
  if (!vehicleToken) return;
  const enteringToken = event.data?.token;
  if (!enteringToken || enteringToken.id === vehicleToken.id) return;
  await attachTokenToVehicle(vehicleToken, enteringToken);
}

/**
 * Handle TOKEN_EXIT on any seat region: detach the leaving token from the
 * vehicle so it is no longer moved along with it.
 *
 * Runs only on the activeGM client.
 */
async function _onSeatTokenExit(event) {
  if (game.user !== game.users.activeGM) return;
  const vehicleToken = _vehicleTokenForBehavior(this);
  if (!vehicleToken) return;
  const exitingToken = event.data?.token;
  if (!exitingToken || exitingToken.id === vehicleToken.id) return;
  await detachTokenFromVehicle(vehicleToken, exitingToken);
}

// ── Seat behavior classes ─────────────────────────────────────────────────────

/**
 * Driver Seat behavior.
 *
 * Marks a Region as the vehicle's driver seat area.  A token entering this
 * region is auto-attached so it moves with the vehicle AND is recorded as the
 * current driver on the vehicle actor (flags.cyberpunk-blue.currentDriverTokenId).
 * This flag is read by `executeVehicleTurn` to distinguish coast from drift.
 *
 * On TOKEN_EXIT the driver flag is cleared so the vehicle reverts to drifting
 * if no new driver takes the seat.
 */
export class CyberBlueDriverSeatBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {};
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: async function _driverEnterProxy(event) {
      await _onSeatTokenEnter.call(this, event);
      // Record the entering token as the active driver on the vehicle actor.
      if (game.user !== game.users.activeGM) return;
      const vehicleToken = _vehicleTokenForBehavior(this);
      if (!vehicleToken?.actor) return;
      const enteringToken = event.data?.token;
      if (!enteringToken || enteringToken.id === vehicleToken.id) return;
      await vehicleToken.actor.setFlag('cyberpunk-blue', DRIVER_TOKEN_FLAG, enteringToken.id);
    },
    [CONST.REGION_EVENTS.TOKEN_EXIT]: async function _driverExitProxy(event) {
      await _onSeatTokenExit.call(this, event);
      // Clear the driver flag so the vehicle is treated as unmanned.
      if (game.user !== game.users.activeGM) return;
      const vehicleToken = _vehicleTokenForBehavior(this);
      if (!vehicleToken?.actor) return;
      const exitingToken = event.data?.token;
      if (!exitingToken || exitingToken.id === vehicleToken.id) return;
      // Only clear if this is actually the current driver (not a passenger exiting).
      const currentDriverId = vehicleToken.actor.getFlag('cyberpunk-blue', DRIVER_TOKEN_FLAG);
      if (currentDriverId === exitingToken.id) {
        await vehicleToken.actor.unsetFlag('cyberpunk-blue', DRIVER_TOKEN_FLAG);
      }
    },
  };
}

/**
 * Gunner Seat behavior.
 *
 * Marks a Region as a specific gunner station.  The `seatIndex` links this
 * region to the mounted-weapon equip/unequip flow (Phase 4+).
 * Tokens entering are auto-attached to the vehicle.
 */
export class CyberBlueGunnerSeatBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // Zero-based index into the vehicle's gunner seat array.
      seatIndex: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0,
        label: 'CYBER_BLUE.RegionBehavior.GunnerSeat.SeatIndex',
      }),
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: async function _gunnerEnterProxy(event) {
      return _onSeatTokenEnter.call(this, event);
    },
    [CONST.REGION_EVENTS.TOKEN_EXIT]: async function _gunnerExitProxy(event) {
      return _onSeatTokenExit.call(this, event);
    },
  };
}

/**
 * Passenger Seat behavior.
 *
 * Marks a Region as a passenger area.  Tokens inside gain the vehicle's SP
 * cover (if enclosesRiders) without influencing driving.
 * Tokens entering are auto-attached to the vehicle.
 */
export class CyberBluePassengerSeatBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {};
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_ENTER]: async function _passengerEnterProxy(event) {
      return _onSeatTokenEnter.call(this, event);
    },
    [CONST.REGION_EVENTS.TOKEN_EXIT]: async function _passengerExitProxy(event) {
      return _onSeatTokenExit.call(this, event);
    },
  };
}

/**
 * Vital Area behavior.
 *
 * Marks a Region as a targetable vital zone on the vehicle hull.  When a
 * targeted attacker selects this zone, incoming damage is routed through
 * `subsystemItemId` (if set) instead of the vehicle's main HP pool; and on a
 * critical hit the `criticalDamageEntryId` entry fires deterministically.
 *
 * Targeting UX and damage routing: Phase 6.
 */
export class CyberBlueVitalAreaBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // RollTable result _id to trigger deterministically when this area is
      // hit on a critical (instead of a random roll).  Blank = random roll.
      criticalDamageEntryId: new fields.StringField({
        required: true,
        blank: true,
        initial: '',
        label: 'CYBER_BLUE.RegionBehavior.VitalArea.CritEntryId',
      }),
      // vehicle-subsystem item _id on the parent vehicle actor.
      // When set: damage routes to that subsystem's HP/SP pool.
      // When null: damage routes to vehicle main HP.
      subsystemItemId: new fields.StringField({
        required: false,
        nullable: true,
        blank: true,
        initial: null,
        label: 'CYBER_BLUE.RegionBehavior.VitalArea.SubsystemItemId',
      }),
    };
  }
}

/**
 * Vehicle Roof behavior.
 *
 * Marks a Region as the roof of the vehicle.  Its presence signals that the
 * vehicle encloses riders in this zone.  When the linked roof subsystem is
 * destroyed (Phase 6), this region's behavior toggles `enclosesRiders` false
 * on the parent actor.
 */
export class CyberBlueVehicleRoofBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {};
  }
}

// ── Visibility Region Behavior ────────────────────────────────────────────────

const _CLIPPER_SCALE = 100; // Clipper integer scaling factor

/**
 * Offset a set of PIXI.Polygon objects inward by `deltaPx` pixels using ClipperLib.
 * Returns an array of PIXI.Polygon objects (one per Clipper output path).
 * Returns [] if the input polys are empty or ClipperLib is unavailable.
 *
 * @param {PIXI.Polygon[]} polys
 * @param {number} deltaPx  positive = inward
 * @returns {PIXI.Polygon[]}
 */
function offsetPolygonsInward(polys, deltaPx) {
  if (!polys?.length || deltaPx <= 0) return [];
  if (typeof ClipperLib === 'undefined') return [];

  try {
    const result = [];
    for (const poly of polys) {
      const clipPts = poly.toClipperPoints({ scalingFactor: _CLIPPER_SCALE });
      if (!clipPts?.length) continue;
      const co = new ClipperLib.ClipperOffset();
      co.AddPath(clipPts, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      const solution = new ClipperLib.Paths();
      co.Execute(solution, -deltaPx * _CLIPPER_SCALE);
      for (const path of solution) {
        const p = PIXI.Polygon.fromClipperPoints(path, { scalingFactor: _CLIPPER_SCALE });
        if (p) result.push(p);
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Visibility behavior — marks a Region as a darkness or obscuration zone.
 *
 * Kind "darkness":    penalty evaluated at the target point.
 * Kind "obscuration": penalty evaluated along the attacker→target LOS.
 *
 * Concentric zones (outside → in):
 *   [edge .. lightBandWidth m]                        → DIM   (lightly obscured / dim)
 *   [lightBandWidth .. lightBandWidth + noVisInset m] → DARK  (heavily obscured / dark)
 *   inner core (if enableNoVisibility)                → NOT_VISIBLE (hard block)
 *
 * All band widths are in **metres** (scene distance units).
 *
 * Bypass:
 *   ignoreDarknessPenalty / ignoreObscurationPenalty — removes −2/−4; NOT_VISIBLE still blocks.
 *   bypassDarkness / bypassObscuration               — removes everything incl. NOT_VISIBLE.
 *   Wire these as Active Effect flags (flags.cyberpunk-blue.<key> = true) on cyberware / gear.
 *
 * Residue: set `expiresInRounds > 0` for auto-deletion; the hook in cyberpunk-blue.mjs handles
 * round-based expiry. Out-of-combat time-based expiry uses a flag created alongside the region.
 *
 * Visuals: v1 applies a PIXI ColorMatrixFilter (desaturate + optional darkening) and a blur
 * filter to the region canvas object for a quick visual cue. A proper RegionShader overlay is
 * deferred to a future pass.
 */
export class CyberBlueVisibilityRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      kind: new fields.StringField({
        required: true,
        blank: false,
        initial: 'obscuration',
        choices: {
          darkness:    'CYBER_BLUE.RegionBehavior.Visibility.KindDarkness',
          obscuration: 'CYBER_BLUE.RegionBehavior.Visibility.KindObscuration',
        },
        label: 'CYBER_BLUE.RegionBehavior.Visibility.Kind',
        hint:  'CYBER_BLUE.RegionBehavior.Visibility.KindHint',
      }),
      lightBandWidth: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
        min: 0,
        label: 'CYBER_BLUE.RegionBehavior.Visibility.LightBandWidth',
        hint:  'CYBER_BLUE.RegionBehavior.Visibility.LightBandWidthHint',
      }),
      enableNoVisibility: new fields.BooleanField({
        initial: false,
        label: 'CYBER_BLUE.RegionBehavior.Visibility.EnableNoVisibility',
        hint:  'CYBER_BLUE.RegionBehavior.Visibility.EnableNoVisibilityHint',
      }),
      noVisInset: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
        min: 0,
        label: 'CYBER_BLUE.RegionBehavior.Visibility.NoVisInset',
        hint:  'CYBER_BLUE.RegionBehavior.Visibility.NoVisInsetHint',
      }),
      expiresInRounds: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
        min: 0,
        label: 'CYBER_BLUE.RegionBehavior.Visibility.ExpiresInRounds',
        hint:  'CYBER_BLUE.RegionBehavior.Visibility.ExpiresInRoundsHint',
      }),
    };
  }

  // ── Band polygon cache ──────────────────────────────────────────────────────

  /**
   * Build (or return cached) the inset band polygons for `classifyPoint`.
   * Cache is invalidated by _invalidateBandCache, called on boundary/update events.
   *
   * @returns {{ dimInner: PIXI.Polygon[], core: PIXI.Polygon[] }}
   */
  _buildBandCache() {
    if (this._bandCache && !this._bandCacheInvalid) return this._bandCache;

    const mPx = canvas.dimensions?.distancePixels ?? 1; // px per metre
    const polys = this.region?.polygons ?? [];

    const dimInner = offsetPolygonsInward(polys, this.lightBandWidth * mPx);
    let core = [];
    if (this.enableNoVisibility) {
      core = offsetPolygonsInward(polys, (this.lightBandWidth + this.noVisInset) * mPx);
    }

    this._bandCache = { dimInner, core };
    this._bandCacheInvalid = false;
    return this._bandCache;
  }

  _invalidateBandCache() {
    this._bandCacheInvalid = true;
  }

  // ── Point classification ────────────────────────────────────────────────────

  /**
   * Return the VIS level at `point` according to this region's band geometry.
   * Called from visibility.mjs for both darkness-at-target and obscuration-along-LOS.
   *
   * @param {{x:number, y:number}} point  canvas pixel coordinates
   * @returns {number} VIS constant (NONE=0, DIM=1, DARK=2, NOT_VISIBLE=3)
   */
  classifyPoint(point) {
    const { dimInner, core } = this._buildBandCache();

    // Innermost zone first
    if (core.length && core.some((p) => p.contains(point.x, point.y))) return VIS.NOT_VISIBLE;
    if (dimInner.length && dimInner.some((p) => p.contains(point.x, point.y))) return VIS.DARK;

    // Check if the point is within the outer region boundary at all
    const regionPolys = this.region?.polygons ?? [];
    if (regionPolys.some((p) => p.contains(point.x, point.y))) return VIS.DIM;

    return VIS.NONE;
  }

  // ── Visual overlay (v1: PIXI filters on region canvas object) ───────────────

  static _onBehaviorViewed(event) {
    const regionObj = this.region?.object;
    if (!regionObj) return;

    const filters = [];
    const perfOK = (canvas.performance?.mode ?? 0) > (CONST.CANVAS_PERFORMANCE_MODES?.LOW ?? 0);

    if (perfOK) {
      // Desaturate for both kinds
      const mat = new PIXI.ColorMatrixFilter();
      mat.desaturate();
      if (this.kind === 'darkness') mat.brightness(0.4, false);
      filters.push(mat);

      // Blur for obscuration regions
      if (this.kind === 'obscuration') {
        const blur = canvas.createBlurFilter?.(8, 2) ?? new PIXI.BlurFilter(8);
        filters.push(blur);
      }
    }

    if (!regionObj._cpbVisFilters) regionObj._cpbVisFilters = {};
    const key = this.parent?.id ?? 'unknown';
    regionObj._cpbVisFilters[key] = filters;
    if (filters.length) {
      regionObj.filters = [...(regionObj.filters ?? []), ...filters];
    }
  }

  static _onBehaviorUnviewed(event) {
    const regionObj = this.region?.object;
    if (!regionObj) return;

    const key = this.parent?.id ?? 'unknown';
    const myFilters = regionObj._cpbVisFilters?.[key] ?? [];
    if (myFilters.length) {
      regionObj.filters = (regionObj.filters ?? []).filter((f) => !myFilters.includes(f));
    }
    if (regionObj._cpbVisFilters) delete regionObj._cpbVisFilters[key];
  }

  static _onRegionBoundary(event) {
    // Invalidate cached band polygons when the region shape changes
    this._invalidateBandCache();
  }

  // ── DataModel lifecycle ─────────────────────────────────────────────────────

  _onUpdate(changed, options, userId) {
    super._onUpdate?.(changed, options, userId);
    // Invalidate band cache whenever system fields change
    if ('system' in changed) this._invalidateBandCache();
  }

  // ── Static events registration ──────────────────────────────────────────────

  static events = {
    [CONST.REGION_EVENTS.BEHAVIOR_VIEWED]: function _visViewed(event) {
      CyberBlueVisibilityRegionBehavior._onBehaviorViewed.call(this, event);
    },
    [CONST.REGION_EVENTS.BEHAVIOR_UNVIEWED]: function _visUnviewed(event) {
      CyberBlueVisibilityRegionBehavior._onBehaviorUnviewed.call(this, event);
    },
    [CONST.REGION_EVENTS.REGION_BOUNDARY]: function _visBoundary(event) {
      CyberBlueVisibilityRegionBehavior._onRegionBoundary.call(this, event);
    },
  };
}

// ── Hazard Region Behavior (caltrops, broken glass, etc.) ─────────────────────
//
// A movement hazard: when a token moves through the region, it must save
// (default DV15 RFLX + Athletics) or take damage scaled by the distance moved
// through the hazard (default 1d6 per 2m). Deployed by caltrops (see
// cone-attack.mjs createHazardRegion) but usable as a generic GM tool.

/** Dedupe processed movements so MOVE_IN + MOVE_WITHIN don't double-hit. */
const _hazardProcessed = new Set();

export class CyberBlueHazardRegionBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      label: new fields.StringField({
        required: true, blank: true, initial: 'Hazard',
        label: 'CYBER_BLUE.RegionBehavior.Hazard.Label',
      }),
      dv: new fields.NumberField({
        required: true, nullable: false, integer: true, initial: 15, min: 0,
        label: 'CYBER_BLUE.RegionBehavior.Hazard.Dv',
      }),
      savePrimary: new fields.StringField({
        required: true, blank: false, initial: 'rflx',
        label: 'CYBER_BLUE.RegionBehavior.Hazard.SavePrimary',
      }),
      saveSkill: new fields.StringField({
        required: true, blank: true, initial: 'athletics',
        label: 'CYBER_BLUE.RegionBehavior.Hazard.SaveSkill',
      }),
      damageDie: new fields.StringField({
        required: true, blank: false, initial: '1d6',
        label: 'CYBER_BLUE.RegionBehavior.Hazard.DamageDie',
      }),
      metersPerStep: new fields.NumberField({
        required: true, nullable: false, initial: 2, min: 0.1,
        label: 'CYBER_BLUE.RegionBehavior.Hazard.MetersPerStep',
      }),
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_MOVE_IN]: async function _hazardMoveIn(event) {
      return CyberBlueHazardRegionBehavior._onHazardMove.call(this, event);
    },
    [CONST.REGION_EVENTS.TOKEN_MOVE_WITHIN]: async function _hazardMoveWithin(event) {
      return CyberBlueHazardRegionBehavior._onHazardMove.call(this, event);
    },
  };

  /**
   * Metres travelled by the token's centre inside this region during `movement`.
   * Uses Region#segmentizeMovementPath; falls back to one step on any failure.
   * @returns {number}
   */
  _inRegionMeters(token, movement) {
    const gridSize = canvas?.grid?.size ?? 100;
    const gridDistance = canvas.scene?.grid?.distance ?? 1;
    const units = (canvas.scene?.grid?.units ?? '').toLowerCase().trim();
    const metersPerUnit = ['m', 'meter', 'meters'].includes(units) ? gridDistance : 2;
    try {
      const wpSource = (movement?.passed?.waypoints?.length ?? 0) >= 2
        ? movement.passed.waypoints
        : [movement.origin, movement.destination];
      const waypoints = wpSource.map((w) => ({ x: w.x, y: w.y, elevation: w.elevation ?? 0, teleport: !!w.teleport }));
      const cx = ((token.width ?? 1) * gridSize) / 2;
      const cy = ((token.height ?? 1) * gridSize) / 2;
      const segments = this.region.segmentizeMovementPath(waypoints, [{ x: cx, y: cy }]);
      let px = 0;
      for (const s of segments) {
        px += Math.hypot((s.to.x ?? 0) - (s.from.x ?? 0), (s.to.y ?? 0) - (s.from.y ?? 0));
      }
      if (px <= 0) return this.metersPerStep; // entered but no measurable path → one step
      return (px / gridSize) * metersPerUnit;
    } catch (_err) {
      return this.metersPerStep;
    }
  }

  /** Build a damage formula for N steps from the per-step die (e.g. '1d6' → 'Nd6'). */
  _stepDamageFormula(steps) {
    const m = /^\s*(\d*)d(\d+)\s*$/i.exec(this.damageDie ?? '1d6');
    if (!m) return `${steps}d6`;
    const perStep = m[1] === '' ? 1 : Number(m[1]);
    const dieSize = Number(m[2]);
    return `${Math.max(1, steps * perStep)}d${dieSize}`;
  }

  static async _onHazardMove(event) {
    if (game.user !== game.users.activeGM) return;
    const token = event.data?.token;
    const actor = token?.actor;
    if (!actor) return;

    // Dedupe by movement id so MOVE_IN + MOVE_WITHIN don't both fire.
    const moveId = event.data?.movement?.id;
    const key = `${this.behavior?.id ?? this.region?.id}:${moveId}`;
    if (moveId) {
      if (_hazardProcessed.has(key)) return;
      _hazardProcessed.add(key);
      if (_hazardProcessed.size > 200) _hazardProcessed.clear();
    }

    const meters = this._inRegionMeters(token, event.data.movement);
    const steps = Math.max(1, Math.floor(meters / (this.metersPerStep || 2)));

    // Save: 1d10 + primary stat + skill vs DV.
    const statSlug = this.savePrimary || 'rflx';
    const skillSlug = this.saveSkill || '';
    const statVal = actor.system?.stats?.[statSlug]?.value ?? 0;
    const statMod = actor.system?.stats?.[statSlug]?.rollMod ?? 0;
    const skillRank = skillSlug ? (actor.system?.skills?.[skillSlug]?.rank ?? 0) : 0;
    const skillBonus = skillSlug ? (actor.system?.skills?.[skillSlug]?.bonus ?? 0) : 0;
    const flat = statVal + statMod + skillRank + skillBonus;
    const saveRoll = await new Roll(`1d10 + ${flat}`).evaluate();

    const statLabel = CONFIG.CYBER_BLUE.stats?.[statSlug]?.shortLabel ?? statSlug.toUpperCase();
    const skillLabel = skillSlug ? (CONFIG.CYBER_BLUE.skills?.[skillSlug]?.label ?? skillSlug) : null;
    const passed = saveRoll.total >= this.dv;

    await saveRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-shoe-prints"></i> ${this.label || game.i18n.localize('CYBER_BLUE.RegionBehavior.Hazard.Label')}: ${actor.name}</h3>
        <p>${statLabel}${skillLabel ? ` + ${skillLabel}` : ''} vs DV <strong>${this.dv}</strong> — <strong>${game.i18n.localize(passed ? 'CYBER_BLUE.Combat.AfflictionResisted' : 'CYBER_BLUE.Combat.AfflictionFailed')}</strong></p>
        <p>${game.i18n.format('CYBER_BLUE.RegionBehavior.Hazard.MovedThrough', { m: meters.toFixed(1) })}</p>
      </div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    if (passed) return;

    const dmgRoll = await new Roll(this._stepDamageFormula(steps)).evaluate();
    await dmgRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-droplet"></i> ${this.label}: ${actor.name}</h3></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    await applyDamageWithPermission(actor, dmgRoll.total);
  }
}
