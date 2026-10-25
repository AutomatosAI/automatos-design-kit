import { useEffect, useState } from 'react'
import { useActivityFeed } from '@automatos/theme-sdk'

import type { MascotName } from '@automatos/mascot/types'

import { RUNNING_MISSION } from '../panels/mission-panel'
import styles from './phone.module.css'
import { statusLineWords } from './status-words'

/**
 * The phone core screen's top line (status-words.ts): who is at work and what they do on the left, the running
 * Mission's time on the right, read from the SDK's activity feed with the same ask as the desktop's MISSION panel, and
 * Auto's state, the chat's. The time counts each second while a Mission with a start runs, and stops otherwise. Plain
 * text: the chip under the core is the screen's live region for Auto's state.
 */

const TICK_MS = 1000

/** The time now, read again every second while `ticking`. */
function useNow(ticking: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!ticking) return undefined
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [ticking])
  return now
}

export function StatusLine({ state }: { readonly state: MascotName }) {
  const { data } = useActivityFeed(RUNNING_MISSION)
  const mission = data?.items[0] ?? null
  const now = useNow(typeof mission?.started_at === 'string')
  const words = statusLineWords(state, mission, now)
  return (
    <p className={styles.line}>
      <span className={styles.who}>{`${words.who} · ${words.doing}`}</span>
      {words.clock !== null && (
        <time className={styles.clock} dateTime={words.duration ?? undefined}>
          {words.clock}
        </time>
      )}
    </p>
  )
}
