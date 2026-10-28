// PRD-261 B-02h (QB-13c): kit.yml's harness job runs Lighthouse over the themes drawn in the browser harness, report
// only. The step comes after the shots (so the browsers are installed and Play's look data built), runs the kit's own
// script with Node, continues on an error and has a timeout of its own, so the build never fails on it; its reports are
// uploaded as kit-lighthouse whatever happened, and a run with none only warns. Lighthouse is pinned exactly in the
// root package.json (tests/kit-ci.test.ts holds the pin). These checks read files only; nothing is installed or run.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REPORT_DIR } from "../scripts/lighthouse/plan.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKFLOW = ".github/workflows/kit.yml";
const STEP = "Lighthouse (report only)";
const UPLOAD = "Upload Lighthouse reports";
const SCRIPT = "scripts/lighthouse/main.ts";
const LAST_SHOTS_STEP = "Showcase shots";
const MAX_STEP_MINUTES = 30;
/** What the rest of the harness job takes (the shots and the showcase, about 11 minutes), with room to spare. */
const REST_OF_JOB_MINUTES = 15;

function readText(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// One job's lines, from its key to the next job's key (or the end of the file).
function jobBlock(text: string, job: string): string {
  const lines = text.split("\n");
  const start = lines.indexOf(`  ${job}:`);
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:$/.test(line));
  return lines.slice(start, end < 0 ? lines.length : end).join("\n");
}

/** A step's own lines, without its comments, from its `- name:` line to the next step's. */
function stepLines(block: string, name: string): string[] {
  const lines = block.split("\n");
  const start = lines.indexOf(`      - name: ${name}`);
  if (start < 0) return [];
  const next = lines.findIndex((line, index) => index > start && /^ {6}(?:- name: |#)/.test(line));
  return lines.slice(start, next < 0 ? lines.length : next).filter((line) => line.trim() !== "");
}

function stepNames(block: string): string[] {
  return Array.from(block.matchAll(/^ {6}- name: (.+)$/gm), (match) => match[1]);
}

describe("kit workflow, the harness job's Lighthouse (PRD-261 B-02h)", () => {
  const harness = jobBlock(readText(WORKFLOW), "harness");
  const step = stepLines(harness, STEP).map((line) => line.trim());

  it("runs the kit's Lighthouse script with Node after the last shots, before the uploads", () => {
    const names = stepNames(harness);
    expect(names.indexOf(STEP)).toBe(names.indexOf(LAST_SHOTS_STEP) + 1);
    expect(names.indexOf(STEP)).toBeLessThan(names.indexOf("Upload shots"));
    expect(step.filter((line) => line.startsWith("run:"))).toEqual([`run: node ${SCRIPT}`]);
    expect(existsSync(join(ROOT, SCRIPT))).toBe(true);
  });

  it("never fails the build: the step continues on an error and stops at a timeout of its own", () => {
    expect(step).toContain("continue-on-error: true");
    const minutes = Number(/^timeout-minutes: (\d+)$/m.exec(step.join("\n"))?.[1]);
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThanOrEqual(MAX_STEP_MINUTES);
    expect(step.filter((line) => /^(?:if|uses|env|with|shell):/.test(line))).toEqual([]);
  });

  it("leaves room in the job for the step's whole timeout beside the shots", () => {
    const job = Number(/^ {4}timeout-minutes: (\d+)$/m.exec(harness)?.[1]);
    const own = Number(/^timeout-minutes: (\d+)$/m.exec(step.join("\n"))?.[1]);
    expect(job).toBeGreaterThanOrEqual(own + REST_OF_JOB_MINUTES);
  });

  it("uploads the reports as kit-lighthouse whatever happened, and only warns when there are none", () => {
    const upload = stepLines(harness, UPLOAD).map((line) => line.trim());
    expect(upload).toEqual([
      `- name: ${UPLOAD}`,
      "if: always()",
      expect.stringMatching(/^uses: actions\/upload-artifact@[0-9a-f]{40} # v\d/),
      "with:",
      "name: kit-lighthouse",
      `path: ${REPORT_DIR}/`,
      "if-no-files-found: warn",
    ]);
    expect(stepNames(harness).at(-1)).toBe(UPLOAD);
  });

  it("writes its reports under the harness package's dist/, which git ignores, apart from the shots and the showcase", () => {
    expect(REPORT_DIR.startsWith("packages/theme-harness/dist/")).toBe(true);
    expect(readText(".gitignore")).toMatch(/^packages\/\*\/dist\/$/m);
    ["packages/theme-harness/dist/shots", "packages/theme-harness/dist/showcase"].forEach((other) => expect(REPORT_DIR.startsWith(other)).toBe(false));
  });
});
