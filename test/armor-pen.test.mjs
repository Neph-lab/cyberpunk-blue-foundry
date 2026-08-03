/**
 * Unit tests for module/helpers/armor-pen.mjs.
 * Run with:  node --test test/
 *
 * The point of these tests is the invariant, not the arithmetic: whatever the
 * resolver shows as net damage must be the HP the target actually loses. So each
 * case walks both halves of the pipeline — the resolver's `sp` and the HP loss
 * `Actor#applyDamage` would compute from the target's REAL sp — and asserts they
 * agree. Before the armorPen fix, the four single-shot SP effects all failed this.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveEffectiveSp, armorPenFor, BURNING_EDGE_SP_LIMIT } from '../module/helpers/armor-pen.mjs';

/** What Actor#applyDamage does with (amount, { armorPen }) against a real SP. */
const applyDamageHpLoss = (amount, realSP, armorPen) =>
  Math.max(amount - Math.max(realSP - armorPen, 0), 0);

/**
 * Roll the whole contract for one hit: resolver net damage vs. actual HP loss.
 * Returns both so a failure shows the size of the skew.
 */
function pipeline(realSP, finalDamage, opts) {
  const { sp, armorPen } = resolveEffectiveSp({ rawSP: realSP, ...opts });
  return {
    sp,
    armorPen,
    shown: Math.max(finalDamage - sp, 0),
    actual: applyDamageHpLoss(finalDamage, realSP, armorPen),
  };
}

test('plain hit: no SP effects, nothing is ignored', () => {
  const r = pipeline(11, 20, {});
  assert.equal(r.sp, 11);
  assert.equal(r.armorPen, 0);
  assert.equal(r.shown, 9);
  assert.equal(r.actual, 9);
});

test('charged Tech Weapon halves SP and the HP loss follows', () => {
  const r = pipeline(11, 20, { charged: true });
  assert.equal(r.sp, 5);        // floor(11 / 2)
  assert.equal(r.armorPen, 6);
  assert.equal(r.shown, 15);
  assert.equal(r.actual, 15);   // was 9 before the fix
});

test('Burning Edge zeroes SP below the limit and leaves it alone at or above', () => {
  const under = pipeline(7, 12, { burningEdge: true });
  assert.equal(under.sp, 0);
  assert.equal(under.armorPen, 7);
  assert.equal(under.shown, 12);
  assert.equal(under.actual, 12);  // was 5 before the fix

  const over = pipeline(BURNING_EDGE_SP_LIMIT, 12, { burningEdge: true });
  assert.equal(over.sp, BURNING_EDGE_SP_LIMIT);
  assert.equal(over.armorPen, 0);
  assert.equal(over.shown, over.actual);
});

test('halveSP rounds up and the HP loss follows', () => {
  const r = pipeline(7, 10, { halveSP: true });
  assert.equal(r.sp, 4);        // ceil(7 / 2)
  assert.equal(r.armorPen, 3);
  assert.equal(r.shown, 6);
  assert.equal(r.actual, 6);    // was 3 before the fix
});

test('Spot Weakness bypasses SP entirely', () => {
  const r = pipeline(11, 15, { spBypass: true });
  assert.equal(r.sp, 0);
  assert.equal(r.armorPen, 11);
  assert.equal(r.shown, 15);
  assert.equal(r.actual, 15);   // was 4 before the fix
});

test('Spot Weakness wins over Burning Edge and halveSP', () => {
  const r = resolveEffectiveSp({ rawSP: 20, spBypass: true, burningEdge: true, halveSP: true });
  assert.equal(r.sp, 0);
  assert.equal(r.armorPen, 20);
});

test('Armor-Piercing ammo still reduces SP by its flat amount', () => {
  const r = pipeline(11, 20, { spReduction: 2 });
  assert.equal(r.sp, 9);
  assert.equal(r.armorPen, 2);
  assert.equal(r.shown, 11);
  assert.equal(r.actual, 11);
});

test('AP against SP below the reduction clamps at zero, not negative', () => {
  const r = pipeline(1, 8, { spReduction: 2 });
  assert.equal(r.sp, 0);
  assert.equal(r.armorPen, 1);  // the whole real SP, not the nominal 2
  assert.equal(r.shown, 8);
  assert.equal(r.actual, 8);
});

test('effects stack in order: halveSP then charge then AP', () => {
  // 9 → ceil(9/2)=5 → floor(5/2)=2 → 2-2=0
  const r = pipeline(9, 14, { halveSP: true, charged: true, spReduction: 2 });
  assert.equal(r.sp, 0);
  assert.equal(r.armorPen, 9);
  assert.equal(r.shown, 14);
  assert.equal(r.actual, 14);
});

test('no target: sp stays null and armorPen is zero', () => {
  const r = resolveEffectiveSp({ rawSP: null, charged: true, spReduction: 2 });
  assert.equal(r.sp, null);
  assert.equal(r.armorPen, 0);
});

test('armorPenFor is the real-vs-effective gap, floored at zero', () => {
  assert.equal(armorPenFor(11, 5), 6);
  assert.equal(armorPenFor(4, 4), 0);
  assert.equal(armorPenFor(3, 7), 0);   // never negative
  assert.equal(armorPenFor(null, 5), 0);
  assert.equal(armorPenFor(5, null), 0);
});

test('non-lethal cap lands the target on exactly 1 HP', () => {
  // Charged TW vs SP 11, target on 8 HP, a 30-damage blow capped by nonLethal.
  const realSP = 11;
  const targetHp = 8;
  const { sp, armorPen } = resolveEffectiveSp({ rawSP: realSP, charged: true });
  const effectiveFinalDamage = Math.max(0, (targetHp - 1) + sp);
  assert.equal(targetHp - applyDamageHpLoss(effectiveFinalDamage, realSP, armorPen), 1);
});

test('barrier penetration bonus arrives on top of the through-SP damage', () => {
  // Charged TW vs SP 11, 20 damage, 3 dice showing 5+ → 3 points bypass SP.
  const realSP = 11;
  const finalDamage = 20;
  const barrierPenBonus = 3;
  const { sp, armorPen } = resolveEffectiveSp({ rawSP: realSP, charged: true });
  const barrierPenFinalDamage = sp + Math.max(finalDamage - sp, 0) + barrierPenBonus;
  const netDamage = Math.max(finalDamage - sp, 0);
  assert.equal(applyDamageHpLoss(barrierPenFinalDamage, realSP, armorPen), netDamage + barrierPenBonus);
});

/** Mirrors effectiveSP() in helpers/martial-arts.mjs. */
const martialArtsSP = (rawSP, mode) =>
  mode === 'half' ? Math.ceil(rawSP / 2) : mode === 'quarter' ? Math.ceil(rawSP / 4) : rawSP;

test('martial arts half / quarter SP modes keep the contract', () => {
  for (const [realSP, mode, finalDamage] of [[7, 'half', 10], [11, 'quarter', 14], [9, 'normal', 12]]) {
    const sp = martialArtsSP(realSP, mode);
    const armorPen = armorPenFor(realSP, sp);
    assert.equal(
      applyDamageHpLoss(finalDamage, realSP, armorPen),
      Math.max(finalDamage - sp, 0),
      `${mode} SP ${realSP}`,
    );
  }
});

test('Throw ignores half the target SP, rounded up', () => {
  // BODY 8 thrown into SP 7 armor: effective SP 4, so 4 HP comes off.
  const realSP = 7;
  const body = 8;
  const sp = martialArtsSP(realSP, 'half');
  const armorPen = armorPenFor(realSP, sp);
  assert.equal(sp, 4);
  assert.equal(armorPen, 3);
  assert.equal(applyDamageHpLoss(body, realSP, armorPen), 4);
  assert.equal(applyDamageHpLoss(body, realSP, armorPen), Math.max(body - sp, 0));
});

test('Choke ignores armor outright — the full BODY value lands', () => {
  // ignoreArmor short-circuits SP entirely, so armorPen is irrelevant.
  const body = 8;
  for (const realSP of [0, 7, 20]) {
    assert.equal(applyDamageHpLoss(body, 0, 0), body, `SP ${realSP} must not matter`);
  }
});
