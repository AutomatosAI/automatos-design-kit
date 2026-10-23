# Ralph theme-wave template

A loop that builds one wave of a theme unattended: one fresh Claude Code session per story, each building one story
and committing it, then one push, one pull request and one CI run, with up to three CI-fix sessions. CI is the test:
no session runs anything, and the wave is done only when the pull request's CI run is green.

| File | What it is |
|---|---|
| `theme-wave.json` | The wave: the theme's id and folder, the branch, and the stories, each with the files it may change |
| `PROMPT_build.md` | What every build session reads: one story, its files, the kit's rules, the sentinels |
| `PROMPT_cifix.md` | What a CI-fix session reads after a red run |
| `run.sh` | The runner: the worktree, the sessions, the push, the pull request and the CI rounds |
| `launch.sh` | Starts `run.sh` in the background, from a person's terminal only |

The prompts are filled in from the wave file when each session starts: `{{THEME_ID}}` and `{{THEME_DIR}}` from its
`themeId` and `themeDir`, `{{WAVE}}` and `{{PROGRESS}}` from the folder, `{{CI_LOG}}` and `{{CORE}}` from the runner.

## Before you launch

1. **Copy this folder** to one of its own in your clone of the kit, such as `ralph/harbour/`, and leave
   `templates/ralph/` as it is.
2. **Make the theme's workspace first**, on the base branch: `themes/<slug>/package.json` as
   [`skills/build-automatos-theme/references/theme-folder.md`](../../skills/build-automatos-theme/references/theme-folder.md)
   shows it. A new workspace changes `package-lock.json`, which is never edited by hand: push the branch, run
   `kit-lockfile.yml` on it and commit its artifact (`AGENTS.md`, "Adding a dependency"). The wave's stories never
   touch either file.
3. **Write the wave.** In `theme-wave.json`: `themeId` (`publisher/slug`), `themeDir` (`themes/<slug>`),
   `branchName`, `baseBranch`, `prBase`, `prTitle`, and the stories. One story per surface (the frame, the look data,
   the look editor, a page, the edges), in the order
   [`build-automatos-theme`](../../skills/build-automatos-theme/SKILL.md) gives; each with acceptance criteria CI can
   prove, a `priority`, `"passes": false`, and its `files`, all under `themeDir`.
4. **Commit the folder** on the base branch: the worktree is cut from it.
5. **Tools:** `claude` (signed in), `jq`, `git`, `gh` (signed in) and `timeout` (`gtimeout` from coreutils on macOS).

## Launch

From your own terminal, naming the model exactly:

```sh
RALPH_MODEL=claude-opus-5-5 ./ralph/harbour/launch.sh
```

- `run.sh` refuses to start without `RALPH_MODEL`, and refuses an alias (`opus`, `sonnet`): an unattended run must
  never change model under you. There is no default.
- `launch.sh` refuses a start with no terminal (an agent session, a pipe, a scheduler): a person starts the loop.
- It also refuses on battery power (`RALPH_ALLOW_BATTERY=1` overrides), with the folder's files uncommitted, without
  the base branch, or while a loop runs for this folder.

The worktree is `<repo>-worktrees/<branch>` beside the repo, and the logs are in `<repo>-worktrees/logs/`. To stop,
end the `run.sh` process; to go on, launch again: the worktree is reused and the next story that doesn't pass is next.

| Variable | Default | What it does |
|---|---|---|
| `RALPH_MODEL` | none: required | The model id every session runs on |
| `RALPH_WAVE` | `theme-wave.json` | Another wave file in this folder |
| `RALPH_WORKTREE_ROOT` | `<repo>-worktrees` beside the repo | Where the worktree and the logs go |
| `RALPH_CORE` | none | A core checkout the sessions may read, never edit |
| `RALPH_GH_REPO` | the repo's own | `owner/name` for the push, the pull request and the CI runs |
| `RALPH_MAX_ITERS`, `RALPH_ITER_TIMEOUT` | 22, `60m` | Sessions per wave, and each session's time limit |
| `RALPH_CI_ROUNDS`, `RALPH_CI_WAIT_MIN` | 3, 40 | CI-fix rounds, and minutes to wait for each CI run |

## Read this before the first run

- Each session runs Claude Code with `--dangerously-skip-permissions`: it runs commands without asking, in the
  worktree, with your environment. Launch a wave only where you would let an agent work unattended, with no secrets
  in the environment.
- The sentinels (`STORY_DONE`, `RALPH_COMPLETE`, `RALPH_BLOCKED`, `CI_FIX_DONE`) count only on a reply's last line.
  `RALPH_BLOCKED` stops the loop with the session's reason; read the story's `notes`.
- The loop proves nothing itself. Read the pull request and its CI run, then try the theme on a local edition
  (`automatos-theme install <file.autotheme> --to <your local Automatos> --choose`) before you merge it.
