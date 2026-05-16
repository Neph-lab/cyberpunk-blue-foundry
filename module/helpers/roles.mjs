export const ROLE_CATEGORIES = [
  { value: 'leader', label: 'Leader' },
  { value: 'networker', label: 'Networker' },
  { value: 'protean', label: 'Protean' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'sundry', label: 'Sundry' },
];

export const LEADER_PERMISSIONS = [
  { value: 'observer', label: 'Observer' },
  { value: 'owner', label: 'Owner' },
];

function randomId() {
  return foundry.utils.randomID();
}

export function getRoleCategoryLabel(category) {
  return ROLE_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}

export function createRoleAbilitySectionData() {
  return {
    id: randomId(),
    name: '',
    unlockRank: 1,
    content: '',
  };
}

export function createRoleGrantItemReferenceData() {
  return {
    id: randomId(),
    uuid: '',
    name: '',
    type: 'item',
    img: '',
  };
}

export function createRoleGrantGroupData() {
  return {
    id: randomId(),
    label: '',
    mode: 'all',
    count: 1,
    items: [createRoleGrantItemReferenceData()],
  };
}

export function createLeaderOptionData() {
  return {
    id: randomId(),
    uuid: '',
    name: '',
    img: '',
  };
}

export function createLeaderFeatureData() {
  return {
    id: randomId(),
    unlockRank: 1,
    name: '',
    description: '',
    selectionCount: 1,
    permission: 'observer',
    options: [createLeaderOptionData()],
    selectedUuids: [],
  };
}

export function createProteanFocusData() {
  return {
    id: randomId(),
    name: '',
    description: '',
    unlockRank: 1,
    minPoints: 0,
    maxPoints: 1,
    step: 1,
    points: 0,
  };
}

export function createSpecialistOptionData() {
  return {
    id: randomId(),
    name: '',
    description: '',
  };
}

export function createSpecialistOptionGroupData() {
  return {
    id: randomId(),
    unlockRank: 1,
    choices: 1,
    options: [createSpecialistOptionData()],
    selectedOptionIds: [],
  };
}

export function createSpecialtySectionData() {
  return {
    id: randomId(),
    name: '',
    unlockRank: 1,
    content: '',
  };
}

export function createSpecialtyData() {
  return {
    id: randomId(),
    name: '',
    description: '',
    rank: 0,
    unlockSections: [],
    optionGroups: [],
  };
}

function isRoleOwnerEditor(item) {
  return item?.parent instanceof Actor && (item.isOwner || game.user.role >= CONST.USER_ROLES.ASSISTANT);
}

function mergeWithDefaults(defaults, value) {
  const merged = { ...defaults, ...value };
  if (!merged.id) {
    merged.id = defaults.id;
  }
  return merged;
}

export function normalizeRoleSystemData(system = {}) {
  const next = foundry.utils.deepClone(system);
  next.category ??= 'sundry';
  next.abilitySections = (next.abilitySections ?? []).map((section) => mergeWithDefaults(createRoleAbilitySectionData(), section));
  next.grantedItemGroups = (next.grantedItemGroups ?? []).map((group) => ({
    ...mergeWithDefaults(createRoleGrantGroupData(), group),
    items: (group.items ?? []).map((item) => mergeWithDefaults(createRoleGrantItemReferenceData(), item)),
  }));
  next.leaderFeatures = (next.leaderFeatures ?? []).map((feature) => ({
    ...mergeWithDefaults(createLeaderFeatureData(), feature),
    options: (feature.options ?? []).map((option) => mergeWithDefaults(createLeaderOptionData(), option)),
    selectedUuids: Array.isArray(feature.selectedUuids) ? feature.selectedUuids.filter(Boolean) : [],
  }));
  next.proteanFoci = (next.proteanFoci ?? []).map((focus) => {
    const merged = mergeWithDefaults(createProteanFocusData(), focus);
    merged.points = Math.max(Number(merged.points) || 0, 0);
    merged.minPoints = Math.max(Number(merged.minPoints) || 0, 0);
    merged.maxPoints = Math.max(Number(merged.maxPoints) || 0, 0);
    merged.step = Math.max(Number(merged.step) || 1, 1);
    return merged;
  });
  next.specialties = (next.specialties ?? []).map((specialty) => {
    const merged = mergeWithDefaults(createSpecialtyData(), specialty);
    merged.rank = Math.max(Number(merged.rank) || 0, 0);
    merged.unlockSections = (specialty.unlockSections ?? []).map((section) => mergeWithDefaults(createSpecialtySectionData(), section));
    merged.optionGroups = (specialty.optionGroups ?? []).map((group) => ({
      ...mergeWithDefaults(createSpecialistOptionGroupData(), group),
      options: (group.options ?? []).map((option) => mergeWithDefaults(createSpecialistOptionData(), option)),
      selectedOptionIds: Array.isArray(group.selectedOptionIds) ? group.selectedOptionIds.filter(Boolean) : [],
    }));
    return merged;
  });

  if (next.category === 'protean') {
    const roleRank = Math.max(Number(next.rank) || 0, 0);
    const unlockedFoci = next.proteanFoci.filter((focus) => Number(focus.unlockRank) <= roleRank);
    const pointBudget = roleRank;
    let spent = 0;
    for (const focus of unlockedFoci) {
      const maxPoints = Math.max(Number(focus.maxPoints) || 0, 0);
      const minPoints = Math.min(Math.max(Number(focus.minPoints) || 0, 0), maxPoints);
      const step = Math.max(Number(focus.step) || 1, 1);
      let points = Math.max(Number(focus.points) || 0, 0);
      points = Math.max(minPoints, Math.min(points, maxPoints));
      points = Math.round(points / step) * step;
      points = Math.max(minPoints, Math.min(points, maxPoints));
      focus.points = points;
      spent += points;
    }

    if (spent > pointBudget) {
      let overflow = spent - pointBudget;
      for (const focus of [...unlockedFoci].reverse()) {
        if (overflow <= 0) {
          break;
        }
        const minPoints = Math.max(Number(focus.minPoints) || 0, 0);
        const step = Math.max(Number(focus.step) || 1, 1);
        const reducible = Math.max(focus.points - minPoints, 0);
        const reduction = Math.min(reducible, Math.ceil(overflow / step) * step);
        focus.points -= reduction;
        overflow -= reduction;
      }
    }

    for (const focus of next.proteanFoci) {
      if (Number(focus.unlockRank) > roleRank) {
        focus.points = 0;
      }
    }
  }

  if (next.category === 'specialist') {
    for (const specialty of next.specialties) {
      const rank = Math.max(Number(specialty.rank) || 0, 0);
      // First pass: filter each group's selections to valid option IDs
      for (const group of specialty.optionGroups) {
        const validIds = new Set((group.options ?? []).map((o) => o.id));
        group.selectedOptionIds = (group.selectedOptionIds ?? []).filter((id) => validIds.has(id));
      }
      // Second pass: enforce cross-group total ≤ rank (trim from last group first)
      let totalSelected = specialty.optionGroups.reduce((sum, g) => sum + g.selectedOptionIds.length, 0);
      for (let gi = specialty.optionGroups.length - 1; gi >= 0 && totalSelected > rank; gi--) {
        const group = specialty.optionGroups[gi];
        const excess = totalSelected - rank;
        if (group.selectedOptionIds.length > 0) {
          const remove = Math.min(excess, group.selectedOptionIds.length);
          group.selectedOptionIds = group.selectedOptionIds.slice(0, group.selectedOptionIds.length - remove);
          totalSelected -= remove;
        }
      }
    }
  }

  if (next.category === 'leader') {
    for (const feature of next.leaderFeatures) {
      const validOptionIds = new Set((feature.options ?? []).map((option) => option.uuid).filter(Boolean));
      feature.selectedUuids = (feature.selectedUuids ?? []).filter((uuid) => validOptionIds.has(uuid)).slice(0, Math.max(Number(feature.selectionCount) || 0, 0));
    }
  }

  return next;
}

export function getVisibleRoleAbilitySections(system = {}, roleRank = 0, includeLocked = false) {
  return (system.abilitySections ?? []).filter((section) => includeLocked || Number(section.unlockRank) <= roleRank);
}

export function getHighestUnlockedRoleAbilitySection(system = {}, roleRank = 0) {
  return getVisibleRoleAbilitySections(system, roleRank)
    .sort((left, right) => Number(right.unlockRank) - Number(left.unlockRank))[0] ?? null;
}

export function getUnlockedProteanFoci(system = {}, roleRank = 0) {
  return (system.proteanFoci ?? []).filter((focus) => Number(focus.unlockRank) <= roleRank);
}

export function getUnlockedLeaderFeatures(system = {}, roleRank = 0) {
  return (system.leaderFeatures ?? []).filter((feature) => Number(feature.unlockRank) <= roleRank);
}

export function getUnlockedSpecialtySections(specialty = {}) {
  return (specialty.unlockSections ?? []).filter((section) => Number(section.unlockRank) <= Number(specialty.rank) || 0);
}

export function getUnlockedSpecialtyOptionGroups(specialty = {}) {
  return (specialty.optionGroups ?? []).filter((group) => Number(group.unlockRank) <= Number(specialty.rank) || 0);
}

export function prepareRoleSheetCategoryData(item, itemData, { roleRank = 0, canManageRestricted = false } = {}) {
  const system = normalizeRoleSystemData(itemData.system ?? {});
  const includeLocked = canManageRestricted || !(item.parent instanceof Actor);
  const visibleSections = getVisibleRoleAbilitySections(system, roleRank, includeLocked);
  const category = system.category ?? 'sundry';

  return {
    category,
    categoryLabel: getRoleCategoryLabel(category),
    abilitySections: visibleSections,
    highestUnlockedSection: getHighestUnlockedRoleAbilitySection(system, roleRank),
    unlockedLeaderFeatures: getUnlockedLeaderFeatures(system, roleRank),
    unlockedProteanFoci: getUnlockedProteanFoci(system, roleRank),
    specialties: (system.specialties ?? []).map((specialty) => ({
      ...specialty,
      unlockedSections: getUnlockedSpecialtySections(specialty),
      unlockedOptionGroups: getUnlockedSpecialtyOptionGroups(specialty),
    })),
  };
}

async function promptForGrantChoices(group, availableItems) {
  const count = Math.max(Number(group.count) || 1, 1);
  if (availableItems.length <= count) {
    return availableItems;
  }

  const checkboxMarkup = availableItems.map((item, index) => `
    <label class="checkbox">
      <input type="checkbox" name="grant-choice" value="${index}" />
      <span>${foundry.utils.escapeHTML(item.name)}</span>
    </label>
  `).join('');
  const { promise, resolve } = Promise.withResolvers();
  const dialog = new foundry.applications.api.DialogV2({
    window: {
      title: game.i18n.localize('CYBER_BLUE.Role.ChooseGrantedItems'),
    },
    content: `
      <form class="cyberpunk-blue role-grant-dialog">
        <p>${foundry.utils.escapeHTML(group.label || 'Choose granted items')}</p>
        <p>${game.i18n.format('CYBER_BLUE.Role.ChooseGrantedItemsCount', { count })}</p>
        <div class="checkbox-group">${checkboxMarkup}</div>
      </form>
    `,
    buttons: [
      {
        action: 'confirm',
        icon: 'fa-solid fa-check',
        label: game.i18n.localize('CYBER_BLUE.Role.ConfirmChoices'),
        default: true,
        callback: (_event, _button, dialog) => {
          const form = dialog.element?.querySelector('form');
          if (!form) return [];
          const formData = new FormDataExtended(form).object;
          const raw = formData['grant-choice'];
          const chosen = Array.isArray(raw) ? raw.map(Number) : (raw !== undefined ? [Number(raw)] : []);
          return availableItems.filter((_, i) => chosen.includes(i)).slice(0, count);
        },
      },
      {
        action: 'cancel',
        icon: 'fa-solid fa-xmark',
        label: 'Cancel',
        callback: () => [],
      },
    ],
    submit: (result) => resolve(Array.isArray(result) ? result : []),
  });
  dialog.addEventListener('close', () => resolve([]), { once: true });
  dialog.render(true);
  return promise;
}

async function resolveGrantReference(reference) {
  if (!reference?.uuid) {
    return null;
  }

  const document = await fromUuid(reference.uuid);
  return document instanceof Item ? document : null;
}

export async function applyFirstRoleSetup(actor, roleItem) {
  if (!(actor instanceof Actor) || !(roleItem instanceof Item) || roleItem.type !== 'role') {
    return;
  }

  const existingRoles = actor.items.contents.filter((i) => i.type === 'role' && i.id !== roleItem.id);
  if (existingRoles.length > 0) {
    await roleItem.update({ 'system.rank': 1 });
    return;
  }

  await roleItem.update({ 'system.rank': 4 });
  const system = normalizeRoleSystemData(roleItem.system);
  const createdItems = [];

  for (const group of system.grantedItemGroups ?? []) {
    // Resolve each item reference to a pair { item, quantity } — filter out nulls
    const resolved = (await Promise.all(
      (group.items ?? []).map(async (ref) => {
        const item = await resolveGrantReference(ref);
        return item ? { item, quantity: ref.quantity ?? 1 } : null;
      })
    )).filter(Boolean);
    if (!resolved.length) {
      continue;
    }

    const resolvedItems = resolved.map((r) => r.item);
    const chosen = group.mode === 'choice'
      ? await promptForGrantChoices(group, resolvedItems)
      : resolvedItems;

    for (const sourceItem of chosen) {
      const data = sourceItem.toObject();
      delete data._id;
      // Apply quantity from the grant reference for items that track quantity
      const pair = resolved.find((r) => r.item === sourceItem);
      const qty = pair?.quantity ?? 1;
      if (qty > 1 && data.system && 'quantity' in data.system) {
        data.system.quantity = qty;
      }
      createdItems.push(data);
    }
  }

  if (createdItems.length) {
    // Create platforms before extensions so _preCreate can auto-assign the parent.
    // Also separates non-cyberware so it's unaffected by cyberware ordering.
    const extensions = createdItems.filter(
      (d) => d.type === 'cyberware' && d.system?.integration === 'extension'
    );
    const nonExtensions = createdItems.filter(
      (d) => !(d.type === 'cyberware' && d.system?.integration === 'extension')
    );
    const opts = { cyberBlueSkipRoleGrant: true };
    if (nonExtensions.length) {
      await actor.createEmbeddedDocuments('Item', nonExtensions, opts);
    }
    if (extensions.length) {
      await actor.createEmbeddedDocuments('Item', extensions, opts);
    }
  }
}

function getActorOwnerPermissions(actor, permissionLevel) {
  const level = permissionLevel === 'owner'
    ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    : CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  const updates = {};

  for (const [userId, ownership] of Object.entries(actor.ownership ?? {})) {
    const user = game.users.get(userId);
    if (!user || user.isGM) {
      continue;
    }
    if (ownership >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
      updates[userId] = level;
    }
  }

  return updates;
}

async function ensureTeamFolder(actor) {
  let root = game.folders.find((folder) => folder.type === 'Actor' && !folder.folder && folder.name === 'Team');
  if (!root) {
    root = await Folder.create({
      name: 'Team',
      type: 'Actor',
      color: '#5ef2c0',
    });
  }

  let child = game.folders.find((folder) => folder.type === 'Actor' && folder.folder?.id === root.id && folder.name === actor.name);
  if (!child) {
    child = await Folder.create({
      name: actor.name,
      type: 'Actor',
      folder: root.id,
      color: '#5ef2c0',
    });
  }

  return child;
}

async function ensureLeaderTeamActor(actor, roleItem, feature, sourceActor, folder) {
  const existing = game.actors.contents.find((candidate) =>
    candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.actorId') === actor.id
    && candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.roleId') === roleItem.id
    && candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.featureId') === feature.id
    && candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.sourceUuid') === sourceActor.uuid
  );
  const ownership = {
    default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    ...getActorOwnerPermissions(actor, feature.permission),
  };
  const data = sourceActor.toObject();
  delete data._id;
  delete data.folder;
  data.folder = folder.id;
  data.ownership = ownership;
  data.flags ??= {};
  data.flags['cyberpunk-blue'] ??= {};
  data.flags['cyberpunk-blue'].leaderRoleActor = {
    actorId: actor.id,
    roleId: roleItem.id,
    featureId: feature.id,
    sourceUuid: sourceActor.uuid,
  };

  if (existing) {
    await existing.update(data);
    return existing;
  }

  return Actor.create(data, { renderSheet: false });
}

export async function syncLeaderRoleTeam(actor, roleItem) {
  if (!game.user.isGM || !(actor instanceof Actor) || !(roleItem instanceof Item) || roleItem.type !== 'role') {
    return [];
  }

  const system = normalizeRoleSystemData(roleItem.system);
  if (system.category !== 'leader') {
    return [];
  }

  const unlockedFeatures = getUnlockedLeaderFeatures(system, Number(system.rank) || 0);
  const requiredKeys = new Set();
  const teamActors = [];
  const folder = await ensureTeamFolder(actor);

  for (const feature of unlockedFeatures) {
    const selected = (feature.selectedUuids ?? []).slice(0, Math.max(Number(feature.selectionCount) || 0, 0));
    for (const sourceUuid of selected) {
      const sourceActor = await fromUuid(sourceUuid);
      if (!(sourceActor instanceof Actor)) {
        continue;
      }
      const teamActor = await ensureLeaderTeamActor(actor, roleItem, feature, sourceActor, folder);
      requiredKeys.add(`${roleItem.id}:${feature.id}:${sourceActor.uuid}`);
      teamActors.push({
        sourceUuid,
        featureId: feature.id,
        actor: teamActor,
      });
    }
  }

  const staleActors = game.actors.contents.filter((candidate) =>
    candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.actorId') === actor.id
    && candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.roleId') === roleItem.id
  ).filter((candidate) => {
    const data = candidate.getFlag('cyberpunk-blue', 'leaderRoleActor');
    return !requiredKeys.has(`${data.roleId}:${data.featureId}:${data.sourceUuid}`);
  });

  if (staleActors.length) {
    await Actor.deleteDocuments(staleActors.map((candidate) => candidate.id), { renderSheet: false });
  }

  return teamActors;
}

export async function syncActorLeaderRoles(actor) {
  if (!game.user.isGM || !(actor instanceof Actor)) {
    return;
  }

  const roles = actor.items.contents.filter((item) => item.type === 'role');
  const seenRoleIds = new Set(roles.map((item) => item.id));
  for (const roleItem of roles) {
    await syncLeaderRoleTeam(actor, roleItem);
  }

  const staleActors = game.actors.contents.filter((candidate) =>
    candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.actorId') === actor.id
    && !seenRoleIds.has(candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.roleId'))
  );
  if (staleActors.length) {
    await Actor.deleteDocuments(staleActors.map((candidate) => candidate.id), { renderSheet: false });
  }
}

export function getRoleTeamMembers(actor, roleItem, feature) {
  return game.actors.contents.filter((candidate) =>
    candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.actorId') === actor.id
    && candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.roleId') === roleItem.id
    && candidate.getFlag('cyberpunk-blue', 'leaderRoleActor.featureId') === feature.id
  );
}

export function canEditRoleChoices(item) {
  return isRoleOwnerEditor(item);
}

// ─── Role condition AE sync ──────────────────────────────────────────────────

/**
 * Synchronise actor-level AEs derived from role item AEs that carry a
 * `flags.cyberpunk-blue.isRoleConditionAE` marker.
 *
 * Three condition types are supported:
 *   'rank'      — AE applies when the role's rank >= conditionMinRank
 *   'specialty' — AE applies when the specialty (conditionSpecialtyId) has
 *                 rank >= conditionMinRank
 *   'option'    — AE applies when the specialist option (conditionOptionId)
 *                 is selected anywhere in the role
 *
 * Source AEs on role items should have transfer:false so Foundry doesn't copy
 * them automatically; this function handles all syncing.
 *
 * @param {Actor} actor
 */
export async function syncAllRoleConditionAEs(actor) {
  if (!(actor instanceof Actor) || !actor.isOwner) return;

  // 1. Remove all previously-synced role condition AEs from the actor.
  const toDelete = actor.effects.contents
    .filter((e) => e.getFlag?.('cyberpunk-blue', 'isRoleConditionAE') && e.getFlag?.('cyberpunk-blue', 'sourceRoleId'))
    .map((e) => e.id);
  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
  }

  // 2. Build AEs to (re)create from all role items.
  const toCreate = [];

  for (const roleItem of actor.items.filter((i) => i.type === 'role')) {
    const system = normalizeRoleSystemData(roleItem.system);
    const roleRank = Number(system.rank) || 0;

    for (const ae of roleItem.effects ?? []) {
      // Only process AEs the GM has explicitly tagged as conditional.
      if (!ae.getFlag('cyberpunk-blue', 'isRoleConditionAE')) continue;

      const conditionType = ae.getFlag('cyberpunk-blue', 'conditionType') ?? '';
      const conditionMinRank = Number(ae.getFlag('cyberpunk-blue', 'conditionMinRank') ?? 1);
      const conditionSpecialtyId = ae.getFlag('cyberpunk-blue', 'conditionSpecialtyId') ?? '';
      const conditionOptionId = ae.getFlag('cyberpunk-blue', 'conditionOptionId') ?? '';

      let conditionMet = false;
      switch (conditionType) {
        case 'rank':
          conditionMet = roleRank >= conditionMinRank;
          break;
        case 'specialty': {
          if (!conditionSpecialtyId) break;
          const specialty = (system.specialties ?? []).find((s) => s.id === conditionSpecialtyId);
          conditionMet = specialty ? (Number(specialty.rank) || 0) >= conditionMinRank : false;
          break;
        }
        case 'option': {
          if (!conditionOptionId) break;
          conditionMet = (system.specialties ?? []).some((specialty) =>
            (specialty.optionGroups ?? []).some((group) =>
              (group.selectedOptionIds ?? []).includes(conditionOptionId)
            )
          );
          break;
        }
        default:
          continue; // unknown type — skip
      }

      if (!conditionMet) continue;

      // Clone the AE, mark it as a synced actor-level copy.
      const aeData = ae.toObject();
      delete aeData._id;
      aeData.transfer = false;
      aeData.disabled = false;
      aeData.flags ??= {};
      aeData.flags['cyberpunk-blue'] ??= {};
      // Preserve isRoleConditionAE flag so cleanup works; add source tracking.
      aeData.flags['cyberpunk-blue'].isRoleConditionAE = true;
      aeData.flags['cyberpunk-blue'].sourceRoleId = roleItem.id;
      aeData.flags['cyberpunk-blue'].sourceAEId = ae.id;
      toCreate.push(aeData);
    }
  }

  if (toCreate.length) {
    await actor.createEmbeddedDocuments('ActiveEffect', toCreate);
  }
}

// ─── Protean tactic AE sync ───────────────────────────────────────────────────

/**
 * Synchronise ActiveEffects on the actor for all protean-tactic foci across
 * every protean Role item on the actor.
 *
 * Deletes all AEs tagged `isProteanFocusAE`, then recreates them from the
 * current point allocations.  Handles non-stacking Threat Detection, numeric
 * flag values (Damage Deflection), and boolean flags (Spot Weakness etc.)
 * that combat-resolution.mjs reads via getActiveAEFlag().
 *
 * Safe to call from updateItem hooks and the GM-ready scan.
 *
 * @param {Actor} actor
 */
export async function syncAllProteanFociAEs(actor) {
  if (!(actor instanceof Actor) || !actor.isOwner) return;

  const ADD = 2; // ACTIVE_EFFECT_MODES.ADD

  // 1. Remove all previously-synced tactic AEs.
  const toDelete = actor.effects.contents
    .filter((e) => e.getFlag?.('cyberpunk-blue', 'isProteanFocusAE'))
    .map((e) => e.id);
  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
  }

  // 2. Gather foci from all protean roles on this actor.
  const focusList = []; // { roleName, focus, pts }
  let threatDetectionMax = 0;

  for (const roleItem of actor.items.filter((i) => i.type === 'role')) {
    const system = normalizeRoleSystemData(roleItem.system);
    if (system.category !== 'protean') continue;
    for (const focus of system.proteanFoci ?? []) {
      const pts = Number(focus.points) || 0;
      focusList.push({ roleName: roleItem.name, focus, pts });
      if (focus.name === 'Threat Detection') {
        threatDetectionMax = Math.max(threatDetectionMax, pts);
      }
    }
  }

  if (!focusList.length) return;

  // 3. Build AEs to create.
  const toCreate = [];
  let threatDetectionHandled = false;

  for (const { roleName, focus, pts } of focusList) {
    // Skip zero-allocated foci (no AE needed).
    if (pts <= 0) continue;

    const baseCpbFlags = { isProteanFocusAE: true, proteanFocusName: focus.name };

    switch (focus.name) {

      // ── Initiative Reaction (Solo): +1 to Initiative per point ─────────────
      case 'Initiative Reaction':
        toCreate.push({
          name: `${roleName}: Initiative Reaction (+${pts} Initiative)`,
          disabled: false, transfer: false,
          flags: { 'cyberpunk-blue': baseCpbFlags },
          changes: [{ key: 'system.stats.rflx.rollMod', mode: ADD, value: String(pts) }],
        });
        break;

      // ── Spot Weakness (Solo): SP bypass on first hit (handled by combat code)
      case 'Spot Weakness':
        toCreate.push({
          name: `${roleName}: Spot Weakness (SP bypassed, first hit)`,
          disabled: false, transfer: false,
          flags: { 'cyberpunk-blue': { ...baseCpbFlags, soloSpotWeakness: true } },
          changes: [],
        });
        break;

      // ── Threat Detection (Solo/Ninja): +1 Perception per point; NON-STACKING
      case 'Threat Detection':
        if (!threatDetectionHandled) {
          threatDetectionHandled = true;
          if (threatDetectionMax > 0) {
            toCreate.push({
              name: `Threat Detection (+${threatDetectionMax} Perception)`,
              disabled: false, transfer: false,
              flags: { 'cyberpunk-blue': baseCpbFlags },
              changes: [{ key: 'system.skills.perception.bonus', mode: ADD, value: String(threatDetectionMax) }],
            });
          }
        }
        break;

      // ── Damage Deflection (Solo): −1 per 2 pts on first damage taken ───────
      case 'Damage Deflection': {
        const reduction = Math.min(Math.floor(pts / 2), 5);
        if (reduction > 0) {
          toCreate.push({
            name: `${roleName}: Damage Deflection (−${reduction} first damage)`,
            disabled: false, transfer: false,
            flags: { 'cyberpunk-blue': { ...baseCpbFlags, soloDamageDeflection: reduction } },
            changes: [],
          });
        }
        break;
      }

      // ── Fumble Recovery (Solo): reroll attack die = 1 when ≥ 4 pts ─────────
      case 'Fumble Recovery':
        if (pts >= 4) {
          toCreate.push({
            name: `${roleName}: Fumble Recovery (reroll 1s)`,
            disabled: false, transfer: false,
            flags: { 'cyberpunk-blue': { ...baseCpbFlags, soloFumbleRecovery: true } },
            changes: [],
          });
        }
        break;

      // ── Silent Death (Ninja): +1 Stealth per point ─────────────────────────
      case 'Silent Death':
        toCreate.push({
          name: `${roleName}: Silent Death (+${pts} Stealth)`,
          disabled: false, transfer: false,
          flags: { 'cyberpunk-blue': baseCpbFlags },
          changes: [{ key: 'system.skills.stealth.bonus', mode: ADD, value: String(pts) }],
        });
        break;

      // ── Martial Skill (Ninja): +1 Melee/MA per 2 pts (max +3) ──────────────
      case 'Martial Skill': {
        const bonus = Math.min(Math.floor(pts / 2), 3);
        if (bonus > 0) {
          toCreate.push({
            name: `${roleName}: Martial Skill (+${bonus} Melee & Martial Arts)`,
            disabled: false, transfer: false,
            flags: { 'cyberpunk-blue': baseCpbFlags },
            changes: [
              { key: 'system.skills.meleeWeapon.bonus', mode: ADD, value: String(bonus) },
              { key: 'system.skills.martialArts.bonus', mode: ADD, value: String(bonus) },
            ],
          });
        }
        break;
      }

      // ── Seek Cover (Ninja): +5 Initiative when 2 pts allocated ─────────────
      case 'Seek Cover':
        if (pts >= 2) {
          toCreate.push({
            name: `${roleName}: Seek Cover (+5 Initiative)`,
            disabled: false, transfer: false,
            flags: { 'cyberpunk-blue': baseCpbFlags },
            changes: [{ key: 'system.stats.rflx.rollMod', mode: ADD, value: '5' }],
          });
        }
        break;

      // ── Weak-Spot (Ninja): SP bypass up to threshold (combat-code flag) ────
      case 'Weak-Spot': {
        const threshold = Math.floor(pts / 2) * 3;
        toCreate.push({
          name: `${roleName}: Weak-Spot (SP ≤ ${threshold} bypassed)`,
          disabled: false, transfer: false,
          flags: { 'cyberpunk-blue': { ...baseCpbFlags, ninjaWeakSpot: true } },
          changes: [],
        });
        break;
      }

      // ── Precision Attack (Solo): +1 to all attacks per 3 pts (max +3) ────────
      case 'Precision Attack': {
        const bonus = Math.min(Math.floor(pts / 3), 3);
        if (bonus > 0) {
          toCreate.push({
            name: `${roleName}: Precision Attack (+${bonus} all attacks)`,
            disabled: false, transfer: false,
            flags: { 'cyberpunk-blue': { ...baseCpbFlags, soloPrecisionAttack: bonus } },
            changes: [],
          });
        }
        break;
      }

      // Pummel, Poison, Precision Kill — combat-code hooks not yet implemented;
      // displayed on sheet as text only.
      default:
        break;
    }
  }

  // Handle Threat Detection if only Ninja has it and pts > 0 (deduplicated above).
  if (!threatDetectionHandled && threatDetectionMax > 0) {
    toCreate.push({
      name: `Threat Detection (+${threatDetectionMax} Perception)`,
      disabled: false, transfer: false,
      flags: { 'cyberpunk-blue': { isProteanFocusAE: true, proteanFocusName: 'Threat Detection' } },
      changes: [{ key: 'system.skills.perception.bonus', mode: ADD, value: String(threatDetectionMax) }],
    });
  }

  if (toCreate.length) {
    await actor.createEmbeddedDocuments('ActiveEffect', toCreate);
  }
}
