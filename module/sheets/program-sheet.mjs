const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
import { resolveNetAttack } from '../helpers/netrunning.mjs';

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

    // Resolve the linked executable — for temp Program Actors look it up via
    // flags on the actor; for world actors fall back to system.executableId.
    let executable     = null;
    let exeItemDoc     = null;
    const netActorId   = this.document.getFlag('cyberpunk-blue', 'programActorFor');
    const exeItemId    = this.document.getFlag('cyberpunk-blue', 'programExecutableId')
      ?? system.executableId;

    if (netActorId && exeItemId) {
      const netActor = game.actors.get(netActorId);
      exeItemDoc = netActor?.items.get(exeItemId) ?? null;
    } else if (exeItemId) {
      exeItemDoc = game.items?.get(exeItemId) ?? null;
    }

    if (exeItemDoc) {
      executable = { id: exeItemDoc.id, name: exeItemDoc.name };
    }

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
    context.executable = executable;
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
    this.element.querySelector('[data-action="delete-executable"]')
      ?.addEventListener('click', this._onDeleteExecutable.bind(this));
    this.element.querySelector('[data-edit="img"]')
      ?.addEventListener('click', this._onEditProfileImage.bind(this));
    this.element.querySelector('[data-action="program-attack"]')
      ?.addEventListener('click', this._onProgramAttack.bind(this));
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
