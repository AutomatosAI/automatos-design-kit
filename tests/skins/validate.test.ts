// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AssetEntry, SkinError, TokenValues, ValidateOptions } from "@/lib/skins/format";
import { validateSkin } from "@/lib/skins/validate";
import { asset, mascotSet, omit, validSkin, withField, withTokens, withoutTokens, type Json } from "./helpers";

function errorsOf(skin: unknown, assets: readonly AssetEntry[] = [], options: ValidateOptions = {}): readonly SkinError[] {
  const result = validateSkin(skin, assets, options);
  return result.ok ? [] : result.errors;
}

function onlyError(skin: unknown, assets: readonly AssetEntry[] = []): SkinError {
  const errors = errorsOf(skin, assets);
  expect(errors).toHaveLength(1);
  return errors[0];
}

describe("validateSkin: a valid skin", () => {
  it("passes and returns the skin with every colour as an HSL triplet", () => {
    const result = validateSkin(validSkin(), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errors).toEqual([]);
    expect(result.skin.slug).toBe("warm-paper");
    expect(result.skin.tones).toEqual(["light", "dark"]);
    expect(result.skin.tokens.light?.card).toBe("0 0% 100%");
    expect(result.skin.tokens.light?.background).toBe("38 50% 92%");
    expect(result.skin.mascot).toEqual({ mode: "auto", shell: "bronze", light: "159.3 84.6% 61.8%" });
    expect(result.skin.shape).toEqual({ radius: 10, glow: 12 });
  });

  it("passes with a font file, a preview and a full custom mascot set", () => {
    const skin = {
      ...validSkin(),
      fonts: { sans: "Geist", serif: "assets/fonts/display-serif.woff2", mono: "Geist Mono" },
      mascot: { mode: "custom" },
      preview: "assets/preview.png",
    };
    const assets = [asset("assets/fonts/display-serif.woff2", "woff2"), asset("assets/preview.png", "png"), ...mascotSet()];
    expect(errorsOf(skin, assets)).toEqual([]);
  });

  it("accepts a dark-only skin and an empty tone", () => {
    const skin = { ...validSkin(), tones: ["dark"], tokens: { dark: {} } };
    expect(errorsOf(skin)).toEqual([]);
  });

  it("leaves out optional fields that are absent", () => {
    const result = validateSkin(omit(validSkin(), ["description", "licence", "shape", "mascot"]), []);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.skin)).toEqual(["schema", "slug", "name", "version", "author", "base", "tones", "tokens"]);
  });
});

describe("validateSkin: the header", () => {
  it("refuses something that isn't an object", () => {
    expect(onlyError([1, 2])).toEqual({ path: "$", message: "skin.json must hold one JSON object." });
  });

  it.each([
    ["schema", "automatos-skin/v2", "$.schema", `"schema" must be "automatos-skin/v1"`],
    ["slug", "Warm Paper", "$.slug", "lowercase letters and digits joined by single dashes"],
    ["slug", "warm--paper", "$.slug", "single dashes"],
    ["name", "", "$.name", `"name" can't be empty.`],
    ["name", "x".repeat(41), "$.name", "at most 40 characters (it has 41)"],
    ["name", "Two\nlines", "$.name", "one line of plain text"],
    ["version", "1.0", "$.version", "semantic version"],
    ["author", 42, "$.author", `"author" must be text.`],
    ["description", "y".repeat(281), "$.description", "at most 280 characters"],
    ["description", "See https://example.com", "$.description", "can't hold a link"],
    ["description", "Visit www.example.com", "$.description", "can't hold a link"],
    ["licence", "<b>MIT</b>", "$.licence", "can't hold < or >"],
    ["name", "Night\u202Egnihs", "$.name", "one line of plain text"],
    ["author", "Zero\u200Bwidth", "$.author", "one line of plain text"],
    ["author", "mailto:me@example.com", "$.author", "can't hold a link"],
    ["description", "Fonts from //cdn.example/x", "$.description", "can't hold a link"],
    ["base", "neon", "$.base", `"base" must be "studio", "classic"`],
    ["tones", [], "$.tones", `"tones" must be`],
    ["tones", ["light", "light"], "$.tones", "names a tone twice"],
    ["tones", ["light", "dim"], "$.tones", `"tones" must be`],
    ["preview", "assets/cover.png", "$.preview", `"preview" must be "assets/preview.png"`],
  ])("%s = %j fails with a plain message", (key, value, path, message) => {
    const error = onlyError(withField(validSkin(), key, value));
    expect(error.path).toBe(path);
    expect(error.message).toContain(message);
  });

  it("names each missing required field", () => {
    expect(errorsOf(omit(validSkin(), ["slug", "author"]))).toEqual([
      { path: "$.slug", message: `"slug" is required.` },
      { path: "$.author", message: `"author" is required.` },
    ]);
  });

  it("refuses fields that aren't in the schema, such as css or a script", () => {
    const errors = errorsOf({ ...validSkin(), css: "body{}", script: "alert(1)" });
    expect(errors.map((error) => error.path)).toEqual(["$.css", "$.script"]);
    expect(errors[0].message).toBe(`"css" isn't part of an automatos-skin/v1 skin. Remove it.`);
  });
});

describe("validateSkin: tokens", () => {
  it("refuses a token Studio doesn't let a skin set, and a derived alias", () => {
    const errors = errorsOf(withTokens(validSkin(), "light", { sidebar: "0 0% 0%", paper: "0 0% 100%" }));
    expect(errors).toEqual([
      { path: "$.tokens.light.sidebar", message: `"sidebar" isn't a token Studio lets a skin set. Remove it, or use one of the allowed names.` },
      { path: "$.tokens.light.paper", message: `"paper" is worked out by Studio from the core tokens; a skin can't set it. Remove it.` },
    ]);
  });

  it.each(["red", "#FFF", "#GGGGGG", "16 100 50", "361 50% 50%", "16 101% 50%", "hsl(16 100% 50%)", "url(x)", "16 100% 50%;}body{"])(
    "refuses %j as a colour",
    (value) => {
      const error = onlyError(withTokens(validSkin(), "dark", { accent: value }));
      expect(error.path).toBe("$.tokens.dark.accent");
      expect(error.message).toContain(`Use an HSL triplet such as "16 100% 50%" or #rrggbb.`);
    },
  );

  it("refuses tokens for a tone the skin leaves out, and keys other than light and dark", () => {
    const skin = { ...validSkin(), tones: ["light"], tokens: { ...(validSkin().tokens as Json), dim: {} } };
    expect(errorsOf(skin)).toEqual([
      { path: "$.tokens.dim", message: `"dim" isn't part of tokens (only light and dark). Remove it.` },
      { path: "$.tokens.dark", message: `This skin has no dark tone ("tones" leaves it out), so remove tokens.dark.` },
    ]);
  });

  it("requires tokens", () => {
    expect(onlyError(omit(validSkin(), ["tokens"])).path).toBe("$.tokens");
  });
});

describe("validateSkin: contrast", () => {
  it("names a failing text pair, its tone and its ratio", () => {
    const skin = withTokens(validSkin(), "light", { primary: "16 100% 50%", "primary-foreground": "0 0% 98%" });
    expect(onlyError(skin)).toEqual({
      path: "$.tokens.light.primary-foreground",
      message: "In light, primary-foreground on primary is 3.30:1; text needs at least 4.5:1.",
    });
  });

  it("checks the focus ring against the background at 3:1", () => {
    const skin = withTokens(validSkin(), "light", { ring: "38 50% 85%" });
    expect(onlyError(skin)).toEqual({
      path: "$.tokens.light.ring",
      message: "In light, ring on background is 1.14:1; the focus ring needs at least 3:1.",
    });
  });

  it("checks each declared tone on its own", () => {
    const skin = withTokens(validSkin(), "dark", { foreground: "30 12% 12%" });
    expect(onlyError(skin).path).toBe("$.tokens.dark.foreground");
  });

  it("resolves the side a skin doesn't set from its base when the base palette is given", () => {
    const base: TokenValues = { "primary-foreground": "0 0% 98%" };
    const skin = withTokens(withoutTokens(validSkin(), "light", ["primary-foreground"]), "light", { primary: "16 100% 50%" });
    expect(validateSkin(skin, []).ok).toBe(true);
    const result = validateSkin(skin, [], { baseTokens: (from, tone) => (from === "studio" && tone === "light" ? base : {}) });
    expect(result.ok ? [] : result.errors.map((error) => error.message)).toEqual([
      "In light, primary-foreground on primary is 3.30:1; text needs at least 4.5:1.",
    ]);
  });

  it("checks a pair when the skin sets one side, and leaves pairs it doesn't touch to the base", () => {
    const failingBase: TokenValues = { primary: "16 100% 50%", "primary-foreground": "0 0% 98%" };
    const options = { baseTokens: () => failingBase };
    const onlyText = withoutTokens(validSkin(), "light", ["primary"]);
    expect(errorsOf(onlyText, [], options).map((error) => error.path)).toEqual(["$.tokens.light.primary-foreground"]);
    const untouched = withoutTokens(validSkin(), "light", ["primary", "primary-foreground"]);
    expect(errorsOf(untouched, [], options)).toEqual([]);
  });
});

describe("validateSkin: fonts, shape and mascot", () => {
  it.each([
    [{ sans: "Comic Sans" }, "$.fonts.sans", "isn't a font Studio ships"],
    [{ mono: "assets/fonts/code.ttf" }, "$.fonts.mono", "woff2 file in assets/fonts/"],
    [{ serif: "https://fonts.example/x.woff2" }, "$.fonts.serif", "isn't a font Studio ships"],
    [{ display: "Geist" }, "$.fonts.display", "isn't part of fonts"],
  ])("fonts %j fails", (fonts, path, message) => {
    const error = onlyError(withField(validSkin(), "fonts", fonts));
    expect(error.path).toBe(path);
    expect(error.message).toContain(message);
  });

  it.each([
    [{ radius: 25 }, "$.shape.radius", "whole number from 0 to 24 px"],
    [{ radius: -1 }, "$.shape.radius", "whole number from 0 to 24 px"],
    [{ glow: 2.5 }, "$.shape.glow", "whole number from 0 to 40"],
    [{ glow: "12" }, "$.shape.glow", "whole number from 0 to 40"],
  ])("shape %j fails", (shape, path, message) => {
    const error = onlyError(withField(validSkin(), "shape", shape));
    expect(error.path).toBe(path);
    expect(error.message).toContain(message);
  });

  it.each([
    [{ mode: "loud" }, "$.mascot.mode", `"mascot.mode" must be "off", "auto", "custom".`],
    [{ mode: "auto", shell: "plaid" }, "$.mascot.shell", "shell tints"],
    [{ mode: "auto", light: "glow" }, "$.mascot.light", "must be a colour"],
    [{ mode: "auto", clips: "x" }, "$.mascot.clips", "isn't part of mascot"],
  ])("mascot %j fails", (mascot, path, message) => {
    const error = onlyError(withField(validSkin(), "mascot", mascot));
    expect(error.path).toBe(path);
    expect(error.message).toContain(message);
  });
});
