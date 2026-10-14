// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runValidate, terminalSafe, USAGE } from "@/scripts/lib/validate-cli";
import { PNG_BYTES, validSkin, withTokens, type Json } from "./helpers";

// npm run validate over real folders and .autoskin files in a temporary directory.

let root = "";

function capture() {
  const log: string[] = [];
  const error: string[] = [];
  return { io: { log: (line: string) => log.push(line), error: (line: string) => error.push(line) }, log, error };
}

async function skinFolder(name: string, skin: Json | string, files: Record<string, Uint8Array> = {}): Promise<string> {
  const dir = join(root, name);
  await mkdir(join(dir, "assets"), { recursive: true });
  await writeFile(join(dir, "skin.json"), typeof skin === "string" ? skin : JSON.stringify(skin, null, 2));
  for (const [path, bytes] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), bytes);
  }
  return dir;
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "skin-cli-"));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("npm run validate", () => {
  it("passes a valid folder and ignores the OS's own files", async () => {
    const skin = { ...validSkin(), preview: "assets/preview.png" };
    const dir = await skinFolder("good", skin, { "assets/preview.png": PNG_BYTES, ".DS_Store": new Uint8Array(4) });
    const out = capture();
    expect(await runValidate([dir], out.io)).toBe(0);
    expect(out.log).toEqual(["✓ Warm Paper (warm-paper 1.0.0) is a valid automatos-skin/v1 skin."]);
    expect(out.error).toEqual([]);
  });

  it("prints each problem with its JSON path and exits 1", async () => {
    const skin = withTokens(validSkin(), "light", { primary: "16 100% 50%", "primary-foreground": "0 0% 98%" });
    const dir = await skinFolder("contrast", skin, { "assets/notes.txt": new TextEncoder().encode("hi") });
    const out = capture();
    expect(await runValidate([dir], out.io)).toBe(1);
    expect(out.error).toEqual([
      "✗ $.tokens.light.primary-foreground  In light, primary-foreground on primary is 3.30:1; text needs at least 4.5:1.",
      "✗ assets/notes.txt  skin.json doesn't name this file, and a skin may hold only the files it names. Remove it.",
      `2 problems in ${dir}.`,
    ]);
  });

  it("refuses files outside assets/ and symbolic links in a folder", async () => {
    const dir = await skinFolder("links", validSkin(), { "theme.css": new TextEncoder().encode("body{}") });
    await symlink("/etc/hosts", join(dir, "assets", "preview.png"));
    const out = capture();
    expect(await runValidate([dir], out.io)).toBe(1);
    expect(out.error.slice(0, 2)).toEqual([
      `✗ assets/preview.png  "assets/preview.png" is a link. Put the real file in its place.`,
      `✗ theme.css  "theme.css" is outside assets/. A skin holds only skin.json and files under assets/.`,
    ]);
  });

  it("never lets a hostile name drive the terminal", () => {
    expect(terminalSafe("assets/\u001b]0;pwned\u0007x.png")).toBe("assets/?]0;pwned?x.png");
    expect(terminalSafe("a\nb\u202Ec")).toBe("a?b?c");
    expect(terminalSafe("x".repeat(500))).toHaveLength(401);
  });

  it("refuses a skin.json that is a link", async () => {
    const dir = join(root, "linked");
    await mkdir(join(dir, "assets"), { recursive: true });
    await writeFile(join(root, "real.json"), JSON.stringify(validSkin()));
    await symlink(join(root, "real.json"), join(dir, "skin.json"));
    const out = capture();
    expect(await runValidate([dir], out.io)).toBe(1);
    expect(out.error[0]).toBe("✗ $  skin.json is a link. Put the real file in its place.");
  });

  it("says when skin.json isn't JSON", async () => {
    const dir = await skinFolder("broken", "{ name: ");
    const out = capture();
    expect(await runValidate([dir], out.io)).toBe(1);
    expect(out.error[0]).toMatch(/^✗ \$  skin\.json isn't valid JSON: /);
  });

  it("validates a .autoskin file", async () => {
    const skin = { ...validSkin(), preview: "assets/preview.png" };
    const file = join(root, "warm-paper-1.0.0.autoskin");
    await writeFile(file, zipSync({ "skin.json": new TextEncoder().encode(JSON.stringify(skin)), "assets/preview.png": PNG_BYTES }));
    const out = capture();
    expect(await runValidate([file], out.io)).toBe(0);
    expect(out.log[0]).toContain("is a valid automatos-skin/v1 skin");
  });

  it("refuses other files, a missing path and wrong usage", async () => {
    const other = join(root, "skin.zip");
    await writeFile(other, PNG_BYTES);
    const out = capture();
    expect(await runValidate([other], out.io)).toBe(1);
    expect(out.error[0]).toBe("✗ $  Give a skin folder or a .autoskin file.");
    expect(await runValidate([join(root, "nowhere")], out.io)).toBe(2);
    expect(out.error).toContain(`There's no folder or file at ${join(root, "nowhere")}.`);
    expect(await runValidate([], out.io)).toBe(2);
    expect(await runValidate(["a", "b"], out.io)).toBe(2);
    expect(out.error.filter((line) => line === USAGE)).toHaveLength(2);
  });
});
