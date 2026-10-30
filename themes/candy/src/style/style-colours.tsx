import { useId } from 'react'

import { contrastRatio, rgbOfCss } from '../looks/colour'
import { AA_TEXT, DESIGN_PAIRS, type LabelledPair } from '../looks/pairs'
import styles from './style.module.css'
import ui from '../ui/ui.module.css'

/**
 * The style sheet's colours: the active palette's colours as swatches, each with the value it is painted in now, and
 * the design's colour pairs, each measured from those painted values (the WCAG contrast ratio, beside the ratio it
 * must reach, as a glyph and a word). A value the page can't read yet says "not measured" rather than guessing.
 */

export const COLOURS_HEADING = 'Colours'
export const SWATCHES_HEADING = 'Swatches'
export const PAIRS_HEADING = 'Contrast'
export const NOT_MEASURED = 'not measured'

export interface Swatch {
  readonly label: string
  readonly variable: string
}

export const SWATCHES: readonly Swatch[] = [
  { label: 'Page', variable: '--candy-page' },
  { label: 'Band', variable: '--candy-band-a' },
  { label: 'Window', variable: '--candy-win' },
  { label: 'Chip', variable: '--candy-chip' },
  { label: 'Text', variable: '--candy-text' },
  { label: 'Quiet text', variable: '--candy-quiet' },
  { label: 'Accent', variable: '--candy-accent' },
  { label: 'Accent ink', variable: '--candy-accent-ink' },
  { label: 'Accent as text', variable: '--candy-accent-text' },
  { label: 'First card', variable: '--candy-g1a' },
  { label: 'Second card', variable: '--candy-g2a' },
  { label: 'Third card', variable: '--candy-g3a' },
]

/** Every variable the colours section reads from the page. */
export const PAINTED_VARIABLES: readonly string[] = [
  ...new Set([...SWATCHES.map((swatch) => swatch.variable), ...DESIGN_PAIRS.flatMap((pair) => [pair.text, pair.ground])]),
]

type Painted = Readonly<Record<string, string>>

/** A pair's contrast ratio from the painted values; null when either can't be read. */
export function ratioOf(pair: LabelledPair, painted: Painted): number | null {
  const text = rgbOfCss(painted[pair.text] ?? '')
  const ground = rgbOfCss(painted[pair.ground] ?? '')
  return text === null || ground === null ? null : contrastRatio(text, ground)
}

/** A ratio against the pair's minimum, as a glyph and a word: never colour alone. */
export function verdictOf(ratio: number, min: number): string {
  return ratio >= min ? `✓ Passes ${min}:1` : `✕ Under ${min}:1`
}

function Swatches({ painted }: { readonly painted: Painted }) {
  return (
    <ul className={styles.swatches}>
      {SWATCHES.map((swatch) => (
        <li key={swatch.variable} className={styles.swatch}>
          <span className={styles.swatchChip} style={{ background: `var(${swatch.variable})` }} aria-hidden="true" />
          <span className={styles.swatchName}>{swatch.label}</span>
          <code className={styles.code}>{swatch.variable}</code>
          <span className={ui.meta}>{painted[swatch.variable] || NOT_MEASURED}</span>
        </li>
      ))}
    </ul>
  )
}

function PairRow({ pair, painted }: { readonly pair: LabelledPair; readonly painted: Painted }) {
  const ratio = ratioOf(pair, painted)
  const min = pair.min ?? AA_TEXT
  return (
    <li className={styles.pair}>
      <span className={styles.pairSample} style={{ color: `var(${pair.text})`, background: `var(${pair.ground})` }} aria-hidden="true">
        Aa
      </span>
      <span className={styles.pairLabel}>{pair.label}</span>
      <span className={styles.ratio}>{ratio === null ? NOT_MEASURED : `${ratio.toFixed(2)}:1`}</span>
      {ratio !== null && (
        <span className={ui.chip} data-quiet={ratio >= min ? undefined : 'true'}>
          {verdictOf(ratio, min)}
        </span>
      )}
    </li>
  )
}

export function Colours({ painted, name }: { readonly painted: Painted; readonly name: string }) {
  const headingId = useId()
  return (
    <section className={`${ui.window} ${styles.section}`} aria-labelledby={headingId}>
      <div className={styles.sectionHead}>
        <h2 id={headingId} className={ui.sectionTitle}>
          {COLOURS_HEADING}
        </h2>
        <span className={ui.meta}>{name}</span>
      </div>
      <h3 className={styles.subTitle}>{SWATCHES_HEADING}</h3>
      <Swatches painted={painted} />
      <h3 className={styles.subTitle}>{PAIRS_HEADING}</h3>
      <ul className={styles.pairs} aria-label={PAIRS_HEADING}>
        {DESIGN_PAIRS.map((pair) => (
          <PairRow key={pair.label} pair={pair} painted={painted} />
        ))}
      </ul>
    </section>
  )
}
