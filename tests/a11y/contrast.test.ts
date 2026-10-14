// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ACCENT_KEYS, GROUND_KEYS, type AccentKey, type GroundKey } from "@/lib/looks/catalogue";
import { AA_TEXT, contrastRatio } from "@/lib/looks/contrast";
import { lookToCssVars } from "@/lib/looks/css";
import { EMBER } from "@/lib/looks/presets";

import { readSource, resolveTokens, themeTokens } from "./css";

// WCAG AA for the text colours: every "--fg on --bg" pair listed in app/theme.css's header
// comment must reach 4.5:1 in every Look. Theme tokens resolve to the Look's variables, which
// are filled in from lookToCssVars() for all 24 ground x accent pairs (the type style, shell,
// light and glow don't change a text colour). The WCAG 2.2 formulas live in lib/looks/contrast.ts.

const PAIR = /^\s*\*\s+(--color-[\w-]+) on (--color-[\w-]+)\s*$/gm;
const HEX = /^#[0-9a-f]{6}$/i;

function listedPairs(): readonly (readonly [string, string])[] {
  return [...readSource("app/theme.css").matchAll(PAIR)].map((match) => [match[1] ?? "", match[2] ?? ""] as const);
}

/** The theme's tokens with the Look's variables for this ground and accent added. */
function tokensFor(ground: GroundKey, accent: AccentKey): ReadonlyMap<string, string> {
  return new Map([...themeTokens(), ...Object.entries(lookToCssVars({ ...EMBER, ground, accent }))]);
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
    expect(pairs).toContain("--color-text on --color-bg");
    expect(pairs).toContain("--color-text-3 on --color-surface");
    expect(pairs).toContain("--color-accent-ink on --color-accent");
    expect(pairs).toContain("--color-accent-text on --color-bg");
    expect(pairs).toContain("--color-error-text on --color-surface");
    expect(pairs.length).toBeGreaterThanOrEqual(12);
  });

  it("meets AA (4.5:1) for every listed text colour on its ground, in all 24 ground x accent pairs", () => {
    const pairs = listedPairs();
    for (const ground of GROUND_KEYS) {
      for (const accent of ACCENT_KEYS) {
        const tokens = tokensFor(ground, accent);
        for (const [foreground, background] of pairs) {
          const fg = resolveTokens(`var(${foreground})`, tokens);
          const bg = resolveTokens(`var(${background})`, tokens);
          const where = `${ground} x ${accent}: ${foreground} on ${background}`;
          expect({ where, plain: HEX.test(fg) && HEX.test(bg) }).toEqual({ where, plain: true });
          const ratio = contrastRatio(fg, bg);
          const pair = `${where} (${ratio.toFixed(2)}:1)`;
          expect({ pair, passes: ratio >= AA_TEXT }).toEqual({ pair, passes: true });
        }
      }
    }
  });
});
