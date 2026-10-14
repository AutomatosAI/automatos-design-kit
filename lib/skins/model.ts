import { basePalette } from "./base";
import { normaliseColour } from "./colour";
import {
  CONTRAST_PAIRS,
  GLOW_MAX,
  GLOW_MIN,
  RADIUS_MAX,
  RADIUS_MIN,
  SKIN_SCHEMA,
  TONES,
  type FontSlot,
  type Skin,
  type SkinBase,
  type SkinFonts,
  type SkinMascot,
  type Tone,
  type TokenName,
  type TokenValues,
} from "./format";

// The editor's skin draft: an immutable value plus an undo/redo history. Every edit returns a
// new draft (the same one when nothing changed); nothing is validated here, so a draft becomes
// a skin only through draftToSkinJson() and validateSkin(). A draft holds only the colours the
// skin sets; the base palette (lib/skins/base.ts) shows through the rest. Pure; relative imports
// only (the CLI runs lib/skins under tsx).

export interface SkinMeta {
  readonly slug: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly description: string;
  readonly licence: string;
}

export interface DraftShape {
  readonly radius: number;
  readonly glow: number;
}

export interface SkinDraft {
  readonly meta: SkinMeta;
  readonly base: SkinBase;
  readonly tones: readonly Tone[];
  /** The skin's own colours per tone, as HSL triplets. Kept for a dropped tone, left out of the skin. */
  readonly tokens: Readonly<Record<Tone, TokenValues>>;
  readonly fonts: SkinFonts;
  readonly shape: DraftShape;
  readonly mascot: SkinMascot;
}

export const NEW_SKIN_META: SkinMeta = {
  slug: "my-skin",
  name: "My skin",
  version: "0.1.0",
  author: "",
  description: "",
  licence: "",
};

/** Studio's own corner (PRD-259 S-009: 8 px, and Classic's 0.5rem) and no glow. */
export const DEFAULT_SHAPE: DraftShape = { radius: 8, glow: 0 };
export const DEFAULT_MASCOT: SkinMascot = { mode: "off" };

const NO_TOKENS: Readonly<Record<Tone, TokenValues>> = { light: {}, dark: {} };

/** A new skin on Studio's or Classic's own look: no colour of its own yet, both tones. */
export function startDraft(base: SkinBase): SkinDraft {
  return { meta: NEW_SKIN_META, base, tones: TONES, tokens: NO_TOKENS, fonts: {}, shape: DEFAULT_SHAPE, mascot: DEFAULT_MASCOT };
}

/** A draft from a validated skin (an example, or an imported file). */
export function draftFromSkin(skin: Skin): SkinDraft {
  return {
    meta: {
      slug: skin.slug,
      name: skin.name,
      version: skin.version,
      author: skin.author,
      description: skin.description ?? "",
      licence: skin.licence ?? "",
    },
    base: skin.base,
    tones: skin.tones,
    tokens: { light: skin.tokens.light ?? {}, dark: skin.tokens.dark ?? {} },
    fonts: skin.fonts ?? {},
    shape: { ...DEFAULT_SHAPE, ...skin.shape },
    mascot: skin.mascot ?? DEFAULT_MASCOT,
  };
}

/** What the browser draws for a tone: the base palette with the skin's own colours over it. */
export function resolvedTokens(draft: SkinDraft, tone: Tone): TokenValues {
  return { ...basePalette(draft.base, tone), ...draft.tokens[tone] };
}

export function setMeta(draft: SkinDraft, patch: Partial<SkinMeta>): SkinDraft {
  return { ...draft, meta: { ...draft.meta, ...patch } };
}

export function setBase(draft: SkinDraft, base: SkinBase): SkinDraft {
  return draft.base === base ? draft : { ...draft, base };
}

/** One tone or both, kept in TONES order; an empty or unknown list leaves the draft as it is. */
export function setTones(draft: SkinDraft, tones: readonly Tone[]): SkinDraft {
  const next = TONES.filter((tone) => tones.includes(tone));
  return next.length === 0 || next.length !== new Set(tones).size ? draft : { ...draft, tones: next };
}

type Writable<T> = { -readonly [K in keyof T]: T[K] };

function withToken(values: TokenValues, name: TokenName, value: string): TokenValues {
  const copy: Writable<TokenValues> = { ...values };
  copy[name] = value;
  return copy;
}

function partnersOf(name: TokenName): readonly TokenName[] {
  return CONTRAST_PAIRS.flatMap((pair) => (pair.text === name ? [pair.on] : pair.on === name ? [pair.text] : []));
}

/**
 * Pins the base's value for every token the skin doesn't set yet that is chained to `name` by
 * contrast pairs (setting background pins muted-foreground, which pairs with card, which pairs
 * with card-foreground), so no pair is left with one side (decision K5).
 */
function pinPartners(own: TokenValues, base: TokenValues, name: TokenName): TokenValues {
  const step = (values: TokenValues, queue: readonly TokenName[]): TokenValues => {
    const [next, ...rest] = queue;
    if (next === undefined) return values;
    const added = partnersOf(next).flatMap((partner) => {
      const value = base[partner];
      return values[partner] === undefined && value !== undefined ? [[partner, value] as const] : [];
    });
    const pinned = added.reduce((acc, [partner, value]) => withToken(acc, partner, value), values);
    return step(pinned, [...rest, ...added.map(([partner]) => partner)]);
  };
  return step(own, [name]);
}

/**
 * Sets a colour (an HSL triplet or #rrggbb; anything else leaves the draft as it is). The other
 * side of each contrast pair it belongs to is pinned to the base's value when the skin doesn't
 * set it yet, and so on along the chain, so the pairs the editor shows are the pairs the skin
 * carries and the validator checks.
 */
export function setToken(draft: SkinDraft, tone: Tone, name: TokenName, colour: string): SkinDraft {
  const triplet = normaliseColour(colour);
  if (triplet === null) return draft;
  const base = basePalette(draft.base, tone);
  const own = withToken(draft.tokens[tone], name, triplet);
  const next = pinPartners(own, base, name);
  return { ...draft, tokens: { ...draft.tokens, [tone]: next } };
}

/** Drops the skin's own colour, so the base shows through again. */
export function clearToken(draft: SkinDraft, tone: Tone, name: TokenName): SkinDraft {
  const own = draft.tokens[tone];
  if (own[name] === undefined) return draft;
  const next: Writable<TokenValues> = { ...own };
  delete next[name];
  return { ...draft, tokens: { ...draft.tokens, [tone]: next } };
}

/** A font Studio ships, or a package path under assets/fonts/; null puts the base font back. */
export function setFont(draft: SkinDraft, slot: FontSlot, font: string | null): SkinDraft {
  const fonts: Writable<SkinFonts> = { ...draft.fonts };
  if (font === null) delete fonts[slot];
  else fonts[slot] = font;
  return { ...draft, fonts };
}

function wholeIn(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

/** Radius and glow, rounded to whole numbers and held to their ranges. */
export function setShape(draft: SkinDraft, patch: Partial<DraftShape>): SkinDraft {
  const radius = wholeIn(patch.radius ?? draft.shape.radius, RADIUS_MIN, RADIUS_MAX, draft.shape.radius);
  const glow = wholeIn(patch.glow ?? draft.shape.glow, GLOW_MIN, GLOW_MAX, draft.shape.glow);
  return { ...draft, shape: { radius, glow } };
}

export function setMascot(draft: SkinDraft, mascot: SkinMascot): SkinDraft {
  return { ...draft, mascot };
}

/** The draft as skin.json: only the declared tones' colours, empty optional text left out. */
export function draftToSkinJson(draft: SkinDraft): Record<string, unknown> {
  const { description, licence, ...meta } = draft.meta;
  const tokens = Object.fromEntries(draft.tones.map((tone) => [tone, draft.tokens[tone]] as const));
  return {
    schema: SKIN_SCHEMA,
    ...meta,
    ...(description === "" ? {} : { description }),
    ...(licence === "" ? {} : { licence }),
    base: draft.base,
    tones: draft.tones,
    tokens,
    ...(Object.keys(draft.fonts).length === 0 ? {} : { fonts: draft.fonts }),
    shape: draft.shape,
    mascot: draft.mascot,
  };
}

// Undo and redo.

export const HISTORY_LIMIT = 100;

export interface DraftHistory {
  readonly past: readonly SkinDraft[];
  readonly present: SkinDraft;
  readonly future: readonly SkinDraft[];
}

export function createHistory(draft: SkinDraft): DraftHistory {
  return { past: [], present: draft, future: [] };
}

function sameDraft(a: SkinDraft, b: SkinDraft): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Records `next` as a step (the oldest drops off past HISTORY_LIMIT); a no-op edit records nothing. */
export function commit(history: DraftHistory, next: SkinDraft): DraftHistory {
  if (sameDraft(history.present, next)) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

/** Applies one edit, e.g. `edit(history, (draft) => setToken(draft, "light", "primary", "#c44a1a"))`. */
export function edit(history: DraftHistory, change: (draft: SkinDraft) => SkinDraft): DraftHistory {
  return commit(history, change(history.present));
}

export function canUndo(history: DraftHistory): boolean {
  return history.past.length > 0;
}

export function canRedo(history: DraftHistory): boolean {
  return history.future.length > 0;
}

export function undo(history: DraftHistory): DraftHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo(history: DraftHistory): DraftHistory {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}
