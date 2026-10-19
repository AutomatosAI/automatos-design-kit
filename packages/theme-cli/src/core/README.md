# Vendored core validators

`pack` refuses what the core reader refuses. The manifest, look and prepaint checks are the core's own
TypeScript twins of the server's validators, copied here with only the edits listed below so the two cannot drift by accident.

Source: `AutomatosAI/automatos-ai` at `c6fbcb0d0988ac4cfb4871c7565c71238215fc2d` (main, 19 Oct 2026).

| File here | Core file | Edits |
|---|---|---|
| `css-value.ts` | `frontend/lib/theme-host/css-value.ts` | import paths only |
| `look-schema.ts` | `frontend/lib/theme-host/look-schema.ts` | import paths only |
| `package-manifest.ts` | `frontend/lib/theme-host/package-manifest.ts` | import paths; the `PAGE_SCOPE` comment reworded |
| `engines.ts` | `frontend/lib/theme-host/engines.ts` | none |
| `plain-line.ts` | `frontend/lib/text/plain-line.ts` | none |
| `host.ts` | values from `shared-modules.json`, `constants.ts`, `lib/looks/types.ts` | written here |

The import edits: `@/lib/text/plain-line` becomes `./plain-line.ts`; `@/lib/looks/types`, `./constants` and
`./sdk` become `./host.ts`; `./css-value` and `./engines` gain their `.ts` extension (Node runs the CLI with type
stripping, which needs the extension).

The test corpus `test/fixtures/core/cases.json` and the hello theme `test/fixtures/core/hello/` are copied from
`orchestrator/tests/fixtures/themes/` at the same commit, byte for byte.

## Re-vendoring

When core changes one of these files, copy it again from core `main`, redo the import edits above, update the
commit here, read every comment in the copy (this repo is public: reword any that names a person or an internal
decision log), and copy `cases.json` and `hello/` from the same commit. `test/core-corpus.test.ts` then holds the copy
to the core corpus.

Not vendored: the zip reader and the CSS scope check exist only in Python (`orchestrator/services/themes/package.py`
and `css_scope.py`). `src/members.ts` and `src/check-package.ts` port the reader's rules, and
`@automatos/vite-preset/css-scope` ports the scope check; the corpus cases `packages` and `cssScope` hold both ports
to the server's verdicts.
