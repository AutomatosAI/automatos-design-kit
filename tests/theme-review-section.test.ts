// PRD-261 B-02j: the review's report-only "Previews and accessibility" section (scripts/review/report.ts and
// previews.ts). Seeded packages give the expected section: each preset's previews with their sizes and the screens their
// names give, a preset with none, a listed preview no preset claims, and a file in assets/previews/ theme.json doesn't
// list; contrast "not measured" while core's look schema declares no pairs, saying whether a `mobile` block is there.
// The review's outcome rules are unchanged: the section is never a check, a package with stray previews still passes,
// and a failing one still fails. The axe part runs outside the review (tests/theme-review-axe.test.ts).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { phonePreviewsLines, phonePreviewsReport, previewsLines, previewsReport } from "../scripts/review/previews.ts";
import {
  AXE_AFTER, CONTRAST_NOT_MEASURED, MOBILE_BLOCK, NO_MOBILE_BLOCK, previewsAndAccessibility, SECTION_HEAD, SECTION_NOT_READ,
  sectionLines,
} from "../scripts/review/report.ts";
import { reviewPackage, type ReviewReport } from "../scripts/review/review.ts";
import { summaryText } from "../scripts/review/summary.ts";
import type { ProbeResult } from "../scripts/review/probe.ts";
import { REVIEW_CHECKS } from "./support/package-review.ts";
import {
  HELLO_CSS, HELLO_ENTRY, packSeeded, previewBytes, removeSeededFolders, tempFolder, type Seeded,
} from "./support/seeded-package.ts";
import { ROOT } from "./support/workflow-steps.ts";

const TOOLS = { kitCommit: "test", node: process.version, vite: "test", preset: "test" };
const ISOLATED: ProbeResult = { isolated: true, lines: ["https://example.com/: failed (ENOTFOUND)"] };
const REACHED: ProbeResult = { isolated: false, lines: ["https://example.com/: reached (the job has network access)"] };
const P = "assets/previews/";
/** The hello fixture's presets: default (its default look) and night. */
const LISTED = [`${P}default.png`, `${P}default-chat.png`, `${P}stray.png`];
const SIZES: Readonly<Record<string, number>> = { "default.png": 40, "default-chat.png": 24, "stray.png": 8, "old.png": 16 };
const PREVIEW_FILES = Object.fromEntries(Object.entries(SIZES).map(([name, size]) => [`${P}${name}`, previewBytes(size)]));
const bytesOf = (name: string): number => previewBytes(SIZES[name]).length;
const THEME_FILES = { "src/entry.js": `import './theme.css'\n${HELLO_ENTRY}`, "src/theme.css": HELLO_CSS };
const LOOK_SCHEMA = "packages/theme-cli/src/core/look-schema.ts";
const PHONE = `${P}phone/`;
/** A JPEG's first bytes (SOI and an APP0 marker), then `size` more, which core's reader checks a .jpg for. */
const jpegBytes = (size: number): Uint8Array => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array<number>(size).fill(0)]);
/** Phone screenshots: one per look, one no preset claims, and one theme.json doesn't list. */
const PHONE_FILES: Readonly<Record<string, Uint8Array>> = {
  [`${PHONE}night-chat.jpg`]: jpegBytes(20), [`${PHONE}default.png`]: previewBytes(12),
  [`${PHONE}stray.jpg`]: jpegBytes(6), [`${PHONE}old.jpg`]: jpegBytes(10),
};
const PHONE_LISTED = [`${PHONE}night-chat.jpg`, `${PHONE}default.png`, `${PHONE}stray.jpg`];
const phoneBytes = (name: string): number => PHONE_FILES[`${PHONE}${name}`].length;

afterEach(() => {
  removeSeededFolders();
});

function review(packed: Seeded, probe = ISOLATED, expected = packed.digest): Promise<ReviewReport> {
  return reviewPackage(packed.zip, expected, { workDir: tempFolder(), tools: TOOLS, probe: async () => probe });
}

/** The hello theme with previews: two for its default look, one no preset claims, and one theme.json doesn't list. */
function withPreviews(manifest: Readonly<Record<string, unknown>> = {}): Promise<Seeded> {
  return packSeeded({ files: { ...THEME_FILES, ...PREVIEW_FILES }, manifest: { previews: LISTED, ...manifest }, entry: "src/entry.js" });
}

const EXPECTED_PREVIEWS = {
  cover: `${P}default.png`,
  presets: [
    {
      id: "default",
      default: true,
      previews: [
        { path: `${P}default.png`, bytes: bytesOf("default.png"), screen: null },
        { path: `${P}default-chat.png`, bytes: bytesOf("default-chat.png"), screen: "chat" },
      ],
    },
    { id: "night", default: false, previews: [] },
  ],
  unclaimed: [{ path: `${P}stray.png`, bytes: bytesOf("stray.png"), screen: null }],
  unlisted: [{ path: `${P}old.png`, bytes: bytesOf("old.png"), screen: null }],
};

describe("a seeded package's section", () => {
  it("lists each preset's previews with sizes, a preset with none, the unclaimed and the unlisted", async () => {
    const report = await review(await withPreviews());
    expect(report.previewsAndAccessibility?.previews).toEqual(EXPECTED_PREVIEWS);
    expect(previewsLines(EXPECTED_PREVIEWS)).toEqual([
      `Previews: 3 previews listed; the listing's cover is ${P}default.png, the first theme.json lists.`,
      "  - default (default look): 2 previews",
      `      ${P}default.png, ${bytesOf("default.png")} bytes`,
      `      ${P}default-chat.png, ${bytesOf("default-chat.png")} bytes, screen chat`,
      "  - night: no preview",
      `  - claimed by no preset (the listing shows it apart): ${P}stray.png, ${bytesOf("stray.png")} bytes`,
      `  - not listed in theme.json (packed, never shown): ${P}old.png, ${bytesOf("old.png")} bytes`,
    ]);
  });

  it("says when theme.json lists no previews, and lists each preset with none", async () => {
    const report = await review(await packSeeded({ files: THEME_FILES, entry: "src/entry.js" }));
    const previews = report.previewsAndAccessibility?.previews;
    expect(previews).toEqual({
      cover: null, unclaimed: [], unlisted: [],
      presets: [{ id: "default", default: true, previews: [] }, { id: "night", default: false, previews: [] }],
    });
    expect(previews && previewsLines(previews)[0]).toBe("Previews: theme.json lists none, so the Marketplace listing shows none.");
  });

  it("says contrast is not measured, and whether theme.json has a mobile block, whose pairs core's report measures", () => {
    const files = new Map<string, Uint8Array>();
    expect(previewsAndAccessibility({}, files).contrast).toEqual({ status: "not_measured", reason: CONTRAST_NOT_MEASURED, mobileBlock: false });
    expect(previewsAndAccessibility({ mobile: {} }, files).contrast.mobileBlock).toBe(true);
    const lines = (mobile: boolean) => sectionLines({ ...previewsAndAccessibility(mobile ? { mobile: {} } : {}, files) });
    expect(lines(true)).toEqual(expect.arrayContaining([`  ${CONTRAST_NOT_MEASURED}`, `    ${MOBILE_BLOCK}`, `  ${AXE_AFTER}`]));
    expect(lines(false)).toContain(`    ${NO_MOBILE_BLOCK}`);
  });

  it("measures no contrast only while core's look schema declares no text and ground pairs (schema, look and knobs alone)", () => {
    const schema = readFileSync(join(ROOT, LOOK_SCHEMA), "utf8");
    expect(schema).toContain("const SCHEMA_FIELDS: readonly string[] = ['schema', 'look', 'knobs']");
  });
});

describe("a seeded package's phone screenshots", () => {
  it("lists them per preset after the web previews, by the same rule, and leaves them out of the web's unlisted", async () => {
    const packed = await packSeeded({
      files: { ...THEME_FILES, ...PREVIEW_FILES, ...PHONE_FILES }, manifest: { previews: LISTED, phonePreviews: PHONE_LISTED }, entry: "src/entry.js",
    });
    const report = await review(packed);
    expect(report.outcome).toBe("pass");
    const section = report.previewsAndAccessibility;
    expect(section?.previews).toEqual(EXPECTED_PREVIEWS);
    expect(section?.phonePreviews).toEqual({
      cover: `${PHONE}night-chat.jpg`,
      presets: [
        { id: "default", default: true, previews: [{ path: `${PHONE}default.png`, bytes: phoneBytes("default.png"), screen: null }] },
        { id: "night", default: false, previews: [{ path: `${PHONE}night-chat.jpg`, bytes: phoneBytes("night-chat.jpg"), screen: "chat" }] },
      ],
      unclaimed: [{ path: `${PHONE}stray.jpg`, bytes: phoneBytes("stray.jpg"), screen: null }],
      unlisted: [{ path: `${PHONE}old.jpg`, bytes: phoneBytes("old.jpg"), screen: null }],
    });
    const phoneLines = [
      `Phone screenshots: 3 phone screenshots listed; the listing's phone cover is ${PHONE}night-chat.jpg, the first theme.json lists.`,
      "  - default (default look): 1 phone screenshot",
      `      ${PHONE}default.png, ${phoneBytes("default.png")} bytes`,
      "  - night: 1 phone screenshot",
      `      ${PHONE}night-chat.jpg, ${phoneBytes("night-chat.jpg")} bytes, screen chat`,
      `  - claimed by no preset (the listing shows it apart): ${PHONE}stray.jpg, ${phoneBytes("stray.jpg")} bytes`,
      `  - not listed in theme.json (packed, never shown): ${PHONE}old.jpg, ${phoneBytes("old.jpg")} bytes`,
    ];
    expect(section && phonePreviewsLines(section.phonePreviews)).toEqual(phoneLines);
    const lines = sectionLines(section ?? null);
    expect(lines.indexOf(`  ${phoneLines[0]}`)).toBeGreaterThan(lines.indexOf(`  ${previewsLines(EXPECTED_PREVIEWS)[0]}`));
    expect(lines.indexOf(`  ${phoneLines[0]}`)).toBeLessThan(lines.indexOf(`  ${CONTRAST_NOT_MEASURED}`));
  });

  it("adds no phone line for a package with no phone screenshot", () => {
    const files = new Map<string, Uint8Array>([["looks/presets/default.look.json", new Uint8Array()]]);
    expect(phonePreviewsLines(phonePreviewsReport({}, files))).toEqual([]);
    expect(sectionLines(previewsAndAccessibility({}, files)).some((line) => line.includes("Phone screenshots"))).toBe(false);
  });
});

describe("the review's outcome rules are unchanged by the section", () => {
  it("passes a package with stray and unlisted previews on its six checks alone, the section after the checks", async () => {
    const report = await review(await withPreviews());
    expect(report.checks.map((item) => [item.name, item.status])).toEqual(REVIEW_CHECKS.map((name) => [name, "pass"]));
    expect(report.outcome).toBe("pass");
    const lines = summaryText(report).split("\n");
    expect(lines.filter((line) => line.startsWith("Outcome:"))).toEqual(["Outcome: pass"]);
    expect(lines.indexOf(SECTION_HEAD)).toBeGreaterThan(lines.indexOf("Checks:"));
    expect(lines.slice(lines.indexOf(SECTION_HEAD) + 1).every((line) => line.startsWith("  "))).toBe(true);
  });

  it("still fails a package that isn't the version the queue named, with its section", async () => {
    const report = await review(await withPreviews(), ISOLATED, "0".repeat(64));
    expect(report.outcome).toBe("fail");
    expect(report.previewsAndAccessibility?.previews.cover).toBe(`${P}default.png`);
  });

  it("makes no section when the package is not read, and says so", async () => {
    const reached = await review(await withPreviews(), REACHED);
    expect(reached.previewsAndAccessibility).toBeNull();
    expect(summaryText(reached).split("\n")).toContain(SECTION_NOT_READ);
    const refused = await review({ zip: Buffer.from("not a zip"), digest: "0".repeat(64) });
    expect({ outcome: refused.outcome, section: refused.previewsAndAccessibility }).toEqual({ outcome: "fail", section: null });
  });
});
