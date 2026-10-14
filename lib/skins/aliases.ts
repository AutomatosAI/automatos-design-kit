import type { DerivedAlias, Tone, TokenName, TokenValues } from "./format";
import { recordOf } from "./validate-common";

// How Studio writes its aliases. Most tokens are bare HSL triplets (read as hsl(var(--x))), but
// a few Studio aliases are pre-wrapped colours, and six more are derived from the core tokens.
// The rules follow the core's PRD-259 S-004a (frontend/lib/skins/css.ts); values passed in here
// must already be safe triplets. Pure; relative imports only (the CLI runs this under tsx).

/** Studio aliases that globals.css writes as whole colours, not triplets. */
export const WRAPPED_TOKENS = ["border-2", "navy", "accent-2"] as const;

/** --accent-2 is the accent as a tint: 10% in light, 14% in dark (Studio's globals.css). */
export const ACCENT_2_ALPHA: Readonly<Record<Tone, number>> = { light: 0.1, dark: 0.14 };

/** --fg-3 (faded ink for meta and eyebrows) is the muted ink at this opacity. */
export const FG3_ALPHA = 0.75;

/** The core token each derived alias comes from. */
export const DERIVED_SOURCES: Readonly<Record<DerivedAlias, TokenName>> = {
  paper: "card",
  "bg-1": "background",
  "bg-2": "secondary",
  fg: "foreground",
  "fg-2": "muted-foreground",
  "fg-3": "muted-foreground",
};

const DERIVED_ALPHA: Readonly<Partial<Record<DerivedAlias, number>>> = { "fg-3": FG3_ALPHA };

/** hsl(<triplet>) or hsl(<triplet> / 0.75); alpha is always written with two decimals. */
export function hslValue(triplet: string, alpha?: number): string {
  return alpha === undefined ? `hsl(${triplet})` : `hsl(${triplet} / ${alpha.toFixed(2)})`;
}

function isWrapped(name: TokenName): boolean {
  const wrapped: readonly string[] = WRAPPED_TOKENS;
  return wrapped.includes(name);
}

/** The CSS value Studio gives a token: the bare triplet, or a whole colour for the wrapped aliases. */
export function tokenCssValue(name: TokenName, triplet: string, tone: Tone): string {
  if (!isWrapped(name)) return triplet;
  return name === "accent-2" ? hslValue(triplet, ACCENT_2_ALPHA[tone]) : hslValue(triplet);
}

/** The derived aliases as CSS values, for those whose source token is in `tokens`. */
export function derivedAliases(tokens: TokenValues): Readonly<Partial<Record<DerivedAlias, string>>> {
  const aliases = Object.keys(DERIVED_SOURCES) as DerivedAlias[];
  const entries = aliases.flatMap((alias) => {
    const source = tokens[DERIVED_SOURCES[alias]];
    return source === undefined ? [] : [[alias, hslValue(source, DERIVED_ALPHA[alias])] as const];
  });
  return recordOf(entries);
}
