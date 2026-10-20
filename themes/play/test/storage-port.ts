// The SDK's storage area as Play's tests get it (test/sdk-stub.ts re-exports the names Play calls), and the
// controls a test sets the host with (setStorage, resetStorage, changeInAnotherTab), until the harness's
// storage area (packages/theme-harness, PRD-261 B-02b) replaces it. It ports core's frontend/lib/theme-sdk/storage.ts over internal/theme-state-{store,runtime}.ts
// at 0dd8b846e41772c8dd7ef159e4373bcb9419b06a: the same key scheme in the window's localStorage ('browser')
// and sessionStorage ('session'); the same readiness (no scope: reads not ready, writes refused 'not-ready',
// the window's storage untouched; `within: 'workspace'` waits for the workspace); JSON values only, within
// THEME_STATE_LIMITS (the oldest blob evicted past the per-lifetime cap); frozen snapshots, the same object
// while the value is; one `storage` listener for other tabs; memory and one warning while the storage is
// blocked. Left out: useThemeState (Play doesn't call it) and core's cache-size bounds.
import type { ThemeStateOptions, ThemeStateResult, ThemeStateValue } from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')

type Lifetime = 'browser' | 'session'
type Within = 'account' | 'workspace'
type Failure = Extract<ThemeStateResult, { ok: false }>
type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>
type Data = Readonly<Record<string, ThemeStateValue>>
type Changed = { readonly ok: true; readonly evicted: readonly string[] } | Failure
type Change = (store: Store, storageKey: string, now: number) => Changed

interface Resolved { readonly lifetime: Lifetime; readonly within: Within }
interface Snapshot { readonly ready: boolean; readonly value: ThemeStateValue | null; readonly persisted: boolean }
interface Subscriber { readonly key: string; readonly options: Resolved; readonly listener: () => void }

/** What the host publishes, and whether the browser lets the state be kept. */
export interface StorageStandIn {
  /** True while an installed theme runs and its user is known; false: reads not ready, writes refused. */
  readonly ready: boolean
  /** False: the browser blocks its storage; state lives in memory until resetStorage, with one warning. */
  readonly persisted: boolean
  readonly themeId: string
  /** The signed-in user's id; the local edition's one user is 'local'. */
  readonly userKey: string
  /** The workspace's id; null while it loads or failed, and then `within: 'workspace'` state is not ready. */
  readonly workspaceKey: string | null
}

export const THEME_STATE_LIMITS = Object.freeze({
  keyPattern: '^[a-z][a-z0-9-]{0,47}$', keysPerBlob: 32, valueChars: 32768, blobChars: 65536, depth: 8, blobsPerLifetime: 8,
} as const) satisfies Sdk['THEME_STATE_LIMITS']

/** Only keys with exactly this prefix are theme state. */
export const THEME_STATE_KEY_PREFIX = 'automatos-theme-state:v1:'
/** Play running in the local edition, in one workspace: the scope a test starts with. */
export const STORAGE_DEFAULTS: StorageStandIn = Object.freeze({
  ready: true, persisted: true, themeId: 'automatos/play', userKey: 'local', workspaceKey: 'workspace-1',
})

const BLOB_VERSION = 1
const LIFETIME_LETTER: Readonly<Record<Lifetime, string>> = Object.freeze({ browser: 'b', session: 's' })
const LIFETIMES: readonly string[] = Object.freeze(['browser', 'session'])
const WITHINS: readonly string[] = Object.freeze(['account', 'workspace'])
const KEY_RE = new RegExp(THEME_STATE_LIMITS.keyPattern)
const EMPTY_DATA: Data = Object.freeze({})
const NOT_READY_SNAPSHOT: Snapshot = Object.freeze({ ready: false, value: null, persisted: false })
const BAD_KEY_SNAPSHOT: Snapshot = Object.freeze({ ready: true, value: null, persisted: false })
const BLOCKED_WARNING = "Automatos theme SDK: this browser's storage is blocked, so theme state is kept for this page only."

const failure = (reason: Failure['reason'], message: string): Failure => Object.freeze({ ok: false as const, reason, message })

const NOT_READY = failure('not-ready', "Theme state isn't ready here: only an installed theme, once its user is known, keeps state.")
const ON_THE_SERVER = failure('unavailable', 'Theme state is kept in the browser; there is none on the server.')
const BAD_OPTIONS = failure('bad-key', "Theme state options are lifetime 'browser' or 'session' and within 'account' or 'workspace'.")
const BAD_KEY = failure('bad-key', `A theme state key is a lowercase letter, then lowercase letters, digits or hyphens (${THEME_STATE_LIMITS.keyPattern}).`)

let standIn: StorageStandIn = STORAGE_DEFAULTS
let memory: Readonly<Partial<Record<Lifetime, Store>>> = Object.freeze({})
let warned = false
let listening = false
const subscribers = new Map<Subscriber, Snapshot>()
const snapshots = new Map<string, { readonly raw: string | null; readonly text: string; readonly snapshot: Snapshot }>()

const onTheServer = (): boolean => typeof window === 'undefined'
const hasOwn = (data: object, key: string): boolean => Object.prototype.hasOwnProperty.call(data, key)
const isKey = (key: unknown): key is string => typeof key === 'string' && KEY_RE.test(key)
const isPart = (part: unknown): part is string => typeof part === 'string' && part.length > 0 && !part.includes(':')

function listProblem(values: readonly unknown[], depth: number, ancestors: Set<object>): string | null {
  for (const item of values) {
    const problem = valueProblem(item, depth, ancestors)
    if (problem) return problem
  }
  return null
}

function objectProblem(value: object, depth: number, ancestors: Set<object>): string | null {
  if (Array.isArray(value)) {
    return Object.keys(value).length === value.length ? listProblem(value, depth, ancestors) : 'an array has holes or named properties'
  }
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return 'only plain objects and arrays are kept (not a Date, Map, Set or class instance)'
  if (Object.getOwnPropertySymbols(value).length > 0) return 'an object has symbol keys'
  const descriptors = Object.keys(value).map((name) => Object.getOwnPropertyDescriptor(value, name))
  if (descriptors.some((descriptor) => !descriptor || !('value' in descriptor))) return 'an object has a getter'
  return listProblem(descriptors.map((descriptor) => descriptor?.value), depth, ancestors)
}

/** Why `value` is not JSON within the depth cap, or null when it is; `depth` counts the containers above it. */
function valueProblem(value: unknown, depth: number, ancestors: Set<object>): string | null {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return null
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'numbers must be finite'
  if (typeof value !== 'object') return `${typeof value} values are not JSON`
  if (ancestors.has(value)) return 'the value refers to itself'
  if (depth >= THEME_STATE_LIMITS.depth) return `values nest at most ${THEME_STATE_LIMITS.depth} deep`
  ancestors.add(value)
  const problem = objectProblem(value, depth + 1, ancestors)
  ancestors.delete(value)
  return problem
}

/** The value as JSON text when it may be kept; never throws. */
function checkValue(value: unknown): { readonly ok: true; readonly text: string } | Failure {
  let problem: string | null
  let text = ''
  try {
    problem = valueProblem(value, 0, new Set())
    if (!problem) text = JSON.stringify(value)
  } catch {
    problem = 'the value could not be read'
  }
  if (problem) return failure('bad-value', `Theme state keeps JSON values only: ${problem}.`)
  const cap = THEME_STATE_LIMITS.valueChars
  if (text.length > cap) return failure('too-large', `A theme state value is at most ${cap} characters as JSON; this one is ${text.length}.`)
  return { ok: true, text }
}

/** JSON.parse's reviver: every object and array of the blob comes back frozen. */
const frozen = (_key: string, value: unknown): unknown => (value !== null && typeof value === 'object' ? Object.freeze(value) : value)

function isValidData(data: unknown): data is Record<string, ThemeStateValue> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return false
  const entries = Object.entries(data)
  return entries.length <= THEME_STATE_LIMITS.keysPerBlob && entries.every(([key, value]) => isKey(key) && checkValue(value).ok)
}

/** A blob's write time and data; empty (time null) when there is none or it doesn't read back. */
function parseBlob(raw: string | null): { readonly at: number | null; readonly data: Data } {
  const unreadable = { at: null, data: EMPTY_DATA }
  if (raw === null || raw.length > THEME_STATE_LIMITS.blobChars) return unreadable
  let parsed: unknown
  try {
    parsed = JSON.parse(raw, frozen)
  } catch {
    return unreadable
  }
  if (parsed === null || typeof parsed !== 'object') return unreadable
  const { v, at, data } = parsed as { v?: unknown; at?: unknown; data?: unknown }
  const readable = v === BLOB_VERSION && typeof at === 'number' && Number.isFinite(at) && isValidData(data)
  return readable ? { at: at as number, data: data as Data } : unreadable
}

const blobText = (data: Readonly<Record<string, unknown>>, now: number): string => JSON.stringify({ v: BLOB_VERSION, at: now, data })

function resolveOptions(options: unknown): Resolved | null {
  if (options === undefined || options === null) return { lifetime: 'browser', within: 'account' }
  if (typeof options !== 'object') return null
  const { lifetime = 'browser', within = 'account' } = options as { lifetime?: unknown; within?: unknown }
  if (typeof lifetime !== 'string' || !LIFETIMES.includes(lifetime)) return null
  if (typeof within !== 'string' || !WITHINS.includes(within)) return null
  return { lifetime: lifetime as Lifetime, within: within as Within }
}

/** The storage key of the scope's blob for these options; null while not ready or the scope can't name one. */
function storageKeyFor(options: Resolved): string | null {
  const { ready, themeId, userKey, workspaceKey } = standIn
  if (!ready || !isPart(themeId) || !isPart(userKey)) return null
  if (options.within === 'workspace' && !isPart(workspaceKey)) return null
  const scope = options.within === 'account' ? `u:${userKey}` : `w:${workspaceKey}:u:${userKey}`
  return `${THEME_STATE_KEY_PREFIX}${LIFETIME_LETTER[options.lifetime]}:${themeId}:${scope}`
}

function memoryStore(seed: ReadonlyMap<string, string>): Store {
  const items = new Map(seed)
  return {
    get length() {
      return items.size
    },
    key: (index: number) => Array.from(items.keys())[index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(String(key), String(value)),
    removeItem: (key: string) => void items.delete(key),
  }
}

function themeStateIn(store: Store): Map<string, string> {
  const found = new Map<string, string>()
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    const raw = key !== null && key.startsWith(THEME_STATE_KEY_PREFIX) ? store.getItem(key) : null
    if (key !== null && raw !== null) found.set(key, raw)
  }
  return found
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

/** Swaps the lifetime's storage for memory, seeded with what it holds, for the rest of the test; warns once. */
function fallBackToMemory(lifetime: Lifetime): Store {
  const store = memoryStore(readableThemeState(lifetime))
  memory = Object.freeze({ ...memory, [lifetime]: store })
  if (!warned) {
    warned = true
    console.warn(BLOCKED_WARNING)
  }
  return store
}

/** Runs `operation` on the lifetime's storage, and on memory once that storage is blocked or throws. */
function onStorage<R>(lifetime: Lifetime, operation: (store: Store) => R): { readonly result: R; readonly persisted: boolean } {
  const kept = memory[lifetime]
  if (kept) return { result: operation(kept), persisted: false }
  if (standIn.persisted) {
    try {
      return { result: operation(windowStore(lifetime)), persisted: true }
    } catch {
      // The browser refused (blocked site data, a full quota): the state moves to memory below.
    }
  }
  return { result: operation(fallBackToMemory(lifetime)), persisted: false }
}

/** The cached snapshot while the key's value and persistence are unchanged, else a new one. */
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

function snapshotFor(key: string, options: Resolved): Snapshot {
  const storageKey = storageKeyFor(options)
  if (storageKey === null) return NOT_READY_SNAPSHOT
  if (!isKey(key)) return BAD_KEY_SNAPSHOT
  const { result: raw, persisted } = onStorage(options.lifetime, (store) => store.getItem(storageKey))
  const { data } = parseBlob(raw)
  return snapshotOf(storageKey, key, raw, hasOwn(data, key) ? data[key] : null, persisted)
}

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

/** Tells the subscribers whose key lives in one of `storageKeys` and whose value changed. */
function notifyChanged(storageKeys: readonly string[]): void {
  Array.from(subscribers.entries()).forEach(([subscriber, last]) => {
    const storageKey = storageKeyFor(subscriber.options)
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

/** The other blobs of the store to evict for a write to `storageKey`: the oldest, past the per-lifetime cap. */
function evictionFor(store: Store, storageKey: string): string[] {
  const others = Array.from(themeStateIn(store), ([key, raw]) => ({ key, at: parseBlob(raw).at ?? Number.NEGATIVE_INFINITY }))
    .filter((other) => other.key !== storageKey)
    .sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1))
  const over = others.length + 1 - THEME_STATE_LIMITS.blobsPerLifetime
  return over > 0 ? others.slice(0, over).map((other) => other.key) : []
}

function writeChange(key: string, value: unknown): Change {
  return (store, storageKey, now) => {
    const checked = checkValue(value)
    if (!checked.ok) return checked
    const { data } = parseBlob(store.getItem(storageKey))
    if (!hasOwn(data, key) && Object.keys(data).length >= THEME_STATE_LIMITS.keysPerBlob) {
      return failure('too-large', `A theme keeps at most ${THEME_STATE_LIMITS.keysPerBlob} keys here; '${key}' would be one more.`)
    }
    const raw = blobText({ ...data, [key]: value }, now)
    const cap = THEME_STATE_LIMITS.blobChars
    if (raw.length > cap) return failure('too-large', `A theme keeps at most ${cap} characters here; this write would make ${raw.length}.`)
    const evicted = evictionFor(store, storageKey)
    store.setItem(storageKey, raw)
    evicted.forEach((other) => store.removeItem(other))
    return { ok: true, evicted }
  }
}

function removeChange(key: string): Change {
  return (store, storageKey, now) => {
    const { data } = parseBlob(store.getItem(storageKey))
    if (!hasOwn(data, key)) return { ok: true, evicted: [] }
    const rest = Object.fromEntries(Object.entries(data).filter(([name]) => name !== key))
    if (Object.keys(rest).length === 0) store.removeItem(storageKey)
    else store.setItem(storageKey, blobText(rest, now))
    return { ok: true, evicted: [] }
  }
}

/** Runs a write or remove against the scope's blob, then tells the subscribers it touched. */
function change(key: string, options: unknown, operation: Change): ThemeStateResult {
  if (onTheServer()) return ON_THE_SERVER
  const resolved = resolveOptions(options)
  if (resolved === null) return BAD_OPTIONS
  const storageKey = storageKeyFor(resolved)
  if (storageKey === null) return NOT_READY
  if (!isKey(key)) return BAD_KEY
  const now = Date.now()
  const { result, persisted } = onStorage(resolved.lifetime, (store) => operation(store, storageKey, now))
  if (!result.ok) return result
  notifyChanged([storageKey, ...result.evicted])
  return Object.freeze({ ok: true as const, persisted })
}

export const readThemeState = ((key, options) => readSnapshot(key, options)) satisfies Sdk['readThemeState']

export const writeThemeState = ((key, value, options) => change(key, options, writeChange(key, value))) satisfies Sdk['writeThemeState']

export const removeThemeState = ((key, options) => change(key, options, removeChange(key))) satisfies Sdk['removeThemeState']

export const subscribeThemeState = ((key, listener, options) => {
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

// ---- The test's controls ----

/** Changes what the host publishes (or the browser allows); a changed scope tells every subscriber, as the host's does. */
export function setStorage(next: Partial<StorageStandIn>): void {
  const before = standIn
  standIn = Object.freeze({ ...standIn, ...next })
  const scope = ['ready', 'themeId', 'userKey', 'workspaceKey'] as const
  if (scope.some((field) => before[field] !== standIn[field])) notifyAll()
}

/** STORAGE_DEFAULTS again, with no theme state in the window's storage, no memory, warning, subscriber or snapshot. */
export function resetStorage(): void {
  standIn = STORAGE_DEFAULTS
  memory = Object.freeze({})
  warned = false
  subscribers.clear()
  snapshots.clear()
  if (onTheServer()) return
  listenForOtherTabs(false)
  for (const lifetime of ['browser', 'session'] as const) {
    const store = windowStore(lifetime)
    Array.from(themeStateIn(store).keys()).forEach((key) => store.removeItem(key))
  }
}

/** Another tab sets `key` (or removes it, for undefined): its blob changes in the window's storage and a storage event fires. */
export function changeInAnotherTab(key: string, value: ThemeStateValue | undefined, options?: ThemeStateOptions): void {
  const resolved = resolveOptions(options)
  const storageKey = resolved === null ? null : storageKeyFor(resolved)
  if (resolved === null || storageKey === null || !isKey(key)) throw new Error('changeInAnotherTab: no scope for these options, or a bad key')
  const store = windowStore(resolved.lifetime)
  const operation = value === undefined ? removeChange(key) : writeChange(key, value)
  const result = operation(store, storageKey, Date.now())
  if (!result.ok) throw new Error(`changeInAnotherTab: ${result.message}`)
  window.dispatchEvent(new StorageEvent('storage', { key: storageKey }))
}
