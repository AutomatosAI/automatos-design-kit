import { useId } from 'react'

import { useLook } from '@automatos/theme-sdk'

import { Panel } from '../components/panel'
import { PRESETS } from '../lib/looks/presets'
import { THEME_HEADING } from '../theme'
import styles from './placeholder.module.css'

/**
 * lookEditor@1, the host's /looks page: for now the five presets, each made the active look with a press (the
 * SDK's setLook, which the host checks against looks/schema.json and then paints). A stand-in: the Looks drawer
 * of "Automatos Command HUD.dc.html" replaces it in this module, under the same name, HudLookEditor, which
 * src/entry.ts registers.
 */

export const LOOK_EDITOR_TITLE = 'Look'

export function HudLookEditor() {
  const headingId = useId()
  const { available, look, setLook } = useLook()
  return (
    <section className={styles.screen} aria-labelledby={headingId}>
      <h1 id={headingId} className={styles.heading} tabIndex={-1} {...THEME_HEADING}>
        {LOOK_EDITOR_TITLE}
      </h1>
      <Panel title="Presets">
        <ul className={styles.choices}>
          {PRESETS.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                className={styles.choice}
                aria-pressed={look?.id === preset.id}
                disabled={!available}
                onClick={() => setLook(preset)}
              >
                {preset.name}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  )
}
