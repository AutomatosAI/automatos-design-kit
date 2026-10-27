// PRD-261 B-06a: the proof launcher (scripts/proof/launch.sh), the protocol's files (proof/) and kit.yml's proof job.
// The launcher is read as text, then run with bash (CI only): it refuses without --model and refuses a --dest inside
// a repository, inside the folder it runs from, inside the home folder's Claude Code folder, or one that exists,
// before it writes anything; a --dry-run against a throwaway kit (tests/support/proof-git.ts) makes the proof branch,
// deletes the leak paths in one commit, writes the proof folder, the run's settings and its task, starts nothing,
// and leaves a branch the guard passes once a theme is added.
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BASE_TAG, BRANCH, COMMAND_FOLDER, LEAK_FILES, PROOF_ID, REFERENCES_TEST, ROOT, SLUG, commitFiles, git, gitEnv, sandbox,
  themeFiles, upstream,
} from "./support/proof-git.ts";
import { codeOf, jobOf, stepNamed, stepsOf, usesLines } from "./support/workflow-steps.ts";

const LAUNCH = "scripts/proof/launch.sh";
const GUARD = join(ROOT, "scripts/proof/guard.mjs");
const MODEL = "claude-opus-5-5";
const SCRIPT_TIMEOUT_MS = 60_000;
const EXIT_REFUSED = 1;
const PROTOCOL_FILES = ["proof/README.md", "proof/BRIEF.template.md", "proof/PROMPT.md", "proof/run-settings.json", "proof/leak-paths.txt"];
const SCRIPT_FILES = ["scripts/proof/launch.sh", "scripts/proof/guard.mjs", "scripts/proof/audit.mjs"];
const FORBIDDEN_TEXT = ["/Users/", "/home/", ".worktrees", "DUMPING AREA", "HANDOFF", "phase-bc-plan", "prd-261.json", "automatos-play-command"];
const CATEGORIES = ["docs", "cli", "template", "checks", "host", "brief", "environment"];
const BRIEF_SECTIONS = ["Theme", "Look and feel", "Frame and pages", "Looks", "Mascot", "Phone skin", "Out of scope", "Done when"];
const FLAGS = ["--id", "--slug", "--brief", "--model", "--base", "--dest", "--dry-run"];
const PLACEHOLDER = /\{\{([A-Z]+)\}\}/g;

const readText = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const script = readText(LAUNCH);

const scratch = sandbox("proof-launch-");
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const home = join(scratch, "home");
const claudeHome = join(home, ".claude");
const runFrom = join(scratch, "run");
const proofs = join(scratch, "proofs");
[claudeHome, runFrom, proofs].forEach((folder) => mkdirSync(folder, { recursive: true }));
const brief = join(scratch, "brief.md");
writeFileSync(brief, "# Brief: Harbour\n\n## Theme\n\nacme/harbour, a made-up theme for the tests.\n");

/** Runs the launcher with bash, stdin a pipe, git's test environment (HOME is the sandbox's home), plus `env`. */
function launch(args: readonly string[], cwd = runFrom, env: Readonly<Record<string, string>> = {}): SpawnSyncReturns<string> {
  return spawnSync("bash", [join(ROOT, LAUNCH), ...args], {
    cwd, env: { ...gitEnv(home), ...env }, input: "", encoding: "utf8", timeout: SCRIPT_TIMEOUT_MS,
  });
}

const valid = (dest: string, extra: readonly string[] = []): string[] =>
  ["--id", PROOF_ID, "--slug", SLUG, "--brief", brief, "--model", MODEL, "--dest", dest, "--dry-run", ...extra];

describe("scripts/proof/launch.sh, read as text", () => {
  it("is a bash script with set -eu, and executable", () => {
    expect(script.startsWith("#!/bin/bash\n")).toBe(true);
    expect(script).toMatch(/^set -eu$/m);
    expect(statSync(join(ROOT, LAUNCH)).mode & 0o111).not.toBe(0);
  });

  it("checks the model first, before the names, the brief, the destination or any clone", () => {
    const at = (call: string): number => script.indexOf(`\n  ${call}\n`);
    expect(script).toContain('refuse "--model is required');
    ["check_model", "check_names", "check_brief", "check_dest", "clone_base"].forEach((call) => expect(at(call), call).toBeGreaterThan(0));
    expect(at("check_model")).toBeLessThan(at("check_names"));
    expect(at("check_dest")).toBeLessThan(at("clone_base"));
  });

  it("clones the base tag one commit deep, that tag only, and deletes what the leak list lists", () => {
    expect(script).toContain('clone --quiet --depth 1 --single-branch --branch "$BASE"');
    expect(script).toContain("readonly LEAK_LIST='proof/leak-paths.txt'");
    expect(script).toContain('rm -r -q --ignore-unmatch -- ":(glob)$1" ":(glob)$1/**" < /dev/null');
  });

  it("refuses a destination inside this repository, the folder it runs from, or the home folder's Claude Code folder", () => {
    ["git rev-parse --show-toplevel", "is inside this repository", "inside the folder the launcher runs from",
      `CLAUDE_HOME="$(real_dir "$HOME")/$SETTINGS_DIR"`, "readonly SETTINGS_DIR='.claude'"].forEach((part) => expect(script).toContain(part));
  });

  it("pins the model on the run, writes stream-json beside the clone, and never names a remote action or a memory path", () => {
    expect(script).toMatch(/claude -p --model "\$MODEL" --output-format stream-json --verbose/);
    expect(script).toContain('> "$DEST$TRANSCRIPT_SUFFIX"');
    expect(script).toContain("readonly TRANSCRIPT_SUFFIX='.transcript.jsonl'");
    expect(script).not.toMatch(/push/i);
    expect(script).not.toMatch(/\/projects\/|\/memory\b|MEMORY\.md/);
  });
});

describe("scripts/proof/launch.sh refuses before it writes anything", () => {
  const nothingWritten = (dest: string): void => {
    expect(readdirSync(runFrom)).toEqual([]);
    expect(existsSync(dest)).toBe(false);
  };

  it("without --model, whatever else is wrong, and with an alias for one", () => {
    const dest = join(proofs, "no-model");
    const missing = launch(["--id", PROOF_ID, "--slug", SLUG, "--brief", brief, "--dest", runFrom, "--dry-run"]);
    expect(missing.status).toBe(EXIT_REFUSED);
    expect(missing.stderr).toContain("--model is required");
    const alias = launch(valid(dest).map((arg) => (arg === MODEL ? "opus" : arg)));
    expect(alias.status).toBe(EXIT_REFUSED);
    expect(alias.stderr).toContain("--model opus is not a model id");
    nothingWritten(dest);
  });

  it("a bad id or slug, a missing brief and a missing --dest", () => {
    const dest = join(proofs, "bad-names");
    expect(launch(valid(dest).map((arg) => (arg === PROOF_ID ? "B06" : arg))).stderr).toContain("is not a proof id");
    expect(launch(valid(dest).map((arg) => (arg === SLUG ? "x" : arg))).stderr).toContain("is not a theme folder's name");
    expect(launch(valid(dest).map((arg) => (arg === brief ? join(scratch, "none.md") : arg))).stderr).toContain("is not a readable file");
    expect(launch(valid(dest).filter((arg) => arg !== "--dest" && arg !== dest)).stderr).toContain("--dest is required");
    nothingWritten(dest);
  });

  it("a --dest inside a repository, inside the folder it runs from, inside the home folder's Claude Code folder, or there already", () => {
    const repo = join(scratch, "a-repo");
    mkdirSync(repo, { recursive: true });
    git(repo, ["init", "-q"], home);
    expect(launch(valid(join(repo, "clone")), repo).stderr).toContain("is inside this repository");
    expect(launch(valid(join(runFrom, "clone"))).stderr).toContain("is inside the folder the launcher runs from");
    expect(launch(valid(join(claudeHome, "clone"))).stderr).toContain("is inside the home folder's Claude Code folder");
    expect(launch(valid(proofs)).stderr).toContain("exists already");
    const hidden = join(claudeHome, "brief.md");
    writeFileSync(hidden, "# Brief\n");
    expect(launch(valid(join(proofs, "x")).map((arg) => (arg === brief ? hidden : arg))).stderr).toContain("--brief");
    expect(readdirSync(repo)).toEqual([".git"]);
    expect(readdirSync(proofs)).toEqual([]);
    nothingWritten(join(proofs, "x"));
  });
});

describe("scripts/proof/launch.sh --dry-run, against a throwaway kit", () => {
  /** The dry runs' own folder, apart from the one the refusals keep empty. */
  const dryRuns = join(scratch, "dry-runs");
  const dest = join(dryRuns, `${PROOF_ID}-${SLUG}`);
  const inClone = (rel: string): string => join(dest, rel);
  const prepared = { kitUrl: "", baseCommit: "", result: undefined as SpawnSyncReturns<string> | undefined };
  const result = (): SpawnSyncReturns<string> => {
    if (prepared.result === undefined) throw new Error("the dry run did not run");
    return prepared.result;
  };

  beforeAll(() => {
    mkdirSync(dryRuns, { recursive: true });
    const kit = upstream(scratch);
    prepared.kitUrl = pathToFileURL(kit).href;
    prepared.baseCommit = git(kit, ["rev-parse", BASE_TAG], home).trim();
    prepared.result = launch(valid(dest), runFrom, { PROOF_KIT_URL: prepared.kitUrl });
  }, SCRIPT_TIMEOUT_MS);

  it("prepares the clone and prints the run's command, starting nothing", () => {
    expect(result().status, `${result().stdout}${result().stderr}`).toBe(0);
    expect(result().stdout).toContain(`claude -p --model ${MODEL} --output-format stream-json --verbose --setting-sources project`);
    expect(result().stdout).toContain("dry run: nothing started.");
    expect(existsSync(`${dest}.transcript.jsonl`)).toBe(false);
  });

  it("is on the proof branch, the leak paths deleted in one commit that names them, and nothing else gone", () => {
    expect(git(dest, ["symbolic-ref", "--short", "HEAD"], home).trim()).toBe(BRANCH);
    LEAK_FILES.forEach((rel) => expect(existsSync(inClone(rel)), rel).toBe(false));
    expect(existsSync(inClone("packages/theme-cli/test/fixtures/core/hello/theme.json"))).toBe(true);
    const removal = git(dest, ["log", "-n", "1", "--format=%B", "HEAD~1"], home);
    expect(removal).toContain(`proof(${PROOF_ID}): remove the leak paths before the run`);
    [`- ${COMMAND_FOLDER}: 2 files`, "- packages/theme-cli/test/fixtures/**/command*: 1 files", `- ${REFERENCES_TEST}: 1 files`]
      .forEach((line) => expect(removal).toContain(line));
    expect(git(dest, ["rev-parse", "HEAD~2"], home).trim()).toBe(prepared.baseCommit);
  });

  it("commits the brief, the run's records and the base tag, and leaves the clone clean", () => {
    expect(readFileSync(inClone(`proof/${PROOF_ID}/BRIEF.md`), "utf8")).toBe(readFileSync(brief, "utf8"));
    expect(readFileSync(inClone(`proof/${PROOF_ID}/BASE`), "utf8")).toBe(`${BASE_TAG}\n`);
    const record = readFileSync(inClone(`proof/${PROOF_ID}/RUN.md`), "utf8");
    [`| Model | \`${MODEL}\` |`, `| Base tag | \`${BASE_TAG}\` |`, `| Base commit | \`${prepared.baseCommit}\` |`, "| Ended (UTC) | to fill |"]
      .forEach((row) => expect(record).toContain(row));
    expect(readFileSync(inClone(`proof/${PROOF_ID}/GAPS.md`), "utf8")).toContain("| Gap | Where | Category | What the agent did |");
    expect(git(dest, ["status", "--porcelain"], home)).toBe("");
  });

  it("gives the run the base's allow-list and the kit's skills, kept out of git, and its task beside the clone", () => {
    expect(readFileSync(inClone(".claude/settings.json"), "utf8")).toBe(readText("proof/run-settings.json"));
    expect(lstatSync(inClone(".claude/skills")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(inClone(".claude/skills"))).toBe("../skills");
    const task = readFileSync(`${dest}.prompt.md`, "utf8");
    [`themes/${SLUG}/`, `proof/${PROOF_ID}/BRIEF.md`, BASE_TAG, BRANCH].forEach((part) => expect(task).toContain(part));
    expect(task).not.toContain("{{");
  });

  it("leaves a branch the guard passes once the run adds its theme", () => {
    commitFiles(dest, themeFiles(), home, "the theme");
    const guard = spawnSync(process.execPath, [GUARD, prepared.baseCommit, PROOF_ID, SLUG], { cwd: dest, env: gitEnv(home), encoding: "utf8" });
    expect(guard.status, `${guard.stdout}${guard.stderr}`).toBe(0);
  });

  it("refuses a slug the base has a theme for, after the clone", () => {
    const again = launch(valid(join(dryRuns, "play")).map((arg) => (arg === SLUG ? "play" : arg)), runFrom, { PROOF_KIT_URL: prepared.kitUrl });
    expect(again.status).toBe(EXIT_REFUSED);
    expect(again.stderr).toContain("themes/play is in kit-b06-base already");
  });
});

describe("the protocol's files", () => {
  it("PROMPT.md's placeholders are the ones the launcher fills", () => {
    const names = new Set(Array.from(readText("proof/PROMPT.md").matchAll(PLACEHOLDER), (match) => match[1]));
    expect([...names].sort()).toEqual(["BASE", "BRANCH", "ID", "SLUG"]);
    names.forEach((name) => expect(script).toContain(`{{${name}}}`));
  });

  it("run-settings.json allows the kit's tools only, and denies the web, git push and the home folder's Claude Code folder", () => {
    const { permissions } = JSON.parse(readText("proof/run-settings.json")) as { permissions: { allow: string[]; deny: string[] } };
    expect(permissions.allow).toEqual(["Read", "Glob", "Grep", "Edit", "Write", "Bash(npm *)", "Bash(npx automatos-theme *)",
      "Bash(node *)", "Bash(git status *)", "Bash(git diff *)", "Bash(git add *)", "Bash(git commit *)", "Bash(git log *)"]);
    expect(permissions.deny).toEqual(["WebFetch", "WebSearch", "Bash(git push *)", "Read(~/.claude/**)", "Edit(~/.claude/**)"]);
  });

  it("README.md says audited, not impossible, and names every flag, every gap category and every script", () => {
    const readme = readText("proof/README.md");
    expect(readme).toContain("**audited, not impossible**");
    FLAGS.forEach((flag) => {
      expect(readme).toContain(`\`${flag}`);
      expect(script).toContain(`${flag})`);
    });
    CATEGORIES.forEach((category) => expect(readme).toMatch(new RegExp(`^\\| \`${category}\` \\|`, "m")));
    ["launch.sh", "guard.mjs", "audit.mjs", "leak-paths.txt", "run-settings.json", "kit-proof-shots"].forEach((name) => expect(readme).toContain(name));
    expect(script).toContain(`readonly DEFAULT_BASE='${BASE_TAG}'`);
  });

  it("BRIEF.template.md has the brief's sections, in order", () => {
    expect(Array.from(readText("proof/BRIEF.template.md").matchAll(/^## (.+)$/gm), (match) => match[1])).toEqual(BRIEF_SECTIONS);
  });

  it.each([...PROTOCOL_FILES, ...SCRIPT_FILES])("%s names no local path, planning file or private repository", (rel) => {
    const text = readText(rel);
    FORBIDDEN_TEXT.forEach((part) => expect(text, part).not.toContain(part));
  });
});

describe("kit.yml's proof job (PRD-261 B-06a)", () => {
  const kit = readText(".github/workflows/kit.yml");
  const job = jobOf(kit, "proof");
  const steps = stepsOf(job);

  it("runs only on a pull request from a proof/ branch, from the branch's own head and history, without credentials", () => {
    expect(job).toMatch(/^ {4}if: startsWith\(github\.head_ref, 'proof\/'\)$/m);
    const checkout = codeOf(stepNamed(steps, "Check out"));
    ["persist-credentials: false", "ref: ${{ github.event.pull_request.head.sha }}", "fetch-depth: 0"].forEach((part) => expect(checkout).toContain(part));
    expect(job).not.toMatch(/secrets\.|GITHUB_TOKEN|github\.token/);
  });

  it("uses only the kit job's actions, at the same pins", () => {
    const kitUses = usesLines(jobOf(kit, "kit")).map((line) => line.trim());
    expect(usesLines(job).map((line) => line.trim()).filter((line) => !kitUses.includes(line))).toEqual([]);
  });

  it("guards with main's copy of the guard and Node alone before installing, then builds, checks and shoots the theme", () => {
    expect(steps.map(({ name }) => name)).toEqual([
      "Check out", "Set up Node", "Proof guard", "Pin npm", "Install (from the lockfile)", "Build", "Proof theme check",
      "Install browsers", "Proof theme shots", "Upload proof shots",
    ]);
    const guard = stepNamed(steps, "Proof guard");
    expect(guard.run.split("\n").map((line) => line.trim())).toEqual([
      'git show origin/main:scripts/proof/guard.mjs > "$RUNNER_TEMP/proof-guard.mjs"', 'node "$RUNNER_TEMP/proof-guard.mjs" --ci',
    ]);
    expect(guard.body).toContain("id: guard");
    expect(guard.body).toContain("HEAD_REF: ${{ github.head_ref }}");
    expect(stepNamed(steps, "Proof theme check").run).toBe('npx automatos-theme check "$PROOF_THEME"');
    expect(stepNamed(steps, "Proof theme shots").run).toBe('npx automatos-theme shots "$PROOF_THEME" --out packages/theme-harness/dist/shots/proof');
    ["Proof theme check", "Proof theme shots"].forEach((name) => expect(stepNamed(steps, name).body).toContain("PROOF_THEME: ${{ steps.guard.outputs.theme }}"));
    steps.forEach((step) => expect(step.run, step.name).not.toContain("${{"));
  });

  it("uploads the shots as kit-proof-shots whatever happened, and fails when there are none", () => {
    const upload = codeOf(stepNamed(steps, "Upload proof shots"));
    ["if: always()", "name: kit-proof-shots", "path: packages/theme-harness/dist/shots/proof/", "if-no-files-found: error"]
      .forEach((part) => expect(upload).toContain(part));
  });
});
