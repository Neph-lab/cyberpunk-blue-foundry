/**
 * Style catalogue — cosmetic variants seeded onto compendium Gear and Cyberware.
 *
 * DO NOT hand-edit the STYLES table below. It is generated from the authoring
 * folders by the `/wire-styles` skill:
 *
 *     assets/items/styles/<gear|cyberware>/<item-slug>/
 *       styles.json     ← name, description, manufacturer, cost, bonus per style
 *       <style>.png     ← one image per style
 *
 * Entries are keyed by the item's exact catalogue `name:`. `stylesFor(name)` is
 * called by the gear() and cw() builders, and the compendium sync in
 * cyberpunk-blue.mjs pushes drift onto already-seeded items.
 *
 * Style `id`s are DETERMINISTIC slugs of the style name, never randomID(). A
 * random id would differ on every world boot, so the sync would rewrite the
 * array forever and every player's selection would be orphaned each reload.
 */

const A_STYLES = 'systems/cyberpunk-blue/assets/items/styles';

const COST = {
  CH:  '€$10 (Cheap)',
  EV:  '€$20 (Everyday)',
  CO:  '€$50 (Costly)',
  PR:  '€$100 (Premium)',
  EX:  '€$500 (Expensive)',
  VEX: '€$1,000 (Very Expensive)',
  LUX: '€$5,000 (Luxury)',
  SLX: '€$10,000 (Super Luxury)',
};

const h = (text) => /^\s*<(p|ul|ol|div|h\d|table)\b/i.test(text) ? text : `<p>${text}</p>`;

/** Deterministic, human-readable style id. Unique within one item, which is all that matters. */
export function styleId(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'style';
}

/**
 * Build one style entry. `folder` is the `<gear|cyberware>/<item-slug>` path
 * under assets/items/styles; `img` is the bare filename inside it.
 */
function style({ name, folder, img = '', description = '', manufacturer = '', cost = '', bonus = 0 }) {
  return {
    id: styleId(name),
    name,
    img: img ? `${A_STYLES}/${folder}/${img}` : '',
    description: description ? h(description) : '',
    manufacturer,
    cost: cost ? (COST[cost] ?? cost) : '',
    bonus,
  };
}

/**
 * name → style[]  (the item's own look is the implicit Default and is never listed).
 *
 * ── GENERATED BLOCK START ──
 */
const STYLES = {
};
/* ── GENERATED BLOCK END ── */

/** Styles for one catalogue item, or an empty array. */
export function stylesFor(name) {
  return STYLES[name] ?? [];
}

export const STYLE_CATALOGUE = STYLES;
export { style as buildCatalogueStyle };
