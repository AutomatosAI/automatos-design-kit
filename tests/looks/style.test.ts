// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ACCENTS,
  ACCENT_KEYS,
  ERROR_COLOUR,
  GROUNDS,
  GROUND_KEYS,
  LIGHTS,
  TYPE_STYLES,
  TYPE_STYLE_KEYS,
} from "@/lib/looks/catalogue";
import { duskOf, lookToCssVars } from "@/lib/looks/css";
import { DAYLIGHT, EMBER, PRESETS } from "@/lib/looks/presets";
import {
  COLOUR_TOKENS,
  RADII,
  SPACING_STEPS,
  TEXT_SPECIMENS,
  colourSwatches,
  contrastCheck,
  contrastChecks,
  displayLine,
  displaySpecimens,
  familyName,
  formatRatio,
  mascotSlots,
  rootBlock,
  variantNote,
} from "@/lib/looks/style";
import { MASCOT_STATES } from "@/lib/mascot/types";

import { themeTokens } from "../a11y/css";

// PRD-002 L-007: the style page's data, computed from the Look it is given.

const COLOUR_VALUE = /^(#[0-9A-F]{6}|rgba\()/i;

function swatch(name: string, look = EMBER) {
  const found = colourSwatches(look).find((entry) => entry.name === name);
  if (!found) throw new Error(`no swatch ${name}`);
  return found;
}

function ratio(label: string, look = EMBER): number {
  const found = contrastChecks(look).find((entry) => entry.label === label);
  if (!found) throw new Error(`no contrast check ${label}`);
  return found.ratio;
}

describe("colour swatches", () => {
  it("cover every colour a Look sets, and nothing else", () => {
    const colours = Object.entries(lookToCssVars(EMBER))
      .filter(([, value]) => COLOUR_VALUE.test(value))
      .map(([name]) => name)
      .sort();
    expect(COLOUR_TOKENS.map((token) => token.name).sort()).toEqual(colours);
    expect(COLOUR_TOKENS.every((token) => token.role.length > 0)).toBe(true);
  });

  it("show the active Look's values", () => {
    expect(swatch("--ground-bg").value).toBe(GROUNDS.graphite.bg);
    expect(swatch("--accent").value).toBe(ACCENTS.molten.hex);
    expect(swatch("--ground-bg", DAYLIGHT).value).toBe(GROUNDS.paper.bg);
    expect(colourSwatches(DAYLIGHT).map((entry) => entry.value)).toEqual(
      COLOUR_TOKENS.map((token) => lookToCssVars(DAYLIGHT)[token.name]),
    );
  });

  it("note a readable variant only where it differs from the raw colour", () => {
    expect(swatch("--accent-text").note).toBeNull();
    expect(swatch("--error-text").note).toBeNull();
    expect(swatch("--accent-text", DAYLIGHT).value).not.toBe(ACCENTS.molten.hex);
    expect(swatch("--accent-text", DAYLIGHT).note).toBe("darkened for reading on Paper");
    expect(swatch("--error-text", DAYLIGHT).note).toBe("darkened for reading on Paper");
    expect(swatch("--accent", DAYLIGHT).note).toBeNull();
  });

  it("say which way a variant moved", () => {
    expect(variantNote("#FF6A1F", "#ff6a1f", "Paper")).toBeNull();
    expect(variantNote("#FF6A1F", "#AA4C1C", "Paper")).toBe("darkened for reading on Paper");
    expect(variantNote("#333333", "#777777", "Night")).toBe("lightened for reading on Night");
  });
});

describe("contrast checks", () => {
  it("match the Ember style sheet", () => {
    expect(ratio("text / bg")).toBeCloseTo(16.36, 1);
    expect(ratio("text-2 / bg")).toBeCloseTo(8.54, 1);
    expect(ratio("ink / molten")).toBeCloseTo(6.74, 1);
    expect(formatRatio(ratio("text / bg"))).toBe("16.36:1");
  });

  it("check text, secondary text, button ink and both readable variants", () => {
    expect(contrastChecks(EMBER).map((entry) => entry.label)).toEqual([
      "text / bg",
      "text-2 / bg",
      "text / surface",
      "text-2 / surface",
      "ink / molten",
      "accent text / bg",
      "error text / bg",
    ]);
    const daylight = contrastChecks(DAYLIGHT).find((entry) => entry.label === "accent text / bg");
    expect(daylight?.foreground).toBe(lookToCssVars(DAYLIGHT)["--accent-text"]);
  });

  it("pass AA in every ground and accent pairing", () => {
    for (const ground of GROUND_KEYS) {
      for (const accent of ACCENT_KEYS) {
        for (const entry of contrastChecks({ ...EMBER, ground, accent })) {
          expect({ ground, accent, label: entry.label, passes: entry.passes }).toEqual({
            ground,
            accent,
            label: entry.label,
            passes: true,
          });
        }
      }
    }
  });

  it("fail below 4.5:1 and pass at it", () => {
    expect(contrastCheck("grey / grey", "#777777", "#888888").passes).toBe(false);
    const black = contrastCheck("text / bg", "#000000", "#FFFFFF");
    expect(black).toMatchObject({ label: "text / bg", foreground: "#000000", background: "#FFFFFF", passes: true });
    expect(black.ratio).toBeCloseTo(21, 5);
  });
});

describe("Copy tokens", () => {
  it("is every Look variable as a :root block", () => {
    const vars = lookToCssVars(EMBER);
    const block = rootBlock(EMBER);
    const lines = block.split("\n");
    expect(lines[0]).toBe(":root {");
    expect(lines.at(-1)).toBe("}");
    expect(lines).toHaveLength(Object.keys(vars).length + 2);
    expect(lines).toContain(`  --ground-bg: ${GROUNDS.graphite.bg};`);
    expect(lines).toContain(`  --accent-text: ${vars["--accent-text"]};`);
    expect(rootBlock(DAYLIGHT)).toContain(`  --ground-bg: ${GROUNDS.paper.bg};`);
  });
});

describe("type specimens", () => {
  it("use the Look's own display sizes", () => {
    for (const key of TYPE_STYLE_KEYS) {
      const { sizes } = TYPE_STYLES[key];
      expect(displaySpecimens({ ...EMBER, font: key }).map((specimen) => specimen.label)).toEqual([
        `Hero ${sizes.hero}px`,
        `Status ${sizes.status}px`,
        `Title ${sizes.card}px`,
      ]);
    }
    expect(displaySpecimens(EMBER).map((specimen) => specimen.sample)).toEqual([
      "The fun way.",
      "Searching.",
      "Laptop shortlist",
    ]);
  });

  it("name the display family", () => {
    expect(familyName(TYPE_STYLES.serif.family)).toBe("Instrument Serif");
    expect(displayLine(EMBER)).toBe("Editorial · Instrument Serif italic 400");
    expect(displayLine({ ...EMBER, font: "bric" })).toBe("Characterful · Bricolage Grotesque normal 700");
  });

  it("label reading type with the sizes in app/theme.css", () => {
    const tokens = themeTokens();
    for (const specimen of TEXT_SPECIMENS) {
      const value = tokens.get(specimen.token) ?? "";
      const numbers = specimen.label.match(/\d+(\.\d+)?/g) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      for (const number of numbers) {
        expect({ token: specimen.token, number, found: value.includes(number) }).toEqual({
          token: specimen.token,
          number,
          found: true,
        });
      }
    }
  });
});

describe("spacing and radii", () => {
  it("match the 4px scale in app/theme.css", () => {
    const tokens = themeTokens();
    for (const step of SPACING_STEPS) expect(tokens.get(step.token)).toBe(`${step.px}px`);
    expect(SPACING_STEPS.every((step) => step.px % 4 === 0)).toBe(true);
  });

  it("are the five Ember radii", () => {
    const tokens = themeTokens();
    expect(RADII.map((radius) => radius.kind)).toEqual(["paper", "tool", "button", "card", "pill"]);
    for (const radius of RADII) {
      const px = /^\d+/.exec(radius.label)?.[0] ?? "999";
      expect(tokens.get(`--radius-${radius.kind}`)).toBe(`${px}px`);
    }
  });
});

describe("mascot slots", () => {
  it("are Auto's 12 states with the ring each takes under the Look", () => {
    const slots = mascotSlots(EMBER);
    expect(slots.map((slot) => slot.state)).toEqual([...MASCOT_STATES]);
    expect(slots.every((slot) => slot.when.length > 0)).toBe(true);
    const ringOf = (state: string, look = EMBER) => mascotSlots(look).find((slot) => slot.state === state)?.ring;
    expect(ringOf("idle")).toBe(LIGHTS.mint.hex);
    expect(ringOf("thinking")).toBe(ACCENTS.molten.hex);
    expect(ringOf("oops")).toBe(ERROR_COLOUR);
    expect(ringOf("sleeping")).toBe(duskOf("graphite"));
    expect(ringOf("idle", { ...EMBER, light: "ice" })).toBe(LIGHTS.ice.hex);
  });

  it("are computed for every preset", () => {
    for (const look of PRESETS) expect(mascotSlots(look)).toHaveLength(12);
  });
});
