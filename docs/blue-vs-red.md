# Cyberpunk Blue vs. Cyberpunk Red — Quick Reference

Cyberpunk Blue is **inspired by but mechanically distinct from** R. Talsorian Games' Cyberpunk RED. Many concepts share names with similar Red equivalents; many do not exist in Blue at all. LLM training data is dominated by Red, so terminology drift is the single largest risk when generating new content, tables, or docs.

**Consult this file before** writing any list, table, or prose that names stats, resources, roles, categories, skills, or other rules concepts. If a term isn't listed here as a confirmed Blue concept, verify against the authoritative source listed below before using it.

---

## Authoritative sources in this repo

| Topic | File |
|-------|------|
| Stats / skills / resources | `module/helpers/config.mjs` (`STATS`, `SKILLS`) + `module/data/base-actor.mjs` (`resources` schema) |
| Roles & abilities | `docs/Roles-source.md` (the canonical Blue write-up) + `module/data/role-catalogue.mjs` |
| Role categories | `module/helpers/roles.mjs` (`ROLE_CATEGORIES`) |
| Lifepath tables | `module/data/lifepath-catalogue.mjs` |
| Conditions / status effects | `module/cyberpunk-blue.mjs` (`CONFIG.statusEffects`) |

If a question can't be answered from one of these files, **ask the user** rather than reach for Red defaults.

---

## Stats

Blue has **6** stats:

| Short | Long | Source |
|-------|------|--------|
| BODY | Body | `config.mjs` STATS.body |
| RFLX | Reflexes | `config.mjs` STATS.rflx |
| INT | Intelligence | `config.mjs` STATS.int |
| TECH | Technological Ability | `config.mjs` STATS.tech |
| COOL | Cool | `config.mjs` STATS.cool |
| MOVE | Move | `config.mjs` STATS.move |

**Not in Blue** (Red-only — never write these as if they were Blue stats):

- **REF** — Blue uses RFLX. Don't write "REF or REFLEX" in Blue contexts.
- **DEX** — no Blue equivalent.
- **WILL / Willpower** — no Blue equivalent.
- **EMP / Empathy** — no Blue equivalent. (The string `EMP` does appear in Blue content, but always meaning *electromagnetic pulse* — weapons, drugs, cyberware features.)
- **HUM / Humanity** — Blue does not track Humanity. Psyche fills a *related but distinct* role; do not equate them.
- **LUCK** is a *resource* in Blue, not a stat.
- **MOVE** *is* a Blue stat, but its mechanics differ significantly from Red — don't import Red MOVE behaviour assumptions.

---

## Resources

Per `base-actor.mjs` `resources` schema:

- HP
- armor (SP)
- psyche (with `maxBonus` field)
- luck
- seriousWoundThreshold
- deathSave

**Not in Blue**: Humanity, Reputation (as a tracked resource — may exist as flavor but not a schema field).

---

## Roles (13 total) and Categories (5 total)

Categories are **buckets**, not Roles. Don't list "Leader" or "Specialist" as if they were Roles a character can take.

| Role | Category |
|------|----------|
| Bandit | Networker |
| Corpo | Leader |
| Fixer | Networker |
| Guide | Sundry |
| Law | Leader |
| Media | Networker |
| Medtech | Specialist |
| Netrunner | Sundry |
| Ninja | Protean |
| Operative | Specialist |
| Rocker | Networker |
| Solo | Protean |
| Techie | Specialist |

**Categories:** Leader, Networker, Protean, Specialist, Sundry.

**Not Blue Roles** (Red-only names; common mistakes):

- **Exec** — Blue's equivalent is **Corpo**.
- **Lawman** — Blue's equivalent is **Law**. (The word "Lawman" appears in some flavor/lifepath text inherited from Red sources — that's intentional and stays. Don't *add new* uses of "Lawman" as a role name.)
- **Nomad** — Not a Role in Blue. (A `Nomad.svg` exists in `assets/icons/` but isn't wired up; treat as legacy art.)
- **Networker** is a **category**, not a Role. It has *nothing to do with* Netrunners.

---

## Other notable terminology differences

- **Skills** in Blue have a `components` field — sub-skill breakdowns. Don't import Red's flat skill list; consult `config.mjs` `SKILLS`.
- **Critical Injuries** exist in Blue, but the tables (`packs/critical-injury-tables`) are Blue-authored — don't reach for Red's tables.
- **Cyberware** categories: neuralware, cyberoptics, cyberaudio, cyberarms, cyberlegs, internal, external, fashionware, borgware. See `cyberware-catalogue.mjs` field docs.
- **Cost ladder**: Cheap, Everyday, Costly, Premium, Expensive, Very Expensive, Luxury, Super Luxury (the COST_LADDER in catalogue files). Same tier names as Red but **prices may differ** — never quote a price from memory; consult the catalogue.

---

## Guard-rail checklist when writing new content

Before publishing any list, table, or prose that involves rules concepts:

1. **Stats**: only the 6 in the table above. No REF/DEX/WILL/EMP/HUM.
2. **Resources**: only the schema fields above. No Humanity.
3. **Roles**: only the 13 in the table above. No Exec/Lawman/Nomad. Categories ≠ Roles.
4. **Skills / cyberware / items**: don't generate from training; pull names from the catalogue files.
5. **When in doubt, ask the user** before guessing.
