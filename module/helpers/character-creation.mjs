const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const _openWizards = new Map(); // actorId → wizard instance

const CC_STEPS = ['welcome', 'lifepath', 'stats', 'secondary', 'languages', 'ability', 'skills', 'role'];
const PRIMARY_STATS = ['body', 'rflx', 'int', 'tech', 'cool'];
const STAT_MIN = 3;
const STAT_MAX = 8;
const STAT_BUDGET = 30;
const SKILL_BUDGET = 35;

function calcSkillPointsUsed(actor) {
  const skills = CONFIG.CYBER_BLUE.skills;
  let skillPts = 0;
  let freeCompRanks = 0;
  let totalCompRanks = 0;

  for (const [slug, def] of Object.entries(skills)) {
    const rank = actor.system.skills[slug]?.rank ?? 0;
    skillPts += rank;
    if (rank > 0 && def.components?.length > 0) {
      freeCompRanks += rank; // 1 free component rank per purchased skill rank
    }
  }

  for (const slug of Object.keys(CONFIG.CYBER_BLUE.components)) {
    totalCompRanks += actor.system.components[slug]?.rank ?? 0;
  }

  const paidCompRanks = Math.max(0, totalCompRanks - freeCompRanks);
  return skillPts + Math.ceil(paidCompRanks / 2);
}

export class CharacterCreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['cyberpunk-blue', 'character-creation-wizard'],
    window: {
      title: 'CYBER_BLUE.CC.Title',
      resizable: false,
    },
    position: {
      width: 560,
      height: 'auto',
    },
  };

  static PARTS = {
    wizard: {
      template: 'systems/cyberpunk-blue/templates/character-creation/wizard.hbs',
    },
  };

  static getForActor(actorId) {
    return _openWizards.get(actorId) ?? null;
  }

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._hasRolledLifepath = false;
    _openWizards.set(actor.id, this);
    this._actorUpdateHookId = Hooks.on('updateActor', (doc) => {
      if (doc.id === this.actor.id) {
        this.actor = doc;
        this.render({ force: false });
      }
    });
  }

  async close(options = {}) {
    _openWizards.delete(this.actor.id);
    Hooks.off('updateActor', this._actorUpdateHookId);
    return super.close(options);
  }

  get step() {
    return this.actor.system.characterCreation?.step ?? 'welcome';
  }

  get stepIndex() {
    return CC_STEPS.indexOf(this.step);
  }

  _getRemainingStatPoints() {
    return STAT_BUDGET - PRIMARY_STATS.reduce((sum, slug) => {
      return sum + (this.actor.system.stats[slug]?.value ?? STAT_MIN);
    }, 0);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const step = this.step;
    const stepIndex = this.stepIndex;

    context.step = step;
    context.stepIndex = stepIndex;
    context.steps = CC_STEPS.map((s, i) => ({
      slug: s,
      label: game.i18n.localize(`CYBER_BLUE.CC.Progress.${s}`),
      done: i < stepIndex,
      active: i === stepIndex,
    }));
    context.canGoBack = stepIndex > 0 && step !== 'welcome';
    context.actorName = this.actor.name;

    if (step === 'welcome') {
      context.welcome = {
        intro: game.i18n.localize('CYBER_BLUE.CC.Welcome.Intro'),
      };
    }

    if (step === 'lifepath') {
      const folder = game.folders.find(f => f.type === 'RollTable' && f.name === 'Lifepath');
      const allTables = game.tables?.contents ?? [];
      const rollAllTable = allTables.find(t => t.name?.toLowerCase().includes('roll all lifepath'));
      const tables = folder
        ? allTables.filter(t => t.folder?.id === folder.id && t.id !== rollAllTable?.id)
        : [];
      context.lifepath = {
        rollAllId: rollAllTable?.id ?? null,
        tables: tables.map(t => ({ id: t.id, name: t.name })),
        hasRolled: this._hasRolledLifepath,
      };
    }

    if (step === 'stats') {
      const remaining = this._getRemainingStatPoints();
      context.stats = {
        list: PRIMARY_STATS.map(slug => {
          const def = CONFIG.CYBER_BLUE.stats[slug];
          const value = this.actor.system.stats[slug]?.value ?? STAT_MIN;
          return {
            slug,
            label: def.label,
            shortLabel: def.shortLabel,
            value,
            atMin: value <= STAT_MIN,
            atMax: value >= STAT_MAX,
          };
        }),
        remaining,
        canAdvance: remaining === 0,
        allSpent: remaining === 0,
      };
    }

    if (step === 'secondary') {
      context.secondary = {
        moveText: game.i18n.localize('CYBER_BLUE.CC.Secondary.MoveText'),
        hpText: game.i18n.localize('CYBER_BLUE.CC.Secondary.HpText'),
        psycheText: game.i18n.localize('CYBER_BLUE.CC.Secondary.PsycheText'),
        luckText: game.i18n.localize('CYBER_BLUE.CC.Secondary.LuckText'),
        sheetNote: game.i18n.localize('CYBER_BLUE.CC.Secondary.SheetNote'),
      };
    }

    if (step === 'languages') {
      const extraLanguage = this.actor.system.characterCreation?.extraLanguage ?? '';
      context.languages = {
        extraLanguage,
        canAdvance: extraLanguage.trim().length > 0,
      };
    }

    if (step === 'ability') {
      const extraLanguage = this.actor.system.characterCreation?.extraLanguage ?? '';
      const folder = game.folders.find(f => f.type === 'Item' && f.name === 'Abilities');
      const abilities = folder
        ? (game.items?.contents ?? []).filter(i => i.type === 'ability' && i.folder?.id === folder.id)
        : [];
      context.ability = {
        extraLanguage,
        upgradeLabel: game.i18n.format('CYBER_BLUE.CC.Ability.UpgradeLanguage', { language: extraLanguage }),
        abilities: abilities.map(a => ({
          id: a.id,
          name: a.name,
          maxRank: a.system?.maxRank ?? 10,
          note: a.system?.note ?? '',
        })),
        noAbilities: abilities.length === 0,
      };
    }

    if (step === 'skills') {
      const used = calcSkillPointsUsed(this.actor);
      const remaining = SKILL_BUDGET - used;
      context.skills = {
        used,
        remaining,
        over: remaining < 0,
        remainingAbs: Math.abs(remaining),
      };
    }

    if (step === 'role') {
      const folder = game.folders.find(f => f.type === 'Item' && f.name === 'Roles');
      const roles = folder
        ? (game.items?.contents ?? []).filter(i => i.type === 'role' && i.folder?.id === folder.id)
        : [];
      context.roles = {
        list: roles.map(r => ({ id: r.id, name: r.name, note: r.system?.abilitySections?.[0]?.content ?? '' })),
        noRoles: roles.length === 0,
      };
    }

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelectorAll('[data-action="roll-table"]').forEach(btn => {
      btn.addEventListener('click', this._onRollTable.bind(this));
    });

    this.element.querySelectorAll('[data-action="stat-increase"]').forEach(btn => {
      btn.addEventListener('click', (e) => this._onStatChange(1, e));
    });
    this.element.querySelectorAll('[data-action="stat-decrease"]').forEach(btn => {
      btn.addEventListener('click', (e) => this._onStatChange(-1, e));
    });

    const langField = this.element.querySelector('#cc-language-input');
    if (langField) {
      langField.addEventListener('input', this._onLanguageInput.bind(this));
    }

    this.element.querySelector('[data-action="upgrade-language"]')?.addEventListener('click', this._onUpgradeLanguage.bind(this));

    this.element.querySelectorAll('[data-action="choose-ability"]').forEach(btn => {
      btn.addEventListener('click', this._onChooseAbility.bind(this));
    });

    this.element.querySelectorAll('[data-action="choose-role"]').forEach(btn => {
      btn.addEventListener('click', this._onChooseRole.bind(this));
    });

    this.element.querySelector('[data-action="cc-next"]')?.addEventListener('click', this._onNextStep.bind(this));
    this.element.querySelector('[data-action="cc-back"]')?.addEventListener('click', this._onPrevStep.bind(this));
    this.element.querySelector('[data-action="cc-skip"]')?.addEventListener('click', this._onSkipStep.bind(this));
  }

  async _onRollTable(event) {
    const tableId = event.currentTarget.dataset.tableId;
    const table = game.tables.get(tableId);
    if (!table) return;

    const result = await table.roll();
    const text = result.results.map(r => r.text).join(' ');
    const current = this.actor.system.details?.background ?? '';
    const newBg = current ? `${current}<p>${text}</p>` : `<p>${text}</p>`;
    await this.actor.update({ 'system.details.background': newBg });

    this._hasRolledLifepath = true;
    this.render({ force: false });
  }

  async _onStatChange(delta, event) {
    const slug = event.currentTarget.dataset.statSlug;
    if (!slug) return;

    const current = this.actor.system.stats[slug]?.value ?? STAT_MIN;
    const remaining = this._getRemainingStatPoints();

    if (delta > 0 && remaining <= 0) return;
    const newValue = Math.max(STAT_MIN, Math.min(STAT_MAX, current + delta));
    if (newValue === current) return;

    await this.actor.update({ [`system.stats.${slug}.value`]: newValue });
  }

  async _onLanguageInput(event) {
    const value = event.currentTarget.value;
    await this.actor.update({ 'system.characterCreation.extraLanguage': value });
  }

  async _advanceTo(nextStep) {
    if (nextStep === 'secondary') {
      await this._initializeSecondaryStats();
    }
    if (nextStep === 'ability') {
      await this._prepareLanguageAbilities();
    }
    await this.actor.update({ 'system.characterCreation.step': nextStep });
  }

  async _onNextStep() {
    const step = this.step;

    if (step === 'stats') {
      if (this._getRemainingStatPoints() !== 0) {
        ui.notifications.warn(game.i18n.localize('CYBER_BLUE.CC.Stats.MustSpendAll'));
        return;
      }
    }

    if (step === 'skills') {
      const used = calcSkillPointsUsed(this.actor);
      if (used > SKILL_BUDGET) {
        ui.notifications.warn(game.i18n.format('CYBER_BLUE.CC.Skills.Over', { over: used - SKILL_BUDGET }));
        return;
      }
      if (used < SKILL_BUDGET) {
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize('CYBER_BLUE.CC.Title') },
          content: `<p>${game.i18n.format('CYBER_BLUE.CC.Skills.ConfirmUnderSpent', { remaining: SKILL_BUDGET - used })}</p>`,
        });
        if (!ok) return;
      }
    }

    const nextStep = CC_STEPS[this.stepIndex + 1];
    if (!nextStep) return;
    await this._advanceTo(nextStep);
  }

  async _onSkipStep() {
    const nextStep = CC_STEPS[this.stepIndex + 1];
    if (!nextStep) return;
    await this._advanceTo(nextStep);
  }

  async _onPrevStep() {
    const prevStep = CC_STEPS[this.stepIndex - 1];
    if (!prevStep) return;
    await this.actor.update({ 'system.characterCreation.step': prevStep });
  }

  async _initializeSecondaryStats() {
    const body = this.actor.system.stats.body?.value ?? 3;
    const hp = (body * 5) + 10;
    await this.actor.update({
      'system.stats.move.value': 5,
      'system.resources.hp.value': hp,
      'system.resources.psyche.value': 60,
      'system.resources.luck.value': 5,
    });
  }

  async _addLanguageAbilities(extraLanguage) {
    const existing = this.actor.items.filter(i => i.type === 'ability');
    const englishName = 'Language: English';
    const extraName = `Language: ${extraLanguage}`;

    const toCreate = [];
    if (!existing.find(i => i.name === englishName)) {
      toCreate.push({ name: englishName, type: 'ability', system: { rank: 2, maxRank: 2 } });
    }
    if (!existing.find(i => i.name === extraName)) {
      toCreate.push({ name: extraName, type: 'ability', system: { rank: 1, maxRank: 2 } });
    }
    if (toCreate.length > 0) {
      await this.actor.createEmbeddedDocuments('Item', toCreate);
    }
  }

  async _onUpgradeLanguage() {
    const extraLanguage = this.actor.system.characterCreation?.extraLanguage ?? '';
    if (!extraLanguage) return;

    const abilityName = `Language: ${extraLanguage}`;
    const existing = this.actor.items.find(i => i.type === 'ability' && i.name === abilityName);
    if (existing) {
      await existing.update({ 'system.rank': 2 });
    }
    await this.actor.update({ 'system.characterCreation.step': 'skills' });
  }

  async _onChooseAbility(event) {
    const abilityId = event.currentTarget.dataset.abilityId;
    const source = game.items.get(abilityId);
    if (!source) return;

    const existing = this.actor.items.find(i => i.type === 'ability' && i.name === source.name);
    if (existing) {
      const newRank = Math.min((existing.system.rank ?? 0) + 1, existing.system.maxRank ?? 10);
      await existing.update({ 'system.rank': newRank });
    } else {
      const sysData = source.system.toObject?.() ?? { ...source.system };
      await this.actor.createEmbeddedDocuments('Item', [{
        name: source.name,
        type: 'ability',
        img: source.img,
        system: { ...sysData, rank: 1 },
      }]);
    }
    await this.actor.update({ 'system.characterCreation.step': 'skills' });
  }

  async _onChooseRole(event) {
    const roleId = event.currentTarget.dataset.roleId;
    const source = game.items.get(roleId);
    if (!source) return;

    const sysData = source.system.toObject?.() ?? { ...source.system };
    await this.actor.createEmbeddedDocuments('Item', [{
      name: source.name,
      type: 'role',
      img: source.img,
      system: sysData,
    }]);

    await this.actor.update({
      'system.characterCreation.active': false,
      'system.characterCreation.step': 'welcome',
    });

    this.close();
  }

  // Called when advancing to the languages step; adds language abilities
  async _prepareLanguageAbilities() {
    const extraLanguage = this.actor.system.characterCreation?.extraLanguage ?? '';
    if (extraLanguage) {
      await this._addLanguageAbilities(extraLanguage);
    }
  }
}

export const CC_STEPS_LIST = CC_STEPS;
