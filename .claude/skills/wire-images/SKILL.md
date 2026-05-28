---
name: wire-images
description: Wire item-art images under assets/items/** to their matching compendium catalogue entries (sets the `img:` / `imgPath:` field in `module/data/*-catalogue.mjs`). Triggers on phrases like "wire up the new images", "add these images to the compendium", "/wire-images", or when the user points at one or more specific tracked files/folders they want connected to compendium entries. Use whenever the user has added or already-committed art they want hooked up to weapons, gear, mods, cyberware, drugs, ammo, programs, or vehicles.
---

# Wire images to compendium entries

Connect image files under `assets/items/**` to their matching entry in a `module/data/*-catalogue.mjs` file by setting/updating the `img:` (or `imgPath:` for weapons) field.

The compendium pack DBs are LevelDB and get regenerated when the GM loads the world — **never edit `packs/**` directly**. Only edit catalogue source files.

## Inputs

The user invokes this skill in one of two ways:

1. **No arguments** → scan `git status` for untracked files under `assets/items/**` and wire those.
2. **Path(s) given** (one or more files or folders, tracked or untracked) → wire exactly those. A folder means "every image file directly or recursively under it."

If both apply (untracked files exist AND the user gave paths), only wire the given paths — don't sweep up unrelated untracked files.

## Folder → catalogue mapping

| `assets/items/` subfolder | Catalogue file                    | Field      |
|---------------------------|-----------------------------------|------------|
| `weapons/` (any depth)    | `weapon-catalogue.mjs`            | `imgPath:` |
| `ammo/`                   | `ammo-catalogue.mjs`              | `img:`     |
| `mods/` (any depth)       | `mod-catalogue.mjs`               | `img:`     |
| `cyberware/`              | `cyberware-catalogue.mjs`         | `img:`     |
| `drugs/`                  | `drug-catalogue.mjs`              | `img:`     |
| `gear/`, `clothes/`, `armor/`, `chipware/` | `equipment-catalogue.mjs` | `img:` |
| `programs/`               | `program-catalogue.mjs`           | `img:`     |
| `vehicles/`               | `vehicle-catalogue.mjs`           | `img:`     |
| `abilities/`              | `ability-catalogue.mjs`           | `img:`     |

The weapon catalogue uses a helper: `imgPath: img(W_PISTOL, 'Filename.png')` where `W_PISTOL`, `W_SMG`, `W_SHOTGUN`, `W_AR`, `W_SNIPER`, `W_MELEE`, `W_ROOT` are constants defined at the top. Use the matching constant for the file's subfolder. Note the folder `Pisols/` is misspelled on disk — that's intentional, `W_PISTOL` points there.

Other catalogues use a literal path string: `img: \`systems/cyberpunk-blue/assets/items/<sub>/<file>\``.

## Matching procedure

For each image path:

1. **Find the catalogue** from the subfolder mapping above.
2. **Read the catalogue file** if not already read this session.
3. **Match by name**: derive a candidate name from the filename (drop extension, normalize whitespace/case). Search the catalogue's `name:` fields for:
   - exact match (ignore case)
   - then "filename is contained in name" or vice versa (handles "Carnage.png" → "Budget Arms Carnage")
   - then fuzzy/typo match (e.g. `Polychenic.png` ↔ `Darra Polytechnic DS-1 Tenebra`, `Maloran Arms Sonnet.png` ↔ `Malorian Arms Sonnet`)
4. **Categorize**:
   - **Clean match** — exactly one strong candidate → edit confidently.
   - **Ambiguous** — multiple plausible candidates, or a fuzzy match where the filename differs significantly → list and ask the user before editing.
   - **No entry** — the catalogue has no matching item → tell the user; do NOT invent an entry.
   - **Already wired** — the catalogue entry already points at this exact file → skip silently (don't report unless the user asked for everything).

## Edits

- For weapon catalogue: replace `imgPath: img(<CONST>, '<old>')` with the new filename and (if subfolder changed) new constant.
- For other catalogues: replace the `img: \`...\`` template literal with the new full path.

Don't touch surrounding fields. Don't reformat the entry.

## Verification & commit

After edits:

1. Show the user a short summary: `N wired, M ambiguous (listed), K not found (listed), J already wired`.
2. Per the user's standing rule ([[feedback_commit_to_main]]), if there are no unresolved ambiguities and the user hasn't asked you to hold off, stage the image files + catalogue edits and commit directly to main. Use a message like `art: wire <count> images to compendium entries`. If ambiguities remain, surface them first and wait for direction before committing.

## Reload note

For changes to appear in a running world the GM must reload — the catalogues seed the packs on world init. Mention this only if the user asks whether it's live.
