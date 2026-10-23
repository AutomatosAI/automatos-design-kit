/**
 * PRD-261 B-02b: the fake of SDK area `looks`. It mirrors core's frontend/lib/theme-sdk/looks.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac): outside a look runtime (the default here) useLook answers
 * `available: false`, listLooks is empty, exportLook is null and every action refuses in core's words. A test
 * mounts a look runtime with host.setLooks: the active look, the saved looks and their flags, and the theme's
 * own look check (by default: a look names its schema, id, name and sub as text), and the theme's default look
 * when the active one is another (a user's saved look, read back on a reload). Its actions change that state
 * as core's runtime does, and its forced tone is the one useTone answers. useLookScope is the workspace and
 * the storage area's user, as core's look-kit/scope.ts:23 joins them; null while no workspace is loaded.
 */
import type { HostLook, HostLookFile, HostLookResult, HostLookState } from '@automatos/theme-sdk'
import { useMemo } from 'react'
import { cell } from '../internal/cell.ts'
import { setForcedTone, useWorkspace } from './context.ts'
import { useStorageUserKey } from './storage.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** A look runtime as a test mounts it. */
export interface LooksStandIn {
  /** The active look; the theme's default one too, unless `defaultLook` names another. */
  readonly look: HostLook
  /** The theme's default look, which deleting the active look goes back to; left out, `look`. */
  readonly defaultLook?: HostLook
  readonly saved?: readonly HostLook[]
  readonly loaded?: boolean
  readonly persisted?: boolean
  readonly tone?: 'light' | 'dark' | null
  /** The theme's look spec: a look as kept, or why it is refused. */
  readonly check?: (look: unknown) => HostLookResult
}

interface Runtime {
  readonly defaultLook: HostLook
  readonly look: HostLook
  readonly saved: readonly HostLook[]
  readonly loaded: boolean
  readonly persisted: boolean
  readonly tone: 'light' | 'dark' | null
  readonly check: (look: unknown) => HostLookResult
}

/** looks.ts:73-88: the words and the state outside a look runtime. */
const LOOKS_NOT_AVAILABLE = "Looks aren't available here."
const NOT_AVAILABLE: HostLookResult = Object.freeze({ ok: false as const, errors: Object.freeze([LOOKS_NOT_AVAILABLE]) })
const NO_LOOKS: readonly HostLook[] = Object.freeze([])
const NO_LOOK_STATE: HostLookState = Object.freeze({
  available: false,
  look: null,
  saved: NO_LOOKS,
  loaded: true,
  persisted: false,
  tone: null,
  setLook: () => NOT_AVAILABLE,
  deleteLook: () => undefined,
  renameLook: () => NOT_AVAILABLE,
})
const LOOK_FIELDS = ['schema', 'id', 'name', 'sub'] as const
const NOT_A_LOOK = 'A look names its schema, id, name and sub.'
const LOOK_FILE_SUFFIX = '.look.json'
const LOOK_FILE_TYPE = 'application/json'
const IMPORTED_ID_PREFIX = 'imported-'
const SCOPE_SEPARATOR = ':'
const JSON_INDENT = 2

/** The default look check: the four identity fields as text. */
function checkIdentity(look: unknown): HostLookResult {
  const fields = (look ?? {}) as Record<string, unknown>
  const ok = typeof look === 'object' && look !== null && LOOK_FIELDS.every((name) => typeof fields[name] === 'string')
  if (!ok) return Object.freeze({ ok: false as const, errors: Object.freeze([NOT_A_LOOK]) })
  return Object.freeze({ ok: true as const, look: Object.freeze({ ...(look as HostLook) }) })
}

const runtime = cell<Runtime | null>(null)
let imports = 0

function update(change: (now: Runtime) => Runtime): void {
  const now = runtime.get()
  if (now !== null) runtime.set(Object.freeze(change(now)))
}

const withSaved = (saved: readonly HostLook[], look: HostLook): readonly HostLook[] =>
  saved.some((entry) => entry.id === look.id) ? saved.map((entry) => (entry.id === look.id ? look : entry)) : [...saved, look]

function setActive(look: HostLook): HostLookResult {
  const result = runtime.get()?.check(look) ?? NOT_AVAILABLE
  if (result.ok) update((now) => ({ ...now, look: result.look }))
  return result
}

function deleteSaved(id: string): void {
  update((now) => ({
    ...now,
    saved: now.saved.filter((entry) => entry.id !== id),
    look: now.look.id === id ? now.defaultLook : now.look,
  }))
}

/** The look with `id`, saved or active, as `look` from now on. */
function replaced(now: Runtime, id: string, look: HostLook): Runtime {
  return { ...now, saved: now.saved.map((entry) => (entry.id === id ? look : entry)), look: now.look.id === id ? look : now.look }
}

function rename(id: string, name: string): HostLookResult {
  const now = runtime.get()
  if (now === null) return NOT_AVAILABLE
  const found = now.saved.find((entry) => entry.id === id) ?? (now.look.id === id ? now.look : undefined)
  if (found === undefined) return Object.freeze({ ok: false as const, errors: Object.freeze([`There is no look "${id}".`]) })
  const result = now.check({ ...found, name })
  if (result.ok) update((latest) => replaced(latest, id, result.look))
  return result
}

function stateOf(now: Runtime): HostLookState {
  return Object.freeze({
    available: true,
    look: now.look,
    saved: now.saved,
    loaded: now.loaded,
    persisted: now.persisted,
    tone: now.tone,
    setLook: setActive,
    deleteLook: deleteSaved,
    renameLook: rename,
  })
}

/** looks.ts:91: the active look, the saved looks and their actions; the theme re-renders when they change. */
export const useLook = ((): HostLookState => {
  const now = runtime.use()
  return useMemo(() => (now === null ? NO_LOOK_STATE : stateOf(now)), [now])
}) satisfies Sdk['useLook']

/** looks.ts:96: adds the look to the saved looks, or replaces the saved look with its id. */
export const saveLook = ((look: HostLook): HostLookResult => {
  const result = runtime.get()?.check(look) ?? NOT_AVAILABLE
  if (result.ok) update((now) => ({ ...now, saved: withSaved(now.saved, result.look) }))
  return result
}) satisfies Sdk['saveLook']

/** looks.ts:101: the saved looks now. */
export const listLooks = ((): readonly HostLook[] => runtime.get()?.saved ?? NO_LOOKS) satisfies Sdk['listLooks']

/** looks.ts:106: the look as a `.look.json` file; null when it does not pass the theme's check. */
export const exportLook = ((look: HostLook): HostLookFile | null => {
  const result = runtime.get()?.check(look)
  if (!result?.ok) return null
  const text = JSON.stringify(result.look, null, JSON_INDENT)
  return Object.freeze({ fileName: `${result.look.id}${LOOK_FILE_SUFFIX}`, text, type: LOOK_FILE_TYPE })
}) satisfies Sdk['exportLook']

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/** looks.ts:111: pasted text as a look ready to save, under a fresh id, or why it is refused. */
export const importLook = ((text: string): HostLookResult => {
  const now = runtime.get()
  if (now === null) return NOT_AVAILABLE
  const look = parsed(text)
  if (typeof look !== 'object' || look === null) return now.check(look)
  imports += 1
  return now.check({ ...look, id: `${IMPORTED_ID_PREFIX}${imports}` })
}) satisfies Sdk['importLook']

/** looks.ts:120: whose looks these are, as look-kit/scope.ts:23 names them; null until a workspace is loaded. */
export const useLookScope = ((): string | null => {
  const { workspace } = useWorkspace()
  const userKey = useStorageUserKey()
  return workspace === null ? null : `${workspace.id}${SCOPE_SEPARATOR}${userKey}`
}) satisfies Sdk['useLookScope']

/** The controls of this area, gathered by host.ts. */
export const lookControls = Object.freeze({
  /** Mounts a look runtime with this state, or none (null): then nothing is available. */
  setLooks(next: LooksStandIn | null): void {
    const tone = next?.tone ?? null
    runtime.set(next === null ? null : Object.freeze({
      defaultLook: next.defaultLook ?? next.look,
      look: next.look,
      saved: Object.freeze([...(next.saved ?? NO_LOOKS)]),
      loaded: next.loaded ?? true,
      persisted: next.persisted ?? true,
      tone,
      check: next.check ?? checkIdentity,
    }))
    setForcedTone(tone)
  },
})

export function resetLooks(): void {
  runtime.set(null)
  setForcedTone(null)
  imports = 0
}
