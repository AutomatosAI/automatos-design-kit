import { useState } from 'react'
import {
  HostLink,
  type Mission,
  type MissionFilters,
  missionHref,
  type MissionList,
  type Retry,
  useMissions,
  useReplanMission,
  useRerunMission,
} from '@automatos/theme-sdk'

import { Panel } from '../../components/panel'
import { MISSION_ID } from './mission-rows'
import styles from './panels.module.css'
import { missionsInOrder, NEXT_STEP_MARK, stateMark } from './status-marks'

/**
 * HUD 1.2.0 (PRD-268): MISSIONS, under MISSION (which stays one Mission's steps): the workspace's Missions (the SDK's
 * useMissions), the ones that need you first, each its goal linked to its page, where it stands as a glyph and a word
 * (◆ NEEDS YOU, ● WORKING, ✓ READY, ✓ DONE, ✕ FAILED, the server's own state; none for one it didn't send), `▸` and the
 * server's next step, and a 3 px rail in the readable accent while it works. A failed one the server says can be tried
 * again has Try again, through the SDK's own routes: a new Mission from the same goal and settings (useRerunMission),
 * or the Mission replanned (useReplanMission). Colour is never the only signal: the glyph and the word are. It never
 * glows: only what needs you does, and that is NEEDS YOU's.
 */

export const MISSIONS_TITLE = 'Missions'
export const MISSIONS_LOADING = 'Loading the Mission list…'
export const MISSIONS_FAILED = "Couldn't load the Mission list."
export const NO_MISSIONS = 'No Missions yet.'
/** How many rows the panel lists. */
export const MISSIONS_SHOWN = 4
/** The newest Missions MISSIONS asks for, so the ones that need you can come first. */
export const RECENT_MISSIONS: MissionFilters = { limit: 20 }
export const TRY_AGAIN = 'Try again'
export const TRIED_AGAIN = 'Sent to run again.'
export const RETRY_REFUSED = 'Try again was refused.'

function refusalOf(failure: unknown): string {
  return failure instanceof Error && failure.message ? failure.message : RETRY_REFUSED
}

function MissionRetry({ mission, retry }: { readonly mission: Mission; readonly retry: Retry }) {
  const rerun = useRerunMission()
  const replan = useReplanMission()
  const [said, setSaid] = useState<string | null>(null)
  // A ticket's Run now is the board's; a Mission's row offers its own two.
  if (retry === 'retry_ticket') return null
  const busy = rerun.isRunning || replan.isRunning
  const press = (): void => {
    setSaid(null)
    const sent =
      retry === 'replan_mission'
        ? replan.runAsync({ id: mission.id })
        : rerun.runAsync({ goal: mission.goal, config: mission.config ?? undefined })
    sent.then(() => setSaid(TRIED_AGAIN), (failure: unknown) => setSaid(refusalOf(failure)))
  }
  return (
    <span className={styles.retry}>
      <button type="button" className={styles.retryButton} aria-label={`${TRY_AGAIN}: ${mission.goal}`} aria-busy={busy} disabled={busy} onClick={press}>
        {TRY_AGAIN}
      </button>
      {said !== null && (
        <span className={styles.detail} role="status">
          {said}
        </span>
      )}
    </span>
  )
}

function MissionRow({ mission }: { readonly mission: Mission }) {
  const mark = stateMark(mission.display_state)
  const working = mission.display_state === 'working'
  return (
    <li className={styles.mission} data-display-state={mark ? mission.display_state ?? undefined : undefined} data-rail={working ? 'true' : undefined}>
      <span className={styles.rowHead}>
        {MISSION_ID.test(mission.id) ? (
          <HostLink href={missionHref(mission.id)} className={styles.rowLink}>
            {mission.goal}
          </HostLink>
        ) : (
          <span className={styles.name}>{mission.goal}</span>
        )}
        {mark !== null && (
          <span className={styles.status} data-tone={mark.tone}>
            <span aria-hidden="true">{mark.glyph}</span> {mark.word}
          </span>
        )}
      </span>
      {mission.next_step && (
        <span className={styles.nextStep}>
          <span aria-hidden="true">{NEXT_STEP_MARK}</span> {mission.next_step}
        </span>
      )}
      {mission.display_state === 'failed' && mission.retry && <MissionRetry mission={mission} retry={mission.retry} />}
    </li>
  )
}

function MissionsBody({ list, error }: { readonly list: MissionList | null; readonly error: string | null }) {
  if (list === null) return <p className={styles.note}>{error === null ? MISSIONS_LOADING : MISSIONS_FAILED}</p>
  if (list.missions.length === 0) return <p className={styles.note}>{NO_MISSIONS}</p>
  return (
    <ul className={styles.rows}>
      {missionsInOrder(list.missions).slice(0, MISSIONS_SHOWN).map((mission) => (
        <MissionRow key={mission.id} mission={mission} />
      ))}
    </ul>
  )
}

export function MissionsPanel() {
  const { data, error } = useMissions(RECENT_MISSIONS)
  return (
    <Panel title={MISSIONS_TITLE} value={data === null ? undefined : String(data.total)}>
      <MissionsBody list={data} error={error} />
    </Panel>
  )
}
