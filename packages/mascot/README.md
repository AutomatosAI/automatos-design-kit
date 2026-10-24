# @automatos/mascot

Auto, the mascot, as a theme bundles him (PRD-261 §7): his state machine, the clip player's queue, the media chooser
and his captions, the light ring's tones, the chat's status and newest reply as his events, and the Pause Auto
control (F10, WCAG 2.2.2), written once for every theme with a mascot.

It starts from Play's copy (`themes/play/src/lib/mascot/` and `src/components/mascot/mascot-pause-button.tsx`, ported
from core). The files came out of Play as they were, but for their imports and two changes that keep the package
free of any one theme's code:

- `ringColour(state, vars)` reads the ring's colour from the look's custom properties, which the theme makes (Play
  passes its `lookToCssVars(look)`), where it read Play's look engine itself.
- `MascotPauseButton` brings no stylesheet: the theme gives the button's class and its icon's (`className`,
  `iconClassName`; Play's are `auto-mascot.module.css`'s `.pause` and `.pauseIcon`).

`tools.ts` (which state a tool call shows) came too, since the reducer reads it.

| Module | What it does |
|---|---|
| `@automatos/mascot/types` | his 12 states, the one-shots, the priority ranks, and the stream and page events he reads |
| `@automatos/mascot/reducer` | the state machine: a pure `(state, event) => state` |
| `@automatos/mascot/player` | which clip is on screen and which waits for the 5 s clip boundary; pure |
| `@automatos/mascot/media` | `.mp4` or `.webm` by browser, each state's clip and still under the package's `assets/mascot/` (through the SDK's `assetUrl`), the page glow, the captions |
| `@automatos/mascot/ring` | the ring's tone in each state, and its colour from a look's custom properties |
| `@automatos/mascot/events` | the chat's status and newest reply as his events |
| `@automatos/mascot/tools` | which state a tool call shows him in (the tool names live here only) |
| `@automatos/mascot/mascot-pause-button` | the Pause Auto toggle: one name, `aria-pressed`, natively disabled until the host knows |

A theme keeps what is its own: where the files sit and how they look (Play's `components/mascot/auto-mascot.tsx` and
its stylesheet, `hooks/use-mascot-player.ts`), the pause and the first-open hello in the SDK's storage area
(`lib/mascot/pause.ts`, `lib/mascot/session.ts`), and the chat's data parts as events (`lib/mascot/data-events.ts`).

## Bundling it

A theme names the package, at this version, under `dependencies` in its `package.json`
(`"@automatos/mascot": "0.1.0"`) and imports its modules by name. The kit's vite-preset then bundles this folder's
`src/` with the theme's own (and nothing else of it), and `automatos-theme pack` writes it into the package as
`source/packages/mascot/src/`, where the Marketplace review rebuilds it. The review has no `package.json` of this
package, so it sets no `sideEffects` and nothing else the build would read. `@automatos/theme-sdk` and React come from
the host, as for the theme.

## Tests

`npm test` here, on the kit's harness preset. The reducer, player, media, ring, events and tools tests moved here from
Play's with their modules; the test-move ledger (`themes/play/test/moved-from-core/mascot.json`) names them. Where
they read Play's files (its looks and stylesheets, its data-events module, its test helpers) they import them from
`themes/play` by path. `test/mascot-pause-button.test.tsx` holds the Pause control on its own; Play's
`test/mascot/auto-mascot-pause.test.tsx` holds it under Auto.
