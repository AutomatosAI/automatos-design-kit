# Changelog

HUD's versions, newest first. A version once released never changes: a change ships as a new version.

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
