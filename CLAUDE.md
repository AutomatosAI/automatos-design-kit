# CLAUDE.md: automatos-play

A playful second interface on a **local** Automatos install, with Auto as an animated mascot. A pilot. Studio (in `automatos-ai`) stays the default interface.

## What this repo is

- Its own repo, outside `automatos-ai`. It must never require a change in the core. If it needs one, write it up as an open question in `docs/prd/`.
- The spec is `docs/prd/PRD-001-FUN-UI-PILOT.md`, plus `docs/prd/PRD-002-LOOKS-POC.md` for Looks. The Look format, catalogue and contrast rules are explained in `docs/LOOKS.md` (`tests/looks/docs.test.ts` keeps it in step with `lib/looks/`).
- The API knowledge is `skills/build-automatos-interface/` and nowhere else. Build from the skill. When the core and the skill disagree, the core wins: fix the skill and log it in `docs/SKILL-GAPS.md`.
- Local edition only: no login, no hosted edition.

## Stack

Next.js 15 App Router, TypeScript strict, vitest, ESLint. Plain CSS with tokens in `app/theme.css`. Port 3100. Setup: `README.md`; manual checks against a real install: `docs/RUN-CHECKLIST.md`. The backend is at `AUTOMATOS_BACKEND_URL` (default `http://localhost:8000`).

## Traps

- The browser never calls the backend directly. Use the proxy routes only (no CORS change in the core, no secrets in the page).
- Never use `ORCHESTRATOR_API_KEY`. The local edition needs no credentials.
- Fonts are self-hosted through the `@fontsource` packages (imported in `app/layout.tsx`). Never `next/font/google` (it broke `next build` in the core).
- Mascot video: `.mp4` (HEVC alpha) for Safari and iOS, `.webm` (VP9 alpha) everywhere else. The wrong one shows a black box.
- The Deliverables list returns HTTP 200 with `success: false` on failure. Check `success`.
- Stream recordings in `tests/fixtures/` contain everything Auto said. Record from test data only, and read them before committing.
- No API keys in this repo, ever. That includes Higgsfield keys for the mascot pipeline.

## Workspace conventions

CI is the gate. Nothing runs on the maintainer's machine unless he runs it. Stage files explicitly (never `git add -A`). Commits use `type(scope): description`. Never push until asked; the repo is local only for now.
