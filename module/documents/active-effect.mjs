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
}
