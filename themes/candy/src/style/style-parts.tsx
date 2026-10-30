import { MASCOT_STATES } from '@automatos/mascot/types'
import { useId, type CSSProperties, type ReactNode } from 'react'

import { Auto } from '../art/auto'
import { stateGlyph, stateWord } from '../art/state-words'
import { GRADIENT_NOTES, KNOBS, type ChoiceKnob } from '../looks/spec'
import { CARD_LAYERS, GRADIENTS } from './card-layers'
import styles from './style.module.css'
import ui from '../ui/ui.module.css'

/**
 * The style sheet's other sections: Candy's type scale (Outfit for titles and numbers, Nunito for everything else,
 * at the design's sizes), the three card gradients as Soft, Rich and Vivid draw them, the buttons, pills and chips,
 * and Auto in all twelve states as stills, each with its state word. All of it is drawn in the active look.
 */

export const TYPE_HEADING = 'Type'
export const CARDS_HEADING = 'Cards'
export const CONTROLS_HEADING = 'Buttons, pills and chips'
export const STATES_HEADING = 'Auto'
export const STILL_SIZE = 72

interface TypeSample {
  readonly face: 'title' | 'body'
  readonly size: number
  readonly weight: number
  readonly sample: string
  readonly use: string
}

export const TYPE_SCALE: readonly TypeSample[] = [
  { face: 'title', size: 76, weight: 600, sample: '12', use: 'The orb’s number' },
  { face: 'title', size: 48, weight: 600, sample: '4 · 3 · 9', use: 'Big numbers' },
  { face: 'title', size: 34, weight: 600, sample: 'Your look', use: 'Page titles, card numbers' },
  { face: 'title', size: 20, weight: 600, sample: 'Presets', use: 'Window titles' },
  { face: 'body', size: 18, weight: 700, sample: 'Here is your day.', use: 'Lead lines' },
  { face: 'body', size: 15, weight: 400, sample: 'Auto keeps an eye on everything for you.', use: 'Body' },
  { face: 'body', size: 15, weight: 800, sample: 'Save look', use: 'Buttons and row names' },
  { face: 'body', size: 14, weight: 700, sample: 'Looking lovely. Want to keep it?', use: 'Bubbles and notes' },
  { face: 'body', size: 13, weight: 800, sample: 'Needs you', use: 'Card labels' },
  { face: 'body', size: 12, weight: 700, sample: '● Active', use: 'Chips: the smallest text' },
]

const FACE_NAMES = { title: 'Outfit', body: 'Nunito' } as const
const GRADIENT_KNOB = KNOBS.find((knob): knob is ChoiceKnob => knob.name === 'gradient')
const gradientLabel = (key: string): string => GRADIENT_KNOB?.choices.find((choice) => choice.key === key)?.label ?? key
const CARD_NAMES = ['First card', 'Second card', 'Third card'] as const

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const headingId = useId()
  return (
    <section className={`${ui.window} ${styles.section}`} aria-labelledby={headingId}>
      <h2 id={headingId} className={ui.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export function TypeScale() {
  return (
    <Section title={TYPE_HEADING}>
      <ul className={styles.typeList}>
        {TYPE_SCALE.map((entry) => (
          <li key={`${entry.face}-${entry.size}-${entry.weight}`} className={styles.typeRow}>
            <span className={styles.typeSpec}>{`${FACE_NAMES[entry.face]} ${entry.weight} · ${entry.size} px`}</span>
            <span className={styles.typeSample} data-face={entry.face} style={{ fontSize: `${entry.size}px`, fontWeight: entry.weight }}>
              {entry.sample}
            </span>
            <span className={ui.meta}>{entry.use}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function CardGradients() {
  return (
    <Section title={CARDS_HEADING}>
      <ul className={styles.gradientRows}>
        {GRADIENTS.map((gradient) => (
          <li key={gradient} className={styles.gradientRow} style={CARD_LAYERS[gradient] as CSSProperties}>
            <span className={styles.gradientName}>{gradientLabel(gradient)}</span>
            <span className={ui.meta}>{GRADIENT_NOTES[gradient]}</span>
            <span className={styles.gradientCards}>
              {CARD_NAMES.map((name, index) => (
                <span key={name} className={styles.gradientCard} data-set={index + 1}>
                  <span className={styles.cardLabel}>{name}</span>
                  <span className={styles.cardNumber}>{index + 1}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** Each group is a picture of the parts, with a caption that says what they are. */
export function Controls() {
  return (
    <Section title={CONTROLS_HEADING}>
      <div className={styles.specimens}>
        <div className={styles.specimen}>
          <div className={styles.specimenRow} aria-hidden="true">
            <span className={ui.button}>Save look</span>
            <span className={`${ui.secondary} ${styles.outlined}`}>Reset</span>
            <span className={ui.quiet}>Export</span>
          </div>
          <p className={ui.meta}>Buttons: accent, window and quiet pills, 50 px tall.</p>
        </div>
        <div className={styles.specimen}>
          <div className={styles.specimenRow} aria-hidden="true">
            <span className={ui.pill} aria-current="page">All</span>
            <span className={ui.pill}>Active</span>
            <span className={ui.pill}>Inactive</span>
          </div>
          <p className={ui.meta}>Filter pills: the picked one in the accent.</p>
        </div>
        <div className={styles.specimen}>
          <div className={styles.specimenRow} aria-hidden="true">
            <span className={ui.chip}>● Active</span>
            <span className={ui.chip} data-quiet="true">○ Inactive</span>
            <span className={ui.chip}>✓ Done</span>
          </div>
          <p className={ui.meta}>Chips: a status is always a glyph and a word.</p>
        </div>
      </div>
    </Section>
  )
}

export function AutoStates() {
  return (
    <Section title={STATES_HEADING}>
      <ul className={styles.states}>
        {MASCOT_STATES.map((state) => (
          <li key={state} className={styles.state}>
            <Auto state={state} size={STILL_SIZE} still />
            <span className={styles.stateWord}>
              <span aria-hidden="true">{`${stateGlyph(state)} `}</span>
              {stateWord(state)}
            </span>
            <span className={ui.meta}>{state}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
