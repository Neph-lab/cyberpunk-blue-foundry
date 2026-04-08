export class CyberBlueActor extends Actor {
  static SERIOUS_WOUND_FLAG = 'autoSeriousWound';

  async createEmbeddedDocuments(embeddedName, data = [], options = {}) {
    if (embeddedName === 'Item') {
      const existingRoleNames = new Set(
        this.items.contents
          .filter((item) => item.type === 'role')
          .map((item) => item.name.trim().toLowerCase())
      );
      const filteredData = [];

      for (const entry of data) {
        if (entry?.type !== 'role') {
          filteredData.push(entry);
          continue;
        }

        const normalizedName = `${entry.name ?? ''}`.trim().toLowerCase();
        if (existingRoleNames.has(normalizedName)) {
          ui.notifications.warn(`Role "${entry.name}" is already on this character.`);
          continue;
        }

        existingRoleNames.add(normalizedName);
        filteredData.push(entry);
      }

      data = filteredData;
    }

    if (!data.length) {
      return [];
    }

    return super.createEmbeddedDocuments(embeddedName, data, options);
  }

  getRollData() {
    return { ...super.getRollData(), ...(this.system.getRollData?.() ?? {}) };
  }

  toPlainObject() {
    const result = this.toObject();

    result.id = this.id;
    result.system = this.system.toPlainObject();
    result.items = this.items?.size > 0
      ? this.items.contents.map((item) => item.toPlainObject?.() ?? item.toObject())
      : [];
    result.effects = this.effects?.size > 0
      ? this.effects.contents.map((effect) => effect.toObject())
      : [];

    return result;
  }

  getSkillDefinition(skillSlug) {
    return CONFIG.CYBER_BLUE.skills[skillSlug] ?? null;
  }

  getComponentDefinition(componentSlug) {
    return CONFIG.CYBER_BLUE.components[componentSlug] ?? null;
  }

  getSkillRollContext(skillSlug, componentSlug = null) {
    const skill = this.getSkillDefinition(skillSlug);
    if (!skill) {
      throw new Error(`Unknown skill slug "${skillSlug}"`);
    }

    const stat = CONFIG.CYBER_BLUE.stats[skill.stat];
    const statValue = this.system.stats[skill.stat]?.value ?? 0;
    const statRollMod = this.system.stats[skill.stat]?.rollMod ?? 0;
    const skillRank = this.system.skills[skillSlug]?.rank ?? 0;

    if (!componentSlug) {
      return {
        skillLabel: skill.label,
        skillRank,
        statShortLabel: stat?.shortLabel ?? skill.stat.toUpperCase(),
        statValue,
        statRollMod,
        componentLabel: null,
        componentRank: null,
        usedRank: skillRank,
      };
    }

    const component = this.getComponentDefinition(componentSlug);
    if (!component) {
      throw new Error(`Unknown component slug "${componentSlug}"`);
    }

    const componentRank = this.system.components[componentSlug]?.rank ?? 0;

    return {
      skillLabel: skill.label,
      skillRank,
      statShortLabel: stat?.shortLabel ?? skill.stat.toUpperCase(),
      statValue,
      statRollMod,
      componentLabel: component.label,
      componentRank,
      usedRank: Math.min(skillRank, componentRank),
    };
  }

  async rollSkill({ skillSlug, componentSlug = null, modifier = 0, dv = null } = {}) {
    const context = this.getSkillRollContext(skillSlug, componentSlug);
    const terms = [context.statValue, context.usedRank];

    if (context.statRollMod) {
      terms.push(context.statRollMod);
    }

    if (modifier) {
      terms.push(modifier);
    }

    const formula = [
      '1d10',
      ...terms.map((term) => (term >= 0 ? `+ ${term}` : `- ${Math.abs(term)}`)),
    ].join(' ');

    const roll = await (new Roll(formula)).evaluate();
    const hasDv = Number.isFinite(dv);
    const success = hasDv ? roll.total >= dv : null;
    const statModifierText = context.statRollMod ? ` ${context.statRollMod >= 0 ? '+' : '-'} stat mod ${Math.abs(context.statRollMod)}` : '';
    const modifierText = modifier ? ` + modifier ${modifier}` : '';
    const componentText = componentSlug
      ? `<p><strong>${context.componentLabel}</strong> rank ${context.componentRank}. ${game.i18n.localize("CYBER_BLUE.Sheet.Roll.UsesLowerRank")}</p>`
      : '';
    const dvText = hasDv
      ? `<p>${game.i18n.format("CYBER_BLUE.Sheet.Roll.AgainstDv", { dv })}: <strong>${success ? game.i18n.localize("CYBER_BLUE.Sheet.Roll.Success") : game.i18n.localize("CYBER_BLUE.Sheet.Roll.Failure")}</strong></p>`
      : '';

    const flavor = `
      <div class="cyberpunk-blue chat-card">
        <h3>${componentSlug
          ? game.i18n.localize("CYBER_BLUE.Sheet.Roll.Component")
          : game.i18n.localize("CYBER_BLUE.Sheet.Roll.Standard")}</h3>
        <p><strong>${context.skillLabel}</strong> using <strong>${context.statShortLabel}</strong> (${context.statValue}) + rank ${context.usedRank}${statModifierText}${modifierText}</p>
        ${componentText}
        ${dvText}
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor,
    });

    return roll;
  }

  getSeriousWoundEffect() {
    return this.effects.find((effect) => effect.getFlag('cyberpunk-blue', CyberBlueActor.SERIOUS_WOUND_FLAG));
  }

  shouldBeSeriouslyWounded() {
    return (this.system.resources.hp.value ?? 0) <= (this.system.resources.seriousWoundThreshold.value ?? 0);
  }

  getSeriousWoundEffectData() {
    const changes = ['body', 'rflx', 'int', 'tech', 'cool'].map((slug) => ({
      key: `system.stats.${slug}.rollMod`,
      type: 'add',
      value: '-2',
    }));
    const effectData = {
      name: game.i18n.localize('CYBER_BLUE.Effect.SeriouslyWounded'),
      icon: 'icons/svg/blood.svg',
      origin: this.uuid,
      disabled: false,
      transfer: false,
      system: { changes },
      flags: {
        'cyberpunk-blue': {
          [CyberBlueActor.SERIOUS_WOUND_FLAG]: true,
        },
      },
    };

    if (game.modules.get('tagger')?.active) {
      effectData.flags.tagger = { tags: ['Health'] };
    }

    return effectData;
  }

  async syncSeriousWoundEffect(options = {}) {
    const existingEffect = this.getSeriousWoundEffect();
    const shouldExist = this.shouldBeSeriouslyWounded();

    if (!shouldExist) {
      if (existingEffect) {
        await existingEffect.delete({ ...options, cyberBlueSyncSeriousWound: true });
      }
      return;
    }

    const effectData = this.getSeriousWoundEffectData();
    if (!existingEffect) {
      await this.createEmbeddedDocuments('ActiveEffect', [effectData], {
        ...options,
        cyberBlueSyncSeriousWound: true,
      });
      return;
    }

    await existingEffect.update(effectData, {
      ...options,
      cyberBlueSyncSeriousWound: true,
    });
  }
}
