/**
 * Shared Style-entry schema used by both Gear and Cyberware items.
 *
 * A Style is a cosmetic variant of an item: its own picture and blurb, and
 * optionally its own manufacturer and cost. Selecting one does NOT rewrite the
 * item — `system.selectedStyle` is the only stored state, and
 * CyberBlueItem#prepareDerivedData resolves img/manufacturer/cost from it. The
 * item's `_source` therefore always holds the true Default values.
 *
 * The "Default" style is implicit: `selectedStyle === ''` means Default, whose
 * picture, manufacturer and cost ARE the item's own. It is never stored in the
 * array, so there is nothing to keep in sync and nothing to migrate.
 */
export function buildStyleField() {
  const fields = foundry.data.fields;

  return new fields.SchemaField({
    id: new fields.StringField({
      required: true,
      blank: false,
      initial: () => foundry.utils.randomID(),
    }),
    name: new fields.StringField({ required: true, blank: true, initial: '' }),
    // Blank falls back to the item's own picture when displayed.
    img: new fields.FilePathField({ categories: ['IMAGE'], blank: true, initial: '' }),
    description: new fields.HTMLField({ initial: '' }),
    // Blank means "no override" — the item's own value stands.
    manufacturer: new fields.StringField({ required: true, blank: true, initial: '' }),
    cost: new fields.StringField({ required: true, blank: true, initial: '' }),
    // Adds to `system.skills.style.bonus` via an AE while the item is in use.
    // GM-only field; players never see it.
    bonus: new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
  });
}

/**
 * Resolve the style currently selected on an item's system data.
 * Returns null for Default (the empty selection) or a dangling selection.
 *
 * @param {object} system  An item's system data (live or raw source).
 * @returns {object|null}
 */
export function getSelectedStyle(system) {
  const selected = system?.selectedStyle;
  if (!selected) return null;
  const styles = system?.styles ?? [];
  return styles.find((style) => style?.id === selected) ?? null;
}

/**
 * Rebuild a complete flat dot-path update for `system.styles` from a partially
 * submitted form.
 *
 * Foundry's ArrayField._cleanElement forces `partial: false`, so any style field
 * missing from the submitted data is reset to its schema `initial`. A
 * ProseMirror save submits only `system.styles.N.description`, which would
 * otherwise wipe that style's name, cost and bonus — and a player's form never
 * contains the GM-only bonus field at all.
 *
 * Seeding every style from source and emitting EVERY field of EVERY style means
 * nothing is left undefined, so clean() preserves the lot.
 *
 * @param {object[]} rawStyles  `_source.system.styles` — raw, not derived.
 * @param {object}   formObj    `formData.object`, flat dot-path keys.
 * @returns {object|null}       Flat update keys, or null when no style field was submitted.
 */
export function buildStylesSubmitData(rawStyles, formObj) {
  if (!Array.isArray(rawStyles)) return null;

  const submitted = {};
  const styleFieldRegex = /^system\.styles\.(\d+)\.(.+)$/;
  for (const [key, value] of Object.entries(formObj ?? {})) {
    const match = key.match(styleFieldRegex);
    if (!match) continue;
    (submitted[match[1]] ??= {})[match[2]] = value;
  }

  if (!Object.keys(submitted).length) return null;

  const update = {};
  rawStyles.forEach((style, index) => {
    const merged = { ...style, ...(submitted[String(index)] ?? {}) };
    for (const [field, value] of Object.entries(merged)) {
      update[`system.styles.${index}.${field}`] = value;
    }
  });
  return update;
}
