import { lstat, open, readFile, readdir } from "node:fs/promises";
import { join, posix } from "node:path";
import { readSkinArchive } from "../../lib/skins/archive";
import { AUTOSKIN_EXTENSION } from "../../lib/skins/pack";
import { PACKAGE_MAX_BYTES, SKIN_FILE, type AssetEntry, type SkinError } from "../../lib/skins/format";
import { SNIFF_BYTES, sniffType } from "../../lib/skins/sniff";
import { formatBytes } from "../../lib/skins/validate-files";

// Node side of the CLI: turns a skin source folder or a .autoskin file into skin.json's text
// plus the asset manifest lib/skins/validate.ts checks. Never follows a symbolic link.

export const ARCHIVE_EXTENSION = AUTOSKIN_EXTENSION;
/** Files the operating system leaves in folders; never part of a skin, so never packed. */
const OS_JUNK: ReadonlySet<string> = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

export interface SkinSource {
  readonly skinJson: string | null;
  readonly assets: readonly AssetEntry[];
  /** The .autoskin's size on disk; absent for a folder (the validator sums the assets). */
  readonly packageBytes?: number;
  readonly errors: readonly SkinError[];
}

async function sniffFile(path: string): Promise<AssetEntry["sniffedType"]> {
  const handle = await open(path, "r");
  try {
    const head = new Uint8Array(SNIFF_BYTES);
    const { bytesRead } = await handle.read(head, 0, SNIFF_BYTES, 0);
    return sniffType(head.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

async function walk(root: string, relative: string): Promise<readonly AssetEntry[]> {
  const entries = await readdir(join(root, relative), { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => !OS_JUNK.has(entry.name))
      .filter((entry) => !(relative === "" && entry.name === SKIN_FILE))
      .map(async (entry): Promise<readonly AssetEntry[]> => {
        const path = relative === "" ? entry.name : posix.join(relative, entry.name);
        if (entry.isSymbolicLink()) return [{ path, bytes: 0, sniffedType: "unknown", link: true }];
        if (entry.isDirectory()) return walk(root, path);
        // A FIFO, socket or device would block or lie when read: listed, never opened.
        if (!entry.isFile()) return [{ path, bytes: 0, sniffedType: "unknown" }];
        const absolute = join(root, path);
        const { size } = await lstat(absolute);
        return [{ path, bytes: size, sniffedType: await sniffFile(absolute) }];
      }),
  );
  return nested.flat().sort((a, b) => a.path.localeCompare(b.path));
}

function folderError(assets: readonly AssetEntry[], message: string): SkinSource {
  return { skinJson: null, assets, errors: [{ path: "$", message }] };
}

export async function readSkinFolder(dir: string): Promise<SkinSource> {
  const assets = await walk(dir, "");
  const file = join(dir, SKIN_FILE);
  try {
    const stats = await lstat(file);
    if (stats.isSymbolicLink()) return folderError(assets, `${SKIN_FILE} is a link. Put the real file in its place.`);
    if (!stats.isFile()) return folderError(assets, `${SKIN_FILE} isn't a plain file.`);
    if (stats.size > PACKAGE_MAX_BYTES) return folderError(assets, `${SKIN_FILE} is larger than a whole package may be.`);
    const skinJson = await readFile(file, "utf8");
    return { skinJson, assets, errors: [] };
  } catch (error) {
    console.error(`Reading ${file} failed:`, error);
    return folderError(assets, `This folder has no readable ${SKIN_FILE}.`);
  }
}

export async function readSkinFile(file: string): Promise<SkinSource> {
  if (!file.endsWith(ARCHIVE_EXTENSION)) {
    return { skinJson: null, assets: [], errors: [{ path: "$", message: `Give a skin folder or a ${ARCHIVE_EXTENSION} file.` }] };
  }
  const { size } = await lstat(file);
  if (size > PACKAGE_MAX_BYTES) {
    const message = `The package is ${formatBytes(size)}; Studio accepts at most ${formatBytes(PACKAGE_MAX_BYTES)}.`;
    return { skinJson: null, assets: [], packageBytes: size, errors: [{ path: "$", message }] };
  }
  const bytes = new Uint8Array(await readFile(file));
  const archive = readSkinArchive(bytes);
  if (!archive.ok) return { skinJson: null, assets: [], packageBytes: bytes.byteLength, errors: archive.errors };
  const skinJson = new TextDecoder().decode(archive.skinJson);
  return { skinJson, assets: archive.assets, packageBytes: bytes.byteLength, errors: [] };
}

/** A folder or a .autoskin file. Throws (ENOENT…) when the path doesn't exist. */
export async function readSkinSource(target: string): Promise<SkinSource> {
  const stats = await lstat(target);
  return stats.isDirectory() ? readSkinFolder(target) : readSkinFile(target);
}

/** skin.json's text to a value, with a plain-word error (shared with pack). */
export { parseSkinJson } from "../../lib/skins/pack";
