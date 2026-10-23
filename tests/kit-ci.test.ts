// The kit's own contract: npm workspaces, exact pins, and a CI workflow that runs
// every workspace's scripts. These checks read files only; nothing is installed.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PACKED_FOLDERS, PACKED_TOP_FILES } from "../packages/theme-cli/src/collect.ts";
import { SOURCE_DIR } from "../packages/theme-cli/src/source.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PLAY_DIR = "themes/play";
const WORKSPACE_GLOBS = ["packages/*", "themes/*"];
const WORKFLOW = ".github/workflows/kit.yml";
const LOCKFILE = "package-lock.json";
const ROOT_SCRIPTS = ["build", "lint", "typecheck", "test", "pack"] as const;
const D2_DEV_DEPENDENCIES = ["typescript", "vitest", "vite", "postcss", "@types/react"];
// PRD-261 B-02a: the React test toolchain a theme's component tests run on (packages/theme-harness).
const TEST_DEV_DEPENDENCIES = [
  "jsdom",
  "react",
  "react-dom",
  "@testing-library/react",
  "@testing-library/dom",
  "@testing-library/user-event",
  "@testing-library/jest-dom",
];
// PRD-261 QB-13b (the maintainer's OK): Playwright at the version core's browser lane pins and axe for the
// harness shots (B-02f), and ESLint 9 for the kit's eslint plugin (B-03i), each pinned at this version.
const QB13B_DEV_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@playwright/test": "1.57.0",
  "@axe-core/playwright": "4.14.0",
  eslint: "9.39.5",
};
// Every outside package a manifest may name. A new one needs the maintainer's OK and its name here.
const APPROVED_DEPENDENCIES = [
  ...D2_DEV_DEPENDENCIES,
  "@types/node",
  ...TEST_DEV_DEPENDENCIES,
  ...Object.keys(QB13B_DEV_DEPENDENCIES),
];
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const TARBALL_URL = /^https:\/\/\S+\.tgz$/;
const PINNED_ACTION = /@[0-9a-f]{40}(?:\s+#.*)?$/;
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type PackageJson = {
  name?: string;
  private?: boolean;
  workspaces?: string[];
  engines?: Record<string, string>;
  scripts?: Record<string, string>;
} & Partial<Record<DependencyField, Record<string, string>>>;

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function readJson<T>(rel: string): T {
  return JSON.parse(readText(rel)) as T;
}

// Every package.json under packages/* and themes/*, as repo-relative paths.
function workspaceManifests(): string[] {
  return WORKSPACE_GLOBS.flatMap((glob) => {
    const parent = glob.slice(0, -2);
    if (!existsSync(join(ROOT, parent))) return [];
    return readdirSync(join(ROOT, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}/package.json`)
      .filter((rel) => existsSync(join(ROOT, rel)));
  }).sort();
}

// Files under a workspace, skipping installed and built output.
function workspaceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { encoding: "utf8", recursive: true })
    .map((rel) => rel.split("\\").join("/"))
    .filter((rel) => !/(^|\/)(node_modules|dist)(\/|$)/.test(rel));
}

function isPinned(name: string, spec: string, localNames: ReadonlySet<string>): boolean {
  if (localNames.has(name)) return spec === "*" || EXACT_VERSION.test(spec);
  return EXACT_VERSION.test(spec) || TARBALL_URL.test(spec);
}

// Dependencies whose spec is a range (or anything else npm could resolve differently later).
function loosePins(pkg: PackageJson, localNames: ReadonlySet<string>): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(pkg[field] ?? {})
      .filter(([name, spec]) => !isPinned(name, spec, localNames))
      .map(([name, spec]) => `${field}: ${name}@${spec}`),
  );
}

function localPackageNames(): Set<string> {
  const names = workspaceManifests().map((rel) => readJson<PackageJson>(rel).name);
  return new Set(names.filter((name): name is string => typeof name === "string"));
}

// The outside packages a manifest depends on, in any dependency field; workspace packages are left out.
function outsideDependencies(pkg: PackageJson, localNames: ReadonlySet<string>): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) => Object.keys(pkg[field] ?? {})).filter((name) => !localNames.has(name));
}

// npm 11.6.0+ fixes the edgesOut crash on optional peers (npm/cli#9787); CI pins it first.
const PIN_NPM = "npm install -g npm@11.21.1";
// PRD-261 C-06r (PB-4): a released Play version never changes. The check runs right after the npm pin
// (tests/kit-lockfile-workflow.test.ts holds the first run to the pin) and before the install.
const RELEASED_STEP = "Check a released Play is unchanged";
const RELEASED_SCRIPT = "scripts/release/released-unchanged.mjs";
const RELEASED_CHECK = `node ${RELEASED_SCRIPT}`;
/** Where the install runs: after the npm pin and the released-bytes check. */
const INSTALL_AT = 2;

// The jobs of the workflow, in file order: each key two spaces in under `jobs:`.
function jobNames(text: string): string[] {
  const jobs = text.slice(text.indexOf("\njobs:\n"));
  return Array.from(jobs.matchAll(/^ {2}([A-Za-z0-9_-]+):$/gm), (match) => match[1]);
}

// One job's lines, from its key to the next job's key (or the end of the file).
function jobBlock(text: string, job: string): string {
  const lines = text.split("\n");
  const start = lines.indexOf(`  ${job}:`);
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:$/.test(line));
  return lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

// The `uses:` lines of a block, as written.
function usesLines(text: string): string[] {
  return text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line)).map((line) => line.trim());
}

// The `run:` commands of the workflow, in file order.
function workflowRuns(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^\s*run:\s*(.+)$/.exec(line)?.[1]?.trim())
    .filter((run): run is string => typeof run === "string");
}

/** A step's lines, from its `- name:` line up to the next step's (empty when there is no such step). */
function stepLines(text: string, name: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf(`      - name: ${name}`);
  if (start < 0) return [];
  const next = lines.findIndex((line, index) => index > start && /^ {6}- name: /.test(line));
  return lines.slice(start, next < 0 ? lines.length : next);
}

describe("pin check helper", () => {
  const local = new Set(["@automatos/theme-sdk"]);

  it("accepts exact versions, tarball URLs and local workspace links", () => {
    const pkg: PackageJson = {
      dependencies: { a: "1.2.3", b: "https://cdn.example.com/b/1.0.0/b.tgz" },
      devDependencies: { c: "19.0.0-rc.1", "@automatos/theme-sdk": "*" },
    };
    expect(loosePins(pkg, local)).toEqual([]);
  });

  it("flags ranges, tags and a star on an outside package", () => {
    const pkg: PackageJson = {
      dependencies: { a: "^1.2.3", b: "latest" },
      devDependencies: { c: "~2.0.0", d: "*" },
      optionalDependencies: { e: ">=1.0.0" },
    };
    expect(loosePins(pkg, local)).toEqual([
      "dependencies: a@^1.2.3",
      "dependencies: b@latest",
      "devDependencies: c@~2.0.0",
      "devDependencies: d@*",
      "optionalDependencies: e@>=1.0.0",
    ]);
  });
});

describe("root package.json", () => {
  const pkg = readJson<PackageJson>("package.json");

  it("is a private npm workspaces root over packages/* and themes/*", () => {
    expect(pkg.private).toBe(true);
    expect(pkg.workspaces).toEqual(WORKSPACE_GLOBS);
    expect(pkg.engines?.node).toMatch(/^>=22\.\d+\.\d+$/);
  });

  it.each(ROOT_SCRIPTS)("script %s runs the same script in every workspace", (name) => {
    expect(pkg.scripts?.[name]).toContain(`npm run ${name} --workspaces --if-present`);
  });

  it("has the build tools approved for the kit", () => {
    const dev = pkg.devDependencies ?? {};
    expect(Object.keys(dev)).toEqual(expect.arrayContaining(D2_DEV_DEPENDENCIES));
    expect(dev["@types/react"]).toMatch(/^19\./);
  });

  it("pins the test toolchain exactly, with react-dom at react's version", () => {
    const dev = pkg.devDependencies ?? {};
    TEST_DEV_DEPENDENCIES.forEach((name) => expect(dev[name], name).toMatch(EXACT_VERSION));
    expect(dev["react-dom"]).toBe(dev.react);
  });

  it("pins the browser and lint toolchain at the versions QB-13b approved", () => {
    const dev = pkg.devDependencies ?? {};
    Object.entries(QB13B_DEV_DEPENDENCIES).forEach(([name, version]) => expect(dev[name], name).toBe(version));
  });
});

describe("every manifest pins its dependencies exactly", () => {
  const manifests = ["package.json", ...workspaceManifests()];
  const local = localPackageNames();

  it.each(manifests)("%s", (rel) => {
    expect(loosePins(readJson<PackageJson>(rel), local)).toEqual([]);
  });
});

describe("every manifest names only approved outside packages", () => {
  const manifests = ["package.json", ...workspaceManifests()];
  const local = localPackageNames();

  it("reads every dependency field and leaves workspace packages out", () => {
    const pkg: PackageJson = {
      dependencies: { a: "1.0.0", "@automatos/theme-sdk": "*" },
      devDependencies: { b: "1.0.0" },
      optionalDependencies: { c: "1.0.0" },
    };
    expect(outsideDependencies(pkg, new Set(["@automatos/theme-sdk"]))).toEqual(["a", "b", "c"]);
  });

  it.each(manifests)("%s", (rel) => {
    const unapproved = outsideDependencies(readJson<PackageJson>(rel), local)
      .filter((name) => !APPROVED_DEPENDENCIES.includes(name));
    expect(unapproved).toEqual([]);
  });
});

describe("workspaces expose what CI runs", () => {
  const manifests = workspaceManifests();

  it("workspace package names are unique", () => {
    const names = manifests.map((rel) => readJson<PackageJson>(rel).name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(manifests)("%s defines test/typecheck when it has tests/a tsconfig", (rel) => {
    const dir = rel.slice(0, -"/package.json".length);
    const files = workspaceFiles(dir);
    const scripts = readJson<PackageJson>(rel).scripts ?? {};
    if (files.some((file) => /\.test\.tsx?$/.test(file))) expect(scripts.test).toBeTruthy();
    if (files.includes("tsconfig.json")) expect(scripts.typecheck).toBeTruthy();
  });
});

describe("TypeScript configs", () => {
  it("the base config is strict and bundler-resolved", () => {
    const base = readJson<{ compilerOptions: Record<string, unknown> }>("tsconfig.base.json");
    expect(base.compilerOptions.strict).toBe(true);
    expect(base.compilerOptions.moduleResolution).toBe("Bundler");
    expect(base.compilerOptions.jsx).toBe("react-jsx");
  });

  it("the root config extends the base", () => {
    expect(readJson<{ extends?: string }>("tsconfig.json").extends).toBe("./tsconfig.base.json");
  });

  // A theme that extends the base must be able to typecheck the preset's .ts sources.
  it("the base config allows .ts import paths, without emitting", () => {
    const base = readJson<{ compilerOptions: Record<string, unknown> }>("tsconfig.base.json");
    expect(base.compilerOptions.allowImportingTsExtensions).toBe(true);
    expect(base.compilerOptions.noEmit).toBe(true);
    expect(base.compilerOptions.verbatimModuleSyntax).toBe(true);
  });

  const workspaceConfigs = workspaceManifests()
    .map((rel) => rel.replace(/package\.json$/, "tsconfig.json"))
    .filter((rel) => existsSync(join(ROOT, rel)));

  it.each(workspaceConfigs)("%s extends the base", (rel) => {
    expect(readJson<{ extends?: string }>(rel).extends).toBe("../../tsconfig.base.json");
  });
});

describe("kit workflow", () => {
  const text = readText(WORKFLOW);
  const runs = workflowRuns(jobBlock(text, "kit"));

  it("reads each job's own block", () => {
    const sample = ["jobs:", "  one:", "    steps:", "      - name: A", "        run: a", "", "  two:", "    steps:", "      - name: B", "        run: b"]
      .join("\n");
    expect(jobNames(`x\n${sample}`)).toEqual(["one", "two"]);
    expect(workflowRuns(jobBlock(sample, "one"))).toEqual(["a"]);
    expect(workflowRuns(jobBlock(sample, "two"))).toEqual(["b"]);
    expect(jobBlock(sample, "three")).toBe("");
  });

  it("has the kit job, then the harness job (PRD-261 B-02f)", () => {
    expect(jobNames(text)).toEqual(["kit", "harness"]);
  });

  it("runs on pull requests and on pushes to main, read-only", () => {
    expect(text).toMatch(/^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]$/m);
    expect(text).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  it("pins every action to a full commit SHA", () => {
    const uses = text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
  });

  it("pins npm, checks a released Play is unchanged, installs, then runs every root script", () => {
    const expected = ["npm run build", "npm run lint", "npm run typecheck", "npm test", "npm run pack"];
    expect(runs.slice(0, INSTALL_AT)).toEqual([PIN_NPM, RELEASED_CHECK]);
    expect(runs.slice(INSTALL_AT + 1)).toEqual(expected);
  });

  it("installs from the lockfile once it is committed, otherwise uploads the resolved one", () => {
    if (existsSync(join(ROOT, LOCKFILE))) {
      expect(runs[INSTALL_AT]).toBe("npm ci --no-audit --no-fund");
      return;
    }
    expect(runs[INSTALL_AT]).toBe("npm install --no-audit --no-fund");
    expect(text).toMatch(/name: kit-lockfile\n\s+path: package-lock\.json\n\s+if-no-files-found: error/);
  });

  // PRD-261 C-06r: the script lists origin's play-v* tags and fetches the matching one itself, anonymously
  // (tests/released-unchanged.test.ts runs it against git repositories).
  it("checks a released Play is unchanged after a credential-free checkout, with Node alone and no secret or token", () => {
    const step = stepLines(text, RELEASED_STEP);
    const lines = text.split("\n");
    const checkout = lines.findIndex((line) => /^\s*uses: actions\/checkout@/.test(line));
    expect(step.filter((line) => /^\s*run:/.test(line)).map((line) => line.trim())).toEqual([`run: ${RELEASED_CHECK}`]);
    expect(step.filter((line) => /^\s*(?:env|with|uses|shell):/.test(line))).toEqual([]);
    expect(checkout).toBeGreaterThanOrEqual(0);
    expect(lines.indexOf(`      - name: ${RELEASED_STEP}`)).toBeGreaterThan(checkout);
    expect(lines.slice(checkout, checkout + 3).join("\n")).toMatch(/\n\s+with:\n\s+persist-credentials: false$/);
    expect(text).not.toMatch(/\bsecrets\.|GITHUB_TOKEN|github\.token/);
    expect(existsSync(join(ROOT, RELEASED_SCRIPT))).toBe(true);
  });
});

// PRD-261 B-02f: the harness job installs and builds as the kit job does, installs the two browsers the shots run
// on, runs `automatos-theme shots` over Play and uploads its PNGs and axe.json files as kit-harness.
const SHOTS_OUT = "packages/theme-harness/dist/shots";
const SHOTS_CONFIG = "packages/theme-harness/shots/playwright.config.ts";
const escapedPath = (path: string): string => path.replace(/[/.]/g, (char) => `\\${char}`);

describe("kit workflow, harness job (PRD-261 B-02f)", () => {
  const text = readText(WORKFLOW);
  const kit = jobBlock(text, "kit");
  const harness = jobBlock(text, "harness");

  it("installs and builds as the kit job does, then installs Chromium and WebKit and runs the shots over Play", () => {
    expect(workflowRuns(harness)).toEqual([
      PIN_NPM,
      workflowRuns(kit)[INSTALL_AT],
      "npm run build",
      "npx playwright install --with-deps chromium webkit",
      `npx automatos-theme shots themes/play --out ${SHOTS_OUT}`,
    ]);
  });

  it("uses only the actions the kit job uses, at the same pins, with no checkout credentials and the same Node", () => {
    const kitUses = usesLines(kit);
    expect(usesLines(harness).length).toBeGreaterThan(0);
    expect(usesLines(harness).filter((line) => !kitUses.includes(line))).toEqual([]);
    expect(harness).toMatch(/actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+persist-credentials: false/);
    expect(/node-version: "(\d+)"/.exec(harness)?.[1]).toBe(/node-version: "(\d+)"/.exec(kit)?.[1]);
  });

  it("uploads the shots as kit-harness whatever they did, and fails when there are none", () => {
    const upload = new RegExp(
      `- name: Upload shots\\n\\s+if: always\\(\\)\\n\\s+uses: actions/upload-artifact@[0-9a-f]{40}[^\\n]*\\n` +
        `\\s+with:\\n\\s+name: kit-harness\\n\\s+path: ${escapedPath(SHOTS_OUT)}/\\n\\s+if-no-files-found: error`,
    );
    expect(harness).toMatch(upload);
  });

  it("shoots on Chromium and WebKit, with no retry", () => {
    const config = readText(SHOTS_CONFIG);
    expect(Array.from(config.matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).toEqual(["chromium", "webkit"]);
    expect(config).toMatch(/^\s+retries: 0,$/m);
  });
});

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

describe("AGENTS.md", () => {
  it("points at PRD-261 and states the workspace script contract", () => {
    const text = readText("AGENTS.md");
    expect(text).toContain("PRD-261");
    ROOT_SCRIPTS.forEach((name) => expect(text).toContain(`\`${name}\``));
  });

  it("says either required reviewer of theme-signing may approve, with Prevent self-review off for now", () => {
    const text = readText("AGENTS.md").replace(/\s+/g, " ");
    expect(text).toContain("either one may approve");
    expect(text).toContain('"Prevent self-review" is off for now');
    expect(text).not.toMatch(/self-review prevented|second signer|two signers/i);
  });
});
