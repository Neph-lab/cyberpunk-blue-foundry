# Non-Weapon Abilities — Implementation Audit

Status key: ✅ automated · ❌ not automated · ➖ partial / display only

Last updated: 2026-05-11 (gear AE state sync + Rocket Boost reminder)

Focus: Cyberware, non-weapon Gear, non-weapon Mods, Executables/Programs, Drugs.
Weapon abilities are tracked separately in `weapon-abilities-audit.md`.

---

## Already automated (reference)

| Feature | Where | Notes |
|---|---|---|
| ✅ Cyberware slot / platform validation | `cyberware.mjs` | Enforces slot type, paired install, multipleInstalls cap |
| ✅ Cyberware psyche loss — formula display | actor sheet | Parses `psycheLoss` expression for sheet display |
| ✅ Cyberware disable state (AE) | `cyberware-disable.mjs` | Cyberware Malfunction & Short Circuit quickhacks toggle disabled |
| ✅ Armor — Skin-Weave / Subdermal Armor | item schema | `isArmor`, `maxSp`, `currentSp` tracked; used in SP resolution |
| ✅ Cyberdeck / architecture hardware schema | item schema | `isComputer`, hardware-slot fields, RAM, DATA nodes tracked |

---

## 1. Cyberware — stat and skill bonuses

All entries below exist in the catalogue with descriptive text but apply **no mechanical effect** to actor stats or checks.

### 1a. Always-active stat/skill bonuses

| Cyberware | Bonus | Notes |
|---|---|---|
| ✅ Grafted Muscle & Bone Lace | +2 BODY (max 10) | `multipleInstalls: true`; bonus stacks across installs up to BODY 10 |
+2 to BODY per install via AE. Cap of 10 is GM-enforced (Foundry AEs don't support conditional caps).
| ✅ Big Knucks | +1d6 Martial Arts punch damage | Extra die on all MA attacks |
AE flag `maExtraDamageDice: 1`; `buildMaDamageFormula()` in martial-arts.mjs adds extra dice to all MA rolls.
| ✅ Toxin Binders | +2 Endurance vs blood-borne toxins/drugs | Situational; passive AE |
AE adds +2 to Endurance skill rank.
| ❌ Enhanced Antibodies | Heal BODY×2 HP/day after stabilised | Passive healing rate change |
Add +BODY of the character to HP regained when GM activates natural healing. GM-handled.
| ✅ Implanted Linear Frame Sigma | BODY → 12 | Hard override via OVERRIDE AE |
AE with mode 5 (OVERRIDE) sets BODY to 12. Can't be installed if Beta is installed.
| ✅ Implanted Linear Frame Beta | BODY → 14 | Hard override via OVERRIDE AE |
AE with mode 5 (OVERRIDE) sets BODY to 14. Conflicts with Sigma.
| ❌ Amplified Hearing | +2 hearing Perception | Perception sub-type bonus |
Reminder AE only; bonus is handled by GM.
| ❌ Image Enhance | +2 sight Perception | PAIRED; Perception sub-type bonus |
Reminder AE only; bonus is handled by GM.
| ✅ Voice Stress Analyzer | +2 Human Perception, +1 Influence | Multiple stat bonus |
AE adds +2 humanPerc rank, +1 influence rank.
| ✅ AudioVox | +2 Acting, +2 Music; voice imitation via Acting | Skill bonus + narrative voice-mimicry |
AE adds +2 acting rank, +2 music component rank.
| ✅ Medscanner (cyberarm) | +2 Medicine | Skill bonus when cyber arm installed |
AE adds +2 medicine rank.
| ✅ Techscanner (cyberarm) | +2 Electronics, +2 Mechanics | Skill bonus when cyber arm installed |
AE adds +2 electronics rank, +2 mechanics rank.
| ❌ Olfactory Boost | +2 scent Perception | Perception sub-type bonus |
Reminder AE; bonus is handled by GM.
| ✅ TeleOptics | +1 attack rolls >50m (not Autofire) | Conditional attack bonus |
AE flag `teleOptics: true`; `combat-resolution.mjs` checks the flag and adds +1 when range > 50m.
| ✅ Targeting Scope | +1 Aimed attacks | Conditional attack bonus |
AE flag `targetingScope: true`; `combat-resolution.mjs` adds +1 when Target Vitals is active.
| ❌ Skill Chip | Treat skill rank as 3 if user < 3 | Minimum-rank floor, not additive |
The one-line note-field in the header should have the name of the Skill or Component. Implemented via AE if that name can be validated as actual Skill or Component.

### 1b. Speedware (exclusive group — only one may be active)

| Cyberware | Effect | Notes |
|---|---|---|
| ✅ Kerenzikov | +1 Initiative, +1 Evasion, +1 Swerve | Passive always-on while installed; speedware exclusivity |
AE adds +1 rflx rollMod (Initiative), +1 evasion rank, +1 drive rank (Swerve).
| ✅ Sandevistan | Action to activate; 10 min: +3 Init/Evasion/Martial Arts/Melee | Active toggle; re-use within 1 hr → 3d6 HP damage to self |
`aeOff` + Instructions: Activate message → enable AE → Deactivate message (terminates). Cooldown damage is GM-handled.

### 1c. Fashionware — combined style bonuses

| Cyberware | Effect | Notes |
|---|---|---|
| ➖ Chem-Skin + Tech-Hair | +2 Style (combined, not per-item) | Only grants bonus when BOTH are installed |
Reminder AE on each item; the conditional cross-item check can't be automated with standard AEs. GM-enforced.
| ➖ 3+ Light Tattoos | +2 Style total | Threshold check on installed count |
Reminder AE on each item; threshold check can't be automated with standard AEs. GM-enforced.

### 1d. Chipware — active or conditional

| Cyberware | Effect | Notes |
|---|---|---|
| ❌ Pain Editor | Ignore Seriously Wounded penalties | Passive flag; suppresses wound-penalty AE |
Should be Gear (Chipware), not Cyberware. Providing the effect while equipped requires wound-suppression AE logic.
| ❌ Tactile Boost | Narrative only | No mechanical enforcement needed |
Should be Gear (Chipware). No mechanical effect to automate.

---

## 2. Cyberware — movement and positional specials

| Cyberware | Effect | Notes |
|---|---|---|
| ✅ Skate Foot | +6m MOVE per turn | PAIRED; additive to base MOVE |
`aeOff` + Instructions: Deploy message → enable AE (+6 move.value) → Retract message (terminates).
| ➖ Rocket Boost | Doubles jump height; ignore first 6m of fall | PAIRED; reminder AE only |
Reminder AE added. Jump/fall-distance mechanics not implemented; GM-handled.
| ❌ Gripfoot | Removes movement penalties on difficult terrain/climbing | PAIRED; terrain-penalty suppression |
Negate terrain penalties from a Region.
| ❌ Jump Booster | Removes jump-distance penalties | PAIRED |
Handled by the GM.
| ❌ Webbed Foot | Removes swimming movement penalties | PAIRED |
Handled by the GM.

---

## 3. Cyberware — combat specials (non-weapon-schema)

| Cyberware | Effect | Notes |
|---|---|---|
| ✅ Monowire | On crit: roll injury table twice, choose result | `critDoublePick: true` on weapon schema |
`_drawSecondCritResult()` + DialogV2 pick dialog in `critical-injury.mjs`. GM fallback: auto-resolves to first result on close.
| ✅ Mantis Blades | Two blades at same target same Attack → roll all dice together | Two weapon entries in catalogue |
Single-blade entry (3d6, RoF 2) + combined-strike entry (6d6, RoF 1, 2-handed). Both on the same catalogue item.
| ❌ Self-ICE | Adds a Passwall layer (DV 10 + 2 per install) to architecture | NET-side effect; requires architecture integration |
Relevant for quickhacking. Rules added at the end of this document.
| ❌ Radar / Sonar | 50m terrain scan on HUD | Display feature; no combat mechanic required beyond narrative |
Yes, that.

---

## 4. Non-weapon Gear — passive or worn effects

| Gear | Effect | Notes |
|---|---|---|
| ✅ Medscanner (gear) | +2 Medicine while carried/equipped | AE on gear item |
AE adds +2 medicine rank. `syncGearEffects()` disables the AE when gear state is 'owned'; re-enables when carried/equipped. Doesn't stack with the Cyberware version (player awareness; no enforcement).
| ✅ Techscanner (gear) | +2 Electronics, +2 Mechanics while carried/equipped | AE on gear item |
AE adds +2 electronics rank, +2 mechanics rank. Same gear-state sync as Medscanner.
| ❌ Smart Visor | Functions as 2-slot cybereye with Virtuality while worn | Worn-state tracking + conditional NET access |
Requires Gear Mods to replicate Cybereye extensions. Deferred until Mods overhaul.
| ➖ Anti-Smog Breathing Mask | Immune to inhaled toxins while worn | Reminder AE only |
Status immunity AE (description only); mechanical enforcement not implemented.
| ➖ Auto-Level Ear Protectors | Immune to deafness / loud-noise effects while worn | Reminder AE only |
Reminder AE; Deaf-condition suppression not implemented.
| ✅ Linear Frame Sigma (exoskeleton) | Strength tasks as BODY 12 | Instructions + aeOff |
`aeOff` + Instructions: Connect → enable OVERRIDE AE (BODY 12) → Disconnect (terminates).
| ✅ Linear Frame Beta (exoskeleton) | Strength tasks as BODY 14 | Instructions + aeOff |
`aeOff` + Instructions: Connect → enable OVERRIDE AE (BODY 14) → Disconnect (terminates).
| ❌ Airhypo | Store 3 drugs; administer as Action; vs unwilling: BODY+Melee attack first | Inventory sub-system + combat action |
The drugs involved can be handled manually. Treat as Light Melee weapon with Affliction damage that transfers a description-only Drugged AE.
| ❌ Caltrops | DV15 RFLX+Athletics save or 1d6 per 2m moved through | Area placement + movement-triggered save |
Treat as a grenade (see next section) where the Region created stays until manually removed. A Token moving more than 2 meters inside the region during their turn takes damage.
| ❌ Toxin (gear) | DV13 BODY+Endurance or 2d6 HP + −1 BODY | Save-or-suffer on application |
Handled by GM.
| ❌ Toxin, Strong (gear) | DV15 BODY+Endurance or 3d6 HP + −1 BODY/RFLX | Save-or-suffer on application |
Handled by GM.

### 4a. Grenades (AoE resolution system)

| Grenade | Effect | Notes |
|---|---|---|
| ❌ All grenade types | AoE attack roll, DV13 BODY+Endurance save in radius | Shared resolution: deviation scatter, AoE radius, save prompt, damage application |
A grenade is a thrown Weapon with Explosion damage. If no Half Damage radius is set, assume it should be ½ Spread (round up). If the effect is not damage, its uses Affliction Explosion to apply an AE. If nothing else is given, assume this is a DV 13 BODY + Endurance check that lasts a number of minutes equal to the margin of failure.
| ❌ Smoke / Teargas | Cloud drift/shrink per turn | Ongoing zone tracking across turns |
Just like any AoE, this should use Foundry Regions to take advantage of their capabilities. The explosion Region remains after detonation. Radii shrink by 1 meter at the end of each Round (every 3 seconds game time outside Combat). The GM will move the region manually if needed.

---

## 5. Non-weapon Mods (computerMod type) — architecture hardware
THIS RELIES ON NETRUNNING RULES - See later in this file

---

## 6. Programs / Executables — NET combat system
THIS RELIES ON NETRUNNING RULES - See later in this file

---

## 7. Drugs

All drug effects are currently unautomated. Duration, stat changes, PSYCHE changes, addiction tracking, and secondary-roll effects require a drug/condition system.

Drugs rely on an implementation of the Instructions array already present for Cyberware and Gear. They require this system to also be able to post to chat for the player and GM to see. Drugs default to this pattern:
[ Take ]→Reduce Quantity→Usage AE with effects and duration→First effect description→[ Wear off ]→Endurance vs given DV→(if successful)Hangover description if successful, then end→(if failed)→Immediate negative AE with effects and description→Bad hangover description→[ Sober up ]→Long-term AE (that stay even after this sequence)→Bad effects description.

Drugs with Quantity = 0 stay in Inventory for reference, but can't be used.
"Addiction to x" is a long-term AE that carries those effects. It is usually suppressed while having another AE from the same drug. The negative long-term effects from the same drug don't stack. Once one is in place, future ones can be ignored.

Several Drugs here erroneously derive their effects from "Cyberpunk Red" — that game is NOT reliably compatible with this one. Key effects in the original table here can't be trusted, use my descriptions below.

| Drug | Key Effects |
|---|---|
| ❌ Antibiotics | Removes infection status; heals 2d6 HP in 1 hr |
Use AE: BODY -1, +2 HP recovered from GM triggering natural healing, 24 hours; First: "Your body aches with a light fever as your immune system is boosted."; DV 10; Hangover: "The worst is over and your body wil recover."; Immediate AE: no regained HP from natural healing, 24 hours; Bad hangover: "You can keep your food down and you're shivering."; Long AE: none; Bad: "Finally, your body doesn't hate you."
| ❌ Black Lace | BODY +2, RFLX +2, WILL +2; −2 Empathy per dose; addiction; Fatigue on wear-off |
Use AE: 2d6 (roll when applied, store result in AE) PSYCHE loss (only while AE lasts), +1 BODY, +1 RFLX, suppress the effects of Seriously Wounded, Broken Arm, Broken Leg, Broken Ribs, Broken Jaw, Torn Muscle, Foreign Object, 24 hours; First "You're the biggest, baddest there ever was! Puny little humans can't harm you!"; DV 17; Hangover: "You feel tiny and empty. Your body is like wrung out rag."; Immediate AE: PSYCHE loss from Use AE is applied properly, 4 hours; Bad hangover: "Your strengths are abandoning you and you feel a pathetic need to defeat the world."; Long AE: Addicted to Black Lace, -2 RFLX; Bad: "You're slow and weak. You can be powerful again. All you need is some Black Lace..."
| ❌ Blue Glass | −2 all stats; hallucinatory; Empathy +4 |
Use AE: Description of euphoria and possible hallucinations only, 4 hours; First: "It all feels better now. The world around you doesn't have to be real and your thoughts don't have to be imaginary. Just float on the vibes."; DV 15; Hangover: "It all feels a bit empty. Cold. Too real."; Immediate AE: none, 8 hours; Bad Hangover: "The world is bleak and feels pointless."; Long AE: Addicted to Blue Grass. When the GM triggers natural healing, they also roll 1d6 for the number of hallucinations during the next day.; Bad: "This can't be reality and you're pretty sure some parts of it aren't, but you can't tell which parts. You need to escape these fears. You need Blue Grass."
| ❌ Boost | RFLX +1, REF +1 for 1 hr; Fatigue |
Use AE: +2 INT (caps out at 8), 20 hours; First: "Everything comes into focus. Your thoughts feel fast, like skating on clear ice."; DV 17; Hangover: "The clarity is gone and now what used to be the usual feels dull."; Immediate AE: -1 INT, 8 hours; Bad Hangover: "Everything seemed so clear, but now a fog clouds your mind. You can't seem to focus."; Long AE: Addicted to Boost, -2 INT; Bad: "The mig fog won't go away. It just gets denser. You know the only thing that will allow you to think again is Boost."
| ❌ Immunoblockers | Suppress immune reaction for 24 hr (relevant to organ rejection) |
Use AE: Restores 2d6 PSYCHE immediately and then remains as reminder AE, 30 days; First: "A tension you didn't know you had leaves your body as it stops fighting itself. Your mind gets some much needed rest."; DV 21; Hangover: "There it is. That nagging feeling that parts of you aren't actually you."; Immediate AE: Immediate loss of 2d6 PSYCHE, -2 to all checks, 1 minute (20 rounds); Bad Hangover: "In a flash, you're not you. You're just pieces of flesh and metal and plastic, barely held together by wiring and sinew."; Long AE: The GM gets a chance to skip this step, otherwise 4d6 PSYCHE loss; Bad: "Your mind shatters into anger and confusion. Blood. The parts of your body all scream! They scream different things."
| ❌ PDGF Injection | BODY×2 HP recovery over 1 hr when stabilised |
Use AE: Immediately heals 1d6 HP then keep as reminder, 4 hours; First: "It feels like your wounds burn and the tissue around them stretches painfully, but they're healing at a visible pace."; DV 15; Hangover: "You're sore and stretching feels like it pulls on more on your body than it should, but you're fine." Immediate AE: none; Bad hangover: "The wounds healed. But your throat feels like its choking you. Your tongue sticks to your cheek. Your insides hurt."; Long AE: 1d6/2 (round up) damage if moving more than MOVE meters in a turn (like in comparable Critical Injury) or they make an Athletics check. If they would be able to Evade, the player are asked to confirm (in which case they roll Evade but take this damage) or automatically fail the evasion. The description states a DV 14 Medicine (with a Medtech's Surgery) is required to remove this AE; Bad: "You're coughing blood. Sudden movements risk internal bleeding. It feels like you're wearing your body too tight."
| ❌ RPM | RFLX +3 for 30 min; crash −2 RFLX after |
Use AE: If active, reduce Fatigue Condition (with AEs) by one step: "Extreme Fatigue" → "Severe Fatigue" → "Fatigued" → none, 20 hours, remind GM that the character needs RPM within 4 hours to not suffer 1d6 PSYCHE loss; First: "You're refreshed! Fully rested and ready to take on the world!"; DV 13; Hangover: "It all comes back like a ton of bricks. The fatigue. How tired you are. So very, very tired..."; Immediate AE: none; Bad hangover: "Just as you were ready to get all you need to do done, all energy is gone. You're just tired. Well and truly tired."; Long AE: Addicted to RPM. Is always at least Fatigued, if not a more serious level of the Condition; Bad: "You can't sleep properly. You're really not awake. Nothing pushes through the sleepy fog. Nothing but RPM."
| ❌ Smash | BODY +2 for 1 hr; rage; crash −2 BODY after |
Use AE: +2 to Acting, Contortionist, Human Perception, Influence, and Performance, 4 hours; First: "You're smooth; you're suave. Confidence flows through you and you're ready to party!"; DV 13; Hangover: "Your head is heavy and you don't feel comfortable in your own skin. Another Smash might help."; Immediate AE: -1 COOL, 1 hour; Bad hangover: "Your stomach's churning and you feel a bit shaky. It was good while it lasted, but now..."; Long AE: Addicted to Smash, -2 to Acting, Contortionist, Human Perception, Influence, and Performance; Bad: "Smash. It felt so good. You had such confidence after drinking it. Without it you're just a failure. You can't stop thinking about it. Maybe have some now?"
| ❌ Speed | Move +4 for 30 min; Fatigue after |
Use AE: Any penalties due levels of the Fatigued Condition are reduced by 1, description makes clear that while need for sustenance remains there is no sense of hunger, 8 hours; First: "Your head clears and you're ready to focus!"; DV 12; Hangover: "A headache again, slowing you down. You could do with a pick-me-up." Immediate AE: none; Bad hangover: "Your head's tired and your body's aching. It's harder to focus..."; Long AE: Addicted to Speed, -2 to tasks requiring extended focus — handled by GM; Bad: "The harder you try to focus on something, the more it slips away. You now some Speed would help you for a few hours..."
| ❌ Synthcoke | COOL +2, WILL +2 for 1 hr; mild addiction |
Use AE: +1 RFLX, +1 Influence, description has a reminder about constant paranoia, 4 hours; First: "You're sharp. On the edge. You see everything clear now. Every move is perfect and you're ready to take on anyone."; DV 16; Hangover: "You feel like you've run a marathon. It's exhausting but such a thrill!"; Immediate AE: Fatigued, 1 hour; Bad hangover: "All that itching to do things just feels like itching. You're speed car, revving your engine but unable to race." Long AE: Addicted to Synthcoke, -2 RFLX, description mentions de deep cravings for synthcoke; Bad: "It's hard to keep your hands steady. Sweat beads collect on your brow. All you need to be in control is a hit of synthcoke. Just one more."

---

## Additional Implementation Notes
How to handle PAIRED Cyberware and bring consistency: Increase the cost of all these Items by one step on the Cost ladder. When installed, they require their number of slots to be used up by two separate Platforms of the right kind instead of only using that many slots on one. If this can't be fulfilled, it is Disconnected just like other Extensions without enough slots on a Platform.

---

# Netrunning System
To engage in Netrunning, a character must have NET Actions, which is at the core of the Netrunner Role. Full Roles implementation will come after everything in this document.

We need to establish three Foundry Region behavior types:
* Access Point: Placed in a scene that represents the physical ("meat") world for where it's possible to connect to an Architecture (such as a subnet).
* ACC_node: Placed in a scene that represents an Architecture.
* Net_node: Will be able to set itself to one of the subtypes: EXE_node, DATA_node, CTRL_node, or ROOT_node.

Cyberware or Gear that have the Computer flag need a new input: Range.

The Role Ability area on an Actor's sheet gains a button to Connect to an Architecture if: They have NET Actions > 0 (which almost exclusively means the Netrunner Role), they have a Cyberdeck equipped, AND an Access Point region exists within their Cyberdeck's Range. When they Connect, the Scene referenced by the Access Point behavior is placed in the Scene Navigation for both the player and the GM if it wasn't there already. The player gets the Architecture scene activated for them and a Token for their Actor is placed on the ACC_node the Action Point behavior targeted. The Connect button on the Character sheet turns into a Disconnect button and using it will let the character safely Disconnect. Regardless of how a disconnect happens, it removes the Actor's token from the Architecture, puts the player's active scene to the one with the Access Point, and removes the Architecture scene from their navigation.

An actor has Unsafely Disconnected should any of the criteria to connect no longer be true (like being pushed out of the AP region). Also some Programs and other effects might cause an unsafe Disconnect. If they're unsafely disconnected, they immediately take 1d6 damage to HP (ignore SP). Any Black ICE programs in the Architecture that were aware of them automatically and immediately succeeds on an attack check against them just before the disconnect happens.

Inside an Architecture, Executables and Program Actors need to be connected. NPC programs will have an Executable as part of them and any change in one is updated in the other, including name and picture. When character is connected and sets one of the Executables installed on their Cyebrdeck to Running, it should spawn a new Token linked to a temporary Program Actor. It takes up quarter of a Grid space and any time the spawning Actor moves, the spawned tokens will follow, in order of spawning, as close as they can without overlapping with tokens, walls, or other places that block movement. These Programs need to link to the UUID of the program set to running. Changes to one is updated in the other, just like an Executable attached to a Program. If the program is set to not running or the Actor is Disconnected, the Token is removed and the temporary Actor deleted. The player has bLimited permissions to these temporary Actors, but changes they make to their Executable will carry over.

If a Program's current REZ ≤ 0, has the "##ERROR##" AE: it can't move, use any attacks or abilities, provides no bonuses, is skipped in Encounter order, and its Token is given a glitch effect.

## NET Actions
As their regular Action on their turn, an Actor may forgo things like attacking with their weapons or making another Move, and instead take NET Actions. If they do, their Role(s) determine how many such they can take during their turn. NET Actions that don't require a roll still use them. Movement within an Architecture doesn't use up any movement, only movement in meat-space does.

Since almost every check for netrunning is 1d10 + INT + Netrunner Role ranks (if any) + (the lower of Netrunning skill ranks and the appropriate Component's ranks ), I will just use NET(Component), e.g. NET(Spider), to refer to them.

Connecting: Covered above.
Disconnect: A safe disconnect takes a NET Action
Analyze Binary: NET(Dev) to understand what encountered software does and how. The result is handled by the GM.
Breach: NET(Codebreak) to breach a Passwall (biometric lock, password, etc). The GM sets the DV and unlocks the door if appropriate.
Cloak: NET(Ghost) attempts to clean up traces of hacking. Report the result to the GM to keep track of.
Defrag: Doesn't require a connection. Restores all RAM for Quickhacks.
Upload/Download: Prompt GM to optionally set a timer in seconds (1 Round = 3 seconds) after which it is complete. Doesn't require further action, but it fails with a message to chat if the Netrunner disconnected before it was done. It should report its progress to the player and GM (in percent) at the end of each round or for every 10% completed — whichever would post *less*
Encrypt/Decrypt: NET(Codebreak), with the GM setting the DV for decryption and getting the result for encryption to use as basis for decryption attempts. Takes time in the same way Upload/Download does.
Execute Command: The use-button for any program or function within the Architecture takes a NET Action.
Eye-Dee: NET(Spider) analyze data to determine what it is. The result is handled by the GM.
Pathfinder: DV 19 Net(Spider) reveals adjacent nodes, the more margin the better. Passwalls block Pathfinder. Handled by the GM who will clear fog of war.
Run Program / Close Program: Flip the Running flag on an Executable installed on their own Computers. Closing a Program resets its current REZ to max.
Scanner: DV 19 NET(Spider) while connected reveals any other AP nodes within 10 meters of the Actor's token in the meat-space Scene. Each step the roll is higher adds 2 meters to what is possibly revealed. If part of a Region is revealed, the full shape of the Region is revealed. If this NET Action is used while the Architecture scene token is in an ACC_node, the AP it is linked to is automatically revealed.
Slide: NET(Ghost) to force anything in the next Node they enter to make a PER check. Only programs that rolled higher than the Slide are aware of the netrunner.
Virus: These can be uploaded if the Architecture is in a ROOT_node only.
Zap: See NET Combat below.

## NET Combat
Attacks and Defense checks for Characters and NPC netrunners are made with NET(Cracker). Programs add ATK to attack and defend with a static DEF score instead of rolling. Attackers must meet or surpass the defense to deal damage. The Zap NET Action deals 1d6 damage on a hit.
Damage dealt to programs happen in REZ. Damage dealt to humans bypasses any SP. Critical Injuries bring the usual extra damage but don't roll on the Critical Injury tables. A connected runner who goes Unconscious is Unsafely Disconnected.

Programs can choose an attack to deal 1d6 damage, or attack to inflict their Attack Function (Written out as "Attack()" names and descriptions). This Attack function can include damage, applying an AE, affecting the Connected status, deleting Executables from the target, or a combination of these. They do explicitly target either a the netrunning Actor or a program (one installed on a Cyberdeck used by an Actor, or a Program Actor), but not both.

Black ICE programs whose PER check was higher than the Slide check of an Actor who just entered the Net_node region they're in also apply their Attack function once with an automatic success as it happens. This is also true, but handled by the GM for an Actor entering without Sliding.

## The Netrunning tab
NET Actions appear as buttons on Netrunning tab of a Character sheet. This tab is visible if the Actor has NET Actions and any Cyberware or equipped Gear that is a Cyberdeck. They are sorted by the Component they use, plus an area listing the actions that don't require rolls, as a reminder.

The Netrunning tab on the Character sheet also shows all Cyberware and equipped Gear that is a Computer and any Executables the Actor has. This is where they manage what software is installed where, if it's running, trigger its actions, rolling for any Attacks or Perception, and keep track of its REZ. Executables can be set to Owned, Carried, or Installed; similar to how Gear can be. However, to be Installed they need to use a Computer with enough free slots in the same way that Cyberware Extensions need a Platform with enough slots. An Executable uses 1 slot. A Computer can provide a number of slots for Executables to install equal to their Software slots + their General slots. Executables will use up Software slots first. Note that General slots can also be used up by Hardware.

The tab needs to show what Executables and Hardware Mods are installed on each Computer, and which Computer each Executable is on (if any). Executables installed on a computer can be set to Running or not.

## Quickhacking
The Quickhack buttons in the Role Ability area on the Character sheet is visible IF: They have NET actions, at least 1 rank in the Quickhacking Component, they have a Cyberdeck with the can Quickhack flag enabled, they have at least one Quickhack installed on their Cyberware, there target Token is within their Cyberdeck's range, AND that Token is within line of sight, the Actor linked to that Token has a Cyberware Item that is Neuralware and a Platform installed.

Attempting to Quickhack uses up the Character's NET Actions.
* Breaching: NET(Quickhacking) against the raget's ICE: 18 +2 per instllation of Self-ICE. On a success, apply "Breached" AE that references the hacker. If they target someone who is Breached by them, they skip this step. The AE ends in 1 minute or if any of the prerequisites of Quickhacking (most likely range) is false.
* If the target is Breached, the netrunner has the option to "Upload" a Quickhack. The player gets a dialog to choose between those installed on their Cyberdeck that requires ≤ the Cyberdeck's current RAM. Auto-select if there's only one. This applies an AE on the target that will trigger the effect of the Quickhack at the end of the hacker's next turn. This reduces the Cyberdeck's current RAM by the amount specified by the Quickhack. RAM is restored by the Defrag NET Action.

## From the non-weapon audit: 5. Non-weapon Mods (computerMod type) — architecture hardware
These are Hardware Mods. Their UUIDs can be added to the Mods tab on Gear that are Computers. They can only be added if the Computer has enough remaining slots. Each Mod uses 1 slot. The Computer can provide as many slots as their Hardware slots + their General slots. Hardware Mods will use up Hardware slots first. These Mods won't attach if there aren't enough slots or the Gear isn't set as being a Computer. If it later has too few slots or isn't a Computer, the Mods are disabled and have no effect. Note that General slots can also be used up by Executables.

| Mod | Effect | Notes |
|---|---|---|
| ❌ Coolant | +1 active program slot; immune to fire-program effects | Slot cap increase + status immunity |
Add 1 Software slot on a Computer. AW with fire-protection during Netrunning.
| ❌ Insulation | Immune to EMP/microwave program effects | Status immunity |
If something would disable Cyberware or Computers through an effect, it has no effect on this Item and is wasted.
| ❌ Memory Upgrade | +1 DATA node | Architecture resource increase |
Handled manually.
| ❌ Backup Drive | Recover deleted non-Black-ICE programs | Reactive effect on deletion events |
If an effect would delete an Executable installed on the Computer, it is instead Running = false but can't run until a Disconnect has happened. See Netrunning rules.
| ❌ Hardened Circuitry | Immune to EMP/microwave/non-BIC program effects | Status immunity |
Same as Insulation. GM will handle restrictions.
| ❌ Insulated Wiring | Won't catch fire from programs | Status immunity |
Same as Coolant. GM will handle restrictions.
| ❌ KRASH-Barrier | Unsafe disconnections treated as safe | Changes disconnect trauma outcome |
Ignore Unsafe Disconnect effects. Se Netrunning.
| ❌ Range Upgrade | Doubles wireless range | Numeric range change |
Since there might be later changes, the Range is hanled manually.
| ❌ DNA Lock | Biometric lock — others cannot use device | Access control flag |
Handled by the GM

---

## From the non-weapon audit: 6. Programs / Executables — NET combat system

The NET combat system is **entirely unautomated**. Program schema fields exist (REZ, ATK, DEF, program type), but no resolution logic is implemented.

**With the implementation of Netrunning described here, a new audit of program functions is required with that in mind**