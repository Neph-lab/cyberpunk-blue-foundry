---
name: wire-styles
description: Wire authored item Styles under assets/items/styles/** into module/data/style-catalogue.mjs, so Gear and Cyberware compendium entries carry their cosmetic variants (name, image, description, manufacturer, cost, Style-skill bonus). Triggers on "/wire-styles", "wire up the new styles", "add these styles to the compendium", or when the user points at one or more folders under assets/items/styles/. Use whenever the user has authored a batch of style folders and wants them connected to compendium items.
---

# Wire item Styles to the compendium

A **Style** is a cosmetic variant of a Gear or Cyberware item: its own picture and
blurb, optionally its own manufacturer and cost, and optionally a bonus to the
**Style** skill. The item's own look is the implicit **Default** and is never
authored — only the variants are.

This skill turns the authoring folders under `assets/items/styles/` into entries
in the generated block of `module/data/style-catalogue.mjs`.

The compendium pack DBs are LevelDB and get regenerated when the GM loads the
world — **never edit `packs/**` directly**. Only edit catalogue source files.

## Authoring layout

```
assets/items/styles/
  gear/
    leather-jacket/
      styles.json
      chrome-noir.png
      kitsch.png
  cyberware/
    cyberarm/
      styles.json
      gunmetal.png
```

The `gear/` vs `cyberware/` split is what picks the catalogue to validate
against — it resolves real collisions that already exist across the two (e.g.
`Linear Frame Sigma` in gear vs `Implanted Linear Frame Sigma` in cyberware).
The item-slug folder name is for humans; the authoritative name is `item` inside
the JSON.

`styles.json`:

```json
{
  "item": "Leather Jacket",
  "styles": [
    {
      "name": "Chrome Noir",
      "img": "chrome-noir.png",
      "description": "Brushed gunmetal panels over a matte shell.",
      "manufacturer": "MaxiWear",
      "cost": "LUX",
      "bonus": 1
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `item` | yes | The exact catalogue `name:`. The folder slug need not match it. |
| `name` | yes | Style name. Also the source of its stable `id` (a slug) — **renaming a style orphans every player's selection of it**, so flag a rename to the user rather than doing it silently. |
| `img` | no | Bare filename inside the folder. Blank falls back to the item's Default art. |
| `description` | no | Bare sentence (auto-wrapped in `<p>` by the `h()` helper) or full HTML in the house style. |
| `manufacturer` | no | Blank/omitted = no override. |
| `cost` | no | Short COST code (`CH`, `EV`, `CO`, `PR`, `EX`, `VEX`, `LUX`, `SLX`) or a literal price string. Blank/omitted = no override. |
| `bonus` | no | Integer, default 0. Non-zero grants an AE adding to `system.skills.style.bonus` while the item is equipped/installed. |

## Inputs

1. **No arguments** → every `assets/items/styles/**/styles.json` whose contents
   differ from what's already in `style-catalogue.mjs`.
2. **Path(s) given** → only those folders (or the folders containing the given
   `styles.json` files).

## Procedure

1. **Read** `module/data/style-catalogue.mjs` and each target `styles.json`.
2. **Validate** each file before writing anything:
   - `item` resolves to a real entry: `gear/` → a `gear({ name: ... })` in
     `module/data/equipment-catalogue.mjs`; `cyberware/` → a `cw({ name: ... })`
     in `module/data/cyberware-catalogue.mjs`. **Never invent a catalogue entry.**
   - Every referenced `img` file exists in the folder.
   - Style names are unique within the item (their slugs become the `id`s).
   - `cost` is a known COST code or a plausible literal price string.
   - `bonus` is an integer.
3. **Categorize**, as `/wire-images` does: clean / ambiguous (ask first) / no
   entry (report, never invent) / already wired (skip silently).
4. **Write** the `STYLES` table inside the generated block of
   `style-catalogue.mjs`, between the `── GENERATED BLOCK START ──` and
   `── GENERATED BLOCK END ──` markers. One key per item name, using the
   `style({ ... })` builder with `folder: '<gear|cyberware>/<item-slug>'`:

   ```js
   const STYLES = {
     'Leather Jacket': [
       style({
         name: 'Chrome Noir', folder: 'gear/leather-jacket', img: 'chrome-noir.png',
         manufacturer: 'MaxiWear', cost: 'LUX', bonus: 1,
         description: 'Brushed gunmetal panels over a matte shell.',
       }),
     ],
   };
   ```

   Keep existing items in the table untouched unless their `styles.json`
   changed. Do not hand-write `id:` — `style()` derives it from the name.

## Verification & commit

1. Run `node --check module/data/style-catalogue.mjs`.
2. Summarize: `N styles across M items wired, K unmatched (listed), J already present`.
3. Per the user's standing rule ([[feedback_commit_to_main]]), if nothing is
   unresolved, stage the images + `style-catalogue.mjs` and commit directly to
   main — e.g. `feat(styles): wire <count> styles for <count> items`. If anything
   is ambiguous, surface it and wait.

## Notes

- **Already-owned items don't update.** Like every other catalogue field, styles
  reach compendium entries only; a world item already dragged off the compendium
  keeps whatever it had. That's existing, accepted behavior — mention it only if
  the user asks why their character's jacket didn't gain the new styles.
- **The GM must reload** for changes to appear — the catalogues seed the packs on
  world init.
