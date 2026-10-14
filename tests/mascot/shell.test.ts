// @vitest-environment node
import { describe, expect, it } from "vitest";

import { SHELL_KEYS, SHELLS } from "@/lib/looks/catalogue";
import { lookToCssVars } from "@/lib/looks/css";
import { EMBER } from "@/lib/looks/presets";

import { cssRules, declarations, readSource, resolveTokens, themeTokens } from "../a11y/css";

// Auto's shell is a CSS filter over his clip and still (Ember Looks prototype: "Shell tint is a
// filter over the mascot video"). The ring and eyes are drawn by the page and stay untinted.

/** The filters from docs/design/ember/Automatos Play Looks.dc.html, per shell. */
const EXPECTED_FILTERS = {
  bronze: "none",
  gold: "hue-rotate(18deg) saturate(1.2) brightness(1.1)",
  silver: "grayscale(1) brightness(1.25)",
  cobalt: "hue-rotate(195deg) saturate(1.1)",
} as const;

describe("the shell filter", () => {
  it("maps each of the 4 shells to its filter", () => {
    expect([...SHELL_KEYS].sort()).toEqual(Object.keys(EXPECTED_FILTERS).sort());
    for (const shell of SHELL_KEYS) {
      const filter = lookToCssVars({ ...EMBER, shell })["--auto-shell-filter"];
      expect({ shell, filter }).toEqual({ shell, filter: EXPECTED_FILTERS[shell] });
      expect(SHELLS[shell].filter).toBe(EXPECTED_FILTERS[shell]);
    }
  });

  it("is set on the mascot video and PNG (.figure and .probing), and nowhere else in Auto", () => {
    const tokens = themeTokens();
    const rules = cssRules(readSource("components/mascot/mascot.module.css"));
    const filtered = rules
      .filter((rule) => declarations(rule.body).some((decl) => decl.property === "filter"))
      .map((rule) => ({
        selectors: rule.selector.split(",").map((part) => part.trim()),
        filter: declarations(rule.body).find((decl) => decl.property === "filter")?.value ?? "",
      }));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.selectors).toEqual([".figure", ".probing"]);
    expect(resolveTokens(filtered[0]?.filter ?? "", tokens)).toBe("var(--auto-shell-filter)");
  });
});
