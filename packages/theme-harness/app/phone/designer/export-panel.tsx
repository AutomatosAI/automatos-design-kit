/**
 * The skin designer's export: skin.json, exactly the draft's `mobile` block, offered only when `automatos-theme skin`
 * would write it (src/phone/skin-export.ts: the vendored validator, then the theme's files and the contrast). Then a
 * download link (a data: URL of the file's text, read where it is), a Copy button (the browser's clipboard, when the
 * page may use it) and the text itself, with the command that writes it into theme.json. Otherwise every reason the
 * command gives, and no file.
 */
import { SKIN_FILE } from '@automatos/theme-cli/skin-check'
import { useState, type CSSProperties } from 'react'
import { skinHref, type SkinExport } from '../../../src/phone/skin-export.ts'

export const DOWNLOAD_TEXT = `Download ${SKIN_FILE}`
export const COPY_TEXT = 'Copy'
export const REFUSED_TEXT = 'automatos-theme skin would refuse this block, so there is no file yet:'
export const COPY_WORDS = Object.freeze({ copied: 'Copied.', failed: "The page can't use the clipboard here: copy the text below." })
export const SKIN_COMMAND = `automatos-theme skin <theme folder> --from ${SKIN_FILE}`

const SET_STYLE: CSSProperties = Object.freeze({ border: '1px solid #d4d4d8', borderRadius: '6px', padding: '8px 12px', margin: 0 })
const ROW_STYLE: CSSProperties = Object.freeze({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' })
const TEXT_STYLE: CSSProperties = Object.freeze({ width: '100%', boxSizing: 'border-box', font: '12px ui-monospace, monospace', marginTop: '8px' })
const FAIL_INK = '#b91c1c'
const TEXT_ROWS = 12

type CopyOutcome = keyof typeof COPY_WORDS

/** Writes `text` to the clipboard; false when the page has none or may not use it. */
async function copied(text: string): Promise<boolean> {
  const clipboard: Clipboard | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (clipboard === undefined) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function Refused({ problems }: { readonly problems: readonly string[] }) {
  return (
    <div data-skin-export="refused">
      <p style={{ margin: '0 0 4px' }}>{REFUSED_TEXT}</p>
      <ul style={{ margin: 0, paddingLeft: '20px', color: FAIL_INK }}>
        {problems.map((problem, index) => <li key={`${index} ${problem}`}>{problem}</li>)}
      </ul>
    </div>
  )
}

function Ready({ text }: { readonly text: string }) {
  const [outcome, setOutcome] = useState<{ readonly text: string; readonly copy: CopyOutcome } | null>(null)
  const copy = (): void => {
    void copied(text).then((done) => setOutcome({ text, copy: done ? 'copied' : 'failed' }))
  }
  return (
    <div data-skin-export="ready">
      <div style={ROW_STYLE}>
        <a href={skinHref(text)} download={SKIN_FILE}>{DOWNLOAD_TEXT}</a>
        <button type="button" onClick={copy}>{COPY_TEXT}</button>
        <span aria-live="polite" data-skin-copy="">{outcome !== null && outcome.text === text ? COPY_WORDS[outcome.copy] : ''}</span>
      </div>
      <textarea readOnly aria-label={SKIN_FILE} value={text} rows={TEXT_ROWS} style={TEXT_STYLE} />
      <p style={{ margin: '4px 0 0' }}>Then <code>{SKIN_COMMAND}</code> writes it into theme.json.</p>
    </div>
  )
}

export function ExportPanel({ exported }: { readonly exported: SkinExport }) {
  return (
    <fieldset style={SET_STYLE}>
      <legend>Export</legend>
      {exported.problems.length > 0 ? <Refused problems={exported.problems} /> : <Ready text={exported.text} />}
    </fieldset>
  )
}
