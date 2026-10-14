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

export interface PairCheck {
  readonly pair: ContrastPair;
  /** The two sides as HSL triplets. */
  readonly text: string;
  readonly on: string;
  readonly ratio: number;
  readonly passes: boolean;
  /** A readable colour for `pair.text` when the pair fails; null when it passes. */
  readonly suggestion: string | null;
}

export function checkPair(pair: ContrastPair, text: string, on: string): PairCheck {
  const ratio = tripletContrast(text, on);
  const passes = ratio >= pair.min;
  return { pair, text, on, ratio, passes, suggestion: passes ? null : suggestReadable(text, on, pair.min) };
}

/** Every contrast pair whose two sides are in `palette` (a resolved tone: base under the skin's own). */
export function pairChecks(palette: TokenValues): readonly PairCheck[] {
  return CONTRAST_PAIRS.flatMap((pair) => {
    const text = palette[pair.text];
    const on = palette[pair.on];
    return text === undefined || on === undefined ? [] : [checkPair(pair, text, on)];
  });
}

/** The pairs a token is one side of: the badges its colour shows. */
export function pairsOf(name: TokenName): readonly ContrastPair[] {
  return CONTRAST_PAIRS.filter((pair) => pair.text === name || pair.on === name);
}
