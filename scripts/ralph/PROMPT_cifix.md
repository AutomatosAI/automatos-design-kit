# Ralph CI-fix session: Automatos Play pilot

The wave is built and pushed, and CI failed. Fix it in this one session.

1. Read `CLAUDE.md`, the "Patterns" section of `scripts/ralph/progress.txt`, and the failure log at `scripts/ralph/logs/ci-failure.txt` (the failed steps of the latest CI run on this branch).
2. Fix the **root cause** of every failure in the log. Never weaken, skip or delete a test, a lint rule or a CI step to make it pass. If a test is wrong (it asserts something the acceptance criteria don't require), fix the test and say why in progress.txt.
3. A red CI job shows only its first failing step. Read the code around the failure for the same mistake elsewhere, and fix those too.
4. Append `## CI fix <date>` to `scripts/ralph/progress.txt`: what failed, why, and what you changed.
5. Commit, staging explicit paths: `git commit -m "fix(play): CI <short reason>"`. **Do not push**; the runner pushes.
6. Your final reply's last line is `CI_FIX_DONE`, or `RALPH_BLOCKED ci <reason in under 60 characters>` if you can't fix it.

The execution contract in `scripts/ralph/PROMPT_build.md` applies in full: nothing runs locally (`npm view` only), no background work, no push, and sentinels on the last line only. The core source is read-only at `{{CORE}}`.
