# Icon Placement Reference — Cyberpunk Blue

Every location in the system that needs a custom SVG icon, with enough selector and template detail to wire them in without re-reading the codebase. Intended to be used alongside the chamfered design system (see `_design_handoff_temp/`).

---

## Asset Conventions

- **Item-tab / sheet icons** live at `assets/icons/bk_*.svg` (PascalCase, `bk_` prefix). Other icons in `assets/icons/` (e.g. role icons like `Solo.svg`, `Netrunner.svg`) follow plain PascalCase.
- **Manufacturer logos** live at `assets/logo/<Brand-Name>.svg`. Filename is the brand name, hyphenated, matched against `system.manufacturer` strings via `branding.mjs` (case-insensitive, whitespace → hyphens).
- **Color**: the canonical (`bk_`) SVGs in `assets/logo/` and `assets/icons/` are authored **black on transparent** (`fill:#000`, `fill:none` for groups). This is the default — see the wiring patterns below for how each kind of icon ends up the right color in-app via CSS at runtime.
- **Color prefixes**: an icon's filename prefix declares the colour baked into the file. Prefer the `bk_` version recoloured at runtime via CSS (Pattern A/B below); only ship a separate pre-coloured file when runtime recolouring won't work for the use case.

  | Prefix | Meaning |
  | --- | --- |
  | `bk_` | Black on transparent (the canonical/default version). |
  | `wt_` | White on transparent. |
  | `acc_` | System accent colour (`--cpb-accent` in the CSS) on transparent. |
  | `col_` | Some other fixed colour scheme, e.g. a logo's official brand colours. |

  Same base name across variants (e.g. `bk_d10.svg`, `wt_d10.svg`, `acc_d10.svg`). When a non-`bk_` file is genuinely needed, create it and name it with the matching prefix.

---

## Wiring Patterns

There are **two** patterns now. Pick the one that matches what you're placing:

### Pattern A — Icons that should match the text color (`<span class="cpb-icon">`)

For sheet tab icons, section header icons, stat-card icons, etc. — anywhere the icon needs to follow `currentColor` (text color, hover, active, accent, etc.):

```hbs
<span class="cpb-icon" style="--cpb-icon: url('/systems/cyberpunk-blue/assets/icons/bk_Example.svg')"></span>
```

For the larger sheet-tab variant:

```hbs
<span class="cpb-tab-icon" style="--cpb-icon: url('/systems/cyberpunk-blue/assets/icons/bk_Example.svg')"></span>
```

CSS (already defined in `css/cyberpunk-blue.css`):

```css
.cyberpunk-blue .cpb-icon,
.cyberpunk-blue .cpb-tab-icon {
  background-color: currentColor;
  -webkit-mask: var(--cpb-icon) center / contain no-repeat;
          mask: var(--cpb-icon) center / contain no-repeat;
  /* …size + alignment differ between .cpb-icon and .cpb-tab-icon… */
}
```

Because the icon is a CSS mask over `background-color: currentColor`, it inherits the surrounding text color automatically — no per-state filter chain needed.

> **The `url()` must be root-absolute (leading slash): `url('/systems/cyberpunk-blue/…')`.** The `--cpb-icon` value is substituted into the `mask` rule *inside `cyberpunk-blue.css`*, so a relative path resolves against the stylesheet's `/css/` directory (`…/css/systems/…`) and 404s, leaving the icon invisible. The leading slash anchors it to the server root instead.

### Pattern B — Logos / pictorial images that should display white (`<img class="manufacturer-logo">`)

For manufacturer logos that need to render as the original white silhouette on dark sheets:

```hbs
<img class="manufacturer-logo" src="{{manufacturerLogo}}" alt="{{system.manufacturer}}" />
```

`.manufacturer-logo` carries `filter: invert(1)`, which flips the black source SVG to white at display time. Branding resolution is handled by `module/helpers/branding.mjs` (`getBrandLogoPath` / `normalizeBrandName`); the helper populates `manufacturerLogo` on items/contexts.

> **Note on the old `::before` pattern.** Earlier docs described wiring icons via CSS `::before { background: url(...) }` with hand-tuned `filter:` invert/hue-rotate chains. **That approach is retired.** All existing `::before` icon usage has been migrated to Pattern A. Do not add new `::before` icons for art — keep `::before` for the chamfer-frame technique (`.cpb-frame::before`) and similar structural pseudo-elements only.

---

## Already-wired Icons

These are complete; listed for reference.

### Character Sheet Tabs
`templates/actor/actor-sheet.hbs` lines ~43–50 — each tab `<a>` contains a `<span class="cpb-tab-icon">` whose `--cpb-icon` points at the matching SVG.

| Tab | `data-tab` value | SVG file |
|-----|-----------------|----------|
| Overview | `overview` | `bk_Overview.svg` |
| Skills | `skills` | `bk_Skills.svg` |
| Cyberware | `cyberware` | `bk_Cyberware.svg` |
| Inventory | `inventory` | `bk_Inventory.svg` |
| Netrunning | `netrunning` | `bk_Netrunning.svg` |
| Notes | `notes` | `bk_Notes.svg` |

### Stat-block icons on Overview tab
Inline `<img class="stat-icon-sm" src="…">` in `templates/actor/actor-sheet.hbs`:

| Icon | SVG file |
|------|----------|
| HP | `bk_HP.svg` |
| Serious Wound Threshold | `bk_SWT.svg` |
| Death Save | `bk_Death_Save.svg` |
| MOVE | `bk_MOVE.svg` |
| PSYCHE | `bk_PSYCHE.svg` |
| LUCK | `bk_LUCK.svg` |

> These are still raw `<img>` tags (no `currentColor` inheritance). If a future change wants them to follow text color (e.g. for a luck-spent state), migrate them to Pattern A.

### Manufacturer Logos
All ~100 brand SVGs in `assets/logo/` are wired via `<img class="manufacturer-logo">` in:

- `templates/actor/actor-sheet.hbs` (embedded item rows)
- `templates/item/item-sheet.hbs` (item header + child-mod rows)

### Item Sheet Tabs
Pattern A `<span class="cpb-tab-icon">` inside each `<a class="item">`, across all tab navs in `templates/item/item-sheet.hbs` (drug, cyberware, generic weapon/gear/role) and the `templates/item/parts/item-program-executable.hbs` partial. All tab labels below are now wired.

| Tab | `data-tab` value | SVG file |
|-----|-----------------|----------|
| Description | `description` | `bk_Overview.svg` |
| Details | `details` | `bk_Details.svg` |
| Advanced | `advanced` | `bk_Advanced.svg` |
| Modifications | `mods` | `bk_Mod.svg` |
| Effects | `effects` | `bk_Effects.svg` |
| Lifepath | `lifepath` | `bk_Lifepath.svg` |
| Abilities | `abilities` | `bk_Abilities.svg` |
| Notes | `notes` | `bk_Notes.svg` |

### Mook Sheet Tabs
`templates/actor/mook-sheet.hbs` — all tabs wired (Pattern A).

| Tab | `data-tab` value | SVG file |
|-----|-----------------|----------|
| Basics | `basics` | `bk_Overview.svg` |
| Items | `items` | `bk_Inventory.svg` |
| Notes | `notes` | `bk_Notes.svg` |

### Vehicle Sheet Tabs
`templates/actor/vehicle-sheet.hbs` — all tabs wired (Pattern A).

| Tab | `data-tab` value | SVG file |
|-----|-----------------|----------|
| General | `general` | `bk_Vehicle.svg` |
| Stats | `stats` | `bk_VehicleStats.svg` |
| Notes | `notes` | `bk_Notes.svg` |

### Six-Stat Block (header) — Overview
`templates/actor/actor-sheet.hbs` header `.header-stat` rows use `<img class="stat-icon" src="{{stat.iconPath}}">`; `iconPath` is computed in `module/sheets/actor-sheet.mjs` as `bk_${SLUG}.svg` (MOVE hard-coded to `bk_MOVE.svg`).

| Stat | SVG file |
|------|----------|
| BODY | `bk_BODY.svg` |
| RFLX | `bk_RFLX.svg` |
| INT | `bk_INT.svg` |
| TECH | `bk_TECH.svg` |
| COOL | `bk_COOL.svg` |
| MOVE | `bk_MOVE.svg` |

### Resource / Stat Cards — Overview
`templates/actor/actor-sheet.hbs` Overview `.stat-card` blocks use raw `<img class="stat-icon-sm">` (same as the "Stat-block icons" table above). SP / armor card has no icon yet (see Needs Icons §6).

| Resource | SVG file |
|----------|----------|
| HP | `bk_HP.svg` |
| Serious Wound Threshold | `bk_SWT.svg` |
| Death Save | `bk_Death_Save.svg` |
| MOVE | `bk_MOVE.svg` |
| PSYCHE | `bk_PSYCHE.svg` |
| Luck | `bk_LUCK.svg` |

### Mook Skills Header
`templates/actor/mook-sheet.hbs` Skills panel — Pattern A `<span class="cpb-icon">` inside `<h2>Skills</h2>` (the panel is a generic `.sheet-panel`, not `.mook-skills-panel`).

| Element | SVG file |
|---------|----------|
| Mook skills header | `bk_Skills.svg` |

---

## Needs Icons

Icons in the catalogue below that already exist as files in `assets/icons/` but aren't referenced anywhere yet:
**Bandit, Corpo, Document, Fixer, Guide, Law, Media, Medtech, Netrunner, Ninja, Nomad, Operative, Rocker, Solo.** Most are role icons (see §10). Wire them with Pattern A when the receiving template lands.

### 1. Item Sheet Tabs

> **Done** — all tabs (description/details/advanced/mods/effects/lifepath/abilities/notes) are wired. See Already-wired Icons → Item Sheet Tabs.

### 2. Mook Sheet Tabs

> **Done** — basics/items/notes all wired. See Already-wired Icons → Mook Sheet Tabs.

### 3. Vehicle Sheet Tabs **(new — Vehicles subsystem)**

> **Done** — general/stats/notes all wired. See Already-wired Icons → Vehicle Sheet Tabs.

### 4. Vehicle-specific section/row icons **(new)**

For the in-vehicle UI (`templates/actor/vehicle-sheet.hbs`, `templates/apps/vehicle-hud.hbs`, `templates/dialogs/vehicle-maneuver-picker.hbs`). All Pattern A.

| Element | Suggested CSS hook / selector | Suggested icon | SVG file |
|---------|-------------------------------|---------------|------|
| SDP (structural damage points) | `.cyberpunk-blue .vehicle-sdp-header` | Bent panel / shield | |
| Seats panel header | `.cyberpunk-blue .vehicle-seats-header` | Seat / person | |
| Subsystems panel header | `.cyberpunk-blue .vehicle-subsystems-header` | Gear / module | |
| Vehicle mods panel header | `.cyberpunk-blue .vehicle-mods-header` | Wrench + bolt | `bk_Mod.svg` |
| Speed / movement readout | `.cyberpunk-blue .vehicle-speed-readout` | Chevron / speedometer | |
| Maneuver picker entry | `.cyberpunk-blue .vehicle-maneuver` | Steering wheel / arrow-curve | |
| Vehicle HUD condition strip | `.cyberpunk-blue .vehicle-hud-condition` | Per-condition (re-use status icons §17) | |

> Verify class names against the templates before designing — these are the natural selectors, but the vehicles subsystem is still settling and some classes may not exist yet.

### 5. Stat Cards (Overview tab)

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab stat block.
**Pattern:** A. The stat card itself is a `.cpb-frame`, so place the icon inside an inner element (e.g. label):

```hbs
<span class="stat-label">
  <span class="cpb-icon" style="--cpb-icon: url('…/bk_INT.svg')"></span>
  INT
</span>
```

Blue's six stats (per `module/helpers/config.mjs` `STATS` + `module/data/base-actor.mjs`):

> **Done** — all six stats (BODY/RFLX/INT/TECH/COOL/MOVE) are wired via `stat.iconPath` in the header stat block. See Already-wired Icons → Six-Stat Block. (The inner-`.stat-card`-label placement shown above was the original suggestion; the header `.stat-icon` placement is what shipped.)

> Blue does **not** have REF, DEX, WILL, EMP, or HUM. Don't add those — they're Cyberpunk Red stats. See `docs/blue-vs-red.md`.

### 6. Resource Cards

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab.
**Pattern:** A inside `.resource-name`.

Blue resources (per `base-actor.mjs` `resources` schema):

> All cards except SP/armor are **done** — see Already-wired Icons → Resource / Stat Cards.

| Resource | Key / class | Suggested icon | SVG file |
|----------|-------------|---------------|-----|
| SP (armor) | `armor` / `.armor-card` | Shield / armor plate | |

> Blue does **not** have a Humanity resource. Psyche serves a related but distinct role; don't conflate them. See `docs/blue-vs-red.md`.

### 7. Health Panel

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab, `.health-panel`. Pattern A.

| Element | Insertion point | Suggested icon |
|---------|----------------|---------------|
| Health section header | `.cyberpunk-blue .health-block h3` | Heart / pulse |
| Serious Wound Threshold label | `.cyberpunk-blue .health-threshold-label` | Warning triangle |
| Death Save label | `.cyberpunk-blue .health-death-save-label` | Skull |
| Active Effects section header | `.cyberpunk-blue .health-effects h3` | Status dot / pulse wave |
| Critical Injury row modifier | `.cyberpunk-blue .health-effect.is-critical-injury` | Broken bone / cross |

> Individual AE rows already use the item's own `img`; no system icon needed there.

### 8. Skill Section

**Template:** `templates/actor/actor-sheet.hbs` — Skills tab. Icons on category headers, not individual rows. Pattern A.

**Structure is now in place.** Skills are grouped into 8 categories defined in `module/helpers/config.mjs` (`SKILL_CATEGORIES`, the single source of truth — slug → `{ label, skills[] }`, key order = display order). The Skills tab renders one `.skill-category[data-category="<slug>"]` block per category, each headed by a `.cpb-divider--header`. Any skill not listed in a category falls into an `Other` (`uncategorized`) group rather than disappearing.

Wire each category icon as Pattern A `<span class="cpb-icon">` inside that group's `.cpb-divider--header > span` (or target `.skill-category[data-category="<slug>"] .cpb-divider--header`):

| Group (`data-category`) | Label | Skills | Suggested icon | SVG file |
|-------------------------|-------|--------|----------------|----------|
| `ranged` | Ranged Combat | archery, autofire, handgun, hvyWeapons, shoulderArms | Crosshair | |
| `melee` | Close Combat | martialArts, meleeWeapons, evasion | Fist / blade | |
| `physical` | Athletics & Agility | athletics, endurance, contortionist, drive | Running figure | |
| `covert` | Stealth & Larceny | stealth, conceal, pickLock, sleightOfHand | Mask / lockpick | |
| `tech` | Tech & Engineering | electronics, mechanics, demolition, netrunning, medicine | Wrench / circuit | |
| `knowledge` | Investigation & Lore | perception, deduction, criminology, education, tactics, survival, animals | Magnifier / book | |
| `social` | Social & Influence | acting, influence, humanPerc, streetwise, style, performance, composition | Speech bubble | |
| `trade` | Trade & Society | business, trading, government, gambling | Coin / handshake | |

> Category membership is data-driven — to re-bucket a skill, edit only its slug in `SKILL_CATEGORIES`; the template and grouping logic need no changes. Each category currently holds 3–7 skills.

### 9. Cyberware Section

**Template:** `templates/actor/actor-sheet.hbs` — Cyberware tab. Pattern A on group headers.

| Body location | `data-location` | Suggested icon |
|---------------|----------------|---------------|
| Head | `head` | Head silhouette |
| Eyes | `eyes` | Eye |
| Ears | `ears` | Ear |
| Mouth | `mouth` | Lips / speaker |
| Torso / Internal | `torso` | Torso / heart |
| Shoulders / Arms | `arms` | Arm / fist |
| Hands | `hands` | Hand / fingers |
| Legs | `legs` | Leg / boot |
| Unconnected | `unconnected` | Link-slash |

### 10. Inventory Groups

**Template:** `templates/actor/actor-sheet.hbs` — Inventory tab. Pattern A on group headers.

| Category | `data-type` | Suggested icon | SVG file |
|----------|-------------|---------------|----|
| Weapons | `weapon` | Pistol / sword | |
| Armor | `armor` | Shield | |
| Clothing | `clothing` | T-shirt / jacket | |
| Gear | `gear` | Bag / crate | |
| Electronics | `electronics` | Circuit / phone | |
| Cyberware | `cyberware` | Implant chip | |
| Drugs | `drug` | Syringe / pill | |
| Ammo | `ammo` | Bullet / cartridge | |

### 11. Role & Ability Tables

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab. Pattern A.

| Element | Insertion point | Icon | SVG file |
|---------|----------------|------|-----|
| Roles section header | `.traits-role-panel .panel-header h2` | Crown / archetype | |
| Abilities section header | `.traits-ability-panel .panel-header h2` | Star burst / talent | |
| Individual role row | `.embedded-row[data-item-type="role"]` | Per-role (table below) | |
| Individual ability row | `.embedded-row[data-item-type="ability"]` | Specialty-specific | |

**Per-role icons** — Blue has 13 Roles grouped into 5 categories. Category names (Leader, Networker, Protean, Specialist, Sundry) are **not** Roles themselves — don't add icons under those names. Authoritative source: `docs/Roles-source.md`.

| Role | Category | File present? | Suggested icon |
|------|----------|--------------|----------------|
| Bandit | Networker | ✅ `Bandit.svg` | Skull / fist |
| Corpo | Leader | ✅ `Corpo.svg` | Briefcase / suit |
| Fixer | Networker | ✅ `Fixer.svg` | Handshake / coin |
| Guide | Sundry | ✅ `Guide.svg` | Compass / map |
| Law | Leader | ✅ `Law.svg` | Badge / gavel |
| Media | Networker | ✅ `Media.svg` | Camera / newspaper |
| Medtech | Specialist | ✅ `Medtech.svg` | Medical cross / syringe |
| Netrunner | Sundry | ✅ `Netrunner.svg` | Circuit / terminal |
| Ninja | Protean | ✅ `Ninja.svg` | Shadow / blade |
| Operative | Specialist | ✅ `Operative.svg` | Wrench / badge |
| Rocker | Networker | ✅ `Rocker.svg` | Guitar / mic |
| Solo | Protean | ✅ `Solo.svg` | Crosshair / blade |
| Techie | Specialist | — | Wrench / gear |

> **Not Blue Roles**: Exec (Red name for Corpo), Lawman (Red name for Law), Nomad (Red-only), Leader/Networker/Protean/Specialist/Sundry (these are categories). Don't seed art under those names.

### 12. Role Overview Feature (per-role mechanics panel)

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab, role-overview-feature block. Pattern A.

| Element | Insertion point | Note | SVG file |
|---------|----------------|------|--------|
| Role category heading | `.role-overview-feature .roleCategory` | One per active role; reuse §11 role icons | |
| Role mechanic row labels | `.role-mechanic-row .role-mechanic-label` | Action-type icon | |
| Specialty budget counter | `.specialty-budget .panel-header span` | Points/budget chip icon | |
| Protean tactic name | `.protean-tactic-name` | Strategy/morph icon | |

### 13. Netrunning Tab

**Template:** `templates/actor/actor-sheet.hbs` — Netrunning tab. Pattern A. Many buttons already use FontAwesome `<i class="fas fa-*">` — those don't need migration.

| Element | Insertion point | Icon | SVG file |
|---------|----------------|------|---------|
| Components section header | `.netrunner-components-row .panel-header h2` | Microchip / NET globe | |
| Individual component header | `.netrunner-comp-header` | Component-specific | |
| NET connection box | `.net-connection-box .panel-header span` | Plug / signal | |
| Computers section header | `.sheet-panel h2.computers-header` | Monitor / terminal | |
| Executables on Disk header | `.netrunner-exe-table thead th:first-child` | Disk / storage | |
| Executables on Shards header | `.netrunner-shards-table thead th:first-child` | Shard / card | |

### 14. Character Creation Wizard

**Template:** `templates/character-creation/wizard.hbs`. Pattern A.

| Element | Insertion point | Icon | SVG file |
|---------|----------------|------|-----|
| Progress step dot (active) | `.cc-step-dot.active` | Filled circle / number | |
| Progress step dot (completed) | `.cc-step-dot.completed` | Checkmark | |
| Points counter (on-budget) | `.cc-points-counter` | Gauge / chip | |
| Points counter (all spent) | `.cc-points-counter.all-spent` | Check / full gauge | |
| Points counter (over budget) | `.cc-points-counter.over-budget` | Warning triangle | |

### 15. Panel Headers (general — across all sheets)

`.panel-header` elements wrapping `h2`/`h3` that lack icons. Pattern A.

| Element | Insertion point | Icon | SVG file |
|---------|----------------|------|-----|
| Weapon block header | `.weapon-block > .panel-header h3` | Weapon silhouette | |
| Weapon mods section header | `.mod-list .panel-header h3` | Wrench / bolt | |
| Range band table header | `.weapon-range-table-wrap .panel-header` | Range / radar | |
| Embedded item section headers | `.component-panel .panel-header h2` | Stacked layers / puzzle | |
| Mook components header | `.mook-components-panel .panel-header h2` | Puzzle / gear | |

> Mook skills header is **done** — see Already-wired Icons → Mook Skills Header.

### 16. Chat Messages

**Template:** `templates/chat/`. Pattern A on message headers.

| Message type | Wrapper class to verify in template | Icon | SVG file |
|-------------|-------------------------------------|------|--------|
| Skill roll | `.chat-roll-skill .message-header` | Brain / d10 | `bk_d10.svg` |
| Attack roll | `.chat-roll-attack .message-header` | Crosshair | |
| Damage roll | `.chat-roll-damage .message-header` | Lightning / blood drop | |
| Initiative roll | `.chat-roll-initiative .message-header` | Speed / clock | |
| Death Save roll | `.chat-roll-death .message-header` | Skull | `bk_Death_Save.svg` |
| Luck spend | `.chat-luck-spend .message-header` | Dice | `bk_LUCK.svg` |
| Role ability use | `.chat-role-ability .message-header` | Star / archetype | Reuse §11 Role icon |

> Verify wrapper class names in `templates/chat/` before implementing — these are best-guess.

### 17. Foundry Status Effects **(new)**

The system registers 17 conditions via `CONFIG.statusEffects` in `module/cyberpunk-blue.mjs` (search for `CONFIG.statusEffects =`). Each currently uses a stock Foundry icon (`icons/svg/skull.svg` etc.); replacing them with custom black-on-transparent SVGs in `assets/icons/` and pointing the `icon:` field at the new path is the recommended swap.

**Note on color**: status effect icons appear on token overlays and the condition tray, not inside the sheet DOM, so they bypass Pattern A's `currentColor` mask. They render as the raw SVG over the token. The "black on transparent" authoring rule still applies — Foundry's overlay layer brightens them for visibility — but if a particular condition reads poorly on a token, that one is the exception and can be authored at a lighter fill.

| `id` (in CONFIG) | Localization key | Current stock icon | Suggested custom icon concept | SVG file |
|-----------------|------------------|---------------------|------------------------------|--------|
| `dying` | `CYBER_BLUE.Condition.Dying` | `icons/svg/skull.svg` | Heartbeat flatline | |
| `dead` | `CYBER_BLUE.Condition.Dead` | `icons/svg/tombstone.svg` | Skull | |
| `unconscious` | `CYBER_BLUE.Condition.Unconscious` | `icons/svg/unconscious.svg` | Closed eye / Zzz | |
| `prone` | `CYBER_BLUE.Condition.Prone` | `icons/svg/falling.svg` | Figure on ground | |
| `asleep` | `CYBER_BLUE.Condition.Asleep` | `icons/svg/sleep.svg` | Zzz | |
| `stunned` | `CYBER_BLUE.Condition.Stunned` | `icons/svg/daze.svg` | Spiral / dazed-stars | |
| `restrained` | `CYBER_BLUE.Condition.Restrained` | `icons/svg/net.svg` | Net / rope | |
| `grappled` | `CYBER_BLUE.Condition.Grappled` | `icons/svg/grab.svg` | Grasping hand | |
| `burning-embers` | `CYBER_BLUE.Condition.BurningEmbers` | `icons/svg/fire.svg` | Single ember / small flame | |
| `burning-fire` | `CYBER_BLUE.Condition.BurningFire` | `icons/svg/fire.svg` | Flame | |
| `burning-deadly` | `CYBER_BLUE.Condition.BurningDeadly` | `icons/svg/fire.svg` | Large flame / inferno | |
| `fatigued` | `CYBER_BLUE.Condition.Fatigued` | `icons/svg/downgrade.svg` | Downward arrow / drooping figure | |
| `severe-fatigue` | `CYBER_BLUE.Condition.SevereFatigue` | `icons/svg/downgrade.svg` | Double down-arrow | |
| `extreme-fatigue` | `CYBER_BLUE.Condition.ExtremeFatigue` | `icons/svg/downgrade.svg` | Triple down-arrow / collapse | |
| `deaf` | `CYBER_BLUE.Condition.Deaf` | `icons/svg/deaf.svg` | Ear with slash | |
| `blind` | `CYBER_BLUE.Condition.Blind` | `icons/svg/blind.svg` | Eye with slash | |

Suggested filenames: `cond_Dying.svg`, `cond_Dead.svg`, etc., in `assets/icons/`. Update the `icon:` path in `CONFIG.statusEffects` once added.

### 18. Combat Tracker

Foundry-core widget; overrides may live in `templates/combat/`. Pattern A where the system controls the DOM.

| Element | Selector | Icon | SVG file |
|---------|---------|------|-------|
| Combatant row (PC) | `#combat-tracker .combatant[data-actor-type="character"]` | Person silhouette | |
| Combatant row (NPC/mook) | `#combat-tracker .combatant[data-actor-type="npc"]` | Skull / target | |
| Sprint button | `.sprint-btn` | Running figure | |
| Initiative input | `.initiative` | Clock / chevron | |

### 19. Martial Arts Component Icons **(new)**

The five Martial Arts Components (`module/helpers/config.mjs` → `martialArts.components`). These need custom `bk_` SVGs; until they exist, anything that wants a per-component icon (e.g. a future martial-arts macro, parallel to the weapon/skill macro buttons) should fall back to Foundry's generic placeholder `icons/svg/mystery-man.svg`.

| Component slug | Label | Suggested icon concept | SVG file |
|----------------|-------|------------------------|----------|
| `aikido` | Aikido | Throw / redirect motion | |
| `brawling` | Brawling | Fist | |
| `judo` | Judo | Grapple / throw | |
| `karate` | Karate | Open-hand strike | |
| `taekwondo` | Taekwondo | High kick | |

> Placeholder for now: `icons/svg/mystery-man.svg`. Swap each entry to `assets/icons/bk_<Name>.svg` once authored.

### 20. Compendium Macros **(new)**

The `cyberpunk-blue.macros` compendium is auto-seeded at GM login by `ensureMacroCatalogue()` (`module/cyberpunk-blue.mjs`); the entries live in `MACRO_CATALOGUE` (`module/helpers/critical-injury-macros.mjs`, each with a `name` / `img` / `_folder`). Every macro currently uses a **stock Foundry `icons/svg/*` image**. Macro images render as raw pictures in the Macro Directory / hotbar (NOT Pattern A masks), so custom art can be full-colour. Suggested filenames `assets/icons/mac_<Name>.svg`; point the catalogue entry's `img:` at the new path once authored.

| Macro | Folder | Current stock icon | Suggested icon concept | SVG file |
|-------|--------|--------------------|------------------------|----------|
| Request Skill Check | GM Tools | `icons/svg/d10-grey.svg` | d10 + skill/brain | |
| Apply Damage | GM Tools | `icons/svg/sword.svg` | Impact / blade burst | |
| Heal / Restore HP | GM Tools | `icons/svg/heal.svg` | Heart + plus | |
| Adjust Improvement Points | GM Tools | `icons/svg/upgrade.svg` | Up-arrow chevrons / IP chip | |
| Advance Death State | GM Tools | `icons/svg/tombstone.svg` | Tombstone + clock/hourglass | |
| Clear Role-Granted Items | GM Tools | `icons/svg/item-bag.svg` | Bag with slash / broom | |
| Quick Fix | Medical | `icons/svg/heal.svg` | Bandage / quick cross | |
| Treatment | Medical | `icons/svg/aura.svg` | Caduceus / sustained cross | |
| Stabilize | Medical | `icons/svg/anchor.svg` | Heartbeat steadying / hand on chest | |
| Natural Healing | Medical | `icons/svg/sun.svg` | Bed / rest moon-sun | |
| Apply Table Effect | Combat Effects | `icons/svg/dice-target.svg` | Die hitting target | |
| Remove Table Effects | Combat Effects | `icons/svg/cancel.svg` | Eraser / circle-slash | |

### 21. Wound & Death-State Effects **(new)**

System-managed ActiveEffects that mark the HP-down → death pipeline (see the "HP → wound → stabilization → death pipeline" section in `project_design_spec_status.md`). These are NOT `CONFIG.statusEffects` (except as noted) — they're created/synced from `module/documents/actor.mjs` and shown in the Overview health-effects list as raw `<img src="{{effect.icon}}">`. Each currently uses a stock or legacy icon. Suggested filenames `assets/icons/cond_<Name>.svg` (treat as condition-class art).

| Effect | Flag (`cyberpunk-blue.*`) | Current icon | Shown where | Suggested icon concept | SVG file |
|--------|---------------------------|--------------|-------------|------------------------|----------|
| Seriously Wounded | `autoSeriousWound` | `assets/pummeled.svg` (legacy custom) | Health-effects list | Cracked / bruised torso | |
| Mortally Wounded | `autoMortallyWounded` | `icons/svg/skull.svg` (stock) | Health-effects list | Flatline heartbeat / fading skull | |
| Needs Stabilization | `needsStabilization` | `icons/svg/blood.svg` (stock) | Health-effects list | Blood drop + cross / bleeding wound | |
| Dead — Death State N/10 | `dead` (carries `deathState`) | `icons/svg/tombstone.svg` (stock) | Token overlay (`statuses:['dead']`) + health-effects list | Tombstone (shares the `dead` condition art, §17) | |

> The **Dead** effect overlaps the `dead` condition in §17 — author once and reuse. **Seriously Wounded** already ships custom art (`assets/pummeled.svg`); the other three are still on stock icons.

---

## Implementation Notes

1. **SVG authoring**: black on transparent (`fill:#000`). The bulk-convert ran on 2026-05-28 normalized the full library; new SVGs should follow this rule. `fill:none` is fine for groups/parents.

2. **Pattern A** (`.cpb-icon` / `.cpb-tab-icon`) is the default. Use it for anything that should track text color, including hover, active, and accent states. No per-state `filter:` rules needed.

3. **Pattern B** (`<img class="manufacturer-logo">`) is for logos that should always render white. The `filter: invert(1)` on the class handles the flip. Don't use this pattern for icons inside text runs — the inversion locks the color to white regardless of text color.

4. **File naming**:
   - Sheet/section icons: `bk_PascalCase.svg`
   - Role icons: plain `PascalCase.svg`
   - Status effect icons (new): `cond_PascalCase.svg` — also used for the wound/death-state effect AEs in §21
   - Compendium macro icons (new): `mac_PascalCase.svg` — raw full-colour images, not Pattern A masks (§20)
   - Manufacturer logos: `Brand-Name.svg` (matched by `branding.mjs`)

5. **`.cpb-frame` interaction**: elements styled with `.cpb-frame` use `::before` for the chamfer inner fill. Don't add Pattern A icons directly on a `.cpb-frame` element — put them on an inner element (label, heading) instead.

6. **FontAwesome icons** (`<i class="fas fa-*">`) embedded inline in templates are still fine and don't need migration. They're already color-correct via FontAwesome's own font-color inheritance.

7. **CSS is the sole source**: `css/cyberpunk-blue.css` is hand-edited and authoritative. The SCSS build step has been removed (no `npm run build`/`watch`), so all style edits — icon-related or otherwise — must land directly in the CSS. The `src/scss/` files are stale and no longer compiled; do not recompile them, as that would overwrite the hand-maintained CSS.