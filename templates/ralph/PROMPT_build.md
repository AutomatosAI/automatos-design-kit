# Ralph build session: the theme {{THEME_ID}}

You are one session of an unattended loop building the Automatos theme **{{THEME_ID}}** in `{{THEME_DIR}}`, in a
clone of the Automatos design kit. Each session builds **exactly one story** of the wave file `{{WAVE}}`, commits it
and stops. A fresh session picks up the next one.

## Read first (every session)

1. `AGENTS.md` and `CLAUDE.md`: the kit's contract and its traps.
2. `{{WAVE}}`: the stories. Yours is the **lowest `priority` with `"passes": false`**. Its `files` are the only files
   you may change, with `{{WAVE}}` and `{{PROGRESS}}`.
3. `{{PROGRESS}}`: what earlier sessions learned. Read its "Patterns" section before writing code. If the file is not
   there yet, create it with a `## Patterns` section.
4. `skills/build-automatos-theme/SKILL.md`, then the skill and the guides your story touches (`guides/README.md` lists
   them). The guides are the host's contract: where a guide and your story disagree, the guide wins and you stop
   (below). Where you need more, read `themes/play` (a complete theme), then core, read-only: {{CORE}}.

## Do the story

1. `git status`. If the tree is dirty, a previous session timed out mid-story: finish that work if it belongs to
   your story; otherwise set it aside with a commit `wip: <what it is>` and say so in `{{PROGRESS}}`. Never use
   `git stash`: the stash is shared with every worktree.
2. Build the story and its tests. Every acceptance criterion is met **in code**; tests on the kit's harness
   (`@automatos/theme-harness`) prove the testable ones, by role and text.
3. Review your own diff against each criterion, then fix what is missing. Read your imports and types carefully:
   nothing is compiled until CI runs at the end of the wave, so a typo now costs a CI round later.
4. In `{{WAVE}}`, set your story's `"passes": true` and write one or two lines in its `"notes"`: what you built, and
   what the next stories must know.
5. Append to `{{PROGRESS}}`: `## <story id> <date>`, what you did, the files, and what you learned. Put a reusable
   pattern in "Patterns" at the top.
6. Commit, staging explicit paths (never `git add -A` or `git add .`), signed off:
   `git commit -s -m "feat(<theme slug>): <story id> <story title>"`. **Do not push.** The runner pushes the whole wave
   once, at the end.
7. **Stop.** Your final reply's last line is `STORY_DONE <story id>`. Don't start the next story.

If every story already has `"passes": true` when you start, check that the tree is clean and committed, and end with
the last line `RALPH_COMPLETE`.

If you can't finish the story (a fact neither the guides, Play nor core answers; a criterion the contract forbids; a
file your story needs that its `files` don't list), write the reason in the story's `notes`, commit what is safe, and
end with the last line `RALPH_BLOCKED <story id> <reason in under 60 characters>`.

## Execution contract (non-negotiable)

- **CI is the test.** Nothing runs in this session: no `npm install`, `npm ci`, `npm run`, `npx`, `tsc`, `vitest`,
  `vite`, `eslint`, no `automatos-theme` command, no browser. At the end of the wave the kit's CI runs `npm run build`,
  `npm run lint`, `npm run typecheck`, `npm test` and `npm run pack` over every workspace, this theme's included, and
  its result is the only proof. The theme's `pack` script runs `automatos-theme check design` before
  `automatos-theme pack`, so a colour pair under its minimum fails CI too.
- **No new dependency, and never `package-lock.json`.** The theme's `package.json` and the lockfile were made before
  the wave; only the kit's `kit-lockfile.yml` dispatch writes the lockfile. A story that needs a new package ends in
  `RALPH_BLOCKED`.
- **Never end your turn with background work.** No background agents, no scheduled wake-ups, no "I'll continue when X
  finishes". In print mode the turn is the session: anything left running is killed and the story is lost. A
  subagent runs in the foreground.
- **Never push, never open a pull request, never touch `main`.**
- **Sentinels go on the last line only.** Never write `STORY_DONE`, `RALPH_COMPLETE` or `RALPH_BLOCKED` anywhere else
  in your reply.

## Theme rules

- **SDK only.** Everything the theme reads or does goes through `@automatos/theme-sdk` (`guides/sdk.md`): no network
  calls, no cookies, no browser storage, no `@/` imports, no `next/*`, no `eval`. The Marketplace review refuses each
  one, and the theme's `lint` fails on it first.
- **Bundle only `{{THEME_DIR}}/src/`.** An outside library is copied into `src/vendor/` as source, with its licence.
- **CSS** under `html.<htmlClass>`, every variable under the theme's own prefix, every colour from the look, no
  `!important` (`guides/pitfalls.md`).
- **Protected surfaces stay the host's**: place the host's approval cards and keep the AI label visible; a composer
  goes inside `cards.AiLabelFence`.
- **Untrusted text is text**: Markdown through `cards.MarkdownView`, never HTML from a reply, a Deliverable or an
  import.
- TypeScript strict, no `any`, no `@ts-ignore`. Functions under 50 lines, files under 400, nesting at most 4 levels.
  Immutable updates. Never swallow an error: the person sees a plain message.
- Copy uses the product's words: **Auto** (a name), **Mission**, **Deliverable**, **Playbook**.
- No secrets, no keys, no tokens, anywhere.
