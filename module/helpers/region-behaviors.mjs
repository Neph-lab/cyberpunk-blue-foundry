/**
 * Custom Region Behavior Types for Cyberpunk Blue's netrunning system.
 *
 * Registered in `cyberpunk-blue.mjs` under `CONFIG.RegionBehavior.dataModels`.
 * These behaviors are data-store types; the interactive logic lives in
 * `module/helpers/netrunning.mjs`.
 */

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
}
