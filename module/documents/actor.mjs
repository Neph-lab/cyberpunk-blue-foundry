import { getEligiblePlatforms, promptForCyberwarePlatform } from '../helpers/cyberware.mjs';
import { normalizeGearState } from '../helpers/gear.mjs';
import { applyFirstRoleSetup, normalizeRoleSystemData } from '../helpers/roles.mjs';
import { CyberBlueActiveEffect } from './active-effect.mjs';
import { resolveWeaponAttack, resolveAutofireAttack } from '../helpers/combat-resolution.mjs';
import { reloadWeapon, toggleWeaponCharge, toggleWeaponRicochet } from '../helpers/weapon-actions.mjs';

/** True if the create-data / item has a consumable-thrown (grenade) weapon entry. */
function isConsumableThrownEntry(entry) {
  const weapons = entry?.system?.weapons;
  return Array.isArray(weapons) && weapons.some((w) => w?.consumableThrown);
}

/**
 * Strip the fields that legitimately differ between two copies of the same
 * grenade stack (quantity, carried state, and the per-weapon ammoCurrent, which
 * is meaningless when quantity is the magazine) so the remainder can be compared.
 */
function normalizeStackSystem(system = {}) {
  const clone = foundry.utils.deepClone(system);
  delete clone.quantity;
  delete clone.carried;
  delete clone.state;
  if (Array.isArray(clone.weapons)) {
    for (const w of clone.weapons) { if (w) delete w.ammoCurrent; }
  }
  return clone;
}

/** Two grenade stacks merge when they share name/type and an otherwise-identical system. */
function consumableThrownStacksMatch(existingItem, entry) {
  if (existingItem.type !== entry.type || existingItem.name !== entry.name) return false;
  const existingObj = existingItem.toObject();
  if (!isConsumableThrownEntry(existingObj)) return false;
  return foundry.utils.objectsEqual(
    normalizeStackSystem(existingObj.system),
    normalizeStackSystem(entry.system ?? {}),
  );
}

export class CyberBlueActor extends Actor {
  static SERIOUS_WOUND_FLAG = 'autoSeriousWound';
  static MORTALLY_WOUNDED_FLAG = 'autoMortallyWounded';
  static NEEDS_STABILIZATION_FLAG = 'needsStabilization';
  static DEAD_FLAG = 'dead';
  static DEATH_STATE_MAX = 10;

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
    // ── Grenade stacking: merge identical consumable-thrown stacks ────────────
    // When a grenade identical to one already on the actor (save for quantity,
    // carried state, and naturally-unique fields like the id) is added, fold its
    // quantity into the existing stack and skip creating a duplicate. The
    // existing item keeps its own carried state.
    if (isConsumableThrownEntry(entry)) {
      const existing = this.items.find((it) => consumableThrownStacksMatch(it, entry));
      if (existing) {
        const incoming = Number(entry.system?.quantity) || 1;
        const current = Number(existing.system?.quantity) || 0;
        await existing.update({ 'system.quantity': current + incoming });
        return null; // skip creating a new item
      }
      return entry;
    }

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

    // Taking damage through the pipeline marks the actor as needing
    // stabilization (blocks Natural Healing until a Stabilize check clears it).
    // A corpse instead accrues Death State (1 per 4 points of post-death damage).
    if (this.type === 'character' || this.type === 'npc') {
      if (this.isDead()) {
        await this.recordPostDeathDamage(totalDamage);
      } else if (hpLoss > 0) {
        await this.applyNeedsStabilization();
      }
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
    // Mooks: skill checks use the Combat Number in place of stat + skill rank.
    // CN is used at full value when every required piece is "listed" (trained):
    //   • a plain skill check → the skill itself is listed;
    //   • a skill+component check → both the skill AND the chosen component are listed.
    // Otherwise (anything not fully listed, including a bare stat check) floor(CN/2)
    // is used. Roll-adjusting AE bonuses still apply on top, exactly as for characters.
    if (this.type === 'mook') {
      const combatNumber = this.system.combatNumber ?? 10;
      const skillDef = this.getSkillDefinition(skillSlug);
      const componentDef = componentSlug ? this.getComponentDefinition(componentSlug) : null;

      const skillListed = !!this.system.skills?.[skillSlug]?.active;
      const componentListed = componentSlug
        ? !!this.system.components?.[componentSlug]?.active
        : true;
      const statValue = (skillListed && componentListed)
        ? combatNumber
        : Math.floor(combatNumber / 2);

      // Mooks have no ranks (checks resolve from the Combat Number), so there is
      // nothing for a scoped bonus to be capped against — every skill/component
      // bonus (scoped or general) is treated as a flat general bonus on top.
      const skillScoped = this.system.skills?.[skillSlug]?.bonus ?? 0;
      const skillGeneral = this.system.skills?.[skillSlug]?.generalBonus ?? 0;
      const compScoped = componentSlug ? (this.system.components?.[componentSlug]?.bonus ?? 0) : 0;
      const compGeneral = componentSlug ? (this.system.components?.[componentSlug]?.generalBonus ?? 0) : 0;
      return {
        skillLabel: skillDef?.label ?? skillSlug,
        skillRank: 0,
        statShortLabel: 'CN',
        statValue,
        statRollMod: 0,
        componentLabel: componentDef?.label ?? componentSlug ?? null,
        componentRank: componentSlug ? (this.system.components?.[componentSlug]?.rank ?? 0) : null,
        usedRank: 0,
        generalBonus: skillScoped + skillGeneral + compScoped + compGeneral,
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
    const skillGeneral = this.system.skills[skillSlug]?.generalBonus ?? 0;

    // Skill Chip: active AEs may impose a minimum rank floor of 3.
    const chipFloors = this._getSkillChipFloors();
    const skillFloor = chipFloors.get(skillSlug) ?? 0;
    const effectiveSkillRank = Math.max(skillRank, skillFloor);
    // Scoped (skill) bonus is folded into the skill side of the min.
    const skillSide = effectiveSkillRank + skillBonus;

    if (!componentSlug) {
      // No component: the min collapses to skill + skillBonus; general on top.
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
        usedRank: skillSide,
        generalBonus: skillGeneral,
      };
    }

    const component = this.getComponentDefinition(componentSlug);
    if (!component) {
      throw new Error(`Unknown component slug "${componentSlug}"`);
    }

    const componentRank = this.system.components[componentSlug]?.rank ?? 0;
    const componentBonus = this.system.components[componentSlug]?.bonus ?? 0;
    const componentGeneral = this.system.components[componentSlug]?.generalBonus ?? 0;
    const componentFloor = chipFloors.get(componentSlug) ?? 0;
    const effectiveComponentRank = Math.max(componentRank, componentFloor);
    // Scoped (component) bonus is folded into the component side of the min.
    const componentSide = effectiveComponentRank + componentBonus;

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
      // result = stat + min(skill+skillBonus, component+componentBonus) + general
      usedRank: Math.min(skillSide, componentSide),
      generalBonus: skillGeneral + componentGeneral,
    };
  }

  async rollSkill({ skillSlug, componentSlug = null, modifier = 0, dv = null, messageMode = null } = {}) {
    const context = this.getSkillRollContext(skillSlug, componentSlug);
    const terms = [context.statValue, context.usedRank];

    if (context.statRollMod) {
      terms.push(context.statRollMod);
    }

    // General bonuses (speedware, tech tools, drugs, Netrunner rank, …) add on
    // top of the min — skill/component-scoped bonuses are already folded into
    // context.usedRank by getSkillRollContext.
    const generalBonus = context.generalBonus ?? 0;
    if (generalBonus) {
      terms.push(generalBonus);
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
    const bonusText = generalBonus ? ` ${generalBonus >= 0 ? '+' : '-'} bonus ${Math.abs(generalBonus)}` : '';
    const modifierText = modifier ? ` + modifier ${modifier}` : '';
    const componentText = componentSlug
      ? `<p><strong>${context.componentLabel}</strong> rank ${context.componentRank}${context.componentBonus ? ` (+${context.componentBonus} scoped)` : ''}. ${game.i18n.localize("CYBER_BLUE.Sheet.Roll.UsesLowerRank")}</p>`
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

    // v14: message visibility is `messageMode` (CONFIG.ChatMessage.modes), passed
    // as toMessage's SECOND argument. When null it falls back to core.messageMode.
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
    }, { messageMode });

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

  // ── Needs Stabilization ─────────────────────────────────────────────────────
  // Event-driven marker (applied by applyDamage). Blocks Natural Healing until a
  // Stabilize check clears it. Has no mechanical changes of its own.
  getNeedsStabilizationEffect() {
    return this.effects.find((e) => e.getFlag('cyberpunk-blue', CyberBlueActor.NEEDS_STABILIZATION_FLAG));
  }

  isStabilized() {
    return !this.getNeedsStabilizationEffect();
  }

  async applyNeedsStabilization(options = {}) {
    if (this.getNeedsStabilizationEffect()) return; // already flagged
    await this.createEmbeddedDocuments('ActiveEffect', [{
      name: game.i18n.localize('CYBER_BLUE.Effect.NeedsStabilization'),
      icon: 'icons/svg/blood.svg',
      origin: this.uuid,
      disabled: false,
      transfer: false,
      system: { changes: [] },
      flags: { 'cyberpunk-blue': { [CyberBlueActor.NEEDS_STABILIZATION_FLAG]: true } },
    }], options);
  }

  // ── Mortally Wounded ────────────────────────────────────────────────────────
  // Reactive marker, present iff HP ≤ 0 (mirrors the Seriously Wounded sync).
  getMortallyWoundedEffect() {
    return this.effects.find((e) => e.getFlag('cyberpunk-blue', CyberBlueActor.MORTALLY_WOUNDED_FLAG));
  }

  shouldBeMortallyWounded() {
    if (!(this.type === 'character' || this.type === 'npc')) return false;
    if (this.isDead()) return false; // a corpse is past Mortally Wounded
    return (this.system.resources?.hp?.value ?? 1) <= 0;
  }

  getMortallyWoundedEffectData() {
    return {
      name: game.i18n.localize('CYBER_BLUE.Effect.MortallyWounded'),
      icon: 'icons/svg/skull.svg',
      origin: this.uuid,
      disabled: false,
      transfer: false,
      system: { changes: [] },
      flags: { 'cyberpunk-blue': { [CyberBlueActor.MORTALLY_WOUNDED_FLAG]: true } },
    };
  }

  async syncMortallyWoundedEffect(options = {}) {
    const existing = this.getMortallyWoundedEffect();
    if (!this.shouldBeMortallyWounded()) {
      if (existing) await existing.delete({ ...options, cyberBlueSyncMortallyWounded: true });
      return;
    }
    if (!existing) {
      await this.createEmbeddedDocuments('ActiveEffect', [this.getMortallyWoundedEffectData()], {
        ...options,
        cyberBlueSyncMortallyWounded: true,
      });
    }
  }

  // ── Death (death-save loop, Dead condition, Death State) ─────────────────────
  getDeadEffect() {
    return this.effects.find((e) => e.getFlag('cyberpunk-blue', CyberBlueActor.DEAD_FLAG));
  }

  isDead() {
    return !!this.getDeadEffect();
  }

  /** The penalty currently reducing this actor's Death Save below base BODY. */
  getDeathSavePenalty() {
    return Math.max(0, -(this.system.resources?.deathSave?.bonus ?? 0));
  }

  _computeDeathState(c = {}) {
    const total = 1 + (c.base || 0) + Math.floor((c.damage || 0) / 4) + (c.crits || 0) + (c.gmExtra || 0);
    return Math.min(CyberBlueActor.DEATH_STATE_MAX, total);
  }

  /**
   * End-of-turn death save for a Mortally Wounded actor. 1d10 vs Death Save:
   *  ≤ DS → holds on (repeat next turn);
   *  > DS while conscious → falls Unconscious;
   *  > DS while Unconscious → Dead.
   * @returns {Promise<'stable'|'unconscious'|'dead'|null>}
   */
  async rollMortalDeathSave({ messageMode = null } = {}) {
    if (!this.getMortallyWoundedEffect()) return null;
    const ds = this.system.resources?.deathSave?.value ?? 1;
    const roll = await (new Roll('1d10')).evaluate();
    const survived = roll.total <= ds;
    const wasUnconscious = this.statuses?.has?.('unconscious');

    let outcome, line;
    if (survived) {
      outcome = 'stable';
      line = game.i18n.format('CYBER_BLUE.Death.Holds', { roll: roll.total, ds });
    } else if (!wasUnconscious) {
      await this.toggleStatusEffect('unconscious', { active: true });
      outcome = 'unconscious';
      line = game.i18n.format('CYBER_BLUE.Death.Unconscious', { roll: roll.total, ds });
    } else {
      await this.applyDead();
      outcome = 'dead';
      line = game.i18n.format('CYBER_BLUE.Death.Dead', { roll: roll.total, ds });
    }

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.format('CYBER_BLUE.Death.SaveTitle', { name: this.name })}</h3><p>${line}</p></div>`,
    }, { messageMode });
    return outcome;
  }

  getDeadEffectData(total) {
    return {
      name: game.i18n.format('CYBER_BLUE.Effect.DeadWithState', { state: total }),
      icon: 'icons/svg/tombstone.svg',
      origin: this.uuid,
      statuses: ['dead'],
      disabled: false,
      transfer: false,
      // Zero every stat except BODY (HP is a resource and is left untouched).
      system: {
        changes: ['rflx', 'int', 'tech', 'cool', 'move'].map((slug) => ({
          key: `system.stats.${slug}.value`, type: 'override', value: '0',
        })),
      },
      flags: {
        'cyberpunk-blue': {
          [CyberBlueActor.DEAD_FLAG]: true,
          deathState: { base: this.getDeathSavePenalty(), damage: 0, crits: 0, gmExtra: 0, total },
        },
      },
    };
  }

  async applyDead() {
    if (this.isDead()) return;
    const total = this._computeDeathState({ base: this.getDeathSavePenalty() });

    // Create the Dead effect FIRST so isDead() is true — this stops the reactive
    // Mortally Wounded sync from re-adding itself while HP is still ≤ 0 (and in
    // fact prompts that sync to remove the existing Mortally Wounded effect).
    await this.createEmbeddedDocuments('ActiveEffect', [this.getDeadEffectData(total)]);

    // Remove the wound/stabilization markers and the Unconscious condition.
    // The Mortally Wounded sync may already be deleting its effect concurrently,
    // so delete defensively (only ids that still exist, ignoring races).
    const toRemove = this.effects.filter((e) =>
      e.getFlag('cyberpunk-blue', CyberBlueActor.MORTALLY_WOUNDED_FLAG)
      || e.getFlag('cyberpunk-blue', CyberBlueActor.NEEDS_STABILIZATION_FLAG)
    ).map((e) => e.id).filter((id) => this.effects.has(id));
    if (toRemove.length) {
      try { await this.deleteEmbeddedDocuments('ActiveEffect', toRemove); } catch (_e) { /* already gone */ }
    }
    if (this.statuses?.has?.('unconscious')) await this.toggleStatusEffect('unconscious', { active: false });

    // Mark the combatant Defeated.
    const cb = game.combat?.combatants.find((c) => c.actorId === this.id);
    if (cb && !cb.defeated) await cb.update({ defeated: true });
  }

  async _updateDeathState(mutate) {
    const dead = this.getDeadEffect();
    if (!dead) return;
    const components = foundry.utils.deepClone(
      dead.getFlag('cyberpunk-blue', 'deathState') ?? { base: 0, damage: 0, crits: 0, gmExtra: 0 },
    );
    mutate(components);
    const total = this._computeDeathState(components);
    await dead.update({
      name: game.i18n.format('CYBER_BLUE.Effect.DeadWithState', { state: total }),
      'flags.cyberpunk-blue.deathState': { ...components, total },
    });
  }

  async recordPostDeathDamage(amount) {
    const n = Number(amount) || 0;
    if (n <= 0) return;
    await this._updateDeathState((c) => { c.damage = (c.damage || 0) + n; });
  }

  async recordPostDeathCrit() {
    await this._updateDeathState((c) => { c.crits = (c.crits || 0) + 1; });
  }

  /** GM control: advance Death State for time elapsed (1 per minute). */
  async advanceDeathState(minutes = 1) {
    await this._updateDeathState((c) => { c.gmExtra = (c.gmExtra || 0) + (Number(minutes) || 0); });
  }
}
