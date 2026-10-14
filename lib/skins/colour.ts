import { contrastRatio } from "../looks/contrast";
import { HEX_COLOUR_PATTERN, HSL_TRIPLET_PATTERN } from "./format";

// Skin colours: Studio stores HSL triplets ("16 100% 50%", read as hsl(var(--x))). A skin may
// also give #rrggbb, normalised to a triplet. Pure.

export interface Hsl {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

type Rgb = readonly [number, number, number];

/** Two decimals at most, no trailing zeros: 16.50 -> "16.5", 100.00 -> "100". */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)));
}

export function formatTriplet({ h, s, l }: Hsl): string {
  return `${formatNumber(h)} ${formatNumber(s)}% ${formatNumber(l)}%`;
}

export function parseTriplet(value: string): Hsl | null {
  if (!HSL_TRIPLET_PATTERN.test(value)) return null;
  const [h, s, l] = value.split(" ").map((part) => parseFloat(part));
  return { h, s, l };
}

function hexToRgb(hex: string): Rgb {
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return [channel(1), channel(3), channel(5)];
}

function rgbToHsl([red, green, blue]: Rgb): Hsl {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: l * 100 };
  const s = delta / (1 - Math.abs(2 * l - 1));
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  const h = (sector * 60 + 360) % 360;
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const at = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const toByte = (unit: number) => Math.round(unit * 255);
  return [toByte(at(0)), toByte(at(8)), toByte(at(4))];
}

/** A triplet from #rrggbb, rounded to one decimal so it reads like Studio's own values. */
export function hexToTriplet(hex: string): string {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  const tenth = (value: number) => Math.round(value * 10) / 10;
  return formatTriplet({ h: tenth(h) % 360, s: tenth(s), l: tenth(l) });
}

/** #RRGGBB for a valid triplet (the sRGB colour a browser draws for hsl(<triplet>)). */
export function tripletToHex(triplet: string): string {
  const hsl = parseTriplet(triplet);
  if (!hsl) throw new Error(`${triplet} isn't an HSL triplet`);
  return `#${hslToRgb(hsl)
    .map((value) => value.toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;
}

/** The canonical triplet for a skin colour (triplet or #rrggbb), or null when it is neither. */
export function normaliseColour(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (HEX_COLOUR_PATTERN.test(value)) return hexToTriplet(value);
  const hsl = parseTriplet(value);
  return hsl ? formatTriplet(hsl) : null;
}

/** WCAG contrast between two triplets. */
export function tripletContrast(text: string, on: string): number {
  return contrastRatio(tripletToHex(text), tripletToHex(on));
}

/** "3.21:1", rounded down so a ratio just under a limit never prints as the limit. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}
