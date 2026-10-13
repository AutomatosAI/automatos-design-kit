# Automatos Play

A fun second interface for your local Automatos, with Auto as an animated mascot that reacts to what Auto is doing.

**Status: pilot, not built yet.** This repo currently holds the plan, the build skill and the mascot assets:

- `docs/prd/PRD-001-FUN-UI-PILOT.md`: what Play will do.
- `skills/build-automatos-interface/`: how any interface talks to the Automatos API. Play is built from this skill alone.
- `docs/design/CLAUDE-DESIGN-PROMPT.md`: the brief for the design mocks.

The mascot animations (`public/auto/`) and the pipeline that made them (`mascot/`) stay local until the usage rights of the generated images are confirmed (PRD-001, open question 1).

Play works with the **local edition** of Automatos (`docker compose up` in `automatos-ai`, no accounts). It changes nothing in Automatos itself: Studio stays your main interface.

Code: Apache-2.0 (to be added with the scaffold). The Auto mascot: see the open questions in PRD-001.
