# Play

Play (`automatos/play`, `themes/play`) is Automatos with Auto, the mascot: its own frame and sidebar, a chat with
Auto that a member types or talks to, a shelf of Deliverables, a Conversations page, and looks a member picks and
changes, from a phone's width up. It began as an interface
built into core and now lives only in this kit; [PLAY-HISTORY.md](../PLAY-HISTORY.md) records where its code came
from, and [`themes/play/README.md`](../../themes/play/README.md) how it is built. This page reads
`themes/play/theme.json` at version 1.2.0.

| Field | Value |
|---|---|
| `id`, `version` | `automatos/play`, `1.2.0` |
| `engines` | `{"automatos": "^1.1.0", "sdk": "^1.2.0"}`: SDK 1.2.0 for the `voice` area |
| `base` | `studio`: the host's Studio design wherever Play draws nothing of its own |
| `htmlClass` | `play`: every rule of `dist/theme.css` sits under `html.play` |
| `minWidth` | 360: below it the host draws its own pages and chrome; from 360 up to 1023 px Play draws its phone layout (below) |
| `tone` | `from-look`: the look sets light or dark |
| `look` | `ember`, the default preset |

## What Play draws

`src/entry.ts` registers four slots, two pages and one route; `theme.json` declares the same, plus `asleep@1`.

| Where | What it is |
|---|---|
| `frame@1` | Play's frame and sidebar around every page. A page Play doesn't own is the host's, inside the frame. Below 1024 px, the phone's frame: its bar with Menu, Chats and Shelf, no sidebar, and the menu (below). |
| `asleep@1` | Declared, not registered: Play's frame draws its own "backend is asleep" screen, so the host leaves the health poll to it. |
| `lookEditor@1` | Look, at `/looks`: pick a look, change it, save it. |
| `styleSheet@1` | The style sheet, at `/looks/style`: what the active look paints, its type, colours, components and Auto's states. |
| `notFound@1` | The 404, with Auto lost. |
| `/chat` | Play's own chat with Auto (`mode: own`), the host's voice button beside Send. A `/chat` link with `repo`, `runtime` or `mode` keeps the host's chat page. |
| `/deliverables` | Play's shelf of Deliverables (`mode: own`). A link with `tab`, `post` or `artifact_type` keeps the host's page. |
| `/x/conversations` | The route `conversations`: Play's Conversations page. |

The menu entries (`nav`) for the host's search: Conversations (`/x/conversations`), Look (`/looks`) and
Style sheet (`/looks/style`). `uses` names the SDK areas the code imports: `assets`, `cards`, `chat`, `context`,
`deliverables`, `events`, `looks`, `navigation`, `pages-command-center`, `storage`, `theme` and `voice`.
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

## Voice

The message box holds the host's voice button (the SDK's `voice.VoiceButton`) between the words and Send: `mode`
`auto` (Live where the workspace has it, else quick-ask), `press` `hold`, the Space hotkey on a desktop and none on a
phone, `size` `md`. Core draws the press, the microphone prompt, the "AI voice assistant" caption and the stop control
while the microphone is open (a protected surface), and a failure with Try again; Play sets only the button's
`--voice-button-*` properties (a 44 px square, the text colour at rest, the accent and its ink while it hears) and
styles it by its `data-voice-*` attributes. Nothing locks: the words and Send work while voice runs.

While a session runs, Auto follows it (`src/lib/voice/voice-pose.ts`):

| Phase | Auto | Caption |
|---|---|---|
| `connecting`, waiting for the microphone | `loading` | "Getting ready to listen" |
| `listening` (or connecting with the microphone open) | `listening` | "Listening" |
| `thinking` | `thinking` | "Thinking" |
| `speaking` | `idle`, his light ring swelling with `readVoiceLevels().agent` | "Speaking" |
| `error` | `oops` | "Something went wrong" |
| `idle`, `ended` | the chat's own state | the chat's |

His ring follows the level once a frame, in `requestAnimationFrame`, never under reduced motion or while he is paused.
What the session heard and what Auto has said so far are the conversation's last two messages while it runs (core's
chat adds them, `voice-live-user` and `voice-live-assistant`, until the saved turn takes their place), so Play's message
list draws them as your message and Auto's reply, with his AI-generated mark; Play draws no words of its own beside
them. Play captures and plays no audio itself; the kit's rules refuse a theme that does.

## In a phone's browser

`minWidth` is 360, so Play draws a phone's width. Below 1024 px (`DESKTOP_MIN_WIDTH` in `src/lib/play/phone-layout.ts`,
asked as core's `useIsBelowWidth` asks it, `(max-width: 1023px)`) it draws the Ember design's 390 screens instead of
its desktop layout; from 1024 px up nothing changes, and a window crossing the width keeps its page. Core's host keeps
an installed theme's `minWidth` and draws its frame and pages from that width up
(`frontend/lib/theme-host/installed-entry.ts`).

- **The frame** (`src/components/play/shell/phone-bar.tsx`, `phone-menu.tsx`). A 56 px bar: Menu, the wordmark (to the
  chat), and the design's two places, Chats (Conversations) and Shelf (the Deliverables), the current one marked with
  the accent's dot. No sidebar and no header row: the page takes the whole width. Menu (`aria-expanded`,
  `aria-controls`, `aria-haspopup="dialog"`) opens a modal menu from the left edge over a glass: New chat and search,
  the sidebar's nav with Conversations after Chat and Look on its own, Recent, Docs and Settings, the connection pill,
  then the host's header utilities, which stay mounted while it is shut. Open, it takes the focus (Close first), Tab
  wraps inside it, and Esc, Close or the glass shut it with the focus back on Menu; a link, New chat or search shuts
  it for what it opens. The bar, the page and the host's floating Auto widget are `inert` while it is open.
- **The pages.** Every page starts 16 px in. The chat has no mascot column: Auto stands at his small size beside his
  caption over the message box, as the design's strip has him, and the voice button has no hotkey. Conversations is
  titled Chats, with no mascot column. The shelf lays its cards in two columns, the newest across both. A
  Deliverable's side panel, the look editor and the style sheet's columns stack under the page. The asleep screen and
  the 404 take the phone's type sizes and full-width buttons, Auto at 170 px where he is large.

Kit CI's harness shots draw Play at a phone's 390 × 844 too, as its `minWidth` fits a phone: every view of each preset
(`<preset>/390/`) and `/chat` on the made-up transcript (`<preset>/390-transcript/`), each with an axe scan; and its
voice states on the transcript at 1440 px (`<preset>/1440-voice-<phase>/`), the session's words at the end of the
conversation. Play's own tests hold the layout too
(`test/shell/phone-frame.test.tsx`, `test/shell/phone-css.test.ts`, `test/chat/voice-chat.test.tsx`).

## In the phone app

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
