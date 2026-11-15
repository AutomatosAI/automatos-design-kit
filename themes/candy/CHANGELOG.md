# Changelog

Candy's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.1.0

Talk to one agent, and Studio's modes, in Candy's own chat. Candy now needs SDK 1.5.0 (`engines.sdk` moves from
`^1.2.0` to `^1.5.0`): the chat controller's `agentId`, `chooseAgent`, `planMode` and `setPlanMode`, and a roster
agent's `configuration`.

- Code, Plan and Mission under the message box, in the pill's width, as Candy's round pills on the chip colour, 36 px
  on a desktop and 44 px targets on the phone, in a group named Modes. Code is a link to the host's chat with the code
  canvas (`/chat?repo=.`) and Mission one to Missions (`/assignments?tab=missions`), each with a title saying where it
  goes. Plan is a toggle (`aria-pressed`) on the host's own Plan switch, the one Studio's Plan button and a
  `/chat?mode=plan` link set, filled with the accent while on; the next message goes with Plan.
- The agent picker, first in that row: a pill naming the agent the box talks to ("Talking to Auto" to a screen
  reader), opening a list of Auto and the active agents that can run. A choice makes the next message go to that
  agent, names the box "Message <agent>" and gives it the focus; one the host refuses changes nothing; Esc shuts the
  list. A session agent (its runtime the CLI) is a link to its session (`/chat?agent=<id>`), never a choice.
- `/chat`'s `keepCorePage` adds `agent`, as core keeps its own chat page for an agent link.

## 1.0.1

The look works on the hosted app as it does in the kit's harness.

- Your look changes the look again. Core's look runtime knows only the knobs the first-paint table paints, and
  Roundness was a number of px the table couldn't paint (the frame set it), so the host refused every look,
  the presets among them. Roundness is now a choice of the whole numbers 16 to 40, each painting its corners, and the
  editor still draws it as a slider.
- The cards' gradients, the band behind each page and Vivid's aura draw again. Core's first paint in the browser
  drops a value that calls a gradient, so the table now paints their colours, stops and places, and the stylesheet
  composes the gradients from them.
- The look data's tests hold every first-paint value to core's browser rules, and every knob to the table.

## 1.0.0

- The first version, one of Automatos's own themes from the start (`automatos/candy`), built from the Candy design
  handoff on the design kit's minimal template: the sidebar and band, the phone layout with its floating tab bar below
  1024 px, Today (`/x/today`), the chat, the Deliverables, Your team (`/x/agents`), Your look, the style sheet, the
  404 and the asleep screen.
- Three palettes (Blush, Lilac, Night bloom) over six knobs (palette, card colours, gradient, roundness, glow, motion),
  every colour pair at AA. Two card start colours are darkened from the handoff's to reach AA under white text.
- Auto drawn in code from the design's glossy concept, twelve states, floating and blinking, with Pause motion and
  nothing moving under reduced motion; his phone stills are rasterised from the same geometry.
- A phone skin from the member's look, with Outfit and Nunito and Auto's twelve stills, for Automatos Go versions
  without the Candy layout.
