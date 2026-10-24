import { exportLook, importLook, type HostLookResult } from '@automatos/theme-sdk'
import { useId, useState, type FormEvent } from 'react'

import { downloadText } from './download'
import { asNewLook, isPreset, type ThemeLook } from './spec'
import type { ThemeLooks } from './use-theme-looks'
import styles from './looks.module.css'

/**
 * What the look editor does with a whole look: keep the active one as a new saved look, delete a saved one, export
 * it as a .look.json file, and import one pasted as text. The host checks every look first (the SDK's saveLook,
 * exportLook and importLook); a refusal is shown in its own words, never thrown.
 */

export const SAVE_AS_NEW = 'Save as a new look'
export const DELETE_LOOK = 'Delete this look'
export const EXPORT_LOOK = 'Export'
export const IMPORT_LABEL = "Paste a look's JSON"
export const IMPORT_LOOK = 'Import'
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

function exported(look: ThemeLook): Said {
  const file = exportLook(look)
  if (file === null) return failed([`${look.name} can't be exported: it doesn't pass the theme's look checks.`])
  downloadText(file.fileName, file.text, file.type)
  return done(`The download of ${file.fileName} has started.`)
}

export interface LookTransferProps {
  readonly looks: ThemeLooks
  readonly onSaid: (said: Said) => void
}

export function LookActions({ looks, onSaid }: LookTransferProps) {
  const { look } = looks
  const saveAsNew = () => onSaid(kept(looks, looks.keep(asNewLook(look, looks.saved)), (made) => `Saved ${made.name}.`))
  const remove = () => {
    looks.remove(look.id)
    onSaid(done(`Deleted ${look.name}.`))
  }
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.primary} onClick={saveAsNew}>
        {SAVE_AS_NEW}
      </button>
      {!isPreset(look.id) && (
        <button type="button" className={styles.secondary} onClick={remove}>
          {DELETE_LOOK}
        </button>
      )}
      <button type="button" className={styles.secondary} onClick={() => onSaid(exported(look))}>
        {EXPORT_LOOK}
      </button>
    </div>
  )
}

export function LookImport({ looks, onSaid }: LookTransferProps) {
  const [text, setText] = useState('')
  const fieldId = useId()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const imported = importLook(text)
    const said = kept(looks, imported.ok ? looks.keep(imported.look as ThemeLook) : imported, (made) => `Added ${made.name}.`)
    if (said.kind === 'done') setText('')
    onSaid(said)
  }
  return (
    <form className={styles.section} onSubmit={submit}>
      <label htmlFor={fieldId} className={styles.label}>
        {IMPORT_LABEL}
      </label>
      <textarea
        id={fieldId}
        className={styles.paste}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        spellCheck={false}
      />
      <div className={styles.actions}>
        <button type="submit" className={styles.secondary}>
          {IMPORT_LOOK}
        </button>
      </div>
    </form>
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
          <ul>
            {said.errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
