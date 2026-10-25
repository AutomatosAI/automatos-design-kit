import styles from './empty-chat.module.css'

/**
 * The conversation before anything is said, at the foot of the transcript over the message box: one line set as the
 * box's key hint is (mono capitals, tracked), and three starters in HUD's secondary button style, each putting its
 * words in the box for you to send or change first (after Play's first open, themes/play/src/components/play/chat/
 * first-open.tsx, Play 1.1.1). The starters are examples, made up.
 */

/** The transcript before anything is said. */
export const EMPTY_LINE = 'Nothing said yet. Type below, and Auto answers here.'
export const STARTERS_LABEL = 'Starters'
export const STARTERS = [
  'What needs me today?',
  'Plan my week around three deadlines',
  'Draft a short update for the team',
] as const

export interface EmptyChatProps {
  /** Puts a starter's words in the message box; without it the line stands alone. */
  readonly onStarter?: (text: string) => void
}

export function EmptyChat({ onStarter }: EmptyChatProps) {
  return (
    <div className={styles.empty}>
      <p className={styles.line}>{EMPTY_LINE}</p>
      {onStarter && (
        <ul className={styles.starters} aria-label={STARTERS_LABEL}>
          {STARTERS.map((starter) => (
            <li key={starter}>
              <button type="button" className={styles.starter} onClick={() => onStarter(starter)}>
                {starter}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
