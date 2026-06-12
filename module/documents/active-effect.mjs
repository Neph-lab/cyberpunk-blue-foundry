/**
 * CyberBlueActiveEffect — custom ActiveEffect subclass for Cyberpunk BLUE.
 *
 * Extends the standard Foundry ActiveEffect with system-specific behaviours:
 *
 *   One-use AEs (flags.cyberpunk-blue.oneUse: true)
 *     The AE applies its changes normally during data preparation.  After the
 *     next roll that reads prepared actor data (i.e. the end of rollSkill on
 *     the parent actor), the AE deletes itself.  Use this for temporary
 *     single-roll bonuses such as the Guide Tarot "The Magician" card (+1 to
 *     the next roll).
 *
 *   Registration
 *     Set CONFIG.ActiveEffect.documentClass = CyberBlueActiveEffect in the
 *     'init' hook so Foundry uses this class for all ActiveEffect documents.
 */
export class CyberBlueActiveEffect extends ActiveEffect {
  /** Flag key that marks an AE as self-deleting after the next roll. */
  static ONE_USE_FLAG = 'oneUse';

  /**
   * Item images that are placeholders rather than "a defined picture of its
   * own", so they should NOT be borrowed as an effect icon.
   */
  static PLACEHOLDER_IMAGES = new Set([
    'icons/svg/item-bag.svg',   // Foundry default Item image
    'icons/svg/mystery-man.svg',
  ]);

  prepareDerivedData() {
    super.prepareDerivedData();
    this._applyParentItemImage();
  }

  /**
   * When this effect belongs to an Item that has a picture of its own (cyberware,
   * gear, a drug, …), display the item's image as the effect's icon — including
   * art added later (e.g. via the wire-images skill), since this re-derives on
   * every data prep and reads the item's *current* image.
   *
   * Derived only — never written to `_source`, so:
   *   • effects copied via `toObject()` (e.g. attack-applied afflictions) keep
   *     their authored icon;
   *   • the stored icon is preserved if the item image is later cleared.
   *
   * Deliberately untouched (per docs/icon-placement.md):
   *   • Conditions / wound-state effects and any other actor-owned effect — its
   *     parent is an Actor, not an Item, so the guard below skips it.
   *   • Affliction source templates — these are applied to a target by an attack
   *     (someone else's effect), so they keep their authored icon.
   */
  _applyParentItemImage() {
    const item = this.parent;
    if (!(item instanceof Item)) return;
    if (this.getFlag('cyberpunk-blue', 'isAfflictionEffect')) return;

    const img = item.img;
    if (!img || CyberBlueActiveEffect.PLACEHOLDER_IMAGES.has(img)) return;

    this.img = img;
  }
}
