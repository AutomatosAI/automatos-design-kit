# HUD

HUD (`automatos/hud`, `themes/hud`) draws Automatos as a command deck: a 56 px top bar with the AUTOMATOS // HUD
mark, the clock and the host's utilities; a side rail with every core page; square, bracketed panels with mono
labels; one accent; and a grid, a glow and scan lines behind everything. It is the kit's second theme, built here
from the Command design among the kit's design references ([`references/`](../../references/README.md)), around the
host's own pages. [`themes/hud/README.md`](../../themes/hud/README.md) has how it is built. This page reads
`themes/hud/theme.json` at version 1.0.1.

| Field | Value |
|---|---|
| `id`, `version` | `automatos/hud`, `1.0.1` |
| `engines` | `{"automatos": "^1.1.0", "sdk": "^1.1.0"}` |
| `base` | `studio`: the host's Studio design wherever HUD draws nothing of its own |
| `htmlClass` | `hud`: every rule of `dist/theme.css` sits under `html.hud` |
| `minWidth` | 360: below it the host draws its own pages and chrome; from 360 up to 1023 px HUD draws its phone layout (below) |
| `tone` | `from-look`: the look sets light or dark, and every HUD look is dark |
| `look` | `arc`, the default preset |

## What HUD draws

`src/entry.ts` registers three slots, one page and one route, the same that `theme.json` declares.

| Where | What it is |
|---|---|
| `frame@1` | The top bar, the side rail and the backdrop around every page. Every page HUD doesn't own is the host's, drawn inside the frame and recoloured by the look. Below 1024 px, the phone's frame: its top bar with MENU, no rail, and the menu (below). |
| `lookEditor@1` | The LOOK drawer, at `/looks`: the five presets and your saved looks, the eight knobs, Save as new look, Reset and Delete, a live preview, and Share to export or import a look. |
| `styleSheet@1` | The style sheet, at `/looks/style`: the active look's knobs with the variable each drives, HUD's colours and Studio's tokens with their values, the live contrast, the type and the components. |
| `/chat` | The core screen (`mode: own`): Auto in the voice core with his state in words and Pause Auto beside it, the transcript with his replies and the host's cards (or, before anything is said, a short line and three starters that fill the message box), NEW CHAT beside the title, the message box, and the Agents, Mission (this conversation's first), Deliverables, Today, Needs you and Next up panels as the window allows. A `/chat` link with `repo`, `runtime` or `mode` keeps the host's chat page. Below 1024 px, the phone's core screen (below). |
| `/x/conversations` | The Conversations route: every conversation as HUD panels, searchable by title, with NEW CHAT. The rail lists it after Chat, with a RECENT list of the latest five below the nav. |

HUD fills no `notFound@1` or `asleep@1`. Its menu entries (`nav`) are Conversations (`/x/conversations`), Look
(`/looks`) and Style sheet (`/looks/style`). `uses` names the SDK areas the code imports: `assets`, `cards`, `chat`, `context`, `deliverables`, `events`, `looks`, `navigation`, `pages-agents`, `pages-assignments`, `pages-command-center`, `storage` and `theme`. There is no microphone: the SDK gives a theme no voice, so the message box is the way in (Enter sends,
Shift + Enter makes a new line, Esc stops).

## In a phone's browser

`minWidth` is 360, so HUD draws a phone's width. Below 1024 px (`DESKTOP_MIN_WIDTH` in `src/lib/phone-layout.ts`) it
draws the Command design's phone (390 by 844) instead of its desktop layout. 1024 is the width core's own shell takes
for a desktop (`hooks/use-mobile.ts`), the width HUD's desktop frame is built and shot from, and the width core's host
draws an installed theme's frame from; the width is asked as core's `useIsBelowWidth` asks it (`(max-width: 1023px)`,
through `matchMedia`, known on the first render), and a browser that can't say is a wide one. From 1024 px up nothing
changes, and a window crossing the width keeps the page it shows.

- **The frame** (`src/frame/phone-top-bar.tsx`, `src/frame/nav-drawer.tsx`). A 56 px bar: MENU, the mark and
  AUTOMATOS //, and the backend's connection as a glyph and a word (the design's MIC LIVE stands there; it arrives with
  the SDK's voice area). No rail: every page takes the window's whole width, padded 16 px, on the design phone's 32 px
  grid and 320 by 320 glow. MENU (`aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`) opens the menu, a modal
  dialog from the left edge over the drawer glass: New chat, search and LOOK; the rail's pages in their groups with
  Conversations after Chat, RECENT, Docs and Settings; then the host's header utilities, which stay mounted while the
  menu is shut, so the frame always renders them. Open, it takes the focus (Close first), Tab and Shift + Tab wrap
  inside it, and Esc, Close or a tap on the glass shut it with the focus back on MENU; following a link or New chat
  shuts it for the page it opens. The bar, the page and the host's floating Auto widget are `inert` while it is open.
  A key pressed in a host menu drawn elsewhere in the page stays that menu's.
- **The core screen** (`src/chat/phone/`). From the top: the line naming who is at work, the running Mission's agent,
  `WORKING`, and the time since it started (the SDK's activity feed, the same ask as the desktop's MISSION panel; the
  feed says nothing finer of what the agent does), or with none `AUTO` and his state in a word, with no time; the
  290 px core with Auto, the state chip and Pause Auto beside it, as on the desktop; the last exchange, your newest
  words in quotes and every reply after them, Auto's with all it carries on the desktop (tool lines, Deliverables, the
  host's cards, receipts, the snag box, the AI-generated mark), then what follows the conversation; and a dock pinned
  to the foot: the host's credits banner, the message box (the desktop's, with the AI label fence) once TYPE opens it,
  and the control row. TYPE opens and shuts the box, putting the focus in it and keeping its words when shut; an empty
  chat's starter opens it with its words. STOP stops a reply as the box's Stop does, is disabled while nothing runs,
  and hands the focus to TYPE. The row's middle is the voice button's place (`VoiceSlot`, which draws nothing): the
  SDK has no voice area yet, so HUD draws no HOLD TO TALK, no waveform and no MIC LIVE. The conversation's title is the
  screen's h1 for a screen reader and the host's focus, not drawn, as the design's phone has none; New chat is in the
  menu. The screen scrolls as one when the window is too short for it.
- **Conversations, the LOOK drawer and the style sheet** draw in the phone's frame as they do on the desktop, each
  wrapping to the width; Conversations' heading shrinks to fit a 360 px window.

Core's host draws an installed theme's frame and pages from 1024 px up for now, whatever `minWidth` names
(`frontend/lib/theme-host/installed-entry.ts`, `INSTALLED_FRAME_MIN_WIDTH_PX`), and its own pages below that; the kit's
harness draws HUD from its `minWidth`, so `automatos-theme dev` in a narrow window shows the phone layout. Kit CI's
harness shots draw HUD at 1440 and 1024 px and just below `minWidth` (the host's pages), so no shot draws the phone
layout yet; HUD's own tests hold it (`test/frame/phone-frame.test.tsx`, `test/chat/chat-phone.test.tsx`).

## Looks

HUD's look data is committed: `looks/schema.json`, `looks/presets/*.look.json` and `boot/prepaint.json` are made from
its catalogue (`src/lib/looks/`, whose values are the Command design's) and held to it by HUD's own tests, not by
`scripts/compile-looks.mjs`. Its `pack` script runs `automatos-theme check design .` before `automatos-theme pack`.

The look format is `automatos-interface-look/v1`, interface `command`, with eight knobs (`looks/schema.json`):

| Knob | Label | Kind | Values | Default |
|---|---|---|---|---|
| `accent` | Accent | choice | `arc`, `forge`, `ghost`, `nova`, `signal`, `gold` | `arc` |
| `ground` | Background | choice | `void`, `carbon`, `navy`, `ember` | `void` |
| `font` | Type | choice | `raj` (Rajdhani), `chakra` (Chakra Petch), `mono` | `raj` |
| `grid` | Grid | number | 0 to 30, whole | 14 |
| `glow` | Glow | number | 0 to 40, whole | 22 |
| `scan` | Scan | choice | `on`, `off` | `on` |
| `auto` | Auto | choice | `on`, `off` | `on` |
| `motion` | Motion | choice | `on`, `off` | `on` |

The five presets (`looks/presets/`):

| Preset | accent | ground | font | grid | glow | scan | auto | motion |
|---|---|---|---|---|---|---|---|---|
| ARC (`arc`, the default) | arc | void | raj | 14 | 22 | on | on | on |
| FORGE (`forge`) | forge | ember | chakra | 8 | 26 | off | on | on |
| GHOST (`ghost`) | ghost | carbon | mono | 6 | 8 | off | off | on |
| NOVA (`nova`) | nova | navy | chakra | 16 | 30 | on | on | on |
| SIGNAL (`signal`) | signal | void | mono | 22 | 18 | on | off | on |

`boot/prepaint.json` paints the active look before HUD's code runs: HUD's own `--hud-*` variables and Studio's colour
tokens, so the host's pages inside the frame take the look's colours too. Its tone rule gives every ground `dark`.
The text colours are fixed so they read at WCAG AA on every background, and the glow stops where text on it would
drop under AA; `design/contrast.json` declares the pairs `automatos-theme check design` measures on every preset (it
is never packed).

## Auto and the files

- **Auto.** Through `@automatos/mascot`: twelve states (`hello`, `idle`, `listening`, `thinking`, `working`,
  `searching`, `reading`, `celebrate`, `oops`, `sleeping`, `lost`, `loading`), each as `.webm`, `.mp4` and `.png` in
  `assets/mascot/`: the same 36 files as Play's, (c) Automatos AI and not covered by the code licence
  (`themes/hud/NOTICE`). He shows while the look's `auto` is on, at the foot of the rail, on a ring in the look's
  colours, with the Pause Auto control; on the core screen he is in the voice core and the rail's dock steps aside.
  In a phone's browser there is no rail, so he shows on the core screen alone.
- **Fonts.** Rajdhani 700 and Chakra Petch 600 in `assets/fonts/`, listed in `theme.json` `fonts`, under the SIL Open
  Font License 1.1 with their licences. Geist and Geist Mono are the host's.
- **Bundled.** `@automatos/look-kit` and `@automatos/mascot`, packed under `source/packages/<name>/src/`.
- **Previews.** None: `theme.json` lists no `previews`.

## In the phone app

A phone app never runs HUD's code. What it can read is `theme.json`'s `mobile` block: `tokens`, with a `light` and a
`dark` scheme of Studio's 24 colour tokens as `#rrggbb`, the two schemes identical (ARC's colours: `--background`
`#030507`, `--foreground` `#E6F1F5`, `--primary` `#3FE0FF`, and the rest), and `"mascot": "none"`.

Core turns that into the answer of `GET /api/themes/mobile/{install_id}` (core's `docs/theme-host/mobile.md`):

- **Colours, fixed.** `tokens`: the block's own schemes, exactly as `theme.json` writes them. They don't follow the
  member's look.
- **Light or dark.** `tone` is null for a `tokens` block, so the phone follows the device's setting; both schemes
  are the same dark colours, so HUD draws dark either way.
- **Auto.** `none`: the answer lists no mascot states.
- **Fonts.** None: the block names no phone fonts.

HUD's own source says what the block is for (`src/lib/looks/mobile.ts`): a phone's own HUD layout reads none of these
tokens; they are there so a phone app that draws a theme from data alone draws HUD dark, and so core's review can
measure them, on each scheme, at AA. `test/mobile.test.ts` holds `theme.json` to the colours Studio's tokens paint on
the web for ARC. Core's `docs/theme-host/mobile.md` notes that the Automatos Go app does not read this answer yet.

## Building, releasing and history

In the kit, from `themes/hud`: `npm run build` (`vite build` with the kit's preset), `npm run lint`,
`npm run typecheck`, `npm test` and `npm run pack` (`automatos-theme check design .`, then
`automatos-theme pack . --out out`, which writes `automatos.hud-<version>.autotheme` and its `.sha256.json`). Kit CI's
`harness` job shoots HUD in the browser harness after Play. A `hud-v<version>` tag releases it
([releasing.md](../releasing.md)); its review, signature and listing follow Play's steps with HUD's names
([OFFICIAL-LISTING.md](../OFFICIAL-LISTING.md)).

What each version changed is in [`themes/hud/CHANGELOG.md`](../../themes/hud/CHANGELOG.md), newest first.
