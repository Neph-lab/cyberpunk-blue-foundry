# Active Effects — Supported Targets & Limitations

## What AEs Can Do (standard Foundry `add`/`override`/`upgrade`)

| AE change key | Effect |
|---|---|
| `system.stats.<stat>.rollMod` | Adds to every roll using that stat (and initiative for RFLX). Used by Seriously Wounded, drug boosts, tactic bonuses, Kerenzikov, etc. |
| `system.stats.<stat>.value` | Changes the displayed stat value and all derived values (HP max from BODY, death save from BODY). Use only for permanent/structural changes; prefer `rollMod` for temporary effects. |
| `system.stats.move.value` | Changes movement speed. Used by Seriously Wounded (-6), Skate Foot (+6), charging weapon AEs (Improved Charge → 1, SR Capacity → ½). |
| `system.skills.<slug>.bonus` | Adds to rolls using that skill without corrupting the player-set rank. Primary target for cyberware skill bonuses (Medscanner +2 Medicine, Voice Stress Analyzer +2 Human Perception, etc.) and Ninja/Solo tactic bonuses. |
| `system.components.<slug>.bonus` | Adds to component (weapon/martial arts) rolls. Target for Ninja Martial Skill, Solo Precision Attack (if applied here), etc. |
| `system.resources.hp.max` | Modifies maximum HP. |
| `system.resources.psyche.maxBonus` | Modifies maximum Psyche pool. |

## Recommended AE Patterns by Source

### Cyberware (always-on while installed, auto-applied on install, removed on uninstall)
- Voice Stress Analyzer: `system.skills.humanPerception.bonus` +2, `system.skills.influence.bonus` +1
- AudioVox: `system.skills.acting.bonus` +2, `system.skills.musicianship.bonus` +2
- Medscanner: `system.skills.medicine.bonus` +2
- Techscanner: `system.skills.electronics.bonus` +2, `system.skills.mechanics.bonus` +2
- Amplified Hearing / Image Enhance / Olfactory Boost: descriptive AE only (GM handles sub-type perception bonuses)
- Kerenzikov: `system.stats.rflx.rollMod` +1, `system.skills.evasion.bonus` +1
  - Note: Swerve bonus is handled by the GM (vehicle-specific)
- Sandevistan: toggle AE with `system.stats.rflx.rollMod` +3, `system.skills.evasion.bonus` +3, `system.skills.martialArts.bonus` +3, `system.skills.melee.bonus` +3. Add companion AE for 1-hr cooldown (descriptive).
- Skate Foot: toggle AE via Instructions, `system.stats.move.value` +6
- Pain Editor: toggle/passive AE that suppresses the Seriously Wounded effect (disabled=true override of the sw flag effect — **can be done** via suppression on the flag key)
- Skill Chip: AE `{ key: 'system.skills.<slug>.rank', type: 'upgrade', value: '3' }` — sets rank to `max(rank, 3)`. Any `bonus` field then adds on top: effective roll value = `max(rank, 3) + bonus`. **This is fully supported by standard AEs.**
- Toxin Binders: `system.skills.endurance.bonus` +2 (descriptive note: applies vs blood-borne only; GM enforces scope)

### Drugs (temporary, from Instructions sequence)
- Antibiotic (Medtech drug): descriptive AE with 7-use tracking note
- Myelin Strengthener: `system.stats.rflx.rollMod` +1, duration in description
- Roids: `system.stats.body.rollMod` +1, duration in description
- RPM: `system.stats.rflx.rollMod` +3, crash AE `system.stats.rflx.rollMod` -2
- Smash: `system.stats.body.rollMod` +2, crash AE `system.stats.body.rollMod` -2
- Speed: `system.stats.move.value` +4, Fatigue AE after
- Synthcoke: `system.stats.cool.rollMod` +2
- Stim: suppresses Seriously Wounded AE (disabled override on the flag), descriptive note for Critical Injury HP
- Surge: descriptive-only AE (no mechanical effect to automate)
- Torpor: apply Unconscious condition AE + descriptive AE
- Runner-speed: `system.netActionsTotal` +1 (AE add — this field lives in the data model and is AE-targetable)
- Rapidetox: GM removes relevant AEs manually (identifying which AEs are from drugs vs other sources is not automatable)
- Addiction AEs: long-term AEs with stat rollMods (usually negative), suppressed while same-drug AE is active

### Ninja / Solo Tactics (applied per tactic allocation; reset when tactics change)
- Ninja Silent Death: `system.skills.stealth.bonus` per point
- Ninja Threat Detection: `system.skills.perception.bonus` per point
- Ninja Martial Skill: `system.components.martialArts.bonus` and `system.components.melee.bonus` (+1 per 2 points, max +3)
- Solo Initiative Reaction: `system.stats.rflx.rollMod` per point (flows into initiative formula)
- Solo Threat Detection: `system.skills.perception.bonus` per point (GM resolves stack conflict with Ninja)
- Solo Damage Deflection: **see Limitations** — reduces first damage per round only
- Solo Precision Attack: `system.components.<attack>.bonus` (+1 per 3 points) — applicable AE target exists; GM notes "all attacks"
- Solo Fumble Recovery: **see Limitations** — reroll on die=1

---

## Limitations — Things That Cannot Be Done Effectively with Standard AEs

### 1. Conditional per-round effects (round-bounded, first-use-only) — **RESOLVED via hooks**
- **Solo Damage Deflection**, **Solo Spot Weakness**, **Ninja Weak-Spot**: Handled by `onHit` (pre-armor) and `onDamage` (post-armor) hooks in `combat-resolution.mjs`. These check AE flags and per-turn state in `turnState`; no standard AE change key needed.
- **Solo Fumble Recovery**: Handled by a post-roll hook that checks the d10 result. Not an AE; implemented as a system hook on attack resolution.

### 2. Distance/positioning conditions — **RESOLVED via range table**
- **TeleOptics** (+1 attack rolls >50m, not Autofire): Integrated into the weapon range consultation step in `resolveWeaponAttack`. If the attacker has an AE flagged `cyberpunk-blue.teleOptics`, and the measured range exceeds 50m, +1 is added to the attack roll.

### 3. Skill minimum floor (Skill Chip) — **RESOLVED**
- `{ key: 'system.skills.<slug>.rank', type: 'upgrade', value: '3' }` — sets rank to `max(rank, 3)`. Any bonus adds on top. Fully supported.

### 4. Drug multi-step sequencing — **RESOLVED (Instructions system already exists)**
- The Instructions system (`module/helpers/instructions.mjs`) handles effect/check/message/pause steps with full wear-off, fail-jump, and permanent-AE support. Drug items use this system; limitation no longer applies.

### 5. NET action count (Runner-speed, Netrunner rank) — **RESOLVED**
- `system.netActionsTotal` is a data-model field on the actor, computed via `prepareDerivedData` from role rank. AEs can add to it (Runner-speed: +1). Operative Infiltration ≥ 5 contributes +1 at prepare time.

### 6. Sandevistan cooldown damage
- Re-using Sandevistan within 1 hr deals 3d6 HP to self. This is a conditional triggered effect, not an AE. **Descriptive AE for the cooldown; GM applies damage manually.**

### 7. Quickhack AEs
- "Breached" AE references a specific hacker Actor UUID and has prerequisite checks (range, RAM). "Upload" AEs fire at end of next turn. These require custom flag-based AEs with system hooks, not standard change-key AEs. **Implemented separately via the Netrunning system.**

### 8. Guide Tarot card AEs — **PARTIALLY RESOLVED**
- Card 15 (The Devil): `system.stats.<stat>.rollMod` +1 for 1 hr — standard AE, fully implemented.
- Card 1 (The Magician): `CyberBlueActiveEffect` one-use subclass with `flags.cyberpunk-blue.oneUse: true` — deletes itself after the next roll that includes it. **Implemented via custom subclass.**
- Card 10 (Wheel of Fortune): assume d10=8 for next check — post-roll hook intercepts. **Not an AE; system hook.**
- Card 12 (The Hanged Man): heal 5 HP + remove Fatigue — sheet button, not an AE.

### 9. Backup Drive (Netrunner architecture) — **RESOLVED via hook**
- `preDeleteEmbeddedDocuments` hook on Program-type actors: if a Backup Drive item is installed and the item being deleted is not Black ICE, the deletion is cancelled and the program is instead marked `running: false` until the next Disconnect.

### 10. Grenade / Affliction AEs without damage
- Affliction-type explosions that apply an AE (e.g., smoke, tear gas) can be created as Affliction damage weapons, and the AE is applied on hit. However, the duration (minutes = margin of failure) is dynamic and can't be set in a static AE template. **GM sets duration manually on the applied AE.**
