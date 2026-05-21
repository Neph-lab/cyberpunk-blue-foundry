# Icon Placement Reference — Cyberpunk Blue

Every location in the system that needs a custom SVG icon, with enough selector detail to wire them in without re-reading the codebase. Created to be used alongside the chamfered design system (see `_design_handoff_temp/`).

---

## Wiring Pattern

All icons follow the same CSS pattern. Icon files live at `assets/icons/bk_*.svg`.

```css
/* Tab icon (::before is reserved for tab icons, ::after is chamfer fill) */
.cyberpunk-blue .sheet-tabs .item[data-tab="example"]::before {
  background: url("../assets/icons/bk_Example.svg") center / contain no-repeat;
}

/* Section header icon (::before is free here — not a .cpb-frame element) */
.cyberpunk-blue .some-header::before {
  content: "";
  display: inline-block;
  width: 1.1rem;
  height: 1.1rem;
  background: url("../assets/icons/bk_Example.svg") center / contain no-repeat;
  filter: var(--cpb-icon-filter);  /* tints SVG to match text colour */
  flex-shrink: 0;
}
```

**Important stacking rule:** Elements styled with `.cpb-frame` use `::before` for the chamfer inner fill. Do **not** add `::before` icons to `.cpb-frame` elements — use a child element's `::before`, or an `<img>`/`<span>` icon inside the frame instead.

---

## Already-wired Icons (Character Sheet Tabs)

These are complete; listed here for reference only.

**CSS location:** `css/cyberpunk-blue.css` — search for `SHEET TABS`

| Tab | `data-tab` value | SVG file |
|-----|-----------------|----------|
| Overview | `overview` | `bk_Overview.svg` |
| Skills | `skills` | `bk_Skills.svg` |
| Cyberware | `cyberware` | `bk_Cyberware.svg` |
| Inventory | `inventory` | `bk_Inventory.svg` |
| Netrunning | `netrunning` | `bk_Netrunning.svg` |
| Notes | `notes` | `bk_Notes.svg` |

---

## Needs Icons

### 1. Item Sheet Tabs

All item sheet tabs currently render text-only. Add icons using the same `::before` pattern as character sheet tabs.

**Template:** `templates/item/item-sheet.hbs`  
**CSS target pattern:** `.cyberpunk-blue .sheet-tabs .item[data-tab="VALUE"]::before`

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

---

### 2. Mook Sheet Tabs

**Template:** `templates/actor/mook-sheet.hbs`  
**CSS target pattern:** `.cyberpunk-blue .sheet-tabs .item[data-tab="VALUE"]::before`

| Tab label | `data-tab` value | Suggested icon concept |
|-----------|-----------------|----------------------|
| Basics | `basics` | Person / ID card |
| Items | `items` | Bag / crate |
| Notes | `notes` | Notepad / pen |

---

### 3. Stat Cards

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab  
**Target:** add a `::before` icon to the heading or a decorative `::after` on the card itself.  
**CSS pattern:**

```css
.cyberpunk-blue .stat-card[data-stat="STAT_KEY"]::before { /* icon */ }
/* or, if the card has a label element: */
.cyberpunk-blue .stat-card[data-stat="STAT_KEY"] .stat-label::before { }
```

| Stat | `data-stat` attribute (check template) | Suggested icon concept |
|------|----------------------------------------|----------------------|
| INT | `int` | Brain / circuit |
| REF | `ref` | Lightning bolt |
| DEX | `dex` | Hand / fingers |
| TECH | `tech` | Wrench / gear |
| COOL | `cool` | Sunglasses / ice shard |
| WILL | `will` | Fist / shield |
| LUCK | `luck` | Dice / four-leaf |
| MOVE | `move` | Running figure / chevron |
| BODY | `body` | Torso / flexed arm |
| EMP | `emp` | Heart / signal waves |

---

### 4. Resource Cards

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab  
**CSS pattern:** `.cyberpunk-blue .resource-card[data-resource="KEY"] .resource-name::before`

| Resource | Key / label | Suggested icon concept |
|----------|-------------|----------------------|
| SP (armor) | `sp` / `.armor-card` | Shield / armor plate |
| MOVE (derived) | `move` / `.move-card` | Chevron right / sprint |
| Humanity | `humanity` | Heart / yin-yang |
| Luck | `luck` | Dice |
| Extra resources | any `.resource-card` | Generic chip / gauge |

---

### 5. Health Panel

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab, `.health-panel`  
**Note:** These elements are NOT `.cpb-frame`, so `::before` is safe.

| Element | CSS selector | Suggested icon |
|---------|-------------|---------------|
| Health section header | `.cyberpunk-blue .health-block h3::before` | Heart / pulse |
| Serious Wound Threshold label | `.cyberpunk-blue .health-threshold-label::before` | Warning triangle |
| Death Save label | `.cyberpunk-blue .health-death-save-label::before` | Skull |
| Active Effects section header | `.cyberpunk-blue .health-effects h3::before` | Status dot / pulse wave |
| Individual AE row | `.cyberpunk-blue .health-effect::before` (falls back to item img) | Already uses `img` element |
| Critical Injury row modifier | `.cyberpunk-blue .health-effect.is-critical-injury::before` | Broken bone / cross |

---

### 6. Skill Section

**Template:** `templates/actor/actor-sheet.hbs` — Skills tab  
**Note:** Individual skill rows are dense tables; icons are best on **category headers**, not individual rows.

| Element | CSS selector | Suggested icon |
|---------|-------------|---------------|
| Skill section header | `.cyberpunk-blue .skills-layout > .panel-header h2::before` | Brain / skill star |
| Athletics group | `.cyberpunk-blue .skill-category-header[data-category="athletics"]::before` | Running figure |
| Awareness group | `.cyberpunk-blue .skill-category-header[data-category="awareness"]::before` | Eye |
| Body group | `.cyberpunk-blue .skill-category-header[data-category="body"]::before` | Torso |
| Control group | `.cyberpunk-blue .skill-category-header[data-category="control"]::before` | Steering wheel / hand |
| Education group | `.cyberpunk-blue .skill-category-header[data-category="education"]::before` | Book |
| Fighting group | `.cyberpunk-blue .skill-category-header[data-category="fighting"]::before` | Crossed swords / fist |
| Performance group | `.cyberpunk-blue .skill-category-header[data-category="performance"]::before` | Star / mic |
| Ranged group | `.cyberpunk-blue .skill-category-header[data-category="ranged"]::before` | Crosshair |
| Social group | `.cyberpunk-blue .skill-category-header[data-category="social"]::before` | Speech bubble |
| Technique group | `.cyberpunk-blue .skill-category-header[data-category="technique"]::before` | Wrench |

> Check the templates for what class/attribute marks a skill category header — if no `data-category` exists, target via `:nth-child` or add the attribute to the template.

---

### 7. Cyberware Section

**Template:** `templates/actor/actor-sheet.hbs` — Cyberware tab  
**CSS pattern for body-part groups:** `.cyberpunk-blue .cyberware-group[data-location="LOC"] > h2::before`

| Body location | `data-location` (check template) | Suggested icon |
|---------------|----------------------------------|---------------|
| Head | `head` | Head silhouette |
| Eyes | `eyes` | Eye |
| Ears | `ears` | Ear |
| Mouth | `mouth` | Lips / speaker |
| Torso / Internal | `torso` | Torso / heart |
| Shoulders / Arms | `arms` | Arm / fist |
| Hands | `hands` | Hand / fingers |
| Legs | `legs` | Leg / boot |
| Unconnected | `unconnected` | Link-slash / disconnected |

> If `data-location` is not on the group element, check whether the h2 text is the discriminator and target by `h2` text content via `:has()` or JavaScript class injection instead.

---

### 8. Inventory Groups

**Template:** `templates/actor/actor-sheet.hbs` — Inventory tab  
**CSS pattern:** `.cyberpunk-blue .inventory-group[data-type="TYPE"] > h2::before`

| Category | `data-type` (check template) | Suggested icon |
|----------|------------------------------|---------------|
| Weapons | `weapon` | Pistol / sword |
| Armor | `armor` | Shield |
| Clothing | `clothing` | T-shirt / jacket |
| Gear | `gear` | Bag / crate |
| Electronics | `electronics` | Circuit / phone |
| Cyberware | `cyberware` | Implant chip |
| Drugs | `drug` | Syringe / pill |
| Ammo | `ammo` | Bullet / cartridge |

---

### 9. Role & Ability Tables

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab (Roles/Abilities section)  
**CSS pattern:** `.cyberpunk-blue .traits-role-panel .panel-header h2::before` etc.

| Element | CSS selector | Suggested icon |
|---------|-------------|---------------|
| Roles section header | `.cyberpunk-blue .traits-role-panel .panel-header h2::before` | Crown / archetype |
| Abilities section header | `.cyberpunk-blue .traits-ability-panel .panel-header h2::before` | Star burst / talent |
| Individual role row | `.cyberpunk-blue .embedded-row[data-item-type="role"]::before` | Per-role icon (see below) |
| Individual ability row | `.cyberpunk-blue .embedded-row[data-item-type="ability"]::before` | Specialty-specific |

**Per-role row icons** — target by role name data attribute or item name class if present:

| Role | Suggested icon |
|------|---------------|
| Bandit | Skull / fist |
| Exec | Briefcase / suit |
| Fixer | Handshake / coin |
| Guide | Compass / map |
| Lawman | Badge / gavel |
| Leader | Megaphone / crown |
| Media | Camera / newspaper |
| Medtech | Medical cross / syringe |
| Netrunner | Circuit / terminal |
| Nomad | Wheel / road |
| Protean | Shift / morph |
| Rocker | Guitar / mic |
| Solo | Crosshair / blade |
| Specialist | Wrench / badge |
| Techie | Wrench / gear |

---

### 10. Role Overview Feature (per-role mechanics panel)

**Template:** `templates/actor/actor-sheet.hbs` — Overview tab, role-overview-feature block  
**CSS pattern:** `.cyberpunk-blue .role-overview-feature .roleCategory::before`

Each role's overview panel header (`h4.roleCategory`) could display the role icon. Selector is the same for all — the icon displayed is determined by which role is active, so this would need either:
- A per-role CSS class on the feature wrapper (check if one exists)
- Or a single generic "role active" icon

| Element | CSS selector | Note |
|---------|-------------|------|
| Role category heading | `.cyberpunk-blue .role-overview-feature .roleCategory::before` | One icon per active role, or generic |
| Role mechanic row labels | `.cyberpunk-blue .role-mechanic-row .role-mechanic-label::before` | Action-type icon |
| Specialty budget counter | `.cyberpunk-blue .specialty-budget .panel-header span::before` | Points/budget chip icon |
| Protean tactic name | `.cyberpunk-blue .protean-tactic-name::before` | Strategy/morph icon |

---

### 11. Netrunning Tab

**Template:** `templates/actor/actor-sheet.hbs` — Netrunning tab  
**Note:** Many buttons already use `<i class="fas fa-*">` inline — those don't need CSS `::before` icons.

| Element | CSS selector | Suggested icon | Note |
|---------|-------------|---------------|------|
| Components section header | `.cyberpunk-blue .netrunner-components-row .panel-header h2::before` | Microchip / NET globe | |
| Individual component header | `.cyberpunk-blue .netrunner-comp-header::before` | Component-specific | Depends on component type |
| NET connection box | `.cyberpunk-blue .net-connection-box .panel-header span::before` | Plug / signal | |
| Computers section header | `.cyberpunk-blue .sheet-panel h2.computers-header::before` | Monitor / terminal | Verify class name in template |
| Executables on Disk header | `.cyberpunk-blue .netrunner-exe-table thead th:first-child::before` | Disk / storage | |
| Executables on Shards header | `.cyberpunk-blue .netrunner-shards-table thead th:first-child::before` | Shard / card | Verify class name |

---

### 12. Character Creation Wizard

**Template:** `templates/character-creation/wizard.hbs`  
**Note:** Buttons already have `<i class="fas fa-*">` icons. Focus here is on structural indicators.

| Element | CSS selector | Suggested icon |
|---------|-------------|---------------|
| Progress step dot (active) | `.cyberpunk-blue .cc-step-dot.active::before` | Filled circle / number |
| Progress step dot (completed) | `.cyberpunk-blue .cc-step-dot.completed::before` | Checkmark |
| Points counter (on-budget) | `.cyberpunk-blue .cc-points-counter::before` | Gauge / chip |
| Points counter (all spent) | `.cyberpunk-blue .cc-points-counter.all-spent::before` | Check / full gauge |
| Points counter (over budget) | `.cyberpunk-blue .cc-points-counter.over-budget::before` | Warning triangle |

---

### 13. Panel Headers (general — across all sheets)

These are `.panel-header` elements that wrap sections with an `h2` or `h3`. Many don't have icons.

| Element | CSS selector | Suggested icon |
|---------|-------------|---------------|
| Weapon block header | `.cyberpunk-blue .weapon-block > .panel-header h3::before` | Weapon silhouette |
| Weapon mods section header | `.cyberpunk-blue .mod-list .panel-header h3::before` | Wrench / bolt |
| Range band table header | `.cyberpunk-blue .weapon-range-table-wrap .panel-header::before` | Range / radar |
| Embedded item section headers | `.cyberpunk-blue .component-panel .panel-header h2::before` | Stacked layers / puzzle |
| Mook skills header | `.cyberpunk-blue .mook-skills-panel .panel-header h2::before` | Brain / chart |
| Mook components header | `.cyberpunk-blue .mook-components-panel .panel-header h2::before` | Puzzle / gear |

---

### 14. Chat Messages

**Template:** `templates/chat/` (various partial templates)  
**CSS pattern:** `.cyberpunk-blue .chat-message[data-message-type="TYPE"] .message-header::before`

Chat messages don't currently have type-specific icons on the header. Add them by targeting the message wrapper or header.

| Message type | Suggested CSS selector | Suggested icon |
|-------------|----------------------|---------------|
| Skill roll | `.cyberpunk-blue .chat-roll-skill .message-header::before` | Brain / d10 |
| Attack roll | `.cyberpunk-blue .chat-roll-attack .message-header::before` | Crosshair |
| Damage roll | `.cyberpunk-blue .chat-roll-damage .message-header::before` | Lightning bolt / blood drop |
| Initiative roll | `.cyberpunk-blue .chat-roll-initiative .message-header::before` | Speed / clock |
| Death Save roll | `.cyberpunk-blue .chat-roll-death .message-header::before` | Skull |
| Luck spend | `.cyberpunk-blue .chat-luck-spend .message-header::before` | Dice |
| Role ability use | `.cyberpunk-blue .chat-role-ability .message-header::before` | Star / archetype |

> Check `templates/chat/` for actual class names on the message wrappers — these may differ. Use `Grep` on `chat-roll` or `message-type` to verify selectors before implementing.

---

### 15. Combat Tracker

**Template:** Foundry core renders the combat tracker; system overrides may exist in `templates/combat/`.

| Element | CSS selector | Suggested icon |
|---------|-------------|---------------|
| Combatant row (PC) | `.cyberpunk-blue #combat-tracker .combatant[data-actor-type="character"]::before` | Person silhouette |
| Combatant row (NPC/mook) | `.cyberpunk-blue #combat-tracker .combatant[data-actor-type="npc"]::before` | Skull / target |
| Sprint button | `.cyberpunk-blue .sprint-btn::before` or inner icon | Running figure |
| Initiative input | `.cyberpunk-blue .initiative::before` | Clock / chevron |

---

## Implementation Notes

1. **Icon file naming:** Follow existing convention — `bk_` prefix, PascalCase, `.svg`. Example: `bk_SkillBrain.svg`.

2. **Tab icons use `::before`; chamfer fill uses `::after`** — this is already correct in the CSS for `.sheet-tabs .item`. Any new tab added to either the character sheet or item sheet needs only the `::before` background-image rule.

3. **Stat and resource card icons:** The stat cards use `.cpb-frame` class in the new design system, meaning their `::before` is taken by the chamfer fill. Place stat icons either:
   - On an inner element's `::before` (e.g., `.stat-label::before`)
   - As a separate `<span class="stat-icon">` in the template (preferred for flexibility)

4. **Inline FontAwesome icons already present:** Many buttons already contain `<i class="fas fa-*">` elements in the Handlebars templates. These render correctly and do NOT need CSS `::before` additions. The locations listed above that say "has `fas fa-*` in HTML" are complete — no CSS work needed.

5. **SVG filter for icon tinting:** The existing tab icons use raw SVG files at fixed colour. For icons that should adapt to the text colour (muted, accent, etc.), use:
   ```css
   filter: brightness(0) saturate(100%) invert(85%) sepia(20%) saturate(400%) hue-rotate(160deg);
   ```
   Or define a `--cpb-icon-filter` custom property in `:root` so it can be overridden per context.
