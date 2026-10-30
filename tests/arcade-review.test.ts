// Arcade's own package passes the whole Marketplace review in kit CI, as Play's and HUD's do (tests/play-review.test.ts,
// tests/hud-review.test.ts, PRD-261 C-06p2), so the review job (theme-review.yml) holds no surprise for Arcade's
// release either. kit.yml's Build step has built themes/arcade with its own vite.config.ts; tests/support/package-review.ts
// packs the folder as `npm run pack` does and reviews the package as scripts/review/main.ts does, the probe stubbed
// and the work folder outside the kit tree. Unlike Play and HUD, Arcade bundles @automatos/mascot alone, not
// @automatos/look-kit, so its source/ carries only mascot's src/ under source/packages/mascot/src/; its committed
// look data (boot/, looks/) and its fonts and Auto's sprite files (assets/) ship as they are in the folder. All six
// checks pass: no network, the package, the digest, source/, the JS rules (no finding, comments and strings
// included) and the reproducible build.
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
const ARCADE = join(KIT, "themes", "arcade");
const ARCADE_ID = "automatos/arcade";
const ARCADE_VERSION = (JSON.parse(readFileSync(join(ARCADE, "theme.json"), "utf8")) as { version: string }).version;
/** The kit packages Arcade's package.json names, which its build bundles and pack writes under source/packages/. */
const BUNDLED = ["@automatos/mascot"];
/** A file of the bundled package that must be in the package's source/ (the Pause control). */
const BUNDLED_FILES = ["mascot/src/mascot-pause-button.tsx"];
/** Files Arcade commits that its package carries as they are: the first paint, the look format and a font. */
const COMMITTED_FILES = [
  "boot/prepaint.json", "looks/schema.json", "looks/presets/overworld.look.json",
  "assets/fonts/press-start-2p-latin-400-normal.woff2",
];

let reviewed: Reviewed;

beforeAll(async () => {
  reviewed = await packAndReview(ARCADE, "automatos-arcade-review-");
}, REVIEW_TIMEOUT_MS);

afterAll(() => {
  removeReviewFolders();
});

describe("Arcade's own package", () => {
  it(`packs as automatos.arcade-${ARCADE_VERSION}${PACKAGE_EXTENSION}`, () => {
    expect(basename(reviewed.file)).toBe(`automatos.arcade-${ARCADE_VERSION}${PACKAGE_EXTENSION}`);
    expect(reviewed.report).toMatchObject({ id: ARCADE_ID, version: ARCADE_VERSION, digest: reviewed.digest });
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

  it("carries exactly themes/arcade/src as source/ and mascot's src/ under source/packages/, byte for byte", () => {
    expect(bundledPackages(ARCADE).map((item) => item.name)).toEqual(BUNDLED);
    const expected = expectedSource(ARCADE);
    const present = BUNDLED_FILES.map((path) => `${SOURCE_FOLDER}/${SOURCE_PACKAGES_DIR}/${path}`);
    expect(Array.from(expected.keys())).toEqual(expect.arrayContaining([`${SOURCE_FOLDER}/entry.ts`, ...present]));
    const shipped = shippedSource(reviewed.zip);
    expect(Array.from(shipped.keys()).sort()).toEqual(Array.from(expected.keys()).sort());
    expect(differingPaths(expected, shipped)).toEqual([]);
  });

  it("carries its committed look data, fonts and Auto's stills as the folder holds them", () => {
    const entries = new Map(readZip(reviewed.zip).map((entry): [string, Uint8Array] => [entry.path, entry.data]));
    const differing = COMMITTED_FILES.filter((path) => {
      const shipped = entries.get(path);
      return shipped === undefined || Buffer.compare(Buffer.from(shipped), readFileSync(join(ARCADE, path))) !== 0;
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
