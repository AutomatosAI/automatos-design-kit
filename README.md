# Automatos Play

A fun second interface for your local Automatos, with Auto as an animated mascot that reacts to what Auto is doing.

**Status: pilot, not built yet.** This repo currently holds the plan, the build skill and the mascot assets:

- `docs/prd/PRD-001-FUN-UI-PILOT.md`: what Play will do.
- `skills/build-automatos-interface/`: how any interface talks to the Automatos API. Play is built from this skill alone.
- `docs/design/CLAUDE-DESIGN-PROMPT.md`: the brief for the design mocks.

The mascot's clips and stills are committed in `themes/play/assets/mascot/`, under their own notice (`NOTICE`); the pipeline that made them (`/mascot/`) stays local.

Play works with the **local edition** of Automatos (`docker compose up` in `automatos-ai`, no accounts). It changes nothing in Automatos itself: Studio stays your main interface.

## Install Play

- **A local or open-source edition:** download `automatos.play-<version>.autotheme` from [Play's releases](https://github.com/AutomatosAI/automatos-play/releases) (its `.sha256` is next to it), then Settings › Appearance › Themes › Install theme. A signed version's release also carries `<version>.sig.json`: upload it with the package once your Automatos accepts signed theme uploads; until then the package installs on its own.
- **The hosted edition:** Play comes from the Marketplace (Marketplace › Themes), listed as the official theme. There is nothing to download.

How a Play version is released, reviewed, signed and listed: [docs/OFFICIAL-LISTING.md](docs/OFFICIAL-LISTING.md).

Code: Apache-2.0 (`LICENSE`). The Auto mascot's clips and stills: (c) Automatos AI, not covered by the code licence (`NOTICE`).
