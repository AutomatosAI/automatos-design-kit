// @vitest-environment node
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { ACCENT_KEYS, GROUND_KEYS } from "@/lib/looks/catalogue";
import { contrastRatio } from "@/lib/looks/contrast";
import { lookToCssVars } from "@/lib/looks/css";
import { EMBER } from "@/lib/looks/presets";

import {
  cssRules,
  declarations,
  filesUnder,
  pxLengths,
  readSource,
  resolveTokens,
  selectsClass,
  stylesheets,
  themeTokens,
} from "./css";

// US-014, the parts jsdom can't see: the focus ring, tap target sizes and fixed widths
// are checked in the stylesheets themselves.

const PHONE_WIDTH = 390;
/** WCAG 1.4.11: a focus indicator against what is next to it. */
const NON_TEXT_CONTRAST = 3;
const TAP_MIN = 44;

/** Rules that only apply to wide screens can be as wide as they like. */
const WIDE_ONLY = /@media[^{]*\(\s*min-width/;

/** Rules that drop the outline without drawing a --focus- ring in the same rule, and why (none today). */
const OWN_FOCUS = new Map<string, string>();

/** Interactive elements with no class of their own, and why they may be small (none today). */
const UNSIZED = new Map<string, string>();

function allRules() {
  return stylesheets().flatMap((file) => cssRules(readSource(file)).map((rule) => ({ file, ...rule })));
}

describe("the focus ring", () => {
  it("is on every focusable element, drawn from the theme tokens", () => {
    const tokens = themeTokens();
    const ring = cssRules(readSource("app/globals.css")).find((rule) => rule.selector === ":focus-visible");
    expect(ring).toBeDefined();
    const values = new Map(declarations(ring?.body ?? "").map((decl): [string, string] => [decl.property, decl.value]));
    expect(values.get("outline")).toBe("var(--focus-outline)");
    expect(values.get("outline-offset")).toBe("var(--focus-offset)");
    expect(pxLengths("var(--focus-outline)", tokens)[0]).toBeGreaterThanOrEqual(2);
  });

  it("is a solid colour from the Look that stands out (3:1) on the page and on cards, in every Look", () => {
    for (const ground of GROUND_KEYS) {
      for (const accent of ACCENT_KEYS) {
        const vars = lookToCssVars({ ...EMBER, ground, accent });
        const looks = new Map([...themeTokens(), ...Object.entries(vars)]);
        const outline = resolveTokens("var(--focus-outline)", looks);
        const where = `${ground} x ${accent}: ${outline}`;
        const colour = /^\d+px solid (#[0-9a-f]{6})$/i.exec(outline)?.[1];
        expect({ where, solid: colour !== undefined }).toEqual({ where, solid: true });
        const ratio = Math.min(
          contrastRatio(colour ?? "", vars["--ground-bg"] ?? ""),
          contrastRatio(colour ?? "", vars["--ground-surface"] ?? ""),
        );
        expect({ where, visible: ratio >= NON_TEXT_CONTRAST }).toEqual({ where, visible: true });
      }
    }
  });

  it("is only removed by a rule that draws its own from a --focus- token", () => {
    const removed = allRules().filter((rule) =>
      declarations(rule.body).some((decl) => decl.property === "outline" && /^(none|0)$/.test(decl.value)),
    );
    for (const rule of removed) {
      const key = `${rule.file} ${rule.selector}`;
      const ownRing = /box-shadow:\s*var\(--focus-/.test(rule.body);
      expect({ key, ownRing: ownRing || OWN_FOCUS.has(key) }).toEqual({ key, ownRing: true });
    }
  });
});

interface Interactive {
  readonly file: string;
  readonly tag: string;
  readonly className: string | null;
  readonly stylesheet: string | null;
}

const TAG = /<(button|Link|a|input|textarea|select)\b[^<]*/g;
const CLASS = /className=\{(\w+)\.(\w+)\}/;
const STYLE_IMPORT = /import (\w+) from "(\.{1,2}\/[\w./-]+\.module\.css)"/g;

/** Every button, link and field in the components, with the class that sizes it. */
function interactiveElements(): readonly Interactive[] {
  return filesUnder("components", [".tsx"]).flatMap((file) => {
    const source = readSource(file);
    const imports = new Map(
      [...source.matchAll(STYLE_IMPORT)].map((match): [string, string] => [match[1] ?? "", match[2] ?? ""]),
    );
    return [...source.matchAll(TAG)].map((match) => {
      const found = CLASS.exec(match[0]);
      const sheet = found ? imports.get(found[1] ?? "") : undefined;
      return {
        file,
        tag: match[1] ?? "",
        className: found?.[2] ?? null,
        stylesheet: sheet ? join(dirname(file), sheet) : null,
      };
    });
  });
}

function tallEnough(element: Interactive, tokens: ReadonlyMap<string, string>): boolean {
  if (!element.stylesheet || !element.className) return false;
  const className = element.className;
  return cssRules(readSource(element.stylesheet))
    .filter((rule) => selectsClass(rule.selector, className) && !(rule.media && WIDE_ONLY.test(rule.media)))
    .flatMap((rule) => declarations(rule.body))
    .filter((decl) => ["height", "min-height", "block-size", "min-block-size"].includes(decl.property))
    .some((decl) => pxLengths(decl.value, tokens).some((px) => px >= TAP_MIN));
}

describe("tap targets", () => {
  it("are at least 44 px tall for every button, link and field", () => {
    const tokens = themeTokens();
    expect(pxLengths("var(--tap-min)", tokens)).toEqual([TAP_MIN]);
    const elements = interactiveElements();
    expect(elements.length).toBeGreaterThan(25);
    for (const element of elements) {
      const where = `${element.file} <${element.tag} ${element.className ?? "(no class)"}>`;
      const ok = element.className === null ? UNSIZED.has(element.file) : tallEnough(element, tokens);
      expect({ where, ok }).toEqual({ where, ok: true });
    }
  });
});

const WIDTHS = new Set([
  "width",
  "min-width",
  "inline-size",
  "min-inline-size",
  "flex",
  "flex-basis",
  "grid-template-columns",
]);

describe("phone widths", () => {
  it(`has no fixed width wider than a ${PHONE_WIDTH} px phone outside wide-screen rules`, () => {
    const tokens = themeTokens();
    const rules = allRules().filter((rule) => rule.file !== join("app", "theme.css"));
    expect(rules.length).toBeGreaterThan(100);
    for (const rule of rules) {
      if (rule.media && WIDE_ONLY.test(rule.media)) continue;
      for (const decl of declarations(rule.body)) {
        if (!WIDTHS.has(decl.property) && !decl.property.startsWith("--")) continue;
        const widest = Math.max(0, ...pxLengths(decl.value, tokens));
        const where = `${rule.file} ${rule.selector} { ${decl.property}: ${decl.value} }`;
        expect({ where, fits: widest <= PHONE_WIDTH }).toEqual({ where, fits: true });
      }
    }
  });
});
