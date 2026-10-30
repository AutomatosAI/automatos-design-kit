import type { Mission, MissionDetail, MissionRunState, MissionTask, MissionTaskState } from '@automatos/theme-sdk'

import type { Region } from '../art/world-map'

/**
 * The Quests map as data: each Mission's region by its state (Greenwood for the ones under way, Storm Peaks for the
 * ones that need you, Hearth Village for the finished ones), its glyph and word, and a quest window's steps (the
 * Mission's tasks, in order, each with its glyph and word) and progress. The region names are the theme's words,
 * not data. Every word comes with a glyph, so colour is never the only sign. Pure.
 */

export type Tone = 'active' | 'needs' | 'done' | 'failed' | 'now' | 'todo'

export interface Status {
  readonly glyph: string
  readonly word: string
  readonly tone: Tone
}

export const REGIONS: readonly { readonly region: Region; readonly name: string; readonly status: Status }[] = [
  { region: 'active', name: 'Greenwood', status: { glyph: '◆', word: 'Active', tone: 'active' } },
  { region: 'needs', name: 'Storm Peaks', status: { glyph: '!', word: 'Needs you', tone: 'needs' } },
  { region: 'done', name: 'Hearth Village', status: { glyph: '✓', word: 'Done', tone: 'done' } },
]

const MISSION_STATUS: Readonly<Record<MissionRunState, Status & { readonly region: Region }>> = {
  pending: { glyph: '◆', word: 'Pending', tone: 'active', region: 'active' },
  planning: { glyph: '◆', word: 'Planning', tone: 'active', region: 'active' },
  running: { glyph: '◆', word: 'Active', tone: 'active', region: 'active' },
  verifying: { glyph: '◆', word: 'Checking', tone: 'active', region: 'active' },
  paused: { glyph: '❚❚', word: 'Paused', tone: 'active', region: 'active' },
  awaiting_approval: { glyph: '!', word: 'Needs you', tone: 'needs', region: 'needs' },
  awaiting_human: { glyph: '!', word: 'Needs you', tone: 'needs', region: 'needs' },
  failed: { glyph: '✕', word: 'Failed', tone: 'failed', region: 'needs' },
  completed: { glyph: '✓', word: 'Done', tone: 'done', region: 'done' },
  cancelled: { glyph: '—', word: 'Cancelled', tone: 'done', region: 'done' },
}

const UNKNOWN_MISSION: Status & { readonly region: Region } = { glyph: '◆', word: 'Active', tone: 'active', region: 'active' }

export function missionStatus(mission: Pick<Mission, 'state'>): Status & { readonly region: Region } {
  return MISSION_STATUS[mission.state] ?? UNKNOWN_MISSION
}

export function regionName(region: Region): string {
  return REGIONS.find((entry) => entry.region === region)?.name ?? ''
}

const TASK_STATUS: Readonly<Record<MissionTaskState, Status>> = {
  completed: { glyph: '✓', word: 'Done', tone: 'done' },
  verified: { glyph: '✓', word: 'Done', tone: 'done' },
  running: { glyph: '▶', word: 'Now', tone: 'now' },
  assigned: { glyph: '▶', word: 'Now', tone: 'now' },
  verifying: { glyph: '▶', word: 'Checking', tone: 'now' },
  retrying: { glyph: '▶', word: 'Retrying', tone: 'now' },
  pending: { glyph: '·', word: 'Next', tone: 'todo' },
  queued: { glyph: '·', word: 'Next', tone: 'todo' },
  stalled: { glyph: '!', word: 'Stuck', tone: 'needs' },
  failed: { glyph: '✕', word: 'Failed', tone: 'failed' },
  skipped: { glyph: '—', word: 'Skipped', tone: 'todo' },
}

const DONE_TASKS: ReadonlySet<MissionTaskState> = new Set(['completed', 'verified'])

export function taskStatus(task: Pick<MissionTask, 'state'>): Status {
  return TASK_STATUS[task.state] ?? { glyph: '·', word: 'Next', tone: 'todo' }
}

export function stepsOf(detail: MissionDetail): readonly MissionTask[] {
  return [...detail.tasks].sort((a, b) => a.sequence_number - b.sequence_number)
}

export interface Progress {
  readonly done: number
  readonly total: number
}

/** The server's count when it gives one, else the tasks counted here. */
export function progressOf(detail: MissionDetail): Progress {
  if (detail.task_progress) return { done: detail.task_progress.done, total: detail.task_progress.total }
  return { done: detail.tasks.filter((task) => DONE_TASKS.has(task.state)).length, total: detail.tasks.length }
}

export function isDoneTask(task: Pick<MissionTask, 'state'>): boolean {
  return DONE_TASKS.has(task.state)
}

/** "1 quest", "6 quests". */
export function questCount(count: number): string {
  return `${count} ${count === 1 ? 'quest' : 'quests'}`
}

/** The quest to open first: the first that needs you, else the first on the list. */
export function firstQuest(missions: readonly Mission[]): string | null {
  return (missions.find((mission) => missionStatus(mission).region === 'needs') ?? missions[0])?.id ?? null
}
