// PRD-261 B-02f and B-02i: kit.yml's harness job. It installs and builds as the kit job does, installs the two
// browsers the shots run on, runs `automatos-theme shots` over Play, then over HUD into a folder of its own (each
// group in its own viewport; a theme whose minWidth fits a phone is shot at 390 × 844 too), then the dev smoke
// (`automatos-theme dev themes/play` serves the harness and /chat renders, on Chromium), then the phone view's shots
// (`automatos-theme dev` over the harness's made-up phone skin, /phone shot on Chromium into a folder of its own), then
// the showcase shots (`automatos-theme dev` over HUD and Play, chosen views on the hosted edition at twice the pixel
// density, on Chromium, into a folder apart from the shots), and uploads the shots, their axe.json files and the
// smoke's shot as kit-harness and the showcase as kit-showcase. These checks read files only; nothing is installed. (Moved out of tests/kit-ci.test.ts, which holds the kit's own contract, to keep each
// file under the 400-line cap.)
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
/** HUD's shots, in a folder of their own inside the upload, so no group of HUD's can stand in for one of Play's. */
const HUD_SHOTS_OUT = `${SHOTS_OUT}/hud`;
const HUD_SHOTS_STEP = "HUD shots";
const SHOTS_CONFIG = "packages/theme-harness/shots/playwright.config.ts";
// The shots' spec and their groups: one group shoots the chat page with motion allowed, so the Pause Auto control
// (which reduced motion never draws) is in the upload; every other group keeps the config's reduced motion.
const SHOTS_SPEC = "packages/theme-harness/shots/shots.spec.ts";
const SHOT_GROUPS = "packages/theme-harness/src/host/shot-groups.ts";
// The harness's widths: the phone's viewport, which the phone-width group shoots in and the toolbar offers the width of.
const ROUTER = "packages/theme-harness/src/host/router.ts";
const TOOLBAR = "packages/theme-harness/app/toolbar.tsx";
// The phone view's phone, which draws Automatos Go at the same 390 × 844 the phone-width group shoots in.
const PHONE_FRAME = "packages/theme-harness/app/phone/frame.tsx";
const PHONE_VIEWPORT = "export const PHONE_VIEWPORT: Readonly<{ width: number; height: number }> = Object.freeze({ width: 390, height: 844 })";
/** The theme folder each `automatos-theme shots` run of a job shoots. */
const SHOTS_THEME = /^npx automatos-theme shots (\S+)/;
// PRD-261 B-02i: the dev smoke's own Playwright config, whose web server is `automatos-theme dev themes/play`, and the
// spec it runs, which opens /chat there.
const DEV_SMOKE_CONFIG = "packages/theme-harness/shots/dev-smoke.config.ts";
const DEV_SMOKE_SPEC = "packages/theme-harness/shots/dev-smoke.spec.ts";
const DEV_SMOKE_STEP = "Dev smoke";
const DEV_SMOKE_RUN = `npx playwright test --config ${DEV_SMOKE_CONFIG}`;
// The phone view's shots: their own Playwright config, whose web server is `automatos-theme dev` over the harness's
// made-up theme with a `mobile` block, the spec that opens /phone there, and the folder of the upload they go to.
const PHONE_SHOTS_CONFIG = "packages/theme-harness/shots/phone-shots.config.ts";
const PHONE_SHOTS_SPEC = "packages/theme-harness/shots/phone-shots.spec.ts";
const PHONE_SHOTS_STEP = "Phone shots";
const PHONE_SHOTS_RUN = `npx playwright test --config ${PHONE_SHOTS_CONFIG}`;
const PHONE_SKIN_THEME = "packages/theme-harness/fixtures/phone-skin/theme.json";
// The showcase shots: their own Playwright config, whose web servers are `automatos-theme dev` over HUD and over Play,
// each on its own port, the spec, and the folder they go to, uploaded as an artefact of its own.
const SHOWCASE_CONFIG = "packages/theme-harness/shots/showcase.config.ts";
const SHOWCASE_SPEC = "packages/theme-harness/shots/showcase.spec.ts";
const SHOWCASE_STEP = "Showcase shots";
const SHOWCASE_RUN = `npx playwright test --config ${SHOWCASE_CONFIG}`;
const SHOWCASE_OUT = "packages/theme-harness/dist/showcase";
const SHOWCASE_UPLOAD = "Upload showcase";
const SHOWCASE_PLAN = "packages/theme-harness/src/host/showcase.ts";
// PRD-261 B-02h: Lighthouse over the themes drawn in the harness, report only, after the showcase; its reports are
// uploaded last, as kit-lighthouse (tests/lighthouse-ci.test.ts holds the step and the upload).
const LIGHTHOUSE_STEP = "Lighthouse (report only)";
const LIGHTHOUSE_RUN = "node scripts/lighthouse/main.ts";
const LIGHTHOUSE_UPLOAD = "Upload Lighthouse reports";
const HARNESS_PREFIX = "packages/theme-harness/";
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

  it("installs and builds as the kit job does, installs both browsers, shoots Play, HUD, the dev smoke, the phone, then Lighthouse", () => {
    expect(workflowRuns(harness)).toEqual([
      PIN_NPM,
      workflowRuns(kit)[KIT_INSTALL_AT],
      "npm run build",
      "npx playwright install --with-deps chromium webkit",
      `npx automatos-theme shots themes/play --out ${SHOTS_OUT}`,
      `npx automatos-theme shots themes/hud --out ${HUD_SHOTS_OUT}`,
      DEV_SMOKE_RUN,
      PHONE_SHOTS_RUN,
      SHOWCASE_RUN,
      LIGHTHOUSE_RUN,
    ]);
  });

  it("runs HUD's shots after Play's, then the dev smoke (PRD-261 B-02i), the phone shots, the showcase and Lighthouse, before the uploads", () => {
    const steps = stepNames(harness);
    const shots = steps.indexOf("Shots");
    const upload = steps.indexOf("Upload shots");
    expect(shots).toBeGreaterThanOrEqual(0);
    expect(upload).toBeGreaterThan(shots);
    expect(steps.slice(shots + 1, upload)).toEqual([HUD_SHOTS_STEP, DEV_SMOKE_STEP, PHONE_SHOTS_STEP, SHOWCASE_STEP, LIGHTHOUSE_STEP]);
    expect(steps.slice(upload)).toEqual(["Upload shots", SHOWCASE_UPLOAD, LIGHTHOUSE_UPLOAD]);
  });

  it("shoots HUD into a folder of the upload that none of Play's groups or the smoke's folder takes", () => {
    const config = readText(DEV_SMOKE_CONFIG);
    expect(HUD_SHOTS_OUT.startsWith(`${SHOTS_OUT}/`)).toBe(true);
    const folder = HUD_SHOTS_OUT.slice(SHOTS_OUT.length + 1);
    expect(config).not.toContain(`const SMOKE_FOLDER = '${folder}'`);
    expect(Array.from(readText(SHOTS_CONFIG).matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).not.toContain(folder);
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

  it("uploads the showcase as kit-showcase whatever happened, from its own folder outside kit-harness's, and fails when there is none", () => {
    const upload = new RegExp(
      `- name: ${SHOWCASE_UPLOAD}\\n\\s+if: always\\(\\)\\n\\s+uses: actions/upload-artifact@[0-9a-f]{40}[^\\n]*\\n` +
        `\\s+with:\\n\\s+name: kit-showcase\\n\\s+path: ${escapedPath(SHOWCASE_OUT)}/\\n\\s+if-no-files-found: error`,
    );
    expect(harness).toMatch(upload);
    expect(`${SHOWCASE_OUT}/`.startsWith(`${SHOTS_OUT}/`)).toBe(false);
    expect(readText(SHOWCASE_CONFIG)).toContain("join(HARNESS_DIR, SHOWCASE_FOLDER, 'test-results')");
    expect(readText(SHOWCASE_SPEC)).toContain("join(fileURLToPath(new URL('..', import.meta.url)), SHOWCASE_FOLDER)");
    expect(readText(SHOWCASE_PLAN)).toContain(`export const SHOWCASE_FOLDER = '${SHOWCASE_OUT.slice(HARNESS_PREFIX.length)}'`);
  });

  it("shoots the showcase on Chromium alone, at twice the pixel density, with reduced motion, a fixed clock and no retry", () => {
    const config = readText(SHOWCASE_CONFIG);
    expect(Array.from(config.matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).toEqual(["chromium"]);
    expect(config).toMatch(/^\s+retries: 0,$/m);
    expect(config).toMatch(/^\s+testMatch: 'showcase\.spec\.ts',$/m);
    expect(config).toContain("deviceScaleFactor: SHOWCASE_SCALE");
    expect(config).toContain("contextOptions: { reducedMotion: 'reduce' }");
    expect(config).toContain("[process.execPath, themeCli(), 'dev', join(THEMES_DIR, theme), '--port', String(SHOWCASE_PORTS[theme])]");
    expect(config).toContain("webServer: SHOWCASE_THEMES.map(serve)");
    const spec = readText(SHOWCASE_SPEC);
    expect(spec).toContain("await page.clock.setFixedTime(SHOWCASE_TIME)");
    expect(spec).not.toContain("scanShot");
    const plan = readText(SHOWCASE_PLAN);
    expect(plan).toContain("export const SHOWCASE_SCALE = 2");
    expect(plan).toContain("export const SHOWCASE_EDITION: HarnessEdition = 'saas'");
  });

  it("shoots on Chromium and WebKit, with no retry", () => {
    const config = readText(SHOTS_CONFIG);
    expect(Array.from(config.matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).toEqual(["chromium", "webkit"]);
    expect(config).toMatch(/^\s+retries: 0,$/m);
  });

  it("asks every shot context for reduced motion, but the motion group's page, which asks the browser for none", () => {
    expect(readText(SHOTS_CONFIG)).toContain("contextOptions: { reducedMotion: 'reduce' }");
    const spec = readText(SHOTS_SPEC);
    expect(spec).toContain("if (!group.reducedMotion) await page.emulateMedia({ reducedMotion: 'no-preference' })");
    expect(spec).toContain("shotGroups(presets, typeof manifest.minWidth === 'number' ? manifest.minWidth : 0, declared.pages, usesIn(manifest))");
    const groups = readText(SHOT_GROUPS);
    expect(groups).toContain("export const CHAT_PAGE = '/chat'");
    expect(groups).toContain("export const MOTION_SUFFIX = '-motion'");
  });

  it("sizes each shot's page to its group's viewport: 900 tall, or a phone's 390 × 844 for a theme that fits one", () => {
    const spec = readText(SHOTS_SPEC);
    expect(spec).toContain("await page.setViewportSize({ width: group.width, height: group.height })");
    expect(spec).not.toContain("VIEWPORT_HEIGHT");
    const groups = readText(SHOT_GROUPS);
    expect(groups).toContain("export const DESKTOP_HEIGHT = 900");
    expect(groups).toContain("return minWidth <= PHONE_VIEWPORT.width");
    expect(groups).toContain("...phoneGroups(looks, minWidth, pages)]");
    expect(readText(ROUTER)).toContain(PHONE_VIEWPORT);
    expect(readText(TOOLBAR)).toContain("widthChoices(minWidth)");
    expect(readText(SHOTS_CONFIG)).toContain("const VIEWPORT = Object.freeze({ width: SHOT_WIDTHS[0], height: DESKTOP_HEIGHT })");
    expect(readText(PHONE_FRAME)).toContain("width: PHONE_VIEWPORT.width, height: PHONE_VIEWPORT.height");
  });

  it("shoots themes that each declare their own minWidth, which decides their phone-width group", () => {
    const themes = workflowRuns(harness).flatMap((run) => SHOTS_THEME.exec(run)?.[1] ?? []);
    expect(themes).toEqual(["themes/play", "themes/hud"]);
    themes.forEach((theme) => {
      const manifest = JSON.parse(readText(`${theme}/theme.json`)) as { minWidth?: unknown };
      expect(Number.isInteger(manifest.minWidth), `${theme}/theme.json declares minWidth`).toBe(true);
    });
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

  it("shoots the phone view with its own spec over the made-up phone skin, on Chromium alone, with no retry", () => {
    const config = readText(PHONE_SHOTS_CONFIG);
    expect(Array.from(config.matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).toEqual(["chromium"]);
    expect(config).toMatch(/^\s+retries: 0,$/m);
    expect(config).toMatch(/^\s+testMatch: 'phone-shots\.spec\.ts',$/m);
    expect(config).toMatch(/^const SKIN_DIR = resolve\(HARNESS_DIR, 'fixtures\/phone-skin'\)$/m);
    expect(config).toContain("[process.execPath, themeCli(), 'dev', SKIN_DIR]");
    expect(config).toContain("contextOptions: { reducedMotion: 'reduce' }");
    expect(readText(PHONE_SHOTS_SPEC)).toContain("new URL('../fixtures/phone-skin/theme.json', import.meta.url)");
    expect(readText(PHONE_SKIN_THEME)).toContain('"mobile"');
  });

  it("puts the phone shots in a folder of the upload that no other step's shots take", () => {
    const folder = /^const PHONE_FOLDER = '([a-z-]+)'$/m.exec(readText(PHONE_SHOTS_CONFIG))?.[1] ?? "";
    expect(folder).not.toBe("");
    expect(folder).not.toBe(HUD_SHOTS_OUT.slice(SHOTS_OUT.length + 1));
    expect(readText(DEV_SMOKE_CONFIG)).not.toContain(`const SMOKE_FOLDER = '${folder}'`);
    expect(Array.from(readText(SHOTS_CONFIG).matchAll(/\bname: '([a-z]+)'/g), (match) => match[1])).not.toContain(folder);
  });
});
