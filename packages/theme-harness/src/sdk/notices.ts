/**
 * PRD-261 B-02b: the fake of SDK area `notices`. It mirrors core's frontend/lib/theme-sdk/notices.ts (at
 * 101a0bf33f64fb4f89af81b4293415be60b661ac): every field is checked the same way and a malformed notice throws
 * the same TypeError. There is no toaster: each notice is kept, with its id and whether it was dismissed, for
 * a test to read (host.notices()).
 */
import type { Notice, NoticeAction, NoticeId, NoticeKind } from '@automatos/theme-sdk'
import { log } from '../internal/cell.ts'

type Sdk = typeof import('@automatos/theme-sdk')

/** One notice a theme showed, as checked, with the id notify returned. */
export interface ShownNotice {
  readonly id: NoticeId
  readonly kind: NoticeKind
  readonly title: string
  readonly description?: string
  readonly durationMs?: number
  readonly action?: NoticeAction
  /** dismissNotice named it, or dismissed every notice, after it was shown. */
  readonly dismissed: boolean
}

/** notices.ts:33: the kinds the host's toaster has. */
const KINDS: readonly string[] = Object.freeze(['message', 'success', 'info', 'warning', 'error'])
const DEFAULT_KIND: NoticeKind = 'message'
/** sonner numbers its toasts from 1. */
const FIRST_ID = 1

let shown: readonly ShownNotice[] = Object.freeze([])
let nextId = FIRST_ID
const dismissals = log<NoticeId | undefined>()

/** notices.ts:43. */
function refuse(problem: string): never {
  throw new TypeError(`Automatos theme SDK: notify() ${problem}.`)
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

/** notices.ts:51. */
function checkedKind(kind: unknown): NoticeKind {
  if (kind === undefined) return DEFAULT_KIND
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return refuse(`has no notice kind "${String(kind)}"`)
  return kind as NoticeKind
}

/** notices.ts:59. */
function checkedAction(action: unknown): NoticeAction | undefined {
  if (action === undefined) return undefined
  const candidate = action as Partial<NoticeAction> | null
  if (!candidate || !isText(candidate.label) || typeof candidate.onClick !== 'function') {
    return refuse('needs an action with a label and an onClick function')
  }
  return Object.freeze({ label: candidate.label, onClick: candidate.onClick })
}

/** notices.ts:69: the description, duration and action, each checked. */
function checkedOptions(notice: Notice): Pick<ShownNotice, 'description' | 'durationMs' | 'action'> {
  const { description, durationMs } = notice
  if (description !== undefined && typeof description !== 'string') refuse('needs a text description')
  if (durationMs !== undefined && !(typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0)) {
    refuse('needs a positive durationMs')
  }
  const action = checkedAction(notice.action)
  return {
    ...(description !== undefined ? { description } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(action !== undefined ? { action } : {}),
  }
}

/** notices.ts:84: shows `notice` (here: keeps it); returns its id, for dismissNotice. */
export const notify = ((notice: Notice): NoticeId => {
  if (typeof notice !== 'object' || notice === null) return refuse('needs a notice object')
  if (!isText(notice.title)) return refuse('needs a title')
  const kind = checkedKind(notice.kind)
  const options = checkedOptions(notice)
  const id = nextId
  nextId += 1
  shown = Object.freeze([...shown, Object.freeze({ id, kind, title: notice.title, ...options, dismissed: false })])
  return id
}) satisfies Sdk['notify']

/** notices.ts:92: dismisses one notice by its id, or every notice when no id is given. */
export const dismissNotice = ((id?: NoticeId): void => {
  dismissals.add(id)
  shown = Object.freeze(shown.map((entry) => (id === undefined || entry.id === id ? Object.freeze({ ...entry, dismissed: true }) : entry)))
}) satisfies Sdk['dismissNotice']

/** The controls of this area, gathered by host.ts. */
export const noticeControls = Object.freeze({
  /** Every notice a theme showed since the last reset, oldest first. */
  notices(): readonly ShownNotice[] {
    return shown
  },
  /** Every dismissNotice call since the last reset, oldest first (undefined: every notice). */
  dismissals(): readonly (NoticeId | undefined)[] {
    return dismissals.all()
  },
})

export function resetNotices(): void {
  shown = Object.freeze([])
  nextId = FIRST_ID
  dismissals.clear()
}
