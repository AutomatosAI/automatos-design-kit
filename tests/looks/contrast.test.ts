// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ACCENTS, ACCENT_KEYS, ERROR_COLOUR, GROUNDS, GROUND_KEYS } from "@/lib/looks/catalogue";
import { AA_TEXT, READABLE_TARGET, contrastRatio, mixHex, readableOn, relativeLuminance } from "@/lib/looks/contrast";

// Every Look the catalogue can make must read at WCAG AA. 4 grounds x 6 accents = 24 pairs.

const PAIRS = GROUND_KEYS.flatMap((ground) => ACCENT_KEYS.map((accent) => ({ ground, accent })));

function channels(hex: string): readonly number[] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
}

function near(actual: string, expected: string, tolerance: number): boolean {
  const a = channels(actual);
  return channels(expected).every((value, at) => Math.abs(value - (a[at] ?? -999)) <= tolerance);
}

function expectAa(label: string, foreground: string, background: string): void {
  const ratio = contrastRatio(foreground, background);
  const pair = `${label} (${ratio.toFixed(2)}:1)`;
  expect({ pair, passes: ratio >= AA_TEXT }).toEqual({ pair, passes: true });
}

describe("WCAG helpers", () => {
  it("compute luminance and contrast", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 10);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#FFFFFF", "#000000")).toBe(contrastRatio("#000000", "#FFFFFF"));
  });

  it("refuse anything but #rrggbb", () => {
    expect(() => relativeLuminance("rgba(0,0,0,.5)")).toThrow("isn't a #rrggbb colour");
    expect(() => relativeLuminance("#FFF")).toThrow();
  });

  it("mix in sRGB and round", () => {
    expect(mixHex("#000000", "#FFFFFF", 0)).toBe("#000000");
    expect(mixHex("#000000", "#FFFFFF", 1)).toBe("#FFFFFF");
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#ff6a1f", "#ff6a1f", 0)).toBe("#FF6A1F");
  });

  it("match the ratios measured on 14 Oct", () => {
    const { graphite, paper } = GROUNDS;
    expect(contrastRatio(graphite.text, graphite.bg)).toBeCloseTo(16.36, 1);
    expect(contrastRatio(graphite.text2, graphite.bg)).toBeCloseTo(8.54, 1);
    expect(contrastRatio(ACCENTS.molten.ink, ACCENTS.molten.hex)).toBeCloseTo(6.74, 1);
    expect(contrastRatio(paper.text2, paper.bg)).toBeCloseTo(5.12, 1);
    // Why readableOn exists: raw accent and error as text fail on Paper.
    expect(contrastRatio(ACCENTS.molten.hex, paper.bg)).toBeCloseTo(2.49, 1);
    expect(contrastRatio(ERROR_COLOUR, paper.bg)).toBeCloseTo(2.41, 1);
  });
});

describe("readableOn", () => {
  it("keeps a colour that already reads on both grounds", () => {
    const { graphite } = GROUNDS;
    expect(readableOn(ACCENTS.molten.hex, graphite.bg, graphite.surface, graphite.text)).toBe("#FF6A1F");
    expect(readableOn(ERROR_COLOUR, graphite.bg, graphite.surface, graphite.text)).toBe(ERROR_COLOUR);
  });

  it("darkens molten and error coral for Paper, toward the PRD's values", () => {
    const { paper } = GROUNDS;
    const molten = readableOn(ACCENTS.molten.hex, paper.bg, paper.surface, paper.text);
    const error = readableOn(ERROR_COLOUR, paper.bg, paper.surface, paper.text);
    expect({ molten, near: near(molten, "#A84A1B", 4) }).toEqual({ molten, near: true });
    expect({ error, near: near(error, "#A84A49", 4) }).toEqual({ error, near: true });
    for (const colour of [molten, error]) {
      expect(contrastRatio(colour, paper.bg)).toBeGreaterThanOrEqual(READABLE_TARGET);
      expect(contrastRatio(colour, paper.surface)).toBeGreaterThanOrEqual(READABLE_TARGET);
    }
  });

  it("falls back to the ground's text when no mix reads", () => {
    expect(readableOn("#777777", "#777777", "#777777", "#787878")).toBe("#787878");
  });
});

describe("every ground x accent pair reads at AA", () => {
  it("covers 24 pairs", () => {
    expect(PAIRS).toHaveLength(24);
  });

  it.each(PAIRS)("$ground with $accent", ({ ground, accent }) => {
    const g = GROUNDS[ground];
    const a = ACCENTS[accent];
    const accentText = readableOn(a.hex, g.bg, g.surface, g.text);
    const errorText = readableOn(ERROR_COLOUR, g.bg, g.surface, g.text);
    expectAa("text on bg", g.text, g.bg);
    expectAa("text on surface", g.text, g.surface);
    expectAa("text2 on bg", g.text2, g.bg);
    expectAa("text2 on surface", g.text2, g.surface);
    expectAa("ink on accent", a.ink, a.hex);
    expectAa(`accentText ${accentText} on bg`, accentText, g.bg);
    expectAa(`accentText ${accentText} on surface`, accentText, g.surface);
    expectAa(`errorText ${errorText} on bg`, errorText, g.bg);
    expectAa(`errorText ${errorText} on surface`, errorText, g.surface);
  });
});
