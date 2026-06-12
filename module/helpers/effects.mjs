/**
 * Manage Active Effect instances through an Actor or Item Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning document which manages this effect
 */
export function onManageActiveEffect(event, owner) {
  event.preventDefault();
  const a = event.currentTarget;
  const li = a.closest('li');
  const effect = li.dataset.effectId
    ? owner.effects.get(li.dataset.effectId)
    : null;
  switch (a.dataset.action) {
    case 'create':
      return owner.createEmbeddedDocuments('ActiveEffect', [
        {
          name: game.i18n.format('DOCUMENT.New', {
            type: game.i18n.localize('DOCUMENT.ActiveEffect'),
          }),
          icon: 'icons/svg/aura.svg',
          origin: owner.uuid,
          'duration.rounds':
            li.dataset.effectType === 'temporary' ? 1 : undefined,
          disabled: li.dataset.effectType === 'inactive',
          transfer: owner.documentName === 'Item',
        },
      ]);
    case 'edit':
      return effect.sheet.render(true);
    case 'delete':
      return effect.delete();
    case 'toggle':
      return effect.update({ disabled: !effect.disabled });
  }
}

/**
 * Scan all *active* (non-disabled) AEs on an actor for a flag value under the
 * 'cyberpunk-blue' scope.  Returns the maximum numeric value across all matching
 * AEs, `true` if the flag is a non-numeric truthy value, or `null` if no active
 * AE carries the flag.
 *
 * Used for tactic AEs (soloSpotWeakness, ninjaWeakSpot, soloDamageDeflection,
 * soloFumbleRecovery, soloPrecisionAttack) which carry their effect purely via a
 * flag, not a change.
 *
 * @param {Actor}  actor
 * @param {string} flagKey — flag key within the 'cyberpunk-blue' scope
 * @returns {number|boolean|null}
 */
export function getActiveAEFlag(actor, flagKey) {
  let result = null;
  for (const effect of actor.effects ?? []) {
    if (effect.disabled) continue;
    const val = effect.getFlag('cyberpunk-blue', flagKey);
    if (val === undefined || val === null || val === false) continue;
    if (typeof val === 'number') {
      result = result === null ? val : Math.max(result, val);
    } else {
      result = val; // boolean true or string
    }
  }
  return result;
}

/**
 * Active-effect flags that mark an effect as triggered by a critical condition
 * (low HP, low PSYCHE, or a Critical Injury). The Effects panel renders these
 * in the --cpb-error colour so they stand out from ordinary buffs.
 */
const ERROR_EFFECT_FLAGS = Object.freeze([
  'autoSeriousWound',    // low HP (below Serious Wound threshold)
  'autoMortallyWounded', // HP ≤ 0
  'dead',                // killed
  'needsStabilization',  // bleeding out (HP loss)
  'psycheState',         // low PSYCHE (cyberpsychosis states)
  'criticalInjury',      // Critical Injury
]);
const CRITICAL_INJURY_FLAG = 'criticalInjury';
const AFFLICTION_EFFECT_FLAG = 'isAffliction';

/**
 * Build the grouped data for the actor "Effects" panel.
 *
 * Collects every Active Effect currently applied to the actor — including
 * effects transferred from owned items (cyberware, gear, drugs) — and groups
 * them by name so that repeated effects with the same name (e.g. several
 * "PSYCHE loss" instances) collapse under a single expandable header instead
 * of filling the panel.
 *
 * @param {Actor} actor
 * @returns {{ groups: object[], hasEffects: boolean }}
 */
export function buildActorEffectGroups(actor) {
  if (!actor || typeof actor.appliedEffects?.[Symbol.iterator] !== 'function') {
    return { groups: [], hasEffects: false };
  }

  const canEdit = game.user.role >= CONST.USER_ROLES.TRUSTED;
  const groups = new Map();

  for (const effect of actor.appliedEffects) {
    const cb = effect.flags?.['cyberpunk-blue'] ?? {};
    const isError = ERROR_EFFECT_FLAGS.some(
      (flag) => cb[flag] !== undefined && cb[flag] !== null && cb[flag] !== false,
    );
    const critFlag = cb[CRITICAL_INJURY_FLAG];
    const icon = effect.img || effect.icon || 'icons/svg/aura.svg';
    const member = {
      id: effect.id,
      uuid: effect.uuid,
      name: effect.name,
      icon,
      // Root-absolute form for CSS mask-image (error icons). A relative url()
      // inside a custom property resolves against the stylesheet's /css/ dir and
      // 404s, so it must start with "/" (or be an absolute URL).
      iconCss: /^(https?:\/\/|\/)/.test(icon) ? icon : `/${icon}`,
      duration: effect.duration?.label || game.i18n.localize('CYBER_BLUE.Effect.Ongoing'),
      canEdit,
      isError,
      isCriticalInjury: !!critFlag,
      mortal: critFlag?.mortal ?? false,
      isAffliction: !!cb[AFFLICTION_EFFECT_FLAG],
    };

    const existing = groups.get(effect.name);
    if (existing) {
      existing.members.push(member);
      if (isError) existing.isError = true;
    } else {
      groups.set(effect.name, {
        key: effect.name,
        name: effect.name,
        icon: member.icon,
        iconCss: member.iconCss,
        isError,
        members: [member],
      });
    }
  }

  const list = [...groups.values()]
    .map((group) => ({
      ...group,
      count: group.members.length,
      expandable: group.members.length > 1,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return { groups: list, hasEffects: list.length > 0 };
}

/**
 * Wire the click handlers for an actor "Effects" panel rendered from the shared
 * partial. Opens an effect (by UUID, so transferred item effects resolve) and
 * lets GMs delete Critical Injury / Affliction effects.
 *
 * @param {HTMLElement} root  The sheet's root element.
 * @param {Actor} actor       The actor owning the panel.
 */
export function attachEffectsPanelListeners(root, actor) {
  if (!root) return;

  root.querySelectorAll('[data-action="open-health-effect"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const uuid = event.currentTarget.dataset.effectUuid;
      const effect = uuid ? await fromUuid(uuid) : null;
      if (!effect) return;
      effect.sheet.render(true, { editable: game.user.role >= CONST.USER_ROLES.TRUSTED });
    });
  });

  root.querySelectorAll('[data-action="remove-critical-injury"], [data-action="remove-affliction"]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const effectId = event.currentTarget.dataset.effectId;
      const effect = effectId ? actor.effects.get(effectId) : null;
      if (!effect) return;
      await effect.delete();
    });
  });
}

/**
 * Prepare the data structure for Active Effects which are currently embedded in an Actor or Item.
 * @param {ActiveEffect[]} effects    A collection or generator of Active Effect documents to prepare sheet data for
 * @return {object}                   Data for rendering
 */
export function prepareActiveEffectCategories(effects) {
  // Define effect header categories
  const categories = {
    temporary: {
      type: 'temporary',
      label: game.i18n.localize('CYBER_BLUE.Effect.Temporary'),
      effects: [],
    },
    passive: {
      type: 'passive',
      label: game.i18n.localize('CYBER_BLUE.Effect.Passive'),
      effects: [],
    },
    inactive: {
      type: 'inactive',
      label: game.i18n.localize('CYBER_BLUE.Effect.Inactive'),
      effects: [],
    },
  };

  // Iterate over active effects, classifying them into categories
  for (let e of effects) {
    if (e.disabled) categories.inactive.effects.push(e);
    else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }
  return categories;
}
