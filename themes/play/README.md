# Play

Play is the Automatos theme with Auto, the mascot: its own frame and sidebar, a chat with Auto, a shelf of
Deliverables, a Conversations page, and looks you pick and tweak (Make it yours, and the style sheet). This folder
builds it as an installable theme package, `automatos/play` (PRD-261). `CHANGELOG.md` lists what each version changed.

## Where the code comes from

Copied from core (`AutomatosAI/automatos-ai`); the kit's `docs/PLAY-HISTORY.md` names the commit and every line changed.

## What Play registers

`src/entry.ts` registers `frame@1`, `lookEditor@1`, `styleSheet@1` and `notFound@1`, the `/chat` and
`/deliverables` pages and the route `conversations` (`/x/conversations`). `theme.json` declares the same, plus
`asleep@1`, which Play's frame draws itself. The pages keep the core page for the link parameters core keeps it for
(`keepCorePage`); the host's own layouts still say which `?tab=` values the theme's Deliverables page serves. Make it
yours and the style sheet mark their heading with `data-theme-heading` (and `tabindex="-1"`), the mark the host hands
the focus to once the screen shows.

## Source

`src/` keeps the layout of core's `frontend/` (`components/`, `lib/`, `hooks/`, `stores/` and `app/`), and the
package carries it as `source/`, the folder the Marketplace review rebuilds `dist/` from. From 1.1.1 two parts of
Play's code are kit packages it bundles, in place of its own copies under `src/`:

- `@automatos/look-kit` (the kit's `packages/look-kit`, from `lib/look-kit`): the look's CSS variables, contrast and
  colour, Studio's tokens and the look validator, with the AA proofs;
- `@automatos/mascot` (the kit's `packages/mascot`, from `lib/mascot` and `components/mascot`): Auto's state machine,
  his player, the media chooser and the Pause Auto control.

The package carries their source too, under `source/packages/<name>/src/`, so the review rebuilds them with the
rest. Beyond those, the build takes no outside module: the two icons and the store library Play's code uses are
copied into `src/vendor/` as source, at the versions core pins, with their licences (`src/vendor/README.md`).

## Styles and assets

The entry imports `app/play-fonts.css` and `app/play-theme.css`, then the components import their 25 CSS modules;
the preset puts all 27 into `dist/theme.css`, every rule under `html.play` (D2-c), keyframes renamed `play-…`.
`test/css.test.ts` runs the preset's wrap and the server's scope check over each file and over the whole sheet.

- **The cascade (FX-01).** The wrap leaves a rule that is already under `html.play` as it is, so every rule of
  `play-theme.css` and every FX-01 rule of the modules (`:global(html.play) …`, the headings, keys and code that must
  outrank Studio's `.studio h1`) keeps core's specificity. Every other module rule gains exactly (0,1,1).
- **The motion stop** has no `!important` (core's had six: three declarations in each of two rules). It stops
  animations and transitions under the OS setting, and when the host marks `<html>` with
  `data-theme-motion="reduce"`, the host's generic marker and the only one Play reads. Each rule's selector carries
  `:not(#play-none)`, an id no element has, which adds (1,0,0): it outranks every selector without an id, and no
  Play selector has one, nor sets a motion inline. Play's motion factor for `calc()`, `--pl-motion-scale`, is the
  host's `--theme-motion` (0 under reduced motion), or 1 when the host sets none.
- **The forced-colours rings** (`[aria-pressed="true"]` and its `:focus-visible`) name the wrap twice
  (`html.play:is(html.play)`), so they gain the same (0,1,1) as the modules: against every module rule that sets an
  outline, the comparison comes out as in core.
- **Fonts.** core's `app/play-fonts.ts` (next/font/local) becomes `app/play-fonts.css`: one `@font-face` per file, the
  families `play-instrument-serif`, `play-bricolage-grotesque` and `play-fredoka`, and the variables core's catalogue
  reads (`--pl-font-instrument-serif`, `--pl-font-bricolage`, `--pl-font-fredoka`). The `url()`s are relative to
  `dist/theme.css` as the host serves it (`../assets/fonts/…`); the build leaves them as written, since `src/` has no
  `assets/` folder. The four display faces and their OFL licences are in `assets/fonts/`. Geist stays the host's
  (`--font-geist-sans`, `--font-geist-mono`).
- **The mascot.** Auto's 36 clips and stills are committed in `assets/mascot/`; they are (c) Automatos AI and not
  covered by the code licence (the kit's `NOTICE`). The media chooser asks
  `assetUrl('assets/mascot/<state>.<png|webm|mp4>')` for each file. Every clip is under the 1 MB cap (the largest,
  `celebrate.mp4`, is 277,691 bytes). `test/fixtures/mascot-files.json` lists each file's sha256 and size, and
  `test/assets.test.ts` holds every file to it, its byte signature and its name; the build reads no list and makes no
  request.
- **The wordmark** is text ("Automatos Play", `components/play/edges/wordmark.tsx` and the sidebar), so there is no
  `assets/brand/`.
- **The previews.** `assets/previews/` holds the seven images the Marketplace listing shows, screenshots of Play at
  1440×900 on demo data: one per preset (`ember.png`, `obsidian.png`, `aurora.png`, `workshop.png`, `daylight.png`)
  and two more of Ember (`ember-deliverables.png`, `ember-looks.png`). `theme.json`'s `previews` lists them, and the
  listing shows each under its preset by name: `<preset>.png`, or `<preset>-<screen>.png` for another screen in that
  look (the longest matching preset id wins). Each is a PNG under the 512 KB image cap; `test/previews.test.ts` holds
  the list to the folder, each name to a preset and the bytes to the cap.

## Looks and the first paint

`scripts/compile-looks.mjs` (at the kit's root) writes Play's look data from `src/lib/looks/catalogue.ts` and
`presets.ts`, and Play's build runs it first. The three kinds of file it writes are generated, never edited, and
kept out of git (`.gitignore`):

- `looks/schema.json`: the look format (`automatos-interface-look/v1`, interface `play`) and its six knobs, each
  catalogue section's keys as a choice and the glow as a whole number from 0 to 40, with Ember's values as the
  defaults. It is byte for byte the schema core held for builtin Play
  (`orchestrator/services/themes/data/play-look-schema.json`, kept in the kit's `tests/fixtures/core/`).
- `looks/presets/<id>.look.json`: the five presets, Ember (the default, `theme.json`'s `look`), Obsidian, Aurora,
  Workshop and Daylight.
- `boot/prepaint.json`: the table core's boot script paints a stored look from before first paint: every
  catalogue entry's `--pl-*` variables and Studio tokens, the accent-on-ground pairs, and the glow as a
  numeric-knob rule, capped at each ground and accent's safe glow. The builder, `scripts/looks/play-prepaint.ts` in
  the kit, is builtin Play's (core's `frontend/lib/theme-host/builtin/play-prepaint.ts`) with only its imports
  changed, and the table's types are core's (`scripts/looks/boot-types.ts`). Beside it the file carries the tone rule
  (`tone`: the knob `ground` and each ground's tone, from `lib/looks/tone.ts`'s `toneOfGround`; PRD-261 K-19c), from
  which the host's look runtime sets an installed look's tone.

`tests/compile-looks.test.ts` holds the files to core's look and CSS-value checks and paints every preset from the
table as the boot script does, against Play's engine.

## Build

- `npm run build`: `node ../../scripts/compile-looks.mjs .` (above), then `vite build` with `@automatos/vite-preset`, every rule under `html.play` (decision D2-c, so
  Play's cascade over Studio's rules stays as it is in core). React and the SDK come from the host's import map.
- `npm run typecheck`, `npm test`: the TypeScript check and the static tests in `test/` (imports, `theme.json`
  against core's validator, the entry's registrations, the stylesheets' scope and cascade, the assets and their URLs),
  and `test/storage-port.test.ts`: no browser storage under `src/`, and Auto's pause, his hello and the seen
  Deliverables on the SDK's storage area, run on the theme harness's storage area (`@automatos/theme-harness`, core's
  ported), which the test holds to core's rules.
- `npm run pack`: `automatos-theme pack` into `out/`: `automatos.play-1.1.1.autotheme` and its `.sha256.json`, checked
  as core's reader checks a package (the caps: the entry 300 KB, JS and CSS 3 MB, each clip 1 MB; the scope check on
  `dist/theme.css`). Kit CI uploads both as the `kit-themes` artifact.
