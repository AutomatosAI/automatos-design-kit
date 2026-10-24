// PRD-261 B-01e: the minimal template's own tests (templates/minimal/test), run here on the harness. A template is
// no workspace of its own, so kit CI runs its tests through this file, with this package's preset (jsdom, the fake
// SDK, the setup), as a theme made from it runs them; this package's typecheck reads the template's code through
// them. The template's text is not filled in here: its placeholders ({{name}}, {{htmlClass}}, ...) stay as written,
// and every test reads them through the template's own names.
import '../../../templates/minimal/test/look-data.test.ts'
import '../../../templates/minimal/test/screens.test.tsx'
