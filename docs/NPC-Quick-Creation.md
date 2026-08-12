**NPC Quick Creation**
 An Application v2 application window available to GMs from a button at the top of the Actors panel. The GM chooses one category each from base type, background, and purpose. They may also choose any number (including 0) for each of the extras. If they confirm with a button, a a dialog will request a name and the create an NPC sheet with the choices combined and place it in an "NPCs" folder (creating one if needed) in the Actors panel.

 Roles applied to NPCs this way don't add any of their starting gear. However, the same tricks to add the cyberware are needed here: rename cybereyes, cyberarms, cyberhands, cyberlegs, and cyberfeet for left and right to avoid conflicts, install Platforms first so that extensions have slots to use, and forego the dialog for PSYCHE loss and always use the suggested value.
 
 If a combination would install more than one of cyberware that doesn't allow for multiple installations (except the usually renamed eyes, arms, and legs which are capped at 2 each), only install one copy. If a combination includes more than one cyberarm and one or more hand, or more than one cyberleg and one or more feet — only include the arms/legs. MultiOptic Mount allows for the installation of more than two eyes — just number them after the first two. Sensor Array changes the slots provided by a Cyberaudio Suite to 7 — use that one instead of a regular one if a combination would give both. If a combination results in some cyberware not having enough slots to be installed leave what's left over as not installed and the GM will remove whichever fits the character least. 
 
 Gear can be safely added together by adding only one Item of each, but setting the Quantity to the combined number.

## Implementation notes

Built in `module/apps/npc-quick-creation.mjs` (the window), `module/helpers/npc-builder.mjs`
(the rules), and `module/data/npc-quick-catalogue.mjs` (the tables below, as data). Decisions taken
while implementing, recorded so the doc and the code agree:

- **Stats.** Base types set the five Primary Stats absolutely; Backgrounds and Purposes add deltas.
  MOVE is a Blue stat but not a Primary Stat, so it stays at its default of 5 and is never a target
  for Mundane's random bonus or the Focused/Scattered boosts.
- **Languages.** The base type's `Language: English` is granted at rank 2 (a native language, as in
  character creation); every other language at rank 1.
- **Sensor Array.** The item is added *and* the accompanying Cyberaudio Suite is built with
  7 `slotsProvided`, which is the only way the engine will let 7 cyberaudio extensions connect.
- **Duplicate naming.** Only the anatomical pairs get `(Left)` / `(Right)`; a third or later copy is
  numbered. Other legitimately stackable cyberware (Self-ICE, Light Tattoo) is numbered rather than
  sided.
- **Overflow.** Extensions are created one at a time so each one sees the slots its predecessors
  took. Anything with nowhere to go is created Disconnected and flagged not installed, and costs no
  PSYCHE until the GM finds it a slot.
- **PSYCHE.** Summed across all connected cyberware and applied in a single update, using each
  item's suggested value. The per-item `createItem` hook is skipped, because Foundry does not await
  hook callbacks and thirty of them would race to the same starting value.
- **No IP, no locks.** The NPC sheet already shows no IP and never locks progression — quick-built
  NPCs are edited by GM fiat.
- One summary chat card (whispered to GMs) reports the PSYCHE spent, anything left uninstalled or
  dropped from the combination, any name that failed to resolve, and any Extras that ran out of
  eligible targets.

# Base type
## Brains
* BODY: 4
* RFLX: 5
* INT: 6
* TECH: 6
* COOL: 5
* Cyberware: Neuroport
* Ability: Language: English

## Brute
* BODY: 6
* RFLX: 6
* INT: 4
* TECH: 5
* COOL: 5
* Cyberware: Neuroport
* Ability: Language: English

## Social
* BODY: 5
* RFLX: 6
* INT: 4
* TECH: 5
* COOL: 6
* Cyberware: Neuroport
* Ability: Language: English

# Background
## Corpo
NOT to be confused with the Role of the same name.
* INT: +1
* Skills
 - Acting: +2
 - Business: +3
 - Education: +1
 - Human Perception: +3
 - Influence: +2
 - Perception: +1
 - Trading: +2
* Components
 - Bureaucracy: +2
 - Business Strategy: +3
* Cyberware: Toxin Binders, Standard Cyberaudio Suite, Voice Stress Analyzer, Skin-Weave
* Gear: MicroComp, Synthcoke ×2, Boost ×5
* Ability: Language. Japanese (rank 1)

## Gang
* BODY: +1
* Skills
 - Athletics: +1
 - Drive: +1
 - Evasion: +2
 - Gambling: +1
 - Handgun: +3
 - Martial Arts: +1
 - Melee Weapons: +2
 - Shoulder Arms: +2
 - Streetwise: +2
* Components
 - Brawling: +1
 - Land Vehicles: +1
* Cyberware: Standard Cyberarm, Hidden Holster
* Gear: Malorian Overture, Duct Tape, Synthcoke
* Ability: Reaction Speed (rank 1)

## Industrial
* BODY: +1
* Skills
 - Athletics: +1
 - Deduction: +1
 - Drive: +2
 - Electronics: +2
 - Evasion: +2
 - Mechanics: +3
 - Perception: +3
 - Sleight-of-Hand: +1
* Components
 - Basic Tech: +3
 - Land Vehicles: +2 
 - Robotics: +2
* Cyberware: Standard Cyberarm, Tool Hand
* Gear: Techtool, Duct Tape, Anti-Smog Breathing Mask, Road Flare, Rope
* Ability: Language: Spanish (rank 1)

## Investigator
* INT: +1
* Skills
 - Deduction: +2
 - Government: +1
 - Human Perception: +3
 - Perception: +3
 - Pick Lock: +2
 - Stealth: +2
 - Streetwise: +2
* Components
 - Public Information: +1
* Cyberware: Standard Cybereye ×2, Image Enhance, MicroVideo
* Gear: Flashlight, Grapple Gun, Audio Recorder, Disposable Phone, Scrambler / Descrambler, Lock-Picking Kit
* Ability: Language: Russian (rank 1)

## Joytoy
* COOL: +1
* Skills
 - Acting: +3
 - Athletics: +2
 - Martial Arts: +1
 - Melee Weapons: +1
 - Performance: +3
 - Streetwise: +2
 - Style: +3
* Components
 - Aikido: +1
 - Dancing: +3
* Cyberware: Tech Hair, Light Tattoo, Shift Tacts, Braindance Recorder, Contraceptive Implant, MidnightLady™, Standard Cyberhand, Scratchers
* Gear: Baseball Bat, Glow Stick ×2
* Ability: Language: Japanese (rank 1)

## Military
* RFLX: +1
* Skills
 - Autofire: +2
 - Endurance: +1
 - Evasion: +1
 - Handgun: +3
 - Heavy Weapons: +2
 - Melee Weapons: +1
 - Shoulder Arms: +3
 - Tactics: +2
* Cyberware: Sandevistan, Standard Cyberarm, Embedded Firearm
* Gear: Militech M-10AF Lexington, Militech M251s Ajax, Black Lace ×2
* Ability: Reaction Speed (rank 1)

## Mundane
* [Random Primary Stat]: +1
* Skills
 - Acting: +1
 - Deduction: +1
 - Drive: +1
 - Education: +1
 - Evasion: +1
 - Handgun: +1
 - Human Perception: +1
 - Influence: +1
 - Mechanics: +1
 - Melee Weapons: +1
 - Perception: +2
 - Sleight-of-Hand: +1
 - Stealth: +1
 - Streetwise: +1
* Components
 - Basic Tech: +1
 - Land Vehicles: +1
* Cyberware: Shard Socket, Threading
* Gear: Rope, Glow Stick, Personal Care Pack, Memory Shard, Smash ×2
* Ability: Language: Spanish (rank 1)

## Nomad
* RFLX: +1
* Skills
 - Drive: +3
 - Electronics: +2
 - Evasion: +2
 - Handgun: +1
 - Mechanics: +3
 - Shoulder Arms: +2
 - Survival: +2
* Components
 - Air Vehicles: +2
 - Basic Tech: +2
 - Land Vehicles: +3
 - Sea Vehicles: +2
* Cyberware: Standard Cyberarm, Subdermal Grip, Tool Hand, Nasal Filters
* Gear: Rope, Road Flare, Flashlight, Duct Tape, Binoculars, Auto-Level Ear Protectors, Techtool
* Ability: Language: Spanish (rank 1)

## Street
* COOL: +1
* Skills
 - Conceal: +2
 - Endurance: +1
 - Evasion: +1
 - Gambling: +2
 - Handgun: +2
 - Human Perception: +1
 - Perception: +2
 - Streetwise: +3
 - Style: +1
* Cyberware: Tech Hair, Threading, Subdermal Pocket
* Gear: Braindance Wreath, Food Stick, Glow Paint, Music Album (Shard), Blue Glass ×2, Smash ×4
* Ability: Language: Spanish (rank 1)

## Thief
* RFLX: +1
* Skills
 - Conceal: +1
 - Electronics: +2
 - Evasion: +1
 - Perception: +2
 - Pick Lock: +3
 - Sleight-of-Hand: +3
 - Stealth: +3
* Components
 - Security: +2
* Cyberware: Standard Cyberhand, Tool Hand, Standard Cyberaudio Suite, Amplified Hearing
* Gear: Bug Detector, Lock-Picking Kit
* Ability: Reaction Speed (rank 1)

## Tinkerer
* TECH: +1
* Skills
 - Demolition: +1
 - Drive: +2
 - Electronics: +3
 - Mechanics: +3
 - Perception: +2
 - Pick Lock: +1
* Components
 - Basic Tech: +3
 - Cybernetics: +1
 - Land Vehicles: +2
 - Media: +1
 - Robotics: +3
 - Security: +2
 - Weaponstech: +2
* Cyberware: Standard Cyberhand, Tool Hand, Standard Cyberaudio Suite, Level Dampener
* Gear: Anti-Smog Breathing Mask, Duct Tape, Techscanner, Techtool
* Ability: Language: Spanish (rank 1)

# Purpose
## Artist
* COOL: +1
* Skills
 - Acting: +2
 - Composition: +2
 - Gambling: +1
 - Handgun: +1
 - Human Perception: +2
 - Influence: +2
 - Perception: +1
 - Performance: +3
 - Streetwise: +1
 - Style: +2
* Components
 - Music: +3
 - Writing: +2
* Cyberware: Light Tattoo, Shift Tacts, Tech Hair, AudioVox, Mr. Studd™, Standard Cyberaudio Suite, Level Dampener, Radio / Music Player (Cyberaudio)
* Gear: Darra Polytechnic DR-5 Nova, Duct Tape, Glow Paint, Glow Stick ×10, Audio Recorder, Drum Synthesizer, Electric Guitar, Music Album (Shard), Pocket Amplifier, Radio / Music Player, Leather Armor
* Role: Rocker (rank 2)

## Connections
* INT: +1
* Skills
 - Business: +1
 - Government: +1
 - Handgun: +1
 - Human Perception: +3
 - Influence: +3
 - Perception: +2
 - Streetwise: +2
 - Style: +1
 - Trading: +1
* Components
 - Business Strategy: +1
 - Politics: +1
* Cyberware: Self-ICE, Skin-Weave, Dermal Display, Standard Cyberaudio Suite, Voice Stress Analyzer
* Gear: Malorian Arms Sonnet, Smoke Grenade ×2, Disposable Phone ×2, Scrambler / Descrambler, Homing Tracer, Bug Detector
* Role: Fixer (rank 2)

## Cop
* RFLX: +1
* Skills
 - Criminology: +3
 - Deduction: +2
 - Evasion: +2
 - Government: +1
 - Handgun: +2
 - Human Perception: +2
 - Shoulder Arms: +1
 - Streetwise: +1
 - Tactics: +1
* Components
 - Bureaucracy: +1
* Cyberware: Standard Cyberaudio Suite, Voice Stress Analyzer, Amplified Hearing
* Gear: Militech M-10AF Lexington, Constitutional Arms M2038 Tactician, Road Flare ×2, Flashlight, Chemical Analyzer, Radio Communicator, Handcuffs ×2, Medium Armorjack
* Role: Law (rank 2)

## Cyberpsycho
* BODY: +1
* RFLX: +1
* Skills
 - Athletics: +2
 - Autofire: +3
 - Demolition: +1
 - Endurance: +2
 - Handgun: +3
 - Heavy Weapons: +1
 - Melee Weapons: +2
 - Perception: +1
 - Shoulder Arms: +3
* Cyberware: MultiOptic Mount, Standard Cybereye ×4, Wide Spectrum Optics, Radiation Detector, Targeting Scope, Sandevistan, Self-ICE ×2, Grafted Muscle & Bone Lace, Toxin Binders, Nasal Filters, Subdermal Armor, Standard Cyberleg ×2, Jump Booster, Standard Cyberarm ×2, Projectile Launch System, Mantis Blades ×2, Wolvers
* Gear: Techtronika RT-46 Burya, Rostovic DB-2 Satara, Nokota D5 Copperhead, Black Lace ×2
* Role: Solo (rank 4 — Spot Weakness 2, Damage Deflection 2)

## Engineer
* TECH: +1
* Skills
 - Demolition: +2
 - Drive: +2
 - Electronics: +3
 - Mechanics: +3
 - Medicine: +1
 - Shoulder Arms: +2
* Components
 - Basic Tech: +2
 - Cybernetics: +2
 - Land Vehicles: +2
 - Robotics: +2
 - Security: +2
 - Weaponstech: +2
* Cyberware: Standard Cyberarm, Techscanner (Cyberarm), Tool Hand, Subdermal Grip, Standard Cybereye, MicroOptics
* Gear: Rostovic DB-4 Palica, EMP Grenade ×2, Techtool, Road Flare, Flashlight, Duct Tape, Backpack, Radio Communicator, Kevlar
* Role: Techie (rank 2 — Field Expertise 2, Upgrade Expertise 2)

## Fun
* COOL: +1
* Skills
 - Acting: +2
 - Endurance: +2
 - Gambling: +2
 - Human Perception: +2
 - Influence: +2
 - Perception: +2
 - Streetwise: +1
 - Style: +2
* Cyberware: Tech Hair, Chemskin, Light Tattoo, Subdermal Pocket
* Gear: Glow Stick ×3, Glow Paint, Braindance Wreath, Blue Glass ×5, RPM ×4, Smash ×4
* Role: —

## Grunt
* BODY: +1
* INT: - 1
* TECH: - 1
* Skills
 - Autofire: +2
 - Evasion: +1
 - Handgun: +3
 - Heavy Weapons: +2
 - Martial Arts: +2
 - Melee Weapons: +1
 - Shoulder Arms: +3
* Components
 - Taekwondo: +2
* Cyberware: Gorilla Arm ×2, Big Knucks, Enhanced Antibodies, Grafted Muscle & Bone Lace
* Gear: Constitutional Arms M2038 Tactician, Budget Arms Cut-O-Matic, KTech Terrier, Medium Armorjack, The Snitcher, PDGF Injection ×2, Synthcoke ×2
* Role: Bandit (rank 2)

## Infiltrator
* COOL: +1
* Skills
 - Acting: +3
 - Conceal: +1
 - Human Perception: +3
 - Influence: +2
 - Perception: +2
 - Sleight-of-Hand: +2
 - Stealth: +1
* Cyberware: Tech Hair, Chemskin, Skin-Weave, Subdermal Pocket, Hidden Holster, Standard Cybereye, MicroVideo, TeleOptics, Sensor Array, Standard Cyberaudio Suite (7 slots), Amplified Hearing, Bug Detector (Cyberaudio), Homing Tracer (Cyberaudio), Scrambler / Descrambler (Cyberaudio), Voice Stress Analyzer
* Gear: Tsunami Yanari, Leather Armor, Homing Tracer, IR-Flashlight, EMP Grenade ×2, Knock-Out Grenade ×2
* Role: Operative (rank 2 — Analysis 1, Infiltration 1, Preparation 2)

## Netrunner
* INT: +1
* Skills
 - Electronics: +2
 - Evasion: +2
 - Handgun: +2
 - Netrunner: +4
 - Perception: +2
* Components
 - Codebreak: +2
 - Cracker: +3
 - Dev: +2
 - Ghost: +1
 - Security: +2
 - Spider: +1
* Cyberware: Neuroport Cyberdeck Port, Ex-Disk, Self-ICE ×2, Standard Cybereye ×2, Virtuality, Threading
* Gear: Militech M-76e Omaha, Braindance Wreath, Braindance, Cyberdeck, Standard, Scrambler / Descrambler
* Programs: Vrizzbolt, Speed-Slice, Armor, Shield
* Role: Netrunner (rank 2 — Component Training: Cracker, Codebreak)

## Racer
* RFLX: +1
* Skills
 - Autofire: +1
 - Drive: +3
 - Evasion: +2
 - Handgun: +1
 - Mechanics: +3
 - Perception: +1
 - Shoulder Arms: +2
 - Tactics: +1
* Components
 - Air Vehicles: +3
 - Land Vehicles: +3
 - Sea Vehicles: +2
* Cyberware: Kerenzikov, Enhanced Antibodies, Standard Cyberleg ×2, Rocket Boost, Standard Cyberaudio Suite, Radio / Music Player (Cyberaudio), Tool Hand
* Gear: Arasaka Nowaki, Arasaka HJRE-9 Asuka, Road Flare ×4, Radar Detector, Duct Tape, Anti-Smog Breathing Mask, Auto-Level Ear Protectors, Techscanner, Tech Bag, Radio Communicator
* Role: —

## Scientist
* TECH: +1
* Skills
 - Deduction: +3
 - Education: +2
 - Electronics: +1
 - Government: +1
 - Human Perception: +1
 - Influence: +1
 - Medicine: +3
 - Perception: +3
* Components
 - Basic Tech: +1
 - Bureaucracy: +1
* Cyberware: Nasal Filters, Toxin Binders, Standard Cybereye ×2, Wide Spectrum Optics, Standard Cyberarm, Techscanner (Cyberarm), Medscanner (Cyberarm)
* Gear: Militech Stun Baton, Food Stick, Techtool, Tech Bag, Medtech Bag, Cryopump, Chemical Analyzer, Airhypo, MicroComp, Laptop
* Role: Medtech (rank 2 — Battle Medic 2, Surgery 1, Cryosystem Operation 1)

## Sneaky
* RFLX: +1
* Skills
 - Archery: +2
 - Conceal: +2
 - Evasion: +1
 - Melee Weapons: +3
 - Perception: +2
 - Sleight-of-Hand: +2
 - Stealth: +3
* Cyberware: Kerenzikov, Nasal Filters, Hidden Holster, Standard Cybereye ×2, Targeting Scope, TeleOptics, Wide Spectrum Optics, Standard Cyberarm, Monowire, Subdermal Grip
* Gear: Katana, Bow, Rope, Grapple Gun, Smoke Grenade ×2, IR-Flashlight, Caltrops, Light Armorjack
* Role: Ninja (rank 2 — Silent Death 2)

## Snob
* INT: +1
* Skills
 - Business: +2
 - Drive: +1
 - Education: +2
 - Gambling: +1
 - Government: +1
 - Human Perception: +2
 - Influence: +2
 - Style: +2
 - Trading: +2
* Components
 - Business Strategy: +2
 - Politics: +1
* Cyberware: Contraceptive Implant, Toxin Binders, Skin-Weave, Standard Cybereye ×2, Virtuality, Standard Cyberaudio Suite, Voice Stress Analyzer, Bug Detector (Cyberaudio), Amplified Hearing
* Gear: Darra Polytechnic DS-1 Tenebra, MicroComp, Advanced, Laptop, Boost ×3, RPM ×5
* Role: Corpo (rank 2)

## Sweet
* Skills
 - Acting: +2
 - Animals: +1
 - Deduction: +3
 - Evasion: +2
 - Human Perception: +3
 - Influence: +2
 - Perception: +2
* Cyberware: Standard Cyberaudio Suite
* Gear: Personal Care Pack, Food Stick, Radio / Music Player
* Role: —

# Extras
Each +1 granted by these is added in a loop, preceeded by a new evaluation for eligable targets, as those might change due to the random allocation of the previous +1. Each of these is a applied as many tiomes as chosen in the order they are listed here.

## Focused boost (Can be applied more than once)
+1 randomly assigned to one of the two (or more, if tied) highest Primary Stats currently < 8.

## Scattered boost (Can be applied more than once)
+1 randomly assigned to a Primary Stat currently < 8.

## Skilled
+1 to a random Skill already assigned points to the NPC in the steps before Extras. That pool is fixed at the pre-Extras state — a Skill raised from 0 by Hobbies never becomes eligible here. The skill isn’t eligible if this would push it to 8 or higher. If the Skill has Components, also give +1 to a random Component that already has points assigned.

## Hobbies
+1 to a random Skill that wasn’t assigned any points to the NPC in the steps before Extras. That pool is fixed at the pre-Extras state, so the same Skill can be drawn again on a later iteration. The skill isn’t eligible to get enough points to push its rank to 8 or higher. If the Skill has Components, also give +1 to a randomly selected one.