const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { Tabs } = foundry.applications.ux;
import { getBrandLogoPath } from '../helpers/branding.mjs';
import { getEligiblePlatforms, getPlatformUsage, isExtensionFullyConnected, promptForCyberwarePlatform, promptForCyberwarePlatformPair } from '../helpers/cyberware.mjs';
import { getActorCyberwareDisableState } from '../helpers/cyberware-disable.mjs';
import { normalizeGearState, getGearStateUpdateData } from '../helpers/gear.mjs';
import { getEffectiveItemWeapons } from '../helpers/mods.mjs';
import { buildWeaponUpdate, getWeaponTypeDefinition } from '../helpers/combat.mjs';
import { getTurnState, consumeNetAction, unlockNetActions } from '../helpers/combat-tracker.mjs';
import {
  getNetConnection, isNetConnected, getPrimaryCyberdeck,
  getAccessPointsInRange, getCyberdeckRam,
  checkQuickhackPrereqs,
  connectToArchitecture, disconnectFromArchitecture,
  defrag,
  spawnProgramActor, despawnProgramActor,
  performQuickhackBreach, performQuickhackUpload,
  resolveNetAttack,
  startEncryptDecryptTimer,
  getLinkedExecutable,
} from '../helpers/netrunning.mjs';
import { getNetCombat, isInert, getBoost } from '../helpers/net-program-combat.mjs';
import { resolveWeaponAttack, resolveAutofireAttack, resolveDoubleLockAttack } from '../helpers/combat-resolution.mjs';
import { refreshAllRicochetLines } from '../helpers/ricochet-canvas.mjs';
import { reloadWeapon, toggleWeaponCharge, toggleWeaponRicochet } from '../helpers/weapon-actions.mjs';
import { playUiSound } from '../helpers/audio.mjs';
import { buildActorEffectGroups } from '../helpers/effects.mjs';
import { getSkillCheckPreview, getWeaponAttackPreview, signedModifier } from '../helpers/roll-preview.mjs';
import { startInstructions, advanceInstructions, getInstructionContext } from '../helpers/instructions.mjs';
import { CharacterCreationWizard, CC_STEPS_LIST } from '../helpers/character-creation.mjs';
import {
  getRoleCategoryLabel,
  getRoleTeamMembers,
  getHighestUnlockedRoleAbilitySection,
  getUnlockedLeaderFeatures,
  getUnlockedProteanFoci,
  getUnlockedSpecialtyOptionGroups,
  getUnlockedSpecialtySections,
  getVisibleRoleAbilitySections,
  normalizeRoleSystemData,
} from '../helpers/roles.mjs';
import {
  buildMartialArtsContext,
  resolveMartialArtsAttack,
  resolveGrab,
  resolveChoke,
  resolveRecovery,
  resolveThrow,
  resolveIronGrip,
  resolveImprovisedWeapon,
  resolveStrongAttack,
  resolveBoneBreakingCombination,
  resolveArmorBreakingCombination,
  resolveCounterThrow,
  resolveGrabEscape,
  resolvePressurePointStrike,
  resolveFlyingKick,
} from '../helpers/martial-arts.mjs';

/** Major arcana cards available to Guide (indices 0–21). */
const GUIDE_CARDS = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
  'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
  'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
  'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World',
];

/** Fisher-Yates shuffle; returns a new array. */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
        description: data.description ?? '',
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
    context.showDescriptionTooltips = game.settings.get('cyberpunk-blue', 'descriptionTooltips');
    // MOVE is shown in the quick-stats move-card (for both characters and NPCs),
    // never in the header six-stat block — a second system.stats.move.value input
    // would submit as an array and break NumberField validation.
    context.stats = Object.entries(CONFIG.CYBER_BLUE.stats)
      .filter(([slug]) => slug !== 'move')
      .map(([slug, data]) => ({
        slug,
        ...data,
        value: system.stats[slug].value,
        iconPath: `systems/cyberpunk-blue/assets/icons/bk_${slug.toUpperCase()}.svg`,
      }));
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
      description: data.description ?? '',
      statSlug: data.stat,
      statLabel: CONFIG.CYBER_BLUE.stats[data.stat]?.shortLabel ?? data.stat.toUpperCase(),
      rank: system.skills[slug].rank,
      roll: getSkillCheckPreview(this.document, slug),
      components: data.components
        .filter((componentSlug) => system.components[componentSlug].active)
        .map((componentSlug) => ({
          slug: componentSlug,
          label: CONFIG.CYBER_BLUE.components[componentSlug].label,
          rank: system.components[componentSlug].rank,
          roll: getSkillCheckPreview(this.document, slug, componentSlug),
        })),
    }));
    context.skills = skillEntries;
    const skillsBySlug = Object.fromEntries(skillEntries.map((entry) => [entry.slug, entry]));
    const categorizedSlugs = new Set();
    context.skillGroups = Object.entries(CONFIG.CYBER_BLUE.skillCategories)
      .map(([slug, data]) => {
        const groupSkills = data.skills
          .map((skillSlug) => skillsBySlug[skillSlug])
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));
        groupSkills.forEach((entry) => categorizedSlugs.add(entry.slug));
        return { slug, label: data.label, skills: groupSkills };
      })
      .filter((group) => group.skills.length);
    const uncategorizedSkills = skillEntries
      .filter((entry) => !categorizedSlugs.has(entry.slug))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (uncategorizedSkills.length) {
      context.skillGroups.push({ slug: 'uncategorized', label: 'Other', skills: uncategorizedSkills });
    }
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
        ...getInstructionContext(item),
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
          .filter((item) => isExtensionFullyConnected(item.system))
          .map((item) => {
            const parent = cyberwareItems.find((candidate) => candidate.id === item.system.parentCyberwareId);
            const parent2 = item.system.paired
              ? cyberwareItems.find((candidate) => candidate.id === item.system.parentCyberwareId2)
              : null;
            const usedSlots = cyberwareUsage.get(item.id) ?? 0;
            const itemDoc = this.document.items.get(item.id);
            return {
              ...item,
              ...getInstructionContext(item),
              isDisabled: cyberwareDisableState.byItemId.has(item.id),
              disabledBy: cyberwareDisableState.byItemId.get(item.id)?.effectNames ?? [],
              disabledTooltip: cyberwareDisableState.byItemId.get(item.id)?.tooltip ?? '',
              manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
              integrationLabel: game.i18n.localize(
                CONFIG.CYBER_BLUE.cyberware.integrations
                  ?.find((entry) => entry.value === item.system.integration)?.label
                ?? item.system.integration,
              ),
              paired: Boolean(item.system.paired),
              slotText: item.system.integration === 'platform'
                ? `${Math.max((item.system.slotsProvided ?? 0) - usedSlots, 0)}/${item.system.slotsProvided ?? 0}`
                : `${item.system.slotsUsed ?? 0}`,
              platformName: [parent?.name, parent2?.name].filter(Boolean).join(' + ') || null,
              canDetachPlatform: item.system.integration === 'extension'
                && (Boolean(item.system.parentCyberwareId) || Boolean(item.system.parentCyberwareId2)),
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
          label: game.i18n.localize(typeConfig.label),
          items,
        };
      })
      .filter((group) => group.items.length > 0);
    {
      const unconnected = cyberwareItems
        .filter((item) => item.system.installed && item.system.integration === 'extension' && !isExtensionFullyConnected(item.system))
        .map((item) => {
          const eligiblePlatforms = getEligiblePlatforms(this.document, item.id, item.system);
          return {
            ...item,
            ...getInstructionContext(item),
            isDisabled: cyberwareDisableState.byItemId.has(item.id),
            disabledTooltip: cyberwareDisableState.byItemId.get(item.id)?.tooltip ?? '',
            manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
            integrationLabel: CONFIG.CYBER_BLUE.cyberware.integrations
              ?.find((entry) => entry.value === item.system.integration)?.label ?? item.system.integration,
            slotText: `${item.system.slotsUsed ?? 0}`,
            paired: Boolean(item.system.paired),
            eligiblePlatforms,
            hasEligiblePlatforms: item.system.paired
              ? eligiblePlatforms.length >= 2
              : eligiblePlatforms.length > 0,
            description: cyberwareDescriptionMap.get(item.id) ?? '',
          };
        });
      unconnected.forEach((item, i, arr) => {
        item.canMoveUp = i > 0;
        item.canMoveDown = i < arr.length - 1;
      });
      context.unconnectedCyberware = unconnected;
    }
    // Owned-but-uninstalled cyberware. Catalogue cyberware is created with
    // installed:false ("owned, not yet surgically fitted"); the installed
    // sections above filter those out, so without this list a freshly-dropped
    // item would exist but render nowhere. Surface them with an Install action.
    context.uninstalledCyberware = cyberwareItems
      .filter((item) => !item.system.installed)
      .map((item) => ({
        ...item,
        ...getInstructionContext(item),
        manufacturerLogo: manufacturerLogoMap.get(item.system.manufacturer) ?? null,
        integrationLabel: game.i18n.localize(
          CONFIG.CYBER_BLUE.cyberware.integrations
            ?.find((entry) => entry.value === item.system.integration)?.label
          ?? item.system.integration,
        ),
        paired: Boolean(item.system.paired),
        description: cyberwareDescriptionMap.get(item.id) ?? '',
      }));
    const gearDocs = embeddedItemDocuments.filter((item) => item.type === 'gear');
    const inventoryItems = gearDocs.map((itemDoc) => {
      const item = embeddedItems.find((entry) => entry.id === itemDoc.id);
      const state = itemDoc.getGearState?.() ?? normalizeGearState(item.system);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);
      return {
        ...item,
        ...getInstructionContext(item),
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
    const drugDocs = embeddedItemDocuments.filter((item) => item.type === 'drug');
    context.drugItems = drugDocs.map((itemDoc) => {
      const item = embeddedItems.find((entry) => entry.id === itemDoc.id) ?? itemDoc.toPlainObject();
      return { ...item, ...getInstructionContext(item) };
    });
    const combatWeaponEntries = [];
    // RoF tracking: look up this actor's turn state from the combatant flag
    const actorToken = this.document.getActiveTokens()[0];
    const combatant = game.combat?.started
      ? game.combat.combatants.find((c) => c.actorId === this.document.id)
      : null;
    const turnState = combatant ? getTurnState(combatant) : null;

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
      // Unified roll-button preview: stat + weapon-skill rank + AEs + always-on
      // weapon bonuses (quality, recoil mods, calibration, charge, …). Situational
      // modifiers (range, visibility, target vitals, autofire recoil) are added at
      // roll time and intentionally excluded here.
      const attackRoll = getWeaponAttackPreview(this.document, itemDoc, weapon, weaponIndex);
      const autofireRoll = getWeaponAttackPreview(this.document, itemDoc, weapon, weaponIndex, { rankCap: autofireRank });
      const rateOfFire = Math.max(Number(weapon.rateOfFire) || 1, 1);
      const effectiveWeapons = itemDoc.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(itemDoc);

      // RoF locking: in combat, can only attack with ONE weapon type per turn,
      // and only up to rateOfFire times with that weapon.
      const key = `${itemDoc.id}::${weaponIndex}`;
      const rofEntry = turnState?.rofAttacks?.[key] ?? null;
      const sameWeapon = rofEntry !== null;
      const rofExhausted = sameWeapon && rofEntry.used >= rateOfFire;
      const rofLocked = !!(turnState?.actionUsed) && !sameWeapon; // action used by different weapon/action

      // BODY enforcement: disable buttons for hard-body weapons when BODY < requirement.
      // Soft-body weapons (critOnBodyReq > 0, e.g. Carnage) are still allowed to fire.
      const actorBodyVal = Number(this.document.system?.stats?.body?.value) || 0;
      const minBodyVal = Number(itemDoc.system?.minBodyReq) || 0;
      const bodyBlocked = minBodyVal > 0 && actorBodyVal < minBodyVal && (weapon.critOnBodyReq ?? 0) === 0;

      return {
        itemId: itemDoc.id,
        weaponIndex,
        itemName: itemDoc.name,
        name: effectiveWeapons.length > 1 ? `${itemDoc.name} - ${definition.label}` : itemDoc.name,
        attackLabel: attackRoll.mod,
        attackTooltip: attackRoll.tooltip,
        attackRoll,
        autofireRoll,
        damage: weapon.damage ?? definition.damage,
        concealable: weapon.concealable ?? definition.concealable,
        modDots,
        rateOfFire,
        attacksUsed: rofEntry?.used ?? 0,
        rofExhausted,
        rofLocked,
        attackDisabled: rofExhausted || rofLocked || bodyBlocked,
        showsAmmo: definition.usesMagazine,
        ammoCurrent: ammo.current,
        magazine: ammo.magazine,
        // Consumable-thrown grenades: the owning Item's quantity is the magazine,
        // shown read-only (no editable ammo field, no reload button).
        isConsumableThrown: !!weapon.consumableThrown,
        grenadeQty: Number(itemDoc.system?.quantity) || 0,
        shots: weapon.shots ?? 0,
        damageType,
        hasAutofire: damageType === 'autofire',
        autofireAmmoOk: damageType === 'autofire' && ammo.current >= 10,
        isAffliction: ['affliction', 'affliction-cone', 'affliction-explosion'].includes(damageType),
        // Target vitals is available on standard and autofire weapons (standard attack only), but not on area-effect types.
        isStandardDamage: !['cone', 'explosion', 'affliction', 'affliction-cone', 'affliction-explosion'].includes(damageType),
        targetVitals: itemDoc.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false,
        targetVehicleVitalRegionId: itemDoc.getFlag('cyberpunk-blue', `targetVehicleVitalRegionId-${weaponIndex}`) ?? null,
        jammed: !!itemDoc.getFlag('cyberpunk-blue', `jammed-${weaponIndex}`),
        canJam: (weapon.jamOnRoll ?? 0) > 0,
        // Calibration: Hawk Eye scope installed → show calibrate button
        hasCalibration: this.document.items.some(
          (i) => i.type === 'mod' && i.system.modType === 'weaponMod' &&
                 i.system.installedOnId === itemDoc.id &&
                 Number(i.system.targetWeaponIndex) === weaponIndex &&
                 i.system.calibration,
        ),
        calibrationActive: (itemDoc.getFlag('cyberpunk-blue', `calibration-${weaponIndex}`) ?? 0) > 0,
        // Ricochet point: Power Weapons only
        isPowerWeapon: weapon.isPowerWeapon ?? false,
        ricochetActive: !!(this.document.getFlag?.('cyberpunk-blue', 'ricochetPoint')),
        bodyBlocked,
        // Tech Weapon charge state
        isTechWeapon: weapon.isTechWeapon ?? false,
        chargeType: weapon.chargeType ?? '',
        isCharged: !!(itemDoc.getFlag('cyberpunk-blue', `charged-${weaponIndex}`)),
        isChargeCooldown: !!(itemDoc.getFlag('cyberpunk-blue', `chargeCooldown-${weaponIndex}`)),
        chargeDisabled: (() => {
          if (!(weapon.isTechWeapon)) return false;
          const isCharged    = !!(itemDoc.getFlag('cyberpunk-blue', `charged-${weaponIndex}`));
          const isCooldown   = !!(itemDoc.getFlag('cyberpunk-blue', `chargeCooldown-${weaponIndex}`));
          if (isCharged) return false; // charged → button cancels (always clickable)
          if (isCooldown) return true; // cooldown → can't re-charge
          // Block if the actor has already moved this turn.
          const moved = (turnState?.movementUsed ?? 0) > 0;
          return moved;
        })(),
        autofireLabel: autofireRoll.mod,
        autofireTooltip: autofireRoll.tooltip,
        skillSlug,
        skillOptions: definition.skillOptions.map((slug) => ({
          value: slug,
          label: CONFIG.CYBER_BLUE.skills[slug]?.label ?? slug,
        })),
        // ── Batch 8 weapon abilities ───────────────────────────────────────
        hasDoubleLock: !!(weapon.doubleLock ?? false),
        doubleLockAmmoOk: (weapon.doubleLock ?? false) && ammo.current >= 4,
        hasElectricCharge: !!(weapon.electricCharge ?? false),
        electricChargeUses: (weapon.electricCharge ?? false)
          ? (itemDoc.getFlag('cyberpunk-blue', `electricCharge-${weaponIndex}`) ?? (weapon.electricChargeMax ?? 0))
          : 0,
        electricChargeMax: weapon.electricChargeMax ?? 0,
        isBayonet: !!(weapon._isBayonet ?? false),
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

    // Martial Arts context (attacks + special moves for Overview tab)
    const maContext = buildMartialArtsContext(this.document, turnState);
    context.martialArtsAttacks = maContext.martialArtsAttacks;
    context.martialArtsSpecialMoves = maContext.martialArtsSpecialMoves;

    context.roleOverviewFeatures = context.roles.map((role) => {
      const roleSystem = normalizeRoleSystemData(role.system);
      const roleRank = Number(roleSystem.rank) || 0;
      // Networkers show only their latest unlocked tier in the overview.
      // All other categories keep their full detail on the Role item sheet.
      const sections = roleSystem.category === 'networker'
        ? [getHighestUnlockedRoleAbilitySection(roleSystem, roleRank)].filter(Boolean).filter((s) => s.content)
        : [];

      // ── Role-specific mechanics context ────────────────────────────────
      const roleMechanics = {};
      if (role.name === 'Netrunner' && roleRank >= 1) {
        // Read from the data model so AE bonuses (Runner-speed +1) are included.
        roleMechanics.netActionsTotal = this.document.system.netActionsTotal ?? 0;
      }
      if (role.name === 'Bandit' && roleRank >= 1) {
        const maxUses = 1 + Math.floor(roleRank / 3);
        const usesRemaining = this.document.getFlag('cyberpunk-blue', 'toughUsesRemaining') ?? maxUses;
        roleMechanics.toughMaxUses = maxUses;
        roleMechanics.toughUsesRemaining = Math.min(usesRemaining, maxUses);
        roleMechanics.toughDepleted = roleMechanics.toughUsesRemaining <= 0;
      }
      if (role.name === 'Media' && roleRank >= 1) {
        roleMechanics.canPickUpRumours = true;
        // DV tiers: vague/typical/substantial/detailed
        roleMechanics.rumourDvs = [
          { label: 'CYBER_BLUE.Role.Media.RumourVague',       passiveDv: 15, activeDv: 12 },
          { label: 'CYBER_BLUE.Role.Media.RumourTypical',     passiveDv: 18, activeDv: 15 },
          { label: 'CYBER_BLUE.Role.Media.RumourSubstantial', passiveDv: 21, activeDv: 18 },
          { label: 'CYBER_BLUE.Role.Media.RumourDetailed',    passiveDv: 25, activeDv: 22 },
        ];
      }
      if (role.name === 'Rocker' && roleRank >= 1) {
        roleMechanics.canRock = true;
      }
      if (role.name === 'Law' && roleRank >= 1) {
        const backupTypes = (roleSystem.leaderFeatures ?? [])
          .filter((f) => roleRank >= (Number(f.unlockRank) || 1))
          .map((f) => {
            const dvMatch = (f.description ?? '').match(/DV (\d+)/);
            return {
              id: f.id,
              name: f.name,
              dv: dvMatch ? parseInt(dvMatch[1], 10) : 10,
            };
          });
        if (backupTypes.length > 0) {
          roleMechanics.backupTypes = backupTypes;
          roleMechanics.lawRank = roleRank;
        }
      }
      if (role.name === 'Medtech' && roleRank >= 1) {
        const battleSpec = (roleSystem.specialties ?? []).find((s) => s.name === 'Battle Medic' && s.rank >= 1);
        const surgSpec   = (roleSystem.specialties ?? []).find((s) => s.name === 'Surgery' && s.rank >= 1);
        const cryoSpec   = (roleSystem.specialties ?? []).find((s) => s.name === 'Cryosystem Operation' && s.rank >= 1);
        if (battleSpec) {
          roleMechanics.canPatchUp = true;
          roleMechanics.patchUpMaxHp = (Number(battleSpec.rank) || 1) * 2;
        }
        if (surgSpec) {
          roleMechanics.canSurgery = true;
          roleMechanics.surgeryRank = Number(surgSpec.rank) || 1;
        }
        if (cryoSpec) {
          roleMechanics.canCryo = true;
        }
      }
      if (role.name === 'Techie' && roleRank >= 1) {
        const techieRolls = [];
        const fieldSpec   = (roleSystem.specialties ?? []).find((s) => s.name === 'Field Expertise' && s.rank >= 1);
        const fabSpec     = (roleSystem.specialties ?? []).find((s) => s.name === 'Fabrication Expertise' && s.rank >= 1);
        const upgSpec     = (roleSystem.specialties ?? []).find((s) => s.name === 'Upgrade Expertise' && s.rank >= 1);
        const invSpec     = (roleSystem.specialties ?? []).find((s) => s.name === 'Invention Expertise' && s.rank >= 1);
        if (fieldSpec) techieRolls.push({ type: 'field',       name: 'CYBER_BLUE.Role.Techie.Field',       rank: Number(fieldSpec.rank) || 1 });
        if (fabSpec)   techieRolls.push({ type: 'fabrication', name: 'CYBER_BLUE.Role.Techie.Fabrication', rank: Number(fabSpec.rank)   || 1 });
        if (upgSpec)   techieRolls.push({ type: 'upgrade',     name: 'CYBER_BLUE.Role.Techie.Upgrade',     rank: Number(upgSpec.rank)   || 1 });
        if (invSpec)   techieRolls.push({ type: 'invention',   name: 'CYBER_BLUE.Role.Techie.Invention',   rank: Number(invSpec.rank)   || 1 });
        if (techieRolls.length > 0) {
          roleMechanics.techieRolls = techieRolls;
        }
      }
      if (role.name === 'Fixer' && roleRank >= 1) {
        roleMechanics.canHaggle = true;
        roleMechanics.fixerRank = roleRank;
      }
      if (role.name === 'Guide' && roleRank >= 1) {
        const psycheMax = this.document.system.resources?.psyche?.max ?? 60;
        const lockedCount = Math.max(0, Math.floor((60 - psycheMax) / 10));
        const meditationsMax = 1 + (roleRank >= 5 ? 1 : 0) + (roleRank >= 10 ? 1 : 0);
        const meditationsUsed = this.document.getFlag('cyberpunk-blue', 'guide.meditationsUsed') ?? 0;
        const readingRaw = this.document.getFlag('cyberpunk-blue', 'guide.reading') ?? [];
        const deckRaw = this.document.getFlag('cyberpunk-blue', 'guide.deck') ?? [];
        roleMechanics.canGuide = true;
        roleMechanics.guide = {
          guideRank:       roleRank,
          lockedCount,
          meditationsMax,
          meditationsUsed,
          meditationsLeft: Math.max(0, meditationsMax - meditationsUsed),
          canMeditate:     meditationsUsed < meditationsMax && readingRaw.length > 0,
          hasReading:      readingRaw.length > 0,
          deckSize:        deckRaw.length,
          reading:         readingRaw.map((idx) => ({ index: idx, name: GUIDE_CARDS[idx] ?? `Card ${idx}` })),
        };
      }

      const base = {
        roleId: role.id,
        roleName: role.name,
        kind: roleSystem.category,
        roleRank,
        abilityOverview: roleSystem.abilityOverview ?? '',
        categoryLabel: getRoleCategoryLabel(roleSystem.category),
        sections,
        roleMechanics,
        hasMechanics: Object.keys(roleMechanics).length > 0,
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
        })).filter((feature) => feature.members.length || feature.selectedUuids?.length || feature.description);
        return { ...base, leaderFeatures };
      }

      if (roleSystem.category === 'specialist') {
        const totalBudget = roleRank * 2;
        const allSpecialties = (roleSystem.specialties ?? []).map((specialty, specialtyIndex) => {
          const rank = Number(specialty.rank) || 0;
          const unlockedGroups = rank > 0 ? getUnlockedSpecialtyOptionGroups(specialty) : [];
          const allSelectedIds = new Set(unlockedGroups.flatMap((g) => g.selectedOptionIds ?? []));
          const totalSelected = allSelectedIds.size;
          const atCap = totalSelected >= rank;
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
            rank,
            specialtyIndex,
            unlockedSections: rank > 0 ? getUnlockedSpecialtySections(specialty) : [],
            unlockedOptionGroups: unlockedGroups,
            allOptions,
            selectedOptions: allOptions.filter((opt) => opt.selected),
          };
        });
        const totalUsed = allSpecialties.reduce((sum, s) => sum + s.rank, 0);
        const remainingBudget = totalBudget - totalUsed;
        const specialties = allSpecialties.map((s) => ({
          ...s,
          canIncrement: remainingBudget > 0 && s.rank < roleRank,
          canDecrement: s.rank > 0,
        }));
        return { ...base, specialties, totalBudget, remainingBudget };
      }

      return base;
    }).filter((feature) => {
      if (feature.sections?.length) return true;
      if (feature.kind === 'protean' && feature.foci?.length) return true;
      if (feature.kind === 'leader' && feature.leaderFeatures?.length) return true;
      if (feature.kind === 'specialist' && (feature.roleRank ?? 0) >= 1) return true;
      if (feature.hasMechanics) return true;
      return false;
    });
    const _enrichHTML = (html) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html ?? '', {
      secrets: this.document.isOwner,
      async: true,
      rollData: this.document.getRollData(),
      relativeTo: this.document,
    });
    context.enrichedRoleOverviewFeatures = await Promise.all(context.roleOverviewFeatures.map(async (feature) => ({
      ...feature,
      enrichedAbilityOverview: feature.abilityOverview ? await _enrichHTML(feature.abilityOverview) : '',
      sections: await Promise.all((feature.sections ?? []).map(async (section) => ({
        ...section,
        enrichedContent: await _enrichHTML(section.content),
      }))),
      specialties: feature.specialties
        ? await Promise.all(feature.specialties.map(async (specialty) => ({
          ...specialty,
          unlockedSections: await Promise.all((specialty.unlockedSections ?? []).map(async (section) => ({
            ...section,
            enrichedContent: await _enrichHTML(section.content),
          }))),
        })))
        : null,
    })));
    const _hid = CONFIG.CYBER_BLUE.healthItemDescriptions ?? {};
    context.health = {
      hp: {
        value: system.resources.hp.value,
        max: system.resources.hp.max,
        description: CONFIG.CYBER_BLUE.resources.hp?.description ?? '',
      },
      seriousWoundThreshold: system.resources.seriousWoundThreshold.value,
      seriousWoundDescription: _hid.seriousWound ?? '',
      deathSave: system.resources.deathSave.value,
      deathSaveDescription: _hid.deathSave ?? '',
      stoppingPowerDescription: _hid.stoppingPower ?? '',
    };
    context.effects = buildActorEffectGroups(this.document);
    context.enrichedDetails = {};
    for (const field of ['background', 'appearance', 'personality', 'style']) {
      context.enrichedDetails[field] = await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.details[field], {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.document.getRollData(),
        relativeTo: this.document,
      });
    }

    // The Netrunner role (category: sundry, name: 'Netrunner') unlocks the NET tab.
    const networkerRole = context.roles.find((role) => {
      const rs = normalizeRoleSystemData(role.system);
      return role.name === 'Netrunner' && (Number(rs.rank) || 0) >= 1;
    });
    const networkerRoleSystem = networkerRole ? normalizeRoleSystemData(networkerRole.system) : null;
    const networkerRank = Number(networkerRoleSystem?.rank) || 0;
    // Operatives who've unlocked the "Infiltrate Network" specialty (rank ≥ 5)
    // also get net actions and should see the Netrunning tab even without the
    // Netrunner role. We detect this via a nonzero netActionsTotal.
    context.showNetrunningTab = Boolean(networkerRole)
      || (this.document.system.netActionsTotal ?? 0) > 0;

    // ── Netrunner tab context ──────────────────────────────────────────────
    if (context.showNetrunningTab) {
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
        const usedRank = Math.min(netrunningSkillRank, componentRank);
        const modifier = intVal + networkerRank + usedRank;
        const modLabel = (modifier >= 0 ? '+' : '') + modifier;
        // Breakdown tooltip mirroring the unified roll buttons.
        const tooltip = [
          `INT +${intVal}`,
          `Netrunner +${networkerRank}`,
          `${CONFIG.CYBER_BLUE.components[slug]?.label ?? slug} +${usedRank}`,
        ].join('<br>');
        // Embed componentSlug + modifier into each use so the template doesn't need ../
        const uses = (NETRUNNER_COMPONENT_USES[slug] ?? []).map((u) => ({
          ...u,
          componentSlug: slug,
          modifier,
          modLabel,
          tooltip,
        }));
        return {
          slug,
          label: CONFIG.CYBER_BLUE.components[slug]?.label ?? slug,
          rank: componentRank,
          modifier,
          modLabel,
          tooltip,
          uses,
        };
      });

      // Computer items from actor inventory (gear + cyberware where isComputer)
      const computerItems = embeddedItems.filter((item) =>
        (item.type === 'gear' || item.type === 'cyberware') && item.system.isComputer
      );

      // Count executables installed on each computer and track their names
      const allExecutables = embeddedItems.filter((item) => item.type === 'programExecutable');
      const execsPerComputer = new Map();
      const execNamesPerComputer = new Map();
      for (const exe of allExecutables) {
        const cid = exe.system.installedOnId;
        if (cid) {
          execsPerComputer.set(cid, (execsPerComputer.get(cid) ?? 0) + 1);
          if (!execNamesPerComputer.has(cid)) execNamesPerComputer.set(cid, []);
          execNamesPerComputer.get(cid).push(exe.name);
        }
      }

      context.netrunnerComputers = computerItems
        .map((c) => {
          const comp = c.system.computer ?? {};
          const usedSlots = execsPerComputer.get(c.id) ?? 0;
          const totalSlots = (comp.softwareSlots ?? 0) + (comp.generalSlots ?? 0);
          const isCyberdeck = comp.isCyberdeck ?? false;
          return {
            id: c.id,
            name: c.name,
            img: c.img,
            hardwareSlots: comp.hardwareSlots ?? 0,
            softwareSlots: comp.softwareSlots ?? 0,
            generalSlots: comp.generalSlots ?? 0,
            ram: comp.ram ?? 0,
            currentRam: isCyberdeck ? getCyberdeckRam(this.document, c.id) : 0,
            range: comp.range ?? 0,
            isCyberdeck,
            canQuickhack: comp.canQuickhack ?? false,
            running: comp.running ?? false,
            usedSlots,
            freeSlots: Math.max(totalSlots - usedSlots, 0),
            installedPrograms: execNamesPerComputer.get(c.id) ?? [],
          };
        })
        .sort((a, b) => {
          if (a.isCyberdeck !== b.isCyberdeck) return a.isCyberdeck ? -1 : 1;
          if (a.canQuickhack !== b.canQuickhack) return a.canQuickhack ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      // ── Support programs (NET Combat "Support attack" executables) ─────────
      // Running, non-inert executables on the active cyberdeck whose NET Combat
      // attack mode is "support" get an ATK button on this tab; the runner
      // spends a NET action and attacks via the Cracker component.
      const activeDeckId = getNetConnection(this.document)?.cyberdeckId
        || getPrimaryCyberdeck(this.document)?.id || null;
      context.supportPrograms = activeDeckId
        ? allExecutables
          .filter((exe) => exe.system.installedOnId === activeDeckId
            && getNetCombat(exe)?.attack?.mode === 'support'
            && !isInert(exe))
          .map((exe) => ({
            id: exe.id,
            name: exe.name,
            img: exe.img,
            supportModifier: getNetCombat(exe)?.attack?.supportModifier ?? 0,
          }))
        : [];

      // ── Net connection context ────────────────────────────────────────────
      context.netConnected = isNetConnected(this.document);
      context.canConnect   = false;
      context.nearbyAccessPoints = [];

      if (!context.netConnected && canvas?.ready && canvas.scene) {
        const actorTok = canvas.tokens.placeables.find((t) => t.actor?.id === this.document.id);
        if (actorTok) {
          const gridSize  = canvas.grid.size;
          const tokenPos  = {
            x: actorTok.document.x + actorTok.document.width  * gridSize / 2,
            y: actorTok.document.y + actorTok.document.height * gridSize / 2,
          };
          const primaryDeck = getPrimaryCyberdeck(this.document);
          const range       = Number(primaryDeck?.system.computer?.range) || 10;
          const aps         = getAccessPointsInRange(canvas.scene, tokenPos, range);
          context.nearbyAccessPoints = aps.map((r) => ({ id: r.id, name: r.name || 'Access Point' }));
          context.canConnect = aps.length > 0 && Boolean(primaryDeck);
        }
      }

      // ── Quickhacking context ──────────────────────────────────────────────
      context.canQuickhack       = false;
      context.quickhackTarget    = '';
      context.quickhackTargetBreached = false;

      if (canvas?.ready) {
        const qhCheck = checkQuickhackPrereqs(this.document);
        context.canQuickhack = qhCheck.ok;
        if (qhCheck.targetActor) {
          context.quickhackTarget = qhCheck.targetActor.name;
          // Check if target already breached by this actor
          context.quickhackTargetBreached = qhCheck.targetActor.effects.some(
            (e) => e.getFlag('cyberpunk-blue', 'breachedBy') === this.document.id
          );
        }
      }

      // Split executables into On Disk vs On Shards
      const computerIdSet = new Set(computerItems.map((c) => c.id));
      const computerById = new Map(context.netrunnerComputers.map((c) => [c.id, c]));
      const executablesOnDisk = [];
      const executablesOnShards = [];
      for (const exe of allExecutables) {
        const cid = exe.system.installedOnId;
        const valid = cid && computerIdSet.has(cid);
        const entry = { ...exe };
        entry.atkRoll = { mod: signedModifier(exe.system.atk ?? 0), tooltip: `ATK ${signedModifier(exe.system.atk ?? 0)}` };
        entry.perRoll = { mod: signedModifier(exe.system.per ?? 0), tooltip: `PER ${signedModifier(exe.system.per ?? 0)}` };
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

      // ── Self-ICE Passwall DV ──────────────────────────────────────────────
      // Self-ICE cyberware (neuralware) provides a single Passwall against
      // Quickhacking: DV = 15 + (2 × number of Self-ICE installs).
      // Shown as a note on the cyberware tab and used by the Quickhacking panel.
      {
        const selfIceCount = embeddedItems.filter((i) =>
          i.type === 'cyberware'
          && i.system.installed !== false
          && i.name.toLowerCase().includes('self-ice'),
        ).length;
        context.selfIceCount = selfIceCount;
        context.selfIceDv    = selfIceCount > 0 ? 15 + (2 * selfIceCount) : null;
      }

      // ── NET actions combat counter ─────────────────────────────────────────
      const netCombatant = game.combat?.combatants.find(
        (c) => c.actor?.id === this.document.id,
      );
      if (netCombatant) {
        const ts = getTurnState(netCombatant);
        context.netActionsUsed       = ts.netActionsUsed  ?? 0;
        context.netActionsTurnTotal  = ts.netActionsTotal ?? 0;
        context.netActionsRemaining  = Math.max((ts.netActionsTotal ?? 0) - (ts.netActionsUsed ?? 0), 0);
      } else {
        context.netActionsUsed      = 0;
        context.netActionsTurnTotal = 0;
        context.netActionsRemaining = 0;
      }
    } else {
      context.netrunnerComponents  = [];
      context.netrunnerComputers   = [];
      context.executablesOnDisk    = [];
      context.executablesOnShards  = [];
      context.diskColVis   = {};
      context.shardsColVis = {};
      context.netConnected = false;
      context.canConnect   = false;
      context.nearbyAccessPoints        = [];
      context.canQuickhack              = false;
      context.quickhackTarget           = '';
      context.quickhackTargetBreached   = false;
      context.netActionsUsed      = 0;
      context.netActionsTurnTotal = 0;
      context.netActionsRemaining = 0;
      context.selfIcePasswalls    = [];
    }

    // Character creation state
    const isCC = actorData.type === 'character' && (system.characterCreation?.active ?? false);
    const stepIdx = isCC ? CC_STEPS_LIST.indexOf(system.characterCreation?.step ?? 'welcome') : -1;
    const canEdit = context.editable ?? false;
    context.charCreation = {
      active: isCC,
      canBegin: actorData.type === 'character' && !isCC && (canManageRestricted || this.document.isOwner),
      step: isCC ? (system.characterCreation?.step ?? null) : null,
      notesWritable: !isCC || (stepIdx > 0 && canEdit),
      statsWritable: !isCC || (stepIdx > 2 && canEdit),
      skillsWritable: !isCC || (stepIdx >= 6 && canEdit),
      highlightStats: isCC && stepIdx === 2,
      highlightSecondary: isCC && stepIdx === 3,
      highlightAbilities: isCC && stepIdx === 5,
      highlightSkills: isCC && stepIdx === 6,
    };

    // Post-CC read-only lock: players can't manually edit progression fields once CC is done.
    // The IP spending window is the sanctioned route for advancement after CC.
    const ccDone = actorData.type === 'character' && !isCC;
    context.lockProgression = ccDone && !canManageRestricted;
    if (context.lockProgression) {
      context.charCreation.statsWritable = false;
      context.charCreation.skillsWritable = false;
    }

    // IP (characters only)
    if (actorData.type === 'character') {
      context.ip = {
        value: system.ip ?? 0,
        total: system.totIP ?? 0,
        canSpend: (system.ip ?? 0) > 0,
      };
    } else {
      context.ip = null;
    }

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
    this.element.querySelectorAll('[data-action="create-skill-macro"]').forEach((button) => {
      button.addEventListener('click', this._onCreateSkillMacro.bind(this));
    });
    this.element.querySelectorAll('[data-action="create-weapon-macro"]').forEach((button) => {
      button.addEventListener('click', this._onCreateWeaponMacro.bind(this));
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
    this.element.querySelectorAll('[data-action="install-cyberware"]').forEach((button) => {
      button.addEventListener('click', this._onInstallCyberware.bind(this));
    });
    this.element.querySelectorAll('[data-action="uninstall-cyberware"]').forEach((button) => {
      button.addEventListener('click', this._onUninstallCyberware.bind(this));
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
    this.element.querySelector('[data-action="open-ip-spender"]')?.addEventListener('click', this._onOpenIpSpender.bind(this));

    this.element.querySelectorAll('[data-action="remove-critical-injury"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveCriticalInjury.bind(this));
    });
    this.element.querySelectorAll('[data-action="remove-affliction"]').forEach((button) => {
      button.addEventListener('click', this._onRemoveAffliction.bind(this));
    });
    this.element.querySelectorAll('[data-action="start-instructions"]').forEach((button) => {
      button.addEventListener('click', this._onStartInstructions.bind(this));
    });
    this.element.querySelectorAll('[data-action="advance-instructions"]').forEach((button) => {
      button.addEventListener('click', this._onAdvanceInstructions.bind(this));
    });
    this.element.querySelectorAll('[data-action="toggle-target-vitals"]').forEach((checkbox) => {
      checkbox.addEventListener('change', this._onToggleTargetVitals.bind(this));
    });
    this.element.querySelectorAll('[data-action="pick-vehicle-vital"]').forEach((button) => {
      button.addEventListener('click', this._onPickVehicleVital.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-unjam"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponUnjam.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-calibrate"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponCalibrate.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-ricochet"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponRicochet.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-charge"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponCharge.bind(this));
    });
    this.element.querySelectorAll('[data-action="weapon-double-lock"]').forEach((button) => {
      button.addEventListener('click', this._onWeaponDoubleLock.bind(this));
    });

    // Martial Arts
    this.element.querySelectorAll('[data-action="ma-attack"]').forEach((button) => {
      button.addEventListener('click', this._onMartialArtsAttack.bind(this));
    });
    this.element.querySelectorAll('[data-action="ma-special"]').forEach((button) => {
      button.addEventListener('click', this._onMartialArtsSpecialMove.bind(this));
    });
    this.element.querySelectorAll('[data-action="ma-toggle-vitals"]').forEach((checkbox) => {
      checkbox.addEventListener('change', this._onMaToggleTargetVitals.bind(this));
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
    this.element.querySelectorAll('[data-action="net-connect"]').forEach((button) => {
      button.addEventListener('click', this._onNetConnect.bind(this));
    });
    this.element.querySelectorAll('[data-action="net-disconnect"]').forEach((button) => {
      button.addEventListener('click', this._onNetDisconnect.bind(this));
    });
    this.element.querySelectorAll('[data-action="net-defrag"]').forEach((button) => {
      button.addEventListener('click', this._onNetDefrag.bind(this));
    });
    this.element.querySelectorAll('[data-action="net-quickhack-breach"]').forEach((button) => {
      button.addEventListener('click', this._onQuickhackBreach.bind(this));
    });
    this.element.querySelectorAll('[data-action="net-quickhack-upload"]').forEach((button) => {
      button.addEventListener('click', this._onQuickhackUpload.bind(this));
    });
    this.element.querySelectorAll('[data-action="support-program-attack"]').forEach((button) => {
      button.addEventListener('click', this._onSupportProgramAttack.bind(this));
    });

    // ── Role-specific mechanics ────────────────────────────────────────────
    this.element.querySelectorAll('[data-action="role-bandit-tough"]').forEach((button) => {
      button.addEventListener('click', this._onBanditTough.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-bandit-tough-reset"]').forEach((button) => {
      button.addEventListener('click', this._onBanditToughReset.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-media-rumour"]').forEach((button) => {
      button.addEventListener('click', this._onMediaRumour.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-rocker-rock"]').forEach((button) => {
      button.addEventListener('click', this._onRockerRock.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-law-backup"]').forEach((button) => {
      button.addEventListener('click', this._onLawBackup.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-medtech-patchup"]').forEach((button) => {
      button.addEventListener('click', this._onMedtechPatchUp.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-medtech-surgery"]').forEach((button) => {
      button.addEventListener('click', this._onMedtechSurgery.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-medtech-cryo"]').forEach((button) => {
      button.addEventListener('click', this._onMedtechCryo.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-techie-roll"]').forEach((button) => {
      button.addEventListener('click', this._onTechieRoll.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-fixer-haggle"]').forEach((button) => {
      button.addEventListener('click', this._onFixerHaggle.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-guide-deal"]').forEach((button) => {
      button.addEventListener('click', this._onGuideDeal.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-guide-meditate"]').forEach((button) => {
      button.addEventListener('click', this._onGuideMeditate.bind(this));
    });
    this.element.querySelectorAll('[data-action="role-guide-play"]').forEach((button) => {
      button.addEventListener('click', this._onGuidePlayCard.bind(this));
    });
    this.element.querySelectorAll('[data-action="specialty-rank-change"]').forEach((button) => {
      button.addEventListener('click', this._onSpecialtyRankChange.bind(this));
    });

    // Money field: supports arithmetic expressions (e.g. "500-50" → 450)
    this.element.querySelectorAll('[data-action="update-money"]').forEach((input) => {
      input.addEventListener('change', this._onUpdateMoney.bind(this));
    });

    // Description tooltip / click-to-chat
    this.element.querySelectorAll('[data-description]').forEach((el) => {
      el.addEventListener('click', this._onShowDescription.bind(this));
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

  _onShowDescription(event) {
    if (game.settings.get('cyberpunk-blue', 'descriptionTooltips')) return;
    const el = event.currentTarget;
    const description = el.dataset.description;
    if (!description) return;
    event.preventDefault();
    event.stopPropagation();
    const label = el.dataset.label || el.textContent?.trim() || '';
    ChatMessage.create({
      content: `<p>${label ? `<strong>${label}</strong><br>` : ''}${description}</p>`,
      whisper: [game.user.id],
    });
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

  async _onRemoveAffliction(event) {
    event.preventDefault();
    const effectId = event.currentTarget.dataset.effectId;
    if (!effectId) return;
    const effect = this.document.effects.get(effectId);
    if (!effect) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.AfflictionEffectNotFound'));
      return;
    }
    await effect.delete();
  }

  async _onStartInstructions(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item) return;
    await startInstructions(item, this.document);
  }

  async _onAdvanceInstructions(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item) return;
    await advanceInstructions(item, this.document);
  }

  async _onToggleTargetVitals(event) {
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    const item = this._getItemFromEvent(event);
    if (!item) return;
    const current = item.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false;
    await item.setFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`, !current);
  }

  async _onPickVehicleVital(event) {
    event.preventDefault();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    const item = this._getItemFromEvent(event);
    if (!item) return;

    // If already set, clicking again clears the selection.
    const existing = item.getFlag('cyberpunk-blue', `targetVehicleVitalRegionId-${weaponIndex}`) ?? null;
    if (existing !== null) {
      await item.unsetFlag('cyberpunk-blue', `targetVehicleVitalRegionId-${weaponIndex}`);
      return;
    }

    // Require a vehicle token to be targeted.
    const targetToken = game.user.targets.first() ?? null;
    const targetActor = targetToken?.actor ?? null;
    if (!targetActor || targetActor.type !== 'vehicle') {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.VehicleVitals.NoAreas'));
      return;
    }

    const { pickVehicleVitalArea } = await import('../helpers/vehicle-vitals-canvas.mjs');
    const regionId = await pickVehicleVitalArea(targetToken.document);
    if (regionId === null) return; // cancelled

    await item.setFlag('cyberpunk-blue', `targetVehicleVitalRegionId-${weaponIndex}`, regionId);
  }

  async _onWeaponUnjam(event) {
    event.preventDefault();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    const item = this._getItemFromEvent(event);
    if (!item) return;
    await item.unsetFlag('cyberpunk-blue', `jammed-${weaponIndex}`);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-wrench"></i> ${game.i18n.format('CYBER_BLUE.Combat.WeaponUnjammed', { weapon: item.name })}</p></div>`,
    });
  }

  async _onWeaponCalibrate(event) {
    event.preventDefault();
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    const item = this._getItemFromEvent(event);
    if (!item) return;
    const actor = this.document;

    // If calibration is already active, cancel it
    const existing = item.getFlag('cyberpunk-blue', `calibration-${weaponIndex}`) ?? 0;
    if (existing > 0) {
      await item.unsetFlag('cyberpunk-blue', `calibration-${weaponIndex}`);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bullseye"></i> ${game.i18n.localize('CYBER_BLUE.Combat.CalibrationCancelled')}</p></div>`,
      });
      return;
    }

    const intValue = actor.system?.stats?.int?.value ?? 0;
    const intRollMod = actor.system?.stats?.int?.rollMod ?? 0;
    const saRank = actor.system?.skills?.shoulderArms?.rank ?? 0;
    const saBonus = actor.system?.skills?.shoulderArms?.bonus ?? 0;
    const calibrateTerms = [intValue, saRank];
    if (intRollMod) calibrateTerms.push(intRollMod);
    if (saBonus) calibrateTerms.push(saBonus);
    const formula = ['1d10', ...calibrateTerms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();

    const saLabel = CONFIG.CYBER_BLUE?.skills?.shoulderArms?.label ?? 'Shoulder Arms';
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.Calibrate')}: ${item.name}</h3><p>INT ${intValue} + ${saLabel} ${saRank} — DV 15</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    if (roll.total >= 15) {
      // Bonus: min(+8, shoulderArmsRank × 2) — but at least 1 if rank > 0
      const bonus = Math.max(1, Math.min(8, saRank * 2));
      await item.setFlag('cyberpunk-blue', `calibration-${weaponIndex}`, bonus);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bullseye"></i> ${game.i18n.format('CYBER_BLUE.Combat.CalibrateSuccess', { n: bonus })}</p></div>`,
      });
    } else {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="cyberpunk-blue chat-card"><p>${game.i18n.localize('CYBER_BLUE.Combat.CalibrateFail')}</p></div>`,
      });
    }
  }

  /**
   * Ricochet point button for Power Weapons.
   * If a point is already set: clear it.
   * Otherwise: enter placement mode and wait for canvas click.
   */
  async _onWeaponRicochet(event) {
    event.preventDefault();
    await toggleWeaponRicochet(this.document);
  }

  /**
   * Tech Weapon charge button.
   * If currently charged: manually cancel (set cooldown, remove MOVE AE).
   * Otherwise: charge the weapon (apply MOVE AE, set flags).
   */
  async _onWeaponCharge(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item) return;
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    await toggleWeaponCharge(this.document, item, weaponIndex);
  }

  async _onMartialArtsAttack(event) {
    event.preventDefault();
    const maIndex = Number.parseInt(event.currentTarget.dataset.maIndex ?? '0', 10);
    const componentSlug = event.currentTarget.dataset.componentSlug || null;
    const targetVitals = this.document.getFlag('cyberpunk-blue', `ma-targetVitals-${maIndex}`) ?? false;
    await resolveMartialArtsAttack(this.document, componentSlug, { targetVitals, maIndex });
  }

  async _onMaToggleTargetVitals(event) {
    const maIndex = Number.parseInt(event.currentTarget.dataset.maIndex ?? '0', 10);
    const current = this.document.getFlag('cyberpunk-blue', `ma-targetVitals-${maIndex}`) ?? false;
    await this.document.setFlag('cyberpunk-blue', `ma-targetVitals-${maIndex}`, !current);
  }

  async _onMartialArtsSpecialMove(event) {
    event.preventDefault();
    const moveId = event.currentTarget.dataset.moveId;
    const actor = this.document;
    switch (moveId) {
      case 'grab':                       return resolveGrab(actor);
      case 'choke':                      return resolveChoke(actor);
      case 'recovery':                   return resolveRecovery(actor);
      case 'throw':                      return resolveThrow(actor);
      case 'iron-grip':                  return resolveIronGrip(actor);
      case 'improvised-weapon':          return resolveImprovisedWeapon(actor, 0);
      case 'strong-attack':              return resolveStrongAttack(actor, 0);
      case 'bone-breaking-combination':  return resolveBoneBreakingCombination(actor, 0);
      case 'armor-breaking-combination': return resolveArmorBreakingCombination(actor, game.user.targets.first()?.actor ?? null);
      case 'counter-throw':              return resolveCounterThrow(actor, 0);
      case 'grab-escape':                return resolveGrabEscape(actor);
      case 'pressure-point-strike':      return resolvePressurePointStrike(actor, 0);
      case 'flying-kick':                return resolveFlyingKick(actor, 0);
      default:
        ui.notifications.warn(`Unknown martial arts move: ${moveId}`);
    }
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const type = event.currentTarget.dataset.itemType;
    if (!type) {
      return;
    }

    const labelKey = CONFIG.CYBER_BLUE.itemTypes[type]?.label ?? type;
    const label = game.i18n.localize(labelKey);
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

  async _onCreateSkillMacro(event) {
    event.preventDefault();

    const skillSlug = event.currentTarget.dataset.skillSlug;
    const actor = this.document;
    const skillDef = CONFIG.CYBER_BLUE.skills[skillSlug];
    if (!skillDef) {
      return;
    }
    const skillLabel = skillDef.label;

    // Components this skill links to that are active on this actor.
    const components = (skillDef.components ?? [])
      .filter((slug) => actor.system.components?.[slug]?.active)
      .map((slug) => ({
        slug,
        label: CONFIG.CYBER_BLUE.components[slug]?.label ?? slug,
        rank: actor.system.components[slug]?.rank ?? 0,
      }));

    const componentField = components.length
      ? `<div class="form-group">
          <label>${game.i18n.localize('CYBER_BLUE.Sheet.Macro.ChooseComponent')}</label>
          <select name="component">
            <option value="">${game.i18n.localize('CYBER_BLUE.Sheet.Macro.StandardOption')}</option>
            ${components.map((c) => `<option value="${c.slug}">${c.label} (${c.rank})</option>`).join('')}
          </select>
        </div>`
      : '';

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Sheet.Macro.DialogTitle') },
      content: `<div class="cyberpunk-blue">
          ${componentField}
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:0.5rem;">
              <input type="checkbox" name="hotbar" checked /> ${game.i18n.localize('CYBER_BLUE.Sheet.Macro.AddToHotbar')}
            </label>
          </div>
        </div>`,
      buttons: [
        { action: 'create', label: game.i18n.localize('CYBER_BLUE.Sheet.Macro.Create'), icon: 'fa-solid fa-scroll', default: true },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fa-solid fa-times' },
      ],
      submit: (result, event2, form) => resolve({
        result,
        component: form?.querySelector('[name="component"]')?.value || null,
        hotbar: form?.querySelector('[name="hotbar"]')?.checked ?? false,
      }),
    });
    dialog.addEventListener('close', () => resolve({ result: 'cancel' }), { once: true });
    dialog.render(true);

    const { result, component, hotbar } = await promise;
    if (result !== 'create') {
      return;
    }

    const componentSlug = component && components.some((c) => c.slug === component) ? component : null;
    const componentLabel = componentSlug ? components.find((c) => c.slug === componentSlug)?.label : null;
    const macroName = componentLabel ? `${skillLabel} (${componentLabel})` : skillLabel;

    const command = [
      `// Cyberpunk Blue — auto-generated skill macro`,
      `const actor = await fromUuid(${JSON.stringify(actor.uuid)});`,
      `if (!actor?.rollSkill) {`,
      `  ui.notifications.warn(game.i18n.localize("CYBER_BLUE.Sheet.Macro.NoActor"));`,
      `} else {`,
      `  await actor.rollSkill({ skillSlug: ${JSON.stringify(skillSlug)}, componentSlug: ${JSON.stringify(componentSlug)} });`,
      `}`,
    ].join('\n');

    const macro = await Macro.create({
      name: macroName,
      type: CONST.MACRO_TYPES.SCRIPT,
      // Default skill-macro icon; will be swapped for per-category icons once those exist.
      img: 'systems/cyberpunk-blue/assets/icons/bk_d10.svg',
      command,
      flags: {
        'cyberpunk-blue': {
          skillMacro: { actorUuid: actor.uuid, skillSlug, componentSlug },
        },
      },
    });
    if (!macro) {
      return;
    }

    if (hotbar) {
      let slot = null;
      for (let i = 1; i <= 50; i += 1) {
        if (!game.user.hotbar[i]) {
          slot = i;
          break;
        }
      }
      await game.user.assignHotbarMacro(macro, slot ?? 1);
      ui.notifications.info(game.i18n.format('CYBER_BLUE.Sheet.Macro.CreatedHotbar', { name: macroName }));
    } else {
      ui.notifications.info(game.i18n.format('CYBER_BLUE.Sheet.Macro.Created', { name: macroName }));
    }
  }

  async _onCreateWeaponMacro(event) {
    event.preventDefault();

    const ds = event.currentTarget.dataset;
    const itemId = ds.itemId;
    const weaponIndex = Number.parseInt(ds.weaponIndex ?? '-1', 10);
    const actor = this.document;
    const item = actor.items.get(itemId);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) {
      return;
    }

    const weaponName = ds.weaponName || item.name;
    const hasAutofire = ds.hasAutofire === 'true';
    const isStandardDamage = ds.isStandardDamage === 'true';
    const isTechWeapon = ds.isTechWeapon === 'true';
    const isPowerWeapon = ds.isPowerWeapon === 'true';
    const showsAmmo = ds.showsAmmo === 'true';

    // Available actions for this weapon, in display order.
    const actions = [{ value: 'attack', label: game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.ActionAttack') }];
    if (hasAutofire) actions.push({ value: 'autofire', label: game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.ActionAutofire') });
    if (showsAmmo) actions.push({ value: 'reload', label: game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.ActionReload') });
    if (isTechWeapon) actions.push({ value: 'charge', label: game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.ActionCharge') });
    if (isPowerWeapon) actions.push({ value: 'ricochet', label: game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.ActionRicochet') });

    const actionField = `<div class="form-group">
        <label>${game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.ChooseAction')}</label>
        <select name="weapon-action">
          ${actions.map((a) => `<option value="${a.value}">${a.label}</option>`).join('')}
        </select>
      </div>`;

    // Target-vitals is only meaningful for a standard-damage attack.
    const vitalsField = isStandardDamage
      ? `<div class="form-group" data-vitals-row>
          <label style="display:flex;align-items:center;gap:0.5rem;">
            <input type="checkbox" name="target-vitals" /> ${game.i18n.localize('CYBER_BLUE.Combat.TargetVitals')}
          </label>
        </div>`
      : '';

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Sheet.WeaponMacro.DialogTitle') },
      content: `<div class="cyberpunk-blue">
          ${actionField}
          ${vitalsField}
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:0.5rem;">
              <input type="checkbox" name="hotbar" checked /> ${game.i18n.localize('CYBER_BLUE.Sheet.Macro.AddToHotbar')}
            </label>
          </div>
        </div>`,
      buttons: [
        { action: 'create', label: game.i18n.localize('CYBER_BLUE.Sheet.Macro.Create'), icon: 'fa-solid fa-scroll', default: true },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fa-solid fa-times' },
      ],
      submit: (result, event2, form) => resolve({
        result,
        action: form?.querySelector('[name="weapon-action"]')?.value || 'attack',
        targetVitals: form?.querySelector('[name="target-vitals"]')?.checked ?? false,
        hotbar: form?.querySelector('[name="hotbar"]')?.checked ?? false,
      }),
    });
    dialog.addEventListener('close', () => resolve({ result: 'cancel' }), { once: true });
    dialog.render(true);

    const { result, action, targetVitals, hotbar } = await promise;
    if (result !== 'create') {
      return;
    }

    const actionLabel = actions.find((a) => a.value === action)?.label ?? action;
    const macroName = `${weaponName} — ${actionLabel}`;

    // target-vitals is only relevant for the attack action.
    const options = action === 'attack' ? { targetVitals } : {};
    const optionsArg = Object.keys(options).length ? `, options: ${JSON.stringify(options)}` : '';

    const command = [
      `// Cyberpunk Blue — auto-generated weapon macro`,
      `const actor = await fromUuid(${JSON.stringify(actor.uuid)});`,
      `if (!actor?.runWeaponAction) {`,
      `  ui.notifications.warn(game.i18n.localize("CYBER_BLUE.Sheet.Macro.NoActor"));`,
      `} else {`,
      `  await actor.runWeaponAction({ itemId: ${JSON.stringify(itemId)}, weaponIndex: ${weaponIndex}, action: ${JSON.stringify(action)}${optionsArg} });`,
      `}`,
    ].join('\n');

    const macro = await Macro.create({
      name: macroName,
      type: CONST.MACRO_TYPES.SCRIPT,
      img: item.img,
      command,
      flags: {
        'cyberpunk-blue': {
          weaponMacro: { actorUuid: actor.uuid, itemId, weaponIndex, action },
        },
      },
    });
    if (!macro) {
      return;
    }

    if (hotbar) {
      let slot = null;
      for (let i = 1; i <= 50; i += 1) {
        if (!game.user.hotbar[i]) {
          slot = i;
          break;
        }
      }
      await game.user.assignHotbarMacro(macro, slot ?? 1);
      ui.notifications.info(game.i18n.format('CYBER_BLUE.Sheet.Macro.CreatedHotbar', { name: macroName }));
    } else {
      ui.notifications.info(game.i18n.format('CYBER_BLUE.Sheet.Macro.Created', { name: macroName }));
    }
  }

  async _onOpenHealthEffect(event) {
    event.preventDefault();
    // UUID-based lookup so effects transferred from owned items (cyberware,
    // gear, drugs) resolve too — not just the actor's own effects.
    const uuid = event.currentTarget.dataset.effectUuid;
    const effect = uuid ? await fromUuid(uuid) : null;
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

    if (item.system.paired) {
      if (eligiblePlatforms.length < 2) {
        ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Cyberware.NeedTwoPlatforms'));
        return;
      }
      const pair = await promptForCyberwarePlatformPair(eligiblePlatforms);
      if (!pair) {
        return;
      }
      await item.update({
        'system.parentCyberwareId': pair[0],
        'system.parentCyberwareId2': pair[1],
      });
      return;
    }

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

    // Detaching a paired extension clears both platform assignments.
    const update = { 'system.parentCyberwareId': null };
    if (item.system.paired) {
      update['system.parentCyberwareId2'] = null;
    }
    await item.update(update);
  }

  // Flip an owned-but-uninstalled cyberware item to installed so it moves into
  // the appropriate installed section. Mirrors the role-grant behaviour, which
  // sets installed:true because granted gear is "already surgically fitted".
  async _onInstallCyberware(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'cyberware') {
      return;
    }

    await item.update({ 'system.installed': true });
  }

  async _onUninstallCyberware(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    if (!item || item.type !== 'cyberware') {
      return;
    }

    await item.update({ 'system.installed': false });
  }

  async _onSetGearState(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const state = event.currentTarget.dataset.state;
    if (!item || item.type !== 'gear' || !state) {
      return;
    }

    playUiSound('equip');
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

  async _onWeaponDoubleLock(event) {
    event.preventDefault();
    const item = this._getItemFromEvent(event);
    const weaponIndex = Number.parseInt(event.currentTarget.dataset.weaponIndex ?? '-1', 10);
    if (!item || Number.isNaN(weaponIndex) || weaponIndex < 0) return;
    await resolveDoubleLockAttack(this.document, item, weaponIndex);
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
    await reloadWeapon(this.document, item, weaponIndex);
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

  async _onOpenIpSpender(event) {
    event.preventDefault();
    const { IpSpenderApplication } = await import('../apps/ip-spender.mjs');
    IpSpenderApplication.openForActor(this.document);
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

  /**
   * Booster boost contributed by running Booster programs on the active
   * cyberdeck for a given component/use. Cracker uses the generic
   * attack/defend slugs.
   */
  _netBoost(componentSlug, useSlug) {
    const deckId = getNetConnection(this.document)?.cyberdeckId
      || getPrimaryCyberdeck(this.document)?.id || null;
    if (!deckId) return 0;
    return getBoost(this.document, deckId, componentSlug, useSlug);
  }

  async _onNetrunnerComponentRoll(event) {
    event.preventDefault();
    const componentSlug = event.currentTarget.dataset.componentSlug;
    const useLabel      = event.currentTarget.dataset.useLabel;
    const useSlug       = event.currentTarget.dataset.useSlug;
    const modifier      = Number(event.currentTarget.dataset.modifier) || 0;
    if (!componentSlug) return;

    // Zap has a full combat-resolution path
    if (useSlug === 'zap') {
      return this._onNetZap(modifier);
    }

    // Booster boost for this component/use (Cracker → generic "defend").
    const boostUse = componentSlug === 'cracker' ? 'defend' : useSlug;
    const totalMod = modifier + this._netBoost(componentSlug, boostUse);

    const componentLabel = CONFIG.CYBER_BLUE.components[componentSlug]?.label ?? componentSlug;
    const formula = totalMod >= 0 ? `1d10+${totalMod}` : `1d10${totalMod}`;
    const roll = await new Roll(formula).evaluate();
    const flavor = `<div class="cyberpunk-blue chat-card"><h3>${componentLabel}: ${useLabel}</h3></div>`;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor,
      rollMode: game.settings.get('core', 'rollMode'),
    });

    // Consume a NET action if in combat
    const combatant = game.combat?.combatants.find((c) => c.actor?.id === this.document.id);
    if (combatant) await consumeNetAction(combatant);

    // Encrypt/Decrypt: start a 1-round countdown AE (resolves next turn in combatTurn hook)
    if (useSlug === 'encryptDecrypt' && game.combat?.started) {
      const opLabel = useLabel ?? 'Encrypt/Decrypt';
      await startEncryptDecryptTimer(this.document, opLabel);
    }
  }

  async _onNetZap(modifier) {
    const actor = this.document;

    if (!isNetConnected(actor)) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.NotConnected'));
      return;
    }

    const targetToken = [...(game.user?.targets ?? [])][0];
    if (!targetToken?.actor) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoTarget'));
      return;
    }

    const label = game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.ZapLabel');
    const result = await resolveNetAttack(actor, targetToken.actor, modifier, label, '1d6', {
      boostContext: this._netBoost('cracker', 'attack'),
    });
    if (!result) return;

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) await consumeNetAction(combatant);
  }

  /**
   * Support-attack: the runner triggers a "Support attack" program's effects via
   * the Cracker component (like Zap) + the program's support modifier and
   * Booster Cracker/attack boost. On-hit effects come from the executable.
   */
  async _onSupportProgramAttack(event) {
    event.preventDefault();
    const actor = this.document;

    if (!isNetConnected(actor)) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.NotConnected'));
      return;
    }
    const exeId = event.currentTarget.dataset.exeId;
    const exe = actor.items.get(exeId);
    if (!exe || isInert(exe)) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.SupportUnavailable'));
      return;
    }
    const targetToken = [...(game.user?.targets ?? [])][0];
    if (!targetToken?.actor) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NoTarget'));
      return;
    }

    // Cracker modifier (same math as Zap): INT + Netrunner rank + min(netrunning, cracker).
    const sys = actor.system;
    const networkerRole = actor.items.find((i) => i.type === 'role' && i.name === 'Netrunner' && (Number(i.system.rank) || 0) >= 1);
    const networkerRank = Number(networkerRole?.system?.rank) || 0;
    const intVal = Number(sys.stats?.int?.value) || 0;
    const crackerRank = Number(sys.components?.cracker?.rank) || 0;
    const netrunningRank = Number(sys.skills?.netrunning?.rank) || 0;
    const crackerMod = intVal + networkerRank + Math.min(netrunningRank, crackerRank);
    const supportMod = Number(getNetCombat(exe)?.attack?.supportModifier) || 0;

    const label = game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.SupportAttackLabel', { name: exe.name });
    const result = await resolveNetAttack(actor, targetToken.actor, crackerMod + supportMod, label, '', {
      effectsConfig: getNetCombat(exe)?.attack ?? null,
      effectsSourceDoc: exe,
      sourceExe: exe,
      boostContext: this._netBoost('cracker', 'attack'),
    });
    if (!result) return;

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) await consumeNetAction(combatant);
  }

  async _onNetConnect(event) {
    event.preventDefault();
    const actor = this.document;
    if (isNetConnected(actor)) return;

    // Gather nearby access points from canvas
    let aps = [];
    if (canvas?.ready && canvas.scene) {
      const actorTok = canvas.tokens.placeables.find((t) => t.actor?.id === actor.id);
      if (actorTok) {
        const gridSize = canvas.grid.size;
        const tokenPos = {
          x: actorTok.document.x + actorTok.document.width  * gridSize / 2,
          y: actorTok.document.y + actorTok.document.height * gridSize / 2,
        };
        const primaryDeck = getPrimaryCyberdeck(actor);
        const range = Number(primaryDeck?.system.computer?.range) || 10;
        aps = getAccessPointsInRange(canvas.scene, tokenPos, range);
      }
    }

    if (aps.length === 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.NoAccessPoints'));
      return;
    }

    let chosenAp = aps[0];
    if (aps.length > 1) {
      const { promise, resolve } = Promise.withResolvers();
      const buttons = aps.map((r) => ({
        action: r.id,
        label: r.name || game.i18n.localize('CYBER_BLUE.Netrunning.AccessPoint'),
        callback: () => resolve(r),
      }));
      buttons.push({
        action: 'cancel',
        label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
        icon: 'fas fa-times',
        callback: () => resolve(null),
      });
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: game.i18n.localize('CYBER_BLUE.Netrunning.ChooseAP') },
        content: `<div class="cyberpunk-blue"><p>${game.i18n.localize('CYBER_BLUE.Netrunning.ChooseAPHint')}</p></div>`,
        buttons,
        submit: (result) => resolve(result),
      });
      dialog.addEventListener('close', () => resolve(null), { once: true });
      dialog.render(true);
      chosenAp = await promise;
      if (!chosenAp) return;
    }

    await connectToArchitecture(actor, chosenAp);

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) {
      // Seed the turn's NET action budget from the actor's data-model value
      // (includes role rank + Operative Infiltration + AE bonuses like Runner-speed).
      const netTotal = actor.system.netActionsTotal ?? 0;
      if (netTotal > 0) await unlockNetActions(combatant, netTotal);
      await consumeNetAction(combatant);
    }
  }

  async _onNetDisconnect(event) {
    event.preventDefault();
    const actor = this.document;
    if (!isNetConnected(actor)) return;

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Netrunning.DisconnectTitle') },
      content: `<div class="cyberpunk-blue"><p>${game.i18n.localize('CYBER_BLUE.Netrunning.DisconnectConfirm')}</p></div>`,
      buttons: [
        {
          action: 'confirm',
          label: game.i18n.localize('CYBER_BLUE.Netrunning.Disconnect'),
          icon: 'fas fa-plug-circle-xmark',
          callback: () => resolve(true),
        },
        {
          action: 'cancel',
          label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
          icon: 'fas fa-times',
          callback: () => resolve(false),
        },
      ],
      submit: (result) => resolve(result === 'confirm'),
    });
    dialog.addEventListener('close', () => resolve(false), { once: true });
    dialog.render(true);
    const confirmed = await promise;
    if (!confirmed) return;

    await disconnectFromArchitecture(actor, true);

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) await consumeNetAction(combatant);
  }

  async _onNetDefrag(event) {
    event.preventDefault();
    const actor = this.document;
    await defrag(actor);

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) await consumeNetAction(combatant);
  }

  async _onQuickhackBreach(event) {
    event.preventDefault();
    const actor = this.document;
    const check = checkQuickhackPrereqs(actor);
    if (!check.ok) {
      ui.notifications.warn(check.reason || game.i18n.localize('CYBER_BLUE.Netrunning.QuickhackNotReady'));
      return;
    }

    await performQuickhackBreach(actor, check.targetActor);

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) await consumeNetAction(combatant);
  }

  async _onQuickhackUpload(event) {
    event.preventDefault();
    const actor = this.document;
    const check = checkQuickhackPrereqs(actor);
    if (!check.ok) {
      ui.notifications.warn(check.reason || game.i18n.localize('CYBER_BLUE.Netrunning.QuickhackNotReady'));
      return;
    }
    const breached = check.targetActor.effects.some(
      (e) => e.getFlag('cyberpunk-blue', 'breachedBy') === actor.id
    );
    if (!breached) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Netrunning.MustBreachFirst'));
      return;
    }

    await performQuickhackUpload(actor, check.targetActor);

    const combatant = game.combat?.combatants.find((c) => c.actor?.id === actor.id);
    if (combatant) await consumeNetAction(combatant);
  }

  // ── Role ability mechanics ─────────────────────────────────────────────────

  async _onBanditTough(event) {
    event.preventDefault();
    const actor = this.document;
    const banditRole = actor.items.find((i) => i.type === 'role' && i.name === 'Bandit');
    if (!banditRole) return;
    const rank = Number(banditRole.system.rank) || 0;
    const maxUses = 1 + Math.floor(rank / 3);
    const current = actor.getFlag('cyberpunk-blue', 'toughUsesRemaining') ?? maxUses;
    if (current <= 0) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Role.Bandit.ToughDepleted'));
      return;
    }
    await actor.setFlag('cyberpunk-blue', 'toughUsesRemaining', current - 1);
    // Heal 1 HP
    const hp = actor.system.resources.hp;
    const maxHp = hp.max ?? hp.value ?? 0;
    const newHp = Math.min((hp.value ?? 0) + 1, maxHp);
    await actor.update({ 'system.resources.hp.value': newHp });
    // Apply suppression AE
    await actor.createEmbeddedDocuments('ActiveEffect', [{
      name: game.i18n.localize('CYBER_BLUE.Role.Bandit.Suppression'),
      icon: 'icons/svg/shield.svg',
      origin: actor.uuid,
      disabled: false,
      transfer: false,
      duration: { rounds: 1 },
      changes: [],
      flags: { 'cyberpunk-blue': { conditionId: 'bandit-suppression' } },
    }]);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Bandit.Tough')}</h3>
        <p>${game.i18n.format('CYBER_BLUE.Role.Bandit.ToughUsed', { remaining: current - 1, max: maxUses })}</p>
        <p>+1 HP, Suppression applied for 1 round.</p>
      </div>`,
    });
  }

  async _onBanditToughReset(event) {
    event.preventDefault();
    const actor = this.document;
    const banditRole = actor.items.find((i) => i.type === 'role' && i.name === 'Bandit');
    if (!banditRole) return;
    const rank = Number(banditRole.system.rank) || 0;
    const maxUses = 1 + Math.floor(rank / 3);
    await actor.setFlag('cyberpunk-blue', 'toughUsesRemaining', maxUses);
    ui.notifications.info(game.i18n.format('CYBER_BLUE.Role.Bandit.ToughReset', { max: maxUses }));
  }

  async _onMediaRumour(event) {
    event.preventDefault();
    const actor = this.document;
    const mediaRole = actor.items.find((i) => i.type === 'role' && i.name === 'Media');
    if (!mediaRole) return;
    const rank = Number(mediaRole.system.rank) || 0;
    const dvType = event.currentTarget.dataset.dvType; // 'active' or 'passive'
    const dv = parseInt(event.currentTarget.dataset.dv, 10);
    const tierName = event.currentTarget.dataset.tierName ?? '';

    // Pick the best available skill: business, government, or streetwise
    const RUMOUR_SKILLS = ['business', 'government', 'streetwise'];
    const system = actor.system;
    const intVal  = system.stats?.int?.value  ?? 0;
    const coolVal = system.stats?.cool?.value ?? 0;
    const statVal = Math.max(intVal, coolVal);
    const statLabel = statVal === coolVal && coolVal > intVal ? 'COOL' : 'INT';

    // Show dialog for skill selection
    const skillOptions = RUMOUR_SKILLS.map((slug) => {
      const skillRank = system.skills?.[slug]?.rank ?? 0;
      return `<option value="${slug}">${slug.charAt(0).toUpperCase() + slug.slice(1)} (rank ${skillRank})</option>`;
    }).join('');

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Role.Media.PickUpRumours') },
      content: `<div class="form-group"><label>${game.i18n.localize('CYBER_BLUE.Role.Media.RumourSkill')}</label><select name="skill">${skillOptions}</select></div>`,
      buttons: [
        { action: 'roll', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Roll'), icon: 'fa-solid fa-dice-d10', default: true },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fa-solid fa-times' },
      ],
      submit: (result, event2, form) => resolve({ result, skill: form?.querySelector('[name="skill"]')?.value }),
    });
    dialog.addEventListener('close', () => resolve({ result: 'cancel' }), { once: true });
    dialog.render(true);
    const { result, skill } = await promise;
    if (result !== 'roll' || !skill) return;

    const skillRank = system.skills?.[skill]?.rank ?? 0;
    const skillBonus = system.skills?.[skill]?.bonus ?? 0;
    const chosenStatSlug = (statLabel === 'COOL') ? 'cool' : 'int';
    const statRollMod = system.stats?.[chosenStatSlug]?.rollMod ?? 0;
    const mediaTerms = [statVal, skillRank, rank];
    if (statRollMod) mediaTerms.push(statRollMod);
    if (skillBonus) mediaTerms.push(skillBonus);
    const formula = ['1d10', ...mediaTerms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();
    const success = Number.isFinite(dv) ? roll.total >= dv : null;
    const dvText = Number.isFinite(dv) ? ` vs DV ${dv}` : '';
    const resultText = success === null ? '' : `<p><strong>${success ? game.i18n.localize('CYBER_BLUE.Sheet.Roll.Success') : game.i18n.localize('CYBER_BLUE.Sheet.Roll.Failure')}</strong></p>`;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Media.PickUpRumours')}${tierName ? ' — ' + tierName : ''}</h3>
        <p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}</strong> + ${statLabel} (${statVal}) + Media rank ${rank}${dvText}</p>
        ${resultText}
      </div>`,
    });
  }

  async _onRockerRock(event) {
    event.preventDefault();
    const actor = this.document;
    const rockerRole = actor.items.find((i) => i.type === 'role' && i.name === 'Rocker');
    if (!rockerRole) return;
    const rank = Number(rockerRole.system.rank) || 0;
    const system = actor.system;
    const coolVal = system.stats?.cool?.value ?? 0;

    // Performance skills: performance, persuasion, or any acting/art skill
    const PERF_SKILLS = ['performance', 'persuasion', 'acting', 'musicianship'];
    const available = PERF_SKILLS.filter((slug) => (system.skills?.[slug]?.rank ?? 0) > 0);
    const skillOptions = (available.length ? available : PERF_SKILLS).map((slug) => {
      const skillRank = system.skills?.[slug]?.rank ?? 0;
      return `<option value="${slug}">${slug.charAt(0).toUpperCase() + slug.slice(1)} (rank ${skillRank})</option>`;
    }).join('');

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Role.Rocker.Rock') },
      content: `<div class="form-group"><label>${game.i18n.localize('CYBER_BLUE.Role.Rocker.PerformSkill')}</label><select name="skill">${skillOptions}</select></div>`,
      buttons: [
        { action: 'roll', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Roll'), icon: 'fa-solid fa-dice-d10', default: true },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fa-solid fa-times' },
      ],
      submit: (result, event2, form) => resolve({ result, skill: form?.querySelector('[name="skill"]')?.value }),
    });
    dialog.addEventListener('close', () => resolve({ result: 'cancel' }), { once: true });
    dialog.render(true);
    const { result, skill } = await promise;
    if (result !== 'roll' || !skill) return;

    const skillRank = system.skills?.[skill]?.rank ?? 0;
    const skillBonus = system.skills?.[skill]?.bonus ?? 0;
    const coolRollMod = system.stats?.cool?.rollMod ?? 0;
    const rockerTerms = [coolVal, skillRank, rank];
    if (coolRollMod) rockerTerms.push(coolRollMod);
    if (skillBonus) rockerTerms.push(skillBonus);
    const formula = ['1d10', ...rockerTerms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Rocker.Rock')}</h3>
        <p><strong>${skill.charAt(0).toUpperCase() + skill.slice(1)}</strong> (rank ${skillRank}) + COOL (${coolVal}) + Rocker rank ${rank}</p>
      </div>`,
    });
  }

  async _onLawBackup(event) {
    event.preventDefault();
    const actor = this.document;
    const lawRole = actor.items.find((i) => i.type === 'role' && i.name === 'Law');
    if (!lawRole) return;
    const rank = Number(lawRole.system.rank) || 0;
    const backupType = event.currentTarget.dataset.backupType;
    const dv = parseInt(event.currentTarget.dataset.dv, 10);
    if (!backupType || !Number.isFinite(dv)) return;

    const formula = `1d10 + ${rank}`;
    const roll = await new Roll(formula).evaluate();
    const success = roll.total >= dv;

    let arrivalMsg = '';
    if (success) {
      const arrivalRoll = await new Roll('1d6').evaluate();
      arrivalMsg = game.i18n.format('CYBER_BLUE.Role.Law.BackupArrives', { rounds: arrivalRoll.total });
      // Also show arrival roll in the same message
      await arrivalRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `<div class="cyberpunk-blue chat-card"><p>${game.i18n.localize('CYBER_BLUE.Role.Law.ArrivalRoll')}</p></div>`,
        rollMode: 'blindroll',
      });
    }

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Law.CallBackup')}: ${backupType}</h3>
        <p>1d10 + Law rank ${rank} vs DV ${dv}</p>
        <p><strong>${success ? game.i18n.localize('CYBER_BLUE.Sheet.Roll.Success') : game.i18n.localize('CYBER_BLUE.Sheet.Roll.Failure')}</strong>${success ? ' — ' + arrivalMsg : ''}</p>
      </div>`,
    });
  }

  async _onMedtechPatchUp(event) {
    event.preventDefault();
    const actor = this.document;
    const medRole = actor.items.find((i) => i.type === 'role' && i.name === 'Medtech');
    if (!medRole) return;
    const medSystem = normalizeRoleSystemData(medRole.system);
    const battleSpec = (medSystem.specialties ?? []).find((s) => s.name === 'Battle Medic');
    const battleRank = Number(battleSpec?.rank) || 0;
    const maxHeal = battleRank * 2;
    if (maxHeal <= 0) return;

    // Build target picker: all actors the user can see
    const candidates = game.actors.contents
      .filter((a) => ['character', 'npc'].includes(a.type) && a.testUserPermission(game.user, 'OBSERVER'))
      .map((a) => `<option value="${a.id}">${a.name} (HP: ${a.system.resources?.hp?.value ?? '?'}/${a.system.resources?.hp?.max ?? '?'})</option>`)
      .join('');

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize('CYBER_BLUE.Role.Medtech.PatchUp') },
      content: `<div class="form-group">
        <label>${game.i18n.localize('CYBER_BLUE.Role.Medtech.PatchUpTarget')}</label>
        <select name="actorId">${candidates}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize('CYBER_BLUE.Role.Medtech.PatchUpAmount')} (max ${maxHeal})</label>
        <input type="number" name="amount" value="${maxHeal}" min="1" max="${maxHeal}" />
      </div>`,
      buttons: [
        { action: 'apply', label: game.i18n.localize('CYBER_BLUE.Role.Medtech.Apply'), icon: 'fa-solid fa-heart-pulse', default: true },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fa-solid fa-times' },
      ],
      submit: (result, event2, form) => resolve({
        result,
        actorId: form?.querySelector('[name="actorId"]')?.value,
        amount: Math.min(parseInt(form?.querySelector('[name="amount"]')?.value ?? maxHeal, 10), maxHeal),
      }),
    });
    dialog.addEventListener('close', () => resolve({ result: 'cancel' }), { once: true });
    dialog.render(true);

    const { result, actorId, amount } = await promise;
    if (result !== 'apply' || !actorId || !(amount > 0)) return;

    const targetActor = game.actors.get(actorId);
    if (!targetActor) return;
    const hp = targetActor.system.resources.hp;
    const newHp = Math.min((hp.value ?? 0) + amount, hp.max ?? hp.value ?? 0);
    await targetActor.update({ 'system.resources.hp.value': newHp });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Medtech.PatchUp')}</h3>
        <p>${game.i18n.format('CYBER_BLUE.Role.Medtech.PatchUpApplied', { amount, target: targetActor.name, newHp })}</p>
      </div>`,
    });
  }

  async _onMedtechSurgery(event) {
    event.preventDefault();
    const actor = this.document;
    const medRole = actor.items.find((i) => i.type === 'role' && i.name === 'Medtech');
    if (!medRole) return;
    const medSystem = normalizeRoleSystemData(medRole.system);
    const surgSpec = (medSystem.specialties ?? []).find((s) => s.name === 'Surgery');
    const surgRank = Number(surgSpec?.rank) || 0;
    const system = actor.system;
    const techVal = system.stats?.tech?.value ?? 0;
    const techRollMod = system.stats?.tech?.rollMod ?? 0;
    const medRank = system.skills?.medicine?.rank ?? 0;
    const medBonus = system.skills?.medicine?.bonus ?? 0;
    const usedRank = Math.min(medRank, surgRank);
    const surgTerms = [techVal, usedRank];
    if (techRollMod) surgTerms.push(techRollMod);
    if (medBonus) surgTerms.push(medBonus);
    const formula = ['1d10', ...surgTerms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Medtech.Surgery')}</h3>
        <p>1d10 + TECH (${techVal}) + min(Medicine ${medRank}, Surgery ${surgRank}) = + ${usedRank}</p>
      </div>`,
    });
  }

  async _onMedtechCryo(event) {
    event.preventDefault();
    const actor = this.document;
    const medRole = actor.items.find((i) => i.type === 'role' && i.name === 'Medtech');
    if (!medRole) return;
    const medSystem = normalizeRoleSystemData(medRole.system);
    const cryoSpec = (medSystem.specialties ?? []).find((s) => s.name === 'Cryosystem Operation');
    const cryoRank = Number(cryoSpec?.rank) || 0;
    const system = actor.system;
    const techVal = system.stats?.tech?.value ?? 0;
    const techRollMod = system.stats?.tech?.rollMod ?? 0;
    const medRank = system.skills?.medicine?.rank ?? 0;
    const medBonus = system.skills?.medicine?.bonus ?? 0;
    const dv = parseInt(event.currentTarget.dataset.dv, 10) || 13;
    const cryoTerms = [techVal, Math.min(medRank, cryoRank)];
    if (techRollMod) cryoTerms.push(techRollMod);
    if (medBonus) cryoTerms.push(medBonus);
    const formula = ['1d10', ...cryoTerms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();
    const success = roll.total >= dv;
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Medtech.CryoUse')}</h3>
        <p>1d10 + TECH (${techVal}) + min(Medicine ${medRank}, Cryosystem ${cryoRank}) vs DV ${dv}</p>
        <p><strong>${success ? game.i18n.localize('CYBER_BLUE.Sheet.Roll.Success') : game.i18n.localize('CYBER_BLUE.Sheet.Roll.Failure')}</strong></p>
      </div>`,
    });
  }

  async _onTechieRoll(event) {
    event.preventDefault();
    const actor = this.document;
    const techRole = actor.items.find((i) => i.type === 'role' && i.name === 'Techie');
    if (!techRole) return;
    const techRoleSystem = normalizeRoleSystemData(techRole.system);
    const rollType = event.currentTarget.dataset.rollType;
    const specRank = parseInt(event.currentTarget.dataset.specRank, 10) || 0;
    const system = actor.system;
    const techVal = system.stats?.tech?.value ?? 0;

    // Pick appropriate skill: electronics or mechanics
    const elecRank = system.skills?.electronics?.rank ?? 0;
    const mechRank = system.skills?.mechanics?.rank ?? 0;
    const skillOptions = [
      `<option value="electronics">Electronics (rank ${elecRank})</option>`,
      `<option value="mechanics">Mechanics (rank ${mechRank})</option>`,
    ].join('');

    const { promise, resolve } = Promise.withResolvers();
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: game.i18n.localize(`CYBER_BLUE.Role.Techie.${rollType.charAt(0).toUpperCase() + rollType.slice(1)}`) },
      content: `<div class="form-group"><label>${game.i18n.localize('CYBER_BLUE.Role.Techie.Skill')}</label><select name="skill">${skillOptions}</select></div>`,
      buttons: [
        { action: 'roll', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Roll'), icon: 'fa-solid fa-dice-d10', default: true },
        { action: 'cancel', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), icon: 'fa-solid fa-times' },
      ],
      submit: (result, event2, form) => resolve({ result, skill: form?.querySelector('[name="skill"]')?.value }),
    });
    dialog.addEventListener('close', () => resolve({ result: 'cancel' }), { once: true });
    dialog.render(true);
    const { result, skill } = await promise;
    if (result !== 'roll' || !skill) return;

    const skillRank = system.skills?.[skill]?.rank ?? 0;
    const skillBonus = system.skills?.[skill]?.bonus ?? 0;
    const techRollMod = system.stats?.tech?.rollMod ?? 0;
    const techieTerms = [techVal, skillRank, specRank];
    if (techRollMod) techieTerms.push(techRollMod);
    if (skillBonus) techieTerms.push(skillBonus);
    const formula = ['1d10', ...techieTerms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize(`CYBER_BLUE.Role.Techie.${rollType.charAt(0).toUpperCase() + rollType.slice(1)}`)}</h3>
        <p>1d10 + TECH (${techVal}) + ${skill} (${skillRank}) + spec rank (${specRank})</p>
      </div>`,
    });
  }

  async _onSpecialtyRankChange(event) {
    event.preventDefault();
    const roleId = event.currentTarget.closest('[data-item-id]')?.dataset.itemId;
    const specialtyIndex = parseInt(event.currentTarget.dataset.specialtyIndex, 10);
    const delta = parseInt(event.currentTarget.dataset.delta, 10);
    if (!roleId || !Number.isFinite(specialtyIndex) || !Number.isFinite(delta)) return;

    const roleItem = this.document.items.get(roleId);
    if (!roleItem || roleItem.type !== 'role') return;

    // Work on a full clone of the role system and write back the WHOLE object.
    // Updating a single array element via a dotted path (system.specialties.N.rank)
    // collides with the intact array in CyberBlueItem#_preUpdate's role merge and
    // wipes the specialties (and the rest of the role). Mirror the safe pattern in
    // _onToggleSpecialtyOption: clone → mutate → update({ system }).
    const system = normalizeRoleSystemData(roleItem.system.toObject?.() ?? roleItem.system);
    const specialty = system.specialties[specialtyIndex];
    if (!specialty) return;

    const roleRank = Number(system.rank) || 0;
    const totalBudget = roleRank * 2;
    const currentTotal = system.specialties.reduce((sum, s) => sum + (Number(s.rank) || 0), 0);
    const currentRank = Number(specialty.rank) || 0;
    const newRank = Math.max(0, Math.min(roleRank, currentRank + delta));

    if (delta > 0 && currentTotal >= totalBudget) return;
    if (newRank === currentRank) return;

    specialty.rank = newRank;
    await roleItem.update({ system });
  }

  async _onFixerHaggle(event) {
    event.preventDefault();
    const actor = this.document;
    const fixerRole = actor.items.find((i) => i.type === 'role' && i.name === 'Fixer');
    if (!fixerRole) return;
    const rank = Number(fixerRole.system.rank) || 0;
    const system = actor.system;
    const coolVal = system.stats?.cool?.value ?? 0;
    const intVal  = system.stats?.int?.value  ?? 0;
    const tradingRank  = system.skills?.trading?.rank  ?? 0;
    const tradingBonus = system.skills?.trading?.bonus ?? 0;
    // Ability: "Use COOL instead of INT if preferred" → auto-use whichever is higher
    const useCool = coolVal > intVal;
    const statName = useCool ? 'COOL' : 'INT';
    const statVal  = useCool ? coolVal : intVal;
    const statRollMod = useCool
      ? (system.stats?.cool?.rollMod ?? 0)
      : (system.stats?.int?.rollMod  ?? 0);
    const terms = [statVal, tradingRank, rank];
    if (statRollMod)  terms.push(statRollMod);
    if (tradingBonus) terms.push(tradingBonus);
    const formula = ['1d10', ...terms.map((t) => (t >= 0 ? `+ ${t}` : `- ${Math.abs(t)}`))].join(' ');
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      rollMode: game.settings.get('core', 'rollMode'),
      flavor: `<div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Role.Fixer.Haggle')}</h3>
        <p>1d10 + ${statName} (${statVal}) + Trading (${tradingRank}) + Fixer rank (${rank})</p>
      </div>`,
    });
  }

  /** Deal a fresh Reading at the start of a session (or re-deal). Resets meditations. */
  async _onGuideDeal(event) {
    event.preventDefault();
    const actor = this.document;
    const guideRole = actor.items.find((i) => i.type === 'role' && i.name === 'Guide');
    if (!guideRole) return;
    const rank = Number(guideRole.system.rank) || 0;
    const psycheMax = actor.system.resources?.psyche?.max ?? 60;
    const lockedCount = Math.max(0, Math.floor((60 - psycheMax) / 10));
    const availableCards = 22 - lockedCount;
    const drawCount = Math.min(rank, availableCards);

    // Build and shuffle a deck of available cards (lock the highest-numbered ones)
    const allIndices = Array.from({ length: 22 }, (_, i) => i);
    const unlockedIndices = allIndices.slice(0, availableCards);
    const shuffled = shuffleArray(unlockedIndices);
    const reading = shuffled.slice(0, drawCount);
    const deck    = shuffled.slice(drawCount);

    await actor.setFlag('cyberpunk-blue', 'guide.reading', reading);
    await actor.setFlag('cyberpunk-blue', 'guide.deck',    deck);
    await actor.setFlag('cyberpunk-blue', 'guide.meditationsUsed', 0);

    const cardNames = reading.map((i) => `${i}. ${GUIDE_CARDS[i]}`).join(', ');
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3>Guide Reading Dealt</h3>
        <p>${lockedCount > 0 ? `<em>${lockedCount} card(s) locked due to cyberware.</em> ` : ''}Drawing ${drawCount} of ${availableCards} available cards.</p>
        <p><strong>Reading:</strong> ${cardNames}</p>
        <p><em>Deck: ${deck.length} card(s) remaining.</em></p>
      </div>`,
    });
  }

  /** Meditate: reshuffle all held + deck cards and deal a new Reading. */
  async _onGuideMeditate(event) {
    event.preventDefault();
    const actor = this.document;
    const guideRole = actor.items.find((i) => i.type === 'role' && i.name === 'Guide');
    if (!guideRole) return;
    const rank = Number(guideRole.system.rank) || 0;
    const meditationsMax = 1 + (rank >= 5 ? 1 : 0) + (rank >= 10 ? 1 : 0);
    const meditationsUsed = actor.getFlag('cyberpunk-blue', 'guide.meditationsUsed') ?? 0;
    if (meditationsUsed >= meditationsMax) {
      ui.notifications.warn('No meditations remaining this session.');
      return;
    }
    const psycheMax = actor.system.resources?.psyche?.max ?? 60;
    const lockedCount = Math.max(0, Math.floor((60 - psycheMax) / 10));
    const availableCards = 22 - lockedCount;
    const drawCount = Math.min(rank, availableCards);

    const currentReading = actor.getFlag('cyberpunk-blue', 'guide.reading') ?? [];
    const currentDeck    = actor.getFlag('cyberpunk-blue', 'guide.deck')    ?? [];
    const allCurrent = [...currentReading, ...currentDeck];
    const shuffled = shuffleArray(allCurrent);
    const reading = shuffled.slice(0, drawCount);
    const deck    = shuffled.slice(drawCount);
    const newMeditationsUsed = meditationsUsed + 1;

    await actor.setFlag('cyberpunk-blue', 'guide.reading', reading);
    await actor.setFlag('cyberpunk-blue', 'guide.deck',    deck);
    await actor.setFlag('cyberpunk-blue', 'guide.meditationsUsed', newMeditationsUsed);

    const cardNames = reading.map((i) => `${i}. ${GUIDE_CARDS[i]}`).join(', ');
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3>Guide Meditates</h3>
        <p>Reshuffled and dealt a new Reading (meditation ${newMeditationsUsed}/${meditationsMax}).</p>
        <p><strong>New Reading:</strong> ${cardNames}</p>
      </div>`,
    });
  }

  /** Play a card from the Reading; draw a replacement from the deck, shuffle played card back in. */
  async _onGuidePlayCard(event) {
    event.preventDefault();
    const actor = this.document;
    const cardIndex = parseInt(event.currentTarget.dataset.cardIndex, 10);
    if (!Number.isFinite(cardIndex)) return;

    const reading = [...(actor.getFlag('cyberpunk-blue', 'guide.reading') ?? [])];
    const deck    = [...(actor.getFlag('cyberpunk-blue', 'guide.deck')    ?? [])];
    const pos = reading.indexOf(cardIndex);
    if (pos === -1) return;

    // Remove played card from reading, shuffle it back into deck, draw one replacement
    reading.splice(pos, 1);
    const newDeck = shuffleArray([...deck, cardIndex]);
    let newReading = [...reading];
    if (newDeck.length > 0) {
      newReading = [...reading, newDeck.shift()];
    }

    await actor.setFlag('cyberpunk-blue', 'guide.reading', newReading);
    await actor.setFlag('cyberpunk-blue', 'guide.deck',    newDeck);

    const cardName = GUIDE_CARDS[cardIndex] ?? `Card ${cardIndex}`;
    const drawnName = newReading.length > reading.length
      ? (GUIDE_CARDS[newReading.at(-1)] ?? `Card ${newReading.at(-1)}`)
      : null;
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3>Guide plays: ${cardIndex}. ${cardName}</h3>
        ${drawnName ? `<p>Drew <strong>${drawnName}</strong> as replacement. Reading: ${newReading.map((i) => `${i}. ${GUIDE_CARDS[i]}`).join(', ')}.</p>` : '<p>Deck is empty — no replacement drawn.</p>'}
      </div>`,
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

    // Program lifecycle: spawn / despawn when the running flag is toggled
    if (field === 'system.running' && isNetConnected(this.document)) {
      if (value === true) {
        await spawnProgramActor(this.document, exeDoc);
      } else {
        await despawnProgramActor(this.document, exeDoc);
      }
    }

    // Exe → Program Actor field sync (incl. REZ) is handled centrally by the
    // updateItem hook (syncExecutableToProgramActors); no manual push needed.
  }

  /**
   * Money field change handler — evaluates simple arithmetic expressions before saving.
   * e.g. "500-50" → 450, "1200+300" → 1500.
   */
  async _onUpdateMoney(event) {
    event.preventDefault();
    event.stopPropagation();
    const raw = (event.currentTarget.value ?? '').trim();
    let result = 0;
    if (raw) {
      // Strip everything except digits and basic arithmetic operators
      const safe = raw.replace(/[^0-9+\-*/\s().]/g, '').trim();
      try {
        // eslint-disable-next-line no-new-func
        const evaluated = Function('"use strict"; return (' + safe + ')')();
        result = Number.isFinite(evaluated) ? Math.round(evaluated) : 0;
      } catch {
        result = parseInt(raw, 10) || 0;
      }
    }
    result = Math.max(0, result);
    await this.document.update({ 'system.money': result });
  }
}
