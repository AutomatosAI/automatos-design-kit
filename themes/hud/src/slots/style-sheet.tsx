import { useId } from 'react'

import { Panel } from '../components/panel'
import { ACCENTS, FONTS, GROUNDS } from '../lib/looks/catalogue'
import { KNOB_LABELS } from '../lib/looks/spec'
import { useHudLook } from '../lib/looks/use-hud-look'
import { THEME_HEADING } from '../theme'
import styles from './placeholder.module.css'

/**
 * styleSheet@1, the host's /looks/style page: for now the active look's choices, in words. A stand-in: HUD's
 * style sheet (its type, colours, panels and Auto's states) replaces it in this module, under the same name,
 * HudStyleSheet, which src/entry.ts registers.
 */

export const STYLE_SHEET_TITLE = 'Style sheet'

export function HudStyleSheet() {
  const headingId = useId()
  const look = useHudLook()
  const rows: readonly (readonly [string, string])[] = [
    [KNOB_LABELS.accent, ACCENTS[look.accent].name],
    [KNOB_LABELS.ground, GROUNDS[look.ground].name],
    [KNOB_LABELS.font, FONTS[look.font].face],
  ]
  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <h1 id={headingId} className={styles.heading} tabIndex={-1} {...THEME_HEADING}>
        {STYLE_SHEET_TITLE}
      </h1>
      <Panel title={look.name}>
        <dl className={styles.facts}>
          {rows.map(([label, value]) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </section>
  )
}
