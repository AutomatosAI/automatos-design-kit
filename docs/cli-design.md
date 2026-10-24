# `automatos-theme`: the design commands

The design commands. Two start a theme's design before any code: `brief` turns a brand kit into a theme brief, and
`clone` copies a core page's source as a read-only reference to redraw. `skin` writes a phone skin, designed in the
browser harness's phone view, into `theme.json`. The rest of the command line (running it, the commands table, the
environment) is in [cli.md](cli.md).

## `brief`

```text
usage:    automatos-theme brief --brand-kit <file.json> --out <file.md>
example:  npx automatos-theme brief --brand-kit brand-kit.json --out briefs/harbour/BRIEF.md
```

Writes a theme's brief from a brand kit, so a branded theme starts from the brand's real colours and voice
(`src/brief.ts`, `src/brief-kit.ts`, `src/brief-colours.ts`, `src/brief-markdown.ts`). It reads one file and sends
nothing.

| Argument | Meaning |
|---|---|
| `--brand-kit <file.json>` | Required. The brand kit as core's `GET /api/documents/brand-kit` answers it, saved to a file. On a local edition: `curl -sf http://localhost:8000/api/documents/brand-kit -o brand-kit.json` (no token). |
| `--out <file.md>` | Required. The brief to write, usually `briefs/<slug>/BRIEF.md`. Its folder is made when missing. |

The brief has the sections of `skills/brand-a-theme/references/brief-template.md`, in order:

- **Brand**: the name, the tagline and the accent use (`sparing` or `bold`).
- **Grounds**: the kit's `paper`, `surface` and `surface_2` as the page, cards and header fills, and the other ground,
  the colour of the kit's `ink`, `heading`, `primary_color`, `secondary_color` and `text_color` that stands furthest
  from the page. Each with its `#rrggbb`, its Studio triplet, its tone (light when black reads on it better than white)
  and the field it comes from, with `palette_source`'s `set` or `derived`.
- **Accents**: the kit's `accent`, its `accent_2` when it has one, and its `primary_color` when that is neither. Each
  as a fill on every ground (3:1) and as text on each tone's grounds and with a label on it (4.5:1).
- **Proposed pairs**: every text pair, each with both colours and its ratio, rounded down to two decimals. A text
  colour is the kit's own when it reads at 4.5:1 on each of its grounds; otherwise it is `@automatos/look-kit`'s
  `readableOnAll` mix of it toward the grounds' body text (body text itself toward black or white). Only a pair at
  4.5:1 or more is proposed; any other is listed under the table as not proposed, with a warning.
- **Fonts**: the body and heading stacks, and each uploaded font file with the path it takes in a theme
  (`assets/fonts/<name>.woff2`) and its route.
- **Logo variants**: the logo, the logo for dark grounds, the one-colour logo and the square mark, each uploaded (PNG,
  or JPEG to convert), a link or not set, with its path in a theme (`assets/brand/<variant>.png`).
- **Voice**: the tone words and their meanings, the banned phrases and the sign-off.
- **Theme**: a theme name from the brand's name, when one fits `new`'s rule, the tones the grounds give, and what the
  brand kit can't decide, to finish by hand.

The palette is read strictly: `paper`, `surface`, `surface_2`, `ink`, `heading`, `muted` and `accent` must each be a
hex colour (`#abc` is read as `#aabbcc`), and `accent_2` too when present. Every other field is read as core reads a
stored kit: one of the wrong type counts as unset. Every text from the file is printed as one plain line. The kit's
company contact details and social handles are never read.

It refuses, writing nothing and printing every reason:

- a `--brand-kit` that is not a file, not JSON (`BAD_JSON`'s reasons: not UTF-8 JSON text, nested past 32 levels, a
  lone surrogate), not a JSON object, or without a `palette` object;
- a colour role that is missing or not a hex colour, each named;
- an `--out` that is there already: a brief is finished by hand, so it is never written over.

On success it prints the brief's path, then one line saying every proposed pair reads at 4.5:1 or more.

Exit codes: 0 written; 1 refused; 2 usage error.

## `clone`

```text
usage:    automatos-theme clone <route> [<theme folder>]
example:  npx automatos-theme clone /agents themes/harbour
example:  npx automatos-theme clone '/missions/[id]' themes/harbour
```

Fetches the core source of a page a theme may replace, as a reading reference for a theme that redraws the page, and
makes the page a clone in `theme.json` (`src/clone.ts`; the skill is `skills/clone-and-redesign-a-page`).

| Argument | Meaning |
|---|---|
| `<route>` | A page a theme may replace, a key of core's `PAGE_SOURCES`: `/chat`, `/deliverables`, `/assignments`, `/missions/[id]`, `/agents`, `/documents`, `/playbooks`, `/command-center` or `/`. Quote one with brackets. |
| `<theme folder>` | The folder holding the theme's `theme.json`. Default: the folder the command runs in. |

Each of the route's core files ([guides/page-inventory.md](../guides/page-inventory.md)) is fetched from the public
core repo at the commit the kit vendors (`CORE_SHA` in `src/check/report.ts`, the Source line of
`src/core/README.md`), at `https://github.com/AutomatosAI/automatos-ai/raw/<sha>/frontend/<path>`, following GitHub's
redirect to the file and waiting up to 30 seconds for each. The address is not what is trusted: each file's sha256,
CRLF read as LF as core hashes it, must be the one the vendored `core-pages.json` holds for its path. Only when every
file matches is anything written:

- each file, as fetched and read-only, at `reference/core/<path>` in the theme folder, never under `src/` (a copy from
  an earlier clone is replaced). `pack` never packs `reference/`: it packs only the files [`pack`](cli.md#pack) lists;
- `theme.json` `pages["<route>"]` as `{"mode": "clone", "clonedFrom": {"path", "sha"}}`: the route's last core file
  (the component that draws the page) and its sha256, with the page's `keepCorePage` list kept if it had one. With no
  `pages` yet, the field is added after the last one and the rest of the file stays as it was; otherwise the file is
  written again as JSON with two-space indents.

It refuses, writing nothing and printing every reason: a host-owned route or a page under one, any other route that
is not a key of `PAGE_SOURCES` (both before anything is sent), a folder with no `theme.json` object, a file with no
answer or an answer that isn't a success, and a file whose sha256 isn't `core-pages.json`'s. Once the kit vendors a
host release that changed a cloned file, `check` warns at `clonedFrom`; `clone` again fetches it and moves the sha.

Exit codes: 0 written; 1 refused (nothing written); 2 usage error.

## `skin`

```text
usage:    automatos-theme skin <theme folder> --from <skin.json>
example:  npx automatos-theme skin themes/harbour --from skin.json
```

Writes a skin, the theme's `mobile` block ([guides/contract.md](../guides/contract.md)), into its `theme.json` as the
`mobile` field (`src/skin.ts`). `skin.json` holds exactly the block, as the harness's skin designer downloads it
(`/phone` under [`dev`](cli-harness.md#dev); `packages/theme-harness/README.md`, "The phone view"). The old block is
replaced where it stands, or the field is added after the last one, and every other line of `theme.json` stays as it
was; a layout the edit can't follow (the field on one line with another) has the whole file written again as JSON
with two-space indents. It reads the folder and the skin file, writes only `theme.json` and sends nothing.

| Argument | Meaning |
|---|---|
| `<theme folder>` | The folder holding the theme's `theme.json`. Exactly one. |
| `--from <skin.json>` | Required. The block to write, as JSON. |

Nothing is written unless every check passes (`src/skin-check.ts`, which the designer runs too, so the designer and
this command agree on the block itself; the released-theme and publisher refusals below are this command's alone,
since the browser can't see the folder), in two passes, the second only once the first passed:

1. the vendored validator (`src/core/mobile-manifest.ts`) on `theme.json` with the block in place of its own, the
   theme's top-level `mascot` and `engines` read with it: `BAD_MOBILE` or `UNKNOWN_FIELD`, each naming the field. A
   theme whose `engines.automatos` admits a host below 1.1.0 is refused here;
2. each font the block names, and under `clips` or `stills` each state's files (the `.mp4` and the `.png`, or the
   `.png`), must be a regular file in the folder (`MISSING_FILE`; a link is not one, as `pack` refuses links); and
   `check`'s own contrast measure (`src/check/mobile-contrast.ts`) must find no pair under its minimum and no colour
   set without `--background` and `--foreground` (`MOBILE_CONTRAST`, in `check`'s words). For each failing pair of a
   `tokens` block it also prints the nearest passing value of the pair's first token (`src/phone/nearest-passing.ts`:
   its lightness moved the least, hue and saturation kept). No flag writes a failing pair.

It refuses a released theme too: a folder inside the kit's `themes/play` or `themes/hud`, followed through links,
whose packed files change only with a new version and which Automatos Go draws in its own built-in layout, reading
none of the block; and a theme of the reserved `automatos` publisher. So are a folder with no `theme.json` that is a
JSON object and a `--from` that is not a file or not JSON.

A refusal prints `automatos-theme skin: nothing was written to <folder>, because:` and then every reason, one a line.
On success it prints the `theme.json` it wrote and the contrast measure's reason.

Exit codes: 0 written; 1 refused (nothing written); 2 usage error.
