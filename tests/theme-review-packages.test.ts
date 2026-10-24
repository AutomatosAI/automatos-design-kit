// PRD-261 B-01i: the isolated review of a package whose theme bundles a kit workspace package. A kit laid out in the
// system temp folder, themes/hello/ beside packages/greet/: hello names @automatos/greet in its package.json and imports
// it by name. Built with the kit's preset as its author would and packed with the theme CLI, its package carries the
// package's src/ as source/packages/greet/src/, and the review rebuilds it beside the theme, byte for byte. A
// source/packages/ pack never writes, or a bundled file changed after the build, fails the rebuild.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { packTheme } from "@automatos/theme-cli";
import { readZip } from "@automatos/theme-cli/zip";
import { buildThemeFolder, compareDist, packageFolders, rebuildDist, type Files } from "../scripts/review/rebuild.ts";
import { reviewPackage } from "../scripts/review/review.ts";
import type { ProbeResult } from "../scripts/review/probe.ts";

const HELLO = fileURLToPath(new URL("../packages/theme-cli/test/fixtures/core/hello/", import.meta.url));
const HELLO_ENTRY = readFileSync(join(HELLO, "dist/entry.js"), "utf8");
const HELLO_CSS = ".hello-frame { min-height: 100vh; }\n";
const GREETING = "hello from a bundled package";
const GREET_FILES: Readonly<Record<string, string>> = {
  "package.json": `${JSON.stringify({ name: "@automatos/greet", version: "0.1.0", type: "module" })}\n`,
  "src/index.ts": "export const mark: string = '!'\n",
  "src/words.ts": `import { mark } from './index.ts'\n\nexport const greeting: string = '${GREETING}' + mark\n`,
};
const THEME_PACKAGE = { name: "@automatos/theme-hello", version: "1.0.0", private: true, type: "module", dependencies: { "@automatos/greet": "0.1.0" } };
const BUNDLED_SOURCE = ["source/packages/greet/src/index.ts", "source/packages/greet/src/words.ts"];
const TOOLS = { kitCommit: "test", node: process.version, vite: "test", preset: "test" };
const ISOLATED: ProbeResult = { isolated: true, lines: ["https://example.com/: failed (ENOTFOUND)"] };

const folders: string[] = [];

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
});

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), "automatos-review-packages-"));
  folders.push(folder);
  return folder;
}

function write(root: string, files: Readonly<Record<string, string>>): void {
  Object.entries(files).forEach(([path, text]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  });
}

/** hello in a temp kit, bundling @automatos/greet, built with the preset as its author builds it, then packed. */
async function packedTheme(): Promise<{ readonly zip: Buffer; readonly digest: string }> {
  const kit = tempFolder();
  const root = join(kit, "themes", "hello");
  ["theme.json", "README.md", "looks"].forEach((path) => cpSync(join(HELLO, path), join(root, path), { recursive: true }));
  const entry = `import './theme.css'\nimport { greeting } from '@automatos/greet/words'\nexport const bundledGreeting = greeting\n${HELLO_ENTRY}`;
  write(root, { "package.json": `${JSON.stringify(THEME_PACKAGE)}\n`, "src/entry.js": entry, "src/theme.css": HELLO_CSS });
  write(join(kit, "packages", "greet"), GREET_FILES);
  await buildThemeFolder(root, "src/entry.js");
  const result = packTheme(root, tempFolder());
  if (!result.ok) throw new Error(result.errors.map((error) => `${error.code} ${error.message}`).join("\n"));
  return { zip: readFileSync(result.file), digest: result.manifest.digest };
}

/** The package's files by path, as the review reads them. */
function filesOf(zip: Buffer): Map<string, Uint8Array> {
  return new Map(readZip(zip).map((entry): [string, Uint8Array] => [entry.path, entry.data]));
}

describe("a package whose theme bundles a kit workspace package", () => {
  it("carries the package's src/ under source/packages/, its code in dist/, and passes every check", async () => {
    const packed = await packedTheme();
    const files = filesOf(packed.zip);
    expect(Array.from(files.keys()).filter((path) => path.startsWith("source/packages/"))).toEqual(BUNDLED_SOURCE);
    expect(Buffer.from(files.get("dist/entry.js") ?? new Uint8Array()).toString("utf8")).toContain(GREETING);
    const report = await reviewPackage(packed.zip, packed.digest, { workDir: tempFolder(), tools: TOOLS, probe: async () => ISOLATED });
    expect(report.checks.filter((item) => item.status !== "pass").map(({ name, detail, items }) => ({ name, detail, items }))).toEqual([]);
    expect(report.outcome).toBe("pass");
  });

  it("rebuilds other bytes when a bundled source file is not what was built, and names dist/entry.js", async () => {
    const files: Map<string, Uint8Array> = filesOf((await packedTheme()).zip);
    const words = Buffer.from(files.get(BUNDLED_SOURCE[1]) ?? new Uint8Array()).toString("utf8");
    files.set(BUNDLED_SOURCE[1], new Uint8Array(Buffer.from(words.replace(GREETING, "a changed greeting"))));
    const rebuilt = await rebuildDist(files, tempFolder());
    if (!rebuilt.ok) throw new Error(rebuilt.error);
    expect(compareDist(files, rebuilt.dist).differing).toEqual(["dist/entry.js"]);
  });

  it("refuses a source/packages/ that holds anything but <package>/src/ folders of kit packages", async () => {
    const stray = ["source/packages/greet/README.md", "source/packages/notes.md", "source/packages/Up/src/a.ts"];
    const files: Files = new Map([["source/packages/greet/src/a.ts", new Uint8Array()], ...stray.map((path): [string, Uint8Array] => [path, new Uint8Array()])]);
    const laid = packageFolders(files);
    expect("error" in laid ? stray.filter((path) => !laid.error.includes(path)) : "laid out").toEqual([]);
    const withEntry = new Map([...files, ["source/entry.js", new Uint8Array()]]);
    expect(await rebuildDist(withEntry, tempFolder())).toMatchObject({ ok: false, error: expect.stringContaining("source/packages/") });
  });

  it("lays source/packages/<name>/src/ out as <name>/src/ of the packages folder, by name", () => {
    const files: Files = new Map([["source/packages/greet/src/words.ts", new Uint8Array([1])], ["source/entry.js", new Uint8Array([2])]]);
    const laid = packageFolders(files);
    if ("error" in laid) throw new Error(laid.error);
    expect({ paths: Array.from(laid.files.keys()), names: laid.names }).toEqual({ paths: ["greet/src/words.ts"], names: ["greet"] });
  });
});
