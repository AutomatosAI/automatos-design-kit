# Guides

What a theme author needs to know about the Automatos host, without reading core. Each guide is held to the code by
`tests/guides.test.ts`: the slot ids, routes and pages to core's lists as the kit vendors them, the SDK names to the
SDK's surface, the knob kinds to core's look validator, and the phone skin's contrast pairs to the vendored `mobile`
validator.

Core (`AutomatosAI/automatos-ai`) owns the contract. The kit's copy of its validators and data is in
`packages/theme-cli/src/core/`, at the commit [its README](../packages/theme-cli/src/core/README.md) names. When a
guide and core disagree, core wins and the guide is fixed.

| Guide | What it covers |
|---|---|
| [contract.md](contract.md) | The package and its files, `theme.json` field by field, the slots, the pages a theme may replace, its own routes, the host-owned routes, the modules, the CSS rules and the `mobile` block |
| [page-inventory.md](page-inventory.md) | The nine core pages a theme may replace: what each reads through the SDK, the core files a clone copies, and which placement slots reach it |
| [mascot-placement.md](mascot-placement.md) | Where a mascot can go (the theme's own surfaces, the three placement slots), which pages each slot reaches, and where Play puts Auto |
| [mobile-skins.md](mobile-skins.md) | The phone skin, `theme.json`'s `mobile` block: what it is and isn't, the app's four layouts and which theme gets each, its fields as the validator takes them, what Automatos Go draws from it, its ten contrast pairs, and the work from the skin designer through `skin`, `check` and `pack` |
| [looks.md](looks.md) | The look schema and its two knob kinds, presets, the first-paint table, the tone rule, recolouring the host's pages, and `check design` |
| [sdk.md](sdk.md) | Every name of `@automatos/theme-sdk`, by area, storage included |
| [pitfalls.md](pitfalls.md) | What went wrong building Play, and the rule or check that now catches each one |
| [designing-a-theme.md](designing-a-theme.md) | For the designer: what a theme can change, the host's parts it only places, the data it can show, looks and knobs, motion, the phone, the handoff `check handoff` reads, and a prompt to start a design session |
| [from-design-to-theme.md](from-design-to-theme.md) | From a design to an installed theme: design, check the handoff, one prompt to build, see it, check and pack, install, list; and the kit's own proof |

## How they fit with the rest of the kit

- The skills in [`skills/`](../skills/README.md) are the work order an agent follows; they point here for the facts.
- `automatos-theme`, the kit's command line (`packages/theme-cli`), starts a theme and checks it as the server would:
  `automatos-theme new` to start one from a template (`templates/minimal`, or `templates/full`: Play de-branded),
  `automatos-theme check design` for the look data, `automatos-theme check` for the whole package, and
  `automatos-theme pack` to write the `.autotheme` file. [docs/cli.md](../docs/cli.md) (with [docs/cli-design.md](../docs/cli-design.md) for `brief`, `clone` and `skin`, and [docs/cli-harness.md](../docs/cli-harness.md) for `dev`, `shots` and `previews`) documents every command, its
  flags, what it refuses and its exit codes; its [README](../packages/theme-cli/README.md) has more on `pack`,
  `source/` and each command's internals.
- The kit's own reference sits in [`docs/`](../docs/): [architecture.md](../docs/architecture.md) (how the packages,
  the source guard, the package layout and the harness fit, and what the kit takes from core),
  [releasing.md](../docs/releasing.md) (how a theme version is released, reviewed and signed), and a page each for
  [Play](../docs/themes/play.md) and [HUD](../docs/themes/hud.md).
- `themes/play` is a complete theme built on this contract: when a guide is not enough, read how Play does it.
  `themes/hud` is a second one, HUD: its frame around the host's own pages, with its look data committed rather
  than generated (its catalogue in `src/lib/looks/`, its `design/contrast.json` and its tests).
