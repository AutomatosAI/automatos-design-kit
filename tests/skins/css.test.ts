// @vitest-environment node
import { describe, expect, it } from "vitest";
import { skinSelectors, skinToCss } from "@/lib/skins/css";
import type { AssetEntry, Skin } from "@/lib/skins/format";
import { validateSkin } from "@/lib/skins/validate";
import { asset, validSkin, withField, type Json } from "./helpers";

// skinToCss: Studio's generated stylesheet (PRD-259 §4), from validated numbers only.

function validated(json: Json, assets: readonly AssetEntry[] = []): Skin {
  const result = validateSkin(json, assets);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.skin;
}

/** A skin that skipped validateSkin: what a careless caller could hand the engine. */
function unvalidated(patch: Json): Skin {
  return { ...validated(validSkin()), ...patch } as unknown as Skin;
}

const GOLDEN = `html[data-skin="warm-paper"] {
  --background: 38 50% 92%;
  --foreground: 30 12% 9%;
  --card: 0 0% 100%;
  --card-foreground: 30 12% 9%;
  --primary: 30 12% 9%;
  --primary-foreground: 38 50% 96%;
  --muted-foreground: 36 12% 36%;
  --ring: 82 30% 33%;
  --paper: hsl(0 0% 100%);
  --bg-1: hsl(38 50% 92%);
  --fg: hsl(30 12% 9%);
  --fg-2: hsl(36 12% 36%);
  --fg-3: hsl(36 12% 36% / 0.75);
  --radius: 10px;
  --skin-glow: 12px;
}
html.dark[data-skin="warm-paper"] {
  --background: 30 12% 9%;
  --foreground: 38 40% 90%;
  --card: 30 10% 12%;
  --card-foreground: 38 40% 90%;
  --muted-foreground: 38 18% 62%;
  --ring: 82 35% 52%;
  --paper: hsl(30 10% 12%);
  --bg-1: hsl(30 12% 9%);
  --fg: hsl(38 40% 90%);
  --fg-2: hsl(38 18% 62%);
  --fg-3: hsl(38 18% 62% / 0.75);
}
`;

describe("skinToCss", () => {
  it("writes a sample skin's light and dark tokens, derived aliases, radius and glow", () => {
    expect(skinToCss(validated(validSkin()))).toBe(GOLDEN);
  });

  it("scopes to html[data-skin] so it outranks .studio and .studio.dark", () => {
    expect(skinSelectors("warm-paper")).toEqual({ light: 'html[data-skin="warm-paper"]', dark: 'html.dark[data-skin="warm-paper"]' });
    expect(skinToCss(validated(validSkin()), { id: "0b6a7c1e-2f4d" })).toContain('html.dark[data-skin="0b6a7c1e-2f4d"] {');
  });

  it("wraps Studio's pre-wrapped aliases the way globals.css does", () => {
    const aliases = { "border-2": "40 30% 70%", navy: "213 51% 23%", "accent-2": "15 76% 44%", olive: "82 50% 22%" };
    const css = skinToCss(validated({ ...validSkin(), tokens: { light: aliases, dark: aliases } }));
    expect(css).toContain("--border-2: hsl(40 30% 70%);");
    expect(css).toContain("--navy: hsl(213 51% 23%);");
    expect(css).toContain("--accent-2: hsl(15 76% 44% / 0.10);");
    expect(css).toContain("--accent-2: hsl(15 76% 44% / 0.14);");
    expect(css).toContain("--olive: 82 50% 22%;");
  });

  it("puts only shape in the light block of a dark-only skin", () => {
    // primary and its ink share no token with another pair, so they are complete on their own
    // (card would bring muted-foreground, which brings background, ring and the rest: K5).
    const skin = validated({ ...validSkin(), tones: ["dark"], tokens: { dark: { primary: "#000000", "primary-foreground": "#FFFFFF" } } });
    expect(skinToCss(skin)).toBe(
      'html[data-skin="warm-paper"] {\n  --radius: 10px;\n  --skin-glow: 12px;\n}\n' +
        'html.dark[data-skin="warm-paper"] {\n  --primary: 0 0% 0%;\n  --primary-foreground: 0 0% 100%;\n}\n',
    );
  });

  it("is empty for a skin that changes nothing", () => {
    expect(skinToCss(validated({ ...validSkin(), tokens: { light: {}, dark: {} }, shape: {} }))).toBe("");
  });

  it("points Studio's font variables at shipped fonts and the skin's own families, with no @font-face or url() (K2)", () => {
    const fonts = { sans: "newsreader", serif: "assets/fonts/my-face.woff2", mono: "geist-mono" };
    const skin = validated(withField(validSkin(), "fonts", fonts), [asset("assets/fonts/my-face.woff2", "woff2")]);
    const css = skinToCss(skin);
    expect(css).toContain('--font-geist-sans: "Newsreader", Georgia, ui-serif, serif;');
    expect(css).toContain('--font-newsreader: "skin-warm-paper-serif", Georgia, ui-serif, serif;');
    expect(css).toContain('--font-geist-mono: "Geist Mono", ui-monospace, monospace;');
    expect(css).not.toContain("@font-face");
    expect(css).not.toContain("url(");
  });
});

describe("skinToCss never lets a hostile value through", () => {
  const HOSTILE = ["}body{", "0 0% 0%; } body{display:none", "url(https://evil)", "</style><script>alert(1)</script>", "16 100% 50%;}", "expression(alert(1))"];

  function expectRefused(make: () => string, hostile: string) {
    let css = "";
    try {
      css = make();
    } catch {
      return;
    }
    expect(css).not.toContain(hostile);
    throw new Error(`skinToCss accepted ${hostile}`);
  }

  it("refuses hostile token values, because only re-parsed numbers are written", () => {
    for (const hostile of HOSTILE) {
      expectRefused(() => skinToCss(unvalidated({ tokens: { light: { primary: hostile } } })), hostile);
      expectRefused(() => skinToCss(unvalidated({ tokens: { dark: { ring: hostile } } })), hostile);
    }
  });

  it("refuses hostile names, ids, shapes, fonts and font URLs", () => {
    expectRefused(() => skinToCss(unvalidated({ tokens: { light: { "x;}body{": "0 0% 0%" } } })), "body{");
    expectRefused(() => skinToCss(unvalidated({}), { id: 'x"]{}' }), 'x"]');
    expectRefused(() => skinToCss(unvalidated({ slug: "</style>" })), "</style>");
    expectRefused(() => skinToCss(unvalidated({ shape: { radius: "8px;}" } })), "8px;}");
    expectRefused(() => skinToCss(unvalidated({ shape: { glow: 1e9 } })), "1000000000");
    expectRefused(() => skinToCss(unvalidated({ fonts: { sans: 'x"; } body{' } })), "body{");
    expectRefused(() => skinToCss(unvalidated({ fonts: { sans: "assets/fonts/a.woff2) url(https://evil" } })), "evil");
    expectRefused(() => skinToCss(unvalidated({ fonts: { sans: "Geist" } })), "Geist");
  });

  it("writes nothing but declarations of numbers and names it made", () => {
    const css = skinToCss(validated(validSkin()));
    for (const banned of ["url(", "<", "@", "\\", "javascript", ";;"]) expect(css).not.toContain(banned);
    const values = css.split("\n").filter((line) => line.startsWith("  --")).map((line) => line.replace(/^ {2}--[a-z0-9-]+: /, ""));
    for (const value of values) expect(value).toMatch(/^(?:hsl\()?[\d.]+ [\d.]+% [\d.]+%(?: \/ 0\.\d\d)?\)?;$|^\d+px;$/);
  });
});
