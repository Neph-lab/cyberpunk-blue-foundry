import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { getBrandLogoPath } from '../helpers/branding.mjs';
import { applyWeaponTypeDefaults, createWeaponData, getWeaponTypeDefinition } from '../helpers/combat.mjs';
import { parsePsycheLossFormula } from '../helpers/cyberware.mjs';
import { GEAR_STATES, getGearStateUpdateData, normalizeGearState } from '../helpers/gear.mjs';
import {
  createItemModificationData,
  createWeaponChangeData,
  getModificationEffects,
  getModificationValidation,
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
    if (context.isGear) {
      itemData.system.state = normalizeGearState(itemData.system);
    }
    context.showCombatTab = (context.isCyberware || context.isGear)
      && (itemData.system.isArmor || itemData.system.isWeapon);
    context.showCyberwareDetailsTab = context.isCyberware;
    context.enrichedDescription = await TextEditor.enrichHTML(itemData.system.description, {
      secrets: this.document.isOwner,
      async: true,
      rollData: this.document.parent?.getRollData?.() ?? {},
      relativeTo: this.document,
    });
    context.enrichedNotes = (context.isRole || context.isCyberware)
      ? await TextEditor.enrichHTML(itemData.system.notes, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    context.enrichedLifepathLinks = context.isRole
      ? await TextEditor.enrichHTML(itemData.system.lifepathLinks, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    context.enrichedLifepathQuestions = context.isRole
      ? await TextEditor.enrichHTML(itemData.system.lifepathQuestions, {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    context.enrichedAbilityOverview = context.isRole
      ? await TextEditor.enrichHTML(itemData.system.abilityOverview, {
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
        enrichedContent: await TextEditor.enrichHTML(section.content, {
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
        enrichedContent: await TextEditor.enrichHTML(roleCategoryData.highestUnlockedSection.content ?? '', {
          secrets: this.document.isOwner,
          async: true,
          rollData: this.document.parent?.getRollData?.() ?? {},
          relativeTo: this.document,
        }),
      }
      : null;
    context.roleLeaderFeatures = context.isRole
      ? roleCategoryData.unlockedLeaderFeatures.map((feature, featureIndex) => ({
        ...feature,
        featureIndex,
        options: (feature.options ?? []).map((option, optionIndex) => ({
          ...option,
          optionIndex,
          selected: (feature.selectedUuids ?? []).includes(option.uuid),
        })),
        selectedUuids: feature.selectedUuids ?? [],
      }))
      : [];
    context.roleProteanFoci = context.isRole
      ? roleCategoryData.unlockedProteanFoci.map((focus, focusIndex) => ({
        ...focus,
        focusIndex,
      }))
      : [];
    context.roleSpecialties = context.isRole
      ? await Promise.all(roleCategoryData.specialties.map(async (specialty, specialtyIndex) => ({
        ...specialty,
        specialtyIndex,
        enrichedSections: await Promise.all((specialty.unlockedSections ?? []).map(async (section, sectionIndex) => ({
          ...section,
          sectionIndex,
          enrichedContent: await TextEditor.enrichHTML(section.content ?? '', {
            secrets: this.document.isOwner,
            async: true,
            rollData: this.document.parent?.getRollData?.() ?? {},
            relativeTo: this.document,
          }),
        }))),
        optionGroups: (specialty.unlockedOptionGroups ?? []).map((group, groupIndex) => ({
          ...group,
          groupIndex,
        })),
      })))
      : [];
    context.effects = prepareActiveEffectCategories(
      this.document.effects.filter((effect) => !effect.getFlag('cyberpunk-blue', 'modId'))
    );
    context.showEffectsTab = !context.isCyberware && (!(context.isAbility || context.isGear) || canManageRestricted);
    context.showRoleNotesTab = context.isRole && (this.document.isOwner || game.user.isGM);
    context.showCyberwareNotesTab = context.isCyberware && (this.document.isOwner || game.user.isGM);
    context.costLadder = CONFIG.CYBER_BLUE.costLadder ?? [];
    context.manufacturers = CONFIG.CYBER_BLUE.manufacturers ?? [];
    context.manufacturerLogo = await getBrandLogoPath(itemData.system.manufacturer);
    context.showReadonlyManufacturer = !canManageRestricted;
    context.cyberwareConfig = CONFIG.CYBER_BLUE.cyberware ?? {};
    context.combatConfig = CONFIG.CYBER_BLUE.combat ?? {};
    context.gearStates = GEAR_STATES;
    context.modificationConfig = CONFIG.CYBER_BLUE.modifications ?? {};
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
    context.mods = await Promise.all((itemData.system.mods ?? []).map(async (mod, index) => {
      const validation = getModificationValidation(itemData, mod);
      const modEffects = getModificationEffects(this.document, mod.id);
      return {
        ...mod,
        index,
        validation,
        isValid: validation.valid,
        typeLabel: (CONFIG.CYBER_BLUE.modifications?.types ?? []).find((entry) => entry.value === mod.type)?.label ?? mod.type,
        weaponOptions: (itemData.system.weapons ?? []).map((weapon, weaponIndex) => ({
          index: weaponIndex,
          label: `${weaponIndex + 1}. ${getWeaponTypeDefinition(weapon.type).label}`,
          selected: weaponIndex === Number(mod.targetWeaponIndex),
        })),
        enrichedDescription: await TextEditor.enrichHTML(mod.description ?? '', {
          secrets: this.document.isOwner,
          async: true,
          rollData: this.document.parent?.getRollData?.() ?? {},
          relativeTo: this.document,
        }),
        effects: modEffects.map((effect) => ({
          id: effect.id,
          name: effect.name,
          icon: effect.img || effect.icon,
          disabled: effect.disabled,
        })),
      };
    }));
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
    this.element.querySelectorAll('[data-action="add-mod"]').forEach((button) => {
      button.addEventListener('click', this._onAddMod.bind(this));
    });
    this.element.querySelectorAll('[data-action="delete-mod"]').forEach((button) => {
      button.addEventListener('click', this._onDeleteMod.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-weapon-change"]').forEach((button) => {
      button.addEventListener('click', this._onAddWeaponChange.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-weapon-change"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveWeaponChange.bind(this));
    });
    this.element.querySelectorAll('[data-action="create-mod-effect"]').forEach((button) => {
      button.addEventListener('click', this._onCreateModEffect.bind(this));
    });
    this.element.querySelectorAll('[data-action="edit-mod-effect"]').forEach((button) => {
      button.addEventListener('click', this._onEditModEffect.bind(this));
    });
    this.element.querySelectorAll('[data-action="delete-mod-effect"]').forEach((button) => {
      button.addEventListener('click', this._onDeleteModEffect.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-mod-effect"]').forEach((button) => {
      button.addEventListener('click', this._onToggleModEffect.bind(this));
    });
    this.element.querySelectorAll('[data-edit="img"]').forEach((element) => {
      element.addEventListener('click', this._onEditProfileImage.bind(this));
    });
  }

  async _onAddRoleSection(event) {
    event.preventDefault();
    const sections = foundry.utils.deepClone(this.document.system.abilitySections ?? []);
    sections.push(createRoleAbilitySectionData());
    await this.document.update({ 'system.abilitySections': sections });
  }

  async _onRemoveRoleSection(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.sectionIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const sections = foundry.utils.deepClone(this.document.system.abilitySections ?? []);
    sections.splice(index, 1);
    await this.document.update({ 'system.abilitySections': sections });
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
    const weapons = foundry.utils.deepClone(this.document.system.weapons ?? []);
    weapons.push(createWeaponData());
    await this.document.update({ 'system.weapons': weapons, 'system.isWeapon': true });
  }

  async _onRemoveWeapon(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const weapons = foundry.utils.deepClone(this.document.system.weapons ?? []);
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

    const weapons = foundry.utils.deepClone(this.document.system.weapons ?? []);
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

    const weapons = foundry.utils.deepClone(this.document.system.weapons ?? []);
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

  async _onAddMod(event) {
    event.preventDefault();
    const select = this.element.querySelector('[data-mod-type-select]');
    const type = select?.value || (this.document.type === 'cyberware' ? 'cyberwareMod' : 'gearMod');
    const mods = foundry.utils.deepClone(this.document.system.mods ?? []);
    mods.push(createItemModificationData(type));
    await this.document.update({ 'system.mods': mods });
  }

  async _onDeleteMod(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.modIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const mods = foundry.utils.deepClone(this.document.system.mods ?? []);
    const [removed] = mods.splice(index, 1);
    if (removed?.id) {
      const effectIds = this.document.getModificationEffects(removed.id).map((effect) => effect.id);
      if (effectIds.length) {
        await this.document.deleteEmbeddedDocuments('ActiveEffect', effectIds);
      }
    }
    await this.document.update({ 'system.mods': mods });
  }

  async _onAddWeaponChange(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.modIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) {
      return;
    }

    const mods = foundry.utils.deepClone(this.document.system.mods ?? []);
    mods[index].weaponChanges ??= [];
    mods[index].weaponChanges.push(createWeaponChangeData());
    await this.document.update({ 'system.mods': mods });
  }

  async _onRemoveWeaponChange(event) {
    event.preventDefault();
    const modIndex = Number.parseInt(event.currentTarget.dataset.modIndex ?? '-1', 10);
    const changeIndex = Number.parseInt(event.currentTarget.dataset.changeIndex ?? '-1', 10);
    if (Number.isNaN(modIndex) || modIndex < 0 || Number.isNaN(changeIndex) || changeIndex < 0) {
      return;
    }

    const mods = foundry.utils.deepClone(this.document.system.mods ?? []);
    mods[modIndex]?.weaponChanges?.splice(changeIndex, 1);
    await this.document.update({ 'system.mods': mods });
  }

  async _onCreateModEffect(event) {
    event.preventDefault();
    const modId = event.currentTarget.dataset.modId;
    if (!modId) {
      return;
    }

    await this.document.createEmbeddedDocuments('ActiveEffect', [{
      name: game.i18n.format('DOCUMENT.New', {
        type: game.i18n.localize('DOCUMENT.ActiveEffect'),
      }),
      icon: 'icons/svg/aura.svg',
      origin: this.document.uuid,
      transfer: true,
      flags: {
        'cyberpunk-blue': {
          modId,
        },
      },
    }]);
  }

  async _onEditModEffect(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const effect = effectId ? this.document.effects.get(effectId) : null;
    return effect?.sheet.render(true);
  }

  async _onDeleteModEffect(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const effect = effectId ? this.document.effects.get(effectId) : null;
    return effect?.delete();
  }

  async _onToggleModEffect(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    const effect = effectId ? this.document.effects.get(effectId) : null;
    if (!effect) {
      return;
    }

    await effect.update({ disabled: !effect.disabled });
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
