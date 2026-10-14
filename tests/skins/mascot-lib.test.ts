// @vitest-environment node
import { describe, expect, it } from "vitest";

import { LIGHTS, LIGHT_KEYS, SHELL_KEYS } from "@/lib/looks/catalogue";
import { MASCOT_LIGHTS, MASCOT_SHELLS, type SkinMascot } from "@/lib/skins/format";
import { validateSkin } from "@/lib/skins/validate";
import { draftToSkinJson, setMascot, startDraft } from "@/lib/skins/model";
import { LIGHT_SWATCHES, lightKeyOf, shellOf, withLight, withMascotMode, withShell } from "@/lib/skins/mascot";

// PRD-004 K-006: the mascot modes a draft can hold, and that each is a mascot skin.json accepts.
// K-010: shell and light are catalogue keys, as the core's S-001 stores them.

describe("mascot modes", () => {
  it("gives Auto a shell tint and a light, Custom a light only, and Off nothing", () => {
    expect(withMascotMode({ mode: "off" }, "auto")).toEqual({ mode: "auto", shell: "bronze", light: "mint" });
    expect(withMascotMode({ mode: "auto", shell: "cobalt", light: "mint" }, "custom")).toEqual({ mode: "custom", light: "mint" });
    expect(withMascotMode({ mode: "custom", light: "ice" }, "auto")).toEqual({ mode: "auto", shell: "bronze", light: "ice" });
    expect(withMascotMode({ mode: "auto", shell: "gold", light: "mint" }, "off")).toEqual({ mode: "off" });
  });

  it("keeps a chosen tint and light when Auto is picked again", () => {
    const amber = withLight(withShell({ mode: "auto", shell: "bronze", light: "mint" }, "silver"), "amber");
    expect(amber).toEqual({ mode: "auto", shell: "silver", light: "amber" });
    expect(withMascotMode(amber, "auto")).toEqual(amber);
    expect(shellOf(amber)).toBe("silver");
    expect(lightKeyOf(amber.light)).toBe("amber");
  });

  it("offers the format's lights with the catalogue's colours, and knows a value that isn't one", () => {
    expect(LIGHT_SWATCHES.map((swatch) => swatch.key)).toEqual(["mint", "amber", "ice", "rose"]);
    for (const swatch of LIGHT_SWATCHES) expect(swatch.hex).toBe(LIGHTS[swatch.key].hex);
    expect(lightKeyOf("159.3 84.6% 61.8%")).toBeNull();
    expect(lightKeyOf(undefined)).toBeNull();
    const tampered = JSON.parse('{"mode":"auto","shell":"toString"}') as SkinMascot;
    expect(shellOf(tampered)).toBe("bronze");
  });

  it("uses the same keys as the Looks catalogue the player reads", () => {
    expect([...MASCOT_SHELLS]).toEqual([...SHELL_KEYS]);
    expect([...MASCOT_LIGHTS]).toEqual([...LIGHT_KEYS]);
  });

  it("makes a skin.json the validator accepts in every mode (custom files are the package's job)", () => {
    for (const mode of ["off", "auto"] as const) {
      const draft = setMascot(startDraft("studio"), withMascotMode({ mode: "off" }, mode));
      const result = validateSkin(draftToSkinJson({ ...draft, meta: { ...draft.meta, author: "Kit" } }), []);
      expect({ mode, ok: result.ok, errors: result.errors }).toEqual({ mode, ok: true, errors: [] });
    }
  });
});
