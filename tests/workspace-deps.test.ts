// Every workspace names, in its package.json, each of the kit's own packages its code loads, so the dependency is
// in the lockfile and not only in the hoisted workspace links (theme-cli's shots load the harness, and the harness
// loads theme-cli's manifest check and the vite-preset). It reads each workspace's code: its src/, app/ and shots/
// folders and its top-level scripts and configs, not its tests or fixtures, which quote other packages' imports as
// data. A load is an import or export from, an import() or a require(.resolve) naming the package.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKSPACE_PARENTS = ["packages", "themes"];
const CODE_DIRS = ["src", "app", "shots"];
const SKIPPED_DIRS = /(^|\/)(node_modules|dist)(\/|$)/;
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const DECLARING_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
const KIT_PACKAGE = "@automatos/[a-z0-9-]+";
const LOADS: readonly RegExp[] = [
  new RegExp(`\\bfrom\\s*['"](${KIT_PACKAGE})`, "g"),
  new RegExp(`\\bimport\\s*\\(\\s*['"](${KIT_PACKAGE})`, "g"),
  new RegExp(`\\bimport\\s*['"](${KIT_PACKAGE})`, "g"),
  new RegExp(`\\brequire(?:\\.resolve)?\\s*\\(\\s*['"\`](${KIT_PACKAGE})`, "g"),
];

type Manifest = { name?: string } & Partial<Record<(typeof DECLARING_FIELDS)[number], Record<string, string>>>;

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8")) as T;
}

/** Every workspace folder (packages/* and themes/* with a package.json), repo-relative. */
function workspaceDirs(): string[] {
  return WORKSPACE_PARENTS.flatMap((parent) =>
    readdirSync(join(ROOT, parent), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, parent, entry.name, "package.json")))
      .map((entry) => `${parent}/${entry.name}`),
  ).sort();
}

/** A workspace's code files: its top-level ones and those under its code folders, repo-relative. */
function codeFiles(dir: string): string[] {
  const top = readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && CODE_FILE.test(entry.name))
    .map((entry) => `${dir}/${entry.name}`);
  const nested = CODE_DIRS.filter((name) => existsSync(join(ROOT, dir, name))).flatMap((name) =>
    readdirSync(join(ROOT, dir, name), { encoding: "utf8", recursive: true })
      .map((rel) => `${name}/${rel.split("\\").join("/")}`)
      .filter((rel) => CODE_FILE.test(rel) && !SKIPPED_DIRS.test(rel))
      .map((rel) => `${dir}/${rel}`),
  );
  return [...top, ...nested];
}

/** The kit packages a text loads, by name. */
function loadedKitPackages(text: string): string[] {
  const names = LOADS.flatMap((pattern) => Array.from(text.matchAll(pattern), (match) => match[1] ?? ""));
  return Array.from(new Set(names)).sort();
}

function declared(manifest: Manifest): Set<string> {
  return new Set(DECLARING_FIELDS.flatMap((field) => Object.keys(manifest[field] ?? {})));
}

describe("the load reader", () => {
  it("names a package loaded by import, export, import() and require.resolve, and nothing quoted as plain text", () => {
    const text = [
      "import { a } from '@automatos/one'",
      "import type { B } from \"@automatos/two/sub\"",
      "export { c } from '@automatos/three'",
      "import '@automatos/four'",
      "type S = typeof import('@automatos/five')",
      "const dir = require.resolve('@automatos/six/package.json')",
      "const SHARED = ['@automatos/seven']",
    ].join("\n");
    expect(loadedKitPackages(text)).toEqual(
      ["one", "two", "three", "four", "five", "six"].map((name) => `@automatos/${name}`).sort(),
    );
  });
});

describe("each workspace declares the kit packages its code loads", () => {
  const dirs = workspaceDirs();
  const kitNames = new Set(dirs.map((dir) => readJson<Manifest>(`${dir}/package.json`).name ?? ""));

  it("found the workspaces", () => {
    expect(dirs).toContain("packages/theme-harness");
  });

  it.each(dirs)("%s", (dir) => {
    const manifest = readJson<Manifest>(`${dir}/package.json`);
    const names = declared(manifest);
    const loaded = codeFiles(dir).flatMap((rel) => loadedKitPackages(readFileSync(join(ROOT, rel), "utf8")));
    const undeclared = Array.from(new Set(loaded))
      .filter((name) => kitNames.has(name) && name !== manifest.name && !names.has(name))
      .sort();
    expect(undeclared).toEqual([]);
  });
});
