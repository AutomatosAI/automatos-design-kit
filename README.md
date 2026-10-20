# Automatos Play

A fun second interface for your local Automatos, with Auto as an animated mascot that reacts to what Auto is doing.

**Status: pilot, not built yet.** This repo currently holds the plan, the build skill and the mascot assets:

- `docs/prd/PRD-001-FUN-UI-PILOT.md`: what Play will do.
- `skills/build-automatos-interface/`: how any interface talks to the Automatos API. Play is built from this skill alone.
- `docs/design/CLAUDE-DESIGN-PROMPT.md`: the brief for the design mocks.

The mascot's clips and stills are committed in `themes/play/assets/mascot/`, under their own notice (`NOTICE`); the pipeline that made them (`/mascot/`) stays local.

Play works with the **local edition** of Automatos (`docker compose up` in `automatos-ai`, no accounts). It changes nothing in Automatos itself: Studio stays your main interface.

Code: Apache-2.0 (`LICENSE`). The Auto mascot's clips and stills: (c) Automatos AI, not covered by the code licence (`NOTICE`).
