import { HostLink, type Mission, missionHref, useMission } from '@automatos/theme-sdk'

import { isDoneTask, missionStatus, progressOf, regionName, stepsOf, taskStatus } from './quests'
import styles from './quests.module.css'
import ui from '../ui/ui.module.css'

/**
 * A quest window (the design's QUEST): the Mission's state and region, its goal, its steps as a checklist (its tasks
 * in order, from the SDK's useMission, each with a glyph and a word), its progress as blocks, and OPEN MISSION, the
 * host's own page for it. Until the Mission's tasks load the checklist says so; a Mission with no tasks yet has none.
 */

export const QUEST_LABEL = 'Quest'
export const OPEN_MISSION = 'Open Mission'
export const PROGRESS = 'Progress'
export const STEPS_LOADING = 'Reading the quest log…'
export const STEPS_FAILED = "Couldn't read the quest log."
export const NO_STEPS = 'No steps planned yet.'
export const STEPS_LABEL = 'Steps'

function Steps({ id }: { readonly id: string }) {
  const { data, error } = useMission(id)
  if (data === null) return <p className={ui.note}>{error === null ? STEPS_LOADING : STEPS_FAILED}</p>
  const steps = stepsOf(data)
  const progress = progressOf(data)
  return (
    <>
      {steps.length === 0 ? (
        <p className={ui.note}>{NO_STEPS}</p>
      ) : (
        <ol className={styles.steps} aria-label={STEPS_LABEL}>
          {steps.map((task) => {
            const status = taskStatus(task)
            return (
              <li key={task.id} className={styles.step} data-done={isDoneTask(task) ? 'true' : undefined}>
                <span className={ui.status} data-tone={status.tone} aria-hidden="true">{status.glyph}</span>
                <span className={styles.stepTitle}>{task.title}</span>
                <span className={ui.status} data-tone={status.tone}>{status.word.toUpperCase()}</span>
              </li>
            )
          })}
        </ol>
      )}
      {progress.total > 0 && (
        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <span className={ui.label}>{PROGRESS}</span>
            <span>{`${progress.done} / ${progress.total} steps`}</span>
          </div>
          <div className={styles.blocks} aria-hidden="true">
            {Array.from({ length: progress.total }, (_, index) => (
              <span key={index} className={styles.block} data-done={index < progress.done ? 'true' : undefined} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export function QuestWindow({ mission }: { readonly mission: Mission }) {
  const status = missionStatus(mission)
  return (
    <section className={`${ui.window} ${styles.quest}`} aria-label={QUEST_LABEL}>
      <p className={ui.status} data-tone={status.tone}>
        <span aria-hidden="true">{status.glyph}</span> {`${status.word.toUpperCase()} · ${regionName(status.region)}`}
      </p>
      <h2 className={styles.questTitle} title={mission.goal}>{mission.goal}</h2>
      <Steps id={mission.id} />
      <HostLink href={missionHref(mission.id)} className={ui.button}>
        {OPEN_MISSION}
      </HostLink>
    </section>
  )
}
