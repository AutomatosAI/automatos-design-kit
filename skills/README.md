# Skills

Agent skills for building Automatos themes with this kit, in the Agent Skills format Claude Code reads: one folder
per skill, holding a `SKILL.md` whose frontmatter `name` is the folder's name and whose `description` says when to
use it, and any `references/` the skill links to. To use them in Claude Code, put each folder (or a link to it) in
the `skills` folder of the project's `.claude` folder, or of your own; any agent can also read them as plain Markdown.

The facts live in [`guides/`](../guides/README.md); a skill is the order of work and points there. `tests/skills.test.ts`
lints this folder: every skill is listed here once, its `name` and `description` are valid, its links resolve, every
`automatos-theme` command it names is one the CLI has built, and no skill teaches a backend call, a proxy or the
browser's storage.

| Skill | Use it to |
|---|---|
| [build-automatos-theme](build-automatos-theme/SKILL.md) | Build or change a theme: the brief, the folder, the frame, the look editor, pages, routes, the mascot, then check, pack and try it |
| [write-a-look-schema-and-presets](write-a-look-schema-and-presets/SKILL.md) | Write the look data (schema, presets, first-paint table, tone rule, colour pairs) and prove every preset readable before any code |
| [pass-marketplace-review](pass-marketplace-review/SKILL.md) | Run the server's review checks in the kit, fix what they refuse, and submit the package |
