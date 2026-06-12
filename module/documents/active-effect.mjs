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

  /**
   * True when this effect should borrow its parent Item's picture as its own
   * icon: it belongs to an Item that has a real image (not a placeholder), and
   * it is not an affliction source template (those are applied to targets by an
   * attack and keep their authored icon). Conditions and other actor-owned
   * effects have an Actor parent and are excluded automatically.
   *
   * @returns {string|null} the image to use, or null to leave the icon as-is.
   */
  getInheritedItemImage() {
    const item = this.parent;
    if (!(item instanceof Item)) return null;
    if (this.getFlag('cyberpunk-blue', 'isAfflictionEffect')) return null;
    const img = item.img;
    if (!img || CyberBlueActiveEffect.PLACEHOLDER_IMAGES.has(img)) return null;
    return img;
  }

  /**
   * Persist the parent Item's picture onto the effect document itself on
   * creation, so every consumer (Effects panel, token HUD, the effect's own
   * config sheet, exports) reads the same stored image. Item-image *changes*
   * after creation are propagated by CyberBlueItem (see syncEffectImages).
   * Compendium effects are baked by the catalogue sync while the pack is
   * unlocked, so this skips them.
   */
  async _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    if (game.user.id !== userId) return;
    if (this.parent?.pack) return;
    const img = this.getInheritedItemImage();
    if (img && this._source.img !== img) {
      await this.update({ img });
    }
  }
}
