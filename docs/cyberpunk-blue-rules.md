# Cyberpunk Blue — Rules Digest

*A condensed but complete description of the game as it currently stands. This is a
description of **Cyberpunk Blue as a tabletop RPG**, not of its Foundry implementation —
enough to run it, explain it, or judge a rules question, without reference to code.*

Cyberpunk Blue is inspired by, but mechanically distinct from, R. Talsorian's *Cyberpunk RED*.
Where a name is shared the mechanics usually are not; where a RED concept is absent it is
absent deliberately. Blue has **no Humanity, no EMP/WILL/DEX stats, no Reputation track, and
no Nomad or Exec Roles**. See `docs/blue-vs-red.md` for the full divergence list.

Vehicles are deliberately omitted from this document; that subsystem is only partly designed.

---

## 1. The core mechanic

Everything resolves on a single flat **d10**. No exploding dice, no natural-20 equivalent,
no fumble table on the check itself.

```
1d10 + Primary Stat + Skill rank   vs.  DV     (success on equal or higher)
```

With a **Component** (a specialization of a skill), the trained value is the *lower* of the
two ranks:

```
1d10 + Primary Stat + min(Skill rank, Component rank)   vs. DV
```

Notation used throughout: `Skill (Component)` means that specific pairing. `STAT + Skill`
means to use that stat instead of the skill's default. `DV 15 TECH + Medicine` is a complete
instruction: roll it, succeed on 15+.

**Opposed checks** are common (Acting vs. INT + Human Perception; melee attack vs. Evasion).
Higher wins; **ties go to the attacker / active party**.

**Difficulty values** are set by the GM, by an opposing Actor, or by an item or ability.
Players never set their own DV. As a rough ladder, everyday competence sits around DV 10–13,
professional work 15, and expert-only feats 17–18+.

**LUCK** is spent *after* the roll but *before* the GM announces the outcome: +1 per point.
This is the player's lever on the narrative, and it is the only one.

**Modifiers.** Unfamiliar equipment (an odd handgun, an unknown biome) is −1 or −2.
Improvised melee weapons are always −2. Being Seriously Wounded is −2 on everything.
Bonuses from cyberware, drugs, Role abilities and Components stack additively; the game does
not use advantage-style dice manipulation.

---

## 2. Stats

Six stats. The first five are the **Primary Stats** and default to 6 for an unbuilt actor;
MOVE is a separate movement stat. Nothing can push a stat below 0.

| Short | Name | What it covers |
|---|---|---|
| **BODY** | Body | Strength, durability, physical force. Sets HP and Death Save. |
| **RFLX** | Reflexes | Speed, coordination, reaction. Sets Initiative; gates dodging bullets. |
| **INT** | Intelligence | Observation, reasoning, quick thinking. |
| **TECH** | Technological Ability | Hands-on understanding of hardware — build, repair, operate. |
| **COOL** | Cool | Social presence, projected confidence, attitude. |
| **MOVE** | Move | Movement rate. Starts at 5. |

Normal human range is 3–8 at creation; 10 is the practical ceiling. Values above 8 exist
only through cyberware, drugs, or long advancement.

### Derived and secondary values

| Value | Derivation |
|---|---|
| **HP** | (BODY × 5) + 10 |
| **Serious Wound Threshold** | ⌊max HP ÷ 2⌋ |
| **Death Save** | BODY (modified downward by critical injuries; never below 1) |
| **SP** (Stopping Power) | From the single armor source currently worn — armor does **not** stack |
| **PSYCHE** | Starts at 60 (max and current). Cyberware and trauma lower it |
| **LUCK** | Starts at 5. Refreshes on rest / at GM discretion. NPCs never have LUCK |
| **MOVE budget** | MOVE × 2 metres per turn (i.e. MOVE grid squares of 2 m each) |

---

## 3. Skills and Components

A skill has a **default Primary Stat**, but the GM may call for a different pairing when the
fiction demands it (Contortionist is RFLX to escape a rope, INT to tie one).

Some skills have **Components** — named specializations. A Component is rolled as
`min(skill, component)`, so a Component is worthless without the skill beneath it and vice
versa. Components are shared: *Cybernetics* hangs off both Electronics and Mechanics,
*Forgery* off Business, Government and Performance.

### The skill list

**Ranged Combat** — Archery (RFLX), Autofire (RFLX), Handgun (RFLX), Heavy Weapons (RFLX),
Shoulder Arms (RFLX).

**Close Combat** — Martial Arts (BODY) *[Aikido, Brawling, Judo, Karate, Taekwondo]*,
Melee Weapons (BODY), Evasion (RFLX).

**Athletics & Agility** — Athletics (BODY), Endurance (BODY), Contortionist (RFLX),
Drive (RFLX) *[Air Vehicles, Land Vehicles, Sea Vehicles]*.

**Stealth & Larceny** — Stealth (RFLX), Conceal (INT), Pick Lock (TECH),
Sleight-of-Hand (RFLX).

**Tech & Engineering** — Electronics (TECH) *[Basic Tech, Cybernetics, Media, Security,
Weaponstech]*, Mechanics (TECH) *[Air/Land/Sea Vehicles, Basic Tech, Cybernetics, Robotics,
Security, Weaponstech]*, Demolition (TECH), Netrunning (INT) *[Codebreak, Cracker, Dev,
Ghost, Quickhacking, Software, Spider]*, Medicine (TECH).

**Investigation & Lore** — Perception (INT), Deduction (INT), Criminology (INT),
Education (INT), Tactics (INT), Survival (INT), Animals (COOL).

**Social & Influence** — Acting (COOL), Influence (COOL), Human Perception (COOL),
Streetwise (COOL), Style (COOL), Performance (COOL) *[Braindance, Dancing, Forgery, Music,
Public Speaking, Visual Arts]*, Composition (COOL) *[Braindance, Dancing, Music, Sculpting,
Visual Arts, Writing]*.

**Trade & Society** — Business (INT) *[Bureaucracy, Business Strategy, Forgery]*,
Trading (INT), Government (INT) *[Bureaucracy, Business Strategy, Forgery, Politics, Public
Information]*, Gambling (INT).

### Notable skill rulings

- **Autofire** is a gate, not a weapon skill: an autofire attack uses the *lower* of the
  weapon's normal skill and Autofire.
- **Evasion** works freely in melee. Against ranged attacks you only get to roll if your
  **RFLX is 8 or higher** — ordinary people cannot dodge bullets.
- **Demolition** uses TECH normally, but RFLX when throwing grenades.
- **Netrunning** without NET Actions (i.e. without Netrunner ranks) only covers using
  ordinary software and neuroport commands. Only the **Software** Component works without
  NET Actions; Codebreak, Cracker, Dev, Ghost, Quickhacking and Spider all require them.
- **Melee Weapons** defaults to BODY; Light melee weapons use RFLX, Medium melee weapons
  let you choose.
- **Component uses are not Components.** Cloak and Slide are two *uses* of Ghost; they have
  no rank of their own, but effects can target one use without touching the rest.

---

## 4. Character creation

Eight steps, in order. Budgets are firm.

1. **Lifepath** (optional). Roll or choose from the lifepath tables — general background
   plus a Role-specific set (what kind of gang / corp / clinic you come from, who your
   friends and enemies are, who's gunning for you). Purely narrative, but it seeds
   connections between the player characters.
2. **Primary Stats.** **30 points** distributed among BODY, RFLX, INT, TECH, COOL.
   Minimum 3, maximum 8 per stat. All 30 must be spent.
3. **Secondary stats.** Derived, not chosen: MOVE 5, HP = BODY×5+10, Serious Wound
   Threshold = half that, Death Save = BODY, PSYCHE 60, LUCK 5.
4. **Languages.** You speak English (rank 2 — fluent) and have partial understanding of one
   other language (rank 1).
5. **Ability.** Either raise your second language to full fluency (rank 2), or take 1 rank in
   one Ability: *Sanity* (each rank: +3 current and max PSYCHE, max 10), *Lip-Reading* (acts
   as a Component wired to Perception, max 10), *Reaction Speed* (+1 Initiative per rank,
   max 3 — Initiative only), or another *Language*.
6. **Skills.** **35 points.** The economy:
   - 1 point = 1 skill rank.
   - Each rank bought in a skill that *has* Components also grants **1 free Component rank**
     in one of that skill's Components.
   - 1 point may instead buy **2 Component ranks** (in one or two Components).
   - Or, forgoing the free Component rank, 1 point buys **2 ranks in the same skill** —
     provided the skill does not end up above at least one of its Components.
7. **Role.** Choose one. You start at **rank 4** in it, and receive that Role's starting gear
   (weapons, armor, outfit, cyberware). Installed cyberware immediately reduces PSYCHE.
8. **Name.**

---

## 5. Roles

A Role is what you contribute to the story, and it comes with an ability that no one else
has. Ranks run 1–10. A character's **first** Role starts at rank 4; any Role acquired later
starts at rank 1, and **only one Role below rank 4 confers benefits at a time**. You cannot
take the same Role twice.

Roles fall into five **categories** that describe how the ability is *shaped* — categories
are not Roles and cannot be taken on their own.

| Category | Shape of the ability |
|---|---|
| **Leader** | Grants NPC subordinates or callable backup, controlled by the player. |
| **Networker** | A ladder of social reach; the highest unlocked tier is what matters. |
| **Protean** | A pool of points equal to Role rank, re-allocated freely among tactics. |
| **Specialist** | Four internal specialty tracks; each Role rank gives +1 in two of them. |
| **Sundry** | Bespoke — doesn't fit the other four. |

### The thirteen Roles

**Bandit** *(Networker)* — Gang muscle climbing the ladder. Adds Bandit rank to facedowns
within their own gang (half, rounded down, with other gangs). **Tough** (rank 1): activate to
ignore wound-state penalties for a minute and heal 1 HP; while active, take 2 less damage
from critical injuries and 2 instead of 5 from Foreign Object. Usable once, plus once per
three full ranks, refreshed on rest. Higher ranks (Thug 3, Ganger 5, Lieutenant 7, The Boss 9)
escalate how much of the gang obeys, and whether a facedown is needed first.

**Corpo** *(Leader)* — Corporate operator with subordinates. Gains a team member at rank 3,
a second at 5, a third at 9, plus escalating perks (corporate housing 2, Trauma Team Gold 6,
better housing 7, Platinum 8, villa 10). Each team member has a **Loyalty** score (starts 4,
max 10) that the GM adjusts by a published table — compliments +1, bonuses +4, taking a
bullet for them +8; berating them −2, forgetting a birthday −4, abandoning them under fire −8.
At Loyalty 0 they turn on you. New team members from HR cost €$200. Team member stats are
assigned from the array **3, 4, 4, 5, 7**, MOVE 5, LUCK 0, PSYCHE 50.

**Fixer** *(Networker)* — Middleman of the Street. Four strands scale with rank:
**Contacts** (who you can reach — local honcho → world leaders), **Reach** (the price tier
you can source at will — Everyday at rank 1 up to essentially anything at 10), **Haggle**
(add Fixer rank to Trading checks, and use the higher of COOL or INT; benefits escalate from
±10% price to doubling job pay), and **Grease** (cultural fluency, granting a Language rank
at ranks 3, 5, 7, 9, and twice at 10). At rank 5 they can run a monthly **Night Market**
where anything up to Super Luxury can be sourced.

**Guide** *(Sundry)* — Reader of fate, using a **major-arcana tarot deck**. At session start,
shuffle and draw cards equal to Guide rank; that spread is the **Reading**. Each card has a
trigger and an effect; when the trigger fires the Guide may play the card, immediately draw a
replacement, then resolve it. Once per session (twice at rank 5, three times at rank 10) they
may **meditate** for an in-game hour to redraw the whole Reading. **Cyberware closes paths**:
before each new Reading, remove one card from the deck for every full 10 that *max* PSYCHE is
below 60. Effects range from re-rolls (The Fool, The Chariot, Judgement) through flat bonuses
(+2/+3 on specific check types) to substituting a fixed die result (Wheel of Fortune = 8,
Temperance = 6), extra damage (The Tower, +1d6), healing (The Hanged Man: 5 HP and clears
Fatigued, at the cost of the Guide becoming Fatigued), and an out-of-turn action for someone
Mortally Wounded (Death).

**Law** *(Leader)* — Police of some stripe. The ability is **calling for backup**: as an
Action, roll `1d10 + Role rank` against the DV for the unit you want. Success means they
arrive in 1d6 rounds; a 6 on that die means slower arrival but the *next tier up* of backup.
At rank 10 two units respond. Unlocks: Corporate Security (DV 7, rank 1), Beat Cops (DV 9,
rank 3), Precinct Officers (DV 11, rank 5), SWAT (DV 14, rank 8), MaxTac (DV 16, rank 9),
International Special Agents (rank 10, GM-run). Abusing the privilege has career consequences.

**Media** *(Networker)* — Journalist trading on credibility. **Passive rumors**: each day the
GM secretly rolls the Media's Business, Government or Streetwise (full ranks, no Component)
plus Media rank against a DV ladder — 15 vague, 18 typical, 21 substantial, 25 detailed.
**Active digging** uses the same ladder three points easier (12/15/18/22). Streetwise may use
INT instead of COOL when INT is higher. Rank also sets **Access**, **Audience** and **Impact**
— from a neighborhood screamsheet to a worldwide audience. Publishing converts roughly 10% of
the audience, +5% per Role rank, +5% per verifiable easily-understood fact (max +20%).

**Medtech** *(Specialist)* — Specialties: **Battle Medic** (add ranks to all ordinary Medicine
checks; *Patching Up* heals 2 × rank HP with ten minutes' work, once per person per day),
**Surgery** (required for treating serious critical injuries, installing cyberware, and any
invasive procedure — without a Surgery Medtech those things simply cannot be done),
**Pharmaceuticals** (analyze compounds; *Synthesize* one new drug per rank — materials €$100
for doses equal to rank, one hour, DV 15 TECH + Medicine (Pharmaceuticals)), and **Cryosystem
Operation** (stasis: DV 13 for a cryopump, 15 for a tank; tanks also enable full body
modification, and higher ranks grant more equipment).

*Medtech-synthesizable drugs:* Antibiotic (+3 HP/day natural healing for a week),
Anti-Psychosis (restore 1d6 PSYCHE, one dose/week), Myelin Strengthener (+1 RFLX, 2d6 hours),
Rapidetox (purge all drugs and poisons), Roids (+1 BODY, 2d6 hours), Runnerspeed (+1 NET
Action for an hour), Speedheal (heal BODY HP if not Mortally Wounded, once/day), Stim (ignore
Seriously Wounded penalties for an hour), Surge (no sleep needed for 24 hours), Torpor
(unconscious 2d6 hours; DV 15 Medicine to detect vital signs; comes with an antidote).
Administering a drug takes an Action; an unwilling target requires a BODY + Melee Weapons
attack that delivers the dose instead of damage. Anyone without Medtech training who
administers pharmaceuticals gets unreliable, possibly dangerous results.

**Netrunner** *(Sundry)* — The ability is simply **NET Actions**: `1 + ⌈rank ÷ 3⌉` per turn,
so 2 at ranks 1–3, 3 at 4–6, 4 at 7–9, 5 at rank 10. Everything else is the netrunning rules
(§9).

**Ninja** *(Protean)* — Points equal to Role rank, re-allocated when rolling Initiative or as
an Action. Tactics: **Poison** (a toxin you personally applied to a melee weapon; on any
penetrating hit the target rolls BODY + Endurance vs DV 11 + points or takes 1d6 straight to
HP), **Silent Death** (+1 Stealth per point), **Threat Detection** (+1 Perception per point;
does not stack with the Solo tactic of the same name), **Martial Skill** (+1 melee/MA attack
per 2 points, max +3), **Seek Cover** (2 points: +5 Initiative, but your first turn may only
hide or retreat), **Weak-Spot** (2 points bypasses 3 SP, +3 SP per further 2 points, max 15;
does not ablate the armor, and single-shot only), **Precision Kill** (against an unaware
target: +1d6 at 3 points, +2d6 at 6, +3d6 at 9).

**Operative** *(Specialist)* — Specialties: **Analysis**, **Infiltration**, **Preparation**,
**Undercover**. Analysis, for example, allows **Coded Message** (hide information in innocuous
text; decoding is INT + Deduction vs DV 10 + your INT + your Analysis rank) and adds ranks to
INT checks that sort information, with **Pattern Recognition** at rank 4 adding half ranks to
Deduction and Human Perception.

**Rocker** *(Networker)* — Choose a medium of expression (a Composition/Performance Component,
or Acting); add Rocker rank to checks using it. **Converting a fan**: DV 8, plus the target's
INT or COOL (their choice) if they actively disagree; against a crowd, every step above DV 10
converts 5% of non-fans. **Calling on fans**: `1d10 + COOL + Rocker rank` — DV 15 for one
individual, 18 for a small group (~20), 22 for a large group (~100), +1 per rank above what
was needed. What fans will *do* escalates from buying you a drink at rank 1 to a cult-like
private army at rank 10.

**Solo** *(Protean)* — Points equal to Role rank, re-allocated out of combat, on Initiative,
or as an Action. Tactics: **Initiative Reaction** (+1 Initiative per point), **Pummel**
(1 point: +1 damage with Martial Arts (Brawling) while holding any weapon; 2 points: use any
one-handed object as a Light Melee weapon, two-handed as Medium), **Spot Weakness** (+1 damage
before armor on your first successful attack each round, per point), **Threat Detection**
(+1 Perception per point; doesn't stack with the Ninja version), **Damage Deflection**
(reduce the first damage you take each round by 1 per 2 points, max 5), **Precision Attack**
(+1 to all attacks per 3 points, max +3), **Fumble Recovery** (4 points: re-roll a natural 1
on an attack die; you must take the new result).

**Techie** *(Specialist)* — Specialties: **Field** (fixing things on the fly), **Upgrade**
(improving existing items), **Fabrication** (building from scratch), **Invention** (creating
genuinely new items and modifications).

---

## 6. Advancement — Improvement Points

**IP** is the XP equivalent. The GM grants it; `totIP` tracks lifetime IP as a general
power-level measure while `IP` is the spendable pool.

| Purchase | Cost (Rank = the new rank being bought) |
|---|---|
| Primary Stat, MOVE, or LUCK max | 80 × new rank |
| Skill rank | 30 × new rank |
| Component rank | 30 × new rank |
| New Ability | 40 |
| Raise an Ability | 40 × new rank (up to its max rank) |
| New Role | 60 |
| Raise a Role | 60 × new rank (cap 10) |

Stats, skills and components cap at **rank 10**. LUCK's base is 5, so the first LUCK purchase
is LUCK 6 at 480 IP. Buying a skill rank still grants the free Component rank as at creation,
and Component purchases can bundle a free skill or second Component rank under the same
conditions.

---

## 7. Combat

### Turn structure

**Initiative** is `1d10 + RFLX` (+ Reaction Speed, + Solo Initiative Reaction, etc.). Ties
break on highest RFLX, then player characters before others, then randomly.

On your turn you get **movement** and **one Action**.

- **Movement**: up to **MOVE × 2 metres** (MOVE squares of 2 m). Movement may be split around
  the Action, and attacks may happen at different points along it.
- **Attack Action**: choose an equipped weapon and attack up to its **RoF** times. The
  attacks may have different targets.
- **Sprint**: spend the Action to gain another MOVE × 2 metres of movement.
- **Reload**: return the current magazine's ammo to inventory and load compatible ammo.
- **Throw**: see below.
- **Interact**: the catch-all — the GM decides what check, if any, is needed.

**Throwing at a point**: an Athletics check that must reach `6 + the distance in metres`.
Missing by less than 10 still lands, but in a random direction, off by as many metres as you
fell short (blocked by walls). Missing by 10 or more is a clean failure.

### Making an attack

**Melee** requires the target within 2 m (weapon mods can extend this). The **target rolls
Evasion, and that roll is the DV.** Attacker wins ties. Attacks cannot pass through anything
that blocks movement.

**Ranged**: the DV comes from the weapon's **range table** — a row of DVs for the bands
0–6 m, 6–12, 12–25, 25–50, 50–100, 100–200, 200–400, 400–800 m. A `0` or `–` entry means the
weapon cannot reach that far at all. If the target has **RFLX 8+**, they may also roll
Evasion, and the attack must beat the *higher* of the range DV and the Evasion roll.

Common range profiles (DV per band):

| Weapon type | 0–6 | 6–12 | 12–25 | 25–50 | 50–100 | 100–200 | 200–400 | 400–800 |
|---|---|---|---|---|---|---|---|---|
| Pistols (all) / Stun Gun | 13 | 15 | 20 | 25 | 30 | 30 | — | — |
| SMG / Heavy SMG | 15 | 13 | 15 | 20 | 25 | 25 | 30 | — |
| Shotgun | 13 | 15 | 20 | 25 | 30 | 35 | — | — |
| Assault Rifle | 17 | 16 | 15 | 13 | 15 | 20 | 25 | 30 |
| Precision Rifle | 30 | 25 | 17 | 15 | 17 | 18 | 25 | — |
| Sniper Rifle | 30 | 25 | 25 | 20 | 15 | 16 | 17 | 20 |
| Machine Gun | 25 | 20 | 17 | 15 | 17 | 20 | 20 | 25 |
| Grenade Launcher | 16 | 15 | 15 | 17 | 20 | 22 | 25 | — |
| Rocket Launcher | 17 | 16 | 15 | 15 | 20 | 20 | 25 | 30 |
| Bow/Crossbow | 15 | 13 | 15 | 17 | 20 | 22 | — | — |
| Thrown | 15 | 13 | 25 | — | — | — | — | — |

**Targeting vitals** (the head, or a specific weak point) is **−8 to hit** by default; some
weapons and mods change that penalty. A critical injury from a vitals hit rolls on the Head
table instead of the Body table.

### Weapon baselines

| Type | Damage | RoF | Mag | Shots/attack | Hands | Concealable |
|---|---|---|---|---|---|---|
| Light Melee | 1d6 | 2 | — | — | 1 | yes |
| Medium Melee | 2d6 | 2 | — | — | 1 | no |
| Heavy Melee | 3d6 | 2 | — | — | 1 | no |
| Very Heavy Melee | 4d6 | 1 | — | — | 2 | no |
| Medium Pistol | 2d6 | 2 | 12 | 1 | 1 | yes |
| Heavy Pistol | 3d6 | 2 | 8 | 1 | 1 | yes |
| Very Heavy Pistol | 4d6 | 1 | 8 | 1 | 1 | no |
| SMG | 2d6 | 2 | 30 | 3 | 1 | no |
| Heavy SMG | 3d6 | 1 | 40 | 4 | 1 | no |
| Shotgun | 5d6 | 1 | 4 | 1 | 2 | no |
| Assault Rifle | 5d6 | 1 | 25 | 1 | 2 | no |
| Precision / Sniper Rifle | 5d6 | 1 | 5 / 4 | 1 | 2 | no |
| Machine Gun | 5d6 | 1 | 50 | 10 | 2 | no |
| Flamethrower | 5d6 | 1 | 10 | 1 | 2 | no |
| Grenade / Rocket Launcher | 6d6 | 1 | 2 / 1 | 1 | 2 | no |
| Bow/Crossbow | 2d6 | 1 | 1 | 1 | 2 | no |
| Thrown | 1d6 | 1 | 1 | 1 | 1 | yes |
| Stun Gun | 3d6 | 2 | 12 | 1 | 1 | yes |

Individual weapons in the catalogue deviate from these baselines and carry their own quirks:
**Excellent Quality** (+1 to hit), **Poor Quality** (jams after firing on a 1), **Cheap**
(jams on a 1, and the shot is lost), **Smart** weapons (+1, more with smart ammo, and smart
rounds self-correct on a near miss), **Tech** weapons (charge them, trading effects for
power), **Power** weapons (can ricochet around cover at −4, and crit for +10 instead of +5),
and various one-off behaviors.

### Autofire

Requires a weapon with an autofire mode and the **Autofire** skill. The check uses
`min(weapon skill, Autofire)`. It consumes **10 rounds** (some mods reduce this to a minimum
of 8), and uses the weapon's separate autofire range table, which is generally harsher and
shorter-ranged.

Damage is the weapon's autofire damage **multiplied by how much the attack beat the DV**,
capped at the weapon's autofire multiplier and never below ×1. Autofire cannot target vitals,
and its critical injuries always use the Body table.

### Damage and armor

1. Roll the weapon's damage dice.
2. **Critical check**: if **two or more damage dice show 6** *and* at least one point of the
   unmodified roll would penetrate the target's SP, the attack is a **critical hit** —
   add **+5** damage (+10 for Power weapons) and roll on a critical injury table.
   Halved damage (AoE outer zone, successful evasion against an explosion) suppresses this.
3. **Subtract SP.** Whatever remains comes off HP. If the damage was **equal to or greater
   than SP**, the armor **ablates by 1** (2 for Armor-Piercing ammo).
4. **Only one armor source applies** — the highest current SP. Armor does not stack.

Effects modify this in three distinct ways: **ignore armor entirely** (Choke), **armor
penetration** (treat SP as lower — Armor-Piercing ammo, Karate/Taekwondo halving, Weak-Spot
bypassing, a charged Tech weapon halving), and **no ablation** (rubber ammo, Brawling's
Strong Attack — damage gets through but the armor is not degraded).

### Area and special attacks

- **Cone** (flamethrowers, shotgun-like spreads): a cone of given angle and reach; walls clip
  it.
- **Explosion**: full damage inside the inner radius, half within the outer radius. A target
  who beats the attack roll with Evasion halves it again.
- **Affliction** (gas, stun, toxins): deals no HP damage. On a hit that *would* have
  penetrated SP, the target rolls a stat + skill check against the weapon's affliction DV;
  on a failure they take a condition. Outer-zone targets in an affliction blast get +2 to
  resist. Some afflictions expire after a set number of rounds, others until the GM removes
  them. Grenades may leave a **persistent residue** region that blocks or hampers vision.
- **Toxins** are weapon modifications applied to a blade, triggering on a penetrating hit.
- **Caltrops** and similar hazards are placed areas that damage anything moving through.

### Martial arts

Martial Arts attacks use `BODY + Martial Arts (Component)`, RoF 2, within 2 m, and may target
vitals. Damage scales off BODY: **<5 → 1d6, 5–7 → 2d6, 8–10 → 3d6, 11+ → 4d6** (cyberware
like Big Knucks adds dice).

Component SP handling: Aikido, Brawling and Judo use full SP; **Karate and Taekwondo ignore
half** (rounded up).

Special moves:

| Move | Component | Effect |
|---|---|---|
| **Grab** | any (+1 for Aikido/Brawling/Judo) | Contest of `max(BODY, RFLX) + Martial Arts`. Win to grapple or take an item. |
| **Choke** | requires grapple | BODY damage **ignoring armor entirely** — SP neither blocks nor degrades. After 3 chokes, or if it would drop them below 1 HP, the target is Unconscious at 1 HP. |
| **Throw** | requires grapple | BODY damage ignoring **half** SP (round up), target knocked Prone, grapple ends. |
| **Iron Grip** | requires grapple | Target has −2 on all escape attempts. |
| **Recovery** | — | DV 14 Martial Arts to shed Prone; failure wastes the action. |
| **Improvised Weapon** | Brawling | Use Brawling for thrown or improvised Light/Medium/Heavy melee weapons. |
| **Strong Attack** | Brawling | Ignores half SP and does **not** ablate armor. |
| **Disarming Combination** | Aikido | After a hit, DV 15 RFLX + Martial Arts (Aikido) to take something from their hand. |
| **Armor Breaking Combination** | Karate | After a successful attack (RoF 2+), a Karate attack then a DV 17 Karate check reduces target SP by 1 extra. |
| **Bone Breaking Combination** | Karate | −4, RoF 1, may target vitals. On a hit: guaranteed Cracked Ribs (Cracked Skull if aimed at vitals). |
| **Counter Throw** | Judo | After being attacked in melee without being hit since your turn: DV 17 RFLX + Judo to throw the attacker Prone up to 2 m, optionally with a follow-up attack. |
| **Grab Escape** | Judo | DV 17 RFLX + Judo to escape a grapple; on success the grappler suffers a Broken Arm. |
| **Pressure Point Strike** | Taekwondo | −6, RoF 1, may target vitals. On a hit: guaranteed Spinal Injury (Brain Injury if aimed at vitals). |
| **Flying Kick** | Taekwondo | Target must be 4+ m away. SP counts as only **¼** (round up). If your RFLX or BODY exceeds the target's BODY, they're knocked back that many metres. |

---

## 8. Injury, death, and healing

### Wound states

- **Seriously Wounded** — current HP below the Serious Wound Threshold (half max HP) but
  above 0. **−2 on all checks.** A Pain Editor suppresses it.
- **Mortally Wounded** — HP at 0 or below. See death saves.
- **Needs Stabilization** — applied by *any* HP loss. It blocks natural healing until cleared
  by a Stabilize check. Taking further damage re-applies it.
- **Dead** — every stat except BODY drops to 0.

### Critical injuries

A critical hit rolls **2d6** on the Body table, or the Head table if the attacker was
targeting vitals. Each injury carries a lasting Active Effect, a treatment DV, and sometimes
a **quick fix** DV (a battlefield patch) — some injuries have no quick fix, and several
require a Medtech with the Surgery specialty.

**Body (2d6)**

| 2d6 | Injury | Effect | Quick fix | Treatment |
|---|---|---|---|---|
| 2 | Dismembered Arm | Mortal; Death Save −1 | — | DV 17, surgery |
| 3 | Dismembered Hand | Mortal; Death Save −1 | — | DV 17, surgery |
| 4 | Collapsed Lung | Mortal; MOVE −2, Death Save −1 | 15 | DV 17, surgery |
| 5 | Broken Ribs | — | 15 | DV 18 (15 with surgery) |
| 6 | Broken Arm | — | 15 | DV 18 (15 with surgery) |
| 7 | Foreign Object | Ongoing damage until removed | — | DV 14 |
| 8 | Broken Leg | MOVE −2 | 15 | DV 18 (15 with surgery) |
| 9 | Torn Muscle | −2 Athletics, Martial Arts, Melee Weapons | — | DV 13 |
| 10 | Spinal Injury | Death Save −1 | 17 | DV 17, surgery |
| 11 | Crushed Fingers | — | 15 | DV 15, surgery |
| 12 | Dismembered Leg | Mortal; MOVE −6, Death Save −1 | — | DV 17, surgery |

**Head (2d6)**

| 2d6 | Injury | Effect | Quick fix | Treatment |
|---|---|---|---|---|
| 2 | Lost Eye | RFLX −4, Death Save −1 | — | DV 17, surgery |
| 3 | Brain Injury | −2 to **all** stats, Death Save −1 | — | DV 17, surgery |
| 4 | Damaged Eye | RFLX −2 | 15 | DV 15, surgery |
| 5 | Concussion | — | — | DV 13 |
| 6 | Broken Jaw | — | 15 | DV 18 (15 with surgery) |
| 7 | Foreign Object (Head) | — | — | DV 13 |
| 8 | Whiplash | RFLX −1, Death Save −1 | 15 | DV 15 (13 with surgery) |
| 9 | Cracked Skull | Mortal; Death Save −1 | 17 | DV 18 (15 with surgery) |
| 10 | Damaged Ear | — | 15 | DV 15, surgery |
| 11 | Crushed Windpipe | Mortal; Death Save −1 | — | DV 15, surgery |
| 12 | Lost Ear | Death Save −1 | — | DV 17, surgery |

Injuries marked **Mortal** need stabilization on top of everything else. Note that critical
injuries drive the **Death Save** downward permanently until treated — the more times you've
been carved up, the less likely you are to survive the next time you go down.

### Stabilization

A **Medicine** check by someone at the patient's side (within 2 m):
**DV 10** normally, **DV 13** if Seriously Wounded, **DV 15** if Mortally Wounded.
Success clears Needs Stabilization; a Mortally Wounded patient is brought to 1 HP and left
Unconscious.

### Death saves

While Mortally Wounded, at the **end of each of your turns** roll **1d10 against your Death
Save** (BODY, minus accumulated critical-injury penalties, never below 1). Rolling **at or
under** it means you hold on. Rolling over it: you fall Unconscious — or, if already
Unconscious, **you die**.

Once dead, a **Death State** on a 0–10 scale tracks how recoverable the body is:
`1 + (death-save penalty at time of death) + ⌊post-death damage ÷ 4⌋ + post-death critical
injuries + 1 per minute elapsed`, capped at 10. Higher Death States mean less can be brought
back.

### Healing

**Natural healing** happens on a full rest: heal **BODY** HP, provided you are stabilized.
Enhanced Antibodies cyberware doubles it; the Antibiotics drug adds +3/day for a week.
On top of that, a Medtech with Battle Medic can **Patch Up** for 2 × specialty rank HP, once
per person per day.

---

## 9. Netrunning

Netrunning is a subsystem for one Role, run inside a **NET Architecture** — a mapped space of
nodes the runner physically moves through as a token.

**Jacking in.** A Netrunner needs a **cyberdeck** and an **Access Point** within range. The
deck has **RAM** (spent on quickhacks and programs, restored by a **Defrag**), plus hardware,
software and flexible **slots** that hold Program Executables. Only programs *installed on a
cyberdeck and running* confer any benefit.

**NET Actions.** On your turn you may spend your Action to take `1 + ⌈Netrunner rank ÷ 3⌉`
NET Actions. Each NET Action is a roll of `1d10 + Netrunner rank + min(Netrunning skill,
Component rank)`, modified by the specific *use*.

**The Components and their uses:**

| Component | Uses | Purpose |
|---|---|---|
| **Spider** | Eye-Dee, Pathfinder, Scanner | Explore the architecture, identify what's in a node, read data. |
| **Codebreak** | Breach, Encrypt/Decrypt | Break firewalls; encrypt or decrypt data (a timed operation). |
| **Ghost** | Cloak, Slide | Move undetected; slip away from something that spotted you. |
| **Cracker** | Zap, Defend | Attack hostile programs and enemy runners; defend against them. |
| **Dev** | Code, Deconstruct | Write and analyze programs. |
| **Quickhacking** | Upload, Quickbreach | Hack a target's neuroport in meatspace. |
| **Software** | — | The only Netrunning Component usable without NET Actions: operating existing software. |

**Programs.** A Program Executable has six stats:

| Stat | Meaning |
|---|---|
| **ACT** | NET Actions the program gets per turn |
| **ATK** | Added to 1d10 when the program attacks |
| **DEF** | What an attack must beat to hit it |
| **NET** | The program's own netrunner proficiency for NET Actions |
| **PER** | What a runner must beat to escape its notice |
| **REZ** | The program's hit points — at 0 it is frozen (`##ERROR##`) and must be closed and reopened |

Program types: Attack, Defense, Booster, Quickhack, Daemon, ICE, Black ICE, Malware. Defense
programs do things like **Ablate** (absorb damage equal to current REZ, then lose 1 REZ),
**Reduce**, **Block** (negate damage at or below a threshold), **Intercept** (take the hit
instead, then deactivate), **Cool** (prevent Burning), and **Restore** (save a program from
deletion). Attack programs can, beyond damage, apply conditions, derez or delete the target's
programs, cut their NET Actions, impose stat penalties, node-lock them, or force an unsafe
disconnect.

**Black ICE** engages automatically when a runner enters its node — it is the reason running
is dangerous.

**Quickhacking** (attacking a person's cyberware rather than a network):
**Breach** them first — `INT + Networker rank + min(Netrunning, Quickhacking)` against
`DV 18 + 2 per layer of Self-ICE` the target has. Once Breached, **Upload** a quickhack,
paying its RAM cost; it activates after a countdown of rounds. Uploading requires the target
to have a Neuroport. **Self-ICE** is the defense: each installed layer is a Passwall, with
DVs of 10, 12, 14, … per layer.

**Disconnecting.** A safe jack-out costs nothing. An **unsafe disconnect** — forced by a
program or triggered by dropping to 0 HP — deals damage. **KRASH-Barrier** hardware converts
an unsafe disconnect into a safe one.

---

## 10. Gear, cyberware, and PSYCHE

### Money and cost tiers

Prices are quoted on a fixed ladder rather than as exact figures:

| Tier | Price |
|---|---|
| Cheap | €$10 |
| Everyday | €$20 |
| Costly | €$50 |
| Premium | €$100 |
| Expensive | €$500 |
| Very Expensive | €$1,000 |
| Luxury | €$5,000 |
| Super Luxury | €$10,000 |

### Gear

Gear sits in three states: **Equipped** (the only state where its effects apply and its
weapons or armor count), **Carried**, and **Owned** (stashed elsewhere). Categories in the
catalogue: Body Armor, Grenades, Chipware, Computer Hardware, Architecture Hardware, Media
Gear, Scientific & Medical, Clandestine Gear, Survival & Exploration, Outfits, Miscellaneous.

**Armor SP**: Leather 4, Kevlar 7, Light Bodyweight Suit 9, Light Armorjack 11, Bodyweight
Suit 11, Medium Armorjack 12, Heavy Armorjack 13, Flak 15, Bulletproof Shield 15,
Metalgear 18. Armor degrades as it takes hits and is repaired back toward its maximum SP.
(The Bodyweight Suits are netrunner wear — they also reduce Black ICE and remote-hacking
damage by 1 and stop programs setting the wearer alight.)

**Ammo** comes in weapon-specific types (medium/heavy/very heavy pistol, SMG, shotgun slug
and shell, rifle, sniper, arrow, grenade, rocket, fuel, battery), each with Basic, **Smart**
(guided, +to-hit and self-correcting), **Armor-Piercing** (reduces effective SP, ablates 2),
**Incendiary**, **Rubber** (no ablation), **Toxic** and other variants.

**Chipware** (skill chips, Pain Editor, sensory boosts) are Gear that slots into a Neuroport,
not cyberware. A Skill Chip sets a floor on the relevant skill rank rather than adding to it.

**Modifications** are separate items attached to gear or cyberware — Cyberware Mods, Gear
Mods, Weapon Mods (silencers, scopes, grips, bipods, thermal imaging) and Hardware Mods
(cyberdeck upgrades). Weapon mods change to-hit, range, recoil, ammo behavior and more; some
are *activatable* (a deployed bipod) rather than always-on.

### Cyberware

Cyberware is organized by type — **neuralware, cyberoptics, cyberaudio, cyberarms, cyberlegs,
internal, external, fashionware, borgware** — and by **integration**:

- **Platform** — provides slots (a Neuroport, a Cyberarm, a Cybereye housing).
- **Extension** — consumes slots on a compatible Platform.
- **Stand-alone** — needs no platform.

An Extension with no Platform to sit in is **Unconnected** and does nothing at all. Disable a
Platform and everything in it goes down with it.

**Installation** requires a facility, and — for anything invasive — a Medtech with the Surgery
specialty. Defaults scale with facility: **Mall** (€$50, DV 12), **Clinic** (€$100, DV 15),
**Hospital** (€$500, DV 18). Some implants are installed against
TECH + Medicine (Cybernetics) rather than Surgery.

### PSYCHE

PSYCHE is mental integrity — the closest thing Blue has to a humanity track, but *not*
equivalent to it. It starts at 60 current and 60 max.

Each piece of cyberware has a **PSYCHE loss** roll (e.g. 2d6). You may take the rolled value
or the listed average, but you always take it. Critically, cyberware also **lowers your
maximum PSYCHE by the number of dice in that roll** — therapy can restore current PSYCHE, but
never above the reduced maximum. Chrome is permanent in a way injury is not.

The *Sanity* Ability raises both current and max PSYCHE by 3 per rank; Anti-Psychosis restores
1d6 current PSYCHE (once per week).

**PSYCHE states:**

| Current PSYCHE | State |
|---|---|
| 30+ | Stable |
| 20–29 | **Disassociation** — at least one symptom showing strongly |
| 10–19 | **Disrupted Mind** — three symptoms intensely, on the edge of a breakdown |
| 0–9 | **Beginning Cyberpsychosis** — five or more symptoms; other people stop feeling real |
| below 0 | **Full Cyberpsychosis** — the GM takes the character, playing them as violent and uncontrollable, until PSYCHE is positive again |

Symptoms: grandiose sense of self, self-hatred, manipulative behavior, visual and auditory
hallucinations, lack of remorse, impulsivity, aggression, refusal to accept responsibility,
ruthlessness, and an excessive need for adrenaline or sensory rush.

The Guide's tarot ability is also gated by max PSYCHE — every 10 points of permanent loss
removes a card from their deck.

### Drugs and addiction

Street drugs (Black Lace, Blue Glass, Boost, Smash, Speed, Synthcoke, RPM, PDGF Injection,
Immunoblockers) run through a use → effect → wear-off cycle with a **wear-off check**, and
repeated use risks a permanent **Addiction**. Medtech-synthesized pharmaceuticals (§5) are
the clean, controlled counterpart.

---

## 11. Conditions

| Condition | Effect |
|---|---|
| **Dying** | −2 to all stats, MOVE −6 |
| **Unconscious** | Cannot act; MOVE 0 |
| **Asleep** | As Unconscious |
| **Dead** | All stats but BODY reduced to 0 |
| **Prone** | MOVE −2 |
| **Stunned** | −4 to all stats |
| **Restrained** / **Grappled** | MOVE 0 |
| **Blind** | −10 on Handgun / Shoulder Arms / Heavy Weapons attacks, and those **automatically miss** beyond 5 m |
| **Deaf** | No fixed modifier — GM-adjudicated on hearing-based checks |
| **Burning: Embers / Fire / Deadly** | 2 / 4 / 6 damage per round |
| **Fatigued** | −2 to all stats |
| **Severe Fatigue** | −2 BODY/TECH/COOL, −4 RFLX/INT |
| **Extreme Fatigue** | −4 BODY/TECH/COOL, −6 RFLX/INT, MOVE 2 |

---

## 12. NPCs and Mooks

**NPCs** use the same rules as player characters, with two changes: LUCK is always 0, and any
skill not explicitly listed on them is rank 0.

**Mooks** are the fast-resolution stat block. They have BODY, MOVE, HP, SP and a single
**Combat Number (CN)**:

- Any listed skill (or a listed skill + listed Component pairing) rolls `1d10 + CN`.
- Anything else — any unlisted skill, or a bare stat check — rolls `1d10 + ⌊CN ÷ 2⌋`.
- BODY is tracked normally, because it drives HP and death saves.

This makes a mook a two-number opponent: how hard they hit and how much they can take. Law
backup, gang muscle and corporate security all use it.

---

## 13. Things the GM adjudicates

Blue deliberately leaves a lot in the GM's hands rather than pinning it to a table:

- All DVs not fixed by a weapon, ability or item.
- Loyalty changes for a Corpo's team, and what a Networker's contacts will actually do.
- Whether a tarot card's trigger has been met.
- Whether an unfamiliar situation warrants the −1/−2 unfamiliarity penalty.
- Facedowns — the game's opposed-attitude contest, referenced by Bandit and by the Guide's
  Emperor card, and typically COOL-based.
- Drug interactions, timing, and stacking.
- When LUCK refreshes.

---

## Appendix: quick reference

- **Everything**: `1d10 + Stat + Skill` (or `min(Skill, Component)`) vs. DV, ties to the actor.
- **HP** = BODY×5+10. **SWT** = half that. **Death Save** = BODY. **PSYCHE** = 60. **LUCK** = 5.
- **Move** = MOVE × 2 m per turn; Sprint spends the Action to double it.
- **Initiative** = 1d10 + RFLX.
- **Melee DV** = the target's Evasion roll. **Ranged DV** = the range table (Evasion only if RFLX 8+).
- **Vitals** = −8 to hit, Head crit table.
- **Crit** = two or more 6s on damage dice *and* the raw roll penetrates SP → +5 damage and a 2d6 injury.
- **Damage** = roll − SP, off HP; SP ablates 1 if damage ≥ SP. Only one armor source counts.
- **Autofire** = 10 rounds, `min(skill, Autofire)`, damage × (margin of success, capped).
- **0 HP** = Mortally Wounded; roll 1d10 ≤ Death Save each turn end or fall Unconscious, then die.
- **Stabilize** = Medicine DV 10 / 13 (Seriously Wounded) / 15 (Mortally Wounded).
- **Rest** heals BODY HP, if stabilized.
- **Character creation** = 30 stat points (3–8), 35 skill points, one Role at rank 4.
