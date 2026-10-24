import { useState } from 'react'

import { HostLink, LOOK_STYLE_HREF } from '@automatos/theme-sdk'

import type { HudLook } from '../lib/looks/types'
import { THEME_HEADING } from '../theme'
import { asNewLook, isSavedLook, resetTarget, statusLine, withValues, type KnobValues } from './editing'
import { LookDrawer } from './look-drawer'
import { LookPreview } from './look-preview'
import { LookShare } from './look-share'
import styles from './screen.module.css'
import { keptLook, useHudLooks, type HudLooks } from './use-hud-looks'

/**
 * HUD's /looks page (the host's lookEditor@1 slot): the LOOK drawer of "Automatos Command HUD.dc.html" beside a
 * live preview, under the page's heading and the active look's status ('ARC', or 'ARC · edited'). Every change goes
 * through the SDK's looks area, so the host repaints the whole app at once, this page included; nothing is kept in
 * the browser by HUD itself. Until the user's looks have been read the page shows its heading alone and is busy, so
 * it never shows ARC's choices in place of the user's own look.
 */

export const LOOK_TITLE = 'Look'
export const LOOK_LEAD = 'Pick a look, then tune it. Every page follows at once.'
export const STYLE_SHEET_LINK = 'See the style sheet'
export const NO_RUNTIME = "Looks aren't available here, so nothing you pick is kept."
export const NOT_KEPT = "This browser isn't keeping your looks: they last until you leave."

/** The drawer's actions on the active look, and why the host refused the last one. */
function useLookActions(looks: HudLooks) {
  const [errors, setErrors] = useState<readonly string[]>([])
  const apply = (next: HudLook): void => {
    const result = looks.pick(next)
    setErrors(result.ok ? [] : result.errors)
  }
  const change = (values: Partial<KnobValues>) => apply(withValues(looks.look, values))
  const saveAsNew = () => {
    const result = looks.keep(asNewLook(looks.look, looks.saved))
    if (result.ok) {
      apply(keptLook(result))
      return
    }
    console.warn('[looks] Save as new look was refused:', result.errors)
    setErrors(result.errors)
  }
  const reset = () => apply(resetTarget(looks.look, looks.saved))
  const remove = () => {
    setErrors([])
    looks.remove(looks.look.id)
  }
  return { errors, apply, change, saveAsNew, reset, remove }
}

function Notes({ looks }: { readonly looks: HudLooks }) {
  if (!looks.available) return <p className={styles.note}>{NO_RUNTIME}</p>
  if (!looks.persisted) return <p className={styles.note}>{NOT_KEPT}</p>
  return null
}

function LookBody({ looks }: { readonly looks: HudLooks }) {
  const actions = useLookActions(looks)
  return (
    <>
      <Notes looks={looks} />
      <div className={styles.columns}>
        <div className={styles.main}>
          <LookPreview look={looks.look} reducedMotion={looks.reducedMotion} />
          <LookShare looks={looks} />
        </div>
        <LookDrawer
          look={looks.look}
          saved={looks.saved}
          reducedMotion={looks.reducedMotion}
          deletable={isSavedLook(looks.look, looks.saved)}
          errors={actions.errors}
          onPick={actions.apply}
          onChange={actions.change}
          onSaveAs={actions.saveAsNew}
          onReset={actions.reset}
          onDelete={actions.remove}
        />
      </div>
    </>
  )
}

export function LookScreen() {
  const looks = useHudLooks()
  return (
    <div className={styles.screen} aria-busy={looks.loaded ? undefined : true}>
      <header className={styles.header}>
        <div className={styles.headingText}>
          <h1 className={styles.heading} tabIndex={-1} {...THEME_HEADING}>
            {LOOK_TITLE}
          </h1>
          <p className={styles.lead}>{LOOK_LEAD}</p>
        </div>
        {looks.loaded && (
          <div className={styles.headerSide}>
            <p className={styles.status} role="status">
              {statusLine(looks.look, looks.saved)}
            </p>
            <HostLink href={LOOK_STYLE_HREF} className={styles.link}>
              {STYLE_SHEET_LINK}
            </HostLink>
          </div>
        )}
      </header>
      {looks.loaded && <LookBody looks={looks} />}
    </div>
  )
}
