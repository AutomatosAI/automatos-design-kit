# Play's history

Play began as core's builtin interface (`AutomatosAI/automatos-ai`, under `frontend/`). Under PRD-261 it became an
installable theme, `automatos/play`, built in this kit (`themes/play`). This page records where its code came from
and where Play lives now. It sits outside Play's package, so it can change without a new Play version.

## Where Play's code came from

- **The code.** Core's merge `ebedc7eb8d7f7f9d032706728a7f420a9e833392` (AutomatosAI/automatos-ai#1232) ported
  builtin Play onto `@automatos/theme-sdk`. Play's `src/` is copied from core at that commit and keeps core's
  `frontend/` layout, so every relative import is the one core had. What was copied, and every line the package
  changes from core's text with the reason for each, are below (Play's README held them until Play 1.1.0).
- **The files.** Auto's clips and stills (`themes/play/assets/mascot/`, core's `frontend/public/auto/`) and the
  display faces with their licences (`themes/play/assets/fonts/`, core's `frontend/app/fonts/play/`) are copied at
  the same commit, byte for byte. So is the builder of the first-paint table (`scripts/looks/play-prepaint.ts`, core's
  `frontend/lib/theme-host/builtin/play-prepaint.ts`), with only its imports changed.
- **The storage port.** From Play 1.1.0 the package keeps its state through the host's storage area, not browser
  storage (PRD-261 E3g; the table below lists the files). Its tests first ran on a port of core's storage area at
  `0dd8b846e41772c8dd7ef159e4373bcb9419b06a` (E3g's `themes/play/test/storage-port.ts`, since removed). Since
  PRD-261 B-02b they run on the theme harness's storage area, core's ported at
  `101a0bf33f64fb4f89af81b4293415be60b661ac` (`packages/theme-harness/src/sdk/storage.ts` over
  `packages/theme-harness/src/internal/theme-state-rules.ts`), and `themes/play/test/storage-port.test.ts` holds it
  to core's rules.
- **The tests.** Play's tests moved from core into `themes/play/test/`, read at core commit
  `101a0bf33f64fb4f89af81b4293415be60b661ac`, and the tests of the storage port's files at
  `0dd8b846e41772c8dd7ef159e4373bcb9419b06a`. Each move is a row in `themes/play/test/moved-from-core/<area>.json`:
  the core test, the kit test that replaces it, and the core tests that now hold any assertion the kit test does not
  (`rehomed`). `themes/play/test/moved-from-core.test.ts` holds the ledger to the files.
- **The kit packages.** Since Play 1.1.1 the look kit (`lib/look-kit`) is the kit's `packages/look-kit`
  (`@automatos/look-kit`), and Auto's state machine, player, media chooser and Pause Auto control (from `lib/mascot`
  and `components/mascot`) are `packages/mascot` (`@automatos/mascot`) (PRD-261 B-01i). Play bundles both; its package
  carries their source under `source/packages/<name>/src/`.

### What was copied

Into `themes/play/src/`, at the commit above:

- `components/play`, `components/looks`, `components/mascot`;
- `lib/play`, `lib/looks`, `lib/mascot`, and `lib/look-kit` (the look runtime, vendored next to the looks);
- the hooks and the store Play's code imports (`hooks/use-*.ts`, `stores/play-chat-store.ts`);
- `lib/text/plain-line.ts`, the one other core file the copied code reads (`lib/look-kit/validate.ts`);
- `app/play-theme.css`, Play's tokens and base rules (core's `frontend/app/play-theme.css`);
- outside `src/`, the package's files: `assets/mascot/` (core's `frontend/public/auto/`, the 36 clips and stills) and
  `assets/fonts/` (core's `frontend/app/fonts/play/`, the four display faces and their OFL licences), byte for byte.

Core's tests were not copied with the code (they moved later, above).

### The lines the package changes from core's text

The copied files are core's text, except for these lines. Each row names the file where it was copied to, under
`themes/play/src/`; the look kit's files and Auto's player have lived in the kit packages since Play 1.1.1 (above).

| File | Change | Why |
|---|---|---|
| `lib/look-kit/validate.ts` | `'@/lib/text/plain-line'` becomes `'../text/plain-line'` | a theme has no `@/` alias |
| `stores/play-chat-store.ts` | `'zustand'` becomes `'../vendor/zustand/index.js'` | the build reads only `src/` (Play's README, "Source") |
| `components/play/shell/play-frame.tsx`, `play-sidebar.tsx` | `'lucide-react'` becomes `'../../../vendor/lucide-react/index.js'` | the same |
| `components/play/shell/play-frame.tsx`, `components/play/chat/message-list.tsx`, `play-chat-view.tsx`, `components/play/edges/asleep-gate.tsx` | `RefObject<T>` becomes `RefObject<T \| null>` (6 types) | the kit types React 19, whose `useRef<T>(null)` is a `RefObject<T \| null>`; core's React 18 types accept both |
| `components/play/chat/labels.ts` | a comment no longer names a person | this repo is public |
| `components/play/conversations/play-conversations-lazy.tsx` | a comment says "a dynamic import of a relative path" for `import()` | the Marketplace review's JS rules read comments too, and refuse an `import(` with no quoted path after it |
| `lib/mascot/pause.ts`, `lib/mascot/session.ts`, `lib/play/seen.ts`, `hooks/use-celebrate-new.ts` | rewritten onto the SDK's storage area (`readThemeState`, `writeThemeState`, `removeThemeState`, `subscribeThemeState`): Auto's pause is `mascot-paused` (browser, account, `true` or no value), hello's first open `hello-played` (session, account), the seen Deliverables `seen-deliverables` (browser, workspace, the same record and `SEEN_CAP`); no `localStorage` or `sessionStorage`, no look scope, and no move of records kept before | PRD-261 E3g: a theme keeps its state through the host, and the Marketplace review refuses browser storage |
| `lib/play/seen.ts`, `hooks/use-celebrate-new.ts` | `markSeen` adds only the unseen Deliverables that can still count as new (dated, and newer than the newest seen); the hook skips the host's report of its own `writeSeen`, keeping the record it wrote; the comments say so | the same: the host reports every change, this hook's own write included, so a record that each pass changed (more than `SEEN_CAP` Deliverables, or two chips or tabs taking turns) was written again without end |
| `components/mascot/use-mascot-motion.ts` | the pause snapshot is one string (`'unknown'`, `'paused'`, `'playing'`); until the host knows the flag Auto is a still and the toggle does nothing; `MascotMotion` gains `ready` | the same; no clip loops before the flag is known (WCAG 2.2.2) |
| `hooks/use-auto-mascot.ts` | the `session` option is gone; `greet` is a new function when hello's readiness changes, so the chat page's effect asks again | the same |
| `components/mascot/auto-mascot.tsx`, `mascot-pause-button.tsx` | the Pause Auto control takes `disabled`, and Auto passes `disabled={!motion.ready}`; the header comments say so | the same: until the host knows the flag a press changes nothing, so the control can't be pressed |
| `components/mascot/auto-mascot.module.css` | adds `.pause:disabled` (`cursor: progress`, `color: var(--pl-color-text-2)`, as the shelf's `.moreButton:disabled`) and its comment | the same: the disabled Pause Auto control looked live |
| `lib/looks/scope.ts` | deleted | its one caller was `lib/play/seen.ts`; state kept before the storage area is dropped (PRD-261 E1) |
| `lib/mascot/media.ts` | `MASCOT_DIR` is `'assets/mascot'`; `posterUrl` and `clipUrls` build each URL with the SDK's `assetUrl(path)` and give `undefined` where it gives `null`; the header comment says where the files are | an installed theme's files are served from its package, under a URL only the host knows |
| `components/mascot/auto-mascot.tsx` | two comments say `assets/mascot/` for `public/auto/` | the same |
| `app/play-theme.css` | the header names `src/entry.ts` and `app/play-fonts.css`; the 6 `!important` are gone and the forced-colours rings name the wrap twice (Play's README, "Styles and assets") | a theme's CSS may hold no `!important`, and the wrap must not change which rule wins |
| `app/play-theme.css` | the motion stop's second rule matches `[data-theme-motion="reduce"]`, the host's generic marker, in place of builtin Play's `[data-pl-motion="reduce"]`; `--pl-motion-scale` is `var(--theme-motion, 1)` (Play 1.1.0 read both markers and fell back to `--pl-motion`) | PRD-261 K-19c and K-21: under an installed theme the host's look runtime marks `<html>` with `data-theme-motion` and `--theme-motion`; builtin Play's LookProvider, which set `data-pl-motion` and `--pl-motion`, left core with A-19, and Play 1.1.1 dropped them |
| `components/looks/screen-heading.ts` | `PLAY_ONLY_HEADING` is `data-theme-heading` in place of builtin Play's `data-play-only-heading` (Play 1.1.0 carried both); the header comment says why | PRD-261 K-19c and K-21: `data-theme-heading` is the mark core's ThemeSlotPage hands the focus to under any installed theme; only builtin Play's host looked for the other, and it left core with A-19 |

## Builtin Play leaves core

Core's merge `fd993980e319172ea442491217249000ed85a5e7` (AutomatosAI/automatos-ai#1282, PRD-261 A-19) removed
builtin Play from core: its components, hooks, styles and fonts, Auto's clips and stills, its boot and registrations
(`frontend/lib/theme-host/builtin/`), and its tests. Core's own ledger of the deleted tests names, for each one, the kit test or the core
test that holds its assertions now. Core runs Play only as an installed theme, from the package this kit builds.

Since that merge Play lives only in this kit:

- A change to Play is made here, and only here. There is no copy of Play in core to keep in step.
- A released Play version's packed files never change; a change to them is a new version (`AGENTS.md`, "What CI
  runs").
- Core still owns the package format and the host contract (`AGENTS.md`, "The kit contract"): when they change, the
  kit follows.

## Play's own README

`themes/play/README.md` is packed into Play's package, so it changes only with a new Play version. Up to Play 1.1.0 it
held this page's record of the copy (the commit, what was copied and the lines changed) and a section on keeping core's
copy and this one in step until A-19. Since Play 1.1.1 its "Where the code comes from" is one line pointing here, and
`themes/play/CHANGELOG.md` lists what each version changed.
