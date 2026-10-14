import {
  ACCENTS,
  ERROR_COLOUR,
  GROUNDS,
  LIGHTS,
  SHELLS,
  TYPE_STYLES,
  type AccentKey,
  type GroundKey,
  type LightKey,
  type ShellKey,
  type TypeStyleKey,
} from "./catalogue";
import { readableOn } from "./contrast";
import { DEFAULT_LOOK } from "./presets";
import type { Look } from "./types";

// A Look as CSS custom properties, set on <html> by LookProvider and, before first paint, by
// the inline script from lib/looks/prepaint.ts. Pure. Each section has its own builder so the
// pre-paint script's table is made from exactly the same values.

export type CssVars = Readonly<Record<string, string>>;

/** --accent-line: the accent at 45% alpha (selected borders, focus halos). */
export const ACCENT_LINE_ALPHA = 0.45;
/** --accent-fill: the accent at 12% alpha (tinted grounds). */
export const ACCENT_FILL_ALPHA = 0.12;
/** --glow is the accent at glow / GLOW_SCALE alpha. */
export const GLOW_SCALE = 100;

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** "r,g,b" for a #rrggbb colour, to build rgba() from. */
export function rgbList(hex: string): string {
  const match = HEX.exec(hex);
  if (!match) throw new Error(`${hex} isn't a #rrggbb colour`);
  return match.slice(1, 4).map((pair) => parseInt(pair, 16)).join(",");
}

export function rgba(hex: string, alpha: number): string {
  return `rgba(${rgbList(hex)},${alpha})`;
}

/** The ground's colours, plus the fixed error and its readable text on this ground. */
export function groundVars(key: GroundKey): CssVars {
  const ground = GROUNDS[key];
  return {
    "--ground-bg": ground.bg,
    "--ground-surface": ground.surface,
    "--ground-text": ground.text,
    "--ground-text-2": ground.text2,
    "--ground-line": ground.line,
    "--ground-chip": ground.chip,
    "--ground-panel": ground.panel,
    "--error": ERROR_COLOUR,
    "--error-text": readableOn(ERROR_COLOUR, ground.bg, ground.surface, ground.text),
  };
}

export function accentVars(key: AccentKey): CssVars {
  const accent = ACCENTS[key];
  return {
    "--accent": accent.hex,
    "--accent-ink": accent.ink,
    "--accent-line": rgba(accent.hex, ACCENT_LINE_ALPHA),
    "--accent-fill": rgba(accent.hex, ACCENT_FILL_ALPHA),
  };
}

/** The accent as text: darkened toward the ground's text where the raw accent doesn't read. */
export function accentTextVars(ground: GroundKey, accent: AccentKey): CssVars {
  const { bg, surface, text } = GROUNDS[ground];
  return { "--accent-text": readableOn(ACCENTS[accent].hex, bg, surface, text) };
}

/** The display type style (headings, Auto's caption, card titles). Body text stays Geist. */
export function fontVars(key: TypeStyleKey): CssVars {
  const font = TYPE_STYLES[key];
  return {
    "--display-family": font.family,
    "--display-style": font.style,
    "--display-weight": String(font.weight),
    "--display-tracking": font.letterSpacing,
    "--display-hero": `${font.sizes.hero}px`,
    "--display-brand": `${font.sizes.brand}px`,
    "--display-status": `${font.sizes.status}px`,
    "--display-card": `${font.sizes.card}px`,
  };
}

export function shellVars(key: ShellKey): CssVars {
  const shell = SHELLS[key];
  return { "--auto-shell": shell.hex, "--auto-shell-filter": shell.filter };
}

export function lightVars(key: LightKey): CssVars {
  return { "--auto-light": LIGHTS[key].hex };
}

export function glowVars(accent: AccentKey, glow: number): CssVars {
  return { "--glow": rgba(ACCENTS[accent].hex, glow / GLOW_SCALE) };
}

export function lookToCssVars(look: Look): CssVars {
  return {
    ...groundVars(look.ground),
    ...accentVars(look.accent),
    ...accentTextVars(look.ground, look.accent),
    ...fontVars(look.font),
    ...shellVars(look.shell),
    ...lightVars(look.light),
    ...glowVars(look.accent, look.glow),
  };
}

/** Every property a Look sets: the same set for every Look. */
export const LOOK_VAR_NAMES: readonly string[] = Object.keys(lookToCssVars(DEFAULT_LOOK));

/** Sets every property of `vars` on `element` (normally document.documentElement). */
export function applyCssVars(element: HTMLElement, vars: CssVars): void {
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
}
