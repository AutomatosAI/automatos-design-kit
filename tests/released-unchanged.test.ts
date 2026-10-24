// PRD-261 C-06r (PB-4): scripts/release/released-unchanged.mjs, kit CI's check that a released theme version
// never changes, run with Node against throwaway git repositories. Each case builds an upstream repository
// (Play's and HUD's files, commits, play-v* and hud-v* tags), clones it as kit CI's checkout does (one commit
// deep, no tags) and runs the script at the clone's root: for each theme it lists the upstream's tags with git
// ls-remote, fetches the one theme.json's version names and compares the theme's packed paths with it. git
// runs with no system or user config.
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
const CHANGELOG = "themes/play/CHANGELOG.md";
const LICENSE = "themes/play/LICENSE";
/** A file of a kit package Play bundles (PRD-261 B-01i): its src/ is packed as source/packages/mascot/src/. */
const BUNDLED_SOURCE = "packages/mascot/src/player.ts";
/** One file under each of Play's packed paths but theme.json, which manifest() writes. */
const PACKED_FILES = {
  [SOURCE]: "export const entry = 1;\n",
  [BUNDLED_SOURCE]: "export const player = 1;\n",
  [ASSET]: "home preview\n",
  [README]: "# Play\n",
  [CHANGELOG]: "## 1.1.0\n\n- Release.\n",
};
/** Files outside Play's packed paths: a change to them never needs a new version. */
const OUTSIDE_FILES = {
  "themes/play/package.json": '{ "name": "@automatos/theme-play", "version": "1.1.0" }\n',
  "themes/play/test/entry.test.ts": "// a test\n",
  "themes/play/vite.config.ts": "export default {};\n",
  "packages/mascot/README.md": "# mascot\n",
  "README.md": "# kit\n",
};
const OUTSIDE_CHANGES = {
  "themes/play/package.json": '{ "name": "@automatos/theme-play", "version": "1.1.0", "description": "Play" }\n',
  "themes/play/test/entry.test.ts": "// a test, reworded\n",
  "themes/play/vite.config.ts": "export default { base: './' };\n",
  "themes/play/signatures/1.1.0.sig.json": "{}\n",
  "packages/mascot/README.md": "# mascot, reworded\n",
  "README.md": "# kit, reworded\n",
};
const GUARDED_CHANGES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["a source file", { [SOURCE]: "export const entry = 2;\n" }],
  ["a new asset", { "themes/play/assets/previews/chat.png": "chat preview\n" }],
  ["the README", { [README]: "# Play, reworded\n" }],
  ["theme.json at the same version", { [MANIFEST]: manifest(RELEASED, { name: "Play, renamed" }) }],
  ["a new LICENSE", { [LICENSE]: "MIT\n" }],
  ["a CHANGELOG.md edit", { [CHANGELOG]: "## 1.1.0\n\n- Release.\n- Reworded.\n" }],
  ["a bundled kit package's source", { [BUNDLED_SOURCE]: "export const player = 2;\n" }],
];
const BAD_VERSIONS: readonly unknown[] = ["1.1", "v1.1.0", "1.1.0-rc.1", "1.1.0\n", " 1.1.0", 110, null];

// HUD, released by hud-v<version>: it commits boot/ and looks/, which its pack collects, so they are guarded too.
const HUD_RELEASED = "1.0.0";
const HUD_TAG = `hud-v${HUD_RELEASED}`;
const HUD_MANIFEST = "themes/hud/theme.json";
const HUD_SOURCE = "themes/hud/src/entry.ts";
const HUD_PREPAINT = "themes/hud/boot/prepaint.json";
const HUD_PRESET = "themes/hud/looks/presets/arc.look.json";
/** One file under each of HUD's packed paths but theme.json, which hudManifest() writes. */
const HUD_PACKED_FILES = {
  [HUD_SOURCE]: "export const entry = 1;\n",
  [HUD_PREPAINT]: "{}\n",
  [HUD_PRESET]: '{ "id": "arc" }\n',
  "themes/hud/assets/fonts/README.md": "# fonts\n",
  "themes/hud/README.md": "# HUD\n",
  "themes/hud/CHANGELOG.md": "## 1.0.0\n\n- Release.\n",
};
/** Files outside HUD's packed paths: its tests, its design proofs, its package.json, its notice and signatures. */
const HUD_OUTSIDE_CHANGES = {
  "themes/hud/package.json": '{ "name": "@automatos/theme-hud", "version": "1.0.0", "description": "HUD" }\n',
  "themes/hud/test/entry.test.tsx": "// a test\n",
  "themes/hud/design/contrast.json": "{}\n",
  "themes/hud/NOTICE": "notice\n",
  "themes/hud/signatures/1.0.0.sig.json": "{}\n",
};
const HUD_GUARDED_CHANGES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["a source file", { [HUD_SOURCE]: "export const entry = 2;\n" }],
  ["the committed first paint (boot/)", { [HUD_PREPAINT]: '{ "defaults": {} }\n' }],
  ["a new committed preset (looks/)", { "themes/hud/looks/presets/gold.look.json": '{ "id": "gold" }\n' }],
  ["theme.json at the same version", { [HUD_MANIFEST]: hudManifest(HUD_RELEASED, { name: "HUD, renamed" }) }],
  ["a bundled kit package's source", { [BUNDLED_SOURCE]: "export const player = 2;\n" }],
];

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

/** HUD's theme.json at `version`. */
function hudManifest(version: unknown, extra: Readonly<Record<string, unknown>> = {}): string {
  return `${JSON.stringify({ schema: "automatos-theme/v1", id: "automatos/hud", version, ...extra }, null, 2)}\n`;
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

/** A new upstream repository with one commit: Play at `version`, HUD at `hudVersion`, and files outside their packed paths. */
function upstream(version: string = RELEASED, hudVersion: string = HUD_RELEASED): string {
  const repo = mkdtempSync(join(sandbox, "upstream-"));
  git(repo, ["init", "-q", "-b", "main"]);
  commit(repo, { [MANIFEST]: manifest(version), ...PACKED_FILES, ...OUTSIDE_FILES, [HUD_MANIFEST]: hudManifest(hudVersion), ...HUD_PACKED_FILES });
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

  it("passes before HUD's first release: with no hud-v* tag nothing of HUD is released, whatever Play's tags", () => {
    const repo = upstream(RELEASED, "1.1.0");
    tag(repo, RELEASE_TAG);
    commit(repo, { [HUD_SOURCE]: "export const entry = 2;\n", [HUD_PREPAINT]: '{ "defaults": {} }\n' });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain("no HUD version is released");
    expect(outcome.named).toEqual([]);
  });

  it.each(HUD_GUARDED_CHANGES)("fails on a change to HUD's %s under its released version, naming the path", (_, files) => {
    const repo = upstream();
    tag(repo, HUD_TAG, true);
    commit(repo, files);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(new RegExp(`^::error::released-unchanged: HUD ${HUD_RELEASED} is released \\(${HUD_TAG}\\)`, "m"));
    expect(outcome.output).toContain("no Play version is released");
    expect(outcome.named).toEqual(Object.keys(files));
  });

  it("passes on changes outside HUD's packed paths under its released version, and names both released themes", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    tag(repo, HUD_TAG);
    commit(repo, { ...HUD_OUTSIDE_CHANGES, ...OUTSIDE_CHANGES });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain(`Play ${RELEASED} is released (${RELEASE_TAG})`);
    expect(outcome.output).toContain(`HUD ${HUD_RELEASED} is released (${HUD_TAG})`);
  });

  it("guards a bundled kit package for every released theme that bundles it", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    tag(repo, HUD_TAG);
    commit(repo, { [BUNDLED_SOURCE]: "export const player = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output.match(/^::error::released-unchanged: (?:Play|HUD) \S+ is released/gm)).toHaveLength(2);
    expect(outcome.named).toEqual([BUNDLED_SOURCE, BUNDLED_SOURCE]);
  });

  it("passes on HUD bumped above its release, and fails on an untagged HUD below it", () => {
    const repo = upstream();
    tag(repo, HUD_TAG);
    commit(repo, { [HUD_SOURCE]: "export const entry = 2;\n", [HUD_MANIFEST]: hudManifest("1.0.1") });
    const bumped = check(repo);
    expect(bumped.status, bumped.output).toBe(0);
    expect(bumped.output).toContain(`above the latest release, ${HUD_TAG}`);
    commit(repo, { [HUD_MANIFEST]: hudManifest("0.9.0") });
    const below = check(repo);
    expect(below.status, below.output).toBe(1);
    expect(below.output).toMatch(/^::error::released-unchanged: HUD 0\.9\.0 .* is not above the latest release, hud-v1\.0\.0/m);
  });

  it("fails when HUD's theme.json can't be read", () => {
    const repo = upstream();
    removeAndCommit(repo, HUD_MANIFEST);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toContain(`::error::released-unchanged: can't read ${HUD_MANIFEST}`);
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
