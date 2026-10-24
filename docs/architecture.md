# How the kit fits together

The kit is one npm workspace tree: `packages/*` are the build tools and the libraries a theme bundles, `themes/*` are
theme packages. A theme is built by Vite with the kit's preset, packed by the CLI into an `.autotheme` file, and
drawn either by an Automatos server or, with nothing of Automatos running, by the kit's browser harness. This page
says how the parts connect; [cli.md](cli.md) has every command, and each package's README has its details.

## The packages

| Package | Role | Kit packages it uses |
|---|---|---|
| `@automatos/vite-preset` (`packages/vite-preset`) | The Vite plugin every theme builds with, `automatosTheme()`: the ES library output, the import map's modules left external, one stylesheet scoped under the theme's class, and the source guard | none (`postcss`; `vite` as a peer) |
| `@automatos/theme-cli` (`packages/theme-cli`) | `automatos-theme`: `pack`, `check`, `new`, `brief`, `clone`, `dev`, `shots`, `previews`, `install`, `submit`; the vendored core validators in `src/core/` | vite-preset, theme-harness, theme-rules, look-kit |
| `@automatos/theme-harness` (`packages/theme-harness`) | The vitest preset a theme's tests run on (jsdom, React, Testing Library, a fake SDK, a fake host) and the browser harness, a mock host page in `app/` | theme-cli (core's manifest validator), theme-sdk, vite-preset |
| `@automatos/theme-sdk` (`packages/theme-sdk`) | The SDK's type declarations, version 1.1.0, vendored from core; types only | none |
| `@automatos/theme-rules` (`packages/theme-rules`) | The Marketplace review's JS rules, as one table of data | vite-preset (its import refusals) |
| `@automatos/eslint-plugin` (`packages/eslint-plugin`) | The same rules as ESLint rules, one per code, for a theme's `lint` | theme-rules |
| `@automatos/look-kit` (`packages/look-kit`) | A kit library: a look's custom properties, Studio's tokens, WCAG contrast, HSL triplets, the look validator | none |
| `@automatos/mascot` (`packages/mascot`) | A kit library: Auto's state machine, clip player, media chooser, captions, ring tones, chat events, the Pause Auto control | none |

`look-kit` and `mascot` set `"kitLibrary": true` in their `package.json`. That field is what makes a kit package one
a theme bundles: a theme that names one under `dependencies`, at the library's own version, gets its `src/` built into
the theme's `dist/` and packed into the theme's `source/`. No other kit package is ever bundled: the SDK stays the
host's, and the build tools stay out.

## The flow

```text
 themes/<name>/                                       packages/look-kit/src/, packages/mascot/src/
   theme.json, src/, looks/, boot/, assets/              (kit libraries the theme names under dependencies)
        |                                                     |
        |  npm run build: vite build + automatosTheme()       |
        +---------------------------+-------------------------+
                                    |   @automatos/vite-preset: the source guard, React and the SDK external,
                                    |   dist/theme.css wrapped under html.<htmlClass> and scope-checked
                                    v
                     dist/entry.js, dist/chunks/*.js, dist/theme.css
                                    |
        automatos-theme pack        |   collects the package files, src/ as source/, the libraries' src/ as
        (check runs pack first)     |   source/packages/<name>/src/; checks them as core's reader does
                                    v
              <publisher>.<slug>-<version>.autotheme   +   <publisher>.<slug>-<version>.sha256.json
                    |                       |                          |
   automatos-theme check          automatos-theme install     automatos-theme submit
   review stage port, theme-rules,     local Automatos          Marketplace: a person reviews with
   --rebuild: scripts/review/                                    theme-review.yml, signs with theme-sign.yml
   rebuild.ts

 automatos-theme dev / shots  -->  @automatos/theme-harness: vite.harness.config.ts builds app/ (the mock host)
                                   with the theme's src/entry.ts and the fake SDK
                                   dev:   served on 127.0.0.1:4319, rebuilt after each change under src/
                                   shots: vite preview on 127.0.0.1:4318, Playwright on Chromium and WebKit, axe
```

## The build and the source guard

A theme's `vite.config.ts` is `defineConfig({ plugins: [automatosTheme()] })`. `vite build` writes:

- `dist/entry.js`, an ES module, with lazy imports in `dist/chunks/`. `react`, `react/jsx-runtime`, `react-dom`,
  `react-dom/client` and `@automatos/theme-sdk` stay imports: the host serves them through its import map. Any other
  entry point of React, react-dom or the SDK, `sonner`, and a stylesheet imported as text or a URL fail the build.
- `dist/theme.css`: every stylesheet the theme imports, CSS modules included, in one file, every rule put under
  `html.<htmlClass>` (or `:where(html.<htmlClass>)` with `wrap: 'where'`), every `@keyframes` name and `@font-face`
  family renamed to start with `<htmlClass>-`, then checked exactly as the server checks it
  (`src/css-scope.ts`, a port of core's `css_scope.py`).

The build is a production build whatever `NODE_ENV` or `--mode` says, so an author's build writes the bytes the
Marketplace review's rebuild writes.

The source guard keeps the build to the theme's own `src/` and the `src/` of each kit library it bundles. It judges
what the build actually read and wrote, not how a reference was spelled:

- `src/source-guard.ts`: Vite's `load` refuses any module that is not a file under those `src/` folders: an import
  that climbs out, an absolute path, an `import.meta.glob` match outside, a package from `node_modules`. A kit
  library's name is resolved by the preset itself to its `src/`, never through `node_modules`.
- `src/css-origin.ts`: the stylesheet's PostCSS run refuses CSS taken in from a file outside `src/`.
- `src/output-check.ts`: the output is refused when a chunk lists a module from outside `src/`, imports at run time
  anything but the host's shared modules and its own chunks, emits an asset made from a file outside `src/`, or
  inlines a `data:` URL that is not the content of a file under `src/`.

A scan of `new URL(…, import.meta.url)` and CSS `url()`, `@import`, `image-set()` and `composes … from` gives an
early error naming the file. An outside library a theme needs is copied into its `src/vendor/` as source, with its
licence (Play's `src/vendor/` holds `lucide-react`, `zustand` and `use-sync-external-store`). The Marketplace review
rebuilds `source/` with the same preset and the same guard, so a theme that builds for its author builds in the
review.

## The package

`automatos-theme pack` writes a plain zip (`packages/theme-cli/src/zip.ts`): every member deflated, in path order,
one fixed time (1980-01-01 00:00), no folder entries, no zip64. The same files always give the same bytes. Inside:

```text
theme.json                               the manifest, schema automatos-theme/v1
README.md, CHANGELOG.md, LICENSE[.md|.txt]
dist/entry.js                            the entry module; its default export is defineTheme({ register })
dist/chunks/<name>.js                    lazy chunks
dist/theme.css                           the one stylesheet
boot/prepaint.json                       the first-paint table
looks/schema.json                        the look format
looks/presets/<id>.look.json             the presets
assets/fonts/<name>.woff2                web fonts, with their licences (.txt, .md)
assets/fonts/mobile/<name>.ttf|.otf      a phone's fonts (the mobile block)
assets/mascot/<state>.webm|.mp4|.png     the mascot's clips and stills
assets/brand/<name>.png|.webp            the wordmark
assets/previews/<name>.png               the Marketplace listing's previews
source/<path under src/>                 the theme's src/, byte for byte
source/packages/<name>/src/<path>        each bundled kit library's src/, byte for byte
```

Only those paths may be in a package; the caps and the reader's other rules are in
[guides/contract.md](../guides/contract.md). `design/` (the kit's own contrast pairs), `signatures/`,
`package.json`, `vite.config.ts` and `node_modules` are never packed.

Beside the zip, `<publisher>.<slug>-<version>.sha256.json` records `{schema: "automatos-theme-pack/v1", id, version,
digest, zipSha256, files}`: each file's content type, size and sha256, the package digest, and the zip's own sha256.
The package digest (`src/digest.ts`, core's `digest.py`) is the sha256 of the sorted `<path>\0<sha256>\n` lines of
its files, so it depends on the files alone, never on the zip's order, times or compression. Core names and serves an
installed theme's files under it, the admin queue shows it, and a signature covers it.

The review rebuilds a package in the kit's layout (`scripts/review/rebuild.ts`): `source/` written out as
`themes/theme/src/`, each `source/packages/<name>/src/` as `packages/<name>/src/` beside it, then `vite build` from
the theme folder with `automatosTheme()` alone: no `package.json`, `tsconfig.json`, `vite.config.*` or PostCSS
config of the package's. Its `dist/` must match the package's byte for byte. That is why a kit library may not set
`sideEffects`, and why a theme's build must not depend on its own config.

## What the kit takes from core

The package format belongs to core (`AutomatosAI/automatos-ai`); where the kit and core disagree, core wins and the
kit is fixed. The kit vendors core's contract at commit `99fb70ff5c837e9b7a1da40b8234d364b34b19d4` (host contract
1.1.0, SDK 1.1.0, with the `mobile` block), the commit `packages/theme-cli/src/core/README.md` names:

- **The validators**, copied with only their import paths edited, into `packages/theme-cli/src/core/`: core's
  `frontend/lib/theme-host/` `css-value.ts`, `look-schema.ts`, `package-manifest.ts`, `mobile-manifest.ts` and
  `engines.ts`, and `frontend/lib/text/plain-line.ts`. `host.ts` holds the host values they import (the host and SDK
  versions, the `htmlClass` and look-id patterns).
- **The server's data**, byte for byte, each held to a sha256 by a test: `data/core-pages.json` (the hashes of the
  core page files a clone copies, for the `clonedFrom` check) and `data/sdk-surface.json` (the SDK's names by area,
  for the `uses` check). `data/contract.json` is four lists of core's `contract.py` (the known and required slots,
  the pages a theme may replace and the core files a clone copies, the host-owned routes), written as JSON; the
  guides are held to it.
- **The corpora**: core's shared test cases (`test/fixtures/core/cases.json`), its review corpus
  (`review-cases.json`) and its hello test theme (`hello/`). `test/core-corpus.test.ts` holds `pack`'s checks to the
  server's verdicts and `test/review-corpus.test.ts` holds `check` to the server's review stage.
- **The SDK's types**: `packages/theme-sdk` is core's `frontend/packages/theme-sdk` at the same commit, every
  declaration unchanged.
- **Ports**, where core's code is Python: the zip reader and its file kinds (`src/members.ts`, `src/files.ts`,
  `src/check-package.ts`), the CSS scope check (`@automatos/vite-preset/css-scope`), the review stage
  (`src/check/`), and the host's first paint (`src/mobile-paint.ts`, `src/check/contrast.ts`).

`check` prints the commit on its first line (`CORE_SHA` in `src/check/report.ts`). Taking a newer core is a
re-vendor: copy the files again from one commit, redo the import edits, move every sha256 row and `CORE_SHA`
together, and let the corpus tests hold the copy (`packages/theme-cli/src/core/README.md`, "Re-vendoring").

The harness's fakes are ported from core too: each fake SDK area's doc comment names the core file and lines it
mirrors, at core commit `101a0bf33f64fb4f89af81b4293415be60b661ac`, and the host's fonts in
`packages/theme-harness/app/fonts/core/` are core's own files, each pinned by sha256.

## The harness

`@automatos/theme-harness` runs a theme without an Automatos host, in two ways.

**In tests.** `harnessTestConfig()` (`src/vitest-preset.ts`) gives a theme's vitest jsdom, React's automatic JSX
runtime, the jest-dom matchers, `@automatos/theme-sdk` aliased to the harness's fake SDK (`src/sdk/`, one module per
area, every name held to the vendored types by name and by type), and a network refusal: `fetch` and
`XMLHttpRequest` throw. `host` (`@automatos/theme-harness/host`) sets what the host would say (the workspace, the
role, the edition, health, width, tone, looks, storage, chat scripts, Deliverables) and reads back what the theme
asked of it (navigations, notices, chat turns, card actions, network calls). The fakes answer from recorded, made-up
fixtures in `fixtures/`, never from a backend.

**In a browser: the mock host.** `app/` is a page that draws a theme as core's host does. `vite.harness.config.ts`
builds it for one theme folder (`AUTOMATOS_HARNESS_THEME`):

- the theme's `src/entry.ts` is bundled with the page, its bare imports resolved by the harness's import map
  (`src/host/import-map.ts`): the same five specifiers core's import map serves, React from the kit's install and the
  SDK to the fake;
- its CSS is made as the preset makes `dist/theme.css`, then wrapped under `html.<htmlClass>`;
- `theme.json` is checked with core's own validator, and the entry's `register(host)` runs as core's loader runs it
  (`src/host/register.ts`): an unknown slot, page or route, a second registration or a missing frame stops the theme;
- before the theme draws, `<html>` gets the base's class, the theme's class and the active look painted from
  `boot/prepaint.json` (`src/host/prepaint.ts`);
- the host draws what `theme.json` declares and the theme registers (`src/host/router.ts`): `lookEditor@1` on
  `/looks`, `styleSheet@1` on `/looks/style`, a page on its route, a route under `/x/`, and the host's own page for
  any other path, inside the theme's frame;
- a toolbar switches the view, preset, width, tone, reduced motion and forced colours, each kept in the address.

`automatos-theme dev` serves that build on `127.0.0.1:4319` with Node's own `http`, rebuilt after each change under
`src/`. `automatos-theme shots` previews it on `127.0.0.1:4318` and shoots it with Playwright on Chromium and WebKit,
with an axe scan of each shot; a shot fails on any request to another origin. The harness shows that a theme draws;
it does not show that core draws it the same way.

## The phone

A phone app never loads a theme's code. `theme.json`'s optional `mobile` block is data: Studio's colour tokens per
scheme (`tokens`) or the member's look painted through `boot/prepaint.json` (`fromLooks`), up to three `.ttf` or
`.otf` faces in `assets/fonts/mobile/`, and the mascot's clips or stills. `pack` checks the block as core does
(`src/core/mobile-manifest.ts`, and `src/check-package.ts` for the files it names and the first paint `fromLooks`
needs), and `check` measures its colour pairs as the review does. Core turns the block into the answer of
`GET /api/themes/mobile/{install_id}` (core's `docs/theme-host/mobile.md`). [guides/contract.md](../guides/contract.md)
has the block field by field.

## Review, signing and CI

- `scripts/review/` is the Marketplace review job (`theme-review.yml`): no network, the package checks (the CLI's
  reader port), the digest against the admin queue's, `source/` present, the JS rules on `source/`, and the
  reproducible build.
- `scripts/sign/` signs an approved version's `{id, version, digest, files}` with Ed25519 (`theme-sign.yml`), prints
  the `.sig.json` envelope, and verifies an envelope against a package and `keys/theme-signing.json`.
- `scripts/release/released-unchanged.mjs` keeps a released theme version's files as its tag has them.
- `.github/workflows/kit.yml` runs that guard, then `npm ci` and the root `build`, `lint`, `typecheck`, `test` and
  `pack` scripts over every workspace, `packages/*` before `themes/*`; its `harness` job runs `shots` over Play and
  HUD and a smoke of `dev`.

[releasing.md](releasing.md) has the release, review, signing and lockfile workflows step by step.
