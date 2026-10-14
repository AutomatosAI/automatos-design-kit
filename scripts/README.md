# scripts/

The kit's command line, run with `npm run <name>` (TypeScript through `tsx`; the logic is in `scripts/lib/` so tests can call it):

- `validate <dir|file.autoskin>`: checks a skin with the same rules as Studio (`lib/skins/validate.ts`) and prints each problem with its JSON path, or the package file it is about. Exits 0 when the skin is valid, 1 when it isn't (or the file isn't a `.autoskin`), 2 when the path doesn't exist or the usage is wrong. Until K-003 brings Studio's base palettes, a contrast pair whose other side would come from the base is not checked. A folder's `.DS_Store`, `Thumbs.db` and `desktop.ini` are ignored (they are never packed).
- `sync-schema [-- --from <automatos-ai checkout>]`: refreshes `spec/automatos-skin.v1.schema.json` from `GET {AUTOMATOS_BACKEND_URL}/api/skins/schema` (default `http://localhost:8000`), or with `--from` from the schema exported by the checkout's `frontend/lib/skins/schema.ts`, and records where it came from in `x-source`. When neither answers it says why and changes nothing.
- `pack <dir>`: validates a skin folder and writes `dist/<slug>-<version>.autoskin` (K-007).

`scripts/ralph/` is the build loop that made the kit, not part of it.
