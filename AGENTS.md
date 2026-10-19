# AGENTS.md: automatos-play, the Automatos design kit

This repo is the design kit that builds installable theme packages (`.autotheme`) for Automatos, under
PRD-261 (installable themes). `README.md` and `CLAUDE.md` still describe the earlier pilot and are rewritten
later; where they differ from this file, this file wins.

## The kit contract

The package format belongs to the core repo (`AutomatosAI/automatos-ai`). When the kit and core disagree,
core wins and the kit is fixed.

- Format and checks: `orchestrator/services/themes/{package,manifest,contract,css_scope,digest}.py` and
  `frontend/lib/theme-host/package-manifest.ts`. `theme.json` uses schema `automatos-theme/v1`; only
  whitelisted files; JS + CSS at most 3 MB, the entry at most 300 KB, each clip at most 1 MB.
- CSS: every rule sits under `html.<htmlClass>` (or `:where(html.<htmlClass>)`); no `!important`, no
  `@import`, no selector naming `data-protected-surface`; every `@keyframes` name and `@font-face`
  family starts with `<htmlClass>-`.
- Modules: `react`, `react-dom`, `react/jsx-runtime` and `@automatos/theme-sdk` come from the host's
  import map and stay external. Nothing else is external.
- SDK types: `@automatos/theme-sdk` declarations are vendored from core's `frontend/packages/theme-sdk`,
  by version.

## Layout

- `packages/*`: build tools (the vite preset, the theme CLI, the vendored SDK types).
- `themes/*`: theme packages.
- npm workspaces over both. `tsconfig.base.json` holds the shared compiler options; each workspace's
  `tsconfig.json` extends it.

## What CI runs

`.github/workflows/kit.yml` installs, then runs the root scripts `build`, `lint`, `typecheck`, `test` and
`pack`. Each one runs the same script in every workspace that defines it, `packages/*` before `themes/*`.

- A workspace with `*.test.ts` files defines `test` (vitest); one with a `tsconfig.json` defines `typecheck`.
- A theme that produces a package defines `pack`; CI uploads every `*.autotheme*` it writes.
- `tests/` at the root checks this contract (workspaces, exact pins, the workflow).

## Rules

- Nothing runs on the maintainer's machine. CI is the test.
- Every dependency is pinned to an exact version (the root tests enforce it). A new dependency needs
  the maintainer's OK. Until `package-lock.json` is committed, CI installs with `npm install` and uploads
  the lockfile it resolved as the `kit-lockfile` artifact; once committed, CI uses `npm ci`.
- This repo is public: no secrets, no internal plans, no customer or pricing material.
- Functions at most 50 lines, files at most 400 lines, plain comments.
- Git: stage explicit paths, sign off (`git commit -s`), messages `type(scope): what`.
