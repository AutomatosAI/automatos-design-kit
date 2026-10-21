# @automatos/theme-harness

Runs a theme's tests without an Automatos host: vitest in jsdom, React with Testing Library and user-event, the
jest-dom matchers, and `@automatos/theme-sdk` resolved to a stand-in, since the host serves the real SDK only at
run time and the kit vendors its types alone (`packages/theme-sdk`).

## Use it in a theme

```ts
// themes/<theme>/vitest.config.ts
import { fileURLToPath } from 'node:url'
import { harnessTestConfig } from '@automatos/theme-harness/vitest-preset'
import { defineConfig } from 'vitest/config'

const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(harnessTestConfig({
  sdk: local('./test/sdk-stub.ts'),
  setupFiles: [local('./test/setup.ts')],
}))
```

`harnessTestConfig(options)` (`src/vitest-preset.ts`) gives:

- **jsdom** for every test file. A test that only reads files (the theme's source, `theme.json`, its assets) runs
  in node instead, by naming that environment in its header comment, as vitest reads it per file.
- **React's automatic JSX runtime**, as the vite-preset builds the theme.
- **The setup**: the harness's own (`src/setup.ts`) first, then `setupFiles`. The harness's turns React's act
  environment flag on for each file, unmounts what a test rendered after it, and adds the jest-dom matchers to
  `expect`. vitest's globals stay off, so tests import `describe`, `it` and `expect` from `vitest`.
- **`sdk`**: the module the tests get for `@automatos/theme-sdk`. Left out, the name is not aliased.
- **`include`**: test files, relative to the theme folder; default `test/**/*.test.{ts,tsx}`.

For the jest-dom matcher types, a theme's setup file starts with
`/// <reference types="@testing-library/jest-dom/vitest" />`.

## Dependencies

The test toolchain (vitest, jsdom, React, React DOM and Testing Library's `react`, `dom`, `user-event` and
`jest-dom`) is pinned exactly in the kit's root `package.json`, so every workspace runs on the same versions, and
this package names none of its own. `tests/kit-ci.test.ts` holds each pin exact, React DOM at React's version, and
every outside package on the kit's approved list.

## What comes next

A fake of every SDK area with controls a test drives (workspace, role, edition, tone, health, media preferences,
storage readiness), and fake chat, Deliverables and host cards over fixtures, so a theme's tests run against the
whole SDK surface rather than a theme's own stand-in.
