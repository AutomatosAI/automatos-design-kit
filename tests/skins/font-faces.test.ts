// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserFontHost, registerFaces, skinFaceSources, type FontHost } from "@/lib/skins/font-faces";

import { WOFF2_BYTES } from "./helpers";

// K-010, decision K2: a skin's own woff2 faces go to the FontFace API under the family the CSS
// names; nothing is written as @font-face, and a face the browser refuses keeps its fallback.

afterEach(() => {
  vi.restoreAllMocks();
});

describe("skinFaceSources", () => {
  it("lists the slots that name a woff2 whose bytes are at hand, under Studio-made families", () => {
    const bytes = new Map([["assets/fonts/face.woff2", WOFF2_BYTES]]);
    const fonts = { sans: "assets/fonts/face.woff2", serif: "newsreader", mono: "assets/fonts/gone.woff2" };
    expect(skinFaceSources(fonts, "kit-draft", (path) => bytes.get(path))).toEqual([
      { slot: "sans", family: "skin-kit-draft-sans", bytes: WOFF2_BYTES },
    ]);
  });

  it("never takes a family from the skin: a bad id throws, a bad path is skipped", () => {
    expect(() => skinFaceSources({ sans: "assets/fonts/a.woff2" }, 'x"]{', () => WOFF2_BYTES)).toThrow();
    expect(skinFaceSources({ sans: "assets/fonts/a.woff2) url(x" }, "kit-draft", () => WOFF2_BYTES)).toEqual([]);
  });
});

describe("registerFaces", () => {
  it("registers each face from its bytes and removes them all again", async () => {
    const removed: string[] = [];
    const host: FontHost = {
      register: async (family, bytes) => {
        expect(bytes.byteLength).toBe(WOFF2_BYTES.length);
        return () => removed.push(family);
      },
    };
    const sources = [
      { slot: "sans" as const, family: "skin-kit-draft-sans", bytes: WOFF2_BYTES },
      { slot: "mono" as const, family: "skin-kit-draft-mono", bytes: WOFF2_BYTES },
    ];
    const remove = await registerFaces(sources, host);
    expect(removed).toEqual([]);
    remove();
    expect(removed).toEqual(["skin-kit-draft-sans", "skin-kit-draft-mono"]);
  });

  it("logs a face the browser refuses and keeps going, never rejecting", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const host: FontHost = { register: async () => Promise.reject(new Error("bad font")) };
    const remove = await registerFaces([{ slot: "serif", family: "skin-kit-draft-serif", bytes: WOFF2_BYTES }], host);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(() => remove()).not.toThrow();
  });
});

describe("browserFontHost", () => {
  it("is null where there is no FontFace API (the server)", () => {
    expect(browserFontHost()).toBeNull();
  });
});
