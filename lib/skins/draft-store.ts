import type { StorageSource } from "../looks/storage";
import { normaliseColour } from "./colour";
import {
  ALLOWED_TOKENS,
  BASES,
  FONT_FILE_PATTERN,
  FONT_SLOTS,
  MASCOT_MODES,
  MASCOT_SHELLS,
  STUDIO_FONTS,
  TONES,
  type SkinFonts,
  type SkinMascot,
  type Tone,
  type TokenValues,
} from "./format";
import { DEFAULT_MASCOT, NEW_SKIN_META, setShape, setTones, startDraft, type SkinDraft, type SkinMeta } from "./model";
import { isRecord, oneOf, recordOf } from "./validate-common";

// The editor's draft, kept in this browser's localStorage so it survives a reload. Storage may
// be missing, blocked or full: then the editor still works and says the draft isn't kept. What
// comes back is untrusted: every field is checked, and anything that isn't valid falls back to
// a new skin's value (skinToCss refuses anything unsafe as well).

export const DRAFT_KEY = "automatos-skin-kit.draft";
export const DRAFT_STORE_VERSION = 1;
/** Longer text than this isn't a draft the editor wrote. */
const STORED_TEXT_MAX = 2000;

function storedText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length <= STORED_TEXT_MAX ? value : fallback;
}

function storedMeta(value: unknown): SkinMeta {
  const meta = isRecord(value) ? value : {};
  return {
    slug: storedText(meta.slug, NEW_SKIN_META.slug),
    name: storedText(meta.name, NEW_SKIN_META.name),
    version: storedText(meta.version, NEW_SKIN_META.version),
    author: storedText(meta.author, NEW_SKIN_META.author),
    description: storedText(meta.description, NEW_SKIN_META.description),
    licence: storedText(meta.licence, NEW_SKIN_META.licence),
  };
}

function storedTokens(value: unknown): TokenValues {
  if (!isRecord(value)) return {};
  return recordOf(
    ALLOWED_TOKENS.flatMap((name) => {
      const triplet = Object.hasOwn(value, name) ? normaliseColour(value[name]) : null;
      return triplet === null ? [] : [[name, triplet] as const];
    }),
  );
}

function isFont(value: unknown): value is string {
  return typeof value === "string" && (oneOf(STUDIO_FONTS, value) || FONT_FILE_PATTERN.test(value));
}

function storedFonts(value: unknown): SkinFonts {
  if (!isRecord(value)) return {};
  return recordOf(
    FONT_SLOTS.flatMap((slot) => {
      const font = Object.hasOwn(value, slot) ? value[slot] : undefined;
      return isFont(font) ? [[slot, font] as const] : [];
    }),
  );
}

function storedMascot(value: unknown): SkinMascot {
  if (!isRecord(value)) return DEFAULT_MASCOT;
  const { mode, shell } = value;
  if (!oneOf(MASCOT_MODES, mode)) return DEFAULT_MASCOT;
  const light = normaliseColour(value.light);
  return {
    mode,
    ...(oneOf(MASCOT_SHELLS, shell) ? { shell } : {}),
    ...(light === null ? {} : { light }),
  };
}

function storedNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** A draft from what localStorage held, or null when it isn't one this editor wrote. */
export function parseStoredDraft(value: unknown): SkinDraft | null {
  if (!isRecord(value) || value.version !== DRAFT_STORE_VERSION) return null;
  const { draft: stored } = value;
  if (!isRecord(stored)) return null;
  const { base: storedBase, tones: storedTones, tokens: storedTokenSets, shape: storedShape } = stored;
  const base = oneOf(BASES, storedBase) ? storedBase : "studio";
  const tones = Array.isArray(storedTones) ? storedTones.filter((tone): tone is Tone => oneOf(TONES, tone)) : [];
  const tokens = isRecord(storedTokenSets) ? storedTokenSets : {};
  const shape = isRecord(storedShape) ? storedShape : {};
  const draft: SkinDraft = {
    ...startDraft(base),
    meta: storedMeta(stored.meta),
    tokens: { light: storedTokens(tokens.light), dark: storedTokens(tokens.dark) },
    fonts: storedFonts(stored.fonts),
    mascot: storedMascot(stored.mascot),
  };
  return setShape(setTones(draft, [...new Set(tones)]), {
    radius: storedNumber(shape.radius),
    glow: storedNumber(shape.glow),
  });
}

/** The stored draft, or null (nothing stored, storage blocked, or not a draft). */
export function readStoredDraft(storage: StorageSource): SkinDraft | null {
  let raw: string | null;
  try {
    raw = storage().getItem(DRAFT_KEY);
  } catch (error) {
    console.warn("[skins] localStorage can't be read, so the editor starts from Studio:", error);
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("[skins] the stored draft isn't JSON, so the editor starts from Studio:", error);
    return null;
  }
  const draft = parseStoredDraft(parsed);
  if (draft === null) console.warn("[skins] the stored draft isn't one this editor wrote, so it's ignored.");
  return draft;
}

/** False when this browser blocks storage (a sandboxed frame, blocked site data). Never throws. */
export function storageAvailable(storage: StorageSource): boolean {
  try {
    storage().getItem(DRAFT_KEY);
    return true;
  } catch {
    // readStoredDraft has already logged why.
    return false;
  }
}

/** Keeps the draft in this browser. False when storage is blocked or full. */
export function writeStoredDraft(storage: StorageSource, draft: SkinDraft): boolean {
  try {
    storage().setItem(DRAFT_KEY, JSON.stringify({ version: DRAFT_STORE_VERSION, draft }));
    return true;
  } catch (error) {
    console.warn("[skins] the draft couldn't be kept in this browser:", error);
    return false;
  }
}
