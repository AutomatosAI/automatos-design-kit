import { useId, type CSSProperties } from 'react'

import { useMotion } from '../motion/use-motion'
import { CARD_SETS, paletteById } from './catalogue'
import { clampKnob, GRADIENT_NOTES, KNOBS, sliderKey, type ChoiceKnob, type Knob, type KnobName, type NumberKnob, type ThemeLook } from './spec'
import styles from './looks.module.css'

/**
 * The look editor's knob rows (the design's W5): the knob's name on the left, its control on the right. Palette is
 * three round swatches, each its palette's first two card colours; Card colours and Gradient are segmented pills
 * (Gradient with its note beside it); Roundness and Glow are sliders with their value; Motion is a switch, which
 * under the system's Reduce Motion is off and can't be changed, since nothing moves then anyway. Every change goes to
 * the host at once, so the whole app repaints, not only this page.
 */

export const MOTION_ON = 'On · Auto floats and blinks'
export const MOTION_PAUSED = 'Paused · everything still'
export const MOTION_REDUCED = 'Motion off · Reduce Motion'

export type KnobChange = (knob: KnobName, value: string | number) => void

export interface KnobRowsProps {
  readonly look: ThemeLook
  readonly onChange: KnobChange
}

interface ControlProps<K extends Knob> {
  readonly knob: K
  readonly labelId: string
  readonly onChange: KnobChange
}

/** A palette's swatch as custom properties: its first two card colours' starts, from the catalogue. */
function swatchColours(paletteId: string): CSSProperties {
  const palette = paletteById(paletteId)
  if (palette === undefined) return {}
  return { '--candy-swatch-a': CARD_SETS[palette.order[0]].a, '--candy-swatch-b': CARD_SETS[palette.order[1]].a } as CSSProperties
}

function PaletteSwatches({ knob, value, labelId, onChange }: ControlProps<ChoiceKnob> & { readonly value: string }) {
  const group = useId()
  return (
    <div role="radiogroup" aria-labelledby={labelId} className={styles.swatches}>
      {knob.choices.map((choice) => (
        <label key={choice.key} className={styles.swatch} title={choice.label}>
          <input
            type="radio"
            className={styles.hiddenInput}
            name={group}
            value={choice.key}
            aria-label={choice.label}
            checked={value === choice.key}
            onChange={() => onChange(knob.name, choice.key)}
          />
          <span className={styles.swatchFace} style={swatchColours(choice.key)} aria-hidden="true" />
        </label>
      ))}
    </div>
  )
}

interface SegmentedProps extends ControlProps<ChoiceKnob> {
  readonly value: string
  readonly describedBy?: string
}

function Segmented({ knob, value, labelId, describedBy, onChange }: SegmentedProps) {
  const group = useId()
  return (
    <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} className={styles.segmented}>
      {knob.choices.map((choice) => (
        <label key={choice.key} className={styles.segment}>
          <input
            type="radio"
            className={styles.hiddenInput}
            name={group}
            value={choice.key}
            checked={value === choice.key}
            onChange={() => onChange(knob.name, choice.key)}
          />
          <span className={styles.segmentFace}>{choice.label}</span>
        </label>
      ))}
    </div>
  )
}

function GradientControl({ knob, value, labelId, onChange }: ControlProps<ChoiceKnob> & { readonly value: string }) {
  const noteId = useId()
  return (
    <div className={styles.control}>
      <Segmented knob={knob} value={value} labelId={labelId} describedBy={noteId} onChange={onChange} />
      <span id={noteId} className={styles.note}>
        {GRADIENT_NOTES[value] ?? ''}
      </span>
    </div>
  )
}

interface Range {
  readonly min: number
  readonly max: number
  readonly unit: string
}

interface SliderProps {
  readonly range: Range
  readonly value: number
  readonly labelId: string
  readonly onSlide: (value: number) => void
}

/** A range input over whole numbers, its value said with its unit. */
function Slider({ range, value, labelId, onSlide }: SliderProps) {
  const shown = range.unit === '' ? String(value) : `${value} ${range.unit}`
  return (
    <div className={styles.control}>
      <input
        type="range"
        className={styles.slider}
        min={range.min}
        max={range.max}
        step={1}
        value={value}
        aria-labelledby={labelId}
        aria-valuetext={shown}
        onChange={(event) => onSlide(Number(event.target.value))}
      />
      <span className={styles.sliderValue} aria-hidden="true">
        {shown}
      </span>
    </div>
  )
}

function motionWords(reduced: boolean, on: boolean): string {
  if (reduced) return MOTION_REDUCED
  return on ? MOTION_ON : MOTION_PAUSED
}

function MotionSwitch({ knob, value, labelId, onChange }: ControlProps<ChoiceKnob> & { readonly value: string }) {
  const { reduced } = useMotion()
  const wordsId = useId()
  const on = !reduced && value === 'on'
  return (
    <div className={styles.control}>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={wordsId}
        disabled={reduced}
        onClick={() => onChange(knob.name, on ? 'paused' : 'on')}
      >
        <span className={styles.switchKnob} aria-hidden="true" />
      </button>
      <span id={wordsId} className={styles.note}>
        {motionWords(reduced, on)}
      </span>
    </div>
  )
}

/** A number knob's slider (Glow), its value clamped to the knob. */
function NumberSlider({ knob, value, labelId, onChange }: ControlProps<NumberKnob> & { readonly value: number }) {
  const onSlide = (next: number) => onChange(knob.name, clampKnob(knob, next))
  return <Slider range={knob} value={value} labelId={labelId} onSlide={onSlide} />
}

/** A choice knob of whole numbers drawn as a slider (Roundness): the position is written as its choice's key. */
function ChoiceSlider({ knob, value, labelId, onChange }: ControlProps<ChoiceKnob> & { readonly value: string }) {
  const range = knob.slider as Range
  const onSlide = (next: number) => onChange(knob.name, sliderKey(knob, next))
  const position = Number(value)
  return <Slider range={range} value={Number.isFinite(position) ? position : Number(knob.default)} labelId={labelId} onSlide={onSlide} />
}

function KnobControl({ knob, look, labelId, onChange }: ControlProps<Knob> & { readonly look: ThemeLook }) {
  if (knob.kind === 'number') return <NumberSlider knob={knob} value={look[knob.name]} labelId={labelId} onChange={onChange} />
  const props = { knob, value: look[knob.name], labelId, onChange }
  if (knob.slider !== undefined) return <ChoiceSlider {...props} />
  if (knob.name === 'palette') return <PaletteSwatches {...props} />
  if (knob.name === 'gradient') return <GradientControl {...props} />
  if (knob.name === 'motion') return <MotionSwitch {...props} />
  return <Segmented {...props} />
}

function KnobRow({ knob, look, onChange }: { readonly knob: Knob; readonly look: ThemeLook; readonly onChange: KnobChange }) {
  const labelId = useId()
  return (
    <div className={styles.row}>
      <span id={labelId} className={styles.rowLabel}>
        {knob.label}
      </span>
      <KnobControl knob={knob} look={look} labelId={labelId} onChange={onChange} />
    </div>
  )
}

export function KnobRows({ look, onChange }: KnobRowsProps) {
  return (
    <div className={styles.rows}>
      {KNOBS.map((knob) => (
        <KnobRow key={knob.name} knob={knob} look={look} onChange={onChange} />
      ))}
    </div>
  )
}
