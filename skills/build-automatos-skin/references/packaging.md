# Validate, pack, load, submit

## The source folder

A skin you work on is a folder (the examples are in `skins/`):

```
skins/<slug>/
  skin.json
  assets/preview.png              optional, at most 1 MB
  assets/fonts/<name>.woff2       only the fonts skin.json names, at most 400 KB each
  assets/mascot/<state>.<format>  only for "mode": "custom", all 36, at most 8 MB together
```

Nothing else is allowed: no other files, no folders outside `assets/`, no path traversal, no symbolic links. `.DS_Store`, `Thumbs.db` and `desktop.ini` are skipped by the folder reader and never packed. Every file is checked by its first bytes, not its name.

## Validate

```sh
npm run validate skins/<slug>          # a source folder
npm run validate dist/<file>.autoskin  # a packed file
```

The same rules as Studio (`lib/skins/validate.ts`): the schema and allowed fields, token names and colour formats, the contrast pairs, fonts, shape, mascot, files and sizes. It prints `✓ <name> (<slug> <version>) is a valid automatos-skin/v1 skin.` or one line per problem, `✗ <JSON path or file>  <what is wrong>`, then `<n> problems in <target>.` Exit code 0 valid, 1 invalid, 2 when the path doesn't exist or the usage is wrong. Run it after every change; fix the problems it names, top to bottom.

## Pack

```sh
npm run pack skins/<slug>
```

Validates the folder again, then writes `dist/<slug>-<version>.autoskin` and prints `✓ Packed <name> into dist/<file> (<size>).` An invalid skin writes nothing ("Nothing was packed."). The file is a zip of `skin.json` (kept byte for byte) and the `assets/` files it names, at most 15 MB, and the same skin always packs to the same bytes. `dist/` is git-ignored.

The editor's **Export .autoskin** makes the same file from the draft (`lib/skins/pack.ts` is the only packer), and **Import a .autoskin** reads one back (validated first; a preview picture isn't kept).

## Load into my Automatos

With a local Automatos that has skins (core PRD-259) running:

- **In Studio:** Style → Add a skin…, then pick the `.autoskin`. It is installed in your workspace only, with no review, and applies at once.
- **From the kit's editor:** "Load into my Automatos" sends the draft as a file to `POST /api/skins/import` (multipart field `file`) through the kit's own server (`/api/studio/import-skin`; the browser never calls Automatos). The answer says "<name> is in your Automatos. Pick it in Studio under Style, Skins."

Studio checks the file again with its own validator; its reasons are listed in the editor when it refuses. An Automatos without PRD-259 answers 404, shown as "Your Automatos doesn't support skins yet (it needs PRD-259)": keep the file until it does.

How Studio then applies it (PRD-259 §4): the `automatos-style` cookie becomes `skin:<id>`, `<html>` gets the base's class (`studio`, or none for Classic) and `data-skin="<id>"`, and Studio writes one stylesheet from the validated numbers: `html[data-skin="<id>"]{…light…}` and `html.dark[data-skin="<id>"]{…dark…}`, with `--radius`, `--skin-glow` and the font variables. A dark-only skin forces Dark while it is active (and a light-only one Light); a skin that goes missing falls back to its base with a quiet notice.

## Submit to the Marketplace

"Submit to the Marketplace" in the editor sends the same file to `POST /api/marketplace/skins` through `/api/studio/submit-skin`. It waits for an admin's review (in the local edition you are the admin) unless you are a trusted author; the answer says which. Once approved, other workspaces find it under the Marketplace's Skins tab, install it and pick it in their Style list. "Open my Automatos Marketplace" opens the page (`NEXT_PUBLIC_AUTOMATOS_STUDIO_URL`, default `http://localhost:3000`).

Before you submit: a `preview.png` (people choose by it), a `description` that says what the skin looks like, a `licence`, and a `version` bumped from any copy already out there.

## What never goes in

CSS, JavaScript, SVG, HTML, URLs, fields the schema doesn't have, and keys of any kind. Studio refuses them, and so does the kit. A skin is data that Studio turns into CSS; that is what lets anyone install one safely.
