const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;
import { getBrandLogoPath } from '../helpers/branding.mjs';
import { getEligiblePlatforms, getPlatformUsage, promptForCyberwarePlatform } from '../helpers/cyberware.mjs';
import { getActorCyberwareDisableState } from '../helpers/cyberware-disable.mjs';
import { normalizeGearState, getGearStateUpdateData } from '../helpers/gear.mjs';
import { getEffectiveItemWeapons } from '../helpers/mods.mjs';
import { getWeaponTypeDefinition } from '../helpers/combat.mjs';

function sortEmbeddedDocuments(left, right) {
  return (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name);
}

function clampWeaponAmmo(weapon) {
  const magazine = Math.max(Number(weapon.magazine) || 0, 0);
  const current = Math.max(Math.min(Number(weapon.ammoCurrent) || 0, magazine), 0);
  return { current, magazine };
}

export class CyberBlueActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'actor'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 980,
      height: 860,
    },
    window: {
      resizable: true,
    },
  }, { inplace: false });

  static PARTS = {
    sheet: {
      root: true,
      template: 'systems/cyberpunk-blue/templates/actor/actor-sheet.hbs',
    },
  };

  tabGroups = {
    primary: 'overview',
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorData = this.document.toPlainObject();
    const { system } = actorData;
    const activeRoleId = system.roleState?.activeLowRankRoleId ?? null;
    const canManageRestricted = game.user.role >= CONST.USER_ROLES.ASSISTANT;
    const taggerActive = game.modules.get('tagger')?.active && globalThis.Tagger?.getTags;
    const cyberwareDisableState = getActorCyberwareDisableState(this.document);
    const activeComponents = Object.entries(CONFIG.CYBER_BLUE.components)
      .filter(([slug]) => system.components[slug].active)
      .map(([slug, data]) => ({
        slug,
        label: data.label,
        rank: system.components[slug].rank,
        linkedSkills: data.skills.map((skillSlug) => CONFIG.CYBER_BLUE.skills[skillSlug].label).join(', '),
      }));
    const availableComponents = Object.entries(CONFIG.CYBER_BLUE.components)
      .filter(([slug]) => !system.components[slug].active)
      .map(([slug, data]) => ({
        slug,
        label: data.label,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    context.cssClass = this.options.classes.join(' ');
    context.actor = actorData;
    context.system = system;
    context.config = CONFIG.CYBER_BLUE;
    context.canManageRestricted = canManageRestricted;
    context.itemTypes = CONFIG.CYBER_BLUE.itemTypes;
    context.stats = Object.entries(CONFIG.CYBER_BLUE.stats)
      .filter(([slug]) => slug !== 'move')
      .map(([slug, data]) => ({
        slug,
        ...data,
        value: system.stats[slug].value,
      }));
    context.move = {
      slug: 'move',
      ...CONFIG.CYBER_BLUE.stats.move,
      value: system.stats.move.value,
    };
    const availableArmorItems = this.document.getAvailableArmorItems();
    const activeArmorItem = this.document.getActiveArmorItem();
    context.armor = {
      activeId: activeArmorItem?.id ?? '',
      current: system.resources.armor.value ?? 0,
      max: system.resources.armor.max ?? 0,
      options: availableArmorItems.map((item) => ({
        id: item.id,
        name: item.name,
      })),
    };
    context.psyche = {
      slug: 'psyche',
      ...CONFIG.CYBER_BLUE.resources.psyche,
      value: system.resources.psyche.value,
      max: system.resources.psyche.max,
    };
    context.luck = {
      slug: 'luck',
      ...CONFIG.CYBER_BLUE.resources.luck,
      value: system.resources.luck.value,
      max: system.resources.luck.max,
    };
    context.resources = Object.entries(CONFIG.CYBER_BLUE.resources).map(([slug, data]) => ({
      slug,
      ...data,
      value: system.resources[slug].value,
      max: system.resources[slug].max,
    }));
    const skillEntries = Object.entries(CONFIG.CYBER_BLUE.skills).map(([slug, data]) => ({
      slug,
      label: data.label,
      statSlug: data.stat,
      statLabel: CONFIG.CYBER_BLUE.stats[data.stat]?.shortLabel ?? data.stat.toUpperCase(),
      rank: system.skills[slug].rank,
      components: data.components
        .filter((componentSlug) => system.components[componentSlug].active)
        .map((componentSlug) => ({
          slug: componentSlug,
          label: CONFIG.CYBER_BLUE.components[componentSlug].label,
          rank: system.components[componentSlug].rank,
        })),
    }));
    context.skills = skillEntries;
    context.components = activeComponents;
    context.availableComponents = availableComponents;

    const embeddedItemDocuments = this.document.items.contents
      .slice()
      .sort(sortEmbeddedDocuments);
    const embeddedItems = embeddedItemDocuments
      .map((item) => ({ ...item.toPlainObject(), img: item.img || Item.DEFAULT_ICON }));
    const manufacturerLogoMap = new Map(await Promise.all(
      [...new Set(embeddedItems.map((item) => item.system.manufacturer).filter(Boolean))]
        .map(async (manufacturer) => [manufacturer, await getBrandLogoPath(manufacturer)])
    ));
    const cyberwareDescriptionMap = new Map(await Promise.all(
      embeddedItems
        .filter((item) => item.type === 'cyberware')
        .map(async (item) => ([
          item.id,
          await TextEditor.enrichHTML(item.system.description ?? '', {
            secrets: this.document.isOwner,
            async: true,
            rollData: this.document.getRollData(),
            relativeTo: this.document,
          }),
        ]))
    ));

    context.roles = embeddedItems
      .filter((item) => item.type === 'role')
      .map((item) => ({
        ...item,
        isAlwaysActive: item.system.rank >= 4,
        isLowRankActive: item.system.rank < 4 && item.id === activeRoleId,
      }));
    context.abilities = embeddedItems
      .filter((item) => item.type === 'ability')
      .map((item) => ({
        ...item,
        maxRankDisplay: canManageRestricted && Number.isFinite(item.system.maxRank)
          ? item.system.maxRank
          : null,
      }));
    const cyberwareItems = embeddedItems.filter((item) => item.type === 'cyberware');
    const cyberwareDocs = embeddedItemDocuments.filter((item) => item.type === 'cyberware');
    const cyberwareUsage = getPlatformUsage(cyberwareItems.map((item) => ({
      id: item.id,
      name: item.name,
      system: item.system,
    })));
    context.cyberwareGroups = (CONFIG.CYBER_BLUE.cyberware?.types ?? [])
      .map((typeConfig) => {
        const items = cyberwareItems
          .filter((item) => item.system.installed && item.system.cyberwareType === typeConfig.value)
          .filter((item) => item.system.integration !== 'extension' || Boolean(item.system.parentCyberwareId))
          .map((item) => {
            const parent = cyberwareItems.find((candidate) => candidate.id === item.system.parentCyberwareId);
            const usedSlots = cyberwareUsage.get(item.id) ?? 0;
            const itemDoc = this.document.items.get(item.id);
            return {
              ...item,
              isDisabled: cyberwareDisableState.byItemId.has(item.id),
              disabledBy: cyberwareDisableState.byItemId.get(item.id)?.effectNames ?? [],
              disabledTooltip: cyberwareDisableState.byItemId.get(item.id)?.tooltip ?? '',
              manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
              integrationLabel: CONFIG.CYBER_BLUE.cyberware.integrations
                ?.find((entry) => entry.value === item.system.integration)?.label ?? item.system.integration,
              slotText: item.system.integration === 'platform'
                ? `${Math.max((item.system.slotsProvided ?? 0) - usedSlots, 0)}/${item.system.slotsProvided ?? 0}`
                : `${item.system.slotsUsed ?? 0}`,
              platformName: parent?.name ?? null,
              canDetachPlatform: item.system.integration === 'extension' && Boolean(item.system.parentCyberwareId),
              description: cyberwareDescriptionMap.get(item.id) ?? '',
              rowGapClass: 'embedded-entry',
              effectiveWeapons: getEffectiveItemWeapons(itemDoc ?? item).map((weapon, weaponIndex) => {
                const definition = getWeaponTypeDefinition(weapon.type);
                const ammo = clampWeaponAmmo(weapon);
                return {
                  index: weaponIndex,
                  definition,
                  ammoText: definition.usesMagazine ? `${ammo.current}/${ammo.magazine}` : null,
                };
              }),
            };
          });

        return {
          ...typeConfig,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
    context.unconnectedCyberware = cyberwareItems
      .filter((item) => item.system.installed && item.system.integration === 'extension' && !item.system.parentCyberwareId)
      .map((item) => {
        const eligiblePlatforms = getEligiblePlatforms(this.document, item.id, item.system);
        return {
          ...item,
          isDisabled: cyberwareDisableState.byItemId.has(item.id),
          disabledTooltip: cyberwareDisableState.byItemId.get(item.id)?.tooltip ?? '',
          manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
          integrationLabel: CONFIG.CYBER_BLUE.cyberware.integrations
            ?.find((entry) => entry.value === item.system.integration)?.label ?? item.system.integration,
          slotText: `${item.system.slotsUsed ?? 0}`,
          eligiblePlatforms,
          hasEligiblePlatforms: eligiblePlatforms.length > 0,
          description: cyberwareDescriptionMap.get(item.id) ?? '',
        };
      });
    const gearDocs = embeddedItemDocuments.filter((item) => item.type === 'gear');
    const inventoryItems = gearDocs.map((itemDoc) => {
      const item = embeddedItems.find((entry) => entry.id === itemDoc.id);
      const state = itemDoc.getGearState?.() ?? normalizeGearState(item.system);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      return {
        ...item,
        state,
        manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
        armorText: item.system.isArmor ? `${Math.max(item.system.armor?.currentSp ?? 0, 0)}/${Math.max(item.system.armor?.maxSp ?? 0, 0)}` : null,
        weaponSummaries: effectiveWeapons.map((weapon) => {
          const definition = getWeaponTypeDefinition(weapon.type);
          const ammo = clampWeaponAmmo(weapon);
          return {
            label: definition.label,
            ammoText: definition.usesMagazine ? `${ammo.current}/${ammo.magazine}` : null,
          };
        }),
      };
    });
    context.inventoryGroups = ['equipped', 'carried', 'owned'].map((state) => ({
      state,
      label: CONFIG.CYBER_BLUE.gearStates.find((entry) => entry.value === state)?.label ?? state,
      items: inventoryItems.filter((item) => item.state === state),
    }));
    const combatWeaponEntries = [];
    for (const itemDoc of gearDocs) {
      if ((itemDoc.getGearState?.() ?? normalizeGearState(itemDoc.system)) !== 'equipped' || !itemDoc.system.isWeapon) {
        continue;
      }

      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      for (const [weaponIndex, weapon] of effectiveWeapons.entries()) {
        const definition = getWeaponTypeDefinition(weapon.type);
        const baseSkill = itemDoc.system.weapons?.[weaponIndex]?.skill ?? weapon.skill;
        const rollContext = this.document.getSkillRollContext(
          CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill
        );
        const total = rollContext.statValue + rollContext.usedRank + (rollContext.statRollMod ?? 0);
        const ammo = clampWeaponAmmo(weapon);
        combatWeaponEntries.push({
          itemId: itemDoc.id,
          weaponIndex,
          itemName: itemDoc.name,
          name: effectiveWeapons.length > 1 ? `${itemDoc.name} - ${definition.label}` : itemDoc.name,
          attackLabel: `1d10 + ${total}`,
          attackTooltip: `${rollContext.statShortLabel} ${rollContext.statValue} + ${rollContext.skillLabel} ${rollContext.usedRank}${rollContext.statRollMod ? ` + bonus ${rollContext.statRollMod}` : ''}`,
          rateOfFire: weapon.rateOfFire,
          showsAmmo: definition.usesMagazine,
          ammoCurrent: ammo.current,
          magazine: ammo.magazine,
        });
      }
    }
    for (const itemDoc of cyberwareDocs) {
      if (!itemDoc.system.installed || itemDoc.isUnconnectedExtension?.() || itemDoc.isCyberwareDisabled?.() || !itemDoc.system.isWeapon) {
        continue;
      }

      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      for (const [weaponIndex, weapon] of effectiveWeapons.entries()) {
        const definition = getWeaponTypeDefinition(weapon.type);
        const baseSkill = itemDoc.system.weapons?.[weaponIndex]?.skill ?? weapon.skill;
        const rollContext = this.document.getSkillRollContext(
          CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill
        );
        const total = rollContext.statValue + rollContext.usedRank + (rollContext.statRollMod ?? 0);
        const ammo = clampWeaponAmmo(weapon);
        combatWeaponEntries.push({
          itemId: itemDoc.id,
          weaponIndex,
          itemName: itemDoc.name,
          name: effectiveWeapons.length > 1 ? `${itemDoc.name} - ${definition.label}` : itemDoc.name,
          attackLabel: `1d10 + ${total}`,
          attackTooltip: `${rollContext.statShortLabel} ${rollContext.statValue} + ${rollContext.skillLabel} ${rollContext.usedRank}${rollContext.statRollMod ? ` + bonus ${rollContext.statRollMod}` : ''}`,
          rateOfFire: weapon.rateOfFire,
          showsAmmo: definition.usesMagazine,
          ammoCurrent: ammo.current,
          magazine: ammo.magazine,
        });
      }
    }
    context.combatWeapons = combatWeaponEntries;
    context.health = {
      hp: {
        value: system.resources.hp.value,
        max: system.resources.hp.max,
      },
      seriousWoundThreshold: system.resources.seriousWoundThreshold.value,
      deathSave: system.resources.deathSave.value,
      effects: this.document.effects.contents
        .filter((effect) => !effect.disabled)
        .map((effect) => {
          const tags = taggerActive ? globalThis.Tagger.getTags(effect) ?? [] : [];
          return {
            id: effect.id,
            uuid: effect.uuid,
            name: effect.name,
            icon: effect.img || effect.icon,
            duration: effect.duration?.label || game.i18n.localize('CYBER_BLUE.Effect.Ongoing'),
            isHealthTagged: tags.some((tag) => `${tag}`.toLowerCase() === 'health'),
            canEdit: game.user.role >= CONST.USER_ROLES.TRUSTED,
          };
        })
        .sort((left, right) => {
          if (left.isHealthTagged !== right.isHealthTagged) {
            return Number(right.isHealthTagged) - Number(left.isHealthTagged);
          }
          return left.name.localeCompare(right.name);
        }),
    };
    context.otherResources = context.resources.filter((resource) => !['hp', 'armor', 'luck', 'psyche'].includes(resource.slug));

    context.enrichedDetails = {};
    for (const field of ['background', 'appearance', 'personality', 'style']) {
      context.enrichedDetails[field] = await TextEditor.enrichHTML(system.details[field], {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.getRollData(),
        relativeTo: this.document,
      });
    }

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const tabs = new Tabs({
      navSelector: '.sheet-tabs',
      contentSelector: '.sheet-body',
      initial: this.tabGroups.primary ?? 'overview',
      callback: (_event, _tabs, active) => {
        this.tabGroups.primary = active;
      },
    });
    tabs.bind(this.element);

    this.element.querySelectorAll('[data-action="create-item"]').forEach((button) => {
      button.addEventListener('click', this._onItemCreate.bind(this));
    });
    this.element.querySelectorAll('[data-action="edit-item"], .item-name-link').forEach((button) => {
      button.addEventListener('click', this._onItemEdit.bind(this));
    });
    this.element.querySelectorAll('[data-action="delete-item"]').forEach((button) => {
      button.addEventListener('click', this._onItemDelete.bind(this));
    });
    this.element.querySelectorAll('[data-action="move-item"]').forEach((button) => {
      button.addEventListener('click', this._onItemMove.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-active-role"]').forEach((button) => {
      button.addEventListener('click', this._onToggleActiveRole.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-component"]').forEach((button) => {
      button.addEventListener('click', this._onAddComponent.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-component"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveComponent.bind(this));
    });
    this.element.querySelectorAll('[data-action="roll-skill"]').forEach((button) => {
      button.addEventListener('click', this._onRollSkill.bind(this));
    });
    this.element.querySelectorAll('[data-action="open-health-effect"]').forEach((button) => {
      button.addEventListener('click', this._onOpenHealthEffect.bind(this));
    });
    this.element.querySelectorAll('[data-action="assign-platform"]').forEach((button) => {
      button.addEventListener('click', this._onAssignPlatform.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-platform"]').forEach((button) => {
      button.addEventListener('click', this._onRemovePlatform.bind(this));
    });
    this.element.querySelectorAll('[data-action="set-gear-state"]').forEach((button) => {
      button.addEventListener('click', this._onSetGearState.bind(this));
    });
    this.element.querySelectorAll('[data-action="update-item-field"]').forEach((input) => {
      input.addEventListener('change', this._onUpdateItemField.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-attack"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponAttack.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-reload"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponReload.bind(this));
    });
    this.element.querySelectorAll('[data-edit="img"]').forEach((element) => {
      element.addEventListener('click', this._onEditProfileImage.bind(this));
    });
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.itemType;
    if (!type) {
      return;
    }

    const label = CONFIG.CYBER_BLUE.itemTypes[type]?.label ?? type;
    await this.document.createEmbeddedDocuments('Item', [
      {
        name: `New ${label}`,
        type,
      },
    ]);
  }

  _getItemFromEvent(event) {
    const row = event.currentTarget.closest('[data-item-id]');
    return row ? this.document.items.get(row.dataset.itemId) : null;
  }

  async _onItemEdit(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    return item?.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (item) {
      await item.delete();
    }
  }

  async _onItemMove(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item) {
      return;
    }

    const direction = event.currentTarget.dataset.direction === 'down' ? 1 : -1;
    const row = event.currentTarget.closest('[data-item-id]');
    const container = row?.parentElement;
    const siblingRows = container
      ? Array.from(container.children).filter((element) => element.hasAttribute('data-item-id'))
      : [];
    const currentIndex = siblingRows.findIndex((element) => element.dataset.itemId === item.id);
    const targetRow = siblingRows[currentIndex + direction];
    const target = targetRow ? this.document.items.get(targetRow.dataset.itemId) : null;

    if (!target) {
      return;
    }

    const siblings = siblingRows
      .filter((element) => element.dataset.itemId !== item.id)
      .map((element) => this.document.items.get(element.dataset.itemId))
      .filter(Boolean);
    const sortUpdates = SortingHelpers.performIntegerSort(item, {
      target,
      siblings,
      sortBefore: direction < 0,
    });
    const updateData = sortUpdates.map((update) => ({
      _id: update.target._id,
      ...update.update,
    }));

    await this.document.updateEmbeddedDocuments('Item', updateData);
  }

  async _onToggleActiveRole(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'role' || item.system.rank >= 4) {
      return;
    }

    const currentId = this.document.system.roleState.activeLowRankRoleId;
    const nextId = currentId === item.id ? null : item.id;
    await this.document.update({ 'system.roleState.activeLowRankRoleId': nextId });
  }

  async _onAddComponent(event) {
    event.preventDefault();
    const select = this.element.querySelector('[data-component-select]');
    const componentSlug = select?.value;
    if (!componentSlug) {
      return;
    }

    await this.document.update({
      [`system.components.${componentSlug}.active`]: true,
      [`system.components.${componentSlug}.rank`]: this.document.system.components[componentSlug]?.rank ?? 0,
    });
  }

  async _onRemoveComponent(event) {
    event.preventDefault();
    const componentSlug = event.currentTarget.dataset.componentSlug;
    if (!componentSlug) {
      return;
    }

    await this.document.update({
      [`system.components.${componentSlug}.active`]: false,
      [`system.components.${componentSlug}.rank`]: 0,
    });
  }

  async _onRollSkill(event) {
    event.preventDefault();

    const skillSlug = event.currentTarget.dataset.skillSlug;
    const componentSlug = event.currentTarget.dataset.componentSlug || null;
    const row = event.currentTarget.closest('[data-skill-row]');
    const modifierField = row?.querySelector('[data-field="modifier"]');
    const modifierValue = Number.parseInt(modifierField?.value ?? '0', 10);

    await this.document.rollSkill({
      skillSlug,
      componentSlug,
      modifier: Number.isNaN(modifierValue) ? 0 : modifierValue,
    });
  }

  async _onOpenHealthEffect(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    if (!effectId) {
      return;
    }

    const effect = this.document.effects.get(effectId);
    if (!effect) {
      return;
    }

    await effect.sheet.render(true, {
      editable: game.user.role >= CONST.USER_ROLES.TRUSTED,
    });
  }

  async _onAssignPlatform(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'cyberware' || item.system.integration !== 'extension') {
      return;
    }

    const eligiblePlatforms = getEligiblePlatforms(this.document, item.id, item.system);
    if (!eligiblePlatforms.length) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Cyberware.NoEligiblePlatforms'));
      return;
    }

    const platformId = await promptForCyberwarePlatform(eligiblePlatforms);

    if (!platformId) {
      return;
    }

    await item.update({ 'system.parentCyberwareId': platformId });
  }

  async _onRemovePlatform(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'cyberware' || item.system.integration !== 'extension') {
      return;
    }

    await item.update({ 'system.parentCyberwareId': null });
  }

  async _onSetGearState(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const state = event.currentTarget.dataset.state;
    if (!item || item.type !== 'gear' || !state) {
      return;
    }

    await item.update(getGearStateUpdateData(state));
  }

  async _onUpdateItemField(event) {
    const item = this._getItemFromEvent(event);
    const path = event.currentTarget.dataset.fieldPath;
    if (!item || !path) {
      return;
    }

    const rawValue = event.currentTarget.value;
    const value = event.currentTarget.dataset.dtype === 'Number' ? Number(rawValue) || 0 : rawValue;
    await item.update({ [path]: value });
  }

  async _onWeaponAttack(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) {
      return;
    }

    const weapon = (item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item))[weaponIndex];
    if (!weapon) {
      return;
    }

    const baseSkill = item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill;
    const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill;
    await this.document.rollSkill({ skillSlug });
  }

  async _onWeaponReload(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    const magazine = Number.parseInt(event.currentTarget.dataset.magazine ?? '0', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) {
      return;
    }

    await item.update({ [`system.weapons.${weaponIndex}.ammoCurrent`]: Math.max(magazine, 0) });
  }

  async _onEditProfileImage(event) {
    event.preventDefault();
    if (!this.document.isOwner && game.user.role < CONST.USER_ROLES.ASSISTANT) {
      return;
    }

    const current = this.document.img || '';
    const picker = new FilePicker({
      type: 'imagevideo',
      current,
      callback: async (path) => {
        await this.document.update({ img: path });
      },
    });

    return picker.browse();
  }
}
