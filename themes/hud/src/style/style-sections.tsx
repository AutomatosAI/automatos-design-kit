import { type CSSProperties, Fragment } from 'react'

import { Panel } from '../components/panel'
import type { HudLook } from '../lib/looks/types'
import { contrastChecks, displayValue, formatRatio, knobRows, swatches, HUD_COLOURS, STUDIO_TOKENS, type Swatch } from './tokens'
import styles from './style.module.css'

/**
 * The style sheet's sections, each a HUD panel: the look's knobs with the variable each drives, HUD's colours,
 * Studio's tokens, and the live contrast with an AA verdict as a glyph and a word, never the colour alone. A
 * swatch's chip is drawn in the variable itself (var(), or hsl(var()) for a Studio triplet), so it shows what the
 * page paints now; the value beside it is the one the look paints, its numbers rounded to three places, free to wrap
 * after a comma and never inside a number.
 */

export const KNOBS_TITLE = 'This look'
export const COLOURS_TITLE = 'Colours'
export const STUDIO_TITLE = "Studio's tokens"
export const CONTRAST_TITLE = 'Contrast'
export const AA_PASS = 'AA pass'
export const AA_FAIL = 'AA fail'

type ChipStyle = CSSProperties & { readonly '--hud-swatch': string }

/** A chip drawn in a HUD variable, or in a Studio triplet wrapped as hsl(). */
export function chipStyle(name: string, studio: boolean): ChipStyle {
  return { '--hud-swatch': studio ? `hsl(var(${name}))` : `var(${name})` }
}

/** A painted value, rounded for reading (displayValue), with a line break allowed after each comma. */
export function PaintedValue({ value, className }: { readonly value: string; readonly className?: string }) {
  const [first, ...rest] = displayValue(value).split(',')
  return (
    <code className={className}>
      {first}
      {rest.map((part, index) => (
        // The parts of one value never reorder.
        <Fragment key={index}>
          ,<wbr />
          {part}
        </Fragment>
      ))}
    </code>
  )
}

export function KnobSection({ look }: { readonly look: HudLook }) {
  return (
    <Panel title={KNOBS_TITLE} value={look.name}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Knob</th>
            <th scope="col">Choice</th>
            <th scope="col">Variable</th>
            <th scope="col">Painted</th>
          </tr>
        </thead>
        <tbody>
          {knobRows(look).map((row) => (
            <tr key={row.knob}>
              <th scope="row">{row.label}</th>
              <td>{row.choice}</td>
              <td>
                <code className={styles.code}>{row.variable}</code>
              </td>
              <td>
                <PaintedValue className={styles.code} value={row.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function SwatchList({ items, studio }: { readonly items: readonly Swatch[]; readonly studio: boolean }) {
  return (
    <ul className={styles.swatches}>
      {items.map((swatch) => (
        <li key={swatch.name} className={styles.swatch}>
          <span className={styles.chip} style={chipStyle(swatch.name, studio)} aria-hidden="true" />
          <code className={styles.code}>{swatch.name}</code>
          <PaintedValue className={styles.value} value={swatch.value} />
          <span className={styles.role}>{swatch.role}</span>
        </li>
      ))}
    </ul>
  )
}

export function ColourSection({ look }: { readonly look: HudLook }) {
  return (
    <Panel title={COLOURS_TITLE}>
      <SwatchList items={swatches(look, HUD_COLOURS)} studio={false} />
    </Panel>
  )
}

export function StudioSection({ look }: { readonly look: HudLook }) {
  return (
    <Panel title={STUDIO_TITLE}>
      <p className={styles.note}>The host&apos;s own pages inside HUD&apos;s frame read these, so they take the look too.</p>
      <SwatchList items={swatches(look, STUDIO_TOKENS)} studio />
    </Panel>
  )
}

export function ContrastSection({ look }: { readonly look: HudLook }) {
  return (
    <Panel title={CONTRAST_TITLE}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Colours</th>
            <th scope="col">Ratio</th>
            <th scope="col">WCAG</th>
          </tr>
        </thead>
        <tbody>
          {contrastChecks(look).map((check) => (
            <tr key={check.label}>
              <th scope="row">{check.label}</th>
              <td>
                <code className={styles.code}>{`${check.foreground} on ${check.background}`}</code>
              </td>
              <td>{formatRatio(check.ratio)}</td>
              <td className={styles.verdict} data-passes={check.passes ? 'true' : 'false'}>
                <span aria-hidden="true">{check.passes ? '✓' : '✕'}</span> {check.passes ? AA_PASS : AA_FAIL}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
