# Candy

Candy is an installable Automatos theme (`automatos/candy`): Automatos bright, soft and glossy. Every card carries its
own gradient, the corners are big and round, and every icon, avatar and badge is a circle. Today's numbers sit in a
candy orb, and Auto wears a glossy pink-to-violet shell. It was built with this kit from a Claude Design handoff (a
README of rules, `looks.json` and HTML mocks), starting from the minimal template, as
[the kit's guide](../../guides/from-design-to-theme.md) describes.

Like every theme built in this kit, Candy installs and runs the same way on the local edition and the hosted edition.

Every number and name it shows is the host's own data, read through `@automatos/theme-sdk`; where the design wanted
something the SDK doesn't give, Candy leaves it out (below).

## What it registers

`src/entry.ts` registers what `theme.json` declares:

- `frame@1`: at 1024 px and up, the sidebar (the Candy mark, Auto's card, Today, Chat, Deliverables and Agents, the
  host's Missions and Playbooks page and Knowledge Base, More with the rest of the host's menu, Look, Pause motion and
  the workspace), the band behind the top of each page, and the host's header utilities. From 360 px to 1023 px, the
  design's phone: a top bar (menu, mark, the host's utilities), a menu sheet with every page, and a floating tab bar
  (Today, Chat, the host's voice button raised in the middle, Shelf, Team). The frame draws its own asleep screen
  (`asleep@1`) while the backend doesn't answer.
- `/x/today` (its own route): the greeting, the orb with what was completed today and Auto celebrating, four stat
  cards (working now, needs you, in queue, agents active), Needs you and Coming up, from the host's Command Center
  reads.
- `/chat` (its own page): the thread in a white window (the accent-gradient bubbles for you, Auto's on the chip, tool
  lines as chips, a Deliverable made in the chat as a row with its gradient square, the host's approval and Mission
  cards placed), the message box inside the host's `AiLabelFence` with the host's voice button beside it, and the
  rail: Auto's stage with his state word and Pause, and your conversations, newest first.
- `/deliverables` (its own page): type filters as pills, search, and a grid of tiles whose gradient comes from the
  Deliverable's kind (report and slides pink, document and spreadsheet violet, image and blog post blue in Blush).
- `/x/agents` (its own route): your team, filtered by All, Active and Inactive, each agent a card with a round avatar
  (a gradient ring when active), the job title and a status chip that always says the word.
- `lookEditor@1` (`/looks`): Your look, three presets, a row per knob, Save look, Reset, Export and Import, and a live
  preview.
- `styleSheet@1` (`/looks/style`): the type, the palette's colour pairs measured on the page, the card gradients, the
  parts, and Auto's twelve states.
- `notFound@1`: the 404, with Auto lost.

Every other page (the Command Center, Assignments, Agent Management, Settings and the rest) is the host's own, inside
the frame, recoloured by the palette's Studio tokens.

## The host's parts

The approval and Mission cards, the withdraw offer and ticket cards, the voice button, the header utilities, the
first-run nudge and the credits banner are the host's own components, placed and never restyled: each sits in a strip
in Studio's own type, and Candy's rules name only its own classes (and, inside the host's Markdown, a reply's text,
which is the theme's to set), so none reaches inside them. The message box is Candy's (the SDK has no host message
box), inside the host's `AiLabelFence`; the voice button sits beside it, outside the fence. The "Auto is an AI" label
is the host's, drawn by the host at the foot of the window: every page keeps that corner clear, and on a phone the tab
bar floats above it.

## Looks

Six knobs (`looks/schema.json`): palette (Blush, Lilac, Night bloom), card colours (Mixed, One colour), gradient (Soft,
Rich, Vivid), roundness (16 to 40 px, a choice per whole number, drawn as a slider), glow (0 to 10) and motion (on,
paused). One preset per palette: Blush (Rich, 28, 6), Lilac (Vivid, 32, 5), Night bloom (Vivid, 28, 8). Every literal colour is in `src/looks/catalogue.ts`;
`test/look-data.test.ts` writes `looks/`, `boot/prepaint.json` and `design/contrast.json` from it
(`CANDY_WRITE=1 npx vitest run test/look-data.test.ts`) and holds them equal, and measures every pair on every preset
with Mixed and One colour cards. `automatos-theme check design` measures 51 colour pairs on every preset.

- The first paint draws the whole look: the palette (its colours, Auto's and Studio's tokens), the card gradients'
  stops (a pair table of palette and card colours), the band's and the aura's stops (palette and gradient), the
  card's layers (the gradient knob), the corners (`--candy-r` and `--candy-rs`, r × 0.72, per roundness), the shadows'
  tint (the glow knob, a numeric rule) and every loop's play state (the motion knob).
- Core's look runtime knows only the knobs the table paints, so every knob is one it paints: Roundness is a choice of
  the whole numbers 16 to 40, not a number knob. Core's first paint in the browser drops a value that calls a gradient
  or runs past 200 characters, so the table paints colours, stops and places, and `src/app/theme.css` composes the
  cards, the band and the aura from them. `test/look-data.test.ts` holds the table to both rules.
- Two card colours differ from the handoff: its pink start `#D93A7E` and blue start `#2878D8` hold white text at
  4.32:1 and 4.40:1 (`automatos-theme check handoff`), so each is darkened by the least that reaches AA: `#D73178` and
  `#2675D3`. Blush's accent as text is `#C2266C` (the accent `#D62F7A` reads at 4.15:1 on the page).

## Auto

Auto is drawn from code, from the design's glossy concept: `src/art/auto-geometry.ts` holds him as shapes and paints in
one square box (an antenna and its glossy ball, the body with its gloss and cyan glow, the dark visor, two glowing eyes
and two blush cheeks), and the twelve states differ in the eyes (the concept's five, idle, listening, thinking,
celebrate and sleeping, and seven more in their spirit). The web draws it as SVG (`src/art/auto.tsx`); his state
follows the turn through the kit's `@automatos/mascot` state machine. He floats 4 px over 3 s and blinks every few
seconds; nothing moves under reduced motion, while the look's Motion is Paused, or after Pause motion, which stops every
loop (WCAG 2.2.2) and is kept per account. The phone's stills (`assets/mascot/*.png`, 320 px) are rasterised from the
same geometry by `test/stills.test.ts` (`CANDY_WRITE=1`), which holds them to it pixel for pixel; Automatos Go vendors
the geometry and draws it with Skia.

## On the phone

From the Automatos Go release that adds it, the app has a Candy layout of its own, built in beside Studio, Play, HUD
and Arcade: while `automatos/candy` is the active theme, the phone switches to it, with the same palettes and knobs,
synced with the web through the host's looks API. The [phone guide](../../guides/mobile-skins.md#the-phones-layouts)
says how the layouts work.

`theme.json`'s `mobile` block is the skin for an app version without that layout: it paints Automatos Go's Studio
layout from the member's look (`fromLooks`), with Outfit SemiBold for titles, Nunito for body text, and Auto's twelve
stills. `automatos-theme check` measures its ten pairs on the defaults and every preset.

## What the host doesn't give, so Candy leaves out

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

## Fonts

Outfit and Nunito, both SIL Open Font License 1.1, ship in `assets/fonts/` with their licences;
`assets/fonts/README.md` names each file's source and sha256.

## Build, check and pack

- `npm run build`: `vite build` with the kit's preset, every rule under `html.candy`.
- `npm run lint`, `npm run typecheck`, `npm test`: the review's JS rules, TypeScript, and the tests on the kit's
  harness.
- `npm run pack`: `automatos-theme check design`, then `automatos-theme pack` into `out/`.

A merge to `main` that raises its version publishes it and releases `candy-v<version>`, as it does Play, HUD and
Arcade ([releasing](../../docs/releasing.md)); `CHANGELOG.md` lists what each version changed, and a released
version's files never change.
