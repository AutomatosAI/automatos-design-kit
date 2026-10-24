# CLAUDE.md: automatos-play

The Automatos design kit: it builds installable theme packages (`.autotheme`) for Automatos, under PRD-261
(installable themes). `AGENTS.md` is the current, maintained contract — read it first. This file adds a few
working notes on top of it for a Claude Code session; where the two differ, `AGENTS.md` wins.

## What this repo is

- Its own repo, outside `automatos-ai`. The package format belongs to the core repo (`AutomatosAI/automatos-ai`):
  when the kit and core disagree, core wins and the kit is fixed.
- A theme built here installs and runs the same way on both the local edition and the hosted edition of
  Automatos — the package format carries no edition switch. The theme CLI (`packages/theme-cli`) is narrower
  than that today: its `pack` and `submit` commands are exercised, and recommended, against the local edition.
  Hosted CLI auth — a credential `submit` could use against a hosted API without a browser sign-in — is parked
  for now; that is the maintainer's call, not a gap. Until it lands, `submit` against a hosted API will usually
  print the server's 401 or 403.
- `themes/play`: Play, copied from core at one pinned commit (its own README names the commit and what changed).
  Core no longer has builtin Play (its A-19 merge removed it), so Play lives only here: a Play change is made in this
  kit alone. `docs/PLAY-HISTORY.md` records where the code came from. Play's README still has its old "Until A-19"
  section, which no longer applies; the README is packed, so it changes only with Play's next version.
  The original pilot plan for Play, superseded by PRD-261, is kept at `docs/prd/PRD-001-FUN-UI-PILOT.md` for
  history.

## Stack

npm workspaces (`packages/*` build tools, `themes/*` theme packages), TypeScript (strict), vitest, ESLint, and
the kit's own Vite build preset. `tsconfig.base.json` holds the shared compiler options; each workspace's
`tsconfig.json` extends it.

## Traps

- Nothing runs on the maintainer's machine; CI (`.github/workflows/kit.yml`) is the only test.
- A theme's build may read only its own `src/` (the vite preset's source guard refuses `node_modules` and
  anything outside `src/`); an outside library it needs is vendored into `src/vendor/` as source, at the
  version core pins.
- `package-lock.json` is committed and installed with `npm ci`. Never hand-edit it — a new dependency goes
  through the `kit-lockfile.yml` dispatch (see `AGENTS.md`'s "Adding a dependency").
- `theme-review.yml` and `theme-sign.yml` are person-run `workflow_dispatch` jobs; core never calls GitHub.
- This repo is public: no secrets, no internal plans, no customer or pricing material, no API keys (including
  the mascot pipeline's).
- Stream recordings and fixtures hold everything Auto said. Record them from made-up test data only, and read
  them before committing (`tests/fixtures-fake-data.test.ts` refuses e-mails, outside URLs and key shapes, not
  everything).

## Workspace conventions

CI is the gate. Stage files explicitly (never `git add -A`). Commits use `type(scope): description`, signed off
(`git commit -s`). Never push until asked.
