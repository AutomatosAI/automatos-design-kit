// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unpackSkin } from "@/lib/skins/pack";
import { PACK_USAGE, runPack } from "@/scripts/lib/pack-cli";
import { PNG_BYTES, WOFF2_BYTES, validSkin, withTokens, type Json } from "./helpers";

// npm run pack <dir> over real folders in a temporary directory: validate first, then
// dist/<slug>-<version>.autoskin; nothing written for an invalid skin.

let root = "";
let out = "";

function capture() {
  const log: string[] = [];
  const error: string[] = [];
  return { io: { log: (line: string) => log.push(line), error: (line: string) => error.push(line) }, log, error };
}

async function skinFolder(name: string, skin: Json, files: Record<string, Uint8Array> = {}): Promise<string> {
  const dir = join(root, name);
  await mkdir(join(dir, "assets"), { recursive: true });
  await writeFile(join(dir, "skin.json"), JSON.stringify(skin, null, 2));
  for (const [path, bytes] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), bytes);
  }
  return dir;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skin-pack-"));
  out = join(root, "dist");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("npm run pack", () => {
  it("writes dist/<slug>-<version>.autoskin that unpacks to the same skin and files", async () => {
    const skin = { ...validSkin(), fonts: { sans: "assets/fonts/face.woff2" }, preview: "assets/preview.png" };
    const dir = await skinFolder("good", skin, {
      "assets/fonts/face.woff2": WOFF2_BYTES,
      "assets/preview.png": PNG_BYTES,
      ".DS_Store": new Uint8Array(4),
    });
    const io = capture();

    expect(await runPack([dir], io.io, { outDir: out })).toBe(0);
    expect(io.error).toEqual([]);
    expect(io.log).toEqual([expect.stringMatching(/^✓ Packed Warm Paper into .*warm-paper-1\.0\.0\.autoskin \(\d+(\.\d)? KB\)\.$/)]);

    const unpacked = unpackSkin(new Uint8Array(await readFile(join(out, "warm-paper-1.0.0.autoskin"))));
    expect(unpacked.ok).toBe(true);
    if (!unpacked.ok) return;
    expect(unpacked.skinText).toBe(JSON.stringify(skin, null, 2));
    expect(unpacked.files.map((file) => file.path)).toEqual(["assets/fonts/face.woff2", "assets/preview.png"]);
  });

  it("validates first: an invalid skin prints its problems, exits 1 and writes nothing", async () => {
    const skin = withTokens(validSkin(), "light", { primary: "16 100% 50%", "primary-foreground": "0 0% 98%" });
    const dir = await skinFolder("contrast", skin);
    const io = capture();

    expect(await runPack([dir], io.io, { outDir: out })).toBe(1);
    expect(io.error).toEqual([
      "✗ $.tokens.light.primary-foreground  In light, primary-foreground on primary is 3.30:1; text needs at least 4.5:1.",
      `1 problem in ${dir}. Nothing was packed.`,
    ]);
    await expect(readFile(join(out, "warm-paper-1.0.0.autoskin"))).rejects.toThrow();
  });

  it("refuses a file the skin doesn't name", async () => {
    const dir = await skinFolder("extra", validSkin(), { "assets/notes.txt": new TextEncoder().encode("hi") });
    const io = capture();
    expect(await runPack([dir], io.io, { outDir: out })).toBe(1);
    expect(io.error[0]).toMatch(/^✗ assets\/notes\.txt {2}skin\.json doesn't name this file/);
  });

  it("says how to use it, and that it takes a folder", async () => {
    const usage = capture();
    expect(await runPack([], usage.io, { outDir: out })).toBe(2);
    expect(usage.error).toEqual([PACK_USAGE]);

    const missing = capture();
    expect(await runPack([join(root, "nowhere")], missing.io, { outDir: out })).toBe(2);
    expect(missing.error).toEqual([`There's no folder at ${join(root, "nowhere")}.`]);

    const file = join(root, "skin.autoskin");
    await writeFile(file, new Uint8Array(4));
    const notFolder = capture();
    expect(await runPack([file], notFolder.io, { outDir: out })).toBe(2);
    expect(notFolder.error[0]).toMatch(/isn't a folder/);
  });
});
