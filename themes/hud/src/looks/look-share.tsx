import { useId, useState, type FormEvent } from 'react'

import { exportLook, importLook, type HostLookResult } from '@automatos/theme-sdk'

import { Panel } from '../components/panel'
import type { HudLook } from '../lib/looks/types'
import { downloadText } from './download'
import styles from './drawer.module.css'
import { keptLook, type HudLooks } from './use-hud-looks'

/**
 * Sharing a look as a file: Export saves the active look as the host's .look.json (the SDK's exportLook), and Import
 * takes one pasted as text (the SDK's importLook, which checks it against looks/schema.json and gives it a fresh
 * id), keeps it among the user's looks and makes it the active one. A look is data only: keys, two numbers and
 * three switches. What happened is said in words: a polite status for a success, an alert with the host's reasons
 * for a refusal, never a throw.
 */

export const SHARE_TITLE = 'Share'
export const EXPORT_LABEL = 'Export'
export const IMPORT_FIELD_LABEL = "Paste a look's JSON"
export const IMPORT_LABEL = 'Import'
export const NOT_DONE = "That didn't work."
export const DOWNLOAD_FAILED = "The browser didn't start the download."

export const exportStarted = (fileName: string): string => `The download of ${fileName} has started.`
export const importedLine = (name: string): string => `Added ${name}.`
export const notExportable = (name: string): string => `${name} can't be exported: it doesn't pass HUD's look checks.`

export interface Said {
  readonly kind: 'done' | 'failed'
  readonly text: string
  readonly errors: readonly string[]
}

const done = (text: string): Said => ({ kind: 'done', text, errors: [] })
const failed = (errors: readonly string[]): Said => ({ kind: 'failed', text: NOT_DONE, errors })

function exported(look: HudLook): Said {
  const file = exportLook(look)
  if (file === null) return failed([notExportable(look.name)])
  try {
    downloadText(file.fileName, file.text, file.type)
  } catch (error) {
    console.error('[looks] the download of the look did not start', error)
    return failed([DOWNLOAD_FAILED])
  }
  return done(exportStarted(file.fileName))
}

/** The pasted text kept as a saved look and made the active one, in words. */
function imported(looks: HudLooks, text: string): Said {
  const checked: HostLookResult = importLook(text)
  if (!checked.ok) return failed(checked.errors)
  const kept = looks.keep(keptLook(checked))
  if (!kept.ok) return failed(kept.errors)
  const look = keptLook(kept)
  const picked = looks.pick(look)
  return picked.ok ? done(importedLine(look.name)) : failed(picked.errors)
}

function SaidLine({ said }: { readonly said: Said | null }) {
  return (
    <>
      <p className={styles.said} role="status">
        {said?.kind === 'done' ? said.text : ''}
      </p>
      {said?.kind === 'failed' && (
        <div className={styles.errors} role="alert">
          <p className={styles.errorTitle}>{said.text}</p>
          <ul className={styles.errorList}>
            {said.errors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

export function LookShare({ looks }: { readonly looks: HudLooks }) {
  const fieldId = useId()
  const [text, setText] = useState('')
  const [said, setSaid] = useState<Said | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const outcome = imported(looks, text)
    if (outcome.kind === 'done') setText('')
    setSaid(outcome)
  }
  return (
    <Panel title={SHARE_TITLE}>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => setSaid(exported(looks.look))}>
          {EXPORT_LABEL}
        </button>
      </div>
      <form className={styles.section} onSubmit={submit}>
        <label htmlFor={fieldId} className={styles.label}>
          {IMPORT_FIELD_LABEL}
        </label>
        <textarea
          id={fieldId}
          className={styles.paste}
          value={text}
          rows={4}
          spellCheck={false}
          onChange={(event) => setText(event.target.value)}
        />
        <div className={styles.actions}>
          <button type="submit" className={styles.secondary}>
            {IMPORT_LABEL}
          </button>
        </div>
      </form>
      <SaidLine said={said} />
    </Panel>
  )
}
