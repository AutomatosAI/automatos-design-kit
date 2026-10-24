# Play's history

Play began as core's builtin interface (`AutomatosAI/automatos-ai`, under `frontend/`). Under PRD-261 it became an
installable theme, `automatos/play`, built in this kit (`themes/play`). This page records where its code came from
and where Play lives now. It sits outside Play's package, so it can change without a new Play version.

## Where Play's code came from

- **The code.** Core's merge `ebedc7eb8d7f7f9d032706728a7f420a9e833392` (AutomatosAI/automatos-ai#1232) ported
  builtin Play onto `@automatos/theme-sdk`. Play's `src/` is copied from core at that commit and keeps core's
  `frontend/` layout, so every relative import is the one core had. `themes/play/README.md` names the commit and
  lists every line the package changes from core's text, with the reason for each.
- **The files.** Auto's clips and stills (`themes/play/assets/mascot/`, core's `frontend/public/auto/`) and the
  display faces with their licences (`themes/play/assets/fonts/`, core's `frontend/app/fonts/play/`) are copied at
  the same commit, byte for byte. So is the builder of the first-paint table (`scripts/looks/play-prepaint.ts`, core's
  `frontend/lib/theme-host/builtin/play-prepaint.ts`), with only its imports changed.
- **The storage port.** From Play 1.1.0 the package keeps its state through the host's storage area, not browser
  storage (PRD-261 E3g; the README's table lists the files). Its tests first ran on a port of core's storage area at
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
- **The look runtime and Auto's core.** From Play 1.1.1 (PRD-261 B-01i), Play's copy of core's look runtime
  (`src/lib/look-kit/`) is the kit package `packages/look-kit` (`@automatos/look-kit`), and Auto's reducer, player,
  media, ring, types, events and tool names (`src/lib/mascot/`) with the Pause Auto control
  (`src/components/mascot/mascot-pause-button.tsx`) are `packages/mascot` (`@automatos/mascot`). Play names both
  under `dependencies`, imports them by name and bundles their `src/`, which its package carries under
  `source/packages/`. Their tests moved with them, and the ledger's rows name the tests there.

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

`themes/play/README.md` is packed into Play's package, so it changes only with a new Play version. Until then its
"Until A-19" section still describes the rule that kept core's copy and this one in step. That rule ended with the
merge above. Its Build section still says the storage tests run on `test/storage-port.ts`; they run on the theme
harness's storage area now (above).
