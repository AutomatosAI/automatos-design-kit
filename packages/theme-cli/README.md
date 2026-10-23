# @automatos/theme-cli

`automatos-theme pack <theme folder> [--out <folder>]` turns a built theme into the package the Automatos server
installs.

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
zip reader (`src/members.ts`, `src/check-package.ts`) and CSS scope check (`@automatos/vite-preset/css-scope`).
Core's shared test corpus holds all of them to the server's verdicts (`test/core-corpus.test.ts`).

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

The review (`scripts/review/rebuild.ts`) writes the package back out with `source/` as `src/` and builds it with the
kit's preset alone: `automatosTheme({ entry })`, from the theme folder, with no config file. It sees no `tsconfig.json`,
`package.json` or `vite.config.*`, because none of them is in the package. So a theme's build must not depend on its
own config: no path aliases, no extra Vite or PostCSS plugins, no preset options but the entry, and nothing bundled
from outside `src/` (the preset's source guard refuses that in the author's build too).

Node 22.18 or later runs the TypeScript sources directly (type stripping): `npm run pack` packs core's hello
test theme into `out/`.

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
