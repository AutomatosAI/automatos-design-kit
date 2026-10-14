import { derivedAliases, tokenCssValue } from "./aliases";
import { formatTriplet, normaliseColour, parseTriplet } from "./colour";
import {
  ALLOWED_TOKENS,
  DERIVED_ALIASES,
  FONT_FILE_PATTERN,
  FONT_SLOTS,
  GLOW_MAX,
  GLOW_MIN,
  RADIUS_MAX,
  RADIUS_MIN,
  SHIPPED_FONT_NAMES,
  SHIPPED_FONTS,
  SLUG_PATTERN,
  type FontSlot,
  type ShippedFont,
  type Skin,
  type SkinFonts,
  type SkinShape,
  type Tone,
  type TokenName,
  type TokenValues,
} from "./format";
import { recordOf } from "./validate-common";

// skinToCss: the stylesheet Studio generates for a skin (core PRD-259 §4, S-004a):
//   html[data-skin="<id>"]{ light tokens, --radius, --skin-glow, font variables }
//   html.dark[data-skin="<id>"]{ dark tokens }
// The light selector (0,1,1) outranks :root and .studio (0,1,0); the dark one (0,2,1) outranks
// .dark and .studio.dark (0,2,0). No @font-face and no url() (decision K2): a skin's own woff2 is
// registered with the FontFace API (lib/skins/font-faces.ts) under the family skinFontFamily()
// makes, and the CSS only names that family.
//
// Nothing from the skin is copied into the output as text. Every colour is parsed to numbers and
// written back by formatTriplet, shape values must be whole numbers in range, token names come
// from ALLOWED_TOKENS and font families are names this file makes. Anything else throws: a skin
// reaches here only after validateSkin, so a throw means a caller skipped the gate. Pure;
// relative imports only (the CLI runs lib/skins under tsx).

/** Studio's font variables (next/font in its app/layout.tsx); the slot a skin font replaces. */
export const FONT_VARIABLES: Readonly<Record<FontSlot, string>> = {
  sans: "--font-geist-sans",
  serif: "--font-newsreader",
  mono: "--font-geist-mono",
};

/** What each slot falls back to while a face loads, or when the browser refuses it. */
const FALLBACKS: Readonly<Record<FontSlot, string>> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, ui-serif, serif",
  mono: "ui-monospace, monospace",
};

/** The slot whose fallback each shipped face takes. */
const SHIPPED_SLOT: Readonly<Record<ShippedFont, FontSlot>> = {
  geist: "sans",
  "geist-mono": "mono",
  newsreader: "serif",
};

const ID_MAX = 64;

export interface SkinCssOptions {
  /** The value of <html data-skin>; defaults to the skin's slug. Kebab-case, up to 64 characters. */
  readonly id?: string;
}

function safeId(id: string): string {
  if (id.length > ID_MAX || !SLUG_PATTERN.test(id)) throw new Error("A skin id must be kebab-case, up to 64 characters.");
  return id;
}

function safeTriplet(value: unknown, where: string): string {
  const hsl = parseTriplet(normaliseColour(value) ?? "");
  if (!hsl) throw new Error(`${where} isn't a colour; validate the skin before making its CSS.`);
  return formatTriplet(hsl);
}

function safeWhole(value: number, min: number, max: number, where: string): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${where} must be a whole number from ${min} to ${max}.`);
  return value;
}

function isAllowed(name: string): name is TokenName {
  const allowed: readonly string[] = ALLOWED_TOKENS;
  return allowed.includes(name);
}

function tokenDeclarations(tokens: TokenValues, tone: Tone): readonly string[] {
  const unknown = Object.keys(tokens).filter((name) => !isAllowed(name));
  if (unknown.length > 0) throw new Error(`tokens.${tone} has a name Studio doesn't allow; validate the skin first.`);
  const safe: TokenValues = recordOf(
    ALLOWED_TOKENS.flatMap((name) => (tokens[name] === undefined ? [] : [[name, safeTriplet(tokens[name], `tokens.${tone}.${name}`)] as const])),
  );
  const own = ALLOWED_TOKENS.flatMap((name) => {
    const triplet = safe[name];
    return triplet === undefined ? [] : [`--${name}: ${tokenCssValue(name, triplet, tone)};`];
  });
  const aliases = derivedAliases(safe);
  const derived = DERIVED_ALIASES.flatMap((alias) => {
    const value = aliases[alias];
    return value === undefined ? [] : [`--${alias}: ${value};`];
  });
  return [...own, ...derived];
}

function shapeDeclarations(skin: Skin): readonly string[] {
  const shape: SkinShape = skin.shape ?? {};
  const { radius, glow } = shape;
  return [
    ...(radius === undefined ? [] : [`--radius: ${safeWhole(radius, RADIUS_MIN, RADIUS_MAX, "shape.radius")}px;`]),
    ...(glow === undefined ? [] : [`--skin-glow: ${safeWhole(glow, GLOW_MIN, GLOW_MAX, "shape.glow")}px;`]),
  ];
}

function isShipped(value: string): value is ShippedFont {
  const shipped: readonly string[] = SHIPPED_FONTS;
  return shipped.includes(value);
}

/** The family a skin's own font file gets: made here, never taken from the skin. */
export function skinFontFamily(id: string, slot: FontSlot): string {
  return `skin-${safeId(id)}-${slot}`;
}

function familyFor(id: string, slot: FontSlot, value: string): string {
  if (isShipped(value)) return `"${SHIPPED_FONT_NAMES[value]}", ${FALLBACKS[SHIPPED_SLOT[value]]}`;
  if (!FONT_FILE_PATTERN.test(value)) throw new Error(`fonts.${slot} isn't a font Studio ships or a woff2 file; validate the skin first.`);
  return `"${skinFontFamily(id, slot)}", ${FALLBACKS[slot]}`;
}

function fontDeclarations(skin: Skin, id: string): readonly string[] {
  const fonts: SkinFonts = skin.fonts ?? {};
  return FONT_SLOTS.flatMap((slot) => {
    const value = fonts[slot];
    return value === undefined ? [] : [`${FONT_VARIABLES[slot]}: ${familyFor(id, slot, value)};`];
  });
}

function rule(selector: string, declarations: readonly string[]): readonly string[] {
  return declarations.length === 0 ? [] : [`${selector} {\n${declarations.map((line) => `  ${line}`).join("\n")}\n}`];
}

/** The light and dark selectors for a skin id. */
export function skinSelectors(id: string): { readonly light: string; readonly dark: string } {
  const safe = safeId(id);
  return { light: `html[data-skin="${safe}"]`, dark: `html.dark[data-skin="${safe}"]` };
}

/** The skin's stylesheet. Throws when the skin holds anything validateSkin would refuse. */
export function skinToCss(skin: Skin, options: SkinCssOptions = {}): string {
  const id = safeId(options.id ?? skin.slug);
  const selectors = skinSelectors(id);
  const light = [
    ...(skin.tokens.light ? tokenDeclarations(skin.tokens.light, "light") : []),
    ...shapeDeclarations(skin),
    ...fontDeclarations(skin, id),
  ];
  const dark = skin.tokens.dark ? tokenDeclarations(skin.tokens.dark, "dark") : [];
  const blocks = [...rule(selectors.light, light), ...rule(selectors.dark, dark)];
  return blocks.length === 0 ? "" : `${blocks.join("\n")}\n`;
}
