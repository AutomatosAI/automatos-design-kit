// PRD-261 B-02j: the axe part of the review's "Previews and accessibility" section, which theme-review.yml runs after
// the review has passed, outside its no-network container (scripts/review/axe.ts). A seeded package is laid out for
// the browser harness (axe-layout.ts) with the kit library it bundles beside it, and a real harness build bundles the
// package's own copy of that library. The pass (axe-pass.ts) runs here with made-up shots that write axe.json files as
// `automatos-theme shots` does: what axe found is counted by impact and rule, selectors never printed, and a failed
// shots run is reported, not raised. The command exits 0 whatever happens. No browser runs here.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { readZip } from "@automatos/theme-cli/zip";
import { harnessConfig } from "../packages/theme-harness/vite.harness.config.ts";
import { AXE_PACKAGES_DIR, AXE_THEME_DIR, HARNESS_ENTRY, layOutPackage, packageExports } from "../scripts/review/axe-layout.ts";
import { axePass, SHOTS_DIR, type Shots } from "../scripts/review/axe-pass.ts";
import { axeJobSummary, axeText, readScanSets, summarize } from "../scripts/review/axe-report.ts";
import {
  HELLO_CSS, HELLO_ENTRY, packSeeded, removeSeededFolders, tempFolder, writeFiles, type Seeded,
} from "./support/seeded-package.ts";
import { ROOT } from "./support/workflow-steps.ts";

const GREETING = "hello from the bundled copy of greet";
const GREET_FILES = {
  "package.json": `${JSON.stringify({ name: "@automatos/greet", version: "0.1.0", type: "module", kitLibrary: true })}\n`,
  "src/index.ts": "export const mark: string = '!'\n",
  "src/words.ts": `import { mark } from './index.ts'\n\nexport const greeting: string = '${GREETING}' + mark\n`,
};
const THEME_PACKAGE = { name: "@automatos/theme-hello", version: "1.0.0", private: true, type: "module", dependencies: { "@automatos/greet": "0.1.0" } };
const ENTRY = `import './theme.css'\nimport { greeting } from '@automatos/greet/words'\nexport const bundledGreeting = greeting\n${HELLO_ENTRY}`;
/** A selector from the package's own page, which the text must never print. */
const SELECTOR = "#from-the-package";
const AXE_SCRIPT = "scripts/review/axe.ts";
/** A real harness build (React and the fake SDK with it) on a cold CI runner. */
const BUILD_TIMEOUT_MS = 120_000;

afterEach(() => {
  removeSeededFolders();
});

/** The hello theme with a TypeScript entry that bundles @automatos/greet, packed. */
function greetingTheme(entry = "src/entry.ts"): Promise<Seeded> {
  const files = { "package.json": `${JSON.stringify(THEME_PACKAGE)}\n`, [entry]: ENTRY, "src/theme.css": HELLO_CSS };
  return packSeeded({ files, entry, packages: { greet: GREET_FILES } });
}

const filesOf = (zip: Buffer): Map<string, Uint8Array> => new Map(readZip(zip).map((entry): [string, Uint8Array] => [entry.path, entry.data]));

function violation(id: string, impact: string, targets: number): object {
  return { id, impact, help: `${id} help`, helpUrl: "https://example.com/rule", targets: Array(targets).fill(SELECTOR) };
}

/** Made-up shots: an axe.json per set as the harness writes them, a trace's stray one, and the exit code given. */
function madeUpShots(code: number): Shots {
  return (_themeDir, outDir) => {
    writeFiles(outDir, {
      "chromium/default/1440/axe.json": JSON.stringify({ scans: [
        { shot: "page-chat.png", violations: [violation("color-contrast", "serious", 2), violation("region", "minor", 1)], passes: 9, incomplete: 0 },
        { shot: "slot-frame-1.png", violations: [], passes: 9, incomplete: 0 },
      ] }),
      "webkit/default/1440/axe.json": JSON.stringify({ scans: [{ shot: "page-chat.png", violations: [violation("color-contrast", "serious", 1)] }] }),
      "test-results/trace/axe.json": JSON.stringify({ scans: [{ shot: "x.png", violations: [violation("ignored", "critical", 1)] }] }),
    });
    return code;
  };
}

describe("the package laid out for the harness", () => {
  it("names each module of a bundled library as the preset resolves it, src/index as the package itself", () => {
    expect(packageExports(["words.js", "words.ts", "index.ts", "button.tsx", "style.css", "deep/part.ts"])).toEqual({
      ".": "./src/index.ts", "./button": "./src/button.tsx", "./deep/part": "./src/deep/part.ts", "./index": "./src/index.ts",
      "./words": "./src/words.ts",
    });
  });

  it("lays the theme out from source/ and links the package's own copy of each library it bundles", async () => {
    const files = filesOf((await greetingTheme()).zip);
    const work = tempFolder();
    const layout = layOutPackage(files, work);
    expect(layout).toEqual({ ok: true, themeDir: join(work, AXE_THEME_DIR) });
    const themeDir = join(work, AXE_THEME_DIR);
    expect(readFileSync(join(themeDir, HARNESS_ENTRY), "utf8")).toBe(ENTRY);
    expect(existsSync(join(themeDir, "dist"))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(work, AXE_PACKAGES_DIR, "greet", "package.json"), "utf8")) as { exports: unknown };
    expect(manifest.exports).toEqual({ ".": "./src/index.ts", "./index": "./src/index.ts", "./words": "./src/words.ts" });
    const link = join(work, "node_modules", "@automatos", "greet");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(join(work, AXE_PACKAGES_DIR, "greet")));
  });

  it("builds in the harness with the package's own copy of the library", async () => {
    const work = tempFolder();
    const layout = layOutPackage(filesOf((await greetingTheme()).zip), work);
    if (!layout.ok) throw new Error(layout.why);
    const outDir = tempFolder();
    const config = harnessConfig(layout.themeDir);
    await build({ ...config, configFile: false, logLevel: "silent", build: { ...config.build, outDir } });
    const scripts = readdirSync(outDir, { recursive: true, encoding: "utf8" }).filter((path) => path.endsWith(".js"));
    expect(scripts.some((path) => readFileSync(join(outDir, path), "utf8").includes(GREETING))).toBe(true);
  }, BUILD_TIMEOUT_MS);

  it("says why when the package's entry is not the one the harness draws", async () => {
    const layout = layOutPackage(filesOf((await greetingTheme("src/entry.js")).zip), tempFolder());
    expect(layout).toEqual({ ok: false, why: expect.stringContaining(`${HARNESS_ENTRY}, and this package's entry is source/entry.js`) });
  });
});

describe("the axe pass", () => {
  it("counts what axe found by impact and rule, in every set but a trace's, and never prints a selector", async () => {
    const work = tempFolder();
    const run = await axePass((await greetingTheme()).zip, work, madeUpShots(0));
    if (run.status !== "ran") throw new Error(run.why);
    expect(run.summary).toMatchObject({
      sets: 2, shots: 3, browsers: ["chromium", "webkit"], byImpact: { critical: 0, serious: 2, moderate: 0, minor: 1, unknown: 0 },
    });
    expect(run.summary.rules.map((rule) => [rule.impact, rule.id, rule.elements])).toEqual([["serious", "color-contrast", 3], ["minor", "region", 1]]);
    const text = axeText(run);
    expect(text).toContain("Shots: 3 in 2 sets, on chromium and webkit. `automatos-theme shots` passed.");
    expect(text).toContain("  Violations by impact: critical 0, serious 2, moderate 0, minor 1.");
    expect(text).toContain("      3 elements in 2 shots: chromium/default/1440/page-chat.png, webkit/default/1440/page-chat.png");
    expect(text).not.toContain(SELECTOR);
    expect(readScanSets(join(work, SHOTS_DIR)).map((set) => set.folder)).toEqual(["chromium/default/1440", "webkit/default/1440"]);
  });

  it("reports a shots run that failed, and still counts the scans it wrote", async () => {
    const run = await axePass((await greetingTheme()).zip, tempFolder(), madeUpShots(1));
    expect(run).toMatchObject({ status: "ran", shotsExit: 1 });
    expect(axeText(run)).toContain("ended with exit code 1");
    expect(summarize([]).rules).toEqual([]);
    expect(axeText({ status: "ran", shotsExit: 0, summary: summarize([]) })).toContain("No violations in any shot.");
  });

  it("is not run, and says why, for a package it can't read or draw; no shots are taken", async () => {
    let taken = 0;
    const count: Shots = () => { taken += 1; return 0; };
    const unread = await axePass(Buffer.from("not a zip"), tempFolder(), count);
    expect(unread).toMatchObject({ status: "not_run", why: expect.stringContaining("the package was not read") });
    const other = await axePass((await greetingTheme("src/entry.js")).zip, tempFolder(), count);
    expect(other).toMatchObject({ status: "not_run", why: expect.stringContaining(HARNESS_ENTRY) });
    expect(taken).toBe(0);
    expect(axeText(unread)).toMatch(/^Previews and accessibility, axe over harness shots of this package \(report only\): not run: /);
  });

  it("goes in the job summary under its own heading, fenced so nothing renders as Markdown", () => {
    const markdown = axeJobSummary("a ``` b");
    expect(markdown).toContain("### Previews and accessibility: axe");
    expect(markdown).toContain("````text\na ``` b\n````");
  });
});

describe("scripts/review/axe.ts", () => {
  it("exits 0 and reports the pass as not run when the workflow's environment is missing", () => {
    const work = tempFolder();
    const summary = join(work, "summary.md");
    mkdirSync(work, { recursive: true });
    writeFileSync(summary, "");
    const env = { ...process.env, REVIEW_PACKAGE: "", AXE_WORK: "", REVIEW_SUMMARY: summary };
    const result = spawnSync(process.execPath, [AXE_SCRIPT], { cwd: ROOT, env, encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("not run: REVIEW_PACKAGE, AXE_WORK not set");
    expect(readFileSync(summary, "utf8")).toContain("### Previews and accessibility: axe");
  });
});
