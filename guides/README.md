# Guides

What a theme author needs to know about the Automatos host, without reading core. Each guide is held to the code by
`tests/guides.test.ts`: the slot ids, routes and pages to core's lists as the kit vendors them, the SDK names to the
SDK's surface, the knob kinds to core's look validator.

Core (`AutomatosAI/automatos-ai`) owns the contract. The kit's copy of its validators and data is in
`packages/theme-cli/src/core/`, at the commit [its README](../packages/theme-cli/src/core/README.md) names. When a
guide and core disagree, core wins and the guide is fixed.

| Guide | What it covers |
|---|---|
| [contract.md](contract.md) | The package and its files, `theme.json` field by field, the slots, the pages a theme may replace, its own routes, the host-owned routes, the modules, the CSS rules and the `mobile` block |
| [page-inventory.md](page-inventory.md) | The nine core pages a theme may replace: what each reads through the SDK, the core files a clone copies, and which placement slots reach it |
| [mascot-placement.md](mascot-placement.md) | Where a mascot can go (the theme's own surfaces, the three placement slots), which pages each slot reaches, and where Play puts Auto |
| [looks.md](looks.md) | The look schema and its two knob kinds, presets, the first-paint table, the tone rule, recolouring the host's pages, and `check design` |
| [sdk.md](sdk.md) | Every name of `@automatos/theme-sdk`, by area, storage included |
| [pitfalls.md](pitfalls.md) | What went wrong building Play, and the rule or check that now catches each one |

## How they fit with the rest of the kit

- The skills in `skills/` are the work order an agent follows; they point here for the facts.
- `automatos-theme`, the kit's command line (`packages/theme-cli`), checks a theme as the server would:
  `automatos-theme check design` for the look data, `automatos-theme check` for the whole package, and
  `automatos-theme pack` to write the `.autotheme` file. Its [README](../packages/theme-cli/README.md) documents
  `pack`, `submit`, `install` and `shots`; `check` and `check design` are described at the top of
  `packages/theme-cli/src/check/index.ts` and `design.ts`.
- `themes/play` is a complete theme built on this contract: when a guide is not enough, read how Play does it.
