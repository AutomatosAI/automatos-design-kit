# Mascot placement

Where a theme can put Auto (or its own mascot), what the host gives it there, and where Play puts him. A mascot is
the theme's own: its clips and stills ship in the package and its code decides what state shows. The host only
offers the places.

## The mascot's files

- `theme.json` `mascot`: `{"states": [...]}`, up to 32 state names of lower-case letters, digits and dashes.
- Files: `assets/mascot/<state>.webm` and `.mp4` (clips, at most 1 MB each) and `assets/mascot/<state>.png` (a
  still, at most 512 KB). The phone uses the `.mp4` and the `.png` only ([contract.md](contract.md), "The `mobile`
  block").
- A theme asks the host for a file's URL with `assetUrl('assets/mascot/<state>.mp4')` (the SDK's `assets` area,
  [sdk.md](sdk.md)): the package is served under its digest, at a URL only the host knows. `assetUrl` answers
  `null` until the host knows the package, so draw the still or nothing until then.

## The places

### Inside the theme's own surfaces

The theme's frame (`frame@1`), its own pages (`pages`), its routes (`/x/<path>`) and its edge screens (`notFound@1`,
its asleep screen) are all the theme's components, so Auto can go anywhere in them. This is the only way to reach
`/chat`, `/assignments`, `/agents`, `/command-center` and `/` under the Studio base: none of them draws a placement
slot there.

### On core pages: the placement slots

Three slots sit in core's shared page header and empty state ([contract.md](contract.md), "Slots"). A theme lists
the ones it fills in `slots` and registers a component for each.

| Slot | Where it draws | Props |
|---|---|---|
| `page-header.art@1` | The shared page header: the first child of the header row, before the title block | `{ base, title, titleAccent, eyebrow }` |
| `page-header.mascot@1` | The shared page header: after the title block, before the actions | `{ base, title, titleAccent, eyebrow }` |
| `empty-state.mascot@1` | The shared empty state, in place of its icon tile | `{ base, title, description }` |

`base` is `studio` where the Studio layout draws the page and `classic` otherwise, so one component can size itself
for either head. A placed component draws inside `<div data-theme-slot="<slot id>">`, which the theme's CSS may
style under its own class. With nothing registered, the page has exactly the markup it had before the slots
existed; a component that throws is replaced by that markup.

### Which pages reach a slot

From core's `docs/theme-host/placement-reach.md` (read from the code, not run):

| Page | Studio base | Classic base |
|---|---|---|
| `/chat` | none | none |
| `/deliverables` | `empty-state.mascot@1` on the empty Templates tab | the header slots (the page, the Blog tab) and the empty Templates tab |
| `/assignments` | none | the header slots, and the empty Playbooks tab |
| `/missions/[id]` | the header slots | the header slots |
| `/agents` | none | the header slots |
| `/documents` | the header slots | the header slots |
| `/playbooks` | none (it sends you to `/assignments?tab=playbooks`) | the header slots |
| `/command-center` | none | the header slots |
| `/` | none (it sends you to `/chat`) | none |

Pages a theme can't replace that draw the shared header under both bases include `/analytics`, `/marketplace`,
`/team`, `/settings` and `/deliverables/explorer`; `/tools` draws it under Classic only. A page the theme replaces
shows the theme's page, so no core slot draws there.

### Not a place: the AI label

The label that says Auto is an AI is drawn by the host at the window's bottom corner on every chat route, outside the
theme's page and frame ([contract.md](contract.md#the-ai-label)). No slot reaches it, a theme never draws a second
copy, and no mascot, glow or effect sits over its corner.

## How Play places Auto

Play ships twelve states: `hello`, `idle`, `listening`, `thinking`, `working`, `searching`, `reading`, `celebrate`,
`oops`, `sleeping`, `lost` and `loading`, each as `.webm`, `.mp4` and `.png`. Its reducer picks the state from the
chat's events (`@automatos/mascot`, `packages/mascot/src/`, which Play bundles), and every Auto carries a caption, a
polite live region saying what he is doing.

| Where | State | Size | Caption |
|---|---|---|---|
| Chat, first open | `hello`, then `idle` | large | none while the headline says it (`hello`, `idle`, `listening`) |
| Chat, a turn | from the turn's events: thinking, working, searching, reading, celebrate, oops | regular | the state's caption, such as "Working on it" |
| Chat, while the page loads | `loading` | regular | "Loading" |
| Chat, a voice session (Play 1.2.0) | from the host's session (`useVoice`): listening, thinking, `idle` while he speaks with his ring following his voice (`readVoiceLevels`), oops, `loading` while it waits for the microphone | as the chat's | "Listening", "Thinking", "Speaking" |
| Chat on a phone (below 1024 px) | as on a desktop | small, beside his caption over the message box | the state's caption |
| Deliverables shelf | from the shelf: idle, celebrate on a new Deliverable | small | "Your report is ready" for a new report |
| Conversations (`/x/conversations`) | `idle` (none on a phone) | regular | "Ready when you are" |
| 404 (`notFound@1`) | `lost` | regular | none: the screen's own text speaks |
| Asleep (in the frame) | `sleeping` | large | none: the screen's own text speaks |
| Look preview (`/looks`) | `celebrate` | regular | "Ta-da." |
| Style sheet (`/looks/style`) | every state, as stills until you play the clips | regular | none: decorative |

Play uses no placement slot: it replaces `/chat` and `/deliverables` and draws Auto in its own surfaces.

## A mascot drawn in code

A mascot need not be clips: a pixel sprite, an SVG figure or a canvas drawing is the theme's own code, drawn in its
own surfaces. It keeps the same rules (below), and three things work differently:

- **Its states.** `@automatos/mascot` still picks the state: name it under `dependencies` at its version and use its
  reducer and events (`@automatos/mascot/reducer`, `/events`, `/types`: `MASCOT_STATES`, `mascotReducer`,
  `mascotEventsFromStatus`, `mascotEventsFromReply`) with the chat's status and parts, as Play's and HUD's chats do.
  `theme.json` `mascot.states` lists the states the theme draws.
- **One-shots end on a timer.** The reducer ends a one-shot (`hello`, `celebrate`) on `{ type: 'clip-ended', state }`,
  which a clip player sends at its clip's end. With no clip, send it yourself after the loop has played a few times
  (two or three seconds), and under reduced motion after the same time, showing the still meanwhile.
- **The pause control stops everything that moves**: the mascot's frames and any cursor, ticker or typing out
  beside it ([pitfalls.md](pitfalls.md), "Motion that can't stop"). `MascotPauseButton` is named "Pause Auto"; a theme
  pausing more than Auto draws its own toggle, named for what it does, kept the same way.
- **The phone's stills** are each state's first frame as a PNG, `assets/mascot/<state>.png`. Draw them from the same
  code in a test, with the harness's PNG writer (`@automatos/theme-harness/png`: `encodePng` and `decodePng`), and
  hold the committed files to what the code draws, pixel for pixel
  ([design-a-mascot](../skills/design-a-mascot/SKILL.md)).

## Rules every mascot keeps

- **Motion can stop.** A clip that loops needs a pause control beside it (WCAG 2.2.2). Play's Pause Auto control sits
  under every live Auto and keeps the choice through the SDK's `storage` area; until the host knows the saved choice,
  Auto shows his still and the control is disabled.
- **Reduced motion.** When `useMediaPreferences().reducedMotion` is true (it always is on the server), show the still.
  Under an installed theme the host also marks `<html>` with `data-theme-motion="reduce"`.
- **Name and caption, once.** A decorative copy (the style sheet's) has no image role and reads nothing out; a live
  one has one name and one caption.
- **Colours come from the look.** A ring or glow drawn in a fixed colour fails on some ground; derive it from the
  look ([pitfalls.md](pitfalls.md)).
