// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readSource, themeTokens } from "./css";

// WCAG AA for the text colours: every "--fg on --bg" pair listed in app/theme.css's
// header comment must reach 4.5:1. Formulas from WCAG 2.2 (relative luminance, contrast ratio).

const AA_TEXT = 4.5;
const PAIR = /^\s*\*\s+(--color-[\w-]+) on (--color-[\w-]+)\s*$/gm;
const HEX = /^#([0-9a-f]{6})$/i;

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = HEX.exec(hex)?.[1];
  if (!digits) throw new Error(`${hex} isn't a #rrggbb colour`);
  const [red, green, blue] = [0, 2, 4].map((at) => channel(parseInt(digits.slice(at, at + 2), 16)));
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function listedPairs(): readonly (readonly [string, string])[] {
  return [...readSource("app/theme.css").matchAll(PAIR)].map((match) => [match[1] ?? "", match[2] ?? ""] as const);
}

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#ffffff", "#000000")).toBe(contrastRatio("#000000", "#ffffff"));
  });

  it("reads the pairs from app/theme.css, including the main ones", () => {
    const pairs = listedPairs().map(([fg, bg]) => `${fg} on ${bg}`);
    expect(pairs).toContain("--color-text on --color-night");
    expect(pairs).toContain("--color-text-3 on --color-surface");
    expect(pairs).toContain("--color-bronze-ink on --color-bronze");
    expect(pairs.length).toBeGreaterThanOrEqual(12);
  });

  it("meets AA (4.5:1) for every listed text colour on its ground", () => {
    const tokens = themeTokens();
    for (const [foreground, background] of listedPairs()) {
      const fg = tokens.get(foreground);
      const bg = tokens.get(background);
      expect({ foreground, defined: fg !== undefined && bg !== undefined }).toEqual({ foreground, defined: true });
      const ratio = contrastRatio(fg ?? "", bg ?? "");
      const pair = `${foreground} on ${background} (${ratio.toFixed(2)}:1)`;
      expect({ pair, passes: ratio >= AA_TEXT }).toEqual({ pair, passes: true });
    }
  });
});
