# spec/

The `automatos-skin/v1` format: `automatos-skin.v1.schema.json`, the JSON Schema a skin's `skin.json` must match.

Studio owns the format (core PRD-259 §3). Until Studio publishes `GET /api/skins/schema`, the copy here implements PRD-259 §3 as a draft and says so (`"x-status": "draft-until-studio-publishes"`, with the PRD revision in `x-follows`). `npm run sync-schema` refreshes it from a running Automatos or a local `automatos-ai` checkout, and records where it came from in `x-source`. Edit the schema in Studio, not here.

The JSON Schema can't express every rule, so the `x-` keys carry the rest: `x-contrast` (the AA pairs and their minimum ratios), `x-limits` (size caps in bytes), `x-mascot-states` and `x-mascot-formats` (a custom mascot's 36 files), `x-files` (which package files are allowed) and `x-derived-aliases` (tokens Studio derives and a skin never sets). `lib/skins/format.ts` holds the same values for the validator; `tests/skins/spec.test.ts` fails when the two disagree.

Choices the draft makes where PRD-259 §3 is open (to confirm when Studio publishes):

- Text pairs: each `-foreground` on its own fill, plus `muted-foreground` on `background` and on `muted`, and `olive` and `warn-ink` on `background`; `ring` on `background` at 3:1.
- A pair is checked in a tone when the skin sets at least one of its two tokens there; the other side comes from the base. Pairs the skin doesn't touch are the base's (Classic's own palette fails six of them). The validator takes the base palettes as `baseTokens`; K-003 supplies them.
- `mascot.shell` is one of Auto's shell tints (`bronze`, `gold`, `silver`, `cobalt`); `mascot.light` is a colour.
- Studio's fonts are `Geist`, `Geist Mono` and `Newsreader`; any slot may use any of them.
- `shape.radius` and `shape.glow` are whole numbers; `description`, `licence`, `fonts`, `shape`, `mascot` and `preview` are optional.
- Words (`name`, `author`, `description`, `licence`) may not hold a web address or `<`/`>`.
