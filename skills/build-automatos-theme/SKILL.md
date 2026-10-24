---
name: build-automatos-theme
description: Build an installable Automatos theme (an .autotheme package) in the Automatos design kit - theme.json, an entry that registers the frame, the look editor and the style sheet through @automatos/theme-sdk, scoped CSS, looks, tests on the kit's harness - then check it, pack it and try it on a local install. Use when asked to make, extend or fix an Automatos theme, one of its pages, slots or screens, or its mascot. SDK only - no proxy, no backend calls, no browser storage of its own.
---

# Build an Automatos theme

A theme is a package the Automatos host loads into its own page: the host owns the data, the sign-in, the routes and
the safety rails, and the theme draws. Everything the theme reads or does goes through one module the host serves,
`@automatos/theme-sdk`. This skill supersedes `build-automatos-interface`, which built a separate app against the backend.
A theme has no server, no proxy and no backend calls of its own.

## When to use

- Making a new theme in this kit (`themes/<slug>/`), or changing one (Play is `themes/play`).
- Adding a page, a slot, a route, a look or a mascot to a theme.
- Fixing a theme that `automatos-theme check` or the Marketplace review refuses.

Not for changes to Automatos itself (the core repo, `AutomatosAI/automatos-ai`): core has its own rules. Not for the
look data alone: that is [write-a-look-schema-and-presets](../write-a-look-schema-and-presets/SKILL.md). Not for the
submission: that is [pass-marketplace-review](../pass-marketplace-review/SKILL.md).

## Read first

The guides are the facts; this skill is the order of work.

1. [guides/contract.md](../../guides/contract.md): the package, `theme.json`, the slots, the pages, the routes, CSS.
2. [guides/sdk.md](../../guides/sdk.md): every SDK name, by area.
3. [guides/pitfalls.md](../../guides/pitfalls.md): what went wrong building Play. Read it before the first line of CSS.
4. As your theme needs them: [page-inventory.md](../../guides/page-inventory.md), [looks.md](../../guides/looks.md),
   [mascot-placement.md](../../guides/mascot-placement.md).
5. [references/theme-folder.md](references/theme-folder.md): the folder, its files and the entry, to copy.

`themes/play` is a complete theme on the same contract. When a guide doesn't answer, read how Play does it, then the
core source if you have it. Core wins over this kit: if the two disagree, say so; don't work around it.

## The order of work

Work one surface at a time, and finish each before the next.

1. **Brief.** Write down, before any code: the theme's id (`publisher/slug`), its `htmlClass`, its `base` (`studio`
   or `classic`), its `tone`, its `minWidth`, which core pages it replaces (`own` or `clone`), its own routes, the
   placement slots it fills, and whether it has a mascot. Done when every field of `theme.json` has a value.
2. **Design data.** The look schema, the presets, the first-paint table and the colour pairs, with
   [write-a-look-schema-and-presets](../write-a-look-schema-and-presets/SKILL.md). Done when
   `automatos-theme check design themes/<slug>` passes with no error.
3. **The folder.** Copy the layout in [references/theme-folder.md](references/theme-folder.md): `package.json`,
   `theme.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `src/entry.ts`. Done when
   the entry registers a frame, a look editor and a style sheet, even as placeholders.
4. **The frame** (`frame@1`). It draws around every page, so it renders `children` and the host's `HeaderUtilities`,
   and navigates with `HostLink` and `useHostRouter`. If it draws its own asleep screen, list `asleep@1` and read
   `useHealth({ poll: true })`. Done when its test shows the page, the header utilities and the menu.
5. **The look editor and the style sheet** (`lookEditor@1`, `styleSheet@1`), on `useLook()`. Done when a look can be
   picked, changed, saved, exported and imported in a test on the harness.
6. **Pages and routes.** Each replaced page reads its SDK page area ([page-inventory.md](../../guides/page-inventory.md));
   each own route is `host.registerRoute(path, Component)` and listed in `routes`. Place the host's cards (approvals,
   tasks, Missions) from `cards`; never draw your own versions. Done when each page has a test over the harness's
   fixtures.
7. **The edges.** `notFound@1`, and the asleep screen if the frame draws one. Done when both have tests.
8. **The mascot** (if any): files in `assets/mascot/`, `mascot.states` in `theme.json`, URLs from `assetUrl`, a pause
   control, the still under reduced motion ([mascot-placement.md](../../guides/mascot-placement.md)).
9. **Copy.** The words below, buttons that say what they do, every text from the theme's own strings.

## Check, pack and try

Kit CI is the test: its `kit` job runs `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` and
`npm run pack` over every workspace, the theme's folder included, and a theme's `lint` runs the review's rules. Where
your setup lets you run commands, the same checks are:

- `automatos-theme check design themes/<slug>`: the look data, before any code.
- `automatos-theme check themes/<slug>`, after a build: the server's review checks, in the server's words, with the
  verdict. Add `--rebuild` to rebuild `source/` with the kit's preset and compare it with `dist/` byte for byte, as the
  Marketplace review does.
- `automatos-theme pack themes/<slug> --out out`: writes `<publisher>.<slug>-<version>.autotheme` and its
  `.sha256.json`, or prints every reason the server would refuse it.
- `automatos-theme shots themes/<slug>`: each slot, page and route on Chromium and WebKit in the kit's browser
  harness, for every preset, with an axe scan.
- `automatos-theme previews themes/<slug> --from shots --pick <preset>=<shot>`: the shots you pick become the
  listing's previews (`<preset>.png`, `<preset>-<screen>.png`), in that order, the first the cover; commit them.
- `automatos-theme install <file.autotheme> --to http://localhost:3000 --choose`: installs it privately on a local
  edition (`--to` takes the web app's address or the API's) and makes it your theme, so you can try it in the real
  app.

When it is ready for others, follow [pass-marketplace-review](../pass-marketplace-review/SKILL.md).

## Rules

- **SDK only.** Data through the page areas, navigation through `useHostRouter` and `HostLink`, notices through
  `notify`, small state through the `storage` area, files through `assetUrl`. No network calls, no cookies, no
  browser storage, no `@/` imports, no `next/*`, no `eval`: the review refuses each one, and the theme's `lint`
  fails on it first.
- **Bundle only your own `src/`**, and the kit libraries you name. React and the SDK come from the host. A library
  you need is copied into `src/vendor/` as source with its licence; the preset refuses `node_modules`. The kit's
  `@automatos/look-kit` and `@automatos/mascot` are bundled from their `src/` when the theme's `package.json` names
  them under `dependencies`, at their version (`guides/pitfalls.md`).
- **A new theme folder is a new workspace.** It changes `package-lock.json`, which is never edited by hand: the
  `kit-lockfile.yml` dispatch writes it (`AGENTS.md`, "Adding a dependency"). Pin every dependency exactly, and add
  none without the maintainer's OK.
- **CSS under your class**, every variable under your own prefix, every colour from the look, no `!important`
  ([pitfalls.md](../../guides/pitfalls.md)).
- **Protected surfaces stay the host's**: the approval cards and the AI label. Place them; never restyle, cover or
  hide them. A composer goes inside `cards.AiLabelFence`.
- **Untrusted text is text.** Chat replies, Deliverables and imported looks are untrusted: Markdown through
  `cards.MarkdownView`, everything else as text, never as HTML.
- **Accessible from the first commit**: AA contrast on every preset, visible focus, a pause for every loop, the still
  under reduced motion, roles and names a screen reader can follow.
- **Functions under 50 lines, files under 400**, TypeScript strict, no `any`, immutable updates.

## Words

Use the product's words in every string: **Auto** (a name, never "the assistant"), **Mission**, **Deliverable** (not
"output" or "file"), **Playbook**, **Agent**.

## Verify

- Every story ends with its tests on the harness: roles and text, not markup.
- Read the CI run's result before saying anything passed. Never report a check as passed without having seen it pass.
