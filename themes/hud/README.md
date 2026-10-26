# HUD

HUD is an installable Automatos theme (`automatos/hud`) that draws Automatos as a command deck: a 56 px top bar
with the AUTOMATOS // HUD mark, the clock and the host's own utilities; a side rail with every core page; square,
bracketed panels with mono labels; one accent; and a grid, a glow and scan lines behind everything. The same
Automatos and the same Auto as Studio and Play, in a different shell. Its design is the Command design among the
kit's design references (`references/`).

Like every theme built in this kit, HUD installs and runs the same way on the local edition and the hosted edition.

## What HUD draws

- The frame around every page (`frame@1`): the top bar, the side rail (every core page, HUD's Conversations after
  Chat, and RECENT, the latest conversations) and the backdrop. Every page HUD doesn't own is the host's, drawn
  inside the frame and recoloured by the look. In a phone's browser it is the phone's frame (below).
- The core screen at `/chat`, a page HUD owns: the conversation's title with New chat beside it, Auto in the voice
  core with the state in words under him and Pause Auto beside it, the transcript with his replies and the host's own
  cards (approvals, Deliverables, Missions, tickets), the message box (Enter sends, Shift + Enter makes a new line,
  Esc stops), and the panels beside it as the window allows: Agents and Mission (this conversation's Mission first,
  else the newest running one) on the left; Today, Needs you, Next up and Deliverables on the right. A new chat says
  how to start, with three starters that fill the message box. Over the message box, the host's voice button in the
  design's waveform (below, Voice). It loads in its own chunk. A `/chat` link with `repo`, `runtime` or `mode` keeps the
  host's own chat page. In a phone's browser it is the phone's core screen (below).
- Conversations at `/x/conversations`, HUD's own route (`routes`, with a nav entry): every conversation in Today,
  This week and Earlier panels, a search on the title and New chat. It loads in its own chunk; where HUD doesn't
  draw (below 360 px, its minWidth) it sends the browser to the chat.
- The LOOK drawer at `/looks` (`lookEditor@1`): the five presets and your saved looks, the eight knobs, Save as new
  look, Reset and Delete, a live preview, and Share, to export a look as a file or import one.
- The style sheet at `/looks/style` (`styleSheet@1`): what the active look paints, its knobs with the variable each
  drives, HUD's colours and Studio's tokens with their values, the live contrast, the type and the components.

## Voice

HUD talks to Auto through the host's voice (the SDK's voice area, SDK 1.2.0), and never opens the microphone itself:
the host's voice button does, on a press. Typing stays: voice is beside the message box, never instead of it.

- **The voice button** is the SDK's `VoiceButton`: core draws the press, the microphone prompt, the "AI voice
  assistant" caption (a tiny caption, never a pill) and the stop control, with Live's mute and device, a failure's Try
  again, and the spoken AI notice once a session; HUD places it and styles it through its data attributes and
  `--voice-button-*` properties, and never hides or covers the caption or the stop control. Hold to talk, in Auto Live
  where it can start and quick-ask otherwise. On the desktop (`src/voice/voice-deck.tsx`) it stands in the middle of
  the Command design's waveform over the message box, with Space as its key anywhere but a field you type in, and the
  design's hint under it (HOLD SPACE TO TALK · OR TYPE · "AUTO, STOP" TO CANCEL), which gives way to the host's
  caption and stop control while the session runs. On the phone (`src/chat/phone/voice-slot.tsx`) it is the design's
  84 px HOLD TO TALK circle between TYPE and STOP, with no key. Nothing locks it, the message box's AI label fence
  included.
- **MIC LIVE** (`src/voice/mic-live.tsx`) shows in the top bar whenever the microphone is open, MIC MUTED on a muted
  call, its words in a status a screen reader hears; on the phone it takes the connection status's place.
- **The waveform** (`src/voice/waveform.tsx`, `src/voice/wave.ts`): the design's 72 bars on the desktop, half on each
  side of the button, and 44 over the phone's control row. An animation-frame loop reads the voice's levels
  (`readVoiceLevels`: the member's while the microphone is open, Auto's while he speaks), the newest beside the button;
  it runs only while a session runs and motion is allowed, so the bars stand still under the reduced-motion setting and
  while the look's motion is off.
- **What was said aloud** is the conversation's: while a session runs on it, the host puts what was heard and what
  Auto is saying at the end of its messages (`voice-live-user` and `voice-live-assistant`), so the transcript shows them
  as its newest YOU and AUTO rows, Auto's with the AI-generated mark, and on the phone they are the last exchange, until
  the saved turn takes their place. HUD draws no words of its own beside them, so they show once.

## Looks

One look applies to every page. A look picks an accent (ARC, FORGE, GHOST, NOVA, SIGNAL or GOLD), a background
(VOID, CARBON, NAVY or EMBER), a display face (RAJDHANI, CHAKRA or MONO), a grid (0 to 30) and a glow (0 to 40),
and turns the scan lines, Auto and motion on or off. The format is `looks/schema.json`, look schema v1
(`automatos-interface-look/v1`, interface `command`), the one the phone's HUD layout reads as well, and the five
presets in `looks/presets/` are the design's: ARC (the default), FORGE, GHOST, NOVA and SIGNAL. Both are the design's
files, byte for byte.

The host keeps the looks and paints the active one before HUD's code runs, from `boot/prepaint.json`: HUD's own
`--hud-*` variables and Studio's colour tokens, so the host's pages inside HUD's frame take the look's colours too.
The table is built from HUD's catalogue (`src/lib/looks/`), whose values are the design's (`looks.json`), and the
tests hold the committed file to it. Every look is dark. The text colours are fixed so they read at WCAG AA on every
background; the accent and the error colour have readable text forms; the glow stops where the text on it, or in a
panel over it, would drop under AA.

## Fonts

Rajdhani 700 and Chakra Petch 600, the latin subsets of their Fontsource packages, under the SIL Open Font License
1.1, ship in `assets/fonts/` with their licences (`assets/fonts/README.md` names each file's package and sha256).
Geist and Geist Mono are the host's.

## Auto

Auto, the Automatos mascot, through `@automatos/mascot`: his 12 states, his clips (`.webm`, and `.mp4` for Safari
and iOS) and stills in `assets/mascot/`, on a ring the page draws in the look's colours. He shows while the look's
Auto is on: at the foot of the rail, his state the backend's. He moves only where he can be paused (the Pause Auto
control), and stands still under the reduced-motion setting and while the look's motion is off. On the core
screen he is in the voice core, his state the chat's, with Pause Auto beside the state chip, and the rail's dock
steps aside, so he shows once; it steps aside too while the host draws its own floating Auto. In a phone's browser
there is no rail, so he shows on the core screen alone. His files are
(c) Automatos AI, not covered by the code licence (`NOTICE`).

## In a phone's browser

HUD draws from 360 px up (`minWidth`). Below 1024 px, the width core's own shell takes for a desktop, it draws the
Command design's phone (390 by 844) instead of its desktop layout. The width is asked as core asks it
(`src/lib/phone-layout.ts`), so HUD and the host agree on each side of it; from 1024 px up nothing changes.

- **The frame.** The phone's top bar: MENU, the mark and AUTOMATOS //, and the backend's connection as a glyph and a
  word, which MIC LIVE takes the place of while the microphone is open. There is no rail, so every page takes the window's whole width. MENU opens the menu, a modal panel from the
  left edge: New chat, search and LOOK; the rail's pages with Conversations after Chat, RECENT, Docs and Settings;
  and the host's header utilities. It takes the focus, keeps Tab inside it, and Esc, Close or a tap beside it shuts
  it, handing the focus back to MENU; everything behind it is inert while it is open, and following a link shuts it.
- **The core screen.** A line naming who is at work (the running Mission's agent with the time since it started, or
  Auto and his state in a word), the 290 px core with Auto, the state chip and Pause Auto beside it, the last
  exchange (your words in quotes, then Auto's reply with all it carries on the desktop: his tool lines, the host's
  cards, the receipts, the snag box; while a voice session runs, the exchange being spoken), the waveform and
  the control row: TYPE, the host's voice button as HOLD TO TALK, and STOP. TYPE opens the message box, the desktop's,
  over the waveform, and puts the focus in it; shut again, it keeps its words. STOP stops a reply, ends a voice
  session, and is disabled while nothing runs.

## In the phone app

The phone has its own HUD layout. `theme.json`'s `mobile` block gives a phone that draws a theme from data alone
HUD's ARC colours (Studio's tokens, the same in its light and dark schemes, since HUD is never light), and no
mascot.

## Building

In the kit, from this folder: `npm run build` (the kit's Vite preset), `npm run lint`, `npm run typecheck`,
`npm test` (vitest on the kit's harness) and `npm run pack` (`automatos-theme check design`, then
`automatos-theme pack` into `out/`). `automatos-theme check` checks the built package as the server would,
`automatos-theme shots` photographs every slot and page in the kit's browser harness under each preset (kit CI's
harness job runs it on HUD), and `automatos-theme dev` serves HUD in that harness on 127.0.0.1.
