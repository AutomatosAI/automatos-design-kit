import { ownBuffer, type StoredAsset } from "./assets";
import { isRecord } from "./validate-common";

// Where the draft's font and mascot files live between reloads: IndexedDB in this browser
// (localStorage is too small for clips and holds text only). IndexedDB may be missing (a
// private window, an old browser, jsdom), blocked or full: every call answers with a result,
// never a throw, and a failure carries a sentence to show and logs the detail. Records are
// {path, name, bytes} with bytes as an ArrayBuffer; what comes back is checked before use.

export const ASSET_DB_NAME = "automatos-skin-kit";
export const ASSET_DB_VERSION = 1;
export const ASSET_STORE_NAME = "assets";

export const NO_STORAGE_MESSAGE = "This browser won't keep font and mascot files, so they go when you reload.";
export const FULL_MESSAGE = "This browser has no room left for these files. Remove a font or some mascot files, or use smaller ones.";
export const SAVE_FAILED_MESSAGE = "These files couldn't be kept in this browser. They work until you reload.";

export type StoreResult = { readonly ok: true } | { readonly ok: false; readonly message: string };
export type LoadResult =
  | { readonly ok: true; readonly assets: readonly StoredAsset[] }
  | { readonly ok: false; readonly message: string; readonly assets: readonly StoredAsset[] };

export interface AssetStore {
  load(): Promise<LoadResult>;
  /** Adds or replaces files by path. */
  put(assets: readonly StoredAsset[]): Promise<StoreResult>;
  remove(paths: readonly string[]): Promise<StoreResult>;
}

const PATH_MAX = 200;
const NAME_MAX = 400;

/** A record read back from IndexedDB, or null when it isn't one this editor wrote. */
export function parseStoredAsset(value: unknown): StoredAsset | null {
  if (!isRecord(value)) return null;
  const { path, name, bytes } = value;
  if (typeof path !== "string" || path.length > PATH_MAX || !path.startsWith("assets/")) return null;
  if (typeof name !== "string" || name.length > NAME_MAX) return null;
  if (bytes instanceof ArrayBuffer) return { path, name, bytes: new Uint8Array(bytes) };
  if (bytes instanceof Uint8Array) return { path, name, bytes };
  return null;
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    : error instanceof Error && error.name === "QuotaExceededError";
}

/** The sentence a failed write shows. */
export function writeFailureMessage(error: unknown): string {
  return isQuotaError(error) ? FULL_MESSAGE : SAVE_FAILED_MESSAGE;
}

function requestDone<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** The failed request's own error: while it bubbles, transaction.error is still null. */
function requestError(event: Event): unknown {
  const { target } = event;
  return target !== null && "error" in target ? target.error : null;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => reject(requestError(event) ?? transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(ASSET_DB_NAME, ASSET_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ASSET_STORE_NAME)) {
        request.result.createObjectStore(ASSET_STORE_NAME, { keyPath: "path" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB didn't open"));
    request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab"));
  });
}

/** The IndexedDB store. `factory` returns undefined where the browser has none. */
export function indexedDbAssetStore(factory: () => IDBFactory | undefined): AssetStore {
  let opening: Promise<IDBDatabase> | null = null;
  const database = (): Promise<IDBDatabase> => {
    const found = factory();
    if (found === undefined) return Promise.reject(new Error("IndexedDB isn't available in this browser"));
    opening ??= openDatabase(found).catch((error: unknown) => {
      opening = null;
      throw error;
    });
    return opening;
  };

  const write = async (change: (store: IDBObjectStore) => void, what: string): Promise<StoreResult> => {
    try {
      const db = await database();
      const transaction = db.transaction(ASSET_STORE_NAME, "readwrite");
      change(transaction.objectStore(ASSET_STORE_NAME));
      await transactionDone(transaction);
      return { ok: true };
    } catch (error) {
      console.error(`[skins] ${what} failed in IndexedDB:`, error);
      return { ok: false, message: writeFailureMessage(error) };
    }
  };

  return {
    async load() {
      try {
        const db = await database();
        const store = db.transaction(ASSET_STORE_NAME, "readonly").objectStore(ASSET_STORE_NAME);
        const records = await requestDone<unknown[]>(store.getAll());
        const assets = records.flatMap((record) => parseStoredAsset(record) ?? []);
        if (assets.length !== records.length) console.warn("[skins] some stored files weren't ones this editor wrote; they're ignored.");
        return { ok: true, assets };
      } catch (error) {
        console.warn("[skins] the stored font and mascot files can't be read:", error);
        return { ok: false, message: NO_STORAGE_MESSAGE, assets: [] };
      }
    },
    put(assets) {
      return write((store) => {
        for (const asset of assets) store.put({ path: asset.path, name: asset.name, bytes: ownBuffer(asset.bytes) });
      }, "Keeping files");
    },
    remove(paths) {
      return write((store) => {
        for (const path of paths) store.delete(path);
      }, "Removing files");
    },
  };
}

/** A store that lasts as long as the page: tests, and the fallback where IndexedDB is missing. */
export function memoryAssetStore(initial: readonly StoredAsset[] = []): AssetStore {
  let held = new Map(initial.map((asset) => [asset.path, asset] as const));
  return {
    async load() {
      return { ok: true, assets: [...held.values()] };
    },
    async put(assets) {
      held = new Map([...held, ...assets.map((asset) => [asset.path, asset] as const)]);
      return { ok: true };
    },
    async remove(paths) {
      held = new Map([...held].filter(([path]) => !paths.includes(path)));
      return { ok: true };
    },
  };
}

/** The browser's store, opened on first use. */
export const browserAssetStore: AssetStore = indexedDbAssetStore(() =>
  typeof indexedDB === "undefined" ? undefined : indexedDB,
);
