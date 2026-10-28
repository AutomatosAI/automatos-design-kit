# The proof protocol

A proof shows that the kit is enough to build a new theme on its own (PRD-261 B-06). A fresh Claude Code session,
given only a clean clone of the kit at a base tag and a brief, builds the theme the brief describes with the kit as
it is designed: the `automatos-theme` commands (`new`, `check design`, `check`, `pack` and the rest), the guides, the
skills, and Play and HUD as worked examples. It may change only its theme folder and its proof folder. Afterwards
the guard checks the branch's diff, the audit checks the run's transcript for reads it should not have made, and CI
on the proof branch builds, lints, typechecks, tests, packs and draws the theme.

This protocol is two steps (launch, judge) of the nine from a design to an installed, listed theme; the whole path,
with the step before a launch (the brief) and the ones after a proof passes (fix, release, install, list), is
[guides/from-design-to-theme.md](../guides/from-design-to-theme.md).

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
| `run-settings.json` | The run's Claude Code settings, its permission rules and its sandbox: a template that `launch.sh` fills with the clone's paths and writes into the clone's settings |
| `leak-paths.txt` | The paths `launch.sh` deletes from the run's clone before the run starts |
| `<id>/` | One proof's folder, on its proof branch only: `BRIEF.md`, `RUN.md`, `GAPS.md`, `BASE` and, with `--design`, `design/` |

The scripts are in `scripts/proof/`: `launch.sh` prepares the clone and starts the run, `guard.mjs` checks the diff
and `audit.mjs` checks the transcript, with `leak-content.mjs` (the content check), `shell.mjs` (a Bash call read as
the shell reads it) and `transcript.mjs` (the transcript's calls and results). `tests/proof*.test.ts` holds them to
this page.

## What the run may read and change

- It reads only inside its clone: the kit at the base tag, with the leak paths deleted. No web, no other folder of
  the machine, no other branch, tag or earlier commit.
- It changes only `themes/<slug>/` and `proof/<id>/`, and `package-lock.json` only by the new workspace's own
  entries (`themes/<slug>` and its `node_modules/<package name>` link), which `npm install` adds.
- Its tools are `run-settings.json`'s, filled in and written into the clone's Claude Code settings, kept out of git:
  the file tools inside the clone; Bash for `npm ci`, `npm install`, `npm run`, `npm test`, `npx automatos-theme`,
  and `git status`, `git diff`, `git add`, `git commit` and `git log`. `node` on its own, `npm exec`, `npx -c`,
  `npm publish`, `git push`, `curl`, `wget`, WebFetch and WebSearch are denied, and so is the home folder. Bash runs
  in a sandbox ([Isolation](#isolation)). The kit's `skills/` folder is linked into the clone's settings folder, so
  the run can use the skills as Claude Code skills.
- The run installs, builds and tests in its clone, so launch it on a machine where that is fine. The kit's rule that
  nothing runs on the maintainer's machine is about the maintainers' own checkouts; `PROMPT.md` tells the run so.

## Isolation

The run is held twice: Claude Code's permission rules hold its own tools, and a sandbox holds its shell. Both come
from `run-settings.json`, a template: `launch.sh` fills in `{{CLONE}}` (the clone's real path; in a permission rule
`/{{CLONE}}` becomes the `//`-prefixed absolute form), `{{NPM_CACHE}}` (`<dest>.npm-cache`, beside the clone) and
`{{TOOLCHAIN_BIN}}`/`{{TOOLCHAIN_NPM}}` (below, or drops their line together), and refuses settings with a
placeholder left. Neither layer is perfect on its own; the audit reads the record of both.

- **The sandbox** holds Bash and every process it starts: npm, the build, the tests, any script a `package.json`
  names. They write only to the clone and to npm's cache (`allowWrite`), never to the clone's Claude Code project
  settings folder (where the settings are), `.git/hooks/` or `.git/config` (`denyWrite`); they read nothing in the
  home folder (`denyRead`); and they reach only the npm registry (`registry.npmjs.org`): any other host is refused.
  They may listen and connect on localhost, for a dev server (`allowLocalBinding`, on macOS; on Linux a sandboxed
  command has a localhost of its own). `failIfUnavailable` stops the run when the sandbox can't start,
  `allowUnsandboxedCommands: false` takes away the retry outside it, and `autoAllowBashIfSandboxed: false` keeps
  the Bash rules the gate (by default a sandboxed command needs no allow rule). npm runs with no user config
  (`npm_config_userconfig=/dev/null`), so the home folder's `.npmrc` and its tokens stay out, and the clone's git
  config holds the identity the run commits with (`.git/index` and `.git/objects` stay writable, for that commit;
  `.git/hooks` and `.git/config` do not).
- **node under the home folder**: when node's install prefix is inside the home folder, the launcher checks it
  against the version managers it knows (`~/.nvm/versions/node/<v>`, `~/.volta/tools/image/node/<v>`,
  `~/.local/share/fnm/node-versions/<v>/installation`, `~/.asdf/installs/nodejs/<v>`) and, only then, puts the node
  binary's own folder and `<prefix>/lib/node_modules/npm` in the sandbox's `allowRead`
  (`{{TOOLCHAIN_BIN}}`/`{{TOOLCHAIN_NPM}}`) — never the whole prefix, and never the home folder itself or a direct
  child of it, which a made-up `node` could claim to be: that would hand the sandbox the home folder back. A prefix
  that isn't one of those layouts gets no `allowRead` at all, with a warning that npm or node may fail to start. The
  sandbox's documented rule is that the narrower path wins, so these two paths are readable while the rest of the
  home folder stays denied; it is unproven until the first real launch, and if npm or node fail to start, look there
  first.
- **The permission rules** hold Claude Code's tools: Read and Edit inside the clone only (an `Edit` rule covers the
  Write tool too, and a `Read` rule Glob and Grep; `Write(...)` and `Glob(...)` path rules never match), the home
  folder denied (`Read(~/**)`, `Edit(~/**)`), the clone's Claude Code project settings folder, `.git/hooks/` and
  `.git/config` denied to Edit too (matching the sandbox's `denyWrite`, since nothing else stops the Edit tool
  writing them), the web denied, and Bash only for the commands listed, with `node`, `npm exec`, `npm x`, `npx -c`,
  `npm publish`, `git push`, `curl` and `wget` denied. Under `--permission-mode dontAsk` a call no rule allows is
  refused without a prompt. The launcher also makes the clone's Claude Code settings file unwritable (`chmod a-w`)
  before it starts the run, so even a write neither layer catches fails at the filesystem.
- **`.git/hooks` and `.git/config`, after the run**: the launcher snapshots `.git/config` once the clone has its
  commit identity, and, when the run stops, removes any non-sample file `.git/hooks` has gained and restores
  `.git/config` if it no longer matches, saying so either way, before anything else touches the clone's git with a
  host command — a hook or a config value a later `git` command on this machine could otherwise run or be
  redirected by.
- **What is left**: Bash's read-only commands (`cat`, `ls`, `grep`, `find`) and every process in the sandbox can still
  read outside the clone wherever it isn't the home folder: the system's folders, another checkout under `/tmp`. The
  audit's outside-path flag catches a path a call names outside the clone, and its content check catches a leak
  file's text however the run came to read it.
- **Platforms**: on macOS the sandbox is built in (Seatbelt). On Linux and WSL2 it needs `bubblewrap` and `socat`;
  without them the run doesn't start.

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
| `--design <folder>` | A design handoff folder (a README, `looks.json`, `*.html` and `*.dc.html` mocks), copied into the clone as `proof/<id>/design/`, preserving names; `*.js` files (a design tool's own runtime, never the design) are skipped. Refused when the folder is missing, lies inside `$HOME/.claude`, or holds a file over 5 MB. What is copied and skipped is listed in `RUN.md` |
| `--dest <folder>` | Required. Where the clone goes: a new folder, outside the repository the launcher runs in, outside the folder it runs from, and outside the home folder (under `/tmp`, say), so the run's rules can deny the home folder |
| `--dry-run` | Prepare the clone and print the run's command; start nothing |

The launcher refuses without `--model`, and refuses any `--dest` above, one that exists, and one whose path holds a
quote, a backslash, `#`, `&` or a control character (the settings are filled in with it). Then it clones the base
tag from the kit's public repository (one commit deep, that tag only), makes the branch `proof/<id>-<slug>`, deletes
every path `leak-paths.txt` lists and commits the deletion with a message naming what it removed, then commits
`proof/<id>/BRIEF.md`, `RUN.md`, `GAPS.md` and `BASE` (the base tag's name). It gives the clone's own git config the
identity this machine commits with (the sandbox keeps the run from the home folder's), writes the run's settings
(`run-settings.json`, filled in with the clone's paths) and the task (`PROMPT.md`, filled in) to `<dest>.prompt.md`
and, unless `--dry-run`, runs `claude -p` in the clone with that task on its input, that model, the clone's own
settings only, no prompts (a call the rules don't allow is denied), no saved session, npm's cache at
`<dest>.npm-cache` and no npm user config, writing the stream-json transcript to `<dest>.transcript.jsonl`, beside
the clone and never inside it; when the run stops it adds the end time to `RUN.md`. It never reads or writes the home folder's Claude Code folder and sends nothing to any
remote. An unattended start is fine: the model is pinned by the flag.

## After the run

1. Audit the transcript, with the deny file if you keep one:
   `node scripts/proof/audit.mjs <dest>.transcript.jsonl <dest> --deny <file>`. The deny file holds one name a
   line that the run must never mention (private repositories, products, people); keep it outside every repository
   and never commit it. Audit the clone as the launcher and the run left it: the content check reads the base from
   its history. The audit prints the run's turns, cost and duration from the transcript's last line and what the
   content check holds, then one line per flag. Read the report before you paste it anywhere: it quotes the calls
   it flags (never a leak file's text).
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
| The audit's content check (authoritative) | the owner, after the run | No tool result showed the run a leak file's text: none held a fingerprint of one (`leak-content: <leak file> seen in turn <n>`), and the base could be read from the clone's history |
| The audit's command checks (secondary) | the owner, after the run | No tool call named a path outside the clone (but Node's and npm's own: its cache, the node binary's prefix, `/tmp`, `/private/tmp` and `/dev/null`), named a leak path, ran git on a ref other than `HEAD` or the proof branch, on every ref, against another repository or in a folder outside the clone (`-C`, `--git-dir`, `--work-tree`), printed history's patches for a path outside `themes/<slug>/` and `proof/<id>/` or for none (`git log -p` would show the removed files), used the web, or held a line of the deny file; each command read as the shell reads it, quotes and escapes taken off |
| Build, lint, typecheck, test, pack | kit CI's `kit` job | The new theme is a workspace (`themes/*`), so every root script runs its scripts too, and `pack` checks its design and writes its package |
| Shots | kit CI's `proof` job | `automatos-theme shots` draws the theme in the browser harness, every slot, page and route for each preset, on Chromium and WebKit, with an axe scan of each shot; uploaded as `kit-proof-shots` |

The `proof` job runs only on a pull request from a branch whose name starts with `proof/`. It runs `main`'s copy of
`guard.mjs`, never the branch's own, so a proof branch can't change the check that judges it. The guard reads the one
`proof/<id>/BASE` the branch holds, takes the slug from the branch's name, fetches the base tag and checks the diff;
then the job installs, builds, runs `automatos-theme check` on the theme and shoots it.

### Why the content check is the authoritative one

The command checks read what a call asked for, and a command can be written in more ways than they read: an escape the
shell takes off (`com\mand`, which they do read), a git alias, a shell inside a shell (`sh -c`), or a script that runs
git itself. The content check reads what came back instead. From the clone's history it takes the base (the parent of
the launcher's deletion commit, which must be the commit of the tag `proof/<id>/BASE` names when the clone has both)
and the leak files there (`leak-paths.txt` at the base). Each leak file's fingerprints are its lines, trimmed, of 32
characters or more that no other text file of the base holds, whole or inside a line (so a line HUD shares with the
reference it was built from is none), and its whole text, when it has a line of its own. Every tool result in the
transcript, which holds what each call showed the run, is searched for them, as written and as JSON escapes them (a
line counts by its first 200 characters). Whichever way the run reached a leak file, what it was shown is in a result,
so a flag here stands whatever the commands looked like; the command checks then help find the call.

It does not see text the run turned into something else before printing it (base64, say), nor a leak file's lines
under 32 characters. A long line a leak file shares with a file outside the kit (boilerplate in an HTML page, say)
flags a read of that file too, and a brief that quotes a leak file flags its own read: the report names the leak
file and the turn, so read that turn of the transcript before deciding.

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
