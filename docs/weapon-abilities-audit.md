# Weapon & Mod Abilities — Implementation Audit

Status key: ✅ implemented · ❌ not implemented · ➖ partial / display only

---

## 1. Flat attack bonuses (conditional)

| Ability | Where | Notes |
|---|---|---|
| ✅ +1 attack — Smart weapon | all SW | always active |
| ✅ +1 attack — Excellent Quality | Tamayura, Kenshin, SPT32 Grad | always active |
| ❌ +1 attack — recoilBonus (all-attack) | RC-7 Yokai/Kutrub/Liger/Dybbuk, RC-7 Aswang/Varkolak/Ifrit | `recoilBonus` field exists, never read |
Implement.
| ❌ +1 attack — recoilAFOnly | RC-7 Strigoi, RC-7 Zaar | autofire attacks only |
Implement.
| ❌ +1 attack — Digital Link (sacrifice Move) | Hyakume, Softsys Handyman | requires spending Move action; lasts one turn |
Only provide the bonus if the Token hasn't moved this turn. Set MOVE to 0 via an AE until they start their next turn.
| ❌ +1 attack — Trajectory Calculations | Arasaka SO-21 Saika (long scope) | only vs targets >40m away |
Measure distance first and apply this bonus, if applicable. Then check for things like Range Improvement that can alter the range used itself. Then compare to the Weapon's Range table for the attack to get the DV for the check.
| ❌ +1 attack — Beginner Friendly | Budget Arms Add-Vantage | only if user has 0 Handgun ranks |
Implement.
| ❌ +1 attack — Steady (on scopes/grips) | Cetus silencer, Type II Grip, Hakatome | only if user did not Move this turn |
Only if the Token hasn't spent movement this turn. Set MOVE to 0 via an AE until next turn.
| ❌ +1 attack — Forward Grip (AF only) | Militech Type II Grip | autofire only; weapon becomes 2-hand |
Don't allow attachment (or disable the effect it already attached) to a Weapon that doesn't have AF or already is 2-hand.
| ❌ +1 attack — Shoulder Stock | Tsunami Hakatome | weapon becomes 2-hand, switches to Shoulder Arms |
Implement.
| ❌ +1 attack — Handling Computer | Arasaka Stability Calibrator | only if last attack was same direction AND no Move/physical action since |
Apply if the Token hasn't been moved (through their own movement, GM fiat, or otherwise) since their last attack AND they're attacking the same target. Other uses are handled manually.
| ❌ +1 attack — Stabilizers while charged | Sanroo Hello Cutie+ | only while Tech Weapon is charged |
See Tech weapons below.
| ❌ +1 attack — Ifrit close range bonus | Techtronika RC-7 Ifrit | extra +1 when target is within 20m |
Separate the ability so that the Ifrit gets the standard recoilBonus effect, and then add Trajectory Calculations as per the Saika but rewarding this short range instead of long range.
| ❌ +8 attack (or double skill) — Calibration | Federated Arms Hawk Eye | DV15 Action; bonus lasts until fired/Moved/acted |
The bonus lasts until after attacking with the weapon or any Action is taken or movement is used.

---

## 2. Damage bonuses

| Ability | Where | Notes |
|---|---|---|
| ✅ +N damage — Toxic Payload on penetration | Yanari MP, Hercules 3AX | `payloadDmgBonus` already used in combat-resolution |
The logic here should be: if the weapon is currently using Ammo with a name that contains the word X, and the attack would already deal damage, add Y to that damage. In these cases, the word is 'Toxic' and it adds 2 damage.
| ❌ +5 damage on criticals — Power Weapon standard | all PW | PW base mechanic |
Implement.
| ❌ +1 dmg/die — Synergy (same brand) | RC-7 Yokai/Kutrub/Aswang | `synergyBrand` + `synergyDiceThreshold` both exist |
Implement. Can be evaluated when a weapon first brings in the Mod data instead of at each attack.
| ❌ +1 dmg/die extra — Synergy (≥N damage dice) | same mods | threshold check on top of brand check |
Same.
| ❌ +1 dmg/die — Dybbuk specialised (revolver only) | Malorian RC-7 Dybbuk | |
Skip the check and assume that if it has been added, the GM has already defined the weapon as a revolver.
| ❌ +1 dmg/die on ricochet — Critical Ricochet | Malorian Critical Ricochet (mod) | PW only; triggers on successful ricochet |
See Power weapons below.
| ❌ +2 damage — Burn (incendiary ammo) | Nokota Osprey SR | on penetration |
Same as Toxic Payload, but the word is 'Incendiary'.
| ❌ +2 damage — Concussive (explosive rounds) | Midnight Arms MA70 HB | on penetration |
Same as Toxic Payload, but the word is 'Explosive' and it doesn't need to bypass SP first.
| ❌ +2 damage — Barrier Penetration | Tsunami Ketsuretsu (mod) | each die showing 5–6 deals 1 extra dmg bypassing SP |
Implement.
| ❌ +2 damage electrical — SR Capacity | Militech SR Capacity (mod) | TW only; charged hit past SP |
The half of the usual movement this mod allows the user to take is before considering the setting MOVE to 0 that happens when charging a Tech weapon.
| ❌ -1 dmg/die — silencer damage reduction | all silencers (reduceDmgPerDie) | applied after SP, per die |
Implement.

---

## 3. Ammo / shot consumption changes

| Ability | Where | Notes |
|---|---|---|
| ❌ Forces RoF1 | silencers (compressRof) | single-shot only regardless of weapon RoF |
Implement.
| ❌ Burst Control — autofire costs 2 fewer ammo (min 8) | Militech ClearVue Mk.8 (long scope) | |
Implement.
| ❌ CS3 (Charged Shot 3) — uses 3 rounds per attack | Omaha HP, Ticon HP, Quasar HP, Achilles PR, BT-1 Pelrun SG | Tech Weapon HOLD variant |
When in the Charged state, the TW retains its RoF but changes Shots to 3. It can fire with one or two Ammo left in Mag but deals 1 die less damage.
| ❌ Accidental Discharge — odd die on SS → 2× ammo + +1 dmg/die | Rostovic RC-7 Strigoi | |
Implement.
| ❌ Zhuo minimum 8 ammo loaded to fire | Kang Tao L-69 Zhuo (smart SG) | refusal to fire if < 8 shells |
Minimum only applies to Cone.
| ❌ Double Lock — 4 ammo for 1 attack vs 2 targets | Tsunami Kappa (smart MP) | targets must be within 6m of each other |
Implement.

---

## 4. Critical injury modifications

| Ability | Where | Notes |
|---|---|---|
| ❌ Lost Force — crit requires 6 on an extra die | all RC-7 muzzle breaks (lostForce) | rolls extra die; only crits if that die also = 6 |
No, roll the same number of dice. Normally, an attack is a critical hit if at least two damage dice = 6. In this case, at least THREE damage dice must = 6.
| ❌ Highlighted Vitals — auto-crit on double-6 | Arasaka Kanetsugo (short scope) | roll extra 1d6; auto-crit if it = 6 AND any damage die = 6 |
Also if any two damage dice = 6. Don't count the extra die rolled for actual damage, only to determine Critical Hit.
| ❌ Slicing — Broken Arm/Leg → roll 1d6; 2+ = Dismembered | Kendachi Mono-Three, Katana | upgrade to dismember |
Implement.
| ❌ Blunt — no dismember; would-be dismember → Broken + 5 dmg | Baseball Bat | |
Implement.
| ❌ Crushing — chain criticals (Collapsed Lung→Broken Ribs etc.) | Sledgehammer | cascading crit table modifications |
Implement if it comes down to simple if-then-statements, otherwise tell me.
| ❌ Stun (on death) — 0 HP but ≤10 past → unconscious at 1 HP | Militech Stun Baton, Kang Tao Mámù stun gun | |
Implement.
| ❌ Vicious — criticals deal +5 damage | Budget Arms Cut-O-Matic (powered) | only while powered on |
Implement.
| ❌ Shattered Projectiles — deal dmg even on miss; if total > 15 → 2d6 in 2m radius | Techtronika Metel VHP | |
Place a Region centered on the target and give it a 2m radius to determine who is hit. Let it remain after per the same rules as Explosion damage.

---

## 5. Range / targeting modifications

| Ability | Where | Notes |
|---|---|---|
| ❌ Range Improvement (1-way) — N meters closer | short scopes: Kanone Mini, Add-Vantage, Type-2067, Kanetsugo | subtract N from distance before DV lookup |
Look up DV for both actual distance and after subtracting N; use the lower DV.
| ❌ Range Improvement (bidirectional) — ±N meters | Gimlet Eye, Percipient, Grandstand, Saika, Kairo, ClearVue, Jue, Hawk Eye/Prospecta, HPO Kanone Max | |
As above but also check actual distance +N and use the lower DV.
| ❌ Thermal Imaging — darkness/smoke ≤ -1 penalty | Hyakume, Percipient, Grandstand | environment penalty cap |
Add a sightPenaltyCap to use later, but no darkness mechanic is implemented yet, so this remains narrative.

---

## 6. Power Weapon mechanics

| Ability | Where | Notes |
|---|---|---|
| ❌ Ricochet — miss can be redirected to nearby target at -4 | all PW (base mechanic) | requires targeting a surface/cover |
No, original text was unclear. Give PW a button in the Weapons table to set up a ricochet point. Draw a green line between their Actor's token, to the ricochet point, to the target. If the target isn't within 4 meters of the ricochet point, that part is't drawn and the rest is red. The player must either move or remove the point, or switch target to one within range of the point. When attacking, instead of calculating line of sight directly between tokens like normal attacks should, use the trajectory line to determine if walls, movement-blocking regions, or other Tokens are in the way. The attack check when using a ricochet point has -4.
| ❌ Targeted Shot / Aimed Shot — penalty for higher damage | Liberty (−2 pen / +1d6), Unity/Overture/Omaha (−4 pen / +1d6 or +2d6) | attack penalty in exchange for damage step-up |
This is a change in the penalty for Target vitals combined with a dice-based damage bonus on a successful hit when targeting vitals.
| ❌ Directed Recoil — PW ricochet penalty reduced by 1 | RC-7 Babaroga, RC-7 Varkolak (mods) | |
Change from the default -4, as described above.
| ❌ Improved Ricochet — ricochet hit deals +1 dmg/base die | Malorian Critical Ricochet (mod) | PW only |
Inly when using a ricochet point.
| ❌ BODY requirement enforcement — action penalty or auto-crit | Carnage SG (BODY 10+), Hurricane SG / Helix MG / Defender / MA70 (BODY 8+ or 11+) | currently no enforcement |
Create a GM visible and editable only control for this. An actor with BODY < the requirement has any buttons to use or attack with the weapon disabled and greyed out. Carnage is different — someone with too low BODY and less than three Cyberarm Platform cyberware suffers Torn Muscle from the Critical Injury table.
| ❌ Armor Piercing — 1 SP ablation → 2 | M2038 Tactician SG | PW trait |
Implement.
| ❌ Scatter — 2m lateral enemies take ½ dmg | Militech AR-9 Brunswick | on single shot |
Immediately follow up with a cone attack with a spread equal to the range to the target, a 10 degree angle, and a Half Distance of 0 (making all of the area halve the damage and not ble able to get Criticals). This cone doesn't deal damage to the original target.
| ❌ Burst fire step-up — extra ammo for higher damage | Osprey SR burst (6d6/3rnd; fallback 3d6) | unique to Osprey |
Follows the same logic as others with "Uses A ammo to deal X damage; if remaining Ammo < A but > 0, fire remaining and deal Y damage instead." A should be the Shots statistic on the Weapon.

---

## 7. Tech Weapon charge mechanics

| Ability | Where | Notes |
|---|---|---|
| ❌ KEEP charge — accumulates over turns, held until fired | most TW (Burya, Kenshin, Nekomata, SPT32 Grad, Satara/Pozhar/Pelrun SG) | charge state tracked per weapon |
Handled in the HOLD version below instead.
| ❌ HOLD charge — sacrifice Move action; expires end of turn | Omaha HP, Ticon HP, Quasar HP, Achilles PR, HA-4 Grit SMG, SR Capacity mod | |
Give TW a button in the Weapons table to Charge. This is only possible (and otherwise the button is disabled and greyed out) if the Actor hasn't used any of their movement during the same turn. Using charge creates an AW that sets their MOVE to 0 until their next turn and halved (round up) after that, after 20 rounds (1 minute), or when the Charge ends. Attacking with the Charged weapon ends the Charge and the end of that turn. The player can also choose to end the Charge through the same button, but the weapon can't attack until the turn after the Charge ended.
| ❌ Charged effect — ROF1, sees through thin cover, ignores ½ SP | all charged shots | applies on discharge |
"Sees through thin cover" can be interpreted as highlighting tokens within 15 meters, even if they're behind walls, on a different Level, etc. This lasts while the weapon is Charged. Tokes made visible this way can be set as targets. Every wall in the way reduces the damage by 10, any movement-blocking Region reduces it by 20/meter (round down).
| ❌ Improved Charge — may move 2m while charging | Tsunami Gaki, Nokota E305 Prospecta (sniper scopes) | only for TW sniper rifles |
The MOVE reduction from Charging TW will bring it to 1 (thus, 2 meters) instead of 0 at first, and at least 1 on subsequent turns while Charged.
| ❌ SR Capacity — can Move at half-MOVE while charging | Militech SR Capacity (mod) | alternative to Improved Charge |
Half MOVE immediately, instead of a turn at MOVE 0 first.

---

## 8. Smart Weapon advanced mechanics

| Ability | Where | Notes |
|---|---|---|
| ❌ Homing — rocket miss ≤7 on moving solo target at 50m+ redirects | Arasaka Dojigiri Yasutsuna RL | ISA only; specific geometric condition |
On a failure of ≤7, state that in chat and let the GM handle it manually.
| ❌ Miss redirect — ISA miss ≤5 vs beacon-tagged target → roll 1d10+15 | Malorian Arms Sonnet HP | requires separate TAG/beacon mechanic |
Let the Gear have a field for a tracked Token and use that to determine if the target is already tracked. If anyone new is tracked, overwrite the old value.
| ❌ Tracker Dart mode — alternate fire (1d6, silent, 2 darts) | Malorian Arms Sonnet HP | separate weapon entry for alt mode |
Implement
| ❌ Dart mode — silent, 4d6, toxin payload | Tsunami Ashura SR | separate weapon entry for alt mode |
Implement
| ❌ Auto-fire-on-10 — if attack die = 10 and ammo sufficient, treat as autofire | Kang Tao S9 Daishi Tang SMG | |
Implement.
| ❌ Target Vitals penalty -1 (SW mod) | Kang Tao Zhanshou (mod, SW only) | ISA guidance: -1 more + always targets vitals |
Implement.

---

## 9. Melee weapon specials

| Ability | Where | Notes |
|---|---|---|
| ❌ Electric Charge (battery) — hit triggers DV15 TECH+End or 2d6 direct HP | Kendachi RA-5 Knife | 10 charges; also disables electrical devices |
Make the Mag column in the Weapons table on the Actor sheer more flexible so that charges like this can be displayed as unused/used when there is no actual Mag to show data for.
| ❌ Burning Edge (biometric) — ignores SP < 11 while active | Kendachi Mono-Three | activation as part of attack |
Assume the effect is active. The GM will handle other cases.
| ❌ Bayonet — melee attack 1d6/RoF2, ignores ½ SP | Kendachi Shi Bayonet (mod) | separate weapon mode on long gun |
Implement.
| ❌ Return Thrower — thrown weapon returns on hand signal | Militech TWA Boomerang (mod) | light melee thrown only |
Implement the restriction. The actual effect is handled manually.

---

## 10. Silence / stealth

| Ability | Where | Notes |
|---|---|---|
| ➖ silenceBuiltIn + silenceBuiltInDV — DV N INT+Perception to hear | Tenebra MP, Yanari MP | flag exists + displayed; not enforced in combat flow |
See below.
| ❌ Silencer mod — same DV mechanic | all silencers (silenceDV field) | `silenceDV` field exists, never read |
Make a chat message with the information for the silenced shot. The GM handles the Perception checks.
| ❌ Stealth Advantage | Strix, Tocororo, Taipan silencers (stealthAdvantage) | narrative benefit; could flag bonus on opposed stealth check |
When an attack successfully targets vitals: If at least one damage dice = 6 AND no Critical Injury was triggered, write a chat message to the GM only with that information. They'll decide how to handle it.
| ❌ destroyedByTech | Strix, Tocororo, Taipan | silencer destroyed on Tech Weapon discharge |
Implement.
| ❌ destroyedByRof2 | Strix | silencer destroyed on RoF2+ firing |
Implement.

---

## 11. Condition / status on hit

| Ability | Where | Notes |
|---|---|---|
| ❌ Shockwave — BODY < 8 target pushed 2m | Kang Tao Mámù stun gun | positional effect |
Implement, but the push is restricted by walls and regions that block movement.
| ❌ Chomp ammo — sticks to target on hit (or AF miss ≤5); 1d6 AoE next turn | KTech Terrier SMG | end-of-round trigger |
End of attacker's next turn.
| ❌ Heavy Recoil — BODY < 8 attacker takes 1d6 to HP when firing | Rostovic Kolac PR | self-damage |
Implement with a warning in chat when it happens.

---

## 12. Weapon-entry alternate modes

| Ability | Where | Notes |
|---|---|---|
| ❌ Alternate fire mode (e.g. burst at different stats, dart mode) | Sonnet HP, Ashura SR, Osprey SR, Strigoi mod | would need extra weapon entry or mode-toggle |
Many of these have been solved above. Distinctly different modes should be extra weapon entries with a visible note in the Weapons table with a (preferably one-word) note about the difference.
| ❌ Battery ammo — no ammo item; costs €$50 battery, 1h recharge | Kang Tao Mámù stun gun | no magazine loop |
Let's intoduce a new Ammo category: Battery. Weapons get to choose Ammo type that defaults to their Weapon type but could differ.
| ❌ Bandfed — extra 40-round bands loaded in sequence | Tsunami RMS Helix | narrative; could track as quantity |
The Helix uses Machine Gun ammo like any other. The GM can create one named appropriately if they want.

---

## 13. Magazine modifications

| Ability | Where | Notes |
|---|---|---|
| ❌ Extended Magazine — 2× capacity, per-type caps | Extended Magazine mod | `weaponChanges` could handle it but caps are complex |
Don't try to implement, but include the information along with the table in the Description. The GM can manually change the Mag size of the weapon.
| ❌ Drum Magazine — 4× capacity, per-type caps | Drum Magazine mod | same |
Same.

---

## 14. Narrative / out-of-combat only

These have no in-combat mechanical effect; description is sufficient.

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
- **Sturdy barrel** (MA70 HB) — description says concussive rounds; no distinct ammo type yet

Extra notes:
* Any Mods or Weapon abilities that affected the Check to hit, the Check to evade (if applicable), and damage (if applied) should be mentioned in the chat message. Include the Item that provided the effect along with the ability.
* Abilities listed in the Description of Items should each be their own <p>, with the name in <strong style="color: var(--cpb-accent)">.