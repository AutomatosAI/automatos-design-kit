// PRD-261 A-16c, E4a, B-05a and C-06r: Play's package in kit CI. Play's build writes its look data, its pack
// writes the package to out/ and CI uploads it; the build fetches nothing (Auto's clips are committed); the
// generated folders stay out of git; and released-unchanged.mjs guards everything the pack collects. These
// checks read files and ask git only; nothing is installed. (Moved out of tests/kit-ci.test.ts, which holds
// the kit's own contract, to keep each file under the 400-line cap.)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { SOURCE_DIR } from "../packages/theme-cli/src/source.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PLAY_DIR = "themes/play";
const WORKFLOW = ".github/workflows/kit.yml";
const RELEASED_SCRIPT = "scripts/release/released-unchanged.mjs";

/** The one field of Play's package.json these checks read. */
type PackageJson = { scripts?: Record<string, string> };

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readJson<T>(rel: string): T {
  return JSON.parse(readText(rel)) as T;
}

// The words the dropped mascot fetch left behind, and the folders allowed to name them (its tests).
const FETCH_WORDS = ["raw.githubusercontent.com", "fetch-mascot", "mascot.lock"];
const FETCH_WORD_FOLDERS = ["tests/", "themes/play/test/"];
const ASSET_NOTICE = "(c) Automatos AI; not covered by the code licence.";

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

// .gitignore's patterns: trimmed, without blank lines and comments.
function ignorePatterns(): string[] {
  return readText(".gitignore").split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

// PRD-261 B-05a: the folders Play's build and pack write, ignored at Play's own root only (themes/play/.gitignore).
const PLAY_BUILD_OUTPUT = ["out", "looks", "boot"];
// A file in each of them, matched by its folder's line alone (no other ignore rule names it).
const PLAY_BUILD_FILES = ["themes/play/out/summary.json", "themes/play/looks/ember.json", "themes/play/boot/prepaint.json"];
// Play's own files in folders of the same names, which git must track.
const PLAY_NAMESAKE_FILES = [
  "themes/play/test/looks/x.test.tsx",
  "themes/play/src/components/looks/x.tsx",
  "themes/play/src/lib/looks/x.ts",
];

// The forms of a folder's ignore line that match a folder of that name at any depth.
function unanchoredForms(folder: string): string[] {
  return [folder, `${folder}/`, `**/${folder}`, `**/${folder}/`];
}

// The paths git ignores, of those given, in their order (git check-ignore exits 1 when it ignores none).
function ignoredPaths(paths: readonly string[]): string[] {
  const run = spawnSync("git", ["check-ignore", ...paths], { cwd: ROOT, encoding: "utf8" });
  if (run.status !== 0 && run.status !== 1) throw new Error(`git check-ignore failed (${String(run.status)}): ${run.stderr}`);
  return run.stdout.split("\n").filter(Boolean);
}

// PRD-261 A-16c: Play's build writes its look data first, its pack writes the package to out/,
// and CI uploads every package the pack steps wrote.
describe("Play's package in CI", () => {
  const play = readJson<PackageJson>("themes/play/package.json");

  it("builds its look data (scripts/compile-looks.mjs) before the bundle, then packs into out/", () => {
    expect(play.scripts?.build).toBe("node ../../scripts/compile-looks.mjs . && vite build");
    expect(play.scripts?.pack).toBe("automatos-theme pack . --out out");
    expect(existsSync(join(ROOT, "scripts/compile-looks.mjs"))).toBe(true);
  });

  // PRD-261 E4a: Auto's clips are committed (themes/play/assets/mascot, held to their checksums by Play's
  // assets test), so the build fetches nothing and the lock it read is gone.
  it("fetches nothing: the mascot fetch and its lock are gone, and no tracked file outside the tests names them", () => {
    expect(existsSync(join(ROOT, "scripts/fetch-mascot.mjs"))).toBe(false);
    expect(existsSync(join(ROOT, "themes/play/mascot.lock.json"))).toBe(false);
    const checked = trackedFiles().filter((rel) => !FETCH_WORD_FOLDERS.some((folder) => rel.startsWith(folder)));
    expect(checked.length).toBeGreaterThan(0);
    const naming = checked.filter((rel) => existsSync(join(ROOT, rel)))
      .flatMap((rel) => {
        const bytes = readFileSync(join(ROOT, rel));
        return FETCH_WORDS.filter((word) => bytes.includes(word)).map((word) => `${rel}: ${word}`);
      });
    expect(naming).toEqual([]);
  });

  it("tracks the committed clips, and still ignores the generation pipeline and the pilot's served copy", () => {
    const patterns = ignorePatterns();
    expect(patterns).not.toContain("themes/*/assets/mascot/");
    expect(patterns).not.toContain("mascot/");
    expect(patterns).toEqual(expect.arrayContaining(["/mascot/", "public/auto/"]));
  });

  it("gives the clips their own notice, outside the code licence", () => {
    const notice = readText("NOTICE");
    expect(notice).toContain(ASSET_NOTICE);
    expect(notice).toContain("themes/play/assets/mascot/");
    expect(notice).toContain("/mascot/");
  });

  // PRD-261 B-05a: anchored to Play's folder, so src/**/looks/ and test/looks/ (Play's look tests) stay tracked.
  it("keeps the generated look data and the pack output out of git, anchored to Play's folder", () => {
    const ignored = readText("themes/play/.gitignore").split("\n").map((line) => line.trim());
    expect(ignored).toEqual(expect.arrayContaining(PLAY_BUILD_OUTPUT.map((folder) => `/${folder}/`)));
    const unanchored = ignored.filter((line) => PLAY_BUILD_OUTPUT.some((folder) => unanchoredForms(folder).includes(line)));
    expect(unanchored).toEqual([]);
  });

  it("ignores Play's build output, and none of Play's files in folders of the same names (git check-ignore)", () => {
    expect(ignoredPaths(PLAY_NAMESAKE_FILES)).toEqual([]);
    expect(ignoredPaths(PLAY_BUILD_FILES)).toEqual(PLAY_BUILD_FILES);
  });

  it("uploads every package the pack steps wrote, and fails when there is none", () => {
    expect(readText(WORKFLOW)).toMatch(
      /name: kit-themes\n\s+path: \|\n\s+\*\*\/\*\.autotheme\*\n\s+!\*\*\/node_modules\/\*\*\n\s+if-no-files-found: error/,
    );
  });
});

// PRD-261 C-06r (PB-4): released-unchanged.mjs keeps its own PACKED_PATHS (plain Node, no TypeScript
// loader to read collect.ts/source.ts at run time); read back here as text, it must stay a superset of
// what pack actually collects for Play, so the two guarded sets can't silently drift apart. A folder
// collect.ts packs but Play never commits (dist/, boot/, looks/: generated from src/, gitignored) needs
// no path of its own, until the day one of them is tracked.
function releasedUnchangedPackedPaths(): string[] {
  const match = /PACKED_PATHS\s*=\s*\[([^\]]*)\]/.exec(readText(RELEASED_SCRIPT));
  if (match === null) throw new Error(`can't find PACKED_PATHS in ${RELEASED_SCRIPT}`);
  return [...match[1].matchAll(/'([^']*)'/g)].map(([, path]) => path);
}

describe("released-unchanged.mjs guards everything pack collects for Play", () => {
  const packedPaths = releasedUnchangedPackedPaths();
  const committedFolders = PACKED_FOLDERS.filter((name) =>
    trackedFiles().some((rel) => rel.startsWith(`${PLAY_DIR}/${name}/`)));

  it("guards every top file and committed folder collect.ts names, and src/ (source.ts)", () => {
    expect(PACKED_TOP_FILES.length).toBeGreaterThan(0);
    expect(committedFolders).toContain("assets");
    [...PACKED_TOP_FILES, ...committedFolders, SOURCE_DIR].forEach((name) => expect(packedPaths).toContain(`${PLAY_DIR}/${name}`));
  });
});
