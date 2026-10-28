// Seeded packages for the review's report-only section (PRD-261 B-02j: tests/theme-review-section.test.ts and
// tests/theme-review-axe.test.ts). The hello fixture theme (packages/theme-cli/test/fixtures/core/hello/) in a kit laid
// out in the system temp folder, themes/hello/ beside packages/<name>/ for each kit library it bundles, with the test's
// own files and theme.json fields over it, built with the kit's preset and packed with the theme CLI as its author
// would. Made-up data only: the previews are a PNG signature and a few bytes.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packTheme } from "@automatos/theme-cli";
import { buildThemeFolder } from "../../scripts/review/rebuild.ts";

export const HELLO = fileURLToPath(new URL("../../packages/theme-cli/test/fixtures/core/hello/", import.meta.url));
/** The hello theme's entry as its package ships it: plain modules, so it is also a TypeScript entry. */
export const HELLO_ENTRY = readFileSync(join(HELLO, "dist/entry.js"), "utf8");
export const HELLO_CSS = ".hello-frame { min-height: 100vh; }\n";
/** A PNG's eight-byte signature, which core's reader checks a preview for. */
export const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export type SeedFiles = Readonly<Record<string, string | Uint8Array>>;

export interface Seed {
  /** Files of the theme folder, over the fixture's theme.json, README.md and looks/. */
  readonly files: SeedFiles;
  /** Fields set in the fixture's theme.json. */
  readonly manifest?: Readonly<Record<string, unknown>>;
  /** The entry the preset builds; the files must hold it. */
  readonly entry: string;
  /** Kit libraries the theme bundles, by folder name under packages/: each one's files. */
  readonly packages?: Readonly<Record<string, SeedFiles>>;
}

export interface Seeded {
  readonly zip: Buffer;
  readonly digest: string;
}

const folders: string[] = [];

export function tempFolder(prefix = "automatos-seeded-"): string {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  folders.push(folder);
  return folder;
}

export function removeSeededFolders(): void {
  folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true }));
}

/** A preview's bytes: the PNG signature and `size` more bytes. */
export function previewBytes(size: number): Uint8Array {
  return Uint8Array.from([...PNG_SIGNATURE, ...new Array<number>(size).fill(0)]);
}

export function writeFiles(root: string, files: SeedFiles): void {
  Object.entries(files).forEach(([path, data]) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data);
  });
}

/** The seeded hello theme, built with the preset and packed; the package's bytes and digest. */
export async function packSeeded(seed: Seed): Promise<Seeded> {
  const kit = tempFolder();
  const root = join(kit, "themes", "hello");
  ["README.md", "looks"].forEach((path) => cpSync(join(HELLO, path), join(root, path), { recursive: true }));
  const manifest = { ...(JSON.parse(readFileSync(join(HELLO, "theme.json"), "utf8")) as object), ...seed.manifest };
  writeFiles(root, { ...seed.files, "theme.json": `${JSON.stringify(manifest, null, 2)}\n` });
  Object.entries(seed.packages ?? {}).forEach(([name, files]) => writeFiles(join(kit, "packages", name), files));
  await buildThemeFolder(root, seed.entry);
  const packed = packTheme(root, tempFolder());
  if (!packed.ok) throw new Error(packed.errors.map((error) => `${error.code} ${error.path}: ${error.message}`).join("\n"));
  return { zip: readFileSync(packed.file), digest: packed.manifest.digest };
}
