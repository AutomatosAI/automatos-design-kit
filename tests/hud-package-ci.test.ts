// HUD's package in kit CI, as tests/play-package-ci.test.ts holds Play's: HUD's build is the preset's alone (its look
// data, boot/ and looks/, is committed, not generated), its pack checks the design first and writes the package to
// out/, which git ignores and CI uploads with every other package; and released-unchanged.mjs guards everything the
// pack collects for HUD, the committed boot/ and looks/ among it, once hud-v<version> is tagged; it checks every folder
// under themes/, each by its own tag. These checks read files and ask git only; nothing is installed.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundledPackages } from "@automatos/vite-preset";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { PACKAGE_EXTENSION, packageBaseName } from "../packages/theme-cli/src/pack.ts";
import { SOURCE_DIR } from "../packages/theme-cli/src/source.ts";
import { packedPathsOf, tagPrefixOf, themeFolders } from "../scripts/release/themes.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HUD_DIR = "themes/hud";
const WORKFLOW = ".github/workflows/kit.yml";
/** The folders HUD commits that its pack collects (collect.ts PACKED_FOLDERS less the built dist/). */
const HUD_COMMITTED_FOLDERS = ["assets", "boot", "looks"];
/** A file in each folder HUD commits, and one in its pack's out/, which git must ignore. */
const HUD_TRACKED_FILES = ["themes/hud/boot/prepaint.json", "themes/hud/looks/schema.json", "themes/hud/looks/presets/arc.look.json"];
const HUD_PACK_OUTPUT = "themes/hud/out/automatos.hud-1.0.0.autotheme";

type PackageJson = { scripts?: Record<string, string> };
type Manifest = { id: string; version: string };

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readJson<T>(rel: string): T {
  return JSON.parse(readText(rel)) as T;
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

// The paths git ignores, of those given, in their order (git check-ignore exits 1 when it ignores none).
function ignoredPaths(paths: readonly string[]): string[] {
  const run = spawnSync("git", ["check-ignore", ...paths], { cwd: ROOT, encoding: "utf8" });
  if (run.status !== 0 && run.status !== 1) throw new Error(`git check-ignore failed (${String(run.status)}): ${run.stderr}`);
  return run.stdout.split("\n").filter(Boolean);
}

describe("HUD's package in CI", () => {
  const hud = readJson<PackageJson>(`${HUD_DIR}/package.json`);
  const manifest = readJson<Manifest>(`${HUD_DIR}/theme.json`);

  it("builds with the preset alone, then checks its design and packs into out/", () => {
    expect(hud.scripts?.build).toBe("vite build");
    expect(hud.scripts?.pack).toBe("automatos-theme check design . && automatos-theme pack . --out out");
  });

  it("keeps the pack output out of git and its committed look data in it (git check-ignore)", () => {
    expect(readText(`${HUD_DIR}/.gitignore`).split("\n").map((line) => line.trim())).toContain("/out/");
    expect(trackedFiles()).toEqual(expect.arrayContaining(HUD_TRACKED_FILES));
    expect(ignoredPaths(HUD_TRACKED_FILES)).toEqual([]);
    expect(ignoredPaths([HUD_PACK_OUTPUT])).toEqual([HUD_PACK_OUTPUT]);
  });

  it("writes the package kit.yml's upload takes: a *.autotheme file outside node_modules, named by its id", () => {
    const file = `${HUD_DIR}/out/${packageBaseName(manifest.id, manifest.version)}${PACKAGE_EXTENSION}`;
    expect(file).toBe(`${HUD_DIR}/out/automatos.hud-${manifest.version}.autotheme`);
    expect(file.split("/")).not.toContain("node_modules");
    expect(readText(WORKFLOW)).toMatch(
      /name: kit-themes\n\s+path: \|\n\s+\*\*\/\*\.autotheme\*\n\s+!\*\*\/node_modules\/\*\*\n\s+if-no-files-found: error/,
    );
  });
});

describe("released-unchanged.mjs guards everything pack collects for HUD", () => {
  const packedPaths = packedPathsOf(ROOT, "hud");
  const committedFolders = PACKED_FOLDERS.filter((name) => trackedFiles().some((rel) => rel.startsWith(`${HUD_DIR}/${name}/`)));

  it("guards every top file and committed folder collect.ts names, boot/ and looks/ among them, and src/", () => {
    expect([...committedFolders].sort()).toEqual(HUD_COMMITTED_FOLDERS);
    [...PACKED_TOP_FILES, ...committedFolders, SOURCE_DIR].forEach((name) => expect(packedPaths).toContain(`${HUD_DIR}/${name}`));
  });

  it("guards the src/ of each kit package HUD bundles, which pack writes under source/packages/ (B-01i)", () => {
    const root = realpathSync(ROOT);
    const bundled = bundledPackages(join(root, HUD_DIR)).map((item) => relative(root, join(item.dir, SOURCE_DIR)).split(sep).join("/"));
    expect(bundled).toEqual(["packages/look-kit/src", "packages/mascot/src"]);
    expect(packedPaths.filter((path) => path.startsWith("packages/"))).toEqual(bundled);
  });

  it("checks every theme folder of the kit, each by its own <slug>-v tag", () => {
    const themes = trackedFiles().filter((rel) => /^themes\/[^/]+\/theme\.json$/.test(rel)).map((rel) => rel.split("/")[1]).sort();
    expect(themeFolders(ROOT)).toEqual(themes);
    expect(themes).toEqual(expect.arrayContaining(["hud", "play"]));
    themes.forEach((theme) => expect(tagPrefixOf(theme)).toBe(`${theme}-v`));
  });
});
