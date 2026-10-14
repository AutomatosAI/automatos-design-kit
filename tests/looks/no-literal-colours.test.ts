// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// PRD-002 L-003 / FR-3: every visible colour comes from the active Look. No hex colour may
// appear in app/ or components/ (CSS, TSX or TS); the catalogue in lib/looks/catalogue.ts is
// the only home for one. Test files and lib/looks/ are outside the scan by design.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCANNED = ["app", "components"];
const EXTENSIONS = [".css", ".tsx", ".ts"];
const ALLOWED = new Set([join("lib", "looks", "catalogue.ts")]);
// #rgb, #rgba, #rrggbb, #rrggbbaa; not an HTML entity such as &#39;.
const HEX_COLOUR = /(?<!&)#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;

function isTestFile(path: string): boolean {
  return /\.test\.tsx?$/.test(path) || path.split(sep).includes("tests");
}

function scannedFiles(): readonly string[] {
  return SCANNED.flatMap((dir) =>
    readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((name) => EXTENSIONS.some((extension) => name.endsWith(extension)))
      .map((name) => join(dir, name)),
  ).filter((path) => !isTestFile(path) && !path.startsWith(join("lib", "looks")) && !ALLOWED.has(path));
}

function hexColours(text: string): readonly string[] {
  return [...text.matchAll(HEX_COLOUR)].map((match) => match[0]);
}

describe("no literal colours outside the Look catalogue", () => {
  it("finds the pattern it is looking for", () => {
    expect(hexColours("color: #FF6A1F; border: 1px solid #fff; fill: #1a0a0280")).toEqual(["#FF6A1F", "#fff", "#1a0a0280"]);
    expect(hexColours("it&#39;s #section-2 and #main")).toEqual([]);
  });

  it("scans the stylesheets and components, including app/theme.css", () => {
    const files = scannedFiles();
    expect(files).toContain(join("app", "theme.css"));
    expect(files).toContain(join("app", "layout.tsx"));
    expect(files.some((file) => file.startsWith("components") && file.endsWith(".module.css"))).toBe(true);
    expect(files.some((file) => file.startsWith("components") && file.endsWith(".tsx"))).toBe(true);
  });

  it("has no hex colour in app/ or components/", () => {
    for (const file of scannedFiles()) {
      const found = hexColours(readFileSync(join(ROOT, file), "utf8"));
      expect({ file, found }).toEqual({ file, found: [] });
    }
  });

  it("keeps the catalogue as the place the colours live", () => {
    expect(hexColours(readFileSync(join(ROOT, "lib/looks/catalogue.ts"), "utf8")).length).toBeGreaterThan(20);
  });
});
