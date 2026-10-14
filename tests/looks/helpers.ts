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
