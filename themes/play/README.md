# Play

Play is the Automatos theme with Auto, the mascot: its own frame and sidebar, a chat with Auto, a shelf of
Deliverables, a Conversations page, and looks you pick and tweak (Make it yours, and the style sheet). This folder
builds it as an installable theme package, `automatos/play` (PRD-261).

## Where the code comes from

Play's code is copied from core (`AutomatosAI/automatos-ai`) at commit
`ebedc7eb8d7f7f9d032706728a7f420a9e833392`, the merge that ported builtin Play onto `@automatos/theme-sdk`.
`src/` keeps core's `frontend/` layout, so every relative import is the one core has:

- `components/play`, `components/looks`, `components/mascot`;
- `lib/play`, `lib/looks`, `lib/mascot`, and `lib/look-kit` (the look runtime, vendored next to the looks);
- the hooks and the store Play's code imports (`hooks/use-*.ts`, `stores/play-chat-store.ts`);
- `lib/text/plain-line.ts`, the one other core file the copied code reads (`lib/look-kit/validate.ts`);
- `app/play-theme.css`, Play's tokens and base rules (core's `frontend/app/play-theme.css`);
- outside `src/`, the package's files: `assets/mascot/` (core's `frontend/public/auto/`, the 36 clips and stills) and
  `assets/fonts/` (core's `frontend/app/fonts/play/`, the four display faces and their OFL licences), byte for byte.
  Auto's clips are **not committed here** until the image rights are confirmed (PRD-001, open question 1): the
  build fetches them from core at the commit `mascot.lock.json` pins, checking each one's sha256 and size
  (`scripts/fetch-mascot.mjs`), so `assets/mascot/` exists only in a build. Once the rights are confirmed they can
  be committed and the fetch step dropped.

Core's tests are not copied. The copied files are core's text, except for these lines:

| File | Change | Why |
|---|---|---|
| `lib/look-kit/validate.ts` | `'@/lib/text/plain-line'` becomes `'../text/plain-line'` | a theme has no `@/` alias |
| `stores/play-chat-store.ts` | `'zustand'` becomes `'../vendor/zustand/index.js'` | the build reads only `src/` (below) |
| `components/play/shell/play-frame.tsx`, `play-sidebar.tsx` | `'lucide-react'` becomes `'../../../vendor/lucide-react/index.js'` | the same |
| `components/play/shell/play-frame.tsx`, `components/play/chat/message-list.tsx`, `play-chat-view.tsx`, `components/play/edges/asleep-gate.tsx` | `RefObject<T>` becomes `RefObject<T \| null>` (6 types) | the kit types React 19, whose `useRef<T>(null)` is a `RefObject<T \| null>`; core's React 18 types accept both |
| `components/play/chat/labels.ts`, `lib/looks/scope.ts` | a comment no longer names a person | this repo is public |
| `lib/mascot/media.ts` | `MASCOT_DIR` is `'assets/mascot'`; `posterUrl` and `clipUrls` build each URL with the SDK's `assetUrl(path)` and give `undefined` where it gives `null`; the header comment says where the files are | an installed theme's files are served from its package, under a URL only the host knows |
| `components/mascot/auto-mascot.tsx` | two comments say `assets/mascot/` for `public/auto/` | the same |
| `app/play-theme.css` | the header names `src/entry.ts` and `app/play-fonts.css`; the 6 `!important` are gone (below) | a theme's CSS may hold no `!important` |

The vite-preset refuses any module from outside `src/`, `node_modules` included, so the Marketplace review can
rebuild the package from its `source/` alone. The two icons and the store library Play's code uses are therefore
copied into `src/vendor/` as source, at the versions core pins, with their licences (`src/vendor/README.md`).

What Play registers is core's builtin list (`frontend/lib/theme-host/builtin/play-slots.tsx`, `play-entry.ts`):
`src/entry.ts` registers `frame@1`, `lookEditor@1`, `styleSheet@1` and `notFound@1`, the `/chat` and
`/deliverables` pages and the route `conversations` (`/x/conversations`). `theme.json` declares the same, plus
`asleep@1`, which Play's frame draws itself. The pages keep the core page for the link parameters core keeps it for
(`keepCorePage`); the host's own layouts still say which `?tab=` values the theme's Deliverables page serves.

## Styles and assets

The entry imports `app/play-fonts.css` and `app/play-theme.css`, then the components import their 25 CSS modules;
the preset puts all 27 into `dist/theme.css`, every rule under `html.play` (D2-c), keyframes renamed `play-…`.
`test/css.test.ts` runs the preset's wrap and the server's scope check over each file and over the whole sheet.

- **The cascade (FX-01).** The wrap leaves a rule that is already under `html.play` as it is, so every rule of
  `play-theme.css` and every FX-01 rule of the modules (`:global(html.play) …`, the headings, keys and code that must
  outrank Studio's `.studio h1`) keeps core's specificity. Every other module rule gains exactly (0,1,1).
- **The 6 `!important`** (the motion stop, three declarations in each of two rules: the OS setting and
  `data-pl-motion="reduce"`) are gone. Each rule's selector carries `:not(#play-none)`, an id no element has, which
  adds (1,0,0): it outranks every selector without an id, and no Play selector has one, nor sets a motion inline.
- **The forced-colours rings** (`[aria-pressed="true"]` and its `:focus-visible`) name the wrap twice
  (`html.play:is(html.play)`), so they gain the same (0,1,1) as the modules: against every module rule that sets an
  outline, the comparison comes out as in core.
- **Fonts.** core's `app/play-fonts.ts` (next/font/local) becomes `app/play-fonts.css`: one `@font-face` per file, the
  families `play-instrument-serif`, `play-bricolage-grotesque` and `play-fredoka`, and the variables core's catalogue
  reads (`--pl-font-instrument-serif`, `--pl-font-bricolage`, `--pl-font-fredoka`). The `url()`s are relative to
  `dist/theme.css` as the host serves it (`../assets/fonts/…`); the build leaves them as written, since `src/` has no
  `assets/` folder. Geist stays the host's (`--font-geist-sans`, `--font-geist-mono`).
- **The mascot.** `lib/mascot/media.ts` asks `assetUrl('assets/mascot/<state>.<png|webm|mp4>')` for each file. Every
  clip is under the 1 MB cap (the largest, `celebrate.mp4`, is 277,691 bytes); `test/assets.test.ts` holds the sizes,
  the byte signatures and the names.
- **The wordmark** is text ("Automatos Play", `components/play/edges/wordmark.tsx` and the sidebar), so there is no
  `assets/brand/`.

## Until A-19: a Play change goes into both repositories

Builtin Play stays in core until A-19 removes it. Until then, **a change to Play in core must be made here too, and
the reverse**, with each pull request naming the other. Take the change from core by file and record the new core
commit above. Keep the table of changed lines true.

## Looks and the first paint

`scripts/compile-looks.mjs` (at the kit's root) writes Play's look data from `src/lib/looks/catalogue.ts` and
`presets.ts`, and Play's build runs it first. The three kinds of file it writes are generated, never edited, and
kept out of git (`.gitignore`):

- `looks/schema.json`: the look format (`automatos-interface-look/v1`, interface `play`) and its six knobs, each
  catalogue section's keys as a choice and the glow as a whole number from 0 to 40, with Ember's values as the
  defaults. It is core's `orchestrator/services/themes/data/play-look-schema.json` byte for byte
  (`tests/fixtures/core/`).
- `looks/presets/<id>.look.json`: the five presets, Ember (the default, `theme.json`'s `look`), Obsidian, Aurora,
  Workshop and Daylight.
- `boot/prepaint.json`: the table core's boot script paints a stored look from before first paint: every
  catalogue entry's `--pl-*` variables and Studio tokens, the accent-on-ground pairs, and the glow as a
  numeric-knob rule, capped at each ground and accent's safe glow. The builder is core's
  `frontend/lib/theme-host/builtin/play-prepaint.ts`, copied at the commit above into `scripts/looks/play-prepaint.ts`
  with only its imports changed, and the table's types are core's (`scripts/looks/boot-types.ts`), so the package
  and builtin Play paint from the same table.

`tests/compile-looks.test.ts` holds the files to core's look and CSS-value checks and paints every preset from the
table as the boot script does, against Play's engine.

## Build

- `npm run build`: `node ../../scripts/compile-looks.mjs .` (above), then `vite build` with `@automatos/vite-preset`, every rule under `html.play` (decision D2-c, so
  Play's cascade over Studio's rules stays as it is in core). React and the SDK come from the host's import map.
- `npm run typecheck`, `npm test`: the TypeScript check and the static tests in `test/` (imports, `theme.json`
  against core's validator, the entry's registrations, the stylesheets' scope and cascade, the assets and their URLs).
- `npm run pack`: `automatos-theme pack` into `out/`: `automatos.play-1.0.0.autotheme` and its `.sha256.json`, checked
  as core's reader checks a package (the caps: the entry 300 KB, JS and CSS 3 MB, each clip 1 MB; the scope check on
  `dist/theme.css`). Kit CI uploads both as the `kit-themes` artifact.
