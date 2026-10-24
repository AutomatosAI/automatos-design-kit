# The theme folder

A theme in this kit is one npm workspace under `themes/<slug>/`, laid out as Play's (`themes/play`) and HUD's
(`themes/hud`, which commits its look data instead of building it). The example below
is a theme `acme/harbour` with the class `harbour`; replace both. Every file here is one Play has, cut down.

```
themes/harbour/
  package.json        the workspace: its scripts and exact pins
  theme.json          the manifest (guides/contract.md)
  README.md           the theme's own readme; it ships in the package
  vite.config.ts      the kit's preset, alone
  tsconfig.json       extends the kit's base config
  eslint.config.js    the review's rules, as lint
  vitest.config.ts    the harness preset
  .gitignore          /out/ (and /looks/, /boot/ only if a build writes them)
  design/contrast.json  the colour pairs check design measures (never packed)
  looks/schema.json, looks/presets/*.look.json, boot/prepaint.json   the look data (guides/looks.md)
  assets/             fonts, mascot clips and stills, brand, previews (guides/contract.md)
  src/entry.ts        the entry: defineTheme({ register })
  src/vendor/         outside libraries, copied as source with their licences
  test/               tests on the harness
```

## `package.json`

```json
{
  "name": "@acme/theme-harbour",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "scripts": {
    "build": "vite build",
    "lint": "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "pack": "automatos-theme check design . && automatos-theme pack . --out out"
  },
  "engines": { "node": ">=22.18.0" },
  "devDependencies": {
    "@automatos/eslint-plugin": "0.1.0",
    "@automatos/theme-cli": "0.1.0",
    "@automatos/theme-harness": "0.1.0",
    "@automatos/vite-preset": "0.1.0",
    "eslint": "9.39.5"
  },
  "peerDependencies": { "@automatos/theme-sdk": "1.1.0", "react": "^19.0.0" },
  "peerDependenciesMeta": { "react": { "optional": true } }
}
```

Kit CI runs each of these scripts from the root, in every workspace that defines it. The kit's root tests hold every
workspace to exact pins and to the approved outside packages, and a workspace with tests or a `tsconfig.json` must
define `test` or `typecheck`. `pack` runs `check design` first, so CI measures every preset's colour pairs as well
as packing the theme. Play's `build` also runs `scripts/compile-looks.mjs` first, because its look data is generated
from its catalogue; a theme whose look data is written by hand needs only `vite build`.

## `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`

```ts
// vite.config.ts: the kit's preset alone, as the Marketplace review rebuilds the package.
import { defineConfig } from 'vite'
import { automatosTheme } from '@automatos/vite-preset'

export default defineConfig({ plugins: [automatosTheme({ htmlClass: 'harbour', wrap: 'html' })] })
```

```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "test", "vite.config.ts", "vitest.config.ts"] }
```

```js
// eslint.config.js: the review's JS rules over src/, through @automatos/eslint-plugin.
import automatos from '@automatos/eslint-plugin'

export default [automatos.configs.recommended]
```

```ts
// vitest.config.ts: jsdom, React, Testing Library and the harness's fake SDK, then the theme's own setup.
import { fileURLToPath } from 'node:url'
import { harnessTestConfig } from '@automatos/theme-harness/vitest-preset'
import { defineConfig } from 'vitest/config'

const local = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig(
  harnessTestConfig({ setupFiles: [local('./test/setup.ts')], include: ['test/**/*.test.{ts,tsx}'] }),
)
```

```ts
// test/setup.ts: types the jest-dom matchers the harness adds.
/// <reference types="@testing-library/jest-dom/vitest" />
export {}
```

The review rebuilds the package with `automatosTheme({ entry })` and no config file, so `vite.config.ts` must add
nothing the build depends on: no aliases, no other plugins.

## `theme.json`

```json
{
  "schema": "automatos-theme/v1",
  "id": "acme/harbour",
  "name": "Harbour",
  "version": "0.1.0",
  "description": "Automatos in harbour colours.",
  "engines": { "automatos": "^1.1.0", "sdk": "^1.1.0" },
  "base": "studio",
  "htmlClass": "harbour",
  "minWidth": 1024,
  "tone": "from-look",
  "slots": ["frame@1", "lookEditor@1", "styleSheet@1", "notFound@1"],
  "uses": ["theme", "navigation", "cards", "looks"],
  "look": "paper"
}
```

## `src/entry.ts`

```ts
import './app/harbour.css'

import { defineTheme } from '@automatos/theme-sdk'

import { HarbourFrame } from './frame'
import { LookEditor, LostScreen, StyleSheet } from './screens'

export default defineTheme({
  register(host) {
    host.registerSlot('frame@1', HarbourFrame)
    host.registerSlot('lookEditor@1', LookEditor)
    host.registerSlot('styleSheet@1', StyleSheet)
    host.registerSlot('notFound@1', LostScreen)
  },
})
```

Register what `theme.json` lists, and list what you register: `theme.json` is what the server checks, and wherever
nothing is registered the host draws its own version. The one slot listed but not registered is `asleep@1`, when the
frame draws the asleep screen itself, as Play's does. A screen that is large loads its own chunk (`React.lazy` around
a dynamic import of a relative path, as Play's `src/play-slots.tsx` does), so the frame paints first.

## The frame

```tsx
import type { ReactNode } from 'react'
import { CHAT_HREF, DELIVERABLES_HREF, HeaderUtilities, HostLink } from '@automatos/theme-sdk'

interface FrameProps {
  readonly children?: ReactNode
  readonly fullBleed?: boolean
  readonly autoWidget?: ReactNode
}

export function HarbourFrame({ children, autoWidget }: FrameProps) {
  return (
    <div className="frame">
      <header className="bar">
        <nav aria-label="Harbour">
          <HostLink href={CHAT_HREF}>Chat</HostLink>
          <HostLink href={DELIVERABLES_HREF}>Deliverables</HostLink>
        </nav>
        <HeaderUtilities />
      </header>
      <main className="page">{children}</main>
      {autoWidget}
    </div>
  )
}
```

`frame` and `bar` become `html.harbour .frame` and `html.harbour .bar` when the preset builds the stylesheet, and CSS
modules are named `harbour-<name>-<hash>`.

## A test on the harness

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'

import { HarbourFrame } from '../src/frame'

beforeEach(() => host.reset())

it('draws the page inside the frame, with the host header utilities', () => {
  render(<HarbourFrame><p>The page</p></HarbourFrame>)
  expect(screen.getByText('The page')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Harbour' })).toBeInTheDocument()
})
```

The harness's README (`packages/theme-harness/README.md`) lists every control of the fake host (`setHealth`,
`setWidth`, `setLooks`, `setChatScript`, `setStorage` and the rest) and the fixtures the fake SDK answers from.
