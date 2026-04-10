import { CyberBlueActor } from './documents/actor.mjs';
import { CyberBlueItem } from './documents/item.mjs';
import { CyberBlueActorSheet } from './sheets/actor-sheet.mjs';
import { CyberBlueItemSheet } from './sheets/item-sheet.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { CYBER_BLUE } from './helpers/config.mjs';
import { applyWeaponTypeDefaults, createWeaponData } from './helpers/combat.mjs';
import {
  CYBERWARE_DISABLE_CHANGE_KEYS,
  getActorCyberwareDisableState,
  resolveCyberwareDisableSelections,
  syncDisabledCyberwareItemEffects,
  syncActorCyberwareDisableEffects,
} from './helpers/cyberware-disable.mjs';
import { syncItemModificationEffects } from './helpers/mods.mjs';
import * as models from './data/_module.mjs';

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
  };

  CONFIG.Item.documentClass = CyberBlueItem;
  CONFIG.Item.dataModels = {
    role: models.CyberBlueRole,
    ability: models.CyberBlueAbility,
    cyberware: models.CyberBlueCyberware,
    gear: models.CyberBlueGear,
  };

  CONFIG.ActiveEffect.legacyTransferral = false;

  Actors.registerSheet('cyberpunk-blue', CyberBlueActorSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Actor',
    types: ['character', 'npc'],
  });

  Items.registerSheet('cyberpunk-blue', CyberBlueItemSheet, {
    makeDefault: true,
    label: 'CYBER_BLUE.SheetLabels.Item',
    types: ['role', 'ability', 'cyberware', 'gear'],
  });

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

const syncModificationEffects = (document, options = {}) => {
  if (options?.cyberBlueSyncModEffects) {
    return;
  }

  const item = document instanceof Item
    ? document
    : document?.parent instanceof Item
      ? document.parent
      : null;

  if (!(item instanceof CyberBlueItem) || !['gear', 'cyberware'].includes(item.type)) {
    return;
  }

  return syncItemModificationEffects(item, options);
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
Hooks.on('createItem', syncModificationEffects);
Hooks.on('updateItem', syncModificationEffects);
Hooks.on('createActiveEffect', syncModificationEffects);
Hooks.on('updateActiveEffect', syncModificationEffects);
Hooks.on('deleteActiveEffect', syncModificationEffects);
Hooks.on('createItem', syncCyberwareOperationalEffects);
Hooks.on('updateItem', syncCyberwareOperationalEffects);
Hooks.on('createActiveEffect', syncCyberwareOperationalEffects);
Hooks.on('updateActiveEffect', syncCyberwareOperationalEffects);
Hooks.on('deleteActiveEffect', syncCyberwareOperationalEffects);

Hooks.once('ready', async () => {
  if (!game.user.isGM) {
    return;
  }

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

  const modItems = [
    ...game.items.contents,
    ...game.actors.contents.flatMap((actor) => actor.items.contents),
  ].filter((item) => item instanceof CyberBlueItem && ['gear', 'cyberware'].includes(item.type))
    .filter((item) => {
      if (seen.has(`${item.uuid}-mods`)) {
        return false;
      }
      seen.add(`${item.uuid}-mods`);
      return true;
    });
  for (const item of modItems) {
    await syncItemModificationEffects(item, { cyberBlueSyncModEffects: true });
  }

  for (const actor of game.actors.contents) {
    await syncActorCyberwareDisableEffects(actor, { cyberBlueSyncCyberwareDisable: true });
  }
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
