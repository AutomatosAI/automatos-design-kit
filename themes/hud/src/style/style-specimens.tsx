import { Panel } from '../components/panel'
import { FONTS } from '../lib/looks/catalogue'
import type { HudLook } from '../lib/looks/types'
import styles from './style.module.css'

/**
 * The style sheet's type and components, drawn in the look: the display face at its top-bar and panel-label sizes,
 * Geist for every sentence and Geist Mono capitals for labels; then HUD's panel, a live panel, the two buttons and
 * the status words. Sample words only: nothing here reads or does anything.
 */

export const TYPE_TITLE = 'Type'
export const COMPONENTS_TITLE = 'Components'

/** Every status is a glyph and a word (the Command design's "Status"), never the colour alone. */
export const STATUS_SAMPLES: readonly (readonly [glyph: string, word: string])[] = [
  ['●', 'Routing'],
  ['○', 'Queued'],
  ['—', 'Idle'],
  ['◆', 'Watching'],
  ['✓', 'Done'],
  ['▸', 'Running'],
  ['✕', 'Failed'],
]

/** What the display face is for this look, in words. */
export function displayDetail(look: Pick<HudLook, 'font'>): string {
  const font = FONTS[look.font]
  return `${font.face} ${font.weight}: ${font.titlePx} px in the top bar, ${font.labelPx} px on a panel's label`
}

export function TypeSection({ look }: { readonly look: HudLook }) {
  return (
    <Panel title={TYPE_TITLE} value={FONTS[look.font].name}>
      <dl className={styles.specimens}>
        <div className={styles.specimen}>
          <dt className={styles.role}>{displayDetail(look)}</dt>
          <dd className={styles.display}>Automatos // HUD</dd>
          <dd className={styles.displayLabel}>Spend · 7 days</dd>
        </div>
        <div className={styles.specimen}>
          <dt className={styles.role}>Geist, the host&apos;s face, for every sentence</dt>
          <dd className={styles.body}>Auto read the brief and drafted the plan.</dd>
        </div>
        <div className={styles.specimen}>
          <dt className={styles.role}>Geist Mono capitals for labels, tracked .14em</dt>
          <dd className={styles.mono}>Searching the web</dd>
        </div>
      </dl>
    </Panel>
  )
}

export function ComponentsSection() {
  return (
    <Panel title={COMPONENTS_TITLE}>
      <div className={styles.components}>
        <Panel title="Mission" value="2 / 4" level={3}>
          <p className={styles.sampleText}>A panel: the accent&apos;s fill, its border and two corner brackets.</p>
        </Panel>
        <Panel title="Researcher" value="62%" level={3} live>
          <p className={styles.sampleText}>A live panel: the accent&apos;s border and a soft glow.</p>
        </Panel>
      </div>
      <div className={styles.buttons} aria-hidden="true">
        <span className={styles.primary}>Open Mission</span>
        <span className={styles.secondary}>Pause</span>
      </div>
      <ul className={styles.statuses} aria-label="Status words">
        {STATUS_SAMPLES.map(([glyph, word]) => (
          <li key={word} className={styles.status}>
            <span aria-hidden="true">{glyph}</span> {word}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
