// @vitest-environment node
import { describe, expect, it } from "vitest";

import { LIGHTS } from "@/lib/looks/catalogue";
import { normaliseColour } from "@/lib/skins/colour";
import { validateSkin } from "@/lib/skins/validate";
import { draftToSkinJson, setMascot, startDraft } from "@/lib/skins/model";
import { LIGHT_SWATCHES, lightKeyOf, shellOf, withLight, withMascotMode, withShell } from "@/lib/skins/mascot";

// PRD-004 K-006: the mascot modes a draft can hold, and that each is a mascot skin.json accepts.

const MINT = normaliseColour(LIGHTS.mint.hex) ?? "";

describe("mascot modes", () => {
  it("gives Auto a shell tint and a light, Custom a light only, and Off nothing", () => {
    expect(withMascotMode({ mode: "off" }, "auto")).toEqual({ mode: "auto", shell: "bronze", light: MINT });
    expect(withMascotMode({ mode: "auto", shell: "cobalt", light: MINT }, "custom")).toEqual({ mode: "custom", light: MINT });
    expect(withMascotMode({ mode: "custom", light: MINT }, "auto")).toEqual({ mode: "auto", shell: "bronze", light: MINT });
    expect(withMascotMode({ mode: "auto", shell: "gold", light: MINT }, "off")).toEqual({ mode: "off" });
  });

  it("keeps a chosen tint and light when Auto is picked again", () => {
    const amber = withLight(withShell({ mode: "auto", shell: "bronze", light: MINT }, "silver"), "amber");
    expect(withMascotMode(amber, "auto")).toEqual(amber);
    expect(shellOf(amber)).toBe("silver");
    expect(lightKeyOf(amber.light)).toBe("amber");
  });

  it("stores Auto's lights as triplets, and knows a colour that isn't one of them", () => {
    expect(LIGHT_SWATCHES.map((swatch) => swatch.key)).toEqual(["mint", "amber", "ice", "rose"]);
    for (const swatch of LIGHT_SWATCHES) expect(swatch.triplet).toBe(normaliseColour(swatch.hex));
    expect(lightKeyOf("10 10% 10%")).toBeNull();
    expect(lightKeyOf(undefined)).toBeNull();
    expect(shellOf({ mode: "auto", shell: "toString" })).toBe("bronze");
  });

  it("makes a skin.json the validator accepts in every mode (custom files are the package's job)", () => {
    for (const mode of ["off", "auto"] as const) {
      const draft = setMascot(startDraft("studio"), withMascotMode({ mode: "off" }, mode));
      const result = validateSkin(draftToSkinJson({ ...draft, meta: { ...draft.meta, author: "Kit" } }), []);
      expect({ mode, ok: result.ok, errors: result.errors }).toEqual({ mode, ok: true, errors: [] });
    }
  });
});
