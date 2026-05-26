const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;

export class CyberBlueVehicleSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'actor', 'vehicle'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 620,
      height: 580,
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

    // Derived display helpers
    const h = system.stats.handling;
    context.handlingEffective = h.base + h.bonus;
    context.maxMoveEffective = system.stats.maxMove.value + system.stats.maxMove.bonus;
    context.accEffective = system.stats.acc.value + system.stats.acc.bonus;
    context.sizeDisplay = system.stats.size.label
      ? `${system.stats.size.value} (${system.stats.size.label})`
      : `${system.stats.size.value}`;

    // State choices for the select element
    context.stateChoices = [
      { value: 'operational', label: 'Operational' },
      { value: 'wreck',       label: 'Wreck' },
    ];

    // Classification primary choices
    context.primaryChoices = [
      { value: 'land', label: 'Land' },
      { value: 'sea',  label: 'Sea'  },
      { value: 'air',  label: 'Air'  },
    ];

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description,
      {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.getRollData?.() ?? {},
        relativeTo: this.document,
      }
    );
    context.enrichedNotes = isGM
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          system.notes,
          {
            secrets: true,
            async: true,
            rollData: this.document.getRollData?.() ?? {},
            relativeTo: this.document,
          }
        )
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

    this.element.querySelector('[data-action="post-speed-chat"]')
      ?.addEventListener('click', this._onPostSpeedChat.bind(this));
    this.element.querySelector('[data-edit="img"]')
      ?.addEventListener('click', this._onEditProfileImage.bind(this));
  }

  /** Post a chat message showing the vehicle's max speed in real-world units. */
  async _onPostSpeedChat(event) {
    event.preventDefault();
    const maxMove  = (this.document.system.stats.maxMove.value ?? 0)
                   + (this.document.system.stats.maxMove.bonus ?? 0);
    const mps  = (maxMove  * 2).toFixed(1);
    const kmh  = (maxMove  * 2 * 3.6).toFixed(1);
    const mph  = (maxMove  * 2 * 2.237).toFixed(1);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `
        <div class="cyberpunk-blue chat-card">
          <h3>${this.document.name}: MAX MOVE ${maxMove}</h3>
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
