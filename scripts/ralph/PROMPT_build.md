# Ralph build session: Automatos Play pilot

You are one session of an unattended loop building **Automatos Play** (PRD-001). Each session builds **exactly one story**, commits it, and stops. A fresh session picks up the next one.

## Read first (every session)

1. `CLAUDE.md`: what this repo is and its traps.
2. `scripts/ralph/prd.json`: the stories. Yours is the **lowest `priority` with `"passes": false`**.
3. `scripts/ralph/progress.txt`: what earlier sessions learned. Read the "Patterns" section at the top before writing code.
4. `docs/prd/PRD-001-FUN-UI-PILOT.md`: the why.
5. `skills/build-automatos-interface/SKILL.md` and the reference your story touches. **This skill is the only spec for the Automatos API.** Where you need more, read the core source, read-only, at `{{CORE}}` (the paths in the skill are relative to it). Never edit anything under `{{CORE}}`.
6. The designs: `docs/design/mocks/automatos-play-mocks.dc.html` (search for your screen's title) and the screenshots in `docs/design/mocks/screens/` (`panel-01.png` … `panel-13.png`, top to bottom: screens 01–05 on panels 1–6, 06–09 on panels 7–11, the style sheet on 12–13). The yellow tags and "Tweaks" in the mocks are design notes, not features. Gerard isn't fully sold on the mocks yet, so follow their layout and tokens but keep components simple to restyle.

## Do the story

1. `git status`. If the tree is dirty, a previous session timed out mid-story: finish that work if it belongs to your story, otherwise `git stash` it and note that in progress.txt.
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
- Treat stream lines and Deliverable content as untrusted: no `dangerouslySetInnerHTML`, no raw HTML in markdown, no `eval`.
- Colours, type, spacing and radii come from `app/theme.css` tokens only.
- Copy uses the canonical words: **Auto** (a name), **Deliverable**, **Mission**. Buttons say exactly what they do.
- No secrets, no `ORCHESTRATOR_API_KEY`, no `Authorization` headers. Local edition only.
- The mascot files in `public/auto/` are git-ignored and may be missing (in CI they always are). Code must degrade to the placeholder, and tests must not depend on them.
