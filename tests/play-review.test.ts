// PRD-261 C-06p2: Play's own package passes the whole Marketplace review in kit CI, so the review
// job (theme-review.yml) holds no surprise for its release. kit.yml's Build step has built
// themes/play with its own vite.config.ts, as its author builds it; this packs the folder as
// `npm run pack` does, into a temp folder, and reviews the package as scripts/review/main.ts does:
// the network probe stubbed (the workflow runs the real one in `docker run --network none`) and the
// work folder outside the kit tree, so the rebuilt theme folder finds neither the kit's tsconfig.json
// nor its node_modules above it, as in the job.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PACKAGE_EXTENSION, packTheme } from "@automatos/theme-cli";
import { ENTRY_PATH } from "@automatos/theme-cli/check";
import { readZip } from "@automatos/theme-cli/zip";
import { isHidden } from "../packages/theme-cli/src/collect.ts";
import { SOURCE_DIR, SOURCE_FOLDER } from "../packages/theme-cli/src/source.ts";
import { readTree } from "../scripts/review/rebuild.ts";
import { reviewPackage, type ReviewReport } from "../scripts/review/review.ts";
import type { ProbeResult } from "../scripts/review/probe.ts";

const KIT = fileURLToPath(new URL("../", import.meta.url));
const PLAY = join(KIT, "themes", "play");
const PLAY_ID = "automatos/play";
const PLAY_VERSION = (JSON.parse(readFileSync(join(PLAY, "theme.json"), "utf8")) as { version: string }).version;
const CHECKS = ["No network", "Package", "Digest", "Source", "JS rules", "Reproducible build"];
const TOOLS = { kitCommit: "test", node: process.version, vite: "test", preset: "test" };
const ISOLATED: ProbeResult = { isolated: true, lines: ["https://example.com/: failed (ENOTFOUND)"] };
/** Packing Play and rebuilding its source/ is a whole Vite build of the theme on a cold runner. */
const REVIEW_TIMEOUT_MS = 180_000;

interface Reviewed {
  readonly file: string;
  readonly zip: Buffer;
  readonly digest: string;
  readonly workDir: string;
  readonly report: ReviewReport;
}

const folders: string[] = [];
let reviewed: Reviewed;

function tempFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), "automatos-play-review-"));
  folders.push(folder);
  return folder;
}

/**
 * Runs `work` with NODE_ENV as the review job has it: unset (theme-review.yml's container sets
 * none), so Vite builds for production, as kit.yml's Build step did for the shipped dist/. Vitest
 * sets NODE_ENV=test, under which Vite's build gives import.meta.env DEV true and PROD false,
 * unlike the shipped dist/ (Play's vendored zustand reads import.meta.env).
 */
async function withJobNodeEnv<T>(work: () => Promise<T>): Promise<T> {
  const saved = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    return await work();
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
}

/** themes/play packed as `npm run pack` packs it, then reviewed as the review job reviews it. */
async function packAndReview(): Promise<Reviewed> {
  if (!existsSync(join(PLAY, ENTRY_PATH))) {
    throw new Error(`themes/play has no ${ENTRY_PATH}: kit.yml's Build step (npm run build) runs before the tests.`);
  }
  const packed = packTheme(PLAY, tempFolder());
  if (!packed.ok) throw new Error(packed.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join("\n"));
  const zip = readFileSync(packed.file);
  const workDir = tempFolder();
  const options = { workDir, tools: TOOLS, probe: async () => ISOLATED };
  const report = await withJobNodeEnv(() => reviewPackage(zip, packed.manifest.digest, options));
  return { file: packed.file, zip, digest: packed.manifest.digest, workDir, report };
}

/** The non-dot files under a folder, as pack copies them (source.ts skips dotfiles at every level). */
function packedTree(dir: string, prefix: string): Map<string, Uint8Array> {
  const tree = readTree(dir, prefix);
  return new Map(Array.from(tree).filter(([path]) => !path.slice(prefix.length).split("/").some(isHidden)));
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array): boolean {
  return a !== undefined && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
}

beforeAll(async () => {
  reviewed = await packAndReview();
}, REVIEW_TIMEOUT_MS);

afterAll(() => {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
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
    expect(reviewed.report.checks.map((item) => item.name)).toEqual(CHECKS);
    expect(reviewed.report.outcome).toBe("pass");
  });

  it("carries exactly themes/play/src as source/, byte for byte", () => {
    const prefix = `${SOURCE_FOLDER}/`;
    const expected = packedTree(join(PLAY, SOURCE_DIR), prefix);
    const shipped = new Map(readZip(reviewed.zip)
      .filter((entry) => entry.path.startsWith(prefix))
      .map((entry): [string, Uint8Array] => [entry.path, entry.data]));
    expect(Array.from(shipped.keys()).sort()).toEqual(Array.from(expected.keys()).sort());
    const differing = Array.from(expected).filter(([path, data]) => !sameBytes(shipped.get(path), data));
    expect(differing.map(([path]) => path)).toEqual([]);
  });

  it("rebuilds dist/ from source/ byte for byte (the differing paths are listed when not)", () => {
    const build = reviewed.report.checks.find((item) => item.name === "Reproducible build");
    expect(build?.items).toEqual([]);
    expect(build).toMatchObject({ status: "pass", detail: expect.stringContaining("byte for byte") });
  });
});
