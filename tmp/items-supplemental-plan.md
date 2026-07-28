# Implementation plan — items-supplemental.md

Status key: 🟢 data-only (reuses existing flags) · 🟡 small new mechanic · 🔴 engine/UI work · ⚪ GM-handled / narrative · ❌ remove

This plan maps every spec item onto existing code and sequences the work so shared
foundations land before the items that depend on them.

---

## What already exists (verified in code)

| Capability | Where | Reused by |
|---|---|---|
| Affliction attack (`affliction` / `affliction-cone` / `affliction-explosion`); `afflictionEffectId` = disabled AE on item copied to target on failed save; `outerZoneResistBonus` for the "+N outside inner radius" | weapon-schema.mjs:194, affliction-attack.mjs, cone-attack.mjs | Microwaver, Toxic ammo, EMP/Incendiary grenades |
| Disable N random installed cyberware via AE change `cyberblue.disableCyberware.random` = N | cyberware-disable.mjs | Microwaver, EMP grenade, Inazuma |
| Cone/explosion geometry: `coneSpread` / `coneAngle` / `coneHalfDamageDistance`; residue clouds (`leavesResidue`…) | weapon-schema.mjs, cone-attack.mjs | Onibi, Delaware, grenades |
| Jam: `jamOnRoll` / `jamFiresFirst` | weapon-schema.mjs:79, combat-resolution.mjs | Slaught-O-Matic |
| Armor-Piercing (ablate 2) | weapon flag `armorPiercing`, combat-resolution.mjs:916 | AP ammo (needs projection) |
| Attack-die = 10 detection | `autoFireOn10` precedent, combat-resolution | Vibro-Stun |
| Charge button (per-weapon toggle + state flags + "no move before/after") | template actor-sheet.hbs:279 → actor-sheet.mjs:1266 → `toggleWeaponCharge` (weapon-actions.mjs:154); flags `charged-{i}` etc.; MOVE AE via tech-charge.mjs | Activation-button mods |
| Mod weapon synthesis: `weaponChanges` + injected synthetic weapon modes (bayonet) | mods.mjs `getEffectiveItemWeapons` | Skachok, Inazuma, Delaware |
| Critical-injury roll with a `weaponFlags` channel | `rollCriticalInjury(target, table, {attackerActor, weaponFlags})` critical-injury.mjs:607; Foreign Object = table key `foreign-object` | Permanent Edge, Hollow-Point |
| Conditions: `stunned`, `unconscious`, graded `burning-embers`/`-fire`/`-deadly` | CONFIG.statusEffects cyberpunk-blue.mjs:426 | Vibro-Stun, Rubber, Incendiary, Thermal Advantage |
| Ammo loading + `attackBonus`/`smartWeaponOnly`/`smartMissReroll` read at resolve time | ammo-catalogue.mjs, combat-resolution.mjs `getLoadedAmmoItem`/`loadedAmmoData` | Ammo subsystem base |

**Does NOT yet exist (must be built):**
- General **non-lethal** cap (critStun at combat-resolution.mjs:945 is close but bounded to −10 and does not apply the Unconscious status).
- **Ammo → attack projection** beyond attackBonus/smart (no way for ammo to change SP ablation, replace damage with an affliction, add crit behaviour, or carry a grenade payload).
- **Generalized mod-activation toggle** button (only Charge exists; four mods need an analogous per-weapon activate/deactivate).
- A per-weapon **`noReload`/single-use** flag (Slaught-O-Matic hides the reload button).

---

## Phase 0 — Foundations (build first; everything else leans on these)

### 0.1 Non-lethal cap 🔴  (spec line 1)
Generalize the `critStun` block (combat-resolution.mjs:945) into a reusable path driven by a
`nonLethal` boolean readable on the resolved weapon (and projectable from ammo):
when `netDamage > 0` and it would bring target HP ≤ 0, cap so HP lands at **1** and apply the
`unconscious` status (reuse the `toggleStatusEffect('unconscious', …)` pattern from
martial-arts.mjs / critical-injury-macros.mjs). Consumers: Rubber ammo, Skachok, Rostović stun.
**Decision needed** — see Q "Non-lethal & critStun".

### 0.2 Ammo → attack projection layer 🔴
Extend the ammo schema with an override/payload block, and merge it onto the resolved `weapon`
object in combat-resolution immediately after `getLoadedAmmoItem`. New ammo fields (superset):
`armorPiercing`, `nonLethal`, `noAblate` (Rubber), `damageOverride`, `damageType` + affliction
fields (Toxic, grenade payloads), an effect/`afflictionEffectId` payload, `critRerollForeignObject`
(Hollow-Point), and a `nonTechOnly` gate. Precedence rule: ammo fields override the weapon's own
where both are set. This backs every special ammo and grenade-as-ammo.
**Decision needed** — see Q "Ammo scope".

### 0.3 Generalized mod-activation toggle 🔴
Data-driven per-weapon toggle mirroring Charge: a mod declares an "activatable" capability
(id, button label/icon, optional self-AE, optional per-turn no-move restriction). The sheet
renders a toggle next to the Charge button when such a mod is installed on that weapon;
toggling flips an item flag (`modActive-{modId}-{weaponIndex}`) and applies/removes any self-AE;
combat-resolution reads the active state. Powers Thermal Advantage, Riptide, Bipod, Vibro-Stun.
**Decision needed** — see Q "Activation buttons".

---

## Phase 1 — Data-only & light items (reuse existing flags)

| Item | Type | Approach |
|---|---|---|
| Eagletech Fletcher (crossbow) | 🟢 weapon | bow/crossbow defaults (mirror existing "Bow") |
| Militech Grenade Launcher | 🟢 weapon | grenadeLauncher defaults |
| Militech Rocket Launcher | 🟢 weapon | rocketLauncher defaults (mirror Dojigiri sans homing) |
| Budget Arms Slaught-O-Matic | 🟡 weapon | SMG 2d6, autofire ×3, `jamOnRoll:1`, **new** `noReload` flag (single-use) |
| Zetatech Microwaver-55 | 🟡 weapon | VHP `affliction` DV15 TECH+Endurance; item AE with cyberware-disable `random:2`; battery ammo |
| Onibi Plasma Caster | 🟡 weapon | flamethrower cone 2d6 spread6 half4; **new** post-attack 1d10 → on 9–10 self+cone 2d6 that bypasses SP |
| The Snitcher (BD) | 🟢 gear | pure data; manufacturer "Fourth Wall" |
| Arasaka SPU Tsubasa | ⚪ mod | data only (GM-handled), smart-weapon restriction |
| Federated Arms Sling | ⚪ mod | data only (GM-handled), any-gear restriction |
| Arasaka Inazuma | 🟡 mod | melee-only; **+1 per damage die** (needs per-die bonus flag, not a flat weaponChange) |
| Constitutional Arms Delaware | 🟡 mod | shotgun-cone only; halve `coneAngle`, +3 attack, +1d6 damage for that shell attack |

---

## Phase 2 — Ammo subsystem (depends on 0.2)

Rules from spec: grenades/rockets Ammo qty 1, all other ammo qty 10. Grenades exist as **both**
a thrown Gear item (mirror Knock-Out Grenade, equipment-catalogue.mjs) **and** an Ammo item whose
payload replaces the grenade launcher's damage/affliction/effect.

| Item | Type | Approach |
|---|---|---|
| Armor-Piercing | 🟡 ammo | projects `armorPiercing`; per weapon type; non-Tech only; PR |
| Hollow-Point | 🔴 ammo | on Foreign-Object crit, roll one extra crit result (skip another Foreign Object) via `weaponFlags`/crit channel; non-Tech; PR |
| Rubber | 🟡 ammo | `noAblate` + `nonLethal` (Phase 0.1); non-Tech; PR |
| Toxic | 🟡 ammo | damage only checks SP penetration; on penetration → DV15 Endurance, 3d6 direct HP (½ on success), no crit; non-Tech; PR |
| Toxic-shotgun-shells | 🟡 ammo | as Toxic but DV **12** |
| EMP-Grenade | 🟡 gear + ammo | affliction-explosion spread8 half4 DV15 TECH+Endurance (+2 outside inner); item AE cyberware-disable `random:2`, 1-minute copy; Zetatech, EX |
| Incendiary-Grenade | 🟡 gear + ammo | affliction-explosion 6d6 spread10 half6; applies `burning-embers` to anyone taking HP dmg (unless already burning); Militech, PR |
| Rockets | 🟢 | = existing Basic Rocket (dedupe reference) |
| Full-Metal-Jacket | ❌ | remove (redundant with basic ammo) |
| Shotgun Slug Hollow-point | ❌ | remove references (not a thing) |

Matrix note: "each of AR, SMG, Heavy SMG, each pistol, shotgun slug." The ammo schema's `smg`
type already covers **both** SMG and Heavy SMG (see Basic SMG Ammo note), so AP/Hollow/Rubber/Toxic
each need: mediumPistol, heavyPistol, veryHeavyPistol, smg, assault, shotgunSlug = **6 items × 4 = 24**.
**Decision needed** — see Q "Ammo scope".

---

## Phase 3 — Bespoke mod mechanics (depend on 0.1 / 0.3 / crit channel)

| Item | Type | Approach |
|---|---|---|
| Arasaka Thermal Advantage | 🔴 mod | activation toggle (0.3); on active + ≥2 HP dmg → apply `burning-embers` for 1d6 rounds |
| Budget Arms Riptide | 🔴 mod | activation toggle (0.3); while active +1d6 dmg + ablate 2 |
| Militech CS-63 Bipod | 🔴 mod | activation toggle (0.3) with charge-style no-move-before/after; +1 attack that turn |
| Militech Vibro-Stun | 🔴 mod | activation toggle (0.3); attack die = 10 & HP dmg > 0 → target `stunned` to end of next turn; self −1 Melee AE (persists 1 turn past deactivation) |
| Kendachi Permanent Edge | 🔴 mod | intercept crit roll → roll 3d6, post dice to chat, GM picks any 2; keep crit bonus damage; via `weaponFlags` |
| Large fuel tank | 🟡 mod | double flamethrower `magazine`; AE MOVE −1 when `ammoCurrent` > 10 + BODY |
| Rostović Skachok | 🟡 mod | inject synthetic Medium/Heavy Melee mode (per description), ignore ½ SP, non-lethal (0.1); only when charged |
| Rostović Smart-targeting | 🟡 mod | post-hit AE lasting 1 turn granting +1 attack (weapon or its skill); refresh duration if present; clear at end of turn / out of combat |
| EBM IR-Flashlight | ⚪→🔴 gear | **convert from mod to Gear**; IR light. Narrative-only unless cheap; otherwise desaturation overlay via infrared.mjs / visibility.mjs |
| Techtronika SR-2 Seshcha | ❌ mod | remove (idea fell through) |

---

## Phase 4 — Clothing reorg 🔴

Spec: the Outfit folder should gain **subfolders per clothing type** (Jackets, Tops, …) and three
new categories: **Full body, Dresses, Skirts**. Current `clothing()` puts everything in the flat
`_folder: 'Outfit'`; the pack seeder uses a single-level `_folder`.
**Decision needed** — see Q "Clothing folders" (nested folders? new items or just structure?).

---

## Corrections applied along the way

- Filename `meomilitarism-…` → `neomilitarism-…` (done).
- Descriptions rewritten cleanly (spec typos: "helt"→"melt", "the sam Jam"→"same", "aa second"→"a
  second", Smart-targeting "1 Turns"→"1 turn", "at which out"→"at which point").
- Removals: Full-Metal-Jacket, Shotgun Slug Hollow-point references, Techtronika SR-2 Seshcha.
- Re-adds of previously-excluded weapons (Onibi, Slaught-O-Matic, Microwaver, Kendachi Permanent
  Edge): update the exclusion list in weapon-catalogue.mjs header **and** memory/weapon-cards-excluded.md.

---

## Progress (this batch — pushed to main)
- **Phase 0.1** ✅ non-lethal cap + critStun unification (commit fac2b06).
- **Phase 0.2** ✅ ammo-projection layer + Armor-Piercing wiring + nonTechOnly reload gate (fac2b06).
- **Phase 0.3** ⏸ deferred — its only consumers are Phase 3 mods; building now = untestable scaffolding.
- **Phase 1 (data-only)** ✅ Eagletech Fletcher, Militech Grenade/Rocket Launcher, The Snitcher,
  Federated Arms Sling, Arasaka SPU Tsubasa; manufacturers Eagletech + Fourth Wall (c94d24b).
- **Phase 1 (Slaught-O-Matic)** ✅ + new `noReload` weapon flag (9a5095f).
- **Phase 2 (AP slice)** ✅ Armor-Piercing ammo × 6 weapon types; removed 3 orphan images (c94d24b).
- **AP effective-SP−2** ✅ implemented via an `armorPen` option threaded through `actor.applyDamage`
  (mook/vehicle/character) + `applyDamageWithPermission` + socket; resolver reduces its own `sp`
  to match; autofire now projects ammo too.
- **Phase 1 remaining** ✅ all four done:
  - Zetatech Microwaver-55 — affliction, `damage:'0'` bypasses armor (checkAfflictionSP), item AE
    with `disableCyberware.random=2`.
  - Arasaka Onibi Plasma Caster — flamethrower cone + `selfConeMalfunction` (1d10 → 9–10 second cone
    hits attacker, bypasses SP via new `ignoreArmor` option, non-recursive).
  - Arasaka Inazuma — `damagePerDie` mod field (+1/die), folded into single-shot damage.
  - Constitutional Arms Delaware — `narrowConeShell`/`coneAttackBonus`/`coneDamageBonusDice` mod
    fields; cone resolver now reads installed mods (it didn't before).

**Phases 0–2 complete and LIVE-VERIFIED** on the test server (2026-07-28):
- AP: chat showed `SP: 6 → Damage: 2 (SP -2)` vs a real SP 8 target; `applyDamage(8, {armorPen:2})`;
  HP −2 and armour −2. Unit-checked `applyDamage` directly across 5 cases (mook w/ armor item).
- Non-lethal: 7 damage vs 3 HP capped to `amount:2` → HP exactly 1 + Unconscious status applied.
- Microwaver: item AE (`disableCyberware.random=2`, `isAfflictionEffect`) disabled exactly 2 of 3
  installed cyberware on the target.
- Onibi: cone resolved clean; forced a 10 on the toxicity check → malfunction fired, evasion rolled
  for the target AND the attacker, attacker HP 40→30, target took 10 through SP 11 (bypass ✓),
  single malfunction message (non-recursive ✓).
- Seeded data + all new lang keys verified in-world; Inazuma/Delaware/Slaught-O-Matic flags correct.

### Bug found by live testing (fixed, 45ab35b)
Heavy weapons used skill slug `heavyWeapons`, which does not exist — the real slug is `hvyWeapons`.
Every machine gun / rocket & grenade launcher / flamethrower threw `Unknown skill slug` on attack
(the resolver's fallback reads the item's own stored skill, same bad value). **Pre-existing**, hit 7
shipped weapons besides the 3 new ones. `_syncWeaponEntries` repairs seeded compendium entries on
the next GM login; actor-owned copies predating the fix must be re-added.

### AP "effective SP −2" — deeper than a flag (needs confirmation)
The resolver passes GROSS damage to `actor.applyDamage`, which re-subtracts the actor's REAL SP
using a barrier-pen-style compensation (combat-resolution.mjs:925) that assumes
`resolution SP == real SP`. So a resolution-only SP−2 changes the displayed net + pierce/crit gating
but NOT the actual HP lost. Delivering true SP−2 damage needs one of:
  (a) an `armorPen` option threaded through `actor.applyDamage` (mook / vehicle / character branches)
      + `applyDamageWithPermission` + the socket emit — the clean fix; or
  (b) routing AP's 2 points through the existing `barrierPenBonus` bypass (covers the damage but not
      the easier-pierce/ablation half).
AP currently ships as ablate-2 (correct, tested). The SP−2 upgrade is the first task once the
approach is confirmed. Note: this same split likely affects how charge/½-SP and Burning Edge reduce
*actual* HP — worth verifying in-world during review.

## Phase 3 & 4 — COMPLETE (ac97f38), live-verified
- **0.3 activation framework**: mods declare `activatable` (+ icon, `activationBlocksMove`,
  `activationSelfEffect`); state = flag `cyberpunk-blue.modActive` on the mod Item, surfaced by
  `getInstalledWeaponMods` as `_active`; sheet renders one toggle per mod beside Charge.
- **Mods on it**: Thermal Advantage (Burning 1d6 rnds on ≥2 HP), Riptide (+1d6, ablate 2),
  CS-63 Bipod (+1 attack, no-move), Vibro-Stun (die 10 + dmg → Stunned; −1 Melee self-AE).
- **Also**: Large Fuel Tank (magazine ×2 + activeGM MOVE−1 hook above 10+BODY fuel),
  Skachok (injected non-lethal ½-SP stun-baton mode), Smart-targeting (post-hit +1 AE, refreshes),
  Permanent Edge (3d6, GM picks two), IR-Flashlight moved mod→Clandestine Gear, Seshcha dropped.
- **Phase 4**: `_ensureFolderInPack` accepts nested paths; clothing filed per type; the empty
  Full body / Dresses / Skirts subfolders created; pre-existing flat clothing auto-relocated.

**Live verification** (test server, after reload): all 8 mods seeded with correct fields; 11 Outfit
subfolders present and **zero** clothing left in the flat folder; toggle flips `_active` both ways;
a Riptide-active Katana rolled `3d6 + 1d6` and ablated armour 11→9 (**−2**), chat `SP: 11 → Damage:
16 (SP -2)`. Note: the *Apply Damage confirm dialog* always prints "SP -1" — pre-existing cosmetic
quirk of that dialog only; the chat line and the real ablation are correct.

## Decisions (locked)
1. **Ammo scope** — one effect end-to-end first: build the projection layer (0.2) + **Armor-Piercing
   across all 6 weapon types**, verify in-world, then fan out Hollow-Point / Rubber / Toxic.
2. **Non-lethal** — one unified `nonLethal` path that caps HP at 1 **and applies Unconscious**;
   fold existing `critStun` (Stun Baton, Mámù) into it so they also apply Unconscious.
3. **Activation buttons** — one generalized, data-driven mod-activation toggle framework (0.3);
   Thermal Advantage / Riptide / Bipod / Vibro-Stun become data on top of it.
4. **Clothing** — add nested-subfolder support to the seeder; file existing clothing under
   per-type subfolders; create empty **Full body / Dresses / Skirts** subfolders. No new generic
   items yet.

## Resolved by the spec text (no separate decision needed)
5. Disable-two-random-cyberware (Onibi/Microwaver/EMP) uses the `random:2` cyberware-disable AE;
   insulation is GM-tracked ("The GM keeps track on what is insulated and corrects if needed").
6. Smart-targeting (+1) and Vibro-Stun (−1) self-AEs are **skill-scoped**, which the spec explicitly
   permits ("if limiting to the specific weapon requires significant plumbing, attacks with its skill";
   "−1 to Melee checks").
