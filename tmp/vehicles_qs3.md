P1. At Maneuver declaration, what exact data does the driver lock in? Specifically:
Speed change and direction based on just cruising (no Maneuver needed), Speed change (Accelerate/Decelerate, Hard Breaks), Direction (Dive/Rise, Sharp Turn), or setting up for a specific situation during the Vehicle's turn: Jump (for the GM to handle), Ram (to handle impact better), or Swerve (to make it harder to hit).

Sharp Turn: declare the angle? Or declare "I want to turn", and the actual angle is locked at execution by the driver-seat occupant's hand on the wheel UI?
The UI would allow the user to extend a line from the vehicle to a point it could reach within safe cruising rules. They select a point on that line and then select a line with the same limitations from that point. The UI for Ricochet point for Power Weapons is a good base. These lines are vectors — not absolute points. If something knocks the vehicle off-course, it will still execute on the vectors as best it can, not readjust to reach the selected points. The angle between the two lines that deviates from going straight ahead is the turn angle for the Maneuver.

Ram: declare target? At execution-time the target may have moved.
The Ram maneuver should place a "Ramming" AE on the vehicle, along with the result of the check. When it hits something during the vehicle's next turn, allow a target to try to avoid if applicable and then reduce the damage by the margin (or steps above 10 if the target wasn't one that could try to evade).

Accelerate/Decelerate: declare amount (up to ACC) or always-max?
Declare the amount

Hard Brakes: which tier (×2 / ×3) chosen at declaration?
Chosen at declaration.

Lean: declare type + parameters fully at declaration; execution applies them verbatim. If circumstances changed, that's the cost of not delaying.
Exactly.

Driver-seat occupation rules
P2. If a token sits in the driver seat but then leaves on their own turn (before the vehicle's turn), are they still considered "the driver" for the pending Maneuver until the vehicle's turn? Or does leaving the seat immediately invalidate the Maneuver?
Yes, they're the driver for the Maneuver only. If no new driver takes the seat before the vehicle's turn, it will be drifting after the Maneuver.

P3. If the driver-seat is empty at the vehicle's turn (no one took over), but a Maneuver was declared earlier in the round by the now-departed driver, does the Maneuver still fire? Per B5 it does for the death case. Confirm symmetric behaviour for the "walked away" case.
Confirmed..

P4. "Token in driver seat with no Maneuver declared" — should the system prompt the driver to confirm coast, or is silence = coast automatic? Lean: silence = coast, with a HUD button to declare a Maneuver while it's the driver's turn.
The driver can set up changes within the boundaries of cruising without using an action. If they do nothing before ending their turn, the vehicle cruises with maintained Speed and direction.

Subsystem damage routing
P5. Overflow damage from a subsystem: if a subsystem has 5 HP and takes 12 damage, does the overflow (7) cascade to vehicle main HP, or is it absorbed entirely by the subsystem (HP goes to 0, done)? Cascading is realistic; absorption is simpler and protects the vehicle from being one-shot through a critical subsystem.
Absorption.

P6. When a subsystem has its own SP, does the subsystem's SP also ablate per hit (like vehicle SP / character armor), or is it a static value?
It ablates like any SP.

P7. Hitting a vital area linked to a subsystem when that subsystem is already destroyed — does damage still route somewhere (back to vehicle main?), or does the attack just become a "thump on shattered glass" with no effect because the vital is disabled? Per N5 destroyed subsystems can't be targeted, so this might be a UI-prevention case.
A sub-system Region that has been destroyed can't be targeted. If there's both an "Engine" subsystem that has been destroyed and the Critical Damage table says the engine is destroyed, it's up to the GM to resolve that in the narrative. The same goes in the other direction.

Mounted weapons & gunner ergonomics
P8. When a character takes the gunner seat, the mounted weapon is synthetically added to their equipped gear. What happens to their existing two-handed primary weapon — forced into stow, briefly co-equipped, or do they sit-down-then-pick-up-then-shoot? Lean: automatically stowed when they sit, restored when they leave.
Agreed.

P9. Ammo for mounted weapons — vehicle-stored or character-stored? Lean: vehicle-stored. Reloads pull from vehicle inventory.
Agreed.

P10. Can a single character switch between gunner seats mid-combat? Mechanically a movement and a re-equip; how much action cost? Lean: standard movement, no extra cost beyond moving.
Agreed.

P11. Multiple gunner seats on a single mounted weapon (e.g. crewed howitzer) — does each gunner contribute somehow, or only the active gunner matters?
Only the active gunner. The GM handles any extra complexity.

AE taxonomy mechanics
P12. The new vehicle-targeted AE keys — these need to integrate with existing AE plumbing. Are AE changes[] already keyed by string path (like system.handling.bonus), or is there a custom tag system I should hook into?
There are string paths for characters, but I don't think they overlap. Investigate.

P13. "Handling bonus capped at +4 aggregate" — does this cap apply per AE (each AE clamped to +4) or to the SUM of all AE bonuses (total clamped)? Lean: total. So 3 AEs each granting +2 = +6 raw → clamped to +4.
Yes — the sum.

P14. Does the cap apply only to positive bonuses or also to penalties? E.g. is a -8 Handling penalty from accumulated damage AEs allowed, or clamped to -4? Lean: penalties uncapped, bonuses capped.
Confirmed.

Edge cases worth pinning down
P15. Vehicle HP reaches 0 — what's the resulting state? Static obstacle (still ramps-able, climbable)? Removed from canvas? Token becomes "wreck" with own properties?
It's a static obstacle, but the GM handles everything from there. The token is just left where it is, with every stat except for Size and SP (if there's any left) set to 0. Any vital regions remaining are still there. There's little point in shooting the wheels off a burning car wreck, but you can.

P16. Aerobatics fail — DV 17 single roll. Failure → Lost Control roll, or narrative-only (GM-call)?
Lost Control.

P17. Acceleration/Decelerate as Maneuvers cost both action and movement. This means a driver can't accelerate AND shoot in one turn (without delaying and coasting the next). Confirm this is intentional, or is there a "minor adjust speed" coast variant that's free?
Confirmed for the Maneuver. Cruising is the minor changes that still allow them to shoot as it doesn't require an Action.

P18. Pending Maneuver visibility — does the GM see what the driver has declared before the vehicle's turn? Other players? Lean: GM yes, other players no.
Agreed. Players can tell each other if needed.

P19. Initiative re-roll between combats — confirm vehicles re-roll Handling-tiebreak each combat (not persistent).
Confirmed.

P20. Foot-character → vehicle Ram via running into it — possible at all? Or is Ram strictly vehicle→target?
Ramming damage happens to both a vehicle and what it hits whenever they collide for any reason. Two vehicles colliding deal their ramming damage to each other. This includes walls and regions that block movement, though the consequences beyond stopping the vehicle would have to be managed by the GM. The advantage of taking the Ram Maneuver is the extra protection from damage reduction.