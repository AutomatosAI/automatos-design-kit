import { useId, type CSSProperties } from 'react'

import { ACCENTS, GROUNDS } from '../lib/looks/catalogue'
import type { HudLook } from '../lib/looks/types'
import styles from './drawer.module.css'

/**
 * The drawer's looks ("Automatos Command HUD.dc.html"): the five presets, then the user's saved looks, each a card
 * drawn in its own background with a ring in its own accent, and its name. Picking one makes it the active look. The
 * cards wrap onto as many lines as they need, so every look shows whole, a look just saved at the end of them too.
 */

export const LOOKS_ROW_LABEL = 'Looks'

type CardStyle = CSSProperties & { readonly '--hud-card-ground': string; readonly '--hud-card-accent': string }

/** A card's background and ring, in the catalogue's colours for the look it shows. */
export function cardStyle(look: Pick<HudLook, 'ground' | 'accent'>): CardStyle {
  return { '--hud-card-ground': GROUNDS[look.ground].bg, '--hud-card-accent': ACCENTS[look.accent].hex }
}

export interface LooksRowProps {
  readonly looks: readonly HudLook[]
  /** The active look's id: its card is pressed. */
  readonly activeId: string
  readonly onPick: (look: HudLook) => void
}

export function LooksRow({ looks, activeId, onPick }: LooksRowProps) {
  const headingId = useId()
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        {LOOKS_ROW_LABEL}
      </h2>
      <ul className={styles.row}>
        {looks.map((look) => (
          <li key={look.id} className={styles.rowItem}>
            <button type="button" className={styles.card} aria-pressed={look.id === activeId} onClick={() => onPick(look)}>
              <span className={styles.cardTop} style={cardStyle(look)} aria-hidden="true">
                <span className={styles.cardRing} />
              </span>
              <span className={styles.cardName}>{look.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
