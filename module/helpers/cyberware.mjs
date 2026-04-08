const PSYCHE_LOSS_PATTERN = /^\s*(\d+)d6(?:\s*([+-])\s*(\d+))?(?:\s*\/\s*2)?\s*$/i;

export function parsePsycheLossFormula(formula = '') {
  const text = `${formula}`.trim();
  const match = text.match(PSYCHE_LOSS_PATTERN);
  if (!match) {
    return {
      formula: text,
      valid: false,
      diceCount: 0,
      modifier: 0,
      halve: false,
      suggested: 0,
      maxReduction: 0,
      rollFormula: '',
    };
  }

  const diceCount = Number.parseInt(match[1], 10) || 0;
  const modifierValue = Number.parseInt(match[3] ?? '0', 10) || 0;
  const modifier = match[2] === '-' ? -modifierValue : modifierValue;
  const halve = /\/\s*2\s*$/i.test(text);
  const average = (diceCount * 3.5) + modifier;
  const suggested = Math.max(Math.ceil(halve ? average / 2 : average), 0);
  const rollFormula = `${diceCount}d6${modifier ? `${modifier > 0 ? '+' : '-'}${Math.abs(modifier)}` : ''}`;

  return {
    formula: text,
    valid: true,
    diceCount,
    modifier,
    halve,
    suggested,
    maxReduction: diceCount,
    rollFormula,
  };
}

export function getCyberwareEntries(actor, { pendingItemId = null, pendingSystem = null } = {}) {
  const entries = actor.items.contents
    .filter((item) => item.type === 'cyberware')
    .map((item) => ({
      id: item.id,
      name: item.name,
      item,
      system: foundry.utils.deepClone(item.system),
    }));

  if (!pendingItemId) {
    return entries;
  }

  const pendingIndex = entries.findIndex((entry) => entry.id === pendingItemId);
  if (pendingIndex >= 0) {
    entries[pendingIndex].system = foundry.utils.deepClone(pendingSystem);
    return entries;
  }

  entries.push({
    id: pendingItemId,
    name: pendingSystem?.name ?? '',
    item: null,
    system: foundry.utils.deepClone(pendingSystem ?? {}),
  });
  return entries;
}

export function getPlatformUsage(entries, { excludedItemId = null } = {}) {
  const usage = new Map();

  for (const entry of entries) {
    if (entry.id === excludedItemId) {
      continue;
    }

    if (entry.system.integration !== 'extension' || !entry.system.parentCyberwareId) {
      continue;
    }

    const current = usage.get(entry.system.parentCyberwareId) ?? 0;
    usage.set(entry.system.parentCyberwareId, current + (entry.system.slotsUsed ?? 0));
  }

  return usage;
}

export function getEligiblePlatforms(actor, currentItemId, system) {
  const entries = getCyberwareEntries(actor);
  const slotUsage = getPlatformUsage(entries, { excludedItemId: currentItemId });

  return entries
    .filter((entry) => entry.id !== currentItemId)
    .filter((entry) => entry.system.integration === 'platform')
    .filter((entry) => entry.system.cyberwareType === system.cyberwareType)
    .map((entry) => {
      const usedSlots = slotUsage.get(entry.id) ?? 0;
      const freeSlots = Math.max((entry.system.slotsProvided ?? 0) - usedSlots, 0);
      return {
        id: entry.id,
        name: entry.name,
        freeSlots,
        slotsProvided: entry.system.slotsProvided ?? 0,
        isSelected: entry.id === system.parentCyberwareId,
      };
    })
    .filter((entry) => entry.freeSlots >= (system.slotsUsed ?? 0) || entry.isSelected)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function validateCyberwareConfiguration(actor, { itemId = null, itemName = '', system } = {}) {
  const entries = getCyberwareEntries(actor, {
    pendingItemId: itemId ?? '__pending__',
    pendingSystem: system,
  });
  const normalizedName = `${itemName}`.trim().toLowerCase();

  if (!system.multipleInstalls && normalizedName) {
    const duplicate = entries.find((entry) => {
      if (entry.id === itemId) {
        return false;
      }
      return `${entry.name}`.trim().toLowerCase() === normalizedName
        && entry.system.cyberwareType === system.cyberwareType
        && !entry.system.multipleInstalls;
    });

    if (duplicate) {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.DuplicateInstall'),
      };
    }
  }

  for (const entry of entries) {
    if (entry.system.integration !== 'extension') {
      continue;
    }

    if (!entry.system.parentCyberwareId) {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.MissingPlatform'),
      };
    }

    const platform = entries.find((candidate) => candidate.id === entry.system.parentCyberwareId);
    if (!platform) {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.InvalidPlatform'),
      };
    }

    if (platform.system.integration !== 'platform') {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.PlatformRequired'),
      };
    }

    if (platform.system.cyberwareType !== entry.system.cyberwareType) {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.TypeMismatch'),
      };
    }
  }

  const slotUsage = getPlatformUsage(entries);
  for (const [platformId, usedSlots] of slotUsage.entries()) {
    const platform = entries.find((entry) => entry.id === platformId);
    if (!platform) {
      continue;
    }

    if (usedSlots > (platform.system.slotsProvided ?? 0)) {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.NotEnoughSlots'),
      };
    }
  }

  return { valid: true };
}
