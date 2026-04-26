const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;
import { getBrandLogoPath } from '../helpers/branding.mjs';
import { getEligiblePlatforms, getPlatformUsage, promptForCyberwarePlatform } from '../helpers/cyberware.mjs';
import { getActorCyberwareDisableState } from '../helpers/cyberware-disable.mjs';
import { normalizeGearState, getGearStateUpdateData } from '../helpers/gear.mjs';
import { getEffectiveItemWeapons } from '../helpers/mods.mjs';
import { buildWeaponUpdate, getWeaponTypeDefinition, getWeaponAmmoTypes } from '../helpers/combat.mjs';
import { getCombatAttackState } from '../helpers/combat-tracker.mjs';
import { resolveWeaponAttack, resolveAutofireAttack } from '../helpers/combat-resolution.mjs';
import { CRITICAL_INJURY_FLAG } from '../helpers/critical-injury.mjs';
import { CharacterCreationWizard, CC_STEPS_LIST } from '../helpers/character-creation.mjs';
import {
  getRoleCategoryLabel,
  getRoleTeamMembers,
  getUnlockedLeaderFeatures,
  getUnlockedProteanFoci,
  getUnlockedSpecialtyOptionGroups,
  getUnlockedSpecialtySections,
  getVisibleRoleAbilitySections,
  normalizeRoleSystemData,
} from '../helpers/roles.mjs';

function sortEmbeddedDocuments(left, right) {
  return (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name);
}

function clampWeaponAmmo(weapon) {
  const magazine = Math.max(Number(weapon.magazine) || 0, 0);
  const current = Math.max(Math.min(Number(weapon.ammoCurrent) || 0, magazine), 0);
  return { current, magazine };
}

export class CyberBlueActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ['cyberpunk-blue', 'sheet', 'actor'],
    tag: 'form',
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
    position: {
      width: 980,
      height: 860,
    },
    window: {
      resizable: true,
    },
  }, { inplace: false });

  static PARTS = {
    sheet: {
      root: true,
      template: 'systems/cyberpunk-blue/templates/actor/actor-sheet.hbs',
    },
  };

  tabGroups = {
    primary: 'overview',
  };

  async _prepareContext(options) {
    if (this.element) {
      this._savedScrolls = [];
      for (const el of this.element.querySelectorAll('.tab, .sheet-body')) {
        if (el.scrollTop > 0) {
          const key = el.dataset.tab ? `[data-tab="${el.dataset.tab}"]` : el.className.split(' ')[0];
          this._savedScrolls.push({ key, scrollTop: el.scrollTop });
        }
      }
    }
    const context = await super._prepareContext(options);
    const actorData = this.document.toPlainObject();
    const { system } = actorData;
    const activeRoleId = system.roleState?.activeLowRankRoleId ?? null;
    const canManageRestricted = game.user.role >= CONST.USER_ROLES.ASSISTANT;
    const cyberwareDisableState = getActorCyberwareDisableState(this.document);
    const activeComponents = Object.entries(CONFIG.CYBER_BLUE.components)
      .filter(([slug]) => system.components[slug].active)
      .map(([slug, data]) => ({
        slug,
        label: data.label,
        rank: system.components[slug].rank,
        linkedSkills: data.skills.map((skillSlug) => CONFIG.CYBER_BLUE.skills[skillSlug].label).join(', '),
      }));
    const availableComponents = Object.entries(CONFIG.CYBER_BLUE.components)
      .filter(([slug]) => !system.components[slug].active)
      .map(([slug, data]) => ({
        slug,
        label: data.label,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    context.cssClass = this.options.classes.join(' ');
    context.actor = actorData;
    context.system = system;
    context.config = CONFIG.CYBER_BLUE;
    context.canManageRestricted = canManageRestricted;
    context.isNPC = actorData.type === 'npc';
    context.itemTypes = CONFIG.CYBER_BLUE.itemTypes;
    const moveEntry = { slug: 'move', ...CONFIG.CYBER_BLUE.stats.move, value: system.stats.move.value };
    context.stats = Object.entries(CONFIG.CYBER_BLUE.stats)
      .filter(([slug]) => slug !== 'move')
      .map(([slug, data]) => ({
        slug,
        ...data,
        value: system.stats[slug].value,
      }));
    if (context.isNPC) {
      context.stats = [...context.stats, moveEntry];
    }
    context.move = {
      slug: 'move',
      ...CONFIG.CYBER_BLUE.stats.move,
      value: system.stats.move.value,
    };
    const availableArmorItems = this.document.getAvailableArmorItems();
    const activeArmorItem = this.document.getActiveArmorItem();
    context.armor = {
      activeId: activeArmorItem?.id ?? '',
      current: system.resources.armor.value ?? 0,
      max: system.resources.armor.max ?? 0,
      options: availableArmorItems.map((item) => ({
        id: item.id,
        name: item.name,
      })),
    };
    context.psyche = {
      slug: 'psyche',
      ...CONFIG.CYBER_BLUE.resources.psyche,
      value: system.resources.psyche.value,
      max: system.resources.psyche.max,
    };
    context.luck = {
      slug: 'luck',
      ...CONFIG.CYBER_BLUE.resources.luck,
      value: system.resources.luck.value,
      max: system.resources.luck.max,
    };
    context.resources = Object.entries(CONFIG.CYBER_BLUE.resources).map(([slug, data]) => ({
      slug,
      ...data,
      value: system.resources[slug].value,
      max: system.resources[slug].max,
    }));
    const skillEntries = Object.entries(CONFIG.CYBER_BLUE.skills).map(([slug, data]) => ({
      slug,
      label: data.label,
      statSlug: data.stat,
      statLabel: CONFIG.CYBER_BLUE.stats[data.stat]?.shortLabel ?? data.stat.toUpperCase(),
      rank: system.skills[slug].rank,
      components: data.components
        .filter((componentSlug) => system.components[componentSlug].active)
        .map((componentSlug) => ({
          slug: componentSlug,
          label: CONFIG.CYBER_BLUE.components[componentSlug].label,
          rank: system.components[componentSlug].rank,
        })),
    }));
    context.skills = skillEntries;
    context.components = activeComponents;
    context.availableComponents = availableComponents;

    const embeddedItemDocuments = this.document.items.contents
      .slice()
      .sort(sortEmbeddedDocuments);
    const embeddedItems = embeddedItemDocuments
      .map((item) => ({ ...item.toPlainObject(), img: item.img || Item.DEFAULT_ICON }));
    const manufacturerLogoMap = new Map(await Promise.all(
      [...new Set(embeddedItems.map((item) => item.system.manufacturer).filter(Boolean))]
        .map(async (manufacturer) => [manufacturer, await getBrandLogoPath(manufacturer)])
    ));
    const cyberwareDescriptionMap = new Map(await Promise.all(
      embeddedItems
        .filter((item) => item.type === 'cyberware')
        .map(async (item) => ([
          item.id,
          await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description ?? '', {
            secrets: this.document.isOwner,
            async: true,
            rollData: this.document.getRollData(),
            relativeTo: this.document,
          }),
        ]))
    ));

    context.roles = embeddedItems
      .filter((item) => item.type === 'role')
      .map((item, i, arr) => ({
        ...item,
        system: normalizeRoleSystemData(item.system),
        isAlwaysActive: item.system.rank >= 4,
        isLowRankActive: item.system.rank < 4 && item.id === activeRoleId,
        canMoveUp: i > 0,
        canMoveDown: i < arr.length - 1,
      }));
    context.abilities = embeddedItems
      .filter((item) => item.type === 'ability')
      .map((item, i, arr) => ({
        ...item,
        maxRankDisplay: canManageRestricted && Number.isFinite(item.system.maxRank)
          ? item.system.maxRank
          : null,
        canMoveUp: i > 0,
        canMoveDown: i < arr.length - 1,
      }));
    const cyberwareItems = embeddedItems.filter((item) => item.type === 'cyberware');
    const cyberwareDocs = embeddedItemDocuments.filter((item) => item.type === 'cyberware');
    const cyberwareUsage = getPlatformUsage(cyberwareItems.map((item) => ({
      id: item.id,
      name: item.name,
      system: item.system,
    })));
    const cyberwareIntegrationOrder = { platform: 0, extension: 1, standalone: 2 };
    context.cyberwareGroups = (CONFIG.CYBER_BLUE.cyberware?.types ?? [])
      .map((typeConfig) => {
        const items = cyberwareItems
          .filter((item) => item.system.installed && item.system.cyberwareType === typeConfig.value)
          .filter((item) => item.system.integration !== 'extension' || Boolean(item.system.parentCyberwareId))
          .map((item) => {
            const parent = cyberwareItems.find((candidate) => candidate.id === item.system.parentCyberwareId);
            const usedSlots = cyberwareUsage.get(item.id) ?? 0;
            const itemDoc = this.document.items.get(item.id);
            return {
              ...item,
              isDisabled: cyberwareDisableState.byItemId.has(item.id),
              disabledBy: cyberwareDisableState.byItemId.get(item.id)?.effectNames ?? [],
              disabledTooltip: cyberwareDisableState.byItemId.get(item.id)?.tooltip ?? '',
              manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
              integrationLabel: CONFIG.CYBER_BLUE.cyberware.integrations
                ?.find((entry) => entry.value === item.system.integration)?.label ?? item.system.integration,
              slotText: item.system.integration === 'platform'
                ? `${Math.max((item.system.slotsProvided ?? 0) - usedSlots, 0)}/${item.system.slotsProvided ?? 0}`
                : `${item.system.slotsUsed ?? 0}`,
              platformName: parent?.name ?? null,
              canDetachPlatform: item.system.integration === 'extension' && Boolean(item.system.parentCyberwareId),
              description: cyberwareDescriptionMap.get(item.id) ?? '',
              rowGapClass: 'embedded-entry',
              effectiveWeapons: getEffectiveItemWeapons(itemDoc ?? item).map((weapon, weaponIndex) => {
                const definition = getWeaponTypeDefinition(weapon.type);
                const ammo = clampWeaponAmmo(weapon);
                return {
                  index: weaponIndex,
                  definition,
                  ammoText: definition.usesMagazine ? `${ammo.current}/${ammo.magazine}` : null,
                };
              }),
            };
          });

        // Sort by integration tier: platforms first, then extensions, then standalones.
        // JS sort is stable so relative sort order within each tier is preserved.
        items.sort((a, b) => {
          const aO = cyberwareIntegrationOrder[a.system.integration] ?? 2;
          const bO = cyberwareIntegrationOrder[b.system.integration] ?? 2;
          return aO - bO;
        });

        // Add canMoveUp/canMoveDown: items can only be reordered within their integration tier.
        const tierBuckets = {};
        for (const item of items) {
          const tier = item.system.integration ?? 'standalone';
          if (!tierBuckets[tier]) tierBuckets[tier] = [];
          tierBuckets[tier].push(item);
        }
        for (const tierItems of Object.values(tierBuckets)) {
          tierItems.forEach((item, i) => {
            item.canMoveUp = i > 0;
            item.canMoveDown = i < tierItems.length - 1;
          });
        }

        return {
          ...typeConfig,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
    {
      const unconnected = cyberwareItems
        .filter((item) => item.system.installed && item.system.integration === 'extension' && !item.system.parentCyberwareId)
        .map((item) => {
          const eligiblePlatforms = getEligiblePlatforms(this.document, item.id, item.system);
          return {
            ...item,
            isDisabled: cyberwareDisableState.byItemId.has(item.id),
            disabledTooltip: cyberwareDisableState.byItemId.get(item.id)?.tooltip ?? '',
            manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
            integrationLabel: CONFIG.CYBER_BLUE.cyberware.integrations
              ?.find((entry) => entry.value === item.system.integration)?.label ?? item.system.integration,
            slotText: `${item.system.slotsUsed ?? 0}`,
            eligiblePlatforms,
            hasEligiblePlatforms: eligiblePlatforms.length > 0,
            description: cyberwareDescriptionMap.get(item.id) ?? '',
          };
        });
      unconnected.forEach((item, i, arr) => {
        item.canMoveUp = i > 0;
        item.canMoveDown = i < arr.length - 1;
      });
      context.unconnectedCyberware = unconnected;
    }
    const gearDocs = embeddedItemDocuments.filter((item) => item.type === 'gear');
    const inventoryItems = gearDocs.map((itemDoc) => {
      const item = embeddedItems.find((entry) => entry.id === itemDoc.id);
      const state = itemDoc.getGearState?.() ?? normalizeGearState(item.system);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      return {
        ...item,
        state,
        manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
        armorText: item.system.isArmor ? `${Math.max(item.system.armor?.currentSp ?? 0, 0)}/${Math.max(item.system.armor?.maxSp ?? 0, 0)}` : null,
        weaponSummaries: effectiveWeapons.map((weapon) => {
          const definition = getWeaponTypeDefinition(weapon.type);
          const ammo = clampWeaponAmmo(weapon);
          return {
            label: definition.label,
            ammoText: definition.usesMagazine ? `${ammo.current}/${ammo.magazine}` : null,
          };
        }),
      };
    });
    context.inventoryGroups = ['equipped', 'carried', 'owned'].map((state) => {
      const items = inventoryItems.filter((item) => item.state === state);
      items.forEach((item, i, arr) => {
        item.canMoveUp = i > 0;
        item.canMoveDown = i < arr.length - 1;
      });
      return {
        state,
        label: CONFIG.CYBER_BLUE.gearStates.find((entry) => entry.value === state)?.label ?? state,
        items,
      };
    });
    const ammoDocs = embeddedItemDocuments.filter((item) => item.type === 'ammo');
    context.ammoItems = ammoDocs.map((itemDoc) => {
      const item = embeddedItems.find((entry) => entry.id === itemDoc.id) ?? itemDoc.toPlainObject();
      return { ...item };
    });
    const combatWeaponEntries = [];
    // RoF tracking: look up what this actor's token has attacked with this turn
    const actorToken = this.document.getActiveTokens()[0];
    const rofState = actorToken && game.combat?.started
      ? getCombatAttackState(actorToken.document.id)
      : null;

    const buildWeaponEntry = (itemDoc, weaponIndex, weapon, modDots) => {
      const definition = getWeaponTypeDefinition(weapon.type);
      const baseSkill = itemDoc.system.weapons?.[weaponIndex]?.skill ?? weapon.skill;
      const rollContext = this.document.getSkillRollContext(
        CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill
      );
      const total = rollContext.statValue + rollContext.usedRank + (rollContext.statRollMod ?? 0);
      const ammo = clampWeaponAmmo(weapon);
      const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill;
      const damageType = weapon.damageType ?? '';
      const autofireRank = this.document.system.skills?.autofire?.rank ?? 0;
      const autofireUsedRank = Math.min(rollContext.usedRank, autofireRank);
      const autofireTotal = rollContext.statValue + autofireUsedRank + (rollContext.statRollMod ?? 0);
      const rateOfFire = Math.max(Number(weapon.rateOfFire) || 1, 1);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);

      // RoF locking: in combat, can only attack with ONE weapon type per turn,
      // and only up to rateOfFire times with that weapon.
      const sameWeapon = rofState && rofState.itemId === itemDoc.id && rofState.weaponIndex === weaponIndex;
      const rofExhausted = sameWeapon && rofState.count >= rateOfFire;
      const rofLocked = rofState && !sameWeapon; // different weapon was used this turn

      return {
        itemId: itemDoc.id,
        weaponIndex,
        itemName: itemDoc.name,
        name: effectiveWeapons.length > 1 ? `${itemDoc.name} - ${definition.label}` : itemDoc.name,
        attackLabel: `${total >= 0 ? '+' : ''}${total}`,
        attackTooltip: `${rollContext.statShortLabel} ${rollContext.statValue} + ${rollContext.skillLabel} ${rollContext.usedRank}${rollContext.statRollMod ? ` + bonus ${rollContext.statRollMod}` : ''}`,
        damage: weapon.damage ?? definition.damage,
        concealable: weapon.concealable ?? definition.concealable,
        modDots,
        rateOfFire,
        attacksUsed: sameWeapon ? rofState.count : 0,
        rofExhausted,
        rofLocked,
        attackDisabled: rofExhausted || rofLocked,
        showsAmmo: definition.usesMagazine,
        ammoCurrent: ammo.current,
        magazine: ammo.magazine,
        shots: weapon.shots ?? 0,
        damageType,
        hasAutofire: damageType === 'autofire',
        autofireAmmoOk: damageType === 'autofire' && ammo.current >= 10,
        isStandardDamage: !['autofire', 'cone', 'explosion'].includes(damageType),
        targetVitals: itemDoc.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false,
        autofireLabel: `${autofireTotal >= 0 ? '+' : ''}${autofireTotal}`,
        autofireTooltip: `${rollContext.statShortLabel} ${rollContext.statValue} + min(${rollContext.skillLabel} ${rollContext.usedRank}, Autofire ${autofireRank})`,
        skillSlug,
        skillOptions: definition.skillOptions.map((slug) => ({
          value: slug,
          label: CONFIG.CYBER_BLUE.skills[slug]?.label ?? slug,
        })),
      };
    };

    for (const itemDoc of gearDocs) {
      if ((itemDoc.getGearState?.() ?? normalizeGearState(itemDoc.system)) !== 'equipped' || !itemDoc.system.isWeapon) {
        continue;
      }
      const modCount = this.document.items.filter((i) => i.type === 'mod' && i.system.installedOnId === itemDoc.id).length;
      const modDots = Array.from({ length: modCount }, (_, i) => i);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      for (const [weaponIndex, weapon] of effectiveWeapons.entries()) {
        combatWeaponEntries.push(buildWeaponEntry(itemDoc, weaponIndex, weapon, modDots));
      }
    }
    for (const itemDoc of cyberwareDocs) {
      if (!itemDoc.system.installed || itemDoc.isUnconnectedExtension?.() || itemDoc.isCyberwareDisabled?.() || !itemDoc.system.isWeapon) {
        continue;
      }
      const modCount = this.document.items.filter((i) => i.type === 'mod' && i.system.installedOnId === itemDoc.id).length;
      const modDots = Array.from({ length: modCount }, (_, i) => i);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      for (const [weaponIndex, weapon] of effectiveWeapons.entries()) {
        combatWeaponEntries.push(buildWeaponEntry(itemDoc, weaponIndex, weapon, modDots));
      }
    }
    context.combatWeapons = combatWeaponEntries;
    context.roleOverviewFeatures = context.roles.map((role) => {
      const roleSystem = normalizeRoleSystemData(role.system);
      const roleRank = Number(roleSystem.rank) || 0;
      const sections = getVisibleRoleAbilitySections(roleSystem, roleRank)
        .filter((section) => section.content);

      const base = {
        roleId: role.id,
        roleName: role.name,
        kind: roleSystem.category,
        categoryLabel: getRoleCategoryLabel(roleSystem.category),
        sections,
      };

      if (roleSystem.category === 'protean') {
        const foci = getUnlockedProteanFoci(roleSystem, roleRank);
        const spentPoints = foci.reduce((sum, focus) => sum + (Number(focus.points) || 0), 0);
        const remainingPoints = roleRank - spentPoints;
        return {
          ...base,
          totalPoints: roleRank,
          spentPoints,
          remainingPoints,
          foci: foci.map((focus) => {
            const step = Math.max(Number(focus.step) || 1, 1);
            const max = Math.max(Number(focus.maxPoints) || 0, 0);
            const available = (Number(focus.points) || 0) + remainingPoints;
            const pointOptions = [];
            for (let v = 0; v <= max; v += step) {
              pointOptions.push({ value: v, disabled: v > Math.min(max, available) });
            }
            return {
              ...focus,
              focusIndex: (roleSystem.proteanFoci ?? []).findIndex((f) => f.id === focus.id),
              pointOptions,
            };
          }),
        };
      }

      if (roleSystem.category === 'leader') {
        const leaderFeatures = getUnlockedLeaderFeatures(roleSystem, roleRank).map((feature) => ({
          ...feature,
          featureIndex: (roleSystem.leaderFeatures ?? []).findIndex((f) => f.id === feature.id),
          members: getRoleTeamMembers(this.document, this.document.items.get(role.id), feature).map((member) => ({
            id: member.id,
            name: member.name,
            img: member.img || member.prototypeToken?.texture?.src || Actor.DEFAULT_ICON,
          })),
        })).filter((feature) => feature.members.length || feature.selectedUuids?.length);
        return { ...base, leaderFeatures };
      }

      if (roleSystem.category === 'specialist') {
        const specialties = (roleSystem.specialties ?? []).filter((specialty) => specialty.rank > 0).map((specialty, specialtyIndex) => {
          const unlockedGroups = getUnlockedSpecialtyOptionGroups(specialty);
          const allSelectedIds = new Set(unlockedGroups.flatMap((g) => g.selectedOptionIds ?? []));
          const totalSelected = allSelectedIds.size;
          const atCap = totalSelected >= (Number(specialty.rank) || 0);
          const allOptions = unlockedGroups.flatMap((group) => {
            const realGroupIndex = (specialty.optionGroups ?? []).findIndex((g) => g.id === group.id);
            return (group.options ?? []).map((option) => ({
              ...option,
              selected: (group.selectedOptionIds ?? []).includes(option.id),
              disabled: atCap && !(group.selectedOptionIds ?? []).includes(option.id),
              groupIndex: realGroupIndex,
            }));
          });
          return {
            ...specialty,
            specialtyIndex,
            unlockedSections: getUnlockedSpecialtySections(specialty),
            unlockedOptionGroups: unlockedGroups,
            allOptions,
          };
        });
        return { ...base, specialties };
      }

      return base;
    }).filter((feature) => {
      if (feature.sections?.length) return true;
      if (feature.kind === 'protean' && feature.foci?.length) return true;
      if (feature.kind === 'leader' && feature.leaderFeatures?.length) return true;
      if (feature.kind === 'specialist' && feature.specialties?.length) return true;
      return false;
    });
    context.enrichedRoleOverviewFeatures = await Promise.all(context.roleOverviewFeatures.map(async (feature) => ({
      ...feature,
      sections: await Promise.all((feature.sections ?? []).map(async (section) => ({
        ...section,
        enrichedContent: await foundry.applications.ux.TextEditor.implementation.enrichHTML(section.content ?? '', {
          secrets: this.document.isOwner,
          async: true,
          rollData: this.document.getRollData(),
          relativeTo: this.document,
        }),
      }))),
      specialties: feature.specialties
        ? await Promise.all(feature.specialties.map(async (specialty) => ({
          ...specialty,
          unlockedSections: await Promise.all((specialty.unlockedSections ?? []).map(async (section) => ({
            ...section,
            enrichedContent: await foundry.applications.ux.TextEditor.implementation.enrichHTML(section.content ?? '', {
              secrets: this.document.isOwner,
              async: true,
              rollData: this.document.getRollData(),
              relativeTo: this.document,
            }),
          }))),
        })))
        : null,
    })));
    context.health = {
      hp: {
        value: system.resources.hp.value,
        max: system.resources.hp.max,
      },
      seriousWoundThreshold: system.resources.seriousWoundThreshold.value,
      deathSave: system.resources.deathSave.value,
      effects: this.document.effects.contents
        .filter((effect) => !effect.disabled)
        .map((effect) => {
          const critFlag = effect.getFlag('cyberpunk-blue', CRITICAL_INJURY_FLAG);
          return {
            id: effect.id,
            uuid: effect.uuid,
            name: effect.name,
            icon: effect.img || effect.icon,
            duration: effect.duration?.label || game.i18n.localize('CYBER_BLUE.Effect.Ongoing'),
            canEdit: game.user.role >= CONST.USER_ROLES.TRUSTED,
            isCriticalInjury: !!critFlag,
            mortal: critFlag?.mortal ?? false,
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
    context.otherResources = context.resources.filter((resource) => !['hp', 'armor', 'luck', 'psyche'].includes(resource.slug));

    context.enrichedDetails = {};
    for (const field of ['background', 'appearance', 'personality', 'style']) {
      context.enrichedDetails[field] = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.details[field], {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.getRollData(),
        relativeTo: this.document,
      });
    }

    const networkerRole = context.roles.find((role) => {
      const rs = normalizeRoleSystemData(role.system);
      return rs.category === 'networker' && (Number(rs.rank) || 0) >= 1;
    });
    const networkerRoleSystem = networkerRole ? normalizeRoleSystemData(networkerRole.system) : null;
    const networkerRank = Number(networkerRoleSystem?.rank) || 0;
    context.showNetrunningTab = Boolean(networkerRole);

    // ── Netrunner tab context ──────────────────────────────────────────────
    if (networkerRole) {
      // Component uses (excluding Software)
      const NETRUNNER_COMPONENT_USES = {
        codebreak:   [{ slug: 'breach', label: 'Breach' }, { slug: 'encryptDecrypt', label: 'Encrypt/Decrypt' }],
        cracker:     [{ slug: 'defend', label: 'Defend' }, { slug: 'zap', label: 'Zap' }],
        dev:         [{ slug: 'code', label: 'Code' }, { slug: 'deconstruct', label: 'Deconstruct' }],
        ghost:       [{ slug: 'cloak', label: 'Cloak' }, { slug: 'slide', label: 'Slide' }],
        spider:      [{ slug: 'eyeDee', label: 'Eye-Dee' }, { slug: 'pathfinder', label: 'Pathfinder' }, { slug: 'scanner', label: 'Scanner' }],
        quickhacking: [{ slug: 'upload', label: 'Upload' }, { slug: 'quickbreach', label: 'Quickbreach' }],
      };
      const NETRUNNER_COMPONENTS_ORDER = ['codebreak', 'cracker', 'dev', 'ghost', 'spider', 'quickhacking'];
      const intVal = system.stats?.int?.value ?? 0;
      const netrunningSkillRank = system.skills?.netrunning?.rank ?? 0;

      context.netrunnerComponents = NETRUNNER_COMPONENTS_ORDER.map((slug) => {
        const componentRank = system.components?.[slug]?.rank ?? 0;
        const modifier = intVal + networkerRank + Math.min(netrunningSkillRank, componentRank);
        const modLabel = (modifier >= 0 ? '+' : '') + modifier;
        // Embed componentSlug + modifier into each use so the template doesn't need ../
        const uses = (NETRUNNER_COMPONENT_USES[slug] ?? []).map((u) => ({
          ...u,
          componentSlug: slug,
          modifier,
          modLabel,
        }));
        return {
          slug,
          label: CONFIG.CYBER_BLUE.components[slug]?.label ?? slug,
          rank: componentRank,
          modifier,
          modLabel,
          uses,
        };
      });

      // Computer items from actor inventory (gear + cyberware where isComputer)
      const computerItems = embeddedItems.filter((item) =>
        (item.type === 'gear' || item.type === 'cyberware') && item.system.isComputer
      );

      // Count executables installed on each computer
      const allExecutables = embeddedItems.filter((item) => item.type === 'programExecutable');
      const execsPerComputer = new Map();
      for (const exe of allExecutables) {
        const cid = exe.system.installedOnId;
        if (cid) execsPerComputer.set(cid, (execsPerComputer.get(cid) ?? 0) + 1);
      }

      context.netrunnerComputers = computerItems
        .map((c) => {
          const comp = c.system.computer ?? {};
          const usedSlots = execsPerComputer.get(c.id) ?? 0;
          const totalSlots = (comp.softwareSlots ?? 0) + (comp.generalSlots ?? 0);
          return {
            id: c.id,
            name: c.name,
            img: c.img,
            hardwareSlots: comp.hardwareSlots ?? 0,
            softwareSlots: comp.softwareSlots ?? 0,
            generalSlots: comp.generalSlots ?? 0,
            ram: comp.ram ?? 0,
            isCyberdeck: comp.isCyberdeck ?? false,
            canQuickhack: comp.canQuickhack ?? false,
            running: comp.running ?? false,
            usedSlots,
            freeSlots: Math.max(totalSlots - usedSlots, 0),
          };
        })
        .sort((a, b) => {
          if (a.isCyberdeck !== b.isCyberdeck) return a.isCyberdeck ? -1 : 1;
          if (a.canQuickhack !== b.canQuickhack) return a.canQuickhack ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      // Split executables into On Disk vs On Shards
      const computerIdSet = new Set(computerItems.map((c) => c.id));
      const computerById = new Map(context.netrunnerComputers.map((c) => [c.id, c]));
      const executablesOnDisk = [];
      const executablesOnShards = [];
      for (const exe of allExecutables) {
        const cid = exe.system.installedOnId;
        const valid = cid && computerIdSet.has(cid);
        const entry = { ...exe };
        if (valid) {
          entry.computerName = computerById.get(cid)?.name ?? '?';
          executablesOnDisk.push(entry);
        } else {
          entry.invalidComputer = Boolean(cid && !computerIdSet.has(cid));
          executablesOnShards.push(entry);
        }
      }

      const buildColVis = (items, isDisk) => ({
        showNote: items.some((e) => e.system.note),
        showAct:  items.some((e) => (e.system.act ?? 0) > 0),
        showAtk:  items.some((e) => (e.system.atk ?? 0) > 0),
        showDef:  items.some((e) => (e.system.def ?? 0) > 0),
        showNet:  items.some((e) => (e.system.net ?? 0) > 0),
        showPer:  items.some((e) => (e.system.per ?? 0) > 0),
        showRez:  items.some((e) => isDisk
          ? ((e.system.rez?.max ?? 0) > 0 || (e.system.rez?.value ?? 0) > 0)
          : (e.system.rez?.max ?? 0) > 0),
      });

      context.executablesOnDisk   = executablesOnDisk;
      context.executablesOnShards = executablesOnShards;
      context.diskColVis   = buildColVis(executablesOnDisk, true);
      context.shardsColVis = buildColVis(executablesOnShards, false);
    } else {
      context.netrunnerComponents  = [];
      context.netrunnerComputers   = [];
      context.executablesOnDisk    = [];
      context.executablesOnShards  = [];
      context.diskColVis   = {};
      context.shardsColVis = {};
    }

    // Character creation state
    const isCC = actorData.type === 'character' && (system.characterCreation?.active ?? false);
    const stepIdx = isCC ? CC_STEPS_LIST.indexOf(system.characterCreation?.step ?? 'welcome') : -1;
    const canEdit = context.editable ?? false;
    context.charCreation = {
      active: isCC,
      canBegin: actorData.type === 'character' && !isCC && canManageRestricted,
      step: isCC ? (system.characterCreation?.step ?? null) : null,
      notesWritable: !isCC || (stepIdx > 0 && canEdit),
      statsWritable: !isCC || (stepIdx > 2 && canEdit),
      skillsWritable: !isCC || (stepIdx >= 6 && canEdit),
      highlightStats: isCC && stepIdx === 2,
      highlightSecondary: isCC && stepIdx === 3,
      highlightAbilities: isCC && stepIdx === 5,
      highlightSkills: isCC && stepIdx === 6,
    };

    context.isGM = game.user.isGM;

    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const tabs = new Tabs({
      navSelector: '.sheet-tabs',
      contentSelector: '.sheet-body',
      initial: this.tabGroups.primary ?? 'overview',
      callback: (_event, _tabs, active) => {
        this.tabGroups.primary = active;
      },
    });
    tabs.bind(this.element);

    this.element.querySelectorAll('[data-action="create-item"]').forEach((button) => {
      button.addEventListener('click', this._onItemCreate.bind(this));
    });
    this.element.querySelectorAll('[data-action="edit-item"], .item-name-link').forEach((button) => {
      button.addEventListener('click', this._onItemEdit.bind(this));
    });
    this.element.querySelectorAll('[data-action="delete-item"]').forEach((button) => {
      button.addEventListener('click', this._onItemDelete.bind(this));
    });
    this.element.querySelectorAll('[data-action="move-item"]').forEach((button) => {
      button.addEventListener('click', this._onItemMove.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-active-role"]').forEach((button) => {
      button.addEventListener('click', this._onToggleActiveRole.bind(this));
    });
    this.element.querySelectorAll('[data-action="add-component"]').forEach((button) => {
      button.addEventListener('click', this._onAddComponent.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-component"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveComponent.bind(this));
    });
    this.element.querySelectorAll('[data-action="roll-skill"]').forEach((button) => {
      button.addEventListener('click', this._onRollSkill.bind(this));
    });
    this.element.querySelectorAll('[data-action="open-health-effect"]').forEach((button) => {
      button.addEventListener('click', this._onOpenHealthEffect.bind(this));
    });
    this.element.querySelectorAll('[data-action="assign-platform"]').forEach((button) => {
      button.addEventListener('click', this._onAssignPlatform.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-platform"]').forEach((button) => {
      button.addEventListener('click', this._onRemovePlatform.bind(this));
    });
    this.element.querySelectorAll('[data-action="set-gear-state"]').forEach((button) => {
      button.addEventListener('click', this._onSetGearState.bind(this));
    });
    this.element.querySelectorAll('[data-action="update-item-field"]').forEach((input) => {
      input.addEventListener('change', this._onUpdateItemField.bind(this));
    });
    this.element.querySelectorAll('[data-action="set-ammo-quantity"]').forEach((input) => {
      input.addEventListener('change', this._onSetAmmoQuantity.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-attack"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponAttack.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-autofire"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponAutofire.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-damage"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponDamage.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-reload"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponReload.bind(this));
    });
    this.element.querySelectorAll('[data-action="open-team-member"]').forEach((button) => {
      button.addEventListener('click', this._onOpenTeamMember.bind(this));
    });
    this.element.querySelectorAll('[data-edit="img"]').forEach((element) => {
      element.addEventListener('click', this._onEditProfileImage.bind(this));
    });
    this.element.querySelectorAll('[data-action="update-protean-points"]').forEach((input) => {
      input.addEventListener('change', this._onUpdateProteanPoints.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-specialty-option"]').forEach((input) => {
      input.addEventListener('change', this._onToggleSpecialtyOption.bind(this));
    });

    this.element.querySelector('[data-action="begin-character-creation"]')?.addEventListener('click', this._onBeginCharacterCreation.bind(this));
    this.element.querySelector('[data-action="open-character-creation-wizard"]')?.addEventListener('click', this._onOpenCharacterCreationWizard.bind(this));

    this.element.querySelectorAll('[data-action="remove-critical-injury"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveCriticalInjury.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-target-vitals"]').forEach((checkbox) => {
      checkbox.addEventListener('change', this._onToggleTargetVitals.bind(this));
    });

    // Netrunner tab
    this.element.querySelectorAll('[data-action="netrunner-component-roll"]').forEach((button) => {
      button.addEventListener('click', this._onNetrunnerComponentRoll.bind(this));
    });
    this.element.querySelectorAll('[data-action="executable-install"]').forEach((button) => {
      button.addEventListener('click', this._onExecutableInstall.bind(this));
    });
    this.element.querySelectorAll('[data-action="executable-uninstall"]').forEach((button) => {
      button.addEventListener('click', this._onExecutableUninstall.bind(this));
    });
    this.element.querySelectorAll('[data-action="executable-roll-atk"]').forEach((button) => {
      button.addEventListener('click', this._onExecutableRollAtk.bind(this));
    });
    this.element.querySelectorAll('[data-action="executable-roll-per"]').forEach((button) => {
      button.addEventListener('click', this._onExecutableRollPer.bind(this));
    });
    this.element.querySelectorAll('[data-executable-field]').forEach((input) => {
      input.addEventListener('change', this._onExecutableFieldUpdate.bind(this));
    });

    // Restore scroll positions after re-render
    if (this._savedScrolls?.length) {
      for (const { key, scrollTop } of this._savedScrolls) {
        const el = this.element.querySelector(key.startsWith('[') ? key : `.${key}`);
        if (el) el.scrollTop = scrollTop;
      }
      this._savedScrolls = null;
    }
  }

  async _onRemoveCriticalInjury(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    if (!effectId) return;
    const effect = this.document.effects.get(effectId);
    if (!effect) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.CriticalInjury.EffectNotFound'));
      return;
    }
    await effect.delete();
  }

  async _onToggleTargetVitals(event) {
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    const item = this._getItemFromEvent(event);
    if (!item) return;
    const current = item.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false;
    await item.setFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`, !current);
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.itemType;
    if (!type) {
      return;
    }

    const label = CONFIG.CYBER_BLUE.itemTypes[type]?.label ?? type;
    await this.document.createEmbeddedDocuments('Item', [
      {
        name: `New ${label}`,
        type,
      },
    ]);
  }

  _getItemFromEvent(event) {
    const row = event.currentTarget.closest('[data-item-id]');
    return row ? this.document.items.get(row.dataset.itemId) : null;
  }

  async _onItemEdit(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    return item?.sheet.render(true);
  }

  async _onItemDelete(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (item) {
      await item.delete();
    }
  }

  async _onItemMove(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item) {
      return;
    }

    const direction = event.currentTarget.dataset.direction === 'down' ? 1 : -1;
    const row = event.currentTarget.closest('[data-item-id]');
    const container = row?.parentElement;
    const siblingRows = container
      ? Array.from(container.children).filter((element) => element.hasAttribute('data-item-id'))
      : [];
    const currentIndex = siblingRows.findIndex((element) => element.dataset.itemId === item.id);
    const targetRow = siblingRows[currentIndex + direction];
    const target = targetRow ? this.document.items.get(targetRow.dataset.itemId) : null;

    if (!target) {
      return;
    }

    const siblings = siblingRows
      .filter((element) => element.dataset.itemId !== item.id)
      .map((element) => this.document.items.get(element.dataset.itemId))
      .filter(Boolean);
    const sortUpdates = SortingHelpers.performIntegerSort(item, {
      target,
      siblings,
      sortBefore: direction < 0,
    });
    const updateData = sortUpdates.map((update) => ({
      _id: update.target._id,
      ...update.update,
    }));

    await this.document.updateEmbeddedDocuments('Item', updateData);
  }

  async _onToggleActiveRole(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'role' || item.system.rank >= 4) {
      return;
    }

    const currentId = this.document.system.roleState.activeLowRankRoleId;
    const nextId = currentId === item.id ? null : item.id;
    await this.document.update({ 'system.roleState.activeLowRankRoleId': nextId });
  }

  async _onAddComponent(event) {
    event.preventDefault();
    const select = this.element.querySelector('[data-component-select]');
    const componentSlug = select?.value;
    if (!componentSlug) {
      return;
    }

    await this.document.update({
      [`system.components.${componentSlug}.active`]: true,
      [`system.components.${componentSlug}.rank`]: this.document.system.components[componentSlug]?.rank ?? 0,
    });
  }

  async _onRemoveComponent(event) {
    event.preventDefault();
    const componentSlug = event.currentTarget.dataset.componentSlug;
    if (!componentSlug) {
      return;
    }

    await this.document.update({
      [`system.components.${componentSlug}.active`]: false,
      [`system.components.${componentSlug}.rank`]: 0,
    });
  }

  async _onRollSkill(event) {
    event.preventDefault();

    const skillSlug = event.currentTarget.dataset.skillSlug;
    const componentSlug = event.currentTarget.dataset.componentSlug || null;
    const row = event.currentTarget.closest('[data-skill-row]');
    const modifierField = row?.querySelector('[data-field="modifier"]');
    const modifierValue = Number.parseInt(modifierField?.value ?? '0', 10);

    await this.document.rollSkill({
      skillSlug,
      componentSlug,
      modifier: Number.isNaN(modifierValue) ? 0 : modifierValue,
    });
  }

  async _onOpenHealthEffect(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    if (!effectId) {
      return;
    }

    const effect = this.document.effects.get(effectId);
    if (!effect) {
      return;
    }

    await effect.sheet.render(true, {
      editable: game.user.role >= CONST.USER_ROLES.TRUSTED,
    });
  }

  async _onAssignPlatform(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'cyberware' || item.system.integration !== 'extension') {
      return;
    }

    const eligiblePlatforms = getEligiblePlatforms(this.document, item.id, item.system);
    if (!eligiblePlatforms.length) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Cyberware.NoEligiblePlatforms'));
      return;
    }

    const platformId = await promptForCyberwarePlatform(eligiblePlatforms);

    if (!platformId) {
      return;
    }

    await item.update({ 'system.parentCyberwareId': platformId });
  }

  async _onRemovePlatform(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'cyberware' || item.system.integration !== 'extension') {
      return;
    }

    await item.update({ 'system.parentCyberwareId': null });
  }

  async _onSetGearState(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const state = event.currentTarget.dataset.state;
    if (!item || item.type !== 'gear' || !state) {
      return;
    }

    await item.update(getGearStateUpdateData(state));
  }

  async _onUpdateItemField(event) {
    const item = this._getItemFromEvent(event);
    const path = event.currentTarget.dataset.fieldPath;
    if (!item || !path) {
      return;
    }

    const rawValue = event.currentTarget.type === 'checkbox'
      ? event.currentTarget.checked
      : event.currentTarget.value;
    const value = event.currentTarget.dataset.dtype === 'Number'
      ? Number(rawValue) || 0
      : rawValue;

    // Weapon array fields must emit all 16 schema fields to avoid cleanData
    // resetting every unmentioned field to its schema initial value.
    const weaponMatch = path.match(/^system\.weapons\.(\d+)\.(.+)$/);
    if (weaponMatch) {
      const weaponIndex = Number(weaponMatch[1]);
      const field = weaponMatch[2];
      await item.update(buildWeaponUpdate(item, weaponIndex, { [field]: value }));
    } else {
      await item.update({ [path]: value });
    }
  }

  async _onWeaponAttack(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) {
      return;
    }
    await resolveWeaponAttack(this.document, item, weaponIndex);
  }

  async _onWeaponAutofire(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) {
      return;
    }
    await resolveAutofireAttack(this.document, item, weaponIndex);
  }

  async _onWeaponDamage(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) {
      return;
    }

    const weapon = (item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item))[weaponIndex];
    if (!weapon) {
      return;
    }

    const formula = weapon.damage ?? '1d6';
    const roll = await new Roll(formula).evaluate();
    const definition = getWeaponTypeDefinition(weapon.type);
    const weaponLabel = item.system.weapons?.length > 1
      ? `${item.name} - ${definition.label}`
      : item.name;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Damage')}: ${weaponLabel}</h3></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  async _onWeaponReload(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) return;

    const sourceWeapon = item._source?.system?.weapons?.[weaponIndex] ?? {};
    const magazine = Math.max(Number(sourceWeapon.magazine) || 0, 0);
    const ammoCurrent = Math.max(Number(sourceWeapon.ammoCurrent) || 0, 0);
    const ammoNeededFull = magazine - ammoCurrent;

    if (ammoNeededFull <= 0) {
      ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.WeaponAlreadyFull'));
      return;
    }

    // Find compatible ammo types for this weapon type
    const compatibleAmmoKeys = getWeaponAmmoTypes(sourceWeapon.type ?? '');
    if (compatibleAmmoKeys.length === 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoAmmoType'));
      return;
    }

    // Filter actor's ammo items to those compatible with this weapon
    const actorAmmoDocs = this.document.items.filter((i) => {
      if (i.type !== 'ammo') return false;
      return compatibleAmmoKeys.some((key) => i.system.ammoTypes?.[key]);
    });

    if (actorAmmoDocs.length === 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoCompatibleAmmo'));
      return;
    }

    // If multiple compatible ammo available, prompt player to choose
    let chosenAmmoDoc = actorAmmoDocs[0];
    if (actorAmmoDocs.length > 1) {
      const { promise, resolve } = Promise.withResolvers();
      const buttons = actorAmmoDocs.map((ammoDoc) => ({
        action: ammoDoc.id,
        label: `${ammoDoc.name} (×${ammoDoc.system.quantity})`,
        icon: 'fas fa-box-open',
        callback: () => resolve(ammoDoc.id),
      }));
      buttons.push({ action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fas fa-times', callback: () => resolve(null) });
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize('CYBER_BLUE.Combat.ChooseAmmo') },
        content: `<div class="cyberpunk-blue"><p>${game.i18n.localize('CYBER_BLUE.Combat.ChooseAmmoHint')}</p></div>`,
        buttons,
        submit: (result) => resolve(result),
      });
      dialog.addEventListener('close', () => resolve(null), { once: true });
      dialog.render(true);
      const chosenId = await promise;
      if (!chosenId) return;
      chosenAmmoDoc = actorAmmoDocs.find((a) => a.id === chosenId);
      if (!chosenAmmoDoc) return;
    }

    // Determine how many rounds we can load
    let ammoNeeded = ammoNeededFull;
    let currentAfterUnload = ammoCurrent;

    // If loading a different ammo type than currently loaded → unload existing rounds first
    const prevUuid = sourceWeapon.ammoTypeUuid ?? '';
    const sameAmmo = prevUuid && prevUuid === chosenAmmoDoc.uuid;
    if (!sameAmmo && prevUuid && ammoCurrent > 0) {
      // Try to resolve the previously loaded ammo
      let prevAmmoItem = null;
      try { prevAmmoItem = await fromUuid(prevUuid); } catch { /* not found */ }

      // Search for a matching item on the actor (by uuid, then by name)
      let prevOnActor = this.document.items.find((i) => i.type === 'ammo' && i.uuid === prevUuid);
      if (!prevOnActor && prevAmmoItem?.name) {
        prevOnActor = this.document.items.find((i) => i.type === 'ammo' && i.name === prevAmmoItem.name);
      }
      if (!prevOnActor && !prevAmmoItem) {
        // Try searching world items by name fallback (from world Items directory)
        const worldMatch = game.items.find((i) => i.type === 'ammo' && i.uuid === prevUuid);
        if (worldMatch) prevAmmoItem = worldMatch;
      }

      if (prevOnActor) {
        // Return rounds to existing stack on actor
        await prevOnActor.update({ 'system.quantity': prevOnActor.system.quantity + ammoCurrent });
      } else if (prevAmmoItem) {
        // Create a new ammo entry on the actor with the returned rounds
        const createdData = prevAmmoItem.toObject();
        createdData.system.quantity = ammoCurrent;
        await this.document.createEmbeddedDocuments('Item', [createdData]);
      }
      // Empty the mag before reloading with new ammo
      currentAfterUnload = 0;
      ammoNeeded = magazine;
    }

    // Load as many rounds as we have
    const toLoad = Math.min(ammoNeeded, Math.max(Number(chosenAmmoDoc.system.quantity) || 0, 0));
    if (toLoad <= 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoCompatibleAmmo'));
      return;
    }

    const newAmmoCurrent = currentAfterUnload + toLoad;
    const newAmmoQty = chosenAmmoDoc.system.quantity - toLoad;

    // Update weapon: new ammo count + record which ammo was used
    await item.update(buildWeaponUpdate(item, weaponIndex, {
      ammoCurrent: newAmmoCurrent,
      ammoTypeUuid: chosenAmmoDoc.uuid,
    }));

    // Update or delete the ammo item
    if (newAmmoQty <= 0) {
      await chosenAmmoDoc.delete();
    } else {
      await chosenAmmoDoc.update({ 'system.quantity': newAmmoQty });
    }
  }

  async _onOpenTeamMember(event) {
    event.preventDefault();
    const actorId = event.currentTarget.dataset.actorId;
    if (!actorId) {
      return;
    }
    const actor = game.actors.get(actorId);
    return actor?.sheet.render(true);
  }

  async _onSetAmmoQuantity(event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'ammo') return;
    const qty = Math.max(Number(event.currentTarget.value) || 0, 0);
    if (qty === 0) {
      await item.delete();
    } else {
      await item.update({ 'system.quantity': qty });
    }
  }

  async _onUpdateProteanPoints(event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'role') {
      return;
    }
    const focusIndex = Number.parseInt(event.currentTarget.dataset.focusIndex ?? '-1', 10);
    if (Number.isNaN(focusIndex) || focusIndex < 0) {
      return;
    }
    const value = Number(event.currentTarget.value) || 0;
    const systemData = item.system.toObject?.() ?? item.system;
    const foci = foundry.utils.deepClone(systemData.proteanFoci ?? []);
    if (!foci[focusIndex]) {
      return;
    }
    foci[focusIndex] = { ...foci[focusIndex], points: value };
    await item.update({ 'system.proteanFoci': foci });
    this.render();
  }

  async _onToggleSpecialtyOption(event) {
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'role') return;
    const specialtyIndex = Number.parseInt(event.currentTarget.dataset.specialtyIndex ?? '-1', 10);
    const groupIndex = Number.parseInt(event.currentTarget.dataset.groupIndex ?? '-1', 10);
    const optionId = event.currentTarget.dataset.optionId;
    if (specialtyIndex < 0 || groupIndex < 0 || !optionId) return;

    const systemData = item.system.toObject?.() ?? item.system;
    const system = foundry.utils.deepClone(systemData);
    const specialty = system.specialties?.[specialtyIndex];
    if (!specialty) return;
    const group = specialty.optionGroups?.[groupIndex];
    if (!group) return;

    const next = new Set(group.selectedOptionIds ?? []);
    if (event.currentTarget.checked) {
      // Check cross-group total against rank cap
      const otherGroupTotal = specialty.optionGroups.reduce((acc, g, gi) => {
        if (gi === groupIndex) return acc;
        return acc + (g.selectedOptionIds ?? []).length;
      }, 0);
      if (otherGroupTotal + next.size + 1 > (Number(specialty.rank) || 0)) {
        event.currentTarget.checked = false;
        return;
      }
      next.add(optionId);
    } else {
      next.delete(optionId);
    }
    group.selectedOptionIds = [...next];
    await item.update({ system });
  }

  async _onBeginCharacterCreation(event) {
    event.preventDefault();
    await this.document.update({
      'system.characterCreation.active': true,
      'system.characterCreation.step': 'welcome',
      'system.characterCreation.extraLanguage': '',
    });
    new CharacterCreationWizard(this.document).render(true);
  }

  async _onOpenCharacterCreationWizard(event) {
    event.preventDefault();
    const existing = CharacterCreationWizard.getForActor(this.document.id);
    if (existing) {
      existing.bringToFront?.();
    } else {
      new CharacterCreationWizard(this.document).render(true);
    }
  }

  async _onEditProfileImage(event) {
    event.preventDefault();
    if (!this.document.isOwner && game.user.role < CONST.USER_ROLES.ASSISTANT) {
      return;
    }

    const current = this.document.img || '';
    const picker = new FilePicker({
      type: 'imagevideo',
      current,
      callback: async (path) => {
        await this.document.update({ img: path });
      },
    });

    return picker.browse();
  }

  // ── Netrunner tab handlers ────────────────────────────────────────────────

  async _onNetrunnerComponentRoll(event) {
    event.preventDefault();
    const componentSlug = event.currentTarget.dataset.componentSlug;
    const useLabel = event.currentTarget.dataset.useLabel;
    const modifier = Number(event.currentTarget.dataset.modifier) || 0;
    if (!componentSlug) return;

    const componentLabel = CONFIG.CYBER_BLUE.components[componentSlug]?.label ?? componentSlug;
    const formula = modifier >= 0 ? `1d10+${modifier}` : `1d10${modifier}`;
    const roll = await new Roll(formula).evaluate();
    const flavor = `<div class="cyberpunk-blue chat-card"><h3>${componentLabel}: ${useLabel}</h3></div>`;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  async _onExecutableInstall(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const exeDoc = itemId ? this.document.items.get(itemId) : null;
    if (!exeDoc || exeDoc.type !== 'programExecutable') return;

    // Find all computers with available slots
    const computerItems = this.document.items.filter((i) =>
      (i.type === 'gear' || i.type === 'cyberware') && i.system.isComputer
    );
    const allExes = this.document.items.filter((i) => i.type === 'programExecutable');
    const execsPerComputer = new Map();
    for (const exe of allExes) {
      const cid = exe.system.installedOnId;
      if (cid) execsPerComputer.set(cid, (execsPerComputer.get(cid) ?? 0) + 1);
    }

    const eligible = computerItems
      .map((c) => {
        const comp = c.system.computer ?? {};
        const totalSlots = (comp.softwareSlots ?? 0) + (comp.generalSlots ?? 0);
        const used = execsPerComputer.get(c.id) ?? 0;
        return { id: c.id, name: c.name, isCyberdeck: comp.isCyberdeck ?? false, free: totalSlots - used };
      })
      .filter((c) => c.free > 0)
      .sort((a, b) => {
        if (a.isCyberdeck !== b.isCyberdeck) return a.isCyberdeck ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    if (eligible.length === 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoEligibleComputers'));
      return;
    }

    let chosenId = eligible[0].id;
    if (eligible.length > 1) {
      const { promise, resolve } = Promise.withResolvers();
      const buttons = eligible.map((c) => ({
        action: c.id,
        label: `${c.name}${c.isCyberdeck ? ' ★' : ''} (${c.free} free)`,
        callback: () => resolve(c.id),
      }));
      buttons.push({ action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fas fa-times', callback: () => resolve(null) });
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize('CYBER_BLUE.Combat.ChooseComputer') },
        content: `<div class="cyberpunk-blue"><p>${game.i18n.localize('CYBER_BLUE.Combat.ChooseComputerHint')}</p></div>`,
        buttons,
        submit: (result) => resolve(result),
      });
      dialog.addEventListener('close', () => resolve(null), { once: true });
      dialog.render(true);
      const result = await promise;
      if (!result) return;
      chosenId = result;
    }

    const computer = eligible.find((c) => c.id === chosenId);
    await exeDoc.update({ 'system.installedOnId': chosenId });
    ui.notifications.info(game.i18n.format('CYBER_BLUE.Combat.ExecutableInstalled', {
      name: exeDoc.name, computer: computer?.name ?? chosenId,
    }));
  }

  async _onExecutableUninstall(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const exeDoc = itemId ? this.document.items.get(itemId) : null;
    if (!exeDoc || exeDoc.type !== 'programExecutable') return;

    await exeDoc.update({ 'system.installedOnId': null, 'system.running': false });
    ui.notifications.info(game.i18n.format('CYBER_BLUE.Combat.ExecutableUninstalled', { name: exeDoc.name }));
  }

  async _onExecutableRollAtk(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const exeDoc = itemId ? this.document.items.get(itemId) : null;
    if (!exeDoc || exeDoc.type !== 'programExecutable') return;

    const atk = Number(exeDoc.system.atk) || 0;
    const formula = atk >= 0 ? `1d10+${atk}` : `1d10${atk}`;
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${exeDoc.name}: ATK</h3></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  async _onExecutableRollPer(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const exeDoc = itemId ? this.document.items.get(itemId) : null;
    if (!exeDoc || exeDoc.type !== 'programExecutable') return;

    const per = Number(exeDoc.system.per) || 0;
    const formula = per >= 0 ? `1d10+${per}` : `1d10${per}`;
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${exeDoc.name}: PER</h3></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  async _onExecutableFieldUpdate(event) {
    event.stopPropagation();
    event.stopImmediatePropagation();
    const itemId = event.currentTarget.dataset.executableId;
    const field = event.currentTarget.dataset.field;
    if (!itemId || !field) return;
    const exeDoc = this.document.items.get(itemId);
    if (!exeDoc || exeDoc.type !== 'programExecutable') return;

    const rawValue = event.currentTarget.type === 'checkbox'
      ? event.currentTarget.checked
      : event.currentTarget.value;
    const value = event.currentTarget.dataset.dtype === 'Number'
      ? Number(rawValue) || 0
      : rawValue;

    await exeDoc.update({ [field]: value });
  }
}
