# Changelog

Arcade's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.1.0

Talk to one agent, and Studio's modes, in Arcade's own chat. Arcade now needs SDK 1.5.0 (`engines.sdk` moves from
`^1.2.0` to `^1.5.0`): the chat controller's `agentId`, `chooseAgent`, `planMode` and `setPlanMode`, and a roster
agent's `configuration`.

- Code, Plan and Mission under the message box, on the host strip between the box and its keys, drawn in Studio's tokens as the strip is: round outlined pills, 32 px on a desktop and 44 px targets on the handheld, in a group named Modes. Code is a link to the host's
  chat with the code canvas (`/chat?repo=.`) and Mission one to Missions (`/assignments?tab=missions`), each with a
  title saying where it goes. Plan is a toggle (`aria-pressed`) on the host's own Plan switch, the one Studio's Plan
  button and a `/chat?mode=plan` link set, filled with the primary colour while on; the next message goes with Plan.
- The agent picker, first in that row: a pill naming the agent the box talks to ("Talking to Auto" to a screen
  reader), opening a list of Auto and the active agents that can run. A choice makes the next message go to that
  agent, names the box "Message <agent>" and gives it the focus; one the host refuses changes nothing; Esc shuts the
  list. A session agent (its runtime the CLI) is a link to its session (`/chat?agent=<id>`), never a choice.
- `/chat`'s `keepCorePage` adds `agent`, as core keeps its own chat page for an agent link.

## 1.0.0

Arcade becomes one of Automatos's own themes, `automatos/arcade` (it was `pixelcade/arcade`), released from an
`arcade-v<version>` tag like Play and HUD, and Automatos Go draws it in a layout of its own.

- Auto's replies take the size of the line they sit in (21 px in the story, 25 px in the dialogue box, 17 px on the
  handheld). The host's Markdown set its own 12.5 px, which read too small in the design's type.
- A quest marker on a tile at the map's edge, or on a map narrower than a few markers, stops half a marker in from
  the side instead of hanging outside the map.
- A long Mission goal is cut to four lines in the quest window; the whole goal stays in its text and shows on hover.
- On the handheld (a phone's browser), the D-pad's words fit their 64 px targets (Inventory overflowed at 13 px), the
  story keeps room for a few lines under the dialogue box, whose typed reply now scrolls within 14% of the screen, and
  the message box's keyboard hint is not drawn below 600 px (the box still names it for a screen reader).
- The message box's fence follows core #1365: the host's `AiLabelFence` draws its children alone and disables
  nothing.

## 0.1.0

- The first version, built from the Arcade design handoff on the design kit's minimal template: the status bar and
  pause menu, the handheld below 1024 px, the chat (story, dialogue and party), the Inventory, the Quests map, Options,
  the Sprite gallery, the 404 and Auto in the host's empty state.
- Five palettes (Overworld, Dungeon, Neon Cabinet, Night City, Handheld) over five knobs, every colour pair at AA.
- Auto as an original twelve-state pixel sprite, with a pause control and nothing moving under reduced motion.
- A phone skin from the member's look, with both pixel faces and Auto's twelve stills.
