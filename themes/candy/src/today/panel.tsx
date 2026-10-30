import { useId, type ReactNode } from 'react'

import styles from './today.module.css'
import ui from '../ui/ui.module.css'

/**
 * One of Today's two windows (Needs you, Coming up): its title, an optional link beside it, and its rows, or, until
 * the host answers, a quiet "Loading…" (busy, no made-up rows); a failed read says so in words with Try again; an
 * empty one says there is nothing, in words.
 */

export const LOADING = 'Loading…'
export const RETRY = 'Try again'

export type PanelState = 'loading' | 'failed' | 'empty' | 'rows'

export interface PanelProps {
  readonly title: string
  readonly state: PanelState
  readonly failed: string
  readonly empty: string
  readonly onRetry: () => void
  /** A link beside the title. */
  readonly action?: ReactNode
  readonly className?: string
  readonly children?: ReactNode
}

export function Panel({ title, state, failed, empty, onRetry, action, className, children }: PanelProps) {
  const titleId = useId()
  return (
    <section
      className={[ui.window, styles.panel, className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      aria-busy={state === 'loading' ? true : undefined}
    >
      <div className={styles.panelHead}>
        <h2 id={titleId} className={`${ui.sectionTitle} ${styles.panelTitle}`}>
          {title}
        </h2>
        {action}
      </div>
      {state === 'loading' && <p className={ui.note}>{LOADING}</p>}
      {state === 'failed' && (
        <div className={styles.failed}>
          <p className={ui.note}>{failed}</p>
          <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={onRetry}>
            {RETRY}
          </button>
        </div>
      )}
      {state === 'empty' && <p className={ui.note}>{empty}</p>}
      {state === 'rows' && children}
    </section>
  )
}

/** The state of a window over a read: loading until it answers, failed on an error with no data, else its rows. */
export function panelState(data: unknown, error: string | null, count: number): PanelState {
  if (data === null || data === undefined) return error === null ? 'loading' : 'failed'
  return count === 0 ? 'empty' : 'rows'
}
