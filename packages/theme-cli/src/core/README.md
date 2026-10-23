# Vendored core validators

`pack` refuses what the core reader refuses. The manifest, look and prepaint checks are the core's own
TypeScript twins of the server's validators, copied here with only the edits listed below so the two cannot drift by accident.

Source: `AutomatosAI/automatos-ai` at `0dd8b846e41772c8dd7ef159e4373bcb9419b06a` (main, 20 Oct 2026: host contract and SDK 1.1.0).

| File here | Core file | Edits |
|---|---|---|
| `css-value.ts` | `frontend/lib/theme-host/css-value.ts` | import paths only |
| `look-schema.ts` | `frontend/lib/theme-host/look-schema.ts` | import paths only |
| `package-manifest.ts` | `frontend/lib/theme-host/package-manifest.ts` | import paths; the `PAGE_SCOPE` comment reworded |
| `engines.ts` | `frontend/lib/theme-host/engines.ts` | none |
| `plain-line.ts` | `frontend/lib/text/plain-line.ts` | none |
| `host.ts` | values from `shared-modules.json`, `constants.ts`, `lib/look-kit/validate.ts` | written here |

The import edits: `@/lib/text/plain-line` becomes `./plain-line.ts`; `@/lib/look-kit/validate`, `./constants`
and `./sdk` become `./host.ts`; `./css-value` and `./engines` gain their `.ts` extension (Node runs the CLI with type
stripping, which needs the extension).

The test corpus `test/fixtures/core/cases.json` and the hello theme `test/fixtures/core/hello/` are copied from
`orchestrator/tests/fixtures/themes/` at the same commit, byte for byte.

`check` (`src/check/`) reads two of the server's data files, copied from the same commit byte for byte, with no
edits; `test/check-report.test.ts` holds each to the sha256 here, and `CORE_SHA` in `src/check/report.ts` to the
commit above:

| File here | Core file | sha256 |
|---|---|---|
| `data/core-pages.json` | `orchestrator/services/themes/data/core-pages.json` | `8d588ffc0c47db1386d73d253cbc5c6f4439076ca88b37ce50fc13eea9fbebc1` |
| `data/sdk-surface.json` | `orchestrator/services/themes/data/sdk-surface.json` | `fa37c9b1c356f735df5e34ad7adf22707828995d546292e2a286114c37f58031` |

## Re-vendoring

When core changes one of these files, copy it again from core `main`, redo the import edits above, update the
commit here, read every comment in the copy (this repo is public: reword any that names a person or an internal
decision log), and copy `cases.json`, `hello/` and the two `data/` files from the same commit (their sha256 rows and
`CORE_SHA` move with it). `test/core-corpus.test.ts` then holds the copy to the core corpus.

Not vendored: the zip reader and the CSS scope check exist only in Python (`orchestrator/services/themes/package.py`
and `css_scope.py`). `src/members.ts` and `src/check-package.ts` port the reader's rules, and
`@automatos/vite-preset/css-scope` ports the scope check; the corpus cases `packages` and `cssScope` hold both ports
to the server's verdicts. The review stage is Python too (`review_stage.py`, `scan.py`, `sdk_uses.py`, `drift.py`,
and the preview rule of `listings.py`): `src/check/` ports it over the two data files, and its `check-uses` and
`check-drift` tests repeat the cases of core's `orchestrator/tests/test_prd261_review_stage.py` at the same commit.
