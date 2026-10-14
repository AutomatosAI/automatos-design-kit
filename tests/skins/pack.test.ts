// @vitest-environment node
import { zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { StoredAsset } from "@/lib/skins/assets";
import { PREVIEW_NOT_KEPT, draftPackFiles, draftSkinText, importDraft, packDraft } from "@/lib/skins/draft-pack";
import { MASCOT_FORMATS, MASCOT_STATES } from "@/lib/skins/format";
import { draftFromSkin, setMeta, type SkinDraft } from "@/lib/skins/model";
import { packSkin, packageFileName, unpackSkin, type PackFile } from "@/lib/skins/pack";
import { validateSkin } from "@/lib/skins/validate";
import { PNG_BYTES, TEXT_BYTES, WOFF2_BYTES, bytesFor, validSkin, withTokens, type Json } from "./helpers";

// PRD-004 K-007: skin.json plus assets/ in one .autoskin, and back. Both directions run the
// validator and refuse what Studio would refuse.

const text = (skin: Json) => `${JSON.stringify(skin, null, 2)}\n`;

function withFiles(): { readonly skin: Json; readonly files: readonly PackFile[] } {
  const skin = { ...validSkin(), fonts: { sans: "assets/fonts/face.woff2", mono: "Geist Mono" }, preview: "assets/preview.png" };
  return {
    skin,
    files: [
      { path: "assets/fonts/face.woff2", bytes: WOFF2_BYTES },
      { path: "assets/preview.png", bytes: PNG_BYTES },
    ],
  };
}

function mascotFiles(): readonly PackFile[] {
  return MASCOT_STATES.flatMap((state) =>
    MASCOT_FORMATS.map((format) => ({ path: `assets/mascot/${state}.${format}`, bytes: bytesFor(format) })),
  );
}

function validDraft(): SkinDraft {
  const checked = validateSkin(validSkin(), []);
  if (!checked.ok) throw new Error("the fixture skin must be valid");
  return draftFromSkin(checked.skin);
}

function stored(files: readonly PackFile[]): ReadonlyMap<string, StoredAsset> {
  return new Map(files.map((file) => [file.path, { path: file.path, name: file.path.split("/").pop() ?? "", bytes: file.bytes }]));
}

describe("packSkin and unpackSkin", () => {
  it("round-trips skin.json byte for byte, the validated skin and every file", () => {
    const { skin, files } = withFiles();
    const packed = packSkin(text(skin), files);
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    expect(packed.fileName).toBe("warm-paper-1.0.0.autoskin");

    const unpacked = unpackSkin(packed.bytes);
    expect(unpacked.ok).toBe(true);
    if (!unpacked.ok) return;
    expect(unpacked.skinText).toBe(text(skin));
    expect(unpacked.skin).toEqual(packed.skin);
    expect(unpacked.files.map((file) => file.path)).toEqual(["assets/fonts/face.woff2", "assets/preview.png"]);
    expect(unpacked.files[0]?.bytes).toEqual(WOFF2_BYTES);
    expect(unpacked.files[1]?.bytes).toEqual(PNG_BYTES);
  });

  it("gives the same bytes for the same skin", () => {
    const { skin, files } = withFiles();
    const first = packSkin(text(skin), files);
    const second = packSkin(text(skin), files);
    expect(first.ok && second.ok && first.bytes).toEqual(second.ok && second.bytes);
  });

  it("refuses an invalid skin and packs nothing", () => {
    const failing = withTokens(validSkin(), "light", { primary: "16 100% 50%", "primary-foreground": "0 0% 98%" });
    const result = packSkin(text(failing), []);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual([
      { path: "$.tokens.light.primary-foreground", message: expect.stringContaining("needs at least 4.5:1") },
    ]);
    expect(result).not.toHaveProperty("bytes");
  });

  it("refuses a file skin.json doesn't name, a named file that is missing, and text that isn't JSON", () => {
    const extra = packSkin(text(validSkin()), [{ path: "assets/notes.txt", bytes: TEXT_BYTES }]);
    expect(!extra.ok && extra.errors.map((error) => error.path)).toEqual(["assets/notes.txt"]);

    const { skin } = withFiles();
    const missing = packSkin(text(skin), []);
    expect(missing.ok).toBe(false);

    const broken = packSkin("{ not json", []);
    expect(!broken.ok && broken.errors[0]?.message).toMatch(/^skin\.json isn't valid JSON/);
  });

  it("refuses to unpack a package Studio would refuse, or one that isn't a zip", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = withTokens(validSkin(), "dark", { ring: "30 12% 10%" });
    const zipped = zipSync({ "skin.json": new TextEncoder().encode(JSON.stringify(failing)) });
    const result = unpackSkin(zipped);
    expect(!result.ok && result.errors.map((error) => error.path)).toEqual(["$.tokens.dark.ring"]);

    const notZip = unpackSkin(TEXT_BYTES);
    expect(!notZip.ok && notZip.errors[0]?.message).toMatch(/isn't a zip/);
    vi.restoreAllMocks();
  });

  it("names the file <slug>-<version>.autoskin", () => {
    expect(packageFileName({ slug: "neon", version: "2.1.0-beta.1" })).toBe("neon-2.1.0-beta.1.autoskin");
  });
});

describe("the editor's draft as a package", () => {
  it("packs the draft and imports it back to the same draft", () => {
    const draft = validDraft();
    const packed = packDraft(draft, new Map());
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    const imported = importDraft(packed.bytes);
    expect(imported.ok && imported.draft).toEqual(draft);
    expect(imported.ok && imported.assets).toEqual([]);
    const unpacked = unpackSkin(packed.bytes);
    expect(unpacked.ok && unpacked.skinText).toBe(draftSkinText(draft));
  });

  it("packs the font files the draft names and, for a custom mascot, its 36 clips and stills", () => {
    const font = { path: "assets/fonts/sans-face.woff2", bytes: WOFF2_BYTES };
    const unused = { path: "assets/fonts/old.woff2", bytes: WOFF2_BYTES };
    const draft: SkinDraft = { ...validDraft(), fonts: { sans: font.path, serif: "Newsreader" }, mascot: { mode: "custom" } };
    const assets = stored([font, unused, ...mascotFiles()]);

    expect(draftPackFiles(draft, assets).map((file) => file.path)).toEqual([font.path, ...mascotFiles().map((file) => file.path).sort()]);
    const packed = packDraft(draft, assets);
    expect(packed.ok).toBe(true);
    const imported = packed.ok ? importDraft(packed.bytes) : null;
    expect(imported?.ok && imported.assets.map((asset) => asset.path)).toHaveLength(37);
    expect(imported?.ok && imported.assets.find((asset) => asset.path === font.path)?.name).toBe("sans-face.woff2");
  });

  it("leaves the mascot files out when the mascot isn't custom", () => {
    expect(draftPackFiles(validDraft(), stored(mascotFiles()))).toEqual([]);
  });

  it("refuses a draft the validator refuses, in its words", () => {
    const packed = packDraft(setMeta(validDraft(), { author: "" }), new Map());
    expect(!packed.ok && packed.errors.map((error) => error.path)).toContain("$.author");

    const noFont = packDraft({ ...validDraft(), fonts: { sans: "assets/fonts/gone.woff2" } }, new Map());
    expect(noFont.ok).toBe(false);
  });

  it("drops an imported preview picture and says so", () => {
    const skin = { ...validSkin(), preview: "assets/preview.png" };
    const packed = packSkin(text(skin), [{ path: "assets/preview.png", bytes: PNG_BYTES }]);
    const imported = packed.ok ? importDraft(packed.bytes) : null;
    expect(imported?.ok && imported.assets).toEqual([]);
    expect(imported?.ok && imported.notes).toEqual([PREVIEW_NOT_KEPT]);
  });
});
