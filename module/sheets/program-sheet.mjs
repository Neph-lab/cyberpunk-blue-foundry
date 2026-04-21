const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const PROGRAM_TYPES = [
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

export class CyberBlueProgramSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'actor', 'program'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 580,
      height: 560,
    },
    window: {
      resizable: true,
    },
  }, { inplace: false });

  static PARTS = {
    sheet: {
      root: true,
      template: 'systems/cyberpunk-blue/templates/actor/program-sheet.hbs',
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorData = this.document.toPlainObject();
    const { system } = actorData;
    const isGM = game.user.isGM;

    let executable = null;
    if (system.executableId) {
      const execItem = this.document.items?.find((i) => i.type === 'programExecutable' && i.id === system.executableId)
        ?? game.items?.get(system.executableId);
      if (execItem) {
        executable = { id: execItem.id, name: execItem.name };
      }
    }

    context.actor = actorData;
    context.system = system;
    context.isGM = isGM;
    context.programTypes = PROGRAM_TYPES;
    context.executable = executable;
    context.enrichedDescription = await TextEditor.enrichHTML(system.description, {
      secrets: this.document.isOwner,
      async: true,
      rollData: this.document.getRollData?.() ?? {},
      relativeTo: this.document,
    });
    context.enrichedNotes = isGM
      ? await TextEditor.enrichHTML(system.notes, {
        secrets: true,
        async: true,
        rollData: this.document.getRollData?.() ?? {},
        relativeTo: this.document,
      })
      : '';

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelector('[data-action="roll-atk"]')
      ?.addEventListener('click', () => this._rollStat('atk'));
    this.element.querySelector('[data-action="roll-per"]')
      ?.addEventListener('click', () => this._rollStat('per'));
    this.element.querySelector('[data-action="delete-executable"]')
      ?.addEventListener('click', this._onDeleteExecutable.bind(this));
    this.element.querySelector('[data-edit="img"]')
      ?.addEventListener('click', this._onEditProfileImage.bind(this));
  }

  async _rollStat(stat) {
    const value = this.document.system.stats[stat]?.value ?? 0;
    const roll = await new Roll(`1d10 + ${value}`).evaluate();
    const statLabel = stat === 'atk' ? 'ATK' : 'PER';
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${this.document.name}: ${statLabel}</h3></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  async _onDeleteExecutable(event) {
    event.preventDefault();
    await this.document.update({ 'system.executableId': null });
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
}
