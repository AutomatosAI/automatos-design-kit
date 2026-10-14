import {
  FONTS_DIR,
  FONT_FILE_PATTERN,
  FONT_MAX_BYTES,
  MASCOT_DIR,
  MASCOT_FORMATS,
  MASCOT_MAX_BYTES,
  MASCOT_STATES,
  type SniffedType,
} from "./format";
import { sniffType } from "./sniff";
import { echo } from "./validate-common";
import { formatBytes } from "./validate-files";

// The editor's font and mascot files (PRD-004 K-006): what a dropped file becomes in the draft,
// and the same checks the validator makes, in words a designer can act on. A file's type is
// read from its first bytes, never its name. Pure; relative imports only.

type MascotState = (typeof MASCOT_STATES)[number];
type MascotFormat = (typeof MASCOT_FORMATS)[number];

/** A file the draft holds: its package path, the name it was dropped with, and its bytes. */
export interface StoredAsset {
  readonly path: string;
  readonly name: string;
  readonly bytes: Uint8Array;
}

/** A file as the person dropped it. */
export interface DroppedFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export const MIME_TYPES: Readonly<Record<Exclude<SniffedType, "unknown">, string>> = {
  woff2: "font/woff2",
  png: "image/png",
  webm: "video/webm",
  mp4: "video/mp4",
};

const TYPE_WORDS: Readonly<Record<SniffedType, string>> = {
  woff2: "a woff2 font",
  png: "a PNG image",
  webm: "a WebM video",
  mp4: "an MP4 video",
  unknown: "something else",
};

const FONT_STEM_MAX = 48;
const MASCOT_FILE_COUNT = MASCOT_STATES.length * MASCOT_FORMATS.length;

/** A copy of the bytes as their own ArrayBuffer (a Uint8Array may view part of a bigger one). */
export function ownBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

/** The MIME type for a stored file, from its bytes. */
export function mimeType(bytes: Uint8Array): string {
  const type = sniffType(bytes);
  return type === "unknown" ? "application/octet-stream" : MIME_TYPES[type];
}

/**
 * Where a dropped font goes in the package: the slot, then its name made safe, e.g.
 * "assets/fonts/sans-My-Face.woff2". The slot keeps two slots' files apart even when they
 * share a name; a new file for the same slot and name replaces the old one.
 */
export function fontAssetPath(fileName: string, slot: string): string {
  const stem = fileName
    .replace(/\.woff2$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FONT_STEM_MAX)
    .replace(/-+$/, "");
  const path = `${FONTS_DIR}${stem === "" ? slot : `${slot}-${stem}`}.woff2`;
  return FONT_FILE_PATTERN.test(path) ? path : `${FONTS_DIR}${slot}.woff2`;
}

export type FontCheck = { readonly ok: true; readonly asset: StoredAsset } | { readonly ok: false; readonly message: string };

/** Why a font file is too big, or null: checked before a file is read at all. */
export function fontSizeProblem(name: string, bytes: number): string | null {
  if (bytes <= FONT_MAX_BYTES) return null;
  return `${echo(name)} is ${formatBytes(bytes)}; a font may be at most ${formatBytes(FONT_MAX_BYTES)}. Subset it to the characters you need.`;
}

/** A font must be woff2 by its first bytes and at most 400 KB. */
export function checkFontFile(file: DroppedFile, slot: string): FontCheck {
  const type = sniffType(file.bytes);
  if (type !== "woff2") {
    return {
      ok: false,
      message: `${echo(file.name)} isn't a woff2 font: its first bytes say it is ${TYPE_WORDS[type]}. Convert it to .woff2 and drop it again.`,
    };
  }
  const tooBig = fontSizeProblem(file.name, file.bytes.length);
  if (tooBig !== null) return { ok: false, message: tooBig };
  return { ok: true, asset: { path: fontAssetPath(file.name, slot), name: file.name, bytes: file.bytes } };
}

// The custom mascot: 12 states × webm, mp4 and png, named <state>.<format>.

function isState(value: string): value is MascotState {
  return (MASCOT_STATES as readonly string[]).includes(value);
}

function isFormat(value: string): value is MascotFormat {
  return (MASCOT_FORMATS as readonly string[]).includes(value);
}

interface MascotName {
  readonly state: MascotState;
  readonly format: MascotFormat;
}

function parseMascotName(fileName: string): MascotName | null {
  const match = /^([a-z]+)\.([a-z0-9]+)$/.exec(fileName.toLowerCase());
  if (!match) return null;
  const [, state = "", format = ""] = match;
  return isState(state) && isFormat(format) ? { state, format } : null;
}

/** The package path for a dropped mascot file, or null when its name isn't <state>.<format>. */
export function mascotAssetPath(fileName: string): string | null {
  const parsed = parseMascotName(fileName);
  return parsed === null ? null : mascotClipPath(parsed.state, parsed.format);
}

export function mascotClipPath(state: MascotState, format: MascotFormat): string {
  return `${MASCOT_DIR}${state}.${format}`;
}

export function isMascotPath(path: string): boolean {
  return path.startsWith(MASCOT_DIR);
}

export interface MissingState {
  readonly state: MascotState;
  readonly formats: readonly MascotFormat[];
}

/** The states with files still missing from a custom set, in MASCOT_STATES order. */
export function missingMascotFiles(paths: ReadonlySet<string>): readonly MissingState[] {
  return MASCOT_STATES.flatMap((state) => {
    const formats = MASCOT_FORMATS.filter((format) => !paths.has(mascotClipPath(state, format)));
    return formats.length === 0 ? [] : [{ state, formats }];
  });
}

/** "hello (webm, mp4, png), oops (png)". */
export function describeMissing(missing: readonly MissingState[]): string {
  return missing.map(({ state, formats }) => `${state} (${formats.join(", ")})`).join(", ");
}

/** What the custom set needs next, in words. */
export function mascotSetSummary(paths: ReadonlySet<string>): string {
  const missing = missingMascotFiles(paths);
  if (missing.length === 0) return `All ${MASCOT_FILE_COUNT} files are here.`;
  const have = MASCOT_FILE_COUNT - missing.reduce((sum, entry) => sum + entry.formats.length, 0);
  return `${have} of ${MASCOT_FILE_COUNT} files. Missing: ${describeMissing(missing)}.`;
}

export function totalBytes(assets: readonly StoredAsset[]): number {
  return assets.reduce((sum, asset) => sum + asset.bytes.length, 0);
}

/** True for a file a custom set uses: <state>.<format>, not a hidden OS file. */
export function isMascotFileName(name: string): boolean {
  return !name.startsWith(".") && mascotAssetPath(name) !== null;
}

/** Why a drop is too big to read at all (its files alone pass the 8 MB cap), or null. */
export function mascotDropSizeProblem(bytes: number): string | null {
  if (bytes <= MASCOT_MAX_BYTES) return null;
  return `These files come to ${formatBytes(bytes)}; together a mascot's files may be at most ${formatBytes(MASCOT_MAX_BYTES)}. Nothing was added.`;
}

export interface MascotDrop {
  /** The files to keep (new ones replace stored files of the same name). */
  readonly accepted: readonly StoredAsset[];
  /** Plain sentences: files refused, names not used, or a set over the size cap. */
  readonly problems: readonly string[];
}

function sniffProblem(file: DroppedFile, expected: MascotFormat): string | null {
  const found = sniffType(file.bytes);
  return found === expected ? null : `${echo(file.name)} isn't ${TYPE_WORDS[expected]}: its first bytes say it is ${TYPE_WORDS[found]}.`;
}

function unusedProblem(names: readonly string[]): string[] {
  if (names.length === 0) return [];
  const shown = names.slice(0, 6).map(echo).join(", ");
  const more = names.length > 6 ? ` and ${names.length - 6} more` : "";
  return [`Not used: ${shown}${more}. A mascot file is named <state>.webm, .mp4 or .png, such as idle.webm.`];
}

/**
 * Checks dropped files against the custom set already stored: names, types by first bytes,
 * and the 8 MB total. A file with the wrong type is refused on its own; a drop that would take
 * the set over 8 MB is refused whole. Files that aren't mascot clips are skipped (OS files
 * such as .DS_Store silently).
 */
export function checkMascotDrop(stored: readonly StoredAsset[], dropped: readonly DroppedFile[]): MascotDrop {
  const visible = dropped.filter((file) => !file.name.startsWith("."));
  const named = visible.map((file) => ({ file, clip: parseMascotName(file.name) }));
  const unused = named.filter((entry) => entry.clip === null).map((entry) => entry.file.name);
  const checked = named.flatMap(({ file, clip }) =>
    clip === null ? [] : [{ file, path: mascotClipPath(clip.state, clip.format), problem: sniffProblem(file, clip.format) }],
  );
  const typeProblems = checked.flatMap((entry) => entry.problem ?? []);
  const good = checked.filter((entry) => entry.problem === null);
  const latest = new Map(good.map(({ file, path }) => [path, { path, name: file.name, bytes: file.bytes }] as const));
  const accepted = [...latest.values()];
  const kept = stored.filter((asset) => isMascotPath(asset.path) && !latest.has(asset.path));
  const total = totalBytes([...kept, ...accepted]);
  if (total > MASCOT_MAX_BYTES) {
    const sizeProblem = `These files would bring the mascot to ${formatBytes(total)}; together its files may be at most ${formatBytes(MASCOT_MAX_BYTES)}. Nothing was added.`;
    return { accepted: [], problems: [...typeProblems, sizeProblem, ...unusedProblem(unused)] };
  }
  return { accepted, problems: [...typeProblems, ...unusedProblem(unused)] };
}
