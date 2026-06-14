/**
 * Shared sheet-listener wiring for the NET Combat tab's Booster table. Both the
 * Program actor sheet and the Program Executable item sheet call
 * `attachNetCombatListeners(rootEl, doc)` from their `_onRender`.
 *
 * Booster rows are edited through data-* attributes (no `name`) so they do not
 * ride submitOnChange; instead any add/remove/edit rewrites the whole
 * `system.netCombat.booster.boosts` array (ArrayField replace), which re-renders
 * the sheet and refreshes the per-row use options.
 */

/** Read the current boosts array from the document as a plain array. */
function currentBoosts(doc) {
  return foundry.utils.deepClone(doc.system?.netCombat?.booster?.boosts ?? []);
}

/** Rebuild the boosts array from the DOM rows under `rootEl`. */
function readBoostsFromDom(rootEl) {
  const rows = rootEl.querySelectorAll('.net-booster-row');
  return [...rows].map((row) => ({
    component: row.querySelector('[data-boost-field="component"]')?.value ?? '',
    use:       row.querySelector('[data-boost-field="use"]')?.value ?? '',
    value:     Number(row.querySelector('[data-boost-field="value"]')?.value) || 0,
  }));
}

/**
 * Preserve the Booster `boosts` array across a sheet form submit.
 *
 * Booster rows are edited through `data-*` attributes with NO `name`, so they
 * never ride a form submit — they are written directly via `doc.update()` by the
 * listeners above. But `super._prepareSubmitData` runs the submitted data through
 * SchemaField cleanData with `partial:false`, which resets any un-submitted field
 * to its schema `initial` — for the `booster.boosts` ArrayField that is `[]`. So
 * any unrelated NET Combat edit would silently wipe the boosts. Whenever a submit
 * produces a `system.netCombat` payload, restore the stored boosts from `_source`
 * (the form is never the source of truth for them).
 *
 * Call this from each sheet's `_prepareSubmitData`, just before returning.
 *
 * @param {object}     data - the prepared submit data (nested `system.*`)
 * @param {Actor|Item} doc  - the sheet's document
 * @returns {object} the same `data`, with `booster.boosts` preserved
 */
export function preserveBoosterBoosts(data, doc) {
  const nc = data?.system?.netCombat;
  if (!nc) return data;
  const stored = doc?._source?.system?.netCombat?.booster?.boosts;
  if (stored === undefined) return data;
  nc.booster ??= {};
  nc.booster.boosts = foundry.utils.deepClone(stored);
  return data;
}

export function attachNetCombatListeners(rootEl, doc) {
  if (!rootEl) return;

  rootEl.querySelector('[data-action="net-booster-add"]')?.addEventListener('click', async (event) => {
    event.preventDefault();
    const boosts = currentBoosts(doc);
    boosts.push({ component: '', use: '', value: 0 });
    await doc.update({ 'system.netCombat.booster.boosts': boosts });
  });

  rootEl.querySelectorAll('[data-action="net-booster-remove"]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      const idx = Number(event.currentTarget.dataset.index);
      const boosts = currentBoosts(doc);
      if (idx >= 0 && idx < boosts.length) {
        boosts.splice(idx, 1);
        await doc.update({ 'system.netCombat.booster.boosts': boosts });
      }
    });
  });

  rootEl.querySelectorAll('.net-booster-row [data-boost-field]').forEach((field) => {
    field.addEventListener('change', async (event) => {
      event.stopPropagation();
      const boosts = readBoostsFromDom(rootEl);
      // Resetting the component invalidates the previously chosen use.
      if (event.currentTarget.dataset.boostField === 'component') {
        const row = event.currentTarget.closest('.net-booster-row');
        const idx = Number(row?.dataset.index);
        if (boosts[idx]) boosts[idx].use = '';
      }
      await doc.update({ 'system.netCombat.booster.boosts': boosts });
    });
  });
}
