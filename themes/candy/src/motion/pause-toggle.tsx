import { useMotion } from './use-motion'
import styles from './pause.module.css'

/**
 * The control that stops Candy's motion (WCAG 2.2.2: anything that moves for more than five seconds can be paused):
 * Auto stops floating and blinking, the orb's ring stops turning, the writing dots hold still. A toggle with one name
 * and aria-pressed, kept per account. Under the OS's reduced motion nothing moves, so there is none; until the host
 * can say what was chosen it is a disabled button. `variant` picks the sidebar's row or the stage's outlined pill.
 */

export const PAUSE_LABEL = 'Pause motion'
export const PAUSE_SHORT = 'Pause'

export interface PauseToggleProps {
  readonly variant?: 'row' | 'pill'
}

export function PauseToggle({ variant = 'row' }: PauseToggleProps) {
  const { reduced, paused, ready, togglePause } = useMotion()
  if (reduced) return null
  return (
    <button
      type="button"
      className={variant === 'row' ? styles.row : styles.pill}
      aria-pressed={paused}
      disabled={!ready}
      onClick={togglePause}
    >
      <span className={styles.icon} aria-hidden="true">
        <span className={paused ? styles.play : styles.bars} />
      </span>
      {variant === 'row' ? PAUSE_LABEL : PAUSE_SHORT}
    </button>
  )
}
