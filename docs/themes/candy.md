# Candy

Candy (`automatos/candy`, `themes/candy`) draws Automatos bright, soft and glossy: every card its own gradient (pink,
violet, blue), big round corners, every icon a circle, today's numbers in a candy orb, and Auto in a glossy shell.
It is the kit's fourth theme, built here with the kit from a Claude Design handoff, starting from the minimal
template, as Arcade was ([`guides/from-design-to-theme.md`](../../guides/from-design-to-theme.md)).
[`themes/candy/README.md`](../../themes/candy/README.md) has how it is built. This page reads
`themes/candy/theme.json` at version 1.0.0.

| Field | Value |
|---|---|
| `id`, `version` | `automatos/candy`, `1.0.0` |
| `engines` | `{"automatos": "^1.1.0", "sdk": "^1.2.0"}`: SDK 1.2.0, the SDK with the voice area |
| `base` | `studio`: the host's Studio design wherever Candy draws nothing of its own |
| `htmlClass` | `candy`: every rule of `dist/theme.css` sits under `html.candy` |
| `minWidth` | 360: below it the host draws its own pages and chrome; from 360 up to 1023 px Candy draws its phone layout (below) |
| `tone` | `from-look`: the look sets light or dark |
| `look` | `blush`, the default preset |

## What Candy draws

`src/entry.ts` registers four of the five slots `theme.json` declares, its two pages and its two routes. The fifth,
`asleep@1`, is listed so the host leaves the backend's health poll to the theme: the frame draws its own asleep screen.

| Where | What it is |
|---|---|
| `frame@1` | At 1024 px and up: a sidebar (the Candy mark, Auto's card, the menu with Candy's pages, the Missions and Playbooks page, the Knowledge Base and Look, every other host page under More, then the Pause control and the workspace), a band behind the top of each page, and the host's header utilities at the top right. Below 1024 px: a top bar (menu, mark, utilities), the page, and a floating tab bar (Today, Chat, Shelf, Team, with the host's voice button raised in the middle), left off the chat, which has its own message box and voice button. |
| `asleep@1` | Drawn by the frame: while the backend doesn't answer, the page gives way to Auto asleep, what is going on in words, and Check again. |
| `/chat` (`mode: own`) | Auto's stage (the violet card with Auto, his state pill and the Pause control; a strip across the top on the phone), the thread (your bubbles and Auto's replies, with chips for what a reply did), the host's approval, Mission and ticket cards, Conversations, and the message box with the host's voice button beside it. |
| `/deliverables` (`mode: own`) | The shelf: a search pill, kind pills with their counts, and a grid of gradient tiles, newest first; a tile, or `?deliverable=<id>`, opens that Deliverable in a sheet (its content through the host's `MarkdownView` or `FilePreview`, and Download). Links lead to the host's other Deliverables sections. |
| `/x/today` | Today: the greeting on the band, the orb with what was completed today, the day's four numbers on stat cards, Needs you (the newest three things waiting) and Coming up (the next three on the schedule). |
| `/x/agents` | Your team: a card per agent (a round gradient avatar, the name, the job, the status as a glyph and a word), a search, the All, Active and Inactive filters, and a link to the host's own agents page. |
| `lookEditor@1` (`/looks`) | Your look: the three presets and the member's saved looks, a row per knob, Save look, Reset, Export and Import, and a live preview: Auto, three cards and a bubble each way. |
| `styleSheet@1` (`/looks/style`) | The active look's colour pairs as the page paints them, the type scale, the card gradients under Soft, Rich and Vivid, the components, and Auto's twelve states. |
| `notFound@1` | The 404 on its own: Auto lost, and the ways back to Today and the chat. |

Every other page (the Command Center, Assignments, Agents, Settings and the rest) is the host's own, inside the
frame, recoloured by the palette's Studio tokens. `nav` lists Today (`/x/today`), Your team (`/x/agents`), Your look
(`/looks`) and Style sheet (`/looks/style`). `uses` names the SDK areas the code imports: `cards`, `chat`, `context`,
`deliverables`, `events`, `looks`, `navigation`, `pages-agents`, `pages-command-center`, `storage`, `theme` and
`voice`.

## The host's parts

The host's approval and Mission cards, the withdraw offer and ticket cards, the voice button, the header utilities,
the first-run nudge and the credits banner are placed and never restyled: each sits in a strip in Studio's own type,
with nothing of Candy's drawn over it. The message box is Candy's own (the SDK has no host message box), drawn inside
the host's `AiLabelFence`; the voice button sits beside it, outside the fence, with room for its caption and Stop. The
"Auto is an AI" label is the host's, drawn at the foot of the window; Candy keeps that corner clear, and the phone's
tab bar floats above it.

## Voice

Candy talks to Auto through the SDK's voice area (SDK 1.2.0) and never opens the microphone itself. The host's
`VoiceButton` sits raised in the middle of the phone's tab bar (`src/frame/tab-bar.tsx`: `size="lg"`,
`hotkey={null}`), in a white surround with an accent ring drawn behind it, never over it, and beside the message box
on the chat at every width (`src/chat/chat-view.tsx`), where the phone's tab bar is left off.

## In a phone's browser

`minWidth` is 360, so Candy draws a phone's width. Below 1024 px it draws the design's phone in place of the sidebar:
the top bar and its menu sheet, the page in one column, and the floating tab bar with the voice button. Kit CI's
`harness` job shoots Candy with every other theme under `themes/` (`scripts/shots/other-themes.mjs`), not by name as
it shoots Play and HUD.

## Looks

Six knobs (`looks/schema.json`, look format `candy-look/v1`):

| Knob | Label | Kind | Values | Default |
|---|---|---|---|---|
| `palette` | Palette | choice | `blush`, `lilac`, `nightbloom` | `blush` |
| `cards` | Card colours | choice | `mix` (Mixed: the three gradients in turn), `single` (One colour) | `mix` |
| `gradient` | Gradient | choice | `soft`, `rich`, `vivid` | `rich` |
| `roundness` | Roundness | number | 16 to 40 px, whole numbers | 28 |
| `glow` | Glow | number | 0 to 10, whole numbers | 6 |
| `motion` | Motion | choice | `on`, `paused` | `on` |

One preset per palette: Blush (the default; pink on white), Lilac (violet into blue, light) and Night bloom (neon
pinks after dark, the one dark palette). Every literal colour is in `src/looks/catalogue.ts`; `test/look-data.test.ts`
writes `looks/`, `boot/prepaint.json` and `design/contrast.json` from it (`CANDY_WRITE=1 npx vitest run
test/look-data.test.ts`) and holds them equal to the catalogue, not to `scripts/compile-looks.mjs`, which is Play's
alone. Roundness is the one knob the first paint can't draw (a number knob paints only as a colour's alpha there), so
the frame sets it on its root from the active look. Its `pack` script runs `automatos-theme check design .` before
`automatos-theme pack`, measuring every pair of `design/contrast.json` (never packed) on every preset.

## Auto and the files

- **Auto.** A glossy shell drawn from code: his geometry is data (`src/art/auto-geometry.ts`), which the web draws as
  SVG (`src/art/auto.tsx`) in the look's `--candy-auto-*` colours, in twelve states (`hello`, `idle`, `listening`,
  `thinking`, `working`, `searching`, `reading`, `celebrate`, `oops`, `sleeping`, `lost`, `loading`) that differ in
  the eyes, driven by `@automatos/mascot`'s state machine. He floats and blinks while the person lets things move;
  nothing moves under reduced motion, while the Motion knob is Paused, or once the Pause control is pressed (kept per
  account), which also stops the orb's ring and the writing dots.
- **The phone's stills.** `assets/mascot/*.png`, one per state, are his geometry rasterised by `test/stills.test.ts`
  (`CANDY_WRITE=1`) and held to it pixel for pixel; they are code output under the Apache licence
  (`themes/candy/NOTICE`), not the clips Play and HUD ship.
- **Fonts.** Outfit 600/700 and Nunito 400/700/800 in `assets/fonts/`, listed in `theme.json` `fonts`, under the SIL
  Open Font License 1.1 with their licences (`assets/fonts/README.md` names each file's source and sha256).
- **Bundled.** `@automatos/mascot` alone, packed under `source/packages/mascot/src/`: like Arcade, and unlike Play
  and HUD, Candy names no `@automatos/look-kit` dependency in its `package.json`.

## In the phone app

A phone app never runs Candy's code. Automatos Go gets a Candy layout of its own, built in beside Studio, Play, HUD
and Arcade, in a later app release; installing Candy then switches the phone to it, painted from the member's looks.
Until that release, and on every older app version, the app paints Candy's `mobile` block on its Studio layout:
`fromLooks: true`, Outfit SemiBold for titles and Nunito Regular for body text (`mobile.fonts.serif` and `sans`,
TrueType files in `assets/fonts/mobile/`), and `"mascot": "stills"`, Auto's twelve stills. `automatos-theme check`
measures the block's ten pairs on the defaults and every preset. The kit's harness and `automatos-theme skin` learn
Candy's layout only when the kit moves to the Automatos Go release that has it; until then the harness's phone view
draws Candy's skin on Studio, as the app does ([`guides/mobile-skins.md`](../../guides/mobile-skins.md)).

## Left out

What the design wants and the SDK doesn't give, so Candy 1.0.0 leaves it out:

- **The person's first name.** The SDK names the workspace, never the person, so Today greets with "Good morning",
  "Good afternoon" or "Good evening" alone.
- **Counts per Deliverable kind.** The Deliverables read gives a page at a time with no totals by kind, so each pill
  counts what has loaded and says "24+" until every page is in. Search is the SDK's own filter (a Deliverable's title,
  summary and path, not its agent), and a tile has no thumbnail: its kind's gradient and initial stand for it.
- **A Deliverable's kind in the chat.** The chat's Deliverable is a document, an image or a video, so the row a reply
  makes is violet or blue, never the report or slides pink the Deliverables page shows.
- **Who did what in a reply.** The design's tool chips name an agent ("Pixel wrote a draft"); the chips say what the
  host's receipt or the tool's own summary says, in the host's words.
- **States beyond active.** The roster's statuses other than active count as Inactive, as core's roster counts them;
  an agent in error says "✕ Error".
- **The phone's own layout on the web.** The design's P1 to P4 are Automatos Go's Candy layout. Below 1024 px the web
  theme draws its own pages in one column, under a top bar, with the design's floating tab bar.

## Building, releasing and history

In the kit, from `themes/candy`: `npm run build` (`vite build` with the kit's preset), `npm run lint`,
`npm run typecheck`, `npm test` and `npm run pack` (`automatos-theme check design .`, then
`automatos-theme pack . --out out`, which writes `automatos.candy-<version>.autotheme` and its `.sha256.json`). Kit
CI's `harness` job shoots Candy among every other theme under `themes/` (`scripts/shots/other-themes.mjs`), and its
showcase shoots ten clean images of it (`packages/theme-harness/src/host/showcase.ts`); the listing's eight previews
(`theme.json` `previews`, Today in Blush the cover) are eight of them, at 1440 px. A merge
to `main` that raises its version reviews, signs and lists it, and releases it as `candy-v<version>`, as it does Play,
HUD and Arcade; 1.0.0 has no tag yet, so the first publish run releases it as `candy-v1.0.0`
([releasing.md](../releasing.md), [OFFICIAL-LISTING.md](../OFFICIAL-LISTING.md)).

What each version changed is in [`themes/candy/CHANGELOG.md`](../../themes/candy/CHANGELOG.md), newest first.
