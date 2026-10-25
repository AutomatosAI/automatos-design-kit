import { type ActivityFeedItem, missionHref, type MissionDetail, type MissionTaskState } from '@automatos/theme-sdk'

import { STEP_MARKS } from './panel-rows'

/**
 * What MISSION shows of a Mission, from either source: this conversation's Mission (the SDK's useMission: its
 * goal, its tasks in order, the server's count of the done ones) or the newest one running (an activity feed row:
 * its name and its run's steps). Each becomes the same shape: the name, the page it opens, the steps with their
 * status (✓ done, ▸ running, ○ to do, ✕ failed, – skipped), the step it is on, and whether it is live. Pure but for
 * the SDK's missionHref.
 */

export type StepStatus = 'completed' | 'running' | 'pending' | 'failed' | 'skipped'

export const MISSION_STEP_MARKS: Readonly<Record<StepStatus, string>> = { ...STEP_MARKS, skipped: '–' }

export interface ShownStep {
  readonly key: string
  readonly name: string
  readonly status: StepStatus
}

export interface ShownMission {
  readonly name: string
  /** The Mission's page; null when its id is not one. */
  readonly href: string | null
  readonly steps: readonly ShownStep[]
  /** The step it is on ("2 / 3"), when known. */
  readonly progress: string | undefined
  readonly live: boolean
}

/** A Mission id, as the SDK takes one: one path segment of letters, digits, '-' and '_'. */
export const MISSION_ID = /^[A-Za-z0-9_-]{1,128}$/

const TASK_STEP: Readonly<Record<MissionTaskState, StepStatus>> = {
  pending: 'pending',
  queued: 'pending',
  assigned: 'running',
  running: 'running',
  verifying: 'running',
  retrying: 'running',
  completed: 'completed',
  verified: 'completed',
  failed: 'failed',
  stalled: 'failed',
  skipped: 'skipped',
}

function linkOf(id: string | null): string | null {
  return id !== null && MISSION_ID.test(id) ? missionHref(id) : null
}

/** The newest running Mission, from its activity feed row: always live. */
export function missionFromFeed(item: ActivityFeedItem): ShownMission {
  const progress = item.step_progress
  // A run's steps carry no id and never reorder.
  const steps = (progress?.steps ?? []).map((step, index) => ({
    key: `${index}-${step.name}`,
    name: step.name,
    status: step.status,
  }))
  return {
    name: item.name,
    href: linkOf(item.source_id),
    steps,
    progress: progress ? `${progress.current} / ${progress.total}` : undefined,
    live: true,
  }
}

/** This conversation's Mission: its goal, its tasks in their order, the done ones of all; live while it works. */
export function missionFromDetail(mission: MissionDetail): ShownMission {
  const tasks = [...mission.tasks].sort((a, b) => a.sequence_number - b.sequence_number)
  const done = mission.task_progress?.done ?? tasks.filter((task) => TASK_STEP[task.state] === 'completed').length
  const total = mission.task_progress?.total ?? tasks.length
  return {
    name: mission.goal,
    href: linkOf(mission.id),
    steps: tasks.map((task) => ({ key: task.id, name: task.title, status: TASK_STEP[task.state] })),
    progress: total > 0 ? `${done} / ${total}` : undefined,
    live: mission.state_type === 'active',
  }
}
