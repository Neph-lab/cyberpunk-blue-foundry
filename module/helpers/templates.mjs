/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Item partials
    'systems/cyberpunk-blue/templates/item/parts/item-effects.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-combat.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-mods.hbs',
  ]);
};
