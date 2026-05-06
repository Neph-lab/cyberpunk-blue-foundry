const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;

import { getWeaponTypeDefinition } from '../helpers/combat.mjs';
import { getMartialArtsDamage, MA_COMPONENTS, resolveMartialArtsAttack } from '../helpers/martial-arts.mjs';
import { resolveWeaponAttack } from '../helpers/combat-resolution.mjs';

export class CyberBlueMookSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'actor', 'mook'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 600,
      height: 620,
    },
    window: {
      resizable: true,
    },
  }, { inplace: false });

  static PARTS = {
    sheet: {
      root: true,
      template: 'systems/cyberpunk-blue/templates/actor/mook-sheet.hbs',
    },
  };

  tabGroups = {
    primary: 'basics',
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorData = this.document.toPlainObject();
    const { system } = actorData;
    const isGM = game.user.isGM;

    const allSkills = Object.entries(CONFIG.CYBER_BLUE.skills ?? {})
      .map(([slug, data]) => ({ slug, label: data.label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const allComponents = Object.entries(CONFIG.CYBER_BLUE.components ?? {})
      .map(([slug, data]) => ({ slug, label: data.label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    context.actor = actorData;
    context.system = system;
    context.isGM = isGM;
    context.allSkills = allSkills;
    context.allComponents = allComponents;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.description, {
      secrets: this.document.isOwner,
      async: true,
      rollData: this.document.getRollData?.() ?? {},
      relativeTo: this.document,
    });
    context.enrichedNotes = isGM
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.notes, {
        secrets: true,
        async: true,
        rollData: this.document.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';

    context.embeddedItems = this.document.items.contents.map((item) => ({
      id: item.id,
      name: item.name,
      img: item.img,
      type: item.type,
    }));

    // ── Combat weapons table ─────────────────────────────────────────────────
    // Include weapons from ALL gear/cyberware (all considered equipped for mooks).
    const combatWeapons = [];
    for (const item of this.document.items.contents) {
      const effectiveWeapons = item.getEffectiveWeapons?.() ?? item.system?.weapons ?? [];
      for (let i = 0; i < effectiveWeapons.length; i++) {
        const w = effectiveWeapons[i];
        if (!w?.type) continue;
        const def = getWeaponTypeDefinition(w.type);
        if (!def) continue;
        combatWeapons.push({
          itemId: item.id,
          weaponIndex: i,
          label: effectiveWeapons.length > 1 ? `${item.name} — ${def.label ?? w.type}` : item.name,
          damage: w.damage ?? def.damage ?? '1d6',
          rof: w.rateOfFire ?? def.rateOfFire ?? 1,
          usesMagazine: !!(def.usesMagazine),
          ammoCurrent: w.ammoCurrent ?? 0,
          ammoMax: w.ammoMax ?? 0,
        });
      }
    }
    context.combatWeapons = combatWeapons;

    // ── Martial Arts table ────────────────────────────────────────────────────
    // Only include MA components the mook actually has; damage is based on BODY.
    const bodyValue = system.stats?.body?.value ?? 5;
    const maDamage = getMartialArtsDamage(bodyValue);
    context.martialArtsAttacks = (system.components ?? [])
      .filter((c) => MA_COMPONENTS.includes(c.slug))
      .map((c) => ({
        slug: c.slug,
        label: CONFIG.CYBER_BLUE.components?.[c.slug]?.label ?? c.slug,
        damage: maDamage,
      }));

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const tabNavigation = this.element.querySelector('.sheet-tabs');
    if (tabNavigation) {
      const tabs = new Tabs({
        navSelector: '.sheet-tabs',
        contentSelector: '.sheet-body',
        initial: this.tabGroups.primary ?? 'basics',
        callback: (_event, _tabs, active) => {
          this.tabGroups.primary = active;
        },
      });
      tabs.bind(this.element);
    }

    this.element.querySelectorAll('[data-action="add-skill"]').forEach((btn) =>
      btn.addEventListener('click', this._onAddSkill.bind(this))
    );
    this.element.querySelectorAll('[data-action="remove-skill"]').forEach((btn) =>
      btn.addEventListener('click', this._onRemoveSkill.bind(this))
    );
    this.element.querySelectorAll('[data-action="add-component"]').forEach((btn) =>
      btn.addEventListener('click', this._onAddComponent.bind(this))
    );
    this.element.querySelectorAll('[data-action="remove-component"]').forEach((btn) =>
      btn.addEventListener('click', this._onRemoveComponent.bind(this))
    );
    this.element.querySelectorAll('[data-action="edit-item"]').forEach((btn) =>
      btn.addEventListener('click', this._onEditItem.bind(this))
    );
    this.element.querySelectorAll('[data-action="delete-item"]').forEach((btn) =>
      btn.addEventListener('click', this._onDeleteItem.bind(this))
    );
    this.element.querySelectorAll('[data-edit="img"]').forEach((el) =>
      el.addEventListener('click', this._onEditProfileImage.bind(this))
    );

    // Money field: supports arithmetic expressions (e.g. "500-50" → 450)
    this.element.querySelectorAll('[data-action="update-money"]').forEach((input) =>
      input.addEventListener('change', this._onUpdateMoney.bind(this))
    );

    // Combat tables
    this.element.querySelectorAll('[data-action="mook-weapon-attack"]').forEach((btn) =>
      btn.addEventListener('click', this._onMookWeaponAttack.bind(this))
    );
    this.element.querySelectorAll('[data-action="mook-ma-attack"]').forEach((btn) =>
      btn.addEventListener('click', this._onMookMaAttack.bind(this))
    );
  }

  async _onAddSkill(event) {
    event.preventDefault();
    const select = this.element.querySelector('[data-skill-select]');
    const slug = select?.value;
    if (!slug) return;
    const skills = foundry.utils.deepClone(this.document.system.toObject?.()?.skills ?? this.document.system.skills ?? []);
    if (skills.some((s) => s.slug === slug)) return;
    const label = CONFIG.CYBER_BLUE.skills[slug]?.label ?? slug;
    skills.push({ slug, label, rank: 0 });
    await this.document.update({ 'system.skills': skills });
  }

  async _onRemoveSkill(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.skillIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) return;
    const skills = foundry.utils.deepClone(this.document.system.toObject?.()?.skills ?? this.document.system.skills ?? []);
    skills.splice(index, 1);
    await this.document.update({ 'system.skills': skills });
  }

  async _onAddComponent(event) {
    event.preventDefault();
    const select = this.element.querySelector('[data-component-select]');
    const slug = select?.value;
    if (!slug) return;
    const components = foundry.utils.deepClone(this.document.system.toObject?.()?.components ?? this.document.system.components ?? []);
    if (components.some((c) => c.slug === slug)) return;
    const label = CONFIG.CYBER_BLUE.components[slug]?.label ?? slug;
    components.push({ slug, label, rank: 0 });
    await this.document.update({ 'system.components': components });
  }

  async _onRemoveComponent(event) {
    event.preventDefault();
    const index = Number.parseInt(event.currentTarget.dataset.componentIndex ?? '-1', 10);
    if (Number.isNaN(index) || index < 0) return;
    const components = foundry.utils.deepClone(this.document.system.toObject?.()?.components ?? this.document.system.components ?? []);
    components.splice(index, 1);
    await this.document.update({ 'system.components': components });
  }

  async _onEditItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.document.items.get(itemId);
    return item?.sheet.render(true);
  }

  async _onDeleteItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.document.items.get(itemId);
    return item?.delete();
  }

  async _onEditProfileImage(event) {
    event.preventDefault();
    if (!this.document.isOwner && game.user.role < CONST.USER_ROLES.ASSISTANT) return;
    const picker = new FilePicker({
      type: 'imagevideo',
      current: this.document.img || '',
      callback: async (path) => this.document.update({ img: path }),
    });
    return picker.browse();
  }

  async _onMookWeaponAttack(event) {
    event.preventDefault();
    const { itemId, weaponIndex } = event.currentTarget.dataset;
    const item = this.document.items.get(itemId);
    if (!item) return;
    await resolveWeaponAttack(this.document, item, Number(weaponIndex ?? 0));
  }

  async _onMookMaAttack(event) {
    event.preventDefault();
    const { componentSlug } = event.currentTarget.dataset;
    await resolveMartialArtsAttack(this.document, componentSlug ?? null);
  }

  /**
   * Money field change handler — evaluates simple arithmetic expressions before saving.
   * e.g. "500-50" → 450, "1200+300" → 1500.
   */
  async _onUpdateMoney(event) {
    event.preventDefault();
    event.stopPropagation();
    const raw = (event.currentTarget.value ?? '').trim();
    let result = 0;
    if (raw) {
      const safe = raw.replace(/[^0-9+\-*/\s().]/g, '').trim();
      try {
        // eslint-disable-next-line no-new-func
        const evaluated = Function('"use strict"; return (' + safe + ')')();
        result = Number.isFinite(evaluated) ? Math.round(evaluated) : 0;
      } catch {
        result = parseInt(raw, 10) || 0;
      }
    }
    result = Math.max(0, result);
    await this.document.update({ 'system.money': result });
  }
}
