# The full template

`automatos-theme new <publisher/name> --template full` makes a theme from `themes/play` itself, de-branded, each time
it runs (`packages/theme-cli/src/new/full.ts`), so this template is never a copy of Play that drifts from it. This
folder holds only what the theme gets beside Play's own files:

| Path | What it is |
|---|---|
| `template.json` | What is taken from Play (`copy`), the renames (`keep`, `renames`), the text put into Play's files (`patches`: the `/agents` page registered, and the style sheet's ring colours read through `ring-vars.ts`), the `theme.json` entries added (`pages`, `uses`) and what `--mascot none` changes (`noMascot`) |
| `code/` | Files in Play's own words (its `--pl-*` variables, its component names), added to Play's before the renames and renamed with them: the `/agents` clone (`src/components/agents/`, cloned from core's `components/agents/studio/agent-management-studio.tsx`) and its test on the harness, the tests' setup, and `src/lib/looks/ring-vars.ts`, which hands `@automatos/mascot`'s `ringColour` the look's variables under the package's own names (`RING_VARS`, which keep Play's prefix) |
| `files/` | The new theme's own files: its README, CHANGELOG, the clips' NOTICE and its `.gitignore`, with their placeholders filled and never renamed |
| `no-mascot/` | The code `--mascot none` puts in place of Auto's drawing: his caption alone, and no mascot section in the style sheet |

A rename turns one of Play's names into the theme's: `html.play` into `html.<class>`, `--pl-*` into `--<class>-*` (and
the look catalogue's prefix, `'pl'`, into `'<class>'`, so the variables its look code makes are the theme's too),
`play-` file names, keyframes and font families into `<class>-`, `PlayFrame` into `<Name>Frame`, `PLAY_*` into
`<NAME>_*`, Play in words into the theme's name. Each runs once over every text and path, in one pass, and `new`
refuses a theme whose renames would merge two of Play's names. A Play change that a patch's anchor no longer matches
fails the kit's tests (`tests/template-full.test.ts`), which build, pack and check a theme made from this template.
