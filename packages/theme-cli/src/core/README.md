# Vendored core validators

`pack` refuses what the core reader refuses. The manifest, look and prepaint checks are the core's own
TypeScript twins of the server's validators, copied here with only the edits listed below so the two cannot drift by accident.

Source: `AutomatosAI/automatos-ai` at `40a2e00715f069b7f1bbade0d00b287409a16b74`, the head of pull request #1373 on
30 Oct 2026 (phone screenshots: `theme.json`'s `phonePreviews`, PNG or JPEG files in `assets/previews/phone/`, up to
24 web and 24 phone screenshots, and a 32 MB package cap; the core corpus gains their `manifests` and `packages`
cases; the host contract stays 1.1.0 and the SDK 1.2.0). Every file here but `package-manifest.ts` (`host.ts`
included) is the same as at `3d8c72e7b58d32866f058a171d68bbbb8a335504`, the kit's previous pin (main at the merge of
pull request #1365, 28 Oct 2026: the AI label).

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

So is the shared review corpus (PRD-261 B-03e), `test/fixtures/core/review-cases.json`: core's
`orchestrator/tests/test_prd261_review_corpus.py` runs each case through the server's review stage, and
`test/review-corpus.test.ts` runs it through `check`, which must give the level the case expects at each check it
names (sizes, cssScope, looks, uses and clonedFrom). Core keeps the file in one canonical form, so its sha256 moves
only when a case does; the test holds the copy to this row:

| File here | Core file | sha256 |
|---|---|---|
| `test/fixtures/core/review-cases.json` | `orchestrator/tests/fixtures/themes/review-cases.json` | `1bb99a3181af1a9c2a92bc88bc4b2c4fa25c6b42b60e5a29b80f666dfcc51f8e` |

`check` (`src/check/`) reads two of the server's data files, copied from the same commit byte for byte, with no
edits; `test/check-report.test.ts` holds each to the sha256 here, and `CORE_SHA` in `src/check/report.ts` to the
commit above:

| File here | Core file | sha256 |
|---|---|---|
| `data/core-pages.json` | `orchestrator/services/themes/data/core-pages.json` | `7e75db4867bfea7450f68e31f5d1a7e073404b1107876d57a83d3b180b6539ba` |
| `data/sdk-surface.json` | `orchestrator/services/themes/data/sdk-surface.json` | `2418aa818eb6871e66619ddc2eb15f9338d2c0ebc45b4486b7bc8fe89749d191` |

## `data/contract.json` (the guides' lists)

The guides (`guides/`) are held to core's slot ids, pages and host-owned routes through one more data file. Core has
no such file: `data/contract.json` is four lists of `orchestrator/services/themes/contract.py` at the commit above
(that file's sha256 there: `109aaedbbfa8eab5577a7ad63b35cd2756b191ec5e310062e711fab9297abead`), written as JSON with
no other edit: `KNOWN_SLOTS`, `REQUIRED_SLOTS`, `PAGE_SOURCES` (its keys are the routes a theme may replace) and
`HOST_OWNED_ROUTES`. The four lists are the same as at `101a0bf33f64fb4f89af81b4293415be60b661ac`: since then
contract.py changed only its reserved `htmlClass` names, its `SDK_VERSION` (1.2.0) and its package cap (32 MB).
`tests/guides.test.ts` holds the file to the sha256 below and to the copies of the same lists in
`package-manifest.ts`.

| File here | Core source | sha256 |
|---|---|---|
| `data/contract.json` | `orchestrator/services/themes/contract.py`, four lists | `271a457eaf03d5153ceec45f4fe8f4095917e1702203f0032ecd2411308b7728` |

It is written with python3 alone (contract.py imports only the standard library), from a core checkout:

```sh
SHA=<the commit above>
git -C <core checkout> show "${SHA}:orchestrator/services/themes/contract.py" > contract.py
python3 - contract.py "$SHA" > packages/theme-cli/src/core/data/contract.json <<'PY'
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("contract", sys.argv[1])
contract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contract)
print(json.dumps({
    "_comment": f"PRD-261 B-01b: the slots and pages of core's orchestrator/services/themes/contract.py (KNOWN_SLOTS, REQUIRED_SLOTS, PAGE_SOURCES, HOST_OWNED_ROUTES) at commit {sys.argv[2]}, as JSON. Generated with the python3 lines in packages/theme-cli/src/core/README.md. Don't edit by hand.",
    "KNOWN_SLOTS": list(contract.KNOWN_SLOTS),
    "REQUIRED_SLOTS": list(contract.REQUIRED_SLOTS),
    "PAGE_SOURCES": {route: list(files) for route, files in contract.PAGE_SOURCES.items()},
    "HOST_OWNED_ROUTES": list(contract.HOST_OWNED_ROUTES),
}, indent=2))
PY
```

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

The ratio is the look runtime's own: `contrast.ts` of `@automatos/look-kit` (`packages/look-kit`, which starts from
Play's copy of `frontend/lib/look-kit`, PRD-261 B-01i), imported by name, never copied, and `check design` reads a
triplet with look-kit's `hsl.ts`. look-kit's modules import each other with the `.ts` extension, so plain Node loads
them with no resolve hook. The review's mobile measure, `src/check/mobile-contrast.ts`, imports the same `contrast.ts`
but ports `hsl.ts`'s `hslToHex`, as the server's `parse_colour` reads a phone token; the corpus's `contrast` cases
hold both readings. The package is named in `src/check/contrast.ts` (its import and the `import()` of `hsl.ts`), in
`src/check/mobile-contrast.ts`'s import and in this package's `package.json` `dependencies`. `check` loads look-kit's
`contrast.ts` alone (it imports nothing); only `check design` loads `hsl.ts`: `check/index.ts` imports `design.ts`
when that command runs.

`check design` and `check` also refuse what core's browser would leave out of a theme's first paint and looks, which
core's prepaint and look validators at the commit above accept (`src/first-paint.ts`): a knob or pair cell's value the
first paint's gate drops (`BAD_CSS_VALUE`: boot-sanitize.ts `isCssValue`, ported as `src/mobile-paint.ts`
`bootValueProblem`, which also says why), and a `looks/schema.json` knob the table, as `bootTable` keeps it, never
paints (`KNOB_NOT_PAINTED`: `frontend/lib/theme-host/looks/spec.ts` `lookSpecOf` builds the look spec from the table
alone). `check design` lists them on its prepaint line; `check` refuses the theme before its review, as core's reader
refuses a package, and so does the Marketplace review's Package check (`scripts/review/review.ts` `readPackage`, which
theme-review.yml and theme-publish.yml run). Core's reader refuses three more there: a knob the kept table paints that
the schema lacks (`KNOB_NOT_IN_SCHEMA`), defaults that don't fit what the gate keeps (`PREPAINT_DEFAULTS_UNFIT`, the
code `check design` already gives it) and a knob name the gate drops (`BAD_PREPAINT`); the kit takes those with the
re-vendoring below (`check design` already catches the first two, as `PRESET_NOT_IN_PREPAINT` and
`PREPAINT_DEFAULTS_UNFIT`). The codes, paths and sentences are core's reader's once core ships the same two checks
(`orchestrator/services/themes/first_paint.py`, and `prepaint_drop_errors` in `css_value.py` with its TypeScript twin
`prepaintDropErrors` in `css-value.ts`). `pack`'s reader port (`src/check-package.ts`) stays core's at the commit above,
which the vendored corpus's `packages` cases hold it to. The browser harness paints only the values `isBootValue`
keeps (theme-harness `src/host/prepaint.ts`).

`design/contrast.json` is kit-only. `pack` never packs `design/` (it is not one of the package's folders) and the
server never reads it, so its pairs are measured by the kit alone: the server measures only the `mobile` block's ten
Studio pairs (PRD-261 M-03), and declared pairs for every look stay kit-only for v1 (PRD-261 QB-40). The kit's own
codes are `BAD_CONTRAST_PAIRS`, `CONTRAST_UNDER_MIN`, `CONTRAST_NOT_MEASURED`, `PRESET_NOT_IN_PREPAINT`,
`PREPAINT_DEFAULTS_UNFIT` and `NOT_A_FOLDER` (a file where `looks/`, `looks/presets/`, `boot/` or `design/` goes);
every other code `check design` prints is core's.

## Re-vendoring

When core changes one of these files, copy it again from core `main`, redo the import edits above, update the
commit here, read every comment in the copy (this repo is public: reword any that names a person or an internal
decision log), and copy `cases.json`, `review-cases.json`, `hello/` and the two `data/` files from the same commit
(their sha256 rows and `CORE_SHA` move with it), and write `data/contract.json` again with the lines above (its sha256
row moves too; when its lists change, the guides change with them). `test/core-corpus.test.ts` then holds the copy to
the core corpus, and `test/review-corpus.test.ts` holds `check` to the review corpus. Read `boot.ts`'s
`THEME_BOOT_SCRIPT` and `boot-sanitize.ts`'s `sanitizePrepaint` and `lookFitsPrepaint` at the new commit too: port a
change to the table or the fit into `src/mobile-paint.ts` (`bootTable`, `lookFits`) and a change to the paint into
`src/check/contrast.ts` (`firstPaint`), and move the line numbers both cite. Once the commit carries core's
`first_paint.py`, the vendored `css-value.ts` brings `prepaintDropErrors` and the gate with it: then `src/first-paint.ts`
takes them from there, its two checks move into `src/check-package.ts` as the reader's (so `pack` refuses them too,
held by the corpus's new `packages` and `prepaintDrops` cases), and `check` drops its own step.

Not vendored: the zip reader and the CSS scope check exist only in Python (`orchestrator/services/themes/package.py`
and `css_scope.py`). `src/members.ts`, `src/files.ts` and `src/check-package.ts` port the reader's rules, the phone
screenshots' included (`src/files.ts` the PNG and JPEG kinds of `assets/previews/phone/` and the 32 MB package cap,
`src/check-package.ts` the files `phonePreviews` names), and the
`mobile` block's (PRD-261 M-02: `src/files.ts` the `.ttf` and `.otf` fonts in `assets/fonts/mobile/`,
`src/check-package.ts` the files the block names and, through `src/mobile-paint.ts` (the boot's `sanitizePrepaint`
and fit check, shared with `check design`, and the server's `paint_look`), the first paint `fromLooks` needs), and
`@automatos/vite-preset/css-scope` ports the scope check; the corpus cases `packages` and `cssScope` hold both ports
to the server's verdicts. The review stage is Python too (`review_stage.py`, `scan.py`, `sdk_uses.py`,
`audio_capture.py`, `drift.py`, the preview rule of `listings.py` (one rule for web previews and phone screenshots,
`src/check/previews.ts`), and `mobile_contrast.py`, the WCAG AA measure of a
`mobile` block's colour pairs): `src/check/` ports it over the two data files, the audio capture check included
(`src/check/audio.ts`, over `@automatos/theme-rules`' `AUDIO_APIS`, the JS rules' own patterns), and the contrast check
(`src/check/mobile-contrast.ts`, which paints `fromLooks` through `src/mobile-paint.ts` and takes its ratio from
look-kit's `contrastRatio`, `@automatos/look-kit`'s copy of core's `frontend/lib/look-kit/contrast.ts`, the same file at
this commit). Its `check-uses`, `check-drift` and `check-report` tests repeat the cases of core's
`orchestrator/tests/test_prd261_review_stage.py` at the same commit, `check-audio` those of
`orchestrator/tests/test_theme_voice_audio_capture.py`, and `check-mobile-contrast` those of
`orchestrator/tests/test_prd261_mobile_contrast.py`, the corpus's `contrast` cases among them (Play's
`test/mobile.test.ts` holds look-kit's `contrastRatio` to the same cases).
