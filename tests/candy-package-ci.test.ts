// Candy's package in kit CI, as tests/arcade-package-ci.test.ts holds Arcade's: Candy's build is the preset's alone (its
// look data, boot/ and looks/, is committed, not generated, held to its catalogue by its own tests, CANDY_WRITE=1),
// its pack checks the design first and writes the package to out/, which git ignores and CI uploads with every other
// package; and released-unchanged.mjs guards everything the pack collects for Candy, the committed boot/ and looks/
// among it, once candy-v<version> is tagged; it checks every folder under themes/, each by its own tag. Like Arcade,
// and unlike Play and HUD, Candy bundles @automatos/mascot alone, not @automatos/look-kit.
import { readFileSync, realpathSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundledPackages } from "@automatos/vite-preset";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { PACKAGE_EXTENSION, packageBaseName } from "../packages/theme-cli/src/pack.ts";
import { SOURCE_DIR } from "../packages/theme-cli/src/source.ts";
import { packedPathsOf, parseTag, tagPrefixOf, themeFolders } from "../scripts/release/themes.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CANDY_DIR = "themes/candy";
const WORKFLOW = ".github/workflows/kit.yml";
/** The folders Candy commits that its pack collects (collect.ts PACKED_FOLDERS less the built dist/). */
const CANDY_COMMITTED_FOLDERS = ["assets", "boot", "looks"];

type PackageJson = { scripts?: Record<string, string> };
type Manifest = { id: string; version: string };

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

function readJson<T>(rel: string): T {
  return JSON.parse(readText(rel)) as T;
}

// The paths git ignores, of those given, in their order (git check-ignore exits 1 when it ignores none).
function ignoredPaths(paths: readonly string[]): string[] {
  const run = spawnSync("git", ["check-ignore", ...paths], { cwd: ROOT, encoding: "utf8" });
  if (run.status !== 0 && run.status !== 1) throw new Error(`git check-ignore failed (${String(run.status)}): ${run.stderr}`);
  return run.stdout.split("\n").filter(Boolean);
}

describe("Candy's package in CI", () => {
  const candy = readJson<PackageJson>(`${CANDY_DIR}/package.json`);
  const manifest = readJson<Manifest>(`${CANDY_DIR}/theme.json`);

  it("builds with the preset alone, then checks its design and packs into out/", () => {
    expect(candy.scripts?.build).toBe("vite build");
    expect(candy.scripts?.pack).toBe("automatos-theme check design . && automatos-theme pack . --out out");
  });

  it("keeps the pack output out of git and its committed look data in it (git check-ignore)", () => {
    expect(readText(`${CANDY_DIR}/.gitignore`).split("\n").map((line) => line.trim())).toContain("/out/");
    const output = `${CANDY_DIR}/out/automatos.candy-${manifest.version}.autotheme`;
    const committed = ["boot/prepaint.json", "looks/schema.json", "design/contrast.json", "assets/mascot/idle.png"];
    expect(ignoredPaths(committed.map((path) => `${CANDY_DIR}/${path}`))).toEqual([]);
    expect(ignoredPaths([output])).toEqual([output]);
  });

  it("writes the package kit.yml's upload takes: a *.autotheme file outside node_modules, named by its id", () => {
    const file = `${CANDY_DIR}/out/${packageBaseName(manifest.id, manifest.version)}${PACKAGE_EXTENSION}`;
    expect(file).toBe(`${CANDY_DIR}/out/automatos.candy-${manifest.version}.autotheme`);
    expect(file.split("/")).not.toContain("node_modules");
    expect(readText(WORKFLOW)).toMatch(
      /name: kit-themes\n\s+path: \|\n\s+\*\*\/\*\.autotheme\*\n\s+!\*\*\/node_modules\/\*\*\n\s+if-no-files-found: error/,
    );
  });
});

describe("released-unchanged.mjs guards everything pack collects for Candy", () => {
  const packedPaths = packedPathsOf(ROOT, "candy");
  const committedFolders = PACKED_FOLDERS.filter((name) => trackedFiles().some((rel) => rel.startsWith(`${CANDY_DIR}/${name}/`)));

  it("guards every top file and committed folder collect.ts names, boot/ and looks/ among them, and src/", () => {
    expect([...committedFolders].sort()).toEqual(CANDY_COMMITTED_FOLDERS);
    [...PACKED_TOP_FILES, ...committedFolders, SOURCE_DIR].forEach((name) => expect(packedPaths).toContain(`${CANDY_DIR}/${name}`));
  });

  it("guards mascot's src/ alone (Candy bundles no look-kit), which pack writes under source/packages/ (B-01i)", () => {
    const root = realpathSync(ROOT);
    const bundled = bundledPackages(join(root, CANDY_DIR)).map((item) => relative(root, join(item.dir, SOURCE_DIR)).split(sep).join("/"));
    expect(bundled).toEqual(["packages/mascot/src"]);
    expect(packedPaths.filter((path) => path.startsWith("packages/"))).toEqual(bundled);
    expect(packedPaths).not.toContain("packages/look-kit/src");
  });

  it("is a folder the script checks, by its own candy-v tag, which the tag rule admits", () => {
    expect(themeFolders(ROOT)).toContain("candy");
    expect(tagPrefixOf("candy")).toBe("candy-v");
    expect(parseTag("candy-v1.0.0")).toEqual({ slug: "candy", version: "1.0.0" });
  });
});
