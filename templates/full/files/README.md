# {{name}}

{{name}} (`{{id}}`) is an installable Automatos theme made from the design kit's Play {{playVersion}}, de-branded
(`automatos-theme new {{id}} --template full`): Play's frame and sidebar, its chat with Auto, its shelf of
Deliverables, its Conversations page, its look editor and style sheet, and its 404, under this theme's names.
{{mascot}}

## What it registers

`src/entry.ts` registers what `theme.json` declares: `frame@1`, `lookEditor@1`, `styleSheet@1` and `notFound@1`;
the `/chat` and `/deliverables` pages; and the route `conversations` (`/x/conversations`). The frame draws
the asleep screen itself, so `theme.json` lists `asleep@1` too.

## Looks

`looks/schema.json`, `looks/presets/` and `boot/prepaint.json` were written from Play's look catalogue when the theme
was made (`src/lib/looks/catalogue.ts` and `presets.ts` hold the same values): they are the theme's own data now.
Change a colour in both places, and `automatos-theme check design` measures every pair `design/contrast.json` declares
on every preset.

## Build, check and pack

- `npm run build`: `vite build` with the kit's preset, every rule under `html.{{htmlClass}}`.
- `npm run lint`, `npm run typecheck`, `npm test`: the review's JS rules, TypeScript, and the tests on the kit's
  harness.
- `npm run pack`: `automatos-theme check design`, then `automatos-theme pack` into `out/`.

A new theme folder under `themes/` is a new workspace: it changes `package-lock.json`, which the kit's
`kit-lockfile.yml` dispatch writes (the kit's `AGENTS.md`, "Adding a dependency"). The listing's previews are not
copied from Play: shoot the theme's own (`automatos-theme shots`) and list them in `theme.json`.
