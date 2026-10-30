# Arcade

Arcade (`automatos/arcade`, `themes/arcade`) draws Automatos as a 16-bit role-playing game: your agents are a party,
Auto is the guide in the dialogue box, your Deliverables fill an inventory, and your Missions are quests on a map.
It is the kit's third theme, built here with the kit from a Claude Design handoff (a README of rules, `looks.json`
and an HTML mock), starting from the minimal template ([`guides/from-design-to-theme.md`](../../guides/from-design-to-theme.md)).
[`themes/arcade/README.md`](../../themes/arcade/README.md) has how it is built. This page reads
`themes/arcade/theme.json` at version 1.0.0.

| Field | Value |
|---|---|
| `id`, `version` | `automatos/arcade`, `1.0.0` |
| `engines` | `{"automatos": "^1.1.0", "sdk": "^1.2.0"}`: SDK 1.2.0, the SDK with the voice area |
| `base` | `studio`: the host's Studio design wherever Arcade draws nothing of its own |
| `htmlClass` | `arcade`: every rule of `dist/theme.css` sits under `html.arcade` |
| `minWidth` | 360: below it the host draws its own pages and chrome; from 360 up to 1023 px Arcade draws its handheld console (below) |
| `tone` | `from-look`: the look sets light or dark |
| `look` | `overworld`, the default preset |

## What Arcade draws

`src/entry.ts` registers the five slots, two pages and one route that `theme.json` declares.

| Where | What it is |
|---|---|
| `frame@1` | At 1024 px and up: a status bar (Auto's mark and the wordmark, today's counters as XP, `!` and QUEST, a pause control, search and the host's header utilities) over a pause menu (THEME, HOST PAGES, SYSTEM, a ▶ cursor and arrow keys). Below 1024 px: a handheld console, the page in a screen, a D-pad of four named targets (Quests, Chat, Inventory, Menu; Menu holds the host's utilities and every page), and the host's voice button in a round surround. |
| `/chat` (`mode: own`) | The story window (YOU and AUTO lines, ★ lines for what a turn did, ITEM RECEIVED windows for Deliverables, and the host's approval cards under "! A CHOICE AWAITS"), the dialogue window (Auto's portrait and state word, his newest reply typing out at the look's text speed, and the host strip with the message box and the host's voice button), and the party window (the roster, each agent with a state word). |
| `/deliverables` (`mode: own`) | The Inventory: a grid of item slots with tabs (All, Reports, Documents, Images, Posts where Socials is offered), an info window, links to the host's other Deliverables sections; `?deliverable=<id>` opens that item's own window. |
| `/x/quests` | The workspace's Missions as markers on an overworld map, one region per state, each opening a quest window with the Mission's tasks as a checklist and a link to the host's Mission page. |
| `lookEditor@1` (`/looks`) | Options: the five knobs as rows, Save look and Reset, a live preview, and save slots with export and import. |
| `styleSheet@1` (`/looks/style`) | The Sprite gallery: Auto's twelve states moving and still, the design's colour pairs measured on the page, and the two faces. |
| `notFound@1`, `empty-state.mascot@1` | The 404 with Auto lost; Auto asleep in the host's shared empty state. |

Every other page (the Command Center, Assignments, Agents, Settings and the rest) is the host's own, inside the
frame, recoloured by the palette's Studio tokens. `nav` lists Quests (`/x/quests`), Options (`/looks`) and Sprite
gallery (`/looks/style`). `uses` names the SDK areas the code imports: `cards`, `chat`, `context`, `deliverables`,
`events`, `looks`, `navigation`, `pages-agents`, `pages-assignments`, `pages-command-center`, `storage`, `theme` and
`voice`.

The host's approval and Mission cards, the withdraw offer and ticket cards, the voice button, the header utilities,
the first-run nudge and the credits banner are placed and never restyled: each sits in a strip in Studio's own type.
The message box is Arcade's own (the SDK has no host message box), drawn in Studio's tokens inside the host's
`AiLabelFence`; the voice button sits beside it, outside the fence. The "Auto is an AI" label is the host's, drawn
at the foot of the window; Arcade keeps that corner clear and draws its scanlines inside its own windows only, never
over the page.

## Voice

Arcade talks to Auto through the SDK's voice area (SDK 1.2.0) and never opens the microphone itself. The host's
`VoiceButton` sits in the handheld's round surround (`src/frame/controls.tsx`: `size="lg"`, `hotkey={null}`) and
beside the desktop message box (`src/chat/chat-view.tsx`, hidden on the phone layout since the handheld's own button
covers it there).

## In a phone's browser

`minWidth` is 360, so Arcade draws a phone's width. Below 1024 px it draws the handheld console instead of the
desktop frame: the page in a screen, the D-pad, and the voice button in its round surround. Kit CI's `harness` job
shoots Arcade with every other theme under `themes/` (`scripts/shots/other-themes.mjs`), not by name as it shoots
Play and HUD.

## Looks

Five knobs (`looks/schema.json`, look format `arcade-look/v1`):

| Knob | Label | Kind | Values | Default |
|---|---|---|---|---|
| `palette` | Palette | choice | `overworld`, `dungeon`, `neon`, `nightcity`, `handheld` | `overworld` |
| `scanlines` | Scanlines | choice | `off`, `soft`, `strong` | `soft` |
| `pixelScale` | Pixel scale | choice | `2`, `3` | `3` |
| `windowStyle` | Window | choice | `classic`, `thin` | `classic` |
| `textSpeed` | Text speed | choice | `instant`, `normal`, `slow` (instant under reduced motion or while the animation is paused) | `normal` |

One preset per palette: Overworld (the default), Dungeon, Neon Cabinet, Night City and Handheld. Every literal
colour is in `src/looks/catalogue.ts`; `test/look-data.test.ts` writes `looks/`, `boot/prepaint.json` and
`design/contrast.json` from it (`ARCADE_WRITE=1 npx vitest run test/look-data.test.ts`) and holds them equal to the
catalogue, not to `scripts/compile-looks.mjs`, which is Play's alone. Its `pack` script runs
`automatos-theme check design .` before `automatos-theme pack`, measuring 32 colour pairs on every preset
(`design/contrast.json`, never packed).

## Auto and the files

- **Auto.** An original pixel sprite drawn from code (`src/art/`), a port of the design mock's own drawing: twelve
  states (`hello`, `idle`, `listening`, `thinking`, `working`, `searching`, `reading`, `celebrate`, `oops`,
  `sleeping`, `lost`, `loading`), each two to four stepped frames on one 60 ms clock, driven by `@automatos/mascot`'s
  state machine. Nothing moves under reduced motion, and a pause control stops every sprite, cursor and typed line.
  The phone's stills (`assets/mascot/*.png`) are each state's first frame, written by `test/stills.test.ts`
  (`ARCADE_WRITE=1`) and held to the engine pixel for pixel; they are code output under the Apache licence
  (`themes/arcade/NOTICE`), not the clips Play and HUD ship.
- **Fonts.** Press Start 2P 400 and Pixelify Sans 400/600 in `assets/fonts/`, listed in `theme.json` `fonts`, under
  the SIL Open Font License 1.1 with their licences (`assets/fonts/README.md` names each file's source and sha256).
- **Bundled.** `@automatos/mascot` alone, packed under `source/packages/mascot/src/`: unlike Play and HUD, Arcade
  names no `@automatos/look-kit` dependency in its `package.json`.
- **Previews.** Eight in `theme.json` `previews`, 1440 by 900 from the kit's showcase shots: the chat in each palette
  (Overworld first, the listing's cover), then Quests, the Inventory and Options in Overworld.

## In the phone app

A phone app never runs Arcade's code. From the Automatos Go release that adds it, the app has an Arcade layout of its
own, built in beside Studio, Play and HUD, with the same five palettes and knobs, synced with the web through the
host's looks API (`theme.json`'s `mobile` block is the skin for an app version without that layout: `fromLooks: true`, Press Start
2P for titles and Pixelify Sans for body text (`mobile.fonts`), and `"mascot": "stills"`, Auto's twelve stills).
`automatos-theme check` measures the block's ten pairs on the defaults and every preset.

## Building, releasing and history

In the kit, from `themes/arcade`: `npm run build` (`vite build` with the kit's preset), `npm run lint`,
`npm run typecheck`, `npm test` and `npm run pack` (`automatos-theme check design .`, then
`automatos-theme pack . --out out`, which writes `automatos.arcade-<version>.autotheme` and its `.sha256.json`). Kit
CI's `harness` job shoots Arcade among every other theme under `themes/` (`scripts/shots/other-themes.mjs`). An
`arcade-v<version>` tag releases it ([releasing.md](../releasing.md)); its review, signature and listing follow
Play's steps with Arcade's names ([OFFICIAL-LISTING.md](../OFFICIAL-LISTING.md)).

What each version changed is in [`themes/arcade/CHANGELOG.md`](../../themes/arcade/CHANGELOG.md), newest first.
