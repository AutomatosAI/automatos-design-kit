/**
 * The contrast panel beside the phone: the block measured by `automatos-theme check`'s own measure (src/phone/
 * contrast.ts), its outcome and reason as `check` words them, then the ten MOBILE_CONTRAST_PAIRS of the subject on
 * screen (the scheme, the member's look or the table's defaults), each with its ratio, its minimum (4.5:1 for text,
 * 3:1 for a UI mark) and pass, fail or not measured. A theme.json with no `mobile` block is not measured: the review
 * keeps its unmeasured entry, and the phone draws Studio.
 */
import {
  DEFAULTS_ID, subjectLabel, type ContrastPair, type ContrastSubject, type MobileMeasure,
} from '@automatos/theme-cli/mobile-contrast'
import type { CSSProperties } from 'react'
import { OUTCOME_WORDS, type ShownSubject } from '../../src/phone/contrast.ts'

export const NO_BLOCK_TEXT = 'Not measured: theme.json has no mobile block, so the review measures nothing and the phone draws Studio.'
export const NOTE_TEXT = Object.freeze({
  'other-scheme': 'The block gives no colours for this scheme, so the phone paints the other one: these are its pairs.',
  'defaults-sent': 'This look paints no ground or text for a phone: the review fails it, and the server sends the defaults instead.',
})
export const STATUS_WORDS: Readonly<Record<ContrastPair['status'], string>> = Object.freeze({
  pass: 'pass', fail: 'fail', not_measured: 'not measured',
})

const PANEL_STYLE: CSSProperties = Object.freeze({
  fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#18181b', background: '#ffffff', border: '1px solid #a1a1aa',
  borderRadius: '8px', padding: '12px 16px', minWidth: '320px', maxWidth: '520px',
})
const CELL: CSSProperties = Object.freeze({ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e4e4e7' })
const FAIL_INK = '#b91c1c'

function ratioText(pair: ContrastPair): string {
  return pair.ratio === null ? '–' : `${pair.ratio.toFixed(2)}:1`
}

function PairRow({ pair }: { readonly pair: ContrastPair }) {
  const failed = pair.status === 'fail'
  return (
    <tr data-pair={`${pair.foreground} on ${pair.background}`} data-status={pair.status}>
      <td style={CELL}><code>{pair.foreground}</code> on <code>{pair.background}</code></td>
      <td style={CELL}>{ratioText(pair)}</td>
      <td style={CELL}>{`${pair.minimum}:1`}</td>
      <td style={{ ...CELL, color: failed ? FAIL_INK : CELL.color, fontWeight: failed ? 600 : 400 }}>{STATUS_WORDS[pair.status]}</td>
    </tr>
  )
}

function SubjectTable({ subject }: { readonly subject: ContrastSubject }) {
  const name = subject.id === DEFAULTS_ID ? `${DEFAULTS_ID} (no stored look)` : subjectLabel(subject.kind, subject.id)
  return (
    <table aria-label={`The pairs of ${name}`} style={{ borderCollapse: 'collapse', width: '100%' }}>
      <caption style={{ textAlign: 'left', padding: '8px 0 4px', fontWeight: 600 }}>
        {name}: {OUTCOME_WORDS[subject.status].toLowerCase()}
        {subject.missing.length > 0 ? `, gives no ${subject.missing.join(' or ')}` : ''}
      </caption>
      <thead>
        <tr><th style={CELL}>Pair</th><th style={CELL}>Ratio</th><th style={CELL}>Minimum</th><th style={CELL}>Result</th></tr>
      </thead>
      <tbody>
        {subject.pairs.map((pair) => <PairRow key={`${pair.foreground} ${pair.background}`} pair={pair} />)}
      </tbody>
    </table>
  )
}

export interface ContrastPanelProps {
  readonly measure: MobileMeasure | null
  readonly shown: ShownSubject
}

export function ContrastPanel({ measure, shown }: ContrastPanelProps) {
  const outcome = measure?.status ?? 'not_measured'
  return (
    <section aria-labelledby="phone-contrast-heading" data-outcome={outcome} style={PANEL_STYLE}>
      <h2 id="phone-contrast-heading" style={{ margin: '0 0 8px', fontSize: '16px' }}>
        Contrast, as automatos-theme check measures it: {OUTCOME_WORDS[outcome]}
      </h2>
      <p data-reason="" style={{ margin: '0 0 8px' }}>{measure === null ? NO_BLOCK_TEXT : measure.reason}</p>
      {shown.note === null ? null : <p role="note" style={{ margin: '0 0 8px' }}>{NOTE_TEXT[shown.note]}</p>}
      {shown.subject === null ? null : <SubjectTable subject={shown.subject} />}
    </section>
  )
}
