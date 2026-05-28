# Icon Placement Reference — Cyberpunk Blue

Every location in the system that needs a custom SVG icon, with enough selector and template detail to wire them in without re-reading the codebase. Intended to be used alongside the chamfered design system (see `_design_handoff_temp/`).

---

## Asset Conventions

- **Item-tab / sheet icons** live at `assets/icons/bk_*.svg` (PascalCase, `bk_` prefix). Other icons in `assets/icons/` (e.g. role icons like `Solo.svg`, `Netrunner.svg`) follow plain PascalCase.
- **Manufacturer logos** live at `assets/logo/<Brand-Name>.svg`. Filename is the brand name, hyphenated, matched against `system.manufacturer` strings via `branding.mjs` (case-insensitive, whitespace → hyphens).
- **Color**: every SVG in `assets/logo/` and `assets/icons/` is authored **black on transparent** (`fill:#000`, `fill:none` for groups). This is a hard rule — see the wiring patterns below for how each kind of icon ends up the right color in-app.

---

## Wiring Patterns

There are **two** patterns now. Pick the one that matches what you're placing:

### Pattern A — Icons that should match the text color (`<span class="cpb-icon">`)

For sheet tab icons, section header icons, stat-card icons, etc. — anywhere the icon needs to follow `currentColor` (text color, hover, active, accent, etc.):

```hbs
<span class="cpb-icon" style="--cpb-icon: url('systems/cyberpunk-blue/assets/icons/bk_Example.svg')"></span>
```

For the larger sheet-tab variant:

```hbs
<span class="cpb-tab-icon" style="--cpb-icon: url('systems/cyberpunk-blue/assets/icons/bk_Example.svg')"></span>
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

---

## Needs Icons

Icons in the catalogue below that already exist as files in `assets/icons/` but aren't referenced anywhere yet:
**Bandit, Corpo, Document, Fixer, Guide, Law, Media, Medtech, Netrunner, Ninja, Nomad, Operative, Rocker, Solo.** Most are role icons (see §10). Wire them with Pattern A when the receiving template lands.

### 1. Item Sheet Tabs

All item sheet tabs currently render text-only.

**Template:** `templates/item/item-sheet.hbs` (multiple `<nav class="sheet-tabs">` blocks — weapon, mod, role, ammo, etc.)
**Pattern:** A — insert `<span class="cpb-tab-icon" style="--cpb-icon: url('…')">…</span>` inside each `<a class="item">`.

| Tab label | `data-tab` value | Suggested icon concept |
|-----------|-----------------|----------------------|
| Description | `description` | Document / scroll |
| Details | `details` | Sliders / settings |
| Notes | `notes` | Notepad / pen |
| Advanced | `advanced` | Cog / wrench |
| Modifications | `mods` | Wrench + bolt |
| Effects | `effects` | Sparkle / waveform |
| Lifepath | `lifepath` | Chain / path arrow |
| Abilities | `abilities` | Star / burst |

### 2. Mook Sheet Tabs

**Template:** `templates/actor/mook-sheet.hbs`
**Pattern:** A.

| Tab label | `data-tab` value | Suggested icon concept |
|-----------|-----------------|----------------------|
| Basics | `basics` | Person / ID card |
| Items | `items` | Bag / crate |
| Notes | `notes` | Notepad / pen |

### 3. Vehicle Sheet Tabs **(new — Vehicles subsystem)**

**Template:** `templates/actor/vehicle-sheet.hbs` lines ~48–51.
**Pattern:** A.

| Tab label | `data-tab` value | Suggested icon concept |
|-----------|-----------------|----------------------|
| General | `general` | Vehicle silhouette / steering wheel |
| Stats | `stats` | Gauge / dashboard |
| Notes | `notes` | Notepad / pen |

### 4. Vehicle-specific section/row icons **(new)**

For the in-vehicle UI (`templates/actor/vehicle-sheet.hbs`, `templates/apps/vehicle-hud.hbs`, `templates/dialogs/vehicle-maneuver-picker.hbs`). All Pattern A.

| Element | Suggested CSS hook / selector | Suggested icon |
|---------|-------------------------------|---------------|
| SDP (structural damage points) | `.cyberpunk-blue .vehicle-sdp-header` | Bent panel / shield |
| Seats panel header | `.cyberpunk-blue .vehicle-seats-header` | Seat / person |
| Subsystems panel header | `.cyberpunk-blue .vehicle-subsystems-header` | Gear / module |
| Vehicle mods panel header | `.cyberpunk-blue .vehicle-mods-header` | Wrench + bolt |
| Speed / movement readout | `.cyberpunk-blue .vehicle-speed-readout` | Chevron / speedometer |
| Maneuver picker entry | `.cyberpunk-blue .vehicle-maneuver` | Steering wheel / arrow-curve |
| Vehicle HUD condition strip | `.cyberpunk-blue .vehicle-hud-condition` | Per-condition (re-use status icons §17) |

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

| Stat | Suggested icon concept |
|------|----------------------|
| INT | Brain / circuit |
| REF | Lightning bolt |
| DEX | Hand / fingers |
| TECH | Wrench / gear |
| COOL | Sunglasses / ice shard |
| WILL | Fist / shield |
| LUCK | Dice / four-leaf |
| MOVE | Running figure / chevron |
| BODY | Torso / flexed arm |
| EMP | Heart / signal waves |

### 6. Resource Cards

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab.
**Pattern:** A inside `.resource-name`.

| Resource | Key / class | Suggested icon |
|----------|-------------|---------------|
| SP (armor) | `.armor-card` | Shield / armor plate |
| MOVE (derived) | `.move-card` | Chevron / sprint |
| Humanity | `humanity` | Heart / yin-yang |
| Luck | `luck` | Dice |
| Extra resources | any `.resource-card` | Generic chip / gauge |

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

| Element | Selector / data attr | Suggested icon |
|---------|---------------------|---------------|
| Skill section header | `.skills-layout > .panel-header h2` | Brain / skill star |
| Athletics group | `[data-category="athletics"]` | Running figure |
| Awareness group | `[data-category="awareness"]` | Eye |
| Body group | `[data-category="body"]` | Torso |
| Control group | `[data-category="control"]` | Steering wheel / hand |
| Education group | `[data-category="education"]` | Book |
| Fighting group | `[data-category="fighting"]` | Crossed swords / fist |
| Performance group | `[data-category="performance"]` | Star / mic |
| Ranged group | `[data-category="ranged"]` | Crosshair |
| Social group | `[data-category="social"]` | Speech bubble |
| Technique group | `[data-category="technique"]` | Wrench |

> If `data-category` isn't on the group element, add it in the template — easier than `:nth-child` selectors.

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

| Category | `data-type` | Suggested icon |
|----------|-------------|---------------|
| Weapons | `weapon` | Pistol / sword |
| Armor | `armor` | Shield |
| Clothing | `clothing` | T-shirt / jacket |
| Gear | `gear` | Bag / crate |
| Electronics | `electronics` | Circuit / phone |
| Cyberware | `cyberware` | Implant chip |
| Drugs | `drug` | Syringe / pill |
| Ammo | `ammo` | Bullet / cartridge |

### 11. Role & Ability Tables

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab. Pattern A.

| Element | Insertion point | Icon |
|---------|----------------|------|
| Roles section header | `.traits-role-panel .panel-header h2` | Crown / archetype |
| Abilities section header | `.traits-ability-panel .panel-header h2` | Star burst / talent |
| Individual role row | `.embedded-row[data-item-type="role"]` | Per-role (table below) |
| Individual ability row | `.embedded-row[data-item-type="ability"]` | Specialty-specific |

**Per-role icons** — most already exist in `assets/icons/`:

| Role | File present? | Suggested icon |
|------|--------------|----------------|
| Bandit | ✅ `Bandit.svg` | Skull / fist |
| Exec (Corpo) | ✅ `Corpo.svg` | Briefcase / suit |
| Fixer | ✅ `Fixer.svg` | Handshake / coin |
| Guide | ✅ `Guide.svg` | Compass / map |
| Lawman (Law) | ✅ `Law.svg` | Badge / gavel |
| Leader | — | Megaphone / crown |
| Media | ✅ `Media.svg` | Camera / newspaper |
| Medtech | ✅ `Medtech.svg` | Medical cross / syringe |
| Netrunner | ✅ `Netrunner.svg` | Circuit / terminal |
| Nomad | ✅ `Nomad.svg` | Wheel / road |
| Protean | — | Shift / morph |
| Rocker | ✅ `Rocker.svg` | Guitar / mic |
| Solo | ✅ `Solo.svg` | Crosshair / blade |
| Specialist (Operative) | ✅ `Operative.svg` | Wrench / badge |
| Techie | — | Wrench / gear |
| (extra) | ✅ `Ninja.svg` | unassigned — TBD |

### 12. Role Overview Feature (per-role mechanics panel)

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab, role-overview-feature block. Pattern A.

| Element | Insertion point | Note |
|---------|----------------|------|
| Role category heading | `.role-overview-feature .roleCategory` | One per active role; reuse §11 role icons |
| Role mechanic row labels | `.role-mechanic-row .role-mechanic-label` | Action-type icon |
| Specialty budget counter | `.specialty-budget .panel-header span` | Points/budget chip icon |
| Protean tactic name | `.protean-tactic-name` | Strategy/morph icon |

### 13. Netrunning Tab

**Template:** `templates/actor/actor-sheet.hbs` — Netrunning tab. Pattern A. Many buttons already use FontAwesome `<i class="fas fa-*">` — those don't need migration.

| Element | Insertion point | Icon |
|---------|----------------|------|
| Components section header | `.netrunner-components-row .panel-header h2` | Microchip / NET globe |
| Individual component header | `.netrunner-comp-header` | Component-specific |
| NET connection box | `.net-connection-box .panel-header span` | Plug / signal |
| Computers section header | `.sheet-panel h2.computers-header` | Monitor / terminal |
| Executables on Disk header | `.netrunner-exe-table thead th:first-child` | Disk / storage |
| Executables on Shards header | `.netrunner-shards-table thead th:first-child` | Shard / card |

### 14. Character Creation Wizard

**Template:** `templates/character-creation/wizard.hbs`. Pattern A.

| Element | Insertion point | Icon |
|---------|----------------|------|
| Progress step dot (active) | `.cc-step-dot.active` | Filled circle / number |
| Progress step dot (completed) | `.cc-step-dot.completed` | Checkmark |
| Points counter (on-budget) | `.cc-points-counter` | Gauge / chip |
| Points counter (all spent) | `.cc-points-counter.all-spent` | Check / full gauge |
| Points counter (over budget) | `.cc-points-counter.over-budget` | Warning triangle |

### 15. Panel Headers (general — across all sheets)

`.panel-header` elements wrapping `h2`/`h3` that lack icons. Pattern A.

| Element | Insertion point | Icon |
|---------|----------------|------|
| Weapon block header | `.weapon-block > .panel-header h3` | Weapon silhouette |
| Weapon mods section header | `.mod-list .panel-header h3` | Wrench / bolt |
| Range band table header | `.weapon-range-table-wrap .panel-header` | Range / radar |
| Embedded item section headers | `.component-panel .panel-header h2` | Stacked layers / puzzle |
| Mook skills header | `.mook-skills-panel .panel-header h2` | Brain / chart |
| Mook components header | `.mook-components-panel .panel-header h2` | Puzzle / gear |

### 16. Chat Messages

**Template:** `templates/chat/`. Pattern A on message headers.

| Message type | Wrapper class to verify in template | Icon |
|-------------|-------------------------------------|------|
| Skill roll | `.chat-roll-skill .message-header` | Brain / d10 |
| Attack roll | `.chat-roll-attack .message-header` | Crosshair |
| Damage roll | `.chat-roll-damage .message-header` | Lightning / blood drop |
| Initiative roll | `.chat-roll-initiative .message-header` | Speed / clock |
| Death Save roll | `.chat-roll-death .message-header` | Skull |
| Luck spend | `.chat-luck-spend .message-header` | Dice |
| Role ability use | `.chat-role-ability .message-header` | Star / archetype |

> Verify wrapper class names in `templates/chat/` before implementing — these are best-guess.

### 17. Foundry Status Effects **(new)**

The system registers 17 conditions via `CONFIG.statusEffects` in `module/cyberpunk-blue.mjs` (search for `CONFIG.statusEffects =`). Each currently uses a stock Foundry icon (`icons/svg/skull.svg` etc.); replacing them with custom black-on-transparent SVGs in `assets/icons/` and pointing the `icon:` field at the new path is the recommended swap.

**Note on color**: status effect icons appear on token overlays and the condition tray, not inside the sheet DOM, so they bypass Pattern A's `currentColor` mask. They render as the raw SVG over the token. The "black on transparent" authoring rule still applies — Foundry's overlay layer brightens them for visibility — but if a particular condition reads poorly on a token, that one is the exception and can be authored at a lighter fill.

| `id` (in CONFIG) | Localization key | Current stock icon | Suggested custom icon concept |
|-----------------|------------------|---------------------|------------------------------|
| `dying` | `CYBER_BLUE.Condition.Dying` | `icons/svg/skull.svg` | Heartbeat flatline |
| `dead` | `CYBER_BLUE.Condition.Dead` | `icons/svg/tombstone.svg` | Skull |
| `unconscious` | `CYBER_BLUE.Condition.Unconscious` | `icons/svg/unconscious.svg` | Closed eye / Zzz |
| `prone` | `CYBER_BLUE.Condition.Prone` | `icons/svg/falling.svg` | Figure on ground |
| `asleep` | `CYBER_BLUE.Condition.Asleep` | `icons/svg/sleep.svg` | Zzz |
| `stunned` | `CYBER_BLUE.Condition.Stunned` | `icons/svg/daze.svg` | Spiral / dazed-stars |
| `restrained` | `CYBER_BLUE.Condition.Restrained` | `icons/svg/net.svg` | Net / rope |
| `grappled` | `CYBER_BLUE.Condition.Grappled` | `icons/svg/grab.svg` | Grasping hand |
| `burning-embers` | `CYBER_BLUE.Condition.BurningEmbers` | `icons/svg/fire.svg` | Single ember / small flame |
| `burning-fire` | `CYBER_BLUE.Condition.BurningFire` | `icons/svg/fire.svg` | Flame |
| `burning-deadly` | `CYBER_BLUE.Condition.BurningDeadly` | `icons/svg/fire.svg` | Large flame / inferno |
| `fatigued` | `CYBER_BLUE.Condition.Fatigued` | `icons/svg/downgrade.svg` | Downward arrow / drooping figure |
| `severe-fatigue` | `CYBER_BLUE.Condition.SevereFatigue` | `icons/svg/downgrade.svg` | Double down-arrow |
| `extreme-fatigue` | `CYBER_BLUE.Condition.ExtremeFatigue` | `icons/svg/downgrade.svg` | Triple down-arrow / collapse |
| `deaf` | `CYBER_BLUE.Condition.Deaf` | `icons/svg/deaf.svg` | Ear with slash |
| `blind` | `CYBER_BLUE.Condition.Blind` | `icons/svg/blind.svg` | Eye with slash |

Suggested filenames: `cond_Dying.svg`, `cond_Dead.svg`, etc., in `assets/icons/`. Update the `icon:` path in `CONFIG.statusEffects` once added.

### 18. Combat Tracker

Foundry-core widget; overrides may live in `templates/combat/`. Pattern A where the system controls the DOM.

| Element | Selector | Icon |
|---------|---------|------|
| Combatant row (PC) | `#combat-tracker .combatant[data-actor-type="character"]` | Person silhouette |
| Combatant row (NPC/mook) | `#combat-tracker .combatant[data-actor-type="npc"]` | Skull / target |
| Sprint button | `.sprint-btn` | Running figure |
| Initiative input | `.initiative` | Clock / chevron |

---

## Implementation Notes

1. **SVG authoring**: black on transparent (`fill:#000`). The bulk-convert ran on 2026-05-28 normalized the full library; new SVGs should follow this rule. `fill:none` is fine for groups/parents.

2. **Pattern A** (`.cpb-icon` / `.cpb-tab-icon`) is the default. Use it for anything that should track text color, including hover, active, and accent states. No per-state `filter:` rules needed.

3. **Pattern B** (`<img class="manufacturer-logo">`) is for logos that should always render white. The `filter: invert(1)` on the class handles the flip. Don't use this pattern for icons inside text runs — the inversion locks the color to white regardless of text color.

4. **File naming**:
   - Sheet/section icons: `bk_PascalCase.svg`
   - Role icons: plain `PascalCase.svg`
   - Status effect icons (new): `cond_PascalCase.svg`
   - Manufacturer logos: `Brand-Name.svg` (matched by `branding.mjs`)

5. **`.cpb-frame` interaction**: elements styled with `.cpb-frame` use `::before` for the chamfer inner fill. Don't add Pattern A icons directly on a `.cpb-frame` element — put them on an inner element (label, heading) instead.

6. **FontAwesome icons** (`<i class="fas fa-*">`) embedded inline in templates are still fine and don't need migration. They're already color-correct via FontAwesome's own font-color inheritance.

7. **SCSS vs CSS drift**: `css/cyberpunk-blue.css` is currently hand-edited (the SCSS source has fallen behind). Edits to icon-related rules should land in the CSS directly; mirror to SCSS only for the small subset of rules that still appear in both.
