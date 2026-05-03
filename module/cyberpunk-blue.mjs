import { CyberBlueActor } from './documents/actor.mjs';
import { CyberBlueItem } from './documents/item.mjs';
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
import { syncActorLeaderRoles } from './helpers/roles.mjs';
import { CyberBlueJsonImportDialog, CyberBlueMacroCreator, CyberBlueWeaponImportDialog } from './helpers/gm-tools.mjs';
import { CharacterCreationWizard } from './helpers/character-creation.mjs';
import {
  recordCombatAttack,
  getCombatAttackState,
  combatAttackTracker,
  recordMovement,
  getMovementUsed,
  combatMovementTracker,
  combatActionTracker,
  getActionState,
  markMainActionUsed,
  grantActionMove,
  resetTurnTracking,
  resetAllTracking,
} from './helpers/combat-tracker.mjs';
import * as models from './data/_module.mjs';
import { CRITICAL_INJURY_FLAG, buildCritBodyTableData, buildCritHeadTableData } from './helpers/critical-injury.mjs';
import { MACRO_CATALOGUE } from './helpers/critical-injury-macros.mjs';
import { WEAPON_CATALOGUE } from './data/weapon-catalogue.mjs';
import { MOD_CATALOGUE } from './data/mod-catalogue.mjs';
import { EQUIPMENT_CATALOGUE } from './data/equipment-catalogue.mjs';
import { CYBERWARE_CATALOGUE } from './data/cyberware-catalogue.mjs';
import { DRUG_CATALOGUE } from './data/drug-catalogue.mjs';
import { PROGRAM_CATALOGUE } from './data/program-catalogue.mjs';
import { AMMO_CATALOGUE } from './data/ammo-catalogue.mjs';
import { registerSocketHandlers } from './helpers/socket.mjs';

Hooks.once('init', function () {
  game.cyberpunkblue = {
    CyberBlueActor,
    CyberBlueItem,
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
    },
  };

  CONFIG.CYBER_BLUE = CYBER_BLUE;
  CONFIG.Combat.initiative = {
    formula: '1d10 + @stats.rflx.value',
    decimals: 0,
  };

  CONFIG.Actor.documentClass = CyberBlueActor;
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
  };

  CONFIG.ActiveEffect.legacyTransferral = false;

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
    types: ['role', 'ability', 'cyberware', 'gear', 'ammo', 'programExecutable', 'drug', 'mod'],
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

Hooks.once('ready', async () => {
  // Register socket handlers for all users (handler itself checks isGM where needed)
  registerSocketHandlers();

  if (!game.user.isGM) {
    return;
  }

  await ensureCritInjuryTables();
  await migrateCostStrings();
  await ensureWeaponCatalogue();
  await ensureAmmoCatalogue();
  await ensureEquipmentCatalogue();
  await ensureMacroCatalogue();

  const seen = new Set();
  const cyberwareItems = [
    ...game.items.contents,
    ...game.actors.contents.flatMap((actor) => actor.items.contents),
  ].filter((item) => item instanceof CyberBlueItem && item.type === 'cyberware')
    .filter((item) => {
      if (seen.has(item.uuid)) {
        return false;
      }
      seen.add(item.uuid);
      return true;
    });

  for (const item of cyberwareItems) {
    await item.syncCyberwarePsycheLossEffect({ cyberBlueSyncPsycheLoss: true });
    await item.syncCyberwareOperationalEffects({ cyberBlueSyncOperationalEffects: true });
  }

  for (const actor of game.actors.contents) {
    await syncActorCyberwareDisableEffects(actor, { cyberBlueSyncCyberwareDisable: true });
    await syncActorLeaderRoles(actor);
    await syncPsycheStateEffect(actor, { cyberBlueSyncPsycheState: false });
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

function getPixelsPerMeterGlobal() {
  const gridSize = canvas?.grid?.size ?? 100;
  const gridDistance = canvas?.scene?.grid?.distance ?? 2;
  const gridUnits = (canvas?.scene?.grid?.units ?? '').toLowerCase().trim();
  const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
  return gridSize / metersPerUnit;
}

function getActiveCombatantTokenId() {
  return game.combat?.combatants.get(game.combat?.current?.combatantId)?.tokenId ?? null;
}

/** Total movement budget in meters for a token this turn (base + any Sprint grant). */
function getMovementBudget(tokenId, actor) {
  const moveValue = Math.max(Number(actor?.system?.stats?.move?.value) || 0, 0);
  const baseBudget = moveValue * 2;
  const actionState = getActionState(tokenId);
  return baseBudget + (actionState.extraMoveMeters ?? 0);
}

/**
 * Snap pixel coordinates to the nearest grid vertex.
 * Falls back to rounding to grid-size multiples when the Foundry API isn't available.
 */
function snapToGrid(x, y) {
  const gridSize = canvas?.grid?.size ?? 100;
  if (typeof canvas?.grid?.getSnappedPoint === 'function') {
    return canvas.grid.getSnappedPoint({ x, y });
  }
  return { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize };
}

// ── preUpdateToken: enforce turn restriction + budget (with truncation) ───────

Hooks.on('preUpdateToken', (tokenDoc, changes, options, userId) => {
  if (!game.combat?.started) return;
  if (!('x' in changes) && !('y' in changes)) return;

  const activeTokenId = getActiveCombatantTokenId();
  const isGM = game.users.get(userId)?.isGM ?? false;

  // ── Out-of-turn movement ──────────────────────────────────────────────────
  if (tokenDoc.id !== activeTokenId) {
    if (isGM) return; // GMs may reposition tokens freely
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.MovementOutsideTurn'));
    return false;
  }

  // ── Active combatant: enforce movement budget ─────────────────────────────
  const actor = tokenDoc.actor;
  if (!actor) return;

  const budget = getMovementBudget(tokenDoc.id, actor);
  if (budget <= 0) return; // no move stat — don't interfere

  const used = getMovementUsed(tokenDoc.id);
  const remaining = Math.max(budget - used, 0);
  const ppm = getPixelsPerMeterGlobal();

  const destX = changes.x ?? tokenDoc.x;
  const destY = changes.y ?? tokenDoc.y;
  const dx = destX - tokenDoc.x;
  const dy = destY - tokenDoc.y;
  const proposedMeters = Math.hypot(dx, dy) / ppm;

  if (proposedMeters <= 0.01) return; // negligible move — allow

  if (remaining < 0.01) {
    // Budget fully exhausted — block entirely
    ui.notifications.warn(
      game.i18n.format('CYBER_BLUE.Combat.MovementExhausted', { max: budget })
    );
    return false;
  }

  if (used + proposedMeters > budget + 0.01) {
    // Partial budget left — truncate movement along the same vector
    const allowedPixels = remaining * ppm;
    const totalPixels = Math.hypot(dx, dy);
    const fraction = allowedPixels / totalPixels;
    const snapped = snapToGrid(tokenDoc.x + dx * fraction, tokenDoc.y + dy * fraction);
    changes.x = snapped.x;
    changes.y = snapped.y;
    ui.notifications.warn(
      game.i18n.format('CYBER_BLUE.Combat.MovementTruncated', { remaining: remaining.toFixed(1) })
    );
    // Allow the update to proceed with the truncated coordinates
  }
});

// ── updateToken: record how far the active combatant actually moved ───────────

Hooks.on('updateToken', (tokenDoc, changes, _options, _userId) => {
  if (!game.combat?.started) return;
  if (!('x' in changes) && !('y' in changes)) return;
  if (tokenDoc.id !== getActiveCombatantTokenId()) return;

  const ppm = getPixelsPerMeterGlobal();
  const oldX = tokenDoc._source?.x ?? tokenDoc.x;
  const oldY = tokenDoc._source?.y ?? tokenDoc.y;
  const meters = Math.hypot((changes.x ?? oldX) - oldX, (changes.y ?? oldY) - oldY) / ppm;
  recordMovement(tokenDoc.id, meters);

  // Refresh the combat tracker panel so the movement bar updates in real-time
  ui.combat?.render(false);
});

// ── Combat turn / round resets ────────────────────────────────────────────────

Hooks.on('combatTurn', (combat) => {
  const prev = combat.combatants.get(combat.previous?.combatantId);
  if (prev?.tokenId) resetTurnTracking(prev.tokenId);
  const curr = combat.combatants.get(combat.current?.combatantId);
  if (curr?.tokenId) resetTurnTracking(curr.tokenId);
  ui.combat?.render(false);
});

Hooks.on('combatRound', () => {
  resetAllTracking();
  ui.combat?.render(false);
});

Hooks.on('deleteCombat', () => {
  resetAllTracking();
});

// ── Combat tracker panel: movement + action display ───────────────────────────

Hooks.on('renderCombatTracker', (app, htmlArg, _data) => {
  if (!game.combat?.started) return;

  // Support both Application (jQuery) and ApplicationV2 (HTMLElement)
  const root = htmlArg instanceof HTMLElement ? htmlArg : htmlArg[0];
  if (!root) return;

  // Remove any previous panel so re-renders don't duplicate it
  root.querySelectorAll('.cyber-blue-combat-panel').forEach((el) => el.remove());

  const activeTokenId = getActiveCombatantTokenId();
  if (!activeTokenId) return;

  const activeCombatant = game.combat.combatants.find((c) => c.tokenId === activeTokenId);
  const actor = activeCombatant?.actor;
  if (!actor) return;

  const moveValue = Math.max(Number(actor.system?.stats?.move?.value) || 0, 0);
  const budget = getMovementBudget(activeTokenId, actor);
  const used = getMovementUsed(activeTokenId);
  const remaining = Math.max(budget - used, 0);
  const pct = budget > 0 ? Math.min(100, (remaining / budget) * 100) : 0;

  const actionState = getActionState(activeTokenId);
  const attackMade = combatAttackTracker.has(activeTokenId);
  const actionUsed = actionState.mainActionUsed || attackMade;

  // Show Sprint button to: the GM (always), or the user who owns the active combatant
  const actionFree = !actionUsed && !actionState.actionMoveGranted;
  const ownsActiveCombatant = activeCombatant.isOwner;
  const canSprint = actionFree && ownsActiveCombatant;

  const sprintMeters = moveValue * 2;
  const sprintLabel = game.i18n.format('CYBER_BLUE.Combat.Panel.Sprint', { meters: sprintMeters });
  const sprintBtn = (canSprint && sprintMeters > 0)
    ? `<button type="button" class="cyber-blue-sprint-btn" title="${game.i18n.localize('CYBER_BLUE.Combat.Panel.SprintTitle')}">${sprintLabel}</button>`
    : '';

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
  `;

  // Wire up Sprint button
  panel.querySelector('.cyber-blue-sprint-btn')?.addEventListener('click', () => {
    grantActionMove(activeTokenId, sprintMeters);
    ui.combat?.render(false);
    ui.notifications.info(
      game.i18n.format('CYBER_BLUE.Combat.Panel.SprintGranted', { meters: sprintMeters })
    );
  });

  // Insert above the combat controls row; fall back to appending
  const controls = root.querySelector('.combat-controls');
  if (controls) {
    controls.before(panel);
  } else {
    root.querySelector('.directory-footer, form')?.append(panel)
      ?? root.append(panel);
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

    if (weaponChangesChanged || burstChanged || beginnerChanged || vitalsChanged) {
      updates.push({
        _id: doc.id,
        'system.weaponChanges': defSys.weaponChanges ?? [],
        'system.burstControlAmmoReduction': defSys.burstControlAmmoReduction ?? 0,
        'system.beginnerFriendly': !!defSys.beginnerFriendly,
        'system.targetVitalsPenaltyReduction': defSys.targetVitalsPenaltyReduction ?? 0,
      });
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

    if (countChanged || typeChanged || autofireDamageChanged) {
      updates.push({ _id: doc.id, 'system.weapons': catalogueWeapons });
    }
  }

  if (updates.length === 0) return;

  await pack.configure({ locked: false });
  try {
    await Item.updateDocuments(updates, { pack: PACK_ID });
    console.log(`Cyberpunk Blue | Updated weapon entries for ${updates.length} items in weapons pack.`);
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
    const existingNames = new Set(pack.index.filter((e) => e.type === 'ammo').map((e) => e.name));
    const missing = AMMO_CATALOGUE.filter((it) => !existingNames.has(it.name));
    if (missing.length === 0) return;

    await pack.configure({ locked: false });
    try {
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
    } finally {
      await pack.configure({ locked: true });
    }
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to sync ammo catalogue:', err);
  }
}

// ─── Equipment catalogue ──────────────────────────────────────────────────────

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

    const total = gCreated + cyCreated + dCreated + pCreated;
    if (total > 0) {
      console.log(`Cyberpunk Blue | Equipment catalogue imported: ${gCreated} gear, ${cyCreated} cyberware, ${dCreated} drugs, ${pCreated} programs.`);
      ui.notifications.info(`Cyberpunk Blue: Equipment catalogue imported (${total} items).`);
    }
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to import equipment catalogue:', err);
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
  if (pack.index.size > 0) return; // already populated

  console.log('Cyberpunk Blue | Populating macros compendium…');
  const byFolder = new Map();
  for (const item of MACRO_CATALOGUE) {
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
    console.log(`Cyberpunk Blue | Macros compendium populated: ${created} macros.`);
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to populate macros compendium:', err);
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
export { getCombatAttackState, recordCombatAttack };

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
