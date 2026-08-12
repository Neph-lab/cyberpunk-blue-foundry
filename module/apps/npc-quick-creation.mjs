/**
 * NPC Quick Creation — GM-only ApplicationV2 launched from the Actors sidebar.
 *
 * Pick one Base type, one Background and one Purpose, add any number of the four
 * Extras, then Create. The rules live in helpers/npc-builder.mjs; this class only
 * holds the selection and renders it.
 */

import { BASE_TYPES, BACKGROUNDS, PURPOSES, EXTRAS } from '../data/npc-quick-catalogue.mjs';
import { buildNpcRecipe, createNpcFromRecipe } from '../helpers/npc-builder.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Upper bound on a stepper. Far past any useful value — 39 skills exist. */
const EXTRA_MAX = 40;

/** How many skills a card lists before it gives up and counts the rest. */
const SUMMARY_SKILLS = 3;

export class CyberBlueNpcQuickCreation extends HandlebarsApplicationMixin(ApplicationV2) {
  static _instance = null;

  static DEFAULT_OPTIONS = {
    id: 'cpb-npc-quick-creation',
    classes: ['cyberpunk-blue', 'npc-quick'],
    tag: 'div',
    window: { title: 'CYBER_BLUE.NpcQuick.Title', resizable: true },
    position: { width: 860, height: 780 },
    actions: {
      pick: CyberBlueNpcQuickCreation._onPick,
      bump: CyberBlueNpcQuickCreation._onBump,
      reset: CyberBlueNpcQuickCreation._onReset,
      create: CyberBlueNpcQuickCreation._onCreate,
    },
  };

  static PARTS = {
    body: { template: 'systems/cyberpunk-blue/templates/apps/npc-quick-creation.hbs' },
  };

  /** Open the single shared instance, or bring it to the front. */
  static open() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.NpcQuick.GMOnly'));
      return null;
    }
    if (CyberBlueNpcQuickCreation._instance) {
      CyberBlueNpcQuickCreation._instance.bringToFront();
      return CyberBlueNpcQuickCreation._instance;
    }
    const app = new CyberBlueNpcQuickCreation();
    CyberBlueNpcQuickCreation._instance = app;
    app.render(true);
    return app;
  }

  constructor(options = {}) {
    super(options);
    this._selection = {
      baseType: null,
      background: null,
      purpose: null,
      extras: Object.fromEntries(EXTRAS.map((e) => [e.key, 0])),
    };
    this._busy = false;
  }

  async close(options = {}) {
    if (CyberBlueNpcQuickCreation._instance === this) CyberBlueNpcQuickCreation._instance = null;
    return super.close(options);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selection = this._selection;

    context.groups = [
      { id: 'baseType', label: 'CYBER_BLUE.NpcQuick.BaseType', cards: BASE_TYPES.map((e) => this._card('baseType', e)) },
      { id: 'background', label: 'CYBER_BLUE.NpcQuick.Background', cards: BACKGROUNDS.map((e) => this._card('background', e)) },
      { id: 'purpose', label: 'CYBER_BLUE.NpcQuick.Purpose', cards: PURPOSES.map((e) => this._card('purpose', e)) },
    ];

    context.extras = EXTRAS.map((extra) => ({
      ...extra,
      count: selection.extras[extra.key] ?? 0,
      atMin: (selection.extras[extra.key] ?? 0) <= 0,
      atMax: (selection.extras[extra.key] ?? 0) >= EXTRA_MAX,
    }));

    context.canCreate = Boolean(selection.baseType && selection.background && selection.purpose) && !this._busy;
    context.busy = this._busy;
    return context;
  }

  /** One selectable card, with a summary generated from the catalogue entry. */
  _card(group, entry) {
    return {
      group,
      key: entry.key,
      label: entry.label,
      selected: this._selection[group] === entry.key,
      note: entry.note ?? '',
      stats: CyberBlueNpcQuickCreation._statSummary(entry),
      skills: CyberBlueNpcQuickCreation._skillSummary(entry),
      role: entry.role ? `${entry.role.name} ${entry.role.rank}` : '',
      counts: CyberBlueNpcQuickCreation._countSummary(entry),
    };
  }

  static _statSummary(entry) {
    if (entry.stats) {
      return Object.entries(entry.stats)
        .map(([slug, value]) => `${CONFIG.CYBER_BLUE.stats[slug]?.shortLabel ?? slug} ${value}`)
        .join(' · ');
    }
    if (entry.randomStatDelta) return game.i18n.localize('CYBER_BLUE.NpcQuick.RandomStat');
    return Object.entries(entry.statDeltas ?? {})
      .map(([slug, delta]) => `${delta > 0 ? '+' : ''}${delta} ${CONFIG.CYBER_BLUE.stats[slug]?.shortLabel ?? slug}`)
      .join(' · ');
  }

  static _skillSummary(entry) {
    const ranked = Object.entries(entry.skills ?? {}).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return '';
    const shown = ranked.slice(0, SUMMARY_SKILLS)
      .map(([slug, rank]) => `${CONFIG.CYBER_BLUE.skills[slug]?.label ?? slug} +${rank}`)
      .join(', ');
    const rest = ranked.length - SUMMARY_SKILLS;
    return rest > 0 ? `${shown} +${rest} more` : shown;
  }

  static _countSummary(entry) {
    const parts = [];
    const cyberware = (entry.cyberware ?? []).reduce((total, r) => total + r.count, 0);
    const gear = (entry.gear ?? []).length;
    if (cyberware) parts.push(game.i18n.format('CYBER_BLUE.NpcQuick.CyberwareCount', { count: cyberware }));
    if (gear) parts.push(game.i18n.format('CYBER_BLUE.NpcQuick.GearCount', { count: gear }));
    if (entry.programs?.length) {
      parts.push(game.i18n.format('CYBER_BLUE.NpcQuick.ProgramCount', { count: entry.programs.length }));
    }
    return parts.join(' · ');
  }

  // ── Actions ──

  static _onPick(event, target) {
    const { group, key } = target.dataset;
    if (!group) return;
    // Clicking the selected card again clears it, so a misclick is undoable.
    this._selection[group] = this._selection[group] === key ? null : key;
    this.render({ force: false });
  }

  static _onBump(event, target) {
    const { extra, delta } = target.dataset;
    if (!extra) return;
    const next = (this._selection.extras[extra] ?? 0) + Number(delta);
    this._selection.extras[extra] = Math.min(EXTRA_MAX, Math.max(0, next));
    this.render({ force: false });
  }

  static _onReset() {
    this._selection.baseType = null;
    this._selection.background = null;
    this._selection.purpose = null;
    for (const key of Object.keys(this._selection.extras)) this._selection.extras[key] = 0;
    this.render({ force: false });
  }

  static async _onCreate() {
    if (this._busy) return;
    const { baseType, background, purpose } = this._selection;
    if (!baseType || !background || !purpose) return;

    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize('CYBER_BLUE.NpcQuick.NameTitle') },
      content: `<div class="form-group">
        <label>${game.i18n.localize('CYBER_BLUE.NpcQuick.NameLabel')}</label>
        <input type="text" name="npcName" autofocus placeholder="${
          game.i18n.localize('CYBER_BLUE.NpcQuick.NamePlaceholder')}" />
      </div>`,
      ok: {
        label: game.i18n.localize('CYBER_BLUE.NpcQuick.Create'),
        callback: (_event, button) => button.form.elements.npcName?.value?.trim() ?? '',
      },
    }).catch(() => null);
    if (!name) return;

    this._busy = true;
    await this.render({ force: false });
    try {
      const recipe = buildNpcRecipe(this._selection);
      if (!recipe) {
        ui.notifications.error(game.i18n.localize('CYBER_BLUE.NpcQuick.BuildFailed'));
        return;
      }
      const actor = await createNpcFromRecipe(name, recipe);
      if (actor) {
        ui.notifications.info(game.i18n.format('CYBER_BLUE.NpcQuick.Created', { name: actor.name }));
      }
    } catch (error) {
      console.error('Cyberpunk Blue | NPC Quick Creation failed', error);
      ui.notifications.error(game.i18n.format('CYBER_BLUE.NpcQuick.Error', { error: error.message }));
    } finally {
      this._busy = false;
      await this.render({ force: false });
    }
  }
}
