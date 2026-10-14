// @vitest-environment node
import { describe, expect, it } from "vitest";

import { LOOK_VAR_NAMES, lookToCssVars, rgbList, rgba, sheetOf } from "@/lib/looks/css";
import { AA_TEXT, contrastRatio, READABLE_TARGET } from "@/lib/looks/contrast";
import { ACCENT_KEYS, GROUNDS, GROUND_KEYS } from "@/lib/looks/catalogue";
import { DAYLIGHT, EMBER, PRESETS } from "@/lib/looks/presets";

describe("lookToCssVars", () => {
  it("gives Ember's variables", () => {
    expect(lookToCssVars(EMBER)).toEqual({
      "--ground-bg": "#131110",
      "--ground-surface": "#1D1917",
      "--ground-text": "#F4EEE8",
      "--ground-text-2": "#B7ADA4",
      "--ground-line": "rgba(244,238,232,.12)",
      "--ground-chip": "rgba(244,238,232,.06)",
      "--ground-panel": "rgba(244,238,232,.025)",
      "--sheet-bg": "#F4EEE8",
      "--sheet-text": "#131110",
      "--auto-dusk": "#5D5753",
      "--error": "#FF6B6B",
      "--error-text": "#FF6B6B",
      "--accent": "#FF6A1F",
      "--accent-ink": "#1A0A02",
      "--accent-line": "rgba(255,106,31,0.45)",
      "--accent-fill": "rgba(255,106,31,0.12)",
      "--accent-text": "#FF6A1F",
      "--sheet-accent": "#AA4A1A",
      "--display-family": "'Instrument Serif',serif",
      "--display-style": "italic",
      "--display-weight": "400",
      "--display-tracking": "0",
      "--display-hero": "72px",
      "--display-brand": "28px",
      "--display-status": "40px",
      "--display-card": "22px",
      "--auto-shell": "#C8692A",
      "--auto-shell-filter": "none",
      "--auto-light": "#4BF0B7",
      "--glow": "rgba(255,106,31,0.24)",
    });
  });

  it("darkens accent and error text on Paper (Daylight) and keeps the fills raw", () => {
    const vars = lookToCssVars(DAYLIGHT);
    expect(vars["--accent"]).toBe("#FF6A1F");
    expect(vars["--accent-text"]).toBe("#AA4C1C");
    expect(vars["--error"]).toBe("#FF6B6B");
    expect(vars["--error-text"]).toBe("#A54B49");
    for (const name of ["--accent-text", "--error-text"] as const) {
      const colour = vars[name] ?? "";
      expect(contrastRatio(colour, GROUNDS.paper.bg)).toBeGreaterThanOrEqual(READABLE_TARGET);
      expect(contrastRatio(colour, GROUNDS.paper.surface)).toBeGreaterThanOrEqual(READABLE_TARGET);
    }
  });

  it("prints Deliverables on a cream sheet on dark grounds and on the surface on Paper", () => {
    expect(sheetOf("graphite")).toEqual({ bg: GROUNDS.graphite.text, text: GROUNDS.graphite.bg });
    expect(sheetOf("indigo")).toEqual({ bg: GROUNDS.indigo.text, text: GROUNDS.indigo.bg });
    expect(sheetOf("paper")).toEqual({ bg: GROUNDS.paper.surface, text: GROUNDS.paper.text });
  });

  it("keeps the sheet's text and accent text readable for all 24 ground x accent pairs", () => {
    for (const ground of GROUND_KEYS) {
      for (const accent of ACCENT_KEYS) {
        const vars = lookToCssVars({ ...EMBER, ground, accent });
        const sheet = vars["--sheet-bg"] ?? "";
        for (const name of ["--sheet-text", "--sheet-accent"] as const) {
          const ratio = contrastRatio(vars[name] ?? "", sheet);
          const pair = `${ground} x ${accent}: ${name} on --sheet-bg (${ratio.toFixed(2)}:1)`;
          expect({ pair, passes: ratio >= AA_TEXT }).toEqual({ pair, passes: true });
        }
      }
    }
  });

  it("sets the same variables for every Look", () => {
    for (const look of PRESETS) expect(Object.keys(lookToCssVars(look)).sort()).toEqual([...LOOK_VAR_NAMES].sort());
  });

  it("turns the glow off at 0 and scales it to 40%", () => {
    expect(lookToCssVars({ ...EMBER, glow: 0 })["--glow"]).toBe("rgba(255,106,31,0)");
    expect(lookToCssVars({ ...EMBER, glow: 40 })["--glow"]).toBe("rgba(255,106,31,0.4)");
  });

  it("takes the type style and Auto's finish from the catalogue", () => {
    const vars = lookToCssVars({ ...EMBER, font: "clean", shell: "cobalt", light: "ice" });
    expect(vars["--display-family"]).toBe("'Geist',sans-serif");
    expect(vars["--display-style"]).toBe("normal");
    expect(vars["--display-weight"]).toBe("600");
    expect(vars["--display-tracking"]).toBe("-.03em");
    expect(vars["--auto-shell-filter"]).toBe("hue-rotate(195deg) saturate(1.1)");
    expect(vars["--auto-light"]).toBe("#9FD8FF");
  });
});

describe("rgba helpers", () => {
  it("split #rrggbb into channels", () => {
    expect(rgbList("#FF6A1F")).toBe("255,106,31");
    expect(rgba("#4bf0b7", 0.5)).toBe("rgba(75,240,183,0.5)");
  });

  it("refuse anything but #rrggbb", () => {
    expect(() => rgbList("red")).toThrow("isn't a #rrggbb colour");
    expect(() => rgbList("#FFF")).toThrow();
  });
});
