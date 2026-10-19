// The kit's own contract: npm workspaces, exact pins, and a CI workflow that runs
// every workspace's scripts. These checks read files only; nothing is installed.
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

// npm 11.6.0+ fixes the edgesOut crash on optional peers (npm/cli#9787); CI pins it first.
const PIN_NPM = "npm install -g npm@11.21.1";

// The `run:` commands of the workflow, in file order.
function workflowRuns(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^\s*run:\s*(.+)$/.exec(line)?.[1]?.trim())
    .filter((run): run is string => typeof run === "string");
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
});

describe("every manifest pins its dependencies exactly", () => {
  const manifests = ["package.json", ...workspaceManifests()];
  const local = localPackageNames();

  it.each(manifests)("%s", (rel) => {
    expect(loosePins(readJson<PackageJson>(rel), local)).toEqual([]);
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
  const runs = workflowRuns(text);

  it("runs on pull requests and on pushes to main, read-only", () => {
    expect(text).toMatch(/^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]$/m);
    expect(text).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  it("pins every action to a full commit SHA", () => {
    const uses = text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((line) => !PINNED_ACTION.test(line))).toEqual([]);
  });

  it("pins npm, installs, then runs every root script", () => {
    const expected = ["npm run build", "npm run lint", "npm run typecheck", "npm test", "npm run pack"];
    expect(runs[0]).toBe(PIN_NPM);
    expect(runs.slice(2)).toEqual(expected);
  });

  it("installs from the lockfile once it is committed, otherwise uploads the resolved one", () => {
    if (existsSync(join(ROOT, LOCKFILE))) {
      expect(runs[1]).toBe("npm ci --no-audit --no-fund");
      return;
    }
    expect(runs[1]).toBe("npm install --no-audit --no-fund");
    expect(text).toMatch(/name: kit-lockfile\n\s+path: package-lock\.json\n\s+if-no-files-found: error/);
  });
});

describe("AGENTS.md", () => {
  it("points at PRD-261 and states the workspace script contract", () => {
    const text = readText("AGENTS.md");
    expect(text).toContain("PRD-261");
    ROOT_SCRIPTS.forEach((name) => expect(text).toContain(`\`${name}\``));
  });
});
