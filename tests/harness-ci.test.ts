// PRD-261 B-02f and B-02i: kit.yml's harness job. It installs and builds as the kit job does, installs the two
// browsers the shots run on, runs `automatos-theme shots` over Play, then the dev smoke (`automatos-theme dev
// themes/play` serves the harness and /chat renders, on Chromium), and uploads the shots, their axe.json files and
// the smoke's shot as kit-harness. These checks read files only; nothing is installed. (Moved out of
// tests/kit-ci.test.ts, which holds the kit's own contract, to keep each file under the 400-line cap.)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WORKFLOW = ".github/workflows/kit.yml";
// The npm pin every kit.yml job runs first (tests/kit-ci.test.ts holds the kit job to it).
const PIN_NPM = "npm install -g npm@11.21.1";
/** Where the kit job's install runs: after the npm pin and the released-bytes check (tests/kit-ci.test.ts). */
const KIT_INSTALL_AT = 2;
const SHOTS_OUT = "packages/theme-harness/dist/shots";
const SHOTS_CONFIG = "packages/theme-harness/shots/playwright.config.ts";
// PRD-261 B-02i: the dev smoke's own Playwright config, whose web server is `automatos-theme dev themes/play`, and the
// spec it runs, which opens /chat there.
const DEV_SMOKE_CONFIG = "packages/theme-harness/shots/dev-smoke.config.ts";
const DEV_SMOKE_SPEC = "packages/theme-harness/shots/dev-smoke.spec.ts";
const DEV_SMOKE_STEP = "Dev smoke";
const DEV_SMOKE_RUN = `npx playwright test --config ${DEV_SMOKE_CONFIG}`;
const escapedPath = (path: string): string => path.replace(/[/.]/g, (char) => `\\${char}`);

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

// The `uses:` lines of a block, as written.
function usesLines(text: string): string[] {
  return text.split("\n").filter((line) => /^\s*(?:-\s+)?uses:/.test(line)).map((line) => line.trim());
}

// The `run:` commands of a block, in file order.
function workflowRuns(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^\s*run:\s*(.+)$/.exec(line)?.[1]?.trim())
    .filter((run): run is string => typeof run === "string");
}

// The step names of a block, in file order.
function stepNames(text: string): string[] {
  return Array.from(text.matchAll(/^ {6}- name: (.+)$/gm), (match) => match[1]);
}

describe("kit workflow, harness job (PRD-261 B-02f, B-02i)", () => {
  const text = readText(WORKFLOW);
  const kit = jobBlock(text, "kit");
  const harness = jobBlock(text, "harness");

  it("installs and builds as the kit job does, installs Chromium and WebKit, runs the shots, then the dev smoke", () => {
    expect(workflowRuns(harness)).toEqual([
      PIN_NPM,
      workflowRuns(kit)[KIT_INSTALL_AT],
      "npm run build",
      "npx playwright install --with-deps chromium webkit",
      `npx automatos-theme shots themes/play --out ${SHOTS_OUT}`,
      DEV_SMOKE_RUN,
    ]);
  });

  it("runs the dev smoke (PRD-261 B-02i) after the shots and before the upload", () => {
    const steps = stepNames(harness);
    const shots = steps.indexOf("Shots");
    const upload = steps.indexOf("Upload shots");
    expect(shots).toBeGreaterThanOrEqual(0);
    expect(upload).toBeGreaterThan(shots);
    expect(steps.slice(shots + 1, upload)).toEqual([DEV_SMOKE_STEP]);
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

  it("smokes `automatos-theme dev` over Play with its own spec, on Chromium alone, with no retry, at /chat", () => {
    const config = readText(DEV_SMOKE_CONFIG);
    expect(Array.from(config.matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).toEqual(["chromium"]);
    expect(config).toMatch(/^\s+retries: 0,$/m);
    expect(config).toMatch(/^\s+testMatch: 'dev-smoke\.spec\.ts',$/m);
    expect(config).toMatch(/^const PLAY_DIR = resolve\(HARNESS_DIR, '\.\.\/\.\.\/themes\/play'\)$/m);
    expect(config).toContain("[process.execPath, themeCli(), 'dev', PLAY_DIR]");
    expect(readText(DEV_SMOKE_SPEC)).toContain("const CHAT_PATH = '/chat'");
  });
});
