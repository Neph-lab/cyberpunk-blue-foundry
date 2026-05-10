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
- Skill Chip: `system.skills.<slug>.bonus` to raise effective rank to 3 if currently below 3 (**limitation: `upgrade` mode doesn't work on `bonus`; use a macro or computed value — see Limitations below**)
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
- Runner-speed: descriptive AE noting +1 NET action (NET action count is computed in code, not AE-driven)
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

## Limitations — Things That Cannot Be Done Effectively with AEs

### 1. Conditional per-round effects (round-bounded, first-use-only)
- **Solo Damage Deflection** — "reduce the *first* damage taken each round by 1". AEs have no per-round trigger; the system would need a custom hook on `applyDamage` that checks a per-turn counter. Not implementable as a standard AE. **GM handles.**
- **Solo Spot Weakness** — "+1 damage to *first successful attack* each round". Same constraint. **GM handles.**
- **Ninja Weak-Spot** (bypass armor ≤ N SP) — conditional on target's current SP. Not expressible in AE change keys. **Applied manually at attack resolution.**
- **Solo Fumble Recovery** — reroll 1s on attack dice. Requires a hook on roll evaluation, not an AE change. **GM handles / future hook.**

### 2. Distance/positioning conditions
- **TeleOptics** (+1 attack rolls >50m, not Autofire) — AEs have no range awareness. **Descriptive AE reminder; GM applies manually.**

### 3. Skill minimum floor (Skill Chip)
- Skill Chip should "treat skill rank as 3 if user < 3" — this is an `upgrade` operation on the derived roll total, not a simple add. Foundry's `upgrade` mode on `bonus` would give `max(bonus, 3)` which isn't the same as `max(rank + bonus, 3)`. **Implemented as a descriptive AE; the roll dialog will show the bonus; GM adjusts manually for characters with rank < 3.**

### 4. Drug multi-step wear-off / hangover / long-term sequencing
- The full drug Instructions sequence (use → usage AE → wear-off → endurance check → hangover → long-term AE) requires the Instructions array flow. Individual AEs can represent each stage, but the automated sequencing and Endurance check prompts are outside what a single AE can do. **Requires Instructions implementation.**

### 5. NET action count (Runner-speed, Netrunner rank)
- `roleMechanics.netActionsTotal = 1 + ceil(rank/3)` is computed in sheet context code, not in the data model, so AEs cannot modify it directly. Runner-speed's "+1 NET action for 1 hr" cannot be expressed as a standard AE change. **Descriptive AE; GM enforces.**

### 6. Sandevistan cooldown damage
- Re-using Sandevistan within 1 hr deals 3d6 HP to self. This is a conditional triggered effect, not an AE. **Descriptive AE for the cooldown; GM applies damage manually.**

### 7. Quickhack AEs
- "Breached" AE references a specific hacker Actor UUID and has prerequisite checks (range, RAM). "Upload" AEs fire at end of next turn. These require custom flag-based AEs with system hooks, not standard change-key AEs. **Implemented separately via the Netrunning system.**

### 8. Guide Tarot card AEs
- Most Tarot effects require triggered dialogs, player choice, or replace-the-die-roll mechanics. Standard AEs can handle a few:
  - Card 15 (The Devil): `system.stats.<any>.rollMod` +1 for 1 hr — **workable as AE**
  - Card 1 (The Magician): +3 bonus on next check only — requires a one-use AE that deletes itself after firing. **Not standard AE; needs a custom ActiveEffect subclass or macro.**
  - Card 10 (Wheel of Fortune): assume d10=8 for next check — requires intercepting the roll, not modifiable via AE change key. **GM handles.**
  - Card 12 (The Hanged Man): heal 5 HP + remove Fatigue — data write, not an AE. **Handled by sheet button.**

### 9. Backup Drive (Netrunner architecture)
- "Recover deleted non-Black-ICE programs" — reactive on deletion events. AEs have no deletion trigger. **Custom hook required.**

### 10. Grenade / Affliction AEs without damage
- Affliction-type explosions that apply an AE (e.g., smoke, tear gas) can be created as Affliction damage weapons, and the AE is applied on hit. However, the duration (minutes = margin of failure) is dynamic and can't be set in a static AE template. **GM sets duration manually on the applied AE.**
