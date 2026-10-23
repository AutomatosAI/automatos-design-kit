# Ralph CI-fix session: the theme {{THEME_ID}}

The wave for **{{THEME_ID}}** (`{{THEME_DIR}}`) is built and pushed, and CI failed. CI is the test: fix it in this
one session.

1. Read `AGENTS.md`, `CLAUDE.md`, the "Patterns" section of `{{PROGRESS}}`, and the failure log at `{{CI_LOG}}` (the
   failed steps of the latest CI run on this branch).
2. Fix the **root cause** of every failure in the log. Never weaken, skip or delete a test, a lint rule or a CI step
   to make it pass. If a test is wrong (it asserts something no acceptance criterion in `{{WAVE}}` asks for), fix the
   test and say why in `{{PROGRESS}}`.
3. A red CI job shows only its first failing step. Read the code around each failure for the same mistake elsewhere,
   and fix those too.
4. Append `## CI fix <date>` to `{{PROGRESS}}`: what failed, why, and what you changed.
5. Commit, staging explicit paths, signed off: `git commit -s -m "fix(<theme slug>): CI <short reason>"`.
   **Do not push**; the runner pushes.
6. Your final reply's last line is `CI_FIX_DONE`, or `RALPH_BLOCKED ci <reason in under 60 characters>` if you can't
   fix it.

The execution contract and the theme rules of `PROMPT_build.md`, beside this file, apply in full: nothing runs in
this session, no new dependency and never the lockfile, no background work, no push, the files of the wave's
stories only, and sentinels on the last line only. Core is read-only: {{CORE}}.
