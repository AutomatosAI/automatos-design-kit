import { zipSync, type Zippable, type ZippableFile } from "fflate";
import { readSkinArchive } from "./archive";
import { PACKAGE_MAX_BYTES, SKIN_FILE, type AssetEntry, type Skin, type SkinError } from "./format";
import { sniffType } from "./sniff";
import { validateSkin } from "./validate";
import { formatBytes } from "./validate-files";

// Packing and unpacking a .autoskin (PRD-004 K-007): skin.json plus its assets/ files in one zip.
// Both directions go through the one validator first (the same rules as npm run validate), so
// an invalid skin is never written and never loaded into the editor. Like the validate CLI, a
// contrast pair the skin sets only one side of isn't checked against the base (K-010's
// PAIR_INCOMPLETE replaces that). Pure; relative imports only (the pack CLI runs this under tsx).

export const AUTOSKIN_EXTENSION = ".autoskin";
export const AUTOSKIN_TYPE = "application/zip";

/** Fonts, PNG and video are compressed already: stored as they are. skin.json is deflated. */
const STORED = { level: 0 } as const;
const DEFLATED = { level: 6 } as const;
/** Every entry gets the same date, so packing the same skin twice gives the same bytes. */
const ENTRY_DATE = new Date(2026, 0, 1);

/** One file of a package other than skin.json: its package path and bytes. */
export interface PackFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export type PackResult =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly fileName: string; readonly skin: Skin }
  | { readonly ok: false; readonly errors: readonly SkinError[] };

export type UnpackResult =
  | { readonly ok: true; readonly skin: Skin; readonly skinText: string; readonly files: readonly PackFile[] }
  | { readonly ok: false; readonly errors: readonly SkinError[] };

export type ParsedJson = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: SkinError };

/** JSON.parse with a plain-word error; a leading byte-order mark is allowed. */
export function parseSkinJson(text: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(text.replace(/^\uFEFF/, "")) as unknown };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { path: "$", message: `${SKIN_FILE} isn't valid JSON: ${detail}` } };
  }
}

/** "<slug>-<version>.autoskin", the name `npm run pack` and Export both use. */
export function packageFileName(skin: Pick<Skin, "slug" | "version">): string {
  return `${skin.slug}-${skin.version}${AUTOSKIN_EXTENSION}`;
}

/** What the validator reads about each file: its path, size and type by its first bytes. */
export function manifestOf(files: readonly PackFile[]): readonly AssetEntry[] {
  return files.map((file) => ({ path: file.path, bytes: file.bytes.byteLength, sniffedType: sniffType(file.bytes) }));
}

function entries(skinBytes: Uint8Array, files: readonly PackFile[]): Zippable {
  const pairs: [string, ZippableFile][] = [
    [SKIN_FILE, [skinBytes, { ...DEFLATED, mtime: ENTRY_DATE }]],
    ...files.map((file): [string, ZippableFile] => [file.path, [file.bytes, { ...STORED, mtime: ENTRY_DATE }]]),
  ];
  return Object.fromEntries(pairs);
}

/**
 * Packs skin.json's text (kept byte for byte) and the files it names into a .autoskin.
 * Refuses, with the validator's errors, anything Studio would refuse.
 */
export function packSkin(skinText: string, files: readonly PackFile[]): PackResult {
  const parsed = parseSkinJson(skinText);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const checked = validateSkin(parsed.value, manifestOf(files));
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const bytes = zipSync(entries(new TextEncoder().encode(skinText), files));
  if (bytes.byteLength > PACKAGE_MAX_BYTES) {
    const message = `The package would be ${formatBytes(bytes.byteLength)}; Studio accepts at most ${formatBytes(PACKAGE_MAX_BYTES)}.`;
    return { ok: false, errors: [{ path: "$", message }] };
  }
  return { ok: true, bytes, fileName: packageFileName(checked.skin), skin: checked.skin };
}

function decodeSkinText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    console.error(`${SKIN_FILE} in a .autoskin isn't UTF-8 text:`, error);
    return null;
  }
}

/** Reads a .autoskin back: the validated skin, skin.json's text and the package's files. */
export function unpackSkin(bytes: Uint8Array): UnpackResult {
  const archive = readSkinArchive(bytes);
  if (!archive.ok) return { ok: false, errors: archive.errors };
  const skinText = decodeSkinText(archive.skinJson);
  if (skinText === null) return { ok: false, errors: [{ path: "$", message: `${SKIN_FILE} isn't UTF-8 text.` }] };
  const parsed = parseSkinJson(skinText);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const checked = validateSkin(parsed.value, archive.assets, { packageBytes: bytes.byteLength });
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const files = [...archive.files]
    .map(([path, data]) => ({ path, bytes: data }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, skin: checked.skin, skinText, files };
}
