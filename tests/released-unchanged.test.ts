// PRD-261 C-06r (PB-4): scripts/release/released-unchanged.mjs, kit CI's check that a released theme version
// never changes, run with Node against throwaway git repositories (tests/support/released-unchanged.ts): Play's and
// HUD's cases, and the script's own (its arguments, its imports, a failure to list tags). Each case builds an upstream
// repository (Play's, HUD's and Arcade's files, commits, play-v* and hud-v* tags), clones it as kit CI's checkout does
// (one commit deep, no tags) and runs the script at the clone's root: for every folder under themes/ it lists the
// upstream's <slug>-v* tags with git ls-remote, fetches the one theme.json's version names and compares the theme's
// packed paths (scripts/release/themes.mjs packedPathsOf) with it. Arcade's cases, and those of a theme of another
// publisher, are tests/released-unchanged-themes.test.ts.
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  ASSET, BUNDLED_SOURCE, CHANGELOG, HUD_MANIFEST, HUD_PREPAINT, HUD_RELEASED, HUD_SOURCE, HUD_TAG, MANIFEST,
  OUTSIDE_CHANGES, README, RELEASE_TAG, RELEASED, SCRIPT, SOURCE, check, checkout, commit, hudManifest, manifest,
  removeAndCommit, runScript, sandbox, tag, upstream,
} from "./support/released-unchanged.ts";

const SHARED = fileURLToPath(new URL("../scripts/release/themes.mjs", import.meta.url));
const LICENSE = "themes/play/LICENSE";
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

const HUD_GUARDED_CHANGES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["a source file", { [HUD_SOURCE]: "export const entry = 2;\n" }],
  ["the committed first paint (boot/)", { [HUD_PREPAINT]: '{ "defaults": {} }\n' }],
  ["a new committed preset (looks/)", { "themes/hud/looks/presets/gold.look.json": '{ "id": "gold" }\n' }],
  ["theme.json at the same version", { [HUD_MANIFEST]: hudManifest(HUD_RELEASED, { name: "HUD, renamed" }) }],
  ["a bundled kit package's source", { [BUNDLED_SOURCE]: "export const player = 2;\n" }],
];

describe("scripts/release/released-unchanged.mjs", () => {
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  it("passes before the first release: with no play-v* tag nothing is released", () => {
    const repo = upstream();
    commit(repo, { [SOURCE]: "export const entry = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain("no themes/play version is released");
    expect(outcome.named).toEqual([]);
  });

  it.each([false, true])("passes on a released version whose packed files are as tagged (annotated tag: %s)", (annotated) => {
    const repo = upstream();
    tag(repo, RELEASE_TAG, annotated);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain(`themes/play ${RELEASED} is released (${RELEASE_TAG})`);
  });

  it.each(GUARDED_CHANGES)("fails on a change to %s under the released version, naming the path", (_, files) => {
    const repo = upstream();
    tag(repo, RELEASE_TAG, true);
    commit(repo, files);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(new RegExp(`^::error::released-unchanged: themes/play ${RELEASED} is released \\(${RELEASE_TAG}\\)`, "m"));
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
    expect(changed.output).toContain("themes/play 1.1.1 is released (play-v1.1.1)");
    expect(changed.named).toEqual([SOURCE]);
  });

  it("fails on an untagged version that is not above the latest release", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    commit(repo, { [MANIFEST]: manifest("1.0.9") });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(/^::error::released-unchanged: themes\/play 1\.0\.9 .* is not above the latest release, play-v1\.1\.0/m);
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
    expect(outcome.output).toContain("no themes/play version is released");
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
    // Folders are checked in name order, so Arcade's tags are the first the script lists.
    expect(outcome.output).toContain("::error::released-unchanged: can't list the arcade-v* tags on origin (git ls-remote):");
  });

  it("passes before HUD's first release: with no hud-v* tag nothing of HUD is released, whatever Play's tags", () => {
    const repo = upstream(RELEASED, "1.1.0");
    tag(repo, RELEASE_TAG);
    commit(repo, { [HUD_SOURCE]: "export const entry = 2;\n", [HUD_PREPAINT]: '{ "defaults": {} }\n' });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain("no themes/hud version is released");
    expect(outcome.named).toEqual([]);
  });

  it.each(HUD_GUARDED_CHANGES)("fails on a change to HUD's %s under its released version, naming the path", (_, files) => {
    const repo = upstream();
    tag(repo, HUD_TAG, true);
    commit(repo, files);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(new RegExp(`^::error::released-unchanged: themes/hud ${HUD_RELEASED} is released \\(${HUD_TAG}\\)`, "m"));
    expect(outcome.output).toContain("no themes/play version is released");
    expect(outcome.named).toEqual(Object.keys(files));
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
    expect(below.output).toMatch(/^::error::released-unchanged: themes\/hud 0\.9\.0 .* is not above the latest release, hud-v1\.0\.0/m);
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

  // It runs before the install, so it imports nothing npm installs: its one sibling, themes.mjs, imports Node alone.
  it("imports the shared themes.mjs and Node's built-ins only, and themes.mjs Node's built-ins only", () => {
    const importsOf = (file: string): string[] =>
      [...readFileSync(file, "utf8").matchAll(/^import\s[^;]*?\sfrom\s+'([^']+)'$/gm)].map((match) => match[1]);
    expect(importsOf(SCRIPT)).toEqual(["./themes.mjs"]);
    expect(importsOf(SHARED).length).toBeGreaterThan(0);
    expect(importsOf(SHARED).filter((name) => !name.startsWith("node:"))).toEqual([]);
    [SCRIPT, SHARED].forEach((file) => expect(readFileSync(file, "utf8")).not.toMatch(/\brequire\(|\bimport\(/));
  });
});
