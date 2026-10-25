# Changelog

Play's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.1.1

- **The old markers are gone.** Play's motion stop now reads only the host's generic marker,
  `data-theme-motion="reduce"` on `<html>`, and its motion factor `--pl-motion-scale` only the host's
  `--theme-motion` (1 when the host sets none). The `data-pl-motion` selector and the `--pl-motion` fallback, which
  only builtin Play's own look code set, are removed, and so is that code (`lib/looks/document.ts`'s motion mark,
  which nothing called). The heading of the Look page and of the style sheet carries only
  `data-theme-heading`, the mark the host hands the focus to; `data-play-only-heading` is removed. Under core's host,
  which writes only the generic markers since builtin Play left core, nothing changes.
- **The look kit and Auto's player are kit packages.** `@automatos/look-kit` (the kit's `packages/look-kit`: the
  look's CSS variables, contrast and colour, Studio's tokens and the look validator, with the AA proofs) and
  `@automatos/mascot` (`packages/mascot`: Auto's state machine, his player, the media chooser and the Pause Auto
  control) replace Play's own copies. Play bundles both, and the package carries their source under
  `source/packages/<name>/src/`, so the Marketplace review rebuilds them with the rest.
- **The README.** "Where the code comes from" is one line pointing at the kit's `docs/PLAY-HISTORY.md`, which now
  holds the commit Play was copied from and every line changed. The section on keeping core's copy in step, which
  ended when builtin Play left core, is gone, and the build notes name the storage area Play's tests run on now.
- **The first chat fits a laptop's window.** An empty chat has no page header ("Hi, I'm Auto." is its heading), Auto at
  the large size is at most 36% of the window's height (200 to 380 px), the hero is padded 24px above and below, and
  the message box takes the focus without scrolling the page. At the large size Pause Auto is a quiet button at the
  top right of Auto's stage, not a row between his ring and the headline; it is still on the page wherever he moves.
- **The sidebar keeps its foot in view.** The nav and Recent scroll between New chat and the foot, Recent's list in
  what the nav leaves, so Docs, Settings and the connection pill stay visible. Recent lines up with the nav, a title
  on one line with an ellipsis.
- **Empty pages look finished.** An empty shelf, or an empty type, and Conversations with none yet show Auto at his
  regular size in the middle, the empty message as his caption, then Start a chat (the shelf drops its header Auto,
  Conversations its mascot column).
- **One page frame.** Every page (the chat, Conversations, the shelf and a Deliverable, the Look page, the style sheet
  and a Studio page in the frame) starts 40px in, under the header's search, and every page heading has one size.
- **The Look page.** It is called Look in the nav, in `theme.json`'s nav and in its heading; "Make it yours." opens its
  tagline. Its header no longer breaks the look's name mid-word and stacks in a narrow column (a 1024 to 1280 px
  window), the Looks row snaps its cards and fades its end, and the Glow slider is drawn from the look in every
  browser.
- **Details.** A document's tile keeps a 1px edge on Daylight. A disabled Send is an outline, not a faded fill.
  Conversations' title row cuts a long title instead of pushing New chat out, and the mascot column narrows on a
  laptop (240 to 340 px). The header's search button is named by what it shows, "Search ⌘K", with its shortcut in
  `aria-keyshortcuts`. On a look whose accent reads as its text colour (Obsidian), the secondary buttons are outlines,
  so they differ from the primary. Esc in the message box stops a reply Auto is writing. The asleep screen keeps the
  host's header utilities, so the theme menu and the account stay in reach.

## 1.1.0

The first release from the kit.

- **The phone.** `theme.json` has a `mobile` block: `fromLooks`, so a phone paints Studio's tokens from the look the
  user picked, and Auto's clips (`mascot: "clips"`). The AA proof holds ten pairs (eight text pairs at 4.5:1, two UI
  pairs at 3:1) on the first paint's defaults and on each of the five presets.
- **Auto's reply is marked AI-generated.** Its root carries `data-ai-generated="true"`, the machine-readable mark
  core's chat puts on each assistant message.
- **Seven listing previews** in `assets/previews/`: one per preset, and two more of Ember (Deliverables and Make it
  yours).
- **The SDK's storage area.** Play keeps Auto's pause, his hello and the seen Deliverables through the host's storage
  area, never browser storage.
- **The package.** Auto's clips and stills are committed in `assets/mascot/`; the package carries `src/` as
  `source/` for the Marketplace review; `boot/prepaint.json` carries the tone rule the host sets a look's tone from.
  The motion stop and the screen headings also answer the host's generic markers, `data-theme-motion` and
  `data-theme-heading`, beside builtin Play's own.
