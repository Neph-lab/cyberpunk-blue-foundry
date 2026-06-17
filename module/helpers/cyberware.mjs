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

// The platform(s) an extension occupies. A paired extension consumes its slots
// on BOTH assigned platforms; a normal extension only on its single parent.
export function getEntryPlatformIds(system) {
  if (system.integration !== 'extension') {
    return [];
  }
  const ids = [];
  if (system.parentCyberwareId) {
    ids.push(system.parentCyberwareId);
  }
  if (system.paired && system.parentCyberwareId2) {
    ids.push(system.parentCyberwareId2);
  }
  return ids;
}

// True when an extension has every platform it needs (one normally, two when
// paired). Non-extensions are trivially "connected". Used to decide whether an
// item renders in its installed group or in the Unconnected list, and mirrors
// CyberBlueItem#isUnconnectedExtension.
export function isExtensionFullyConnected(system) {
  if (system.integration !== 'extension') {
    return true;
  }
  if (!system.parentCyberwareId) {
    return false;
  }
  return !system.paired || Boolean(system.parentCyberwareId2);
}

export function getPlatformUsage(entries, { excludedItemId = null } = {}) {
  const usage = new Map();

  for (const entry of entries) {
    if (entry.id === excludedItemId) {
      continue;
    }

    const slots = entry.system.slotsUsed ?? 0;
    for (const platformId of getEntryPlatformIds(entry.system)) {
      usage.set(platformId, (usage.get(platformId) ?? 0) + slots);
    }
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

export async function promptForCyberwarePlatform(eligiblePlatforms) {
  if (!eligiblePlatforms.length) {
    return null;
  }

  if (eligiblePlatforms.length === 1) {
    return eligiblePlatforms[0].id;
  }

  const optionsMarkup = eligiblePlatforms.map((platform) => `
    <option value="${platform.id}">${platform.name} (${game.i18n.format('CYBER_BLUE.Cyberware.FreeSlots', {
      free: platform.freeSlots,
      total: platform.slotsProvided,
    })})</option>
  `).join('');

  return foundry.applications.api.DialogV2.prompt({
    window: {
      title: game.i18n.localize('CYBER_BLUE.Cyberware.PlatformAssignment'),
    },
    content: `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Platform')}</label>
          <select name="platformId">${optionsMarkup}</select>
        </div>
      </form>
    `,
    ok: {
      label: game.i18n.localize('CYBER_BLUE.Sheet.Buttons.AssignPlatform'),
      callback: (_event, _button, dialog) => dialog.element.querySelector('[name="platformId"]')?.value,
    },
    rejectClose: false,
  });
}

// Select the TWO platforms a paired extension installs into. Returns an array
// of two distinct platform ids, or null if the pairing can't be made (fewer
// than two eligible platforms, or the prompt was cancelled).
export async function promptForCyberwarePlatformPair(eligiblePlatforms) {
  if (eligiblePlatforms.length < 2) {
    return null;
  }

  // Exactly two slots available — no choice to make, assign both.
  if (eligiblePlatforms.length === 2) {
    return [eligiblePlatforms[0].id, eligiblePlatforms[1].id];
  }

  const optionsMarkup = (selectedId) => eligiblePlatforms.map((platform) => `
    <option value="${platform.id}"${platform.id === selectedId ? ' selected' : ''}>${platform.name} (${game.i18n.format('CYBER_BLUE.Cyberware.FreeSlots', {
      free: platform.freeSlots,
      total: platform.slotsProvided,
    })})</option>
  `).join('');

  const result = await foundry.applications.api.DialogV2.prompt({
    window: {
      title: game.i18n.localize('CYBER_BLUE.Cyberware.PairAssignment'),
    },
    content: `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.PlatformA')}</label>
          <select name="platformA">${optionsMarkup(eligiblePlatforms[0].id)}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.PlatformB')}</label>
          <select name="platformB">${optionsMarkup(eligiblePlatforms[1].id)}</select>
        </div>
      </form>
    `,
    ok: {
      label: game.i18n.localize('CYBER_BLUE.Sheet.Buttons.AssignPlatform'),
      callback: (_event, _button, dialog) => ({
        a: dialog.element.querySelector('[name="platformA"]')?.value,
        b: dialog.element.querySelector('[name="platformB"]')?.value,
      }),
    },
    rejectClose: false,
  });

  if (!result?.a || !result?.b) {
    return null;
  }

  if (result.a === result.b) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Cyberware.Errors.SamePlatform'));
    return null;
  }

  return [result.a, result.b];
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

    // A paired extension's two platforms must be distinct items (e.g. left eye
    // and right eye, not the same eye twice). A partially-assigned paired item
    // is allowed here — it just stays Disconnected (see isUnconnectedExtension).
    if (entry.system.paired
      && entry.system.parentCyberwareId
      && entry.system.parentCyberwareId2
      && entry.system.parentCyberwareId === entry.system.parentCyberwareId2) {
      return {
        valid: false,
        reason: game.i18n.localize('CYBER_BLUE.Cyberware.Errors.SamePlatform'),
      };
    }

    for (const platformId of getEntryPlatformIds(entry.system)) {
      const platform = entries.find((candidate) => candidate.id === platformId);
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
