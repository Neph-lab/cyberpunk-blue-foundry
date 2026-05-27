/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Character Creation
    'systems/cyberpunk-blue/templates/character-creation/wizard.hbs',
    // Apps
    'systems/cyberpunk-blue/templates/apps/vehicle-hud.hbs',
    // Dialogs
    'systems/cyberpunk-blue/templates/dialogs/vehicle-maneuver-picker.hbs',
    // Item partials
    'systems/cyberpunk-blue/templates/item/parts/item-effects.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-combat.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-mods.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-ammo.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-program-executable.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-mod.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-mods-tab.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-instructions.hbs',
    'systems/cyberpunk-blue/templates/item/parts/item-drug-details.hbs',
  ]);
};
