# scripts/

The kit's command line, run with `npm run <name>` (TypeScript through `tsx`; the logic is in `scripts/lib/` so tests can call it):

- `validate <dir|file.autoskin>`: checks a skin with the same rules as Studio (`lib/skins/validate.ts`) and prints each problem with its JSON path, or the package file it is about. Exits 0 when the skin is valid, 1 when it isn't (or the file isn't a `.autoskin`), 2 when the path doesn't exist or the usage is wrong. A contrast pair whose other side would come from the base is not checked yet (K-010 makes a skin set both sides of every pair it touches). A folder's `.DS_Store`, `Thumbs.db` and `desktop.ini` are ignored (they are never packed).
- `sync-schema [-- --from <automatos-ai checkout>]`: refreshes `spec/automatos-skin.v1.schema.json` from `GET {AUTOMATOS_BACKEND_URL}/api/skins/schema` (default `http://localhost:8000`), or with `--from` from the schema exported by the checkout's `frontend/lib/skins/schema.ts`, and records where it came from in `x-source`. When neither answers it says why and changes nothing.
- `pack <dir>`: validates a skin source folder with the same rules, then writes `dist/<slug>-<version>.autoskin` (a zip of `skin.json`, kept byte for byte, and the `assets/` files it names; `lib/skins/pack.ts`, the same code as the editor's Export). Nothing is written when the skin is invalid. Exits 0 when packed, 1 when the skin is invalid or can't be read, 2 when the folder doesn't exist, isn't a folder, or the usage is wrong.
- `previews [-- <slug>]`: redraws `skins/<slug>/assets/preview.png` for every example skin (or one) from its `skin.json`: a 960 × 540 PNG of Studio-shaped parts (sidebar, header, stats, chat, buttons, a focused field, a chart), one panel per tone. Plain Node (`scripts/draw-previews.mjs`, no dependencies, nothing from the internet). Run it after changing an example's colours.

`scripts/ralph/` is the build loop that made the kit, not part of it.
