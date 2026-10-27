# The proof protocol

A proof shows that the kit is enough to build a new theme on its own (PRD-261 B-06). A fresh Claude Code session,
given only a clean clone of the kit at a base tag and a brief, builds the theme the brief describes with the kit as
it is designed: the `automatos-theme` commands (`new`, `check design`, `check`, `pack` and the rest), the guides, the
skills, and Play and HUD as worked examples. It may change only its theme folder and its proof folder. Afterwards
the guard checks the branch's diff, the audit checks the run's transcript for reads it should not have made, and CI
on the proof branch builds, lints, typechecks, tests, packs and draws the theme.

The result is **audited, not impossible**. The run is told to stay inside its clone and its tools are limited, but
nothing stops a determined session from reading a file outside it, and the kit is public: its history and the
design references it once carried can be found. The proof rests on the record (the transcript, the audit's report,
the branch's diff and CI), not on a sandbox. Say "audited" when reporting a proof, never "impossible".

## The files

| File | What it is |
|---|---|
| `README.md` | This protocol |
| `BRIEF.template.md` | The sections a brief has; the brief itself is a file passed at launch |
| `PROMPT.md` | The run's fixed task: `launch.sh` fills in the proof's id, slug, base tag and branch |
| `run-settings.json` | The run's allow-list of tools, which `launch.sh` copies into the clone's Claude Code settings |
| `leak-paths.txt` | The paths `launch.sh` deletes from the run's clone before the run starts |
| `<id>/` | One proof's folder, on its proof branch only: `BRIEF.md`, `RUN.md`, `GAPS.md` and `BASE` |

The scripts are in `scripts/proof/`: `launch.sh` prepares the clone and starts the run, `guard.mjs` checks the diff
and `audit.mjs` checks the transcript. `tests/proof*.test.ts` holds them to this page.

## What the run may read and change

- It reads only inside its clone: the kit at the base tag, with the leak paths deleted. No web, no other folder of
  the machine, no other branch, tag or earlier commit.
- It changes only `themes/<slug>/` and `proof/<id>/`, and `package-lock.json` only by the new workspace's own
  entries (`themes/<slug>` and its `node_modules/<package name>` link), which `npm install` adds.
- Its tools are `run-settings.json`'s allow-list, copied into the clone's Claude Code settings and kept out of git:
  Read, Write, Edit, Glob and Grep; Bash for `npm`, `npx automatos-theme`, `node`, and `git status`, `git diff`,
  `git add`, `git commit` and `git log`. WebFetch, WebSearch and `git push` are denied, and so are reads and edits
  under the home folder's Claude Code folder. The kit's `skills/` folder is linked into the clone's settings folder,
  so the run can use the skills as Claude Code skills.
- The run installs, builds and tests in its clone, so launch it on a machine where that is fine. The kit's rule that
  nothing runs on the maintainer's machine is about the maintainers' own checkouts; `PROMPT.md` tells the run so.

## Launching a run

Pick a proof id (`b06`, `b07`), a slug (the theme's name, as `automatos-theme new` takes it), a base tag the owner
has pushed (`kit-b06-base` by default) and a brief written from `BRIEF.template.md`. Then, from a checkout of the kit:

```text
scripts/proof/launch.sh --id b06 --slug harbour --brief <brief file> --model <model id> --dest <folder>
```

| Flag | Meaning |
|---|---|
| `--id <id>` | Required. The proof's id: lower-case words joined by single dashes |
| `--slug <slug>` | Required. The theme's folder under `themes/`: 3 to 32 characters, lower-case words joined by single dashes, starting with a letter, and not a theme the base already has |
| `--brief <file>` | Required. The brief, copied into the clone as `proof/<id>/BRIEF.md` |
| `--model <id>` | Required. The model, as an exact id (`claude-<family>-<version>`); an alias such as `opus` is refused, so an unattended run can't change model under it |
| `--base <tag>` | The tag to clone. Default `kit-b06-base` |
| `--dest <folder>` | Required. Where the clone goes: a new folder, outside the repository the launcher runs in, outside the folder it runs from, and outside the home folder's Claude Code folder |
| `--dry-run` | Prepare the clone and print the run's command; start nothing |

The launcher refuses without `--model`, and refuses any `--dest` above or one that exists. Then it clones the base
tag from the kit's public repository (one commit deep, that tag only), makes the branch `proof/<id>-<slug>`, deletes
every path `leak-paths.txt` lists and commits the deletion with a message naming what it removed, then commits
`proof/<id>/BRIEF.md`, `RUN.md`, `GAPS.md` and `BASE` (the base tag's name). It writes the task (`PROMPT.md`, filled
in) to `<dest>.prompt.md` and, unless `--dry-run`, runs `claude -p` in the clone with that task on its input, that
model, the clone's own settings only, no prompts (a call off the allow-list is denied) and no saved session, writing
the stream-json transcript to `<dest>.transcript.jsonl`, beside the clone and never inside it; when the run stops it
adds the end time to `RUN.md`. It never reads or writes the home folder's Claude Code folder and sends nothing to any
remote. An unattended start is fine: the model is pinned by the flag.

## After the run

1. Audit the transcript, with the deny file if you keep one:
   `node scripts/proof/audit.mjs <dest>.transcript.jsonl <dest> --deny <file>`. The deny file holds one name a
   line that the run must never mention (private repositories, products, people); keep it outside every repository
   and never commit it. The audit prints the run's turns, cost and duration from the transcript's last line, then
   one line per flag. Read the report before you paste it anywhere: it quotes the calls it flags.
2. Copy the turns and the cost into `proof/<id>/RUN.md` (the launcher has added the end time), and commit it.
3. Push the branch and open a pull request. Kit CI runs as on any pull request, and its `proof` job runs too.
4. Never merge the proof branch as it is: its first commit deletes the leak paths. To keep the theme, open a new
   branch from `main` that takes only `themes/<slug>/` and `proof/<id>/` from it.

If the guard names lock entries other than the new workspace's (a different npm can rewrite the file), run
`kit-lockfile.yml` on the proof branch and commit its `kit-lockfile` artifact as `package-lock.json`, as AGENTS.md's
"Adding a dependency" says.

## What each check proves

| Check | Where | Proves |
|---|---|---|
| The guard | kit CI's `proof` job | The diff from the base tag to the branch touches only `themes/<slug>/` and `proof/<id>/`, but the lock's new workspace entries and the launcher's deletion of the leak paths; every leak path is still gone; the theme folder is new |
| The audit | the owner, after the run | No tool call named a path outside the clone (but Node's and npm's own: its cache, the node binary's prefix, `/tmp`, `/private/tmp` and `/dev/null`), named a leak path, ran git on a ref other than `HEAD` or the proof branch, on every ref, against another repository or in a folder outside the clone (`-C`, `--git-dir`, `--work-tree`), printed history's patches with no path to limit them (`git log -p` would show the removed files), used the web, or held a line of the deny file |
| Build, lint, typecheck, test, pack | kit CI's `kit` job | The new theme is a workspace (`themes/*`), so every root script runs its scripts too, and `pack` checks its design and writes its package |
| Shots | kit CI's `proof` job | `automatos-theme shots` draws the theme in the browser harness, every slot, page and route for each preset, on Chromium and WebKit, with an axe scan of each shot; uploaded as `kit-proof-shots` |

The `proof` job runs only on a pull request from a branch whose name starts with `proof/`. It runs `main`'s copy of
`guard.mjs`, never the branch's own, so a proof branch can't change the check that judges it. The guard reads the one
`proof/<id>/BASE` the branch holds, takes the slug from the branch's name, fetches the base tag and checks the diff;
then the job installs, builds, runs `automatos-theme check` on the theme and shoots it.

## RUN.md and GAPS.md

`RUN.md` holds the base tag and commit, the branch, the theme folder, the model and the start time (the launcher
writes them), the end time (the launcher adds it when the run stops), the turns and the cost (the owner copies them
from the audit), and what the run did, in order, with what it left unfinished (the run writes it).

`GAPS.md` has one row per gap, in the order the run met them: the gap, where (a file, a command or a guide), its
category, and what the agent did instead. The categories:

| Category | The gap is in |
|---|---|
| `docs` | A guide, skill, README or reference page: missing, wrong or unclear |
| `cli` | An `automatos-theme` command: missing, failing, or its output misleads |
| `template` | A template or a worked example (Play, HUD): it lacks what the brief needs |
| `checks` | `check`, `check design`, lint, the tests or the harness: a right thing refused, or a wrong thing passed |
| `host` | The host contract or the SDK: the theme has no way to do it (a core follow-up) |
| `brief` | The brief: unclear, or at odds with the kit |
| `environment` | The toolchain or the machine, not the kit |

Triage gives each row a disposition afterwards (a kit fix with its story, a core follow-up with its issue, or
deferred by the owner with a date); the run does not.
