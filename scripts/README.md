# scripts/

The kit's command line, run with `npm run <name>`:

- `validate <dir|file.autoskin>`: checks a skin with the same rules as Studio and prints each problem with its JSON path (PRD-004 K-002).
- `sync-schema`: refreshes `spec/` from a running Automatos or a local `automatos-ai` checkout (K-002).
- `pack <dir>`: validates a skin folder and writes `dist/<slug>-<version>.autoskin` (K-007).

`scripts/ralph/` is the build loop that made the kit, not part of it.
