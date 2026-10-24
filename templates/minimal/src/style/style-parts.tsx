import { useId } from 'react'

import shared from '../looks/looks.module.css'
import { COLOURS, RADIUS_VARIABLE, TYPE_SCALE } from './tokens'
import styles from './style.module.css'

/**
 * The style sheet's three sections: the look's colours (each swatch drawn in its own variable, with the value the
 * page has now), the type scale, and the theme's components as they look in the active look.
 */

export const COLOURS_LABEL = 'Colours'
export const TYPE_LABEL = 'Type'
export const COMPONENTS_LABEL = 'Components'
const NOT_PAINTED = 'not painted'

export function Colours({ painted }: { readonly painted: Readonly<Record<string, string>> }) {
  const headingId = useId()
  return (
    <section className={shared.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={shared.label}>
        {COLOURS_LABEL}
      </h2>
      <ul className={styles.swatches}>
        {COLOURS.map((swatch) => (
          <li key={swatch.variable} className={styles.swatch}>
            <span className={styles.chip} style={{ background: `var(${swatch.variable})` }} aria-hidden="true" />
            <span className={styles.swatchName}>{swatch.label}</span>
            <span className={styles.swatchUse}>{swatch.use}</span>
            <code className={styles.code}>
              {swatch.variable}: {painted[swatch.variable] || NOT_PAINTED}
            </code>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TypeScale() {
  const headingId = useId()
  return (
    <section className={shared.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={shared.label}>
        {TYPE_LABEL}
      </h2>
      <dl className={styles.specimens}>
        {TYPE_SCALE.map((specimen) => (
          <div key={specimen.variable} className={styles.specimen}>
            <dt className={styles.code}>{specimen.variable}</dt>
            <dd className={styles.sample} style={{ font: `var(${specimen.variable})` }}>
              {specimen.sample}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function Components({ radius }: { readonly radius: string }) {
  const headingId = useId()
  const fieldId = useId()
  return (
    <section className={shared.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={shared.label}>
        {COMPONENTS_LABEL}
      </h2>
      <div className={styles.components}>
        <button type="button" className={shared.primary}>
          Start a Mission
        </button>
        <button type="button" className={shared.secondary}>
          Not now
        </button>
        <label htmlFor={fieldId} className={styles.field}>
          <span>Ask Auto</span>
          <input id={fieldId} className={styles.input} placeholder="What should Auto do next?" />
        </label>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>A Deliverable</h3>
          <p className={styles.cardText}>A card on the surface, its corners from the look.</p>
          <code className={styles.code}>
            {RADIUS_VARIABLE}: {radius || NOT_PAINTED}
          </code>
        </article>
      </div>
    </section>
  )
}
