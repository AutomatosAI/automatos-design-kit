import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { LOOK_VAR_NAMES } from "@/lib/looks/css";

import { cssRules, declarations } from "./a11y/css";

// Path, not URL, arithmetic: in jsdom tests vitest rewrites a URL resolved against import.meta.url to self.location (http:).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i;
const VAR = /var\((--[\w-]+)\)/g;

function cssFilesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".css"))
    .map((name) => join(dir, name));
}

function rootTokens(): ReadonlyMap<string, string> {
  const css = readFileSync(join(ROOT, "app/theme.css"), "utf8");
  const root = cssRules(css).find((rule) => rule.selector === ":root");
  return new Map(
    declarations(root?.body ?? "")
      .filter((decl) => decl.property.startsWith("--"))
      .map((decl): [string, string] => [decl.property, decl.value]),
  );
}

describe("theme tokens", () => {
  it("defines the Ember colour roles", () => {
    const tokens = rootTokens();
    const names = [
      "bg", "surface", "text", "text-2", "text-3", "accent", "accent-ink", "accent-text",
      "error", "error-text", "light", "dusk", "sheet", "sheet-text", "sheet-accent",
    ];
    for (const name of names) expect({ name, defined: tokens.has(`--color-${name}`) }).toEqual({ name, defined: true });
  });

  it("takes every colour from the Look's variables (L-003)", () => {
    const tokens = rootTokens();
    const looks = new Set(LOOK_VAR_NAMES);
    const colours = [...tokens].filter(([name]) => /^--(color|line|tint)-/.test(name) || name === "--line");
    expect(colours.length).toBeGreaterThan(30);
    for (const [name, value] of colours) {
      const refs = [...value.matchAll(VAR)].map((match) => match[1] ?? "");
      const fromLook = refs.length > 0 && refs.every((ref) => looks.has(ref) || tokens.has(ref));
      expect({ name, value, fromLook }).toEqual({ name, value, fromLook: true });
    }
  });

  it("maps the display type to the Look's type style", () => {
    const tokens = rootTokens();
    expect(tokens.get("--font-display")).toBe("var(--display-family)");
    for (const name of ["--text-hero", "--text-status", "--text-title", "--text-brand"]) {
      expect(tokens.get(name)).toMatch(/^var\(--display-style\) var\(--display-weight\) .*var\(--display-family\)$/);
    }
  });

  it("keeps spacing, radii and motion static", () => {
    const tokens = rootTokens();
    for (const name of ["--space-1", "--space-7", "--radius-card", "--duration-message", "--duration-glow"]) {
      expect(tokens.get(name)).toMatch(/^\d+(\.\d+)?(px|ms|s)$/);
    }
  });

  it("keeps literal colours out of every stylesheet, app/theme.css included", () => {
    const files = [...cssFilesUnder("app"), ...cssFilesUnder("components")];
    expect(files).toContain(join("app", "theme.css"));
    for (const file of files) {
      const css = readFileSync(join(ROOT, file), "utf8");
      expect({ file, literal: LITERAL_COLOUR.test(css) }).toEqual({ file, literal: false });
    }
  });
});
