# Play

Play (`automatos/play`, `themes/play`) is Automatos with Auto, the mascot: its own frame and sidebar, a chat with
Auto, a shelf of Deliverables, a Conversations page, and looks a member picks and changes. It began as an interface
built into core and now lives only in this kit; [PLAY-HISTORY.md](../PLAY-HISTORY.md) records where its code came
from, and [`themes/play/README.md`](../../themes/play/README.md) how it is built. This page reads
`themes/play/theme.json` at version 1.1.1.

| Field | Value |
|---|---|
| `id`, `version` | `automatos/play`, `1.1.1` |
| `engines` | `{"automatos": "^1.1.0", "sdk": "^1.1.0"}` |
| `base` | `studio`: the host's Studio design wherever Play draws nothing of its own |
| `htmlClass` | `play`: every rule of `dist/theme.css` sits under `html.play` |
| `minWidth` | 1024: below it the host draws its own pages and chrome |
| `tone` | `from-look`: the look sets light or dark |
| `look` | `ember`, the default preset |

## What Play draws

`src/entry.ts` registers four slots, two pages and one route; `theme.json` declares the same, plus `asleep@1`.

| Where | What it is |
|---|---|
| `frame@1` | Play's frame and sidebar around every page. A page Play doesn't own is the host's, inside the frame. |
| `asleep@1` | Declared, not registered: Play's frame draws its own "backend is asleep" screen, so the host leaves the health poll to it. |
| `lookEditor@1` | Look, at `/looks`: pick a look, change it, save it. |
| `styleSheet@1` | The style sheet, at `/looks/style`: what the active look paints, its type, colours, components and Auto's states. |
| `notFound@1` | The 404, with Auto lost. |
| `/chat` | Play's own chat with Auto (`mode: own`). A `/chat` link with `repo`, `runtime` or `mode` keeps the host's chat page. |
| `/deliverables` | Play's shelf of Deliverables (`mode: own`). A link with `tab`, `post` or `artifact_type` keeps the host's page. |
| `/x/conversations` | The route `conversations`: Play's Conversations page. |

The menu entries (`nav`) for the host's search: Conversations (`/x/conversations`), Look (`/looks`) and
Style sheet (`/looks/style`). `uses` names the SDK areas the code imports: `assets`, `cards`, `chat`, `context`,
`deliverables`, `events`, `looks`, `navigation`, `pages-command-center`, `storage` and `theme`.
[guides/mascot-placement.md](../../guides/mascot-placement.md) has where Play puts Auto on each of these screens.

## Looks

Play's look data is generated, not committed: its build runs `scripts/compile-looks.mjs` (from
`src/lib/looks/catalogue.ts` and `presets.ts`) before `vite build`, and writes `looks/schema.json`,
`looks/presets/<id>.look.json` and `boot/prepaint.json`.

The look format is `automatos-interface-look/v1`, interface `play`, with six knobs:

| Knob | Kind | Values |
|---|---|---|
| `ground` | choice | `graphite`, `obsidian`, `indigo`, `paper` |
| `accent` | choice | `molten`, `cream`, `mint`, `gold`, `periwinkle`, `rose` |
| `font` | choice | `serif`, `clean`, `bric`, `round` |
| `shell` | choice | `bronze`, `gold`, `silver`, `cobalt` (Auto's shell) |
| `light` | choice | `mint`, `amber`, `ice`, `rose` (Auto's light) |
| `glow` | number | 0 to 40, whole |

The five presets (`src/lib/looks/presets.ts`):

| Preset | Sub | ground | accent | font | shell | light | glow |
|---|---|---|---|---|---|---|---|
| Ember (`ember`, the default) | Warm, editorial | graphite | molten | serif | bronze | mint | 24 |
| Obsidian (`obsidian`) | Mono, minimal | obsidian | cream | clean | bronze | mint | 6 |
| Aurora (`aurora`) | Cool and glassy | obsidian | mint | bric | bronze | ice | 20 |
| Workshop (`workshop`) | The original | indigo | molten | round | bronze | mint | 14 |
| Daylight (`daylight`) | For daytime | paper | molten | serif | bronze | mint | 10 |

`boot/prepaint.json` paints a look before any code runs: Play's own `--pl-*` variables and Studio's colour tokens for
every catalogue entry, the accent-on-ground pairs, the glow as a numeric rule capped per ground and accent, and the
tone rule, each ground's tone from `src/lib/looks/tone.ts` (a ground is dark when its background is darker than its
text: Paper is light, the other three dark). `design/contrast.json` declares the colour pairs `automatos-theme check
design` measures on every preset; it is never packed.

## Auto and the files

- **Auto.** Twelve states (`hello`, `idle`, `listening`, `thinking`, `working`, `searching`, `reading`, `celebrate`,
  `oops`, `sleeping`, `lost`, `loading`), each as `.webm`, `.mp4` and `.png` in `assets/mascot/`: 36 files, (c)
  Automatos AI and not covered by the code licence (the kit's `NOTICE`). The state machine, player and Pause Auto
  control are `@automatos/mascot`, which Play bundles.
- **Fonts.** Four display faces in `assets/fonts/` (Instrument Serif, regular and italic; Bricolage Grotesque 700;
  Fredoka 600), with their OFL licences. Geist is the host's.
- **Previews.** Seven listing images in `assets/previews/`: one per preset and two more of Ember
  (`ember-deliverables.png`, `ember-looks.png`).
- **Bundled.** `@automatos/look-kit` and `@automatos/mascot`, packed under `source/packages/<name>/src/`; three
  outside libraries copied into `src/vendor/` as source.

## On a phone

A phone app never runs Play's code. What it can read is `theme.json`'s `mobile` block:

```json
"mobile": { "fromLooks": true, "mascot": "clips" }
```

Core turns that into the answer of `GET /api/themes/mobile/{install_id}` (core's `docs/theme-host/mobile.md`):

- **Colours, from the member's look.** `fromLooks`: the member's active look for Play in that workspace, or the
  table's defaults when they have saved none, painted through `boot/prepaint.json` as the web's first paint paints
  it, keeping Studio's colour tokens only.
- **Light or dark.** Play's `tone` is `from-look`, so the phone gets the tone the table's tone rule gives the painted
  look: light for the Paper ground, dark for the others.
- **Auto.** `clips`: each of the twelve states with its `.mp4` clip and `.png` still. A phone gets no `.webm`.
- **Fonts.** None: the block names no phone fonts, so the answer has no font files.

The review measures the block's AA contrast on the table's defaults and on each of the five presets; Play's
`CHANGELOG.md` (1.1.0) records the ten pairs its proof holds. Core's `docs/theme-host/mobile.md` notes that the
Automatos Go app does not read this answer yet.

## Building, releasing and history

In the kit, from `themes/play`: `npm run build` (the look compiler, then `vite build`), `npm run lint`,
`npm run typecheck`, `npm test` and `npm run pack` (`automatos-theme pack . --out out`, which writes
`automatos.play-<version>.autotheme` and its `.sha256.json`). A `play-v<version>` tag releases it
([releasing.md](../releasing.md)), and [OFFICIAL-LISTING.md](../OFFICIAL-LISTING.md) lists it on the hosted
edition.

What each version changed is in [`themes/play/CHANGELOG.md`](../../themes/play/CHANGELOG.md), newest first.
