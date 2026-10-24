// PRD-261 C-06p2: Play's own package passes the whole Marketplace review in kit CI, so the review
// job (theme-review.yml) holds no surprise for its release. kit.yml's Build step has built
// themes/play with its own vite.config.ts, as its author builds it; this packs the folder as
// `npm run pack` does, into a temp folder, and reviews the package as scripts/review/main.ts does:
// the network probe stubbed (the workflow runs the real one in `docker run --network none`) and the
// work folder outside the kit tree, so the rebuilt theme folder finds neither the kit's tsconfig.json
// nor its node_modules above it, as in the job. PRD-261 B-01i: Play bundles two kit workspace packages,
// @automatos/look-kit and @automatos/mascot, so its source/ carries their src/ too, under
// source/packages/<name>/src/, and the review rebuilds them beside the theme. The packing and the review
// are tests/support/package-review.ts, which HUD's proof (tests/hud-review.test.ts) shares.
import { readFileSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PACKAGE_EXTENSION } from "@automatos/theme-cli";
import { bundledPackages } from "@automatos/vite-preset";
import { SOURCE_FOLDER, SOURCE_PACKAGES_DIR } from "../packages/theme-cli/src/source.ts";
import {
  REVIEW_CHECKS, REVIEW_TIMEOUT_MS, differingPaths, expectedSource, packAndReview, removeReviewFolders, shippedSource,
  type Reviewed,
} from "./support/package-review.ts";

const KIT = fileURLToPath(new URL("../", import.meta.url));
const PLAY = join(KIT, "themes", "play");
const PLAY_ID = "automatos/play";
const PLAY_VERSION = (JSON.parse(readFileSync(join(PLAY, "theme.json"), "utf8")) as { version: string }).version;
/** The kit packages Play's package.json names, which its build bundles and pack writes under source/packages/. */
const BUNDLED = ["@automatos/look-kit", "@automatos/mascot"];
/** A file of each bundled package that must be in the package's source/ (the AA math, the Pause control). */
const BUNDLED_FILES = ["look-kit/src/contrast.ts", "mascot/src/mascot-pause-button.tsx"];

let reviewed: Reviewed;

beforeAll(async () => {
  reviewed = await packAndReview(PLAY, "automatos-play-review-");
}, REVIEW_TIMEOUT_MS);

afterAll(() => {
  removeReviewFolders();
});

describe("Play's own package", () => {
  it(`packs as automatos.play-${PLAY_VERSION}${PACKAGE_EXTENSION}`, () => {
    expect(basename(reviewed.file)).toBe(`automatos.play-${PLAY_VERSION}${PACKAGE_EXTENSION}`);
    expect(reviewed.report).toMatchObject({ id: PLAY_ID, version: PLAY_VERSION, digest: reviewed.digest });
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

  it("carries exactly themes/play/src as source/ and its kit packages' src/ under source/packages/, byte for byte", () => {
    expect(bundledPackages(PLAY).map((item) => item.name)).toEqual(BUNDLED);
    const expected = expectedSource(PLAY);
    const present = BUNDLED_FILES.map((path) => `${SOURCE_FOLDER}/${SOURCE_PACKAGES_DIR}/${path}`);
    expect(Array.from(expected.keys())).toEqual(expect.arrayContaining(present));
    const shipped = shippedSource(reviewed.zip);
    expect(Array.from(shipped.keys()).sort()).toEqual(Array.from(expected.keys()).sort());
    expect(differingPaths(expected, shipped)).toEqual([]);
  });

  it("rebuilds dist/ from source/ byte for byte (the differing paths are listed when not)", () => {
    const build = reviewed.report.checks.find((item) => item.name === "Reproducible build");
    expect(build?.items).toEqual([]);
    expect(build).toMatchObject({ status: "pass", detail: expect.stringContaining("byte for byte") });
  });
});
