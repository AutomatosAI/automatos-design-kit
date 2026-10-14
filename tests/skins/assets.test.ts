// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  checkFontFile,
  checkMascotDrop,
  describeMissing,
  fontAssetPath,
  fontSizeProblem,
  isMascotFileName,
  mascotAssetPath,
  mascotDropSizeProblem,
  mascotSetSummary,
  missingMascotFiles,
  mimeType,
  type DroppedFile,
  type StoredAsset,
} from "@/lib/skins/assets";
import { FONT_FILE_PATTERN, FONT_MAX_BYTES, MASCOT_FORMATS, MASCOT_MAX_BYTES, MASCOT_STATES, mascotFiles } from "@/lib/skins/format";

import { MP4_BYTES, PNG_BYTES, TEXT_BYTES, WEBM_BYTES, WOFF2_BYTES, bytesFor } from "./helpers";

// PRD-004 K-006: the editor's checks on dropped fonts and mascot files, in plain words.

function sized(head: Uint8Array, length: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => head[index] ?? 0);
}

function dropped(name: string, bytes: Uint8Array): DroppedFile {
  return { name, bytes };
}

/** The whole custom set, or all of it but `skip`. */
function mascotDrop(skip: readonly string[] = [], bytesEach = 64): DroppedFile[] {
  return MASCOT_STATES.flatMap((state) =>
    MASCOT_FORMATS.filter((format) => !skip.includes(`${state}.${format}`)).map((format) =>
      dropped(`${state}.${format}`, sized(bytesFor(format), bytesEach)),
    ),
  );
}

function stored(files: readonly DroppedFile[]): StoredAsset[] {
  return files.map((file) => ({ path: `assets/mascot/${file.name}`, name: file.name, bytes: file.bytes }));
}

describe("fonts", () => {
  it("keeps a woff2 file under a safe package path made from its name", () => {
    const check = checkFontFile(dropped("My Face (Bold).woff2", WOFF2_BYTES), "sans");
    expect(check).toEqual({ ok: true, asset: { path: "assets/fonts/sans-My-Face-Bold.woff2", name: "My Face (Bold).woff2", bytes: WOFF2_BYTES } });
    expect(fontAssetPath("My Face (Bold).woff2", "mono")).toBe("assets/fonts/mono-My-Face-Bold.woff2");
  });

  it("refuses a file that isn't woff2 by its first bytes, whatever its name", () => {
    const check = checkFontFile(dropped("sneaky.woff2", PNG_BYTES), "sans");
    expect(check).toEqual({
      ok: false,
      message: '"sneaky.woff2" isn\'t a woff2 font: its first bytes say it is a PNG image. Convert it to .woff2 and drop it again.',
    });
    expect(checkFontFile(dropped("face.ttf", TEXT_BYTES), "sans").ok).toBe(false);
  });

  it("refuses a font over 400 KB, before and after reading", () => {
    expect(fontSizeProblem("big.woff2", FONT_MAX_BYTES)).toBeNull();
    expect(fontSizeProblem("big.woff2", FONT_MAX_BYTES + 1)).toBe(
      '"big.woff2" is 401 KB; a font may be at most 400 KB. Subset it to the characters you need.',
    );
    const check = checkFontFile(dropped("big.woff2", sized(WOFF2_BYTES, FONT_MAX_BYTES + 1)), "serif");
    expect(check.ok).toBe(false);
  });

  it("falls back to the slot alone when the file name has nothing usable, and always fits the format", () => {
    expect(fontAssetPath("???.woff2", "mono")).toBe("assets/fonts/mono.woff2");
    expect(fontAssetPath(".woff2", "serif")).toBe("assets/fonts/serif.woff2");
    for (const name of ["a.b.c.woff2", "Ünïcode Face.woff2", "x".repeat(200), "../../etc/passwd", "-dash-.WOFF2"]) {
      expect(FONT_FILE_PATTERN.test(fontAssetPath(name, "serif"))).toBe(true);
    }
    expect(fontAssetPath("../../etc/passwd", "sans")).toBe("assets/fonts/sans-etc-passwd.woff2");
  });

  it("names the MIME type from the bytes", () => {
    expect(mimeType(WOFF2_BYTES)).toBe("font/woff2");
    expect(mimeType(WEBM_BYTES)).toBe("video/webm");
    expect(mimeType(MP4_BYTES)).toBe("video/mp4");
    expect(mimeType(PNG_BYTES)).toBe("image/png");
    expect(mimeType(TEXT_BYTES)).toBe("application/octet-stream");
  });
});

describe("the custom mascot set", () => {
  it("maps <state>.<format> names to the package's mascot paths, and nothing else", () => {
    expect(mascotAssetPath("idle.webm")).toBe("assets/mascot/idle.webm");
    expect(mascotAssetPath("Hello.PNG")).toBe("assets/mascot/hello.png");
    expect(mascotAssetPath("idle.mov")).toBeNull();
    expect(mascotAssetPath("dance.webm")).toBeNull();
    expect(mascotAssetPath("idle.webm.png")).toBeNull();
    expect(mascotAssetPath("../idle.webm")).toBeNull();
    expect(isMascotFileName("idle.webm")).toBe(true);
    expect(isMascotFileName("README.md")).toBe(false);
  });

  it("accepts a whole set, with all 36 files in place", () => {
    const result = checkMascotDrop([], mascotDrop());
    expect(result.problems).toEqual([]);
    expect(result.accepted.map((asset) => asset.path).sort()).toEqual([...mascotFiles()].sort());
    expect(mascotSetSummary(new Set(result.accepted.map((asset) => asset.path)))).toBe("All 36 files are here.");
  });

  it("lists what a set is missing, by state and format", () => {
    const result = checkMascotDrop([], mascotDrop(["hello.webm", "hello.mp4", "hello.png", "oops.png"]));
    const paths = new Set(result.accepted.map((asset) => asset.path));
    expect(missingMascotFiles(paths)).toEqual([
      { state: "hello", formats: ["webm", "mp4", "png"] },
      { state: "oops", formats: ["png"] },
    ]);
    expect(describeMissing(missingMascotFiles(paths))).toBe("hello (webm, mp4, png), oops (png)");
    expect(mascotSetSummary(paths)).toBe("32 of 36 files. Missing: hello (webm, mp4, png), oops (png).");
    expect(mascotSetSummary(new Set())).toMatch(/^0 of 36 files\. Missing: hello \(webm, mp4, png\), idle/);
  });

  it("refuses a file whose bytes aren't its kind, and keeps the rest", () => {
    const result = checkMascotDrop([], [dropped("idle.webm", PNG_BYTES), dropped("idle.png", PNG_BYTES)]);
    expect(result.accepted.map((asset) => asset.path)).toEqual(["assets/mascot/idle.png"]);
    expect(result.problems).toEqual(['"idle.webm" isn\'t a WebM video: its first bytes say it is a PNG image.']);
  });

  it("names files it doesn't use and skips hidden OS files without a word", () => {
    const result = checkMascotDrop([], [dropped("notes.txt", TEXT_BYTES), dropped(".DS_Store", TEXT_BYTES), dropped("idle.png", PNG_BYTES)]);
    expect(result.accepted).toHaveLength(1);
    expect(result.problems).toEqual(['Not used: "notes.txt". A mascot file is named <state>.webm, .mp4 or .png, such as idle.webm.']);
  });

  it("adds to the files already kept, and a new file replaces one of the same name", () => {
    const first = stored([dropped("idle.png", PNG_BYTES)]);
    const replacement = sized(PNG_BYTES, 128);
    const result = checkMascotDrop(first, [dropped("idle.png", replacement), dropped("idle.webm", WEBM_BYTES)]);
    expect(result.accepted.map((asset) => [asset.path, asset.bytes.length])).toEqual([
      ["assets/mascot/idle.png", 128],
      ["assets/mascot/idle.webm", 64],
    ]);
  });

  it("refuses a whole drop that takes the set over 8 MB, counting what is kept", () => {
    const half = Math.floor(MASCOT_MAX_BYTES / 2) + 1;
    const kept = stored([dropped("idle.webm", sized(WEBM_BYTES, half))]);
    const result = checkMascotDrop(kept, [dropped("idle.mp4", sized(MP4_BYTES, half))]);
    expect(result.accepted).toEqual([]);
    expect(result.problems).toEqual([
      "These files would bring the mascot to 8.1 MB; together its files may be at most 8.0 MB. Nothing was added.",
    ]);
    expect(checkMascotDrop(kept, [dropped("idle.webm", sized(WEBM_BYTES, half))]).accepted).toHaveLength(1);
  });

  it("says a drop is too big before reading it", () => {
    expect(mascotDropSizeProblem(MASCOT_MAX_BYTES)).toBeNull();
    expect(mascotDropSizeProblem(MASCOT_MAX_BYTES * 2)).toBe(
      "These files come to 16.0 MB; together a mascot's files may be at most 8.0 MB. Nothing was added.",
    );
  });
});
