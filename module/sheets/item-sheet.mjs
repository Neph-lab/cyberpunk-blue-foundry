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
    const ownerActor = this.document.parent instanceof Actor ? this.document.parent : null;
    const roleRank = this.document.type === 'role'
      ? (ownerActor?.items.get(this.document.id)?.system.rank ?? itemData.system.rank ?? 0)
      : 0;
    const roleSections = (itemData.system.abilitySections ?? []).map((section, index) => ({
      ...section,
      index,
      isVisible: !ownerActor || section.unlockRank <= roleRank,
    }));

    context.cssClass = this.options.classes.join(' ');
    context.item = itemData;
    context.system = itemData.system;
    context.config = CONFIG.CYBER_BLUE;
    context.canManageRestricted = canManageRestricted;
    context.ownerActor = ownerActor;
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
    context.roleSections = context.isRole
      ? await Promise.all(roleSections.map(async (section) => ({
        ...section,
        enrichedContent: await TextEditor.enrichHTML(section.content, {
          secrets: this.document.isOwner,
          async: true,
          rollData: this.document.parent?.getRollData?.() ?? {},
          relativeTo: this.document,
        }),
      })))
      : [];
    context.effects = prepareActiveEffectCategories(
      this.document.effects.filter((effect) => !effect.getFlag('cyberpunk-blue', 'modId'))
    );
    context.showEffectsTab = !(context.isAbility || context.isGear) || canManageRestricted;
    context.showRoleNotesTab = context.isRole && this.document.isOwner;
    context.showCyberwareNotes = context.isCyberware && this.document.isOwner;
    context.costLadder = CONFIG.CYBER_BLUE.costLadder ?? [];
    context.manufacturers = CONFIG.CYBER_BLUE.manufacturers ?? [];
    context.manufacturerLogo = await getBrandLogoPath(itemData.system.manufacturer);
    context.cyberwareConfig = CONFIG.CYBER_BLUE.cyberware ?? {};
    context.combatConfig = CONFIG.CYBER_BLUE.combat ?? {};
    context.gearStates = GEAR_STATES;
    context.modificationConfig = CONFIG.CYBER_BLUE.modifications ?? {};
    context.weapons = (itemData.system.weapons ?? []).map((weapon, index) => {
      const definition = getWeaponTypeDefinition(weapon.type);
      return {
        ...weapon,
        index,
        definition,
        skillOptions: definition.skillOptions.map((skillSlug) => ({
          value: skillSlug,
          label: CONFIG.CYBER_BLUE.skills[skillSlug]?.label ?? skillSlug,
        })),
        rangeBands: (CONFIG.CYBER_BLUE.combat?.rangeBands ?? []).map((band) => ({
          ...band,
          value: Number(weapon.rangeTable?.[band.index] ?? 0) || 0,
          isBlocked: (Number(weapon.rangeTable?.[band.index] ?? 0) || 0) === 0,
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
    this.element.querySelectorAll('[data-action="add-weapon"]').forEach((button) => {
      button.addEventListener('click', this._onAddWeapon.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-weapon"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveWeapon.bind(this));
    });
    this.element.querySelectorAll('[data-weapon-type-select]').forEach((select) => {
      select.addEventListener('change', this._onWeaponTypeChange.bind(this));
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
    sections.push({
      unlockRank: 1,
      content: '',
    });
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
