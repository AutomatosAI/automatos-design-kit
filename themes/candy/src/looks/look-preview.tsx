import { useId } from 'react'

import { Auto } from '../art/auto'
import cards from './look-cards.module.css'
import styles from './looks.module.css'
import ui from '../ui/ui.module.css'

/**
 * The look editor's Preview window: on the band, Auto beside his bubble, three of Today's cards (the middle one
 * taller) and a bubble of the user's. It draws nothing of its own: it reads the look the host has painted on <html>,
 * so every change shows here as it does everywhere. Auto celebrates for a moment after Save look. The sample is a
 * picture, hidden from screen readers, which hear one line saying what it shows instead of numbers that aren't real.
 */

export const PREVIEW_HEADING = 'Preview'
export const PREVIEW_SAYS = 'A sample in this look: Auto, three cards and a chat bubble.'
export const AUTO_BUBBLE = 'Looking lovely. Want to keep it?'
export const USER_BUBBLE = 'Make it pinker.'
export const PREVIEW_CARDS: readonly { readonly set: 1 | 2 | 3; readonly label: string; readonly count: number }[] = [
  { set: 1, label: 'Working now', count: 4 },
  { set: 2, label: 'Needs you', count: 3 },
  { set: 3, label: 'In queue', count: 9 },
]
export const PREVIEW_AUTO_SIZE = 84

export function LookPreview({ celebrating }: { readonly celebrating: boolean }) {
  const headingId = useId()
  return (
    <section className={`${ui.window} ${styles.preview}`} aria-labelledby={headingId}>
      <h2 id={headingId} className={ui.sectionTitle}>
        {PREVIEW_HEADING}
      </h2>
      <p className={ui.srOnly}>{PREVIEW_SAYS}</p>
      <div className={cards.stage} aria-hidden="true">
        <div className={cards.stageAuto}>
          <Auto state={celebrating ? 'celebrate' : 'idle'} size={PREVIEW_AUTO_SIZE} />
          <p className={cards.autoBubble}>{AUTO_BUBBLE}</p>
        </div>
        <div className={cards.previewCards}>
          {PREVIEW_CARDS.map((card) => (
            <div key={card.set} className={`${ui.card} ${cards.previewCard}`} data-set={card.set}>
              <span className={cards.previewLabel}>{card.label}</span>
              <span className={cards.previewCount}>{card.count}</span>
            </div>
          ))}
        </div>
        <p className={cards.userBubble}>{USER_BUBBLE}</p>
      </div>
    </section>
  )
}
