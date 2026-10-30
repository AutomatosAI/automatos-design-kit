# AGENTS.md: automatos-design-kit, the Automatos design kit

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
  whitelisted files; the package at most 32 MB, JS + CSS at most 3 MB, the entry at most 300 KB, each clip at
  most 1 MB; up to 24 web previews (`previews`) and 24 phone screenshots (`phonePreviews`, PNG or JPEG in
  `assets/previews/phone/`), at most 512 KB each.
- CSS: every rule sits under `html.<htmlClass>` (or `:where(html.<htmlClass>)`); no `!important`, no
  `@import`, no selector naming `data-protected-surface` or `data-ai-label`; every `@keyframes` name and
  `@font-face` family starts with `<htmlClass>-`.
- Modules: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` and `@automatos/theme-sdk` come
  from the host's import map and stay external. Nothing else is external.
- SDK types: `@automatos/theme-sdk` declarations are vendored from core's `frontend/packages/theme-sdk`,
  by version.

## Layout

- `packages/*`: build tools — `vite-preset` (the Vite build preset and its source guard), `theme-cli` (the
  `automatos-theme` command: `pack` and `pack --watch`, `submit`, `install`, `check`, `check design`, `new`, `brief`,
  `clone`, `skin`, `shots`, `previews` and `dev`), `theme-sdk` (the vendored `@automatos/theme-sdk` declarations), `theme-harness` (the vitest
  preset a theme's own tests run on: jsdom, React, Testing Library and an SDK stand-in; and the browser harness, a
  mock host page in `app/` that draws a theme from its folder with nothing of Automatos running, which
  `automatos-theme shots` photographs on Chromium and WebKit with Playwright and scans with axe, and
  `automatos-theme dev` serves on 127.0.0.1 as a local app, with a phone view on `/phone` that draws the theme as
  Automatos Go draws its `mobile` block, beside the block's contrast as `check` measures it, and a skin designer that
  edits the block and exports it as `skin.json` for `automatos-theme skin`; theme-cli holds the pure model it draws
  from, `mobile-answer`, `phone` and `skin-check`), `theme-rules` (the one table of JS rules the
  Marketplace review runs on a package's `source/`: an error refuses the package, a warning is listed for the
  reviewer) and `eslint-plugin` (`@automatos/eslint-plugin`: those rules as ESLint rules, one per code, which a
  theme's `lint` runs over its `src/`). Two are libraries a theme bundles (PRD-261 B-01i; each `package.json`
  sets `"kitLibrary": true`, the mark the preset bundles by): `look-kit`
  (`@automatos/look-kit`: a look's custom properties and Studio's tokens, the WCAG contrast math with the AA
  proofs of Play's 24 ground and accent pairs, Studio's HSL triplets and the schema-driven look validator, from
  Play's copy of core's look runtime) and
  `mascot` (`@automatos/mascot`: Auto's state machine, the clip player, the media chooser and captions, the ring's
  tones, the chat's events and the Pause Auto control).
- `themes/*`: theme packages. A theme bundles its own `src/` and the `src/` of each kit library it names, at the
  library's version, under `dependencies` in its `package.json` (Play and HUD both name `@automatos/look-kit` and
  `@automatos/mascot`; Arcade names `@automatos/mascot` alone). The preset's source guard refuses anything else,
  `node_modules` included, so an outside library it needs is copied into `src/vendor/` as source with its licence,
  at the version core pins.
- `themes/play`: Play, copied from core at one pinned commit (`docs/PLAY-HISTORY.md` names it and the lines changed;
  Play's README points there). Core's PRD-261 A-19 merge removed builtin Play from core, so Play lives only in this
  kit and a Play change is made here alone. Play's `CHANGELOG.md` lists what each version changed.
- `themes/hud`: HUD (`automatos/hud`), the kit's second theme, built here from the Command design reference: a command
  deck frame (a top bar, a side rail, bracketed panels) around the host's pages, its own chat and Conversations, five
  presets and Auto. Its look data
  (`looks/` and `boot/prepaint.json`) is committed, made from its catalogue (`src/lib/looks/`) and held to it by its
  own tests, not by `scripts/compile-looks.mjs`; its `pack` runs `automatos-theme check design` first.
- `themes/arcade`: Arcade (`automatos/arcade`), the kit's third theme, built here with the kit from a Claude Design
  handoff on the minimal template ([`guides/from-design-to-theme.md`](guides/from-design-to-theme.md)): Automatos as
  a 16-bit role-playing game, agents as a party, Auto as the guide in the dialogue box, Deliverables in an inventory,
  Missions as quests on a map. Its look data (`looks/`, `boot/prepaint.json` and `design/contrast.json`) is
  committed, made from its catalogue (`src/looks/catalogue.ts`) and held to it by its own tests
  (`ARCADE_WRITE=1`), not by `scripts/compile-looks.mjs`; its `pack` runs `automatos-theme check design` first. All
  three themes, and every theme under `themes/`, are published the same way: a merge to `main` that raises a theme's
  version lists, signs and releases it as `<slug>-v<version>` (`theme-publish.yml`, `docs/OFFICIAL-LISTING.md`).
- `scripts/compile-looks.mjs`: Play's look data (`looks/`, and `boot/prepaint.json` with the glow rule and the tone
  rule, each ground's tone from `lib/looks/tone.ts`) from its catalogue and presets, run by Play's `build` before
  `vite build`; the files are generated, not committed.
- npm workspaces over both. `tsconfig.base.json` holds the shared compiler options; each workspace's
  `tsconfig.json` extends it.
- `guides/`: how to build a theme — the host contract (slots, routes, the `mobile` block), the page inventory, the
  SDK, looks, where the mascot goes and the pitfalls. `skills/`: Claude Code skills for building a theme, writing
  a look schema and passing the Marketplace review (`skills/README.md` is their index).
- `templates/minimal/` and `templates/full/`: the templates `automatos-theme new <publisher/name>` starts a theme
  from (PRD-261 B-01e, B-03f, B-01f). `minimal` is the frame alone with the host's pages inside it, a look editor, a
  style sheet and two presets, its `{{...}}` placeholders filled with the theme's names. `full` is Play de-branded,
  made from `themes/play` itself each time `new` runs (with `--mascot none`, without Auto): `templates/full/` holds
  only the renames and what it adds, the `/agents` page cloned from core among them. Neither is a workspace; their
  tests run on the harness through `packages/theme-harness/test/template-*.test.tsx`.
- `templates/ralph/`: a template for running a theme wave with Ralph (an explicit model id, a terminal start, CI as
  the test). `references/designs/`: design references (Ember and Command) to read, never to build from.
- `proof/`: the proof protocol (PRD-261 B-06): a fresh agent, given a clean clone of the kit at a base tag and a
  brief, builds a new theme with the kit alone. `README.md` is the protocol (what the run may read and change, how to
  launch it, how the run is contained, what the guard, the audit and CI prove, what `RUN.md` and `GAPS.md` hold, the
  gap categories); `BRIEF.template.md` the sections a brief has; `PROMPT.md` the run's fixed task;
  `run-settings.json` the run's Claude Code settings (its permission rules and its sandbox), a template the launcher
  fills with the clone's paths; `leak-paths.txt` the paths the launcher deletes from the run's clone. A proof branch,
  `proof/<id>-<slug>`, adds `proof/<id>/` (`BRIEF.md`, `RUN.md`, `GAPS.md`, `BASE`) and `themes/<slug>/`, and is
  never merged as it is.
- `scripts/proof/`: `launch.sh` (prepares the clone, outside this repository, and starts the run with its model
  pinned), `guard.mjs` (a proof branch changes only its theme and proof folders; `--ci` is kit.yml's `proof` job) and
  `audit.mjs` (what the run's transcript shows: first a leak file's text in any tool result, matched against the
  base in the clone's history by `leak-content.mjs`, the authoritative check; then what its calls reached for, read
  as the shell reads them by `shell.mjs`: paths outside the clone, leak paths, other refs, the web, a deny list kept
  outside the repository).

## What CI runs

`.github/workflows/kit.yml`'s `kit` job first runs `scripts/release/released-unchanged.mjs`: for every folder under
`themes/`, once `<slug>-v<version>` is tagged, a change to anything the kit's pack collects for it — `theme.json`, its
top docs (`README.md`, `CHANGELOG.md`, every `LICENSE` spelling), `dist/`, `boot/`, `looks/`, `assets/` and `src/`,
and the `src/` of each kit library its `package.json` names (Play's and HUD's: `packages/look-kit/src/` and
`packages/mascot/src/`; Arcade's: `packages/mascot/src/` alone, not `packages/look-kit/src/`) — fails until the
version moves on; each theme is checked against its own tags only (`scripts/release/themes.mjs` holds the paths and
the tag rule).
It then installs and runs the root scripts `build`, `lint`, `typecheck`, `test` and `pack`. Each one runs
the same script in every workspace that defines it, `packages/*` before `themes/*`.

- A workspace with `*.test.ts` files defines `test` (vitest); one with a `tsconfig.json` defines `typecheck`.
- A theme defines `lint`: eslint over its `src/` with `@automatos/eslint-plugin`'s recommended config (its
  `eslint.config.js`), so a pattern the Marketplace review would report fails CI first. Play's, HUD's and Arcade's
  fail on a warning too (`--max-warnings 0`).
- A theme that produces a package defines `pack`; CI uploads every `*.autotheme*` it writes.
- `tests/` at the root checks this contract (workspaces, exact pins, the workflows) and the release, review,
  sign and proof scripts under `scripts/`. It also runs `automatos-theme new` on each template, `full` with and
  without its mascot, in a temporary folder, and builds, packs and checks each theme it writes
  (`tests/template-*.test.ts`).
- Its `harness` job installs and builds as the `kit` job does (the released-themes check is the `kit` job's alone),
  then installs the two browsers, and runs `automatos-theme shots` over `themes/play`, then over `themes/hud` (into
  the shots' `hud/` folder), then over every other theme under `themes/` (each into `themes/<name>/`,
  `scripts/shots/other-themes.mjs`), in `theme-harness`'s browser harness. Each fails on a missing shot, a request to any
  other origin or a critical axe violation. Then the dev smoke (`packages/theme-harness/shots/dev-smoke.config.ts`):
  `automatos-theme dev themes/play` serves the harness on 127.0.0.1 and `/chat` renders there on Chromium, and so
  does the phone view on `/phone`. Then the phone shots (`packages/theme-harness/shots/phone-shots.config.ts`):
  `automatos-theme dev` over the harness's made-up phone skin (`packages/theme-harness/fixtures/phone-skin`), its
  `/phone` shot on Chromium on Chat, the Command Centre and First open in Light and Dark, and with the skin designer
  showing a failing pair, each with an axe scan of the phone, into the shots' `phone/` folder. Then the showcase
  shots (`packages/theme-harness/shots/showcase.config.ts`): `automatos-theme dev` over HUD and over Play, each on its
  own port, and chosen views of each in chosen looks on the hosted edition (no first-run nudge), at twice the pixel
  density, with reduced motion and a fixed clock, on Chromium and with no axe scan, into
  `packages/theme-harness/dist/showcase/`. Then Lighthouse, report only (`scripts/lighthouse/main.ts`, PRD-261 B-02h):
  `automatos-theme dev` serves each theme under `themes/` in turn, and Lighthouse (pinned in the root `package.json`)
  measures its home view and its `/chat` page at 1440 × 900 and at the phone's 390 × 844 on the same Chromium, its
  scores a table in the job summary; no score fails the build, and the step continues on any error. The job uploads
  the shots, their `axe.json` files and the smoke's shots as `kit-harness`, the showcase as `kit-showcase`, and the
  Lighthouse reports as `kit-lighthouse`.
- Its `proof` job runs only on a pull request from a `proof/` branch (`proof/README.md`). On the branch's own head
  and history, `main`'s copy of `scripts/proof/guard.mjs --ci` (never the branch's) reads the branch's one
  `proof/<id>/BASE`, fetches that base tag and fails on a change outside `themes/<slug>/` and `proof/<id>/` (but the
  new workspace's lock entries and the launcher's deletion of the leak paths); then the job installs, builds, runs
  `automatos-theme check` on the new theme and shoots it in the browser harness, uploaded as `kit-proof-shots`. The `kit` job builds, lints, typechecks, tests
  and packs the new theme with every other workspace; the `harness` job shoots Play and HUD only.

## Adding a dependency

Pin it exactly in `package.json`, push the branch and run `kit-lockfile.yml` on it (`gh workflow run`).
Commit its `kit-lockfile` artifact, checked against the run summary's digest, as `package-lock.json`;
the pull request then has one CI run, installing with `npm ci`. Never hand-edit the lockfile.

## Marketplace review, publishing and signing (PRD-261 C-02b and C-03a)

`theme-review.yml` is a `workflow_dispatch` workflow a person runs from the Actions tab; `theme-publish.yml` runs by
itself once `Kit` has passed on a push to `main`. Core never calls GitHub.

- `theme-review.yml` (inputs: the package's https URL and the digest the admin queue shows): no
  permissions, no secrets; downloads the package, installs the kit with `npm ci --ignore-scripts`,
  then runs `scripts/review/main.ts` in `docker run --network none`: a no-network probe, the
  package checks, the digest, the JS rules on `source/` and the reproducible build. The job summary
  holds the text the reviewer pastes into the admin queue's report note, with its outcome.
- That text ends with a report-only "Previews and accessibility" section (PRD-261 B-02j,
  `scripts/review/report.ts`): each preset's previews with their sizes and the preset that claims each,
  then its phone screenshots the same way when the package holds any, and contrast, not measured while
  core's look schema declares no text and ground pairs (a `mobile` block's pairs are in core's own review
  report). Once the review has passed, the job runs an axe pass
  outside the container (`scripts/review/axe.ts`): the package laid out as a theme folder in a folder of
  its own, drawn by `automatos-theme shots`, and what axe found added to the job summary after the text.
  Neither is a check, so neither changes the outcome; the axe steps continue on any error.
- A Marketplace package ships `source/`: the theme's `src/` exactly as built (`source/entry.ts` is
  `src/entry.ts`), and the `src/` of each kit library it bundles as `source/packages/<name>/src/`. The
  review rebuilds it with this kit's preset and lockfile, from the theme folder, each library's `src/`
  laid out beside it as the kit lays them out, and the dist/ must match byte for byte.
- `theme-publish.yml`: a merge to `main` publishes, and the merge is the approval. When `Kit` passes on a push to
  this repository's `main` (or a person runs it on `main` with a release tag, a backfill), `scripts/release/bumped.mjs`
  picks each theme whose version is above its newest `<slug>-v*` tag and whose publisher `release/publishers.json`
  lists. A build job with no secrets installs with `npm ci --ignore-scripts`, packs the theme and reviews it with
  `scripts/review/main.ts` in `docker run --network none`. The publish job, in the `theme-publish` environment (main
  only, no reviewers), installs nothing: `scripts/sign/from-pack.ts` holds the package to pack's `.sha256.json` and
  signs `{id, version, digest, files}` with `THEME_SIGNING_KEY` (Ed25519, PKCS#8 PEM; core's canonical text), and the
  package, the envelope and the review's text go to the Marketplace's publish endpoint with `THEME_PUBLISH_KEY`;
  each secret is read by one step alone and no other workflow may name either. On core's `published` or `unchanged`
  it releases `<slug>-v<version>` with the `.autotheme`, its `.sha256` and its `.sig.json`, or adds the `.sig.json`
  to the release there is; anything else fails the run and releases nothing. `theme-release.yml` releases a tag a
  person pushes, unlisted and unsigned. The root tests enforce every workflow's shape.
- The vite-preset builds only from the theme's `src/` and its bundled kit libraries' `src/` (its source
  guard), and the JS rules refuse paths that leave `source/`, so the reproducible build can't pull in files
  from outside the package.

## Building a theme with the kit

A theme author works in a copy of the kit and runs its commands locally: that is what they are for. `npm ci` (or
`npx -y npm@11.21.1 ci` on an npm older than 11.6), `npx automatos-theme new <publisher>/<name>`, the theme's own
`npm run build`, `lint`, `typecheck` and `test`, `automatos-theme dev`, `check design`, `check`, `pack` and `install`.
The steps are `README.md`'s "Make your own theme"; from a design, `guides/from-design-to-theme.md`. Every fact a
theme needs is in `guides/`; the order of work is `skills/build-automatos-theme`. A theme folder under `themes/` is a
new npm workspace: in your copy, run `npm install` once when `npm ci` says the lockfile is out of sync.

## Rules

The rules below are the kit's own, for changes to the kit itself (its packages, templates, guides, workflows and the
released themes).

- Nothing runs on the maintainer's machine. CI is the test.
- Every dependency is pinned to an exact version (the root tests enforce it). A new dependency needs
  the maintainer's OK. `package-lock.json` is committed and CI installs from it with `npm ci`.
- This repo is public: no secrets, no internal plans, no customer or pricing material.
- Functions at most 50 lines, files at most 400 lines, plain comments.
- Git: stage explicit paths, sign off (`git commit -s`), messages `type(scope): what`.
