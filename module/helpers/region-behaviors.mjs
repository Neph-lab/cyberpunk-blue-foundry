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
 * Vehicle behaviors (Phase 2 — registered but inert; logic added in later phases):
 *   CyberBlueDriverSeatBehavior    — marks the driver seat zone.
 *   CyberBlueGunnerSeatBehavior    — marks a gunner seat; carries seatIndex.
 *   CyberBluePassengerSeatBehavior — marks a passenger area.
 *   CyberBlueVitalAreaBehavior     — targetable vital zone; carries crit & subsystem refs.
 *   CyberBlueVehicleRoofBehavior   — roof zone; destruction toggles enclosesRiders.
 */

import { getNetConnection, resolveNetAttack } from './netrunning.mjs';

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

/**
 * Driver Seat behavior.
 *
 * Marks a Region as the vehicle's driver seat area.  A token entering this
 * region while no driver is active may claim the driver role.
 *
 * Occupancy logic: Phase 4.
 */
export class CyberBlueDriverSeatBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    // No configuration fields at this stage.
    return {};
  }
}

/**
 * Gunner Seat behavior.
 *
 * Marks a Region as a specific gunner station.  The `seatIndex` links this
 * region to the corresponding entry in `actor.system.seats.gunners` and the
 * mounted-weapon equip/unequip flow (Phase 4+).
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
}

/**
 * Passenger Seat behavior.
 *
 * Marks a Region as a passenger area.  Tokens inside gain the vehicle's SP
 * cover (if enclosesRiders) without influencing driving.
 *
 * Occupancy tracking: Phase 4.
 */
export class CyberBluePassengerSeatBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static defineSchema() {
    return {};
  }
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
