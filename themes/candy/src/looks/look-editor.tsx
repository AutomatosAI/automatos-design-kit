import { HostLink, LOOK_STYLE_HREF } from '@automatos/theme-sdk'
import { useCallback, useEffect, useState } from 'react'

import { THEME_HEADING } from '../theme'
import { KnobRows } from './look-controls'
import { PresetCards, PRESETS_HEADING, SavedLooks } from './look-presets'
import { LookPreview } from './look-preview'
import { done, failed, LookFoot, resetActive, saveActive, SaidLine, type Said } from './look-transfer'
import { withValue, type KnobName, type ThemeLook } from './spec'
import { useThemeLooks, type ThemeLooks } from './use-theme-looks'
import styles from './looks.module.css'
import ui from '../ui/ui.module.css'

/**
 * lookEditor@1, the host's /looks page under Candy (the design's W5, "Your look"): on the left the three presets,
 * the user's saved looks, a row for each knob and the foot's Save look, Reset, Export and Import; on the right a live
 * preview. Every change goes through the SDK's looks area, so the host repaints the whole app at once, the preview
 * with it. After Save look the button says so and Auto celebrates in the preview for a moment. Until the user's
 * looks have loaded the page shows its heading alone and is busy, so it never shows the default look's choices in
 * place of the user's own. Below 1024 px (or in a narrow column) the preview sits under the controls.
 */

export const EDITOR_HEADING = 'Your look'
export const EDITOR_REGION = 'Edit your look'
export const STYLE_SHEET_LINK = 'Style sheet'
export const NO_RUNTIME = "Looks aren't available here, so nothing you pick is kept."
export const NOT_KEPT = "This browser isn't keeping your looks: they last until you leave."
/** How long Auto celebrates a save: one of his one-shots. */
export const CELEBRATE_MS = 2400

interface Celebration {
  readonly on: boolean
  readonly start: () => void
  readonly stop: () => void
}

/** Auto's celebration after a save: on for CELEBRATE_MS from the latest save, off at once on any other change. */
function useCelebration(): Celebration {
  const [round, setRound] = useState<number | null>(null)
  useEffect(() => {
    if (round === null) return undefined
    const timer = window.setTimeout(() => setRound(null), CELEBRATE_MS)
    return () => window.clearTimeout(timer)
  }, [round])
  const start = useCallback(() => setRound((was) => (was ?? 0) + 1), [])
  const stop = useCallback(() => setRound(null), [])
  return { on: round !== null, start, stop }
}

/** What each control does to the looks, with its words for the status line. */
function useEditorActions(looks: ThemeLooks, onSaid: (said: Said | null) => void) {
  const celebration = useCelebration()
  const pick = (look: ThemeLook) => {
    celebration.stop()
    const result = looks.pick(look)
    onSaid(result.ok ? null : failed(result.errors))
  }
  const save = () => {
    const said = saveActive(looks)
    onSaid(said)
    if (said.kind === 'done') celebration.start()
  }
  const reset = () => {
    celebration.stop()
    onSaid(resetActive(looks))
  }
  const rename = (look: ThemeLook, name: string): boolean => {
    const result = looks.rename(look.id, name)
    onSaid(result.ok ? done(`Renamed to ${result.look.name}.`) : failed(result.errors))
    return result.ok
  }
  const remove = (look: ThemeLook) => {
    celebration.stop()
    looks.remove(look.id)
    onSaid(done(`Deleted ${look.name}.`))
  }
  const change = (knob: KnobName, value: string | number) => pick(withValue(looks.look, knob, value))
  return { celebrating: celebration.on, pick, save, reset, rename, remove, change }
}

interface BodyProps {
  readonly looks: ThemeLooks
  readonly said: Said | null
  readonly onSaid: (said: Said | null) => void
}

function EditorBody({ looks, said, onSaid }: BodyProps) {
  const actions = useEditorActions(looks, onSaid)
  return (
    <>
      {!looks.available && <p className={styles.notice}>{NO_RUNTIME}</p>}
      {looks.available && !looks.persisted && <p className={styles.notice}>{NOT_KEPT}</p>}
      <div className={styles.columns}>
        <section className={`${ui.window} ${styles.editor}`} aria-label={EDITOR_REGION}>
          <h2 className={ui.sectionTitle}>{PRESETS_HEADING}</h2>
          <PresetCards palette={looks.look.palette} onPick={actions.pick} />
          <SavedLooks saved={looks.saved} activeId={looks.look.id} onPick={actions.pick} onRename={actions.rename} onDelete={actions.remove} />
          <KnobRows look={looks.look} onChange={actions.change} />
          <LookFoot looks={looks} celebrating={actions.celebrating} onSave={actions.save} onReset={actions.reset} onSaid={onSaid} />
          <SaidLine said={said} />
        </section>
        <LookPreview celebrating={actions.celebrating} />
      </div>
    </>
  )
}

export function LookEditor() {
  const looks = useThemeLooks()
  const [said, setSaid] = useState<Said | null>(null)
  return (
    <div className={styles.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={ui.pageHead}>
        <h1 className={`${ui.pageTitle} ${styles.heading}`} tabIndex={-1} {...THEME_HEADING}>
          {EDITOR_HEADING}
        </h1>
        {looks.loaded && (
          <HostLink href={LOOK_STYLE_HREF} className={`${ui.secondary} ${ui.small}`}>
            {STYLE_SHEET_LINK}
          </HostLink>
        )}
      </header>
      {looks.loaded && <EditorBody looks={looks} said={said} onSaid={setSaid} />}
    </div>
  )
}
