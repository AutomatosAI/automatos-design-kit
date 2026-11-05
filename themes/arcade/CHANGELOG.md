# Changelog

Arcade's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.1.0

The modes Studio's chat offers, in Arcade's own chat, and the seam for talking to one agent. Arcade's `engines.sdk`
stays as it was.

- Code, Plan and Mission under the message box, on the host strip between the box and its keys, drawn in Studio's
  tokens as the strip is: round outlined pills, 32 px on a desktop, 44 px targets on the handheld. Each is a link to
  the host's own page for it, so Tab reaches it after Send and Enter follows it: Code opens the host's chat with the
  code canvas (`/chat?repo=.`), Plan its chat in plan mode (`/chat?mode=plan`), and Mission opens Missions
  (`/assignments?tab=missions`). The group is named Modes, and each link's title says where it goes. `repo` and `mode`
  were already on `/chat`'s `keepCorePage`, so the host draws its own chat page for the first two.
- The agent picker, built ahead of Theme SDK 1.5.0 and drawn only on a host whose chat can choose an agent (its
  controller's `agentId` and `chooseAgent`, read in `src/chat/agent-choice.ts` alone): a pill first in the row naming
  the agent the box talks to, opening a list of Auto and the active agents that can run; a choice names the box
  "Message <agent>" and gives it the focus, one the host refuses changes nothing, and Esc shuts the list. A session
  agent (its runtime the CLI) is a link to its session, never a choice. On SDK 1.4.0 there is no picker and the box is
  "Message Auto", as before. The party's rows stay as they were.

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
