import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { SkinError } from "../../lib/skins/format";
import { packSkin, type PackFile } from "../../lib/skins/pack";
import { validateSkin } from "../../lib/skins/validate";
import { formatBytes } from "../../lib/skins/validate-files";
import { parseSkinJson, readSkinFolder } from "./skin-source";
import { terminalSafe, type Io } from "./validate-cli";

// npm run pack <dir>: validates a skin source folder with the same rules as Studio, then writes
// dist/<slug>-<version>.autoskin. Nothing is written when the skin is invalid. Exit code 0 when
// packed, 1 when the skin is invalid or can't be read, 2 on misuse or a missing folder.

export const PACK_USAGE = "Usage: npm run pack <skin folder>";
export const DIST_DIR = "dist";

export interface PackOptions {
  /** Where the .autoskin goes. Default: dist/ under the current folder (the repo, under npm). */
  readonly outDir?: string;
}

function printErrors(target: string, errors: readonly SkinError[], io: Io): number {
  for (const error of errors) io.error(`✗ ${terminalSafe(error.path)}  ${terminalSafe(error.message)}`);
  io.error(`${errors.length} ${errors.length === 1 ? "problem" : "problems"} in ${target}. Nothing was packed.`);
  return 1;
}

/** The folder's files other than skin.json, read only after the validator accepted the folder. */
async function readFiles(dir: string, paths: readonly string[]): Promise<readonly PackFile[]> {
  return Promise.all(paths.map(async (path) => ({ path, bytes: new Uint8Array(await readFile(join(dir, path))) })));
}

type Checked = { readonly ok: true; readonly skinText: string; readonly paths: readonly string[] } | { readonly ok: false; readonly errors: readonly SkinError[] };

/** The folder through the validator, before a byte of its assets is read. */
async function checkFolder(dir: string): Promise<Checked> {
  const source = await readSkinFolder(dir);
  if (source.errors.length > 0 || source.skinJson === null) return { ok: false, errors: source.errors };
  const parsed = parseSkinJson(source.skinJson);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const checked = validateSkin(parsed.value, source.assets);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  return { ok: true, skinText: source.skinJson, paths: source.assets.map((asset) => asset.path) };
}

async function isFolder(target: string): Promise<boolean> {
  return (await lstat(target)).isDirectory();
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function pack(target: string, dir: string, io: Io, outDir: string): Promise<number> {
  const checked = await checkFolder(dir);
  if (!checked.ok) return printErrors(target, checked.errors, io);
  // packSkin validates again from the bytes it zips, so a file changed meanwhile is caught too.
  const packed = packSkin(checked.skinText, await readFiles(dir, checked.paths));
  if (!packed.ok) return printErrors(target, packed.errors, io);
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, packed.fileName);
  await writeFile(file, packed.bytes);
  const shown = relative(process.cwd(), file) || file;
  io.log(`✓ Packed ${packed.skin.name} into ${terminalSafe(shown)} (${formatBytes(packed.bytes.byteLength)}).`);
  return 0;
}

export async function runPack(args: readonly string[], io: Io, options: PackOptions = {}): Promise<number> {
  const target = args[0];
  if (!target || args.length > 1) {
    io.error(PACK_USAGE);
    return 2;
  }
  const dir = resolve(target);
  try {
    if (!(await isFolder(dir))) {
      io.error(`${target} isn't a folder. Give the skin's source folder (skin.json plus assets/).`);
      return 2;
    }
    return await pack(target, dir, io, resolve(options.outDir ?? DIST_DIR));
  } catch (error) {
    if (isMissing(error)) {
      io.error(`There's no folder at ${target}.`);
      return 2;
    }
    console.error(error);
    io.error(`Couldn't pack ${target}. The details are above.`);
    return 1;
  }
}
