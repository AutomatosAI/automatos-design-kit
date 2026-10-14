import {
  ASSETS_DIR,
  FONT_FILE_PATTERN,
  FONT_MAX_BYTES,
  FONT_SLOTS,
  MASCOT_DIR,
  MASCOT_FORMATS,
  MASCOT_MAX_BYTES,
  MASCOT_STATES,
  PACKAGE_MAX_BYTES,
  PREVIEW_MAX_BYTES,
  mascotFiles,
  type AssetEntry,
  type SkinError,
  type SkinFonts,
  type SkinMascot,
  type SniffedType,
} from "./format";
import { echo } from "./validate-common";

// The package's files against what skin.json names: only assets/, plain paths, no links, no
// unknown files, the right type by first bytes, and the size caps of PRD-259 §3.

type Group = "font" | "mascot" | "preview";

interface Expected {
  readonly type: SniffedType;
  readonly group: Group;
  readonly ref: string;
}

export interface NamedFiles {
  readonly fonts: SkinFonts | undefined;
  readonly mascot: SkinMascot | undefined;
  readonly preview: string | undefined;
  /** Folders whose part of skin.json failed its own check: their files aren't judged again. */
  readonly unchecked: readonly string[];
}

/** Segments of letters, digits, dots, dashes and underscores; none starts with a dot. */
const SAFE_PATH = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const CODE_FILE = /\.(?:css|js|mjs|cjs|ts|svg|html?|xml|json)$/i;
const TYPE_LABEL: Readonly<Record<SniffedType, string>> = {
  woff2: "a woff2 font",
  png: "a PNG image",
  webm: "a WebM video",
  mp4: "an MP4 video",
  unknown: "something else",
};

const KB = 1024;
const MB = 1024 * KB;

export function formatBytes(bytes: number): string {
  return bytes >= MB ? `${(Math.ceil((bytes / MB) * 10) / 10).toFixed(1)} MB` : `${Math.ceil(bytes / KB)} KB`;
}

function expectedFiles(named: NamedFiles): ReadonlyMap<string, Expected> {
  const fonts = FONT_SLOTS.flatMap((slot) => {
    const value = named.fonts?.[slot];
    return value !== undefined && FONT_FILE_PATTERN.test(value)
      ? [[value, { type: "woff2", group: "font", ref: `$.fonts.${slot}` }] as const]
      : [];
  });
  const preview = named.preview ? [[named.preview, { type: "png", group: "preview", ref: "$.preview" }] as const] : [];
  const mascot =
    named.mascot?.mode === "custom"
      ? mascotFiles().map((path) => [path, { type: extensionType(path), group: "mascot", ref: "$.mascot" }] as const)
      : [];
  return new Map<string, Expected>([...fonts, ...preview, ...mascot]);
}

function extensionType(path: string): SniffedType {
  const extension = path.slice(path.lastIndexOf(".") + 1);
  return (MASCOT_FORMATS as readonly string[]).includes(extension) ? (extension as SniffedType) : "unknown";
}

function pathError(entry: AssetEntry): string | null {
  if (!entry.path.startsWith(ASSETS_DIR)) return `${echo(entry.path)} is outside assets/. A skin holds only skin.json and files under assets/.`;
  if (!SAFE_PATH.test(entry.path)) return `${echo(entry.path)} isn't a plain file path: use letters, digits, dots, dashes and underscores, with no "..".`;
  if (entry.link) return `${echo(entry.path)} is a link. Put the real file in its place.`;
  return null;
}

function unknownFileError(entry: AssetEntry, mascot: SkinMascot | undefined): string {
  if (CODE_FILE.test(entry.path)) return "A skin never holds CSS, JavaScript, SVG, HTML or other code. Remove this file.";
  if (entry.path.startsWith(MASCOT_DIR) && mascot?.mode !== "custom") {
    return `Mascot files are only used when "mascot.mode" is "custom". Remove this file or switch the mode.`;
  }
  return "skin.json doesn't name this file, and a skin may hold only the files it names. Remove it.";
}

function sizeError(entry: AssetEntry, expected: Expected): string | null {
  if (expected.group === "font" && entry.bytes > FONT_MAX_BYTES) {
    return `This font is ${formatBytes(entry.bytes)}; a font may be at most ${formatBytes(FONT_MAX_BYTES)}.`;
  }
  if (expected.group === "preview" && entry.bytes > PREVIEW_MAX_BYTES) {
    return `The preview is ${formatBytes(entry.bytes)}; it may be at most ${formatBytes(PREVIEW_MAX_BYTES)}.`;
  }
  return null;
}

function entryErrors(entry: AssetEntry, expected: Expected | undefined, named: NamedFiles): SkinError[] {
  const at = (message: string): SkinError => ({ path: entry.path, message });
  const unsafe = pathError(entry);
  if (unsafe) return [at(unsafe)];
  if (!expected) {
    return named.unchecked.some((dir) => entry.path.startsWith(dir)) ? [] : [at(unknownFileError(entry, named.mascot))];
  }
  if (entry.sniffedType !== expected.type) {
    return [at(`This isn't ${TYPE_LABEL[expected.type]}: its first bytes say it is ${TYPE_LABEL[entry.sniffedType]}.`)];
  }
  const tooBig = sizeError(entry, expected);
  return tooBig ? [at(tooBig)] : [];
}

function pathCounts(assets: readonly AssetEntry[]): ReadonlyMap<string, number> {
  return assets.reduce((counts, entry) => counts.set(entry.path, (counts.get(entry.path) ?? 0) + 1), new Map<string, number>());
}

/** Each path once, at its first entry; one pass, so a zip of many entries stays cheap. */
function firstOfEach(assets: readonly AssetEntry[]): readonly AssetEntry[] {
  const seen = new Set<string>();
  return assets.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}

function duplicateErrors(counts: ReadonlyMap<string, number>): SkinError[] {
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([path]) => ({ path, message: "This file is in the package more than once." }));
}

function missingErrors(expected: ReadonlyMap<string, Expected>, present: ReadonlySet<string>): SkinError[] {
  const missing = [...expected].filter(([path]) => !present.has(path));
  const single = missing
    .filter(([, file]) => file.group !== "mascot")
    .map(([path, file]) => ({ path: file.ref, message: `${path} is named here but isn't in the package.` }));
  const clips = missing.filter(([, file]) => file.group === "mascot").map(([path]) => path.slice(MASCOT_DIR.length));
  if (clips.length === 0) return single;
  const need = `${MASCOT_STATES.length} states × ${MASCOT_FORMATS.join(", ")}`;
  const message = `A custom mascot needs ${MASCOT_STATES.length * MASCOT_FORMATS.length} files in ${MASCOT_DIR} (${need}). Missing: ${clips.join(", ")}.`;
  return [...single, { path: "$.mascot", message }];
}

function totalErrors(assets: readonly AssetEntry[], expected: ReadonlyMap<string, Expected>, packageBytes: number | undefined): SkinError[] {
  const mascotBytes = assets.filter((entry) => expected.get(entry.path)?.group === "mascot").reduce((sum, entry) => sum + entry.bytes, 0);
  const total = packageBytes ?? assets.reduce((sum, entry) => sum + entry.bytes, 0);
  return [
    ...(mascotBytes > MASCOT_MAX_BYTES
      ? [{ path: "$.mascot", message: `The mascot files come to ${formatBytes(mascotBytes)}; together they may be at most ${formatBytes(MASCOT_MAX_BYTES)}.` }]
      : []),
    ...(total > PACKAGE_MAX_BYTES
      ? [{ path: "$", message: `The package is ${formatBytes(total)}; Studio accepts at most ${formatBytes(PACKAGE_MAX_BYTES)}.` }]
      : []),
  ];
}

export function fileErrors(assets: readonly AssetEntry[], named: NamedFiles, packageBytes?: number): SkinError[] {
  const expected = expectedFiles(named);
  const counts = pathCounts(assets);
  const firsts = firstOfEach(assets);
  return [
    ...duplicateErrors(counts),
    ...firsts.flatMap((entry) => entryErrors(entry, expected.get(entry.path), named)),
    ...missingErrors(expected, new Set(counts.keys())),
    ...totalErrors(assets, expected, packageBytes),
  ];
}
