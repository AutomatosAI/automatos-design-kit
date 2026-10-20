// PRD-261 C-06r (PB-4): scripts/release/released-unchanged.mjs, kit CI's check that a released Play
// version never changes, run with Node against throwaway git repositories. Each case builds an upstream
// repository (Play's files, commits, play-v* tags), clones it as kit CI's checkout does (one commit deep,
// no tags) and runs the script at the clone's root: it lists the upstream's tags with git ls-remote,
// fetches the one theme.json's version names and compares Play's packed paths with it. git runs with no
// system or user config.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(new URL("../scripts/release/released-unchanged.mjs", import.meta.url));
const RELEASED = "1.1.0";
const RELEASE_TAG = `play-v${RELEASED}`;
const MANIFEST = "themes/play/theme.json";
const SOURCE = "themes/play/src/entry.ts";
const ASSET = "themes/play/assets/previews/home.png";
const README = "themes/play/README.md";
/** One file under each of Play's packed paths but theme.json, which manifest() writes. */
const PACKED_FILES = { [SOURCE]: "export const entry = 1;\n", [ASSET]: "home preview\n", [README]: "# Play\n" };
/** Files outside Play's packed paths: a change to them never needs a new version. */
const OUTSIDE_FILES = {
  "themes/play/package.json": '{ "name": "@automatos/theme-play", "version": "1.1.0" }\n',
  "themes/play/test/entry.test.ts": "// a test\n",
  "themes/play/vite.config.ts": "export default {};\n",
  "README.md": "# kit\n",
};
const OUTSIDE_CHANGES = {
  "themes/play/package.json": '{ "name": "@automatos/theme-play", "version": "1.1.0", "description": "Play" }\n',
  "themes/play/test/entry.test.ts": "// a test, reworded\n",
  "themes/play/vite.config.ts": "export default { base: './' };\n",
  "themes/play/signatures/1.1.0.sig.json": "{}\n",
  "README.md": "# kit, reworded\n",
};
const GUARDED_CHANGES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["a source file", { [SOURCE]: "export const entry = 2;\n" }],
  ["a new asset", { "themes/play/assets/previews/chat.png": "chat preview\n" }],
  ["the README", { [README]: "# Play, reworded\n" }],
  ["theme.json at the same version", { [MANIFEST]: manifest(RELEASED, { name: "Play, renamed" }) }],
];
const BAD_VERSIONS: readonly unknown[] = ["1.1", "v1.1.0", "1.1.0-rc.1", "1.1.0\n", " 1.1.0", 110, null];

const sandbox = mkdtempSync(join(tmpdir(), "released-unchanged-"));
/** git with no system or user config, a fixed identity, plain messages and no prompts. */
const GIT_ENV = {
  PATH: process.env.PATH ?? "",
  HOME: sandbox,
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: devNull,
  GIT_TERMINAL_PROMPT: "0",
  GIT_AUTHOR_NAME: "Kit Test",
  GIT_AUTHOR_EMAIL: "kit-test@example.com",
  GIT_COMMITTER_NAME: "Kit Test",
  GIT_COMMITTER_EMAIL: "kit-test@example.com",
};

interface Outcome {
  readonly status: number | null;
  readonly output: string;
  /** The changed paths the script named: its indented lines. */
  readonly named: readonly string[];
}

function git(cwd: string, args: readonly string[]): string {
  const run = spawnSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}

/** Play's theme.json at `version`. */
function manifest(version: unknown, extra: Readonly<Record<string, unknown>> = {}): string {
  return `${JSON.stringify({ schema: "automatos-theme/v1", id: "automatos/play", version, ...extra }, null, 2)}\n`;
}

/** Writes `files` (repo-relative path to text) and commits them. */
function commit(repo: string, files: Readonly<Record<string, string>>): void {
  Object.entries(files).forEach(([rel, body]) => {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), body);
  });
  git(repo, ["add", "--", ...Object.keys(files)]);
  git(repo, ["commit", "-q", "-m", `change ${Object.keys(files).join(", ")}`]);
}

function removeAndCommit(repo: string, rel: string): void {
  git(repo, ["rm", "-q", "--", rel]);
  git(repo, ["commit", "-q", "-m", `remove ${rel}`]);
}

/** A new upstream repository with one commit: Play at `version` and the files outside its packed paths. */
function upstream(version: string = RELEASED): string {
  const repo = mkdtempSync(join(sandbox, "upstream-"));
  git(repo, ["init", "-q", "-b", "main"]);
  commit(repo, { [MANIFEST]: manifest(version), ...PACKED_FILES, ...OUTSIDE_FILES });
  return repo;
}

function tag(repo: string, name: string, annotated = false): void {
  git(repo, annotated ? ["tag", "-a", name, "-m", name] : ["tag", name]);
}

/** Clones `repo` as kit CI's checkout does: its head commit only, no tags. */
function checkout(repo: string): string {
  const clone = mkdtempSync(join(sandbox, "checkout-"));
  git(sandbox, ["clone", "-q", "--no-tags", "--depth", "1", pathToFileURL(repo).href, clone]);
  return clone;
}

/** Runs the script at the clone's root, as kit.yml's step does. */
function runScript(clone: string, args: readonly string[] = []): Outcome {
  const run = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: clone, env: GIT_ENV, encoding: "utf8" });
  const output = `${run.stdout}${run.stderr}`;
  const named = output.split("\n").filter((line) => line.startsWith("  ")).map((line) => line.trim());
  return { status: run.status, output, named };
}

const check = (repo: string): Outcome => runScript(checkout(repo));

describe("scripts/release/released-unchanged.mjs", () => {
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  it("passes before the first release: with no play-v* tag nothing is released", () => {
    const repo = upstream();
    commit(repo, { [SOURCE]: "export const entry = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain("no Play version is released");
    expect(outcome.named).toEqual([]);
  });

  it.each([false, true])("passes on a released version whose packed files are as tagged (annotated tag: %s)", (annotated) => {
    const repo = upstream();
    tag(repo, RELEASE_TAG, annotated);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain(`is released (${RELEASE_TAG})`);
  });

  it.each(GUARDED_CHANGES)("fails on a change to %s under the released version, naming the path", (_, files) => {
    const repo = upstream();
    tag(repo, RELEASE_TAG, true);
    commit(repo, files);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(new RegExp(`^::error::released-unchanged: Play ${RELEASED} is released \\(${RELEASE_TAG}\\)`, "m"));
    expect(outcome.named).toEqual(Object.keys(files));
  });

  it("fails on a file removed under the released version, naming it, and names every changed path", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    removeAndCommit(repo, SOURCE);
    commit(repo, { [ASSET]: "home preview, reshot\n", ...OUTSIDE_CHANGES });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.named).toEqual([ASSET, SOURCE]);
  });

  it("passes on changes outside Play's packed paths under the released version", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    commit(repo, OUTSIDE_CHANGES);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.named).toEqual([]);
  });

  it("passes on a change with the version bumped above every release, and guards that version once it is tagged", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    commit(repo, { [SOURCE]: "export const entry = 2;\n", [MANIFEST]: manifest("1.1.1") });
    const bumped = check(repo);
    expect(bumped.status, bumped.output).toBe(0);
    expect(bumped.output).toContain(`above the latest release, ${RELEASE_TAG}`);
    tag(repo, "play-v1.1.1");
    commit(repo, { [SOURCE]: "export const entry = 3;\n" });
    const changed = check(repo);
    expect(changed.status, changed.output).toBe(1);
    expect(changed.output).toContain("is released (play-v1.1.1)");
    expect(changed.named).toEqual([SOURCE]);
  });

  it("fails on an untagged version that is not above the latest release", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    commit(repo, { [MANIFEST]: manifest("1.0.9") });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(/^::error::released-unchanged: Play 1\.0\.9 .* is not above the latest release, play-v1\.1\.0/m);
  });

  it("orders versions by number, not as text", () => {
    const repo = upstream("1.9.0");
    tag(repo, "play-v1.9.0");
    commit(repo, { [SOURCE]: "export const entry = 2;\n", [MANIFEST]: manifest("1.10.0") });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
  });

  it("counts only play-v<major>.<minor>.<patch> tags as releases", () => {
    const repo = upstream();
    ["play-v1.1.0-rc.1", "play-vnext", "v1.1.0", "xplay-v1.1.0"].forEach((name) => tag(repo, name));
    commit(repo, { [SOURCE]: "export const entry = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain("no Play version is released");
  });

  it.each(BAD_VERSIONS)("refuses theme.json's version %j", (version) => {
    const repo = upstream();
    commit(repo, { [MANIFEST]: manifest(version) });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toContain(`::error::released-unchanged: ${MANIFEST}'s version must be MAJOR.MINOR.PATCH`);
  });

  it("fails, never passes, when the upstream's tags can't be listed", () => {
    const repo = upstream();
    const clone = checkout(repo);
    rmSync(repo, { recursive: true, force: true });
    const outcome = runScript(clone);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toContain("::error::released-unchanged: can't list the play-v* tags on origin (git ls-remote):");
  });

  it("takes no arguments", () => {
    const outcome = runScript(checkout(upstream()), ["themes/play"]);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toContain("usage: node scripts/release/released-unchanged.mjs");
  });

  it("imports Node's built-ins only", () => {
    const text = readFileSync(SCRIPT, "utf8");
    const imports = [...text.matchAll(/^import .* from '([^']+)'$/gm)].map((match) => match[1]);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((name) => !name.startsWith("node:"))).toEqual([]);
    expect(text).not.toMatch(/\brequire\(|\bimport\(/);
  });
});
