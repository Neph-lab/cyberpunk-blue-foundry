const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;
import { getPlatformUsage } from '../helpers/cyberware.mjs';

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

    const embeddedItems = actorData.items
      .map((item) => ({ ...item, img: item.img || Item.DEFAULT_ICON }))
      .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name));

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
    const cyberwareUsage = getPlatformUsage(cyberwareItems.map((item) => ({
      id: item.id,
      name: item.name,
      system: item.system,
    })));
    context.cyberwareGroups = (CONFIG.CYBER_BLUE.cyberware?.types ?? [])
      .map((typeConfig) => {
        const items = cyberwareItems
          .filter((item) => item.system.installed && item.system.cyberwareType === typeConfig.value)
          .map((item) => {
            const parent = cyberwareItems.find((candidate) => candidate.id === item.system.parentCyberwareId);
            const usedSlots = cyberwareUsage.get(item.id) ?? 0;
            return {
              ...item,
              integrationLabel: CONFIG.CYBER_BLUE.cyberware.integrations
                ?.find((entry) => entry.value === item.system.integration)?.label ?? item.system.integration,
              slotText: item.system.integration === 'platform'
                ? `${Math.max((item.system.slotsProvided ?? 0) - usedSlots, 0)}/${item.system.slotsProvided ?? 0}`
                : `${item.system.slotsUsed ?? 0}`,
              platformName: parent?.name ?? null,
            };
          });

        return {
          ...typeConfig,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
    context.inventory = embeddedItems.filter((item) => item.type === 'gear');
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
            icon: effect.icon,
            duration: effect.duration?.label ?? '',
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
    context.otherResources = context.resources.filter((resource) => !['hp', 'luck', 'psyche'].includes(resource.slug));

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
    const siblings = this.document.items.contents
      .filter((embedded) => embedded.type === item.type)
      .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0));
    const currentIndex = siblings.findIndex((embedded) => embedded.id === item.id);
    const target = siblings[currentIndex + direction];

    if (!target) {
      return;
    }

    await this.document.updateEmbeddedDocuments('Item', [
      { _id: item.id, sort: target.sort ?? 0 },
      { _id: target.id, sort: item.sort ?? 0 },
    ]);
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
}
