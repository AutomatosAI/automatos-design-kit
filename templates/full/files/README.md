# {{name}}

{{name}} (`{{id}}`) is an installable Automatos theme made from the design kit's Play {{playVersion}}, de-branded
(`automatos-theme new {{id}} --template full`): Play's frame and sidebar, its chat with Auto, its shelf of
Deliverables, its Conversations page, its look editor and style sheet, and its 404, under this theme's names, with
the core Agents page cloned (`/agents`). {{mascot}}

## What it registers

`src/entry.ts` registers what `theme.json` declares: `frame@1`, `lookEditor@1`, `styleSheet@1` and `notFound@1`;
the `/chat`, `/deliverables` and `/agents` pages; and the route `conversations` (`/x/conversations`). The frame draws
the asleep screen itself, so `theme.json` lists `asleep@1` too.

`/agents` is a clone of a core page (`"mode": "clone"`, `src/components/agents/`): `clonedFrom` names the core file it
was copied from and that file's sha256. When a later host changes that file, `automatos-theme check` warns at
`clonedFrom` that the clone may miss what the core page has now: read the core page again, bring the clone up to it,
and set the new sha. The core page's other tabs and an agent's details stay the host's (`keepCorePage`).

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
`kit-lockfile.yml` dispatch writes (the kit's `AGENTS.md`, "Adding a dependency"). The listing's previews and phone
screenshots are not copied from Play: shoot the theme's own (`automatos-theme shots`, then `automatos-theme previews
--from`), take its phone screenshots in Automatos Go (`automatos-theme previews --phone`), and list them in
`theme.json`.
