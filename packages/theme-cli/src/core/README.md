# Vendored core validators

`pack` refuses what the core reader refuses. The manifest, look and prepaint checks are the core's own
TypeScript twins of the server's validators, copied here with only the edits listed below so the two cannot drift by accident.

Source: `AutomatosAI/automatos-ai` at `101a0bf33f64fb4f89af81b4293415be60b661ac` (main, 22 Oct 2026: host contract and SDK
1.1.0, with the theme format's optional `mobile` block; these files are unchanged since `7ae677b52`).

| File here | Core file | Edits |
|---|---|---|
| `css-value.ts` | `frontend/lib/theme-host/css-value.ts` | import paths only |
| `look-schema.ts` | `frontend/lib/theme-host/look-schema.ts` | import paths only |
| `package-manifest.ts` | `frontend/lib/theme-host/package-manifest.ts` | import paths; the `PAGE_SCOPE` comment reworded |
| `mobile-manifest.ts` | `frontend/lib/theme-host/mobile-manifest.ts` | import paths only |
| `engines.ts` | `frontend/lib/theme-host/engines.ts` | none |
| `plain-line.ts` | `frontend/lib/text/plain-line.ts` | none |
| `host.ts` | values from `shared-modules.json`, `constants.ts`, `lib/look-kit/validate.ts` | written here |

The import edits: `@/lib/text/plain-line` becomes `./plain-line.ts`; `@/lib/look-kit/validate`, `./constants`
and `./sdk` become `./host.ts`; `./css-value`, `./engines` and `./mobile-manifest` gain their `.ts` extension (Node
runs the CLI with type stripping, which needs the extension).

The test corpus `test/fixtures/core/cases.json` and the hello theme `test/fixtures/core/hello/` are copied from
`orchestrator/tests/fixtures/themes/` at the same commit, byte for byte.

`check` (`src/check/`) reads two of the server's data files, copied from the same commit byte for byte, with no
edits; `test/check-report.test.ts` holds each to the sha256 here, and `CORE_SHA` in `src/check/report.ts` to the
commit above:

| File here | Core file | sha256 |
|---|---|---|
| `data/core-pages.json` | `orchestrator/services/themes/data/core-pages.json` | `7e75db4867bfea7450f68e31f5d1a7e073404b1107876d57a83d3b180b6539ba` |
| `data/sdk-surface.json` | `orchestrator/services/themes/data/sdk-surface.json` | `fa37c9b1c356f735df5e34ad7adf22707828995d546292e2a286114c37f58031` |

## `check design` and `design/contrast.json` (kit only)

`check design <theme folder>` (`src/check/design.ts`) checks a theme's design before any of its code: `looks/schema.json`
and its presets through `src/looks.ts` over the vendored `look-schema.ts`, and `boot/prepaint.json` through the
vendored `css-value.ts`, each with core's codes. It then paints every preset from the prepaint table as the host's
first paint does and measures each text and ground pair the theme declares in `design/contrast.json`. The painting
is ported, not copied, at the commit above (the boot script is a string literal and boot-sanitize.ts imports much
of the host, so neither is vendored). The table as the host keeps it and the fit check are `bootTable` and
`lookFits` in `src/mobile-paint.ts`, the CLI's one port of `sanitizePrepaint` and `lookFitsPrepaint` in
`frontend/lib/theme-host/boot-sanitize.ts` (`THEME_BOOT_SCRIPT`'s `fits`), which `pack` also uses for a `mobile`
block's `fromLooks`. The paint is `firstPaint` in `src/check/contrast.ts`: `THEME_BOOT_SCRIPT`'s paint in
`frontend/lib/theme-host/boot.ts` on the kept table, every variable it sets, which core's
`frontend/lib/theme-host/looks/paint.ts` repeats as a pure function. It is not `src/mobile-paint.ts`'s `paintLook`,
the server's `paint_look` (`mobile_tokens.py`), which keeps only the triplet Studio tokens a phone draws and leaves
numeric rules out. The table's tone rule paints no variable, so `bootTable` leaves it out: boot.ts reads it only to
decide whether an installed theme's first paint takes its tone from the look runtime's tone cookie.

The ratio is the look runtime's own: Play's copy of `frontend/lib/look-kit/contrast.ts`, imported from
`themes/play/src/lib/look-kit/`, never copied, and `check design` reads a triplet with Play's copy of `hsl.ts`, loaded
through a resolve hook (hsl.ts imports `./contrast` with no extension). The review's mobile measure,
`src/check/mobile-contrast.ts`, imports the same `contrast.ts` but ports `hsl.ts`'s `hslToHex`, as the server's
`parse_colour` reads a phone token, so `check` registers no hook; the corpus's `contrast` cases hold both readings.
That folder is named in `src/check/contrast.ts` (its imports and the `LOOK_KIT` URL its hook matches) and in
`src/check/mobile-contrast.ts`'s import; a move of Play's look-kit moves them all. `check` loads look-kit's
`contrast.ts` alone (it imports nothing); only `check design` registers the hook and loads `hsl.ts`:
`check/index.ts` imports `design.ts` when that command runs.

`design/contrast.json` is kit-only. `pack` never packs `design/` (it is not one of the package's folders) and the
server never reads it, so its pairs are measured by the kit alone: the server measures only the `mobile` block's ten
Studio pairs (PRD-261 M-03), and declared pairs for every look stay kit-only for v1 (PRD-261 QB-40). The kit's own
codes are `BAD_CONTRAST_PAIRS`, `CONTRAST_UNDER_MIN`, `CONTRAST_NOT_MEASURED`, `PRESET_NOT_IN_PREPAINT`,
`PREPAINT_DEFAULTS_UNFIT` and `NOT_A_FOLDER` (a file where `looks/`, `looks/presets/`, `boot/` or `design/` goes);
every other code `check design` prints is core's.

## Re-vendoring

When core changes one of these files, copy it again from core `main`, redo the import edits above, update the
commit here, read every comment in the copy (this repo is public: reword any that names a person or an internal
decision log), and copy `cases.json`, `hello/` and the two `data/` files from the same commit (their sha256 rows and
`CORE_SHA` move with it). `test/core-corpus.test.ts` then holds the copy to the core corpus. Read `boot.ts`'s
`THEME_BOOT_SCRIPT` and `boot-sanitize.ts`'s `sanitizePrepaint` and `lookFitsPrepaint` at the new commit too: port a
change to the table or the fit into `src/mobile-paint.ts` (`bootTable`, `lookFits`) and a change to the paint into
`src/check/contrast.ts` (`firstPaint`), and move the line numbers both cite.

Not vendored: the zip reader and the CSS scope check exist only in Python (`orchestrator/services/themes/package.py`
and `css_scope.py`). `src/members.ts`, `src/files.ts` and `src/check-package.ts` port the reader's rules, the
`mobile` block's included (PRD-261 M-02: `src/files.ts` the `.ttf` and `.otf` fonts in `assets/fonts/mobile/`,
`src/check-package.ts` the files the block names and, through `src/mobile-paint.ts` (the boot's `sanitizePrepaint`
and fit check, shared with `check design`, and the server's `paint_look`), the first paint `fromLooks` needs), and
`@automatos/vite-preset/css-scope` ports the scope check; the corpus cases `packages` and `cssScope` hold both ports
to the server's verdicts. The review stage is Python too (`review_stage.py`, `scan.py`, `sdk_uses.py`, `drift.py`,
the preview rule of `listings.py`, and `mobile_contrast.py`, the WCAG AA measure of a `mobile` block's colour pairs):
`src/check/` ports it over the two data files, the contrast check included (`src/check/mobile-contrast.ts`, which paints
`fromLooks` through `src/mobile-paint.ts` and takes its ratio from look-kit's `contrastRatio`, Play's copy of core's
`frontend/lib/look-kit/contrast.ts`, the same file at this commit). Its `check-uses`, `check-drift` and
`check-report` tests repeat the cases of core's `orchestrator/tests/test_prd261_review_stage.py` at the same commit,
and `check-mobile-contrast` those of `orchestrator/tests/test_prd261_mobile_contrast.py`, the corpus's `contrast` cases
among them (Play's `test/mobile.test.ts` holds look-kit's `contrastRatio` to the same cases).
