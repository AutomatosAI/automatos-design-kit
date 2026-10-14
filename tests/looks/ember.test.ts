// @vitest-environment node
import { describe, expect, it } from "vitest";

import { TYPE_STYLES, TYPE_STYLE_KEYS } from "@/lib/looks/catalogue";
import { fontVars } from "@/lib/looks/css";

import { cssRules, declarations, filesUnder, readSource, resolveTokens, stylesheets, themeTokens } from "../a11y/css";

// PRD-002 L-003: the Ember rules from docs/design/ember/README.md, checked in the source:
// self-hosted fonts, serif display never below 19px, the five radii, and the motion
// (messages rise 12px over 180 ms, the page glow crossfades over 600 ms, everything stops
// under reduced motion).

const SERIF_FLOOR_PX = 19;

/** @fontsource package for each display family in the catalogue. */
const FONT_PACKAGES: Readonly<Record<string, string>> = {
  "Instrument Serif": "instrument-serif",
  Geist: "geist",
  "Bricolage Grotesque": "bricolage-grotesque",
  Fredoka: "fredoka",
};

function layoutFontImports(): readonly string[] {
  return [...readSource("app/layout.tsx").matchAll(/import "@fontsource\/([\w-]+\/[\w-]+\.css)";/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("Ember fonts", () => {
  it("self-hosts Instrument Serif (400, italic), Geist 400-700, Geist Mono, Bricolage Grotesque and Fredoka", () => {
    const imports = layoutFontImports();
    for (const file of [
      "instrument-serif/400.css",
      "instrument-serif/400-italic.css",
      "geist/400.css",
      "geist/500.css",
      "geist/600.css",
      "geist/700.css",
      "geist-mono/400.css",
      "bricolage-grotesque/700.css",
      "fredoka/600.css",
    ]) {
      expect(imports).toContain(file);
    }
  });

  it("imports the weight and style of every display type style in the catalogue", () => {
    const imports = layoutFontImports();
    for (const key of TYPE_STYLE_KEYS) {
      const style = TYPE_STYLES[key];
      const family = /'([^']+)'/.exec(style.family)?.[1] ?? "";
      const file = `${FONT_PACKAGES[family]}/${style.weight}${style.style === "italic" ? "-italic" : ""}.css`;
      expect({ key, file, imported: imports.includes(file) }).toEqual({ key, file, imported: true });
    }
  });

  it("pins every font package to an exact version", () => {
    const { dependencies } = JSON.parse(readSource("package.json")) as { dependencies: Record<string, string> };
    for (const name of new Set(layoutFontImports().map((file) => file.split("/")[0] ?? ""))) {
      expect({ name, version: dependencies[`@fontsource/${name}`] }).toEqual({
        name,
        version: expect.stringMatching(/^\d+\.\d+\.\d+$/),
      });
    }
  });

  it("never loads Google Fonts", () => {
    const sources = [...filesUnder("app", [".ts", ".tsx", ".css"]), ...filesUnder("components", [".ts", ".tsx", ".css"])];
    for (const file of sources) {
      const text = readSource(file);
      const google = text.includes("next/font/google") || text.includes("fonts.googleapis.com");
      expect({ file, google }).toEqual({ file, google: false });
    }
  });

  it("reads in Geist and Geist Mono", () => {
    const tokens = themeTokens();
    expect(tokens.get("--font-text")).toMatch(/^"Geist",/);
    expect(tokens.get("--font-mono")).toMatch(/^"Geist Mono",/);
  });
});

/** A display size in px: "72px", "calc(72px * 0.7)" or "max(19px, 1.17em)" (its floor). */
function sizePx(size: string): number {
  const plain = /^(\d+(?:\.\d+)?)px$/.exec(size);
  if (plain) return Number(plain[1]);
  const scaled = /^calc\((\d+(?:\.\d+)?)px \* (\d+(?:\.\d+)?)\)$/.exec(size);
  if (scaled) return Number(scaled[1]) * Number(scaled[2]);
  const floor = /^max\((\d+(?:\.\d+)?)px, [\d.]+em\)$/.exec(size);
  if (floor) return Number(floor[1]);
  throw new Error(`can't read the display size "${size}"`);
}

interface DisplayUse {
  readonly where: string;
  readonly size: string;
}

/** Every font set in the display family, as the size it resolves to under the Editorial (serif) style. */
function serifDisplayUses(): readonly DisplayUse[] {
  const serif = new Map([...themeTokens(), ...Object.entries(fontVars("serif"))]);
  const resolve = (value: string) => resolveTokens(value, serif).replace(/\s+/g, " ").trim();
  const family = resolve("var(--display-family)");
  const fromTokens = [...themeTokens()]
    .map(([name, value]) => ({ where: `app/theme.css ${name}`, value: resolve(value) }))
    .filter(({ value }) => value.endsWith(family) && value.includes(" / "));
  const shorthand = fromTokens.map(({ where, value }) => ({
    where,
    size: /^italic 400 (.+?) \/ /.exec(value)?.[1] ?? value,
  }));
  const longhand = stylesheets().flatMap((file) =>
    cssRules(readSource(file)).flatMap((rule) => {
      const decls = declarations(rule.body);
      const display = decls.some((decl) => decl.property === "font-family" && resolve(decl.value) === family);
      const size = decls.find((decl) => decl.property === "font-size");
      return display ? [{ where: `${file} ${rule.selector}`, size: size ? resolve(size.value) : "inherited" }] : [];
    }),
  );
  return [...shorthand, ...longhand];
}

describe("Ember type", () => {
  it("sets display type from the Look's type style", () => {
    expect(serifDisplayUses().length).toBeGreaterThan(8);
  });

  it(`never sets the serif display below ${SERIF_FLOOR_PX}px`, () => {
    expect(TYPE_STYLES.serif.style).toBe("italic");
    for (const use of serifDisplayUses()) {
      const px = use.size === "inherited" ? 0 : sizePx(use.size);
      expect({ ...use, px, readable: px >= SERIF_FLOOR_PX }).toEqual({ ...use, px, readable: true });
    }
  });

  it("uses display type only through the theme's display tokens in components", () => {
    for (const file of stylesheets().filter((path) => path.startsWith("components"))) {
      expect({ file, direct: /var\(--display-(family|hero|status|card|brand)\)/.test(readSource(file)) }).toEqual({
        file,
        direct: false,
      });
    }
  });
});

describe("accent and error colours", () => {
  it("are shown as text only through --color-accent-text and --color-error-text", () => {
    for (const file of stylesheets()) {
      for (const rule of cssRules(readSource(file))) {
        for (const decl of declarations(rule.body).filter((d) => d.property === "color")) {
          const where = `${file} ${rule.selector} { color: ${decl.value} }`;
          const raw = /var\(--color-(accent|error)\)/.test(decl.value);
          expect({ where, raw }).toEqual({ where, raw: false });
        }
      }
    }
  });

  it("are readable variants on <html> for every Look (lib/looks/css.ts)", () => {
    const tokens = themeTokens();
    expect(tokens.get("--color-accent-text")).toBe("var(--accent-text)");
    expect(tokens.get("--color-error-text")).toBe("var(--error-text)");
    expect(tokens.get("--color-accent")).toBe("var(--accent)");
    expect(tokens.get("--color-error")).toBe("var(--error)");
  });
});

describe("Ember radii", () => {
  it("are 6 paper, 8 tool line, 10 button, 14 card and pill chips", () => {
    const tokens = themeTokens();
    expect(tokens.get("--radius-paper")).toBe("6px");
    expect(tokens.get("--radius-tool")).toBe("8px");
    expect(tokens.get("--radius-button")).toBe("10px");
    expect(tokens.get("--radius-card")).toBe("14px");
    expect(tokens.get("--radius-pill")).toBe("999px");
  });

  it("come from the radius tokens (or a percentage for round shapes) everywhere", () => {
    const part = /^(var\(--radius-[\w-]+\)|\d+(\.\d+)?%|0)$/;
    for (const file of stylesheets().filter((path) => path !== "app/theme.css")) {
      for (const rule of cssRules(readSource(file))) {
        for (const decl of declarations(rule.body).filter((d) => d.property === "border-radius")) {
          const where = `${file} ${rule.selector} { border-radius: ${decl.value} }`;
          expect({ where, tokens: decl.value.split(/\s+/).every((value) => part.test(value)) }).toEqual({
            where,
            tokens: true,
          });
        }
      }
    }
  });

  it("put each radius on its kind of thing", () => {
    const radius = (file: string, selector: string) =>
      declarations(cssRules(readSource(file)).find((rule) => rule.selector === selector)?.body ?? "").find(
        (decl) => decl.property === "border-radius",
      )?.value;
    expect(radius("components/looks/style/drawn.module.css", ".toolLine")).toBe("var(--radius-tool)");
    expect(radius("components/looks/style/drawn.module.css", ".send,\n.stop")).toBe("var(--radius-button)");
    expect(radius("components/looks/style/drawn.module.css", ".deliverable")).toBe("var(--radius-card)");
    expect(radius("components/looks/style/drawn.module.css", ".deliverableTile")).toBe("var(--radius-paper)");
    expect(radius("components/looks/style/gallery.module.css", ".chip")).toBe("var(--radius-pill)");
  });
});

describe("Ember motion", () => {
  const tokens = themeTokens();

  it("raises a message 12px (the style sheet's motion demo; the chat that used it is retired)", () => {
    expect(tokens.get("--rise-distance")).toBe("12px");
    expect(tokens.get("--duration-message")).toBe("180ms");
    expect(readSource("components/looks/style/gallery.module.css")).toMatch(
      /@keyframes demo-rise \{\s*0% \{\s*opacity: 0;\s*transform: translateY\(var\(--rise-distance\)\);/,
    );
  });

  it("lands a Deliverable card with a 1.04 overshoot over 420 ms and pulses the ring every 2.4 s", () => {
    expect(tokens.get("--duration-card")).toBe("420ms");
    expect(tokens.get("--duration-ring")).toBe("2.4s");
    expect(readSource("components/looks/style/drawn.module.css")).toMatch(/@keyframes land \{[\s\S]*?scale\(1\.04\)/);
    expect(readSource("components/mascot/mascot.module.css")).toMatch(/@keyframes ring-pulse \{[\s\S]*?scale\(1\.06\)/);
  });

  it("crossfades the page glow with Auto's state over 600 ms", () => {
    expect(tokens.get("--duration-glow")).toBe("600ms");
    const rules = cssRules(readSource("app/globals.css"));
    const layers = rules.find((rule) => rule.selector === "body::before,\nbody::after");
    expect(layers?.body).toMatch(/transition: opacity var\(--duration-glow\)/);
    expect(layers?.body).toMatch(/position: fixed/);
    const glowRule = (glow: string, layer: string) =>
      rules.find((rule) => rule.selector.split(/,\s*/).includes(`body:has([data-glow="${glow}"])::${layer}`))?.body;
    expect(glowRule("busy", "before")).toMatch(/opacity: 0\.7/);
    expect(glowRule("bright", "before")).toMatch(/opacity: 1/);
    expect(glowRule("off", "before")).toMatch(/opacity: 0;/);
    expect(glowRule("snag", "before")).toMatch(/opacity: 0;/);
    expect(glowRule("snag", "after")).toMatch(/opacity: 1/);
    expect(tokens.get("--page-glow")).toContain("var(--glow)");
  });

  it("stops everything under reduced motion, from the media query and from LookProvider", () => {
    const rules = cssRules(readSource("app/globals.css"));
    const media = rules.find((rule) => rule.media?.includes("prefers-reduced-motion: reduce"));
    const provider = rules.find((rule) => rule.selector.startsWith(':root[data-motion="reduce"] *'));
    for (const rule of [media, provider]) {
      expect(rule?.selector).toContain("*::before");
      expect(rule?.body).toMatch(/animation-duration: 0\.01ms !important/);
      expect(rule?.body).toMatch(/animation-iteration-count: 1 !important/);
      expect(rule?.body).toMatch(/transition-duration: 0\.01ms !important/);
    }
  });
});
