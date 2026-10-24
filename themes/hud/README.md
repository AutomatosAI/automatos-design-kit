# HUD

HUD is an installable Automatos theme (`automatos/hud`) that draws Automatos as a command deck: a 56 px top bar
with the AUTOMATOS // HUD mark, the clock and the host's own utilities; a side rail with every core page; square,
bracketed panels with mono labels; one accent; and a grid, a glow and scan lines behind everything. The same
Automatos and the same Auto as Studio and Play, in a different shell. Its design is the Command design among the
kit's design references (`references/`).

Like every theme built in this kit, HUD installs and runs the same way on the local edition and the hosted edition.

## What HUD draws

- The frame around every page (`frame@1`): the top bar, the side rail and the backdrop. Every page HUD doesn't own
  is the host's, drawn inside the frame and recoloured by the look.
- The core screen at `/chat`, a page HUD owns: Auto in the voice core with the state in words under him, the
  transcript with his replies and the host's own cards (approvals, Deliverables, Missions, tickets), the message box
  (Enter sends, Shift + Enter makes a new line, Esc stops), and the Agents, Mission and Deliverables panels beside
  it as the window allows. It loads in its own chunk. A `/chat` link with `repo`, `runtime` or `mode` keeps the
  host's own chat page. There is no microphone: the SDK gives a theme no voice.
- The LOOK drawer at `/looks` (`lookEditor@1`): the five presets and your saved looks, the eight knobs, Save as new
  look, Reset and Delete, a live preview, and Share, to export a look as a file or import one.
- The style sheet at `/looks/style` (`styleSheet@1`): what the active look paints, its knobs with the variable each
  drives, HUD's colours and Studio's tokens with their values, the live contrast, the type and the components.

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
screen he is in the voice core, his state the chat's, and the rail's dock steps aside, so he shows once. His files are
(c) Automatos AI, not covered by the code licence (`NOTICE`).

## On a phone

The phone has its own HUD layout. `theme.json`'s `mobile` block gives a phone that draws a theme from data alone
HUD's ARC colours (Studio's tokens, the same in its light and dark schemes, since HUD is never light), and no
mascot.

## Building

In the kit, from this folder: `npm run build` (the kit's Vite preset), `npm run lint`, `npm run typecheck`,
`npm test` (vitest on the kit's harness) and `npm run pack` (`automatos-theme check design`, then
`automatos-theme pack` into `out/`). `automatos-theme check` checks the built package as the server would,
`automatos-theme shots` photographs every slot and page in the kit's browser harness under each preset (kit CI's
harness job runs it on HUD), and `automatos-theme dev` serves HUD in that harness on 127.0.0.1.
