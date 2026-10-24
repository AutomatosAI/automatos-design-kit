# {{name}}

{{name}} (`{{id}}`) is an installable Automatos theme: a frame of its own around every page, with the host's own
pages inside it, and looks a person picks and changes. It was made from the design kit's minimal template
(`automatos-theme new {{id}} --template minimal`).

## What it registers

`src/entry.ts` registers what `theme.json` declares:

- `frame@1`: a sidebar with the host's menu and the theme's two screens, and a header row with the host's search and
  its utilities. Every page the theme doesn't draw is the host's own, inside the frame, recoloured by the look.
- `lookEditor@1` (the host's `/looks`): pick a look, change its knobs, save it as a new look, delete, export or
  import one.
- `styleSheet@1` (`/looks/style`): the active look's colours as the page paints them, the type scale and the
  components.
- `notFound@1`: the 404, with one way back to the chat.

## Looks

The look data is written by hand and kept with the code:

- `looks/schema.json`: three choice knobs, `ground` (paper, ink), `accent` (blue, green, amber) and `corners`
  (square, soft, round).
- `looks/presets/`: Day (the default, `theme.json`'s `look`) and Night.
- `boot/prepaint.json`: what each choice paints before any code runs, the theme's own variables
  (`--{{htmlClass}}-*`) and Studio's tokens, so the host's pages take the look's colours too; the accent's text colour on
  each ground; and the tone each ground sets.
- `design/contrast.json`: the colour pairs `automatos-theme check design` measures on every preset (never packed).

The look editor keeps its own copy of the knobs and presets (`src/looks/spec.ts`), and `test/look-data.test.ts` holds
it to the files: change both together.

## Build, check and pack

- `npm run build`: `vite build` with the kit's preset, every rule under `html.{{htmlClass}}`.
- `npm run lint`, `npm run typecheck`, `npm test`: the review's JS rules, TypeScript, and the tests on the kit's
  harness.
- `npm run pack`: `automatos-theme check design`, then `automatos-theme pack` into `out/`.

A new theme folder under `themes/` is a new workspace: it changes `package-lock.json`, which the kit's
`kit-lockfile.yml` dispatch writes (the kit's `AGENTS.md`, "Adding a dependency").
