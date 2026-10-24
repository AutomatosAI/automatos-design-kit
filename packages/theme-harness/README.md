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
(`fixtures/README.md` says what each fixture holds; every fixture is made-up data).

## The fake host

`host` (`@automatos/theme-harness/host`, `src/host.ts`) sets what the host would say and reads back what a theme
asked of it. `host.reset()` puts it all back: the local edition's one operator in `WORKSPACE_DEFAULTS`, online,
the backend up, a 1280-pixel window over a 1024-pixel `minWidth`, the light tone, the OS motion setting as
`matchMedia` says (jsdom has none: motion allowed), no look runtime, no package files, `STORAGE_DEFAULTS` with no
theme state kept, and nothing asked.

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
workspace does (`tests/workspace-deps.test.ts`).

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
  for a theme that owns `/`, so no two views share a path). Below `minWidth`, and after a failed load or a throw
  while drawing, the host's own page stands alone, the latter with core's notice.
- **Before the theme draws** (`src/host/prepaint.ts`): `<html>` gets the base's class, the theme's class, the active
  look painted from `boot/prepaint.json`, the tone and the host's status, as core's boot puts them there.
- **The host's fonts** (`app/fonts/core`, core's own files; its README names core's commit and pins each file's
  sha256): Geist, Geist Mono and Newsreader, which core supplies to every page. The page (`app/index.html`) declares
  their `@font-face` rules with the weights and styles core declares, and binds `--font-geist-sans`,
  `--font-geist-mono` and `--font-newsreader` on `<html>` with one class each, as core's layout does, so a theme's
  `var(--font-geist-sans)` text draws in Geist, not in the browser's default face. The rules stay in the page, apart
  from the theme's stylesheet and its wrap; the build emits the files under `harness/`.
- **The toolbar** (`app/toolbar.tsx`): the view, the preset (the look runtime is mounted on it, and a look the
  theme's editor sets paints too), the width (the window's, 1440, 1024, or just below `minWidth`), the tone (off
  while the theme or its look forces one), reduced motion and forced colours. A page cannot turn the browser's media
  features on, so the build copies a theme's `@media (prefers-reduced-motion: reduce)` and `@media (forced-colors:
  active)` rules under the toolbar's two attributes, and forced colours paints the system colours over the page.
  The shots ask the browser itself for reduced motion; forced colours is the toolbar's preview only, and no shot
  draws it. Each setting is in the address, so a reload opens the same view.

- **The phone view** (`/phone`, the toolbar's Phone view link; below).

`shots/` photographs it (`automatos-theme shots`, kit CI's `harness` job): Playwright on Chromium and WebKit, one
test per preset and width, each waiting on the host's status, the network, the fonts and the images (never a fixed
sleep), with reduced motion on and animations off. Each PNG gets an axe scan of the theme's stage (`shots/axe.ts`);
a set's scans go to its `axe.json`. A set fails when its folder does not hold exactly one PNG per slot, page and
route that `theme.json` declares, less what the page reports the theme did not register (a route's `/` is `_` in its
file name, so no two views share one); when the page's presets are not the folder's, default look first; on any
request to another origin than `http://127.0.0.1:4318`; and on a critical axe violation. A `theme.json` naming a
default look that `looks/presets/` lacks stops the shots before they start. It proves a theme draws, not that core
draws it the same way: core's browser lane does that.

`shots/dev-smoke.config.ts` is the smoke of `automatos-theme dev` (kit CI's `harness` job, after the shots): its web
server is `automatos-theme dev themes/play`, and `shots/dev-smoke.spec.ts` opens `/chat` there on Chromium and checks
that Play started, that its own `/chat` page is on the stage with Auto saying hello over the message box, and that
every request stayed on `http://127.0.0.1:4319`; then it opens `/phone` and checks the phone view says Play is the
phone's built-in layout and draws Play's `/chat` there, beside the contrast panel. Its shots and a failed test's trace
go to `dist/shots/dev-smoke/`.

## The phone view

`/phone` (`app/phone/`) is what Automatos Go, the Automatos phone app, draws for the theme, at an iPhone's 390 × 844
points, a point a pixel, beside the contrast `automatos-theme check` measures for it. Both servers answer it with the
same page (`PAGE_PATHS` in `src/host/router.ts`), and its settings are in the address (`src/phone/settings.ts`): the
screen (Chat, the Command Centre, First open), the user's Light / Dark, the member's look and reduced motion. It reads
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
  member's looks, and reads none of the block. The harness has no native layout, so the view says so and draws the
  theme's own web screens at the phone's width instead, through the mock host (Chat on `/chat`, the Command Centre on
  `/command-center`, First open on `/`), with the look switch as its preset.

The contrast panel is `check`'s own measure (theme-cli's `mobile-contrast`, `src/phone/contrast.ts`): the outcome and
reason in `check`'s words, then the ten pairs of the scheme or look on screen, each with its ratio, its minimum and its
result. `test/phone-*.test.tsx` hold the view to the app's paint and the panel to `check` (the hello fixture, Play and
HUD), and the dev smoke opens `/phone` on Play in Chromium.
