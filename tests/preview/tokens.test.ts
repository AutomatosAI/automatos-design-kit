// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ALLOWED_TOKENS } from "@/lib/skins/format";

import { cssRules, declarations, filesUnder, readSource } from "../a11y/css";

// PRD-004 K-005: the gallery reads Studio's own token names, the way Studio reads them
// (hsl(var(--card))), and holds no colour of its own: no hex, rgb() or hsl(<numbers>) anywhere
// in components/preview/, so what it shows is only the skin.

const PREVIEW_DIR = "components/preview";
const HEX = /(?<!&)#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const LITERAL_FUNCTION = /rgba?\(|hsla?\((?!\s*var\(--)/i;
/** A token read: hsl(var(--name)) or hsl(var(--name) / alpha). */
const TOKEN_READ = /hsl\(var\(--([\w-]+)\)/g;
/** Studio's whole-colour aliases, read as var(--name, fallback). */
const WHOLE_COLOUR = /var\(--(border-2|accent-2|navy)\b/g;
/** The chart series indirection: chart.module.css names a chart token as --series. */
const SERIES = "series";

/** Values that paint no colour of their own: none, transparent, the text colour, a 0 border. */
const NO_COLOUR = /^(?:[\d.]+px solid )?(?:transparent|none|inherit|currentColor|0)$/;
const COLOUR_PROPERTIES = new Set(["color", "background", "background-color", "border", "border-color", "fill", "stroke"]);

function sources(): readonly string[] {
  return filesUnder(PREVIEW_DIR, [".ts", ".tsx", ".css"]);
}

function stylesheets(): readonly string[] {
  return filesUnder(PREVIEW_DIR, [".css"]);
}

function tokenReads(css: string): readonly string[] {
  return [...css.matchAll(TOKEN_READ)].map((match) => match[1] ?? "");
}

describe("the preview gallery's colours", () => {
  it("scans the gallery's code and styles", () => {
    expect(sources().some((file) => file.endsWith("GalleryFrame.tsx"))).toBe(true);
    expect(stylesheets().length).toBeGreaterThanOrEqual(5);
  });

  it("has no hex literal in components/preview/", () => {
    for (const file of sources()) {
      const found = [...readSource(file).matchAll(HEX)].map((match) => match[0]);
      expect({ file, found }).toEqual({ file, found: [] });
    }
  });

  it("has no rgb() or numeric hsl() colour either", () => {
    for (const file of sources()) {
      expect({ file, literal: LITERAL_FUNCTION.test(readSource(file)) }).toEqual({ file, literal: false });
    }
  });

  it("reads only Studio's token names", () => {
    const allowed = new Set<string>([...ALLOWED_TOKENS, SERIES]);
    const read = stylesheets().flatMap((file) => tokenReads(readSource(file)).map((name) => ({ file, name })));
    expect(read.length).toBeGreaterThan(50);
    for (const { file, name } of read) {
      expect({ file, name, allowed: allowed.has(name) }).toEqual({ file, name, allowed: true });
    }
    const whole = stylesheets().flatMap((file) => [...readSource(file).matchAll(WHOLE_COLOUR)].map((match) => match[1]));
    for (const name of whole) expect(ALLOWED_TOKENS).toContain(name);
  });

  it("paints every colour declaration from a token", () => {
    for (const file of stylesheets()) {
      for (const rule of cssRules(readSource(file))) {
        for (const decl of declarations(rule.body).filter((d) => COLOUR_PROPERTIES.has(d.property))) {
          const where = `${file} ${rule.selector} { ${decl.property}: ${decl.value} }`;
          const fromToken = /var\(--/.test(decl.value) || NO_COLOUR.test(decl.value);
          expect({ where, fromToken }).toEqual({ where, fromToken: true });
        }
      }
    }
  });

  it("draws the charts with chart-1 to chart-5", () => {
    const chart = readSource(`${PREVIEW_DIR}/chart.module.css`);
    for (const index of [1, 2, 3, 4, 5]) expect(chart).toContain(`--series: var(--chart-${index});`);
  });

  it("uses the core's main surface, text and brand tokens", () => {
    const read = new Set(stylesheets().flatMap((file) => tokenReads(readSource(file))));
    for (const name of [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "border",
      "input",
      "ring",
      "destructive",
      "destructive-foreground",
      "success",
      "warning",
      "info",
      "agent",
    ]) {
      expect({ name, read: read.has(name) }).toEqual({ name, read: true });
    }
  });
});
