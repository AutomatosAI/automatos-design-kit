import {
  type Deliverable,
  readThemeState,
  subscribeThemeState,
  type ThemeStateOptions,
  writeThemeState,
} from '@automatos/theme-sdk'

/**
 * PRD-260 §4 — which Deliverables have already shown on Play's shelf, so a new
 * one makes Auto celebrate once; ported from Automatos Play's
 * lib/deliverables/seen.ts onto the core's Deliverable (created_at, the SDK's
 * Deliverable type). A
 * Deliverable is new when its id hasn't been seen and it is newer than the
 * newest one seen: old rows met for the first time (a chip, Load more) don't
 * count. The first visit only remembers, it doesn't celebrate.
 *
 * PRD-261 E3g: a convenience kept through the host, in the SDK's storage area:
 * key `seen-deliverables`, for the signed-in user in this workspace (F5), in
 * this browser. Nothing else reads it. Until the host knows the user and the
 * workspace, nothing is read or remembered (readSeen says not ready), and
 * another account or workspace starts its own record. Where the browser blocks
 * its storage the host keeps it for this page; a write the host refuses (a
 * record over its caps) is logged once, and the shelf then remembers for as
 * long as it is open (use-celebrate-new.ts). A record kept before the move to
 * the host is not read (PRD-261 E1): the first visit after it only remembers.
 */

export type SeenRecord = {
  readonly ids: readonly string[]
  /** created_at of the newest Deliverable seen (the backend's own clock and format). */
  readonly newest: string | null
}

type Dated = Pick<Deliverable, 'id' | 'created_at'>

/** A read of the record: not ready until the host knows the user and the workspace. */
export interface SeenRead {
  readonly ready: boolean
  readonly record: SeenRecord | null
}

export const SEEN_KEY = 'seen-deliverables'
/** For the signed-in user in this workspace, in this browser. */
export const SEEN_STATE: ThemeStateOptions = Object.freeze({ lifetime: 'browser', within: 'workspace' })
/** The most ids kept; the newest ones win. */
export const SEEN_CAP = 500

let warnedRefused = false

function time(iso: string | null | undefined): number | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? null : parsed
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The record a stored value holds, or null when it holds none (nothing yet, or not this shape). */
export function parseSeen(value: unknown): SeenRecord | null {
  if (!isRecord(value) || !Array.isArray(value.ids)) return null
  const ids = value.ids.filter((id): id is string => typeof id === 'string').slice(-SEEN_CAP)
  const newest = typeof value.newest === 'string' ? value.newest : null
  return { ids, newest }
}

/** The record the host keeps for this user and workspace. */
export function readSeen(): SeenRead {
  const { ready, value } = readThemeState(SEEN_KEY, SEEN_STATE)
  return { ready, record: ready ? parseSeen(value) : null }
}

/** Keeps the record; false when the host refused it (logged once), and then the caller's copy is all there is. */
export function writeSeen(record: SeenRecord): boolean {
  const result = writeThemeState(SEEN_KEY, record, SEEN_STATE)
  if (result.ok) return true
  if (!warnedRefused) {
    warnedRefused = true
    console.warn(`[shelf] the host didn't keep the seen Deliverables (${result.reason}), so new ones are remembered only while the shelf is open:`, result.message)
  }
  return false
}

/** Calls `onChange` when the record may have changed: written here or in another tab, or the user or workspace changed. */
export function subscribeSeen(onChange: () => void): () => void {
  return subscribeThemeState(SEEN_KEY, onChange, SEEN_STATE)
}

/** The loaded Deliverables that count as new (none on the first visit). */
export function freshDeliverables<T extends Dated>(record: SeenRecord | null, items: readonly T[]): readonly T[] {
  const newest = time(record?.newest)
  if (!record || newest === null) return []
  const seen = new Set(record.ids)
  return items.filter((item) => {
    const created = time(item.created_at)
    return !seen.has(item.id) && created !== null && created > newest
  })
}

function newestOf(items: readonly Dated[], start: string | null): string | null {
  return items.reduce<string | null>((best, item) => {
    const created = time(item.created_at)
    const top = time(best)
    return created !== null && (top === null || created > top) ? item.created_at : best
  }, start)
}

/** The record with these Deliverables remembered. Returns the same record when nothing changes. */
export function markSeen(record: SeenRecord | null, items: readonly Dated[]): SeenRecord {
  const ids = record?.ids ?? []
  const known = new Set(ids)
  const added = items.map((item) => item.id).filter((id) => !known.has(id))
  const newest = newestOf(items, record?.newest ?? null)
  if (record && added.length === 0 && newest === record.newest) return record
  return { ids: [...ids, ...added].slice(-SEEN_CAP), newest }
}
