// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FULL_MESSAGE,
  NO_STORAGE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  indexedDbAssetStore,
  memoryAssetStore,
  parseStoredAsset,
  writeFailureMessage,
} from "@/lib/skins/asset-store";
import type { StoredAsset } from "@/lib/skins/assets";

import { PNG_BYTES, WOFF2_BYTES } from "./helpers";

// PRD-004 K-006: the draft's files live in IndexedDB so a reload keeps them. Every call answers
// with a result; a missing or full store says so in words.

afterEach(() => {
  vi.restoreAllMocks();
});

const FONT: StoredAsset = { path: "assets/fonts/face.woff2", name: "Face.woff2", bytes: WOFF2_BYTES };
const STILL: StoredAsset = { path: "assets/mascot/idle.png", name: "idle.png", bytes: PNG_BYTES };

function byPath(assets: readonly StoredAsset[]): Record<string, readonly number[]> {
  return Object.fromEntries(assets.map((asset) => [asset.path, [...asset.bytes]]));
}

describe("the IndexedDB store", () => {
  it("keeps files across opens: put, load, replace and remove", async () => {
    const factory = new IDBFactory();
    const store = indexedDbAssetStore(() => factory);
    expect(await store.load()).toEqual({ ok: true, assets: [] });
    expect(await store.put([FONT, STILL])).toEqual({ ok: true });

    const reopened = indexedDbAssetStore(() => factory);
    const loaded = await reopened.load();
    expect(loaded.ok).toBe(true);
    expect(byPath(loaded.assets)).toEqual(byPath([FONT, STILL]));
    expect(loaded.assets.find((asset) => asset.path === FONT.path)?.name).toBe("Face.woff2");

    const bigger: StoredAsset = { ...STILL, bytes: Uint8Array.from([...PNG_BYTES, 1, 2, 3]) };
    await reopened.put([bigger]);
    await reopened.remove([FONT.path]);
    expect(byPath((await store.load()).assets)).toEqual(byPath([bigger]));
  });

  it("stores only the bytes a Uint8Array views, not its whole buffer", async () => {
    const factory = new IDBFactory();
    const store = indexedDbAssetStore(() => factory);
    const backing = new Uint8Array([9, 9, ...WOFF2_BYTES, 9]);
    await store.put([{ ...FONT, bytes: backing.subarray(2, 2 + WOFF2_BYTES.length) }]);
    expect(byPath((await store.load()).assets)).toEqual(byPath([FONT]));
  });

  it("says so in words where the browser has no IndexedDB", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const store = indexedDbAssetStore(() => undefined);
    expect(await store.load()).toEqual({ ok: false, message: NO_STORAGE_MESSAGE, assets: [] });
    expect(await store.put([FONT])).toEqual({ ok: false, message: SAVE_FAILED_MESSAGE });
    expect(console.error).toHaveBeenCalled();
  });

  it("turns a full store into a sentence that says what to do", () => {
    expect(writeFailureMessage(new DOMException("full", "QuotaExceededError"))).toBe(FULL_MESSAGE);
    expect(FULL_MESSAGE).toMatch(/no room left/);
    expect(writeFailureMessage(new Error("other"))).toBe(SAVE_FAILED_MESSAGE);
  });

  it("ignores records it didn't write", () => {
    expect(parseStoredAsset({ path: "assets/fonts/a.woff2", name: "a.woff2", bytes: WOFF2_BYTES.buffer })?.bytes).toEqual(WOFF2_BYTES);
    expect(parseStoredAsset(null)).toBeNull();
    expect(parseStoredAsset({ path: "../x", name: "x", bytes: new ArrayBuffer(1) })).toBeNull();
    expect(parseStoredAsset({ path: "assets/x.png", name: 3, bytes: new ArrayBuffer(1) })).toBeNull();
    expect(parseStoredAsset({ path: "assets/x.png", name: "x", bytes: "AAAA" })).toBeNull();
  });
});

describe("the memory store", () => {
  it("holds files for the page", async () => {
    const store = memoryAssetStore([FONT]);
    await store.put([STILL]);
    expect(byPath((await store.load()).assets)).toEqual(byPath([FONT, STILL]));
    await store.remove([FONT.path]);
    expect(byPath((await store.load()).assets)).toEqual(byPath([STILL]));
  });
});
