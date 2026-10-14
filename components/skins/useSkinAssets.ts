import { useCallback, useEffect, useMemo, useState } from "react";

import type { AssetStore } from "@/lib/skins/asset-store";
import { mimeType, ownBuffer, type StoredAsset } from "@/lib/skins/assets";

// The draft's font and mascot files: read from the asset store after mount, kept in memory for
// the page, and written back on every change. Each file gets an object URL (blob:) for the
// preview's @font-face rules and the mascot player; they are revoked when the files change or
// the page goes. A failed write still keeps the file for this visit and says so in words.

export interface SkinAssetsApi {
  readonly loaded: boolean;
  readonly assets: ReadonlyMap<string, StoredAsset>;
  /** Object URLs by package path ("assets/fonts/x.woff2"); empty where the browser can't make them. */
  readonly urls: Readonly<Record<string, string>>;
  /** Why files aren't kept in this browser, or why the last change wasn't saved. */
  readonly notice: string | null;
  add(assets: readonly StoredAsset[]): Promise<void>;
  remove(paths: readonly string[]): Promise<void>;
}

function objectUrl(asset: StoredAsset): string | null {
  try {
    return URL.createObjectURL(new Blob([ownBuffer(asset.bytes)], { type: mimeType(asset.bytes) }));
  } catch (error) {
    console.warn(`[skins] ${asset.path} can't be shown: this browser made no object URL for it.`, error);
    return null;
  }
}

function revokeAll(urls: Readonly<Record<string, string>>): void {
  for (const url of Object.values(urls)) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("[skins] an object URL couldn't be released:", error);
    }
  }
}

function useObjectUrls(assets: ReadonlyMap<string, StoredAsset>): Readonly<Record<string, string>> {
  const [urls, setUrls] = useState<Readonly<Record<string, string>>>({});
  useEffect(() => {
    const made = Object.fromEntries(
      [...assets.values()].flatMap((asset) => {
        const url = objectUrl(asset);
        return url === null ? [] : [[asset.path, url] as const];
      }),
    );
    setUrls(made);
    return () => revokeAll(made);
  }, [assets]);
  return urls;
}

export function useSkinAssets(store: AssetStore): SkinAssetsApi {
  const [assets, setAssets] = useState<ReadonlyMap<string, StoredAsset>>(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    store
      .load()
      .then((result) => {
        if (!live) return;
        setAssets((current) => new Map([...result.assets.map((asset) => [asset.path, asset] as const), ...current]));
        setNotice(result.ok ? null : result.message);
        setLoaded(true);
      })
      .catch((error: unknown) => {
        console.error("[skins] the font and mascot files couldn't be read:", error);
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [store]);

  const add = useCallback(
    async (added: readonly StoredAsset[]) => {
      setAssets((current) => new Map([...current, ...added.map((asset) => [asset.path, asset] as const)]));
      const result = await store.put(added);
      setNotice(result.ok ? null : result.message);
    },
    [store],
  );

  const remove = useCallback(
    async (paths: readonly string[]) => {
      setAssets((current) => new Map([...current].filter(([path]) => !paths.includes(path))));
      const result = await store.remove(paths);
      setNotice(result.ok ? null : result.message);
    },
    [store],
  );

  const urls = useObjectUrls(assets);
  return useMemo(() => ({ loaded, assets, urls, notice, add, remove }), [loaded, assets, urls, notice, add, remove]);
}
