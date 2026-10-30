# Changelog

Arcade's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.0.0

Arcade becomes one of Automatos's own themes, `automatos/arcade` (it was `pixelcade/arcade`), released from an
`arcade-v<version>` tag like Play and HUD, and Automatos Go draws it in a layout of its own.

- Auto's replies take the size of the line they sit in (21 px in the story, 25 px in the dialogue box, 17 px on the
  handheld). The host's Markdown set its own 12.5 px, which read too small in the design's type.
- A quest marker on a tile at the map's edge, or on a map narrower than a few markers, stops half a marker in from
  the side instead of hanging outside the map.
- A long Mission goal is cut to four lines in the quest window; the whole goal stays in its text and shows on hover.
- The message box's fence follows core #1365: the host's `AiLabelFence` draws its children alone and disables
  nothing.

## 0.1.0

- The first version, built from the Arcade design handoff on the design kit's minimal template: the status bar and
  pause menu, the handheld below 1024 px, the chat (story, dialogue and party), the Inventory, the Quests map, Options,
  the Sprite gallery, the 404 and Auto in the host's empty state.
- Five palettes (Overworld, Dungeon, Neon Cabinet, Night City, Handheld) over five knobs, every colour pair at AA.
- Auto as an original twelve-state pixel sprite, with a pause control and nothing moving under reduced motion.
- A phone skin from the member's look, with both pixel faces and Auto's twelve stills.
