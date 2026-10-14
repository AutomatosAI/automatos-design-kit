// @vitest-environment node
import { zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { listArchive, readSkinArchive } from "@/lib/skins/archive";
import { validateSkin } from "@/lib/skins/validate";
import { PNG_BYTES, validSkin } from "./helpers";

const SYMLINK_ATTRS = 0o120777 * 0x10000;
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

function zip(files: Zippable): Uint8Array {
  return zipSync(files, { level: 6 });
}

describe("readSkinArchive", () => {
  it("reads skin.json and builds the manifest with sniffed types", () => {
    const skin = { ...validSkin(), preview: "assets/preview.png" };
    const result = readSkinArchive(zip({ "skin.json": json(skin), "assets/preview.png": PNG_BYTES }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(new TextDecoder().decode(result.skinJson))).toEqual(skin);
    expect(result.assets).toEqual([{ path: "assets/preview.png", bytes: PNG_BYTES.byteLength, sniffedType: "png" }]);
    expect(result.files.get("assets/preview.png")).toEqual(PNG_BYTES);
    expect(validateSkin(skin, result.assets).ok).toBe(true);
  });

  it("marks a symbolic link and never unpacks it", () => {
    const archive = zip({
      "skin.json": json(validSkin()),
      "assets/preview.png": [new TextEncoder().encode("/etc/passwd"), { os: 3, attrs: SYMLINK_ATTRS }],
    });
    expect(listArchive(archive)?.find((entry) => entry.name === "assets/preview.png")?.link).toBe(true);
    const result = readSkinArchive(archive);
    expect(result.ok && result.assets).toEqual([{ path: "assets/preview.png", bytes: 11, sniffedType: "unknown", link: true }]);
    expect(result.ok && result.files.has("assets/preview.png")).toBe(false);
  });

  it("lists entries outside assets/ so the validator refuses them", () => {
    const result = readSkinArchive(zip({ "skin.json": json(validSkin()), "../evil.png": PNG_BYTES }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const checked = validateSkin(validSkin(), result.assets);
    expect(checked.ok ? [] : checked.errors.map((error) => error.path)).toEqual(["../evil.png"]);
  });

  it("refuses a file that isn't a zip, or has no skin.json", () => {
    expect(readSkinArchive(PNG_BYTES)).toEqual({ ok: false, errors: [{ path: "$", message: "This isn't a .autoskin file: it isn't a zip Studio can read." }] });
    expect(readSkinArchive(zip({ "assets/preview.png": PNG_BYTES }))).toEqual({
      ok: false,
      errors: [{ path: "$", message: "The package has no skin.json at its top level." }],
    });
  });

  it("refuses a package over 15 MB, and one that unpacks to more", () => {
    const big = readSkinArchive(new Uint8Array(15 * 1024 * 1024 + 1));
    expect(big.ok ? "" : big.errors[0].message).toBe("The package is 15.1 MB; Studio accepts at most 15.0 MB.");
    const bomb = readSkinArchive(zip({ "skin.json": json(validSkin()), "assets/preview.png": new Uint8Array(16 * 1024 * 1024) }));
    expect(bomb.ok ? "" : bomb.errors[0].message).toContain("The package unpacks to 16.1 MB");
  });
});
