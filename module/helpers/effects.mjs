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
