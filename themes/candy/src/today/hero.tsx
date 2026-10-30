import { CHAT_HREF, HostLink } from '@automatos/theme-sdk'

import { Auto } from '../art/auto'
import { Orb } from '../art/orb'
import { NEEDS_YOU_HREF } from './needs-rows'
import { greetingFor, longDate, waitingLine } from './today-words'
import styles from './today.module.css'
import ui from '../ui/ui.module.css'

/**
 * Today's hero, on the band: the day, the greeting for the time of day, what is waiting for the person (the
 * Needs-you total, in words), Chat with Auto and See what needs you; at the right the orb with what was completed
 * today, and Auto celebrating at its lower left (decoration: the orb's words say it).
 */

export const CHAT_WITH_AUTO = 'Chat with Auto'
export const SEE_NEEDS = 'See what needs you'
export const COMPLETED_TODAY = 'completed today'

export interface HeroProps {
  readonly now: number
  /** The Needs-you total; null until it answers. */
  readonly waiting: number | null
  /** What was completed today, as the orb shows it. */
  readonly completed: string
}

export function Hero({ now, waiting, completed }: HeroProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroText}>
        <p className={styles.date}>{longDate(now)}</p>
        <p className={styles.greeting}>{greetingFor(new Date(now).getHours())}</p>
        <p className={styles.waiting}>{waitingLine(waiting)}</p>
        <div className={styles.actions}>
          <HostLink href={CHAT_HREF} className={ui.button}>
            {CHAT_WITH_AUTO}
          </HostLink>
          <HostLink href={NEEDS_YOU_HREF} className={ui.secondary}>
            {SEE_NEEDS}
          </HostLink>
        </div>
      </div>
      <div className={styles.orbSpot}>
        <Orb figure={completed} caption={COMPLETED_TODAY} />
        <Auto state="celebrate" size={96} className={styles.auto} />
      </div>
    </div>
  )
}
