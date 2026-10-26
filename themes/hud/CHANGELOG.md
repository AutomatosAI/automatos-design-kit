# Changelog

HUD's versions, newest first. A version once released never changes: a change ships as a new version.

## 1.1.1

Polish for the product images:

- The LOOK drawer's note under the glow slider, once the look's glow is past what its background and accent keep
  readable, says so in plain words: "Held at 20 here so text stays easy to read." (it said "Painted at 20 here: any
  brighter and the text stops reading at AA"). The slider's value for a screen reader reads "30, held at 29".
- The core screen's transcript fades out over 24 px at its top edge, so a row or a card scrolled up under it fades
  instead of being cut in half where the column is short (a voice session at 1440 by 900); 24 px of padding keeps the
  first row clear of the fade at the top of the scroll. The host's voice caption and stop control sit under it, never
  in it.
- On the phone, while a voice session runs, the last exchange sits at the foot of its room, just over the waveform,
  instead of centred between the core and the dock, so the words heard read as said into it rather than adrift in a
  gap. At rest it is centred as before.

## 1.1.0

HUD talks, on the SDK's voice area (SDK 1.2.0: `engines.sdk` is `^1.2.0` and `uses` names `voice`), and types as before:

- The host's voice button (the SDK's `VoiceButton`: core draws the press, the microphone prompt, the "AI voice
  assistant" caption and the stop control; HUD places it and styles it through its data attributes and
  `--voice-button-*` properties). On the desktop it stands in the middle of the Command design's 72-bar waveform over
  the message box: hold to talk, Auto Live where it can start and quick-ask otherwise, Space as its key anywhere but a
  field you type in. The design's hint under it, HOLD SPACE TO TALK · OR TYPE · "AUTO, STOP" TO CANCEL, gives way to
  the host's caption and stop control while the session runs, in a strip that keeps its height, so the press never
  moves under a held pointer. On the phone it is the design's 84 px HOLD TO TALK circle between TYPE and STOP, with no
  key. Nothing locks it: it sits outside the message box's AI label fence.
- MIC LIVE in the top bar whenever the microphone is open (MIC MUTED on a muted Live call), its words in a status a
  screen reader hears; on the phone it takes the connection status's place while it shows.
- The waveform follows the voice's levels, the member's while the microphone is open and Auto's while he speaks, in an
  animation-frame loop, the newest level beside the button: 72 bars on the desktop, 44 over the phone's control row. It
  stands still while no session runs, under the reduced-motion setting and while the look's motion is off.
- What was heard and Auto's spoken reply show in the conversation, where the host puts them while the session runs:
  the transcript's newest YOU and AUTO rows on the desktop, the last exchange on the phone, Auto's with the
  AI-generated mark, until the saved turn takes their place. HUD draws no words of its own beside them, so they show
  once.
- While a voice session listens, thinks or speaks, the state chip and the phone's top line say so: "Listening",
  "Thinking", "Speaking", then the chat's state again. Listening is said only then, while the microphone is open; an
  approval card waiting is still "Waiting for you".
- The phone's STOP ends a voice session too, as it stops a reply.
- The phone's mission clock reads days and hours from a day on (`12d 04h`, not `288:27:26`); under a day it is as it
  was (`02:14`, `1:02:14`).

## 1.0.1

Fixes and the parts 1.0.0 left out, so HUD is a finished theme:

- Every box is measured with its border and padding, whatever the host's own reset, so the rail, the core and the
  panels keep their sizes; the core screen leaves 40 px under the message box's keys.
- Pause Auto on the core screen stands beside the state chip, over the ring's foot, instead of under Auto among the
  rings, and every Pause Auto control stands on the page's ground, so no ring shows through it.
- The host's first-run nudge heads the core screen's column, above the title, instead of landing on the message box.
- A new chat is finished: its one line is set as the message box's key hint (mono capitals), the transcript's list
  appears once something is said, and three starters put their words in the message box.
- Conversations: HUD's own page at `/x/conversations` (its route `conversations`, and a nav entry): every
  conversation in Today, This week and Earlier panels, a title search and New chat. The rail lists it after Chat.
- New chat beside the core screen's title, and RECENT in the rail: the latest conversations, the one on screen
  marked.
- The core screen's right column is full: TODAY (working now, completed today, needs you, in queue, as big numbers),
  NEEDS YOU (the Needs-you number and its first rows, each linked where it is answered) and NEXT UP (the week's next
  runs) over DELIVERABLES, in the places of the design's spend, latency and machine panels, which have no source.
- MISSION shows this conversation's Mission first, once the chat plans one, and the newest running Mission
  otherwise.
- A panel header's value is in capitals, as its label is (DELIVERABLES' ALL).
- Search in the top bar is named by the words it shows, with its shortcut in `aria-keyshortcuts`, so its name
  matches its label (axe's label-content-name-mismatch).
- The style sheet shows each value rounded to three decimal places, and wraps a value only after a comma, never
  inside a number.
- The LOOK drawer's looks wrap in a grid instead of a row cut at the drawer's edge, and its Grid and Glow sliders
  draw their own track (the look's track colour, visible in WebKit too) and a square accent thumb.
- Send with nothing to send is an outline in the line colour instead of a faded accent block.
- The rail's Auto dock steps aside while the host draws its own floating Auto widget, so Auto shows once.
- HUD draws a phone's width: `minWidth` is 360 (it was 1024), and below 1024 px, the width core's own shell takes for
  a desktop, HUD draws the Command design's phone instead of its desktop layout, which is unchanged from 1024 px up.
- The phone's frame: a top bar with MENU, the mark and AUTOMATOS //, and the backend's connection in words; no rail, so
  every page takes the window's whole width. MENU opens a modal menu with New chat, search, LOOK, the rail's pages,
  RECENT, Docs and Settings, and the host's header utilities; it keeps the focus inside, and Esc, Close or a tap
  beside it shuts it with the focus back on MENU.
- The phone's core screen at `/chat`: a line naming who is at work (the running Mission's agent and its time, or Auto
  and his state), the 290 px core with the state chip and Pause Auto beside it, the last exchange (your words in
  quotes, Auto's reply with its cards), TYPE, which opens the message box, and STOP, disabled while nothing runs. The
  row's middle is kept for the voice button, which arrives with the SDK's voice area; HUD draws no microphone.
- Conversations draws in a phone's browser too, instead of sending it to the chat below 1024 px, its heading sized
  to fit a 360 px window.

## 1.0.0

The first version of HUD (`automatos/hud`), from the Command design:

- The frame around every page: the AUTOMATOS // HUD top bar with the clock, the status, search, LOOK and the
  host's utilities; a side rail with every core page; the grid, glow and scan-line backdrop.
- Looks: the design's look schema and its five presets (ARC, the default, FORGE, GHOST, NOVA and SIGNAL), painted
  from `boot/prepaint.json` as HUD's variables and Studio's tokens, every look dark.
- Rajdhani and Chakra Petch as display faces, with their licences.
- Auto at the foot of the rail, on a ring in the look's colours, with the Pause Auto control.
- The core screen at `/chat`: Auto in the voice core, driven by the chat; the transcript with the host's cards; the
  message box; and the Agents, Mission and Deliverables panels. The rail's dock steps aside there.
- The LOOK drawer at `/looks`: the presets and saved looks, the eight knobs, save, reset, delete, a live preview,
  and export and import.
- The style sheet at `/looks/style`: the active look's knobs, HUD's colours, Studio's tokens, the live contrast, the
  type and the components.
- A `mobile` block that gives a phone HUD's ARC colours.
