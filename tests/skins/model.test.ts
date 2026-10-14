// @vitest-environment node
import { describe, expect, it } from "vitest";
import { basePalette } from "@/lib/skins/base";
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  clearToken,
  commit,
  createHistory,
  draftFromSkin,
  draftToSkinJson,
  edit,
  redo,
  resolvedTokens,
  setBase,
  setFont,
  setMeta,
  setShape,
  setToken,
  setTones,
  startDraft,
  undo,
  type SkinDraft,
} from "@/lib/skins/model";
import { suggestReadable } from "@/lib/skins/suggest";
import { validateSkin } from "@/lib/skins/validate";
import { validSkin } from "./helpers";

// The editor's immutable skin draft and its undo/redo history.

function named(draft: SkinDraft): SkinDraft {
  return setMeta(draft, { author: "Kit Tests" });
}

function errorPaths(draft: SkinDraft): readonly string[] {
  const result = validateSkin(draftToSkinJson(draft), []);
  return result.ok ? [] : result.errors.map((error) => error.path);
}

describe("the skin draft", () => {
  it("starts from Studio's or Classic's own look with no colour of its own", () => {
    const draft = startDraft("classic");
    expect(draft.tokens).toEqual({ light: {}, dark: {} });
    expect(draft.tones).toEqual(["light", "dark"]);
    expect(resolvedTokens(draft, "dark")).toEqual(basePalette("classic", "dark"));
    expect(errorPaths(named(startDraft("studio")))).toEqual([]);
  });

  it("sets a colour per tone, normalised to a triplet, without touching the old draft", () => {
    const draft = startDraft("studio");
    const before = JSON.stringify(draft);
    const next = setToken(draft, "dark", "chart-1", "#C44A1A");
    expect(next.tokens.dark["chart-1"]).toBe("16.9 76.6% 43.5%");
    expect(next.tokens.light).toEqual({});
    expect(JSON.stringify(draft)).toBe(before);
    expect(resolvedTokens(next, "dark")["chart-1"]).toBe("16.9 76.6% 43.5%");
  });

  it("ignores a value that isn't a colour", () => {
    const draft = startDraft("studio");
    expect(setToken(draft, "light", "primary", "url(x)")).toBe(draft);
  });

  it("pins the other side of each pair from the base, along the chain, so the validator checks what the editor shows", () => {
    const classic = basePalette("classic", "light");
    const draft = setToken(named(startDraft("classic")), "light", "background", "0 0% 100%");
    expect(draft.tokens.light).toEqual({
      background: "0 0% 100%",
      foreground: classic.foreground,
      "muted-foreground": classic["muted-foreground"],
      ring: classic.ring,
      card: classic.card,
      "card-foreground": classic["card-foreground"],
    });
    expect(errorPaths(draft)).toEqual([]);
    const primary = setToken(named(startDraft("classic")), "light", "primary", "16 100% 50%");
    expect(primary.tokens.light["primary-foreground"]).toBe("0 0% 98%");
    expect(errorPaths(primary)).toEqual(["$.tokens.light.primary-foreground"]);
    const fixed = setToken(primary, "light", "primary-foreground", suggestReadable("0 0% 98%", "16 100% 50%", 4.5));
    expect(errorPaths(fixed)).toEqual([]);
  });

  it("clears a colour so the base shows through", () => {
    const draft = setToken(startDraft("studio"), "light", "chart-2", "#112233");
    expect(clearToken(draft, "light", "chart-2").tokens.light).toEqual({});
    expect(clearToken(draft, "light", "chart-3")).toBe(draft);
  });

  it("drops a tone from the skin but keeps its colours in the draft", () => {
    const draft = setToken(named(startDraft("studio")), "light", "chart-1", "#112233");
    const darkOnly = setTones(draft, ["dark"]);
    expect(darkOnly.tones).toEqual(["dark"]);
    expect(darkOnly.tokens.light["chart-1"]).toBeDefined();
    expect(draftToSkinJson(darkOnly).tokens).toEqual({ dark: {} });
    expect(errorPaths(darkOnly)).toEqual([]);
    expect(setTones(draft, []).tones).toEqual(["light", "dark"]);
    expect(setTones(draft, ["dark", "light"]).tones).toEqual(["light", "dark"]);
  });

  it("keeps shape whole and in range, and sets fonts, base and meta", () => {
    const draft = setShape(startDraft("studio"), { radius: 30.4, glow: -3 });
    expect(draft.shape).toEqual({ radius: 24, glow: 0 });
    expect(setShape(draft, { radius: Number.NaN }).shape.radius).toBe(24);
    const fonts = setFont(setFont(draft, "serif", "newsreader"), "mono", "assets/fonts/code.woff2");
    expect(fonts.fonts).toEqual({ serif: "newsreader", mono: "assets/fonts/code.woff2" });
    expect(setFont(fonts, "serif", null).fonts).toEqual({ mono: "assets/fonts/code.woff2" });
    expect(setBase(draft, "classic").base).toBe("classic");
    expect(setBase(draft, "studio")).toBe(draft);
    expect(setMeta(draft, { name: "Night" }).meta.name).toBe("Night");
  });

  it("round-trips a validated skin through the draft", () => {
    const result = validateSkin(validSkin(), []);
    if (!result.ok) throw new Error("validSkin should validate");
    const json = draftToSkinJson(draftFromSkin(result.skin));
    const again = validateSkin(json, []);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.skin).toEqual(result.skin);
  });
});

describe("the draft history", () => {
  const start = startDraft("studio");
  const paint = (colour: string) => (draft: SkinDraft) => setToken(draft, "light", "chart-1", colour);

  it("undoes and redoes edits", () => {
    const one = edit(createHistory(start), paint("#111111"));
    const two = edit(one, paint("#222222"));
    expect(canUndo(two)).toBe(true);
    expect(canRedo(two)).toBe(false);
    const back = undo(two);
    expect(back.present).toBe(one.present);
    expect(canRedo(back)).toBe(true);
    expect(redo(back).present).toBe(two.present);
    expect(undo(undo(back)).present).toBe(start);
    expect(undo(createHistory(start))).toEqual(createHistory(start));
    expect(redo(two)).toBe(two);
  });

  it("drops the redo steps after a new edit, and records no step for a no-op", () => {
    const history = undo(edit(edit(createHistory(start), paint("#111111")), paint("#222222")));
    const branched = edit(history, paint("#333333"));
    expect(canRedo(branched)).toBe(false);
    expect(edit(branched, paint("#333333"))).toBe(branched);
    expect(commit(branched, { ...branched.present })).toBe(branched);
  });

  it("keeps at most HISTORY_LIMIT steps", () => {
    const shades = Array.from({ length: HISTORY_LIMIT + 10 }, (_, index) => `0 0% ${index % 100}.5%`);
    const history = shades.reduce((current, shade) => edit(current, paint(shade)), createHistory(start));
    expect(history.past).toHaveLength(HISTORY_LIMIT);
  });
});
