import { AA_TEXT, READABLE_TARGET, contrastRatio, mixUntilReadable } from "../looks/contrast";
import { hexToTriplet, tripletContrast, tripletToHex } from "./colour";
import { CONTRAST_PAIRS, type ContrastPair, type TokenName, type TokenValues } from "./format";

// Live AA for the editor: every contrast pair a palette can resolve, its ratio, and for a failing
// pair a readable text colour. The suggestion is readableOn() (lib/looks/contrast.ts) widened
// from the Looks catalogue to any colour: the text keeps its hue and is mixed toward black or
// white, whichever the fill contrasts with more, until it clears the pair's floor with a margin.
// Pure; relative imports only (the CLI runs lib/skins under tsx).

/** How far above a pair's floor a suggestion aims: readableOn()'s own margin over AA. */
export const SUGGESTION_MARGIN = READABLE_TARGET - AA_TEXT;

const BLACK = "#000000";
const WHITE = "#FFFFFF";

/** Black or white, whichever reads better on `fill` (#rrggbb). One of them always reaches 4.58:1. */
export function farthestPole(fill: string): string {
  return contrastRatio(BLACK, fill) >= contrastRatio(WHITE, fill) ? BLACK : WHITE;
}

/**
 * A text colour (HSL triplet) that reads on `on` at `min` or better, starting from `text`.
 * `text` itself when it already does.
 */
export function suggestReadable(text: string, on: string, min: number): string {
  if (tripletContrast(text, on) >= min) return text;
  const onHex = tripletToHex(on);
  const pole = farthestPole(onHex);
  const mixed = hexToTriplet(mixUntilReadable(tripletToHex(text), [onHex], pole, min + SUGGESTION_MARGIN));
  // The pole always clears the text and ring floors, so it is the guaranteed fallback.
  return tripletContrast(mixed, on) >= min ? mixed : hexToTriplet(pole);
}

/**
 * How the validator treats a pair (decision K5): "checked" when the skin sets both sides,
 * "incomplete" when it sets one (an error until it sets the other), "base" when it sets neither
 * (the base's own pair, never checked: Studio's Classic fails several).
 */
export type PairStatus = "checked" | "incomplete" | "base";

export interface PairCheck {
  readonly pair: ContrastPair;
  readonly status: PairStatus;
  /** The two sides as HSL triplets. */
  readonly text: string;
  readonly on: string;
  readonly ratio: number;
  readonly passes: boolean;
  /** A readable colour for `pair.text` when the pair fails; null when it passes. */
  readonly suggestion: string | null;
}

export function checkPair(pair: ContrastPair, text: string, on: string, status: PairStatus = "checked"): PairCheck {
  const ratio = tripletContrast(text, on);
  const passes = ratio >= pair.min;
  return { pair, status, text, on, ratio, passes, suggestion: passes ? null : suggestReadable(text, on, pair.min) };
}

function statusOf(pair: ContrastPair, own: TokenValues): PairStatus {
  const text = own[pair.text] !== undefined;
  const on = own[pair.on] !== undefined;
  if (text && on) return "checked";
  return text || on ? "incomplete" : "base";
}

/**
 * Every contrast pair whose two sides are in `palette` (a resolved tone: base under the skin's
 * own). With `own` (the skin's own colours in that tone) each check carries its K5 status; without
 * it every pair counts as checked.
 */
export function pairChecks(palette: TokenValues, own?: TokenValues): readonly PairCheck[] {
  return CONTRAST_PAIRS.flatMap((pair) => {
    const text = palette[pair.text];
    const on = palette[pair.on];
    if (text === undefined || on === undefined) return [];
    return [checkPair(pair, text, on, own === undefined ? "checked" : statusOf(pair, own))];
  });
}

/** The side of an incomplete pair the skin doesn't set yet; null for a complete or base pair. */
export function missingSide(pair: ContrastPair, own: TokenValues): TokenName | null {
  if (own[pair.text] === undefined && own[pair.on] !== undefined) return pair.text;
  if (own[pair.on] === undefined && own[pair.text] !== undefined) return pair.on;
  return null;
}

/** The pairs a token is one side of: the badges its colour shows. */
export function pairsOf(name: TokenName): readonly ContrastPair[] {
  return CONTRAST_PAIRS.filter((pair) => pair.text === name || pair.on === name);
}
