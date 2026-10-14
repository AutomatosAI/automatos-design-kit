import type { CSSProperties } from "react";

import { ACCENTS, GROUNDS, LIGHTS, TYPE_STYLES, type TypeStyleKey } from "@/lib/looks/catalogue";
import type { Look } from "@/lib/looks/types";

// The Looks page shows options that aren't the active Look: each swatch and mini card draws
// its own catalogue entry. Their values reach the CSS module as custom properties set inline,
// taken from lib/looks/catalogue.ts only (never user text, never a literal colour).

export type SwatchVars = Readonly<Record<`--${string}`, string>>;

/** Custom properties as a style prop. React sets "--name" keys with setProperty. */
export function swatchStyle(vars: SwatchVars): CSSProperties {
  // A cast is the documented way to pass custom properties: CSSProperties has no "--*" keys.
  return vars as CSSProperties;
}

/** One colour for a swatch, a dot or a chip. */
export function colourStyle(hex: string): CSSProperties {
  return swatchStyle({ "--swatch": hex });
}

/** A type option set in its own display style, at its card size. */
export function typeStyle(key: TypeStyleKey): CSSProperties {
  const font = TYPE_STYLES[key];
  return swatchStyle({
    "--option-family": font.family,
    "--option-style": font.style,
    "--option-weight": String(font.weight),
    "--option-tracking": font.letterSpacing,
    "--option-size": `${font.sizes.card}px`,
  });
}

/** A Look's mini card in the Looks row: its ground, type, light and accent. */
export function cardStyle(look: Look): CSSProperties {
  const ground = GROUNDS[look.ground];
  const font = TYPE_STYLES[look.font];
  return swatchStyle({
    "--card-bg": ground.bg,
    "--card-text": ground.text,
    "--card-accent": ACCENTS[look.accent].hex,
    "--card-light": LIGHTS[look.light].hex,
    "--card-family": font.family,
    "--card-style": font.style,
    "--card-weight": String(font.weight),
  });
}
