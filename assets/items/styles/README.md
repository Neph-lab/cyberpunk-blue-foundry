# Item Styles — authoring folder

A **Style** is a cosmetic variant of a Gear or Cyberware item: its own picture and
blurb, optionally its own manufacturer and cost, and optionally a bonus to the
**Style** skill. An item's own look is the implicit **Default** — it is never
authored here, and selecting Default always restores the item's own picture,
manufacturer and cost.

Nothing in this folder is picked up by `/wire-images` (it is explicitly excluded).
Run **`/wire-styles`** instead; it validates these folders and regenerates the
`STYLES` table in `module/data/style-catalogue.mjs`.

## Layout

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

The `gear/` vs `cyberware/` split picks which catalogue the item name is
validated against — it resolves collisions that already exist across the two
(e.g. `Linear Frame Sigma` in gear vs `Implanted Linear Frame Sigma` in
cyberware). The item-slug folder name is for humans; `item` inside the JSON is
authoritative.

## `styles.json`

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
    },
    {
      "name": "Kitsch",
      "img": "kitsch.png",
      "description": "Every colour at once, and then some."
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `item` | yes | The exact catalogue `name:`. |
| `name` | yes | Style name. Its slug becomes the stable `id` — **renaming a style orphans every player's selection of it.** |
| `img` | no | Bare filename in this folder. Blank falls back to the item's Default art. |
| `description` | no | Bare sentence (auto-wrapped in `<p>`) or full HTML in the house style. |
| `manufacturer` | no | Blank/omitted = no override. |
| `cost` | no | Short code (`CH`, `EV`, `CO`, `PR`, `EX`, `VEX`, `LUX`, `SLX`) or a literal price string. Blank/omitted = no override. |
| `bonus` | no | Integer, default 0. Non-zero grants an AE adding to `system.skills.style.bonus` while the item is equipped/installed. GM-only field — players never see it. |
