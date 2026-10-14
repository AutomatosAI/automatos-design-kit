// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CORE_SOURCE, STUDIO_BLOCKS, baseAliases, basePalette, baseTokens } from "@/lib/skins/base";
import { parseTriplet } from "@/lib/skins/colour";
import { ALLOWED_TOKENS, BASES, TONES } from "@/lib/skins/format";
import { pairChecks } from "@/lib/skins/suggest";

// Studio's palettes, copied from the core's frontend/app/globals.css (CORE_SOURCE.commit).

describe("base palettes", () => {
  it("match the core's globals.css for sampled tokens", () => {
    // Values read from automatos-ai frontend/app/globals.css at CORE_SOURCE.commit.
    expect(basePalette("classic", "light").primary).toBe("16 100% 50%"); // :root
    expect(basePalette("classic", "dark").background).toBe("0 0% 6%"); // .dark
    expect(basePalette("studio", "light").background).toBe("38 50% 92%"); // .studio
    expect(basePalette("studio", "dark").ring).toBe("82 35% 52%"); // .studio.dark
    expect(basePalette("studio", "light").navy).toBe("213 51% 23%"); // .studio: hsl(213 51% 23%)
    expect(basePalette("studio", "light")["accent-2"]).toBe("15 76% 44%"); // hsl(15 76% 44% / 0.10)
  });

  it("records the core commit they came from", () => {
    expect(CORE_SOURCE.file).toBe("frontend/app/globals.css");
    expect(CORE_SOURCE.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("hold only allowed token names, each an HSL triplet", () => {
    const allowed: readonly string[] = ALLOWED_TOKENS;
    for (const block of Object.values(STUDIO_BLOCKS)) {
      for (const [name, value] of Object.entries(block)) {
        expect(allowed).toContain(name);
        expect(parseTriplet(value ?? "")).not.toBeNull();
      }
    }
  });

  it("cascade the way <html class> does", () => {
    // .dark leaves the stage colours to :root.
    expect(basePalette("classic", "dark")["stage-1"]).toBe(STUDIO_BLOCKS.root["stage-1"]);
    // Classic has no Studio aliases; Studio defines all 47 tokens in both tones.
    expect(basePalette("classic", "light").olive).toBeUndefined();
    expect(Object.keys(basePalette("classic", "light"))).toHaveLength(41);
    expect(Object.keys(basePalette("studio", "light"))).toHaveLength(ALLOWED_TOKENS.length);
    expect(Object.keys(basePalette("studio", "dark"))).toHaveLength(ALLOWED_TOKENS.length);
    // .studio.dark wins over .studio, which wins over .dark.
    expect(basePalette("studio", "dark").foreground).toBe("38 40% 90%");
    expect(basePalette("studio", "light").foreground).toBe("30 12% 9%");
  });

  it("serve as the validator's baseTokens", () => {
    for (const base of BASES) for (const tone of TONES) expect(baseTokens(base, tone)).toEqual(basePalette(base, tone));
  });

  it("derive paper, bg-1/2 and fg/-2/-3 from the core tokens", () => {
    expect(baseAliases("studio", "light")).toEqual({
      paper: "hsl(0 0% 100%)",
      "bg-1": "hsl(38 50% 92%)",
      "bg-2": "hsl(38 40% 86%)",
      fg: "hsl(30 12% 9%)",
      "fg-2": "hsl(36 12% 36%)",
      "fg-3": "hsl(36 12% 36% / 0.75)",
    });
    expect(baseAliases("studio", "dark").paper).toBe("hsl(30 10% 12%)");
    expect(baseAliases("classic", "dark")["bg-1"]).toBe("hsl(0 0% 6%)");
  });

  it("show where Studio's own colours miss AA (Classic misses six pairs per tone)", () => {
    const failing = (base: "studio" | "classic", tone: "light" | "dark") =>
      pairChecks(basePalette(base, tone))
        .filter((check) => !check.passes)
        .map((check) => check.pair.text);
    const classic = ["primary-foreground", "accent-foreground", "destructive-foreground", "success-foreground", "info-foreground", "agent-foreground"];
    expect(failing("classic", "light")).toEqual(classic);
    expect(failing("classic", "dark")).toEqual(classic);
    expect(failing("studio", "light")).toEqual(["muted-foreground"]); // on muted, 4.21:1 (a kit draft pair)
    expect(failing("studio", "dark")).toEqual([]);
  });
});
