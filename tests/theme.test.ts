import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Path, not URL, arithmetic: in jsdom tests vitest rewrites a URL resolved against import.meta.url to self.location (http:).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;

function cssFilesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".css"))
    .map((name) => join(dir, name));
}

describe("theme tokens", () => {
  it("defines every named colour from the style sheet", () => {
    const theme = readFileSync(join(ROOT, "app/theme.css"), "utf8");
    const names = [
      "night", "surface", "raised", "bronze", "bronze-ink", "mint",
      "coral", "text", "text-2", "text-3", "violet", "dusk", "note",
    ];
    for (const name of names) {
      expect(theme).toMatch(new RegExp(`--color-${name}:\\s*#[0-9a-f]{6};`, "i"));
    }
  });

  it("keeps literal colours out of every stylesheet but app/theme.css", () => {
    const files = [...cssFilesUnder("app"), ...cssFilesUnder("components")].filter(
      (file) => file !== join("app", "theme.css"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const css = readFileSync(join(ROOT, file), "utf8");
      expect({ file, literal: LITERAL_COLOUR.test(css) }).toEqual({ file, literal: false });
    }
  });
});
