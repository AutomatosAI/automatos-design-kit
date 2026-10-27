// The kit's own contract: npm workspaces, exact pins, and a CI workflow that runs
// every workspace's scripts. These checks read files only; nothing is installed. The harness job's own checks
// are in tests/harness-ci.test.ts, to keep each file under the 400-line cap.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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
// PRD-261 C-06r (PB-4): a released theme version (Play's, HUD's) never changes. The check runs right after the npm
// pin (tests/kit-lockfile-workflow.test.ts holds the first run to the pin) and before the install.
const RELEASED_STEP = "Check released themes are unchanged";
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

  // The proof job runs on proof/ branches only; tests/proof.test.ts holds its shape.
  it("has the kit job, then the harness job (PRD-261 B-02f), then the proof job (PRD-261 B-06a)", () => {
    expect(jobNames(text)).toEqual(["kit", "harness", "proof"]);
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

  it("pins npm, checks released themes are unchanged, installs, then runs every root script", () => {
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

  // PRD-261 C-06r: the script lists origin's play-v* and hud-v* tags and fetches the matching one itself,
  // anonymously (tests/released-unchanged.test.ts runs it against git repositories).
  it("checks released themes are unchanged after a credential-free checkout, with Node alone and no secret or token", () => {
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
