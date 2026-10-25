# The host contract

What the Automatos host promises a theme, and what it refuses. Core owns this contract
(`AutomatosAI/automatos-ai`); the kit's checks are core's own validators, vendored in
`packages/theme-cli/src/core/` at the commit its [README](../packages/theme-cli/src/core/README.md) names. When this
guide and core disagree, core wins and this guide is fixed.

The slot ids, the pages and the host-owned routes below are core's `orchestrator/services/themes/contract.py` lists,
copied as data into [`contract.json`](../packages/theme-cli/src/core/data/contract.json); `tests/guides.test.ts`
holds this page to that file.

## A theme is a package

A theme ships as one `.autotheme` file: a plain zip that `automatos-theme pack` writes from the theme folder. The
server takes only the files below; any other path is `NOT_ALLOWED`.

| Path | What it is | Cap |
|---|---|---|
| `theme.json` | The manifest (below) | 64 KB |
| `dist/entry.js` | The entry module: its default export is `defineTheme({ register })` | 300 KB |
| `dist/chunks/<name>.js` | Chunks the entry imports | JS plus CSS 3 MB |
| `dist/theme.css` | The theme's one stylesheet | JS plus CSS 3 MB |
| `boot/prepaint.json` | The first-paint table ([looks.md](looks.md)) | 256 KB |
| `looks/schema.json`, `looks/presets/<id>.look.json` | The look format and its presets ([looks.md](looks.md)) | 64 KB each |
| `assets/fonts/<name>.woff2` and its licence (`.txt`, `.md`) | Web fonts, one face per file | 400 KB a font |
| `assets/mascot/<name>.{webm,mp4,png}` | The mascot's clips and stills ([mascot-placement.md](mascot-placement.md)) | 1 MB a clip, 512 KB a still |
| `assets/brand/<name>.{png,webp}`, `assets/previews/<name>.png` | The wordmark, the listing's previews | 512 KB each |
| `source/**` | The theme's `src/`, which `pack` copies there for the Marketplace review | 1 MB a file, 8 levels deep |
| `README.md`, `CHANGELOG.md`, `LICENSE` | The theme's own documents | 256 KB each |

The whole package is at most 10 MB. A package that breaks a cap is refused with the cap's code (`ENTRY_TOO_LARGE`,
`CODE_TOO_LARGE`, `CLIP_TOO_LARGE`, `FILE_TOO_LARGE`).

## `theme.json`

Schema `automatos-theme/v1`. Every field is checked; a field the host does not know is `UNKNOWN_FIELD`.

| Field | Required | Rule |
|---|---|---|
| `schema` | yes | `"automatos-theme/v1"` |
| `id` | yes | `publisher/slug`, lower-case letters, digits and dashes. The `automatos` publisher is reserved. |
| `name` | yes | One line of plain text, at most 60 characters |
| `version` | yes | `MAJOR.MINOR.PATCH`. A version once submitted is spent: the same version with other bytes, or a lower one, is refused. |
| `engines` | yes | `{"automatos": "^1.1.0", "sdk": "^1.1.0"}`: the host contract and SDK versions the theme runs on. The host is 1.1.0 and so is the SDK. |
| `base` | yes | `studio` or `classic`: the design the host draws wherever the theme has none of its own |
| `htmlClass` | yes | The theme's class on `<html>`: 3 to 32 lower-case letters, digits or dashes, starting with a letter. The host keeps `studio`, `classic`, `dark`, `light` and `system`; any other class that fits, `play` included, is any theme's. |
| `minWidth` | yes | Pixels, 0 to 3840. Below it the host draws its own pages and chrome. |
| `tone` | yes | `from-look`, `user`, `light` or `dark`: who sets light or dark under the theme |
| `slots` | yes | The slots below that the theme fills |
| `description` | no | Plain text, at most 280 characters |
| `pages` | no | The core pages the theme replaces (below) |
| `routes`, `nav` | no | The theme's own pages and their menu entries (below) |
| `uses` | no | The SDK areas the code imports ([sdk.md](sdk.md)); the review warns when code and list disagree |
| `look` | no | The id of the default preset |
| `fonts`, `previews` | no | Up to 16 `assets/fonts/*.woff2`, up to 16 `assets/previews/*.png`. The listing shows a preview `<preset>.png` or `<preset>-<screen>.png` under that preset, in `theme.json`'s order, and its cover is the first; `automatos-theme previews` writes them from harness shots. |
| `brand` | no | `{"name", "wordmark"}`, the wordmark an `assets/brand/` image |
| `mascot` | no | `{"states": [...]}`: up to 32 state names ([mascot-placement.md](mascot-placement.md)) |
| `pricing` | no | A label of at most 40 characters |
| `mobile` | no | The phone's theme (below) |

## Slots

A slot is a place the host draws and the theme fills: the theme lists it in `slots` and registers a component for
it in `register(host)` with `host.registerSlot(id, Component)`. Each id carries its props' version (`@1`). An id the
host does not serve is `UNKNOWN_SLOT`.

| Slot | Where the host draws it | Props |
|---|---|---|
| `frame@1` | Around every page while the theme is the style and the window is at least `minWidth` wide. The loader needs one registered: without it the theme fails to load. | `children`, `fullBleed`, `autoWidget` |
| `lookEditor@1` | The look editor page, `/looks`. Required in `slots` (`MISSING_SLOT` without it). | none |
| `styleSheet@1` | The style sheet page, `/looks/style`. Required in `slots` (`MISSING_SLOT` without it). | none |
| `notFound@1` | The app's 404 page | none |
| `asleep@1` | Listed by a theme whose frame draws its own "backend is asleep" screen: the host then leaves the health poll to the frame. The host mounts nothing for it on its own. | none |
| `page-header.art@1` | Core's shared page header, before the title | `base`, `title`, `titleAccent`, `eyebrow` |
| `page-header.mascot@1` | Core's shared page header, after the title, before the actions | `base`, `title`, `titleAccent`, `eyebrow` |
| `empty-state.mascot@1` | Core's shared empty state, in place of its icon | `base`, `title`, `description` |

The last three are placement slots: they reach only the pages that draw core's shared header or empty state.
[mascot-placement.md](mascot-placement.md) lists which pages do. A placed component that throws is replaced by the
host's own markup (nothing in the header, the icon in the empty state), and the host is told.

## Pages

A theme may replace these core pages with its own, and only these. Each is a key of `pages` in `theme.json`,
registered with `host.registerPage(route, Component)`.

| Route | The page | Core files a clone copies |
|---|---|---|
| `/chat` | Chat | `app/chat/page.tsx`, `components/chatbot/studio-chat-shell.tsx` |
| `/deliverables` | Deliverables | `app/deliverables/page.tsx`, `components/deliverables/studio/deliverables-studio.tsx` |
| `/assignments` | Missions and Playbooks | `app/assignments/page.tsx` |
| `/missions/[id]` | One Mission | `app/missions/[id]/page.tsx` |
| `/agents` | Agents | `app/agents/page.tsx`, `components/agents/studio/agent-management-studio.tsx` |
| `/documents` | Knowledge | `app/documents/page.tsx`, `components/documents/document-management.tsx` |
| `/playbooks` | Playbooks | `app/playbooks/page.tsx`, `components/playbooks/PlaybooksPanel.tsx` |
| `/command-center` | The Command Center | `app/command-center/page.tsx`, `components/command-center/command-center-shell.tsx` |
| `/` | Home | `app/page.tsx` |

A page entry is `{"mode": "own" | "clone", "keepCorePage": [...], "clonedFrom": {"path", "sha"}}`:

- `own`: the theme's own design of the page, on the data its SDK page area gives ([page-inventory.md](page-inventory.md)).
- `clone`: a copy of the core page, redesigned. `clonedFrom` names the core file it copied (one of the route's files
  above) and that file's sha256 when it was copied. When a later host changes that file, the review warns that the
  clone may miss what the core page has now.
- `keepCorePage`: up to 16 link parameter names (such as `tab`). The host checks the list's shape and nothing more;
  the list doesn't decide which links keep the core page. Each route's layout in core holds a fixed list of its own
  (`app/<route>/layout.tsx`, handed to `components/theme-host/theme-slot.tsx`), whatever the theme's list says: a link
  carrying one of those parameters draws the host's own page instead of the theme's, unless its value is one the
  theme's page still serves. A theme may still name the route's list (Play's `theme.json` names core's), so the
  package says which links leave its page; it changes nothing the host draws.

  | Route | Links that keep the core page | Values the theme's page still serves |
  |---|---|---|
  | `/chat` | `repo`, `runtime`, `mode` | |
  | `/deliverables` | `tab`, `post`, `artifact_type` | `tab=outputs` |
  | `/agents` | `tab`, `agent`, `panel` | `tab=roster` |
  | `/assignments` | `tab`, `id` | `tab=missions` |
  | `/command-center` | `tab`, `openExecution`, `recipeId`, `task_id` | `tab=summary` |
  | `/playbooks` | `id` | |
  | `/missions/[id]`, `/documents`, `/` | none | |

Any other route is `PAGE_OUT_OF_SCOPE`; a host-owned one is `HOST_OWNED_PAGE`.

## Theme routes and the menu

A theme may add up to 16 pages of its own: `routes` lists paths such as `conversations` (up to four segments of
lower-case letters, digits and dashes), registered with `host.registerRoute(path, Component)` and served at
`/x/<path>`. `nav` lists up to 16 entries `{"id", "label", "path"}` for the host's search dialog; a `path` under
`/x/` must be one of the theme's `routes`.

## Host-owned routes

These are always the host's: sign-in, security and roles, admin, the Marketplace, the theme menu and look pages, safe
mode, the root of the theme routes, the API and the public AI-content check. A theme can't replace them, nor any page
below them.

`/sign-in`, `/sign-up`, `/auth`, `/sso-callback`, `/reset-password`, `/accept-invitation`, `/settings`, `/team`,
`/admin`, `/marketplace`, `/looks`, `/safe-mode`, `/x`, `/api`, `/dev`, `/verify`

`/looks` and `/looks/style` stay the host's pages: the host draws the theme's `lookEditor@1` and `styleSheet@1` in them.

## Modules

`react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` and `@automatos/theme-sdk` come from the host's import
map: the theme imports them and never bundles them (the kit's Vite preset keeps them external). Nothing else is
external. A theme imports nothing of core (`@/…`) and nothing of Next.js (`next/*`); everything it reads of the app
comes through the SDK ([sdk.md](sdk.md)). An outside library is copied into the theme's `src/vendor/` as source,
with its licence.

## CSS

`dist/theme.css` is checked rule by rule (`CSS_UNSCOPED` and friends):

- every rule sits under `html.<htmlClass>`, or `:where(…)` or `:is(…)` whose every argument does;
- no `!important`, no `@import`; at-rules only `@media`, `@supports`, `@layer`, `@container`, `@font-face`,
  `@keyframes` (or `@-webkit-keyframes`) and `@charset`;
- every `@keyframes` name and `@font-face` family starts with `<htmlClass>-`;
- no selector names `data-protected-surface` or `data-protected-surface-inner`: the approval cards are the host's.

The kit's Vite preset puts every rule under the theme's class, renames its keyframes and font families, and checks
the result as the server does, so a build that passes it passes this check; [pitfalls.md](pitfalls.md) has what the
check does not cover.

## The `mobile` block

The phone app draws a theme from data alone: it never loads `dist/entry.js` or `dist/theme.css`. A theme says how it
looks on a phone in an optional `mobile` block (host 1.1.0, as core's `services/themes/mobile_manifest.py` checks
it):

```jsonc
"mobile": {
  "tokens": { "light": { "--background": "0 0% 100%", "--foreground": "#14181c" }, "dark": { "…": "…" } },
  // or, instead of "tokens":
  "fromLooks": true,
  "fonts": { "sans": "assets/fonts/mobile/inter-regular.ttf", "serif": "…", "mono": "…" },
  "mascot": "clips"
}
```

| Field | Rule |
|---|---|
| `tokens` or `fromLooks` | Exactly one. `fromLooks` is only ever `true`. |
| `tokens.light`, `tokens.dark` | `light` is required, `dark` optional. Each names only Studio's colour tokens below and includes `--background` and `--foreground`. A value is `H S% L%` (such as `0 0% 100%`) or `#rrggbb`. |
| `fromLooks` | The member's active look is painted through `boot/prepaint.json`, which the package must have; the table's `defaults` must paint `--background` and `--foreground` as `H S% L%` triplets, or the package is refused (`MOBILE_CANNOT_PAINT`). |
| `fonts` | Any of `sans`, `serif` and `mono`, each a different `assets/fonts/mobile/<name>.ttf` or `.otf` in the package: one face, at most 400 KB. |
| `mascot` | `clips`, `stills` or `none` (absent means `none`). `clips` needs `assets/mascot/<state>.mp4` and `.png` for every state of the top-level `mascot.states`; `stills` needs the `.png`. |
| `engines.automatos` | Must not admit a host below 1.1.0. |

Studio's colour tokens a scheme may name: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`,
`--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`,
`--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`,
`--input`, `--ring`, `--background-gradient-from`, `--background-gradient-to`, `--glass-border-hover`, `--cc-hover`,
`--cc-hover-border`.

A refusal is `BAD_MOBILE` naming the field, or `UNKNOWN_FIELD` for a key outside the block. The review measures the
block's contrast: 4.5:1 for each text token on its fill, 3:1 for `--primary` and `--ring` on `--background`, per
scheme (or per preset under `fromLooks`); a pair under its minimum blocks the listing. The phone reads the result
from `GET /api/themes/mobile/<install id>`: the colours, the font and mascot file URLs, never a JS or CSS URL.

The kit's vendored reader takes the block as core does (`packages/theme-cli/src/core/mobile-manifest.ts`, at the
commit its README names): `automatos-theme pack` refuses what core refuses, the fonts and clips the block names
included, and `automatos-theme check` measures its colour pairs as the review does, so a pair under its minimum is
an error there before you submit.
