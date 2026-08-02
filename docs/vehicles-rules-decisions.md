# Vehicle combat — rules decisions (authoritative)

Consolidated from three rounds of design Q&A with the system author (2026-05-25 → 2026-05-26,
originally `tmp/vehicles_qs.md`, `tmp/vehicles_qs2.md`, `tmp/vehicles_qs3.md`).

**This file is the source of truth for vehicle rules.** Every answer below is the author's
ruling, kept verbatim in substance. The implementation plan distils these into build order and
schema; when the plan and this file disagree, **this file wins**.

Original identifiers (A1, N7, P5 …) are preserved so cross-references in the plan still resolve:
- **A–L** — first round: stats, initiative, movement, maneuvers, damage, vitals, UX.
- **N** — second round: subsystems, initiative edges, maneuver timing, roofs, reverse.
- **P** — third round: maneuver declaration payloads, seat rules, damage routing, gunners.

Implementation status as of 2026-08-03: data model, blueprint materialisation and position sync
are built (plus the blueprint editor). Initiative, maneuvers, damage routing, drift and Lost
Control are **not** built — the rulings below are the spec for that work.

---

## A. Vehicle stats & categories

**A1. Stat set.**
HP, SP, maxMOVE, ACC, Handling, Size. Plus: subsystems with their own SP and HP (usually the
result of a Vehicle Modification — a new Item type), the number of seats, the locations of
vitals, and which parts of the vehicle have a roof (roof tiles or region boundaries).

**A2. `move` vs `maxMove`.**
maxMOVE is the ceiling. The other value is **`currentSpeed`** — it is only *called* MOVE to help
players grasp that it defines how far the vehicle moves, just as their own MOVE does. It is
expressed in grid units per round: 2 metres per 3 seconds. Whenever that speed exceeds
35 km/h / 20 mph, the speed should **also** be shown in those units. Users can individually
choose in settings to show both, neither, or one.

**A3. Handling.**
A single number between **−5 and +5**, added to Drive checks with the vehicle. AEs may change it
temporarily; Abilities/Gear/Cyberware/Vehicle Mods may change Handling for one *type* of roll.
Adjustments to Handling itself (as opposed to adjustments to the Drive check Handling feeds)
**cannot raise Handling by more than +4 in total**. The exact limit may change with playtesting.

**A4. Categories.**
Land / Sea / Air. Submarines are Sea vehicles with access to Dive/Rise. A vehicle can be more
than one category (amphibious car = Land + Sea); it can be trusted to act as only one at a time.
This matters for drift tables. Maneuver availability may need the GM to pick which apply to a
given vehicle, with sensible defaults.

**A5. ACC limits.**
ACC limits speed change both up and down, equally by default; some vehicles boost one side.
Hard Brakes is the ACC-bypassing exception: speed may drop by ACC×2 with a check, or ACC×3 with
a very hard check.

**A6. Parked.**
Not a distinguished state — just `currentSpeed = 0`.

---

## B / N9–N11. Initiative

**B1. Vehicle initiative.**
Vehicles **lose initiative to every non-vehicle participant**. Among themselves they are ranked
by Handling (random tiebreak). A driver may either stay where they are in initiative and select
a Maneuver that will not take place until the vehicle's turn, **or** move to just before the
vehicle in initiative (sacrificing time getting their bearings). When they stop driving they stay
where they are. Any reason a vehicle would have a *higher* initiative is the GM's call.

**B2. "Delay to just before vehicle" implementation.**
Re-sort initiative on the fly — recompute `combatant.initiative` to `vehicleInit − 0.001`.
(Not a held-action flag.)

**B3. Does the delay persist?**
Yes. They stay in that order from that point onwards.

**B4. Two people in the driver seat.**
Strictly 1 driver for any movement. Anything more complex is GM-handled.

**B5. Driver incapacitated mid-round.**
The vehicle executes the Maneuver, if one was declared, and then Drifts.

**B6. Vehicle with no occupants.**
Still gets an initiative slot. It stays where it is in the order and gets there as per B1.

**N9. Driver delays, then dies; a new driver takes the seat.**
The new driver remains in their own initiative spot, but may delay to just before the vehicle
from that point if they choose.

**N10. Driver delayed, then the vehicle is destroyed.**
They act at the initiative they have after delaying. The original position is discarded.

**N11. Reaction-Speed bonus to vehicle initiative.**
Locked at first computation, not recomputed each round.

**Cross-cutting:** when a character delays to before the vehicle, the vehicle may be treated as
having rolled that character's Reaction Speed + the vehicle's Handling (minimum 0).

---

## C / N14–N15. Speed & movement semantics

**C1. Scale.**
Same grid scale as foot combat, because combat is likely to be mixed (people jumping between
vehicles and similar). This means large scenes — accepted.

**C2. Steering during a move.**
At one point during the vehicle's turn the driver may veer up to **30°** (one hex side). Turning
more than that, or turning several times (weaving through traffic), requires the Sharp Turn
Maneuver. The Drive DV for Sharp Turn depends on the **total** degrees turned (30° left then 30°
right = 60°) and `currentSpeed`.

**C3. Path crosses an occupied space.**
Stop on impact, so the GM can weigh the narrative. It also deals base Ramming damage.

**C4. "Mostly the same speed and direction" (cruising), formalised.**
±30° heading (per C2) and ±`max(ACC/2, currentSpeed/4)` speed, minimum 1. Speed change can be
handled narratively if needed.

**C5. Rotation quantisation.**
Rules were written for a hex grid so tired human minds can picture the paths. Ideally this runs
entirely gridless.

**C6. Altitude / depth.**
Rely on Foundry's own elevation concept.

**N14–N15. Cruising is passive driving.**
The driver may set up changes within cruising limits **without spending an action**. Doing
nothing before ending their turn means the vehicle cruises at maintained speed and direction.
Cruising is free — but a character who leaves the driver's seat is no longer driving and
therefore cannot cruise.

---

## D / N16–N22. Maneuvers

**D10. One Maneuver per turn.** Strictly one.

**P17.** Accelerate/Decelerate as a Maneuver costs both action and movement — a driver cannot
accelerate *and* shoot in the same turn (without delaying and coasting). Confirmed intentional.
Cruising is the free minor-change alternative that still allows shooting.

**N12. When is the Drive check rolled?**
**At declaration** (the driver's turn). Outside factors may change what the roll *achieves*, but
the Maneuver executes according to the roll made at declaration.

**N13. Can the declared Maneuver be changed before execution?**
No. That is precisely why a driver would delay to just before the vehicle's turn — to know what
the situation will actually be.

**N24.** If driver A declares a Maneuver but is replaced by driver B before the vehicle's turn,
**driver B can override** which Maneuver the vehicle takes.

### Sharp Turn
**D1.** Currently a table rather than a formula. The table exists to make speed's contribution
logarithmic — genuinely dangerous high-speed turns aren't realistic, but they're a genre staple.
Anchors: **DV 10** for a drive to work, **DV 15** for a tight city corner with screeching wheels,
**DV 25** for daring action-sequence stunts (deliberately flipping the car 360° as a strategy).

**N16.** Bucket boundaries confirmed: speed bands {parked, 1–5, 6–15, 16–30, 31+ hexes/turn} ×
turn-angle buckets {31–45, 46–90, 91–180, 181–360}.

### Hard Brakes
**D2 / N17.** DV **15** for −ACC×2, DV **25** for −ACC×3.
**N18.** On success, speed drops by the maximum, or until speed is 0.
On failure the driver gets a rolled result from the **Lost Control** table — spinning
uncontrollably in random directions while shedding ACC×3 speed until stopping, flipping over and
sliding `currentSpeed/5` metres (dealing maximum Ramming damage to itself), and similar.

### Aerobatics
**D3 / P16.** A single roll, **DV 17** by default. Narrative or GM-handled outcome; **failure
triggers Lost Control**.

### Dive / Rise
**D4.** Maximum per-turn change: `min(ACC, currentSpeed)`. Some vehicles override this — a
hot-air balloon rises and dives much faster. On later turns the vehicle may alter elevation by
**ACC×2 metres per turn** as part of normal movement, assumed to happen gradually. Mechanically
this works as Sharp Turn but in pitch or roll rather than yaw.

### Jump (ramp)
**D5.** DV based on speed and gap — but there are too many factors to anticipate, so this is
GM-handled. Declared as a set-up for the GM to resolve.

### Ram
**D6.** Damage scales as **Speed × Size**, adding 1d6 at each of a regular interval (needs
testing). **N19:** the interval is `Size × (Speed/5)`.
Base Ramming damage is dealt to **both** the ramming vehicle and its target.
When the collision is the result of a **Ram Maneuver** (as opposed to hitting something after
losing control), the ramming vehicle reduces its own damage by the margin of success —
**N20:** subtract the margin from the damage *before* comparing to SP.
DV to ram another vehicle = **13 + the target's Handling**, or the result of the target's Swerve
if that is the last thing the other vehicle did (**N21** confirmed: a Swerve of 22 makes the Ram
DV 22).
Characters with **RFLX 8+** may try Evasion if moving 2 metres would get them to safety. In all
other cases it is an automatic hit — **N22:** use 10 as the rolled result to compute the margin.

**P20. Collisions in general.** Ramming damage happens to both a vehicle and what it hits
whenever they collide **for any reason**. Two vehicles colliding deal their ramming damage to
each other. This includes walls and movement-blocking regions, though consequences beyond
stopping the vehicle are GM-managed. The advantage of the Ram Maneuver is the extra protection
from damage reduction.

### Swerve
**D7.** Until the vehicle's next turn, attacks against it **and anyone on or in it** are treated
as if the target had rolled Evasion with the result of the driver's check. Characters whose RFLX
is too low to evade bullets themselves still benefit from a swerving driver.
**N23.** Protection ends if the vehicle is destroyed, and does not apply to anyone who leaves.

### Use Equipment
**D8.** A catch-all umbrella — trigger any one vehicle mod, fire a mounted weapon, etc.

### Restrictions
**D9.** Any skill-rank or specialty restrictions are GM-handled. **No one benefits from Handling
higher than their Drive skill.**

---

## P1. What a Maneuver declaration locks in

Speed change and direction within cruising need no Maneuver. Beyond that, declaration covers:
speed change (Accelerate/Decelerate, Hard Brakes), direction (Dive/Rise, Sharp Turn), or setting
up for a situation during the vehicle's turn: Jump (GM-handled), Ram (to handle the impact
better), Swerve (to make the vehicle harder to hit).

**Sharp Turn declaration is a vector pair, not points.** The UI lets the user extend a line from
the vehicle to a point it could reach under safe cruising rules, select a point on that line,
then select a second line with the same limits from that point. The Ricochet-point UI for Power
Weapons is a good base. **These are vectors, not absolute points** — if something knocks the
vehicle off-course it still executes on the vectors as best it can rather than readjusting to
reach the selected points. The angle between the two lines that deviates from straight ahead is
the Maneuver's turn angle.

**Ram** places a "Ramming" AE on the vehicle along with the check result. When it hits something
during the vehicle's next turn, the target may try to avoid if applicable, and the damage is then
reduced by the margin (or by the steps above 10 if the target could not evade).

**Accelerate/Decelerate:** declare the amount. **Hard Brakes:** the tier (×2 / ×3) is chosen at
declaration.

**General principle:** declare type and parameters fully at declaration; execution applies them
verbatim. If circumstances changed, that is the cost of not delaying.

---

## P2–P4. Driver-seat occupation

**P2.** A token that sits in the driver seat and then leaves on its own turn is still "the
driver" for the pending Maneuver. If no new driver takes the seat before the vehicle's turn, the
vehicle drifts after executing the Maneuver.

**P3.** Confirmed symmetric with B5: a Maneuver declared by a now-departed driver still fires.

**P4.** Silence = coast. The driver may set up changes within cruising limits without an action;
doing nothing before ending their turn means the vehicle cruises at maintained speed and
direction.

**J1.** "Prepared to sit at the wheel" means simply being in the driver Region and not having
declared "not driving". To ride along without driving, sit in a passenger seat.

---

## E / N6 / P5–P7. Damage routing

**E1.** Attacking the vehicle itself works like personal armor: SP first, then HP.

**E2.** Vehicle SP ablates like regular armor: if damage > SP then `HP −= (damage − SP)`; if
damage ≥ SP then also `SP −= 1`.

**E3 / N6. The system-wide "highest SP wins" rule.**
Whenever several sources of SP could apply, **the one with the highest current SP is used**
(highest max SP as first tiebreaker, otherwise most-recently-used or random). This is why
characters must *choose* armor for their SP rather than adding it. So if the vehicle's current SP
is higher, the vehicle's is used, and **that** is the armor that ablates. Damage ≤ the vehicle's
current SP has no effect on passengers, exactly as regular armor would block effects on a
character. This rule is already implemented, if not explicitly, with intentional fuzzy logic to
allow player agency.

**E4.** Open-top vehicles (`enclosesRiders = false`): vehicle SP **never** applies to attacks on
occupants — but see A1 (partial roofs are region-defined).

**E5.** "Shooting off a door to bypass SP" is GM ad-hoc, with a Vehicle HUD button to temporarily
zero a section's SP.

**E6.** Being a passenger grants no system-applied cover bonus. Vehicle SP is the protection; the
rest is narrative.

**P5. Subsystem overflow.** **Absorption** — a subsystem with 5 HP taking 12 damage drops to 0
and the remaining 7 is gone. It does not cascade to vehicle main HP.

**P6.** A subsystem's own SP **ablates like any SP**; it is not static.

**P7.** A destroyed subsystem's Region can no longer be targeted. If an "Engine" subsystem is
destroyed *and* the Critical Damage table also says the engine is destroyed, the GM resolves the
overlap narratively — and the same in the other direction.

---

## F. Critical Damage

**F1.** Critical Hit trigger is the same as for characters: 2 or more results of 6 among the
damage dice. A **Serious Damage** AE at ½ max HP lowers Handling by 2.

**F2.** One Critical Damage table per category (Land / Sea / Air) — similar enough to share
structure, different enough that separate tables are easier.

**F3.** Entries are either an AE carrying both mechanics and description, or an AE with a
description whose consequences are complex enough that the GM handles them. Same shape as the
existing critical-injury system.

**F4.** Crits stack. Multiple "Engine damaged" results are allowed.

---

## G / N1–N5 / N25–N27. Vital areas & subsystems

**N1. Relationship.** Model (b): vital regions **optionally** link to a subsystem. Without a
link, hitting the vital routes damage to vehicle main HP but binds the Critical Damage entry on
a crit.

**N2. "Destruction" of an unbacked vital area** is the moment the effect set for the Region
triggers. That result remains a possible entry on the Critical Damage table afterwards.

**N3.** A subsystem with HP that takes a crit triggers Critical Damage, with the roll result
applied to the vehicle as a whole.

**N4.** Subsystem SP is **independent** of vehicle SP.

**N5.** A destroyed subsystem's item **sticks around** but has no effect and is no longer a valid
target until repaired. Repair specifics are GM-handled (restoring systems, HP and/or SP as
appropriate).

**G1.** The GM sets vitals up on each vehicle's Token; they are then remembered whenever the
Actor is added to a scene, duplicated, exported to a compendium and re-imported, etc.

**G2.** When "target vitals" is toggled, the regions defined as vitals become visible on a scene
layer the player can see. There needs to be a "select region as target" UI; after that the player
uses the Attack button on their sheet as usual.

**G3.** The to-hit penalty for a vital is **hardcoded**, the same as for character vitals. Any
variation comes from elsewhere.

**G4.** A "Vehicle Critical Location" region should **offer** to select which Critical Damage
entry applies when it is destroyed, but not require it. A future feature: have the region prepare
enough data to create an AE on the vehicle when destroyed.

**G5.** A destroyed vital area still appears (see N2 — the entry stays on the crit table as a
random possibility, but can no longer be the deterministic target).

**N25.** Vital-region edits on a token propagate to the world copy of the Actor. The compendium
is the "factory default" baseline; it is not unlocked for each edit.

**N26.** Vital regions on a placed token are **editable**, with an edit-and-resync workflow — not
read-only once materialised.

**N27.** With "target vitals" active, vital regions are visible to the **attacker only**.

---

## N28–N29. Roof regions

**N28.** A roof region's purpose is to toggle `enclosesRiders` per area. LOS and everything else
is handled by built-in Foundry functionality and GM fiat.

**N29.** Shooting the roof off (subsystem destruction) toggles `enclosesRiders` from true to
false.

---

## H. Relative-speed penalty

**H1.** `floor(|relSpeed| / 4)` penalty per step, max −10. Approved as proposed.
**H2.** Scalar for v1; **a vector solution is a priority for v2**.
**H3.** A foot target's "speed" is the MOVE it used last turn.
**H4.** The penalty is **symmetric** — it applies to both attacker and defender.

---

## I. Size

**I1.** Theoretically an enum with a mapping, but both forms are shown to help different players
remember: "1 (Small)".
**I2.** Affects **to-hit only**, not damage routing.

---

## J / N30. Unmanned drift & reverse

**J2. Veer formula.** `(1d10 + 5 − Handling) × 15°`, applied left or right at random. (The +5 is
because Handling can be negative.) If the result exceeds 30°, roll 1d6; if the result is ≤ the
number of 15° steps beyond 30°, **also roll on the Lost Control table**.

**J3.** The half-ACC speed reduction can go past 0 into **reverse**. In reverse, maxMove is
halved and Handling is −2 (should be an AE) — hopefully not common.

**N30. Entering reverse.** Once speed is 0 it can be increased in the negative direction as if it
were forwards, subject to the reverse AE's limits. Modelled as negative speed for now, to be
replaced by a vector later.

**N32. Drift vs Lost Control.** Drift is the calculation for what happens when nobody is in the
driver's seat — how far the vehicle veers and in what direction. If that drift produces too
radical a turn, it is one of the things that can trigger **Lost Control**, which is a separate
table per category (Air / Land / Sea).

---

## K. Loss of Control & crashes

**K1.** Lost Control is a table whose results range from small (a dramatic shift in direction) to
large (flipping over). If a result changes speed or direction, the result says so. Otherwise play
just continues.

**K2.** No recovery roll. The driver is presumably unhappy with the situation and will use
Maneuvers to fix it.

**K3.** The Lost Control table can be triggered by Sharp Turn failure, Hard Brakes failure, drift
overshoot, or GM fiat.

**K4.** Crash damage is either rolled damage to the vehicle or setting its HP and/or SP to a value
(e.g. the lower of current HP and 2), and it triggers the Critical Damage table. Some results
already damage passengers, but the consequences can be complex enough that they are best left to
the GM.

---

## P15. Wreck state (HP = 0)

The vehicle becomes a **static obstacle** — still rampable and climbable. The GM handles
everything from there. The token is left where it is, with every stat except **Size and SP (if
any is left)** set to 0. Any remaining vital regions are still there. There is little point in
shooting the wheels off a burning wreck, but you can.

---

## N33–N34 / P8–P11. Mounted weapons & gunners

**N33.** Mounted weapons are fired **from the gunner seat**. The simplest approach: temporarily
add the mounted weapon to the character as equipped gear while they occupy that seat, after
which all established weapon mechanics apply.

**N34.** Mounted-weapon facing is **independent** of vehicle heading (turret-like) and, unless
something outside the core vehicle system says otherwise, unrestricted. The GM handles details.

**P8.** When a character takes the gunner seat, their existing weapon is **automatically stowed**,
and restored when they leave.

**P9.** Ammo for mounted weapons is **vehicle-stored**. Reloads pull from vehicle inventory.

**P10.** Switching between gunner seats mid-combat is standard movement, no extra action cost.

**P11.** With multiple gunner seats on one mounted weapon, **only the active gunner matters**.
The GM handles any extra complexity.

**Cross-cutting:** mounted weapons reuse the existing weapon Item type with a `mountedOn` flag —
a new type would only create duplication.

---

## P12–P14 / N7–N8. AE taxonomy for vehicle stats

**P12.** Character AEs already use string paths in `changes[]`, but they do not overlap with what
vehicles need — investigate before reusing.

**N8.** The two AE flavours are **new** and need modelling: an AE tagged "Handling stat" (capped)
versus one tagged "Drive check (Vehicle X)" (uncapped).

**P13 / N7. The +4 Handling cap applies to the SUM of all AE bonuses**, not per AE. Three AEs
granting +2 each = +6 raw, clamped to +4. It applies to the **bonus side only**: a vehicle with
base Handling −3 plus +5 from mods is clamped to base+4 = +1. If any change is meant to alter the
*base* value, the author will say so explicitly.

**P14.** The cap applies **only to positive bonuses**. Penalties are uncapped — a −8 Handling
penalty from accumulated damage AEs is allowed.

**Vehicle AEs default to applying to the vehicle only**, not propagating to attached tokens.

---

## L. UX

**L1.** Maneuver picker: a HUD button that opens a small picker, with a confirm step.

**L2.** Detach: a Token HUD overlay button on the attached passenger token, plus a "Detach" entry
in the vehicle's combat-tracker context menu.

**L3.** Driver identification on canvas: an **icon placed on the token** (the author will design
it — likely a steering wheel).

**L4.** In multi-vehicle scenes, each driver sees **only their own** vehicle's HUD.

**P18.** Pending Maneuver visibility: the **GM sees it, other players do not**. Players can tell
each other if they want.

**N31.** The combat tracker should show Handling next to vehicle combatants so the ordering is
obvious, plus an indicator for which driver-slot was chosen.

**P19.** Vehicles re-roll the Handling tiebreak **each combat** — it is not persistent.

---

## Cross-cutting notes

- **Compendium materialisation:** dragging a vehicle from a compendium to a scene must create its
  blueprint regions at the right world coordinates with behaviors bound to the new token's id.
  Test dropping two of the same vehicle (no id collisions).
- **Multi-piece vehicles** (truck + trailer) are deferred to v2. v1 supports one Actor = one rigid
  bundle.
- **NPC drivers:** ideally both the HUD and macros are available, but **macros are required**,
  since the GM may control more than one vehicle.
- **Insulation** (for EMP-type effects) is GM-tracked; the GM corrects as needed.
