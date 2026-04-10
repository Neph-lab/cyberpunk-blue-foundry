export const CYBERWARE_DISABLE_FLAG = 'cyberwareDisable';
export const CYBERWARE_DISABLE_EFFECT_STATE_FLAG = 'cyberwareDisableEffectState';
const PSYCHE_LOSS_EFFECT_FLAG = 'autoPsycheLoss';

export const CYBERWARE_DISABLE_CHANGE_KEYS = Object.freeze({
  name: 'cyberblue.disableCyberware.name',
  type: 'cyberblue.disableCyberware.type',
  random: 'cyberblue.disableCyberware.random',
  randomType: 'cyberblue.disableCyberware.randomType',
});

function splitTokens(value) {
  return `${value ?? ''}`
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeName(value) {
  return `${value ?? ''}`.trim().toLowerCase();
}

function normalizeType(value) {
  const token = `${value ?? ''}`.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!token) {
    return null;
  }

  for (const type of CONFIG.CYBER_BLUE.cyberware?.types ?? []) {
    const candidates = [type.value, type.label]
      .filter(Boolean)
      .map((entry) => `${entry}`.trim().toLowerCase().replace(/[\s_-]+/g, ''));
    if (candidates.includes(token)) {
      return type.value;
    }
  }

  return null;
}

function parsePositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(`${value ?? ''}`.trim(), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function shuffle(items) {
  const pool = [...items];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool;
}

function getInstalledCyberware(actor) {
  if (!(actor instanceof Actor)) {
    return [];
  }

  return actor.items.contents.filter((item) => item.type === 'cyberware' && item.system.installed !== false);
}

function getActorCyberwareSignature(actor) {
  return getInstalledCyberware(actor)
    .map((item) => `${item.id}:${normalizeName(item.name)}:${item.system.cyberwareType ?? ''}`)
    .sort()
    .join('|');
}

function parseRandomTypeEntries(value) {
  return splitTokens(value).flatMap((entry) => {
    const [rawType, rawCount] = entry.split(':').map((part) => part.trim());
    const type = normalizeType(rawType);
    if (!type) {
      return [];
    }

    return [{
      type,
      count: parsePositiveInteger(rawCount, 1),
    }];
  });
}

function summarizeRule(rule) {
  switch (rule.mode) {
    case 'name':
      return game.i18n.localize('CYBER_BLUE.Cyberware.Disable.Rule.ByName');
    case 'type':
      return game.i18n.localize('CYBER_BLUE.Cyberware.Disable.Rule.ByType');
    case 'random':
      return game.i18n.localize('CYBER_BLUE.Cyberware.Disable.Rule.Random');
    case 'randomType':
      return game.i18n.localize('CYBER_BLUE.Cyberware.Disable.Rule.RandomType');
    default:
      return rule.mode;
  }
}

export function getCyberwareDisableRules(effect) {
  const changes = effect?.system?.changes ?? [];
  const rules = [];

  for (const change of changes) {
    switch (change.key) {
      case CYBERWARE_DISABLE_CHANGE_KEYS.name: {
        const names = splitTokens(change.value).map(normalizeName).filter(Boolean);
        if (names.length) {
          rules.push({ mode: 'name', names });
        }
        break;
      }
      case CYBERWARE_DISABLE_CHANGE_KEYS.type: {
        const types = splitTokens(change.value).map(normalizeType).filter(Boolean);
        if (types.length) {
          rules.push({ mode: 'type', types });
        }
        break;
      }
      case CYBERWARE_DISABLE_CHANGE_KEYS.random: {
        rules.push({
          mode: 'random',
          count: parsePositiveInteger(change.value, 1),
        });
        break;
      }
      case CYBERWARE_DISABLE_CHANGE_KEYS.randomType: {
        const entries = parseRandomTypeEntries(change.value);
        if (entries.length) {
          rules.push({
            mode: 'randomType',
            entries,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return rules;
}

function pickRandomIds(candidates, count) {
  return shuffle(candidates)
    .slice(0, Math.min(count, candidates.length))
    .map((item) => item.id);
}

export function resolveCyberwareDisableSelections(actor, effect, { forceReroll = false } = {}) {
  const rules = getCyberwareDisableRules(effect);
  const installed = getInstalledCyberware(actor);
  const signature = getActorCyberwareSignature(actor);
  const stored = effect?.getFlag('cyberpunk-blue', CYBERWARE_DISABLE_FLAG) ?? {};
  const keepStored = !forceReroll && stored.signature === signature;
  const disabledIds = new Set();

  for (const rule of rules) {
    if (rule.mode === 'name') {
      for (const item of installed) {
        if (rule.names.includes(normalizeName(item.name))) {
          disabledIds.add(item.id);
        }
      }
    }

    if (rule.mode === 'type') {
      for (const item of installed) {
        if (rule.types.includes(item.system.cyberwareType)) {
          disabledIds.add(item.id);
        }
      }
    }
  }

  const randomIds = [];
  const randomTypeSelections = [];
  const availableIds = new Set(installed.filter((item) => !disabledIds.has(item.id)).map((item) => item.id));

  for (const rule of rules) {
    if (rule.mode === 'random') {
      const candidates = installed.filter((item) => availableIds.has(item.id));
      const keptIds = keepStored
        ? (stored.randomIds ?? []).filter((id) => availableIds.has(id))
        : [];
      const nextIds = keptIds.length >= rule.count
        ? keptIds.slice(0, rule.count)
        : [
          ...keptIds,
          ...pickRandomIds(
            candidates.filter((item) => !keptIds.includes(item.id)),
            rule.count - keptIds.length
          ),
        ];

      for (const id of nextIds) {
        disabledIds.add(id);
        availableIds.delete(id);
      }

      randomIds.push(...nextIds);
    }

    if (rule.mode === 'randomType') {
      for (const entry of rule.entries) {
        const candidates = installed.filter((item) => availableIds.has(item.id) && item.system.cyberwareType === entry.type);
        const keptIds = keepStored
          ? (stored.randomTypeSelections ?? [])
            .find((selection) => selection.type === entry.type)?.ids
            ?.filter((id) => availableIds.has(id)) ?? []
          : [];
        const nextIds = keptIds.length >= entry.count
          ? keptIds.slice(0, entry.count)
          : [
            ...keptIds,
            ...pickRandomIds(
              candidates.filter((item) => !keptIds.includes(item.id)),
              entry.count - keptIds.length
            ),
          ];

        for (const id of nextIds) {
          disabledIds.add(id);
          availableIds.delete(id);
        }

        randomTypeSelections.push({
          type: entry.type,
          ids: nextIds,
        });
      }
    }
  }

  return {
    disabledIds: [...disabledIds],
    rules,
    flagData: {
      signature,
      randomIds,
      randomTypeSelections,
    },
  };
}

export function getActorCyberwareDisableState(actor) {
  const byItemId = new Map();

  if (!(actor instanceof Actor)) {
    return { byItemId, effects: [] };
  }

  for (const effect of actor.effects.contents) {
    if (effect.disabled) {
      continue;
    }

    const resolution = resolveCyberwareDisableSelections(actor, effect);
    if (!resolution.rules.length || !resolution.disabledIds.length) {
      continue;
    }

    const summary = resolution.rules.map(summarizeRule);
    for (const itemId of resolution.disabledIds) {
      const existing = byItemId.get(itemId) ?? {
        effectIds: [],
        effectNames: [],
        summaries: [],
      };

      existing.effectIds.push(effect.id);
      existing.effectNames.push(effect.name);
      existing.summaries.push(...summary);
      byItemId.set(itemId, existing);
    }
  }

  for (const entry of byItemId.values()) {
    entry.effectNames = [...new Set(entry.effectNames)];
    entry.summaries = [...new Set(entry.summaries)];
    entry.tooltip = game.i18n.format('CYBER_BLUE.Cyberware.Disable.ByEffects', {
      effects: entry.effectNames.join(', '),
    });
  }

  return { byItemId };
}

export async function syncActorCyberwareDisableEffects(actor, options = {}) {
  if (!(actor instanceof Actor)) {
    return;
  }

  const updates = [];

  for (const effect of actor.effects.contents) {
    const rules = getCyberwareDisableRules(effect);
    const currentFlag = effect.getFlag('cyberpunk-blue', CYBERWARE_DISABLE_FLAG) ?? null;

    if (!rules.length || effect.disabled) {
      if (currentFlag) {
        updates.push({
          _id: effect.id,
          [`flags.cyberpunk-blue.${CYBERWARE_DISABLE_FLAG}`]: null,
        });
      }
      continue;
    }

    const resolution = resolveCyberwareDisableSelections(actor, effect, {
      forceReroll: options.forceCyberBlueCyberwareDisableReroll === true,
    });

    if (!foundry.utils.isEmpty(foundry.utils.diffObject(currentFlag ?? {}, resolution.flagData))) {
      updates.push({
        _id: effect.id,
        [`flags.cyberpunk-blue.${CYBERWARE_DISABLE_FLAG}`]: resolution.flagData,
      });
    }
  }

  if (updates.length) {
    await actor.updateEmbeddedDocuments('ActiveEffect', updates, {
      ...options,
      cyberBlueSyncCyberwareDisable: true,
    });
  }

  await syncDisabledCyberwareItemEffects(actor, options);
}

export async function syncDisabledCyberwareItemEffects(actor, options = {}) {
  if (!(actor instanceof Actor)) {
    return;
  }

  const disableState = getActorCyberwareDisableState(actor);

  for (const item of actor.items.contents.filter((entry) => entry.type === 'cyberware')) {
    const shouldDisable = disableState.byItemId.has(item.id);
    const updates = [];

    for (const effect of item.effects.contents) {
      if (effect.getFlag('cyberpunk-blue', PSYCHE_LOSS_EFFECT_FLAG)) {
        continue;
      }

      const overrideState = effect.getFlag('cyberpunk-blue', CYBERWARE_DISABLE_EFFECT_STATE_FLAG) ?? null;
      if (shouldDisable) {
        if (effect.disabled !== true || overrideState?.active !== true) {
          updates.push({
            _id: effect.id,
            disabled: true,
            [`flags.cyberpunk-blue.${CYBERWARE_DISABLE_EFFECT_STATE_FLAG}`]: {
              active: true,
              previousDisabled: effect.disabled === true,
            },
          });
        }
        continue;
      }

      if (overrideState?.active === true) {
        updates.push({
          _id: effect.id,
          disabled: overrideState.previousDisabled === true,
          [`flags.cyberpunk-blue.${CYBERWARE_DISABLE_EFFECT_STATE_FLAG}`]: null,
        });
      }
    }

    if (updates.length) {
      await item.updateEmbeddedDocuments('ActiveEffect', updates, {
        ...options,
        cyberBlueSyncCyberwareDisableItemEffects: true,
      });
    }
  }
}
