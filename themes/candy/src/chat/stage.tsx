import { useId } from 'react'

import { Auto } from '../art/auto'
import { PauseToggle } from '../motion/pause-toggle'
import { NewChatRound } from './new-chat'
import { stageLabel, type Stage } from './stage-state'
import styles from './stage.module.css'
import ui from '../ui/ui.module.css'

/**
 * Auto's stage (the design's W2 rail card and P2 strip): the violet card with Auto, live, his state pill ("● Thinking",
 * the glyph beside the word so the colour is never the only sign) and the Pause control that stops everything Candy
 * moves. Auto carries one name ("Auto, Working on it"); the pill is the polite status a screen reader hears change.
 * The desktop draws it as a card at the top of the rail; the phone as a strip across the top of the chat, with the
 * conversation's title, a button that shows your conversations and New chat.
 */

export const AUTO_NAME = 'Auto'
export const CONVERSATIONS_BUTTON = 'Conversations'
/** Auto's size on the rail's card and on the phone's strip, in px. */
const RAIL_SIZE = 170
const STRIP_SIZE = 112

function Pills({ stage }: { readonly stage: Stage }) {
  return (
    <div className={styles.pills}>
      <p className={styles.statePill} role="status">
        <span aria-hidden="true">{stage.glyph}</span> {stage.word}
      </p>
      <PauseToggle variant="pill" />
    </div>
  )
}

export function StageCard({ stage }: { readonly stage: Stage }) {
  const nameId = useId()
  return (
    <section className={`${ui.card} ${styles.card}`} data-set="2" aria-labelledby={nameId}>
      <span className={styles.halo} aria-hidden="true" />
      <Auto state={stage.state} size={RAIL_SIZE} label={stageLabel(stage)} className={styles.figure} />
      <p id={nameId} className={styles.name}>
        {AUTO_NAME}
      </p>
      <Pills stage={stage} />
    </section>
  )
}

export interface StageStripProps {
  readonly stage: Stage
  readonly title: string
  readonly listOpen: boolean
  readonly listId: string
  readonly onList: () => void
}

export function StageStrip({ stage, title, listOpen, listId, onList }: StageStripProps) {
  return (
    <section className={`${ui.card} ${styles.strip}`} data-set="2" aria-label={AUTO_NAME}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.round}
          aria-label={CONVERSATIONS_BUTTON}
          aria-expanded={listOpen}
          aria-controls={listId}
          onClick={onList}
        >
          <span className={styles.lines} aria-hidden="true" />
        </button>
        <h1 className={styles.stripTitle}>{title}</h1>
        <NewChatRound className={styles.round} />
      </div>
      <span className={styles.halo} aria-hidden="true" />
      <Auto state={stage.state} size={STRIP_SIZE} label={stageLabel(stage)} className={styles.figure} />
      <Pills stage={stage} />
    </section>
  )
}
