# Changelog

Play's versions, newest first. A released version's files never change: a change to them is a new version.

## 1.4.0

Proactive Auto, step two. Play needs SDK 1.4.0 (`engines.sdk` `^1.4.0`), whose chat hands a theme each message's parts
(`knownParts`), and draws what they carry where PRD-268 puts it in Play, on a desktop and the phone alike:

- **Reply chips.** When Auto asks you to choose, the answers he offered (a message's `reply_chips@1` part) stand under
  his last message as 40 px pills in the look's secondary button (44 px targets on the phone), each named "Reply:
  <chip>" and marked as Auto's words (`data-ai-generated`). A tap sends the chip's words as your message, through the
  message box's own send, and on a desktop the box takes the focus. They go once a newer message exists; while a turn
  is still ending nothing is sent and they stay.
- **Suggestions in the conversation.** A suggestion Auto posted into the thread (a `suggestion@1` part) is the host's
  suggestion card under his message, with the same Start and Hide as the line pinned above the message box, its state
  the live one: once it is decided its card goes and the message's words stay; one just started there says so for a
  few seconds. The pinned line skips a suggestion the conversation shows, as it skips one the brief lists, so each
  Start is on screen once.
- **The brief by its part.** A brief is found by its message's `brief@1` part, never by its words, so an earlier day's
  brief in the Auto thread is a card too, with that day's rows (named as an earlier brief, and without Listen, which
  reads the day's brief the host holds). A message whose words merely match the day's brief stays Auto's words.

Left as they were: the brief's thumbs are the host's brief card's own (thumbs up and down, posted with the brief's
`state_hash`), so Play draws none beside them; and a brief row's press passes no Hide reason, as the card's row action
carries none and the brief's rows offer Start, Open, Answer and Set up.

## 1.3.0

Proactive Auto. Play needs SDK 1.3.0 (`engines.sdk` `^1.3.0`, `proactive` in `uses`) and places the host's proactive
cards where PRD-268 puts them in Play:

- **The day's brief.** On an empty chat the host's brief card stands where "Hi, I'm Auto." stood, under the page header,
  with Auto in the mascot column on a desktop (his hello still plays there) and over the message box on the phone. In a
  conversation the brief's own message is drawn as the card, its prose inside it once. A row's action works: Start and
  Hide on a suggestion's row, Open, Answer and Set up where the row goes; a row without one is text. With no brief (the
  workspace's proactive mode off, or not opened yet) the empty chat is the first open as before.
- **The suggestion.** The newest open suggestion is one line between the credits banner and the message box, on a
  desktop and the phone; its title opens the full card in place, and Escape or leaving it folds it back. It steps aside
  while a turn's Mission suggestion waits for an answer, and never repeats one the brief on screen lists.
- **Approvals** stay inline in Auto's reply, as before, with Auto listening while one waits; the host's card now shows
  who asked, the action, its target, its preview and the rule that asked.
- **Calibration**, once the server offers it: what Auto knows so far, as his bubble on the empty chat, while he says
  hello.
- **Status colours.** Each look paints Studio's status tokens (`--success`, `--warning`, `--warn-ink`, `--info`,
  `--running`) for its ground's tone, so a state reads the same under every look and never takes the accent; every role
  passes on the background and the card for all 24 ground and accent pairs, Paper included.

Not yet: a theme's chat gets no message parts in SDK 1.3.0, so an older day's brief in the Auto thread stays its prose,
the thread's own suggestion cards aren't drawn, and Auto's reply chips have nothing to draw from.

## 1.2.1

Polish for the product images:

- **Hello on an empty chat only.** Auto's hello ("Hi, I'm Auto.") plays once per browser session, as before, but now
  only on an empty chat, the first open it belongs to. A conversation opened first in a session (a link to it in a new
  tab, a reload, one picked from Conversations) no longer shows the hello caption beside it, under Auto in the mascot
  column or over the phone's message box; the session's hello waits for its first empty chat.
- **A made-up laptop.** The Look page's preview and the style sheet's sample chat name a made-up laptop, the Aero 14,
  where they named a real product.
- **Save as new look fits.** The look editor's option groups sit 20 px apart and 8 px under their labels (24 and 12
  before), so at 1440 by 900 the whole panel fits under the header row and Save as new look and Reset are no longer
  cut at the window's foot. A shorter window still scrolls the panel on its own.

## 1.2.0

Play gets a voice and a phone. It needs SDK 1.2.0 (`engines.sdk` `^1.2.0`, `voice` in `uses`) and draws from a
phone's width up (`minWidth` 360).

- **Talk to Auto.** The host's voice button (the SDK's `voice.VoiceButton`) stands in the message box between the words
  and Send: Live where the workspace has it, else quick-ask (`mode` `auto`), held to talk (`press` `hold`), with the
  Space hotkey on a desktop (never while typing) and none on a phone. Core draws all of it: the press, the microphone
  prompt, the "AI voice assistant" caption and the stop control while the microphone is open, a failure with Try
  again. Play colours it through its `--voice-button-*` properties and `data-voice-*` attributes only, in the look's
  own pairs (the text at rest, the accent and its ink while it hears), and never hides or covers the caption or the
  stop control. Typing stays: nothing locks while voice runs, and the box wraps so core's controls keep their room.
- **Auto follows the voice session.** He listens while the microphone is open, thinks, then speaks, with his caption
  saying so; while he speaks he is his calm clip and his light ring swells with his voice (`readVoiceLevels().agent`,
  read in an animation frame and written as `--pl-voice-level`). Under reduced motion, and while he is paused, he holds
  still. A session waiting for the microphone loads; a failed one is his oops. When it ends the chat drives him again.
  What the session heard and what Auto has said so far show in the conversation, as your message and his reply, where
  the host puts them while it runs; Play draws nothing of its own over the message box, so they show once.
- **Play on a phone.** Below 1024 px Play draws the Ember design's 390 screens instead of its desktop layout: a 56 px
  bar with Menu, the wordmark, Chats and Shelf (the current one dotted), and no sidebar or header row; Menu opens a
  modal menu with New chat, search, the sidebar's nav, Recent, Docs and Settings, the connection pill and the host's
  header utilities (mounted while shut), which keeps Tab inside it and shuts on Esc, Close or the glass, with
  everything behind it inert. The chat puts Auto at his small size beside his caption over the message box;
  Conversations is titled Chats and has no mascot column; the shelf has two columns; a Deliverable's panel, the look
  editor and the style sheet's columns stack under the page; the asleep screen and the 404 take the phone's sizes and
  full-width buttons. Every page starts 16 px in, every control is a 44 px target, and nothing is wider than the
  screen. From 1024 px up nothing changes, and a window crossing the width keeps its page.

## 1.1.1

- **New listing previews.** The seven pictures `theme.json` lists under `previews` (each preset's chat, and Ember's
  shelf and Look page) are shot again from 1.1.1 installed in core's local edition (core's browser lane, the
  `play-previews` shots), so the listing shows the first chat that fits the window, the pinned sidebar foot and the
  Look page as they are now. Same names and sizes; `theme.json` is unchanged.
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
