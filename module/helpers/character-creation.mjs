const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const _openWizards = new Map(); // actorId → wizard instance

const CC_STEPS = ['welcome', 'lifepath', 'stats', 'secondary', 'languages', 'ability', 'skills', 'role', 'name'];

// Tables that are triggered automatically as sub-tables by Friends / Enemies and
// should not be listed as standalone entries the player rolls directly.
const LIFEPATH_SUB_TABLE_NAMES = new Set([
  'Hair color',
  "Who's your friend?",
  "Who's your enemy?",
  "What's their Role?",
  'How big is their Circle?',
]);
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
      resizable: true,
    },
    position: {
      width: 560,
      height: 700,
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
    this._pendingLanguage = null;    // typed but not yet flushed to actor
    this._pendingNewLanguage = null; // new-language input on the ability step
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
      const FOLDER_NAME = 'General Lifepath';
      let folder = game.folders.find(f => f.type === 'RollTable' && f.name === FOLDER_NAME);
      let allTables = game.tables?.contents ?? [];

      // If the world folder doesn't exist yet, import from the system compendium.
      if (!folder && game.user?.isGM) {
        const pack = game.packs.get('cyberpunk-blue.lifepath-tables');
        if (pack) {
          try {
            await pack.getIndex({ fields: ['name', 'folder'] });
            // Create the world folder
            folder = await Folder.create({ name: FOLDER_NAME, type: 'RollTable' });
            // Import all tables from the pack into the new folder
            const toImport = pack.index.map(e => e._id);
            for (const entryId of toImport) {
              const doc = await pack.getDocument(entryId);
              if (doc) {
                await RollTable.create({
                  ...doc.toObject(),
                  folder: folder.id,
                });
              }
            }
            allTables = game.tables?.contents ?? [];
            ui.notifications.info(`Imported ${toImport.length} lifepath tables to "${FOLDER_NAME}".`);
          } catch (err) {
            console.error('Cyberpunk Blue | Failed to import lifepath tables:', err);
          }
        }
      }

      const rollAllTable = allTables.find(t => t.name?.toLowerCase().includes('roll all lifepath'));
      const tables = folder
        ? allTables.filter(t =>
            t.folder?.id === folder.id &&
            t.id !== rollAllTable?.id &&
            !LIFEPATH_SUB_TABLE_NAMES.has(t.name)
          )
        : [];

      context.lifepath = {
        rollAllId: rollAllTable?.id ?? null,
        tables: tables.map(t => ({ id: t.id, name: t.name, groupLabel: '', isCompendium: false })),
        hasRolled: this._hasRolledLifepath,
        fromCompendium: false,
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
      // Use the locally-buffered value if the user is mid-type, so the rendered
      // field shows the current input and canAdvance reflects what they've typed.
      const extraLanguage = this._pendingLanguage
        ?? this.actor.system.characterCreation?.extraLanguage
        ?? '';
      context.languages = {
        extraLanguage,
        canAdvance: extraLanguage.trim().length > 0,
      };
    }

    if (step === 'ability') {
      const extraLanguage = this.actor.system.characterCreation?.extraLanguage ?? '';

      // World items first; fall back to system compendium if none found.
      const folder = game.folders.find(f => f.type === 'Item' && f.name === 'Abilities');
      let abilityItems = folder
        ? (game.items?.contents ?? []).filter(i => i.type === 'ability' && i.folder?.id === folder.id)
        : [];

      if (abilityItems.length === 0) {
        const pack = game.packs.get('cyberpunk-blue.abilities');
        if (pack) {
          await pack.getIndex({ fields: ['name', 'system.maxRank', 'system.description'] });
          // We need full documents for description; use index for listing only.
          abilityItems = pack.index.map(e => ({
            id: `Compendium.cyberpunk-blue.abilities.Item.${e._id}`,
            uuid: `Compendium.cyberpunk-blue.abilities.Item.${e._id}`,
            name: e.name,
            system: { maxRank: e['system.maxRank'] ?? 10, description: e['system.description'] ?? '' },
            _fromPack: true,
          }));
        }
      }

      // Exclude 'Language' from the bonus ability list — handled separately via the Upgrade button.
      const selectableAbilities = abilityItems.filter(a => a.name !== 'Language');

      const pendingNewLanguage = this._pendingNewLanguage ?? '';
      context.ability = {
        extraLanguage,
        upgradeLabel: game.i18n.format('CYBER_BLUE.CC.Ability.UpgradeLanguage', { language: extraLanguage }),
        abilities: selectableAbilities.map(a => ({
          id: a.uuid ?? a.id,
          name: a.name,
          maxRank: a.system?.maxRank ?? 10,
          note: a.system?.note ?? '',
        })),
        noAbilities: selectableAbilities.length === 0,
        pendingNewLanguage,
        canAddNewLanguage: pendingNewLanguage.trim().length > 0,
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
      // World items first; fall back to system compendium if none found.
      const folder = game.folders.find(f => f.type === 'Item' && f.name === 'Roles');
      let roles = folder
        ? (game.items?.contents ?? []).filter(i => i.type === 'role' && i.folder?.id === folder.id)
        : [];

      let fromCompendium = false;
      if (roles.length === 0) {
        const pack = game.packs.get('cyberpunk-blue.roles');
        if (pack) {
          await pack.getIndex({ fields: ['name', 'system.abilitySections'] });
          roles = pack.index.map(e => ({
            id: `Compendium.cyberpunk-blue.roles.Item.${e._id}`,
            uuid: `Compendium.cyberpunk-blue.roles.Item.${e._id}`,
            name: e.name,
            system: { abilitySections: e['system.abilitySections'] ?? [] },
            _fromPack: true,
          }));
          fromCompendium = true;
        }
      }

      context.roles = {
        list: roles.map(r => ({
          id: r.uuid ?? r.id,
          name: r.name,
          note: r.system?.abilitySections?.[0]?.content ?? '',
        })),
        noRoles: roles.length === 0,
        fromCompendium,
      };
    }

    if (step === 'name') {
      context.characterName = this.actor.name;
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
      // If a pending value exists (user typed since last actor flush), restore it
      // so the field shows the current text and the cursor stays at the end.
      if (this._pendingLanguage !== null) {
        langField.value = this._pendingLanguage;
      }
    }

    this.element.querySelector('[data-action="upgrade-language"]')?.addEventListener('click', this._onUpgradeLanguage.bind(this));
    this.element.querySelector('[data-action="add-new-language"]')?.addEventListener('click', this._onAddNewLanguage.bind(this));

    const newLangField = this.element.querySelector('#cc-new-language-input');
    if (newLangField) {
      newLangField.addEventListener('input', this._onNewLanguageInput.bind(this));
      if (this._pendingNewLanguage !== null) {
        newLangField.value = this._pendingNewLanguage;
      }
    }

    this.element.querySelectorAll('[data-action="choose-ability"]').forEach(btn => {
      btn.addEventListener('click', this._onChooseAbility.bind(this));
    });

    this.element.querySelectorAll('[data-action="choose-role"]').forEach(btn => {
      btn.addEventListener('click', this._onChooseRole.bind(this));
    });

    this.element.querySelector('[data-action="cc-next"]')?.addEventListener('click', this._onNextStep.bind(this));
    this.element.querySelector('[data-action="cc-back"]')?.addEventListener('click', this._onPrevStep.bind(this));
    this.element.querySelector('[data-action="cc-skip"]')?.addEventListener('click', this._onSkipStep.bind(this));
    this.element.querySelector('[data-action="cc-finish"]')?.addEventListener('click', this._onFinish.bind(this));

    const nameField = this.element.querySelector('#cc-name-input');
    if (nameField) {
      nameField.addEventListener('input', this._onNameInput.bind(this));
    }
  }

  async _onRollTable(event) {
    const tableId = event.currentTarget.dataset.tableId;

    // Support both world tables (plain id) and compendium tables (UUID string)
    let table;
    if (tableId.startsWith('Compendium.')) {
      table = await fromUuid(tableId);
    } else {
      table = game.tables.get(tableId);
    }
    if (!table) return;

    // draw() rolls the table, posts to chat (including any sub-table chains),
    // and returns {results, roll}. Use it instead of roll() so the GM and player
    // see the results in chat and sub-tables are triggered automatically.
    const drawn = await table.draw();
    const text = drawn.results
      .filter(r => r.type === 0 || r.type === 'text') // text results only
      .map(r => r.text)
      .filter(Boolean)
      .join(' ');
    if (text) {
      const current = this.actor.system.details?.background ?? '';
      const newBg = current ? `${current}<p>${text}</p>` : `<p>${text}</p>`;
      await this.actor.update({ 'system.details.background': newBg });
    }

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

  _onLanguageInput(event) {
    const value = event.currentTarget.value;
    // Buffer locally — do NOT call actor.update() here. Calling it would trigger
    // the updateActor hook → render() → input replaced → cursor jumps to start.
    // The value is flushed to the actor when the user clicks Next (see _onNextStep).
    this._pendingLanguage = value;
    // Keep the Next button enabled/disabled in sync without re-rendering.
    const nextBtn = this.element.querySelector('[data-action="cc-next"]');
    if (nextBtn) nextBtn.disabled = value.trim().length === 0;
  }

  async _advanceTo(nextStep) {
    // Flush any buffered language input before advancing so it's persisted.
    if (this._pendingLanguage !== null) {
      await this.actor.update({ 'system.characterCreation.extraLanguage': this._pendingLanguage });
      this._pendingLanguage = null;
    }
    this._pendingNewLanguage = null;
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

  _onNewLanguageInput(event) {
    const value = event.currentTarget.value;
    this._pendingNewLanguage = value;
    // Enable/disable the Add button in-place without a full re-render.
    const addBtn = this.element.querySelector('[data-action="add-new-language"]');
    if (addBtn) addBtn.disabled = value.trim().length === 0;
  }

  async _onAddNewLanguage() {
    const lang = (this._pendingNewLanguage ?? '').trim();
    if (!lang) return;
    this._pendingNewLanguage = null;

    const abilityName = `Language: ${lang}`;
    const existing = this.actor.items.find(i => i.type === 'ability' && i.name === abilityName);
    if (existing) {
      const newRank = Math.min((existing.system.rank ?? 0) + 1, existing.system.maxRank ?? 10);
      await existing.update({ 'system.rank': newRank });
    } else {
      // Find the base Language ability to use as a template (for img, system shape, etc.)
      const folder = game.folders.find(f => f.type === 'Item' && f.name === 'Abilities');
      let langTemplate = folder
        ? (game.items?.contents ?? []).find(i => i.type === 'ability' && i.name === 'Language')
        : null;
      if (!langTemplate) {
        const pack = game.packs.get('cyberpunk-blue.abilities');
        if (pack) {
          await pack.getIndex({ fields: ['name'] });
          const entry = pack.index.find(e => e.name === 'Language');
          if (entry) langTemplate = await pack.getDocument(entry._id);
        }
      }
      const sysData = langTemplate
        ? (langTemplate.system.toObject?.() ?? { ...langTemplate.system })
        : {};
      await this.actor.createEmbeddedDocuments('Item', [{
        name: abilityName,
        type: 'ability',
        img: langTemplate?.img ?? 'icons/svg/book.svg',
        system: { ...sysData, rank: 1 },
      }]);
    }
    await this.actor.update({ 'system.characterCreation.step': 'skills' });
  }

  async _onChooseAbility(event) {
    const abilityId = event.currentTarget.dataset.abilityId;

    // Support both world items (Item.ID) and compendium items (Compendium.…) — fromUuid handles both
    const source = await fromUuid(abilityId).catch(() => null) ?? game.items.get(abilityId);
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

    // Support both world items (Item.ID) and compendium items (Compendium.…) — fromUuid handles both
    const source = await fromUuid(roleId).catch(() => null) ?? game.items.get(roleId);
    if (!source) return;

    const sysData = source.system.toObject?.() ?? { ...source.system };
    await this.actor.createEmbeddedDocuments('Item', [{
      name: source.name,
      type: 'role',
      img: source.img,
      system: sysData,
    }]);

    // Advance to the name step (final step before completion)
    await this._advanceTo('name');
  }

  async _onNameInput(event) {
    this._pendingName = event.currentTarget.value;
  }

  async _onFinish() {
    const newName = this._pendingName?.trim() || this.actor.name;
    await this.actor.update({
      name: newName,
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
