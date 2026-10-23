# AGENTS.md: automatos-play, the Automatos design kit

This repo is the design kit that builds installable theme packages (`.autotheme`) for Automatos, under
PRD-261 (installable themes). `README.md` and `CLAUDE.md` describe the same kit from a different angle
(install and licensing, and Claude Code working notes); where they differ from this file, this file wins.

## The kit contract

The package format belongs to the core repo (`AutomatosAI/automatos-ai`). When the kit and core disagree,
core wins and the kit is fixed.

- Editions: a built `.autotheme` installs and runs the same way on both the local edition and the hosted
  edition — the format carries no edition switch. The theme CLI is narrower: `pack` and `submit` are
  exercised, and recommended, against the local edition. Hosted CLI auth (a credential `submit` could use
  against a hosted API without a browser sign-in) is parked for now, the maintainer's call, not a gap; until
  it lands, `submit` against a hosted API will usually print the server's 401 or 403.

- Format and checks: `orchestrator/services/themes/{package,manifest,contract,css_scope,digest}.py` and
  `frontend/lib/theme-host/package-manifest.ts`. `theme.json` uses schema `automatos-theme/v1`; only
  whitelisted files; JS + CSS at most 3 MB, the entry at most 300 KB, each clip at most 1 MB.
- CSS: every rule sits under `html.<htmlClass>` (or `:where(html.<htmlClass>)`); no `!important`, no
  `@import`, no selector naming `data-protected-surface`; every `@keyframes` name and `@font-face`
  family starts with `<htmlClass>-`.
- Modules: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` and `@automatos/theme-sdk` come
  from the host's import map and stay external. Nothing else is external.
- SDK types: `@automatos/theme-sdk` declarations are vendored from core's `frontend/packages/theme-sdk`,
  by version.

## Layout

- `packages/*`: build tools — `vite-preset` (the Vite build preset and its source guard), `theme-cli`
  (`pack` and `submit`), `theme-sdk` (the vendored `@automatos/theme-sdk` declarations) and `theme-harness`
  (the vitest preset a theme's own tests run on: jsdom, React, Testing Library and an SDK stand-in).
- `themes/*`: theme packages. A theme bundles only its own `src/` (the preset's source guard refuses `node_modules`),
  so an outside library it needs is copied into `src/vendor/` as source with its licence, at the version core pins.
- `themes/play`: Play, copied from core at one pinned commit (its README names it and the lines changed). Until
  PRD-261 A-19 removes builtin Play from core, a Play change in core is made here too, each pull request naming the other.
- `scripts/compile-looks.mjs`: Play's look data (`looks/`, and `boot/prepaint.json` with the glow rule and the tone
  rule, each ground's tone from `lib/looks/tone.ts`) from its catalogue and presets, run by Play's `build` before
  `vite build`; the files are generated, not committed.
- npm workspaces over both. `tsconfig.base.json` holds the shared compiler options; each workspace's
  `tsconfig.json` extends it.

## What CI runs

`.github/workflows/kit.yml` first runs `scripts/release/released-unchanged.mjs`: once `play-v<version>` is
tagged, a change to anything the kit's pack collects for Play — `theme.json`, its top docs (`README.md`,
`CHANGELOG.md`, every `LICENSE` spelling), `assets/` and `src/` (the source of the package's generated
`dist/`, `boot/` and `looks/` too) — fails until the version moves on.
It then installs and runs the root scripts `build`, `lint`, `typecheck`, `test` and `pack`. Each one runs
the same script in every workspace that defines it, `packages/*` before `themes/*`.

- A workspace with `*.test.ts` files defines `test` (vitest); one with a `tsconfig.json` defines `typecheck`.
- A theme that produces a package defines `pack`; CI uploads every `*.autotheme*` it writes.
- `tests/` at the root checks this contract (workspaces, exact pins, the workflows) and the review and
  sign scripts under `scripts/`.

## Adding a dependency

Pin it exactly in `package.json`, push the branch and run `kit-lockfile.yml` on it (`gh workflow run`).
Commit its `kit-lockfile` artifact, checked against the run summary's digest, as `package-lock.json`;
the pull request then has one CI run, installing with `npm ci`. Never hand-edit the lockfile.

## Marketplace review and signing (person-run, PRD-261 C-02b and C-03a)

Two `workflow_dispatch` workflows a person runs from the Actions tab; core never calls GitHub.

- `theme-review.yml` (inputs: the package's https URL and the digest the admin queue shows): no
  permissions, no secrets; downloads the package, installs the kit with `npm ci --ignore-scripts`,
  then runs `scripts/review/main.ts` in `docker run --network none`: a no-network probe, the
  package checks, the digest, the JS rules on `source/` and the reproducible build. The job summary
  holds the text the reviewer pastes into the admin queue's report note, with its outcome.
- A Marketplace package ships `source/`: the theme's `src/` exactly as built (`source/entry.ts` is
  `src/entry.ts`). The review rebuilds it with this kit's preset and lockfile, from the theme folder,
  and the dist/ must match byte for byte.
- `theme-sign.yml` (input: the whole signature request JSON from the admin queue, `requestId` included):
  installs nothing; its one `Sign` step reads the `THEME_SIGNING_KEY` secret (Ed25519, PKCS#8 PEM) and
  prints the request id and the base64 signature over the canonical JSON of `{id, version, digest,
  files}` (`scripts/sign/`; core's signed form, which keeps `requestId` outside the signed text), which
  the person pastes into the admin queue. It refuses when the secret is absent, when id or version
  break core's manifest patterns, and when any printed line would hold a line break or `::`. The
  `theme-signing` environment allows main only and has required reviewers, the named signers: either one may
  approve a run, and "Prevent self-review" is off for now. No other workflow may name that secret; the root tests
  enforce both workflows' shape.
- The vite-preset builds only from the theme's `src/` (its source guard), and the JS rules refuse paths
  that leave `source/`, so the reproducible build can't pull in files from outside the package.

## Rules

- Nothing runs on the maintainer's machine. CI is the test.
- Every dependency is pinned to an exact version (the root tests enforce it). A new dependency needs
  the maintainer's OK. `package-lock.json` is committed and CI installs from it with `npm ci`.
- This repo is public: no secrets, no internal plans, no customer or pricing material.
- Functions at most 50 lines, files at most 400 lines, plain comments.
- Git: stage explicit paths, sign off (`git commit -s`), messages `type(scope): what`.
