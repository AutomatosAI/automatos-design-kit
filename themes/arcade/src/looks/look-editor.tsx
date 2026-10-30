import { useState } from 'react'
import { HostLink, LOOK_STYLE_HREF } from '@automatos/theme-sdk'

import { THEME_HEADING } from '../theme'
import { KnobRows, SaveSlots } from './look-controls'
import { LookPreview } from './look-preview'
import { done, failed, LookActions, LookImport, SaidLine, type Said } from './look-transfer'
import { PRESETS, resetOf, withChoice, type KnobName, type ThemeLook } from './spec'
import { useThemeLooks, type ThemeLooks } from './use-theme-looks'
import styles from './looks.module.css'
import ui from '../ui/ui.module.css'

/**
 * lookEditor@1, the host's /looks page under Arcade: the design's Options screen. The five knobs as rows of choices,
 * SAVE LOOK (keep the look as a new save slot) and RESET (the palette's preset as it ships), beside a live preview;
 * under them the save slots (the presets and the person's saved looks), with export, delete and import. Every change
 * goes through the SDK's looks area, so the host repaints the whole app at once. Until the person's looks have loaded
 * the screen shows its heading alone and is busy.
 */

export const EDITOR_HEADING = 'Options'
export const EDITOR_LEAD = 'Saved per person, per workspace.'
export const MOTION_NOTE = 'Under reduced motion, text speed is instant and sprites hold their first frame, whatever is chosen here.'
export const SPRITES_LINK = 'See the sprite gallery'
export const SLOTS = 'Save slots'
export const RESET = 'Reset'
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
  const reset = () => {
    const preset = resetOf(looks.look)
    const result = looks.pick(preset)
    onSaid(result.ok ? done(`Back to ${preset.name}.`) : failed(result.errors))
  }
  return (
    <>
      {!looks.available && <p className={ui.note}>{NO_RUNTIME}</p>}
      {looks.available && !looks.persisted && <p className={ui.note}>{NOT_KEPT}</p>}
      <div className={styles.columns}>
        <section className={`${ui.window} ${styles.options}`} aria-label={EDITOR_HEADING}>
          <KnobRows look={looks.look} onChange={change} />
          <p className={ui.note}>{MOTION_NOTE}</p>
          <div className={styles.actions}>
            <LookActions looks={looks} onSaid={onSaid} />
            <button type="button" className={ui.secondary} onClick={reset}>
              {RESET}
            </button>
          </div>
          <SaidLine said={said} />
        </section>
        <LookPreview look={looks.look} />
      </div>
      <section className={`${ui.window} ${styles.slotsWindow}`} aria-label={SLOTS}>
        <h2 className={ui.label}>{SLOTS}</h2>
        <SaveSlots looks={[...PRESETS, ...looks.saved]} activeId={looks.look.id} onPick={pick} />
        <LookImport looks={looks} onSaid={onSaid} />
      </section>
    </>
  )
}

export function LookEditor() {
  const looks = useThemeLooks()
  const [said, setSaid] = useState<Said | null>(null)
  return (
    <div className={styles.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={styles.header}>
        <h1 className={ui.title} tabIndex={-1} {...THEME_HEADING}>
          {EDITOR_HEADING}
        </h1>
        <p className={ui.note}>{EDITOR_LEAD}</p>
        {looks.loaded && (
          <HostLink href={LOOK_STYLE_HREF} className={styles.link}>
            {SPRITES_LINK}
          </HostLink>
        )}
      </header>
      {looks.loaded && <EditorBody looks={looks} said={said} onSaid={setSaid} />}
    </div>
  )
}
