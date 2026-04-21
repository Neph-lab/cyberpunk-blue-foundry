const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;

const VEHICLE_TYPES = [
  { value: 'land', label: 'Land' },
  { value: 'air', label: 'Air' },
  { value: 'sea', label: 'Sea' },
];

export class CyberBlueVehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'actor', 'vehicle'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 580,
      height: 520,
    },
    window: {
      resizable: true,
    },
  }, { inplace: false });

  static PARTS = {
    sheet: {
      root: true,
      template: 'systems/cyberpunk-blue/templates/actor/vehicle-sheet.hbs',
    },
  };

  tabGroups = {
    primary: 'general',
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorData = this.document.toPlainObject();
    const { system } = actorData;
    const isGM = game.user.isGM;

    context.actor = actorData;
    context.system = system;
    context.isGM = isGM;
    context.vehicleTypes = VEHICLE_TYPES;
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

    const tabNavigation = this.element.querySelector('.sheet-tabs');
    if (tabNavigation) {
      const tabs = new Tabs({
        navSelector: '.sheet-tabs',
        contentSelector: '.sheet-body',
        initial: this.tabGroups.primary ?? 'general',
        callback: (_event, _tabs, active) => {
          this.tabGroups.primary = active;
        },
      });
      tabs.bind(this.element);
    }

    this.element.querySelector('[data-action="post-move-chat"]')
      ?.addEventListener('click', this._onPostMoveChat.bind(this));
    this.element.querySelector('[data-edit="img"]')
      ?.addEventListener('click', this._onEditProfileImage.bind(this));
  }

  async _onPostMoveChat(event) {
    event.preventDefault();
    const move = this.document.system.stats.move.value ?? 0;
    const mps = (move * 2).toFixed(1);
    const kmh = (move * 2 * 3.6).toFixed(1);
    const mph = (move * 2 * 2.237).toFixed(1);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `
        <div class="cyberpunk-blue chat-card">
          <h3>${this.document.name}: MOVE ${move}</h3>
          <p>${mps} m/s &bull; ${kmh} km/h &bull; ${mph} mph</p>
        </div>
      `,
    });
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
