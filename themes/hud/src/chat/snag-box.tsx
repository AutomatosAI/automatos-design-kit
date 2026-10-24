import styles from './cards.module.css'

/**
 * The "I hit a snag" box (after Play's, themes/play/src/components/play/chat/snag-box.tsx, Play 1.1.1): what went
 * wrong, in words, each line after ✕, and Try again, which asks the chat to answer the last message again. Only
 * the newest failed turn gets the button.
 */

export const SNAG_TITLE = 'I hit a snag'
export const TRY_AGAIN = 'Try again'
/** A turn that failed before Auto's reply began (the request itself failed): the host's notice has the detail. */
export const TURN_FAILED = "Auto couldn't answer that just now."

export interface SnagBoxProps {
  readonly lines: readonly string[]
  /** Answers the last message again; none for an older reply. */
  readonly onRetry?: () => void
}

export function SnagBox({ lines, onRetry }: SnagBoxProps) {
  return (
    <section className={styles.snag} aria-label={SNAG_TITLE}>
      <h3 className={styles.snagTitle}>{SNAG_TITLE}</h3>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className={styles.snagLine}>
          <span className={styles.mark} aria-hidden="true">
            ✕
          </span>
          {line}
        </p>
      ))}
      {onRetry && (
        <button type="button" className={styles.secondary} onClick={onRetry}>
          {TRY_AGAIN}
        </button>
      )}
    </section>
  )
}
