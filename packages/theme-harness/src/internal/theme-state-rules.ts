/**
 * PRD-261 B-02b: the storage area's pure rules, for the harness's storage fake (src/sdk/storage.ts). A port of
 * core's frontend/lib/theme-sdk/internal/theme-state-store.ts (at 101a0bf33f64fb4f89af81b4293415be60b661ac),
 * moved here from the stand-in Play's tests had (E3g's themes/play/test/storage-port.ts): the same caps
 * (THEME_STATE_LIMITS, :44), key prefix (:54) and key scheme (:77-89, one blob per lifetime, theme and scope),
 * JSON values only (:126-152), blobs that read back or count as empty (:180), frozen as they are parsed, and
 * the oldest blob evicted past the per-lifetime cap. Left out: core's parse cache.
 */
import type { ThemeStateResult, ThemeStateValue } from '@automatos/theme-sdk'

type Sdk = typeof import('@automatos/theme-sdk')

export type Lifetime = 'browser' | 'session'
export type Within = 'account' | 'workspace'
export type Failure = Extract<ThemeStateResult, { ok: false }>
export type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>
export type Data = Readonly<Record<string, ThemeStateValue>>
export type Changed = { readonly ok: true; readonly evicted: readonly string[] } | Failure
/** A write or remove of one key, against the store that holds the scope's blob. */
export type Change = (store: Store, storageKey: string, now: number) => Changed

export interface Resolved {
  readonly lifetime: Lifetime
  readonly within: Within
}

/** Whose state it is: the installed theme, its user and (once known) the workspace. */
export interface Scope {
  readonly themeId: string
  readonly userKey: string
  readonly workspaceKey: string | null
}

export const THEME_STATE_LIMITS = Object.freeze({
  keyPattern: '^[a-z][a-z0-9-]{0,47}$', keysPerBlob: 32, valueChars: 32768, blobChars: 65536, depth: 8, blobsPerLifetime: 8,
} as const) satisfies Sdk['THEME_STATE_LIMITS']

/** Only keys with exactly this prefix are theme state. */
export const THEME_STATE_KEY_PREFIX = 'automatos-theme-state:v1:'

const BLOB_VERSION = 1
const LIFETIME_LETTER: Readonly<Record<Lifetime, string>> = Object.freeze({ browser: 'b', session: 's' })
const LIFETIMES: readonly string[] = Object.freeze(['browser', 'session'])
const WITHINS: readonly string[] = Object.freeze(['account', 'workspace'])
const KEY_RE = new RegExp(THEME_STATE_LIMITS.keyPattern)
const SCOPE_SEPARATOR = ':'
const EMPTY_DATA: Data = Object.freeze({})

export const failure = (reason: Failure['reason'], message: string): Failure => Object.freeze({ ok: false as const, reason, message })

export const NOT_READY = failure('not-ready', "Theme state isn't ready here: only an installed theme, once its user is known, keeps state.")
export const ON_THE_SERVER = failure('unavailable', 'Theme state is kept in the browser; there is none on the server.')
export const BAD_OPTIONS = failure('bad-key', "Theme state options are lifetime 'browser' or 'session' and within 'account' or 'workspace'.")
export const BAD_KEY = failure('bad-key', `A theme state key is a lowercase letter, then lowercase letters, digits or hyphens (${THEME_STATE_LIMITS.keyPattern}).`)

export const hasOwn = (data: object, key: string): boolean => Object.prototype.hasOwnProperty.call(data, key)
export const isKey = (key: unknown): key is string => typeof key === 'string' && KEY_RE.test(key)
const isPart = (part: unknown): part is string => typeof part === 'string' && part.length > 0 && !part.includes(SCOPE_SEPARATOR)

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
export function checkValue(value: unknown): { readonly ok: true; readonly text: string } | Failure {
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
export function parseBlob(raw: string | null): { readonly at: number | null; readonly data: Data } {
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

/** The options with the defaults (browser, account) filled in, or null when they are not the SDK's options. */
export function resolveOptions(options: unknown): Resolved | null {
  if (options === undefined || options === null) return { lifetime: 'browser', within: 'account' }
  if (typeof options !== 'object') return null
  const { lifetime = 'browser', within = 'account' } = options as { lifetime?: unknown; within?: unknown }
  if (typeof lifetime !== 'string' || !LIFETIMES.includes(lifetime)) return null
  if (typeof within !== 'string' || !WITHINS.includes(within)) return null
  return { lifetime: lifetime as Lifetime, within: within as Within }
}

/** The storage key of the scope's blob for these options; null when the scope can't name one. */
export function storageKeyFor(scope: Scope, options: Resolved): string | null {
  const { themeId, userKey, workspaceKey } = scope
  if (!isPart(themeId) || !isPart(userKey)) return null
  if (options.within === 'workspace' && !isPart(workspaceKey)) return null
  const owner = options.within === 'account' ? `u:${userKey}` : `w:${workspaceKey}:u:${userKey}`
  return `${THEME_STATE_KEY_PREFIX}${LIFETIME_LETTER[options.lifetime]}:${themeId}:${owner}`
}

/** A Storage kept in memory, seeded with what the browser's still held. */
export function memoryStore(seed: ReadonlyMap<string, string>): Store {
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

/** Every theme-state blob a store holds, by storage key. */
export function themeStateIn(store: Store): Map<string, string> {
  const found = new Map<string, string>()
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    const raw = key !== null && key.startsWith(THEME_STATE_KEY_PREFIX) ? store.getItem(key) : null
    if (key !== null && raw !== null) found.set(key, raw)
  }
  return found
}

/** The other blobs of the store to evict for a write to `storageKey`: the oldest, past the per-lifetime cap. */
function evictionFor(store: Store, storageKey: string): string[] {
  const others = Array.from(themeStateIn(store), ([key, raw]) => ({ key, at: parseBlob(raw).at ?? Number.NEGATIVE_INFINITY }))
    .filter((other) => other.key !== storageKey)
    .sort((a, b) => a.at - b.at || (a.key < b.key ? -1 : 1))
  const over = others.length + 1 - THEME_STATE_LIMITS.blobsPerLifetime
  return over > 0 ? others.slice(0, over).map((other) => other.key) : []
}

/** Keeps `value` under `key` in the scope's blob, within the caps, evicting the oldest blobs past the cap. */
export function writeChange(key: string, value: unknown): Change {
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

/** Forgets `key` in the scope's blob; the blob goes when it holds nothing else. */
export function removeChange(key: string): Change {
  return (store, storageKey, now) => {
    const { data } = parseBlob(store.getItem(storageKey))
    if (!hasOwn(data, key)) return { ok: true, evicted: [] }
    const rest = Object.fromEntries(Object.entries(data).filter(([name]) => name !== key))
    if (Object.keys(rest).length === 0) store.removeItem(storageKey)
    else store.setItem(storageKey, blobText(rest, now))
    return { ok: true, evicted: [] }
  }
}
