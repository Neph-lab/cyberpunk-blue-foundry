import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { getBrandLogoPath } from '../helpers/branding.mjs';
import { applyWeaponTypeDefaults, buildWeaponUpdate, createWeaponData, getWeaponTypeDefinition } from '../helpers/combat.mjs';
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
    // Save scroll positions before re-render
    if (this.element) {
      this._savedScrolls = [];
      for (const el of this.element.querySelectorAll('.tab, .sheet-body')) {
        if (el.scrollTop > 0) {
          const key = el.dataset.tab ? `[data-tab="${el.dataset.tab}"]` : el.className.split(' ')[0];
          this._savedScrolls.push({ key, scrollTop: el.scrollTop });
        }
      }
    }
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
    context.isDrug = this.document.type === 'drug';
    context.isMod = this.document.type === 'mod';
    if (context.isGear) {
      itemData.system.state = normalizeGearState(itemData.system);
    }
    context.showAdvancedTab = (context.isCyberware || context.isGear)
      && (itemData.system.isArmor || itemData.system.isWeapon || itemData.system.isComputer || canManageRestricted);
    context.showWeaponSection = itemData.system.isWeapon || canManageRestricted;
    context.showCyberwareDetailsTab = context.isCyberware;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.description, {
      secrets: this.document.isOwner,
      async: true,
      rollData: this.document.parent?.getRollData?.() ?? {},
      relativeTo: this.document,
    });
    context.enrichedNotes = (context.isRole || context.isCyberware || context.isProgramExecutable || context.isGear || context.isDrug)
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.notes ?? '', {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.parent?.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';
    if (context.isDrug) {
      context.enrichedDrugPrimary = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.primaryEffect ?? '', { secrets: this.document.isOwner, async: true, relativeTo: this.document });
      context.enrichedDrugSecondary = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.secondaryEffect ?? '', { secrets: this.document.isOwner, async: true, relativeTo: this.document });
      context.enrichedDrugAddiction = await foundry.applications.ux.TextEditor.implementation.enrichHTML(itemData.system.addictionPenalty ?? '', { secrets: this.document.isOwner, async: true, relativeTo: this.document });
    }
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
    const allRoleSections = context.isRole
      ? (normalizeRoleSystemData(itemData.system ?? {}).abilitySections ?? [])
      : [];
    context.roleSectionsLocked = (context.isRole && !canManageRestricted && ownerActor)
      ? await Promise.all(allRoleSections
          .filter((section) => Number(section.unlockRank) > roleRank)
          .map(async (section) => ({
            ...section,
            enrichedContent: await foundry.applications.ux.TextEditor.implementation.enrichHTML(section.content ?? '', {
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

    // Disabled AEs on this item — available as targets for Affliction weapons
    context.itemDisabledEffects = this.document.effects
      .filter((e) => e.disabled && !e.getFlag('cyberpunk-blue', 'modId'))
      .map((e) => ({ id: e.id, name: e.name }));

    // Stat options for affliction primary-for-defense dropdown (no MOVE)
    context.afflictionStatOptions = Object.entries(CONFIG.CYBER_BLUE.stats ?? {})
      .filter(([key]) => key !== 'move')
      .map(([key, stat]) => ({ value: key, label: stat.shortLabel ?? key.toUpperCase() }));

    // Skill options for affliction skill-for-defense dropdown
    context.afflictionSkillOptions = Object.entries(CONFIG.CYBER_BLUE.skills ?? {})
      .map(([key, skill]) => ({ value: key, label: skill.label ?? key }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // ── Instruction sequence context (GM-only Advanced tab) ────────────────
    if ((context.isGear || context.isCyberware) && canManageRestricted) {
      // All non-mod effects on this item are available as instruction step targets
      context.instructionEffectOptions = this.document.effects
        .filter((e) => !e.getFlag('cyberpunk-blue', 'modId'))
        .map((e) => ({ id: e.id, name: e.name }));

      context.instructionStatOptions = Object.entries(CONFIG.CYBER_BLUE.stats ?? {})
        .filter(([key]) => key !== 'move')
        .map(([key, stat]) => ({ value: key, label: stat.shortLabel ?? key.toUpperCase() }));

      context.instructionSkillOptions = Object.entries(CONFIG.CYBER_BLUE.skills ?? {})
        .map(([key, skill]) => ({ value: key, label: skill.label ?? key }))
        .sort((a, b) => a.label.localeCompare(b.label));

      // Enrich each instruction step with component data derived from the selected skill
      context.instructionSteps = (itemData.system.instructions ?? []).map((step, index) => {
        const skillDef = step.skill ? (CONFIG.CYBER_BLUE.skills?.[step.skill] ?? null) : null;
        const componentSlugs = skillDef?.components ?? [];
        return {
          ...step,
          index,
          displayIndex: index + 1,
          skillHasComponents: componentSlugs.length > 0,
          componentOptions: componentSlugs.map((compSlug) => ({
            value: compSlug,
            label: CONFIG.CYBER_BLUE.components?.[compSlug]?.label ?? compSlug,
          })),
        };
      });
    } else {
      context.instructionEffectOptions = [];
      context.instructionStatOptions = [];
      context.instructionSkillOptions = [];
      context.instructionSteps = [];
    }

    context.showEffectsTab = !context.isCyberware && !context.isAmmo && !context.isProgramExecutable && !context.isDrug
      && (!(context.isAbility || context.isGear) || canManageRestricted);
    context.showProgramExecutableNotesTab = context.isProgramExecutable && (this.document.isOwner || game.user.isGM);
    context.ammoTypeOptions = [
      { value: 'pistol', label: 'Pistol' },
      { value: 'smg', label: 'SMG' },
      { value: 'shotgunSlug', label: 'Shotgun Slug' },
      { value: 'shotgunShell', label: 'Shotgun Shell' },
      { value: 'assault', label: 'Assault Rifle' },
      { value: 'sniper', label: 'Sniper Rifle' },
      { value: 'bow', label: 'Bow' },
      { value: 'grenade', label: 'Grenade Launcher' },
      { value: 'rocket', label: 'Rocket Launcher' },
      { value: 'flamethrower', label: 'Flamethrower' },
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
    context.showGearNotesTab = context.isGear && (this.document.isOwner || game.user.isGM);
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
    context.weapons = await Promise.all((itemData.system.weapons ?? []).map(async (weapon, index) => {
      const definition = getWeaponTypeDefinition(weapon.type);

      // Resolve ammo type UUID → display name
      let ammoTypeName = '';
      let ammoTypeResolved = false;
      if (definition.usesMagazine && weapon.ammoTypeUuid) {
        let ammoItem = null;
        try { ammoItem = await fromUuid(weapon.ammoTypeUuid); } catch { /* not found */ }
        if (!ammoItem) {
          // Fallback: search world Items for an ammo item with the same UUID or name match
          ammoItem = game.items?.find((i) => i.type === 'ammo' && i.uuid === weapon.ammoTypeUuid) ?? null;
        }
        if (ammoItem) {
          ammoTypeName = ammoItem.name;
          ammoTypeResolved = true;
        } else {
          // UUID no longer resolves — clear it via a background update (fire-and-forget)
          ammoTypeName = game.i18n.localize('CYBER_BLUE.Combat.AmmoNotFound');
          ammoTypeResolved = false;
        }
      }

      return {
        ...weapon,
        index,
        definition,
        ammoTypeName,
        ammoTypeResolved,
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
        autofireRangeBands: (CONFIG.CYBER_BLUE.combat?.rangeBands ?? []).map((band) => ({
          ...band,
          value: Number(weapon.autofireRangeTable?.[band.index] ?? 0) || 0,
          isBlocked: (Number(weapon.autofireRangeTable?.[band.index] ?? 0) || 0) === 0,
          displayValue: (Number(weapon.autofireRangeTable?.[band.index] ?? 0) || 0) === 0 ? '-' : `${Number(weapon.autofireRangeTable?.[band.index] ?? 0) || 0}`,
        })),
      };
    }));
    context.cyberwarePsyche = context.isCyberware
      ? parsePsycheLossFormula(itemData.system.psycheLossFormula)
      : null;
    context.installedMods = [];
    context.embeddedMods = (context.isGear || context.isCyberware)
      ? await Promise.all((itemData.system.embeddedMods ?? []).map(async (mod) => ({
          ...mod,
          typeLabel: MOD_TYPES.find((t) => t.value === mod.modType)?.label ?? mod.modType,
          enrichedDescription: mod.description ? await TextEditor.enrichHTML(mod.description, { async: true }) : '',
          weaponLabel: mod.targetWeaponIndex >= 0
            ? (itemData.system.weapons?.[mod.targetWeaponIndex]
                ? `Weapon ${mod.targetWeaponIndex + 1}`
                : `Weapon ${mod.targetWeaponIndex + 1} (missing)`)
            : '',
          importedEffects: (mod.importedEffects ?? []),
        })))
      : [];
    context.showEmbeddedModsPanel = (context.isGear || context.isCyberware) && canManageRestricted;
    context.showModsTab = context.showEmbeddedModsPanel;
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

  _prepareSubmitData(event, form, formData) {
    const data = super._prepareSubmitData(event, form, formData);
    // CRITICAL: super._prepareSubmitData runs the form data through SchemaField cleanData.
    // For ArrayField elements (like weapons), cleanData forces partial:false (see Foundry's
    // ArrayField._cleanElement), which fills in any MISSING fields with their schema `initial`
    // values. Several weapon fields are not in the form (the type <select> has no `name`,
    // and damageType/rangeTable/autofireRangeTable/etc. are managed by custom handlers).
    // So data.system.weapons[0] arrives here with type:'lightMelee', rangeTable:[0,...,0],
    // and other defaults — corrupting the weapon. We must NOT trust data.system.weapons.
    //
    // Instead, read the raw form input directly from formData.object (flat dot-path keys
    // exactly as the user submitted them) and merge ONLY those fields with the existing
    // weapon source data. This way fields not in the form are preserved untouched.
    //
    // Then emit each merged weapon field as a flat dot-path key. Per Foundry's
    // ArrayField._cleanType, any field present in the array element's incoming data is
    // preserved by clean(); only undefined fields fall back to the initial value. Since
    // we emit every field of every existing weapon, nothing is left undefined and the
    // weapon round-trips intact.
    const formObj = formData?.object ?? {};
    const formWeaponFields = {};
    const weaponFieldRegex = /^system\.weapons\.(\d+)\.(.+)$/;
    for (const [key, value] of Object.entries(formObj)) {
      const m = key.match(weaponFieldRegex);
      if (!m) continue;
      const i = m[1];
      const field = m[2];
      if (!formWeaponFields[i]) formWeaponFields[i] = {};
      formWeaponFields[i][field] = value;
    }

    // Always remove any nested weapons that super produced — they'd be corrupted by cleanData
    if (data?.system && 'weapons' in data.system) {
      delete data.system.weapons;
    }

    // If no weapon form fields were actually submitted, there's nothing more to do
    if (Object.keys(formWeaponFields).length === 0) {
      return data;
    }

    // Read existing weapons from _source (raw stored JSON, not cleaned/derived)
    const rawWeapons = this.document._source?.system?.weapons ?? [];

    // Seed every existing weapon so nothing is dropped, then overlay only form-submitted fields
    const patched = {};
    rawWeapons.forEach((w, i) => { patched[String(i)] = { ...w }; });
    for (const [key, formFields] of Object.entries(formWeaponFields)) {
      const i = Number(key);
      if (!Number.isFinite(i)) continue;
      const existing = rawWeapons[i] ?? {};
      patched[key] = {
        ...existing,    // start with full existing weapon (all 16 schema fields)
        ...formFields,  // overlay ONLY the fields the user actually submitted
      };
    }

    // Emit every field of every weapon as a flat dot-path key
    for (const [wIdx, weapon] of Object.entries(patched)) {
      for (const [field, value] of Object.entries(weapon)) {
        data[`system.weapons.${wIdx}.${field}`] = value;
      }
    }

    return data;
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
    this.element.querySelectorAll('[data-autofire-range-input]').forEach((input) => {
      input.addEventListener('change', this._onAutofireRangeTableChange.bind(this));
    });
    this.element.querySelectorAll('[data-weapon-damage-type]').forEach((input) => {
      input.addEventListener('change', this._onWeaponDamageTypeChange.bind(this));
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
    this.element.querySelector('[data-action="import-mod-by-uuid"]')
      ?.addEventListener('click', this._onImportModByUuid.bind(this));
    this.element.querySelector('[data-action="sync-embedded-mods"]')
      ?.addEventListener('click', this._onSyncEmbeddedMods.bind(this));
    this.element.querySelectorAll('[data-action="remove-embedded-mod"]').forEach((btn) => {
      btn.addEventListener('click', this._onRemoveEmbeddedMod.bind(this));
    });
    this.element.querySelector('[data-action="add-instruction"]')
      ?.addEventListener('click', this._onAddInstruction.bind(this));
    this.element.querySelectorAll('[data-action="remove-instruction"]').forEach((btn) => {
      btn.addEventListener('click', this._onRemoveInstruction.bind(this));
    });
    this.element.querySelectorAll('[data-action="move-instruction"]').forEach((btn) => {
      btn.addEventListener('click', this._onMoveInstruction.bind(this));
    });
    // Restore scroll positions after re-render
    if (this._savedScrolls?.length) {
      for (const { key, scrollTop } of this._savedScrolls) {
        const el = this.element.querySelector(key.startsWith('[') ? key : `.${key}`);
        if (el) el.scrollTop = scrollTop;
      }
      this._savedScrolls = null;
    }
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
    const doc = await fromUuid(uuid);
    if (!(doc instanceof Item || doc instanceof Actor)) {
      ui.notifications.warn('The UUID must resolve to an Item or Actor.');
      return;
    }
    const path = event.currentTarget.dataset.referencePath;
    if (!path) {
      return;
    }
    // Use full system clone to avoid issues with Foundry dot-path updates on ArrayFields
    const system = this._cloneRoleSystem();
    const pathWithoutSystem = path.replace(/^system\./, '');
    const ref = foundry.utils.getProperty(system, pathWithoutSystem) ?? {};
    ref.uuid = uuid;
    ref.name = doc.name ?? '';
    ref.img = doc.img || '';
    ref.type = doc.documentName.toLowerCase();
    foundry.utils.setProperty(system, pathWithoutSystem, ref);
    await this.document.update({ system });
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
    const specialty = system.specialties[specialtyIndex];
    const group = specialty?.optionGroups[groupIndex];
    if (!group) {
      return;
    }
    const next = new Set(group.selectedOptionIds ?? []);
    if (event.currentTarget.checked) {
      // Enforce cross-group total ≤ specialty rank
      const rank = Math.max(Number(specialty.rank) || 0, 0);
      const otherTotal = specialty.optionGroups.reduce((acc, g, gi) => {
        if (gi === groupIndex) return acc;
        return acc + (g.selectedOptionIds ?? []).length;
      }, 0);
      if (otherTotal + next.size + 1 > rank) {
        event.currentTarget.checked = false;
        return;
      }
      next.add(optionId);
    } else {
      next.delete(optionId);
    }
    group.selectedOptionIds = [...next];
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

    const rawWeapons = (this.document.system.toObject?.() ?? this.document.system).weapons ?? [];
    const newWeapon = applyWeaponTypeDefaults(rawWeapons[index], event.currentTarget.value);
    const updates = {};
    for (const [key, value] of Object.entries(newWeapon)) {
      updates[`system.weapons.${index}.${key}`] = value;
    }
    await this.document.update(updates);
  }

  async _onRangeTableChange(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    const bandIndex = Number.parseInt(event.currentTarget.dataset.bandIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0 || Number.isNaN(bandIndex) || bandIndex < 0) {
      return;
    }

    const weapons = this.document._source?.system?.weapons ?? [];
    const rawValue = `${event.currentTarget.value ?? ''}`.trim();
    const nextValue = rawValue === '-' ? 0 : Math.max(Number(rawValue) || 0, 0);
    const newTable = Array.isArray(weapons[weaponIndex]?.rangeTable)
      ? [...weapons[weaponIndex].rangeTable]
      : Array(8).fill(0);
    newTable[bandIndex] = nextValue;
    await this.document.update(buildWeaponUpdate(this.document, weaponIndex,{ rangeTable: newTable }));
  }

  async _onAutofireRangeTableChange(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    const bandIndex = Number.parseInt(event.currentTarget.dataset.bandIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0 || Number.isNaN(bandIndex) || bandIndex < 0) return;
    const weapons = this.document._source?.system?.weapons ?? [];
    const rawValue = `${event.currentTarget.value ?? ''}`.trim();
    const nextValue = rawValue === '-' ? 0 : Math.max(Number(rawValue) || 0, 0);
    const newTable = Array.isArray(weapons[weaponIndex]?.autofireRangeTable)
      ? [...weapons[weaponIndex].autofireRangeTable]
      : Array(8).fill(0);
    newTable[bandIndex] = nextValue;
    await this.document.update(buildWeaponUpdate(this.document, weaponIndex,{ autofireRangeTable: newTable }));
  }

  async _onWeaponDamageTypeChange(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    const weapons = this.document._source?.system?.weapons ?? [];
    const newType = event.currentTarget.value ?? '';
    const changes = { damageType: newType };
    if (newType === 'autofire') {
      const allZeros = (weapons[weaponIndex]?.autofireRangeTable ?? []).every((v) => v === 0);
      if (allZeros) {
        const definition = getWeaponTypeDefinition(weapons[weaponIndex]?.type);
        if (definition.defaultAutofireRangeTable) {
          changes.autofireRangeTable = definition.defaultAutofireRangeTable.slice();
        }
      }
    }
    // Note: rangeTable is intentionally preserved for all damage types (explosion uses it for scatter DV)
    await this.document.update(buildWeaponUpdate(this.document, weaponIndex,changes));
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

  async _onImportModByUuid(event) {
    event.preventDefault();
    const input = this.element.querySelector('[data-mod-import-uuid]');
    const uuid = (input?.value ?? '').trim();
    if (!uuid) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Sheet.Labels.ModImportNoUuid'));
      return;
    }
    let sourceItem;
    try {
      sourceItem = await fromUuid(uuid);
    } catch {
      ui.notifications.error(game.i18n.localize('CYBER_BLUE.Sheet.Labels.ModImportInvalidUuid'));
      return;
    }
    if (!sourceItem || sourceItem.type !== 'mod') {
      ui.notifications.error(game.i18n.localize('CYBER_BLUE.Sheet.Labels.ModImportNotMod'));
      return;
    }
    const system = this.document.system.toObject?.() ?? this.document.system;
    const embeddedMods = [...(system.embeddedMods ?? [])];
    embeddedMods.push({
      id: foundry.utils.randomID(),
      sourceUuid: uuid,
      modType: sourceItem.system.modType,
      name: sourceItem.name,
      cost: sourceItem.system.cost ?? '',
      note: sourceItem.system.note ?? '',
      description: sourceItem.system.description ?? '',
      importedEffects: (sourceItem.effects ?? []).map((e) => ({
        label: e.name ?? e.label ?? '',
        icon: e.icon ?? '',
        changes: (e.changes ?? []).map((c) => ({ key: c.key, mode: c.mode, value: c.value })),
      })),
      targetWeaponIndex: sourceItem.system.targetWeaponIndex ?? -1,
      weaponChanges: foundry.utils.deepClone(sourceItem.system.weaponChanges ?? []),
    });
    await this.document.update({ 'system.embeddedMods': embeddedMods });
    if (input) input.value = '';
  }

  async _onSyncEmbeddedMods(event) {
    event.preventDefault();
    const system = this.document.system.toObject?.() ?? this.document.system;
    const embeddedMods = foundry.utils.deepClone(system.embeddedMods ?? []);
    let changed = false;
    for (const mod of embeddedMods) {
      if (!mod.sourceUuid) continue;
      let source;
      try { source = await fromUuid(mod.sourceUuid); } catch { continue; }
      if (!source || source.type !== 'mod') continue;
      mod.modType = source.system.modType;
      mod.name = source.name;
      mod.cost = source.system.cost ?? '';
      mod.note = source.system.note ?? '';
      mod.description = source.system.description ?? '';
      mod.importedEffects = (source.effects ?? []).map((e) => ({
        label: e.name ?? e.label ?? '',
        icon: e.icon ?? '',
        changes: (e.changes ?? []).map((c) => ({ key: c.key, mode: c.mode, value: c.value })),
      }));
      mod.targetWeaponIndex = source.system.targetWeaponIndex ?? -1;
      mod.weaponChanges = foundry.utils.deepClone(source.system.weaponChanges ?? []);
      changed = true;
    }
    if (changed) await this.document.update({ 'system.embeddedMods': embeddedMods });
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Sheet.Labels.ModSyncDone'));
  }

  async _onRemoveEmbeddedMod(event) {
    event.preventDefault();
    const modId = event.currentTarget.dataset.modId;
    const system = this.document.system.toObject?.() ?? this.document.system;
    const embeddedMods = (system.embeddedMods ?? []).filter((m) => m.id !== modId);
    await this.document.update({ 'system.embeddedMods': embeddedMods });
  }

  // ── Instruction sequence handlers ─────────────────────────────────────────

  async _onAddInstruction(event) {
    event.preventDefault();
    const raw = this.document.system.toObject?.() ?? this.document.system;
    const instructions = foundry.utils.deepClone(raw.instructions ?? []);
    instructions.push({
      name: '',
      type: 'check',
      effectId: '',
      effectEnabled: true,
      primary: 'body',
      skill: '',
      component: '',
      dv: 13,
      progress: true,
    });
    await this.document.update({ 'system.instructions': instructions });
  }

  async _onRemoveInstruction(event) {
    event.preventDefault();
    const stepIndex = Number.parseInt(event.currentTarget.dataset.stepIndex ?? '-1', 10);
    if (Number.isNaN(stepIndex) || stepIndex < 0) return;
    const raw = this.document.system.toObject?.() ?? this.document.system;
    const instructions = foundry.utils.deepClone(raw.instructions ?? []);
    instructions.splice(stepIndex, 1);
    await this.document.update({ 'system.instructions': instructions });
  }

  async _onMoveInstruction(event) {
    event.preventDefault();
    const stepIndex = Number.parseInt(event.currentTarget.dataset.stepIndex ?? '-1', 10);
    const direction = event.currentTarget.dataset.direction;
    if (Number.isNaN(stepIndex) || stepIndex < 0 || !direction) return;
    const raw = this.document.system.toObject?.() ?? this.document.system;
    const instructions = foundry.utils.deepClone(raw.instructions ?? []);
    const swapIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (swapIndex < 0 || swapIndex >= instructions.length) return;
    [instructions[stepIndex], instructions[swapIndex]] = [instructions[swapIndex], instructions[stepIndex]];
    await this.document.update({ 'system.instructions': instructions });
  }
}
