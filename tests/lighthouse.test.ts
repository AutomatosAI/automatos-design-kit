// PRD-261 B-02h: Lighthouse over the kit's themes drawn in the browser harness, report only. The plan
// (scripts/lighthouse/plan.ts) read against the harness's own widths and the kit's themes/ folder, the summary table
// (summary.ts), and the runs (run.ts) with a made-up Runner: no server starts and no browser opens here. Every failure
// becomes a row that says why, and nothing throws, so the job's step never fails on a score or a run. kit.yml's step
// itself is held by tests/lighthouse-ci.test.ts.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { PHONE_VIEWPORT, readSettings, SHOT_WIDTHS } from "@automatos/theme-harness/router";
import { DESKTOP_HEIGHT } from "../packages/theme-harness/src/host/shot-groups.ts";
import {
  auditedPages, CATEGORIES, CHROME_FLAGS, FORM_FACTORS, JSON_REPORT_SUFFIX, lighthouseArgs, pageAddress, pageSlug, reportBase,
  runsOf, themeFolders, type LighthouseRun,
} from "../scripts/lighthouse/plan.ts";
import { measureAll, type Runner, type Serving } from "../scripts/lighthouse/run.ts";
import { NO_SCORE, scoresOf, summaryTable, type RunResult } from "../scripts/lighthouse/summary.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const THEMES = join(ROOT, "themes");
const ORIGIN = "http://127.0.0.1:4322";
const REPORTS = "/reports";
const CHAT = { pages: { "/chat": "chat" } };
const [DESKTOP, PHONE] = FORM_FACTORS;
const SCORES = { performance: 0.871, accessibility: 0.96, "best-practices": 1, seo: 0.9 };
const REPORT = JSON.stringify({ categories: Object.fromEntries(Object.entries(SCORES).map(([id, score]) => [id, { id, score }])) });

const folders: string[] = [];

afterEach(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
});

function tempThemes(layout: Readonly<Record<string, string | null>>): string {
  const root = mkdtempSync(join(tmpdir(), "automatos-lighthouse-"));
  folders.push(root);
  Object.entries(layout).forEach(([name, manifest]) => {
    mkdirSync(join(root, name), { recursive: true });
    if (manifest !== null) writeFileSync(join(root, name, "theme.json"), manifest);
  });
  writeFileSync(join(root, "README.md"), "not a theme\n");
  return root;
}

interface Calls {
  readonly served: string[];
  readonly stopped: string[];
  readonly args: string[][];
}

/** A Runner over `manifests`, by theme; each Lighthouse run exits with `code` and the report reads as `report`. */
function fakeRunner(manifests: Readonly<Record<string, unknown>>, options: {
  readonly code?: number; readonly report?: string | null; readonly serving?: "ok" | "down"; readonly problem?: string;
} = {}): { runner: Runner; calls: Calls } {
  const calls: Calls = { served: [], stopped: [], args: [] };
  const stop = (theme: string) => async (): Promise<void> => { calls.stopped.push(theme); };
  const serve = async (theme: string): Promise<Serving> => {
    calls.served.push(theme);
    return options.serving === "down" ? { ok: false, why: "port in use", stop: stop(theme) } : { ok: true, origin: ORIGIN, stop: stop(theme) };
  };
  const runner: Runner = {
    themes: Object.keys(manifests),
    problem: () => options.problem ?? null,
    manifest: (theme) => manifests[theme],
    serve,
    lighthouse: async (args) => { calls.args.push([...args]); return options.code ?? 0; },
    readReport: () => (options.report === undefined ? REPORT : options.report),
  };
  return { runner, calls };
}

const where = (result: RunResult): string => `${result.run.theme} ${result.run.factor.name} ${result.run.page}`;

describe("the plan", () => {
  it("measures every folder under themes/ that holds a theme.json, Play and HUD among them", () => {
    const expected = readdirSync(THEMES).filter((name) => {
      try { return statSync(join(THEMES, name, "theme.json")).isFile(); } catch { return false; }
    }).sort();
    expect(themeFolders(THEMES)).toEqual(expected);
    expect(expected).toEqual(expect.arrayContaining(["hud", "play"]));
    expect(themeFolders(tempThemes({ zeta: "{}", alpha: "{}", "no-manifest": null }))).toEqual(["alpha", "zeta"]);
  });

  it("measures at the shots' first desktop width and at the phone's, Lighthouse's mobile scoring for the phone only", () => {
    expect(FORM_FACTORS.map(({ name, width, height, mobile }) => ({ name, width, height, mobile }))).toEqual([
      { name: "desktop", width: SHOT_WIDTHS[0], height: DESKTOP_HEIGHT, mobile: false },
      { name: "phone", width: PHONE_VIEWPORT.width, height: PHONE_VIEWPORT.height, mobile: true },
    ]);
  });

  it("measures the home view, and the /chat page when theme.json declares one, each at both widths", () => {
    expect(auditedPages({})).toEqual(["/"]);
    expect(auditedPages(null)).toEqual(["/"]);
    expect(auditedPages(CHAT)).toEqual(["/", "/chat"]);
    expect(runsOf("play", CHAT).map((run) => `${run.factor.name} ${run.page}`)).toEqual([
      "desktop /", "phone /", "desktop /chat", "phone /chat",
    ]);
  });

  it("opens the harness on the page with the toolbar off, in the default look, at the window's width", () => {
    const address = pageAddress(ORIGIN, "/chat");
    expect(address.startsWith(`${ORIGIN}/?`)).toBe(true);
    expect(readSettings(new URL(address).search)).toMatchObject({ path: "/chat", toolbar: false, preset: null, width: null });
    expect(readSettings(new URL(pageAddress(ORIGIN, "/")).search)).toMatchObject({ path: "/", toolbar: false });
  });

  it("names each run's reports by theme, width and page", () => {
    const run: LighthouseRun = { theme: "hud", factor: PHONE, page: "/chat" };
    expect(reportBase(REPORTS, run)).toBe(join(REPORTS, "hud-phone-chat"));
    expect([pageSlug("/"), pageSlug("/chat"), pageSlug("/missions/[id]")]).toEqual(["home", "chat", "missions-id"]);
  });

  it("asks Lighthouse for each width's emulation, the four categories, HTML and JSON, headless, and no error reporting", () => {
    const desktop = lighthouseArgs("http://a/", DESKTOP, "/r/x");
    expect(desktop[0]).toBe("http://a/");
    expect(desktop).toEqual(expect.arrayContaining([
      "--preset=desktop", "--screenEmulation.mobile=false", `--screenEmulation.width=${SHOT_WIDTHS[0]}`,
      `--screenEmulation.height=${DESKTOP_HEIGHT}`, "--output=json", "--output=html", "--output-path=/r/x",
      `--chrome-flags=${CHROME_FLAGS}`, "--no-enable-error-reporting",
      `--only-categories=${CATEGORIES.map((category) => category.id).join(",")}`,
    ]));
    const phone = lighthouseArgs("http://a/", PHONE, "/r/y");
    expect(phone).toEqual(expect.arrayContaining([
      "--form-factor=mobile", "--screenEmulation.mobile=true", `--screenEmulation.width=${PHONE_VIEWPORT.width}`,
      `--screenEmulation.height=${PHONE_VIEWPORT.height}`,
    ]));
    expect(phone).not.toContain("--preset=desktop");
    expect(CHROME_FLAGS.split(" ")).toEqual(["--headless=new", "--no-sandbox"]);
  });
});

describe("the summary table", () => {
  it("reads each category's score from a JSON report, and says why a report holds none", () => {
    expect(scoresOf(REPORT)).toEqual(SCORES);
    expect(scoresOf(JSON.stringify({ categories: { performance: { score: null } } }))).toEqual({
      performance: null, accessibility: null, "best-practices": null, seo: null,
    });
    expect(scoresOf("{")).toMatch(/^the JSON report can't be read/);
    expect(scoresOf("[]")).toBe("the JSON report has no categories");
  });

  it("shows scores out of 100, a failed run's reason, and says it is report only", () => {
    const run = (page: string): LighthouseRun => ({ theme: "play", factor: DESKTOP, page });
    const table = summaryTable([{ run: run("/"), scores: { ...SCORES, seo: null } }, { run: run("/chat"), failure: "exit | 1\nagain" }], "13.5.0");
    expect(table).toContain("## Lighthouse on the harness (report only)");
    expect(table).toContain("Report only: no score fails the build");
    expect(table).toContain("| Theme | Width | Page | Performance | Accessibility | Best practices | SEO |");
    expect(table).toContain(`| play | desktop ${SHOT_WIDTHS[0]} × ${DESKTOP_HEIGHT} | / | 87 | 96 | 100 | ${NO_SCORE} |`);
    expect(table).toContain("| play | desktop 1440 × 900 | /chat | failed: exit \\| 1 again |  |  |  |");
    expect(summaryTable([], "13.5.0")).toContain("nothing was measured");
  });
});

describe("the runs", () => {
  it("serves each theme once, runs each of its pages at both widths against it, and stops it", async () => {
    const { runner, calls } = fakeRunner({ hud: CHAT, play: {} });
    const results = await measureAll(runner, REPORTS);
    expect(results.map(where)).toEqual([
      "hud desktop /", "hud phone /", "hud desktop /chat", "hud phone /chat", "play desktop /", "play phone /",
    ]);
    expect(results.every((result) => "scores" in result && result.scores.accessibility === SCORES.accessibility)).toBe(true);
    expect({ served: calls.served, stopped: calls.stopped }).toEqual({ served: ["hud", "play"], stopped: ["hud", "play"] });
    expect(calls.args.map((args) => args[0])).toEqual(results.map((result) => pageAddress(ORIGIN, result.run.page)));
    expect(calls.args[0]).toContain(`--output-path=${join(REPORTS, "hud-desktop-home")}`);
  });

  it("turns every failure into a row that says why, and still stops the server", async () => {
    const failed = async (options: Parameters<typeof fakeRunner>[1]) => {
      const { runner, calls } = fakeRunner({ play: {} }, options);
      const results = await measureAll(runner, REPORTS);
      return { failures: results.map((result) => ("failure" in result ? result.failure : "scored")), calls };
    };
    expect((await failed({ code: 1 })).failures).toEqual(["Lighthouse exited with code 1", "Lighthouse exited with code 1"]);
    expect((await failed({ report: null })).failures).toEqual(Array(2).fill("Lighthouse wrote no JSON report"));
    const down = await failed({ serving: "down" });
    expect(down.failures).toEqual(Array(2).fill("the harness did not start: port in use"));
    expect(down.calls.stopped).toEqual(["play"]);
    const refused = await failed({ problem: "no src/entry.ts" });
    expect(refused.failures).toEqual(Array(2).fill("not drawn: no src/entry.ts"));
    expect(refused.calls.served).toEqual([]);
  });

  it("reads the JSON report Lighthouse wrote beside the HTML one", () => {
    expect(JSON_REPORT_SUFFIX).toBe(".report.json");
  });
});
