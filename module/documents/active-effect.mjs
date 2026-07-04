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
/** PSYCHE-state flag id → description i18n key. */
const PSYCHE_STATE_DESC_KEYS = Object.freeze({
  'disassociation': 'CYBER_BLUE.PsycheState.DisassociationDesc',
  'disrupted-mind': 'CYBER_BLUE.PsycheState.DisruptedMindDesc',
  'beginning-cyberpsychosis': 'CYBER_BLUE.PsycheState.BeginningCyberpsychosisDesc',
  'full-cyberpsychosis': 'CYBER_BLUE.PsycheState.FullCyberpsychosisDesc',
});

/** cyberpunk-blue flag (truthy) → description i18n key, for flat system effects. */
const AUTO_EFFECT_DESC_KEYS = Object.freeze({
  autoSeriousWound: 'CYBER_BLUE.Effect.SeriouslyWoundedDesc',
  autoMortallyWounded: 'CYBER_BLUE.Effect.MortallyWoundedDesc',
  dead: 'CYBER_BLUE.Effect.DeadDesc',
  needsStabilization: 'CYBER_BLUE.Effect.NeedsStabilizationDesc',
  autoPsycheLoss: 'CYBER_BLUE.Effect.PsycheLossDesc',
});

// Icons for system effects. White (wt_) copies of the sheet icons are used
// because the effect image renders as a raw <img> on the dark UI and can't be
// recoloured with the Pattern-A CSS mask (see docs/icon-placement.md).
const PSYCHE_STATE_ICON = 'systems/cyberpunk-blue/assets/icons/wt_PSYCHE.svg';
const AUTO_EFFECT_ICONS = Object.freeze({
  autoSeriousWound: 'systems/cyberpunk-blue/assets/icons/wt_SWT.svg',
  autoMortallyWounded: 'systems/cyberpunk-blue/assets/icons/wt_SWT.svg',
  dead: 'systems/cyberpunk-blue/assets/icons/wt_Death_Save.svg',
  needsStabilization: 'icons/svg/blood.svg',
});

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
   * Resolve the descriptive text a system-generated effect should carry in its
   * `description` field, from its `cyberpunk-blue` flags. Returns localized HTML
   * (or null when the effect has no known auto-description). Sources:
   *   • Critical injuries — the `descKey` already stored on the effect.
   *   • PSYCHE states — per-state paragraph + the shared symptom list.
   *   • Wound/death/stabilization/PSYCHE-loss markers — fixed description keys.
   */
  static resolveAutoDescription(effect) {
    const cb = effect?.flags?.['cyberpunk-blue'] ?? {};

    if (cb.criticalInjury?.descKey) {
      return game.i18n.localize(cb.criticalInjury.descKey);
    }

    const psycheKey = cb.psycheState?.id ? PSYCHE_STATE_DESC_KEYS[cb.psycheState.id] : null;
    if (psycheKey) {
      const paragraph = game.i18n.localize(psycheKey);
      const label = game.i18n.localize('CYBER_BLUE.PsycheState.SymptomsLabel');
      const symptoms = game.i18n.localize('CYBER_BLUE.PsycheState.SymptomsHtml');
      return `<p>${paragraph}</p><p><strong>${label}</strong></p>${symptoms}`;
    }

    for (const [flag, key] of Object.entries(AUTO_EFFECT_DESC_KEYS)) {
      const value = cb[flag];
      if (value !== undefined && value !== null && value !== false) {
        return game.i18n.localize(key);
      }
    }

    return null;
  }

  /**
   * Resolve the icon a system effect should use, from its `cyberpunk-blue` flags
   * (white sheet-icon copies). Returns null for effects with no mapped icon, so
   * their existing image is left alone.
   */
  static resolveAutoIcon(effect) {
    const cb = effect?.flags?.['cyberpunk-blue'] ?? {};
    if (cb.psycheState?.id) return PSYCHE_STATE_ICON;
    for (const [flag, icon] of Object.entries(AUTO_EFFECT_ICONS)) {
      const value = cb[flag];
      if (value !== undefined && value !== null && value !== false) return icon;
    }
    return null;
  }

  /**
   * Stamp the system description onto the effect at creation, so it lives in the
   * document's own `description` field (visible in the effect's config sheet and
   * anywhere descriptions are shown). Only fills an empty description, so an
   * item- or hand-authored description is never overwritten. Applies to every
   * creation site that carries the relevant flag — no per-call wiring needed.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    if (!this.description) {
      const description = CyberBlueActiveEffect.resolveAutoDescription(this);
      if (description) this.updateSource({ description });
    }

    // System effects set a deprecated `icon:` that v14 ignores (defaulting to
    // aura.svg); stamp the correct white sheet-icon onto `img` instead.
    const icon = CyberBlueActiveEffect.resolveAutoIcon(this);
    if (icon && this.img !== icon) this.updateSource({ img: icon });

    return allowed;
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
