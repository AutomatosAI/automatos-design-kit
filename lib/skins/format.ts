import { SHELL_KEYS } from "../looks/catalogue";
import { MASCOT_STATES } from "../mascot/types";

// The automatos-skin/v1 format, as core PRD-259 §3 describes it. Studio owns the format; until
// it publishes GET /api/skins/schema this file and spec/automatos-skin.v1.schema.json are the
// kit's draft of it, kept equal by tests/skins/spec.test.ts. Relative imports only: the CLI in
// scripts/ runs these modules under tsx.

export const SKIN_SCHEMA = "automatos-skin/v1";
export const SKIN_FILE = "skin.json";
export const ASSETS_DIR = "assets/";
export const PREVIEW_PATH = "assets/preview.png";
export const MASCOT_DIR = "assets/mascot/";
export const FONTS_DIR = "assets/fonts/";

export const SKIN_FIELDS = [
  "schema",
  "slug",
  "name",
  "version",
  "author",
  "description",
  "licence",
  "base",
  "tones",
  "tokens",
  "fonts",
  "shape",
  "mascot",
  "preview",
] as const;
export const REQUIRED_FIELDS = ["schema", "slug", "name", "version", "author", "base", "tones", "tokens"] as const;

export const BASES = ["studio", "classic"] as const;
export const TONES = ["light", "dark"] as const;
export type SkinBase = (typeof BASES)[number];
export type Tone = (typeof TONES)[number];

/** PRD-259 §3 "Allowed tokens", taken from Studio's app/globals.css. */
export const ALLOWED_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
  "agent",
  "agent-foreground",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "stage-1",
  "stage-2",
  "stage-3",
  "stage-4",
  "stage-5",
  "stage-6",
  "stage-7",
  "stage-8",
  "stage-9",
  "olive",
  "warn-ink",
  "on-strong",
  "border-2",
  "accent-2",
  "navy",
] as const;
export type TokenName = (typeof ALLOWED_TOKENS)[number];

/** Derived by Studio from the core tokens; a skin never sets them. */
export const DERIVED_ALIASES = ["paper", "bg-1", "bg-2", "fg", "fg-2", "fg-3"] as const;

/** WCAG AA: text pairs need 4.5:1, the focus ring 3:1 on the page. */
export const AA_TEXT_RATIO = 4.5;
export const AA_RING_RATIO = 3;

export interface ContrastPair {
  readonly text: TokenName;
  readonly on: TokenName;
  readonly min: number;
}

function textPair(text: TokenName, on: TokenName): ContrastPair {
  return { text, on, min: AA_TEXT_RATIO };
}

/** PRD-259 §3: every text pair at 4.5:1 ("and so on" read as each -foreground on its fill). */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  textPair("foreground", "background"),
  textPair("card-foreground", "card"),
  textPair("popover-foreground", "popover"),
  textPair("primary-foreground", "primary"),
  textPair("secondary-foreground", "secondary"),
  textPair("muted-foreground", "background"),
  textPair("muted-foreground", "muted"),
  textPair("accent-foreground", "accent"),
  textPair("destructive-foreground", "destructive"),
  textPair("success-foreground", "success"),
  textPair("warning-foreground", "warning"),
  textPair("info-foreground", "info"),
  textPair("agent-foreground", "agent"),
  textPair("olive", "background"),
  textPair("warn-ink", "background"),
  { text: "ring", on: "background", min: AA_RING_RATIO },
];

export const FONT_SLOTS = ["sans", "serif", "mono"] as const;
export type FontSlot = (typeof FONT_SLOTS)[number];
/** The fonts Studio ships (its app/layout.tsx); any other face is a woff2 file in assets/fonts/. */
export const STUDIO_FONTS = ["Geist", "Geist Mono", "Newsreader"] as const;

export const MASCOT_MODES = ["off", "auto", "custom"] as const;
export type MascotMode = (typeof MASCOT_MODES)[number];
export { MASCOT_STATES };
export const MASCOT_FORMATS = ["webm", "mp4", "png"] as const;
/** Auto's shell tints are the Looks catalogue's (a filter Studio ports with the player). */
export const MASCOT_SHELLS = SHELL_KEYS;

export const NAME_MAX = 40;
export const DESCRIPTION_MAX = 280;
export const AUTHOR_MAX = 80;
export const LICENCE_MAX = 64;
export const SLUG_MAX = 48;
export const VERSION_MAX = 32;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 24;
export const GLOW_MIN = 0;
export const GLOW_MAX = 40;

const KB = 1024;
const MB = 1024 * KB;
export const FONT_MAX_BYTES = 400 * KB;
export const MASCOT_MAX_BYTES = 8 * MB;
export const PREVIEW_MAX_BYTES = 1 * MB;
export const PACKAGE_MAX_BYTES = 15 * MB;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SEMVER_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
/** "16 100% 50%": hue 0–360, saturation and lightness 0–100%, up to two decimals, one space apart. */
export const HSL_TRIPLET_PATTERN =
  /^(?:360(?:\.0{1,2})?|(?:3[0-5]\d|[12]\d{2}|[1-9]?\d)(?:\.\d{1,2})?) (?:100(?:\.0{1,2})?|[1-9]?\d(?:\.\d{1,2})?)% (?:100(?:\.0{1,2})?|[1-9]?\d(?:\.\d{1,2})?)%$/;
export const HEX_COLOUR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
export const FONT_FILE_PATTERN = /^assets\/fonts\/[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*\.woff2$/;

export type SniffedType = "woff2" | "png" | "webm" | "mp4" | "unknown";

/** One file of a skin package other than skin.json, as the reader found it. */
export interface AssetEntry {
  readonly path: string;
  readonly bytes: number;
  readonly sniffedType: SniffedType;
  /** A symbolic link (never followed, never accepted). */
  readonly link?: boolean;
}

export type TokenValues = Readonly<Partial<Record<TokenName, string>>>;

export interface SkinFonts {
  readonly sans?: string;
  readonly serif?: string;
  readonly mono?: string;
}

export interface SkinShape {
  readonly radius?: number;
  readonly glow?: number;
}

export interface SkinMascot {
  readonly mode: MascotMode;
  readonly shell?: string;
  /** An HSL triplet once validated. */
  readonly light?: string;
}

/** A validated skin.json: every colour is an HSL triplet. */
export interface Skin {
  readonly schema: typeof SKIN_SCHEMA;
  readonly slug: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description?: string;
  readonly licence?: string;
  readonly base: SkinBase;
  readonly tones: readonly Tone[];
  readonly tokens: Readonly<Partial<Record<Tone, TokenValues>>>;
  readonly fonts?: SkinFonts;
  readonly shape?: SkinShape;
  readonly mascot?: SkinMascot;
  readonly preview?: typeof PREVIEW_PATH;
}

/** `path` is a JSON path into skin.json ("$.tokens.dark.ring") or a package file ("assets/x.png"). */
export interface SkinError {
  readonly path: string;
  readonly message: string;
}

export type SkinValidation =
  | { readonly ok: true; readonly skin: Skin; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly SkinError[] };

/** A tone's tokens from the skin's base (Studio's palettes), for pairs the skin sets only one side of. */
export type BaseTokens = (base: SkinBase, tone: Tone) => TokenValues;

export interface ValidateOptions {
  /** The package's size on disk; defaults to the sum of the asset bytes. */
  readonly packageBytes?: number;
  readonly baseTokens?: BaseTokens;
}

export function mascotFiles(): readonly string[] {
  return MASCOT_STATES.flatMap((state) => MASCOT_FORMATS.map((format) => `${MASCOT_DIR}${state}.${format}`));
}
