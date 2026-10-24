# Automatos Design Kit

The kit that builds installable themes for Automatos. A theme ships as one `.autotheme` file, a plain zip that an
Automatos server checks, stores and draws for each member who chooses it. This repository holds the build tools, the
command line that packs and checks a theme, a browser harness to draw a theme with nothing of Automatos running, the
guides, and two finished themes: Play and HUD. `AGENTS.md` has the kit's contract and layout in full.

A theme has two parts:

- **The web theme: code.** A theme's `src/` is built into `dist/entry.js` and `dist/theme.css`, which the Automatos
  web app loads into its own page. Through `@automatos/theme-sdk`, the one module the host serves it, the theme fills
  the host's slots (the frame around every page, the look editor, the style sheet, the 404), replaces some core pages
  with its own, adds pages of its own under `/x/`, and ships looks: presets a member picks and changes. A person
  reviews every version before the Marketplace lists it, and a version Automatos vouches for is signed: the
  signature covers exactly its files ([docs/releasing.md](docs/releasing.md)).
- **The phone skin: data.** `theme.json`'s optional `mobile` block gives a phone app colours, font files and Auto's
  clips or stills, and nothing else. A phone app draws it onto a layout built into the app, because an app store
  allows no downloaded code: the server never gives a phone the address of a JS or CSS file. Core serves the block to
  a phone through `GET /api/themes/mobile/{install_id}` (core's `docs/theme-host/mobile.md`, which notes that the
  Automatos Go app does not read that answer yet).

A built package installs and runs the same way on the local edition and the hosted edition of Automatos: the format
carries no edition switch. The command line is narrower: its `install` and `submit` commands are exercised against
the local edition. It has no sign-in of its own, so against a hosted API `submit` sends whatever
`AUTOMATOS_API_TOKEN` holds and will usually print the server's 401 or 403.

## What's in the repository

| Path | What it is |
|---|---|
| [`packages/theme-cli`](packages/theme-cli/README.md) | `automatos-theme`, the command line: `pack`, `check`, `check design`, `new`, `dev`, `shots`, `previews`, `install`, `submit` ([docs/cli.md](docs/cli.md)) |
| [`packages/vite-preset`](packages/vite-preset/README.md) | `@automatos/vite-preset`: the Vite build every theme uses, with the source guard that keeps a build to the theme's own `src/` |
| [`packages/theme-harness`](packages/theme-harness/README.md) | `@automatos/theme-harness`: the vitest preset a theme's tests run on (a fake SDK and a fake host), and the browser harness `dev` and `shots` serve |
| [`packages/theme-sdk`](packages/theme-sdk/README.md) | The type declarations of `@automatos/theme-sdk` 1.1.0, vendored from core; the host serves the real module |
| [`packages/look-kit`](packages/look-kit/README.md) | `@automatos/look-kit`: a look's custom properties, Studio's tokens, the WCAG contrast math and the look validator; a theme bundles it |
| [`packages/mascot`](packages/mascot/README.md) | `@automatos/mascot`: Auto's state machine, clip player, media chooser, captions and the Pause Auto control; a theme bundles it |
| [`packages/theme-rules`](packages/theme-rules/README.md) | `@automatos/theme-rules`: the JS rules the Marketplace review runs on a package's `source/` |
| [`packages/eslint-plugin`](packages/eslint-plugin/README.md) | `@automatos/eslint-plugin`: the same rules as ESLint rules, for a theme's `lint` |
| [`themes/play`](themes/play/README.md) | Play (`automatos/play`): Automatos with Auto the mascot ([docs/themes/play.md](docs/themes/play.md)) |
| [`themes/hud`](themes/hud/README.md) | HUD (`automatos/hud`): Automatos as a command deck ([docs/themes/hud.md](docs/themes/hud.md)) |
| [`templates/`](templates/) | What `automatos-theme new` starts a theme from: `minimal` (a frame, a look editor, a style sheet, two presets) and `full` (Play without its brand); [`templates/ralph`](templates/ralph/README.md), a template for running a theme wave with an agent loop |
| [`guides/`](guides/README.md) | The host contract, the page inventory, the SDK, looks, where the mascot goes, and the pitfalls |
| [`skills/`](skills/README.md) | Agent skills for building a theme, writing its looks and passing the Marketplace review |
| [`references/`](references/README.md) | Two design references (Ember, which Play came from, and Command, which HUD came from), to read, never to build from |
| [`scripts/`](scripts/) | Play's look compiler (`compile-looks.mjs`), the released-themes guard (`release/`), the Marketplace review job (`review/`) and the signing scripts (`sign/`) |
| [`tests/`](tests/) | The kit's own tests: the workspaces, the pins, the workflows, the guides, the templates and the scripts |
| [`keys/theme-signing.json`](keys/theme-signing.json) | The public keys a theme signature verifies against |
| [`.github/workflows/`](.github/workflows/) | Kit CI (`kit.yml`), theme release, review and signing, and the lockfile dispatch ([docs/releasing.md](docs/releasing.md)) |
| [`docs/`](docs/) | This kit's reference: the CLI, the architecture, releasing, each theme, Play's history and its official listing |

## Quickstart

The kit runs on Node 22.18 or later and npm 11.6 or later (`package.json` `engines`); Node runs the CLI's TypeScript
directly. From a clone of the kit:

```sh
npm ci                                                   # the kit's dependencies, exactly as package-lock.json has them
npx automatos-theme new acme/harbour --template minimal  # writes themes/harbour, a theme that builds and packs as it is
npx automatos-theme dev themes/harbour                   # in a terminal of its own: the harness on http://127.0.0.1:4319/ until Ctrl-C
(cd themes/harbour && npm run build)                     # the theme's own build: dist/ with the kit's preset
npx automatos-theme check design themes/harbour          # the look data: schema, presets, first-paint table, colour pairs
npx automatos-theme check themes/harbour                 # the server's review checks, in the server's report shape
npx automatos-theme pack themes/harbour --out out        # out/acme.harbour-0.1.0.autotheme and its .sha256.json
npx automatos-theme install out/acme.harbour-0.1.0.autotheme --to http://localhost:8000 --choose
```

`install` sends the package to a local Automatos (`--to` takes the API's address, or the web app's where the web app
serves `/automatos-host.json`), opts you in to it and, with `--choose`, makes it your theme there. No other command
above sends anything anywhere. [docs/cli.md](docs/cli.md) has every command and flag.

A theme folder under `themes/` is a new npm workspace, so committing one changes `package-lock.json`, which is never
edited by hand: the `kit-lockfile.yml` dispatch writes it (`AGENTS.md`, "Adding a dependency").

## Documentation

The kit's reference:

- [docs/cli.md](docs/cli.md): every `automatos-theme` command, its flags, what it refuses and its exit codes.
- [docs/architecture.md](docs/architecture.md): how the packages fit, the source guard, the package layout, what the
  kit takes from core and at which commit, and the harness's mock host.
- [docs/releasing.md](docs/releasing.md): how a theme version is released, reviewed and signed, and how a dependency
  changes.
- [docs/themes/play.md](docs/themes/play.md) and [docs/themes/hud.md](docs/themes/hud.md): the two themes.
- [docs/PLAY-HISTORY.md](docs/PLAY-HISTORY.md): where Play's code came from.
- [docs/OFFICIAL-LISTING.md](docs/OFFICIAL-LISTING.md): the run that lists a theme as official.

The guides, for a theme author ([guides/README.md](guides/README.md) is their index):

- [guides/contract.md](guides/contract.md): the package, `theme.json`, the slots, pages, routes, modules, CSS and the
  `mobile` block.
- [guides/page-inventory.md](guides/page-inventory.md): the core pages a theme may replace.
- [guides/sdk.md](guides/sdk.md): every name of `@automatos/theme-sdk`.
- [guides/looks.md](guides/looks.md): the look schema, presets, the first-paint table and `check design`.
- [guides/mascot-placement.md](guides/mascot-placement.md): where a mascot can go.
- [guides/pitfalls.md](guides/pitfalls.md): what went wrong building Play, and what now catches it.

Play's original pilot plan, superseded by installable themes, is kept at
[`docs/prd/PRD-001-FUN-UI-PILOT.md`](docs/prd/PRD-001-FUN-UI-PILOT.md) for history.

## Install Play

- **A local or open-source edition:** download `automatos.play-<version>.autotheme` from [Play's releases](https://github.com/AutomatosAI/automatos-design-kit/releases) (its `.sha256` is next to it), then Settings › Appearance › Themes › Install theme. A signed version's release also carries `<version>.sig.json`: upload it with the package once your Automatos accepts signed theme uploads; until then the package installs on its own.
- **The hosted edition:** Play installs from the Marketplace (Marketplace › Themes) once it is listed there, with nothing to download. It shows as **Official** when the listed version carries an Automatos signature ([docs/OFFICIAL-LISTING.md](docs/OFFICIAL-LISTING.md)).

How a Play version is released, reviewed, signed and listed: [docs/OFFICIAL-LISTING.md](docs/OFFICIAL-LISTING.md).

## Install HUD

HUD is released the same way: a `hud-v<version>` tag puts `automatos.hud-<version>.autotheme` and its `.sha256` on
the same releases page, and a local or open-source edition installs it with Settings › Appearance › Themes › Install
theme. Its review, signature and listing follow Play's steps, with HUD's tag and names
([docs/OFFICIAL-LISTING.md](docs/OFFICIAL-LISTING.md)).

## Licence

Code: Apache-2.0 (`LICENSE`). The Auto mascot's clips and stills: (c) Automatos AI, not covered by the code licence (`NOTICE`).

The mascot's clips and stills are committed in `themes/play/assets/mascot/` and, the same 36 files, in
`themes/hud/assets/mascot/`, under their own notice (`NOTICE`); the pipeline that made them (`/mascot/`) stays local.
