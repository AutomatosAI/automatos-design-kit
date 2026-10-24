import { useId, useState } from 'react'

import styles from './drawer.module.css'

/**
 * The question Delete asks before a saved look goes: a saved look is the user's own data and a delete can't be
 * undone, so the drawer asks first, with Delete look and Keep it. Keep it, the safe choice, takes the focus as the
 * question opens, so it is read out with it (after themes/play/src/components/looks/look-manage-forms.tsx, Play
 * 1.1.1). The question is about one look: it closes by itself once another look is the active one.
 */

export const DELETE_LOOK_LABEL = 'Delete look'
export const KEEP_IT_LABEL = 'Keep it'

export const deleteQuestion = (name: string): string =>
  `Delete ${name}? This can't be undone. Export it first to keep a copy.`

/** Whether the question is open for the active look, and the two ways to open and close it. */
export function useDeleteQuestion(lookId: string) {
  const [open, setOpen] = useState(false)
  const [askedFor, setAskedFor] = useState(lookId)
  // Another look is the active one: the question about the last one goes (React's reset while rendering).
  if (askedFor !== lookId) {
    setAskedFor(lookId)
    setOpen(false)
  }
  return { open, ask: () => setOpen(true), close: () => setOpen(false) }
}

export interface DeleteConfirmProps {
  readonly name: string
  readonly onDelete: () => void
  readonly onKeep: () => void
}

export function DeleteConfirm({ name, onDelete, onKeep }: DeleteConfirmProps) {
  const textId = useId()
  return (
    <div className={styles.confirm} role="group" aria-labelledby={textId}>
      <p id={textId} className={styles.confirmText}>
        {deleteQuestion(name)}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.danger} onClick={onDelete}>
          {DELETE_LOOK_LABEL}
        </button>
        <button type="button" className={styles.secondary} onClick={onKeep} autoFocus>
          {KEEP_IT_LABEL}
        </button>
      </div>
    </div>
  )
}
