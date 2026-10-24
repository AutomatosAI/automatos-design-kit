# Automatos Play

A fun second interface for Automatos, with Auto as an animated mascot that reacts to what Auto is doing. This
repo is the design kit: it builds Play, and any other theme, as an installable package (`.autotheme`) for
Automatos (PRD-261). `AGENTS.md` has the kit's contract and layout in full.

The mascot's clips and stills are committed in `themes/play/assets/mascot/`, under their own notice (`NOTICE`);
the pipeline that made them (`/mascot/`) stays local.

Play installs and runs the same way on the local edition and the hosted edition of Automatos. It changes
nothing in Automatos itself: Studio stays your main interface.

Play's original pilot plan, superseded by PRD-261, is kept at
[`docs/prd/PRD-001-FUN-UI-PILOT.md`](docs/prd/PRD-001-FUN-UI-PILOT.md) for history.

## Install Play

- **A local or open-source edition:** download `automatos.play-<version>.autotheme` from [Play's releases](https://github.com/AutomatosAI/automatos-design-kit/releases) (its `.sha256` is next to it), then Settings › Appearance › Themes › Install theme. A signed version's release also carries `<version>.sig.json`: upload it with the package once your Automatos accepts signed theme uploads; until then the package installs on its own.
- **The hosted edition:** Play comes from the Marketplace (Marketplace › Themes), listed as the official theme. There is nothing to download.

How a Play version is released, reviewed, signed and listed: [docs/OFFICIAL-LISTING.md](docs/OFFICIAL-LISTING.md).

Code: Apache-2.0 (`LICENSE`). The Auto mascot's clips and stills: (c) Automatos AI, not covered by the code licence (`NOTICE`).
