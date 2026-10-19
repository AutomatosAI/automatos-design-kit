# @automatos/vite-preset

Builds an Automatos theme the way the host loads it.

```ts
// themes/<name>/vite.config.ts
import { defineConfig } from 'vite'
import { automatosTheme } from '@automatos/vite-preset'

export default defineConfig({ plugins: [automatosTheme()] })
```

`vite build` then writes:

- `dist/entry.js`: an ES module (lazy imports go to `dist/chunks/`). `react`, `react/jsx-runtime`, `react-dom`,
  `react-dom/client` and `@automatos/theme-sdk` stay imports: the host serves them through its import map.
  Importing `sonner` fails the build (toasts go through the SDK's notices), as does any other entry point of React,
  react-dom or the SDK, and a stylesheet imported as text or a URL (`?inline`, `?raw`, `?url`).
- `dist/theme.css`: every stylesheet the theme imports, CSS modules included, in one file. Every rule is put under
  the theme's class on `<html>`, every `@keyframes` name and `@font-face` family is renamed to start with
  `<htmlClass>-`, and the result is checked exactly as the server checks it (`src/css-scope.ts`, a port of core's
  `css_scope.py`). A rule the wrap can't fix, `!important`, `@import` or an at-rule the server does not allow
  fails the build with the server's reasons.

## Options

| Option | Default | What it does |
|---|---|---|
| `htmlClass` | `theme.json`'s `htmlClass` | The class every rule is put under. |
| `wrap` | `'html'` | `'html'`: `html.<htmlClass>` (specificity 0,1,1). `'where'`: `:where(html.<htmlClass>)` (specificity 0). |
| `entry` | `src/entry.ts` | The theme's entry module. |
| `cssMinify` | `false` | Minify `dist/theme.css` with Vite's CSS minifier. The scope check reads the output either way. |

CSS modules are named `<htmlClass>-[local]-[hash]`, which keeps their keyframes inside the theme's names.

Only the theme's own `src/` goes into the build (`src/source-guard.ts`). The build fails on a module from anywhere
else (a relative import that climbs out of `src/`, an absolute path, an `import.meta.glob` match outside it, a
package from `node_modules`), on a `new URL('…', import.meta.url)` or a CSS `url()`, `@import`, `image-set()` or
`composes … from` that is absolute or leaves `src/`, and on a run-time import that is not one of the host's shared
modules. The entry must sit under `src/`. The Marketplace review rebuilds a package's `source/` with this guard, so
a theme that builds for its author builds in the review.

Then pack the theme with `automatos-theme pack` (`packages/theme-cli`).
