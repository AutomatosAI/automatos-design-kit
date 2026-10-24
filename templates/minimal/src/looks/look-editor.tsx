import { HostLink, LOOK_STYLE_HREF } from '@automatos/theme-sdk'
import { useState } from 'react'

import { THEME_HEADING } from '../theme'
import { KnobPicker, LookPicker } from './look-controls'
import { failed, LookActions, LookImport, SaidLine, type Said } from './look-transfer'
import { PRESETS, withChoice, type KnobName, type ThemeLook } from './spec'
import { useThemeLooks, type ThemeLooks } from './use-theme-looks'
import styles from './looks.module.css'

/**
 * lookEditor@1, the host's /looks page under {{name}}: pick a look (a preset or one of yours), change any of its
 * knobs, keep it as a new look, delete, export or import one. Every change goes through the SDK's looks area, so the
 * host repaints the whole app at once. Until the user's looks have loaded the page shows its heading alone and is
 * busy, so it never shows the default look's choices in place of the user's own.
 */

export const EDITOR_HEADING = 'Make it yours'
export const EDITOR_LEAD = 'Pick a look, then change it. The whole app follows.'
export const STYLE_SHEET_LINK = 'See the style sheet'
export const NO_RUNTIME = "Looks aren't available here, so nothing you pick is kept."
export const NOT_KEPT = "This browser isn't keeping your looks: they last until you leave."

interface BodyProps {
  readonly looks: ThemeLooks
  readonly said: Said | null
  readonly onSaid: (said: Said | null) => void
}

function EditorBody({ looks, said, onSaid }: BodyProps) {
  const pick = (look: ThemeLook) => {
    const result = looks.pick(look)
    onSaid(result.ok ? null : failed(result.errors))
  }
  const change = (knob: KnobName, key: string) => pick(withChoice(looks.look, knob, key))
  return (
    <>
      {!looks.available && <p className={styles.note}>{NO_RUNTIME}</p>}
      {looks.available && !looks.persisted && <p className={styles.note}>{NOT_KEPT}</p>}
      <div className={styles.columns}>
        <div className={styles.main}>
          <LookPicker looks={[...PRESETS, ...looks.saved]} activeId={looks.look.id} onPick={pick} />
          <LookActions looks={looks} onSaid={onSaid} />
          <LookImport looks={looks} onSaid={onSaid} />
        </div>
        <KnobPicker look={looks.look} onChange={change} />
      </div>
      <SaidLine said={said} />
    </>
  )
}

export function LookEditor() {
  const looks = useThemeLooks()
  const [said, setSaid] = useState<Said | null>(null)
  return (
    <div className={styles.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={styles.header}>
        <h1 className={styles.heading} tabIndex={-1} {...THEME_HEADING}>
          {EDITOR_HEADING}
        </h1>
        <p className={styles.lead}>{EDITOR_LEAD}</p>
        {looks.loaded && (
          <HostLink href={LOOK_STYLE_HREF} className={styles.link}>
            {STYLE_SHEET_LINK}
          </HostLink>
        )}
      </header>
      {looks.loaded && <EditorBody looks={looks} said={said} onSaid={setSaid} />}
    </div>
  )
}
