import { CyberBlueActor } from './documents/actor.mjs';
import { CyberBlueItem } from './documents/item.mjs';
import { CyberBlueActorSheet } from './sheets/actor-sheet.mjs';
import { CyberBlueItemSheet } from './sheets/item-sheet.mjs';
import { CyberBlueMookSheet } from './sheets/mook-sheet.mjs';
import { CyberBlueProgramSheet } from './sheets/program-sheet.mjs';
import { CyberBlueVehicleSheet } from './sheets/vehicle-sheet.mjs';
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
import { syncActorLeaderRoles } from './helpers/roles.mjs';
import { CyberBlueJsonImportDialog, CyberBlueMacroCreator } from './helpers/gm-tools.mjs';
import { CharacterCreationWizard } from './helpers/character-creation.mjs';
import {
  recordCombatAttack,
  getCombatAttackState,
  combatAttackTracker,
  recordMovement,
  getMovementUsed,
  combatMovementTracker,
  resetTurnTracking,
  resetAllTracking,
} from './helpers/combat-tracker.mjs';
import * as models from './data/_module.mjs';
import { CRITICAL_INJURY_FLAG, buildCritBodyTableData, buildCritHeadTableData } from './helpers/critical-injury.mjs';

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
    types: ['role', 'ability', 'cyberware', 'gear', 'ammo', 'programExecutable', 'mod'],
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
  if (!game.user.isGM) {
    return;
  }

  await ensureCritInjuryTables();

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

// ─── Combat: movement & RoF tracking hooks ──────────────────────────────────

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

Hooks.on('preUpdateToken', (tokenDoc, changes, options, userId) => {
  if (!game.combat?.started) return;
  if (game.users.get(userId)?.isGM) return;
  if (!('x' in changes) && !('y' in changes)) return;
  if (tokenDoc.id !== getActiveCombatantTokenId()) return;

  const actor = tokenDoc.actor;
  if (!actor) return;
  const moveValue = Math.max(Number(actor.system?.stats?.move?.value) || 0, 0);
  if (moveValue === 0) return;

  const maxMeters = moveValue * 2;
  const used = getMovementUsed(tokenDoc.id);
  const ppm = getPixelsPerMeterGlobal();
  const proposedMeters = Math.hypot(
    (changes.x ?? tokenDoc.x) - tokenDoc.x,
    (changes.y ?? tokenDoc.y) - tokenDoc.y
  ) / ppm;

  if (used + proposedMeters > maxMeters + 0.01) {
    const remaining = Math.max(maxMeters - used, 0).toFixed(1);
    ui.notifications.warn(
      game.i18n.format('CYBER_BLUE.Combat.MovementLimitReached', { max: maxMeters, remaining })
    );
    return false;
  }
});

Hooks.on('updateToken', (tokenDoc, changes, _options, _userId) => {
  if (!game.combat?.started) return;
  if (!('x' in changes) && !('y' in changes)) return;
  if (tokenDoc.id !== getActiveCombatantTokenId()) return;

  const ppm = getPixelsPerMeterGlobal();
  // tokenDoc now holds the NEW values; _source holds the PRE-update values
  const oldX = tokenDoc._source?.x ?? tokenDoc.x;
  const oldY = tokenDoc._source?.y ?? tokenDoc.y;
  const meters = Math.hypot((changes.x ?? oldX) - oldX, (changes.y ?? oldY) - oldY) / ppm;
  recordMovement(tokenDoc.id, meters);
});

Hooks.on('combatTurn', (combat) => {
  const prev = combat.combatants.get(combat.previous?.combatantId);
  if (prev?.tokenId) resetTurnTracking(prev.tokenId);
  const curr = combat.combatants.get(combat.current?.combatantId);
  if (curr?.tokenId) resetTurnTracking(curr.tokenId);
});

Hooks.on('combatRound', () => resetAllTracking());

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
  if (index.size >= 2) return; // already populated

  console.log('Cyberpunk Blue | Populating critical injury tables compendium…');
  try {
    // Unlock the system pack temporarily so we can write into it
    await pack.configure({ locked: false });
    await RollTable.create(buildCritBodyTableData(), { pack: PACK_ID });
    await RollTable.create(buildCritHeadTableData(), { pack: PACK_ID });
    console.log('Cyberpunk Blue | Critical injury tables created in compendium.');
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to create critical injury tables:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ─── Critical Injury: chat card remove button ────────────────────────────────

Hooks.on('renderChatMessage', (message, html) => {
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
