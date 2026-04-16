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

export function normalizeRoleSystemData(system = {}) {
  const next = foundry.utils.deepClone(system);
  next.category ??= 'sundry';
  next.abilitySections = (next.abilitySections ?? []).map((section) => ({
    ...createRoleAbilitySectionData(),
    ...section,
  }));
  next.grantedItemGroups = (next.grantedItemGroups ?? []).map((group) => ({
    ...createRoleGrantGroupData(),
    ...group,
    items: (group.items ?? []).map((item) => ({
      ...createRoleGrantItemReferenceData(),
      ...item,
    })),
  }));
  next.leaderFeatures = (next.leaderFeatures ?? []).map((feature) => ({
    ...createLeaderFeatureData(),
    ...feature,
    options: (feature.options ?? []).map((option) => ({
      ...createLeaderOptionData(),
      ...option,
    })),
    selectedUuids: Array.isArray(feature.selectedUuids) ? feature.selectedUuids.filter(Boolean) : [],
  }));
  next.proteanFoci = (next.proteanFoci ?? []).map((focus) => ({
    ...createProteanFocusData(),
    ...focus,
    points: Math.max(Number(focus.points) || 0, 0),
    minPoints: Math.max(Number(focus.minPoints) || 0, 0),
    maxPoints: Math.max(Number(focus.maxPoints) || 0, 0),
    step: Math.max(Number(focus.step) || 1, 1),
  }));
  next.specialties = (next.specialties ?? []).map((specialty) => ({
    ...createSpecialtyData(),
    ...specialty,
    rank: Math.max(Number(specialty.rank) || 0, 0),
    unlockSections: (specialty.unlockSections ?? []).map((section) => ({
      ...createSpecialtySectionData(),
      ...section,
    })),
    optionGroups: (specialty.optionGroups ?? []).map((group) => ({
      ...createSpecialistOptionGroupData(),
      ...group,
      options: (group.options ?? []).map((option) => ({
        ...createSpecialistOptionData(),
        ...option,
      })),
      selectedOptionIds: Array.isArray(group.selectedOptionIds) ? group.selectedOptionIds.filter(Boolean) : [],
    })),
  }));

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
      specialty.optionGroups = specialty.optionGroups.map((group) => ({
        ...group,
        selectedOptionIds: (group.selectedOptionIds ?? []).filter((selectedId) => group.options.some((option) => option.id === selectedId)).slice(0, Math.max(Number(group.choices) || 0, 0)),
      }));
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
      },
      {
        action: 'cancel',
        icon: 'fa-solid fa-xmark',
        label: 'Cancel',
      },
    ],
    submit: (result, button, form) => {
      if (result !== 'confirm') {
        resolve([]);
        return;
      }
      const formData = new FormDataExtended(form).object;
      const chosen = Array.isArray(formData['grant-choice'])
        ? formData['grant-choice']
        : formData['grant-choice'] ? [formData['grant-choice']] : [];
      const selected = chosen
        .map((entry) => availableItems[Number(entry)])
        .filter(Boolean)
        .slice(0, count);
      resolve(selected);
    },
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

  await roleItem.update({ 'system.rank': 4 });
  const system = normalizeRoleSystemData(roleItem.system);
  const createdItems = [];

  for (const group of system.grantedItemGroups ?? []) {
    const resolved = (await Promise.all((group.items ?? []).map(resolveGrantReference))).filter(Boolean);
    if (!resolved.length) {
      continue;
    }

    const chosen = group.mode === 'choice'
      ? await promptForGrantChoices(group, resolved)
      : resolved;
    for (const sourceItem of chosen) {
      const data = sourceItem.toObject();
      delete data._id;
      createdItems.push(data);
    }
  }

  if (createdItems.length) {
    await actor.createEmbeddedDocuments('Item', createdItems, { cyberBlueSkipRoleGrant: true });
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
