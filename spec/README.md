# spec/

The `automatos-skin/v1` format: `automatos-skin.v1.schema.json`, the JSON Schema a skin's `skin.json` must match.

Studio owns the format (core PRD-259 §3). Until Studio publishes `GET /api/skins/schema`, the copy here implements PRD-259 §3 as a draft and says so (`"x-status": "draft-until-studio-publishes"`, with the PRD revision in `x-follows`). `npm run sync-schema` refreshes it from a running Automatos or a local `automatos-ai` checkout, and records where it came from in `x-source`. Edit the schema in Studio, not here.

The JSON Schema can't express every rule, so the `x-` keys carry the rest: `x-contrast` (the AA pairs and their minimum ratios), `x-limits` (size caps in bytes), `x-mascot-states` and `x-mascot-formats` (a custom mascot's 36 files), `x-files` (which package files are allowed) and `x-derived-aliases` (tokens Studio derives and a skin never sets). `lib/skins/format.ts` holds the same values for the validator; `tests/skins/spec.test.ts` fails when the two disagree.

Since K-010 the rules follow the core's Wave 1 as built (story S-001 and decisions K1-K5 of `automatos-ai/scripts/ralph/prd-259w1.json`; `frontend/lib/skins/schema.ts` at `242c9c0b` on `feat/prd-259-w1-skins`, recorded in `x-source.alignedWith`):

- The 47 allowed tokens and the 14 contrast pairs are the core's lists, in its order: each `-foreground` on its own fill, `muted-foreground` on `background` and on `card`, `ring` on `background` at 3:1.
- Decision K5: a pair is checked in a tone, on the skin's own colours, when the skin sets either side; setting one side without the other is an error. The base's colours are never used (Classic's own palette fails six pairs).
- `tokens.light` is required exactly when `tones` has `light`, `tokens.dark` exactly when it has `dark`.
- Fonts are a shipped key (`geist`, `geist-mono`, `newsreader`) or `assets/fonts/<name>.woff2` with the name `[A-Za-z0-9_-]{1,64}`.
- `mascot.shell` is one of `bronze`, `gold`, `silver`, `cobalt`; `mascot.light` one of `mint`, `amber`, `ice`, `rose`.
- `slug` is 1 to 64 characters; `licence` at most 80.
- Words (`name`, `author`, `description`, `licence`) are one line: no control characters, and none of `<`, `>`, `://`, `url(`, `javascript:`.

Where the kit stays stricter than Studio (a skin it passes always passes Studio): `author` is required; words also refuse other link shapes (`www.`, `//host`, `data:`, `mailto:`, `file:`) and invisible format characters; and errors carry a JSON path and a sentence but not Studio's error codes (`SCHEMA`, `PAIR_INCOMPLETE`, …).
