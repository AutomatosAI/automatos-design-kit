// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readableOn } from "@/lib/looks/contrast";
import { basePalette } from "@/lib/skins/base";
import { formatTriplet, tripletContrast } from "@/lib/skins/colour";
import { AA_RING_RATIO, AA_TEXT_RATIO, BASES, TONES } from "@/lib/skins/format";
import { checkPair, farthestPole, missingSide, pairChecks, pairsOf, suggestReadable } from "@/lib/skins/suggest";

// Readable-text suggestions for any colour pair: readableOn() widened beyond the Looks catalogue.

const HUES = [0, 16, 60, 120, 213, 271];
const LIGHTNESS = [5, 30, 50, 70, 95];
const GRID = HUES.flatMap((h) => LIGHTNESS.map((l) => formatTriplet({ h, s: 80, l })));

describe("suggestReadable", () => {
  it("keeps a colour that already reads", () => {
    expect(suggestReadable("0 0% 10%", "0 0% 98%", AA_TEXT_RATIO)).toBe("0 0% 10%");
  });

  it("fixes Classic's own primary pair and keeps the text's hue family", () => {
    const suggestion = suggestReadable("0 0% 98%", "16 100% 50%", AA_TEXT_RATIO);
    expect(tripletContrast(suggestion, "16 100% 50%")).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
    expect(suggestion).not.toBe("0 0% 98%");
  });

  it("passes AA for every failing pair across a grid of colours", () => {
    for (const text of GRID) {
      for (const on of GRID) {
        expect(tripletContrast(suggestReadable(text, on, AA_TEXT_RATIO), on)).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        expect(tripletContrast(suggestReadable(text, on, AA_RING_RATIO), on)).toBeGreaterThanOrEqual(AA_RING_RATIO);
      }
    }
  });

  it("passes AA for every pair Studio's own palettes fail", () => {
    for (const base of BASES) {
      for (const tone of TONES) {
        for (const check of pairChecks(basePalette(base, tone)).filter((pair) => !pair.passes)) {
          expect(check.suggestion).not.toBeNull();
          expect(tripletContrast(check.suggestion ?? "", check.on)).toBeGreaterThanOrEqual(check.pair.min);
        }
      }
    }
  });

  it("mixes toward black or white, whichever the fill contrasts with more", () => {
    expect(farthestPole("#FFFFFF")).toBe("#000000");
    expect(farthestPole("#101010")).toBe("#FFFFFF");
    expect(farthestPole("#FF4400")).toBe("#000000");
  });

  it("is readableOn's rule: readableOn still behaves as before", () => {
    expect(readableOn("#FF6A1A", "#FFFFFF", "#FFFFFF", "#1A1A1A")).not.toBe("#FF6A1A");
    expect(readableOn("#1A1A1A", "#FFFFFF", "#FFFFFF", "#000000")).toBe("#1A1A1A");
  });
});

describe("pairChecks", () => {
  it("checks only the pairs whose two sides the palette holds", () => {
    const checks = pairChecks({ foreground: "0 0% 10%", background: "0 0% 98%", primary: "16 100% 50%" });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ text: "0 0% 10%", on: "0 0% 98%", passes: true, suggestion: null });
  });

  it("with the skin's own colours, says how the validator treats each pair (decision K5)", () => {
    const palette = { foreground: "0 0% 10%", background: "0 0% 98%", primary: "16 100% 50%", "primary-foreground": "0 0% 98%", ring: "0 0% 40%" };
    const own = { foreground: "0 0% 10%", background: "0 0% 98%", primary: "16 100% 50%" };
    const status = Object.fromEntries(pairChecks(palette, own).map((check) => [`${check.pair.text}/${check.pair.on}`, check.status]));
    expect(status).toEqual({ "foreground/background": "checked", "primary-foreground/primary": "incomplete", "ring/background": "incomplete" });
    expect(pairChecks({ foreground: "0 0% 10%", background: "0 0% 98%" }, {})[0]?.status).toBe("base");
    expect(pairChecks({ foreground: "0 0% 10%", background: "0 0% 98%" })[0]?.status).toBe("checked");
  });

  it("names the side an incomplete pair still needs", () => {
    const [primary] = pairsOf("primary");
    expect(missingSide(primary, { primary: "16 100% 50%" })).toBe("primary-foreground");
    expect(missingSide(primary, { "primary-foreground": "0 0% 98%" })).toBe("primary");
    expect(missingSide(primary, {})).toBeNull();
    expect(missingSide(primary, { primary: "16 100% 50%", "primary-foreground": "0 0% 98%" })).toBeNull();
  });

  it("gives a failing pair its ratio and a suggestion for the text side", () => {
    const [ring] = pairsOf("ring");
    const check = checkPair(ring, "38 50% 85%", "38 50% 92%");
    expect(check.passes).toBe(false);
    expect(check.ratio).toBeLessThan(AA_RING_RATIO);
    expect(tripletContrast(check.suggestion ?? "", "38 50% 92%")).toBeGreaterThanOrEqual(AA_RING_RATIO);
  });

  it("lists the badges a token shows", () => {
    expect(pairsOf("background").map((pair) => pair.text)).toEqual(["foreground", "muted-foreground", "ring"]);
    expect(pairsOf("card").map((pair) => pair.text)).toEqual(["card-foreground", "muted-foreground"]);
    expect(pairsOf("olive")).toEqual([]);
    expect(pairsOf("primary").map((pair) => `${pair.text}/${pair.on}`)).toEqual(["primary-foreground/primary"]);
    expect(pairsOf("chart-1")).toEqual([]);
  });
});
