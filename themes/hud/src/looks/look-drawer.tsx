import { useRef } from 'react'

import { PRESETS } from '../lib/looks/presets'
import type { HudLook } from '../lib/looks/types'
import { DeleteConfirm, useDeleteQuestion } from './delete-confirm'
import styles from './drawer.module.css'
import type { KnobValues } from './editing'
import { AccentOptions, GroundOptions, NumberKnobs, SwitchKnobs, TypeOptions } from './look-knobs'
import { LooksRow } from './looks-row'

/**
 * The LOOK drawer of "Automatos Command HUD.dc.html", as the right-hand column of the /looks page: the looks row,
 * the eight knobs, then Save as new look and Reset (and Delete, for one of the user's own looks, which asks first).
 * Every control changes the active look at once, through the host, so the whole app follows, not only this page. Why
 * the host refused a change is said in its own words under the knobs. Once a look is deleted the focus goes to Save as
 * new look, which every look has, so it never drops to the page as Delete goes.
 */

export const DRAWER_LABEL = 'Edit the look'
export const SAVE_AS_LABEL = 'Save as new look'
export const RESET_LABEL = 'Reset'
export const DELETE_LABEL = 'Delete'
export const REFUSED_TITLE = "That didn't change the look."

export interface LookDrawerProps {
  readonly look: HudLook
  readonly saved: readonly HudLook[]
  readonly reducedMotion: boolean
  /** The active look is one of the user's own: it can be deleted. */
  readonly deletable: boolean
  /** Why the host refused the last change, in plain words; empty when it took it. */
  readonly errors: readonly string[]
  readonly onPick: (look: HudLook) => void
  readonly onChange: (values: Partial<KnobValues>) => void
  readonly onSaveAs: () => void
  readonly onReset: () => void
  readonly onDelete: () => void
}

function Refusal({ errors }: { readonly errors: readonly string[] }) {
  if (errors.length === 0) return null
  return (
    <div className={styles.errors} role="alert">
      <p className={styles.errorTitle}>{REFUSED_TITLE}</p>
      <ul className={styles.errorList}>
        {errors.map((error, index) => (
          <li key={`${index}-${error}`}>{error}</li>
        ))}
      </ul>
    </div>
  )
}

type ActionsProps = Pick<LookDrawerProps, 'look' | 'deletable' | 'onSaveAs' | 'onReset' | 'onDelete'>

function DrawerActions({ look, deletable, onSaveAs, onReset, onDelete }: ActionsProps) {
  const saveAs = useRef<HTMLButtonElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const question = useDeleteQuestion(look.id)
  const asking = deletable && question.open
  const keep = () => {
    question.close()
    deleteButton.current?.focus()
  }
  const remove = () => {
    question.close()
    saveAs.current?.focus()
    onDelete()
  }
  return (
    <>
      <div className={styles.actions}>
        <button ref={saveAs} type="button" className={styles.primary} onClick={onSaveAs}>
          {SAVE_AS_LABEL}
        </button>
        <button type="button" className={styles.secondary} onClick={onReset}>
          {RESET_LABEL}
        </button>
        {deletable && (
          <button ref={deleteButton} type="button" className={styles.secondary} aria-expanded={asking} onClick={question.ask}>
            {DELETE_LABEL}
          </button>
        )}
      </div>
      {asking && <DeleteConfirm name={look.name} onDelete={remove} onKeep={keep} />}
    </>
  )
}

export function LookDrawer(props: LookDrawerProps) {
  const { look, saved, reducedMotion, errors, onPick, onChange } = props
  return (
    <aside className={styles.drawer} aria-label={DRAWER_LABEL}>
      <LooksRow looks={[...PRESETS, ...saved]} activeId={look.id} onPick={onPick} />
      <AccentOptions look={look} onChange={onChange} />
      <GroundOptions look={look} onChange={onChange} />
      <TypeOptions look={look} onChange={onChange} />
      <NumberKnobs look={look} onChange={onChange} />
      <SwitchKnobs look={look} onChange={onChange} reducedMotion={reducedMotion} />
      <Refusal errors={errors} />
      <DrawerActions
        look={look}
        deletable={props.deletable}
        onSaveAs={props.onSaveAs}
        onReset={props.onReset}
        onDelete={props.onDelete}
      />
    </aside>
  )
}
