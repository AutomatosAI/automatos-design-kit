# Ralph build session: Automatos Play

You are one session of an unattended loop building **Automatos Play**. The wave's PRD is the file named in `prdDoc` in `scripts/ralph/prd.json`. Each session builds **exactly one story**, commits it, and stops. A fresh session picks up the next one.

## Read first (every session)

1. `CLAUDE.md`: what this repo is and its traps.
2. `scripts/ralph/prd.json`: the stories. Yours is the **lowest `priority` with `"passes": false`**.
3. `scripts/ralph/progress.txt`: what earlier sessions learned. Read the "Patterns" section at the top before writing code.
4. The PRD named in `prdDoc` in `prd.json`: the why, and the full acceptance criteria. When a story's criterion says "All criteria of X in the PRD", every bullet under that story in the PRD is part of your story. Earlier PRDs in `docs/prd/` describe what is already built.
5. `skills/build-automatos-interface/SKILL.md` and the reference your story touches. **This skill is the only spec for the Automatos API.** Where you need more, read the core source, read-only, at `{{CORE}}` (the paths in the skill are relative to it). Never edit anything under `{{CORE}}`.
6. The designs listed in `designDocs` in `prd.json`. Read the `.dc.html` source for exact values (search for your screen's title) and look at the PNG screenshots with the Read tool. The yellow tags and "Tweaks" in mocks are design notes, not features. The PRD-001 mocks in `docs/design/mocks/` are the earlier direction: where a newer design disagrees, the newer one wins.

## Do the story

1. `git status`. If the tree is dirty, a previous session timed out mid-story: finish that work if it belongs to your story. Otherwise set it aside with a commit `wip: <what it is>` and note that in progress.txt. Never use `git stash`, because the stash is shared with other worktrees.
2. Build the story and its tests. Every acceptance criterion must be met **in code**; tests prove the testable ones.
3. Review your own diff against each criterion, then fix what's missing. Read your imports and types carefully: nothing is compiled until CI runs at the end of the wave, so a typo now costs a CI round later.
4. In `scripts/ralph/prd.json`, set your story's `"passes": true` and write one or two lines in `"notes"`: what you built, and anything the next stories must know.
5. Append to `scripts/ralph/progress.txt`: `## <US-id> <date>`, what you did, files touched, and learnings. Put reusable patterns in the "Patterns" section at the top.
6. Commit, staging explicit paths (never `git add -A` or `git add .`): `git commit -m "feat(play): <US-id> <story title>"`. **Do not push.** The runner pushes the whole wave once, at the end.
7. **Stop.** Your final reply's last line is `STORY_DONE <US-id>`. Don't start the next story.

If every story already has `"passes": true` when you start, check the tree is clean and committed, and end with the last line `RALPH_COMPLETE`.

If you can't finish the story (a missing fact you can't find in the skill or the core source, or a contradiction in the PRD), write the reason in the story's `notes`, commit what is safe, and end with the last line `RALPH_BLOCKED <US-id> <reason in under 60 characters>`.

## Execution contract (non-negotiable)

- **Nothing runs on this machine.** No `npm install`, `npm ci`, `npm run …`, `npx`, `tsc`, `vitest`, `next`, dev servers, browsers or the dev-browser skill. CI is the only gate, and it runs once at the end of the wave. `npm view <pkg> version` (a registry lookup) is allowed and is how you pin versions.
- **Dependencies:** add them to `package.json` by hand with an **exact** version from `npm view`. There is no lockfile; CI runs `npm install`.
- **Never end your turn with background work.** No background agents, no ScheduleWakeup, no "I'll continue when X finishes". In print mode the turn is the session: anything left running is killed and the story is lost. If you use a subagent, run it in the foreground.
- **Never push, never open a PR, never touch `main`.**
- **Sentinels go on the last line only.** Never write `STORY_DONE`, `RALPH_COMPLETE` or `RALPH_BLOCKED` anywhere else in your reply.

## Code rules

- TypeScript strict, no `any`, no `@ts-ignore`. Functions under 50 lines, files 200–400 lines (800 max), nesting at most 4 levels.
- Immutable updates: return new objects, never mutate state or arguments.
- Errors: never swallow one. Users see a friendly message, and the console gets the detail.
- The browser never calls the backend: all backend access goes through `app/api/*` routes and `lib/client/api.ts`.
- Treat stream lines, Deliverable content and imported files as untrusted: no `dangerouslySetInnerHTML`, no raw HTML in markdown, no `eval`. The one exception is the pre-paint Look script in `app/layout.tsx`. Its body is a constant string built from `lib/looks/catalogue.ts` at build time; the only runtime input it reads is the saved Look from localStorage, which it validates against the catalogue keys before use. Never interpolate user text into it.
- Colours, type, spacing and radii come from `app/theme.css` tokens only, and once Looks exist, colours come from the active Look's variables.
- Copy uses the canonical words: **Auto** (a name), **Deliverable**, **Mission**. Buttons say exactly what they do.
- No secrets, no `ORCHESTRATOR_API_KEY`, no `Authorization` headers. Local edition only.
- The mascot files in `public/auto/` are git-ignored and may be missing (in CI they always are). Code must degrade to the placeholder, and tests must not depend on them.
