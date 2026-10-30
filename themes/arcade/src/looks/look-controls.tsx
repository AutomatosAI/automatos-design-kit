import { useId } from 'react'

import { KNOBS, type KnobName, type ThemeLook } from './spec'
import styles from './looks.module.css'
import ui from '../ui/ui.module.css'

/**
 * The Options screen's knob rows (the design's OPTIONS): one row for each knob, its name in the display face and its
 * choices as radio buttons drawn as pixel buttons, with a ▶ cursor beside the row that holds the focus. Each change
 * goes to the host at once, so the whole app repaints, not only this screen.
 */

export const KNOBS_LABEL = 'Options'

export interface KnobRowsProps {
  readonly look: ThemeLook
  readonly onChange: (knob: KnobName, key: string) => void
}

export function KnobRows({ look, onChange }: KnobRowsProps) {
  const group = useId()
  return (
    <div className={styles.rows}>
      {KNOBS.map((knob) => (
        <fieldset key={knob.name} className={styles.row}>
          <span className={styles.rowCursor} aria-hidden="true">
            ▶
          </span>
          <legend className={`${ui.label} ${styles.rowLabel}`}>{knob.label}</legend>
          <div className={styles.choices}>
            {knob.choices.map((choice) => (
              <label key={choice.key} className={styles.choice}>
                <input
                  type="radio"
                  className={styles.radio}
                  name={`${group}-${knob.name}`}
                  value={choice.key}
                  checked={look[knob.name] === choice.key}
                  onChange={() => onChange(knob.name, choice.key)}
                />
                <span className={styles.choiceFace}>{choice.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export interface SaveSlotsProps {
  readonly looks: readonly ThemeLook[]
  readonly activeId: string
  readonly onPick: (look: ThemeLook) => void
}

/** The looks to pick from: the five presets, then the person's saved looks. */
export function SaveSlots({ looks, activeId, onPick }: SaveSlotsProps) {
  return (
    <ul className={styles.slots}>
      {looks.map((look) => (
        <li key={look.id}>
          <button type="button" className={styles.slot} aria-pressed={look.id === activeId} onClick={() => onPick(look)}>
            <span className={styles.slotName}>{look.name}</span>
            <span className={styles.slotSub}>{look.sub}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
