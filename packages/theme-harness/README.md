# @automatos/theme-harness

Runs a theme's tests without an Automatos host: vitest in jsdom, React with Testing Library and user-event, the
jest-dom matchers, `@automatos/theme-sdk` resolved to the harness's fake SDK, and the fake host's controls a test
drives it with. The host serves the real SDK only at run time and the kit vendors its types alone
(`packages/theme-sdk`), so the fake is held to those types by name and by type.

## Use it in a theme

```ts
// themes/<theme>/vitest.config.ts
import { fileURLToPath } from 'node:url'
import { harnessTestConfig } from '@automatos/theme-harness/vitest-preset'
import { defineConfig } from 'vitest/config'

const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(harnessTestConfig({
  setupFiles: [local('./test/setup.ts')],
}))
```

```tsx
// themes/<theme>/test/<name>.test.tsx
import { act, render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

beforeEach(() => {
  host.reset()
})

it('shows the asleep screen while the backend is down', () => {
  render(<Frame />)
  act(() => host.setHealth('down'))
  expect(screen.getByRole('heading', { name: /asleep/i })).toBeInTheDocument()
})
```

`harnessTestConfig(options)` (`src/vitest-preset.ts`) gives:

- **jsdom** for every test file. A test that only reads files (the theme's source, `theme.json`, its assets) runs
  in node instead, by naming that environment in its header comment, as vitest reads it per file.
- **React's automatic JSX runtime**, as the vite-preset builds the theme.
- **The setup**: the harness's own (`src/setup.ts`), its network refusal (`src/no-network.ts`), then
  `setupFiles`. The first turns React's act environment flag on for each file, unmounts what a test rendered
  after it, and adds the jest-dom matchers to `expect`; the second swaps the global `fetch` and `XMLHttpRequest`
  for ones that throw, so a theme's tests never reach a network. vitest's globals stay off, so tests import
  `describe`, `it` and `expect` from `vitest`.
- **`sdk`**: the module the tests get for `@automatos/theme-sdk`. Left out, the harness's fake SDK
  (`src/sdk/index.ts`). Only the bare name is aliased.
- **`include`**: test files, relative to the theme folder; default `test/**/*.test.{ts,tsx}`.

For the jest-dom matcher types, a theme's setup file starts with
`/// <reference types="@testing-library/jest-dom/vitest" />`.

The kit's templates (`templates/minimal`, `templates/full`, which `automatos-theme new` starts a theme from) are no
workspaces, so this package runs their tests on this preset: `test/template-minimal.test.tsx` and
`test/template-full.test.tsx` import each template's test files, the full template's `/agents` clone reading the
fixture agents in `fixtures/agents/`.

## The fake SDK

`src/sdk/<area>.ts` fakes one area of `packages/theme-sdk/areas/*.d.ts` each, every name declared `satisfies` its
SDK type, and `src/sdk/index.ts` re-exports each area's SDK names. Each fake's doc comment names the core file
and lines it mirrors. `test/surface.test.ts` holds the fake's names to the vendored value exports (a name added to
the vendored types fails it until it is faked) and `test/types.test.ts` holds their types (through tsc).

The fakes keep the SDK's rules where a theme depends on them: the href checks, the notice checks, the event
names, the asset path rule, the page areas' id checks, and the storage area, which is core's runtime ported. They
answer from the fake host's state, not a backend. Chat plays recorded turns from `fixtures/streams/`, Deliverables
answer from `fixtures/deliverables/` (or rows a test sets), and the host cards are stand-ins with the cards' props
(`fixtures/README.md` says what each fixture holds; every fixture is made-up data). A stored reply of a conversation may
carry its turn's frames (`frames`, in the stream format), read onto it as the stream reads them, so a conversation
opens with its tool lines and Deliverables. The chrome stand-ins (`src/sdk/cards/chrome.tsx`) take the room core's cards
take, in plain colours: `HeaderUtilities` is core's cluster on the local edition (Help at 30 × 30, the bell at 40 × 40
with a made-up unread badge, a separator, the theme menu at 40 × 40, the account's 36-pixel avatar), each button named
as before; `FirstRunNudge` is core's zero-height anchor with its pill placed over the top of the chat column, so it
takes no room from the chat, with core's words and the link to Settings (a kept click).

The voice area (SDK 1.2.0, `src/sdk/voice.ts`) answers from the fake host's voice session
(`src/internal/voice-session.ts`): `useVoice` a frozen snapshot of it and `stop()`, `readVoiceLevels` the levels a test
set while a session runs (connecting, listening, thinking or speaking), clamped to 0 to 1, and zeros otherwise. The
`VoiceButton` stand-in (`src/sdk/voice-button.tsx`) checks its props as core does and draws core's DOM in plain colours:
the root (`data-voice-button="root"`) with `data-voice-state`, `data-voice-mode`, `data-voice-press`, `data-voice-size`
and `data-voice-mic`, a real `<button>` for the press named by `label` or by what a press does ("Hold to talk", "Talk to
Auto"), sized by `size` and styled by the `--voice-button-*` custom properties a theme sets on core's. While the session
is the button's (its engine, and its `conversation` when it names one) the host's control shows under it in the protected
surface `voice-control`: the "AI voice assistant" caption (a tiny caption in the text's colour, never a pill), the
microphone's state, and Stop (quick-ask) or End call and Close live voice (a Live call); then the microphone prompt
while it connects, and a failure's sentence with Try again and Close. A press moves the session as the host would: a
start listens with the microphone open, a release thinks, a stop ends it (quick-ask back to idle, a call to ended).
`hold` starts on the pointer's press and sends on its release, and a click no pointer made counts as a toggle, as on
core; `toggle` starts, then sends (or ends a call). The hotkey is checked, not listened for. With no host voice on the
page the button is drawn disabled, titled with the reason. `test/voice.test.tsx` holds the stand-ins' behaviour and
`test/voice-types.test.tsx` holds them to the vendored `areas/voice.d.ts`: its phases and the button's modes, presses
and sizes, the snapshot's fields, and every data attribute and custom property it names.

## The fake host

`host` (`@automatos/theme-harness/host`, `src/host.ts`) sets what the host would say and reads back what a theme
asked of it. `host.reset()` puts it all back: the local edition's one operator in `WORKSPACE_DEFAULTS`, online,
the backend up, a 1280-pixel window over a 1024-pixel `minWidth`, the light tone, the OS motion setting as
`matchMedia` says (jsdom has none: motion allowed), no look runtime, no package files, `STORAGE_DEFAULTS` with no
theme state kept, no voice session (the host's voice on the page as `VOICE_DEFAULTS` offers it: quick-ask, and Live
not set up), and nothing asked.

| Area | Controls | Read back |
|---|---|---|
| context | `setWorkspace`, `setRole`, `setEdition`, `setTrial`, `setHealth`, `setOnline`, `setReducedMotion`, `setTone`, `setWidth`, `setMinWidth` | `healthChecks()` |
| navigation | `setPathname`, `setSearchParams`, `setCoreNav` | `navigations()`: router calls and followed links |
| notices | | `notices()`, `dismissals()` |
| events | `emitHostEvent` | `globalSearchOpens()` |
| looks | `setLooks` (a look runtime, its check, its default look and its forced tone) | through `useLook` and `listLooks` |
| assets | `setFilesRoot` | `askedPaths()` |
| storage | `setStorage({ ready, persisted, themeId, userKey, workspaceKey })`, `changeInAnotherTab` | the window's storage |
| pages | `setPageQuery`, `setPageAction`, `setDatabaseKnowledge`, `setDatabaseCall` | `pageAsks()`, `pageRuns()`, `pageRefetches()`, `boardStreams()` |
| chat, Deliverables (B-02c) | `setChatScript`, `continueHeldTurn`, `setConversations`, `setAiLabelShown`, `setChatOpening`, `setTurnEnding`, `setPlanningMissionId`, `setDeliverables`, `setDetail`, `setBlobUrls` | `chatSent()`, `turnsLeft()`, `startedChats()`, `conversationsAsked()`, `deliverablesAsked()`, `detailsAsked()`, `downloadsAsked()` (each with the theme's words for a failure) |
| cards (B-02c) | | `cardActions()`, `markdownViews()` (the props each MarkdownView drew with) |
| voice (SDK 1.2.0) | `setVoice` (any of the session's fields), `setVoicePhase` (the phase, its engine, and the microphone as that engine has it), `setVoiceMic`, `setVoiceWords` (`heard`, `reply`), `setVoiceError`, `setVoiceAvailable` (`VOICE_DEFAULTS` with changes; `null` for no host voice on the page), `setVoiceLevels` | `voiceStops()` (every `stop()`: useVoice's, the button's), `voicePresses()` (each press that reached the host: start, release or stop, with its engine and conversation) |
| network | | `networkCalls()` |

The storage area's workspace follows `setWorkspace`, as the host's scope follows the workspace; a set inside
`act()` renders every component that reads it again.

Beside `host`, the module names what a theme's own fixtures build the chat's parts with: `LIVE_KEY`, the tool-data
key the receipts frame rides under (what `liveReceiptsOf` reads), and `CREDITS_EXHAUSTED_CODE`, the `errorCode` of a
request refused for used-up credits.

## Dependencies

The test toolchain (vitest, jsdom, React, React DOM and Testing Library's `react`, `dom`, `user-event` and
`jest-dom`) is pinned exactly in the kit's root `package.json`, so every workspace runs on the same versions, and
this package names none of its own; so are the shots' Playwright (`@playwright/test`, at the version core's browser
lane pins) and `@axe-core/playwright`. `tests/kit-ci.test.ts` holds each pin exact, React DOM at React's version, and
every outside package on the kit's approved list. The package does name the kit's own packages it loads
(`@automatos/theme-cli` for core's manifest check, `@automatos/theme-sdk`, `@automatos/vite-preset`), as every
workspace does (`tests/workspace-deps.test.ts`). Tailwind's preflight, which the browser harness draws a theme on, is
vendored as source (`src/vendor/tailwind-preflight/`, at the version core pins, with its MIT licence), not installed.

## The browser harness

`app/` is a mock host page that draws a theme in a browser, with no Automatos running: a local design tool, and what
`automatos-theme shots` photographs. `vite.harness.config.ts` builds it for one theme folder
(`AUTOMATOS_HARNESS_THEME`, default `themes/play`) and serves the build on `http://127.0.0.1:4318` (`vite preview`).
`automatos-theme dev <theme folder>` (the theme CLI's README says how) is the same page as a local app: it builds the
harness for the folder into a folder of its own (Vite's `--outDir`), serves only that build on `http://127.0.0.1:4319`
with Node's own `http`, and builds again after each change under the theme's `src/`.

- **The theme's own entry.** The build bundles the folder's `src/entry.ts` with the page. Its bare imports go through
  the harness's import map (`src/host/import-map.ts`), the same specifiers core's import map serves: React from the
  kit's install, `@automatos/theme-sdk` to the fake SDK above. Its CSS is made as the vite-preset makes the
  package's `dist/theme.css`: CSS modules name the classes first (`<htmlClass>-<name>-<hash>`), the build writes one
  stylesheet, and that file is then wrapped under `html.<htmlClass>`, with its keyframes and font families renamed
  once over the whole sheet. Draw from the build (`vite build`, then `vite preview`): the dev server writes no
  stylesheet to wrap. The folder's `assets/` is served where the stylesheet's `../assets/` URLs and the SDK's
  `assetUrl` find it.
- **Core's load.** `theme.json` is checked with core's own validator, then the entry's `register(host)` runs as core's
  loader runs it (`src/host/register.ts`): an unknown slot, page or route, a second registration, a missing frame or
  a throw stops the theme. The host draws what `theme.json` declares and the theme registers; the toolbar lists what
  is declared and not registered, and what is registered and not declared.
- **What the host draws** (`src/host/slots.ts`, `src/host/router.ts`): the fake host's path picks the view, so the
  theme's own links move it too. A slot, page or route sits inside the theme's frame (`lookEditor@1` on `/looks`,
  `styleSheet@1` on `/looks/style`, a page on its route, a route on `/x/<path>`); a path the theme draws nothing for
  is the host's own page inside the frame, the frame's own view among them (on `/`, or on `/harness/slot/frame@1`
  for a theme that owns `/`, so no two views share a path). The frame gets `fullBleed` for a page, a route and the two
  looks pages, as core's `MainLayout fullBleed` draws them (`components/theme-host/theme-slot-page.tsx`); the 404
  (`notFound@1`, on `/harness/not-found`) is drawn alone, with no frame and no Auto widget, as core's
  `app/not-found.tsx` draws it. Below `minWidth`, and after a failed load or a throw while drawing, the host's own
  page stands alone, the latter with core's notice.
- **Before the theme draws** (`src/host/prepaint.ts`): `<html>` gets the base's class, the theme's class, the active
  look painted from `boot/prepaint.json`, the tone and the host's status, as core's boot puts them there.
- **Core's base layer** (`src/host/core-base.ts`): the mock host puts the base every core page draws on first in the
  page's `<head>`, before the theme's stylesheet: Tailwind 3.3.3's preflight with core's theme values
  (`src/vendor/tailwind-preflight/`, MIT, its licence beside it: every box `border-box`, borders reset to `0 solid`, no
  default margins, buttons and fields that inherit their text, images as blocks), then core's `globals.css` base (every
  border in `hsl(var(--border))`, the body on `hsl(var(--background))` and `hsl(var(--foreground))`, with core's values
  of the three for Classic and Studio under the look's own, and Studio's Geist, Newsreader and Geist Mono type). So a
  theme's boxes measure as in core, a box's padding and border inside its width (without it, Play's 232-pixel sidebar
  drew 264 pixels wide). The phone view draws without it.
- **Sample data** (`src/host/sample-data.ts`): the page areas' reads answer with made-up data, as the Deliverables fake
  does: the roster and its counts (`fixtures/agents/`), one running Mission (`fixtures/activity/feed.json`), the day's
  numbers (`useActivityStats`, `stats.json`), six rows across what needs you's five kinds (`useNeedsYou`,
  `needs-you.json`) and four runs a few hours after the fixtures' made-up morning (`useActivitySchedule`,
  `schedule.json`), so a theme's agent, Mission and Command Center panels show rows. A read answers by its hook,
  whatever its filter, window or range (in a theme's tests a read stays loading until the test sets it).
- **The host's fonts** (`app/fonts/core`, core's own files; its README names core's commit and pins each file's
  sha256): Geist, Geist Mono and Newsreader, which core supplies to every page. The page (`app/index.html`) declares
  their `@font-face` rules with the weights and styles core declares, and binds `--font-geist-sans`,
  `--font-geist-mono` and `--font-newsreader` on `<html>` with one class each, as core's layout does, so a theme's
  `var(--font-geist-sans)` text draws in Geist, not in the browser's default face. The rules stay in the page, apart
  from the theme's stylesheet and its wrap; the build emits the files under `harness/`.
- **The toolbar** (`app/toolbar.tsx`): the view, the preset (the look runtime is mounted on it, and a look the theme's
  editor sets paints too), the stage's width (the window's, then, widest first, 1440, 1024, a phone's 390 and just
  below the theme's own `minWidth`; a theme's own media queries answer the window, not the stage, so a layout one of
  them picks, such as a phone layout, shows in a window that narrow, and each shot sizes its window to its group's
  width), the tone (off while the theme or its look forces one), reduced motion, forced colours, the transcript (the
  chat opened on a made-up exchange, `src/host/transcript.ts`: the owner's words, then Auto's reply with a tool line
  and the Deliverable it made, a conversation the backend holds, linked with `?chatId=` as core's deep link opens one)
  and the voice (`src/host/voice.ts`: no session, or a made-up quick-ask session every `VoiceButton` owns, listening
  with the member's words so far, thinking, speaking with Auto's reply, or failed). While the member or Auto speaks,
  `readVoiceLevels` answers a level that moves with the clock, so a theme's waveform animates; under the toolbar's
  reduced motion it holds still, so a shot reads the same levels on every run (the shots' `animations: 'disabled'`
  stops CSS animations, not a theme's own animation frames). A page cannot turn the browser's media features on, so the
  build copies a theme's `@media (prefers-reduced-motion: reduce)` and `@media (forced-colors: active)` rules under the
  toolbar's two attributes, and forced colours paints the system colours over the page. The shots ask the browser itself for reduced
  motion, or for none in the motion group; forced colours is the toolbar's preview only, and no shot draws it. Each
  setting is in the address, so a reload opens the same view.

- **The phone view** (`/phone`, the toolbar's Phone view link; below).

`shots/` photographs it (`automatos-theme shots`, kit CI's `harness` job): Playwright on Chromium and WebKit, one test
per group (`src/host/shot-groups.ts`), each waiting on the host's status, the network, the fonts and the images (never
a fixed sleep), with animations off. Each group sizes the browser's window to its own viewport, so a theme's own media
queries see the width the group shoots, as a browser that size would: 900 px tall at the group's width, or a phone's
390 × 844 (`PHONE_VIEWPORT` in `src/host/router.ts`, the phone view's size too). The groups: every view of each preset
at 1440 and 1024 px, and of the default look just below the theme's own `minWidth`, with reduced motion on; then, for
a theme with a `/chat` page, that page twice more in the default look at 1440 px: with motion allowed
(`<preset>/1440-motion/`: the host's reduced motion off and the browser asked for none, so Auto's clip and the Pause
Auto control beside it are shot), and on the transcript (`<preset>/1440-transcript/`, with reduced motion: a chat with
a conversation on it). Then, for a theme whose own `minWidth` is at most 390 px, so it draws at a phone's width, the
phone-width groups at 390 × 844, with reduced motion: every view of each preset (`<preset>/390/`) and, with a `/chat`
page, that page on the transcript in the default look (`<preset>/390-transcript/`), so the theme's phone layout is
drawn and scanned. Then, for a theme whose `theme.json` `uses` names the SDK's `voice` area, its voice states: the
`/chat` page (or, with none, every view) in the default look at 1440 px, with reduced motion, in each phase of the
made-up voice session but idle, `<preset>/1440-voice-listening/`, `-thinking/`, `-speaking/` and `-error/`, so the
theme's voice button is shot with the host's AI voice caption and stop control, its waveform held still. A theme whose `minWidth` is wider gets none: below it the host draws its own pages, which the group
just below it already shoots. Each PNG gets an axe scan of the theme's stage (`shots/axe.ts`); a set's scans go to its
`axe.json`. A set fails when its folder does not hold exactly one PNG per slot, page and route that `theme.json`
declares (a chat group: the chat page's), less what the page reports the theme did not register (a route's `/` is `_`
in its file name, so no two views share one); when the page's presets are not the folder's, default look first; on any
request to another origin than `http://127.0.0.1:4318`; and on a critical axe violation. A `theme.json` naming a
default look that `looks/presets/` lacks stops the shots before they start. The shots draw a theme on core's base
layer, in core's frames, with stand-ins that take the room core's cards take; they prove a theme draws, not that core
draws it the same way: core's browser lane does that.

`shots/dev-smoke.config.ts` is the smoke of `automatos-theme dev` (kit CI's `harness` job, after the shots): its web
server is `automatos-theme dev themes/play`, and `shots/dev-smoke.spec.ts` opens `/chat` there on Chromium and checks
that Play started, that its own `/chat` page is on the stage with Auto saying hello over the message box, and that
every request stayed on `http://127.0.0.1:4319`; then it opens `/phone` and checks the phone view says Play is the
phone's built-in layout and draws Play's `/chat` there, beside the contrast panel. Its shots and a failed test's trace
go to `dist/shots/dev-smoke/`.

`shots/phone-shots.config.ts` shoots the phone view (kit CI's `harness` job, after the dev smoke): its web server is
`automatos-theme dev fixtures/phone-skin`, a made-up theme with a `mobile` block (`fixtures/README.md`), on the same
`http://127.0.0.1:4319`, and `shots/phone-shots.spec.ts` opens `/phone` there on Chromium with reduced motion. For
Light and for Dark it shoots the phone on Chat, the Command Centre and First open (`<scheme>/<screen>.png`), checking
that the phone paints the skin, that the contrast panel passes the scheme's pairs, that the designer offers the
theme's own block as `skin.json` and that First open shows the theme's still of Auto. Then the skin designer, with a
draft in the address whose muted text fails its pair: the panel marks the pair and offers its nearest passing colour,
the export gives no file, and the whole page is shot (`designer/failing-pair.png`). Each shot gets an axe scan of the
phone's screen (`[data-phone-frame]`: the panels beside it are the harness's, as the toolbar is in the theme shots)
into its folder's `axe.json`; a critical violation, a missing shot or a request to another origin fails the test.
Its files, and a failed test's trace, go to `dist/shots/phone/`. `test/phone-skin-fixture.test.ts` holds the fixture
to core's validator and to `automatos-theme skin`'s own check, so the shots draw a skin that passes.

## The phone view

`/phone` (`app/phone/`) is what Automatos Go, the Automatos phone app, draws for the theme, at an iPhone's 390 × 844
points, a point a pixel, beside the contrast `automatos-theme check` measures for it. Both servers answer it with the
same page (`PAGE_PATHS` in `src/host/router.ts`), and its settings are in the address (`src/phone/settings.ts`): the
screen (Chat, the Command Centre, First open), the user's Light / Dark, the member's look, reduced motion and the skin
designer's draft (below). It reads
the theme's `mobile` block as the phone gets it: theme-cli's `mobile-answer` builds the server's answer from the
folder's files (`GET /api/themes/mobile/{install_id}`; a font or Auto's file only for a file the folder holds, which
the build lists from `assets/`), and theme-cli's `phone` paints it as the app does. What it draws follows the app's
own rule (`src/phone/skin.ts`):

- **A theme with a phone painting**: the app's Studio layout as DOM, painted from it. Each part's colours, the table
  `src/phone/parts.ts` holds with the app file and lines each follows, are the theme's for the 21 tokens the layout
  has a colour for and Studio's for the rest; the thread's boxes mix from them; a pressed card or button takes the
  hover look and the focused message box the ring. The theme's fonts are `@font-face` rules on their role's text.
  Auto shows on First open only (as on the phone): his clip under `clips`, his still under `stills` or reduced
  motion, nothing under `none`. A painting from looks follows the look switch and sets Light / Dark itself. Beside it,
  where each of the 24 tokens lands: its colour, whether the theme set it, and the parts that draw it.
- **A theme with no painting** (no block, or a block that paints no ground and text): the same layout in Studio's own
  colours, saying why the phone offers it none.
- **`automatos/play` and `automatos/hud`**: the phone switches to its own built-in Play or HUD layout, painted from the
  member's looks, and reads none of the block. That layout is part of the app, so the harness can't draw it, and the
  phone says so. The theme's own web screens are no stand-in, whatever the theme's own `minWidth`: Automatos Go runs
  no theme code, and those screens are what a phone's browser draws at or above that width (the shots' phone-width
  groups photograph them for a theme whose `minWidth` fits a phone, above). The contrast panel still measures the
  block, look by look.

The contrast panel is `check`'s own measure (theme-cli's `mobile-contrast`, `src/phone/contrast.ts`): the outcome and
reason in `check`'s words, then the ten pairs of the scheme or look on screen, each with its ratio, its minimum and its
result. `test/phone-*.test.tsx` hold the view to the app's paint and the panel to `check` (the hello fixture, Play and
HUD), the dev smoke opens `/phone` on Play in Chromium, and the phone shots photograph it for the made-up phone skin
(above). [guides/mobile-skins.md](../../guides/mobile-skins.md) is the skin's guide for a theme author.

**The skin designer** (`app/phone/designer/`; its model is `src/phone/designer.ts` and `src/phone/skin-export.ts`)
sits beside the phone for any theme but `automatos/play` and `automatos/hud`, which the phone draws in its own layouts:
for those two it is never offered, whatever the address says. It edits a draft of the `mobile` block, starting from
theme.json's own block, or, with none, from Studio's own colours or from one of the theme's looks turned into its
tokens (the look's colours in the scheme of its tone, Studio's in the other). Once there is a draft, the phone, the
token panel and the contrast panel show the theme with the draft in place of theme.json's block, at every change. Its
controls, each within what the vendored validator takes:

- where the colours come from: the draft's own `tokens`, or `fromLooks` (which needs the theme's `boot/prepaint.json`);
- the schemes: Light alone (the phone then draws Light's colours under Dark too) or Light and Dark;
- each of the 24 tokens of the scheme on screen: a colour picker, and a text field that takes exactly `H S% L%` or
  `#rrggbb` (a value the validator would refuse is marked and not used; an empty field leaves the token to Studio);
- a font for each of `sans`, `serif` and `mono`: Studio's face, or one of the theme's `.ttf` or `.otf` files in
  `assets/fonts/mobile/`, each file for one role;
- Auto: none, stills or clips, with each state's files the mode needs and whether the theme holds each.

The contrast panel marks each failing pair and, for the draft's own colours, offers its fix in one click: the nearest
passing value of the pair's first token (theme-cli's `src/phone/nearest-passing.ts`). The export checks the draft's
block as `automatos-theme skin` checks it (theme-cli's `skin-check`: the validator, then the theme's files and the
contrast). A block the command would write gets **Download skin.json** (a `data:` URL of exactly the block, so nothing
is sent), **Copy** and the text; any other block gets every reason, and no file. `automatos-theme skin <theme folder>
--from skin.json` then writes it into theme.json (`docs/cli-design.md`). The draft is in the address (`skin`, as JSON),
so a reload opens it again, and **Start from theme.json's block** drops it. `test/phone-designer*.test.ts(x)` hold the
designer to the paint, the panel, the export and the address.
