import { LOOK_VAR_NAMES } from "@/lib/looks/css";
import { EMBER } from "@/lib/looks/presets";
import type { Look } from "@/lib/looks/types";

/** A Storage kept in memory, for tests that shouldn't share jsdom's localStorage. */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}): Storage {
  const items = new Map(Object.entries(initial));
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => [...items.keys()][index] ?? null,
    removeItem: (key: string) => {
      items.delete(key);
    },
    setItem: (key: string, value: string) => {
      items.set(key, String(value));
    },
  };
}

/** Storage that refuses every access, like a sandboxed frame or blocked site data. */
export function blockedStorage(): Storage {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

/** A valid saved Look of the user's own. */
export function myLook(fields: Partial<Look> = {}): Look {
  return { ...EMBER, id: "my-look-1", name: "My look 1", sub: "Saved just now", accent: "rose", ground: "indigo", ...fields };
}

/** The Look variables currently on <html>. */
export function rootVars(): Readonly<Record<string, string>> {
  const style = document.documentElement.style;
  return Object.fromEntries(LOOK_VAR_NAMES.map((name) => [name, style.getPropertyValue(name).trim()]));
}

export function clearRoot(): void {
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-motion");
}

/** A Blob's text through FileReader (jsdom's Blob may have no text()). */
export function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** jsdom has no URL.createObjectURL: stub both URL statics, and return a function that puts them back. */
export function stubObjectUrls(create: (blob: Blob) => string, revoke: (url: string) => void): () => void {
  const saved = (["createObjectURL", "revokeObjectURL"] as const).map(
    (name) => [name, Object.getOwnPropertyDescriptor(URL, name)] as const,
  );
  Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true, writable: true });
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(URL, name, descriptor);
      else Reflect.deleteProperty(URL, name);
    }
  };
}
