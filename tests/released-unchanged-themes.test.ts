// PRD-261 C-06r (PB-4): scripts/release/released-unchanged.mjs on every folder under themes/, each by its own
// <slug>-v* tags, run with Node against throwaway git repositories (tests/support/released-unchanged.ts): Arcade's
// cases, the three released themes together (the files outside their packed paths, and the kit library all three
// bundle), and themes of another publisher (acme/harbour, and a slug with -v in it). Play's and HUD's own cases, and
// the script's own, are tests/released-unchanged.test.ts.
import { rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import {
  ARCADE_MANIFEST, ARCADE_PREPAINT, ARCADE_RELEASED, ARCADE_SOURCE, BUNDLED_SOURCE, HUD_RELEASED, HUD_TAG,
  OUTSIDE_CHANGES, RELEASE_TAG, RELEASED, arcadeManifest, check, commit, removeAndCommit, sandbox, tag, themePackage,
  upstream,
} from "./support/released-unchanged.ts";

/** Files outside HUD's packed paths: its tests, its design proofs, its package.json, its notice and signatures. */
const HUD_OUTSIDE_CHANGES = {
  "themes/hud/package.json": themePackage("@automatos/theme-hud", { description: "HUD" }),
  "themes/hud/test/entry.test.tsx": "// a test\n",
  "themes/hud/design/contrast.json": "{}\n",
  "themes/hud/NOTICE": "notice\n",
  "themes/hud/signatures/1.0.0.sig.json": "{}\n",
};

// Arcade's release tag, and the changes its cases make; its files are the support module's.
const ARCADE_TAG = `arcade-v${ARCADE_RELEASED}`;
/** Files outside Arcade's packed paths: its tests, its design proofs, its package.json, its notice and signatures. */
const ARCADE_OUTSIDE_CHANGES = {
  "themes/arcade/package.json": themePackage("@automatos/theme-arcade", { description: "Arcade" }),
  "themes/arcade/test/entry.test.ts": "// a test\n",
  "themes/arcade/design/contrast.json": "{}\n",
  "themes/arcade/NOTICE": "notice\n",
  "themes/arcade/signatures/1.0.0.sig.json": "{}\n",
};
const ARCADE_GUARDED_CHANGES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ["a source file", { [ARCADE_SOURCE]: "export const entry = 2;\n" }],
  ["the committed first paint (boot/)", { [ARCADE_PREPAINT]: '{ "defaults": {} }\n' }],
  ["a new committed preset (looks/)", { "themes/arcade/looks/presets/gold.look.json": '{ "id": "gold" }\n' }],
  ["theme.json at the same version", { [ARCADE_MANIFEST]: arcadeManifest(ARCADE_RELEASED, { name: "Arcade, renamed" }) }],
  ["a bundled kit package's source", { [BUNDLED_SOURCE]: "export const player = 2;\n" }],
];

/** Any other theme's theme.json: the script reads only its version, whatever its publisher. */
function themeManifest(id: string, version: string): string {
  return `${JSON.stringify({ schema: "automatos-theme/v1", id, version })}\n`;
}

describe("scripts/release/released-unchanged.mjs on every folder under themes/", () => {
  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  it("passes on changes outside HUD's and Arcade's packed paths under their released versions, and names all three released themes", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    tag(repo, HUD_TAG);
    tag(repo, ARCADE_TAG);
    commit(repo, { ...HUD_OUTSIDE_CHANGES, ...ARCADE_OUTSIDE_CHANGES, ...OUTSIDE_CHANGES });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain(`themes/play ${RELEASED} is released (${RELEASE_TAG})`);
    expect(outcome.output).toContain(`themes/hud ${HUD_RELEASED} is released (${HUD_TAG})`);
    expect(outcome.output).toContain(`themes/arcade ${ARCADE_RELEASED} is released (${ARCADE_TAG})`);
  });

  it("guards a bundled kit package for every released theme that bundles it", () => {
    const repo = upstream();
    tag(repo, RELEASE_TAG);
    tag(repo, HUD_TAG);
    tag(repo, ARCADE_TAG);
    commit(repo, { [BUNDLED_SOURCE]: "export const player = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output.match(/^::error::released-unchanged: themes\/(?:play|hud|arcade) \S+ is released/gm)).toHaveLength(3);
    expect(outcome.named).toEqual([BUNDLED_SOURCE, BUNDLED_SOURCE, BUNDLED_SOURCE]);
  });

  it("passes before Arcade's first release: with no arcade-v* tag nothing of Arcade is released, whatever Play's and HUD's tags", () => {
    const repo = upstream(RELEASED, HUD_RELEASED, "1.1.0");
    tag(repo, RELEASE_TAG);
    tag(repo, HUD_TAG);
    commit(repo, { [ARCADE_SOURCE]: "export const entry = 2;\n", [ARCADE_PREPAINT]: '{ "defaults": {} }\n' });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(0);
    expect(outcome.output).toContain("no themes/arcade version is released");
  });

  it.each(ARCADE_GUARDED_CHANGES)("fails on a change to Arcade's %s under its released version, naming the path", (_, files) => {
    const repo = upstream();
    tag(repo, ARCADE_TAG, true);
    commit(repo, files);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(new RegExp(`^::error::released-unchanged: themes/arcade ${ARCADE_RELEASED} is released \\(${ARCADE_TAG}\\)`, "m"));
    expect(outcome.output).toContain("no themes/play version is released");
    expect(outcome.output).toContain("no themes/hud version is released");
    expect(outcome.named).toEqual(Object.keys(files));
  });

  it("passes on Arcade bumped above its release, and fails on an untagged Arcade below it", () => {
    const repo = upstream();
    tag(repo, ARCADE_TAG);
    commit(repo, { [ARCADE_SOURCE]: "export const entry = 2;\n", [ARCADE_MANIFEST]: arcadeManifest("1.0.1") });
    const bumped = check(repo);
    expect(bumped.status, bumped.output).toBe(0);
    expect(bumped.output).toContain(`above the latest release, ${ARCADE_TAG}`);
    commit(repo, { [ARCADE_MANIFEST]: arcadeManifest("0.9.0") });
    const below = check(repo);
    expect(below.status, below.output).toBe(1);
    expect(below.output).toMatch(/^::error::released-unchanged: themes\/arcade 0\.9\.0 .* is not above the latest release, arcade-v1\.0\.0/m);
  });

  it("fails when Arcade's theme.json can't be read", () => {
    const repo = upstream();
    removeAndCommit(repo, ARCADE_MANIFEST);
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toContain(`::error::released-unchanged: can't read ${ARCADE_MANIFEST}`);
  });

  it("guards every folder under themes/ by its own tags, whatever its publisher: a fourth theme", () => {
    const repo = upstream();
    const source = "themes/harbour/src/entry.ts";
    commit(repo, { "themes/harbour/theme.json": themeManifest("acme/harbour", "0.1.0"), [source]: "export const entry = 1;\n" });
    tag(repo, "harbour-v0.1.0");
    commit(repo, { [source]: "export const entry = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toMatch(/^::error::released-unchanged: themes\/harbour 0\.1\.0 is released \(harbour-v0\.1\.0\)/m);
    expect(outcome.output).toContain("no themes/play version is released");
    expect(outcome.named).toEqual([source]);
  });

  it("holds a slug with -v in it to its own tags, never to a shorter slug's", () => {
    const repo = upstream();
    const source = "themes/nav-vibe/src/entry.ts";
    commit(repo, {
      "themes/nav/theme.json": themeManifest("acme/nav", "1.0.0"),
      "themes/nav-vibe/theme.json": themeManifest("acme/nav-vibe", "2.0.0"), [source]: "export const entry = 1;\n",
    });
    tag(repo, "nav-vibe-v2.0.0");
    commit(repo, { [source]: "export const entry = 2;\n" });
    const outcome = check(repo);
    expect(outcome.status, outcome.output).toBe(1);
    expect(outcome.output).toContain("no themes/nav version is released");
    expect(outcome.output).toMatch(/^::error::released-unchanged: themes\/nav-vibe 2\.0\.0 is released \(nav-vibe-v2\.0\.0\)/m);
    expect(outcome.named).toEqual([source]);
  });
});
