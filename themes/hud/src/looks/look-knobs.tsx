import { useId, type CSSProperties, type ReactNode } from 'react'

import { ACCENTS, ACCENT_KEYS, FONTS, FONT_KEYS, GROUNDS, GROUND_KEYS } from '../lib/looks/catalogue'
import { KNOB_LABELS } from '../lib/looks/spec'
import { GLOW_MAX, GLOW_MIN, GRID_MAX, GRID_MIN, SWITCH_KNOBS, type HudLook, type Switch, type SwitchKnobName } from '../lib/looks/types'
import styles from './drawer.module.css'
import { clampKnob, flipped, glowCap, type KnobValues } from './editing'

/**
 * The LOOK drawer's eight knobs ("Automatos Command HUD.dc.html"): the accent's swatches, the four backgrounds, the
 * three type styles, the grid and glow sliders, and the scan, Auto and motion switches. Each option is a toggle
 * button (aria-pressed) named by its catalogue entry, each group named by its visible label; each change goes to
 * the host at once (onChange), which repaints the whole app. A swatch is drawn in the catalogue's own colour, set
 * on it as --hud-swatch, the one colour these controls name; everything else is the look's variables.
 */

export const REDUCED_MOTION_NOTE = 'Your device asks for reduced motion, so nothing moves, whatever Motion says.'
/** Under the glow slider while the look's glow is past what its background and accent keep readable, in plain words. */
export const glowCapNote = (cap: number): string => `Held at ${cap} here so text stays easy to read.`
/** The glow slider's value in words while it is capped: '30, held at 29'. */
export const cappedGlowText = (glow: number, cap: number): string => `${glow}, held at ${cap}`

export interface KnobProps {
  readonly look: HudLook
  readonly onChange: (values: Partial<KnobValues>) => void
}

type SwatchStyle = CSSProperties & { readonly '--hud-swatch': string }

/** A catalogue colour on a swatch, as the --hud-swatch its stylesheet draws with. */
export function swatchStyle(colour: string): SwatchStyle {
  return { '--hud-swatch': colour }
}

function OptionGroup({ label, layout, children }: { readonly label: string; readonly layout: string; readonly children: ReactNode }) {
  const labelId = useId()
  return (
    <div className={styles.section} role="group" aria-labelledby={labelId}>
      <p id={labelId} className={styles.label}>
        {label}
      </p>
      <div className={layout}>{children}</div>
    </div>
  )
}

export function AccentOptions({ look, onChange }: KnobProps) {
  return (
    <OptionGroup label={`${KNOB_LABELS.accent} · ${ACCENTS[look.accent].name}`} layout={styles.swatches}>
      {ACCENT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.swatch}
          aria-label={ACCENTS[key].name}
          aria-pressed={key === look.accent}
          onClick={() => onChange({ accent: key })}
        >
          <span className={styles.swatchDot} style={swatchStyle(ACCENTS[key].hex)} aria-hidden="true" />
        </button>
      ))}
    </OptionGroup>
  )
}

export function GroundOptions({ look, onChange }: KnobProps) {
  return (
    <OptionGroup label={KNOB_LABELS.ground} layout={styles.grounds}>
      {GROUND_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.option}
          aria-pressed={key === look.ground}
          onClick={() => onChange({ ground: key })}
        >
          <span className={styles.groundChip} style={swatchStyle(GROUNDS[key].bg)} aria-hidden="true" />
          {GROUNDS[key].name}
        </button>
      ))}
    </OptionGroup>
  )
}

/** Each type style is set in its own face and weight. */
export function TypeOptions({ look, onChange }: KnobProps) {
  return (
    <OptionGroup label={KNOB_LABELS.font} layout={styles.types}>
      {FONT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.typeOption}
          style={{ fontFamily: FONTS[key].family, fontWeight: FONTS[key].weight }}
          aria-pressed={key === look.font}
          onClick={() => onChange({ font: key })}
        >
          {FONTS[key].name}
        </button>
      ))}
    </OptionGroup>
  )
}

interface SliderProps {
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  readonly onChange: (value: number) => void
  /** What the slider's value means when the number alone doesn't say it. */
  readonly valueText?: string
  readonly hint?: string
}

/** A whole number from `min` to `max`, its value shown beside its label (a screen reader hears the slider's own). */
function KnobSlider({ label, value, min, max, onChange, valueText, hint }: SliderProps) {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className={styles.section}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
        <span className={styles.label} aria-hidden="true">
          {value}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={valueText}
        aria-describedby={hint === undefined ? undefined : hintId}
        onChange={(event) => onChange(clampKnob(Number(event.target.value), min, max))}
      />
      {hint !== undefined && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * The grid, 0 to 30, and the glow, 0 to 40: the ranges of looks/schema.json, which the phone's HUD layout reads too.
 * The page never paints a glow past what the look's background and accent keep readable at AA (the first paint's
 * cap), so past that point the slider says what is painted instead.
 */
export function NumberKnobs({ look, onChange }: KnobProps) {
  const glow = clampKnob(look.glow, GLOW_MIN, GLOW_MAX)
  const cap = glowCap(look)
  const capped = glow > cap
  return (
    <>
      <KnobSlider
        label={KNOB_LABELS.grid}
        value={clampKnob(look.grid, GRID_MIN, GRID_MAX)}
        min={GRID_MIN}
        max={GRID_MAX}
        onChange={(grid) => onChange({ grid })}
      />
      <KnobSlider
        label={KNOB_LABELS.glow}
        value={glow}
        min={GLOW_MIN}
        max={GLOW_MAX}
        onChange={(next) => onChange({ glow: next })}
        valueText={capped ? cappedGlowText(glow, cap) : undefined}
        hint={capped ? glowCapNote(cap) : undefined}
      />
    </>
  )
}

function switchValues(knob: SwitchKnobName, value: Switch): Partial<KnobValues> {
  if (knob === 'scan') return { scan: value }
  if (knob === 'auto') return { auto: value }
  return { motion: value }
}

/** Scan, Auto and Motion: each a toggle named by its knob, its state the pressed state and a word beside it. */
export function SwitchKnobs({ look, onChange, reducedMotion }: KnobProps & { readonly reducedMotion: boolean }) {
  const noteId = useId()
  return (
    <div className={styles.section}>
      <div className={styles.switches}>
        {SWITCH_KNOBS.map((knob) => (
          <button
            key={knob}
            type="button"
            className={styles.switch}
            aria-pressed={look[knob] === 'on'}
            aria-describedby={knob === 'motion' && reducedMotion ? noteId : undefined}
            onClick={() => onChange(switchValues(knob, flipped(look[knob])))}
          >
            <span>{KNOB_LABELS[knob]}</span>{' '}
            <span className={styles.switchState} aria-hidden="true">
              {look[knob]}
            </span>
          </button>
        ))}
      </div>
      {reducedMotion && (
        <p id={noteId} className={styles.hint}>
          {REDUCED_MOTION_NOTE}
        </p>
      )}
    </div>
  )
}
