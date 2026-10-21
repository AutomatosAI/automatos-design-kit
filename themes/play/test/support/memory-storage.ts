// Browser storage for the tests that need one other than jsdom's, and what it holds of Play's theme state.
// memoryStorage and blockedStorage are core's (frontend/lib/looks/__tests__/helpers.ts at
// 0dd8b846e41772c8dd7ef159e4373bcb9419b06a); swapWindowStorage hands one to the window, so the storage
// stand-in (test/storage-port.ts) meets it as it would meet the browser's: a new tab's session, or site
// data the browser blocks. The keys are core's scheme for the storage area, one blob per lifetime, theme
// and scope, here for the stand-in's scope (STORAGE_DEFAULTS: Play, the local edition's user, workspace-1).
import { vi } from 'vitest'
import { THEME_STATE_KEY_PREFIX } from '../storage-port.ts'

/** Play's blob in this browser for the account. */
export const BROWSER_ACCOUNT = `${THEME_STATE_KEY_PREFIX}b:automatos/play:u:local`
/** Play's blob in this tab's session for the account. */
export const SESSION_ACCOUNT = `${THEME_STATE_KEY_PREFIX}s:automatos/play:u:local`
/** Play's blob in this browser for the user in the stand-in's workspace. */
export const BROWSER_WORKSPACE = `${THEME_STATE_KEY_PREFIX}b:automatos/play:w:workspace-1:u:local`

/** A Storage kept in memory, for tests that shouldn't share jsdom's localStorage. */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}): Storage {
  const items = new Map(Object.entries(initial))
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => Array.from(items.keys())[index] ?? null,
    removeItem: (key: string) => {
      items.delete(key)
    },
    setItem: (key: string, value: string) => {
      items.set(key, String(value))
    },
  }
}

/** Storage that refuses every access, like a sandboxed frame or blocked site data. */
export function blockedStorage(): Storage {
  throw new DOMException('The operation is insecure.', 'SecurityError')
}

/** window.localStorage or window.sessionStorage answers from `storage` (which may throw) until vi.restoreAllMocks. */
export function swapWindowStorage(name: 'localStorage' | 'sessionStorage', storage: () => Storage): void {
  vi.spyOn(window, name, 'get').mockImplementation(storage)
}

/** The theme-state keys a storage holds. */
export function themeStateKeys(storage: Storage): string[] {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => key !== null && key.startsWith(THEME_STATE_KEY_PREFIX))
}

/** The data of the blob stored under `key`, or null when there is none. */
export function blobData(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key)
  return raw === null ? null : (JSON.parse(raw) as { readonly data?: unknown }).data
}
