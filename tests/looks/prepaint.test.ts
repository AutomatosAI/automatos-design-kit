import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lookToCssVars } from "@/lib/looks/css";
import { LOOK_PREPAINT_SCRIPT } from "@/lib/looks/prepaint";
import { EMBER, PRESETS } from "@/lib/looks/presets";
import { ACTIVE_LOOK_KEY } from "@/lib/looks/storage";

import { clearRoot, myLook, rootVars } from "./helpers";

// Path, not URL, arithmetic: in jsdom tests vitest rewrites a URL resolved against import.meta.url to self.location (http:).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

// Runs the script the way the browser does, as a classic script in the page. Only in tests:
// Play itself never evaluates strings.
function runPrepaint(): void {
  new Function(LOOK_PREPAINT_SCRIPT)();
}

function store(value: unknown): void {
  window.localStorage.setItem(ACTIVE_LOOK_KEY, typeof value === "string" ? value : JSON.stringify(value));
}

beforeEach(() => {
  window.localStorage.clear();
  clearRoot();
});

afterEach(() => {
  window.localStorage.clear();
  clearRoot();
});

describe("the pre-paint Look script", () => {
  it("sets exactly lookToCssVars() for every preset and for a saved Look", () => {
    for (const look of [...PRESETS, myLook(), myLook({ glow: 0, font: "bric", shell: "silver", light: "rose" })]) {
      store(look);
      runPrepaint();
      expect({ id: look.id, vars: rootVars() }).toEqual({ id: look.id, vars: lookToCssVars(look) });
      clearRoot();
    }
  });

  it("applies Ember when nothing is stored", () => {
    runPrepaint();
    expect(rootVars()).toEqual(lookToCssVars(EMBER));
  });

  it("applies Ember when the stored Look is corrupt or names anything outside the catalogue", () => {
    const tampered = [
      "{not json",
      "null",
      '"daylight"',
      { ...EMBER, accent: "#FF0000" },
      { ...EMBER, ground: "__proto__" },
      { ...EMBER, font: "toString" },
      { ...EMBER, shell: "bronze;background:url(x)" },
      { ...EMBER, accent: "rose", glow: 41 },
      { ...EMBER, accent: "rose", glow: 2.5 },
      { ...EMBER, accent: "rose", glow: "24" },
    ];
    for (const value of tampered) {
      store(value);
      runPrepaint();
      expect({ value, vars: rootVars() }).toEqual({ value, vars: lookToCssVars(EMBER) });
      clearRoot();
    }
  });

  it("is safe inside a <script> element", () => {
    expect(LOOK_PREPAINT_SCRIPT).not.toMatch(/<\/?script/i);
    expect(LOOK_PREPAINT_SCRIPT).not.toContain("<!--");
    expect(LOOK_PREPAINT_SCRIPT).not.toContain("</");
  });

  it("runs from the <head> of the root layout", () => {
    const layout = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toContain("dangerouslySetInnerHTML={{ __html: LOOK_PREPAINT_SCRIPT }}");
    expect(layout.indexOf("LOOK_PREPAINT_SCRIPT }}")).toBeLessThan(layout.indexOf("<body>"));
    expect(layout).toContain("<LookProvider>");
  });
});
