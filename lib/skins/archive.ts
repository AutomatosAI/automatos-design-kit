import { unzipSync } from "fflate";
import { PACKAGE_MAX_BYTES, SKIN_FILE, type AssetEntry, type SkinError } from "./format";
import { sniffType } from "./sniff";
import { formatBytes } from "./validate-files";

// Reads a .autoskin (a zip) into skin.json's bytes plus the asset manifest the validator checks.
// fflate unpacks; the central directory is read here too, because fflate doesn't report what a
// zip says about symbolic links, and the declared sizes are checked before anything is inflated.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN = 22;
const COMMENT_MAX = 0xffff;
const HOST_UNIX = 3;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

export interface ArchiveEntry {
  readonly name: string;
  readonly bytes: number;
  readonly link: boolean;
}

export type SkinArchive =
  | { readonly ok: true; readonly skinJson: Uint8Array; readonly assets: readonly AssetEntry[]; readonly files: ReadonlyMap<string, Uint8Array> }
  | { readonly ok: false; readonly errors: readonly SkinError[] };

function findEndRecord(view: DataView): number | null {
  const last = view.byteLength - EOCD_MIN;
  for (let at = last; at >= 0 && at >= last - COMMENT_MAX; at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) return at;
  }
  return null;
}

function readEntry(bytes: Uint8Array, view: DataView, at: number): { entry: ArchiveEntry; next: number } | null {
  if (at + 46 > view.byteLength || view.getUint32(at, true) !== CENTRAL_SIGNATURE) return null;
  const host = view.getUint16(at + 4, true) >> 8;
  const size = view.getUint32(at + 24, true);
  const nameLength = view.getUint16(at + 28, true);
  const extraLength = view.getUint16(at + 30, true);
  const commentLength = view.getUint16(at + 32, true);
  const mode = view.getUint32(at + 38, true) >>> 16;
  const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
  const link = host === HOST_UNIX && (mode & S_IFMT) === S_IFLNK;
  return { entry: { name, bytes: size, link }, next: at + 46 + nameLength + extraLength + commentLength };
}

/** Every entry the zip's central directory lists, or null when it isn't a (non-zip64) zip. */
export function listArchive(bytes: Uint8Array): readonly ArchiveEntry[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength >= EOCD_MIN ? findEndRecord(view) : null;
  if (end === null) return null;
  const count = view.getUint16(end + 10, true);
  const entries: ArchiveEntry[] = [];
  let at = view.getUint32(end + 16, true);
  for (let index = 0; index < count; index += 1) {
    const read = readEntry(bytes, view, at);
    if (!read) return null;
    entries.push(read.entry);
    at = read.next;
  }
  return entries;
}

function failure(message: string): SkinArchive {
  return { ok: false, errors: [{ path: "$", message }] };
}

function unpack(bytes: Uint8Array, entries: readonly ArchiveEntry[]): Readonly<Record<string, Uint8Array>> | string {
  const wanted = new Set(entries.filter((entry) => !entry.link).map((entry) => entry.name));
  try {
    return unzipSync(bytes, { filter: (file) => wanted.has(file.name) && !file.name.endsWith("/") });
  } catch (error) {
    console.error("Unpacking a .autoskin failed:", error);
    return error instanceof Error ? error.message : String(error);
  }
}

function toAsset(entry: ArchiveEntry, data: Uint8Array | undefined): AssetEntry {
  if (entry.link || !data) return { path: entry.name, bytes: entry.bytes, sniffedType: "unknown", ...(entry.link ? { link: true } : {}) };
  return { path: entry.name, bytes: data.byteLength, sniffedType: sniffType(data) };
}

export function readSkinArchive(bytes: Uint8Array): SkinArchive {
  if (bytes.byteLength > PACKAGE_MAX_BYTES) {
    return failure(`The package is ${formatBytes(bytes.byteLength)}; Studio accepts at most ${formatBytes(PACKAGE_MAX_BYTES)}.`);
  }
  const entries = listArchive(bytes);
  if (!entries) return failure("This isn't a .autoskin file: it isn't a zip Studio can read.");
  const unpacked = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (unpacked > PACKAGE_MAX_BYTES) {
    return failure(`The package unpacks to ${formatBytes(unpacked)}; a skin may hold at most ${formatBytes(PACKAGE_MAX_BYTES)}.`);
  }
  const skinEntries = entries.filter((entry) => entry.name === SKIN_FILE);
  if (skinEntries.length > 1) return failure(`The package holds ${SKIN_FILE} more than once.`);
  if (skinEntries[0]?.link) return failure(`${SKIN_FILE} is a link. Put the real file in its place.`);
  const files = unpack(bytes, entries);
  if (typeof files === "string") return failure(`This .autoskin couldn't be unpacked: ${files}`);
  const skinJson = files[SKIN_FILE];
  if (!skinJson) return failure(`The package has no ${SKIN_FILE} at its top level.`);
  const assets = entries
    .filter((entry) => entry.name !== SKIN_FILE && !entry.name.endsWith("/"))
    .map((entry) => toAsset(entry, files[entry.name]));
  const contents = new Map(Object.entries(files).filter(([name]) => name !== SKIN_FILE));
  return { ok: true, skinJson, assets, files: contents };
}
