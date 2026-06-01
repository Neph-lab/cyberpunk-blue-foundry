import { CyberBlueActor } from './documents/actor.mjs';
import { CyberBlueItem } from './documents/item.mjs';
import { CyberBlueActiveEffect } from './documents/active-effect.mjs';
import { CyberBlueCombat } from './documents/combat.mjs';
import { VehicleManeuverDialog } from './apps/vehicle-maneuver-dialog.mjs';
import { VehicleHud } from './apps/vehicle-hud.mjs';
import { CyberBlueActorSheet } from './sheets/actor-sheet.mjs';
import { CyberBlueItemSheet } from './sheets/item-sheet.mjs';
import { CyberBlueMookSheet } from './sheets/mook-sheet.mjs';
import { CyberBlueProgramSheet } from './sheets/program-sheet.mjs';
import { CyberBlueVehicleSheet } from './sheets/vehicle-sheet.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { CYBER_BLUE } from './helpers/config.mjs';
import { applyWeaponTypeDefaults, createWeaponData, COMBAT_CONFIG } from './helpers/combat.mjs';
import {
  CYBERWARE_DISABLE_CHANGE_KEYS,
  getActorCyberwareDisableState,
  resolveCyberwareDisableSelections,
  syncDisabledCyberwareItemEffects,
  syncActorCyberwareDisableEffects,
} from './helpers/cyberware-disable.mjs';
import { syncActorLeaderRoles, syncAllProteanFociAEs, syncAllRoleConditionAEs, normalizeRoleSystemData } from './helpers/roles.mjs';
import { CyberBlueJsonImportDialog, CyberBlueMacroCreator, CyberBlueWeaponImportDialog, CyberBlueResyncStartingGear } from './helpers/gm-tools.mjs';
import { CharacterCreationWizard } from './helpers/character-creation.mjs';
import { initAudio, playUiSound } from './helpers/audio.mjs';
import { initResidueMediaSync } from './helpers/media-effects.mjs';
import {
  getActiveCombatant,
  getCombatantForToken,
  getTurnState,
  getMovementBudget,
  resetTurnState,
  addMovementCost,
  grantSprint,
  recordCombatAttack,
  markActionUsed,
  unlockNetActions,
  consumeNetAction,
  markSpotWeaknessUsed,
  markDamageDeflectionUsed,
} from './helpers/combat-tracker.mjs';
import * as models from './data/_module.mjs';
import { CRITICAL_INJURY_FLAG, buildCritBodyTableData, buildCritHeadTableData } from './helpers/critical-injury.mjs';
import { MACRO_CATALOGUE } from './helpers/critical-injury-macros.mjs';
import { ensureTarotDeck, registerTarotHooks } from './helpers/guide-tarot.mjs';
import { WEAPON_CATALOGUE } from './data/weapon-catalogue.mjs';
import { MOD_CATALOGUE } from './data/mod-catalogue.mjs';
import { EQUIPMENT_CATALOGUE } from './data/equipment-catalogue.mjs';
import { CYBERWARE_CATALOGUE } from './data/cyberware-catalogue.mjs';
import { DRUG_CATALOGUE } from './data/drug-catalogue.mjs';
import { PROGRAM_CATALOGUE } from './data/program-catalogue.mjs';
import { AMMO_CATALOGUE } from './data/ammo-catalogue.mjs';
import { ROLE_CATALOGUE } from './data/role-catalogue.mjs';
import { ABILITY_CATALOGUE } from './data/ability-catalogue.mjs';
import { LIFEPATH_CATALOGUE } from './data/lifepath-catalogue.mjs';
import { registerSocketHandlers, applyDamageWithPermission } from './helpers/socket.mjs';
import { syncRoleGrantedItemGroups } from './helpers/world-init.mjs';
import { refreshAllRicochetLines, clearRicochetLine } from './helpers/ricochet-canvas.mjs';
import { refreshTechChargeHighlights, clearTechChargeHighlights } from './helpers/tech-charge-canvas.mjs';
import { clearWeaponCharge } from './helpers/tech-charge.mjs';
import {
  CyberBlueAccessPointBehavior,
  CyberBlueAccNodeBehavior,
  CyberBlueNetNodeBehavior,
  CyberBlueDriverSeatBehavior,
  CyberBlueGunnerSeatBehavior,
  CyberBluePassengerSeatBehavior,
  CyberBlueVitalAreaBehavior,
  CyberBlueVehicleRoofBehavior,
  CyberBlueVisibilityRegionBehavior,
} from './helpers/region-behaviors.mjs';
import { materialiseVehicleBlueprint, cleanupVehicleRegions, syncVehicleRegionPositions, recordVehicleBaseFootprint, applyVehicleRotationSnap } from './helpers/vehicle-regions.mjs';
import {
  syncAttachedTokenPositions,
  checkVehicleCollisions,
  detachTokenFromVehicle,
  pruneAttachedTokens,
  getAttachedTokens,
} from './helpers/vehicle-movement.mjs';
import {
  executeVehicleTurn,
  rollVehicleInitiative,
  delayDriverToVehicle,
  getVehicleHandling,
  getPendingManeuver as getVehiclePendingManeuver,
  DRIVER_TOKEN_FLAG as VEHICLE_DRIVER_TOKEN_FLAG,
} from './helpers/vehicle-combat.mjs';
import {
  syncVehicleSeriousDamage,
  checkVehicleWreckTransition,
  ensureVehicleCritTables,
  syncSubsystemDestruction,
} from './helpers/vehicle-damage.mjs';
import { ensureLostControlTables } from './helpers/vehicle-lost-control.mjs';
import { ensureVehicleCatalogue } from './data/vehicle-catalogue.mjs';
import {
  isNetConnected,
  getNetConnection,
  isNetArchitectureScene,
  PROGRAM_ACTOR_FLAG,
  getPrimaryCyberdeck,
  getAccessPointsInRange,
  spawnProgramActor,
  despawnProgramActor,
  disconnectFromArchitecture,
  syncRezToExecutable,
  syncExeStatsToActor,
  applyErrorState,
  resolveNetTimers,
} from './helpers/netrunning.mjs';

Hooks.once('init', function () {
  game.cyberpunkblue = {
    CyberBlueActor,
    CyberBlueItem,
    CyberBlueActiveEffect,
    config: CYBER_BLUE,
    combat: {
      createWeaponData,
      applyWeaponTypeDefaults,
      applyDamage: async (actor, amount, options = {}) => actor.applyDamage(amount, options),
    },
    cyberwareDisable: {
      keys: CYBERWARE_DISABLE_CHANGE_KEYS,
      getState: getActorCyberwareDisableState,
      resolve: resolveCyberwareDisableSelections,
      syncItemEffects: syncDisabledCyberwareItemEffects,
      sync: syncActorCyberwareDisableEffects,
    },
    roles: {
      syncLeaderTeams: syncActorLeaderRoles,
      syncProteanFoci: syncAllProteanFociAEs,
      syncConditionAEs: syncAllRoleConditionAEs,
    },
  };

  CONFIG.CYBER_BLUE = CYBER_BLUE;
  CONFIG.Combat.initiative = {
    // Include rollMod so AEs (Seriously Wounded, Kerenzikov, tactic bonuses) affect initiative.
    // initiativeBonus is separate from RFLX rollMod so it only affects initiative rolls,
    // not other RFLX-based checks (e.g. Reaction Speed ability).
    formula: '1d10 + @stats.rflx.value + @stats.rflx.rollMod + @initiativeBonus',
    decimals: 0,
  };
  // Override the Combat document class so vehicle combatants receive Handling-based
  // initiative instead of the standard d10+RFLX formula.
  CONFIG.Combat.documentClass = CyberBlueCombat;

  CONFIG.Actor.documentClass = CyberBlueActor;
  CONFIG.ActiveEffect.documentClass = CyberBlueActiveEffect;
  CONFIG.Actor.dataModels = {
    character: models.CyberBlueCharacter,
    npc: models.CyberBlueNPC,
    mook: models.CyberBlueMook,
    program: models.CyberBlueProgram,
    vehicle: models.CyberBlueVehicle,
  };
  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ['resources.hp', 'resources.armor', 'resources.psyche', 'resources.luck'],
      value: ['resources.deathSave.value', 'resources.seriousWoundThreshold.value'],
    },
    npc: {
      bar: ['resources.hp', 'resources.armor', 'resources.psyche', 'resources.luck'],
      value: ['resources.deathSave.value', 'resources.seriousWoundThreshold.value'],
    },
    mook: {
      bar: ['resources.hp', 'resources.armor'],
      value: [],
    },
    program: {
      bar: ['resources.rez'],
      value: [],
    },
    vehicle: {
      bar: ['resources.hp', 'resources.armor'],
      value: [],
    },
  };

  CONFIG.Item.documentClass = CyberBlueItem;
  CONFIG.Item.dataModels = {
    role: models.CyberBlueRole,
    ability: models.CyberBlueAbility,
    cyberware: models.CyberBlueCyberware,
    gear: models.CyberBlueGear,
    ammo: models.CyberBlueAmmo,
    programExecutable: models.CyberBlueProgramExecutable,
    drug: models.CyberBlueDrug,
    mod: models.CyberBlueMod,
    vehicleMod: models.CyberBlueVehicleMod,
    vehicleSubsystem: models.CyberBlueVehicleSubsystem,
  };

  CONFIG.ActiveEffect.legacyTransferral = false;

  // ── Region Behavior Types ──────────────────────────────────────────────────
  // Note: system.json registers these under documentTypes.RegionBehavior without
  // the system-id prefix (Foundry does NOT auto-prefix for systems, only modules).
  // All client-side registrations must match the unprefixed keys.
  // ── Netrunning behaviors ──────────────────────────────────────────────────
  CONFIG.RegionBehavior.dataModels['accessPoint'] = CyberBlueAccessPointBehavior;
  CONFIG.RegionBehavior.dataModels['accNode']     = CyberBlueAccNodeBehavior;
  CONFIG.RegionBehavior.dataModels['netNode']     = CyberBlueNetNodeBehavior;
  CONFIG.RegionBehavior.typeLabels['accessPoint'] = 'CYBER_BLUE.RegionBehavior.AccessPoint.Label';
  CONFIG.RegionBehavior.typeLabels['accNode']     = 'CYBER_BLUE.RegionBehavior.AccNode.Label';
  CONFIG.RegionBehavior.typeLabels['netNode']     = 'CYBER_BLUE.RegionBehavior.NetNode.Label';

  // ── Vehicle behaviors ─────────────────────────────────────────────────────
  CONFIG.RegionBehavior.dataModels['driverSeat']    = CyberBlueDriverSeatBehavior;
  CONFIG.RegionBehavior.dataModels['gunnerSeat']    = CyberBlueGunnerSeatBehavior;
  CONFIG.RegionBehavior.dataModels['passengerSeat'] = CyberBluePassengerSeatBehavior;
  CONFIG.RegionBehavior.dataModels['vitalArea']     = CyberBlueVitalAreaBehavior;
  CONFIG.RegionBehavior.dataModels['vehicleRoof']   = CyberBlueVehicleRoofBehavior;
  CONFIG.RegionBehavior.typeLabels['driverSeat']    = 'CYBER_BLUE.RegionBehavior.DriverSeat.Label';
  CONFIG.RegionBehavior.typeLabels['gunnerSeat']    = 'CYBER_BLUE.RegionBehavior.GunnerSeat.Label';
  CONFIG.RegionBehavior.typeLabels['passengerSeat'] = 'CYBER_BLUE.RegionBehavior.PassengerSeat.Label';
  CONFIG.RegionBehavior.typeLabels['vitalArea']     = 'CYBER_BLUE.RegionBehavior.VitalArea.Label';
  CONFIG.RegionBehavior.typeLabels['vehicleRoof']   = 'CYBER_BLUE.RegionBehavior.VehicleRoof.Label';

  // ── Visibility behavior ───────────────────────────────────────────────────
  CONFIG.RegionBehavior.dataModels['visibility'] = CyberBlueVisibilityRegionBehavior;
  CONFIG.RegionBehavior.typeLabels['visibility'] = 'CYBER_BLUE.RegionBehavior.Visibility.Label';

  Actors.registerSheet('cyberpunk-blue', CyberBlueActorSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Actor',
    types: ['character', 'npc'],
  });
  Actors.registerSheet('cyberpunk-blue', CyberBlueMookSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Mook',
    types: ['mook'],
  });
  Actors.registerSheet('cyberpunk-blue', CyberBlueProgramSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Program',
    types: ['program'],
  });
  Actors.registerSheet('cyberpunk-blue', CyberBlueVehicleSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Vehicle',
    types: ['vehicle'],
  });

  Items.registerSheet('cyberpunk-blue', CyberBlueItemSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Item',
    types: ['role', 'ability', 'cyberware', 'gear', 'ammo', 'programExecutable', 'drug', 'mod', 'vehicleMod', 'vehicleSubsystem'],
  });

  game.settings.registerMenu('cyberpunk-blue', 'importItemsMenu', {
    name: 'CYBER_BLUE.Settings.ImportItems.Name',
    label: 'CYBER_BLUE.Settings.ImportItems.Label',
    hint: 'CYBER_BLUE.Settings.ImportItems.Hint',
    icon: 'fas fa-file-import',
    type: CyberBlueJsonImportDialog,
    restricted: true,
  });

  game.settings.registerMenu('cyberpunk-blue', 'createMacrosMenu', {
    name: 'CYBER_BLUE.Settings.CreateMacros.Name',
    label: 'CYBER_BLUE.Settings.CreateMacros.Label',
    hint: 'CYBER_BLUE.Settings.CreateMacros.Hint',
    icon: 'fas fa-code',
    type: CyberBlueMacroCreator,
    restricted: true,
  });

  game.settings.registerMenu('cyberpunk-blue', 'importWeaponsMenu', {
    name: 'CYBER_BLUE.Settings.ImportWeapons.Name',
    label: 'CYBER_BLUE.Settings.ImportWeapons.Label',
    hint: 'CYBER_BLUE.Settings.ImportWeapons.Hint',
    icon: 'fas fa-crosshairs',
    type: CyberBlueWeaponImportDialog,
    restricted: true,
  });

  game.settings.registerMenu('cyberpunk-blue', 'resyncStartingGearMenu', {
    name: 'Re-sync Role Starting Gear',
    label: 'Re-sync Starting Gear',
    hint: 'Resolve role starting-gear item names to UUIDs and update the Roles compendium.',
    icon: 'fas fa-sync',
    type: CyberBlueResyncStartingGear,
    restricted: true,
  });

  // ── System settings ────────────────────────────────────────────────────────
  game.settings.register('cyberpunk-blue', 'areaEffectDuration', {
    name: 'CYBER_BLUE.Settings.AreaEffectDuration.Name',
    hint: 'CYBER_BLUE.Settings.AreaEffectDuration.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 10,
    range: { min: 0, max: 120, step: 5 },
    requiresReload: false,
  });

  // Per-user speed-unit preference for the Vehicle Status HUD.
  game.settings.register('cyberpunk-blue', 'vehicleSpeedUnits', {
    name: 'CYBER_BLUE.Settings.VehicleSpeedUnits.Name',
    hint: 'CYBER_BLUE.Settings.VehicleSpeedUnits.Hint',
    scope: 'client',
    config: true,
    type: String,
    choices: {
      mv:  'CYBER_BLUE.Settings.VehicleSpeedUnits.MV',
      mps: 'CYBER_BLUE.Settings.VehicleSpeedUnits.MPS',
      kmh: 'CYBER_BLUE.Settings.VehicleSpeedUnits.KMH',
      mph: 'CYBER_BLUE.Settings.VehicleSpeedUnits.MPH',
    },
    default: 'kmh',
    requiresReload: false,
  });

  game.settings.register('cyberpunk-blue', 'vehicleRotationSnap', {
    name: 'CYBER_BLUE.Settings.VehicleRotationSnap.Name',
    hint: 'CYBER_BLUE.Settings.VehicleRotationSnap.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
  });

  // ── Visibility penalty settings ────────────────────────────────────────────
  game.settings.register('cyberpunk-blue', 'visibilityEnabled', {
    name: 'CYBER_BLUE.Settings.VisibilityEnabled.Name',
    hint: 'CYBER_BLUE.Settings.VisibilityEnabled.Hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  game.settings.register('cyberpunk-blue', 'visibilityDimPenalty', {
    name: 'CYBER_BLUE.Settings.VisibilityDimPenalty.Name',
    hint: 'CYBER_BLUE.Settings.VisibilityDimPenalty.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: -2,
    requiresReload: false,
  });

  game.settings.register('cyberpunk-blue', 'visibilityDarkPenalty', {
    name: 'CYBER_BLUE.Settings.VisibilityDarkPenalty.Name',
    hint: 'CYBER_BLUE.Settings.VisibilityDarkPenalty.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: -4,
    requiresReload: false,
  });

  game.settings.register('cyberpunk-blue', 'visibilityDimThreshold', {
    name: 'CYBER_BLUE.Settings.VisibilityDimThreshold.Name',
    hint: 'CYBER_BLUE.Settings.VisibilityDimThreshold.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 0.25,
    range: { min: 0, max: 1, step: 0.05 },
    requiresReload: false,
  });

  game.settings.register('cyberpunk-blue', 'visibilityDarkThreshold', {
    name: 'CYBER_BLUE.Settings.VisibilityDarkThreshold.Name',
    hint: 'CYBER_BLUE.Settings.VisibilityDarkThreshold.Hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 0.5,
    range: { min: 0, max: 1, step: 0.05 },
    requiresReload: false,
  });


  // ── Foundry Conditions (status effects) ────────────────────────────────────
  // These map system conditions to Foundry's token condition overlay system.
  // AE changes on conditions with numeric effects are applied via embeds; purely
  // descriptive conditions use no changes and rely on the GM to apply them.
  CONFIG.statusEffects = [
    {
      id: 'dying',
      name: 'CYBER_BLUE.Condition.Dying',
      icon: 'icons/svg/skull.svg',
      changes: [
        { key: 'system.stats.body.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.rflx.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.int.rollMod',  type: 'add', value: '-2' },
        { key: 'system.stats.tech.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.cool.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.move.value',   type: 'add', value: '-6' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'dying' } },
    },
    {
      id: 'dead',
      name: 'CYBER_BLUE.Condition.Dead',
      icon: 'icons/svg/tombstone.svg',
      changes: [],
      flags: { 'cyberpunk-blue': { conditionId: 'dead' } },
    },
    {
      id: 'unconscious',
      name: 'CYBER_BLUE.Condition.Unconscious',
      icon: 'icons/svg/unconscious.svg',
      changes: [
        { key: 'system.stats.rflx.rollMod', type: 'override', value: '-99' },
        { key: 'system.stats.int.rollMod',  type: 'override', value: '-99' },
        { key: 'system.stats.tech.rollMod', type: 'override', value: '-99' },
        { key: 'system.stats.cool.rollMod', type: 'override', value: '-99' },
        { key: 'system.stats.move.value',   type: 'override', value: '0' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'unconscious' } },
    },
    {
      id: 'prone',
      name: 'CYBER_BLUE.Condition.Prone',
      icon: 'icons/svg/falling.svg',
      changes: [
        { key: 'system.stats.move.value', type: 'add', value: '-2' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'prone' } },
    },
    {
      id: 'asleep',
      name: 'CYBER_BLUE.Condition.Asleep',
      icon: 'icons/svg/sleep.svg',
      changes: [
        { key: 'system.stats.rflx.rollMod', type: 'override', value: '-99' },
        { key: 'system.stats.int.rollMod',  type: 'override', value: '-99' },
        { key: 'system.stats.tech.rollMod', type: 'override', value: '-99' },
        { key: 'system.stats.cool.rollMod', type: 'override', value: '-99' },
        { key: 'system.stats.move.value',   type: 'override', value: '0' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'asleep' } },
    },
    {
      id: 'stunned',
      name: 'CYBER_BLUE.Condition.Stunned',
      icon: 'icons/svg/daze.svg',
      changes: [
        { key: 'system.stats.body.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.rflx.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.int.rollMod',  type: 'add', value: '-4' },
        { key: 'system.stats.tech.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.cool.rollMod', type: 'add', value: '-4' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'stunned' } },
    },
    {
      id: 'restrained',
      name: 'CYBER_BLUE.Condition.Restrained',
      icon: 'icons/svg/net.svg',
      changes: [
        { key: 'system.stats.move.value', type: 'override', value: '0' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'restrained' } },
    },
    {
      id: 'grappled',
      name: 'CYBER_BLUE.Condition.Grappled',
      icon: 'icons/svg/grab.svg',
      changes: [
        { key: 'system.stats.move.value', type: 'override', value: '0' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'grappled' } },
    },
    {
      id: 'burning-embers',
      name: 'CYBER_BLUE.Condition.BurningEmbers',
      icon: 'icons/svg/fire.svg',
      changes: [],
      flags: { 'cyberpunk-blue': { conditionId: 'burning-embers', burnDamage: 2 } },
    },
    {
      id: 'burning-fire',
      name: 'CYBER_BLUE.Condition.BurningFire',
      icon: 'icons/svg/fire.svg',
      changes: [],
      flags: { 'cyberpunk-blue': { conditionId: 'burning-fire', burnDamage: 4 } },
    },
    {
      id: 'burning-deadly',
      name: 'CYBER_BLUE.Condition.BurningDeadly',
      icon: 'icons/svg/fire.svg',
      changes: [],
      flags: { 'cyberpunk-blue': { conditionId: 'burning-deadly', burnDamage: 6 } },
    },
    {
      id: 'fatigued',
      name: 'CYBER_BLUE.Condition.Fatigued',
      icon: 'icons/svg/downgrade.svg',
      changes: [
        { key: 'system.stats.body.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.rflx.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.int.rollMod',  type: 'add', value: '-2' },
        { key: 'system.stats.tech.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.cool.rollMod', type: 'add', value: '-2' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'fatigued' } },
    },
    {
      id: 'severe-fatigue',
      name: 'CYBER_BLUE.Condition.SevereFatigue',
      icon: 'icons/svg/downgrade.svg',
      changes: [
        { key: 'system.stats.body.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.rflx.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.int.rollMod',  type: 'add', value: '-4' },
        { key: 'system.stats.tech.rollMod', type: 'add', value: '-2' },
        { key: 'system.stats.cool.rollMod', type: 'add', value: '-2' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'severe-fatigue' } },
    },
    {
      id: 'extreme-fatigue',
      name: 'CYBER_BLUE.Condition.ExtremeFatigue',
      icon: 'icons/svg/downgrade.svg',
      changes: [
        { key: 'system.stats.body.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.rflx.rollMod', type: 'add', value: '-6' },
        { key: 'system.stats.int.rollMod',  type: 'add', value: '-6' },
        { key: 'system.stats.tech.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.cool.rollMod', type: 'add', value: '-4' },
        { key: 'system.stats.move.value',   type: 'override', value: '2' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'extreme-fatigue' } },
    },
    {
      id: 'deaf',
      name: 'CYBER_BLUE.Condition.Deaf',
      icon: 'icons/svg/deaf.svg',
      changes: [],
      flags: { 'cyberpunk-blue': { conditionId: 'deaf' } },
    },
    {
      id: 'blind',
      name: 'CYBER_BLUE.Condition.Blind',
      icon: 'icons/svg/blind.svg',
      changes: [
        { key: 'system.stats.rflx.rollMod', type: 'add', value: '-6' },
      ],
      flags: { 'cyberpunk-blue': { conditionId: 'blind' } },
    },
  ];

  registerTarotHooks();
  return preloadHandlebarsTemplates();
});

const syncSeriousWoundEffect = (document, options = {}) => {
  if (options?.cyberBlueSyncSeriousWound) {
    return;
  }

  const actor = document instanceof Actor
    ? document
    : document?.parent instanceof Actor
      ? document.parent
      : document?.parent?.parent instanceof Actor
        ? document.parent.parent
        : null;

  if (!(actor instanceof CyberBlueActor)) {
    return;
  }

  return actor.syncSeriousWoundEffect(options);
};

Hooks.on('createActor', syncSeriousWoundEffect);
Hooks.on('updateActor', syncSeriousWoundEffect);
Hooks.on('createItem', syncSeriousWoundEffect);
Hooks.on('updateItem', syncSeriousWoundEffect);
Hooks.on('deleteItem', syncSeriousWoundEffect);
Hooks.on('createActiveEffect', syncSeriousWoundEffect);
Hooks.on('updateActiveEffect', syncSeriousWoundEffect);
Hooks.on('deleteActiveEffect', syncSeriousWoundEffect);

const syncCyberwarePsycheLossEffect = (document, options = {}) => {
  if (options?.cyberBlueSyncPsycheLoss) {
    return;
  }

  const item = document instanceof Item
    ? document
    : document?.parent instanceof Item
      ? document.parent
      : null;

  if (!(item instanceof CyberBlueItem) || item.type !== 'cyberware') {
    return;
  }

  // Skip compendium items — they are locked and cannot have embedded documents
  // updated via this hook (the pack is re-locked before the async sync resolves).
  if (item.pack) return;

  return item.syncCyberwarePsycheLossEffect(options);
};

const promptCyberwarePsycheLoss = async (item, options = {}, userId = null) => {
  if (game.user.id !== userId) {
    return;
  }

  if (!(item instanceof CyberBlueItem) || item.type !== 'cyberware' || !(item.parent instanceof Actor)) {
    return;
  }

  if (options?.cyberBlueSkipPsychePrompt) {
    return;
  }

  if (item.isUnconnectedExtension()) {
    return;
  }

  // Role-granted cyberware: auto-apply suggested loss without prompting
  if (options?.cyberBlueSkipRoleGrant) {
    const psycheLoss = item.getCyberwarePsycheLossData();
    await item.setFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_PROMPT_FLAG, true);
    if (psycheLoss.valid && psycheLoss.suggested > 0) {
      const actor = item.parent;
      const currentPsyche = actor.system.resources.psyche.value ?? 0;
      await actor.update({
        'system.resources.psyche.value': Math.max(currentPsyche - psycheLoss.suggested, 0),
      });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.PsycheLoss')}</h3><p><strong>${item.name}</strong> (Role Grant): −${psycheLoss.suggested} Psyche (suggested).</p></div>`,
      });
    }
    return;
  }

  if (item.getFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_PROMPT_FLAG)) {
    return;
  }

  const psycheLoss = item.getCyberwarePsycheLossData();
  if (!psycheLoss.valid || psycheLoss.maxReduction <= 0) {
    await item.setFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_PROMPT_FLAG, true);
    return;
  }

  const actor = item.parent;
  const { promise, resolve } = Promise.withResolvers();
  const dialog = new foundry.applications.api.DialogV2({
    window: {
      title: game.i18n.localize('CYBER_BLUE.Cyberware.ChoosePsycheLoss'),
    },
    content: `
      <p><strong>${item.name}</strong></p>
      <p>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.PsycheLoss')}: ${psycheLoss.formula}</p>
      <p>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.SuggestedLoss')}: ${psycheLoss.suggested}</p>
      <p>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.MaxPsycheReduction')}: ${psycheLoss.maxReduction}</p>
    `,
    buttons: [
      {
        action: 'roll',
        icon: 'fa-solid fa-dice-d6',
        label: game.i18n.localize('CYBER_BLUE.Cyberware.RollLoss'),
      },
      {
        action: 'suggested',
        icon: 'fa-solid fa-check',
        label: game.i18n.localize('CYBER_BLUE.Cyberware.UseSuggested'),
        default: true,
      },
      {
        action: 'skip',
        icon: 'fa-solid fa-xmark',
        label: game.i18n.localize('CYBER_BLUE.Cyberware.SkipLoss'),
      },
    ],
    submit: (result) => resolve(result),
  });
  dialog.addEventListener('close', () => resolve('skip'), { once: true });
  dialog.render(true);

  const choice = await promise;
  let loss = 0;

  if (choice === 'roll') {
    const roll = await (new Roll(psycheLoss.rollFormula)).evaluate();
    loss = psycheLoss.halve ? Math.ceil(roll.total / 2) : roll.total;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `
        <div class="cyberpunk-blue chat-card">
          <h3>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.PsycheLoss')}</h3>
          <p><strong>${item.name}</strong>: ${psycheLoss.formula} = <strong>${loss}</strong></p>
        </div>
      `,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  } else if (choice === 'suggested') {
    loss = psycheLoss.suggested;
  }

  await item.setFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_PROMPT_FLAG, true);

  if (loss <= 0) {
    return;
  }

  const currentPsyche = actor.system.resources.psyche.value ?? 0;
  await actor.update({
    'system.resources.psyche.value': Math.max(currentPsyche - loss, 0),
  });
};

const onCreateCyberwarePsycheLoss = (item, options, userId) =>
  promptCyberwarePsycheLoss(item, options, userId);

const onUpdateCyberwarePsycheLoss = (item, changed, options, userId) => {
  if (!(item instanceof CyberBlueItem) || item.type !== 'cyberware') {
    return;
  }

  const systemChange = changed?.system ?? {};
  const shouldCheckPrompt = 'parentCyberwareId' in systemChange
    || 'integration' in systemChange
    || 'installed' in systemChange;

  if (!shouldCheckPrompt) {
    return;
  }

  return promptCyberwarePsycheLoss(item, options, userId);
};

Hooks.on('createItem', syncCyberwarePsycheLossEffect);
Hooks.on('updateItem', syncCyberwarePsycheLossEffect);
Hooks.on('createActiveEffect', syncCyberwarePsycheLossEffect);
Hooks.on('updateActiveEffect', syncCyberwarePsycheLossEffect);
Hooks.on('deleteActiveEffect', syncCyberwarePsycheLossEffect);
Hooks.on('createItem', onCreateCyberwarePsycheLoss);
Hooks.on('updateItem', onUpdateCyberwarePsycheLoss);

const syncCyberwareOperationalEffects = (document, options = {}) => {
  if (options?.cyberBlueSyncOperationalEffects) {
    return;
  }

  const item = document instanceof Item
    ? document
    : document?.parent instanceof Item
      ? document.parent
      : null;

  if (!(item instanceof CyberBlueItem) || item.type !== 'cyberware') {
    return;
  }

  // Skip compendium items — same reason as syncCyberwarePsycheLossEffect above.
  if (item.pack) return;

  return item.syncCyberwareOperationalEffects(options);
};

const syncCyberwareDisableEffects = (document, options = {}) => {
  if (options?.cyberBlueSyncCyberwareDisable) {
    return;
  }

  const actor = document instanceof Actor
    ? document
    : document instanceof Item && document.parent instanceof Actor
      ? document.parent
      : document instanceof ActiveEffect && document.parent instanceof Actor
        ? document.parent
        : null;

  if (!(actor instanceof CyberBlueActor)) {
    return;
  }

  const forceReroll = document instanceof ActiveEffect && document.parent instanceof Actor
    ? true
    : document instanceof Item && document.type === 'cyberware'
      ? true
      : false;

  return syncActorCyberwareDisableEffects(actor, {
    ...options,
    forceCyberBlueCyberwareDisableReroll: forceReroll,
  });
};

Hooks.on('createItem', syncCyberwareDisableEffects);
Hooks.on('updateItem', syncCyberwareDisableEffects);
Hooks.on('deleteItem', syncCyberwareDisableEffects);
Hooks.on('createActiveEffect', syncCyberwareDisableEffects);
Hooks.on('updateActiveEffect', syncCyberwareDisableEffects);
Hooks.on('deleteActiveEffect', syncCyberwareDisableEffects);
Hooks.on('createItem', syncCyberwareOperationalEffects);
Hooks.on('updateItem', syncCyberwareOperationalEffects);
Hooks.on('createActiveEffect', syncCyberwareOperationalEffects);
Hooks.on('updateActiveEffect', syncCyberwareOperationalEffects);
Hooks.on('deleteActiveEffect', syncCyberwareOperationalEffects);

// ─── Gear AE state sync ───────────────────────────────────────────────────────
// Disables item-level AEs when gear state is 'owned'; re-enables when carried/equipped.

const syncGearEffectsHook = (document, options = {}) => {
  if (options?.cyberBlueSyncGearEffects) {
    return;
  }

  const item = document instanceof Item
    ? document
    : document?.parent instanceof Item
      ? document.parent
      : null;

  if (!(item instanceof CyberBlueItem) || item.type !== 'gear') {
    return;
  }

  // Gear state sync is only meaningful for actor-owned items.
  // Compendium items have no actor context, and calling syncGearEffects on them
  // would try to update AEs while the pack is locked (e.g. during _ensureArmorInGearPack).
  if (item.pack) return;

  return item.syncGearEffects(options);
};

Hooks.on('createItem', syncGearEffectsHook);
Hooks.on('updateItem', syncGearEffectsHook);

// ─── Skill Chip AE sync ───────────────────────────────────────────────────────
// Creates / updates a flag-bearing AE on "Skill Chip" gear whose note field
// contains a validated skill or component slug.  Actors read the flag at roll
// time via _getSkillChipFloors() to apply a minimum rank floor of 3.

const syncSkillChipEffectHook = (document, options = {}) => {
  if (options?.cyberBlueSyncSkillChip) {
    return;
  }

  const item = document instanceof Item ? document : null;
  if (!(item instanceof CyberBlueItem) || item.type !== 'gear' || item.name !== 'Skill Chip') {
    return;
  }

  // Skip compendium items — same reason as syncCyberwarePsycheLossEffect above.
  if (item.pack) return;

  return item.syncSkillChipEffect(options);
};

Hooks.on('createItem', syncSkillChipEffectHook);
Hooks.on('updateItem', syncSkillChipEffectHook);

// ─── PSYCHE state sync ────────────────────────────────────────────────────────

const PSYCHE_STATE_FLAG = 'psycheState';

const PSYCHE_STATES = [
  { id: 'full-cyberpsychosis',     min: -Infinity, max: -1,  nameKey: 'CYBER_BLUE.PsycheState.FullCyberpsychosis' },
  { id: 'beginning-cyberpsychosis', min: 0,         max: 9,   nameKey: 'CYBER_BLUE.PsycheState.BeginningCyberpsychosis' },
  { id: 'disrupted-mind',           min: 10,        max: 19,  nameKey: 'CYBER_BLUE.PsycheState.DisruptedMind' },
  { id: 'disassociation',           min: 20,        max: 29,  nameKey: 'CYBER_BLUE.PsycheState.Disassociation' },
];

function getPsycheState(psycheValue) {
  return PSYCHE_STATES.find((s) => psycheValue >= s.min && psycheValue <= s.max) ?? null;
}

async function syncPsycheStateEffect(actor, options = {}) {
  if (options?.cyberBlueSyncPsycheState) return;
  if (!(actor instanceof CyberBlueActor)) return;
  if (!['character', 'npc'].includes(actor.type)) return;

  const psycheValue = actor.system?.resources?.psyche?.value ?? 60;
  const desiredState = getPsycheState(psycheValue);

  const existingEffect = actor.effects.find((e) => e.getFlag('cyberpunk-blue', PSYCHE_STATE_FLAG));

  if (!desiredState) {
    // PSYCHE ≥ 30: no state — remove any existing
    if (existingEffect) {
      await existingEffect.delete({ cyberBlueSyncPsycheState: true });
    }
    return;
  }

  const existingId = existingEffect?.getFlag('cyberpunk-blue', `${PSYCHE_STATE_FLAG}.id`);

  if (existingEffect) {
    if (existingId === desiredState.id) return; // already correct
    await existingEffect.update({
      name: game.i18n.localize(desiredState.nameKey),
      'flags.cyberpunk-blue': {
        [PSYCHE_STATE_FLAG]: { id: desiredState.id },
      },
    }, { cyberBlueSyncPsycheState: true });
  } else {
    await actor.createEmbeddedDocuments('ActiveEffect', [{
      name: game.i18n.localize(desiredState.nameKey),
      icon: 'icons/svg/angel.svg',
      origin: actor.uuid,
      disabled: false,
      transfer: false,
      system: { changes: [] },
      flags: {
        'cyberpunk-blue': {
          [PSYCHE_STATE_FLAG]: { id: desiredState.id },
        },
      },
    }], { cyberBlueSyncPsycheState: true });
  }
}

const onUpdateActorPsyche = (actor, changed, options) => {
  if (!('system' in changed)) return;
  const psycheChanged = 'resources' in (changed.system ?? {})
    && 'psyche' in (changed.system?.resources ?? {});
  if (!psycheChanged) return;
  return syncPsycheStateEffect(actor, options);
};

Hooks.on('updateActor', onUpdateActorPsyche);

const syncLeaderTeams = (document, options = {}) => {
  if (document instanceof Item && document.type !== 'role') {
    return;
  }
  const actor = document instanceof Actor
    ? document
    : document instanceof Item && document.parent instanceof Actor
      ? document.parent
      : null;
  if (!(actor instanceof CyberBlueActor)) {
    return;
  }
  return syncActorLeaderRoles(actor);
};

Hooks.on('createItem', syncLeaderTeams);
Hooks.on('updateItem', syncLeaderTeams);
Hooks.on('deleteItem', syncLeaderTeams);
Hooks.on('updateActor', syncLeaderTeams);

// ─── Protean tactic AE sync ───────────────────────────────────────────────────
// Re-sync tactic AEs whenever a protean Role item is created/updated/deleted.
// Only runs on the client that made the change (userId === game.user.id) to
// avoid duplicate writes when multiple clients are online.
const syncProteanFociEffects = (document, ...hookArgs) => {
  const userId = hookArgs[hookArgs.length - 1];
  if (userId !== game.user.id) return;
  if (!(document instanceof Item) || document.type !== 'role') return;
  if (!(document.parent instanceof CyberBlueActor)) return;
  const system = normalizeRoleSystemData(document.system);
  if (system.category !== 'protean') return;
  return syncAllProteanFociAEs(document.parent);
};
Hooks.on('createItem', syncProteanFociEffects);
Hooks.on('updateItem', syncProteanFociEffects);
Hooks.on('deleteItem', syncProteanFociEffects);

// ─── Cyberware install / uninstall sounds ────────────────────────────────────
Hooks.on('createItem', (item, _data, _options, userId) => {
  if (item.type !== 'cyberware') return;
  if (!(item.parent instanceof Actor)) return;
  if (userId !== game.user.id) return;
  playUiSound('install-cyberware');
});
Hooks.on('deleteItem', (item, _options, userId) => {
  if (item.type !== 'cyberware') return;
  if (!(item.parent instanceof Actor)) return;
  if (userId !== game.user.id) return;
  playUiSound('install-cyberware');
});

// ─── Role condition AE sync ───────────────────────────────────────────────────
// Re-sync role-condition AEs whenever any role item is created/updated/deleted.
// Triggered by the editing client only (userId === game.user.id).
const syncRoleConditionEffects = (document, ...hookArgs) => {
  const userId = hookArgs[hookArgs.length - 1];
  if (userId !== game.user.id) return;
  if (!(document instanceof Item) || document.type !== 'role') return;
  if (!(document.parent instanceof CyberBlueActor)) return;
  return syncAllRoleConditionAEs(document.parent);
};
Hooks.on('createItem', syncRoleConditionEffects);
Hooks.on('updateItem', syncRoleConditionEffects);
Hooks.on('deleteItem', syncRoleConditionEffects);

// Also re-sync when an AE on a role item changes (condition flags edited).
const syncRoleConditionOnAEChange = (document, ...hookArgs) => {
  const userId = hookArgs[hookArgs.length - 1];
  if (userId !== game.user.id) return;
  const parent = document.parent;
  if (!(parent instanceof Item) || parent.type !== 'role') return;
  if (!(parent.parent instanceof CyberBlueActor)) return;
  return syncAllRoleConditionAEs(parent.parent);
};
Hooks.on('createActiveEffect', syncRoleConditionOnAEChange);
Hooks.on('updateActiveEffect', syncRoleConditionOnAEChange);
Hooks.on('deleteActiveEffect', syncRoleConditionOnAEChange);

// ─── Vehicle blueprint materialisation ───────────────────────────────────────
// When a vehicle Token is placed on a scene, spawn Scene Regions for each
// entry in the actor's blueprint.regions array.  Only the activeGM executes
// this to prevent double-creation when multiple GM-level users are online.
// Cleanup runs symmetrically on token deletion.
Hooks.on('createToken', async (tokenDoc, _options, _userId) => {
  if (game.user !== game.users.activeGM) return;
  if (tokenDoc.actor?.type !== 'vehicle') return;
  try {
    await recordVehicleBaseFootprint(tokenDoc);
    await materialiseVehicleBlueprint(tokenDoc);
  } catch (err) {
    console.error('cyberpunk-blue | vehicle blueprint materialisation failed:', err);
  }
});

Hooks.on('deleteToken', async (tokenDoc, _options, _userId) => {
  if (game.user !== game.users.activeGM) return;
  if (tokenDoc.actor?.type !== 'vehicle') return;
  try {
    await cleanupVehicleRegions(tokenDoc);
  } catch (err) {
    console.error('cyberpunk-blue | vehicle region cleanup failed:', err);
  }
});

// ─── Vehicle position sync ────────────────────────────────────────────────────
// After a vehicle token moves: reposition linked Regions and move attached tokens.
// Also run a bounding-box collision check to apply base ramming damage if the
// vehicle has landed on top of another token.
//
// The cyberpunkBlueVehicleSync option guards against infinite recursion: when
// THIS hook updates attached token positions, those updateToken calls re-enter
// this hook but are immediately skipped.
Hooks.on('updateToken', async (tokenDoc, changes, options) => {
  if (options?.cyberpunkBlueVehicleSync) return;
  if (game.user !== game.users.activeGM) return;

  // Position sync applies to vehicle tokens; prune also runs on any token
  // deletion-triggered move edge case.
  if (tokenDoc.actor?.type === 'vehicle') {
    // 90° snap mode: snap rotation + swap footprint. The resulting token update
    // re-enters this hook (flagged) and runs the region sync below, so bail out
    // here when a snap was actually applied.
    if (!options?.cyberpunkBlueVehicleSnap && 'rotation' in changes) {
      const snapped = await applyVehicleRotationSnap(tokenDoc, options).catch(() => false);
      if (snapped) return;
    }
    const positionChanged = 'x' in changes || 'y' in changes;
    const rotationChanged = 'rotation' in changes;
    const sizeChanged = 'width' in changes || 'height' in changes;
    if (positionChanged || rotationChanged || sizeChanged) {
      try {
        // Rotation/size changes also need region re-sync so vital areas keep
        // tracking the token's rotated artwork.
        await syncVehicleRegionPositions(tokenDoc);
        // Passengers must follow both translation and rotation (so they stay in
        // their seats as the vehicle turns).
        if (positionChanged || rotationChanged) {
          await syncAttachedTokenPositions(tokenDoc);
        }
        if (positionChanged) {
          await checkVehicleCollisions(tokenDoc);
        }
      } catch (err) {
        console.error('cyberpunk-blue | vehicle position sync failed:', err);
      }
    }
    // Keep attached list clean regardless of what changed.
    await pruneAttachedTokens(tokenDoc).catch(() => {});
  }
});

// ─── Token HUD: detach from vehicle ──────────────────────────────────────────
// Adds a "Detach from Vehicle" button to the Token HUD when the token is
// currently attached to a vehicle token in the same scene.
Hooks.on('renderTokenHUD', (hud, html, _data) => {
  const scene = canvas.scene;
  if (!scene) return;

  const tokenDoc = hud.object?.document;
  if (!tokenDoc) return;

  // ── Vehicle Status HUD button (on vehicle tokens) ──────────────────────────
  if (tokenDoc.actor?.type === 'vehicle') {
    const hudBtn = document.createElement('div');
    hudBtn.classList.add('control-icon', 'cpb-vehicle-hud-btn');
    hudBtn.title = game.i18n.localize('CYBER_BLUE.VehicleHUD.OpenButton');
    hudBtn.innerHTML = '<i class="fas fa-gauge-high"></i>';
    hudBtn.addEventListener('click', () => {
      VehicleHud.openForActor(tokenDoc.actor);
    });
    const col = html.querySelector('.col.right');
    if (col) col.appendChild(hudBtn);
  }

  // ── Detach from vehicle button (on passenger/crew tokens) ─────────────────
  // Find any vehicle token in this scene that has this token in its attached list.
  const vehicleToken = scene.tokens.find(
    (t) => t.actor?.type === 'vehicle'
        && getAttachedTokens(t).some((r) => r.tokenId === tokenDoc.id),
  );
  if (!vehicleToken) return;

  // Inject a "detach" button into the Token HUD.
  const btn = document.createElement('div');
  btn.classList.add('control-icon', 'cpb-detach-vehicle');
  btn.title = 'Detach from Vehicle';
  btn.innerHTML = '<i class="fas fa-door-open"></i>';
  btn.addEventListener('click', async () => {
    hud.clear();
    await detachTokenFromVehicle(vehicleToken, tokenDoc);
    ui.notifications.info(`${tokenDoc.name} detached from ${vehicleToken.name}.`);
  });

  // Append to the right column of HUD controls.
  const col = html.querySelector('.col.right');
  if (col) {
    col.appendChild(btn);
  }
});

// ─── Ricochet canvas line hooks ───────────────────────────────────────────────
// Redraw the ricochet trajectory line whenever the relevant state changes.
Hooks.on('canvasReady', () => { try { refreshAllRicochetLines(); } catch { /* canvas not ready */ } });
Hooks.on('targetToken', () => { try { refreshAllRicochetLines(); } catch { /* canvas not ready */ } });
Hooks.on('updateActor', (actor, change) => {
  if (change?.flags?.['cyberpunk-blue']?.ricochetPoint !== undefined ||
      change?.flags?.['cyberpunk-blue']?.['-=ricochetPoint'] !== undefined) {
    try { refreshAllRicochetLines(); } catch { /* canvas not ready */ }
  }
});
Hooks.on('updateToken', () => { try { refreshAllRicochetLines(); } catch { /* canvas not ready */ } });

// ─── Tech Weapon charge canvas hooks ─────────────────────────────────────────
// Highlight tokens within 15 m (thin-cover vision) while any TW is charged.
Hooks.on('canvasReady', () => { try { refreshTechChargeHighlights(); } catch { } });
Hooks.on('updateToken', () => { try { refreshTechChargeHighlights(); } catch { } });
Hooks.on('updateItem', (item, change) => {
  const flags = change?.flags?.['cyberpunk-blue'] ?? {};
  const keys  = Object.keys(flags);
  if (keys.some((k) => k.startsWith('charged-') || k.startsWith('-=charged'))) {
    try { refreshTechChargeHighlights(); } catch { }
  }
});
Hooks.on('deleteCombat', () => { try { clearTechChargeHighlights(); } catch { } });

// ─── Netrunning: program actor lifecycle ─────────────────────────────────────
// When a programExecutable's `running` flag changes while a netrunner is
// connected, spawn or despawn its linked program actor accordingly.
// Also sync stat changes to the live program actor, and keep the actor's token
// image up-to-date when the actor's own image changes.
Hooks.on('updateItem', async (item, change) => {
  if (!game.user.isGM) return;
  if (item.type !== 'programExecutable') return;

  const actor = item.parent;

  // ── Running flag: spawn or despawn ─────────────────────────────────────────
  if (foundry.utils.hasProperty(change, 'system.running') && actor && isNetConnected(actor)) {
    if (change.system.running === true) {
      await spawnProgramActor(actor, item);
    } else {
      await despawnProgramActor(actor, item);
    }
  }

  // ── Stats sync: exe → program actor ────────────────────────────────────────
  // When REZ, ACT, ATK, DEF, NET, or PER changes on the exe, propagate to the
  // live program actor (if one exists) so both always show the same numbers.
  if (foundry.utils.hasProperty(change, 'system')) {
    await syncExeStatsToActor(item, change);
  }
});

// ─── Netrunning: exe deletion → despawn program actor ────────────────────────
// When a programExecutable is deleted, tear down its linked program actor and
// any tokens so nothing is left orphaned in the Architecture scene.
Hooks.on('deleteItem', async (item) => {
  if (!game.user.isGM) return;
  if (item.type !== 'programExecutable') return;
  const actor = item.parent;
  if (!actor) return;
  // despawnProgramActor will no-op if there's no linked actor
  await despawnProgramActor(actor, item, { skipRunningUpdate: true });
});

// ─── Netrunning: unsafe disconnect when token leaves AP region ────────────────
// If a connected netrunner's token moves out of every AP region that contains
// their linked access point, trigger an unsafe disconnect (1d6 HP damage).
// Guard with activeGM so only one client fires the automation when multiple
// GM-level users are connected simultaneously.
Hooks.on('updateToken', async (tokenDoc, change) => {
  if (game.user !== game.users.activeGM) return;
  // Only fire when position changes
  if (change.x === undefined && change.y === undefined) return;

  const actor = tokenDoc.actor;
  if (!actor || !isNetConnected(actor)) return;

  const conn = getNetConnection(actor);
  if (!conn?.apSceneId || !conn?.apRegionId) return;

  // Only monitor the physical-world token (the one on the AP scene).
  // The arch-scene token shares the same actor but lives on a different scene;
  // its movement must NOT trigger a disconnect.
  const scene = tokenDoc.parent;
  if (!scene || scene.id !== conn.apSceneId) return;

  const apRegion = scene.regions.get(conn.apRegionId);
  if (!apRegion) {
    await disconnectFromArchitecture(actor, false);
    return;
  }

  // Get new token centre in pixels
  const gridSize = scene.grid.size;
  const newX = (change.x ?? tokenDoc.x) + tokenDoc.width  * gridSize / 2;
  const newY = (change.y ?? tokenDoc.y) + tokenDoc.height * gridSize / 2;

  // Check if AP region still reachable at max cyberdeck range
  const primaryDeck = getPrimaryCyberdeck(actor);
  const range = Number(primaryDeck?.system.computer?.range) || 10;

  const reachable = getAccessPointsInRange(scene, { x: newX, y: newY }, range);
  if (reachable.some((r) => r.id === conn.apRegionId)) return;

  // No longer in range — unsafe disconnect
  await disconnectFromArchitecture(actor, false);
});

// ─── Netrunning: REZ sync & ##ERROR## state ──────────────────────────────────
// When a temporary Program Actor's REZ is updated, sync the value back to the
// originating Executable item and apply the ##ERROR## state if REZ hits 0.
Hooks.on('updateActor', async (actor, changes) => {
  if (game.user !== game.users.activeGM) return;
  if (!actor.getFlag('cyberpunk-blue', 'isTemporaryProgramActor')) return;
  if (!foundry.utils.hasProperty(changes, 'system.resources.rez.value')) return;

  let newRez = foundry.utils.getProperty(changes, 'system.resources.rez.value') ?? 0;

  // Clamp: REZ must never be negative. Correct it and re-fire; the re-fire
  // handles sync + ##ERROR## state (newRez will be 0 on the second pass).
  if (newRez < 0) {
    await actor.update({ 'system.resources.rez.value': 0 });
    return;
  }

  await syncRezToExecutable(actor, newRez);
  if (newRez <= 0) await applyErrorState(actor);
});

// ─── Netrunning: unsafe disconnect when Netrunner falls unconscious ──────────
// If a connected Netrunner's HP drops to 0 or below they are knocked out of
// the NET — the cyberdeck port severs without a graceful handshake.
// KRASH-Barrier (checked inside disconnectFromArchitecture) may absorb damage.
Hooks.on('updateActor', async (actor, changes) => {
  if (game.user !== game.users.activeGM) return;
  if (!foundry.utils.hasProperty(changes, 'system.resources.hp.value')) return;
  const newHp = foundry.utils.getProperty(changes, 'system.resources.hp.value') ?? 1;
  if (newHp > 0) return;
  if (!isNetConnected(actor)) return;
  await disconnectFromArchitecture(actor, false);
});

// ─── Vehicle: Serious Damage AE sync ─────────────────────────────────────────
// Mirrors the character syncSeriousWoundEffect pattern.
// Fires on createActor + updateActor so any HP change is captured immediately.
const _syncVehicleSeriousDamage = async (document, _data, options = {}) => {
  if (options?.cyberBlueSyncVehicleSeriousDamage) return;
  const actor = document instanceof Actor ? document
    : document?.parent instanceof Actor ? document.parent
    : null;
  if (!actor || actor.type !== 'vehicle') return;
  await syncVehicleSeriousDamage(actor, options);
};
Hooks.on('createActor',  _syncVehicleSeriousDamage);
Hooks.on('updateActor',  _syncVehicleSeriousDamage);

// ─── Vehicle: wreck transition when HP hits 0 (GM only) ──────────────────────
// Sets state: 'wreck', zeroes stats (via prepareDerivedData), cancels Maneuver.
Hooks.on('updateActor', async (actor, changes, options) => {
  if (game.user !== game.users.activeGM) return;
  if (options?.cyberpunkBlueWreckTransition) return;
  if (actor.type !== 'vehicle') return;
  if (!foundry.utils.hasProperty(changes, 'system.resources.hp.value')) return;
  await checkVehicleWreckTransition(actor);
});

// ─── Vehicle: subsystem (vital-area) destruction when its HP hits 0 (GM only) ─
// Sets destroyed, enables the configured disabled vehicle AE, fires the bound
// crit entry, and posts a chat announcement.
Hooks.on('updateItem', async (item, changes, options) => {
  if (game.user !== game.users.activeGM) return;
  if (options?.cyberBlueSubsystemDestruction) return;
  if (item.type !== 'vehicleSubsystem') return;
  if (!foundry.utils.hasProperty(changes, 'system.hp.value')) return;
  await syncSubsystemDestruction(item, options);
});

// ─── Tech Weapon charge: turn-start housekeeping (GM only) ───────────────────
// Clears cooldown flags and transitions MOVE AE from 0→half on second+ turns.
Hooks.on('combatTurn', async (combat, updateData) => {
  if (!game.user.isGM) return;

  const newTurnIdx  = updateData.turn  ?? 0;
  const roundNumber = updateData.round ?? combat.round ?? 1;
  const combatant   = combat.combatants.contents[newTurnIdx];
  const actor       = combatant?.actor;
  if (!actor) return;

  for (const item of actor.items) {
    const weapons = item.system?.weapons;
    if (!weapons?.length) continue;

    for (let wi = 0; wi < weapons.length; wi++) {
      // Always clear charge cooldown at start of turn.
      if (item.getFlag('cyberpunk-blue', `chargeCooldown-${wi}`)) {
        await item.unsetFlag('cyberpunk-blue', `chargeCooldown-${wi}`);
      }

      if (!item.getFlag('cyberpunk-blue', `charged-${wi}`)) continue;

      const startRound   = item.getFlag('cyberpunk-blue', `chargeStartRound-${wi}`) ?? roundNumber;
      const roundsElapsed = roundNumber - startRound;

      // Expire charge after 20 rounds.
      if (roundsElapsed >= 20) {
        await clearWeaponCharge(actor, item, wi, false);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeExpired', { weapon: item.name })}</p></div>`,
        });
        continue;
      }

      // After first round: update AE for regular TW (0 → half MOVE).
      // ImprovedCharge and SR Capacity already start at their ongoing value.
      if (roundsElapsed >= 1) {
        const aeId = item.getFlag('cyberpunk-blue', `chargeAeId-${wi}`);
        const ae   = aeId ? actor.effects?.get(aeId) : null;
        if (ae && ae.changes[0]?.value === '0') {
          const origMove = item.getFlag('cyberpunk-blue', `chargeOrigMove-${wi}`) ?? 0;
          const halfMove = String(Math.max(1, Math.ceil(origMove / 2)));
          await ae.update({ changes: [{ key: 'system.stats.move.value', mode: 5, value: halfMove }] });
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeMoveRestored', { weapon: item.name, move: halfMove })}</p></div>`,
          });
        }
      }
    }
  }

  // ── Chomp Ammo detonation (KTech Terrier) ────────────────────────────────
  // At the START of the attacker's NEXT turn, detonate any pending chomp flags:
  // roll 1d6 and deal damage to every token within 2m of the stuck target.
  const chompEntries = Object.entries(actor.flags?.['cyberpunk-blue'] ?? {})
    .filter(([k]) => k.startsWith('chompPending-'));
  for (const [key, value] of chompEntries) {
    const { targetTokenId, setAtRound, setAtTurnIdx, attackerCombatantIdx } = value ?? {};
    if (attackerCombatantIdx === undefined || attackerCombatantIdx < 0) continue;
    // Detonate if this is the attacker's combatant slot AND we're past the round/turn when it was set.
    if (newTurnIdx !== attackerCombatantIdx) continue;
    if (!(roundNumber > setAtRound || (roundNumber === setAtRound && newTurnIdx > setAtTurnIdx))) continue;

    await actor.unsetFlag('cyberpunk-blue', key);

    const targetToken = canvas.tokens?.get(targetTokenId);
    if (!targetToken) continue;

    const chompRoll = await new Roll('1d6').evaluate();
    await chompRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-bone"></i> ${game.i18n.localize('CYBER_BLUE.Combat.ChompAmmoDetonate')}</h3><p>${game.i18n.format('CYBER_BLUE.Combat.ChompAmmoDmg', { target: targetToken.name, dmg: chompRoll.total })}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Find all tokens within 2m of the target
    const gridSize = canvas.grid?.size ?? 100;
    const scene = canvas.scene;
    const gridDistance = scene?.grid?.distance ?? 1;
    const gridUnits = (scene?.grid?.units ?? '').toLowerCase().trim();
    const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
    const blastRadiusPx = (2 / metersPerUnit) * gridSize;
    const tx = targetToken.document.x + (targetToken.document.width * gridSize) / 2;
    const ty = targetToken.document.y + (targetToken.document.height * gridSize) / 2;

    for (const token of canvas.tokens.objects?.children ?? []) {
      if (!token.actor) continue;
      const cx = token.document.x + (token.document.width * gridSize) / 2;
      const cy = token.document.y + (token.document.height * gridSize) / 2;
      if (Math.hypot(cx - tx, cy - ty) > blastRadiusPx) continue;
      await applyDamageWithPermission(token.actor, chompRoll.total);
    }
  }
});

// ── Combat turn marker ───────────────────────────────────────────────────────
// Path to the system's animated "current actor" turn-marker video.
const TURN_MARKER_SRC = 'systems/cyberpunk-blue/assets/effects/current-actor.webm';

// Register a fully-static PIXI animation so the webm plays its own animation
// without the core spin/pulse transforms fighting it.
Hooks.on('initializeCombatConfiguration', (settings) => {
  try {
    const TurnMarkerData = foundry.data?.TurnMarkerData
      ?? foundry.canvas?.placeables?.tokens?.TurnMarkerData;
    const config = {
      id: 'cyberpunk-blue-static',
      label: 'CYBER_BLUE.Settings.TurnMarker.Static',
      config: { spin: 0, pulse: { speed: 0, min: 1, max: 1 } },
    };
    settings.addTurnMarkerAnimation('cyberpunk-blue-static', TurnMarkerData ? new TurnMarkerData(config) : config);
  } catch (err) {
    console.warn('cyberpunk-blue | Could not register turn-marker animation', err);
  }
});

Hooks.once('ready', async () => {
  // Register socket handlers for all users (handler itself checks isGM where needed)
  registerSocketHandlers();
  initAudio();
  initResidueMediaSync();

  if (!game.user.isGM) {
    return;
  }

  // Set the system turn-marker video as the world default, but only if the GM
  // has not already chosen a custom marker source (an empty src means default).
  try {
    const cfgKey = foundry.data?.CombatConfiguration?.CONFIG_SETTING
      ?? CONFIG.Combat?.settings?.constructor?.CONFIG_SETTING
      ?? 'combatTrackerConfig';
    const current = game.settings.get('core', cfgKey);
    if (current?.turnMarker && !current.turnMarker.src) {
      await game.settings.set('core', cfgKey, {
        ...current,
        turnMarker: {
          ...current.turnMarker,
          src: TURN_MARKER_SRC,
          animation: 'cyberpunk-blue-static',
        },
      });
    }
  } catch (err) {
    console.warn('cyberpunk-blue | Could not set default turn marker', err);
  }

  await ensureCritInjuryTables();
  await ensureVehicleCritTables();
  await ensureLostControlTables();
  await ensureVehicleCatalogue();
  await migrateCostStrings();
  await ensureWeaponCatalogue();
  await ensureAmmoCatalogue();
  await ensureEquipmentCatalogue();
  await ensureRoleCatalogue();
  await ensureAbilityCatalogue();
  await ensureLifepathCatalogue();
  await syncRoleLifepathLinks();
  await ensureMacroCatalogue();
  await ensureTarotDeck();

  // Sync role starting gear to the compendium on every GM login so that
  // additions or renames to ROLE_STARTING_GEAR are always picked up without
  // requiring a manual "Re-sync Role Starting Gear" from Settings.
  await syncRoleGrantedItemGroups();

  const seen = new Set();
  const allItems = [
    ...game.items.contents,
    ...game.actors.contents.flatMap((actor) => actor.items.contents),
  ].filter((item) => {
    if (seen.has(item.uuid)) {
      return false;
    }
    seen.add(item.uuid);
    return true;
  });

  const cyberwareItems = allItems.filter((item) => item instanceof CyberBlueItem && item.type === 'cyberware');
  const gearItems = allItems.filter((item) => item instanceof CyberBlueItem && item.type === 'gear');

  for (const item of cyberwareItems) {
    await item.syncCyberwarePsycheLossEffect({ cyberBlueSyncPsycheLoss: true });
    await item.syncCyberwareOperationalEffects({ cyberBlueSyncOperationalEffects: true });
  }

  for (const item of gearItems) {
    await item.syncGearEffects({ cyberBlueSyncGearEffects: true });
    if (item.name === 'Skill Chip') {
      await item.syncSkillChipEffect({ cyberBlueSyncSkillChip: true });
    }
  }

  for (const actor of game.actors.contents) {
    await syncActorCyberwareDisableEffects(actor, { cyberBlueSyncCyberwareDisable: true });
    await syncActorLeaderRoles(actor);
    await syncAllProteanFociAEs(actor);
    await syncAllRoleConditionAEs(actor);
    await syncPsycheStateEffect(actor, { cyberBlueSyncPsycheState: false });
  }

  // Remove orphaned "Jacked In" AEs — actors that still have the AE but no
  // active connection flag (e.g. after a server crash mid-session).
  for (const actor of game.actors.contents) {
    const hasConnection = Boolean(actor.getFlag('cyberpunk-blue', 'netConnection'));
    if (!hasConnection) {
      const staleAe = actor.effects.find((e) => e.getFlag('cyberpunk-blue', 'jackedInEffect'));
      if (staleAe) await staleAe.delete();
    }
  }

  // Auto-create a character for any player who doesn't have one yet
  await ensurePlayerCharacters();
});

Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('concat', function (...parts) {
  return parts.slice(0, -1).join('');
});

Handlebars.registerHelper('eq', function (left, right) {
  return left === right;
});

Handlebars.registerHelper('includes', function (collection, value) {
  return Array.isArray(collection) && collection.includes(value);
});

Handlebars.registerHelper('not', function (value) {
  return !value;
});

Handlebars.registerHelper('gt', function (left, right) {
  return left > right;
});

Handlebars.registerHelper('and', function (...args) {
  return args.slice(0, -1).every(Boolean);
});

Handlebars.registerHelper('or', function (...args) {
  return args.slice(0, -1).some(Boolean);
});

// ── Language ability: prompt for language name when one is added to an actor ──
Hooks.on('preCreateItem', (document, _data, options, _userId) => {
  // Only intercept embedded ability items named exactly 'Language'
  if (document.type !== 'ability') return;
  if (document.name !== 'Language') return;
  if (!document.parent) return;                // not embedded on an actor
  if (options._languageNamed) return;          // recursion guard

  // Cancel the current creation, then prompt and re-create asynchronously.
  setTimeout(async () => {
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('CYBER_BLUE.Ability.Language.ChooseTitle') },
      content: `<p>${game.i18n.localize('CYBER_BLUE.Ability.Language.ChoosePrompt')}</p>
        <input type="text" name="language" autofocus placeholder="${game.i18n.localize('CYBER_BLUE.Ability.Language.ChoosePlaceholder')}" />`,
      ok: {
        label: game.i18n.localize('CYBER_BLUE.Ability.Language.ChooseConfirm'),
        callback: (_event, button) => button.form.elements.language.value.trim(),
      },
    });
    if (!result) return;
    const newName = `Language: ${result}`;
    const base = foundry.utils.deepClone(document.toObject());
    base.name = newName;
    delete base._id;
    await document.parent.createEmbeddedDocuments('Item', [base], { _languageNamed: true });
  }, 0);

  return false; // cancel original creation
});

Hooks.once('ready', () => {
  if (game.user.isGM) return;

  const ownedCharacter = game.actors?.find(
    a => a.type === 'character'
      && a.isOwner
      && (a.system.characterCreation?.active ?? false)
  );
  if (!ownedCharacter) return;

  // Small delay so the actor sheet can open first
  setTimeout(() => new CharacterCreationWizard(ownedCharacter).render(true), 500);
});

// Watch for actors being created for the current player (GM may create on ready,
// but the player might not yet be in the ready hook when that happens).
Hooks.on('createActor', (actor) => {
  if (game.user.isGM) return;
  if (actor.type !== 'character') return;
  if (!actor.isOwner) return;
  if (!(actor.system.characterCreation?.active ?? false)) return;

  setTimeout(() => new CharacterCreationWizard(actor).render(true), 500);
});

// ─── Combat: movement enforcement & action tracking ──────────────────────────

// ── preMoveToken: enforce turn restriction + budget (cancel on exceed) ────────

// Stores old {x,y} of Architecture-scene tokens that are about to move, keyed
// by tokenId. Used by the moveToken hook to chain-follow program tokens.
const _tokenOldPositions = new Map();

Hooks.on('preMoveToken', (tokenDoc, movement) => {
  // ── Architecture scene: exempt from all budget accounting ─────────────────
  // Tokens in Architecture/Network scenes move freely — node-to-node movement
  // in NET space does not consume the combatant's physical movement budget.
  const scene = tokenDoc.parent;
  if (isNetArchitectureScene(scene)) {
    // Record old position so the moveToken hook can chain-follow program tokens.
    _tokenOldPositions.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });
    return; // no budget enforcement
  }

  if (!game.combat?.started) return;

  const activeCombatant = getActiveCombatant();

  // ── Out-of-turn movement ──────────────────────────────────────────────────
  if (tokenDoc.id !== activeCombatant?.tokenId) {
    if (game.user.isGM) return; // GMs may reposition tokens freely
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.MovementOutsideTurn'));
    return false;
  }

  // ── Active combatant: enforce movement budget ─────────────────────────────
  const actor = tokenDoc.actor;
  if (!actor) return;

  const budget = getMovementBudget(activeCombatant, actor);
  if (budget <= 0) return; // no move stat — don't interfere

  const state = getTurnState(activeCombatant);
  const used = state.movementUsed ?? 0;
  const remaining = Math.max(budget - used, 0);

  if (remaining < 0.01) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.MovementExhausted', { max: budget }));
    return false;
  }

  // Measure terrain-adjusted cost of the proposed move
  const proposedCost = tokenDoc.object?.measureMovementPath(movement.waypoints)?.cost ?? 0;
  if (proposedCost <= 0.01) return; // negligible — allow

  if (used + proposedCost > budget + 0.01) {
    ui.notifications.warn(
      game.i18n.format('CYBER_BLUE.Combat.MovementExceeded', { remaining: remaining.toFixed(1) })
    );
    return false;
  }
});

// ── moveToken: record actual cost + Architecture-scene program chain-follow ────

Hooks.on('moveToken', async (tokenDoc, movement, userId) => {
  const scene = tokenDoc.parent;

  // ── Architecture scene: chain-follow program tokens → netrunner's old pos ──
  // When a Netrunner's Architecture token moves, all their running program
  // tokens follow to the netrunner's *previous* position (like a chain).
  if (isNetArchitectureScene(scene)) {
    // Read and immediately discard the stored old position.
    const oldPos = _tokenOldPositions.get(tokenDoc.id) ?? null;
    _tokenOldPositions.delete(tokenDoc.id);

    // Only the GM moves program tokens (they are always GM-owned temp actors).
    if (!game.user.isGM || !oldPos) return;

    // Is this token the Architecture token of a connected Netrunner?
    const netrunnerActor = game.actors.find(
      (a) => getNetConnection(a)?.archTokenId === tokenDoc.id,
    );
    if (!netrunnerActor) return;

    // Gather all running executables that have an active Program Actor with a
    // token in this scene.
    const runningExes = netrunnerActor.items.filter(
      (i) => i.type === 'programExecutable' && i.system.running,
    );
    for (const exe of runningExes) {
      const programActorId = exe.getFlag('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
      if (!programActorId) continue;
      const programTok = scene.tokens.find((t) => t.actorId === programActorId);
      if (!programTok) continue;
      // Move silently without triggering budget hooks
      await programTok.update({ x: oldPos.x, y: oldPos.y }, { animate: false });
    }
    return;
  }

  if (!game.combat?.started) return;
  if (game.user.id !== userId) return; // only the initiating client writes

  const combatant = getCombatantForToken(tokenDoc.id);
  if (!combatant) return;

  const cost = movement.passed?.cost ?? 0;
  if (!(cost > 0)) return;

  addMovementCost(combatant, cost);

  // Refresh the combat tracker panel so the movement bar updates in real-time
  ui.combat?.render(false);
});

// ── Combat turn / round resets ────────────────────────────────────────────────

Hooks.on('combatTurn', async (combat, updateData) => {
  if (!game.user.isGM) return; // only GM writes flag resets
  const prev = combat.combatants.get(combat.previous?.combatantId);
  if (prev) await resetTurnState(prev);
  // Use updateData.turn index to reliably identify the incoming combatant even
  // when combat.current hasn't settled yet in some Foundry versions.
  const newTurnIdx = updateData?.turn ?? 0;
  const curr = combat.combatants.contents[newTurnIdx]
    ?? combat.combatants.get(combat.current?.combatantId);
  if (curr) await resetTurnState(curr);
  ui.combat?.render(false);
  // Re-render open actor sheets so RoF buttons and movement bar refresh.
  for (const actor of [prev?.actor, curr?.actor].filter(Boolean)) {
    actor.sheet?.render(false);
  }

  // Resolve pending NET timers (quickhack activation, encrypt/decrypt completion)
  const _roundNumber = updateData?.round ?? combat.round ?? 1;
  await resolveNetTimers(combat, _roundNumber);

  // ── Vehicle turn execution ───────────────────────────────────────────────────
  // When a vehicle combatant's turn starts, execute its automatic turn logic
  // (coast if a driver is present, drift if unmanned, or acknowledge a pending
  // Maneuver).  This runs after reset so the combatant's state is clean.
  if (curr?.actor?.type === 'vehicle') {
    try {
      await executeVehicleTurn(curr);
    } catch (err) {
      console.error('cyberpunk-blue | vehicle turn execution failed:', err);
    }
  }
});

Hooks.on('combatRound', async (combat) => {
  if (!game.user.isGM) return; // only GM writes flag resets
  for (const combatant of combat.combatants.contents) {
    await resetTurnState(combatant);
  }
  ui.combat?.render(false);
  // Re-render all open sheets so RoF buttons refresh.
  for (const combatant of combat.combatants.contents) {
    combatant.actor?.sheet?.render(false);
  }
});

// ── Visibility residue region expiry ─────────────────────────────────────────
// On each round/turn advance, delete visibility residue regions whose
// expiresOnRound has been reached.  Only activeGM executes deletions.
Hooks.on('updateCombat', async (combat, changes) => {
  if (game.user !== game.users.activeGM) return;
  if (!('round' in changes) && !('turn' in changes)) return;

  const scene = game.scenes.active;
  if (!scene) return;

  const round = combat.round ?? 0;
  const toDelete = [];
  for (const region of scene.regions) {
    const expiry = region.getFlag('cyberpunk-blue', 'visibilityExpiry');
    if (!expiry || expiry.mode !== 'rounds') continue;
    if (expiry.combatId !== combat.id) continue;
    if (round >= expiry.expiresOnRound) toDelete.push(region.id);
  }
  if (toDelete.length) {
    await scene.deleteEmbeddedDocuments('Region', toDelete);
  }
});

// ── Combat tracker panel: movement + action display ───────────────────────────

Hooks.on('renderCombatTracker', (app, htmlArg, _data) => {
  if (!game.combat?.started) return;

  // Support both Application (jQuery) and ApplicationV2 (HTMLElement)
  const root = htmlArg instanceof HTMLElement ? htmlArg : htmlArg[0];
  if (!root) return;

  // Remove any previous panel so re-renders don't duplicate it
  root.querySelectorAll('.cyber-blue-combat-panel').forEach((el) => el.remove());

  const activeCombatant = getActiveCombatant();
  if (!activeCombatant) return;

  const actor = activeCombatant.actor;
  if (!actor) return;

  const moveValue = Math.max(Number(actor.system?.stats?.move?.value) || 0, 0);
  const state = getTurnState(activeCombatant);
  const budget = getMovementBudget(activeCombatant, actor);
  const used = state.movementUsed ?? 0;
  const remaining = Math.max(budget - used, 0);
  const pct = budget > 0 ? Math.min(100, (remaining / budget) * 100) : 0;

  const actionUsed = state.actionUsed;

  // Show Sprint button to the user who owns the active combatant (and GM)
  const canSprint = !actionUsed && activeCombatant.isOwner;

  const sprintMeters = moveValue * 2;
  const sprintLabel = game.i18n.format('CYBER_BLUE.Combat.Panel.Sprint', { meters: sprintMeters });
  const sprintBtn = (canSprint && sprintMeters > 0)
    ? `<button type="button" class="cyber-blue-sprint-btn" title="${game.i18n.localize('CYBER_BLUE.Combat.Panel.SprintTitle')}">${sprintLabel}</button>`
    : '';

  // ── "Declare Maneuver" button for vehicle drivers ─────────────────────────
  // The button is shown when the active combatant is the driver of a vehicle
  // combatant in this combat.  Only the combatant's owner (and GMs) see it.
  let declareManeuverHtml = '';
  let vehicleCombatantForDriver = null;

  if (activeCombatant.isOwner || game.user.isGM) {
    const activeTokenId = activeCombatant.tokenId;
    vehicleCombatantForDriver = game.combat.combatants.find((c) => {
      if (c.actor?.type !== 'vehicle') return false;
      return c.actor.getFlag('cyberpunk-blue', VEHICLE_DRIVER_TOKEN_FLAG) === activeTokenId;
    });

    if (vehicleCombatantForDriver) {
      const pending = getVehiclePendingManeuver(vehicleCombatantForDriver);
      const pendingLabel = pending
        ? `<span class="cpb-pending-chip">Pending: ${pending.type}</span>`
        : '';
      declareManeuverHtml = `
        <div class="cbcp-row cbcp-declare-maneuver">
          <button type="button" class="cpb-declare-maneuver-btn">
            <i class="fas fa-car"></i> Declare Maneuver
          </button>
          ${pendingLabel}
        </div>
      `;
    }
  }

  const panel = document.createElement('div');
  panel.className = 'cyber-blue-combat-panel';
  panel.innerHTML = `
    <div class="cbcp-name">${activeCombatant.name}</div>
    <div class="cbcp-row cbcp-move">
      <span class="cbcp-label">${game.i18n.localize('CYBER_BLUE.Combat.Panel.Move')}</span>
      <div class="cbcp-bar-wrap" title="${remaining.toFixed(1)}m / ${budget}m">
        <div class="cbcp-bar" style="width:${pct.toFixed(1)}%"></div>
      </div>
      <span class="cbcp-value">${remaining.toFixed(1)} / ${budget}m</span>
    </div>
    <div class="cbcp-row cbcp-action">
      <span class="cbcp-label">${game.i18n.localize('CYBER_BLUE.Combat.Panel.Action')}</span>
      <span class="cbcp-action-state ${actionUsed ? 'used' : 'available'}">
        ${actionUsed
          ? game.i18n.localize('CYBER_BLUE.Combat.Panel.ActionUsed')
          : game.i18n.localize('CYBER_BLUE.Combat.Panel.ActionAvailable')}
      </span>
      ${sprintBtn}
    </div>
    ${declareManeuverHtml}
  `;

  // Wire up Sprint button
  panel.querySelector('.cyber-blue-sprint-btn')?.addEventListener('click', async () => {
    await grantSprint(activeCombatant, sprintMeters);
    ui.combat?.render(false);
    ui.notifications.info(
      game.i18n.format('CYBER_BLUE.Combat.Panel.SprintGranted', { meters: sprintMeters })
    );
  });

  // Wire up Declare Maneuver button
  if (vehicleCombatantForDriver) {
    panel.querySelector('.cpb-declare-maneuver-btn')?.addEventListener('click', async () => {
      const driverActor = activeCombatant.actor;
      if (!driverActor) return;
      await VehicleManeuverDialog.show(vehicleCombatantForDriver, driverActor);
      ui.combat?.render(false);
    });
  }

  // Insert above the combat controls row; fall back to appending
  const controls = root.querySelector('.combat-controls');
  if (controls) {
    controls.before(panel);
  } else {
    root.querySelector('.directory-footer, form')?.append(panel)
      ?? root.append(panel);
  }
});

// ── Combat tracker: vehicle row augmentation ──────────────────────────────────
// For each vehicle combatant row, injects:
//   • A "Handling N" badge so the GM can see the effective stat at a glance.
//   • A driver chip showing who is currently in the driver seat (if anyone).
//
// For each NON-vehicle combatant row whose actor is the current driver of a
// vehicle in this combat, injects a "Delay to vehicle" button.  Clicking it
// calls delayDriverToVehicle so the driver acts just before the vehicle.
//
// Runs after the main panel hook so vehicle rows are already in the DOM.
Hooks.on('renderCombatTracker', (app, htmlArg, _data) => {
  if (!game.combat?.started) return;

  const root = htmlArg instanceof HTMLElement ? htmlArg : htmlArg[0];
  if (!root) return;

  const scene = canvas.scene;

  // Remove stale vehicle chips from previous renders so we don't duplicate.
  root.querySelectorAll('.cpb-vehicle-chips').forEach((el) => el.remove());
  root.querySelectorAll('.cpb-delay-btn').forEach((el) => el.remove());

  for (const combatant of game.combat.combatants.contents) {
    const actor = combatant.actor;
    if (!actor) continue;

    // ── Vehicle rows ───────────────────────────────────────────────────────────
    if (actor.type === 'vehicle') {
      const row = root.querySelector(`[data-combatant-id="${combatant.id}"]`);
      if (!row) continue;

      const handling = getVehicleHandling(actor);
      const speed    = actor.system?.stats?.currentSpeed?.value ?? 0;

      // Driver name lookup.
      const driverTokenId = actor.getFlag('cyberpunk-blue', VEHICLE_DRIVER_TOKEN_FLAG);
      const driverToken   = driverTokenId && scene ? scene.tokens.get(driverTokenId) : null;
      const driverChip    = driverToken
        ? `<span class="cpb-chip cpb-chip--driver" title="Driver"><i class="fas fa-steering-wheel"></i> ${driverToken.name}</span>`
        : `<span class="cpb-chip cpb-chip--no-driver" title="No driver"><i class="fas fa-steering-wheel"></i> —</span>`;

      const chips = document.createElement('div');
      chips.className = 'cpb-vehicle-chips';
      chips.innerHTML = `
        <span class="cpb-chip cpb-chip--handling" title="Effective Handling">
          <i class="fas fa-gauge-high"></i> ${handling >= 0 ? '+' : ''}${handling}
        </span>
        <span class="cpb-chip cpb-chip--speed" title="Current Speed">
          <i class="fas fa-tachometer-alt"></i> ${speed} m/t
        </span>
        ${driverChip}
      `;
      row.appendChild(chips);
      continue;
    }

    // ── Non-vehicle rows: "Delay to vehicle" button ────────────────────────────
    // Show button only to GM; only when this combatant is the driver of a vehicle
    // that is also in the current combat.
    if (!game.user.isGM) continue;

    const actorTokenId = combatant.tokenId;

    // Find a vehicle combatant whose actor has this token as its current driver.
    const vehicleCombatant = game.combat.combatants.find((c) => {
      if (c.actor?.type !== 'vehicle') return false;
      return c.actor.getFlag('cyberpunk-blue', VEHICLE_DRIVER_TOKEN_FLAG) === actorTokenId;
    });
    if (!vehicleCombatant) continue;

    const row = root.querySelector(`[data-combatant-id="${combatant.id}"]`);
    if (!row) continue;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cpb-delay-btn';
    btn.title = `Delay to just before ${vehicleCombatant.name}`;
    btn.innerHTML = '<i class="fas fa-car"></i>';
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await delayDriverToVehicle(combatant, vehicleCombatant);
      ui.combat?.render(false);
    });

    // Append button next to the combatant name area.
    const nameEl = row.querySelector('.token-name, .combatant-name');
    if (nameEl) {
      nameEl.after(btn);
    } else {
      row.appendChild(btn);
    }
  }
});

// ─── Critical Injury: populate compendium tables on first run ────────────────

async function ensureCritInjuryTables() {
  if (!game.user.isGM) return;
  const PACK_ID = 'cyberpunk-blue.critical-injury-tables';
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | Critical injury tables compendium not found — skipping auto-populate.');
    return;
  }
  const index = await pack.getIndex();

  // Check if migration is needed: look for the new 'dismembered-hand' body entry
  // (absent in the v1 tables that had Dismembered Leg at roll 3 instead).
  let needsMigration = false;
  if (index.size >= 2) {
    const bodyEntry = index.find((e) => {
      return pack.contents.find((t) => t.id === e._id)
        ?.getFlag('cyberpunk-blue', 'critTableType') === 'body';
    });
    if (bodyEntry) {
      try {
        const bodyTable = await pack.getDocument(bodyEntry._id);
        const hasNewEntries = bodyTable.results.contents.some(
          (r) => r.getFlag('cyberpunk-blue', 'critKey') === 'dismembered-hand'
        );
        needsMigration = !hasNewEntries;
      } catch {
        needsMigration = true;
      }
    } else {
      needsMigration = true;
    }
  }

  if (index.size >= 2 && !needsMigration) return; // already up to date

  console.log('Cyberpunk Blue | Creating/updating critical injury tables in compendium…');
  await pack.configure({ locked: false });
  try {
    if (index.size >= 2 && needsMigration) {
      // Delete existing tables and recreate with new data
      const docs = await pack.getDocuments();
      for (const doc of docs) await doc.delete();
      console.log('Cyberpunk Blue | Old critical injury tables removed for migration.');
    }
    await RollTable.create(buildCritBodyTableData(), { pack: PACK_ID });
    await RollTable.create(buildCritHeadTableData(), { pack: PACK_ID });
    console.log('Cyberpunk Blue | Critical injury tables created in compendium.');
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to create critical injury tables:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Weapon catalogue: populate compendium packs on first run ────────────────

/** Resolve the folder name for a single catalogue item. */
function _classifyForFolder(item) {
  if (item?.type === 'mod') {
    const map = {
      'short':  'Short Scope',
      'long':   'Long Scope',
      'sniper': 'Sniper Scope',
    };
    const sys = item?.system ?? {};
    if (sys.modType === 'computerMod') return { packId: 'cyberpunk-blue.weapon-mods', folderName: 'Computer Hardware' };
    if (sys.scopeType) return { packId: 'cyberpunk-blue.weapon-mods', folderName: map[sys.scopeType] };
    if (sys.silenceDV) return { packId: 'cyberpunk-blue.weapon-mods', folderName: 'Silencer' };
    if (sys.lostForce) return { packId: 'cyberpunk-blue.weapon-mods', folderName: 'Muzzle Break' };
    if (sys.modSlots && sys.modSlots >= 2) return { packId: 'cyberpunk-blue.weapon-mods', folderName: 'Under-Barrel' };
    return { packId: 'cyberpunk-blue.weapon-mods', folderName: 'Attachment' };
  }
  // Weapon → folder by weapon-type label
  const firstWeapon = item?.system?.weapons?.[0];
  const typeKey = firstWeapon?.type ?? 'lightMelee';
  const def = COMBAT_CONFIG.weaponTypeMap[typeKey];
  return { packId: 'cyberpunk-blue.weapons', folderName: def?.label ?? typeKey };
}

async function _ensureFolderInPack(pack, name) {
  await pack.getIndex({ fields: ['name', 'type'] });
  const existing = pack.folders.find((f) => f.name === name);
  if (existing) return existing;
  return Folder.create({ name, type: 'Item', sorting: 'a', color: null }, { pack: pack.collection });
}

async function _populatePack(packId, items) {
  const pack = game.packs.get(packId);
  if (!pack) {
    console.warn(`Cyberpunk Blue | Pack "${packId}" not found.`);
    return 0;
  }
  await pack.getIndex();
  if (pack.index.size > 0) return 0; // already populated

  // Group by folder
  const byFolder = new Map();
  for (const item of items) {
    const { folderName } = _classifyForFolder(item);
    if (!byFolder.has(folderName)) byFolder.set(folderName, []);
    byFolder.get(folderName).push(item);
  }

  let created = 0;
  await pack.configure({ locked: false });
  try {
    for (const [folderName, group] of byFolder.entries()) {
      const folder = await _ensureFolderInPack(pack, folderName);
      const cleaned = group.map((it) => {
        const copy = foundry.utils.deepClone(it);
        delete copy._id;
        copy.folder = folder?.id ?? null;
        return copy;
      });
      const docs = await Item.createDocuments(cleaned, { pack: packId });
      created += docs.length;
    }
  } finally {
    await pack.configure({ locked: true });
  }
  return created;
}

// ─── Cost-string migration ────────────────────────────────────────────────────

/**
 * One-time migration: expand abbreviated cost strings (e.g. 'EX', 'VEX', 'C')
 * to their full COST_LADDER equivalents in the weapons and weapon-mods packs.
 * Safe to run on every load — items already using full strings are untouched.
 */
const _COST_EXPAND = {
  CH:  '€$10 (Cheap)',
  EV:  '€$20 (Everyday)',
  C:   '€$50 (Costly)',
  CO:  '€$50 (Costly)',
  PR:  '€$100 (Premium)',
  EX:  '€$500 (Expensive)',
  VEX: '€$1,000 (Very Expensive)',
  LUX: '€$5,000 (Luxury)',
  SLX: '€$10,000 (Super Luxury)',
};

async function migrateCostStrings() {
  if (!game.user.isGM) return;
  const packIds = [
    'cyberpunk-blue.weapons',
    'cyberpunk-blue.weapon-mods',
    'cyberpunk-blue.gear',
    'cyberpunk-blue.cyberware',
    'cyberpunk-blue.drugs',
    'cyberpunk-blue.programs',
  ];
  let total = 0;
  for (const packId of packIds) {
    const pack = game.packs.get(packId);
    if (!pack) continue;
    const docs = await pack.getDocuments();
    const updates = docs
      .filter((d) => _COST_EXPAND[d.system?.cost])
      .map((d) => ({ _id: d.id, 'system.cost': _COST_EXPAND[d.system.cost] }));
    if (!updates.length) continue;
    await pack.configure({ locked: false });
    try {
      await Item.updateDocuments(updates, { pack: packId });
      total += updates.length;
    } finally {
      await pack.configure({ locked: true });
    }
  }
  if (total > 0) {
    console.log(`Cyberpunk Blue | Migrated ${total} item cost strings to full COST_LADDER format.`);
  }
}

// ─── Weapon catalogue ─────────────────────────────────────────────────────────

async function ensureWeaponCatalogue() {
  if (!game.user.isGM) return;
  try {
    // Filter catalogue by destination pack
    const weapons = WEAPON_CATALOGUE.filter((it) => _classifyForFolder(it).packId === 'cyberpunk-blue.weapons');
    const mods = MOD_CATALOGUE.filter((it) => _classifyForFolder(it).packId === 'cyberpunk-blue.weapon-mods');

    const wCreated = await _populatePack('cyberpunk-blue.weapons', weapons);
    const mCreated = await _populatePack('cyberpunk-blue.weapon-mods', mods);

    if (wCreated || mCreated) {
      console.log(`Cyberpunk Blue | Weapon catalogue imported: ${wCreated} weapons, ${mCreated} mods.`);
      ui.notifications.info(`Cyberpunk Blue: Weapon catalogue imported (${wCreated} weapons, ${mCreated} mods).`);
    }

    // Sync any new mods that weren't present when the pack was first populated
    // (e.g. computerMods added after the initial population)
    await _syncMissingMods(MOD_CATALOGUE);

    // Update existing mod entries whose system data has changed
    // (e.g. weaponChanges added, new boolean/numeric flags set)
    await _syncModEntries(MOD_CATALOGUE);

    // Update existing weapon entries whose weapons[] array has changed
    // (e.g. SS+AF merged into single AF entry, autofireDamage added)
    await _syncWeaponEntries(WEAPON_CATALOGUE);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to import weapon catalogue:', err);
  }
}

/** Add any catalogue mods that are missing from the weapon-mods pack by name. */
async function _syncMissingMods(catalogue) {
  const PACK_ID = 'cyberpunk-blue.weapon-mods';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type'] });
  const existingNames = new Set(pack.index.filter((e) => e.type === 'mod').map((e) => e.name));
  const missing = catalogue.filter((it) => !existingNames.has(it.name));
  if (missing.length === 0) return;

  await pack.configure({ locked: false });
  try {
    // Group by folder
    const byFolder = new Map();
    for (const item of missing) {
      const { folderName } = _classifyForFolder(item);
      if (!byFolder.has(folderName)) byFolder.set(folderName, []);
      byFolder.get(folderName).push(item);
    }
    let created = 0;
    for (const [folderName, group] of byFolder.entries()) {
      const folder = await _ensureFolderInPack(pack, folderName);
      const cleaned = group.map((it) => {
        const copy = foundry.utils.deepClone(it);
        delete copy._id;
        copy.folder = folder?.id ?? null;
        return copy;
      });
      const docs = await Item.createDocuments(cleaned, { pack: PACK_ID });
      created += docs.length;
    }
    if (created > 0) {
      console.log(`Cyberpunk Blue | Added ${created} missing mods to weapon-mods pack.`);
    }
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Synchronise system fields of existing mod items in the weapon-mods compendium
 * against the current catalogue definition.  Detects changes to weaponChanges,
 * burstControlAmmoReduction, beginnerFriendly, and targetVitalsPenaltyReduction
 * so that catalogue updates propagate without a full pack wipe.
 */
async function _syncModEntries(catalogue) {
  const PACK_ID = 'cyberpunk-blue.weapon-mods';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type'] });

  // Build a name → catalogue entry map
  const byName = new Map(catalogue.map((it) => [it.name, it]));

  const updates = [];
  for (const entry of pack.index) {
    if (entry.type !== 'mod') continue;
    const def = byName.get(entry.name);
    if (!def) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;

    const sys = doc.system;
    const defSys = def.system;

    // Compare the fields that can change across catalogue updates
    const weaponChangesChanged =
      JSON.stringify(sys.weaponChanges ?? []) !== JSON.stringify(defSys.weaponChanges ?? []);
    const burstChanged = (sys.burstControlAmmoReduction ?? 0) !== (defSys.burstControlAmmoReduction ?? 0);
    const beginnerChanged = !!sys.beginnerFriendly !== !!defSys.beginnerFriendly;
    const vitalsChanged = (sys.targetVitalsPenaltyReduction ?? 0) !== (defSys.targetVitalsPenaltyReduction ?? 0);
    const trajectoryChanged = !!sys.trajectoryCalculations !== !!defSys.trajectoryCalculations;
    const closeRangeChanged = !!sys.closeRangeBonus !== !!defSys.closeRangeBonus;
    const steadyChanged = !!sys.steady !== !!defSys.steady;
    const handlingComputerChanged = !!sys.handlingComputer !== !!defSys.handlingComputer;
    const calibrationChanged = !!sys.calibration !== !!defSys.calibration;
    const recoilBonusChanged = (sys.recoilBonus ?? 0) !== (defSys.recoilBonus ?? 0);
    const recoilAFOnlyChanged = !!sys.recoilAFOnly !== !!defSys.recoilAFOnly;
    // Batch 5 fields
    const barrierPenChanged = !!sys.barrierPenetration !== !!defSys.barrierPenetration;
    const improvedRicochetChanged = !!sys.improvedRicochet !== !!defSys.improvedRicochet;
    // Batch 6 fields
    const improvedChargeChanged = !!sys.improvedCharge !== !!defSys.improvedCharge;
    const srCapacityChanged     = !!sys.srCapacity !== !!defSys.srCapacity;
    // Batch 7 fields
    const accidentalDischargeChanged = !!sys.accidentalDischarge !== !!defSys.accidentalDischarge;
    // Batch 8 fields
    const bayonetChanged = !!sys.bayonet !== !!defSys.bayonet;
    // Batch 9 fields
    const requiresLightMeleeChanged = !!sys.requiresLightMelee !== !!defSys.requiresLightMelee;

    const modDataChanged = weaponChangesChanged || burstChanged || beginnerChanged || vitalsChanged ||
        trajectoryChanged || closeRangeChanged || steadyChanged || handlingComputerChanged ||
        calibrationChanged || recoilBonusChanged || recoilAFOnlyChanged ||
        barrierPenChanged || improvedRicochetChanged ||
        improvedChargeChanged || srCapacityChanged ||
        accidentalDischargeChanged || bayonetChanged || requiresLightMeleeChanged;
    const modImgChanged = def.img && doc.img !== def.img;
    if (modDataChanged || modImgChanged) {
      const update = { _id: doc.id };
      if (modDataChanged) Object.assign(update, {
        'system.weaponChanges': defSys.weaponChanges ?? [],
        'system.burstControlAmmoReduction': defSys.burstControlAmmoReduction ?? 0,
        'system.beginnerFriendly': !!defSys.beginnerFriendly,
        'system.targetVitalsPenaltyReduction': defSys.targetVitalsPenaltyReduction ?? 0,
        'system.trajectoryCalculations': !!defSys.trajectoryCalculations,
        'system.closeRangeBonus': !!defSys.closeRangeBonus,
        'system.steady': !!defSys.steady,
        'system.handlingComputer': !!defSys.handlingComputer,
        'system.calibration': !!defSys.calibration,
        'system.recoilBonus': defSys.recoilBonus ?? 0,
        'system.recoilAFOnly': !!defSys.recoilAFOnly,
        'system.barrierPenetration': !!defSys.barrierPenetration,
        'system.improvedRicochet': !!defSys.improvedRicochet,
        'system.improvedCharge': !!defSys.improvedCharge,
        'system.srCapacity': !!defSys.srCapacity,
        'system.accidentalDischarge': !!defSys.accidentalDischarge,
        'system.bayonet': !!defSys.bayonet,
        'system.requiresLightMelee': !!defSys.requiresLightMelee,
      });
      if (modImgChanged) update.img = def.img;
      updates.push(update);
    }
  }

  if (updates.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(updates, { pack: PACK_ID });
    console.log(`Cyberpunk Blue | Updated system fields for ${updates.length} mods in weapon-mods pack.`);
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Synchronise the `system.weapons` array of existing gear items in the weapons
 * compendium against the current catalogue definition.  Runs on every GM load
 * so removing a duplicate SS entry or changing autofireDamage propagates
 * without requiring a full pack wipe.
 */
async function _syncWeaponEntries(catalogue) {
  const PACK_ID = 'cyberpunk-blue.weapons';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type'] });

  // Build a name → catalogue entry map (gear items only)
  const byName = new Map(catalogue.filter((it) => it.type === 'gear').map((it) => [it.name, it]));

  const updates = [];
  const effectsToCreate = []; // { doc, effects }[] — affliction AEs to add to existing items
  for (const entry of pack.index) {
    if (entry.type !== 'gear') continue;
    const def = byName.get(entry.name);
    if (!def) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;

    const currentWeapons = doc.system.weapons ?? [];
    const catalogueWeapons = def.system?.weapons ?? [];

    // Compare by weapon count only — if counts differ or the first entry's
    // damageType changed (SS→AF merge), the entry is stale.
    const countChanged = currentWeapons.length !== catalogueWeapons.length;
    const typeChanged = (currentWeapons[0]?.damageType ?? '') !== (catalogueWeapons[0]?.damageType ?? '');
    const autofireDamageChanged = (currentWeapons[0]?.autofireDamage ?? '') !== (catalogueWeapons[0]?.autofireDamage ?? '');
    const critFlagsChanged =
      !!currentWeapons[0]?.critSlicing !== !!catalogueWeapons[0]?.critSlicing ||
      !!currentWeapons[0]?.critBlunt !== !!catalogueWeapons[0]?.critBlunt ||
      !!currentWeapons[0]?.critCrushing !== !!catalogueWeapons[0]?.critCrushing ||
      !!currentWeapons[0]?.critStun !== !!catalogueWeapons[0]?.critStun ||
      !!currentWeapons[0]?.critDoublePick !== !!catalogueWeapons[0]?.critDoublePick;

    // Batch 5: new PW mechanic fields
    const pwFieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (
        (cur.targetedShotDamageDice ?? '') !== (cw.targetedShotDamageDice ?? '') ||
        !!cur.armorPiercing !== !!(cw.armorPiercing) ||
        !!cur.scatter !== !!(cw.scatter) ||
        !!cur.shatteredProjectiles !== !!(cw.shatteredProjectiles) ||
        (cur.shortAmmoFallbackDamage ?? '') !== (cw.shortAmmoFallbackDamage ?? '') ||
        (cur.critOnBodyReq ?? 0) !== (cw.critOnBodyReq ?? 0) ||
        (cur.targetVitalsPenalty ?? 8) !== (cw.targetVitalsPenalty ?? 8)
      );
    });
    // Batch 6: TW charge mechanic fields
    const twChargeFieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (
        !!cur.cs3 !== !!cw.cs3 ||
        (cur.cs3FallbackDamage ?? '') !== (cw.cs3FallbackDamage ?? '') ||
        !!cur.chargeKeepsRof !== !!cw.chargeKeepsRof
      );
    });
    // Batch 7: new weapon behaviour flags
    const batch7FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (
        !!cur.vicious !== !!cw.vicious ||
        !!cur.heavyRecoil !== !!cw.heavyRecoil ||
        !!cur.shockwave !== !!cw.shockwave ||
        !!cur.burningEdge !== !!cw.burningEdge ||
        (cur.chargedAttackBonus ?? 0) !== (cw.chargedAttackBonus ?? 0)
      );
    });
    // Batch 8: autoFireOn10, doubleLock, electricCharge, chompAmmo, halveSP
    const batch8FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (
        !!cur.autoFireOn10 !== !!cw.autoFireOn10 ||
        !!cur.doubleLock !== !!cw.doubleLock ||
        !!cur.electricCharge !== !!cw.electricCharge ||
        (cur.electricChargeMax ?? 0) !== (cw.electricChargeMax ?? 0) ||
        !!cur.chompAmmo !== !!cw.chompAmmo ||
        !!cur.halveSP !== !!cw.halveSP
      );
    });
    // Batch 9: minimumAmmoToFire
    const batch9FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (cur.minimumAmmoToFire ?? 0) !== (cw.minimumAmmoToFire ?? 0);
    });
    // Batch 10: silence fields (silenceBuiltIn, silenceBuiltInDV)
    const batch10FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (
        !!cur.silenceBuiltIn !== !!cw.silenceBuiltIn ||
        (cur.silenceBuiltInDV ?? 0) !== (cw.silenceBuiltInDV ?? 0)
      );
    });
    // Batch 11: weapon type change (e.g. mediumPistol → stunGun for Mámù)
    const batch11FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (cur.type ?? '') !== (cw.type ?? '');
    });
    // Batch 12: affliction fields + outerZoneResistBonus (new schema fields)
    const batch12FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return (
        (cur.afflictionPrimary ?? 'body') !== (cw.afflictionPrimary ?? 'body') ||
        (cur.afflictionSkill ?? '') !== (cw.afflictionSkill ?? '') ||
        (cur.afflictionDv ?? 13) !== (cw.afflictionDv ?? 13) ||
        (cur.afflictionEffectId ?? '') !== (cw.afflictionEffectId ?? '') ||
        (cur.outerZoneResistBonus ?? 2) !== (cw.outerZoneResistBonus ?? 2)
      );
    });
    // Batch 13: isBeaconWeapon
    const batch13FieldsChanged = catalogueWeapons.some((cw, i) => {
      const cur = currentWeapons[i] ?? {};
      return !!cur.isBeaconWeapon !== !!cw.isBeaconWeapon;
    });

    const weaponDataChanged = countChanged || typeChanged || autofireDamageChanged || critFlagsChanged || pwFieldsChanged || twChargeFieldsChanged || batch7FieldsChanged || batch8FieldsChanged || batch9FieldsChanged || batch10FieldsChanged || batch11FieldsChanged || batch12FieldsChanged || batch13FieldsChanged;
    const weaponImgChanged = def.img && doc.img !== def.img;
    if (weaponDataChanged || weaponImgChanged) {
      const update = { _id: doc.id };
      if (weaponDataChanged) update['system.weapons'] = catalogueWeapons;
      if (weaponImgChanged)  update.img = def.img;
      updates.push(update);
    }

    // Sync missing affliction AEs (e.g. stun weapons converted to affliction damageType)
    const catalogueAfflictionEffects = (def.effects ?? []).filter(
      (e) => e.flags?.['cyberpunk-blue']?.isAfflictionEffect,
    );
    const existingAfflictionNames = new Set(
      doc.effects.contents
        .filter((e) => e.getFlag?.('cyberpunk-blue', 'isAfflictionEffect'))
        .map((e) => e.name),
    );
    const missingAfflictionEffects = catalogueAfflictionEffects.filter(
      (ce) => !existingAfflictionNames.has(ce.name),
    );
    if (missingAfflictionEffects.length > 0) {
      effectsToCreate.push({ doc, effects: missingAfflictionEffects });
    }
  }

  if (updates.length === 0 && effectsToCreate.length === 0) return;

  await pack.configure({ locked: false });
  try {
    if (updates.length > 0) {
      await Item.updateDocuments(updates, { pack: PACK_ID });
      console.log(`Cyberpunk Blue | Updated weapon entries for ${updates.length} items in weapons pack.`);
    }
    for (const { doc: itemDoc, effects } of effectsToCreate) {
      await itemDoc.createEmbeddedDocuments('ActiveEffect', effects);
      console.log(`Cyberpunk Blue | Added ${effects.length} affliction AE(s) to "${itemDoc.name}" in weapons pack.`);
    }
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Ammo catalogue ───────────────────────────────────────────────────────────

/**
 * Ensure the basic ammo items exist in the weapons compendium.
 * Unlike _populatePack, this runs even if the pack is already populated —
 * it only creates items that don't already exist (matched by name).
 */
async function ensureAmmoCatalogue() {
  if (!game.user.isGM) return;
  const PACK_ID = 'cyberpunk-blue.weapons';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;

  try {
    await pack.getIndex({ fields: ['name', 'type', 'folder'] });
    const ammoIndex = pack.index.filter((e) => e.type === 'ammo');
    const existingNames = new Set(ammoIndex.map((e) => e.name));
    const byName = new Map(AMMO_CATALOGUE.map((it) => [it.name, it]));
    const missing = AMMO_CATALOGUE.filter((it) => !existingNames.has(it.name));

    // Sync images on already-existing ammo items
    const imgUpdates = [];
    for (const entry of ammoIndex) {
      const def = byName.get(entry.name);
      if (!def?.img) continue;
      const doc = await pack.getDocument(entry._id);
      if (!doc || doc.img === def.img) continue;
      imgUpdates.push({ _id: doc.id, img: def.img });
    }

    if (missing.length === 0 && imgUpdates.length === 0) return;

    await pack.configure({ locked: false });
    try {
      if (missing.length > 0) {
        const ammoFolder = await _ensureFolderInPack(pack, 'Ammo');
        const cleaned = missing.map((it) => {
          const copy = foundry.utils.deepClone(it);
          delete copy._folder;
          copy.folder = ammoFolder?.id ?? null;
          return copy;
        });
        const docs = await Item.createDocuments(cleaned, { pack: PACK_ID });
        console.log(`Cyberpunk Blue | Ammo catalogue: ${docs.length} items added.`);
        if (docs.length > 0) {
          ui.notifications.info(`Cyberpunk Blue: ${docs.length} basic ammo items added to the Weapons compendium.`);
        }
      }
      if (imgUpdates.length > 0) {
        await Item.updateDocuments(imgUpdates, { pack: PACK_ID });
        console.log(`Cyberpunk Blue | Ammo catalogue: synced images for ${imgUpdates.length} items.`);
      }
    } finally {
      await pack.configure({ locked: true });
    }
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to sync ammo catalogue:', err);
  }
}

// ─── Equipment catalogue ──────────────────────────────────────────────────────

/**
 * Ensure armor items from the gear catalogue are present in the gear pack.
 * Runs even when the pack is already populated (adds only missing items by name).
 */
async function _ensureArmorInGearPack(gearItems) {
  const PACK_ID = 'cyberpunk-blue.gear';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;

  const armorItems = gearItems.filter((it) => it.system?.isArmor);
  if (armorItems.length === 0) return;

  await pack.getIndex({ fields: ['name', 'type'] });
  const existingNames = new Set(pack.index.map((e) => e.name));
  const missing = armorItems.filter((it) => !existingNames.has(it.name));
  if (missing.length === 0) return;

  await pack.configure({ locked: false });
  try {
    const folder = await _ensureFolderInPack(pack, 'Body Armor');
    const cleaned = missing.map((it) => {
      const copy = foundry.utils.deepClone(it);
      delete copy._id;
      delete copy._folder;
      copy.folder = folder?.id ?? null;
      return copy;
    });
    const docs = await Item.createDocuments(cleaned, { pack: PACK_ID });
    if (docs.length > 0) {
      console.log(`Cyberpunk Blue | Added ${docs.length} armor item(s) to gear pack.`);
    }
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Synchronise the `system.weapons` and `system.isWeapon` fields of existing
 * cyberware items in the cyberware compendium against the current catalogue.
 * Runs on every GM load so changes like Monowire / Mantis Blades weapons
 * propagate without requiring a full pack wipe.
 */
/**
 * Canonical form of a catalogue-defined effect for comparison purposes.
 * Excludes _id, origin, and system-generated flags (Psyche Loss, etc.).
 */
function _catalogueEffectSig(e) {
  return JSON.stringify({
    name:    (e.name ?? '').trim(),
    disabled: e.disabled ?? false,
    changes:  (e.changes ?? []).map((c) => ({ key: c.key, mode: c.type ?? c.mode, value: String(c.value) })),
    flags:   e.flags?.['cyberpunk-blue'] ?? {},
  });
}

/** True if a document-level AE was added by the system (not from the catalogue). */
function _isSystemGeneratedEffect(effect) {
  return !!(effect.getFlag?.('cyberpunk-blue', 'autoPsycheLoss')
    || effect.getFlag?.('cyberpunk-blue', 'autoOperationalEffectState')
    || effect.getFlag?.('cyberpunk-blue', 'autoGearEffectState')
    || effect.getFlag?.('cyberpunk-blue', 'skillChipFloor') != null);
}

async function _syncCyberwareEntries(catalogue) {
  const PACK_ID = 'cyberpunk-blue.cyberware';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type'] });

  const byName = new Map(
    catalogue
      .filter((it) => it.type === 'cyberware')
      .map((it) => [it.name, it])
  );

  const updates = [];
  for (const entry of pack.index) {
    if (entry.type !== 'cyberware') continue;
    const def = byName.get(entry.name);
    if (!def) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;

    const currentWeapons  = doc.system.weapons  ?? [];
    const currentIsWeapon = doc.system.isWeapon  ?? false;
    const catWeapons      = def.system?.weapons  ?? [];
    const catIsWeapon     = def.system?.isWeapon ?? false;

    const weaponCountChanged = currentWeapons.length !== catWeapons.length;
    const isWeaponChanged    = currentIsWeapon !== catIsWeapon;
    // Also detect critDoublePick flag changes (e.g. Monowire)
    const critDoublePickChanged = catWeapons.some((cw, i) =>
      !!currentWeapons[i]?.critDoublePick !== !!cw.critDoublePick
    );

    // Compare effects (catalogue definition vs. doc's non-system-generated AEs)
    const catEffects = def.effects ?? [];
    const docEffects = (doc.effects?.contents ?? []).filter((e) => !_isSystemGeneratedEffect(e));
    const catSig = catEffects.map(_catalogueEffectSig).sort().join('\n');
    const docSig = docEffects.map((e) => _catalogueEffectSig({
      name:    e.name,
      disabled: e.disabled,
      changes:  e.changes ?? [],
      flags:   { 'cyberpunk-blue': Object.fromEntries(
        Object.entries(e.flags?.['cyberpunk-blue'] ?? {})
          .filter(([k]) => k !== 'autoPsycheLoss' && k !== 'autoOperationalEffectState' && k !== 'autoGearEffectState')
      ) },
    })).sort().join('\n');
    const effectsChanged = catSig !== docSig;

    const catMultipleInstalls = def.system?.multipleInstalls ?? false;
    const catDescription      = def.system?.description      ?? '';
    const multipleInstallsChanged = doc.system.multipleInstalls !== catMultipleInstalls;
    const descriptionChanged      = catDescription && doc.system.description !== catDescription;

    const update = { _id: doc.id };
    let needsUpdate = false;
    if (weaponCountChanged || isWeaponChanged || critDoublePickChanged) {
      update['system.isWeapon'] = catIsWeapon;
      update['system.weapons']  = catWeapons;
      needsUpdate = true;
    }
    if (effectsChanged) {
      // Replace all catalogue-sourced effects with the current catalogue definition.
      // System-generated effects (Psyche Loss etc.) are added at runtime and won't
      // appear on compendium items, so a full replace is safe here.
      update.effects = catEffects;
      needsUpdate = true;
    }
    if (def.img && doc.img !== def.img) {
      update.img = def.img;
      needsUpdate = true;
    }
    if (multipleInstallsChanged) {
      update['system.multipleInstalls'] = catMultipleInstalls;
      needsUpdate = true;
    }
    if (descriptionChanged) {
      update['system.description'] = catDescription;
      needsUpdate = true;
    }
    if (needsUpdate) updates.push(update);
  }

  if (updates.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(updates, { pack: PACK_ID });
    const weaponCount  = updates.filter((u) => 'system.isWeapon' in u).length;
    const effectsCount = updates.filter((u) => 'effects' in u).length;
    const imgCount     = updates.filter((u) => 'img' in u).length;
    console.log(`Cyberpunk Blue | Synced ${weaponCount} weapon, ${effectsCount} effects, ${imgCount} image updates in cyberware pack.`);
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Sync drug compendium entries with the current catalogue definition.
 * Compares effects (AEs) and instructions; description fields are
 * informational and intentionally not synced.
 */
async function _syncDrugEntries(catalogue) {
  const PACK_ID = 'cyberpunk-blue.drugs';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type', 'folder'] });

  const byName = new Map(
    catalogue
      .filter((it) => it.type === 'drug')
      .map((it) => [it.name, it])
  );

  const updates = [];
  for (const entry of pack.index) {
    if (entry.type !== 'drug') continue;
    const def = byName.get(entry.name);
    if (!def) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;

    const catEffects = def.effects ?? [];
    const docEffects = (doc.effects?.contents ?? []).filter((e) => !_isSystemGeneratedEffect(e));
    const catSig = catEffects.map(_catalogueEffectSig).sort().join('\n');
    const docSig = docEffects.map((e) => _catalogueEffectSig({
      name:    e.name,
      disabled: e.disabled,
      changes:  e.changes ?? [],
      flags:   { 'cyberpunk-blue': e.flags?.['cyberpunk-blue'] ?? {} },
    })).sort().join('\n');
    const effectsChanged = catSig !== docSig;

    const catInstr = JSON.stringify(def.system?.instructions ?? []);
    const docInstr = JSON.stringify(doc.system?.instructions ?? []);
    const instrChanged = catInstr !== docInstr;

    const update = { _id: doc.id };
    let needsUpdate = false;
    if (effectsChanged) {
      update.effects = catEffects;
      needsUpdate = true;
    }
    if (instrChanged) {
      update['system.instructions'] = def.system.instructions ?? [];
      needsUpdate = true;
    }
    if (def.img && doc.img !== def.img) {
      update.img = def.img;
      needsUpdate = true;
    }
    // Migrate out of any subfolder — Foundry creates a world folder named after
    // the compendium on import, so a subfolder inside is unnecessary.
    if (entry.folder) {
      update.folder = null;
      needsUpdate = true;
    }
    if (needsUpdate) updates.push(update);
  }

  if (updates.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(updates, { pack: PACK_ID });
    const effectsCount = updates.filter((u) => 'effects' in u).length;
    const instrCount   = updates.filter((u) => 'system.instructions' in u).length;
    const imgCount     = updates.filter((u) => 'img' in u).length;
    console.log(`Cyberpunk Blue | Synced ${instrCount} instruction, ${effectsCount} effects, ${imgCount} image updates in drugs pack.`);
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Sync gear compendium entries with the current catalogue definition.
 * Compares isWeapon / weapons (for gear items that gain weapon entries, e.g.
 * Airhypo) and effects; system-generated effects
 * (gear state flags) are excluded from comparison.
 */
async function _syncGearEntries(catalogue) {
  const PACK_ID = 'cyberpunk-blue.gear';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type'] });

  const byName = new Map(
    catalogue
      .filter((it) => it.type === 'gear')
      .map((it) => [it.name, it])
  );

  const updates = [];
  for (const entry of pack.index) {
    if (entry.type !== 'gear') continue;
    const def = byName.get(entry.name);
    if (!def) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;

    const currentWeapons  = doc.system.weapons  ?? [];
    const currentIsWeapon = doc.system.isWeapon  ?? false;
    const catWeapons      = def.system?.weapons  ?? [];
    const catIsWeapon     = def.system?.isWeapon ?? false;

    const weaponCountChanged = currentWeapons.length !== catWeapons.length;
    const isWeaponChanged    = currentIsWeapon !== catIsWeapon;

    const catEffects = def.effects ?? [];
    const docEffects = (doc.effects?.contents ?? []).filter((e) => !_isSystemGeneratedEffect(e));
    const catSig = catEffects.map(_catalogueEffectSig).sort().join('\n');
    const docSig = docEffects.map((e) => _catalogueEffectSig({
      name:    e.name,
      disabled: e.disabled,
      changes:  e.changes ?? [],
      flags:   { 'cyberpunk-blue': Object.fromEntries(
        Object.entries(e.flags?.['cyberpunk-blue'] ?? {})
          .filter(([k]) => k !== 'autoGearEffectState')
      ) },
    })).sort().join('\n');
    const effectsChanged = catSig !== docSig;

    const update = { _id: doc.id };
    let needsUpdate = false;
    if (weaponCountChanged || isWeaponChanged) {
      update['system.isWeapon'] = catIsWeapon;
      update['system.weapons']  = catWeapons;
      needsUpdate = true;
    }
    if (effectsChanged) {
      update.effects = catEffects;
      needsUpdate = true;
    }
    if (def.img && doc.img !== def.img) {
      update.img = def.img;
      needsUpdate = true;
    }
    if (needsUpdate) updates.push(update);
  }

  if (updates.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(updates, { pack: PACK_ID });
    const weaponCount  = updates.filter((u) => 'system.isWeapon' in u).length;
    const effectsCount = updates.filter((u) => 'effects' in u).length;
    const imgCount     = updates.filter((u) => 'img' in u).length;
    console.log(`Cyberpunk Blue | Synced ${weaponCount} weapon, ${effectsCount} effects, ${imgCount} image updates in gear pack.`);
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Sync program compendium entries with the current catalogue.
 * Updates `damageFormula` and any other system fields that may have changed.
 */
async function _syncProgramEntries(catalogue) {
  const PACK_ID = 'cyberpunk-blue.programs';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;
  await pack.getIndex({ fields: ['name', 'type'] });

  const byName = new Map(
    catalogue
      .filter((it) => it.type === 'programExecutable')
      .map((it) => [it.name, it])
  );

  const updates = [];
  for (const entry of pack.index) {
    if (entry.type !== 'programExecutable') continue;
    const def = byName.get(entry.name);
    if (!def) continue;
    const doc = await pack.getDocument(entry._id);
    if (!doc) continue;

    const newFormula = def.system?.damageFormula ?? '';
    const formulaChanged = (doc.system?.damageFormula ?? '') !== newFormula;
    const imgChanged = def.img && doc.img !== def.img;

    if (!formulaChanged && !imgChanged) continue;

    const update = { _id: doc.id };
    if (formulaChanged) update['system.damageFormula'] = newFormula;
    if (imgChanged)     update.img = def.img;
    updates.push(update);
  }

  if (updates.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(updates, { pack: PACK_ID });
    const imgCount = updates.filter((u) => 'img' in u).length;
    console.log(`Cyberpunk Blue | Synced damageFormula/images for ${updates.length} programs (${imgCount} images).`);
  } finally {
    await pack.configure({ locked: true });
  }
}

/**
 * Populate the gear, drugs, cyberware, and programs compendium packs on first load.
 * Each catalogue entry carries a `_folder` property for folder classification;
 * it is stripped before the item is written to the pack.
 */
async function _populateEquipmentPack(packId, items) {
  const pack = game.packs.get(packId);
  if (!pack) {
    console.warn(`Cyberpunk Blue | Pack "${packId}" not found.`);
    return 0;
  }
  await pack.getIndex();
  if (pack.index.size > 0) return 0; // already populated

  // Group by _folder
  const byFolder = new Map();
  for (const item of items) {
    const folderName = item._folder ?? 'General';
    if (!byFolder.has(folderName)) byFolder.set(folderName, []);
    byFolder.get(folderName).push(item);
  }

  let created = 0;
  await pack.configure({ locked: false });
  try {
    for (const [folderName, group] of byFolder.entries()) {
      const folder = await _ensureFolderInPack(pack, folderName);
      const cleaned = group.map((it) => {
        const copy = foundry.utils.deepClone(it);
        delete copy._id;
        delete copy._folder;
        copy.folder = folder?.id ?? null;
        return copy;
      });
      const docs = await Item.createDocuments(cleaned, { pack: packId });
      created += docs.length;
    }
  } finally {
    await pack.configure({ locked: true });
  }
  return created;
}

async function ensureEquipmentCatalogue() {
  if (!game.user.isGM) return;
  try {
    const gearItems = EQUIPMENT_CATALOGUE.filter((it) => it.type === 'gear' || (it.type === 'mod' && it.system?.modType === 'weaponMod' && it._folder));
    const cyItems  = CYBERWARE_CATALOGUE;
    const drugItems = DRUG_CATALOGUE;
    const progItems = PROGRAM_CATALOGUE;

    const gCreated  = await _populateEquipmentPack('cyberpunk-blue.gear',      gearItems);
    const cyCreated = await _populateEquipmentPack('cyberpunk-blue.cyberware', cyItems);
    const dCreated  = await _populateEquipmentPack('cyberpunk-blue.drugs',     drugItems);
    const pCreated  = await _populateEquipmentPack('cyberpunk-blue.programs',  progItems);

    // Sync weapon data and effects on already-populated cyberware pack entries
    await _syncCyberwareEntries(CYBERWARE_CATALOGUE);

    // Sync effects and weapons on already-populated gear pack entries
    await _syncGearEntries(EQUIPMENT_CATALOGUE);

    // Sync effects and instructions on already-populated drug pack entries
    await _syncDrugEntries(DRUG_CATALOGUE);

    // Sync damageFormula (and future fields) on already-populated program entries
    await _syncProgramEntries(PROGRAM_CATALOGUE);

    // Add armor items that may have been missing in earlier versions
    await _ensureArmorInGearPack(gearItems);

    const total = gCreated + cyCreated + dCreated + pCreated;
    if (total > 0) {
      console.log(`Cyberpunk Blue | Equipment catalogue imported: ${gCreated} gear, ${cyCreated} cyberware, ${dCreated} drugs, ${pCreated} programs.`);
      ui.notifications.info(`Cyberpunk Blue: Equipment catalogue imported (${total} items).`);
    }
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to import equipment catalogue:', err);
  }
}

// ─── Role catalogue ───────────────────────────────────────────────────────────

async function ensureRoleCatalogue() {
  if (!game.user.isGM) return;
  const PACK_ID = 'cyberpunk-blue.roles';
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | Roles compendium not found — skipping auto-populate.');
    return;
  }
  await pack.getIndex();
  if (pack.index.size > 0) {
    // Sync any updated fields (category, abilityOverview, abilitySections, etc.)
    await _syncRoleEntries();
    return;
  }

  // Populate at root level (no subfolder) — Foundry creates a world folder named
  // after the compendium when players import, so a subfolder inside is unnecessary.
  console.log('Cyberpunk Blue | Populating roles compendium…');
  const cleaned = ROLE_CATALOGUE.map((it) => {
    const copy = foundry.utils.deepClone(it);
    delete copy._id;
    delete copy._folder;
    copy.folder = null;
    return copy;
  });

  let created = 0;
  await pack.configure({ locked: false });
  try {
    const docs = await Item.createDocuments(cleaned, { pack: PACK_ID });
    created = docs.length;
    console.log(`Cyberpunk Blue | Roles compendium populated: ${created} roles.`);
    if (created > 0) ui.notifications.info(`Cyberpunk Blue: Roles catalogue imported (${created} roles).`);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to populate roles compendium:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

async function _syncRoleEntries() {
  const PACK_ID = 'cyberpunk-blue.roles';
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;

  // Build lookup by name from the catalogue
  const byName = new Map(ROLE_CATALOGUE.map((r) => [r.name, r]));

  await pack.getIndex({ fields: ['name'] });
  const toUpdate = [];

  await pack.getIndex({ fields: ['name', 'folder'] });

  for (const entry of pack.index) {
    const catalogueEntry = byName.get(entry.name);
    if (!catalogueEntry) continue;

    // Fields that may change between versions (everything except rank / actor state).
    // Also move items to root level (folder: null) — Foundry creates a world folder
    // named after the compendium on import, so a subfolder inside is unnecessary.
    const update = {
      _id: entry._id,
      img: catalogueEntry.img,
      'system.category':          catalogueEntry.system.category,
      'system.description':       catalogueEntry.system.description,
      'system.abilityOverview':   catalogueEntry.system.abilityOverview,
      'system.abilitySections':   catalogueEntry.system.abilitySections,
      'system.lifepathLinks':     catalogueEntry.system.lifepathLinks,
      'system.lifepathQuestions': catalogueEntry.system.lifepathQuestions,
      'system.leaderFeatures':    catalogueEntry.system.leaderFeatures,
      'system.proteanFoci':       catalogueEntry.system.proteanFoci,
      'system.specialties':       catalogueEntry.system.specialties,
      'system.notes':             catalogueEntry.system.notes,
    };
    if (entry.folder) update.folder = null; // migrate out of subfolder
    toUpdate.push(update);
  }

  if (toUpdate.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(toUpdate, { pack: PACK_ID });
    console.log(`Cyberpunk Blue | Role entries synced: ${toUpdate.length} roles updated.`);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Ability catalogue ────────────────────────────────────────────────────────

async function ensureAbilityCatalogue() {
  if (!game.user.isGM) return;
  const PACK_ID = 'cyberpunk-blue.abilities';
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | Abilities compendium not found — skipping auto-populate.');
    return;
  }
  await pack.getIndex();

  if (pack.index.size > 0) {
    // Sync img, description and maxRank from catalogue.
    // Match by _id first; fall back to name so compendiums that were
    // populated before stable IDs were introduced still get updated.
    const byId   = new Map(ABILITY_CATALOGUE.map((a) => [a._id,   a]));
    const byName = new Map(ABILITY_CATALOGUE.map((a) => [a.name,  a]));
    const toUpdate = [];
    for (const entry of pack.index) {
      const cat = byId.get(entry._id) ?? byName.get(entry.name);
      if (!cat) continue;
      toUpdate.push({
        _id: entry._id,
        img: cat.img,
        'system.maxRank': cat.system.maxRank,
        'system.description': cat.system.description,
      });
    }
    if (toUpdate.length > 0) {
      await pack.configure({ locked: false });
      try {
        await Item.updateDocuments(toUpdate, { pack: PACK_ID });
        console.log(`Cyberpunk Blue | Abilities compendium synced: ${toUpdate.length} entries updated.`);
      } finally {
        await pack.configure({ locked: true });
      }
    }
    return;
  }

  console.log('Cyberpunk Blue | Populating abilities compendium…');
  await pack.configure({ locked: false });
  try {
    const cleaned = ABILITY_CATALOGUE.map((a) => {
      const copy = foundry.utils.deepClone(a);
      // Keep _id so the UUID links in wizard code remain stable
      return copy;
    });
    const docs = await Item.createDocuments(cleaned, { pack: PACK_ID });
    console.log(`Cyberpunk Blue | Abilities compendium populated: ${docs.length} abilities.`);
    if (docs.length > 0) ui.notifications.info(`Cyberpunk Blue: Abilities catalogue imported (${docs.length} abilities).`);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to populate abilities compendium:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Lifepath table catalogue ─────────────────────────────────────────────────

async function _ensureRollTableFolderInPack(pack, name) {
  const existing = pack.folders.find((f) => f.name === name);
  if (existing) return existing;
  return Folder.create({ name, type: 'RollTable', sorting: 'a', color: null }, { pack: pack.collection });
}

async function ensureLifepathCatalogue() {
  if (!game.user.isGM) return;
  const PACK_ID = 'cyberpunk-blue.lifepath-tables';
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | Lifepath tables compendium not found — skipping auto-populate.');
    return;
  }
  await pack.getIndex();

  // ── Cleanup pass ──────────────────────────────────────────────────────────
  // Earlier builds had 15-char _ids (GenLp0100000000) which Foundry rejected
  // with a DataModelValidationError and replaced with auto-generated random IDs
  // on each world load, creating duplicate tables.  Purge any table whose name
  // matches a catalogue entry but whose _id doesn't match the expected value.
  {
    const expectedIds   = new Set(LIFEPATH_CATALOGUE.map((t) => t._id));
    const catalogueNames = new Set(LIFEPATH_CATALOGUE.map((t) => t.name));
    const orphanIds = [...pack.index]
      .filter((e) => catalogueNames.has(e.name) && !expectedIds.has(e._id))
      .map((e) => e._id);
    if (orphanIds.length > 0) {
      console.log(`Cyberpunk Blue | Removing ${orphanIds.length} orphan lifepath table(s) (stale duplicate IDs)…`);
      await pack.configure({ locked: false });
      try { await RollTable.deleteDocuments(orphanIds, { pack: PACK_ID }); }
      finally { await pack.configure({ locked: true }); }
      await pack.getIndex(); // refresh after deletion
    }
  }

  // Find catalogue entries missing from the pack by _id.
  // This correctly handles partially-populated folders (including an empty
  // "General Lifepath" folder that already exists but has no tables yet).
  const existingIds = new Set(pack.index.map((e) => e._id));
  const toCreate = LIFEPATH_CATALOGUE.filter((t) => !existingIds.has(t._id));

  if (toCreate.length === 0) return; // already up to date

  console.log(`Cyberpunk Blue | Adding ${toCreate.length} missing lifepath table(s) to compendium…`);

  // Group only the missing tables by folder
  const byFolder = new Map();
  for (const table of toCreate) {
    const folderName = table._folder ?? 'General Lifepath';
    if (!byFolder.has(folderName)) byFolder.set(folderName, []);
    byFolder.get(folderName).push(table);
  }

  let created = 0;
  await pack.configure({ locked: false });
  try {
    for (const [folderName, tables] of byFolder) {
      const folder = await _ensureRollTableFolderInPack(pack, folderName);
      const cleaned = tables.map((t) => {
        const copy = foundry.utils.deepClone(t);
        delete copy._folder;
        delete copy._subTable;
        copy.folder = folder?.id ?? null;
        return copy;
      });
      const docs = await RollTable.createDocuments(cleaned, { pack: PACK_ID });
      created += docs.length;
    }
    console.log(`Cyberpunk Blue | Lifepath tables compendium updated: ${created} tables added.`);
    if (created > 0) ui.notifications.info(`Cyberpunk Blue: Added ${created} lifepath tables to compendium.`);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to populate lifepath tables compendium:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Sync role lifepath links to actual compendium UUIDs ─────────────────────

async function syncRoleLifepathLinks() {
  if (!game.user.isGM) return;
  const LP_PACK_ID = 'cyberpunk-blue.lifepath-tables';
  const ROLE_PACK_ID = 'cyberpunk-blue.roles';
  const lpPack = game.packs.get(LP_PACK_ID);
  const rolePack = game.packs.get(ROLE_PACK_ID);
  if (!lpPack || !rolePack) return;

  // Build (folderName, tableName) → UUID map keyed as "Folder::Name"
  await lpPack.getIndex();
  if (lpPack.index.size === 0) return;

  // Map folder _id → folder name
  const folderIdToName = new Map(lpPack.folders.map((f) => [f.id, f.name]));

  const keyToUUID = new Map();
  for (const entry of lpPack.index) {
    const folderName = folderIdToName.get(entry.folder) ?? '';
    const key = `${folderName}::${entry.name}`;
    keyToUUID.set(key, `Compendium.${LP_PACK_ID}.RollTable.${entry._id}`);
  }

  // Build role → ordered table names from LIFEPATH_CATALOGUE
  const roleToTables = new Map();
  for (const table of LIFEPATH_CATALOGUE) {
    const role = table._folder ?? 'General';
    if (!roleToTables.has(role)) roleToTables.set(role, []);
    roleToTables.get(role).push(table.name);
  }

  // Update each role document in the compendium
  await rolePack.getIndex();
  const toUpdate = [];
  for (const entry of rolePack.index) {
    const tableNames = roleToTables.get(entry.name);
    if (!tableNames?.length) continue;
    const links = tableNames
      .map((name) => {
        const uuid = keyToUUID.get(`${entry.name}::${name}`);
        return uuid ? `<li>@UUID[${uuid}]{${name}}</li>` : `<li>${name}</li>`;
      })
      .join('\n');
    toUpdate.push({ _id: entry._id, 'system.lifepathLinks': `<ul>\n${links}\n</ul>` });
  }

  if (toUpdate.length === 0) return;
  await rolePack.configure({ locked: false });
  try {
    await Item.updateDocuments(toUpdate, { pack: ROLE_PACK_ID });
    console.log(`Cyberpunk Blue | Synced lifepath links for ${toUpdate.length} roles.`);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to sync role lifepath links:', err);
  } finally {
    await rolePack.configure({ locked: true });
  }
}

// ─── Macro catalogue ─────────────────────────────────────────────────────────

async function _ensureMacroFolderInPack(pack, name) {
  const existing = pack.folders.find((f) => f.name === name);
  if (existing) return existing;
  return Folder.create({ name, type: 'Macro', sorting: 'a', color: null }, { pack: pack.collection });
}

async function ensureMacroCatalogue() {
  if (!game.user.isGM) return;
  const PACK_ID = 'cyberpunk-blue.macros';
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | Macros compendium not found — skipping auto-populate.');
    return;
  }
  await pack.getIndex();

  // Sync commands for already-existing macros (keeps scripts up to date after edits).
  const existingByName = new Map(pack.index.map((e) => [e.name, e]));
  const toUpdate = [];
  for (const item of MACRO_CATALOGUE) {
    const entry = existingByName.get(item.name);
    if (!entry) continue;
    const doc = await pack.getDocument(entry._id);
    if (doc && doc.command !== item.command) {
      toUpdate.push({ _id: entry._id, command: item.command });
    }
  }
  if (toUpdate.length) {
    await pack.configure({ locked: false });
    try {
      await Macro.updateDocuments(toUpdate, { pack: PACK_ID });
      console.log(`Cyberpunk Blue | Updated ${toUpdate.length} macro script(s) in compendium.`);
    } finally {
      await pack.configure({ locked: true });
    }
  }

  // Build a set of existing macro names so we only create missing ones.
  const existingNames = new Set(pack.index.map((e) => e.name));
  const missing = MACRO_CATALOGUE.filter((item) => !existingNames.has(item.name));
  if (!missing.length) return; // all macros present

  console.log(`Cyberpunk Blue | Adding ${missing.length} missing macro(s) to compendium…`);
  const byFolder = new Map();
  for (const item of missing) {
    const folderName = item._folder ?? 'General';
    if (!byFolder.has(folderName)) byFolder.set(folderName, []);
    byFolder.get(folderName).push(item);
  }

  let created = 0;
  await pack.configure({ locked: false });
  try {
    for (const [folderName, group] of byFolder.entries()) {
      const folder = await _ensureMacroFolderInPack(pack, folderName);
      const cleaned = group.map((item) => {
        const copy = foundry.utils.deepClone(item);
        delete copy._folder;
        copy.folder = folder?.id ?? null;
        return copy;
      });
      const docs = await Macro.createDocuments(cleaned, { pack: PACK_ID });
      created += docs.length;
    }
    console.log(`Cyberpunk Blue | Macros compendium updated: ${created} macro(s) added.`);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to add macros to compendium:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Critical Injury: chat card remove button ────────────────────────────────

Hooks.on('renderChatMessageHTML', (message, html) => {
  // html is already an HTMLElement in Foundry V13+
  const el = html instanceof HTMLElement ? html : html[0];
  if (!el) return;

  el.querySelectorAll('.remove-critical-injury').forEach((btn) => {
    // Hide the button for non-GMs
    if (!game.user.isGM) {
      btn.style.display = 'none';
      return;
    }
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      const actorId = btn.dataset.actorId;
      const effectId = btn.dataset.effectId;
      if (!actorId || !effectId) return;

      const actor = game.actors.get(actorId);
      if (!actor) {
        ui.notifications.warn(game.i18n.localize('CYBER_BLUE.CriticalInjury.ActorNotFound'));
        return;
      }

      const effect = actor.effects.get(effectId);
      if (!effect) {
        ui.notifications.warn(game.i18n.localize('CYBER_BLUE.CriticalInjury.EffectNotFound'));
        return;
      }

      await effect.delete();
      ui.notifications.info(
        game.i18n.format('CYBER_BLUE.CriticalInjury.EffectRemoved', { name: effect.name, actor: actor.name })
      );
    });
  });
});

// Re-export tracker helpers for external use (e.g., actor sheet context)
export { getTurnState, recordCombatAttack, getActiveCombatant, getCombatantForToken, markSpotWeaknessUsed, markDamageDeflectionUsed };

// ─── Auto-create characters for new players ───────────────────────────────────

/**
 * For every non-GM user who has no owned character actor, create one and
 * assign ownership to that user. The character starts in CC-active state
 * so the wizard opens automatically for them.
 *
 * Called by the GM during the ready hook.
 */
async function ensurePlayerCharacters() {
  const nonGmUsers = game.users.filter((u) => !u.isGM && u.active !== false);
  for (const user of nonGmUsers) {
    const hasCharacter = game.actors.some(
      (a) => a.type === 'character' && a.getUserLevel(user) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );
    if (hasCharacter) continue;

    // Create a character for this user
    const actorData = {
      name: user.name,
      type: 'character',
      ownership: {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      },
      system: {
        characterCreation: { active: true, step: 'welcome' },
      },
    };
    await Actor.create(actorData);
    console.log(`Cyberpunk Blue | Created character for user "${user.name}".`);
  }
}
