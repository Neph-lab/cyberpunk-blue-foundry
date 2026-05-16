/**
 * Custom Region Behavior Types for Cyberpunk Blue's netrunning system.
 *
 * Registered in `cyberpunk-blue.mjs` under `CONFIG.RegionBehavior.dataModels`.
 * These behaviors are data-store types; the interactive logic lives in
 * `module/helpers/netrunning.mjs`.
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
          exe:  'CYBER_BLUE.RegionBehavior.NetNode.Type.EXE',
          data: 'CYBER_BLUE.RegionBehavior.NetNode.Type.DATA',
          ctrl: 'CYBER_BLUE.RegionBehavior.NetNode.Type.CTRL',
          root: 'CYBER_BLUE.RegionBehavior.NetNode.Type.ROOT',
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
    // Only the GM client handles Black ICE attacks
    if (!game.user.isGM) return;

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
