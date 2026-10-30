import type { ActivitySchedule, ScheduleItem } from '@automatos/theme-sdk'

import { cardSetOf, type CardSet } from '../ui/sets'
import { aheadWords } from '../ui/when'

/**
 * The Coming-up window's rows as data: the SDK's useActivitySchedule items, soonest first, each with its name, its
 * kind in the product's words (a scheduled recipe is a Playbook, a social item a Post), when it runs next ("16:00",
 * "Tomorrow", "Fri") and the gradient its dot takes, cycling in screen order. Pure.
 */

const KIND_WORDS: Readonly<Record<ScheduleItem['type'], string>> = {
  routine: 'Routine',
  recipe: 'Playbook',
  task: 'Task',
  mission: 'Mission',
  task_due: 'Task due',
  social: 'Post',
}

/** The word for a kind the schedule names that this theme doesn't know yet. */
export const OTHER_KIND = 'Scheduled'

export interface ComingRow {
  readonly key: string
  readonly name: string
  readonly kind: string
  /** When it runs next, or how often when the schedule gives no next time; null when it gives neither. */
  readonly when: string | null
  readonly set: CardSet
}

/** A schedule item's kind in the product's words. */
export function kindWord(type: string): string {
  return (KIND_WORDS as Readonly<Record<string, string>>)[type] ?? OTHER_KIND
}

function nextTime(item: ScheduleItem): number | null {
  const time = item.next_run_at ? Date.parse(item.next_run_at) : Number.NaN
  return Number.isFinite(time) ? time : null
}

/** Soonest first; an item with no next time after every item with one. */
function soonestFirst(a: ScheduleItem, b: ScheduleItem): number {
  const [left, right] = [nextTime(a), nextTime(b)]
  if (left === null || right === null) return (left === null ? 1 : 0) - (right === null ? 1 : 0)
  return left - right
}

/** The first `limit` items to come, in the window's words. */
export function comingRows(schedule: ActivitySchedule, now: number, limit: number): readonly ComingRow[] {
  return [...schedule.scheduled]
    .sort(soonestFirst)
    .slice(0, limit)
    .map((item, index) => ({
      key: `${item.type}-${item.id}`,
      name: (item.name ?? '').trim() || kindWord(item.type),
      kind: kindWord(item.type),
      when: aheadWords(item.next_run_at, now) ?? ((item.frequency ?? '').trim() || null),
      set: cardSetOf(index),
    }))
}
