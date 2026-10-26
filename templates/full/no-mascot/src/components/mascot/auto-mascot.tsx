'use client'

import { useMascotPlayer } from '../../hooks/use-mascot-player'
import { captionFor } from '@automatos/mascot/media'
import type { MascotName } from '@automatos/mascot/types'

import styles from './auto-mascot.module.css'

/**
 * Auto without his clips: this theme was made with `automatos-theme new --template full --mascot none`, so it draws
 * no mascot. There is no clip, no still and no light ring here, and no Pause Auto control, since nothing moves. What
 * stays is his caption: the words that say what Auto, the AI, is doing, as a polite live region, from the same
 * states the chat feeds him. A one-shot state (his hello, a celebration) still ends on the player's timer, so the
 * chat moves on as it does with him drawn. The props are the drawn mascot's, so every page that places him needs no
 * change; the ones only a drawn mascot reads (lightsPage, playing, pauseControl, speaking) are taken and left alone.
 */

export type AutoMascotSize = 'small' | 'regular' | 'large'

export interface AutoMascotProps {
  /** The reducer's state.mascot (useAutoMascot's `mascot`). */
  readonly state: MascotName
  /** Dispatch {type: 'clip-ended', state} to the reducer (useAutoMascot's `onClipEnded`). */
  readonly onClipEnded?: (state: MascotName) => void
  /** Overrides the caption for the state, e.g. captionFor('celebrate', 'report'). */
  readonly caption?: string
  /** A second caption line, e.g. the search query. */
  readonly detail?: string
  readonly size?: AutoMascotSize
  /** False when the page already says it in words (the first-open headline). */
  readonly showCaption?: boolean
  readonly lightsPage?: boolean
  readonly playing?: boolean
  /** True where the page already names the state in visible words: nothing is drawn. */
  readonly decorative?: boolean
  readonly pauseControl?: boolean
  /** A drawn mascot's ring follows Auto's voice while he speaks; here there is no ring. */
  readonly speaking?: boolean
}

export function AutoMascot({
  state,
  onClipEnded,
  caption,
  detail,
  size = 'regular',
  showCaption = true,
  decorative = false,
}: AutoMascotProps) {
  // No clip plays: the player shows the state at once and ends a one-shot on its timer.
  useMascotPlayer({ target: state, still: true, onClipEnded })
  if (decorative || !showCaption) return null
  return (
    <p className={styles.caption} data-size={size} aria-live="polite" aria-atomic="true">
      <span className={styles.captionTitle}>{caption ?? captionFor(state)}</span>
      {detail && <span className={styles.captionDetail}>{detail}</span>}
    </p>
  )
}
