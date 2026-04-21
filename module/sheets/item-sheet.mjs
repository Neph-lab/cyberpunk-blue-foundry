import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { getBrandLogoPath } from '../helpers/branding.mjs';
import { applyWeaponTypeDefaults, createWeaponData, getWeaponTypeDefinition } from '../helpers/combat.mjs';
import { parsePsycheLossFormula } from '../helpers/cyberware.mjs';
import { GEAR_STATES, getGearStateUpdateData, normalizeGearState } from '../helpers/gear.mjs';
import {
  createWeaponChangeData,
  MOD_TYPES,
  WEAPON_MOD_FIELDS,
  WEAPON_MOD_MODES,
} from '../helpers/mods.mjs';
import {
  canEditRoleChoices,
  createLeaderFeatureData,
  createLeaderOptionData,
  createProteanFocusData,
  createRoleAbilitySectionData,
  createRoleGrantGroupData,
  createRoleGrantItemReferenceData,
  createSpecialistOptionData,
  createSpecialistOptionGroupData,
  createSpecialtyData,
  createSpecialtySectionData,
  normalizeRoleSystemData,
  prepareRoleSheetCategoryData,
} from '../helpers/roles.mjs';

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;

export class CyberBlueItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'item'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 720,
      height: 760,
    },
    window: {
      resizable: true,
    },
  }, { inplace: false });

  static PARTS = {
    sheet: {
      root: true,
      template: 'systems/cyberpunk-blue/templates/item/item-sheet.hbs',
    },
  };

  tabGroups = {
    primary: 'description',
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const itemData = this.document.toPlainObject();
    const canManageRestricted = game.user.role >= CONST.USER_ROLES.ASSISTANT;
    const canEditAsOwner = this.document.isOwner || canManageRestricted;
    const ownerActor = this.document.parent instanceof Actor ? this.document.parent : null;
    const roleRank = this.document.type === 'role'
      ? (ownerActor?.items.get(this.document.id)?.system.rank ?? itemData.system.rank ?? 0)
      : 0;
    if (this.document.type === 'role') {
      itemData.system = normalizeRoleSystemData(itemData.system ?? {});
    }

    context.cssClass = this.options.classes.join(' ');
    context.item = itemData;
    context.system = itemData.system;
    context.config = CONFIG.CYBER_BLUE;
    context.canManageRestricted = canManageRestricted;
    context.canEditAsOwner = canEditAsOwner;
    context.ownerActor = ownerActor;
    context.roleRank = roleRank;
    context.isDocumentOwner = this.document.isOwner;
    context.isRole = this.document.type === 'role';
    context.isAbility = this.document.type === 'ability';
    context.isCyberware = this.document.type === 'cyberware';
    context.isGear = this.document.type === 'gear';
    context.isAmmo = this.document.type === 'ammo';
    context.isProgramExecutable = this.document.type === 'programExecutable';
    context.isMod = this.document.type === 'mod';
    if (context.isGear) {
      itemData.system.state = normalizeGearState(itemData.system);
    }
    context.showAdvancedTab = (context.isCyberware || context.isGear)
      && (itemData.system.isArmor || itemData.system.isWeapon || itemData.system.isComputer);
    context.showWeaponSection = itemData.system.isWeapon || canManageRestricted;
    context.showCyberwareDetailsTab = context.isCyberware;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.description, {
      secrets: this.document.isOwner,
      async: true,
      rollData: this.document.parent?.getRollData?.() ?? {},
      relativeTo: this.document,
    });
    context.enrichedNotes = (context.isRole || context.isCyberware || context.isProgramExecutable)
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.notes, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    context.enrichedLifepathLinks = context.isRole
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.lifepathLinks, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    context.enrichedLifepathQuestions = context.isRole
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.lifepathQuestions, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    context.enrichedAbilityOverview = context.isRole
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.abilityOverview, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    const roleCategoryData = context.isRole
      ? prepareRoleSheetCategoryData(this.document, itemData, { roleRank, canManageRestricted })
      : null;
    context.roleCategoryData = roleCategoryData;
    context.roleCategories = CONFIG.CYBER_BLUE.roles?.categories ?? [];
    context.roleLeaderPermissions = CONFIG.CYBER_BLUE.roles?.leaderPermissions ?? [];
    context.roleCanEditChoices = context.isRole && canEditRoleChoices(this.document);
    context.roleShowRestrictedEditing = context.isRole && canManageRestricted;
    context.roleSections = context.isRole
      ? await Promise.all((roleCategoryData.abilitySections ?? []).map(async (section, index) => ({
        ...section,
        index,
        enrichedContent: await foundry.applications.ux.TextEditor.implementation.enrichHTML(section.content, {
          secrets: this.document.isOwner,
          async: true,
          rollData: this.document.parent?.getRollData?.() ?? {},
          relativeTo: this.document,
        }),
      })))
      : [];
    context.roleHighestUnlockedSection = context.isRole && roleCategoryData?.highestUnlockedSection
      ? {
        ...roleCategoryData.highestUnlockedSection,
        enrichedContent: await foundry.applications.ux.TextEditor.implementation.enrichHTML(roleCategoryData.highestUnlockedSection.content ?? '', {
          secrets: this.document.isOwner,
          async: true,
          rollData: this.document.parent?.getRollData?.() ?? {},
          relativeTo: this.document,
        }),
      }
      : null;
    context.roleLeaderFeatures = context.isRole
      ? roleCategoryData.unlockedLeaderFeatures.map((feature) => ({
        ...feature,
        featureIndex: (itemData.system.leaderFeatures ?? []).findIndex((f) => f.id === feature.id),
        options: (feature.options ?? []).map((option, optionIndex) => ({
          ...option,
          optionIndex,
          selected: (feature.selectedUuids ?? []).includes(option.uuid),
        })),
        selectedUuids: feature.selectedUuids ?? [],
      }))
      : [];
    context.roleProteanFoci = context.isRole
      ? roleCategoryData.unlockedProteanFoci.map((focus) => ({
        ...focus,
        focusIndex: (itemData.system.proteanFoci ?? []).findIndex((f) => f.id === focus.id),
      }))
      : [];
    context.roleSpecialties = context.isRole
      ? await Promise.all(roleCategoryData.specialties.map(async (specialty, specialtyIndex) => ({
        ...specialty,
        specialtyIndex,
        enrichedSections: await Promise.all((specialty.unlockedSections ?? []).map(async (section, sectionIndex) => ({
          ...section,
          sectionIndex,
          enrichedContent: await foundry.applications.ux.TextEditor.implementation.enrichHTML(section.content ?? '', {
            secrets: this.document.isOwner,
            async: true,
            rollData: this.document.parent?.getRollData?.() ?? {},
            relativeTo: this.document,
          }),
        }))),
        optionGroups: (specialty.unlockedOptionGroups ?? []).map((group) => ({
          ...group,
          groupIndex: (specialty.optionGroups ?? []).findIndex((g) => g.id === group.id),
        })),
      })))
      : [];
    context.effects = prepareActiveEffectCategories(
      this.document.effects.filter((effect) => !effect.getFlag('cyberpunk-blue', 'modId'))
    );
    context.showEffectsTab = !context.isCyberware && !context.isAmmo && !context.isProgramExecutable
      && (!(context.isAbility || context.isGear) || canManageRestricted);
    context.showProgramExecutableNotesTab = context.isProgramExecutable && (this.document.isOwner || game.user.isGM);
    context.ammoTypeOptions = [
      { value: 'pistol', label: 'Pistol' },
      { value: 'smg', label: 'SMG' },
      { value: 'shotgun', label: 'Shotgun' },
      { value: 'assault', label: 'Assault Rifle' },
      { value: 'sniper', label: 'Sniper Rifle' },
      { value: 'bow', label: 'Bow' },
      { value: 'grenade', label: 'Grenade Launcher' },
      { value: 'rocket', label: 'Rocket Launcher' },
    ];
    context.programTypes = [
      { value: 'antipersonnel', label: 'Anti-Personnel' },
      { value: 'antiprogram', label: 'Anti-Program' },
      { value: 'defender', label: 'Defender' },
      { value: 'booster', label: 'Booster' },
      { value: 'quickhack', label: 'Quickhack' },
      { value: 'ice', label: 'ICE' },
      { value: 'blackice', label: 'Black ICE' },
      { value: 'daemon', label: 'Daemon' },
      { value: 'malware', label: 'Malware' },
    ];
    context.modTypes = MOD_TYPES;
    context.weaponModFields = WEAPON_MOD_FIELDS;
    context.weaponModModes = WEAPON_MOD_MODES;
    context.showRoleNotesTab = context.isRole && (this.document.isOwner || game.user.isGM);
    context.showCyberwareNotesTab = context.isCyberware && (this.document.isOwner || game.user.isGM);
    context.costLadder = CONFIG.CYBER_BLUE.costLadder ?? [];
    context.manufacturers = CONFIG.CYBER_BLUE.manufacturers ?? [];
    context.manufacturerLogo = await getBrandLogoPath(itemData.system.manufacturer);
    context.showReadonlyManufacturer = !canManageRestricted;
    context.cyberwareConfig = CONFIG.CYBER_BLUE.cyberware ?? {};
    context.combatConfig = CONFIG.CYBER_BLUE.combat ?? {};
    context.gearStates = GEAR_STATES;
    context.showSlotsUsed = context.isCyberware && itemData.system.integration === 'extension';
    context.showSlotsProvided = context.isCyberware && itemData.system.integration === 'platform';
    context.cyberwareTypeLabel = context.cyberwareConfig.types?.find((entry) => entry.value === itemData.system.cyberwareType)?.label ?? itemData.system.cyberwareType;
    context.cyberwareIntegrationLabel = context.cyberwareConfig.integrations?.find((entry) => entry.value === itemData.system.integration)?.label ?? itemData.system.integration;
    context.cyberwareFacilityLabel = context.cyberwareConfig.facilities?.find((entry) => entry.value === itemData.system.facilities)?.label ?? itemData.system.facilities;
    context.weapons = (itemData.system.weapons ?? []).map((weapon, index) => {
      const definition = getWeaponTypeDefinition(weapon.type);
      return {
        ...weapon,
        index,
        definition,
        displayMagazine: definition.usesMagazine ? `${Math.max(Math.min(Number(weapon.ammoCurrent) || 0, Number(weapon.magazine) || 0), 0)} / ${Math.max(Number(weapon.magazine) || 0, 0)}` : null,
        skillOptions: definition.skillOptions.map((skillSlug) => ({
          value: skillSlug,
          label: CONFIG.CYBER_BLUE.skills[skillSlug]?.label ?? skillSlug,
        })),
        rangeBands: (CONFIG.CYBER_BLUE.combat?.rangeBands ?? []).map((band) => ({
          ...band,
          value: Number(weapon.rangeTable?.[band.index] ?? 0) || 0,
          isBlocked: (Number(weapon.rangeTable?.[band.index] ?? 0) || 0) === 0,
          displayValue: (Number(weapon.rangeTable?.[band.index] ?? 0) || 0) === 0 ? '-' : `${Number(weapon.rangeTable?.[band.index] ?? 0) || 0}`,
        })),
      };
    });
    context.cyberwarePsyche = context.isCyberware
      ? parsePsycheLossFormula(itemData.system.psycheLossFormula)
      : null;
    context.installedMods = (context.isGear || context.isCyberware) && ownerActor
      ? ownerActor.items.filter((i) => i.type === 'mod' && i.system.installedOnId === this.document.id)
          .map((i) => ({ id: i.id, name: i.name, modType: i.system.modType, typeLabel: MOD_TYPES.find((t) => t.value === i.system.modType)?.label ?? i.system.modType }))
      : [];
    context.installedOnOptions = context.isMod && ownerActor
      ? ownerActor.items.filter((i) => ['gear', 'cyberware'].includes(i.type))
          .map((i) => ({ value: i.id, label: i.name }))
      : [];
    context.installedOnName = context.isMod && ownerActor
      ? (ownerActor.items.get(itemData.system.installedOnId)?.name ?? '')
      : '';
    context.eligiblePlatforms = context.isCyberware ? this.document.getCyberwareEligiblePlatforms() : [];
    context.currentPlatform = context.eligiblePlatforms.find((platform) => platform.isSelected) ?? null;
    context.cyberwareDisable = context.isCyberware ? this.document.getCyberwareDisableState() : null;
    context.cyberwareDisableText = context.cyberwareDisable
      ? game.i18n.format('CYBER_BLUE.Cyberware.Disable.ByEffects', {
        effects: context.cyberwareDisable.effectNames.join(', '),
      })
      : '';

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const tabNavigation = this.element.querySelector('.sheet-tabs');
    if (tabNavigation) {
    const tabs = new Tabs({
      navSelector: '.sheet-tabs',
      contentSelector: '.sheet-body',
      initial: this.tabGroups.primary ?? 'description',
      callback: (_event, _tabs, active) => {
        this.tabGroups.primary = active;
      },
    });
    tabs.bind(this.element);
    }

    this.element.querySelectorAll('.effect-control').forEach((button) => {
      button.addEventListener('click', (event) => onManageActiveEffect(event, this.document));
    });
    this.element.querySelectorAll('[data-action="add-role-section"]').forEach((button) => {
      button.addEventListener('click', this._onAddRoleSection.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-role-section"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveRoleSection.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-role-grant-group"]').forEach((button) => {
      button.addEventListener('click', this._onAddRoleGrantGroup.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-role-grant-group"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveRoleGrantGroup.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-role-grant-item"]').forEach((button) => {
      button.addEventListener('click', this._onAddRoleGrantItem.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-role-grant-item"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveRoleGrantItem.bind(this));
    });
    this.element.querySelectorAll('[data-action="populate-role-reference"]').forEach((button) => {
      button.addEventListener('click', this._onPopulateRoleReference.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-leader-feature"]').forEach((button) => {
      button.addEventListener('click', this._onAddLeaderFeature.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-leader-feature"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveLeaderFeature.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-leader-option"]').forEach((button) => {
      button.addEventListener('click', this._onAddLeaderOption.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-leader-option"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveLeaderOption.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-leader-selection"]').forEach((input) => {
      input.addEventListener('change', this._onToggleLeaderSelection.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-protean-focus"]').forEach((button) => {
      button.addEventListener('click', this._onAddProteanFocus.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-protean-focus"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveProteanFocus.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-specialty"]').forEach((button) => {
      button.addEventListener('click', this._onAddSpecialty.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-specialty"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveSpecialty.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-specialty-section"]').forEach((button) => {
      button.addEventListener('click', this._onAddSpecialtySection.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-specialty-section"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveSpecialtySection.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-specialty-option-group"]').forEach((button) => {
      button.addEventListener('click', this._onAddSpecialtyOptionGroup.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-specialty-option-group"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveSpecialtyOptionGroup.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-specialty-option"]').forEach((button) => {
      button.addEventListener('click', this._onAddSpecialtyOption.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-specialty-option"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveSpecialtyOption.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-specialty-option"]').forEach((input) => {
      input.addEventListener('change', this._onToggleSpecialtyOption.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-weapon"]').forEach((button) => {
      button.addEventListener('click', this._onAddWeapon.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-weapon"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveWeapon.bind(this));
    });
    this.element.querySelectorAll('[data-weapon-type-select]').forEach((select) => {
      select.addEventListener('change', this._onWeaponTypeChange.bind(this));
    });
    this.element.querySelectorAll('[data-range-input]').forEach((input) => {
      input.addEventListener('change', this._onRangeTableChange.bind(this));
    });
    this.element.querySelectorAll('[data-cyberware-integration]').forEach((select) => {
      select.addEventListener('change', this._onCyberwareIntegrationChange.bind(this));
    });
    this.element.querySelectorAll('[data-edit="img"]').forEach((element) => {
      element.addEventListener('click', this._onEditProfileImage.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-mod-weapon-change"]').forEach((button) => {
      button.addEventListener('click', this._onAddModWeaponChange.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-mod-weapon-change"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveModWeaponChange.bind(this));
    });
    this.element.querySelector('[data-action="roll-executable-atk"]')
      ?.addEventListener('click', () => this._onRollExecutableStat('atk'));
    this.element.querySelector('[data-action="roll-executable-per"]')
      ?.addEventListener('click', () => this._onRollExecutableStat('per'));
  }

  async _onRollExecutableStat(stat) {
    const value = Number(this.document.system[stat]) || 0;
    const roll = await new Roll(`1d10 + ${value}`).evaluate();
    const label = stat === 'atk' ? 'ATK' : 'PER';
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document.parent }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${this.document.name}: ${label}</h3></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  async _onAddRoleSection(event) {
    event.preventDefault();
    const system = this._cloneRoleSystem();
    system.abilitySections.push(createRoleAbilitySectionData());
    await this.document.update({ system });
  }

  async _onRemoveRoleSection(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.sectionIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const system = this._cloneRoleSystem();
    system.abilitySections.splice(index, 1);
    await this.document.update({ system });
  }

  _cloneRoleSystem() {
    return normalizeRoleSystemData(this.document.system.toObject?.() ?? this.document.system);
  }

  async _onAddRoleGrantGroup(event) {
    event.preventDefault();
    const system = this._cloneRoleSystem();
    system.grantedItemGroups.push(createRoleGrantGroupData());
    await this.document.update({ system });
  }

  async _onRemoveRoleGrantGroup(event) {
    event.preventDefault();
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    if (Number.isNaN(groupIndex) || groupIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.grantedItemGroups.splice(groupIndex, 1);
    await this.document.update({ system });
  }

  async _onAddRoleGrantItem(event) {
    event.preventDefault();
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    if (Number.isNaN(groupIndex) || groupIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.grantedItemGroups[groupIndex]?.items.push(createRoleGrantItemReferenceData());
    await this.document.update({ system });
  }

  async _onRemoveRoleGrantItem(event) {
    event.preventDefault();
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    const itemIndex = Number.parseInt(event.currentTarget.dataset.itemIndex ?? '-1', 10);
    if (Number.isNaN(groupIndex) || groupIndex < 0 || Number.isNaN(itemIndex) || itemIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.grantedItemGroups[groupIndex]?.items.splice(itemIndex, 1);
    await this.document.update({ system });
  }

  async _onPopulateRoleReference(event) {
    event.preventDefault();
    const uuid = window.prompt('Enter a Foundry UUID');
    if (!uuid) {
      return;
    }
    const document = await fromUuid(uuid);
    if (!(document instanceof Item || document instanceof Actor)) {
      ui.notifications.warn('The UUID must resolve to an Item or Actor.');
      return;
    }
    const path = event.currentTarget.dataset.referencePath;
    if (!path) {
      return;
    }
    await this.document.update({
      [`${path}.uuid`]: uuid,
      [`${path}.name`]: document.name,
      [`${path}.img`]: document.img || '',
      [`${path}.type`]: document.documentName.toLowerCase(),
    });
  }

  async _onAddLeaderFeature(event) {
    event.preventDefault();
    const system = this._cloneRoleSystem();
    system.leaderFeatures.push(createLeaderFeatureData());
    await this.document.update({ system });
  }

  async _onRemoveLeaderFeature(event) {
    event.preventDefault();
    const featureIndex = Number.parseInt(event.currentTarget.dataset.featureIndex ?? '-1', 10);
    if (Number.isNaN(featureIndex) || featureIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.leaderFeatures.splice(featureIndex, 1);
    await this.document.update({ system });
  }

  async _onAddLeaderOption(event) {
    event.preventDefault();
    const featureIndex = Number.parseInt(event.currentTarget.dataset.featureIndex ?? '-1', 10);
    if (Number.isNaN(featureIndex) || featureIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.leaderFeatures[featureIndex]?.options.push(createLeaderOptionData());
    await this.document.update({ system });
  }

  async _onRemoveLeaderOption(event) {
    event.preventDefault();
    const featureIndex = Number.parseInt(event.currentTarget.dataset.featureIndex ?? '-1', 10);
    const optionIndex = Number.parseInt(event.currentTarget.dataset.optionIndex ?? '-1', 10);
    if (Number.isNaN(featureIndex) || featureIndex < 0 || Number.isNaN(optionIndex) || optionIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.leaderFeatures[featureIndex]?.options.splice(optionIndex, 1);
    await this.document.update({ system });
  }

  async _onToggleLeaderSelection(event) {
    const featureIndex = Number.parseInt(event.currentTarget.dataset.featureIndex ?? '-1', 10);
    const sourceUuid = event.currentTarget.dataset.sourceUuid;
    if (Number.isNaN(featureIndex) || featureIndex < 0 || !sourceUuid) {
      return;
    }
    const system = this._cloneRoleSystem();
    const feature = system.leaderFeatures[featureIndex];
    if (!feature) {
      return;
    }
    const next = new Set(feature.selectedUuids ?? []);
    if (event.currentTarget.checked) {
      next.add(sourceUuid);
    } else {
      next.delete(sourceUuid);
    }
    feature.selectedUuids = Array.from(next).slice(0, Math.max(Number(feature.selectionCount) || 0, 0));
    await this.document.update({ system });
  }

  async _onAddProteanFocus(event) {
    event.preventDefault();
    const system = this._cloneRoleSystem();
    system.proteanFoci.push(createProteanFocusData());
    await this.document.update({ system });
  }

  async _onRemoveProteanFocus(event) {
    event.preventDefault();
    const focusIndex = Number.parseInt(event.currentTarget.dataset.focusIndex ?? '-1', 10);
    if (Number.isNaN(focusIndex) || focusIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.proteanFoci.splice(focusIndex, 1);
    await this.document.update({ system });
  }

  async _onAddSpecialty(event) {
    event.preventDefault();
    const system = this._cloneRoleSystem();
    system.specialties.push(createSpecialtyData());
    await this.document.update({ system });
  }

  async _onRemoveSpecialty(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties.splice(specialtyIndex, 1);
    await this.document.update({ system });
  }

  async _onAddSpecialtySection(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties[specialtyIndex]?.unlockSections.push(createSpecialtySectionData());
    await this.document.update({ system });
  }

  async _onRemoveSpecialtySection(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    const sectionIndex = Number.parseInt(event.currentTarget.dataset.sectionIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0 || Number.isNaN(sectionIndex) || sectionIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties[specialtyIndex]?.unlockSections.splice(sectionIndex, 1);
    await this.document.update({ system });
  }

  async _onAddSpecialtyOptionGroup(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties[specialtyIndex]?.optionGroups.push(createSpecialistOptionGroupData());
    await this.document.update({ system });
  }

  async _onRemoveSpecialtyOptionGroup(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0 || Number.isNaN(groupIndex) || groupIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties[specialtyIndex]?.optionGroups.splice(groupIndex, 1);
    await this.document.update({ system });
  }

  async _onAddSpecialtyOption(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0 || Number.isNaN(groupIndex) || groupIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties[specialtyIndex]?.optionGroups[groupIndex]?.options.push(createSpecialistOptionData());
    await this.document.update({ system });
  }

  async _onRemoveSpecialtyOption(event) {
    event.preventDefault();
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    const optionIndex = Number.parseInt(event.currentTarget.dataset.optionIndex ?? '-1', 10);
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0 || Number.isNaN(groupIndex) || groupIndex < 0 || Number.isNaN(optionIndex) || optionIndex < 0) {
      return;
    }
    const system = this._cloneRoleSystem();
    system.specialties[specialtyIndex]?.optionGroups[groupIndex]?.options.splice(optionIndex, 1);
    await this.document.update({ system });
  }

  async _onToggleSpecialtyOption(event) {
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    const optionId = event.currentTarget.dataset.optionId;
    if (Number.isNaN(specialtyIndex) || specialtyIndex < 0 || Number.isNaN(groupIndex) || groupIndex < 0 || !optionId) {
      return;
    }
    const system = this._cloneRoleSystem();
    const group = system.specialties[specialtyIndex]?.optionGroups[groupIndex];
    if (!group) {
      return;
    }
    const next = new Set(group.selectedOptionIds ?? []);
    if (event.currentTarget.checked) {
      next.add(optionId);
    } else {
      next.delete(optionId);
    }
    group.selectedOptionIds = Array.from(next).slice(0, Math.max(Number(group.choices) || 0, 0));
    await this.document.update({ system });
  }

  async _onAddWeapon(event) {
    event.preventDefault();
    const weapons = (this.document.system.toObject?.() ?? this.document.system).weapons ?? [];
    weapons.push(createWeaponData());
    await this.document.update({ 'system.weapons': weapons, 'system.isWeapon': true });
  }

  async _onRemoveWeapon(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const weapons = (this.document.system.toObject?.() ?? this.document.system).weapons ?? [];
    weapons.splice(index, 1);
    await this.document.update({ 'system.weapons': weapons });
  }

  async _onWeaponTypeChange(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const index = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const weapons = (this.document.system.toObject?.() ?? this.document.system).weapons ?? [];
    weapons[index] = applyWeaponTypeDefaults(weapons[index], event.currentTarget.value);
    await this.document.update({ 'system.weapons': weapons });
  }

  async _onRangeTableChange(event) {
    event.preventDefault();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    const bandIndex = Number.parseInt(event.currentTarget.dataset.bandIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0 || Number.isNaN(bandIndex) || bandIndex < 0) {
      return;
    }

    const weapons = (this.document.system.toObject?.() ?? this.document.system).weapons ?? [];
    const rawValue = `${event.currentTarget.value ?? ''}`.trim();
    const nextValue = rawValue === '-' ? 0 : Math.max(Number(rawValue) || 0, 0);
    weapons[weaponIndex].rangeTable[bandIndex] = nextValue;
    await this.document.update({ 'system.weapons': weapons });
  }

  async _onCyberwareIntegrationChange(event) {
    event.preventDefault();
    const integration = event.currentTarget.value;
    const update = { 'system.integration': integration };
    const currentSlotsUsed = Number(this.document.system.slotsUsed) || 0;
    const currentSlotsProvided = Number(this.document.system.slotsProvided) || 0;

    if (integration === 'extension') {
      update['system.slotsUsed'] = currentSlotsUsed > 0 ? currentSlotsUsed : 1;
      update['system.slotsProvided'] = 0;
    } else if (integration === 'platform') {
      update['system.slotsProvided'] = currentSlotsProvided > 0 ? currentSlotsProvided : 1;
      update['system.slotsUsed'] = 0;
      update['system.parentCyberwareId'] = null;
    } else {
      update['system.slotsUsed'] = 0;
      update['system.slotsProvided'] = 0;
      update['system.parentCyberwareId'] = null;
    }

    await this.document.update(update);
  }

  async _onAddModWeaponChange(event) {
    event.preventDefault();
    const system = this.document.system.toObject?.() ?? this.document.system;
    const weaponChanges = [...(system.weaponChanges ?? [])];
    weaponChanges.push(createWeaponChangeData());
    await this.document.update({ 'system.weaponChanges': weaponChanges });
  }

  async _onRemoveModWeaponChange(event) {
    event.preventDefault();
    const changeIndex = Number.parseInt(event.currentTarget.dataset.changeIndex ?? '-1', 10);
    if (Number.isNaN(changeIndex) || changeIndex < 0) {
      return;
    }
    const system = this.document.system.toObject?.() ?? this.document.system;
    const weaponChanges = [...(system.weaponChanges ?? [])];
    weaponChanges.splice(changeIndex, 1);
    await this.document.update({ 'system.weaponChanges': weaponChanges });
  }

  async _onEditProfileImage(event) {
    event.preventDefault();
    if (!this.document.isOwner && game.user.role < CONST.USER_ROLES.ASSISTANT) {
      return;
    }

    const current = this.document.img || '';
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: 'imagevideo',
      current,
      callback: async (path) => {
        await this.document.update({ img: path });
      },
    });

    return picker.browse();
  }
}
