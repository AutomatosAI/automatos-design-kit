import { exportLook, importLook, type HostLookResult } from '@automatos/theme-sdk'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { downloadText } from './download'
import { asNewLook, resetOf, type ThemeLook } from './spec'
import type { ThemeLooks } from './use-theme-looks'
import styles from './looks.module.css'
import ui from '../ui/ui.module.css'

/**
 * What the look editor does with a whole look, along its foot: Save look (the active look kept as a new saved look,
 * or over itself when it is already one of the user's), Reset (the palette's preset as it ships), Export (a
 * .look.json file) and Import (a look pasted as text, in a small box that opens under the buttons). The host checks
 * every look first (the SDK's saveLook, exportLook and importLook); a refusal is shown in its own words, never thrown.
 */

export const SAVE_LOOK = 'Save look'
export const SAVED = 'Saved ✓'
export const RESET = 'Reset'
export const EXPORT_LOOK = 'Export'
export const IMPORT_LOOK = 'Import'
export const IMPORT_LABEL = "Paste a look's JSON"
export const ADD_LOOK = 'Add this look'
export const NOT_DONE = "That didn't work."

/** What the last action did, in words: a status for a success, an alert for a refusal. */
export interface Said {
  readonly kind: 'done' | 'failed'
  readonly text: string
  readonly errors: readonly string[]
}

export const done = (text: string): Said => ({ kind: 'done', text, errors: [] })
export const failed = (errors: readonly string[]): Said => ({ kind: 'failed', text: NOT_DONE, errors })

/** A kept look made active, in words. */
function kept(looks: ThemeLooks, result: HostLookResult, words: (look: ThemeLook) => string): Said {
  if (!result.ok) return failed(result.errors)
  const look = result.look as ThemeLook
  const picked = looks.pick(look)
  return picked.ok ? done(words(look)) : failed(picked.errors)
}

/** Save look: a preset (or any look not yet the user's) becomes a new saved look; a saved one is saved over. */
export function saveActive(looks: ThemeLooks): Said {
  const mine = looks.saved.some((entry) => entry.id === looks.look.id)
  const target = mine ? looks.look : asNewLook(looks.look, looks.saved)
  return kept(looks, looks.keep(target), (made) => (mine ? `Saved ${made.name}.` : `Saved as ${made.name}.`))
}

/** Reset: the active palette's preset, as it ships. */
export function resetActive(looks: ThemeLooks): Said {
  const preset = resetOf(looks.look)
  const result = looks.pick(preset)
  return result.ok ? done(`Back to ${preset.name}.`) : failed(result.errors)
}

function exported(look: ThemeLook): Said {
  const file = exportLook(look)
  if (file === null) return failed([`${look.name} can't be exported: it doesn't pass the theme's look checks.`])
  downloadText(file.fileName, file.text, file.type)
  return done(`The download of ${file.fileName} has started.`)
}

interface PasteBoxProps {
  readonly id: string
  readonly looks: ThemeLooks
  readonly onSaid: (said: Said) => void
  readonly onAdded: () => void
}

function PasteBox({ id, looks, onSaid, onAdded }: PasteBoxProps) {
  const [text, setText] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  useEffect(() => field.current?.focus(), [])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const imported = importLook(text)
    const said = kept(looks, imported.ok ? looks.keep(imported.look as ThemeLook) : imported, (made) => `Added ${made.name}.`)
    onSaid(said)
    if (said.kind === 'done') onAdded()
  }
  return (
    <form id={id} className={styles.pasteBox} onSubmit={submit}>
      <label htmlFor={fieldId} className={styles.pasteLabel}>
        {IMPORT_LABEL}
      </label>
      <textarea id={fieldId} ref={field} className={styles.paste} value={text} onChange={(event) => setText(event.target.value)} rows={4} spellCheck={false} />
      <div className={styles.pasteActions}>
        <button type="submit" className={`${ui.button} ${ui.small}`}>
          {ADD_LOOK}
        </button>
      </div>
    </form>
  )
}

export interface LookFootProps {
  readonly looks: ThemeLooks
  /** Auto is celebrating a save: the button says so. */
  readonly celebrating: boolean
  readonly onSave: () => void
  readonly onReset: () => void
  readonly onSaid: (said: Said) => void
}

export function LookFoot({ looks, celebrating, onSave, onReset, onSaid }: LookFootProps) {
  const [importing, setImporting] = useState(false)
  const importButton = useRef<HTMLButtonElement>(null)
  const boxId = useId()
  const added = () => {
    setImporting(false)
    importButton.current?.focus()
  }
  return (
    <>
      <div className={styles.foot}>
        <button type="button" className={ui.button} onClick={onSave}>
          {celebrating ? SAVED : SAVE_LOOK}
        </button>
        <button type="button" className={`${ui.secondary} ${styles.outlined}`} onClick={onReset}>
          {RESET}
        </button>
        <span className={styles.footGap} />
        <button type="button" className={ui.quiet} onClick={() => onSaid(exported(looks.look))}>
          {EXPORT_LOOK}
        </button>
        <button
          ref={importButton}
          type="button"
          className={ui.quiet}
          aria-expanded={importing}
          aria-controls={importing ? boxId : undefined}
          onClick={() => setImporting((open) => !open)}
        >
          {IMPORT_LOOK}
        </button>
      </div>
      {importing && <PasteBox id={boxId} looks={looks} onSaid={onSaid} onAdded={added} />}
    </>
  )
}

/** The last action's words: a polite status that is always there, or an alert listing the host's reasons. */
export function SaidLine({ said }: { readonly said: Said | null }) {
  return (
    <>
      <p className={styles.status} role="status">
        {said?.kind === 'done' ? said.text : ''}
      </p>
      {said?.kind === 'failed' && (
        <div className={styles.alert} role="alert">
          <p className={styles.alertTitle}>{said.text}</p>
          <ul className={styles.alertList}>
            {said.errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
