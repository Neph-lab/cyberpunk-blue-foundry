Subsystems & vital areas — the relationship
N1. Are vital areas always backed by a subsystem, or can a vital area exist without one? Three plausible models:

(a) Every vital region IS a subsystem (1:1)
(b) Vital regions optionally link to a subsystem; if no link, hitting the vital just routes damage to vehicle main HP but binds the Critical Damage entry on crit
(c) Vital regions and subsystems are entirely orthogonal — vitals control attack routing for crits only, subsystems track parallel HP pools
Lean: (b). Confirm?
Confirmed.

N2. What does "destruction" of a vital area mean if it's not backed by a subsystem with HP? Is it the moment the Critical Damage entry actually fires? Or does it persist as a takeable hit?
Yes, that's when the effect set for the Region is triggered. The result remains a possible result on the Critical Damage table.

N3. Subsystems with HP — do they have their own crit threshold (2+ sixes) firing a subsystem-level Critical Damage roll, or is crit only at the vehicle level?
It triggers Critical Damage, with the roll result applied to the vehicle as a whole.

N4. Can a subsystem have its own SP independently of vehicle SP, or does vehicle SP always apply first and subsystem SP is the fallback? I assume independent — confirm.
Confirmed.

N5. When a subsystem is destroyed, its destruction effect is an AE on the vehicle. Does the subsystem item itself stick around (so it can be repaired) or is it deleted?
Sticks around but has no effect and is no longer a possible target until repaired. Repair specifics are handled by the GM who will restore systems, HP, and/or SP as appropriate.

The system-wide SP rule
N6. The "highest current SP source wins" rule in E3 — is this a new rule you're formalising now (which means character damage routing needs the same refactor), or already in place? If new: should it apply to character vs character damage too, retroactively?
It is already implemented, if not explicitly, with intentional fuzzy logic to allow some player agency.

Handling cap math
N7. "Adjustments to Handling can't increase Handling by more than 4 in total." Does this cap apply to the total raw value, or only to the bonus side? E.g. a vehicle with base Handling −3 plus +5 from mods = +2 cap-clamped at base+4 = +1?
Bonus, as in that example. If any change is meant to change the base value, I will specify that explicitly.

N8. The cap applies only to non-skill-roll-specific adjustments — i.e. an AE tagged "Handling stat" is capped, but an AE tagged "Drive check (Vehicle X)" is not. Are these two AE flavours we already model elsewhere, or do we need a new AE-target taxonomy for vehicle stats?
They are new.

Initiative edges
N9. Driver delays, then dies. New driver enters the driver seat. Does the new driver start at their own initiative slot, or inherit the delayed slot?
The new driver remains in their old initiative spot, but may delay delay until just before the vehicle at that point, should they choose to.

N10. Driver delays. The vehicle is destroyed. The driver is now in vehicleInit − 0.001 slot. Do they get to act normally there next round, or revert to original?
They act at the initiative they have after delaying. The original position in Initiative can safely be discarded.

N11. Vehicle initiative with delayed-driver RS bonus: is this re-computed each round (so a new driver re-shifts it), or locked at first computation?
Locked at the first computation.

Maneuver declaration vs execution
N12. When a non-delayed driver declares Sharp Turn at their own turn, the Drive check rolls WHEN — at declaration (driver's turn) or at execution (vehicle's turn)? Declaration is simpler; execution allows for interrupts.
At declaration. The actual results of that roll might of course change du to outside factors, but it will be performed according to the roll at declaration.

N13. Can the driver change their declared Maneuver between their turn and the vehicle's turn? (E.g. they declare Sharp Turn, then an enemy moves into Ram range and they want to swap.)
No. That's why they want to delay until before the vehicle's turn. To know what the situation will actually be like when the Maneuver happens.

Coast turns
N14. "Mostly same speed" — is this applied when the driver did not take a delayed-Maneuver path AND did not move to their own slot AND took no driver action? I.e. is this "I'm not driving this turn" / "passive driving" mode?
Passive driving.

N15. Does "coast" still consume an action / movement on the driver's turn, or is it free?
It's free. Of course, if the character leaves the driver's seat they are no longer driving and therefore can't coast.

Sharp Turn formula
N16. The Sharp Turn DV table — I'll mock one up with anchors at DV 10/15/25 over speed bands {parked, 1-5, 6-15, 16-30, 31+ hexes/turn} × turn-angle buckets {31-45, 46-90, 91-180, 181-360}. Confirm the speed and angle bucket boundaries, or override.
Confirmed.

Hard Brakes specifics
N17. Confirm or override: DV 15 for ACC×2, DV 25 for ACC×3.
Confirmed.

N18. On a successful Hard Brakes, does speed drop by exactly ACC×2/×3, or by the driver's choice up to that maximum?
Maximum or until Speed is 0.

Ram details
N19. "Regular interval" for +1d6 damage scaling — initial guess: every 4 hexes/turn of speed? Or Size × N so larger vehicles pile on dice faster?
Size × (Speed/5)

N20. "Margin reduces damage to ramming vehicle as extra SP" — is this an extra SP value (e.g. margin of 7 = +7 SP for this collision), or proportional damage reduction?
To simplify, reduce damage by the margin before comparing to SP.

N21. Target's Swerve result as Ram DV — confirm: if Swerve roll was 22, then Ram DV = 22 instead of 13 + Handling?
Confirmed.

N22. Foot target with RFLX 7: auto-hit at margin 10 (using 10 as the "rolled" result). Confirm.
Confirmed.

Swerve details
N23. Swerve protects until the vehicle's next turn. If the vehicle is destroyed before its next turn, does Swerve still protect remaining occupants?
No. Nor are they protected if they leave the vehicle.

N24. Multiple drivers in a single combat — if one driver Swerves and is replaced, does the Swerve effect stay until the original vehicle's next turn, or the new driver's next turn?
The Swerve happens on the Vehicle's turn. Someone in the Driver's seat decides which Maneuver the vehicle will take. If driver A selects a Maneuver, but is replaced by driver B before the vehicle's turn, driver B can override which Maneuver the vehicle will take.

Vital region UX
N25. When the GM places vital regions on a Token, the changes propagate back to the Actor's blueprint. But what if the Actor is in a compendium (locked)? Do edits go to the world copy, or do we unlock the compendium each time? Lean: world copy; compendium is the "factory default" baseline.
Agreed.

N26. Can the GM move/resize/reshape an existing vital region on a placed Token, or are vital regions immutable once materialised from blueprint? Edits-and-resync workflow vs read-only.
Edit-and-resync.

N27. Vital region visibility on the scene layer when "target vitals" is active — visible to attacker only, or visible to everyone with vision on the vehicle? Lean: attacker only.
Attacker only.

Roof regions
N28. A roof region's purpose — does it gate enclosesRiders per area (so a convertible has no roof region, an SUV has full roof), or affect cover/LOS calculations, or both?
enclosesRiiders toggle. LOS and the rest can be handled by built-in Foundry functionality and GM fiat.

N29. Does the roof being shot off (subsystem destruction) toggle enclosesRiders from true to false?
Yes.

Reverse state
N30. Reverse mode is an AE-driven state. How does the driver enter reverse — a Maneuver? An out-of-combat toggle? Implicit when speed crosses 0 with Hard Brakes?
Once Speed is 0, it can be increased in a negative direction as if it was forwards, with the limitations of the AE in place. This could be modelled as negative speed and later be replaced by a vector rather than a scalar.

Initiative display
N31. Should the combat tracker show Handling values next to vehicle combatants so the ordering is obvious? Plus an indicator for which driver-slot was chosen?
Goo ideas — yes.

Drift tables
N32. Drift table per category — are these the same table as Lost Control, or separate? Re-reading: J2 mentions overshoot triggering "Losing Control table", so drift escalation uses the same Lost Control table. Confirm.
The Drift calculation is what happens when no driver is in the driver's seat and determines how much the vehicle will veer off in what direction. If that Drift results in too radical a turn, it is one of the things that can trigger the Lost Control table. That table is separate for Air, Land, and Sea.

Mounted weapons
N33. Can a mounted weapon be fired by any occupant or only by a designated gunner seat? Different from regular Use Equipment Maneuver?
From the gunner seat. Easiest is probably to temporarily add the mounted weapon to the Character as equipped gear while they're in the gunner seat. All weapon mechanics for it then follow the established mechanics.

N34. When the vehicle moves, mounted-weapon line-of-fire updates with the vehicle's heading? Or is the weapon's facing independent (turret)?
Independent and, unless something unrelated to the core vehicle combat system says otherwise, unrestricted. The GM handles details.