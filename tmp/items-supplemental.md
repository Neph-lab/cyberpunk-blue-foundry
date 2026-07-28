If it doesn't already exists, it's worth implementing a standard function for non-lethal damage that can be used for several attacks. It checks if the target's HP after the attack is ≤ 0, in which case HP is set to 1 and the target is Unconscious.

# Weapons
## Onibi Plasma Caster (Experimental)
Considered a Flamethrower.
*Manufacturer:* Arasaka
*Cost:* EX
*Description:* <p>4/6 cone that deals 2d6 damage.</p><p><strong>Malfunctions:</strong> After firing, roll 1d10. On a 9 or 10, those in a 4/6 cone in front of the user, <em>and the user</em> take another 2d6 from the toxicity. This toxic damage bypasses SP and doesn't ablate it.</p><p><strong>Explosion Risk:</strong> The tank has 5 HP. If broken while it has ammo, the weapon detonates in a 2/4 explosion that deals 6d6 damage.</p>
*Implementation:* Cone: 2d6 damage, spread 6, ½ Damage 4. After handling everything else regarding the attack an (potentially damage), roll (and report to chat) 1d10. If the result is 9 or 10, consider it an immediate additional attack that the character can't stop. The attacker is considered within the inner radius of the cone for the sake of damage and evasion. The explosion risk is fully handled by the GM.

## Budget Arms Slaught-O-Matic
*Manufacturer:* Budget Arms
*Cost:* CH
*Description:* Extremely cheap SMG available in vending machines. Can use autofire, but will jam when rolling 1 on the attack die. Also, it's designed with a fused magazine which prevents reload and components will helt into each other, making the gun single use.
*Implementation:* SMG that deals 2d6 damage and isn't Power, Tech, or Smart. It has Autofire with ×3 multiplier. It uses the sam Jam mechanic already present elsewhere. It doesn't have the reload button in the Weapon's table. Anything else is handled by the GM.

## Zetatech Microwaver-55
Considered a Very Heavy Pistol.
*Manufacturer:* Zetatech
*Cost:* VEX
*Ammo:* Battery instead of Very Heavy Pistol ammo.
*Description:* Doesn't deal damage but the target must make a <strong style="color: var(--cpb-accent)">DV15</strong> <strong>TECH</strong> + <strong>Endurance</strong>, or two random non-insulated cyberware are disabled. They can be rebooted with a <strong style="color: var(--cpb-accent)">DV15</strong> <strong>TECH</strong> + <strong>Electronics (Cybernetics)</strong> check as an Action.
*Implementation:* Standard affliction attack, DV15 TECH+Endurance or gain an AE that disables two random cyberware (should exist somewhere in the codebase). The rest is handled by the GM.

## Crossbow "Eagletech Fletcher"
*Manufacturer:* Eagletech
*Cost:* PR
*Description:* A crossbow designed for sports. Taking down enemies can be a sport.
*Implementation:* Bow/Crossbow defaults.

## Grenade-Launcher
*Manufacturer:* Militech
*Cost:* EX
*Description:* The problem with grenades is the range you can throw them. A launcher removes that concern.
*Implementation:* Defaults for a Grenade Launcher.

## Rocket-launcher
*Manufacturer:* Militech
*Cost:* VEX
*Description:* Launches self-propelled rockets.
*Implementation:* There should already be defaults.

# Ammo
Grenades and rockets Ammo items have quantity 1 while all others have quantity 10 in the Compendium.

These grenades, as the basic Grenade that already exists, should also be Gear like those already implemented. Those grenades should also be Ammo with the same effect they have otherwise. As Ammo they are only for Grenade Launchers and the damage/affliction/effects are replaced with those of the specific Ammo.

## Armor-Piercing
A separate Ammo Item for each of Assault Rifle, SMG, Heavy SMG, each type of Pistol, and Shotgun Slug.
*Cost:* PR
*Restrictions:* Non-Tech Weapons only
*Description:* Ablates 2 instead of 1 from armor when dealing damage. This is considered before determining if the armor is pierced.
*Implementation:* When calculating if SP would stop damage, determine if SP - 2 would stop it. If SP would be reduced, it is reduced by at least 2 (higher if other sources has already set it to more than 2). If a reduced SP would still exceed the damage, nothing happens, as usual.

## Full-Metal-Jacket
Remove. It doesn't make sense to have these separate from basic ammo.

## Hollow-Point
A separate Ammo Item for each of Assault Rifle, SMG, Heavy SMG, each type of Pistol, and Shotgun Slug.
*Cost:* PR
*Restrictions:* Non-Tech Weapons only
*Description:* If you cause the Foreign Object Critical Injury, roll again for an additional result on the Critical Injury table. Re-roll what would be another Foreign Object.
*Implementation:* After scoring a Critical on a target, check if it was Foreign Object. If it was, re-roll for aa second result to add until that second result isn't Foreign Object.

## Rubber
A separate Ammo Item for each of Assault Rifle, SMG, Heavy SMG, each type of Pistol, and Shotgun Slug.
*Cost:* PR
*Restrictions:* Non-Tech Weapons only
*Description:* Doesn't ablate armor. If the target ends up at ≤ 0 HP, they are instead at 1 HP and unconscious.
*Implementation:* Weapon damage stops ablating armor (though otherwise interacts with it normally) and is non-lethal.

## Toxic
A separate Ammo Item for each of Assault Rifle, SMG, Heavy SMG, each type of Pistol, and Shotgun Slug.
*Cost:* PR
*Restrictions:* Non-Tech Weapons only
*Description:* No regular damage. The target must succeed on a <strong style="color: var(--cpb-accent)">DV15</strong> <strong>Endurance</strong> check or take 3d6 damage directly to HP. Those who succeed take half that damage. This can't cause a Critical Injury.
*Implementation:* Weapon damage is only used to determine if the attack penetrates SP — damage exceeding it is ignored. If HP damage would have been dealt, the target instead makes the Endurance check. 3d6 damage that ignores SP on a failure, ½ on a success. Can't trigger Critical Injury.

## EMP-Grenade
*Manufacturer:* Zetatech
*Cost:* EX
*Description:* 4/8 explosion with no regular damage. Someone hit succeed on a <strong style="color: var(--cpb-accent)">DV15</strong> <strong>TECH</strong> + <strong>Endurance</strong> check. Being outside the inner radius gives +2 to this check. On a failure, two random non-insulated pieces of cyberware or other electronics are disabled for the next minute. Doesn't ablate SP because it wasn't interacted with.
*Implementation:* Affliction explosion: Spread 8, ½ Damage 4, DV15 TECH+Endurance (+2 outside ½ Damage radius — examples should exist). The Grenade (or Weapon with the Mod) has a suspended AE that disables two random Cyberware (function should be in the codebase... somewhere), which is copied as an active temporary version (1 minute) onto any Actor who failed their check. The GM keeps track on what is insulated and corrects if needed.

## Incendiary-Grenade
*Manufacturer:* Militech
*Cost:* PR
*Description:* 6/10 spread explosion that deals 6d6 damage. <strong>RFLX</strong> 8+ may roll <strong>Evasion</strong> to halve the damage they would have taken. Ignites a in a target who takes damage. They may use their action to put themselves out, or take Mild Fire damage (2 points) at the end of each turn until the fire is put out. It burns for twenty rounds after the last ammo to ignite them, if not put out before. Multiple instances don’t stack.
*Implementation:* Explosion Affliction damage: 6d6 damage, spread 10, ½ damage 6, applies Mild Burning to anyone to takes HP damage (removal handled by GM) unless they already have a Burning condition.

## Rockets
Corresponds to the existing Basic Rockets.

## Shotgun Slug Hollow-point
Not a thing — remove references.

## Toxic-shotgun-shells
Identical to other Toxic damage above, but DV in both description and implementation is 12.

# Mods
## Arasaka Inazuma
*Manufacturer:* Arasaka
*Cost:* PR
*Restriction:* Melee Weapon only
*Description:* Takes an Action to turn on or off. The weapon deals +1 per die because of the electricity, Targeting non-insulated cyberware (at least -4) results in the target having to make a <strong style="color: var(--cpb-accent)">DV15</strong> <strong>TECH</strong> + <strong>Endurance</strong> check. On a failure, the device is disabled for 1 minute.
*Implementation:* Apply the +1/die bonus damage, the rest is handled by the GM.

## Arasaka SPU Tsubasa
*Manufacturer:* Arasaka
*Cost:* PR
*Restrictions:* Smart Weapons only.
*Description:* Smart Ammunition can side-load a Quickhack program that will upload to the target's cyberware. It has an effective skill at +14 to breach their COS.
*Implementation:* Fully handled by the GM.

## Arasaka Thermal Advantage
*Manufacturer:* Arasaka
*Cost:* PR
*Restrictions:* Melee Weapons only
*Description:* The heating coil can be turned on or off as an Action. While active and dealing at least 2 HP to a target, the weapon applies Mild Burning (2 HP at the start of each turn) for the next 1d6 rounds. The condition can be ended as an Action. Flammable objects will burn even without initial damage. A battery lasts for 8 hours and takes ten minutes to recharge.
*Implementation:* Add a button to the weapon controls on the Overview tab, along things like a Tech weapon's Charge. Clicking it makes the weapon apply the Burning condition AE if damage, after everything else has been handled, in the attack, ≥ 2. The duration is rolled and set with the AE, dealing damage until it's time has run out, at which out it's removed. Clicking the button again turns off the effect. Anything else is handled by the GM.

## Budget Arms Riptide
*Manufacturer:* Budget Arms
*Cost:* PR
*Restrictions:* Melee Weapons only
*Description:* Can only be installed on non-motorized weapon. The rippers can be turn on or off as an Action. While active, the weapon is noisy but deals <strong>1d6</strong> damage extra and ablates SP by 2 instead of 1. €$10 (Everyday) worth of fuel lasts for 8 hours.
*Implementation:* Add a button to the weapon controls on the Overview tab, along things like a Tech weapon's Charge. Clicking it gives the weapon +1d6 damage and ablates SP by 2, or the current amount if set higher than 2 by other sources, but takes an Action. Clicking it again removes these bonuses and also takes an action. GM handles fuel consumption.

## Constitutional Arms Delaware
*Manufacturer:* Constitutional Arms
*Cost:* PR
*Restrictions:* Shotgun with a cone attack
*Description:* When firing a shell, halve the width of the cone due to a narrow pellet spread. Add +3 to the attack roll and 1d6 to the damage.
*Implementation:* The cone angle is halved, the attack roll with that specific attack gains +3 and it's damage is increased by 1d6.

## EBM IR-Flashlight
Implement Gear item instead of a Mod.
*Manufacturer:* EBM
*Cost:* PR
*Description:* Can be turned on or off with little effort. While on, it creates creates a narrow column of bright light or a wide cone of dim light. This light is only in the infrared and thus invisible to those without an ability to see that part of the spectrum.
*Implementation:* Narrative only if implementation takes significant effort. Areas reached by the character's IR sense, but not behind anything that blocks light and not already visible through normal sight, is made visible with a desaturation filter overlay.


## Federated Arms Sling
*Manufacturer:* Federated Arms
*Cost:* CO
*Restrictions:* Any Gear
*Description:* Part of Federated Arms' Righteous Series. Dropping the gear makes it hang by strap at the user's side instead of falling to the ground.
*Implementation:* Handled by the GM.

## Kendachi Permanent Edge
*Manufacturer:* Kendachi
*Cost:* PR
*Restrictions:* Melee Weapon only
*Description:* Can only be installed on a bladed weapon. When the weapon causes a Critical Injury, roll three dice instead of two and pick any combination of two dice to select the result from the Critical Injury table.
*Implementation:* Intercept immediately before rolling on the Critical Injury table for an attack that would trigger it. Instead, roll 3d6 and send the individual dice results in a chat message. The GM handles telling the player what the options are and applying the effect. The target should still suffer the bonus damage from a Critical hit.

## Large fuel tank
*Manufacturer:* Petrochem
*Cost:* PR
*Restrictions:* Flamethrower only.
*Description:* Doubles the ammo available to the weapon. If the ammo in the tank exceeds 10 + the user's <strong>BODY</strong>, their <strong>MOVE</strong> is reduced by 1.
*Implementation:* Double maxAmmo. When currentAmmo changes and is > parent Actor's BODY, create an AE that gives MOVE -1.

## Militech CS-63 Bipod
*Manufacturer:* Militech
*Cost:* EX
*Restrictions:* Hands > 1
*Description:* Deploy a gyroscopic stand against any surface. During a turn the user doesn't use their MOVE, attacks gain +1.
*Implementation:* Add a button to the weapon controls on the Overview tab, along things like a Tech weapon's Charge. Clicking it gives +1 to the weapon's attack(s) that turn but comes with the same no move before — no move after restrictions as Charge.

## Militech Vibro-Stun
*Manufacturer:* Militech
*Cost:* EX
*Restrictions:* Melee Weapon only
*Description:* <p>Can be installed on a melee weapon that isn't motorized and isn't a bladed weapon. Activating the vibrations or turning them off takes an Action. If the attack die with the weapon is shows a 10 <em>and</em> the target takes damage, the target is also Stunned until the end of their next turn.</p><p>The vibrations make precision difficult. While the activation lasts, and one turn after, the user's attacks are at -1.</p><p>The battery lasts for 8 hours and takes 10 minutes to recharge.</p>
*Implementation:* Add a button to the weapon controls on the Overview tab, along things like a Tech weapon's Charge. Clicking it activates the vibrations. While these are active, check for 10 on the attack roll (similar mechanics should already exist). If the HP damage applied is > 0, apply a Stunned condition AE to the target. The next time that character starts a turn (or isn't in combat), their turn immediately ends and the AE is removed. Someone who activates this weapon gains a Vibrations AE that applies -1 to Melee checks (which will mostly be attacks). If, at the end of a turn, they don't have the effect active, it will be removed at the end of their next turn. Anything else is handled by the GM.

## Rostović Skachok
*Manufacturer:* Rostović
*Cost:* PR
*Restrictions:* Tech Weapons only
*Description:* <p>When Charged, the weapon can be used with the Melee skill as a stun baton. A pistol or SMG becomes a Medium Melee Weapon (2d6 damage, RoF 2, 1 hand, ignores ½ SP), others become Heavy Melee Weapons (3d6, RoF 1, 2 hands, ignores ½ SP). This ends the Charge.</p><p><strong>Stun:</strong> If the target is brought to 0 HP or lower, they are at 1 HP and unconscious instead.</p>
*Implementation:* Adds another Weapon to the Gear or Cyberware it's attached to. The weapon type is Medium Melee or Heavy Melee as per the description. This is non-lethal damage.

## Rostović Smart-targeting
*Manufacturer:* Rostović
*Cost:* EX
*Restrictions:* Any Pistol, SMG, Heavy SMG, Assault Rifle, Machine Gun, Precision Rifle, Sniper Rifle, or Bow/Crossbow
*Description:* Ammunition is irradiated slightly and previous hits give feedback to the user. Attacks on a target that has already been hit by the weapon since the start of the last turn gains +1.
*Implementation:* After a successful attack, create an AE that lasts 1 Turns that grants +1 to attacks with the weapon (or, if limiting to the specific weapon requires significant plumbing, attacks with its skill). If the AE already exists, just reset its duration instead. If, at the end of the Actor's turn, the duration is at 0, or if they're not in combat — delete the effect.

## Techtronika SR-2 Seshcha
Idea that fell through — remove.

# Clothes
I'm working on adding more, and less generic clothing options. For now, this just means that the Outfits folder should get subfolders for different types of clothes (jackets, tops, etc). Three categories should be added: "Full body", "Dresses" and "Skirts".

# Gear
## The Snitcher
*Manufacturer:* Fourth Wall
*Cost:* CO
*Description:* Historical police drama set in 1992. Three hardened detectives are hunting a group of robbers — one of whom keeps leaving clues for them. Mean, the robbers always seem to have insider info on the cops...
*Implementation:* None.