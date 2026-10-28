# HUD

HUD (`automatos/hud`, `themes/hud`) draws Automatos as a command deck: a 56 px top bar with the AUTOMATOS // HUD
mark, the clock and the host's utilities; a side rail with every core page; square, bracketed panels with mono
labels; one accent; and a grid, a glow and scan lines behind everything. It is the kit's second theme, built here
from the Command design among the kit's design references ([`references/`](../../references/README.md)), around the
host's own pages. [`themes/hud/README.md`](../../themes/hud/README.md) has how it is built. This page reads
`themes/hud/theme.json` at version 1.1.2.

| Field | Value |
|---|---|
| `id`, `version` | `automatos/hud`, `1.1.2` |
| `engines` | `{"automatos": "^1.1.0", "sdk": "^1.2.0"}`: SDK 1.2.0, the SDK with the voice area |
| `base` | `studio`: the host's Studio design wherever HUD draws nothing of its own |
| `htmlClass` | `hud`: every rule of `dist/theme.css` sits under `html.hud` |
| `minWidth` | 360: below it the host draws its own pages and chrome; from 360 up to 1023 px HUD draws its phone layout (below) |
| `tone` | `from-look`: the look sets light or dark, and every HUD look is dark |
| `look` | `arc`, the default preset |

## What HUD draws

`src/entry.ts` registers three slots, one page and one route, the same that `theme.json` declares.

| Where | What it is |
|---|---|
| `frame@1` | The top bar (with MIC LIVE while the microphone is open), the side rail and the backdrop around every page. Every page HUD doesn't own is the host's, drawn inside the frame and recoloured by the look. Below 1024 px, the phone's frame: its top bar with MENU, no rail, and the menu (below). |
| `lookEditor@1` | The LOOK drawer, at `/looks`: the five presets and your saved looks, the eight knobs, Save as new look, Reset and Delete, a live preview, and Share to export or import a look. |
| `styleSheet@1` | The style sheet, at `/looks/style`: the active look's knobs with the variable each drives, HUD's colours and Studio's tokens with their values, the live contrast, the type and the components. |
| `/chat` | The core screen (`mode: own`): Auto in the voice core with his state in words and Pause Auto beside it, the transcript with his replies and the host's cards, its top edge fading so a row scrolled under it is never cut in half (or, before anything is said, a short line and three starters that fill the message box), NEW CHAT beside the title, the host's voice button in the design's waveform over the message box (below, Voice), the message box, and the Agents, Mission (this conversation's first), Deliverables, Today, Needs you and Next up panels as the window allows. A `/chat` link with `repo`, `runtime` or `mode` keeps the host's chat page. Below 1024 px, the phone's core screen (below). |
| `/x/conversations` | The Conversations route: every conversation as HUD panels, searchable by title, with NEW CHAT. The rail lists it after Chat, with a RECENT list of the latest five below the nav. |

HUD fills no `notFound@1` or `asleep@1`. Its menu entries (`nav`) are Conversations (`/x/conversations`), Look
(`/looks`) and Style sheet (`/looks/style`). `uses` names the SDK areas the code imports: `assets`, `cards`, `chat`, `context`, `deliverables`, `events`, `looks`, `navigation`, `pages-agents`, `pages-assignments`, `pages-command-center`, `storage`, `theme` and `voice`. The message box stays the way to type (Enter sends, Shift + Enter makes a new line,
Esc stops); voice is beside it, never instead of it.

## Voice

HUD talks to Auto through the SDK's voice area (SDK 1.2.0) and never opens the microphone itself: no code of HUD's
captures or speaks audio, which the Marketplace review refuses, and the host's voice button opens the microphone, on a
press.

| Part | Desktop | Phone |
|---|---|---|
| The voice button (`VoiceButton`: core draws the press, the microphone prompt, the "AI voice assistant" caption, the stop control, Live's mute and device, a failure's Try again, and the spoken AI notice once a session) | In the middle of the design's waveform over the message box (`src/voice/voice-deck.tsx`): `press: 'hold'`, `mode: 'auto'` (Auto Live where it can start, else quick-ask), `hotkey: 'Space'` (never while typing, core's rule), `size: 'md'` at the 44 px tap size; the design's hint under it, HOLD SPACE TO TALK · OR TYPE · "AUTO, STOP" TO CANCEL, gives way to the host's caption and stop control while the session runs | The design's 84 px HOLD TO TALK circle between TYPE and STOP (`src/chat/phone/voice-slot.tsx`): `press: 'hold'`, `mode: 'auto'`, `hotkey: null`, `size: 'lg'`; HOLD TO TALK under it at rest |
| MIC LIVE (`src/voice/mic-live.tsx`), whenever `useVoice().micOpen` (MIC MUTED on a muted call) | After the connection status in the top bar, the design's outlined chip | In the connection status's place in the phone's bar |
| The waveform (`src/voice/waveform.tsx`, `wave.ts`) | 72 bars, half on each side of the button | 44 bars over the control row |
| What was said aloud (the host's `voice-live-user` and `voice-live-assistant` messages at the end of the conversation) | The transcript's newest YOU and AUTO rows | The last exchange, at the foot of its room over the waveform while the session runs |
| Auto's state while the session listens, thinks or speaks (`src/voice/session.ts` `VOICE_STATE_WORDS`) | The state chip says LISTENING, THINKING or SPEAKING | The top line (AUTO · LISTENING and the rest) and the state chip |

- **Styling.** Through the button's root data attributes (`data-voice-state`, `data-voice-mic` and the rest), its press's
  `data-voice-button="press"` and the `--voice-button-*` custom properties: a circle in the look's accent, its 12%
  fill at rest and the accent while it is held, the readable accent for the glyph and the focus ring. No rule hides or
  covers the caption or the stop control, and no selector names the protected surface (`voice-control`). The host's
  control opens out under the press in a strip that keeps its height, so the press never moves under a held pointer.
- **No lock.** The button sits outside the message box's AI label fence; nothing disables it.
- **The waveform's motion.** An animation-frame loop reads `readVoiceLevels()` (never in a render), the member's level
  while the microphone is open and Auto's while he speaks, the newest at the bars beside the button. It runs only
  while a session runs and motion is allowed: under the reduced-motion setting and while the look's `motion` is off
  there is no loop and every bar stands at rest; the loop is cancelled when the waveform unmounts.
- **STOP** on the phone cancels the turn, as the design's does: it stops a reply and ends a voice session.
- **Listening.** Auto's state in a word never says Listening for the chat's own listening state (an approval card
  waiting is "Waiting for you"): it would read as an open microphone. While the voice session listens (the microphone
  open), thinks or speaks, the chip and the phone's line say its phase instead, then the chat's state again; a running
  Mission's line gives way to it while you talk to Auto.
- **What was said aloud.** While a session runs on the conversation, core's chat puts what was heard and Auto's reply
  as far as he has spoken it at the end of its messages, and the saved turn takes their place once it lands. HUD draws
  them as any message, in its transcript's type, Auto's row with the AI-generated mark; it never draws `useVoice().heard`
  or `.reply` itself, which would show the words twice.

## In a phone's browser

`minWidth` is 360, so HUD draws a phone's width. Below 1024 px (`DESKTOP_MIN_WIDTH` in `src/lib/phone-layout.ts`) it
draws the Command design's phone (390 by 844) instead of its desktop layout. 1024 is the width core's own shell takes
for a desktop (`hooks/use-mobile.ts`), the width HUD's desktop frame is built and shot from, and the width core's host
draws an installed theme's frame from; the width is asked as core's `useIsBelowWidth` asks it (`(max-width: 1023px)`,
through `matchMedia`, known on the first render), and a browser that can't say is a wide one. From 1024 px up nothing
changes, and a window crossing the width keeps the page it shows.

- **The frame** (`src/frame/phone-top-bar.tsx`, `src/frame/nav-drawer.tsx`). A 56 px bar: MENU, the mark and
  AUTOMATOS //, and the backend's connection as a glyph and a word, whose place MIC LIVE takes while the microphone is
  open, as the design's phone has it. No rail: every page takes the window's whole width, padded 16 px, on the design phone's 32 px
  grid and 320 by 320 glow. MENU (`aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`) opens the menu, a modal
  dialog from the left edge over the drawer glass: New chat, search and LOOK; the rail's pages in their groups with
  Conversations after Chat, RECENT, Docs and Settings; then the host's header utilities, which stay mounted while the
  menu is shut, so the frame always renders them. Open, it takes the focus (Close first), Tab and Shift + Tab wrap
  inside it, and Esc, Close or a tap on the glass shut it with the focus back on MENU; following a link or New chat
  shuts it for the page it opens. The bar, the page and the host's floating Auto widget are `inert` while it is open.
  A key pressed in a host menu drawn elsewhere in the page stays that menu's.
- **The core screen** (`src/chat/phone/`). From the top: the line naming who is at work, the running Mission's agent,
  `WORKING`, and the time since it started (the SDK's activity feed, the same ask as the desktop's MISSION panel; the
  feed says nothing finer of what the agent does), or with none `AUTO` and his state in a word, with no time (while
  a voice session listens, thinks or speaks, `AUTO` and its phase, whatever runs); the
  290 px core with Auto, the state chip and Pause Auto beside it, as on the desktop; the last exchange, your newest
  words in quotes and every reply after them, Auto's with all it carries on the desktop (tool lines, Deliverables, the
  host's cards, receipts, the snag box, the AI-generated mark), which is the exchange being spoken while a voice session
  runs, sitting then at the foot of its room over the waveform rather than centred under the core, then what follows
  the conversation; and a dock pinned to the foot: the host's credits banner, the message box (the
  desktop's, with the AI label fence) once TYPE opens it, the waveform, and the control row: TYPE, the host's voice
  button as HOLD TO TALK (`VoiceSlot`), and STOP. TYPE opens and shuts the box, putting the focus in it and keeping its
  words when shut; an empty chat's starter opens it with its words. STOP stops a reply as the box's Stop does, ends a
  voice session, is disabled while nothing runs, and hands the focus to TYPE. The conversation's title is the
  screen's h1 for a screen reader and the host's focus, not drawn, as the design's phone has none; New chat is in the
  menu. The screen scrolls as one when the window is too short for it.
- **Conversations, the LOOK drawer and the style sheet** draw in the phone's frame as they do on the desktop, each
  wrapping to the width; Conversations' heading shrinks to fit a 360 px window.

Core's host draws an installed theme's frame and pages from 1024 px up for now, whatever `minWidth` names
(`frontend/lib/theme-host/installed-entry.ts`, `INSTALLED_FRAME_MIN_WIDTH_PX`), and its own pages below that; the kit's
harness draws HUD from its `minWidth`, so `automatos-theme dev` in a narrow window shows the phone layout. Kit CI's
harness shots draw HUD at 1440 and 1024 px, just below `minWidth` (the host's pages) and, as its `minWidth` fits a
phone, at a phone's 390 × 844 in a window that size: every view of each preset (`<preset>/390/`) and `/chat` on the
made-up transcript (`<preset>/390-transcript/`), each with an axe scan; and, as `uses` names `voice`, `/chat` on the
transcript at 1440 px in each phase of the harness's made-up voice session (`<preset>/1440-voice-listening/`,
`-thinking/`, `-speaking/` and `-error/`), with the host's caption and stop control, the waveform held still, and the
session's words at the end of the conversation, as core's chat adds them. HUD's own tests hold the layout too
(`test/frame/phone-frame.test.tsx`, `test/chat/chat-phone.test.tsx`, `test/voice/`).

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
drop under AA (past that point the LOOK drawer's glow slider says, in plain words, "Held at 20 here so text stays easy
to read."); `design/contrast.json` declares the pairs `automatos-theme check design` measures on every preset (it
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
