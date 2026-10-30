import { useEffect, useRef } from 'react'
import { useEdition, type HostHealth } from '@automatos/theme-sdk'

import { Auto } from '../art/auto'
import { THEME_HEADING } from '../theme'
import styles from './asleep.module.css'
import ui from '../ui/ui.module.css'

/**
 * Candy's asleep screen (asleep@1: the frame draws it, so the host leaves the health poll to the frame): while the
 * backend doesn't answer, the page gives way to a window with Auto asleep, what is going on in words, and Check again,
 * which asks at once ("Checking…" while it does). The host's own poll keeps asking meanwhile, and the page comes back
 * by itself once it answers. The heading takes the focus as the screen opens, so the swap never drops it.
 */

export const ASLEEP_TITLE = 'Automatos is asleep'
export const ASLEEP_LOCAL = "Automatos isn't running on this computer. Start it again, then check."
export const ASLEEP_HOSTED = "Automatos isn't answering right now. This page checks again on its own."
export const CHECK_AGAIN = 'Check again'
export const CHECKING = 'Checking…'

export function Asleep({ health }: { readonly health: HostHealth }) {
  const local = useEdition() === 'local'
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <section className={`${ui.window} ${styles.asleep}`} aria-labelledby="candy-asleep-title">
      <div className={styles.band} aria-hidden="true" />
      <Auto state="sleeping" size={140} />
      <h1 id="candy-asleep-title" ref={heading} className={styles.title} tabIndex={-1} {...THEME_HEADING}>
        {ASLEEP_TITLE}
      </h1>
      <p className={styles.line}>{local ? ASLEEP_LOCAL : ASLEEP_HOSTED}</p>
      <button type="button" className={ui.button} onClick={health.check} disabled={health.checking}>
        {health.checking ? CHECKING : CHECK_AGAIN}
      </button>
    </section>
  )
}
