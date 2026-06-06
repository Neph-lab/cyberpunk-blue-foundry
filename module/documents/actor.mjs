import { getEligiblePlatforms, promptForCyberwarePlatform } from '../helpers/cyberware.mjs';
import { normalizeGearState } from '../helpers/gear.mjs';
import { applyFirstRoleSetup, normalizeRoleSystemData } from '../helpers/roles.mjs';
import { CyberBlueActiveEffect } from './active-effect.mjs';
import { resolveWeaponAttack, resolveAutofireAttack } from '../helpers/combat-resolution.mjs';
import { reloadWeapon, toggleWeaponCharge, toggleWeaponRicochet } from '../helpers/weapon-actions.mjs';

export class CyberBlueActor extends Actor {
  static SERIOUS_WOUND_FLAG = 'autoSeriousWound';

  prepareDerivedData() {
    super.prepareDerivedData();

    // ── Ability-item bonuses ──────────────────────────────────────────────────
    // Sanity: +3 PSYCHE max per rank (added on top of the base-actor computed max).
    // Reaction Speed: +1 initiative-only bonus per rank (stacks with AE contributions).
    if (this.type === 'character' || this.type === 'npc') {
      let sanityPsyche = 0;
      let reactionSpeedInit = 0;
      for (const item of (this.items?.contents ?? [])) {
        if (item.type !== 'ability') continue;
        const rank = Number(item.system?.rank) || 0;
        if (rank <= 0) continue;
        if (item.name === 'Sanity') sanityPsyche += rank * 3;
        if (item.name === 'Reaction Speed') reactionSpeedInit += rank;
      }
      if (sanityPsyche > 0) this.system.resources.psyche.max += sanityPsyche;
      if (reactionSpeedInit > 0) this.system.initiativeBonus += reactionSpeedInit;
    }

    // Compute netActionsTotal from role items (on top of any AE-applied base).
    // Netrunner: +1 + ceil(rank/3). Operative Infiltration ≥ 5: +1.
    // AEs (e.g. Runner-speed) add to the schema-default 0 before this runs,
    // so role contributions stack cleanly on top.
    if (this.type === 'character' || this.type === 'npc') {
      for (const item of (this.items?.contents ?? [])) {
        if (item.type !== 'role') continue;
        const rs = normalizeRoleSystemData(item.system ?? {});
        const rank = Number(rs.rank) || 0;
        if (rank < 1) continue;
        if (item.name === 'Netrunner') {
          this.system.netActionsTotal += 1 + Math.ceil(rank / 3);
        }
        if (item.name === 'Operative') {
          const infiltSpec = (rs.specialties ?? [])
            .find((s) => s.name === 'Infiltration' && Number(s.rank) >= 5);
          if (infiltSpec) this.system.netActionsTotal += 1;
        }
      }
    }

    if (!this.system.resources?.armor) return;

    if (this.type === 'mook') {
      // Mooks: derive SP from the embedded armor item with the highest maxSp.
      // If no armor items are present the data-model's stored/clamped value is kept as-is.
      let bestItem = null;
      let bestMaxSp = 0;
      for (const item of this.items.contents) {
        const maxSp = item.system?.armor?.maxSp ?? 0;
        if (maxSp > bestMaxSp) { bestMaxSp = maxSp; bestItem = item; }
      }
      if (bestItem) {
        this.system.resources.armor.value = Math.min(
          Math.max(bestItem.system.armor?.currentSp ?? bestMaxSp, 0),
          bestMaxSp,
        );
        this.system.resources.armor.max = bestMaxSp;
      }
      return;
    }

    const activeArmor = this.getActiveArmorItem();
    const currentSp = activeArmor ? Math.max(Math.min(activeArmor.system.armor?.currentSp ?? 0, activeArmor.system.armor?.maxSp ?? 0), 0) : 0;
    const maxSp = activeArmor ? Math.max(activeArmor.system.armor?.maxSp ?? 0, 0) : 0;

    this.system.resources.armor.value = currentSp;
    this.system.resources.armor.max = maxSp;
  }

  async _preUpdate(changed, options, userId) {
    await super._preUpdate(changed, options, userId);

    if (this.type !== 'character' && this.type !== 'npc') return;

    // Find any skill rank changes in this update (handles both flat and nested formats).
    const flat = foundry.utils.flattenObject(changed);
    const rankChanges = {};
    for (const [key, value] of Object.entries(flat)) {
      const m = key.match(/^system\.skills\.(\w+)\.rank$/);
      if (m) rankChanges[m[1]] = Number(value) || 0;
    }
    if (!Object.keys(rankChanges).length) return;

    const skills = CONFIG.CYBER_BLUE?.skills ?? {};
    const components = CONFIG.CYBER_BLUE?.components ?? {};
    const compUpdates = {};

    for (const [skillSlug, newRank] of Object.entries(rankChanges)) {
      const skillDef = skills[skillSlug];
      if (!skillDef?.components?.length) continue;

      const currentRank = this.system.skills[skillSlug]?.rank ?? 0;

      if (currentRank === 0 && newRank > 0) {
        // 0 → active: activate linked components not already in the table.
        for (const compSlug of skillDef.components) {
          if (!this.system.components[compSlug]?.active) {
            compUpdates[`system.components.${compSlug}.active`] = true;
          }
        }
      } else if (currentRank > 0 && newRank === 0) {
        // active → 0: deactivate linked components with no other skill remaining at rank > 0.
        for (const compSlug of skillDef.components) {
          if (!this.system.components[compSlug]?.active) continue;

          const compDef = components[compSlug];
          const hasOtherActiveSkill = (compDef?.skills ?? []).some((otherSlug) => {
            if (otherSlug === skillSlug) return false;
            const rank = rankChanges[otherSlug] !== undefined
              ? rankChanges[otherSlug]
              : (this.system.skills[otherSlug]?.rank ?? 0);
            return rank > 0;
          });

          if (!hasOtherActiveSkill) {
            compUpdates[`system.components.${compSlug}.active`] = false;
            compUpdates[`system.components.${compSlug}.rank`] = 0;
          }
        }
      }
    }

    Object.assign(changed, compUpdates);

    // Signal the one-time components explainer dialog to the initiating client.
    // Only needed the first time any skill with linked components goes 0 → >0.
    if (!options.cyberBlueShowComponentsExplainer
      && !game.user.getFlag('cyberpunk-blue', 'seenComponentsExplainer')) {
      const firstActivation = Object.entries(rankChanges).some(([slug, newRank]) => {
        if (newRank === 0) return false;
        if ((this.system.skills[slug]?.rank ?? 0) !== 0) return false;
        return (CONFIG.CYBER_BLUE?.skills[slug]?.components?.length ?? 0) > 0;
      });
      if (firstActivation) options.cyberBlueShowComponentsExplainer = true;
    }
  }

  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    if (options.cyberBlueShowComponentsExplainer && userId === game.user.id) {
      game.user.setFlag('cyberpunk-blue', 'seenComponentsExplainer', true);
      new Dialog({
        title: 'Skills & Components',
        content: `
          <p>Some skills have linked Components that are ways to specialize within that Skill. But some Components can be used with several Skills, allowing you to benefit from what you've learned across those skills. When you make a check with these skills, you do so along with a Component and add the lower of the two to your check. The table of Components is located below the skills — make sure you add those you want.</p>
          <p>"When you gain a rank in a skill with linked Components, you also gain a rank in one of those Components (one you already have ranks in or a different one). Instead of using a skill-point to buy a rank in a Skill, you may increase two Components by 1 each, or one Component by 2. Or, you may instead use your skill-point to raise a skill linked to Components by 2 ranks, but only if you had a Component at least 2 ranks higher than the skill, and you don't get any Component rank this way."</p>
        `,
        buttons: { ok: { label: 'OK' } },
        default: 'ok',
      }).render(true);
    }
  }

  async createEmbeddedDocuments(embeddedName, data = [], options = {}) {
    const hadNoRoles = embeddedName === 'Item'
      && this.items.contents.every((item) => item.type !== 'role');
    if (embeddedName === 'Item') {
      const existingRoleNames = new Set(
        this.items.contents
          .filter((item) => item.type === 'role')
          .map((item) => item.name.trim().toLowerCase())
      );
      const filteredData = [];

      for (const entry of data) {
        if (entry?.type !== 'role') {
          const prepared = await this._prepareIncomingItemData(entry, options);
          if (prepared) {
            filteredData.push(prepared);
          }
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

    const created = await super.createEmbeddedDocuments(embeddedName, data, options);

    if (embeddedName === 'Item' && hadNoRoles && !options?.cyberBlueSkipRoleGrant) {
      const createdRoles = created.filter((item) => item.type === 'role');
      for (const roleItem of createdRoles) {
        await applyFirstRoleSetup(this, roleItem);
      }
    }

    // ── Cybereye / Cyberleg left-right renaming ────────────────────────────────
    // When a second cyberware item sharing the same base name already exists,
    // rename the pair so one is suffixed "(Left)" and the other "(Right)".
    // Applies to any cyberware: "Standard Cybereye" → "Standard Cybereye (Left)"
    // and "Standard Cybereye (Right)".  Only fires when a second copy is created.
    if (embeddedName === 'Item' && !options?.cyberBlueSkipLRRename) {
      const newCyberware = created.filter((item) => item.type === 'cyberware');
      for (const newItem of newCyberware) {
        const baseName = newItem.name;
        // Skip if already tagged (Left)/(Right)
        if (baseName.endsWith('(Left)') || baseName.endsWith('(Right)')) continue;
        // Find the existing item with the same name (not the one just created)
        const existing = this.items.find(
          (item) =>
            item.type === 'cyberware'
            && item.name === baseName
            && item.id !== newItem.id
            && !item.name.endsWith('(Left)')
            && !item.name.endsWith('(Right)'),
        );
        if (existing) {
          await existing.update({ name: `${baseName} (Left)` });
          await newItem.update({ name: `${baseName} (Right)` });
        }
      }
    }

    return created;
  }

  async _prepareIncomingItemData(entry, options = {}) {
    // ── Ammo stacking: merge into existing item instead of creating a new one ─
    // When ammo of the same name already exists on the actor, increment its
    // quantity rather than adding a duplicate.  Quantity comes from the incoming
    // entry (default 1), or from the existing item's quantity field if missing.
    if (entry?.type === 'ammo') {
      const existing = this.items.find(
        (item) => item.type === 'ammo' && item.name === entry.name,
      );
      if (existing) {
        const incoming = Number(entry.system?.quantity) || 1;
        const current = Number(existing.system?.quantity) || 0;
        await existing.update({ 'system.quantity': current + incoming });
        return null; // skip creating a new item
      }
      return entry;
    }

    if (entry?.type !== 'cyberware') {
      return entry;
    }

    const nextEntry = foundry.utils.deepClone(entry);
    const system = nextEntry.system ?? {};
    if (system.integration !== 'extension' || system.parentCyberwareId) {
      return nextEntry;
    }

    // For role grants, skip the interactive platform prompt — _preCreate will
    // auto-assign to the first eligible platform.
    if (options?.cyberBlueSkipRoleGrant) {
      return nextEntry;
    }

    const selectedPlatformId = await promptForCyberwarePlatform(getEligiblePlatforms(this, null, system));
    if (selectedPlatformId === undefined || selectedPlatformId === '') {
      return null;
    }

    if (selectedPlatformId) {
      nextEntry.system = {
        ...system,
        parentCyberwareId: selectedPlatformId,
      };
      return nextEntry;
    }

    nextEntry.system = {
      ...system,
      parentCyberwareId: null,
    };
    return nextEntry;
  }

  getAvailableArmorItems() {
    return this.items.contents
      .filter((item) => item.type === 'gear' || item.type === 'cyberware')
      .filter((item) => item.system?.isArmor)
      .filter((item) => {
        if (item.type === 'gear') {
          return normalizeGearState(item.system) === 'equipped';
        }

        return Boolean(item.system.installed)
          && !item.isUnconnectedExtension?.()
          && !item.isCyberwareDisabled?.();
      })
      .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name));
  }

  getActiveArmorItem() {
    const availableArmor = this.getAvailableArmorItems();
    if (!availableArmor.length) {
      return null;
    }

    return availableArmor.find((item) => item.id === this.system.combat.activeArmorItemId) ?? availableArmor[0];
  }

  async applyDamage(amount, { ignoreArmor = false } = {}) {
    const totalDamage = Math.max(Number(amount) || 0, 0);

    // Mooks: use the derived armor value directly; no item-based "active armor" selection.
    if (this.type === 'mook') {
      const currentHp = this.system.resources.hp.value ?? 0;
      const mookSp = ignoreArmor ? 0 : Math.max(this.system.resources.armor?.value ?? 0, 0);
      const penetrated = totalDamage - mookSp;
      const hpLoss = Math.max(penetrated, 0);
      const shouldAblate = !ignoreArmor && mookSp > 0 && penetrated >= 0;
      const updates = [];

      if (hpLoss > 0) {
        updates.push(this.update({ 'system.resources.hp.value': Math.max(currentHp - hpLoss, 0) }));
      }
      if (shouldAblate) {
        // Ablate the best armor item (same source as prepareDerivedData) if present
        let bestItem = null;
        let bestMaxSp = 0;
        for (const item of this.items.contents) {
          const maxSp = item.system?.armor?.maxSp ?? 0;
          if (maxSp > bestMaxSp) { bestMaxSp = maxSp; bestItem = item; }
        }
        if (bestItem) {
          const itemCurSp = Math.min(bestItem.system?.armor?.currentSp ?? bestMaxSp, bestMaxSp);
          updates.push(bestItem.update({ 'system.armor.currentSp': Math.max(itemCurSp - 1, 0) }));
        } else {
          updates.push(this.update({ 'system.resources.armor.value': Math.max(mookSp - 1, 0) }));
        }
      }

      if (updates.length) await Promise.all(updates);
      return {
        totalDamage,
        armorId: null,
        armorName: null,
        armorBlocked: Math.min(mookSp, totalDamage),
        hpLoss,
        ablatedArmor: shouldAblate ? 1 : 0,
      };
    }

    // Vehicles: SP lives directly on resources.armor.value — no embedded armor items.
    if (this.type === 'vehicle') {
      const currentHp  = this.system.resources.hp.value ?? 0;
      const vehicleSp  = ignoreArmor ? 0 : Math.max(this.system.resources.armor?.value ?? 0, 0);
      const penetrated = totalDamage - vehicleSp;
      const hpLoss     = Math.max(penetrated, 0);
      const shouldAblate = !ignoreArmor && vehicleSp > 0 && penetrated >= 0;
      const updates    = [];

      if (hpLoss > 0) {
        updates.push(this.update({ 'system.resources.hp.value': Math.max(currentHp - hpLoss, 0) }));
      }
      if (shouldAblate) {
        updates.push(this.update({ 'system.resources.armor.value': Math.max(vehicleSp - 1, 0) }));
      }

      if (updates.length) await Promise.all(updates);
      return {
        totalDamage,
        armorId:      null,
        armorName:    null,
        armorBlocked: Math.min(vehicleSp, totalDamage),
        hpLoss,
        ablatedArmor: shouldAblate ? 1 : 0,
      };
    }

    const activeArmor = ignoreArmor ? null : this.getActiveArmorItem();
    const currentHp = this.system.resources.hp.value ?? 0;
    const currentSp = activeArmor ? Math.max(Math.min(activeArmor.system.armor?.currentSp ?? 0, activeArmor.system.armor?.maxSp ?? 0), 0) : 0;
    const penetrated = activeArmor ? totalDamage - currentSp : totalDamage;
    const hpLoss = penetrated > 0 ? penetrated : 0;
    const shouldAblateArmor = Boolean(activeArmor) && currentSp > 0 && penetrated >= 0;
    const updates = [];

    if (hpLoss > 0) {
      updates.push(this.update({
        'system.resources.hp.value': Math.max(currentHp - hpLoss, 0),
      }));
    }

    if (shouldAblateArmor) {
      updates.push(activeArmor.update({
        'system.armor.currentSp': Math.max(currentSp - 1, 0),
      }));
    }

    if (updates.length) {
      await Promise.all(updates);
    }

    return {
      totalDamage,
      armorId: activeArmor?.id ?? null,
      armorName: activeArmor?.name ?? null,
      armorBlocked: activeArmor ? Math.min(currentSp, totalDamage) : 0,
      hpLoss,
      ablatedArmor: shouldAblateArmor ? 1 : 0,
    };
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

  /**
   * Returns a Map from slug → minimum rank floor contributed by active
   * Skill Chip AEs.  Only non-disabled, transferred effects are counted.
   */
  _getSkillChipFloors() {
    const floors = new Map();
    for (const effect of this.effects ?? []) {
      if (effect.disabled) continue;
      const slug = effect.getFlag?.('cyberpunk-blue', 'skillChipFloor');
      if (typeof slug === 'string' && slug) {
        floors.set(slug, Math.max(floors.get(slug) ?? 0, 3));
      }
    }
    return floors;
  }

  getSkillRollContext(skillSlug, componentSlug = null) {
    // Mooks: all skill checks use combatNumber as a flat bonus (no separate stat + rank).
    if (this.type === 'mook') {
      const combatNumber = this.system.combatNumber ?? 10;
      const skillDef = this.getSkillDefinition(skillSlug);
      const componentDef = componentSlug ? this.getComponentDefinition(componentSlug) : null;
      const componentRank = componentSlug
        ? (this.system.components?.find?.((c) => c.slug === componentSlug)?.rank ?? 0)
        : null;
      return {
        skillLabel: skillDef?.label ?? skillSlug,
        skillRank: 0,
        statShortLabel: 'CN',
        statValue: combatNumber,
        statRollMod: 0,
        componentLabel: componentDef?.label ?? componentSlug ?? null,
        componentRank,
        usedRank: 0,
      };
    }

    const skill = this.getSkillDefinition(skillSlug);
    if (!skill) {
      throw new Error(`Unknown skill slug "${skillSlug}"`);
    }

    const stat = CONFIG.CYBER_BLUE.stats[skill.stat];
    const statValue = this.system.stats[skill.stat]?.value ?? 0;
    const statRollMod = this.system.stats[skill.stat]?.rollMod ?? 0;
    const skillRank = this.system.skills[skillSlug]?.rank ?? 0;
    const skillBonus = this.system.skills[skillSlug]?.bonus ?? 0;

    // Skill Chip: active AEs may impose a minimum rank floor of 3.
    const chipFloors = this._getSkillChipFloors();
    const skillFloor = chipFloors.get(skillSlug) ?? 0;
    const effectiveSkillRank = Math.max(skillRank, skillFloor);

    if (!componentSlug) {
      return {
        skillLabel: skill.label,
        skillRank,
        skillBonus,
        statShortLabel: stat?.shortLabel ?? skill.stat.toUpperCase(),
        statValue,
        statRollMod,
        componentLabel: null,
        componentRank: null,
        componentBonus: 0,
        usedRank: effectiveSkillRank,
      };
    }

    const component = this.getComponentDefinition(componentSlug);
    if (!component) {
      throw new Error(`Unknown component slug "${componentSlug}"`);
    }

    const componentRank = this.system.components[componentSlug]?.rank ?? 0;
    const componentBonus = this.system.components[componentSlug]?.bonus ?? 0;
    const componentFloor = chipFloors.get(componentSlug) ?? 0;
    const effectiveComponentRank = Math.max(componentRank, componentFloor);

    return {
      skillLabel: skill.label,
      skillRank,
      skillBonus,
      statShortLabel: stat?.shortLabel ?? skill.stat.toUpperCase(),
      statValue,
      statRollMod,
      componentLabel: component.label,
      componentRank,
      componentBonus,
      usedRank: Math.min(effectiveSkillRank, effectiveComponentRank),
    };
  }

  async rollSkill({ skillSlug, componentSlug = null, modifier = 0, dv = null, rollMode = null } = {}) {
    const context = this.getSkillRollContext(skillSlug, componentSlug);
    const terms = [context.statValue, context.usedRank];

    if (context.statRollMod) {
      terms.push(context.statRollMod);
    }

    // AE-sourced skill/component bonuses (from cyberware, tactics, etc.)
    const totalBonus = (context.skillBonus ?? 0) + (context.componentBonus ?? 0);
    if (totalBonus) {
      terms.push(totalBonus);
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
    const bonusText = totalBonus ? ` ${totalBonus >= 0 ? '+' : '-'} bonus ${Math.abs(totalBonus)}` : '';
    const modifierText = modifier ? ` + modifier ${modifier}` : '';
    const componentText = componentSlug
      ? `<p><strong>${context.componentLabel}</strong> rank ${context.componentRank}${context.componentBonus ? ` (+${context.componentBonus} bonus)` : ''}. ${game.i18n.localize("CYBER_BLUE.Sheet.Roll.UsesLowerRank")}</p>`
      : '';
    const dvText = hasDv
      ? `<p>${game.i18n.format("CYBER_BLUE.Sheet.Roll.AgainstDv", { dv })}: <strong>${success ? game.i18n.localize("CYBER_BLUE.Sheet.Roll.Success") : game.i18n.localize("CYBER_BLUE.Sheet.Roll.Failure")}</strong></p>`
      : '';

    const flavor = `
      <div class="cyberpunk-blue chat-card">
        <h3>${componentSlug
          ? game.i18n.localize("CYBER_BLUE.Sheet.Roll.Component")
          : game.i18n.localize("CYBER_BLUE.Sheet.Roll.Standard")}</h3>
        <p><strong>${context.skillLabel}</strong> using <strong>${context.statShortLabel}</strong> (${context.statValue}) + rank ${context.usedRank}${statModifierText}${bonusText}${modifierText}</p>
        ${componentText}
        ${dvText}
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      rollMode: rollMode ?? game.settings.get('core', 'rollMode'),
      flavor,
    });

    // Consume any one-use AEs (e.g. Guide Tarot "The Magician") now that
    // their changes have been included in this roll.
    await this.consumeOneUseEffects();

    return roll;
  }

  /**
   * Entry point for auto-generated weapon macros (and the sheet, if desired).
   * Dispatches a weapon action without relying on a rendered sheet / DOM event.
   *
   * @param {object}  opts
   * @param {string}  opts.itemId       Embedded weapon Item id on this actor.
   * @param {number}  opts.weaponIndex  Index into the item's weapons array.
   * @param {string}  opts.action       'attack' | 'autofire' | 'reload' | 'charge' | 'ricochet'.
   * @param {object}  [opts.options]    Action-specific options (e.g. { targetVitals }).
   */
  async runWeaponAction({ itemId, weaponIndex = 0, action = 'attack', options = {} } = {}) {
    // Ricochet is actor-scoped and needs no specific weapon.
    if (action === 'ricochet') {
      await toggleWeaponRicochet(this);
      return;
    }

    const item = this.items.get(itemId);
    if (!item) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Sheet.Macro.NoWeapon'));
      return;
    }

    switch (action) {
      case 'attack': {
        // The attack resolver reads the persistent per-weapon vitals flag, so
        // align it with the macro's choice before resolving.
        if (typeof options.targetVitals === 'boolean') {
          await item.setFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`, options.targetVitals);
        }
        await resolveWeaponAttack(this, item, weaponIndex);
        break;
      }
      case 'autofire':
        await resolveAutofireAttack(this, item, weaponIndex);
        break;
      case 'reload':
        await reloadWeapon(this, item, weaponIndex);
        break;
      case 'charge':
        await toggleWeaponCharge(this, item, weaponIndex);
        break;
      default:
        ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Sheet.Macro.UnknownAction'));
    }
  }

  /**
   * Delete all active one-use AEs on this actor.
   * Called automatically at the end of rollSkill; can also be called manually
   * for roll paths that bypass rollSkill (e.g. custom sheet rolls).
   */
  async consumeOneUseEffects() {
    const toDelete = this.effects
      .filter((e) => !e.disabled && e.getFlag('cyberpunk-blue', CyberBlueActiveEffect.ONE_USE_FLAG))
      .map((e) => e.id);
    if (toDelete.length) {
      await this.deleteEmbeddedDocuments('ActiveEffect', toDelete);
    }
  }

  getSeriousWoundEffect() {
    return this.effects.find((effect) => effect.getFlag('cyberpunk-blue', CyberBlueActor.SERIOUS_WOUND_FLAG));
  }

  shouldBeSeriouslyWounded() {
    if (!this.system.resources?.seriousWoundThreshold) return false;
    const hp = this.system.resources.hp.value ?? 0;
    const threshold = this.system.resources.seriousWoundThreshold.value ?? 0;
    if (!(hp > 0 && hp < threshold)) return false;
    // Pain Editor (chipware) suppresses the Seriously Wounded penalty.
    const hasPainEditor = this.effects.some(
      (e) => !e.disabled && e.getFlag?.('cyberpunk-blue', 'painEditor'),
    );
    return !hasPainEditor;
  }

  getSeriousWoundEffectData() {
    const changes = ['body', 'rflx', 'int', 'tech', 'cool'].map((slug) => ({
      key: `system.stats.${slug}.rollMod`,
      type: 'add',
      value: '-2',
    }));
    const effectData = {
      name: game.i18n.localize('CYBER_BLUE.Effect.SeriouslyWounded'),
      icon: 'systems/cyberpunk-blue/assets/pummeled.svg',
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
