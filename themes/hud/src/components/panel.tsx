import { useId, type ReactNode } from 'react'

import styles from './panel.module.css'

/**
 * HUD's one container (the Command design's README, "Panel"): the accent's 3.5% fill, a 1 px border
 * of the accent at 16%, and 14 by 1.5 px corner brackets on the top left and bottom right; its header is the
 * display face at the look's label size, tracked .2em, in the secondary text, with an optional value on the
 * right. A live panel (a selected card, the running agent) gets a 1.5 px accent border and a soft glow.
 * Square: HUD has no radii. Every HUD screen builds on it: the frame's dock, the chat's panels, the Looks drawer.
 */

export interface PanelProps {
  /** The header's label, as a person reads it: the display face sets it in capitals. */
  readonly title: string
  /** A value on the header's right ("4 / 4", "$3.11"). */
  readonly value?: ReactNode
  /** The panel is selected or live. */
  readonly live?: boolean
  /** The heading's level: 2 by default, 3 inside a page that has its own h2s. */
  readonly level?: 2 | 3
  readonly className?: string
  readonly children?: ReactNode
}

export function Panel({ title, value, live = false, level = 2, className, children }: PanelProps) {
  const titleId = useId()
  const Heading = level === 3 ? 'h3' : 'h2'
  const classes = className ? `${styles.panel} ${className}` : styles.panel
  return (
    <section className={classes} aria-labelledby={titleId} data-live={live ? 'true' : undefined}>
      <header className={styles.head}>
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {value !== undefined && <span className={styles.value}>{value}</span>}
      </header>
      {children}
    </section>
  )
}
