# Proof run {{ID}}: build the theme in the brief with this kit alone

You are in a fresh clone of the Automatos design kit at the tag `{{BASE}}`, on the branch `{{BRANCH}}`. This run is
a proof that the kit is enough to build a new theme without help: what you could not find or do with the kit is the
result we want to read, so write it down rather than work around it in silence.

## The task

Build the theme that `proof/{{ID}}/BRIEF.md` describes, in `themes/{{SLUG}}/`, using only this repository and its
documented commands.

- Start from the kit's own instructions: `README.md`, `AGENTS.md`, `CLAUDE.md`, `guides/`, `skills/` (start with
  `skills/build-automatos-theme/SKILL.md`), `docs/cli.md`, `docs/cli-design.md` and `docs/cli-harness.md`.
- Use the kit's command line, `npx automatos-theme` (`new`, `check design`, `check`, `pack`, `brief`, `clone`,
  `skin`, `previews`), and the root npm scripts (`npm ci`, `npm run build`, `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run pack`). `automatos-theme dev` serves until it is stopped, so leave it out of this run; the
  browser shots run in CI.
- `themes/play` (Play) and `themes/hud` (HUD) are worked examples: read them as often as you like, never copy their
  brand, names or assets into your theme.
- After `automatos-theme new` adds your folder, run `npm install` once so `package-lock.json` gains the new
  workspace. Only your workspace's own entries may change in it.
- Your shell commands run in a sandbox: they write only inside this clone and npm's cache, read nothing in the home
  folder, and reach only the npm registry. The commands above are allowed; `node` on its own, `npm exec` and `npx`
  for anything but `automatos-theme` are not, so run code through the npm scripts and `npx automatos-theme`.
- `AGENTS.md` and `CLAUDE.md` say nothing runs on the maintainer's machine and CI is the only test. That rule is for
  the kit's maintainers in their own checkouts. This clone is the proof's own: run the commands here.

## The rules

1. Read only inside this clone. Never open, list or search a path outside it, and never use the web.
2. Change only `themes/{{SLUG}}/` and `proof/{{ID}}/`. Leave every other file of the kit as it is, even when you
   find a fault in it: record the fault as a gap instead.
3. git: use `git status`, `git diff`, `git log`, `git add <paths>` and `git commit -s` on this branch only. Never
   fetch, pull, push, switch or create branches, read tags or look at an earlier commit's files.
4. Record every gap in `proof/{{ID}}/GAPS.md` as you meet it, one row each: what was missing, wrong or harder than it
   should be, where (a file, a command or a guide), its category (`proof/README.md` lists them) and what you did.
5. Keep `proof/{{ID}}/RUN.md`'s "What the run did" section: the steps in order, and what you left unfinished.
6. Commit your work as you go, with messages that say what changed.

## Done when

- `npm run build`, `npm run lint`, `npm run typecheck` and `npm test` pass at the root, your theme included.
- `npx automatos-theme check design themes/{{SLUG}}` and `npx automatos-theme check themes/{{SLUG}}` report no error.
- `npm run pack` writes your theme's `.autotheme` package.
- `GAPS.md` and `RUN.md` are filled in, and everything is committed.

If you cannot reach one of these, stop, say which one in `RUN.md`, and record why in `GAPS.md`.
