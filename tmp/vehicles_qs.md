Q-A. Vehicle stats & categories
A1. Confirm stat set: hp, sp, move, maxMove, acc, handling, size. Anything missing? Reliability? Fuel? Mass (for ram damage)?
HP, SP, maxMove, ACC, Handling, and Size. There are Subsystems with their own SP and HP, usually as the result of a Vehicle Modification (new Item type). The number of seats. Locations of vitals. What parts of the vehicle has a roof (using roof tiles or defining region boundaries should do this).

A2. Is move the "cruise / default speed", and maxMove the cap; or is move the per-turn-hex distance that changes round-to-round (in which case it's the runtime speed and maxMove is the cap)? I lean towards: rename to cruiseMove + maxMove, with runtime currentSpeed separate.
maxMOVE is the highest. The other value is currentSpeed — it's only called MOVE to help players understand that it will define how far the vehicle will move just like their own MOVE defines how far they can move. But no, it's currentSpeed, expressed in typical grid-units per round, which translates to 2 meters per 3 seconds. Any time this means the speed exceeds 35 km/h or 20 mph, the speed should be given in those units as well. Users should individually be able to change between showing both, neither, or one of them in settings.

A3. Handling — single number on a 1-10 scale, or a stat with sub-values (e.g. "+1 to all Drive checks, max veer angle 30°")?
A single number between -5 and +5 added to Drive checks with the vehicle. AEs might temporarily change this and Abilities/Gear/Cyberware/Vehicle Mods might change handling specifically for one type of roll. However, adjustments to Handling, as opposed to adjustments to the Drive check the Handling will affect, can't increase Handling by more than 4 in total. The exact limit might change in response to playtesting.

A4. Categories: are Land / Sea / Air / Submarine exclusive, or can an amphibious car be [land, sea]? Maneuver gating depends on this.
Land / Sea / Air (submarines are Sea vehicles with access to the Dive/Rise actions). Maneuvers might need the GM to select the ones that can be accessed for any given vehicle, with defaults set up. Vehicles can be both Land and Sea, for example, but they can be trusted to only act as one of them at any given time. This matters for drift tables.

A5. ACC limits both up and down by default? Or is Hard Brakes a separate ACC-bypassing Maneuver (e.g. "you can lose ACC×2 in one turn")?
ACC limits both up and down, equally by default, but some vehicles will have something that boosts either. Hard Breaks works exactly as you surmised. The vehicle's speed can be reduced up to ACC×2 instead of just ACC, with a check. Or up to ACC×3 with a very, very hard check.

A6. Is "parked" (speed 0) a distinguished state with special rules, or just speed=0?
Just currentSpeed=0.

Q-B. Initiative & turn flow
B1. Vehicle's own initiative — what's the formula? Driver's RFLX + something? Vehicle's own Handling? A fixed value? I'd suggest: driver's RFLX + ½ Handling, fallback to ½ Handling when no driver.
Vehicles start by losing Initiative against every non-vehicle participant. Amongst themselves, they are ranked according to handling (randomized in the case of a tie. Drivers can choose to stay where they are in initiative and select the Maneuver which won't actually take place until the vehicle's turn, or they may choose to move to just before the vehicle in Initiative (sacrificing some time getting their bearings). When they stop driving they stay where they are in order. If there's ever a reason why a vehicle would have a higher initiative, that would be on the GM.

B2. "Delay to just before vehicle" — implementation: re-sort initiative on the fly (recompute combatant.initiative to vehicle's − 0.001), or a held-action flag that triggers an out-of-band turn? The former is simpler.
The former.

B3. When the driver delays, does that delay carry over to subsequent rounds, or is it a one-round decision?
They stay where they are in order from that point onwards.

B4. What if there are multiple people in the driver seat / two cockpit seats (e.g. fighter with pilot + co-pilot)? Does the Region behavior allow N drivers, or strictly 1?
Strictly 1 for any movement. Anything more complex will be handled by the GM.

B5. If the driver becomes incapacitated mid-round (after taking their turn but before the vehicle's), does the vehicle's turn proceed with the now-unmanned rules immediately, or only next round?
The vehicle will execute the Maeuver, if there was one, and then Drift.

B6. Vehicle with no occupants at all: does it still get an initiative slot? Probably yes (for drift), but how is initiative rolled? Pure Handling?
Yes. It stays where it is in the order and get there as per B1.

Q-C. Speed & movement semantics
C1. Hex scale for vehicle combat — same as foot scale (2m / hex) or a different vehicle scale (e.g. 10m / hex)? If different, do Maneuvers happen in vehicle-scale combat only and not when mixed?
The same scale, because combat is likely to be mixed, with someone jumping between vehicles or some other shennanigans. Unfortunately this will mean huge Scenes.

C2. Vehicle moving its full MOVE — does it travel in a straight line for the entire distance, or can the driver "steer" mid-turn (a curving path)? If the latter, are tight turns mid-path measured against Sharp Turn DV?
At one point during the vehicle's turn, the driver can plan for it to veer up to 30° (one side on a hex — my paper rules allow 45° on a square grid, but we can afford to be exact). Turning more than this, or turning several time (weaving through traffic, for example) requires the Sharp Turn Maneuver. The DV for the Drive check for that Maneuver depends on the total degrees of turn (30° left, then 30° right is equal to 60° either direction) and the currentSpeed.

C3. What happens when a vehicle's path during its turn would cross an existing token's space mid-travel? Stop on impact? Continue and apply run-over damage? Auto-Ram if speed > threshold?
Stop on impact to let the GM figure out what else might need to be considered in the narrative. Also, it will deal the base Ramming damage.

C4. "Continue at mostly the same speed in mostly the same direction" — formalised? E.g. ±15° heading, ±0 speed change? Or pure narration?
±30° (as per C2), ±higher(ACC/2, currentSpeed/4) (minimum 1) currentSpeed. The speed change can be handled narratively if needed.

C5. Is rotation around the vehicle's pivot point quantised (45° / 30° steps) to fit hex angles, or freeform (any angle)?
Rules are originally written with a hex-grid in mind to allow even tired human minds to imagine the pathways. Ideally, this could run entierly gridless.

C6. Air vehicles & submarines — vertical movement. Is altitude a discrete number on the token (already a Foundry concept) or a separate layer concept?
Relying on Foundry is the way to go.

Q-D. Maneuvers — formulas
D1. Sharp Turn DV — proposal: DV = 10 + currentSpeed + (turn_angle_degrees / 15). Confirm or override.
It is currently a table, which is less ideal than the calculation you suggested. The table exists to apply a logarithmic aspect to speed as dangerous turns at high speeds aren't realistic, but they're a staple of the genre. The DV should end up at 10 for a drive to work, 15 for turning a tight corner with screeching wheels in the city, and 25 for daring action sequences where intentionally making the car flip 360° is a strategy.

D2. Hard Brakes — speed drops by ACC×2 (or ACC×3?), DV = 15 + currentSpeed/3. Outcome on fail?
Yes. On fail, the driver gets a rolled result from the Lost Control table. Spinning uncontrollably in random directions while dropping ACC×3 in Speed until it comes to a stop, flipping over and sliding currentSpeed/5 meters (and dealing maxiumum Ramming damage to itself)... That sort of thing.

D3. Aerobatics — single roll for a stunt, DV based on what? Pure narrative outcome, or specific mechanical effect (Swerve-like)?
This is narrative or handled by the GM. But yes, a single roll (DV17 by default) for a stunt.

D4. Dive/Rise — DV scaling? Limited per-turn altitude change?
Maximum per-turn change: lower of ACC and currentSpeed. Some vehicles will override that limitation with something. A hot-air balloon will be able to rise or dive much faster, for example. On later turns, the vehicle can alter its elevation by ACC×2 meters per turn as part of it normal movement — assumed to happen gradually across that same time. This Maneuver works as Sharp Turn but when the turn is in pitch or roll rather than jaw.

D5. Jump (ramp) — DV based on speed and gap distance? Damage if failed?
Yes. There are too many factors to anticipate all of them, however, and this will have to be dealt with by the GM.

D6. Ram — attack roll vs target's effective DV (size + speed). Damage to ramming vehicle = ½ damage to target? Damage scales as speed × massFactor?
Yes, damage scales ass Speed×Size, adding 1d6 damage at each of a regular interval (which will need testing). Base Ramming damage is dealt to buth the Ramming vehicle and its target. When it happens as the result of a Ram Maneuver (as opposed to hitting something when th driver Lost Control, for example), the Ramming vehicle may treat its SP as being as much higher as the margin by which the driver succeeded. The DV to Ram another vehicle is 13+the target's Handling (or the result of the target's Swirve, if that's the last thing the other vehicle did). Characters with RFLX 8+ may try Evasion if moving 2 meters would get them to safety. In all other cases it's a success — use 10 to calculate the margin of success.

D7. Swerve — what specifically does it do? Add DV to incoming attacks for the rest of the round? Until next turn? How much?
Until the Vehicle's next turn, attacks against it and anyone on/in it are treated as if they had rolled Evasion with the result of the Driver's check. Characters without high enough RFLX to be able to Evade bullets themselves can still benefit from being in a vehicle where the driver Swirves.

D8. Use Equipment — single Maneuver per turn (you can only fire one mounted weapon)? Or umbrella for "trigger any one vehicle-mod"?
The latter. It's a catch.all.

D9. Maneuvers requiring skill rank or specialty? E.g. Aerobatics requires Pilot skill rank ≥ N?
Any such restrictions are handled by the GM. No one can benefit from Handling higher than their Drive skill.

D10. Multiple Maneuvers per turn possible (one per "action slot")? I assumed strictly one — confirm.
Strictly one.

Q-E. Damage routing
E1. When attacking the vehicle itself (not occupants), does damage hit SP first then HP (like personal armor + HP), or is vehicle SP a separate ablating buffer with its own DV?
Like personal armor.

E2. Vehicle SP — does it ablate per hit like character SP? Does it reduce damage by SP value, or block until pierced?
Like regular armor. If damage > SP, then -(damage-SP)HP; if damage ≥ SP, then also -1 SP.

E3. When firing at occupants of an enclosesRiders vehicle: SP applies first; if SP holds → no damage at all to occupant? Or → reduced damage?
In all cases when several sources of SP could apply, the one with the highest current SP is used (highest Max SP as 1st tie-breaker, otherwise latest used or random). This is why Characters have to choose armor for their SP instead of adding. Thus, if the vehicle's currentSP is higher, it's used. The armor ablated is the one used. Damage ≤ currentSP for the vehicle has no effect on passangers, just like regular armor would block effects on a character.

E4. Open-top vehicles (bikes, convertibles, sidecar) — enclosesRiders=false. Does this mean SP never applies to occupant attacks, or partial protection?
Never, but see A1.

E5. "Shooting off a door to bypass SP" — system support? Or GM narration that adjusts SP on the fly? I lean: GM ad-hoc, with a Vehicle HUD button to temporarily zero a section's SP.
I concur. That's the best way to handle it.

E6. Cover from being a passenger — partial or full cover bonus? Or no system-applied bonus (vehicle SP is your protection)?
Vehicle SP is the protection. The rest is narrative.

Q-F. Critical Damage
F1. Crit threshold — same calculation as character serious-wound (½ max HP)? Per-vehicle override?
Critical Hit is the same as for characters (2 ≤ results of 6 among damage dice). Serious Damage AE at ½ max HP lowers Handling by 2.

F2. Universal RollTable, or per-category (land vs sea vs air)?
One per category. While similar, they're different enough that this is easier.

F3. Crit Damage entries — applied as Active Effects with mechanical impact (e.g. "Engine damaged: −2 ACC, can't accelerate"), as descriptive text + GM applies, or both via the existing critical-injury system?
Similar to the existing, it's either an AE with both mechanics and description, or an AE with description and complex enough consequences that the GM needs to handle them.

F4. Stack crits? Multiple "Engine damaged" allowed?
Yes.

Q-G. Vital areas
G1. Defined per template (compendium) or per instance (drag-and-drop to scene then GM edits)?
Ideally, the GM can set them up on each vehicle's Token and they are then remembered for whenever the Actor is added to a scene, if the Actor is dublicated, added to a Compendioum and then imported, etc.

G2. When "target vitals" is toggled, what's revealed: bounding outlines of vital regions on hover-target? A list dropdown in the attack dialog? Both?
The Regions defined as such becomes visible on a Scene layer the player can see. There needs to be some sort of "select region as target" UI. The player uses the Attack button on their sheet as usual after that.

G3. Penalty to hit a vital — assumed same as character vital. Is that penalty data-driven (a system config) or hardcoded?
Hardcoded. Same as for character vitals. Any changes come from other aspects.

G4. Critical Damage table — does hitting a vital area let you pick the corresponding crit entry, or does it just guarantee a crit roll with that area as the result?
A "Vehicle Critical Location" region should offer to select Critical from the table to apply when destroyed, but require it. A future feature is to have the region prepare enough data to create an AE on the vehicle when destroyed.

G5. Can a vital area be destroyed and then no longer be a valid target? (Engine already shot to hell — does it still appear?)
Yes.

Q-H. Relative-speed penalty
H1. Step size and penalty per step — proposal: floor(|relSpeed| / 4) × 1 penalty (stepped, max −10). Override?
Approved.

H2. Vector or scalar? A car overtaking another at +2 vs. a head-on at +12 are very different. Scalar is simpler; vector is realistic. Lean: scalar is fine for v1.
Scalar is fine for now, but implementing a vector solution will be a priority for v2.

H3. Foot-target shot by moving vehicle — is the foot target's "speed" treated as 0, or as the relative speed?
Its Speed is the MOVE it used last turn.

H4. Speed penalty applies symmetrically to both sides (attacker AND defender), or only to the moving party?
Symetrical.

Q-I. Size bonus
I1. Size scale — fixed enum (S/M/L/H/G) with associated bonuses, or freeform integer per vehicle? Lean: enum with mapping.
Theoretically enum with mapping, but both are given to help different players remember, i.e. "1 (Small)".

I2. Affects only to-hit, or also damage routing (bigger vehicles harder to crit?)?
Only to hit.

Q-J. Unmanned drift
J1. "Prepared to sit at the wheel" — exact meaning? Proposal: a token is in the driver Region and has not been declared "not driving" (so just being there counts). If you want to ride along without driving, you sit in a passenger seat.
Yes, exactly.

J2. Veer formula — proposal: veer_angle = roll(1d10 − Handling) × 15°, applied L or R randomly. Confirm or replace.
This is better than my original concept, but adding 5 since Handling can be negative. If this ends up being more than 30°, roll 1d6 and if the result ≤ steps of 15° beyond 30, also roll on the Losing Control table.

J3. Half-ACC speed reduction — does it floor at 0, or can it go negative (= reversing)?
It can reverse. maxMove is ½ and Handling -2 in reverse (should be an AE) and hopefully not common.

Q-K. Loss of Control & Crash
K1. When in LoC, does the vehicle still move at the driver's intended speed, or auto-coast at last speed?
Lost Control is a table that can result in small things, like a dramatic shift in direction, to large, like  flipping over. If there is a change to Speed or direction, the result specifies it. Otherwise, play just continues.

K2. Recovery — is it a Drive check vs a fixed DV on the driver's next turn, or scaled by current speed?
The driver is likely unhappy with some aspect of their situation after losing control and will use Maneuvers to solve that. There is no need for a specific roll.

K3. Crash table — when triggered: after veer overflow only, or also on Sharp Turn / Hard Brakes critical-fail?
It's the Lost Control table and it can be triggered by all of those or GM fiat.

K4. Crash damage — to vehicle: % of max HP? To passengers: based on speed?
Either rolled damage to the vehicle or setting its HP and/or SP to a value (e.g. the lower of current HP and 2), and triggers the Critical Damage table. Some of these results will already damage the passengers, but the consequences can be complex enough that they are best left to the GM.

Q-L. UX
L1. Maneuver picker — modal dialog on driver's turn, or persistent HUD with buttons? Lean: HUD button that opens a small picker, with confirm step.
I agree.

L2. Detach button — where? Lean: Token HUD overlay button for the attached passenger token, plus a "Detach" entry in the vehicle's combat-tracker context menu.
Yes.

L3. Driver identification on the canvas — colored aura on driver token? Crown icon? Or only in the vehicle HUD listing?
An icon (which I  will design, likely a steering wheel) placed on the token.

L4. Multi-vehicle scenes — does each driver only see their own vehicle's HUD, or all of them?
Only their own.

Cross-cutting concerns to write down
-- I have given lines starting with -- to reply to the ones of these that I can already answer clearly.
These don't need Phase 0 answers but I want them in the open:

Compendium materialization for blueprint — when a vehicle is dragged from compendium to scene, its blueprint's regions must be created at the right world coordinates with their behaviors registered to the new token's id. Test the case where two of the same vehicle are dropped (no id collisions).
Multi-piece vehicles (truck+trailer) — defer to a v2; v1 supports one Actor = one rigid bundle.
Driver-grant from cyberware — should "Reaction Speed" rank on the driver factor into vehicle initiative? Probably yes via the existing rank-bonus plumbing.
-- When the character delays their turn to before the vehicle's, they may treat the vehicle as having rolled the character's Reaction Speed + vehicle's Handling (minimum 0).
NPC drivers — when an NPC controls a vehicle, does the GM act on its turn directly via the HUD, or via macros?
-- Ideally, both are available but Macros are needed since the GM might control more than one.
Mounted weapons — reuse weapon Item type with a mountedOn: vehicleId flag, or a new vehicle-weapon type? Lean: reuse, with a flag. New type creates duplication.
-- Reuse with flag.
Vehicle's own Active Effects — engine damage, fire, etc. Apply as AEs on the Actor, propagate to attached tokens via the existing AE transfer rules.
-- Yes. Default is that they only apply to the vehicle.