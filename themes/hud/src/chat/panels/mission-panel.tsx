import { type ActivityFeedFilters, HostLink, useActivityFeed, useMission } from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { MISSION_ID, MISSION_STEP_MARKS, missionFromDetail, missionFromFeed, type ShownMission } from './mission-rows'
import styles from './panels.module.css'

/**
 * MISSION, under AGENTS (the design's left column): this conversation's Mission first, once the chat plans one
 * (the chat's planningMissionId, read with the SDK's useMission), else the newest Mission running now, from the
 * SDK's activity feed. Its name links to its page, and its steps are each a glyph and its name (✓ done, ▸ running,
 * ○ to do, ✕ failed, – skipped; mission-rows.ts); the header's value is the step it is on. If this conversation's
 * Mission can't be read, the newest running one stands in; with none running it says so. HUD 1.2.0: it never glows,
 * as working is not waiting for you (the one-live-border rule: only NEEDS YOU, or BRIEFING in its place, glows); the
 * running step is in the readable accent. MISSIONS under it lists the Missions.
 */

export const MISSION_TITLE = 'Mission'
export const MISSION_LOADING = 'Loading the Missions…'
export const THIS_MISSION_LOADING = 'Loading this Mission…'
export const MISSION_FAILED = "Couldn't load the Missions."
export const NO_MISSION = 'No Mission running.'

/** The newest Mission whose run is working. */
export const RUNNING_MISSION: ActivityFeedFilters = { types: ['mission'], status: 'working', limit: 1 }

function MissionBody({ mission }: { readonly mission: ShownMission }) {
  return (
    <>
      <p className={styles.missionName}>
        {mission.href ? <HostLink href={mission.href}>{mission.name}</HostLink> : mission.name}
      </p>
      {mission.steps.length > 0 && (
        <ol className={styles.steps}>
          {mission.steps.map((step) => (
            <li key={step.key} className={styles.step} data-status={step.status}>
              <span className={styles.stepMark} aria-hidden="true">
                {MISSION_STEP_MARKS[step.status]}
              </span>
              {step.name}
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

/** The panel with a Mission, or the note in its place. */
function MissionView({ mission, note }: { readonly mission: ShownMission | null; readonly note: string }) {
  return (
    <Panel title={MISSION_TITLE} value={mission?.progress}>
      {mission === null ? <p className={styles.note}>{note}</p> : <MissionBody mission={mission} />}
    </Panel>
  )
}

function RunningMission() {
  const { data, error } = useActivityFeed(RUNNING_MISSION)
  const item = data?.items[0] ?? null
  const note = data === null ? (error === null ? MISSION_LOADING : MISSION_FAILED) : NO_MISSION
  return <MissionView mission={item === null ? null : missionFromFeed(item)} note={note} />
}

function ThisMission({ missionId }: { readonly missionId: string }) {
  const { data, error } = useMission(missionId)
  if (data === null && error !== null) return <RunningMission />
  return <MissionView mission={data === null ? null : missionFromDetail(data)} note={THIS_MISSION_LOADING} />
}

export interface MissionPanelProps {
  /** The Mission this conversation plans (the chat's planningMissionId); null or absent for none. */
  readonly missionId?: string | null
}

export function MissionPanel({ missionId = null }: MissionPanelProps) {
  return missionId !== null && MISSION_ID.test(missionId) ? <ThisMission missionId={missionId} /> : <RunningMission />
}
