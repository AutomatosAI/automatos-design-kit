// HUD's own package passes the whole Marketplace review in kit CI, as Play's does (tests/play-review.test.ts,
// PRD-261 C-06p2), so the review job (theme-review.yml) holds no surprise for HUD's release either. kit.yml's Build
// step has built themes/hud with its own vite.config.ts; tests/support/package-review.ts packs the folder as
// `npm run pack` does and reviews the package as scripts/review/main.ts does, the probe stubbed and the work folder
// outside the kit tree. HUD bundles the same two kit packages as Play, @automatos/look-kit and @automatos/mascot, so
// its source/ carries their src/ under source/packages/<name>/src/, and its committed look data (boot/, looks/) and
// its fonts and Auto's files (assets/) ship as they are in the folder. All six checks pass: no network, the package,
// the digest, source/, the JS rules (no finding, comments and strings included) and the reproducible build.
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PACKAGE_EXTENSION } from "@automatos/theme-cli";
import { readZip } from "@automatos/theme-cli/zip";
import { bundledPackages } from "@automatos/vite-preset";
import { SOURCE_FOLDER, SOURCE_PACKAGES_DIR } from "../packages/theme-cli/src/source.ts";
import {
  REVIEW_CHECKS, REVIEW_TIMEOUT_MS, differingPaths, expectedSource, packAndReview, removeReviewFolders, shippedSource,
  type Reviewed,
} from "./support/package-review.ts";

const KIT = fileURLToPath(new URL("../", import.meta.url));
const HUD = join(KIT, "themes", "hud");
const HUD_ID = "automatos/hud";
const HUD_VERSION = (JSON.parse(readFileSync(join(HUD, "theme.json"), "utf8")) as { version: string }).version;
/** The kit packages HUD's package.json names, which its build bundles and pack writes under source/packages/. */
const BUNDLED = ["@automatos/look-kit", "@automatos/mascot"];
/** A file of each bundled package that must be in the package's source/ (the AA math, the Pause control). */
const BUNDLED_FILES = ["look-kit/src/contrast.ts", "mascot/src/mascot-pause-button.tsx"];
/** Files HUD commits that its package carries as they are: the first paint, the look format and a display face. */
const COMMITTED_FILES = ["boot/prepaint.json", "looks/schema.json", "looks/presets/arc.look.json", "assets/fonts/rajdhani-latin-700-normal.woff2"];

let reviewed: Reviewed;

beforeAll(async () => {
  reviewed = await packAndReview(HUD, "automatos-hud-review-");
}, REVIEW_TIMEOUT_MS);

afterAll(() => {
  removeReviewFolders();
});

describe("HUD's own package", () => {
  it(`packs as automatos.hud-${HUD_VERSION}${PACKAGE_EXTENSION}`, () => {
    expect(basename(reviewed.file)).toBe(`automatos.hud-${HUD_VERSION}${PACKAGE_EXTENSION}`);
    expect(reviewed.report).toMatchObject({ id: HUD_ID, version: HUD_VERSION, digest: reviewed.digest });
  });

  it("is reviewed in a work folder outside the kit tree", () => {
    const fromKit = relative(KIT, reviewed.workDir);
    expect(fromKit.startsWith("..") || isAbsolute(fromKit)).toBe(true);
  });

  it("has no JS-rule findings in source/, comments and strings included", () => {
    const findings = reviewed.report.findings.map((item) => `${item.code} ${item.path}:${item.line} | ${item.excerpt}`);
    expect(findings).toEqual([]);
  });

  it("passes all six checks of the review", () => {
    const failed = reviewed.report.checks.filter((item) => item.status !== "pass");
    expect(failed.map(({ name, status, detail, items }) => ({ name, status, detail, items }))).toEqual([]);
    expect(reviewed.report.checks.map((item) => item.name)).toEqual(REVIEW_CHECKS);
    expect(reviewed.report.outcome).toBe("pass");
  });

  it("carries exactly themes/hud/src as source/ and its kit packages' src/ under source/packages/, byte for byte", () => {
    expect(bundledPackages(HUD).map((item) => item.name)).toEqual(BUNDLED);
    const expected = expectedSource(HUD);
    const present = BUNDLED_FILES.map((path) => `${SOURCE_FOLDER}/${SOURCE_PACKAGES_DIR}/${path}`);
    expect(Array.from(expected.keys())).toEqual(expect.arrayContaining([`${SOURCE_FOLDER}/entry.ts`, ...present]));
    const shipped = shippedSource(reviewed.zip);
    expect(Array.from(shipped.keys()).sort()).toEqual(Array.from(expected.keys()).sort());
    expect(differingPaths(expected, shipped)).toEqual([]);
  });

  it("carries its committed look data, fonts and Auto's files as the folder holds them", () => {
    const entries = new Map(readZip(reviewed.zip).map((entry): [string, Uint8Array] => [entry.path, entry.data]));
    const differing = COMMITTED_FILES.filter((path) => {
      const shipped = entries.get(path);
      return shipped === undefined || Buffer.compare(Buffer.from(shipped), readFileSync(join(HUD, path))) !== 0;
    });
    expect(differing).toEqual([]);
    expect(Array.from(entries.keys()).some((path) => path.startsWith("assets/mascot/"))).toBe(true);
  });

  it("rebuilds dist/ from source/ byte for byte (the differing paths are listed when not)", () => {
    const build = reviewed.report.checks.find((item) => item.name === "Reproducible build");
    expect(build?.items).toEqual([]);
    expect(build).toMatchObject({ status: "pass", detail: expect.stringContaining("byte for byte") });
  });
});
