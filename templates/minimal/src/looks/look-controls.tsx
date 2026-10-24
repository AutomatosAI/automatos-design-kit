import { useId } from 'react'

import { KNOBS, type KnobName, type ThemeLook } from './spec'
import styles from './looks.module.css'

/**
 * The look editor's two pickers: the looks (the presets, then the user's saved looks), and one group of choices for
 * each knob of the active look. Each change goes to the host at once, so the whole app repaints, not only this page.
 */

export const LOOKS_LABEL = 'Looks'
export const KNOBS_LABEL = 'Edit the look'

export interface LookPickerProps {
  readonly looks: readonly ThemeLook[]
  readonly activeId: string
  readonly onPick: (look: ThemeLook) => void
}

export function LookPicker({ looks, activeId, onPick }: LookPickerProps) {
  const headingId = useId()
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.label}>
        {LOOKS_LABEL}
      </h2>
      <ul className={styles.looks}>
        {looks.map((look) => (
          <li key={look.id}>
            <button
              type="button"
              className={styles.look}
              aria-pressed={look.id === activeId}
              onClick={() => onPick(look)}
            >
              <span className={styles.lookName}>{look.name}</span>
              <span className={styles.lookSub}>{look.sub}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export interface KnobPickerProps {
  readonly look: ThemeLook
  readonly onChange: (knob: KnobName, key: string) => void
}

export function KnobPicker({ look, onChange }: KnobPickerProps) {
  const groupId = useId()
  return (
    <section className={styles.section} aria-label={KNOBS_LABEL}>
      {KNOBS.map((knob) => (
        <fieldset key={knob.name} className={styles.knob}>
          <legend className={styles.label}>{knob.label}</legend>
          <div className={styles.choices}>
            {knob.choices.map((choice) => (
              <label key={choice.key} className={styles.choice}>
                <input
                  type="radio"
                  name={`${groupId}-${knob.name}`}
                  value={choice.key}
                  checked={look[knob.name] === choice.key}
                  onChange={() => onChange(knob.name, choice.key)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </section>
  )
}
