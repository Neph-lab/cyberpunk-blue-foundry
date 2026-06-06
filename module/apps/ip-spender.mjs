const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const _openSpenders = new Map(); // actorId → instance

const STAT_CAP = 10;
const SKILL_CAP = 10;
const COMPONENT_CAP = 10;
const ROLE_CAP = 10;

export class IpSpenderApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'ip-spender'],
    window: {
      title: 'CYBER_BLUE.IP.WindowTitle',
      resizable: true,
    },
    position: {
      width: 580,
      height: 680,
    },
  }, { inplace: false });

  static PARTS = {
    spender: {
      template: 'systems/cyberpunk-blue/templates/apps/ip-spender.hbs',
    },
  };

  static openForActor(actor) {
    const existing = _openSpenders.get(actor.id);
    if (existing) {
      existing.bringToFront();
      return existing;
    }
    const app = new IpSpenderApplication(actor);
    app.render({ force: true });
    return app;
  }

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._activeTab = 'stats';
    this._selection = null; // { tab, key, newRank, cost, extras }

    _openSpenders.set(actor.id, this);

    this._actorUpdateHookId = Hooks.on('updateActor', (doc, changed) => {
      if (doc.id !== this.actor.id) return;
      this.actor = doc;
      // Clear the pending selection only when the IP balance or progression
      // fields change (e.g. after a Confirm write or GM adjustment).
      const keys = Object.keys(foundry.utils.flattenObject(changed ?? {}));
      const progressionChanged = keys.some((k) =>
        k.startsWith('system.ip') || k.startsWith('system.totIP')
        || k.startsWith('system.stats.') || k.startsWith('system.resources.luck')
        || k.startsWith('system.skills.') || k.startsWith('system.components.')
      );
      if (progressionChanged) this._selection = null;
      this.render({ force: false });
    });
    const _itemRefresh = (doc) => {
      if (doc.parent?.id === this.actor.id) {
        this.actor = game.actors.get(this.actor.id) ?? this.actor;
        this._selection = null;
        this.render({ force: false });
      }
    };
    this._itemHookIds = {
      updateItem: Hooks.on('updateItem', _itemRefresh),
      createItem: Hooks.on('createItem', _itemRefresh),
      deleteItem: Hooks.on('deleteItem', _itemRefresh),
    };
  }

  async close(options = {}) {
    _openSpenders.delete(this.actor.id);
    Hooks.off('updateActor', this._actorUpdateHookId);
    for (const [hookName, id] of Object.entries(this._itemHookIds)) Hooks.off(hookName, id);
    return super.close(options);
  }

  get ip() { return this.actor.system.ip ?? 0; }
  get pendingCost() { return this._selection?.cost ?? 0; }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const ip = this.ip;
    const sel = this._selection;

    context.ip = ip;
    context.pendingCost = this.pendingCost;
    context.ipAfter = ip - this.pendingCost;
    context.canConfirm = sel !== null
      && !(sel.key === 'new-language' && !(sel.extras?.languageName?.trim()));
    context.activeTab = this._activeTab;
    context.selection = sel;

    // ── Main Attributes ────────────────────────────────────────────────
    const STAT_ICONS = { body: 'bk_BODY', rflx: 'bk_RFLX', int: 'bk_INT', tech: 'bk_TECH', cool: 'bk_COOL', move: 'bk_MOVE' };
    context.statsRows = [
      ...Object.entries(CONFIG.CYBER_BLUE.stats).map(([slug, data]) => {
        const currentRank = system.stats[slug]?.value ?? 0;
        const newRank = currentRank + 1;
        const cost = 80 * newRank;
        const atCap = newRank > STAT_CAP;
        const canAfford = !atCap && ip >= cost;
        const isSelected = sel?.tab === 'stats' && sel?.key === slug;
        const isLocked = sel !== null && !isSelected;
        return {
          slug,
          label: data.shortLabel,
          iconPath: `systems/cyberpunk-blue/assets/icons/${STAT_ICONS[slug] ?? ('bk_' + slug.toUpperCase())}.svg`,
          currentRank,
          newRank,
          cost,
          canAfford,
          isSelected,
          isDisabled: !canAfford || isLocked || atCap,
          atCap,
        };
      }),
      (() => {
        const currentRank = system.resources.luck.max ?? 5;
        const newRank = currentRank + 1;
        const cost = 80 * newRank;
        const atCap = newRank > STAT_CAP;
        const canAfford = !atCap && ip >= cost;
        const isSelected = sel?.tab === 'stats' && sel?.key === 'luck';
        const isLocked = sel !== null && !isSelected;
        return {
          slug: 'luck',
          label: 'LUCK',
          iconPath: 'systems/cyberpunk-blue/assets/icons/bk_LUCK.svg',
          currentRank,
          newRank,
          cost,
          canAfford,
          isSelected,
          isDisabled: !canAfford || isLocked || atCap,
          atCap,
        };
      })(),
    ];

    // ── Skills ─────────────────────────────────────────────────────────
    const skillSel = sel?.tab === 'skills' ? sel : null;
    context.skillsRows = Object.entries(CONFIG.CYBER_BLUE.skills).map(([slug, data]) => {
      const currentRank = system.skills[slug]?.rank ?? 0;
      const newRank = currentRank + 1;
      const cost = 30 * newRank;
      const atCap = newRank > SKILL_CAP;
      const canAfford = !atCap && ip >= cost;
      const isSelected = skillSel?.key === slug;
      const isLocked = sel !== null && !isSelected;

      let expandArea = null;
      if (isSelected && data.components.length > 0) {
        // Show every linked Component — raising the skill activates them, so the
        // free rank can land on any of them (not just ones already active).
        const linkedComps = data.components;
        const canTakeExtraRank = linkedComps.some((cs) => (system.components[cs]?.rank ?? 0) > newRank);
        const extraRankSelected = skillSel?.extras?.extraRank === true;
        const options = [];
        if (canTakeExtraRank) {
          options.push({
            type: 'extraRank',
            slug: 'extraRank',
            label: game.i18n.localize('CYBER_BLUE.IP.Skills.ExtraRank') || 'Additional Rank instead of Component',
            rankDisplay: null,
            isSelected: extraRankSelected,
            isLocked: false,
          });
        }
        for (const cs of linkedComps) {
          options.push({
            type: 'freeComponent',
            slug: cs,
            label: CONFIG.CYBER_BLUE.components[cs]?.label ?? cs,
            rankDisplay: system.components[cs]?.rank ?? 0,
            isSelected: skillSel?.extras?.freeComponent === cs,
            isLocked: extraRankSelected,
          });
        }
        expandArea = {
          hint: canTakeExtraRank
            ? game.i18n.localize('CYBER_BLUE.IP.Skills.ExpandHintExtra')
            : game.i18n.localize('CYBER_BLUE.IP.Skills.FreeComponentHint'),
          options,
        };
      }

      return {
        slug,
        label: data.label,
        statLabel: CONFIG.CYBER_BLUE.stats[data.stat]?.shortLabel ?? data.stat.toUpperCase(),
        hasComponents: data.components.length > 0,
        currentRank,
        newRank,
        cost,
        canAfford,
        isSelected,
        isDisabled: !canAfford || isLocked || atCap,
        atCap,
        expandArea,
      };
    });

    // ── Components ─────────────────────────────────────────────────────
    const compSel = sel?.tab === 'components' ? sel : null;
    context.componentsRows = Object.entries(CONFIG.CYBER_BLUE.components)
      .filter(([slug]) => system.components[slug]?.active)
      .map(([slug, data]) => {
        const currentRank = system.components[slug]?.rank ?? 0;
        const newRank = currentRank + 1;
        const cost = 30 * newRank;
        const atCap = newRank > COMPONENT_CAP;
        const canAfford = !atCap && ip >= cost;
        const isSelected = compSel?.key === slug;
        const isLocked = sel !== null && !isSelected;

        let expandArea = null;
        if (isSelected) {
          const options = [];
          for (const ss of data.skills) {
            const skillRank = system.skills[ss]?.rank ?? 0;
            if (skillRank < newRank) {
              options.push({
                type: 'freeSkill',
                slug: ss,
                label: CONFIG.CYBER_BLUE.skills[ss]?.label ?? ss,
                rankDisplay: skillRank,
                isSelected: compSel?.extras?.freeSkill === ss,
                isLocked: false,
              });
            }
          }
          for (const [cs, cd] of Object.entries(CONFIG.CYBER_BLUE.components)) {
            if (cs === slug) continue;
            if (!system.components[cs]?.active) continue;
            const cr = system.components[cs]?.rank ?? 0;
            if (cr < newRank) {
              options.push({
                type: 'secondComponent',
                slug: cs,
                label: cd.label,
                rankDisplay: cr,
                isSelected: compSel?.extras?.secondComponent === cs,
                isLocked: false,
              });
            }
          }
          if (options.length > 0) {
            expandArea = {
              hint: game.i18n.localize('CYBER_BLUE.IP.Components.ExpandHint'),
              options,
            };
          }
        }

        return {
          slug,
          label: data.label,
          linkedSkillsText: data.skills.map((s) => CONFIG.CYBER_BLUE.skills[s]?.label ?? s).join(', '),
          currentRank,
          newRank,
          cost,
          canAfford,
          isSelected,
          isDisabled: !canAfford || isLocked || atCap,
          atCap,
          expandArea,
        };
      });

    // ── Abilities ──────────────────────────────────────────────────────
    const abSel = sel?.tab === 'abilities' ? sel : null;
    context.abilitiesRows = [];

    const ownedAbilities = this.actor.items.filter((i) => i.type === 'ability').slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const item of ownedAbilities) {
      const currentRank = item.system.rank ?? 0;
      const maxRank = item.system.maxRank ?? null;
      const newRank = currentRank + 1;
      const cost = 40 * newRank;
      const atCap = maxRank !== null && newRank > maxRank;
      const canAfford = !atCap && ip >= cost;
      const isSelected = abSel?.key === item.id;
      const isLocked = sel !== null && !isSelected;
      context.abilitiesRows.push({
        id: item.id,
        name: item.name,
        img: item.img || 'icons/svg/book.svg',
        currentRank,
        newRank,
        maxRank,
        cost,
        canAfford,
        isSelected,
        isDisabled: !canAfford || isLocked || atCap,
        atCap,
        isExisting: true,
      });
    }

    // New abilities from compendium/world folder
    const abilityFolder = game.folders.find((f) => f.type === 'Item' && f.name === 'Abilities');
    let sourceAbilities = abilityFolder
      ? (game.items?.contents ?? []).filter((i) => i.type === 'ability' && i.folder?.id === abilityFolder.id)
      : [];
    if (sourceAbilities.length === 0) {
      const pack = game.packs.get('cyberpunk-blue.abilities');
      if (pack) {
        await pack.getIndex({ fields: ['name', 'img', 'system.maxRank'] });
        sourceAbilities = pack.index.map((e) => ({
          uuid: `Compendium.cyberpunk-blue.abilities.Item.${e._id}`,
          name: e.name,
          img: e.img,
          system: { maxRank: e['system.maxRank'] ?? null },
        }));
      }
    }

    for (const src of sourceAbilities) {
      if (src.name === 'Language') continue;
      const alreadyOwned = ownedAbilities.some((i) => i.name === src.name);
      if (alreadyOwned) continue;
      const cost = 40;
      const canAfford = ip >= cost;
      const srcId = src.uuid ?? src.id;
      const isSelected = abSel?.key === `new:${srcId}`;
      const isLocked = sel !== null && !isSelected;
      context.abilitiesRows.push({
        id: `new:${srcId}`,
        name: src.name,
        img: src.img || 'icons/svg/book.svg',
        currentRank: 0,
        newRank: 1,
        maxRank: src.system?.maxRank ?? null,
        cost,
        canAfford,
        isSelected,
        isDisabled: !canAfford || isLocked,
        atCap: false,
        isExisting: false,
        isNew: true,
      });
    }

    // Special "New Language" row
    {
      const cost = 40;
      const canAfford = ip >= cost;
      const isSelected = abSel?.key === 'new-language';
      const isLocked = sel !== null && !isSelected;
      context.newLanguageRow = {
        cost,
        canAfford,
        isSelected,
        isDisabled: !canAfford || isLocked,
        pendingName: isSelected ? (sel?.extras?.languageName ?? '') : '',
      };
    }

    // ── Roles ──────────────────────────────────────────────────────────
    const roleSel = sel?.tab === 'roles' ? sel : null;
    context.rolesRows = [];

    const ownedRoles = this.actor.items.filter((i) => i.type === 'role').slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const item of ownedRoles) {
      const currentRank = item.system.rank ?? 0;
      const newRank = currentRank + 1;
      const cost = 60 * newRank;
      const atCap = newRank > ROLE_CAP;
      const canAfford = !atCap && ip >= cost;
      const isSelected = roleSel?.key === item.id;
      const isLocked = sel !== null && !isSelected;
      context.rolesRows.push({
        id: item.id,
        name: item.name,
        img: item.img || 'icons/svg/card-joker.svg',
        currentRank,
        newRank,
        cost,
        canAfford,
        isSelected,
        isDisabled: !canAfford || isLocked || atCap,
        atCap,
        isExisting: true,
      });
    }

    const roleFolder = game.folders.find((f) => f.type === 'Item' && f.name === 'Roles');
    let sourceRoles = roleFolder
      ? (game.items?.contents ?? []).filter((i) => i.type === 'role' && i.folder?.id === roleFolder.id)
      : [];
    if (sourceRoles.length === 0) {
      const pack = game.packs.get('cyberpunk-blue.roles');
      if (pack) {
        await pack.getIndex({ fields: ['name', 'img'] });
        sourceRoles = pack.index.map((e) => ({
          uuid: `Compendium.cyberpunk-blue.roles.Item.${e._id}`,
          name: e.name,
          img: e.img,
        }));
      }
    }

    for (const src of sourceRoles) {
      const alreadyOwned = ownedRoles.some((i) => i.name === src.name);
      if (alreadyOwned) continue;
      const cost = 60;
      const canAfford = ip >= cost;
      const srcId = src.uuid ?? src.id;
      const isSelected = roleSel?.key === `new:${srcId}`;
      const isLocked = sel !== null && !isSelected;
      context.rolesRows.push({
        id: `new:${srcId}`,
        name: src.name,
        img: src.img || 'icons/svg/card-joker.svg',
        currentRank: 0,
        newRank: 1,
        cost,
        canAfford,
        isSelected,
        isDisabled: !canAfford || isLocked,
        atCap: false,
        isExisting: false,
        isNew: true,
      });
    }

    const lowRankRoles = ownedRoles.filter((r) => (r.system.rank ?? 0) < 4);
    context.showRoleWarning = lowRankRoles.length >= 1;

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Tab switching
    this.element.querySelectorAll('[data-tab-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this._activeTab = e.currentTarget.dataset.tabId;
        this.render({ force: false });
      });
    });

    // Primary selection toggles
    this.element.querySelectorAll('[data-action="ip-select"]').forEach((btn) => {
      btn.addEventListener('click', this._onSelectOption.bind(this));
    });

    // Expand-area extra toggles
    this.element.querySelectorAll('[data-action="ip-select-extra"]').forEach((btn) => {
      btn.addEventListener('click', this._onSelectExtra.bind(this));
    });

    // Language name input
    const langInput = this.element.querySelector('[data-action="ip-language-input"]');
    if (langInput) {
      if (this._selection?.key === 'new-language' && this._selection?.extras?.languageName) {
        langInput.value = this._selection.extras.languageName;
      }
      langInput.addEventListener('input', (e) => {
        if (this._selection?.key !== 'new-language') return;
        if (!this._selection.extras) this._selection.extras = {};
        this._selection.extras.languageName = e.currentTarget.value;
        const confirmBtn = this.element.querySelector('[data-action="ip-confirm"]');
        if (confirmBtn) confirmBtn.disabled = !e.currentTarget.value.trim();
      });
    }

    // Confirm
    this.element.querySelector('[data-action="ip-confirm"]')?.addEventListener('click', this._onConfirm.bind(this));
  }

  _onSelectOption(event) {
    const btn = event.currentTarget;
    const tab = btn.dataset.tab;
    const key = btn.dataset.key;
    const newRank = parseInt(btn.dataset.newRank);
    const cost = parseInt(btn.dataset.cost);

    if (this._selection?.tab === tab && this._selection?.key === key) {
      this._selection = null;
    } else {
      this._selection = { tab, key, newRank, cost, extras: null };
    }
    this.render({ force: false });
  }

  _onSelectExtra(event) {
    const btn = event.currentTarget;
    const extraType = btn.dataset.extraType;
    const extraKey = btn.dataset.extraKey;
    if (!this._selection) return;

    if (!this._selection.extras) this._selection.extras = {};
    const extras = this._selection.extras;

    switch (extraType) {
      case 'freeComponent':
        extras.freeComponent = extras.freeComponent === extraKey ? null : extraKey;
        extras.extraRank = null;
        break;
      case 'extraRank':
        extras.extraRank = extras.extraRank ? null : true;
        extras.freeComponent = null;
        break;
      case 'freeSkill':
        extras.freeSkill = extras.freeSkill === extraKey ? null : extraKey;
        extras.secondComponent = null;
        break;
      case 'secondComponent':
        extras.secondComponent = extras.secondComponent === extraKey ? null : extraKey;
        extras.freeSkill = null;
        break;
    }
    this.render({ force: false });
  }

  async _onConfirm(event) {
    event.preventDefault();
    const sel = this._selection;
    if (!sel) return;

    const ip = this.actor.system.ip ?? 0;
    if (ip < sel.cost) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.IP.NotEnoughIP'));
      return;
    }

    const actorUpdates = { 'system.ip': Math.max(0, ip - sel.cost) };
    const itemUpdates = [];   // { id, update }
    const itemCreates = [];   // create-data objects

    if (sel.tab === 'stats') {
      if (sel.key === 'luck') {
        actorUpdates['system.resources.luck.maxBonus'] = Math.max(0, (this.actor.system.resources.luck.maxBonus ?? 0) + 1);
      } else {
        actorUpdates[`system.stats.${sel.key}.value`] = sel.newRank;
      }
    }

    else if (sel.tab === 'skills') {
      const rankIncrement = sel.extras?.extraRank ? 2 : 1;
      const currentRank = this.actor.system.skills[sel.key]?.rank ?? 0;
      actorUpdates[`system.skills.${sel.key}.rank`] = currentRank + rankIncrement;
      if (sel.extras?.freeComponent) {
        const cs = sel.extras.freeComponent;
        actorUpdates[`system.components.${cs}.rank`] = (this.actor.system.components[cs]?.rank ?? 0) + 1;
        actorUpdates[`system.components.${cs}.active`] = true;
      }
    }

    else if (sel.tab === 'components') {
      const currentRank = this.actor.system.components[sel.key]?.rank ?? 0;
      actorUpdates[`system.components.${sel.key}.rank`] = currentRank + 1;
      actorUpdates[`system.components.${sel.key}.active`] = true;
      if (sel.extras?.freeSkill) {
        const ss = sel.extras.freeSkill;
        actorUpdates[`system.skills.${ss}.rank`] = (this.actor.system.skills[ss]?.rank ?? 0) + 1;
      } else if (sel.extras?.secondComponent) {
        const cs = sel.extras.secondComponent;
        actorUpdates[`system.components.${cs}.rank`] = (this.actor.system.components[cs]?.rank ?? 0) + 1;
        actorUpdates[`system.components.${cs}.active`] = true;
      }
    }

    else if (sel.tab === 'abilities') {
      if (sel.key === 'new-language') {
        const langInput = this.element.querySelector('[data-action="ip-language-input"]');
        const langName = (langInput?.value ?? sel.extras?.languageName ?? '').trim();
        if (!langName) {
          ui.notifications.warn(game.i18n.localize('CYBER_BLUE.IP.LanguageNameRequired'));
          return;
        }
        const abilityName = `Language: ${langName}`;
        const existing = this.actor.items.find((i) => i.type === 'ability' && i.name === abilityName);
        if (existing) {
          const maxRank = existing.system.maxRank ?? null;
          const newRank = (existing.system.rank ?? 0) + 1;
          if (maxRank !== null && newRank > maxRank) {
            ui.notifications.warn(game.i18n.localize('CYBER_BLUE.IP.AbilityAtMaxRank'));
            return;
          }
          itemUpdates.push({ id: existing.id, update: { 'system.rank': newRank } });
        } else {
          const pack = game.packs.get('cyberpunk-blue.abilities');
          let langTemplate = null;
          if (pack) {
            await pack.getIndex({ fields: ['name'] });
            const entry = pack.index.find((e) => e.name === 'Language');
            if (entry) langTemplate = await pack.getDocument(entry._id);
          }
          const sysData = langTemplate ? (langTemplate.system.toObject?.() ?? { ...langTemplate.system }) : {};
          itemCreates.push({
            name: abilityName,
            type: 'ability',
            img: langTemplate?.img ?? 'icons/svg/book.svg',
            system: { ...sysData, rank: 1 },
          });
        }
      } else if (sel.key?.startsWith('new:')) {
        const uuid = sel.key.slice(4);
        const source = await fromUuid(uuid).catch(() => null);
        if (!source) {
          ui.notifications.warn(game.i18n.localize('CYBER_BLUE.IP.AbilityNotFound'));
          return;
        }
        const sysData = source.system.toObject?.() ?? { ...source.system };
        itemCreates.push({ name: source.name, type: 'ability', img: source.img, system: { ...sysData, rank: 1 } });
      } else {
        const item = this.actor.items.get(sel.key);
        if (!item) return;
        itemUpdates.push({ id: item.id, update: { 'system.rank': sel.newRank } });
      }
    }

    else if (sel.tab === 'roles') {
      if (sel.key?.startsWith('new:')) {
        const uuid = sel.key.slice(4);
        const source = await fromUuid(uuid).catch(() => null);
        if (!source) {
          ui.notifications.warn(game.i18n.localize('CYBER_BLUE.IP.RoleNotFound'));
          return;
        }
        const sysData = source.system.toObject?.() ?? { ...source.system };
        itemCreates.push({ name: source.name, type: 'role', img: source.img, system: { ...sysData, rank: 1 } });
      } else {
        const item = this.actor.items.get(sel.key);
        if (!item) return;
        itemUpdates.push({ id: item.id, update: { 'system.rank': sel.newRank } });
      }
    }

    await this.actor.update(actorUpdates);
    for (const { id, update } of itemUpdates) {
      const item = this.actor.items.get(id);
      if (item) await item.update(update);
    }
    if (itemCreates.length > 0) {
      await this.actor.createEmbeddedDocuments('Item', itemCreates);
    }

    // _selection cleared and re-render triggered by updateActor/updateItem hooks
  }
}
