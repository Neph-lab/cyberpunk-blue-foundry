/**
 * The single place that decides how much of a target's SP an attack ignores.
 *
 * Two subsystems subtract SP for the same hit: the resolver (for the pierce
 * check, the net damage on the chat card and crit gating) and `Actor#applyDamage`
 * (for the HP that actually comes off). `applyDamage` only ever sees the target's
 * REAL SP, reduced by the `armorPen` option — so any effect that lowers the
 * resolver's effective SP has to be handed to `applyDamage` as `armorPen` too, or
 * the card and the sheet disagree.
 *
 * Keeping both numbers in one function is what makes that impossible to forget:
 * `armorPen` is *derived* from the gap, not maintained alongside it.
 *
 * Pure module — no Foundry globals, so it is unit-testable (see test/armor-pen.test.mjs).
 */

/** SP at or above which Burning Edge stops ignoring armor entirely. */
export const BURNING_EDGE_SP_LIMIT = 11;

/**
 * The `armorPen` that makes `applyDamage` deduct exactly `sp`.
 *
 * `applyDamage` computes `effSp = max(realSP - armorPen, 0)`, so handing it the
 * whole real-vs-effective gap makes `effSp === sp`.
 *
 * @param {number|null} rawSP  the target's real SP (null when there is no target)
 * @param {number|null} sp     the effective SP the resolver used
 * @returns {number} armorPen, never negative
 */
export function armorPenFor(rawSP, sp) {
  if (rawSP === null || sp === null) return 0;
  return Math.max(0, rawSP - sp);
}

/**
 * Resolve the effective SP for a weapon hit, plus the matching `armorPen`.
 *
 * Applied in order — each stage feeds the next:
 *   1. `spBypass`    Solo Spot Weakness / Ninja Weak-Spot — SP treated as 0.
 *   2. `burningEdge` Mono-Three — SP treated as 0 while the real SP is < 11.
 *   3. `halveSP`     Kendachi Shi Bayonet — SP rounded up to half.
 *   4. `charged`     Charged Tech Weapon — SP rounded down to half.
 *   5. `spReduction` Armor-Piercing ammo — SP reduced by a flat amount.
 *
 * @param {object}       opts
 * @param {number|null}  opts.rawSP        the target's real SP, or null for no target
 * @param {boolean}     [opts.spBypass]
 * @param {boolean}     [opts.burningEdge]
 * @param {boolean}     [opts.halveSP]
 * @param {boolean}     [opts.charged]
 * @param {number}      [opts.spReduction]
 * @returns {{sp: number|null, armorPen: number}}
 */
export function resolveEffectiveSp({
  rawSP,
  spBypass = false,
  burningEdge = false,
  halveSP = false,
  charged = false,
  spReduction = 0,
} = {}) {
  const afterBypass = spBypass ? 0
    : (rawSP !== null && burningEdge && rawSP < BURNING_EDGE_SP_LIMIT ? 0 : rawSP);
  const afterHalve = (!spBypass && afterBypass !== null && halveSP)
    ? Math.ceil(afterBypass / 2)
    : afterBypass;
  const beforeAP = afterHalve !== null
    ? (charged ? Math.floor(afterHalve / 2) : afterHalve)
    : null;
  const sp = (beforeAP !== null && spReduction > 0)
    ? Math.max(0, beforeAP - spReduction)
    : beforeAP;

  return { sp, armorPen: armorPenFor(rawSP, sp) };
}
