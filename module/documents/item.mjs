import {
  getEligiblePlatforms,
  parsePsycheLossFormula,
  validateCyberwareConfiguration,
} from '../helpers/cyberware.mjs';

export class CyberBlueItem extends Item {
  static PSYCHE_LOSS_FLAG = 'autoPsycheLoss';

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }

    if (this.type !== 'cyberware' || !(this.parent instanceof Actor)) {
      return allowed;
    }

    const validation = validateCyberwareConfiguration(this.parent, {
      itemName: data.name ?? this.name,
      system: data.system ?? this.system,
    });
    if (!validation.valid) {
      ui.notifications.warn(validation.reason);
      return false;
    }

    return allowed;
  }

  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) {
      return false;
    }

    if (this.type !== 'cyberware' || !(this.parent instanceof Actor)) {
      return allowed;
    }

    const nextSystem = foundry.utils.mergeObject(
      foundry.utils.deepClone(this.system),
      foundry.utils.deepClone(changed.system ?? {}),
      { inplace: false }
    );
    const nextName = changed.name ?? this.name;
    const validation = validateCyberwareConfiguration(this.parent, {
      itemId: this.id,
      itemName: nextName,
      system: nextSystem,
    });
    if (!validation.valid) {
      ui.notifications.warn(validation.reason);
      return false;
    }

    return allowed;
  }

  toPlainObject() {
    const result = this.toObject();

    result.id = this.id;
    result.system = this.system.toPlainObject();
    result.effects = this.effects?.size > 0
      ? this.effects.contents.map((effect) => effect.toObject())
      : [];

    return result;
  }

  getCyberwarePsycheLossData() {
    return this.type === 'cyberware'
      ? parsePsycheLossFormula(this.system.psycheLossFormula)
      : parsePsycheLossFormula('');
  }

  getCyberwareEligiblePlatforms() {
    if (this.type !== 'cyberware' || !(this.parent instanceof Actor)) {
      return [];
    }
    return getEligiblePlatforms(this.parent, this.id, this.system);
  }

  getPsycheLossEffect() {
    return this.effects.find((effect) => effect.getFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_LOSS_FLAG));
  }

  getPsycheLossEffectData() {
    const psycheLoss = this.getCyberwarePsycheLossData();
    const changes = [
      {
        key: 'system.resources.psyche.max',
        type: 'add',
        value: `${-psycheLoss.maxReduction}`,
      },
    ];
    return {
      name: game.i18n.localize('CYBER_BLUE.Effect.PsycheLoss'),
      icon: 'icons/svg/daze.svg',
      origin: this.uuid,
      disabled: false,
      transfer: true,
      system: { changes },
      flags: {
        'cyberpunk-blue': {
          [CyberBlueItem.PSYCHE_LOSS_FLAG]: true,
        },
      },
    };
  }

  async syncCyberwarePsycheLossEffect(options = {}) {
    if (this.type !== 'cyberware') {
      return;
    }

    const effectData = this.getPsycheLossEffectData();
    const existingEffect = this.getPsycheLossEffect();

    if (!existingEffect) {
      await this.createEmbeddedDocuments('ActiveEffect', [effectData], {
        ...options,
        cyberBlueSyncPsycheLoss: true,
      });
      return;
    }

    await existingEffect.update(effectData, {
      ...options,
      cyberBlueSyncPsycheLoss: true,
    });
  }
}
