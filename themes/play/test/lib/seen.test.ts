// PRD-260 T-007a: which Deliverables have shown on the shelf (lib/play/seen.ts). Moved from core's
// lib/play/__tests__/seen.test.ts: the first visit only remembers, a new one is newer than the newest
// seen, the record is capped, ported as they were. The stored record is rewritten for E3g (PB-10): it is
// kept through the host, in the SDK's storage area (key seen-deliverables, in this browser, for the user in
// this workspace, F5), so readSeen and writeSeen take no scope, writeSeen says whether the host kept it,
// parseSeen reads a stored value, and a record kept before the move to the host is not read (PRD-261 E1).
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
