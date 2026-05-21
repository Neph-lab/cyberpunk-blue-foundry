# Handoff: Cyberpunk Blue — Chamfered Shape Language

A visual-layer overhaul of the **Cyberpunk Blue** Foundry VTT system. The new shape language replaces the previous "soft squared" radii (2–3px) with **chamfered clip-path polygons** in the CyberTechUI vocabulary — diagonal corner cuts, peg/notch tab interlocks, foot-style dividers — while keeping the existing electric-blue palette and Chakra Petch / Share Tech Mono typography intact.

---

## ⚠️ DO NOT TOUCH FUNCTION OR STRUCTURE

**This is a CSS-only refresh.** Read this section before doing anything else.

The Cyberpunk Blue codebase contains:
- Handlebars templates (`templates/actor/*.hbs`, `templates/item/*.hbs`)
- Actor sheet and Item sheet JavaScript classes
- Foundry hooks, system.json declarations
- Actor / Item type definitions (`character`, `npc`, `mook`, `program`, `vehicle`, `role`, `ability`, `cyberware`, `gear`, `ammo`, `programExecutable`, `drug`, `mod`)
- Roll / dice / chat-card behaviour
- Compendium content

**None of those are to be modified.** Specifically:

1. **No Handlebars template edits.** Class names on existing elements MUST stay the same. The class vocabulary in the new CSS deliberately matches the existing system (`.cpb-*` selectors); the visual changes are achieved by re-styling those classes, not by re-marking the HTML.
2. **No JavaScript edits.** Click handlers, form data binding, sheet registration, roll formulas, hooks — all untouched.
3. **No data-shape changes.** `system.json`, schema definitions, attribute paths (`@stats.rflx.value`, etc.), Foundry hook signatures — untouched.
4. **No template-structure changes.** Don't add, remove, or reorder `<div>` / `<section>` / `<button>` elements. If a control needs a new wrapper to support the new shape (e.g. `.cpb-field__wrap` around an `<input>` for the chamfered border trick), that's the rare exception — and only inside `<input>`-equivalent template fragments, never around interactive logic.
5. **No accessibility regressions.** `<label>` / `<button>` / form semantics stay correct.

If a CSS rule cannot be applied without a template change, **stop and ask** before editing the template. Default assumption is: this is a stylesheet swap.

---

## About the Design Files

The files in this handoff are **design references** — CSS + HTML prototypes showing intended look and behaviour. The task is to **merge the new visual vocabulary into the existing `cyberpunk-blue/src/scss/cyberpunk-blue.scss` source**, recompile, and ship — NOT to drop the prototype CSS in raw.

This means:
- **Translate** CSS rules from the handoff into the existing SCSS file structure / partials. Use the same selectors that already exist where possible.
- **Preserve** the existing build (Foundry expects compiled CSS at the path declared in `system.json`). No new build steps.
- **Merge token changes** into the existing `:root.cyberpunk-blue { --cpb-*: ... }` block at the top of the SCSS; the variable names are unchanged, just some values changed (radii → chamfer scale, focus-fill behaviour, etc.).

Everything below is the spec.

---

## Fidelity

**High-fidelity.** Every measurement, every clip-path, every transition duration matches the prototype. The developer should recreate the visual exactly. The previews in this handoff are pixel-true references.

---

## What's Changing

### 1. Shape vocabulary
- **Previously:** `border-radius: 2/2/3/2px` across panels, cards, inputs, buttons.
- **Now:** `clip-path: polygon(...)` chamfered silhouettes. Eight named primitives (`tr-bl`, `tl-br`, `hex`, `card`, `panel`, `notch`, `tag`, `arrow`, `check`, `radio`, `step`, `slab`) — see `cpb-shapes.css`.
- **Chamfer scale:** four sizes (`--cpb-cut-xs: 4px`, `--cpb-cut-sm: 7px`, `--cpb-cut-md: 10px`, `--cpb-cut-lg: 16px`).

### 2. The "fake border" technique
`border` does not respect `clip-path` (the corner pixels get clipped away). Every component therefore paints the outer element in the border colour and uses a 1px-inset `::before` to paint the inner fill. The 1px gap reads as the hairline. `clip-path: inherit` keeps the inner shape in register with the outer.

**Do not try to use real `border` on chamfered elements — it will silently look broken.**

### 3. Contrast rule (memorise this)
> **If the background interior is a solid accent colour, the text on it MUST be `--cpb-bg-solid-top` (near-black) with `font-weight: 700` and `text-transform: uppercase`.**

This applies to:
- Active tabs · button hover · `.cpb-btn--solid` · all `.cpb-chip--active/--always/--disabled/--error` · `.cpb-divider--label` text · `.cpb-card__status` pips
- Hover transitions that fill with the accent
- Lime, warm, warn, error variants of the above

Wash fills (`rgba(0,240,255,0.10)` / `--cpb-accent-wash`) keep accent-coloured text as before — the rule only fires when the interior is a *solid* fill.

### 4. Opaque interiors on solid outers
Where a component's outer (border-painting) layer is a solid accent, the inner `::before` fill MUST also be opaque — translucent inner over solid outer floods the entire interior. Use `--cpb-bg-solid-bottom` (`#060912`) as the base, or `color-mix(in oklab, var(--accent) 18%, var(--cpb-bg-solid-bottom))` for an opaque tinted plate.

### 5. Smooth transitions
All button / tab / chip state changes ride a `0.18s var(--cpb-ease)` transition on `background`, `color`, and `::before` `background`. The previous hard state-flips are gone.

---

## Files in This Package

```
design_handoff_chamfered_shape_language/
├── README.md                           ← this file
├── colors_and_type.css                 ← token source of truth (radii values changed; everything else same)
├── cpb-shapes.css                      ← NEW · shape primitives (clip-paths + .cpb-frame helper)
├── cpb-base.css                        ← REWRITTEN · component layer
└── preview/
    ├── shape-language.html             ← every shape primitive, catalog + chamfer scale
    ├── components-form-inputs.html     ← checkbox / radio / switch / fields / range / submit row
    ├── components-dividers-cards-tabs.html  ← dividers, cards, tab scaffold (h, v, lime), button-group
    ├── components-buttons.html         ← legacy preview, picks up new styles
    ├── components-chips.html           ← legacy preview
    ├── components-tabs.html            ← legacy preview
    └── components-inputs.html          ← legacy preview
```

Open each preview in a browser to see the intended rendering. The preview HTML is reference-only — do not ship it.

---

## Component-by-Component Spec

### Panels (`.cpb-panel`)
- Outer paints `--cpb-panel-border` (32% cyan); `::before` paints `--cpb-panel` (92% opaque navy) inset 1px.
- Shape: `--cpb-cut-lg` (16px) chamfer on TR + BL corners.
- Shadow: `var(--cpb-shadow)` unchanged.
- Use `.cpb-panel-body` as inner padding container; outer `.cpb-panel` should not get its own padding (the chamfered fill takes the whole element).

### Cards (`.cpb-card`)
- Same fake-border treatment as panel; chamfer `--cpb-cut-md`.
- Generous internal padding: header `1.3rem 1.6rem`, body `1.4rem 1.6rem`, footer `1.2rem 1.6rem`.
- Structured slots: `.cpb-card__header`, `.cpb-card__title` (lime ▌ glyph leader), `.cpb-card__id`, `.cpb-card__status` (chevron-tip tag with glowing pip, four variants), `.cpb-card__body`, `.cpb-card__meta`, `.cpb-card__footer`.
- **Tone cascade**: `.cpb-card--lime/warm/warn/error` set `--card-tone`. Buttons inside automatically retint to that tone via `--btn-tint`, EXCEPT `.cpb-btn--roll` (always lime), `.cpb-btn--atk` (always warm-violet), `.cpb-btn--solid` (primary), and `.cpb-btn--ghost` (which keeps its own visual but hovers to the card's tone). This preserves semantic colour rules (rolls are always lime) while letting in-card buttons feel native.
- `.cpb-card--stripe` adds a 4px accent stripe at the left; padding-left compensates. Stripe variants must use OPAQUE inner fill (`--cpb-bg-solid-bottom`) — see "Opaque interiors" above.
- Warn / error variants use 42%-alpha border tokens (not solid) so the standard panel-deep interior reads correctly.

### Inputs (`.cpb-field` / `.cpb-field__wrap` / `.cpb-input`)
- Structure: `<label class="cpb-field"><span class="cpb-field__label">…</span><span class="cpb-field__wrap"><input class="cpb-input"></span></label>`.
- The `__wrap` paints the chamfered fake-border; the `<input>` is borderless, sits inside.
- Focus: the hairline lightens to full `--cpb-accent` but the interior STAYS DARK (deep panel + ~3% cyan wash). Do NOT flood the input with the accent on focus — text becomes unreadable.
- Tones: `.cpb-field--error/warn/lime` change border + label colour.
- Adornments (`.cpb-field__adorn`) sit inside the wrap as leading/trailing slots, separated by 1px hairlines.
- Number inputs strip native spinners; `select` gets a custom chevron caret via gradients.

### Checkbox (`.cpb-check`)
- Marker is a chamfered slab (TR + BL cut). The native `<input>` is visually hidden.
- Check is a polygon (not a stroked SVG path) painted in `--cpb-bg-solid-top` against the bright accent fill.
- Indeterminate state paints a horizontal bar with the same painting strategy.
- Three sizes: 16 / 20 / 26px via `.cpb-check--sm/--lg`.
- Five tints: default cyan, `--lime`, `--warm`, `--warn`, `--error`.

### Radio (`.cpb-radio`)
- Same skeleton; box has all four corners chamfered (no circles in this system).
- Checked state paints a concentric diamond core.

### Switch (`.cpb-switch`)
- Chevron-tipped track + diamond thumb.
- Checked: track fills solid accent, thumb flips to `--cpb-bg-solid-top` (dark) so it pops. **Do not** use a translucent inner on the checked track — it floods the same colour as the thumb.

### Buttons (`.cpb-btn`)
- Tint system: each button reads `--btn-tint`, `--btn-tint-border`, `--btn-tint-wash`. Variants override these via class; ancestor scopes (`.cpb-card--lime`) override via cascade.
- HUD side-stripe at the left interior, painted via `::after`.
- Hover: fills with the accent + black bold uppercase label. Smooth 0.18s transition.
- Variants: `--roll` (lime, for dice), `--atk` (warm violet, for attack rolls), `--ghost` (low emphasis), `--solid` (primary action — always filled, always black bold), `--arrow` (chevron-block silhouette for forward CTAs), `--disabled`.

### Button groups (`.cpb-btn-group`)
- Adjacent buttons use peg/notch interlocks instead of the standard chamfer.
- Middle buttons: peg on the right, notch on the left, with a 4px flex gap of negative space between (peg fits across the gap; notch wraps the air on the other side).
- First button: TL chamfer + right peg; last button: notch + TR chamfer.
- HUD side-stripe is hidden inside groups (the peg/notch is the visual identity).
- Use ONLY for true button groups (segmented controls, paired CTAs). Standalone buttons keep the cleaner TR+BL chamfer.

### Tabs (`.cpb-tab` / `.cpb-tabs__list` / `.cpb-tabs__panel`)
- Same peg/notch geometry as button-groups.
- First tab: TL chamfer + right peg. Last tab: notch + TR chamfer. Middle tabs: peg + notch.
- 4px gap between siblings.
- **Active tab fills solid with the accent + bold uppercase BLACK label**. The active tab's bottom edge overlaps the under-rail with a 2px paint in the accent so it merges into the panel below.
- Hover matches active styling (full fill + black bold).
- `.cpb-tabs--vertical` rotates the geometry: peg points down on the bottom edge, notch on top.
- `.cpb-tabs--lime` swaps the accent.
- Panel: chamfered slab docked under the tabs, painted as a continuation of the active tab's fill.

### Chips (`.cpb-chip`)
- Base: hex silhouette (all four corners cut), 4px chamfer.
- `--active/--always/--disabled/--error` are tag-style markers: SOLID accent fill + bold uppercase BLACK text. (No more wash interior, no more accent-on-accent.)
- `--tag` variant: chevron-tipped pointy-left shape for faction / status flags.

### Pills (`.cpb-pill`)
- Info readouts (HP 35/35, DV 13, RoF 2). Translucent outer + soft wash inner + accent text. Different from chips — pills are non-interactive data.

### Counters (`.cpb-counter`)
- Ammo / charge tally. Image · name · qty. Chamfered outer slab with internal hairline dividers between the three children.
- `--depleted` flips to error tint.

### Dividers (`.cpb-divider`)
- Paint-only chamfered slabs — a horizontal bar with a descending foot on one or both ends.
- Variants: default (left foot), `--r` (right), `--both`, `--mid` (centred), `--up` (foot points up), `--plain` (flat bar only), `--label` (caption housed inside the foot, bold black on accent), `--v` (vertical).
- Tones: `--lime`, `--warm`, `--muted`.

---

## Files to Edit in the Codebase

Working assumption: the codebase is at `cyberpunk-blue/` and the live SCSS is `cyberpunk-blue/src/scss/cyberpunk-blue.scss`. Adjust paths if your tree differs.

1. **`cyberpunk-blue/src/scss/cyberpunk-blue.scss`** — merge in:
   - The new chamfer-scale tokens (`--cpb-cut-xs/sm/md/lg`, `--cpb-stroke`, `--cpb-stripe`) into the `:root.cyberpunk-blue { … }` block.
   - The shape primitives from `cpb-shapes.css` (or import as a partial).
   - The component rules from `cpb-base.css`, replacing the equivalents in the existing SCSS one component at a time:
     - `.sheet-panel` → adopt `.cpb-panel` rules
     - `.sheet-tab` / `.tab` → adopt `.cpb-tab` peg-notch rules
     - `.cpb-btn` / `.btn-roll` → adopt button rules
     - `.cpb-input` / form fields → adopt input rules
     - `.cpb-card` / weapon rows / cyberware cards → adopt card rules
   - The two new utility families: `.cpb-divider--*` and `.cpb-btn-group`.

2. **Compile** with whatever build script exists (likely `npm run build` or `gulp css` in the repo). Do not change the build config.

3. **Visually verify** in Foundry against the preview HTML in this package. Any regression vs the prototype = bug; investigate before declaring done.

4. **Don't touch** anything else in the repo.

---

## Design Tokens

All names unchanged from the existing system. Only the values that changed are listed; everything else is identical to the current `colors_and_type.css`.

### Radii (CHANGED)
The previous `--cpb-radius-input: 2px / --cpb-radius-card: 2px / --cpb-radius-panel: 3px / --cpb-radius-pill: 2px` are kept as legacy aliases but should not be referenced in new rules. The active system is:

```
--cpb-cut-xs: 4px       /* chips, pills, checkbox marks */
--cpb-cut-sm: 7px       /* inputs, buttons, tabs */
--cpb-cut-md: 10px      /* cards, counters */
--cpb-cut-lg: 16px      /* top-level panels */
--cpb-stroke: 1px
--cpb-stroke-thick: 1.5px
--cpb-stripe: 3px       /* HUD side-stripe on buttons */
```

### Colors, type, motion (UNCHANGED)
All `--cpb-bg-*`, `--cpb-panel*`, `--cpb-text`, `--cpb-muted`, `--cpb-accent`, `--cpb-accent-strong`, `--cpb-accent-warm`, `--cpb-warning`, `--cpb-error`, `--cpb-magenta` tokens keep their existing values. Same for type families, sizes, weights, tracking, spacing scale, and motion vars (`--cpb-ease`, `--cpb-dur`). The icon filter tokens (`--cpb-icon-invert`, `--cpb-icon-tint-*`) are untouched.

---

## Open Questions / Risks

- **Form data binding**: the new `<span class="cpb-field__wrap">` wrapper around `<input>` is the one place where a template *might* need an extra DOM node. If the existing templates already wrap inputs in a container element, reuse that element with the new class instead of adding a wrapper. **Check before adding.**
- **Foundry's window chrome**: the system runs inside Foundry's application windows. The new shape language applies to system-owned UI only — do NOT clip-path Foundry's own window header / resize handles / close button.
- **Print / PDF export**: if the system exports character sheets to PDF (chat-card screenshots or printable layout), test that `clip-path` renders correctly in headless Chrome. If not, provide a `@media print` fallback that re-applies the old radii.
- **Older browsers**: `clip-path: polygon()` and `color-mix()` are required. Foundry v14 ships modern Electron so this is fine. Do not introduce polyfills.

---

## Done = ?

The handoff is complete when:
1. The compiled CSS in the existing build outputs the new shapes for every preview equivalent in Foundry.
2. Every Handlebars template renders unchanged (no diff).
3. Every existing JS handler works unchanged (rolls, sheet save, item edit, drag-drop).
4. Visual diff against the preview HTML in this package is essentially zero modulo the surrounding Foundry chrome.
5. No new dependencies, no new build steps, no new files outside `src/scss/`.

If any of those are unmet, the PR is incomplete.
