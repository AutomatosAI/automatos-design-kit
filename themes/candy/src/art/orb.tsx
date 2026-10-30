import type { CSSProperties } from 'react'

import { useMotion } from '../motion/use-motion'
import styles from './orb.module.css'

/**
 * Candy's orb: a glossy ball of the three card gradients and a pink (--candy-orb), a thin see-through ring around
 * it, and a white arc on its right and lower edge that turns once every 20 s while the person lets things move (the
 * look's Motion knob, the Pause control and the OS's reduced motion all stop it, as they stop Auto). In its middle a
 * big white figure and its caption, as text. Today shows what was completed today in it; the look editor's preview
 * can draw it at any size, since every measure follows `size`.
 */

export interface OrbProps {
  /** The big number, as text ("14", or "—" while it is unknown). */
  readonly figure: string
  readonly caption: string
  /** Width and height in px; the design's is 250. */
  readonly size?: number
  /** Never turns, whatever the motion setting. */
  readonly still?: boolean
  readonly className?: string
}

export const ORB_SIZE = 250

export function Orb({ figure, caption, size = ORB_SIZE, still = false, className }: OrbProps) {
  const { moving } = useMotion()
  const style = { '--candy-orb-size': `${size}px` } as CSSProperties
  return (
    <div className={[styles.orb, className].filter(Boolean).join(' ')} style={style} data-moving={moving && !still ? 'true' : undefined}>
      <span className={styles.halo} aria-hidden="true" />
      <span className={styles.ball} aria-hidden="true" />
      <span className={styles.arc} aria-hidden="true" />
      <p className={styles.words}>
        <span className={styles.figure}>{figure}</span> <span className={styles.caption}>{caption}</span>
      </p>
    </div>
  )
}
