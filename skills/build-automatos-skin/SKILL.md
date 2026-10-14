---
name: build-automatos-skin
description: Make a skin for Automatos Studio with the Automatos Skin Kit (automatos-play) — an automatos-skin/v1 skin.json of Studio's colour tokens for light and dark, fonts, radius, glow and an optional mascot, validated with npm run validate, packed into a .autoskin with npm run pack and loaded into a local Automatos. Use when asked to design, change, fix, validate or pack a Studio skin or theme, or to explain what a skin token colours.
---

# Build an Automatos skin

A skin changes how Studio looks, never how it works. It is **data**: one `skin.json` of colours, font names and two numbers, plus optional font and mascot files. Studio validates it and writes the CSS itself (core PRD-259 §3–§4). Studio's pages, layouts and components stay the same.

You work in the Skin Kit, this repo. Everything a skin needs is here: the format (`lib/skins/format.ts`, mirrored in `spec/automatos-skin.v1.schema.json`), four examples in `skins/`, the CLI, and the editor and preview app.

## The rules (read first)

1. **Never write CSS, JavaScript, SVG, HTML or a URL into a skin.** Not in a token, not in `name` or `description`, not as a file. The validator refuses all of them, and Studio refuses them again on upload. If something can't be said with the allowed tokens, it can't be in a skin: say so instead of working around it.
2. **Only the allowed token names.** 47 of them, listed with what each colours in `references/tokens.md`. `paper`, `bg-1`, `bg-2`, `fg`, `fg-2` and `fg-3` are derived by Studio and never set.
3. **Every text pair you touch, you set both sides of.** Set `primary`, set `primary-foreground` too, in every tone the skin has. Each text pair needs 4.5:1, `ring` on `background` 3:1 (`references/contrast.md`). Studio's own palettes fail some pairs, so don't lean on the base for the other side.
4. **`npm run validate` is the judge,** not your reading of the colours. Run it until it prints `✓`. Fix what it names; never weaken a colour pair by guessing.
5. **Nothing runs on the maintainer's machine unless they run it.** If you are in an unattended loop or CI-only session, write the skin and say which commands to run; don't start servers.

## The workflow

1. **Start from something that passes.** Copy an example folder: `cp -r skins/ember skins/<your-slug>` (Ember: Studio base, light and dark, Auto; Daylight: light only; Workshop: Classic base, dark only; Neon: dark only, sharp HUD look, no mascot). Or start from Studio's own look in the editor (`/`, "Start from Studio") and export.
2. **Edit `skins/<your-slug>/skin.json`:**
   - `slug` (kebab-case), `name` (≤ 40 characters), `version` (semver), `author`, `description` (≤ 280), `licence`.
   - `base`: `studio` or `classic`. The base keeps its layout and shapes; your tokens replace its colours.
   - `tones`: `["light", "dark"]` or one alone. Give `tokens.light` and/or `tokens.dark` to match: a tone not in `tones` must have no tokens.
   - `tokens.<tone>`: colours as HSL triplets (`"16 100% 50%"`, no `hsl()`) or `#rrggbb`.
   - `fonts`, `shape` (`radius` 0–24, `glow` 0–40, whole numbers), `mascot` (`references/fonts.md`, `references/mascot.md`).
   - `preview`: `"assets/preview.png"`, a PNG of at most 1 MB, or leave the field out.
3. **Validate until clean:** `npm run validate skins/<your-slug>`. Each problem is a line `✗ <JSON path>  <what is wrong>`, for example `✗ $.tokens.light.primary-foreground  In light, primary-foreground on primary is 3.31:1; text needs at least 4.5:1.` For a failing pair, `references/contrast.md` says how to find a readable colour.
4. **Look at it** (when someone can run the app): `npm run pack` it, `npm run dev`, open http://localhost:3100 and use the editor's "Import a .autoskin" (an example opens with "Start from <name>"). The editor shows every pair's badge, and `/preview` shows the skin on Studio-shaped components in both bases and tones.
5. **Pack:** `npm run pack skins/<your-slug>` writes `dist/<slug>-<version>.autoskin`.
6. **Load it into a local Automatos:** in Studio, Style → Add a skin… and pick the file, or the editor's "Load into my Automatos" (`references/packaging.md`). Submit to the Marketplace the same way when it is ready to share.

Bump `version` whenever you change a skin someone has installed.

## References

- `references/tokens.md`: every allowed token, what it colours in Studio, and where the kit's preview shows it.
- `references/contrast.md`: the pairs, the ratios, and how to derive readable text.
- `references/fonts.md`: Studio's fonts, your own woff2 files, and which base reads them.
- `references/mascot.md`: off, Auto or your own: the 12 looping clips and how they were made.
- `references/packaging.md`: validate, pack, load, submit, and what the package may hold.

## Where the format comes from

Studio owns `automatos-skin/v1` (core PRD-259; `docs/prd/core/PRD-259-SKINS-IN-STUDIO.md` here). Until Studio publishes `GET /api/skins/schema`, the kit's copy is a draft (`spec/README.md` lists its choices) and `npm run sync-schema` refreshes it. When the kit and Studio disagree, Studio wins: fix the kit and log it in `docs/SKILL-GAPS.md`.

Building a whole new interface on the Automatos API instead of a skin is a different job: `skills/build-automatos-interface/`.
