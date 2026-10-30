# Arcade

Arcade is an installable Automatos theme (`automatos/arcade`): Automatos as a 16-bit role-playing game. Your agents
are a party, Auto is the guide in the dialogue box, your Deliverables fill an inventory and your Missions are quests
on a map. It was built with this kit from a Claude Design handoff (a README of rules, `looks.json` and an HTML mock),
starting from the minimal template, as [the kit's guide](../../guides/from-design-to-theme.md) describes.

Like every theme built in this kit, Arcade installs and runs the same way on the local edition and the hosted edition.

Every number and name it shows is the host's own data, read through `@automatos/theme-sdk`; where the design wanted
something the SDK doesn't give, Arcade leaves it out (below).

## What it registers

`src/entry.ts` registers what `theme.json` declares:

- `frame@1`: at 1024 px and up, a status bar (Auto's mark and the wordmark, today's counters as XP, ! and QUEST from
  the host's activity stats, a pause control, search and the host's header utilities) over a pause menu (THEME, HOST
  PAGES, SYSTEM, with a ▶ cursor and arrow keys). From 360 px to 1023 px, a handheld console: the page in a screen,
  a D-pad of four named targets (Quests, Chat, Inventory, Menu; Menu holds the host's utilities and every page), and
  the host's voice button in a round surround.
- `/chat` (its own page): the story window (YOU and AUTO lines, ★ lines for what a turn did, ITEM RECEIVED windows
  for Deliverables, and the host's own approval cards under "! A CHOICE AWAITS"), the dialogue window (Auto's portrait
  and state word, his newest reply typing out at the look's text speed, and the host strip with the message box and
  the host's voice button), and the party window (the roster, each agent with a state word).
- `/deliverables` (its own page): the Inventory, a grid of item slots with tabs (All, Reports, Documents, Images,
  Posts where Socials is offered), an info window, links to the host's other Deliverables sections; and, for
  `?deliverable=<id>`, that item's own window with its content.
- `/x/quests` (its own route): the workspace's Missions as markers on an overworld map, one region per state, each
  opening a quest window with the Mission's tasks as a checklist and a link to the host's Mission page.
- `lookEditor@1` (`/looks`): Options, the five knobs as rows, Save look and Reset, a live preview, and save slots
  with export and import.
- `styleSheet@1` (`/looks/style`): the Sprite gallery, Auto's twelve states moving and still, the design's colour
  pairs measured on the page, and the two faces.
- `notFound@1`, the 404 with Auto lost; `empty-state.mascot@1`, Auto asleep in the host's shared empty state.

Every other page (the Command Center, Assignments, Agents, Settings and the rest) is the host's own, inside the frame,
recoloured by the palette's Studio tokens.

## The host's parts

The approval and Mission cards, the withdraw offer and ticket cards, the voice button, the header utilities, the
first-run nudge and the credits banner are the host's own components, placed and never restyled: each sits in a strip
in Studio's own type, and Arcade's rules name elements only inside the host's Markdown (a reply's text, which is the
theme's to set), so none reaches inside them. The message box is Arcade's (the SDK has no host message box), drawn
in Studio's tokens inside the host's `AiLabelFence`; the voice button sits beside it, outside the fence. The "Auto is
an AI" label is the host's, drawn by the host at the foot of the window; Arcade keeps that corner clear and draws its
scanlines inside its own windows only, never over the page, so nothing of Arcade's covers the label.

## Looks

Five knobs (`looks/schema.json`): palette (Overworld, Dungeon, Neon Cabinet, Night City, Handheld), scanlines (off,
soft, strong), pixel scale (2×, 3×), window (classic double, thin) and text speed (instant, normal, slow; instant under
reduced motion or while the animation is paused). One preset per palette. Every literal colour is in
`src/looks/catalogue.ts`; `test/look-data.test.ts` writes `looks/`, `boot/prepaint.json` and `design/contrast.json`
from it (`ARCADE_WRITE=1 npx vitest run test/look-data.test.ts`) and holds them equal. `automatos-theme check design`
measures 32 colour pairs on every preset.

## Auto

Auto is an original pixel sprite drawn from code (`src/art/`), a port of the design mock's own drawing: twelve states
of two to four stepped frames, on one 60 ms clock. His state follows the turn through the kit's `@automatos/mascot`
state machine. Nothing moves under reduced motion, and a pause control stops every sprite, cursor and typed line
(WCAG 2.2.2). The phone's stills (`assets/mascot/*.png`) are each state's first frame; `test/stills.test.ts` writes
them (`ARCADE_WRITE=1`) and holds them to the engine pixel for pixel.

## On the phone

From the Automatos Go release that adds it, the app has an Arcade layout of its own, built in beside Studio, Play and
HUD: while `automatos/arcade` is the active theme, the phone switches to it, with the same five palettes and knobs, synced with the web through the
host's looks API. The [phone guide](../../guides/mobile-skins.md#the-phones-layouts) says how the layouts work.

`theme.json`'s `mobile` block is the skin for an app version without that layout: it paints Automatos Go's Studio
layout from the member's look (`fromLooks`), with Press Start 2P for titles, Pixelify Sans for body text, and Auto's
twelve stills. `automatos-theme check` measures its ten pairs on the defaults and every preset.

## What the host doesn't give, so Arcade leaves out

- **HP, mana or a level.** The SDK has no budget or quota for the workspace; XP is today's completed count, display
  only, never stored.
- **Who needs you, by agent.** The Needs-you rows name an agent by its name only, so the party's NEEDS YOU matches
  names; WORKING is a working run in the activity feed that names the agent's id.
- **Who made a Deliverable in chat, and when.** The chat's Deliverable carries a title and a kind only, so ITEM
  RECEIVED says "made in this chat".
- **A social-post type.** POSTS is the Deliverables whose source is a social post, shown only where Socials is offered.
- **A video icon.** The design draws four item icons; a video shows as an image.
- **A conversation list.** The design has none; New chat starts one, and the host's search finds an older one.
- **Region names** (Greenwood, Storm Peaks, Hearth Village) are the theme's words; a marker's place is a stable hash
  of its Mission's id onto a free tile of its region.

## Fonts

Press Start 2P and Pixelify Sans, both SIL Open Font License 1.1, ship in `assets/fonts/` with their licences;
`assets/fonts/README.md` names each file's source and sha256.

## Build, check and pack

- `npm run build`: `vite build` with the kit's preset, every rule under `html.arcade`.
- `npm run lint`, `npm run typecheck`, `npm test`: the review's JS rules, TypeScript, and the tests on the kit's
  harness.
- `npm run pack`: `automatos-theme check design`, then `automatos-theme pack` into `out/`.

An `arcade-v<version>` tag releases it, as a `hud-v<version>` tag releases HUD ([releasing](../../docs/releasing.md));
`CHANGELOG.md` lists what each version changed, and a released version's files never change.
