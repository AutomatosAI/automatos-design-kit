// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AssetEntry, SkinError } from "@/lib/skins/format";
import { validateSkin } from "@/lib/skins/validate";
import { asset, mascotSet, validSkin, type Json } from "./helpers";

const KB = 1024;
const MB = 1024 * KB;

function errorsOf(skin: Json, assets: readonly AssetEntry[], packageBytes?: number): readonly SkinError[] {
  const result = validateSkin(skin, assets, { packageBytes });
  return result.ok ? [] : result.errors;
}

const withPreview: Json = { ...validSkin(), preview: "assets/preview.png" };
const withFont: Json = { ...validSkin(), fonts: { serif: "assets/fonts/display.woff2" } };
const withCustom: Json = { ...validSkin(), mascot: { mode: "custom" } };

describe("validateSkin: package files", () => {
  it.each([
    ["styles.css", "is outside assets/"],
    ["/etc/passwd", "is outside assets/"],
    ["assets/../skin.json", "isn't a plain file path"],
    ["assets/.hidden", "isn't a plain file path"],
    ["assets\\fonts\\x.woff2", "is outside assets/"],
    ["assets/fonts/x y.woff2", "isn't a plain file path"],
    ["assets//preview.png", "isn't a plain file path"],
  ])("refuses the path %j", (path, message) => {
    const errors = errorsOf(validSkin(), [asset(path, "unknown")]);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe(path);
    expect(errors[0].message).toContain(message);
  });

  it("refuses a symbolic link, even where a real file is expected", () => {
    const errors = errorsOf(withPreview, [{ path: "assets/preview.png", bytes: 0, sniffedType: "unknown", link: true }]);
    expect(errors).toEqual([{ path: "assets/preview.png", message: `"assets/preview.png" is a link. Put the real file in its place.` }]);
  });

  it("refuses files skin.json doesn't name, and says so plainly for code", () => {
    const errors = errorsOf(validSkin(), [asset("assets/notes.txt", "unknown"), asset("assets/theme.css", "unknown"), asset("assets/logo.svg", "unknown")]);
    expect(errors.map((error) => error.message)).toEqual([
      "skin.json doesn't name this file, and a skin may hold only the files it names. Remove it.",
      "A skin never holds CSS, JavaScript, SVG, HTML or other code. Remove this file.",
      "A skin never holds CSS, JavaScript, SVG, HTML or other code. Remove this file.",
    ]);
  });

  it("refuses mascot clips unless the mode is custom", () => {
    const errors = errorsOf(validSkin(), [asset("assets/mascot/idle.webm", "webm")]);
    expect(errors).toEqual([
      {
        path: "assets/mascot/idle.webm",
        message: `Mascot files are only used when "mascot.mode" is "custom". Remove this file or switch the mode.`,
      },
    ]);
  });

  it("doesn't judge a part's files again when that part of skin.json already failed", () => {
    const badShell = { ...validSkin(), mascot: { mode: "custom", shell: "plaid" } };
    expect(errorsOf(badShell, mascotSet()).map((error) => error.path)).toEqual(["$.mascot.shell"]);
    const badFont = { ...validSkin(), fonts: { serif: "assets/fonts/display.ttf" } };
    expect(errorsOf(badFont, [asset("assets/fonts/display.ttf", "unknown")]).map((error) => error.path)).toEqual(["$.fonts.serif"]);
  });

  it("reports a file listed twice once", () => {
    const errors = errorsOf(withPreview, [asset("assets/preview.png", "png"), asset("assets/preview.png", "png")]);
    expect(errors).toEqual([{ path: "assets/preview.png", message: "This file is in the package more than once." }]);
  });

  it("checks each file's type by its first bytes", () => {
    expect(errorsOf(withFont, [asset("assets/fonts/display.woff2", "png")])).toEqual([
      { path: "assets/fonts/display.woff2", message: "This isn't a woff2 font: its first bytes say it is a PNG image." },
    ]);
    expect(errorsOf(withPreview, [asset("assets/preview.png", "unknown")])[0].message).toBe(
      "This isn't a PNG image: its first bytes say it is something else.",
    );
    const clips = mascotSet().map((entry) => (entry.path === "assets/mascot/idle.mp4" ? { ...entry, sniffedType: "webm" as const } : entry));
    expect(errorsOf(withCustom, clips)[0]).toEqual({
      path: "assets/mascot/idle.mp4",
      message: "This isn't an MP4 video: its first bytes say it is a WebM video.",
    });
  });

  it("says when a named file is missing", () => {
    expect(errorsOf(withFont, [])).toEqual([
      { path: "$.fonts.serif", message: "assets/fonts/display.woff2 is named here but isn't in the package." },
    ]);
    expect(errorsOf(withPreview, [])[0].path).toBe("$.preview");
  });

  it("lists every file a custom mascot is missing", () => {
    const partial = mascotSet().filter((entry) => !["assets/mascot/oops.webm", "assets/mascot/loading.png"].includes(entry.path));
    expect(errorsOf(withCustom, partial)).toEqual([
      {
        path: "$.mascot",
        message: "A custom mascot needs 36 files in assets/mascot/ (12 states × webm, mp4, png). Missing: oops.webm, loading.png.",
      },
    ]);
  });
});

describe("validateSkin: size caps", () => {
  it("caps each font at 400 KB", () => {
    expect(errorsOf(withFont, [asset("assets/fonts/display.woff2", "woff2", 400 * KB)])).toEqual([]);
    expect(errorsOf(withFont, [asset("assets/fonts/display.woff2", "woff2", 400 * KB + 1)])).toEqual([
      { path: "assets/fonts/display.woff2", message: "This font is 401 KB; a font may be at most 400 KB." },
    ]);
  });

  it("caps the preview at 1 MB", () => {
    expect(errorsOf(withPreview, [asset("assets/preview.png", "png", MB + 1)])).toEqual([
      { path: "assets/preview.png", message: "The preview is 1.1 MB; it may be at most 1.0 MB." },
    ]);
  });

  it("caps the mascot files at 8 MB together", () => {
    expect(errorsOf(withCustom, mascotSet(200 * KB))).toEqual([]);
    expect(errorsOf(withCustom, mascotSet(300 * KB))).toEqual([
      { path: "$.mascot", message: "The mascot files come to 10.6 MB; together they may be at most 8.0 MB." },
    ]);
  });

  it("caps the package at 15 MB", () => {
    expect(errorsOf(validSkin(), [], 15 * MB)).toEqual([]);
    expect(errorsOf(validSkin(), [], 16 * MB)).toEqual([{ path: "$", message: "The package is 16.0 MB; Studio accepts at most 15.0 MB." }]);
  });
});
