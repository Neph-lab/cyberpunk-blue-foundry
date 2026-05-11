# Weapon & Mod Abilities — Implementation Audit

Status key: ✅ implemented · ❌ not implemented · ➖ partial / display only

Last updated: 2026-05-11

---

## 1. Flat attack bonuses (conditional)

| Ability | Where | Notes |
|---|---|---|
| ✅ +1 attack — Smart weapon | all SW | always active |
| ✅ +1 attack — Excellent Quality | Tamayura, Kenshin, SPT32 Grad | always active |
| ✅ +1 attack — recoilBonus (all-attack) | RC-7 Yokai/Kutrub/Liger/Dybbuk, RC-7 Aswang/Varkolak/Ifrit | applied in attack modifier sum |
| ✅ +1 attack — recoilAFOnly | RC-7 Strigoi, RC-7 Zaar | autofire attacks only; separate AF modifier |
| ✅ +1 attack — Digital Link (sacrifice Move) | Hyakume, Softsys Handyman | checkbox in attack dialog; player confirms Move sacrifice |
| ✅ +1 attack — Trajectory Calculations | Arasaka SO-21 Saika (long scope) | only vs targets >40m away |
| ✅ +1 attack — Beginner Friendly | Budget Arms Add-Vantage | only if user has 0 Handgun ranks |
| ✅ +1 attack — Steady (on scopes/grips) | Cetus silencer, Type II Grip, Hakatome | checkbox in attack dialog |
| ✅ +1 attack — Forward Grip (AF only) | Militech Type II Grip | recoilAFOnly flag; weaponChanges forces hands=2, concealable=false |
| ✅ +1 attack — Shoulder Stock | Tsunami Hakatome | weaponChanges in mod catalogue sets skill+hands; recoilBonus applied |
| ✅ +1 attack — Handling Computer | Arasaka Stability Calibrator | checkbox in attack dialog |
| ✅ +1 attack — Stabilizers while charged | Sanroo Hello Cutie+ | chargedAttackBonus field; applied when isCharged |
| ✅ +1 attack — Ifrit close range bonus | Techtronika RC-7 Ifrit | closeRangeBonus flag; +1 when target ≤20m |
| ✅ +8 attack (or ×2 skill) — Calibration | Federated Arms Hawk Eye | DV15 calibrate action on sheet; flag cleared on attack/move |

---

## 2. Damage bonuses

| Ability | Where | Notes |
|---|---|---|
| ✅ +N damage — Toxic Payload on penetration | Yanari MP, Hercules 3AX | payloadDmgBonus + 'toxic' ammo name check |
| ✅ +5 damage on criticals — standard | all weapons | critBonus = 5; PW = 10 |
| ✅ +10 damage on criticals — Power Weapon | all PW | isPowerWeapon → critBonus = 10 |
| ✅ +1 dmg/die — Synergy (same brand) | RC-7 Yokai/Kutrub/Aswang | synergyBrand matches weapon manufacturer |
| ✅ +1 dmg/die extra — Synergy (≥N damage dice) | same mods | synergyDiceThreshold check |
| ✅ +1 dmg/die — Dybbuk specialised | Malorian RC-7 Dybbuk | treated as always-active since GM attaches it to revolver |
| ✅ +1 dmg/die on ricochet — Critical Ricochet | Malorian Critical Ricochet (mod) | improvedRicochet flag; +damageDiceCount on ricochet hit |
| ✅ +2 damage — Burn (incendiary ammo) | Nokota Osprey SR | 'incendiary' in ammo name + penetration check |
| ✅ +2 damage — Concussive (explosive ammo) | Midnight Arms MA70 HB | 'explosive' in ammo name; no penetration required |
| ✅ +2 damage — Barrier Penetration | Tsunami Ketsuretsu (mod) | barrierPenetration: each die ≥5 → +1 bypass SP |
| ✅ +2 damage electrical — SR Capacity | Militech SR Capacity (mod) | srCapacity: charged hit past SP |
| ✅ -1 dmg/die — silencer damage reduction | all silencers (reduceDmgPerDie) | applied after SP |
| ✅ +1 dmg/die — Accidental Discharge | Rostovic RC-7 Strigoi | SS odd d10 result → extra round + +1 dmg/die |

---

## 3. Ammo / shot consumption changes

| Ability | Where | Notes |
|---|---|---|
| ✅ Forces RoF1 | silencers (compressRof) | blocks autofire entirely |
| ✅ Burst Control — autofire costs 2 fewer ammo (min 8) | Militech ClearVue Mk.8 | burstControlAmmoReduction |
| ✅ CS3 (Charged Shot 3) — uses 3 rounds per attack | Omaha HP, Ticon HP, Quasar HP, Achilles PR, BT-1 Pelrun SG | cs3 flag + cs3FallbackDamage |
| ✅ Zhuo minimum 8 ammo loaded to fire | Kang Tao L-69 Zhuo (smart SG) | minimumAmmoToFire=8 |
| ✅ Double Lock — 4 ammo for 1 attack vs 2 targets | Tsunami Kappa (smart MP) | resolveDoubleLockAttack; targets must be within 6m |

---

## 4. Critical injury modifications

| Ability | Where | Notes |
|---|---|---|
| ✅ Lost Force — crit requires 3 dice = 6 | all RC-7 muzzle breaks | lostForce raises crit threshold from 2 to 3 |
| ✅ Highlighted Vitals — auto-crit on extra-die-6 + damage-die-6 | Arasaka Kanetsugo (short scope) | highlightedVitals: extra 1d6; auto-crit if 6 AND any damage die = 6 |
| ✅ Slicing — Broken Arm/Leg → roll 1d6; 2+ = Dismembered | Kendachi Mono-Three, Katana | critSlicing flag; handled in critical-injury.mjs |
| ✅ Blunt — no dismember; would-be dismember → Broken + 5 dmg | Baseball Bat | critBlunt flag |
| ✅ Crushing — cascading crit chain | Sledgehammer | critCrushing flag |
| ✅ Stun — 0–(−10) HP → unconscious at 1 HP | Militech Stun Baton, Kang Tao Mámù | critStun flag |
| ✅ Vicious — crits deal +5 extra damage | Budget Arms Cut-O-Matic (powered) | vicious flag; +5 on crit |
| ✅ Shattered Projectiles — dmg on miss; if > 15 → 2d6 in 2m radius | Techtronika Metel VHP | shatteredProjectiles; chat message for splash |

---

## 5. Range / targeting modifications

| Ability | Where | Notes |
|---|---|---|
| ✅ Range Improvement (1-way) — N meters closer | short scopes | rangeImprovementMeters; lower non-zero DV selected |
| ✅ Range Improvement (bidirectional) — ±N meters | long/sniper scopes | rangeImprovementBidirectional: checks both ±N |
| ✅ Target Vitals penalty reduction | Kang Tao Zhanshou (mod, SW only) | targetVitalsPenaltyReduction applied to vitalsPenalty |
| ➖ Thermal Imaging — darkness/smoke penalty cap | Hyakume, Percipient, Grandstand | thermalImaging flag exists; no darkness mechanic yet |

---

## 6. Power Weapon mechanics

| Ability | Where | Notes |
|---|---|---|
| ✅ Ricochet point — line-of-sight via surface | all PW (base mechanic) | ricochet canvas overlay; −4 to attack (−3 with Directed Recoil) |
| ✅ Targeted Shot / Aimed Shot — penalty for damage step-up | Liberty, Unity, Overture | targetVitalsPenalty override + targetedShotDamageDice |
| ✅ Directed Recoil — PW ricochet penalty −1 | RC-7 Babaroga, RC-7 Varkolak | directedRecoil flag; penalty becomes −3 |
| ✅ Improved Ricochet — ricochet hit +1 dmg/base die | Malorian Critical Ricochet (mod) | improvedRicochet; bonus = damageDiceCount |
| ✅ BODY requirement — hard block or Torn Muscle | Carnage SG, Hurricane, Helix, Defender, MA70 | minBodyReq (hard block) + critOnBodyReq (Torn Muscle) |
| ✅ Armor Piercing — 1 SP ablation → 2 | M2038 Tactician SG | armorPiercing flag; ablateArmorExtraWithPermission |
| ✅ Scatter — lateral enemies take ½ dmg | Militech AR-9 Brunswick | scatter flag; resolveScatterEffect (cone follow-up) |
| ✅ Burst fire / short-ammo fallback | Osprey SR burst | shortAmmoFallbackDamage field |

---

## 7. Tech Weapon charge mechanics

| Ability | Where | Notes |
|---|---|---|
| ✅ KEEP charge — accumulates over turns, held until fired | most TW | chargeType='keep'; charge flag + AE; clearWeaponCharge on attack |
| ✅ HOLD charge — sacrifice Move; expires end of turn | Omaha HP, Ticon HP, Quasar HP, Achilles PR, HA-4 Grit | chargeType='hold'; same charge system |
| ✅ Charged effect — RoF1, ignores ½ SP | all charged shots | isCharged → SP halved in resolveWeaponAttack |
| ✅ CS3 ammo handling | Omaha HP, Ticon HP, etc. | cs3=true; 3 shots/attack; cs3FallbackDamage for 1-2 remaining |
| ✅ Improved Charge — MOVE → 1 while charging | Tsunami Gaki, E305 Prospecta | improvedCharge mod; AE sets MOVE=1 |
| ✅ SR Capacity — MOVE → half while charging | Militech SR Capacity (mod) | srCapacity mod; AE sets MOVE=⌈MOVE/2⌉ |
| ✅ Stabilizers while charged — +attack bonus | Sanroo Hello Cutie+ | chargedAttackBonus=1 on weapon schema |

---

## 8. Smart Weapon advanced mechanics

| Ability | Where | Notes |
|---|---|---|
| ✅ Homing guidance — rocket miss ≤7 → GM chat message | Arasaka Dojigiri Yasutsuna RL | cone-attack.mjs; posts chat note on close miss |
| ✅ Auto-fire-on-10 — attack die = 10 → redirect to autofire | Kang Tao S9 Daishi Tang SMG | autoFireOn10 flag; resolveAutofireAttack redirect |
| ✅ Target Vitals penalty −1 | Kang Tao Zhanshou (mod, SW only) | targetVitalsPenaltyReduction=1 |
| ❌ Miss redirect (ISA miss ≤5 vs beacon-tagged target) | Malorian Arms Sonnet HP | requires TAG/beacon mechanic not yet built |
| ❌ Tracker Dart mode | Malorian Arms Sonnet HP | alternate weapon entry needed |
| ❌ Dart mode (silent, 4d6, toxin) | Tsunami Ashura SR | alternate weapon entry needed |

---

## 9. Melee weapon specials

| Ability | Where | Notes |
|---|---|---|
| ✅ Electric Charge (battery) — DV15 TECH+End or 2d6 HP | Kendachi RA-5 Knife | electricCharge flag; 10-charge flag tracking; SS only |
| ✅ Burning Edge — ignores SP < 11 | Kendachi Mono-Three | burningEdge flag; always active (GM handles toggle cases) |
| ✅ Bayonet — melee 1d6/RoF2, ignores ½ SP | Kendachi Shi Bayonet (mod) | bayonet mod flag; getEffectiveItemWeapons injects synthetic weapon |
| ✅ halveSP — Bayonet weapon mode | synthetic bayonet entry | halveSP=true; Math.ceil(SP/2) in SP computation block |
| ❌ Return Thrower — thrown weapon returns | Militech TWA Boomerang (mod) | restriction-check not yet added to mod validation; effect is narrative |

---

## 10. Silence / stealth

| Ability | Where | Notes |
|---|---|---|
| ✅ silenceBuiltIn + silenceBuiltInDV | Tenebra MP, Yanari MP | flag exists; chat message posted on SS attack |
| ✅ Silencer mod — DV chat message | all silencers (silenceDV field) | silenceDV > 0 → chat message on attack |
| ✅ Stealth Advantage — GM whisper on near-crit vitals hit | Strix, Tocororo, Taipan | stealthAdvantage flag; whisper to GM |
| ✅ destroyedByTech — silencer destroyed on TW discharge | Strix, Tocororo, Taipan | flag; checked in combat-resolution + autofire |
| ✅ destroyedByRof2 — silencer destroyed on RoF2+ | Strix | flag; checked in combat-resolution + autofire |

---

## 11. Condition / status on hit

| Ability | Where | Notes |
|---|---|---|
| ✅ Shockwave — BODY < 8 target pushed 2m | Kang Tao Mámù stun gun | shockwave flag; chat message (positional GM-resolved) |
| ✅ Chomp ammo — 1d6 AoE 2m at end of attacker's next turn | KTech Terrier SMG | chompAmmo flag; flag set on hit/AF-miss-≤5; combatTurn hook detonates |
| ✅ Heavy Recoil — BODY < 8 attacker takes 1d6 to HP | Rostovic Kolac PR | heavyRecoil flag; applyDamageWithPermission after attack |

---

## 12. Weapon-entry alternate modes

| Ability | Where | Notes |
|---|---|---|
| ❌ Tracker Dart / Dart alternate fire mode | Sonnet HP, Ashura SR | needs second weapon[] entry; not yet added to catalogue |
| ❌ Battery ammo category | Kang Tao Mámù stun gun | 'Battery' ammo type not yet created; Mámù uses dummy mag for now |

---

## 13. Magazine modifications

| Ability | Where | Notes |
|---|---|---|
| ➖ Extended Magazine — 2× capacity | Extended Magazine mod | weaponChanges can set magazine value; per-type caps not enforced (GM responsibility) |
| ➖ Drum Magazine — 4× capacity | Drum Magazine mod | same |

---

## 14. Narrative / out-of-combat only

Description text is sufficient; no mechanical enforcement needed:

- **Action Cam** (Fuyutsuki) — camera footage, battery
- **Reflector Glass** (Kang Tao Type-2067) — anti-dazzle/glare
- **Digital Feed** (Militech Mk.2X Grandstand) — remote scope view
- **Hidden Compartment** (Budget Arms Depot Grip) — +2 to conceal small items in grip
- **Repairs discount** (Nokota D5 Sidewinder, Nokota D5 Copperhead) — lower repair cost category
- **Sturdy** (Militech M251s Ajax) — 20 HP to break instead of standard
- **Noisy** (Cut-O-Matic) — stealth impossible while powered on (toggle note)
- **EMP Shielding** (Arasaka Stability Calibrator) — only DV>16 EMP disables it
- **Magazine Feed** (Militech MF Selector) — switch ammo type between shots (narrative unless ammo types mechanically distinct)
- **Computer Mods** (Coolant/Insulation/Memory Upgrade) — architecture-level; no combat interaction
- **Bandfed** (Tsunami RMS Helix) — narrative; GM creates extra ammo stacks if desired
- **Sturdy barrel** (MA70 HB) — concussive rounds via 'explosive' ammo name check

---

## Remaining open items (post Batch 9)

| Item | Priority | Notes |
|---|---|---|
| ➖ Tracker Dart / Dart modes (Sonnet HP, Ashura SR) | medium | Second weapons[] entries added; Ashura dart now silenced; Sonnet tag/beacon redirect GM-handled |
| ❌ Battery ammo category (Mámù) | low | New ammo type + reload flow |
| ❌ Return Thrower restriction (Boomerang mod) | low | Validate mod only attaches to light melee throwable |
| ❌ Thermal Imaging darkness cap | deferred | No darkness mechanic yet |
| ❌ Miss-redirect beacon system (Sonnet HP) | low | Requires TAG/beacon token tracking |
| ➖ Extended/Drum Magazine per-type caps | low | GM handles; caps not enforced |
