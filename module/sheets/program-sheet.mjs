const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
import {
  resolveNetAttack,
  getLinkedExecutable,
  isExecutableAttached,
  copyExecutableToProgram,
} from '../helpers/netrunning.mjs';

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

    // Resolve the linked executable via system.executableUuid (single source of
    // truth). Attached mode = exe embedded on this actor; referenced mode = exe
    // living elsewhere (e.g. on a Netrunner's cyberdeck).
    const exeItemDoc = await getLinkedExecutable(this.document);
    const linkUuid   = system.executableUuid ?? '';
    context.link = {
      uuid:     linkUuid,
      hasUuid:  Boolean(linkUuid),
      valid:    Boolean(exeItemDoc),
      name:     exeItemDoc?.name ?? '',
      attached: exeItemDoc ? isExecutableAttached(this.document, exeItemDoc) : false,
    };

    // Attack context — available to GM for temp program actors with ATK > 0
    const isTempProgram  = Boolean(this.document.getFlag('cyberpunk-blue', 'isTemporaryProgramActor'));
    const inErrorState   = this.document.effects.some(
      (e) => e.getFlag('cyberpunk-blue', 'isErrorState'),
    );
    context.canAttack    = isGM && isTempProgram && (system.stats?.atk?.value ?? 0) > 0 && !inErrorState;
    context.inErrorState = inErrorState;
    context.isTempProgram = isTempProgram;

    context.actor = actorData;
    context.system = system;
    context.isGM = isGM;
    context.programTypes = PROGRAM_TYPES;
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

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelector('[data-action="roll-atk"]')
      ?.addEventListener('click', () => this._rollStat('atk'));
    this.element.querySelector('[data-action="roll-per"]')
      ?.addEventListener('click', () => this._rollStat('per'));
    this.element.querySelector('[data-action="remove-executable"]')
      ?.addEventListener('click', this._onRemoveExecutable.bind(this));
    this.element.querySelector('[data-action="set-executable-uuid"]')
      ?.addEventListener('click', this._onSetExecutableUuid.bind(this));
    this.element.querySelector('[data-edit="img"]')
      ?.addEventListener('click', this._onEditProfileImage.bind(this));
    this.element.querySelector('[data-action="program-attack"]')
      ?.addEventListener('click', this._onProgramAttack.bind(this));
  }

  /**
   * Drop an item onto the Program sheet. Only Program Executables are accepted;
   * dropping one embeds a copy (attached mode) and links to it, replacing any
   * existing link.
   * @override
   */
  async _onDropItem(event, item) {
    if (!game.user.isGM || !this.document.isOwner) return null;
    if (item?.type !== 'programExecutable') {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.Program.OnlyExecutables'));
      return null;
    }

    // Single-attachment: drop the previous link (deleting it if it was attached).
    await this._clearCurrentLink({ deleteAttached: true });

    // Embed a copy of the dropped executable on this program actor.
    const data = item.inCompendium
      ? game.items.fromCompendium(item, { clearFolder: true })
      : item.toObject();
    delete data._id;
    const [created] = await this.document.createEmbeddedDocuments('Item', [data]);
    if (!created) return null;

    await this.document.update({ 'system.executableUuid': created.uuid }, { cyberblueProgramSync: true });
    await copyExecutableToProgram(this.document, created);
    ui.notifications.info(game.i18n.format('CYBER_BLUE.Netrunning.Program.Attached', { name: created.name }));
    return created;
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

  async _onProgramAttack(event) {
    event.preventDefault();
    if (!game.user.isGM) return;

    const actor = this.document;
    const atk   = Number(actor.system.stats?.atk?.value) || 0;

    // Must have a targeted token
    const targetToken = [...(game.user?.targets ?? [])][0];
    if (!targetToken?.actor) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoTarget'));
      return;
    }

    // Determine damage formula from button data-attribute (set in template)
    const damageFormula = event.currentTarget.dataset.damage || '1d6';
    const label = `${actor.name} ${game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.ProgramAttackLabel')}`;

    await resolveNetAttack(actor, targetToken.actor, atk, label, damageFormula);
  }

  /**
   * Clear the current executable link. If the linked exe is attached (embedded
   * on this program actor), delete it; a referenced (foreign) exe is only
   * unlinked, never deleted.
   */
  async _clearCurrentLink({ deleteAttached = false } = {}) {
    const exe = await getLinkedExecutable(this.document);
    const wasAttached = exe && isExecutableAttached(this.document, exe);
    if (this.document.system.executableUuid) {
      await this.document.update({ 'system.executableUuid': null }, { cyberblueProgramSync: true });
    }
    if (deleteAttached && wasAttached) {
      await this.document.deleteEmbeddedDocuments('Item', [exe.id]);
    }
  }

  async _onRemoveExecutable(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    await this._clearCurrentLink({ deleteAttached: true });
  }

  async _onSetExecutableUuid(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    const input = this.element.querySelector('[name="executableUuidInput"]');
    const raw = (input?.value ?? '').trim();
    if (!raw) return;

    const doc = await fromUuid(raw).catch(() => null);
    if (doc?.type !== 'programExecutable') {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.Program.InvalidUuid'));
      return;
    }

    // Switching to a referenced link: drop any previously attached exe.
    await this._clearCurrentLink({ deleteAttached: true });
    await this.document.update({ 'system.executableUuid': raw }, { cyberblueProgramSync: true });
    await copyExecutableToProgram(this.document, doc);
    ui.notifications.info(game.i18n.format('CYBER_BLUE.Netrunning.Program.Linked', { name: doc.name }));
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
