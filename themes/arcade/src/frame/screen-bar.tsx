import { Today } from './today'
import { Wordmark } from './status-bar'
import styles from './handheld.module.css'

/**
 * The handheld's two strips: the POWER light over the screen, and the screen's own status strip (Auto's mark, the
 * wordmark and today's counters in their short words).
 */

export const POWER = 'Power'

export function PowerStrip() {
  return (
    <div className={styles.power} aria-hidden="true">
      <span className={styles.powerLight} />
      <span className={styles.powerWord}>{POWER}</span>
    </div>
  )
}

export function ScreenBar() {
  return (
    <header className={styles.screenBar}>
      <Wordmark compact />
      <Today compact />
    </header>
  )
}
