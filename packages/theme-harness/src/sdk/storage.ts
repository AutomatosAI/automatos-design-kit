/**
 * PRD-261 B-02b: the fake of SDK area `storage`, which is core's own runtime ported: frontend/lib/theme-sdk/
 * storage.ts over internal/theme-state-runtime.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac), moved here
 * from the stand-in Play's tests had (E3g's test/storage-port.ts), with useThemeState added. The same key scheme
 * in the window's localStorage ('browser') and sessionStorage ('session'); the same readiness (no scope: reads
 * not ready, writes refused 'not-ready', the window's storage untouched; `within: 'workspace'` waits for the
 * workspace); frozen snapshots, the same object while the value is; one `storage` listener for other tabs;
 * memory and one warning while the storage is blocked. The scope core's host publishes (theme-state-scope.tsx)
 * is the stand-in a test sets (host.setStorage); its workspace follows the context fake's, as core's does.
 * Left out: core's cache-size bounds.
 */
import type { ThemeStateOptions, ThemeStateResult, ThemeStateValue } from '@automatos/theme-sdk'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { cell } from '../internal/cell.ts'
import {
  BAD_KEY, BAD_OPTIONS, hasOwn, isKey, memoryStore, NOT_READY, ON_THE_SERVER, parseBlob, removeChange, resolveOptions,
  storageKeyFor, THEME_STATE_KEY_PREFIX, THEME_STATE_LIMITS, themeStateIn, writeChange,
  type Change, type Lifetime, type Resolved, type Store,
} from '../internal/theme-state-rules.ts'
import { currentWorkspace, subscribeWorkspace, WORKSPACE_DEFAULTS } from './context.ts'

export { THEME_STATE_KEY_PREFIX, THEME_STATE_LIMITS }

type Sdk = typeof import('@automatos/theme-sdk')

/** What the host publishes, and whether the browser lets the state be kept. */
export interface StorageStandIn {
  /** True while an installed theme runs and its user is known; false: reads not ready, writes refused. */
  readonly ready: boolean
  /** False: the browser blocks its storage; state lives in memory until the reset, with one warning. */
  readonly persisted: boolean
  readonly themeId: string
  /** The signed-in user's id; the local edition's one user is 'local'. */
  readonly userKey: string
  /** The workspace's id; null while it loads or failed, and then `within: 'workspace'` state is not ready. */
  readonly workspaceKey: string | null
}

interface Snapshot { readonly ready: boolean; readonly value: ThemeStateValue | null; readonly persisted: boolean }
interface Subscriber { readonly key: string; readonly options: Resolved; readonly listener: () => void }

/**
 * An installed theme (Play's id, the kit's first theme; another theme sets its own with host.setStorage) running in
 * the local edition, in the context fake's workspace: the scope a test starts with.
 */
export const STORAGE_DEFAULTS: StorageStandIn = Object.freeze({
  ready: true, persisted: true, themeId: 'automatos/play', userKey: 'local', workspaceKey: WORKSPACE_DEFAULTS.id,
})

/** theme-state-runtime.ts:85-88. */
const NOT_READY_SNAPSHOT: Snapshot = Object.freeze({ ready: false, value: null, persisted: false })
const BAD_KEY_SNAPSHOT: Snapshot = Object.freeze({ ready: true, value: null, persisted: false })
const BLOCKED_WARNING = "Automatos theme SDK: this browser's storage is blocked, so theme state is kept for this page only."
const SCOPE_FIELDS = ['ready', 'themeId', 'userKey', 'workspaceKey'] as const
const LIFETIMES: readonly Lifetime[] = Object.freeze(['browser', 'session'])

const standIn = cell<StorageStandIn>(STORAGE_DEFAULTS)
let memory: Readonly<Partial<Record<Lifetime, Store>>> = Object.freeze({})
let warned = false
let listening = false
const subscribers = new Map<Subscriber, Snapshot>()
const snapshots = new Map<string, { readonly raw: string | null; readonly text: string; readonly snapshot: Snapshot }>()

const onTheServer = (): boolean => typeof window === 'undefined'

/** theme-state-runtime.ts:121: the scope's storage key, or null while the host publishes no scope. */
function keyFor(options: Resolved): string | null {
  const scope = standIn.get()
  return scope.ready ? storageKeyFor(scope, options) : null
}

const windowStore = (lifetime: Lifetime): Store => (lifetime === 'browser' ? window.localStorage : window.sessionStorage)

/** What the lifetime's storage still lets us read; nothing when it refuses reads too. */
function readableThemeState(lifetime: Lifetime): Map<string, string> {
  try {
    return themeStateIn(windowStore(lifetime))
  } catch {
    return new Map()
  }
}

/** theme-state-runtime.ts:162: swaps the lifetime's storage for memory, seeded with what it holds; warns once. */
function fallBackToMemory(lifetime: Lifetime): Store {
  const store = memoryStore(readableThemeState(lifetime))
  memory = Object.freeze({ ...memory, [lifetime]: store })
  if (!warned) {
    warned = true
    console.warn(BLOCKED_WARNING)
  }
  return store
}

/** theme-state-runtime.ts:181: runs `operation` on the lifetime's storage, and on memory once it is blocked or throws. */
function onStorage<R>(lifetime: Lifetime, operation: (store: Store) => R): { readonly result: R; readonly persisted: boolean } {
  const kept = memory[lifetime]
  if (kept) return { result: operation(kept), persisted: false }
  if (standIn.get().persisted) {
    try {
      return { result: operation(windowStore(lifetime)), persisted: true }
    } catch {
      // The browser refused (blocked site data, a full quota): the state moves to memory below.
    }
  }
  return { result: operation(fallBackToMemory(lifetime)), persisted: false }
}

/** theme-state-runtime.ts:195: the cached snapshot while the key's value and persistence are unchanged. */
function snapshotOf(storageKey: string, key: string, raw: string | null, value: ThemeStateValue | null, persisted: boolean): Snapshot {
  const id = `${storageKey}\n${key}`
  const cached = snapshots.get(id)
  if (cached && cached.raw === raw && cached.snapshot.persisted === persisted) return cached.snapshot
  const text = JSON.stringify(value)
  const same = cached !== undefined && cached.text === text && cached.snapshot.persisted === persisted
  const snapshot = same ? cached.snapshot : Object.freeze({ ready: true, value, persisted })
  snapshots.set(id, { raw, text, snapshot })
  return snapshot
}

/** theme-state-runtime.ts:208. */
function snapshotFor(key: string, options: Resolved): Snapshot {
  const storageKey = keyFor(options)
  if (storageKey === null) return NOT_READY_SNAPSHOT
  if (!isKey(key)) return BAD_KEY_SNAPSHOT
  const { result: raw, persisted } = onStorage(options.lifetime, (store) => store.getItem(storageKey))
  const { data } = parseBlob(raw)
  return snapshotOf(storageKey, key, raw, hasOwn(data, key) ? data[key] : null, persisted)
}

/** theme-state-runtime.ts:219. */
function readSnapshot(key: string, options?: unknown): Snapshot {
  const resolved = onTheServer() ? null : resolveOptions(options)
  return resolved === null ? NOT_READY_SNAPSHOT : snapshotFor(key, resolved)
}

function notify(subscriber: Subscriber, next: Snapshot): void {
  subscribers.set(subscriber, next)
  try {
    subscriber.listener()
  } catch (error) {
    console.error(`Automatos theme SDK: a theme state listener for '${subscriber.key}' threw:`, error)
  }
}

function notifyAll(): void {
  Array.from(subscribers.keys()).forEach((subscriber) => notify(subscriber, snapshotFor(subscriber.key, subscriber.options)))
}

/** theme-state-runtime.ts:242: tells the subscribers whose key lives in one of `storageKeys` and whose value changed. */
function notifyChanged(storageKeys: readonly string[]): void {
  Array.from(subscribers.entries()).forEach(([subscriber, last]) => {
    const storageKey = keyFor(subscriber.options)
    if (storageKey === null || !storageKeys.includes(storageKey)) return
    const next = snapshotFor(subscriber.key, subscriber.options)
    if (next !== last) notify(subscriber, next)
  })
}

function onStorageEvent(event: StorageEvent): void {
  if (event.key === null) notifyAll()
  else if (event.key.startsWith(THEME_STATE_KEY_PREFIX)) notifyChanged([event.key])
}

function listenForOtherTabs(listen: boolean): void {
  if (listen === listening) return
  listening = listen
  if (listen) window.addEventListener('storage', onStorageEvent)
  else window.removeEventListener('storage', onStorageEvent)
}

/** theme-state-runtime.ts:282: runs a write or remove against the scope's blob, then tells the subscribers it touched. */
function change(key: string, options: unknown, operation: Change): ThemeStateResult {
  if (onTheServer()) return ON_THE_SERVER
  const resolved = resolveOptions(options)
  if (resolved === null) return BAD_OPTIONS
  const storageKey = keyFor(resolved)
  if (storageKey === null) return NOT_READY
  if (!isKey(key)) return BAD_KEY
  const now = Date.now()
  const { result, persisted } = onStorage(resolved.lifetime, (store) => operation(store, storageKey, now))
  if (!result.ok) return result
  notifyChanged([storageKey, ...result.evicted])
  return Object.freeze({ ok: true as const, persisted })
}

/** storage.ts:52. */
export const readThemeState = ((key: string, options?: ThemeStateOptions) => readSnapshot(key, options)) satisfies Sdk['readThemeState']

/** storage.ts:57. */
export const writeThemeState = ((key: string, value: ThemeStateValue, options?: ThemeStateOptions) =>
  change(key, options, writeChange(key, value))) satisfies Sdk['writeThemeState']

/** storage.ts:62. */
export const removeThemeState = ((key: string, options?: ThemeStateOptions) => change(key, options, removeChange(key))) satisfies Sdk['removeThemeState']

/** storage.ts:67 over theme-state-runtime.ts:266. */
export const subscribeThemeState = ((key: string, listener: () => void, options?: ThemeStateOptions): (() => void) => {
  const resolved = resolveOptions(options)
  if (onTheServer() || resolved === null || typeof listener !== 'function') return () => undefined
  const subscriber: Subscriber = { key, options: resolved, listener }
  subscribers.set(subscriber, snapshotFor(key, resolved))
  listenForOtherTabs(true)
  return () => {
    subscribers.delete(subscriber)
    if (subscribers.size === 0) listenForOtherTabs(false)
  }
}) satisfies Sdk['subscribeThemeState']

/** storage.ts:76: the key's state for a component, re-rendering when it changes, with `set` and `remove` bound to it. */
export const useThemeState = ((key: string, options?: ThemeStateOptions) => {
  const lifetime = options?.lifetime
  const within = options?.within
  const subscribe = useCallback((listener: () => void) => subscribeThemeState(key, listener, { lifetime, within }), [key, lifetime, within])
  const getSnapshot = useCallback(() => readSnapshot(key, { lifetime, within }), [key, lifetime, within])
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => NOT_READY_SNAPSHOT)
  return useMemo(() => ({
    ready: snapshot.ready,
    value: snapshot.value,
    persisted: snapshot.persisted,
    set: (value: ThemeStateValue) => writeThemeState(key, value, { lifetime, within }),
    remove: () => removeThemeState(key, { lifetime, within }),
  }), [snapshot, key, lifetime, within])
}) satisfies Sdk['useThemeState']

/** The storage area's user, for the look scope (looks.ts). */
export const useStorageUserKey = (): string => standIn.use().userKey

/** theme-state-runtime.ts:316: changes what the host publishes; a changed scope tells every subscriber. */
function setStorage(next: Partial<StorageStandIn>): void {
  const before = standIn.get()
  const after = Object.freeze({ ...before, ...next })
  standIn.set(after)
  if (SCOPE_FIELDS.some((field) => before[field] !== after[field])) notifyAll()
}

// The workspace part of the scope is the context fake's workspace (core: theme-state-scope.tsx workspaceKeyOf).
subscribeWorkspace(() => setStorage({ workspaceKey: currentWorkspace()?.id ?? null }))

/** The controls of this area, gathered by host.ts. */
export const storageControls = Object.freeze({
  setStorage,
  /** Another tab sets `key` (or removes it, for undefined): its blob changes in the window's storage and a storage event fires. */
  changeInAnotherTab(key: string, value: ThemeStateValue | undefined, options?: ThemeStateOptions): void {
    const resolved = resolveOptions(options)
    const storageKey = resolved === null ? null : keyFor(resolved)
    if (resolved === null || storageKey === null || !isKey(key)) throw new Error('changeInAnotherTab: no scope for these options, or a bad key')
    const operation = value === undefined ? removeChange(key) : writeChange(key, value)
    const result = operation(windowStore(resolved.lifetime), storageKey, Date.now())
    if (!result.ok) throw new Error(`changeInAnotherTab: ${result.message}`)
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey }))
  },
})

/** STORAGE_DEFAULTS again, with no theme state in the window's storage, no memory, warning, subscriber or snapshot. */
export function resetStorage(): void {
  standIn.set(STORAGE_DEFAULTS)
  memory = Object.freeze({})
  warned = false
  subscribers.clear()
  snapshots.clear()
  if (onTheServer()) return
  listenForOtherTabs(false)
  LIFETIMES.forEach((lifetime) => {
    const store = windowStore(lifetime)
    Array.from(themeStateIn(store).keys()).forEach((storageKey) => store.removeItem(storageKey))
  })
}
