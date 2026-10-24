// A kit theme's own package through the whole Marketplace review, as the review job (theme-review.yml) runs it: the
// theme folder packed as `npm run pack` packs it, into a temp folder, and the package reviewed as
// scripts/review/main.ts reviews it, the network probe stubbed (the workflow runs the real one in
// `docker run --network none`) and the work folder outside the kit tree, so the rebuilt theme folder finds neither the
// kit's tsconfig.json nor its node_modules above it, as in the job. Shared by tests/play-review.test.ts and
// tests/hud-review.test.ts, which hold Play's and HUD's packages to it; kit.yml's Build step has built each theme
// with its own vite.config.ts first, as its author builds it.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packTheme } from "@automatos/theme-cli";
import { ENTRY_PATH } from "@automatos/theme-cli/check";
import { readZip } from "@automatos/theme-cli/zip";
import { bundledPackages, kitPackageFolder } from "@automatos/vite-preset";
import { isHidden } from "../../packages/theme-cli/src/collect.ts";
import { SOURCE_DIR, SOURCE_FOLDER, SOURCE_PACKAGES_DIR } from "../../packages/theme-cli/src/source.ts";
import { readTree } from "../../scripts/review/rebuild.ts";
import { reviewPackage, type ReviewReport } from "../../scripts/review/review.ts";
import type { ProbeResult } from "../../scripts/review/probe.ts";

/** The review's six checks, in its order. */
export const REVIEW_CHECKS = ["No network", "Package", "Digest", "Source", "JS rules", "Reproducible build"];
/** Packing a theme and rebuilding its source/ is a whole Vite build of the theme on a cold runner. */
export const REVIEW_TIMEOUT_MS = 180_000;
const TOOLS = { kitCommit: "test", node: process.version, vite: "test", preset: "test" };
const ISOLATED: ProbeResult = { isolated: true, lines: ["https://example.com/: failed (ENOTFOUND)"] };

export interface Reviewed {
  readonly file: string;
  readonly zip: Buffer;
  readonly digest: string;
  readonly workDir: string;
  readonly report: ReviewReport;
}

/** The temp folders the reviews made, removed by removeReviewFolders. */
const folders: string[] = [];

function tempFolder(prefix: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  folders.push(folder);
  return folder;
}

export function removeReviewFolders(): void {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
}

/**
 * Runs `work` with NODE_ENV as the review job has it: unset (theme-review.yml's container sets
 * none), as kit.yml's Build step had it for the shipped dist/. Vitest sets NODE_ENV=test; the
 * preset pins import.meta.env's DEV, PROD and MODE to a production build's whatever NODE_ENV says
 * (packages/vite-preset/test/preset-env.test.ts; Play's vendored zustand reads import.meta.env),
 * and this keeps the rest of the run as the job has it too.
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

/** The theme folder packed as `npm run pack` packs it, then reviewed as the review job reviews it. */
export async function packAndReview(themeDir: string, prefix: string): Promise<Reviewed> {
  if (!existsSync(join(themeDir, ENTRY_PATH))) {
    throw new Error(`${themeDir} has no ${ENTRY_PATH}: kit.yml's Build step (npm run build) runs before the tests.`);
  }
  const packed = packTheme(themeDir, tempFolder(prefix));
  if (!packed.ok) throw new Error(packed.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join("\n"));
  const zip = readFileSync(packed.file);
  const workDir = tempFolder(prefix);
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

/** What the package's source/ must hold: the theme's src/ and, under source/packages/, each bundled kit package's src/. */
export function expectedSource(themeDir: string): Map<string, Uint8Array> {
  const prefix = `${SOURCE_FOLDER}/`;
  const packagesPrefix = `${prefix}${SOURCE_PACKAGES_DIR}/`;
  const bundled = bundledPackages(themeDir).flatMap((item) => [
    ...packedTree(join(item.dir, SOURCE_DIR), `${packagesPrefix}${kitPackageFolder(item.name)}/${SOURCE_DIR}/`),
  ]);
  return new Map([...packedTree(join(themeDir, SOURCE_DIR), prefix), ...bundled]);
}

/** The package's source/ as it shipped, by path. */
export function shippedSource(zip: Buffer): Map<string, Uint8Array> {
  const prefix = `${SOURCE_FOLDER}/`;
  return new Map(readZip(zip)
    .filter((entry) => entry.path.startsWith(prefix))
    .map((entry): [string, Uint8Array] => [entry.path, entry.data]));
}

/** The paths of `expected` whose bytes `shipped` doesn't hold exactly. */
export function differingPaths(expected: ReadonlyMap<string, Uint8Array>, shipped: ReadonlyMap<string, Uint8Array>): string[] {
  return Array.from(expected).filter(([path, data]) => !sameBytes(shipped.get(path), data)).map(([path]) => path);
}
