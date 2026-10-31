# Phone layouts

Automatos Go, the Automatos phone app, runs no theme code. App Store Review Guideline 2.5.2 allows an app no
downloaded code that changes what it does, so every screen the app shows is drawn by a layout built into the app: native
code that ships in an app release, through the App Store's review. A theme brings data only: its looks, and its `mobile`
skin's colours, fonts and Auto's pictures ([mobile-skins.md](mobile-skins.md)). Automatos adds layouts over time, each
in an app release; this guide lists the ones there are, what each draws and how a theme reaches it.

The facts are Automatos Go's, at the commit [the theme CLI's README](../packages/theme-cli/README.md) names. When this
guide and the app disagree, the app wins and this guide is fixed.

## The layouts

| Layout | Id | Its character | In the app since | The theme that switches the phone to it |
|---|---|---|---|---|
| Studio | `studio` | The app's own: cream paper or Studio Dark, serif titles, the chat with the host's cards | 1.0.0 | Every theme not named below, painted through its skin; and no theme at all |
| Play | `play` | A companion: Auto on screen over the chat, a glow behind the page, a shelf of Deliverables | 1.0.0 | `automatos/play` |
| HUD | `hud` | A voice-first command deck: Auto in a ring core, a transcript, square bracketed panels, a grid and scan lines | 1.0.0 | `automatos/hud` |
| Arcade | `arcade` | A 16-bit handheld: Auto as a pixel sprite in a dialogue box, your agents as a party, a D-pad | 1.0.0 | `automatos/arcade` |
| Candy | `candy` | Bright, soft and glossy: gradient cards, round everything, today's number in a candy orb, a floating tab bar | The next release | `automatos/candy`, from that release; until then Candy's skin on Studio |

How the phone picks a layout:

- **Same as Studio**, the phone's default, follows the theme Studio shows the member (their own choice, else the
  workspace's default). `automatos/play`, `automatos/hud` and `automatos/arcade` switch the phone to that layout,
  painted from the member's looks; the app reads none of their `mobile` block. Any other theme with a skin the phone
  can paint draws Studio in the skin. No theme, no skin, or a theme revoked with `disable` draws Studio's own colours.
- **A member can pick on the phone**, under Settings, Style and look: Studio, Play, HUD, Arcade or an installed theme
  with a skin. A theme picked there always paints Studio.
- **The match is by theme id**, from a fixed list in the app. A package can't name a layout.
- **An app version from before a layout** paints that theme's `mobile` skin on Studio. That is why Automatos's own
  themes each keep a skin, and why `automatos/candy` draws its skin on Studio until the release with Candy's layout.

## What every layout shares

- **The same data, and no request of its own.** Every layout reads what the app already reads: the needs-you number and
  its items; the one chat thread with Auto; the Board's tickets; the Deliverables gallery; the chat's agents. No layout
  has a Missions screen: a Mission is one of the host's cards in the thread (a suggestion, a plan to approve), and its
  steps are the Board's tickets.
- **The same shared screens, dressed.** The Command Centre (Board, Calendar, Questions, Deliverables), sheets,
  Settings, the edge screens (First open, Not running, Something went wrong, Lost) and the voice screen are one set of
  screens. Each layout dresses them: corners, panels, buttons, labels, the ground and how a status reads.
- **What the server offers.** Where the server lists them, every layout shows Auto's suggestions ("Ideas · N", and the
  newest one) and the day's brief. A card waiting for an answer is answered in the thread on Studio and Play; on HUD
  and Arcade its sheet opens by itself.
- **The AI label.** One small muted caption, "Auto is an AI", at the top of every thread, in every layout. Nothing is
  drawn over it.
- **Minimum sizes.** A control is at least 44 pt each way to touch (a smaller one drawn is padded out to 44); the
  app's type scale has no text below 11 pt; text follows the phone's Dynamic Type.
- **Reduce Motion** stills every loop in every layout. Changing the layout crossfades the app over 180 ms (at once
  under Reduce Motion).
- **Status.** Studio and Play show a status as a coloured dot and a word. HUD and Arcade show a glyph and a word in
  capitals, and Candy shows a glyph and a word:

| Glyph | The statuses it shows |
|---|---|
| ● | working, in progress, live |
| ○ | inbox, assigned, queued, not checked |
| ◆ | review, blocked, needs you, needs setup |
| ✓ | done, ready, approved |
| ✕ | failed, error |
| ▸ | a running step |
| — | cancelled, closed, paused, idle, offline, and a status the app doesn't know |

## Studio

The app's own layout, and the one every creator's theme paints.

| Screen | What it shows | Host data |
|---|---|---|
| Home | The header (the sail mark and "automatos", "Ideas · N", one menu button with the needs-you number); the needs strip ("NEEDS YOU · N", a card per item with its dot, word, title and who); the thread; the message box | The needs-you number and items; the newest chat's thread; suggestions |
| First open | The home before the first message: the sail mark, "Talk to Auto" and a line under it, in the thread's place | None |
| A conversation | The same thread and message box, with Back | The chat thread |
| Chats | Every conversation, newest first | The chat history |

- **Parts.** The thread opens with the AI label, then your messages, Auto's replies and the host's cards: a Mission
  suggestion, a plan or a tool to approve, a ticket, and what Auto did. The message box is a pill with attach, voice
  and send. Above it sits the newest suggestion, where the server offers suggestions.
- **Navigation.** The menu holds New chat, Chats, Notifications, the Command Centre and Settings; Style and look is
  in Settings. A needs card opens its question, ticket or post. The voice button beside send opens the voice screen.
- **Auto.** None of the app's own. A theme whose skin brings Auto shows him on First open and in the voice screen's
  core.
- **Looks.** No look page: Light, Dark or the phone's System. A skin's colours lie over Studio's 24 tokens, its fonts
  take the three type roles, and its `mascot` sets Auto ([mobile-skins.md](mobile-skins.md#what-the-phone-draws)).
- **Type.** Titles in Newsreader 500 (the skin's `serif` role); the body, the thread and the message box in Geist
  (`sans`, the thread at 16/24); eyebrows, labels and figures in Geist Mono 600, labels in capitals at 11 (`mono`).
- **Motion.** A new message rises 8 pt and fades in over about 200 ms; the working dots and the Command Centre's live
  dot pulse. Reduce Motion stills all three. There is no pause control.
- **Accessibility.** A status is a dot and a word; 44 pt targets; text from 11 pt.
- **Shared screens.** Studio's cards and buttons; the voice screen's rings drawn in the text colour (`--foreground`)
  and moving in the accent (`--accent`).

## Play

Automatos's `automatos/play` on the phone. Its looks and palettes: [docs/themes/play.md](../docs/themes/play.md).

| Screen | What it shows | Host data |
|---|---|---|
| Home (the chat) | The header ("Chats", the chat's title, "Shelf +N" when Deliverables landed in this chat, "Ideas · N"); "NEEDS YOU · N  Command Centre →" while anything needs you; Auto's row (Auto, his word, a caption); the thread with report cards; the message box | The chat thread; the needs-you number; suggestions; the brief |
| First open | The brand line, Auto saying hello, "Your Automatos, / the fun way.", and three starters that fill the message box and never send | None |
| Conversations | Today, This week and Earlier; New chat; a bell to the notifications; your avatar to Settings | The chat history; the unread number |
| Shelf | "Your shelf" and its count, Auto, type pills, the newest piece large, then two columns of tiles and Load more | The Deliverables gallery |
| A Deliverable | "← Shelf", a paper sheet (eyebrow, title, summary, body) and its actions | One Deliverable |

- **Parts.** Auto's row with his light ring under him; your messages outlined and Auto's unboxed, with an accent caret
  while he writes; a report card (a gradient, a small page, Open) for each Deliverable a reply made; "What Auto did"
  chips; the message box (send or stop, attach, the language chip, voice); the bottom bar on Conversations and the
  Shelf; the glow behind the page.
- **Navigation.** "Chats" opens Conversations and "Shelf" the Shelf; the needs line opens the Board. The bottom bar
  holds Chats, Shelf and Centre (the Command Centre, with the needs-you number). Play has no menu; Settings is your
  avatar on Conversations, and **Make it yours →** is under Settings, Style and look.
- **Auto.** Always on screen. The app plays its own clips of him (HEVC video with an alpha channel, on iOS), through
  Skia under a colour matrix when his shell is tinted, and shows his still on Android, under Reduce Motion or when a
  clip fails. Twelve states, each with a word ("Hi.", "Ready.", "On it.", "Ta-da.", "Hm."). He is on the chat, the
  Shelf, First open, the edge screens, the voice screen's core and the look page's preview.
- **Looks** (Make it yours):

| Knob | Choices | What it changes on the phone |
|---|---|---|
| Accent (`accent`) | Molten, Cream, Mint, Gold, Periwinkle, Rose | Buttons, links, the caret, the bottom bar's dot, the glow's colour |
| Background (`ground`) | Graphite, Obsidian, Night, Paper | The page; Paper makes the look light |
| Type (`font`) | Editorial, Clean, Characterful, Playful | The display face of titles |
| Auto's shell (`shell`) | Bronze, Gold, Silver, Cobalt | Tints Auto's body (Bronze leaves him untinted) |
| Auto's light (`light`) | Mint, Amber, Ice, Rose | His eyes and his ring |
| Glow (`glow`) | 0 to 40, held to the most the look keeps readable | The glow behind the page |

  Five presets (Ember, the default; Obsidian; Aurora; Workshop; Daylight), Save as new look, Reset, and a long press
  on a saved look for Rename, Duplicate or Delete.
- **Type.** Titles of 19 pt and up in the Type knob's face (Instrument Serif italic, Geist 600, Bricolage Grotesque 700
  or Fredoka 600), smaller titles in Geist 600; the body in Geist (the thread at 16/1.6); labels in Geist 500 at 11,
  in capitals; figures in Geist Mono.
- **Motion.** The glow follows Auto's state over 600 ms (calm, busy, bright, and a coral light on a snag); his ring
  pulses every 2.4 s; a message rises in over 180 ms and a report card drops in with a small bounce; the caret blinks.
  Reduce Motion shows his still, changes the glow at once and stills the ring, the spinner, the caret and every
  entrance. There is no pause control.
- **Accessibility.** A status is a dot and a word; 44 pt targets; the bottom bar's places 48 pt high and at least 96
  wide; Instrument Serif never below 19 pt. VoiceOver hears Auto as one image, "Auto, {what he is doing}". The app's
  tests hold every Background and Accent pair to AA, and the glow to the readable limit.
- **Shared screens.** Cards with radius 14, buttons with radius 10, round pills; the glow behind them. The Command
  Centre's title is in the display face, its tabs underlined in the accent. The edge screens: Not running at dusk
  with Auto asleep and Check again; Something went wrong in coral light, "I hit a snag."; Lost, a large "404" and
  "This page wandered off.". The voice screen's rings and waveform take the accent, with Auto in the centre.

## HUD

Automatos's `automatos/hud` on the phone. Its looks and palettes: [docs/themes/hud.md](../docs/themes/hud.md).

| Screen | What it shows | Host data |
|---|---|---|
| The core (home, and every conversation) | The top bar ("AUTOMATOS //", the microphone's state; COMMAND · N, IDEAS · N, LOOK and the menu; "{AGENT} · {STATE}" and a clock); the newest suggestion as NEXT ▸; the ring core with Auto and his state chip; the transcript (YOU, then AUTO); the waveform; TYPE, HOLD TO TALK and STOP | The chat thread (your last message and Auto's reply); the needs-you number; suggestions; the brief; approvals waiting in the thread |
| The Looks drawer | Over the core, at the right edge | The member's HUD looks |

The Board and the Deliverables are the shared Command Centre's.

- **Parts.** A 290 pt ring core drawn with Skia (an outer ring, ticks, an arc, segments, a dashed ring, an inner arc,
  a pulse and a crosshair); the state chip in a one-point accent box; the transcript, with a block cursor while Auto
  writes; the waveform, standing at the microphone's level while you talk; square buttons and an 84 pt round HOLD TO
  TALK; a grid of lines every 32 pt; scan lines every 3 pt; corner brackets on panels.
- **Navigation.** COMMAND opens the Board, LOOK the Looks drawer (also **Looks →** under Settings, Style and look),
  the menu New chat, Chats, Notifications, the Command Centre and Settings. TYPE opens the message box in a sheet;
  HOLD TO TALK talks in place. A waiting approval opens its sheet once; then "◆ WAITING FOR YOU · OPEN" under the chip
  opens it again.
- **Auto.** In the ring core when the look's AUTO is on, as the app's own clips and stills (as on Play). The chip says
  what he is doing, in capitals.
- **Looks** (the Looks drawer):

| Knob | Choices | What it changes on the phone |
|---|---|---|
| ACCENT (`accent`) | Arc, Forge, Ghost, Nova, Signal, Gold | Rings, lines, brackets, the grid, the glow and the main button |
| BACKGROUND (`ground`) | Void, Carbon, Navy, Ember | The page; the text colours stay the same |
| TYPE (`font`) | Rajdhani, Chakra, Mono | The display face of the brand, titles and panel labels |
| GRID (`grid`) | 0 to 30 | How strong the grid is; 0 draws none |
| GLOW (`glow`) | 0 to 40, held to the most the look keeps readable | The glow behind the core |
| SCAN (`scan`) | On, Off | The scan lines |
| AUTO (`auto`) | On, Off | Auto in the core |
| MOTION (`motion`) | On, Off | Every loop |

  Five presets (ARC, the default; FORGE; GHOST; NOVA; SIGNAL), SAVE AS NEW LOOK, RESET, and a long press on a saved
  look for Rename or Delete.
- **Type.** The display face from TYPE: Rajdhani 700, Chakra Petch 600 or Geist Mono 500. The body in Geist; the
  status row, the chip, buttons and labels in Geist Mono, in capitals; Auto's words at 19 pt, yours at 15.
- **Motion.** Five rings turn at their own speeds, from 5 s to 60 s a turn; the core pulses every 2.4 s; the waveform
  breathes; the cursor blinks. The grid, the scan lines and the glow never move. MOTION off, or Reduce Motion, holds
  everything still; under Reduce Motion the drawer says "MOTION OFF · REDUCE MOTION" and MOTION can't be pressed.
- **Accessibility.** A status is a glyph and a WORD, the glyph in the accent, the secondary text or the error colour;
  44 pt targets (46 in a panel); the smallest text is 11 pt. The rings, the waveform and the brackets are hidden from
  VoiceOver, which hears the chip each time it changes; under VoiceOver HOLD TO TALK is a double tap to talk and
  another to send. The app's tests hold every Background and Accent pair to AA.
- **Shared screens.** Square panels with corner brackets; square buttons and labels in Geist Mono capitals; the grid
  behind them. The Command Centre is "AUTOMATOS // COMMAND" with flush tabs. The edge screens are panels ("✕ Snag",
  "— Not answering"); First open is the core with "Say or type what you need.". The voice screen adds the grid and
  scan lines, and Auto when the look turns him on.

## Arcade

Automatos's `automatos/arcade` on the phone. Its looks and palettes: [docs/themes/arcade.md](../docs/themes/arcade.md).

| Screen | What it shows | Host data |
|---|---|---|
| Home: ◀ Chat | The status bar (Auto's mark, AUTOMATOS, the counters, PAUSE); "IDEAS · N" and ▶ NEXT; the party; the story window (the thread as YOU and AUTO lines, ★ for what a turn did, "Item received!" for a Deliverable); the dialogue window (Auto's portrait and state word, his reply typing out; TYPE, OPEN BRIEF, STOP); the D-pad and hold to talk | The chat thread; the needs-you number and items; the Board; the chat's agents; suggestions; the brief |
| ▲ Quests | The Board's tickets as quests on an overworld map: Storm Peaks for what needs you, Hearth Village for what is done, Greenwood for the rest; OPEN and BOARD | The Board's tickets; the needs-you items |
| ▶ Inventory | The Deliverables as items in a bag, with All, Reports, Documents and Images tabs; OPEN and All Deliverables | The Deliverables gallery |
| ▼ Menu | The menu: New chat, Chats, Notifications, the Command Centre, Settings | The needs-you number |

- **Parts.** The counters: **!** is the needs-you number and **QUEST** the Board's tickets in progress; a number the app
  hasn't read yet is left out, never shown as 0. The party: the chat's agents, each NEEDS YOU, WORKING or READY from
  the needs-you items and the Board, each a 16-pixel robot. The D-pad: a 3 × 3 grid of 64 pt cells. Square pixel
  windows and square buttons with a hard shadow; scan lines behind a window's content; the round voice surround.
- **Navigation.** ◀, ▲ and ▶ swap the screen in place; ▼ opens the menu, which reaches the Command Centre and
  Settings. **Options →** is under Settings, Style and look. TYPE opens the message box in a sheet; hold to talk
  talks in place.
- **Auto.** A 32 × 32 pixel sprite drawn crisp with Skia, never the app's clips: twelve states of two to four poses, on
  one 60 ms clock (a pose every 180 ms). His size is 32 pt times the pixel scale; his portrait in the dialogue is twice
  that.
- **Looks** (Options):

| Knob | Choices | What it changes on the phone |
|---|---|---|
| Palette (`palette`) | Overworld, Dungeon, Neon Cabinet, Night City, Handheld | Every colour and the art; Handheld is the one light palette |
| Scanlines (`scanlines`) | Off, Soft, Strong | The lines behind each window's content |
| Pixel scale (`pixelScale`) | 2×, 3× | Auto's size |
| Window (`windowStyle`) | Classic double, Thin | Each window's frame and drop |
| Text speed (`textSpeed`) | Instant, Normal, Slow | How fast Auto's reply types out |

  A live preview, Save look, Reset (the palette's preset), and save slots: the five presets, then the member's own
  looks, each with a long press for Rename or Delete.
- **Type.** Press Start 2P for titles, labels, buttons, counters and state words, in capitals from 11 pt; Pixelify Sans
  for running text, never below 15 pt (the dialogue at 17).
- **Motion.** Auto's sprite, the ▶ and ▼ cursors, the typewriter, and the voice screen's rings and waveform. **PAUSE**
  (then **PLAY**) sits at the end of the status bar, under the voice screen's top bar, at the top of each edge
  screen's window and beside the way back on Options; one tap stills Arcade everywhere, and the phone keeps it. Paused,
  Auto holds his first pose, the cursor stays lit and replies show whole. Reduce Motion does the same, and shows no
  pause control.
- **Accessibility.** A status is a glyph and a WORD, the glyph in its state's colour (needs you in quest yellow,
  working in mana blue, failed in red), never in the accent; the app's tests hold every palette's status colours to AA
  and far enough apart. 44 pt targets and 64 pt D-pad cells. VoiceOver hears "3 need you" and "Scout, needs you", and
  Auto's reply once it has typed out. Scan lines are left out wherever they would take text below AA.
- **Shared screens.** Every panel a square window with a hard drop shadow, a ▶ beside the current menu row, buttons in
  Press Start 2P. Each edge screen is one window with Auto's sprite in its state (hello, sleeping, oops, lost), that
  state in words and a tab ("— NOT ANSWERING", "✕ SNAG"). The voice screen's core is filled with the window colour,
  with Auto as his sprite.

## Candy

Automatos's `automatos/candy` on the phone, **in the next Automatos Go release**; until then the app paints Candy's skin
on Studio. This section is Candy's design for the layout and the kit's theme
([docs/themes/candy.md](../docs/themes/candy.md)); the release may differ in detail, and this guide follows it then.

| Screen | What it shows | Host data |
|---|---|---|
| Today | The band; a greeting and "{n} things need you"; Auto; the orb with today's number; stat cards (Working now, Needs you, In queue; one the app hasn't read is hidden); a Needs you window with the first two items | The needs-you number and items; the Board |
| Chat | Auto's stage (the violet card, Auto, his state pill, Pause); the thread (the AI label first, bubbles, "✓ {what Auto did}" chips, Deliverable rows, "Auto is writing", and the host's cards as Studio draws them); a "Message Auto" pill with the voice button beside it | The chat thread |
| Shelf | "Deliverables", type chips (All, Reports, Documents, Images, Spreadsheets, Slides), two columns of gradient tiles by type, a link to all | The Deliverables gallery |
| Team | "Your team", "{active} of {total} agents active", a row of up to five ringed avatars, then a list with a status chip each | The chat's agents |

- **Parts.** The band: a gradient behind the top of each view, its lower edge curved. The orb: a 200 pt glossy ball
  with a white arc turning round it. Gradient cards in pink, violet and blue in turn. A floating tab bar (Today, Chat,
  voice, Shelf, Team); round icons and avatars; conic rings round active agents; pills for buttons and chips.
- **Navigation.** The tab bar switches the views in place; its raised centre is hold to talk. A menu circle holds the
  menu every layout has. **Make it sweet →** is the look page, under Settings, Style and look.
- **Auto.** A glossy shell drawn in code with Skia, from the same geometry as the kit's web Auto (a pink-to-violet
  body, a white gloss, a dark visor, glowing eyes, blush and an antenna), never the app's clips. His twelve states
  differ in the eyes. He is on Today, on the Chat stage, on the edge screens and in the voice screen's orb.
- **Looks** (Make it sweet):

| Knob | Choices | What it changes on the phone |
|---|---|---|
| Palette (`palette`) | Blush, Lilac, Night bloom | Every colour and the tone: Night bloom is dark, the others light, whatever the phone's Light or Dark |
| Card colours (`cards`) | Mixed, One colour | Cards cycle pink, violet and blue, or all take the first |
| Gradient (`gradient`) | Soft, Rich, Vivid | The cards' gradients; Vivid adds a soft aura behind the home |
| Roundness (`roundness`) | 16 to 40 | The corners of cards (at about seven tenths of it) and windows; pills, icons and avatars stay round |
| Glow (`glow`) | 0 to 10 | How strong the tinted shadows are |
| Motion (`motion`) | On, Paused | Every loop |

  Three presets (Blush, the default; Lilac; Night bloom), Save look, Reset, and a long press on a saved look for Rename
  or Delete.
- **Type.** Outfit 600 for titles and figures (700 in the orb); Nunito for the body (400), labels (700) and buttons
  (800). No text below 12 pt.
- **Motion.** Auto floats 4 pt over 3 s and blinks every 4 to 6 s; the orb's arc turns; the writing dots bounce; the
  voice rings move. **Pause** sits on the Chat stage and in the header; one tap stills Candy everywhere, and the phone
  keeps it. The look's Motion set to Paused stills it too. Reduce Motion stills Auto on his first frame and shows no
  pause control; the look page's Motion row says "Motion off · Reduce Motion".
- **Accessibility.** A status is a glyph and a word; 44 pt targets; settings rows at least 52 pt. Every preset passes
  the skin's ten contrast pairs ([mobile-skins.md](mobile-skins.md#contrast)), and white text on every card gradient
  reads at 4.5:1.
- **Shared screens.** Round cards with tinted shadows, section titles in Outfit, statuses as a glyph and a word. The
  edge screens: the band, Auto in the state that fits, an accent pill button. The voice screen: the orb as its core,
  with Auto inside, its rings and waveform in the card gradients.

## Using a layout as a creator, today

- **Your theme is drawn on the Studio layout**, through its `mobile` skin: your colours for Studio's tokens, up to three
  fonts and Auto's stills or clips ([mobile-skins.md](mobile-skins.md)).
- **The other layouts belong to Automatos's own themes**: `automatos/play`, `automatos/hud`, `automatos/arcade` and
  `automatos/candy`. A theme that copies one of their looks on the web still gets Studio on the phone.
- **Design your phone skin within Studio's screens**: the home and its thread, First open, the Command Centre and the
  voice screen, as the Studio section above lists them.
- **Preview it in the harness's phone view**: `automatos-theme dev <theme folder>`, then `/phone`
  ([the harness's README](../packages/theme-harness/README.md), "The phone view"). For one of Automatos's own themes
  the phone view says the app switches to its layout, which it can't draw.
- **To ask for a new layout**, open an issue on this repository describing each screen and the host data it shows
  (from the list in "What every layout shares"). A layout ships only in an Automatos Go release; until then, your skin
  on Studio is what members see.

**Planned:** a theme will be able to choose one of these layouts and fill the colours, fonts and Auto it paints from;
this guide will list each layout's slots when the kit supports it.

## For designers

Design the phone as one of two things, and say which in the handoff:

- **A Studio skin**: your colours on Studio's screens, your fonts in its three roles, and Auto's pictures. Draw it over
  Studio's home, thread, First open and Command Centre, not over screens of your own.
- **Web only**: no `mobile` block, and the phone draws Studio's own colours for your theme.

Never draw new phone screens, or one of the layouts above re-dressed, as if they could ship in a theme: the app runs no
theme code, and a layout is app code. A design that needs its own phone layout is a proposal to Automatos (above), not
part of a theme. What a design may ask of the phone is in [designing-a-theme.md](designing-a-theme.md#the-phone).
