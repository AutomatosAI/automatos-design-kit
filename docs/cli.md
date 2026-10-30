# `automatos-theme`: the command line

`automatos-theme` is the kit's command line (`packages/theme-cli`). It starts a theme from a template, serves it in
the browser harness, checks it as the Automatos server would, packs it into an `.autotheme` file, and installs or
submits that file. Every fact here is read from `packages/theme-cli/src/`; the command table is `COMMANDS` in
`src/cli-main.ts`. The design commands, `brief`, `clone` and `skin`, are in [cli-design.md](cli-design.md); the
browser harness's, `dev`, `shots` and `previews`, in [cli-harness.md](cli-harness.md).

## Running it

The CLI is a workspace of this kit, not a published package (its `package.json` is `"private": true`). Several
commands read the kit's own folders (`new` reads `templates/` and `themes/play/`, `check --rebuild` runs
`scripts/review/rebuild.ts`), so run it from a clone of the kit:

```sh
npm ci                              # once: the kit's dependencies, from package-lock.json
npx automatos-theme <command> ...   # from the kit's root
```

A theme's `package.json` scripts call it by name (`"pack": "automatos-theme pack . --out out"`). Node 22.18 or later
runs its TypeScript directly (`src/cli.ts`, type stripping).

Every command:

- writes its results to stdout and its refusals, failures and warnings to stderr; a warning line starts `warning: `;
- resolves every path it is given from the folder it runs in;
- takes its flags strictly: an unknown flag, a missing value or an extra argument is a usage error, and the command
  prints its usage line;
- exits 0 when it did what was asked, 1 when it ran and refused or failed, and 2 for a usage error. Each command's
  section says exactly what 1 and 2 mean for it.

No command, or a name that isn't in the table, prints the usage (the `pack` and `submit` lines and the list of
commands) to stderr and exits 2.

## The commands

| Command | What it does | Network |
|---|---|---|
| [`pack`](#pack) | A built theme folder into `<publisher>.<slug>-<version>.autotheme` and its `.sha256.json` | none |
| [`pack --watch`](#pack---watch) | The theme's build and `pack`, again after each change under `src/` | none |
| [`check`](#check) | The server's review checks on the folder, packed as `pack` packs it | none |
| [`check design`](#check-design) | The look schema, presets, first-paint table and declared colour pairs, before any code | none |
| [`check handoff`](#check-handoff) | A design handoff's `looks.json`: its shape, its knobs and presets through core's look validators, its colour pairs, before any of the theme exists | none |
| [`brief`](cli-design.md#brief) | A theme's brief from a brand kit file: grounds, accents and text pairs with their AA ratios, fonts, logos, voice | none |
| [`new`](#new) | A new theme folder from `templates/minimal`, or from Play without its brand | none |
| [`clone`](cli-design.md#clone) | A core page's source, checked by its hash, as a read-only reference, and the page made a clone in `theme.json` | the public core repo on GitHub |
| [`skin`](cli-design.md#skin) | A phone skin (`skin.json`, the `mobile` block the harness's skin designer exports), checked as `pack` and `check` would and written into `theme.json` | none |
| [`dev`](cli-harness.md#dev) | The browser harness for one theme, served on `127.0.0.1`, rebuilt after each change | `127.0.0.1` only |
| [`shots`](cli-harness.md#shots) | Every slot, page and route the theme serves, shot on Chromium and WebKit with an axe scan | `127.0.0.1` only |
| [`previews`](cli-harness.md#previews) | Picked shots copied into `assets/previews/`, and `theme.json` `previews` set to them; with `--phone`, Automatos Go screenshots into `assets/previews/phone/` and `phonePreviews` | none |
| [`install`](#install) | A package installed privately in a local Automatos, opted in to and optionally chosen | the address given |
| [`submit`](#submit) | A package sent to the Automatos Marketplace for review | `AUTOMATOS_API_URL` |

## `pack`

```text
usage:    automatos-theme pack <theme folder> [--out <folder>] [--watch]
example:  npx automatos-theme pack themes/harbour --out out
```

Turns a **built** theme folder into the package the server installs. `pack` does not build: run the theme's build
first (`npm run build` in its folder). With `--watch`, see [`pack --watch`](#pack---watch).

| Argument | Meaning |
|---|---|
| `<theme folder>` | The theme's folder. Exactly one. |
| `--out <folder>` | Where to write. Default: the folder the command runs in. Made when missing. |

What goes in the package (`src/collect.ts`, `src/source.ts`):

- `theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `LICENSE.md` and `LICENSE.txt`, each when present;
- everything under `dist/`, `boot/`, `looks/` and `assets/`, dotfiles left out;
- `source/`: every file under `src/` (dotfiles left out), byte for byte, at `source/<same path>`, and the `src/` of
  each kit library the theme names under `dependencies` (`@automatos/look-kit`, `@automatos/mascot`) at
  `source/packages/<name>/src/<same path>`.

Nothing else of the folder is packed: not `package.json`, `vite.config.ts`, `node_modules`, `design/`, `reference/`
(what [`clone`](cli-design.md#clone) writes) or `signatures/`. A file inside a packed folder is never dropped: one the server
would refuse (a source map, say) is reported.

The files are then checked as core's package reader checks them (`src/check-package.ts`, `src/members.ts`,
`src/files.ts`), pass by pass, stopping after a pass that refused anything, as the server does:

1. the paths: a link (`SYMLINK`), a path that leaves the package (`UNSAFE_PATH`), a file twice (`DUPLICATE_FILE`),
   an SVG (`SVG_NOT_ALLOWED`), a path no file may have (`NOT_ALLOWED`), more than 500 files (`TOO_MANY_FILES`), more
   than 50 MB unpacked (`UNCOMPRESSED_TOO_LARGE`);
2. each file's size and bytes: over its cap (`FILE_TOO_LARGE`, `ENTRY_TOO_LARGE`, `CODE_TOO_LARGE`,
   `CLIP_TOO_LARGE`), bytes that are not what the name says (`BAD_FILE_TYPE`), text that is not UTF-8 (`NOT_UTF8`);
3. the content: `theme.json` against core's manifest validator, `dist/entry.js` present, JS and CSS together at most
   3 MB, the look schema and presets, the first-paint table, every file `theme.json` names present
   (`MISSING_FILE`), the default look a preset (`UNKNOWN_DEFAULT_LOOK`), `dist/theme.css` against the server's CSS
   scope check, and the `mobile` block: `fromLooks` must paint `--background` and `--foreground` from the table's
   defaults (`MOBILE_CANNOT_PAINT`), and `clips` or `stills` must have each state's files.

Before any of that, `source/` is refused when it can't be rebuilt by the review: a `source/` folder in the theme
folder (`SOURCE_ON_DISK`; pack writes it), `src/` or a file under it that is a link (`SOURCE_LINK`), a file that is
not a source kind (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.json`, `.md` or `.txt` with a plain name),
more than 8 levels deep, over 1 MB or not UTF-8 (`SOURCE_NOT_ALLOWED`), a `src/` without exactly one entry module
(`entry.ts`, `entry.tsx`, `entry.js` or `entry.jsx`: `NO_SOURCE_ENTRY`, `SEVERAL_SOURCE_ENTRIES`), a theme's own
`src/packages/` (`SOURCE_RESERVED`), and a bundled library with no `src/` or at another version than the theme names
(`SOURCE_PACKAGE`). A theme with no `src/` at all still packs, with one warning: its package installs privately, but
the Marketplace review can't rebuild it.

Finally the zip must be at most 32 MB (`PACKAGE_TOO_LARGE`), core's default `THEME_MAX_PACKAGE_MB`: room for 24 web
and 24 phone screenshots at 512 KB beside the code. The zip is plain and reproducible (`src/zip.ts`): every
member deflated, in path order, one fixed time (1980-01-01 00:00), no folder entries, no zip64. `pack` reads the
written zip back and compares its digest before it reports success.

It writes two files to `--out`:

- `<publisher>.<slug>-<version>.autotheme`: the id's `/` becomes `.`, so `acme/harbour` 0.1.0 is
  `acme.harbour-0.1.0.autotheme`;
- `<publisher>.<slug>-<version>.sha256.json`: `{schema: "automatos-theme-pack/v1", id, version, digest, zipSha256,
  files}`, where `files` maps each path to `{type, size, sha256}`, `digest` is the package digest the server names
  the package by (the sha256 of the sorted `<path>\0<sha256>\n` lines, `src/digest.ts`), and `zipSha256` is the
  sha256 of the zip file itself.

Output: `<file> <bytes> bytes, digest <digest>`, then the manifest's path, on stdout; each warning on stderr. A
refusal prints `<folder> can't be packed: the Automatos server would refuse it.` and then one line per reason,
`  <CODE> <path>: <message>`, and writes nothing.

Exit codes: 0 written; 1 refused; 2 usage error.

## `pack --watch`

```text
usage:    automatos-theme pack <theme folder> [--out <folder>] --watch
example:  npx automatos-theme pack themes/harbour --out out --watch
```

Runs the theme's own build (`npm run build` in the theme folder), then packs the folder exactly as `pack` does, now
and again after each change under `src/`, until Ctrl-C (`src/pack-watch.ts`, `src/watch.ts`).

Only `src/` is watched (the build writes the rest of the package), each folder under it with its own watcher, folders
added later included; a link is never followed and a dotfile is no change. A burst of changes is one change: a cycle
starts once `src/` has been quiet for 200 ms, and a change during a cycle starts one more after it, never two at once.
A failed build packs nothing and a refused pack prints every reason; either way the watch goes on.

Exit codes: 0 once stopped; 1 when the folder has no `src/` to watch; 2 usage error.

## `check`

```text
usage:    automatos-theme check <theme folder> [--rebuild] [--json]
example:  npx automatos-theme check themes/harbour --rebuild
```

The server's review checks, run here (`src/check/`). The folder is packed exactly as `pack` packs it, into a
temporary folder that is removed afterwards; a theme `pack` would refuse is refused here with every reason (exit 1),
and nothing else runs. So build the theme first.

| Flag | Meaning |
|---|---|
| `--rebuild` | Rebuild `source/` with the kit's preset and compare `dist/` byte for byte, with the review job's own `scripts/review/rebuild.ts` (it loads Vite) |
| `--json` | Print the report as JSON (schema `automatos-theme-scan/v2`, with `core: {repo, sha}` naming the core commit) in place of the lines |

The first line names the core commit whose checks these are. Then one line per check, in this order, each at `pass`,
`warning`, `error` or `not_measured`, with plain lines under it:

| Check | What it measures |
|---|---|
| `sizes` | The package, JS and CSS, entry and largest clip, against their caps |
| `cssScope` | `dist/theme.css` scoped under the theme's class |
| `looks` | The presets that pass `looks/schema.json` |
| `uses` | `theme.json` `uses` against the SDK names `dist/` imports: an import of a name the SDK doesn't export is an error; an area used but not declared, a `uses` entry that is no SDK area, or a namespace or dynamic import is a warning |
| `audioCapture` | `dist/` naming the browser's audio APIs itself (`getUserMedia`, `SpeechRecognition`, `speechSynthesis`), core's TV-C7 check: any is an error naming each, since a theme's voice goes through the SDK's `voice` area |
| `clonedFrom` | Each page in `"mode": "clone"` against the core release's hash of the file it copied; a changed or missing file is a warning |
| `previews` | Each web preview and phone screenshot by the preset the listing shows it under, and the listing's cover and phone cover; one no preset claims is a warning |
| `jsRules` | The Marketplace review's JS rules on `source/` (`@automatos/theme-rules`): a finding that refuses the package is an error, one listed for the reviewer a warning; no `source/` is `not_measured` |
| `reproducibleBuild` | Only with `--rebuild`: `dist/` rebuilt from `source/`, byte for byte, or an error naming the files that differ |
| `contrast` | The WCAG AA pairs of the `mobile` block, per scheme or per preset; a pair under its minimum is an error; no block is `not_measured` |
| `llm` | The Marketplace's own stage: always `not_measured` here |

The last line is the verdict: `blocked` on any error, `review_required` on any warning, else `pass`, with the count
at each level. The command sends nothing anywhere.

Exit codes: 0 no check is an error; 1 one is, or the folder is refused; 2 usage error, or the path is no folder.

## `check design`

```text
usage:    automatos-theme check design <theme folder>
example:  npx automatos-theme check design themes/harbour
```

Checks a theme's design before its code (`src/check/design.ts`). It reads the folder as it is on disk, builds
nothing and sends nothing. Three lines, then the verdict:

- `looks`: `looks/schema.json` and every `looks/presets/*.look.json` through core's look validators and codes.
- `prepaint`: `boot/prepaint.json` through core's checks, then its defaults and every preset must fit the table as
  the host keeps it (`PREPAINT_DEFAULTS_UNFIT`, `PRESET_NOT_IN_PREPAINT`). `not_measured` without the table.
- `contrast`: every pair `design/contrast.json` declares, on every preset as the first paint paints it. A pair under
  its `min` (default 4.5) is an error naming the preset, both variables and the ratio (`CONTRAST_UNDER_MIN`), and so
  is a pair a preset can't paint (`CONTRAST_NOT_MEASURED`). `not_measured` without the file.

`design/contrast.json` is the kit's own file; `pack` never packs `design/` and the server never reads it:

```json
{ "schema": "automatos-theme-contrast/v1",
  "pairs": [ { "text": "--harbour-text", "ground": "--harbour-bg" },
             { "text": "--harbour-ring", "ground": "--harbour-bg", "min": 3 } ] }
```

A malformed file is `BAD_CONTRAST_PAIRS`; a link where one of these files or folders goes is core's `SYMLINK`, a
file where a folder goes `NOT_A_FOLDER`. A theme folder itself named `design` is checked as `check design ./design`.

Exit codes: 0 when no line is an error; 1 when one is; 2 usage error, or the path is not a folder.

## `check handoff`

```text
usage:    automatos-theme check handoff <design folder>
example:  npx automatos-theme check handoff "design/Harbour handoff"
```

Checks a design handoff before any of the theme is built (`src/check/handoff.ts`), so what the host can't take is
fixed in the design. It reads the folder's `looks.json`, in the shape `automatos-theme-handoff/v1`
([guides/designing-a-theme.md](../guides/designing-a-theme.md#the-handoff)), builds nothing and sends nothing. Three
lines, then the verdict:

- `handoff`: the file's shape (`BAD_HANDOFF`): its schema, the theme's id (`publisher/name`, not the reserved
  `automatos` publisher), one to twelve presets, each with a tone (`light` or `dark`), a value for its knobs and the
  same named `#rrggbb` colours as every other preset, a default that is one of them, the pairs (`text`, `ground` and
  an optional `min` from 1 to 21), and the optional `phone` block (`colours` `looks` or `schemes`, `fonts` a different
  face for each of `serif`, `sans` and `mono`, `mascot` `clips`, `stills` or `none`).
- `looks`: the knobs and presets through core's own look validators and codes, as the theme's `looks/schema.json` and
  `looks/presets/` would be; each path names `looks.json`.
- `contrast`: every pair on every preset's colours, by the look runtime's own ratio. A pair under its `min` (default
  4.5) is `CONTRAST_UNDER_MIN`, naming the preset, both colours and the ratio; a pair naming a colour the presets
  don't have is `CONTRAST_NOT_MEASURED`. `not_measured` with no pairs.

Exit codes: 0 when no line is an error; 1 when one is (a folder with no `looks.json` included); 2 usage error, or the
path is not a folder.

## `new`

```text
usage:    automatos-theme new <publisher/name> [--template minimal|full] [--mascot none] [--to <folder>]
example:  npx automatos-theme new acme/harbour
example:  npx automatos-theme new acme/night-owl --template full --mascot none
```

Writes a new theme folder that builds, packs and passes `check` as it is (`src/new/`).

| Argument | Meaning |
|---|---|
| `<publisher/name>` | The theme's id, as `theme.json` holds it. The name is also its class on `<html>` and its folder's name. |
| `--template minimal` | The default, when `--template` is left out: the one a theme of its own design starts from. `templates/minimal`: a frame with the host's pages inside it, a look editor, a style sheet, a 404, three choice knobs and two presets, the look data written by hand. Its `{{id}}`, `{{publisher}}`, `{{slug}}`, `{{name}}` and `{{htmlClass}}` are filled in. |
| `--template full` | Play without its brand, made from `themes/play` each time `new` runs: every slot, page and route Play has, renamed to the theme's names, and a clone of core's `/agents` page. Play's listing previews are not copied. |
| `--mascot none` | `full` only: no clips, no `mascot` block, no `@automatos/mascot`; the chat still says what Auto is doing. |
| `--to <folder>` | Where to write. Default: `themes/<name>` under the folder the command runs in. |

The first version is 0.1.0. In the kit's own `themes/` (the default `--to`, run from the kit's root) the written
`tsconfig.json` extends `../../tsconfig.base.json`, as Play's and HUD's do, which the kit's CI asks of every
workspace; anywhere else it holds the kit's shared compiler options itself, so the theme builds outside the kit.

A theme that bundles a kit library (`full` names `@automatos/look-kit`, and `@automatos/mascot` unless
`--mascot none`) is built from that library's folder two levels up, `packages/<name>/` beside `themes/<name>/`, so
keep such a theme in the kit's layout.

It refuses, writing nothing and printing every reason:

- an id that is not `publisher/name` in lower-case letters, digits and dashes;
- the `automatos` publisher, which is Automatos's own;
- a name that isn't 3 to 32 lower-case letters and digits, in words joined by single dashes, starting with a letter;
- a class core keeps on `<html>`: `studio`, `classic`, `dark`, `light` or `system`;
- a `--to` that exists already, or that lies inside the kit's `themes/play`, `themes/hud`, `templates` or `packages`;
- for `full`, a rename that would merge two of Play's names or paths into one.

On success it prints the folder, the template and the file count, then the commands that come next, from the folder it
ran in: build it, see it in the browser harness (`dev`), check it, and pack it into the file Settings › Appearance ›
Themes installs. A folder under `themes/` is a new npm workspace of the kit, so `package-lock.json` no longer lists
every workspace: the theme builds and checks as it is, and the next `npm ci` says the lockfile is out of sync. Run
`npm install` once to bring it up to date in your copy of the kit (the kit's own repository writes its lockfile with
the `kit-lockfile.yml` dispatch instead, AGENTS.md, "Adding a dependency").

Exit codes: 0 written; 1 refused; 2 usage error (including `--mascot` with anything but `none`, or with `minimal`).

## `install`

```text
usage:    automatos-theme install <file.autotheme> --to <url> [--choose]
example:  npx automatos-theme install out/acme.harbour-0.1.0.autotheme --to http://localhost:8000 --choose
```

Installs a package privately in a workspace of a local Automatos and opts you in to it, as Settings › Appearance ›
Themes does by hand; with `--choose` it also becomes your theme there (`src/install.ts`).

| Argument | Meaning |
|---|---|
| `<file.autotheme>` | The package, as `pack` wrote it. |
| `--to <url>` | Required. The API's address (`http://localhost:8000` on a local edition) or the web app's (`http://localhost:3000`). |
| `--choose` | Also make it your theme in that workspace. |

Finding the API (`src/host-resolve.ts`), with no credential and following no redirect: `GET <to>/health`; when that
is the API's health answer, `<to>` is the API. Otherwise `GET <to>/automatos-host.json`, the web app's
`{schema: 1, apiUrl}`, names it. A web app that doesn't serve that file answers neither, and then the API's own
address is the one to give.

The steps, each only once the one before it succeeded:

1. `POST /api/themes/import`, the package as the multipart field `file` (201 new, 200 when these exact bytes are in
   the workspace already);
2. only when the workspace runs another version of the theme (status `update_available` or `stored`),
   `POST /api/themes/installs/{installId}/update`: the install moves to this package, and the version before it is
   kept for rollback in Settings; the server refuses a version not newer than the installed one;
3. `POST /api/themes/installs/{installId}/opt-in`: the opt-in to unreviewed code;
4. with `--choose` only, `PUT /api/themes/choice`.

Each refusal is printed in the server's words, with its status and code. Every address, `--to` and a host file's
`apiUrl` alike, must be `http://` or `https://` with no user, password, query or fragment, and plain `http://` only to
`localhost`, `127.0.0.1` or `[::1]`. The token goes only to the API, and is never printed.

Exit codes: 0 installed and opted in to (and chosen, with `--choose`); 1 a step refused, no answer, or an import
status the command does not know; 2 usage or environment error, a package that can't be read, or a `--to` that names
no Automatos API (nothing sent).

## `submit`

```text
usage:    automatos-theme submit <file.autotheme>
example:  AUTOMATOS_API_URL=http://localhost:8000 npx automatos-theme submit out/acme.harbour-0.1.0.autotheme
```

Sends a package to the Automatos Marketplace for review, through core's `POST /api/marketplace/themes/submit` (the
package as the multipart field `file`), and prints the server's answer (`src/submit.ts`). The server checks the
package, runs its automated review stage and stores the version as pending; a person reviews every version before it
is listed.

Before sending, the zip is read: a package with no file under `source/` can't pass the review's rebuild, so it is
refused with one line and nothing is sent. The request waits up to 300 seconds and never follows a redirect.

Who the route accepts is core's decision: a workspace member, the Marketplace switched on, and step-up, which the
local edition passes with no token and the hosted edition only for a Clerk session token from a recent sign-in (never
an API key). So against a hosted API the command will usually print the server's 401 or 403.

The answer, on success: the theme and version, its status, the automated verdict (`pass`, `review_required` or
`blocked`) with each check's level, and the digest. On a refusal: the status and every sentence and error code the
server gave, then a note for a 401 or a step-up refusal saying what the server asks for.

Exit codes: 0 the server took the submission (201, or 200 for bytes it already had); 1 it refused or gave no answer;
2 usage or environment error, or a package refused before sending (nothing sent).

## The environment

`install` and `submit` read who they are only from the environment (`src/submit-target.ts`), never from a file:

| Variable | Used by | Meaning |
|---|---|---|
| `AUTOMATOS_API_URL` | `submit` | Required. The API's address, `https://...`; plain `http://` only to this machine, or with no token. A path prefix is kept. |
| `AUTOMATOS_API_TOKEN` | both | Optional; the local edition needs none. Sent as `Authorization: Bearer <token>`, which core reads as a Clerk session token. Any line that would hold it shows `[AUTOMATOS_API_TOKEN]`. Visible ASCII only. |
| `AUTOMATOS_WORKSPACE_ID` | both | Optional. Sent as `X-Workspace-ID`; a UUID. Without it the server uses your own workspace. |

No message repeats the token or the URL's value. Every text the server sends back is printed with control
characters replaced, so an answer can't move the cursor or recolour the terminal.

The browser harness's variables are set by the commands themselves: `AUTOMATOS_HARNESS_THEME` (the theme folder) by
`dev` and `shots`, `AUTOMATOS_HARNESS_OUT` (the shots' folder) by `shots`.
