# @automatos/theme-cli

The `automatos-theme` command. `pack` comes first, with `source/` and `pack --watch`; then a section each for
`submit`, `install`, `new` (a theme from a template), `shots`, `previews` and `dev` (the browser harness as a local
app), and last the phone's model, the modules the harness's phone view draws from. `brief` (a theme brief from a
brand kit file), `clone` (a core page's source as a read-only reference) and `skin` (a phone skin, `skin.json`,
checked and written into `theme.json`) are described at the top of `src/brief.ts`, `src/clone.ts` and `src/skin.ts`,
and in `docs/cli-design.md`. `check` and `check design` are described at the top of
`src/check/index.ts` and `src/check/design.ts`.
`src/cli-main.ts` holds the table of every command.

`automatos-theme pack <theme folder> [--out <folder>] [--watch]` turns a built theme into the package the Automatos
server installs (`--watch`: again after each change, below).

It reads the folder's package files (`theme.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, and everything under
`dist/`, `boot/`, `looks/` and `assets/`), adds the theme's `src/` as `source/` (below), checks them as core's
package reader does, and writes:

- `<publisher>.<slug>-<version>.autotheme`: a plain zip, members in path order with one fixed time, so the same
  files always give the same package;
- `<publisher>.<slug>-<version>.sha256.json`: each file's type, size and sha256, the package digest the server
  names the package by, and the sha256 of the zip.

When the server would refuse the theme, `pack` writes nothing, prints every reason with the server's code
(`MISSING_SLOT`, `CSS_UNSCOPED`, `NOT_ALLOWED`, ...) and exits 1. The checks are core's own validators for
`theme.json`, the looks and the prepaint table (vendored in `src/core`, see its README), and ports of the server's
zip reader (`src/members.ts`, `src/check-package.ts`), of what it refuses of a theme's first paint (`src/first-paint.ts`:
`BAD_PREPAINT`, `BAD_CSS_VALUE`, `PREPAINT_DEFAULTS_UNFIT`, `KNOB_NOT_PAINTED`, `KNOB_NOT_IN_SCHEMA`; what each means
and how to fix it is in `docs/cli.md`, "First-paint refusals") and of its CSS scope check
(`@automatos/vite-preset/css-scope`). Core's shared test corpus holds all of them to the server's verdicts
(`test/core-corpus.test.ts`).

## source/

A Marketplace package carries its source so the review can rebuild it: `pack` copies every file under the theme's
`src/` (dotfiles and dot folders left out) to `source/<same path>`, byte for byte, and the package digest covers them. `pack` writes
`source/` itself, so a `source/` folder in the theme folder is refused. It also refuses, writing nothing, a `src/` the
review could not rebuild or core would not take as source: a file that isn't a source kind (`.ts`, `.tsx`, `.js`,
`.jsx`, `.mjs`, `.cjs`, `.css`, `.json`, `.md` or `.txt` with a plain name), more than 8 levels deep, over 1 MB or not
UTF-8; a symbolic link; and a `src/` without exactly one entry module (`entry.ts`, `entry.tsx`, `entry.js` or
`entry.jsx` at its top). Every refusal names the `src/` path and the `source/` path it would have had. A theme with no
`src/` still packs, with one warning, and its package has no `source/`: it installs privately, but the Marketplace
review fails it at Source.

A theme that bundles kit workspace packages (the kit libraries, whose `package.json` sets `"kitLibrary": true`, that
its own `package.json` names under `dependencies`, as the vite-preset reads them) gets each one's `src/` as
`source/packages/<name>/src/<same path>`, under the same rules; the package's other files are not packed.
`source/packages/` is theirs alone, so a theme's own `src/packages/` is refused (`SOURCE_RESERVED`), as is a bundled
package with no `src/` folder or at another version than the theme names (`SOURCE_PACKAGE`).

The review (`scripts/review/rebuild.ts`) writes the package back out with `source/` as `src/`, and each
`source/packages/<name>/src/` as `packages/<name>/src/` beside it, the theme at `themes/theme/`, as the kit lays them
out. It builds it with the kit's preset alone: `automatosTheme({ entry, packages })`, from the theme folder, with no
config file. It sees no `tsconfig.json`, `package.json` or `vite.config.*`, because none of them is in the package. So
a theme's build must not depend on its own config: no path aliases, no extra Vite or PostCSS plugins, no preset
options but the entry, and nothing bundled from outside `src/` and its kit packages' `src/` (the preset's source guard
refuses that in the author's build too).

Node 22.18 or later runs the TypeScript sources directly (type stripping): `npm run pack` packs core's hello
test theme into `out/`.

## pack --watch

`automatos-theme pack <theme folder> [--out <folder>] --watch` runs the theme's own build (`npm run build` in the theme
folder) and packs the folder, now and again after each change under its `src/`, until Ctrl-C. Upload the fresh
package again to try it (`install`, or Install theme in Settings): a live link from a host to your machine is not
part of the kit.

- A burst of saves is one change: the cycle starts once `src/` has been quiet for 200 ms, and a change made while a
  cycle runs starts one more after it, never two at once. Dotfiles (an editor's swap file) are no change, as they are
  no part of `source/`. Each folder under `src/` is watched with Node's own `fs.watch`, folders added later too.
- Only `src/` is watched: the build writes the rest of the package (`dist/`, and Play's `looks/` and `boot/`).
- A failed build packs nothing; a refused pack prints every reason, as `pack` does. Either way the watch goes on and
  the next change tries again.

Exit code 0 once stopped, 1 when the folder has no `src/` to watch, 2 for a usage error.

## submit

`automatos-theme submit <file.autotheme>` sends a package to the Automatos Marketplace for review, through core's
`POST /api/marketplace/themes/submit` (the package as the multipart field `file`). The server checks the package,
runs its automated review stage and stores the version as pending; a person reviews every version before it is
listed. The command prints the server's answer: pending review with the automated verdict and each check, or every
sentence and error code of a refusal.

Where and as whom come from the environment only, never from a file:

| Variable | Meaning |
|---|---|
| `AUTOMATOS_API_URL` | The Automatos API's address, `https://...` (plain `http://` only to this machine, or with no token). |
| `AUTOMATOS_API_TOKEN` | Optional. Sent as `Authorization: Bearer <token>`; never printed (any line holding it shows `[AUTOMATOS_API_TOKEN]`). |
| `AUTOMATOS_WORKSPACE_ID` | Optional. Sent as `X-Workspace-ID`; without it the server uses the person's own workspace. |

Who the route accepts is core's decision. It needs a workspace member, the Marketplace switch on, and step-up: in the
local edition step-up passes and no token is needed; in the SaaS edition it passes only a Clerk session token from a
sign-in within the server's step-up window (10 minutes by default), and it refuses API keys. There is no long-lived
credential for this route yet, so outside the local edition the command will usually print the server's 401 or 403
and what it asks for.

Exit code 0 when the server took the submission (201, or 200 when these exact bytes were submitted already), 1 when
it refused it or gave no answer, 2 for a usage or environment problem (nothing is sent).

## install

`automatos-theme install <file.autotheme> --to <url> [--choose]` installs a package privately in your workspace on
the local edition, the way Settings, Appearance, Themes does by hand, so you can try a theme without the web UI. It
makes core's calls, each only once the one before it succeeded:

1. `POST /api/themes/import`, the package as the multipart field `file`: 201 with the package and its install, or
   200 when these exact bytes are in the workspace already. The server checks the package and runs its automated
   review stage; the package stays private to the workspace and unreviewed.
2. Only when the workspace's install of the theme runs another version (the import's status is `update_available`,
   a newer version offered as the update, or `stored`), `POST /api/themes/installs/{installId}/update` with
   `{packageId}`: the install moves to this package, and the version it ran before is kept for rollback in Settings.
   So raising the version in `theme.json` and running `install` again moves you to the new one. The server refuses
   a version not newer than the installed one (409, in its own words).
3. `POST /api/themes/installs/{installId}/opt-in` with `{packageId}`: you opt in to the unreviewed code, and the
   command prints the server's opt-in wording.
4. With `--choose` only, `PUT /api/themes/choice` with `{choice: installId}`: the theme becomes yours in that
   workspace. Without it, choose the theme in Settings, Appearance, Themes.

`--to` takes either address of the local edition: the web app's URL (`install --to http://localhost:3000`) or the
API's (`http://localhost:8000`). The command asks `GET <to>/health` first; when that is the API's health answer,
`<to>` is the API. Otherwise it reads `GET <to>/automatos-host.json`, the web app's `{schema: 1, apiUrl}`, and sends to
that `apiUrl`. Neither question carries a credential or follows a redirect. When neither answers, it prints one
sentence naming both forms, sends nothing and exits 2. Every address must be `http://` or `https://` with no user,
password, query or fragment, and plain `http://` only to this machine (`localhost`, `127.0.0.1`, `[::1]`); a host
file whose `apiUrl` breaks that is refused.

As whom comes from the environment, as for `submit`: `AUTOMATOS_API_TOKEN` (optional; the local edition needs none;
sent only to the API, never printed) and `AUTOMATOS_WORKSPACE_ID` (optional). The import needs a workspace admin, the
workspace's "who may install" setting, private uploads switched on, and step-up, which the local edition passes; the
update needs the same but the uploads switch.

Each refusal is printed in the server's words with its status and code: private uploads off or a reserved publisher
(403), a version clash (409), a package over the cap (413, `PACKAGE_TOO_LARGE`), step-up (403, `step_up_required`).

Exit code 0 when the package is installed (by the import or the update) and opted in to (and chosen, with
`--choose`); 1 when the server refused a step, gave no answer, or stored the package with a status this command does
not know; 2 for a usage or environment problem, a package file that can't be read, or a `--to` that names no
Automatos API (nothing is sent).

Limits:

- The local edition only. Hosted CLI auth, a credential the command could use against a hosted API without a browser
  sign-in, is parked for now; that is the maintainer's call, not a gap. Against a hosted API the command will usually
  print the server's 401 or 403.
- A core without `/automatos-host.json` (PRD-261 B-03j) answers neither form for the web app's URL, so `--to` with it
  exits 2 with the sentence above; there, give the API's URL (`--to http://localhost:8000`).

## new

`automatos-theme new <publisher/name> [--template minimal|full] [--mascot none] [--to <folder>]` starts a theme from
one of the kit's templates (`minimal` when `--template` is left out), in a folder that builds, packs and passes `check`
as it is. The folder is `--to`, or `themes/<name>` from the folder the command runs in (the kit's root, for a theme in
the kit).

- `--template minimal` (`templates/minimal`): the frame only, with the host's own pages inside it, a look editor and a
  style sheet, the 404, three choice knobs and two presets. Its look data (`looks/`, `boot/prepaint.json`,
  `design/contrast.json`) is written by hand, and its look editor keeps a copy of the knobs and presets that its own
  test holds to the files. The template's `{{id}}`, `{{publisher}}`, `{{slug}}`, `{{name}}` and `{{htmlClass}}` are
  filled with the theme's.
- `--template full` (`templates/full`): Play de-branded, made from `themes/play` itself when the theme is made, so it
  never drifts from Play: every slot, page and route Play has, with every name of Play's in the theme's (its class,
  its `--pl-*` variables, in its stylesheets and as its look code makes them, its keyframes and font families, its
  file names, components, hooks and constants, its id, and its name in words), and one core page cloned: `/agents`,
  in `"mode": "clone"` with the `clonedFrom` sha of the core file it copies (the vendored `core-pages.json`'s), on
  the SDK's `pages/agents` area.
  `templates/full/template.json` lists the renames and what the template adds. Play's look
  data is written once, by the kit's `scripts/compile-looks.mjs`, and is the theme's own from then on. Play's listing
  previews and phone screenshots are not copied, and Play itself is only read.
- `--mascot none` (full only): no clips, no `mascot` block, no `@automatos/mascot`. The chat still says what Auto is
  doing, from the package's state machine and words, copied into the theme's `src/lib/auto/`.

The name is also the theme's class on `<html>` and its folder's name: 3 to 32 lower-case letters and digits, in words
joined by single dashes, starting with a letter. The command refuses, writing nothing, a folder that is there already,
a folder inside the kit's `themes/play`, `templates` or `packages` (which it only reads: a theme written there would
change Play's package or every theme made from a template), the `automatos` publisher (Automatos's own themes), a
class core keeps on `<html>` (`studio`, `classic`, `dark`, `light`, `system`), and a name whose renames would merge
two of Play's names into one.

A theme folder under the kit's `themes/` keeps its template's `tsconfig.json`, extending `../../tsconfig.base.json`
as Play's and HUD's do (the kit's CI holds every workspace to that); a folder anywhere else gets a `tsconfig.json`
that holds the kit's shared compiler options itself, so it builds outside the kit.

A theme folder under `themes/` is a new npm workspace, so it changes `package-lock.json`: push the branch and run
`kit-lockfile.yml` (the kit's `AGENTS.md`, "Adding a dependency").

Exit code 0 when the folder is written, 1 when the theme was refused (every reason is printed), 2 for a usage error.
The command reads the kit's own folders, writes only the new one, and sends nothing anywhere.

## shots

`automatos-theme shots <theme folder> [--out <folder>]` draws the theme in the kit's browser harness
(`packages/theme-harness`, its README says how), with nothing of Automatos running, and shoots it on Chromium and
WebKit: one PNG per slot, page and route the theme serves, for each of its presets at 1440 and 1024 px, the same at
390 × 844 for a theme whose `minWidth` fits a phone, plus one set just below its `minWidth`, and for a theme with a
`/chat` page two more chat shots at 1440 (motion allowed, and a made-up transcript), each with an axe scan (`axe.json`
beside each set). The out folder (default `./shots`) holds
`<browser>/<preset>/<width>/<view>.png`.

It builds the harness for the folder (`vite build --config vite.harness.config.ts`), then runs the shots
(`playwright test --config shots/playwright.config.ts`, which serves that build on `http://127.0.0.1:4318`). The
browsers come from `npx playwright install chromium webkit`. A theme whose `theme.json` names a default look needs
its `looks/presets/` first: run the theme's build (Play's writes them; HUD's are committed).

Exit code 0 when every shot passed; the failing step's own exit code when one failed (the shots fail on a missing
PNG, on any request to another origin than the harness's, and on a critical axe violation); 1 when the folder has no
`theme.json` or `src/entry.ts`, or its presets are not built yet; 2 for a usage error. Kit CI's `harness` job runs it
over Play, then over HUD into the `hud/` folder of the same out folder, and uploads it as the `kit-harness` artifact.

## previews

`automatos-theme previews <theme folder> --from <shots folder> [--pick <name>=<shot>]...` copies the harness shots you
picked into the theme's Marketplace previews and sets `theme.json` `previews` to them, in the order given. The listing
keeps `theme.json`'s order and its cover is the first preview listed, so the first pick is the cover.

A pick names a preview and the shot it is: `--pick ember=chromium/ember/1440/page-chat.png` writes
`assets/previews/ember.png`, and `--pick ember-looks=chromium/ember/1440/slot-lookEditor-1.png` writes
`assets/previews/ember-looks.png`, from the folder `shots` wrote (`<browser>/<preset>/<width>/<view>.png`). The listing
shows `<preset>.png` and `<preset>-<screen>.png` under that preset (the longest preset id that matches wins), so a name
no preset claims is refused. With no `--pick`, each preset gets `<preset>.png`: its first view (slots, then pages,
then routes, as the harness orders them) on Chromium at 1440 px, the default look first.

Every pick is checked before anything is written, and every reason is printed: a name the server's reader would not
take as `assets/previews/<name>.png`, a name no preset claims or picked twice, a shot outside the shots folder,
missing, over 512 KB or not a PNG, and more than 24 previews. `theme.json` keeps its own layout: only `previews` is
written. A file in `assets/previews/` the new list doesn't name is left in place, with a warning, since `pack` still
packs it. `check` then lists each preview under its preset and names the cover.

`automatos-theme previews <theme folder> --phone <screenshots folder> [--pick <name>=<file>]...` does the same for
the Marketplace's phone screenshots (`src/previews-phone.ts`): Automatos Go screenshots you took with the theme
installed, copied into `assets/previews/phone/` and listed as `theme.json` `phonePreviews`, the first the listing's
phone cover. `--pick ember-chat=IMG_0412.PNG` writes `assets/previews/phone/ember-chat.png`; the extension is the one
the file's bytes give, `.png` for a PNG and `.jpg` for a JPEG. With no `--pick`, every `.png`, `.jpg` or `.jpeg` file
right in the folder is a pick named by its file name, the default look's first. The same rules hold (the names the
reader takes and a preset claims, each picked once, at most 512 KB, at most 24), with a PNG or a JPEG in place of a
PNG; only `phonePreviews` is written, and a screenshot wider than it is tall is written with a warning
(`src/picture-size.ts` reads its size from its header). Both modes share their checks and writing
(`src/previews-pick.ts`).

The previews are yours to pick and commit: a package's digest covers them, so they are never written by a build.
Exit code 0 when written, 1 when refused (nothing written), 2 for a usage error.

## dev

`automatos-theme dev <theme folder> [--port <n>]` serves the kit's browser harness (the mock host page `shots`
photographs) for the theme on `http://127.0.0.1:4319/`, as a local app to build the theme in, with nothing of
Automatos running: the toolbar switches the view, preset, width, tone, reduced motion, forced colours and a made-up
transcript in the chat.

1. It listens first, on `127.0.0.1` only and the port (`--port`, default 4319, beside the shots' 4318; `0` picks a
   free one). A port in use is refused in one sentence, before anything is built.
2. It builds the harness for the folder as `shots` does (`vite build --config vite.harness.config.ts`), each build into
   a fresh folder under the harness's `dist/`, and answers 503 until the first build passed.
3. It serves the last build that passed and nothing else: the page, its scripts and stylesheet (the theme's `src/`
   bundled into them) and the folder's `assets/`. No path reaches the theme folder, the harness or anything outside
   them: an escaped `..` or `/`, a link out of the build, a folder and a dotfile are all 404, and only GET and HEAD
   are answered. Every answer is `no-store`.
4. Each change under `src/` builds again, as `pack --watch` takes changes; a failed build is printed and the last good
   one stays served. Reload the page to see a new build.

The harness draws the folder's look data (`looks/`, `boot/`) as the theme's own build last wrote it, so a theme whose
`theme.json` names a default look needs that build once first; after changing the looks, run it again (or keep
`pack --watch` running beside `dev`), and the next change under `src/` draws them. `/phone` is the harness's phone
view (what Automatos Go draws for the theme, and its contrast; the harness's README), the same page. Kit CI's `harness`
job runs `automatos-theme dev themes/play` and opens `/chat` and `/phone` on it (`shots/dev-smoke.spec.ts` in the
harness), then `automatos-theme dev` over the harness's made-up phone skin and shoots `/phone`
(`shots/phone-shots.spec.ts`).

Exit code 0 once stopped (Ctrl-C), 1 when the folder has no `theme.json` or `src/entry.ts`, its presets are not built
yet, or the port can't be served; 2 for a usage error.

## The phone's model

What Automatos Go draws for a theme's `mobile` block, as pure modules with none of Node's, so the harness's phone view
(`/phone`, the harness's README) draws in a browser what a command prints:

- `@automatos/theme-cli/mobile-answer` (`src/mobile-answer.ts`): what the server answers the phone,
  `GET /api/themes/mobile/{install_id}`'s `mobile` field, from the theme's own files and a look (core's
  `services/themes/mobile.py`, with no database); its tone is `@automatos/theme-cli/mobile-paint`'s `lookTone`
  (`mobile_tokens.py` `look_tone`).
- `@automatos/theme-cli/phone` (`src/phone/`): Studio's colours as the app draws them, and an installed theme's
  painting over them, from that answer, with the chat thread's boxes, as the app's `src/styles/themes/paint.ts` and
  `src/styles/tokens/` paint them; and the nearest passing colour for a failing contrast pair
  (`src/phone/nearest-passing.ts`: the pair's first token with its lightness moved the least, hue and saturation
  kept, measured as `check` measures it).
- `@automatos/theme-cli/mobile-contrast` (`src/check/mobile-contrast.ts`): `check`'s own AA measure of the block,
  which the phone view's contrast panel shows, so the two never disagree.
- `@automatos/theme-cli/skin-check` (`src/skin-check.ts`): a skin checked as `automatos-theme skin` checks it, the
  vendored validator and then the files it names and the contrast, with each failing pair's nearest passing value,
  so the harness's skin designer offers `skin.json` only when the command would write it.

The phone side is ported from Automatos Go (`AutomatosAI/automatos-go`) at one commit; each module's comment names
the app's files and lines it follows:

| Repository | Commit |
|---|---|
| `AutomatosAI/automatos-go` | `39b638cbae65b513a6ed42ad27f72d52fcf803e0` |
| `AutomatosAI/automatos-go`, branch `feat/a9-candy` (`automatos/candy`'s built-in layout, until it merges) | `2ee8cca4ca447649089163061e561bc3c8f4379b` |
