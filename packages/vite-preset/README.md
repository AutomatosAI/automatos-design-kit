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
| `packages` | the theme's kit packages | The kit workspace packages to bundle, each `{ name, dir }`. Left out, the ones the theme's `package.json` names (below). |

CSS modules are named `<htmlClass>-[local]-[hash]`, which keeps their keyframes inside the theme's names.

The build is a production build whatever `NODE_ENV` or `--mode` it runs under: `process.env.NODE_ENV` is
`'production'`, `import.meta.env.DEV` is `false`, `PROD` `true` and `MODE` `'production'` (in the whole
`import.meta.env` object too), and JSX compiles for production React. So a theme built under `NODE_ENV=development`
writes the bytes the Marketplace review's rebuild writes (`test/preset-env.test.ts`).

Only the theme's own `src/` goes into the build, and the `src/` of each kit workspace package it bundles. A theme
bundles a kit library by naming it, at the library's own version, under `dependencies` in its `package.json`:
`@automatos/<name>`, the kit's `packages/<name>/` two folders up from the theme (`themes/<theme>/`), whose
`package.json` sets `"kitLibrary": true`, such as `@automatos/look-kit` and `@automatos/mascot` for Play
(`src/workspace-packages.ts`). No other kit package is bundled, even named under `dependencies`: the SDK stays the
host's, and a build tool's files are refused like any outside `src/`. The preset resolves the name
itself, never through `node_modules`: `@automatos/<name>` is the package's `src/index` and `@automatos/<name>/<module>`
its `src/<module>`, each `.ts`, `.tsx`, `.js` or `.jsx`, as the package's `exports` map says for tsc and vitest. The
theme CLI packs such a package's `src/` as `source/packages/<name>/src/`, and the Marketplace review rebuilds it there
in the same layout. The review has no `package.json` of the package, so a bundled package may not set `sideEffects`
(the preset refuses one that does). The checks read what the build actually read and wrote, so how a reference is
spelled (a CSS escape, a comment, a string built at run time) does not matter:

- `load` refuses a module from anywhere else: a relative import that climbs out of `src/` (or out of a bundled
  package's `src/`), an absolute path, an `import.meta.glob` match outside it, a package from `node_modules`
  (`src/source-guard.ts`).
- The stylesheet's PostCSS run refuses CSS taken in from a file outside `src/`, however the `@import` was written
  (`src/css-origin.ts`). The preset gives Vite its PostCSS plugins, so a `postcss.config.*` beside `src/` is not read.
- The output is refused when a chunk lists a module from outside `src/` or imports at run time anything but the
  host's shared modules, when an emitted asset was made from a file outside `src/`, or when it inlines a `data:` URL
  that is not the content of a file under `src/` (`src/output-check.ts`). Vite inlines every `url()` and
  `new URL('…', import.meta.url)` asset in library mode, whatever `build.assetsInlineLimit` says, so the check reads
  the inlined bytes.

Before those, a scan of `new URL('…', import.meta.url)` and CSS `url()`, `@import`, `image-set()` and
`composes … from` references gives an early error naming the file and the reference. It is only a friendly early
error, except for `composes … from`, where it is the only check. A Sass, Less or Stylus file's own imports are not
checked. The entry must sit under `src/`. The Marketplace review rebuilds a package's `source/` with these checks, so
a theme that builds for its author builds in the review.

Then pack the theme with `automatos-theme pack` (`packages/theme-cli`).
