import {
  getEligiblePlatforms,
  parsePsycheLossFormula,
  promptForCyberwarePlatform,
  validateCyberwareConfiguration,
} from '../helpers/cyberware.mjs';
import { getActorCyberwareDisableState } from '../helpers/cyberware-disable.mjs';
import { getGearStateUpdateData, normalizeGearState } from '../helpers/gear.mjs';
import { getEffectiveItemWeapons } from '../helpers/mods.mjs';
import { applyFirstRoleSetup, normalizeRoleSystemData } from '../helpers/roles.mjs';

function preserveRoleArrayIds(next, current) {
  if (!next || !current || typeof next !== 'object' || typeof current !== 'object') {
    return;
  }
  for (const key of Object.keys(next)) {
    const nextValue = next[key];
    const currentValue = current[key];
    if (Array.isArray(nextValue) && Array.isArray(currentValue)) {
      for (let i = 0; i < nextValue.length; i++) {
        const nextItem = nextValue[i];
        const currentItem = currentValue[i];
        if (nextItem && typeof nextItem === 'object' && !Array.isArray(nextItem)) {
          if ((!nextItem.id || nextItem.id === '') && currentItem?.id) {
            nextItem.id = currentItem.id;
          }
          preserveRoleArrayIds(nextItem, currentItem ?? {});
        }
      }
    }
  }
}

export class CyberBlueItem extends Item {
  static PSYCHE_LOSS_FLAG = 'autoPsycheLoss';
  static PSYCHE_PROMPT_FLAG = 'psycheLossPrompted';
  static OPERATIONAL_EFFECT_FLAG = 'autoOperationalEffectState';

  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if (this.type === 'role' && this.parent instanceof Actor
        && userId === game.user.id && !options?.cyberBlueSkipRoleGrant) {
      await applyFirstRoleSetup(this.parent, this);
    }
  }

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }

    if (this.type === 'role') {
      const nextSystem = normalizeRoleSystemData(data.system ?? this.system);
      data.system = nextSystem;
      this.updateSource({ system: nextSystem });
      return allowed;
    }

    if (this.type !== 'cyberware' || !(this.parent instanceof Actor)) {
      return allowed;
    }

    const nextSystem = foundry.utils.deepClone(data.system ?? this.system);
    if (nextSystem.integration === 'extension' && !nextSystem.parentCyberwareId) {
      const eligiblePlatforms = getEligiblePlatforms(this.parent, this.id, nextSystem);

      let selectedPlatformId;
      if (options?.cyberBlueSkipRoleGrant) {
        // Auto-assign to the first eligible platform (no user prompt for role grants)
        selectedPlatformId = eligiblePlatforms[0]?.id ?? null;
      } else {
        selectedPlatformId = await promptForCyberwarePlatform(eligiblePlatforms);
      }

      if (selectedPlatformId === undefined || selectedPlatformId === '') {
        return false;
      }

      nextSystem.parentCyberwareId = selectedPlatformId || null;
      data.system = nextSystem;
      this.updateSource({ system: nextSystem });
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

    if (this.type === 'gear') {
      const nextSystem = changed.system ??= {};
      if ('state' in nextSystem) {
        Object.assign(nextSystem, foundry.utils.expandObject(getGearStateUpdateData(nextSystem.state)).system);
      } else if ('equipped' in nextSystem || 'carried' in nextSystem) {
        const mergedSystem = foundry.utils.mergeObject(
          this.system.toObject(),
          foundry.utils.deepClone(nextSystem),
          { inplace: false }
        );
        nextSystem.state = normalizeGearState(mergedSystem);
      }
    }

    if (this.type === 'role') {
      const currentSystem = this.system.toObject();
      const mergedSystem = foundry.utils.mergeObject(
        currentSystem,
        foundry.utils.deepClone(changed.system ?? {}),
        { inplace: false }
      );
      preserveRoleArrayIds(mergedSystem, currentSystem);
      changed.system = normalizeRoleSystemData(mergedSystem);
      return allowed;
    }

    if (this.type !== 'cyberware' || !(this.parent instanceof Actor)) {
      return allowed;
    }

    const nextSystem = foundry.utils.mergeObject(
      this.system.toObject(),
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

  isUnconnectedExtension() {
    return this.type === 'cyberware'
      && this.parent instanceof Actor
      && this.system.integration === 'extension'
      && !this.system.parentCyberwareId;
  }

  shouldApplyCyberwareEffects() {
    return !this.isUnconnectedExtension();
  }

  getCyberwareDisableState() {
    if (this.type !== 'cyberware' || !(this.parent instanceof Actor)) {
      return null;
    }

    return getActorCyberwareDisableState(this.parent).byItemId.get(this.id) ?? null;
  }

  isCyberwareDisabled() {
    return Boolean(this.getCyberwareDisableState());
  }

  getGearState() {
    return this.type === 'gear' ? normalizeGearState(this.system) : null;
  }

  getEffectiveWeapons() {
    return getEffectiveItemWeapons(this);
  }

  getPsycheLossEffect() {
    return this.effects.find((effect) => effect.getFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_LOSS_FLAG));
  }

  getPsycheLossEffectData() {
    const psycheLoss = this.getCyberwarePsycheLossData();
    const changes = [
      {
        key: 'system.resources.psyche.maxBonus',
        type: 'add',
        value: `${-psycheLoss.maxReduction}`,
      },
    ];
    return {
      name: game.i18n.localize('CYBER_BLUE.Effect.PsycheLoss'),
      icon: 'icons/svg/daze.svg',
      origin: this.uuid,
      disabled: !this.shouldApplyCyberwareEffects(),
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

  async syncCyberwareOperationalEffects(options = {}) {
    if (this.type !== 'cyberware') {
      return;
    }

    const shouldApplyEffects = this.shouldApplyCyberwareEffects();
    const updates = [];

    for (const effect of this.effects.contents) {
      if (effect.getFlag('cyberpunk-blue', CyberBlueItem.PSYCHE_LOSS_FLAG)) {
        continue;
      }

      const overrideState = effect.getFlag('cyberpunk-blue', CyberBlueItem.OPERATIONAL_EFFECT_FLAG) ?? null;
      if (!shouldApplyEffects) {
        if (effect.disabled !== true || overrideState?.active !== true) {
          updates.push({
            _id: effect.id,
            disabled: true,
            [`flags.cyberpunk-blue.${CyberBlueItem.OPERATIONAL_EFFECT_FLAG}`]: {
              active: true,
              previousDisabled: effect.disabled === true,
            },
          });
        }
        continue;
      }

      if (overrideState?.active === true) {
        updates.push({
          _id: effect.id,
          disabled: overrideState.previousDisabled === true,
          [`flags.cyberpunk-blue.${CyberBlueItem.OPERATIONAL_EFFECT_FLAG}`]: null,
        });
      }
    }

    if (!updates.length) {
      return;
    }

    await this.updateEmbeddedDocuments('ActiveEffect', updates, {
      ...options,
      cyberBlueSyncOperationalEffects: true,
    });
  }
}
