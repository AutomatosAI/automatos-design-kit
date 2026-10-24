import { type ActivityFeedFilters, type ActivityFeedItem, HostLink, missionHref, useActivityFeed } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { STEP_MARKS } from './panel-rows'
import styles from './panels.module.css'

/**
 * MISSION, under AGENTS (the design's left column): the Mission running now, from the SDK's activity feed (one
 * Mission whose run is working), its name linked to its page, and its steps, each a glyph and its name (✓ done,
 * ▸ running, ○ to do, ✕ failed); the header's value is the step it is on. Live while one runs. With none running it
 * says so.
 */

export const MISSION_TITLE = 'Mission'
export const MISSION_LOADING = 'Loading the Missions…'
export const MISSION_FAILED = "Couldn't load the Missions."
export const NO_MISSION = 'No Mission running.'

/** The newest Mission whose run is working. */
export const RUNNING_MISSION: ActivityFeedFilters = { types: ['mission'], status: 'working', limit: 1 }

const MISSION_ID = /^[A-Za-z0-9_-]{1,128}$/

/** The Mission's page, only when its id is an id. */
function missionLink(item: ActivityFeedItem): string | null {
  return item.source_id !== null && MISSION_ID.test(item.source_id) ? missionHref(item.source_id) : null
}

function MissionBody({ mission }: { readonly mission: ActivityFeedItem }) {
  const href = missionLink(mission)
  const steps = mission.step_progress?.steps ?? []
  return (
    <>
      <p className={styles.missionName}>{href ? <HostLink href={href}>{mission.name}</HostLink> : mission.name}</p>
      {steps.length > 0 && (
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            // A run's steps carry no id and never reorder.
            <li key={`${index}-${step.name}`} className={styles.step} data-status={step.status}>
              <span className={styles.stepMark} aria-hidden="true">
                {STEP_MARKS[step.status]}
              </span>
              {step.name}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

function stepValue(mission: ActivityFeedItem | null): string | undefined {
  const progress = mission?.step_progress
  return progress ? `${progress.current} / ${progress.total}` : undefined
}

export function MissionPanel() {
  const { data, error } = useActivityFeed(RUNNING_MISSION)
  const mission = data?.items[0] ?? null
  const note = data === null ? (error === null ? MISSION_LOADING : MISSION_FAILED) : NO_MISSION
  return (
    <Panel title={MISSION_TITLE} value={stepValue(mission)} live={mission !== null}>
      {mission === null ? <p className={styles.note}>{note}</p> : <MissionBody mission={mission} />}
    </Panel>
  )
}
