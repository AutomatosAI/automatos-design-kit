// PRD-261 B-01f: the full template's /agents clone (templates/full/code), run here on the harness with this
// package's fixture agents (fixtures/agents) through the fake SDK's pages/agents area. The template is no workspace
// of its own, so kit CI runs its test through this file, as a theme made from it runs it; this package's typecheck
// reads the clone's code through it. The clone is in Play's own words here: `new` renames it with Play's files.
import '../../../templates/full/code/test/agents-page.test.tsx'
