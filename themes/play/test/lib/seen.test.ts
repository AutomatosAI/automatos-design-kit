// PRD-260 T-007a: which Deliverables have shown on the shelf (lib/play/seen.ts). Moved from core's
// lib/play/__tests__/seen.test.ts: the first visit only remembers, a new one is newer than the newest
// seen, the record is capped, ported as they were. The stored record is rewritten for E3g (PB-10): it is
// kept through the host, in the SDK's storage area (key seen-deliverables, in this browser, for the user in
// this workspace, F5), so readSeen and writeSeen take no scope, writeSeen says whether the host kept it,
// parseSeen reads a stored value, and a record kept before the move to the host is not read (PRD-261 E1).
// The kit adds markSeen's fixed point (E3g: the host tells the shelf of every change, so a record that
// a pass always changes is written again and again): it adds only the Deliverables that can still count
// as new, so more than SEEN_CAP of them, or two lists taking turns, settle after one round.
// Run on the storage stand-in (test/storage-port.ts); blocked storage is core's blockedStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  freshDeliverables,
  markSeen,
  parseSeen,
  readSeen,
  SEEN_CAP,
  SEEN_KEY,
  SEEN_STATE,
  type SeenRecord,
  subscribeSeen,
  writeSeen,
} from '../../src/lib/play/seen.ts'
import { changeInAnotherTab, resetStub, setStorage, STORAGE_DEFAULTS, THEME_STATE_LIMITS } from '../sdk-stub.ts'
import { blobData, blockedStorage, BROWSER_WORKSPACE, swapWindowStorage, themeStateKeys } from '../support/memory-storage.ts'

const OLD = { id: 'd-old', created_at: '2026-10-10T09:00:00+00:00' }
const NEW = { id: 'd-new', created_at: '2026-10-14T09:00:00+00:00' }
const RECORD = { ids: ['d-old'], newest: OLD.created_at }
/** Where the record lived before the move to the host (PRD-261 E1), unscoped and for one scope. */
const OLD_KEYS = ['automatos-play:seen-deliverables', 'automatos-play:seen-deliverables:workspace-1:local']
const MINUTE_MS = 60_000
/** Each chip's Deliverables in the two-chip case: more than SEEN_CAP together. */
const CHIP_SIZE = 300
/** The rounds a list, or lists taking turns, may take to settle before settle gives up. */
const MAX_ROUNDS = 10

type Item = { readonly id: string; readonly created_at: string }

/** `count` Deliverables, <prefix>-0 the newest, a minute apart; the oldest `after` + 1 minutes after OLD. */
function minutely(prefix: string, count: number, after = 0): Item[] {
  const start = Date.parse(OLD.created_at)
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    created_at: new Date(start + (after + count - index) * MINUTE_MS).toISOString(),
  }))
}

interface Settled {
  readonly record: SeenRecord | null
  /** The passes that changed the record: a write each, in the hook. */
  readonly writes: number
  /** The first round after the first that changed nothing; null when none did within MAX_ROUNDS. */
  readonly settledIn: number | null
}

/** markSeen over each list in turn, round after round: one shelf reading its record again, or two chips or tabs. */
function settle(lists: readonly (readonly Item[])[]): Settled {
  let record: SeenRecord | null = null
  let writes = 0
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const before = writes
    for (const items of lists) {
      const next = markSeen(record, items)
      writes += next === record ? 0 : 1
      record = next
    }
    if (round > 1 && writes === before) return { record, writes, settledIn: round }
  }
  return { record, writes, settledIn: null }
}

beforeEach(() => {
  resetStub()
})

afterEach(() => {
  vi.restoreAllMocks()
  OLD_KEYS.forEach((key) => window.localStorage.removeItem(key))
})

describe('freshDeliverables', () => {
  it('counts nothing as new on the first visit', () => {
    expect(freshDeliverables(null, [NEW, OLD])).toEqual([])
  })

  it('counts an unseen Deliverable newer than the newest seen', () => {
    expect(freshDeliverables({ ids: ['d-old'], newest: OLD.created_at }, [NEW, OLD])).toEqual([NEW])
  })

  it('does not count an older one met for the first time (a chip, Load more)', () => {
    expect(freshDeliverables({ ids: ['d-new'], newest: NEW.created_at }, [OLD])).toEqual([])
  })
})

describe('markSeen', () => {
  it('remembers the ids and the newest time, never mutating the record', () => {
    const before = { ids: ['d-old'], newest: OLD.created_at }
    const after = markSeen(before, [NEW, OLD])
    expect(after).toEqual({ ids: ['d-old', 'd-new'], newest: NEW.created_at })
    expect(before.ids).toEqual(['d-old'])
  })

  it('returns the same record when nothing changes', () => {
    const record = { ids: ['d-new', 'd-old'], newest: NEW.created_at }
    expect(markSeen(record, [NEW, OLD])).toBe(record)
  })

  it(`keeps the newest ${SEEN_CAP} ids`, () => {
    const items = Array.from({ length: SEEN_CAP + 5 }, (_, index) => ({ id: `d-${index}`, created_at: OLD.created_at }))
    const record = markSeen(null, items)
    expect(record.ids).toHaveLength(SEEN_CAP)
    expect(record.ids[0]).toBe('d-5')
  })

  it('adds no unseen Deliverable that can never count as new: none newer than the newest seen, none undated', () => {
    const record = { ids: ['d-new'], newest: NEW.created_at }
    const items = [OLD, { id: 'd-tie', created_at: NEW.created_at }, { id: 'd-undated', created_at: 'not a date' }]
    expect(freshDeliverables(record, items)).toEqual([])
    expect(markSeen(record, items)).toBe(record)
  })

  it(`settles for SEEN_CAP + 20 Deliverables: the first pass keeps the last ${SEEN_CAP}, the next changes nothing`, () => {
    const items = minutely('d', SEEN_CAP + 20)
    expect(settle([items])).toEqual({
      record: { ids: items.slice(20).map((item) => item.id), newest: items[0].created_at },
      writes: 1,
      settledIn: 2,
    })
  })

  it(`settles when two chips of ${CHIP_SIZE} take turns, or two tabs showing one each: the newer pushes out the oldest`, () => {
    const [older, newer] = [minutely('a', CHIP_SIZE), minutely('b', CHIP_SIZE, CHIP_SIZE)]
    const pushedOut = 2 * CHIP_SIZE - SEEN_CAP
    expect(settle([older, newer])).toEqual({
      record: { ids: [...older.slice(pushedOut), ...newer].map((item) => item.id), newest: newer[0].created_at },
      writes: 2,
      settledIn: 2,
    })
  })
})

describe('the stored record', () => {
  it("round-trips through the host's storage area: in this browser, for the user in this workspace", () => {
    expect(writeSeen(RECORD)).toBe(true)
    expect(blobData(window.localStorage, BROWSER_WORKSPACE)).toEqual({ [SEEN_KEY]: RECORD })
    expect(readSeen()).toEqual({ ready: true, record: RECORD })
  })

  it("is kept per user and workspace: another account or workspace in this browser doesn't read it (F5)", () => {
    writeSeen(RECORD)
    setStorage({ userKey: 'user-b' })
    expect(readSeen()).toEqual({ ready: true, record: null })
    setStorage({ userKey: STORAGE_DEFAULTS.userKey, workspaceKey: 'workspace-2' })
    expect(readSeen()).toEqual({ ready: true, record: null })
    setStorage({ workspaceKey: STORAGE_DEFAULTS.workspaceKey })
    expect(readSeen()).toEqual({ ready: true, record: RECORD })
  })

  it('reads no record kept before the move to the host (E1), and leaves it as it was', () => {
    const before = JSON.stringify(RECORD)
    OLD_KEYS.forEach((key) => window.localStorage.setItem(key, before))
    expect(readSeen()).toEqual({ ready: true, record: null })
    expect(freshDeliverables(readSeen().record, [NEW])).toEqual([])
    expect(OLD_KEYS.map((key) => window.localStorage.getItem(key))).toEqual([before, before])
  })

  it('reads a broken record as none, keeping only string ids', () => {
    expect(parseSeen('{not json')).toBeNull()
    expect(parseSeen({ ids: 'd-old' })).toBeNull()
    expect(parseSeen(['d-old'])).toBeNull()
    expect(parseSeen({ ids: ['d-old', 7], newest: 3 })).toEqual({ ids: ['d-old'], newest: null })
    changeInAnotherTab(SEEN_KEY, { ids: 'd-old' }, SEEN_STATE)
    expect(readSeen()).toEqual({ ready: true, record: null })
  })

  it('survives a blocked localStorage: the host keeps the record for this page, with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const browser = window.localStorage
    swapWindowStorage('localStorage', blockedStorage)
    expect(readSeen()).toEqual({ ready: true, record: null })
    expect(writeSeen(RECORD)).toBe(true)
    expect(readSeen()).toEqual({ ready: true, record: RECORD })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(themeStateKeys(browser)).toEqual([])
  })

  it('says false when the host refuses the record (over its caps), logged once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const huge = { ids: ['x'.repeat(THEME_STATE_LIMITS.valueChars)], newest: null }
    expect([writeSeen(huge), writeSeen(huge)]).toEqual([false, false])
    expect(readSeen()).toEqual({ ready: true, record: null })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('too-large')
  })

  it('tells its subscriber when another tab writes the record, and when the workspace changes', () => {
    const onChange = vi.fn()
    const stop = subscribeSeen(onChange)
    changeInAnotherTab(SEEN_KEY, RECORD, SEEN_STATE)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(readSeen()).toEqual({ ready: true, record: RECORD })
    setStorage({ workspaceKey: 'workspace-2' })
    expect(onChange).toHaveBeenCalledTimes(2)
    stop()
  })
})
