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
| looks | `setLooks` (a look runtime, its check and its forced tone) | through `useLook` and `listLooks` |
| assets | `setFilesRoot` | `askedPaths()` |
| storage | `setStorage({ ready, persisted, themeId, userKey, workspaceKey })`, `changeInAnotherTab` | the window's storage |
| pages | `setPageQuery`, `setPageAction`, `setDatabaseKnowledge`, `setDatabaseCall` | `pageAsks()`, `pageRuns()`, `pageRefetches()`, `boardStreams()` |
| chat, Deliverables (B-02c) | `setChatScript`, `setConversations`, `setDeliverables`, `setDetail`, `setBlobUrls` | `startedChats()`, `conversationsAsked()`, `deliverablesAsked()`, `detailsAsked()`, `downloadsAsked()` (each with the theme's words for a failure) |
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
this package names none of its own. `tests/kit-ci.test.ts` holds each pin exact, React DOM at React's version, and
every outside package on the kit's approved list.
