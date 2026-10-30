import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'

import { CARD_SETS, paletteById, type Palette } from './catalogue'
import { PRESETS, type ThemeLook } from './spec'
import styles from './look-cards.module.css'
import ui from '../ui/ui.module.css'

/**
 * The look editor's looks to pick from: the three presets as cards, each with a small picture of its palette (its
 * page colour under its three card colours, in its own order), then the user's saved looks as pills, each with
 * Rename and Delete. A preset's picture is drawn from the catalogue's colours, handed to the CSS as custom
 * properties, so no colour is written in a stylesheet. Picking one goes to the host at once.
 */

export const PRESETS_HEADING = 'Presets'
export const SAVED_HEADING = 'Your looks'
export const RENAME = 'Rename'
export const DELETE = 'Delete'
export const SAVE_NAME = 'Save name'
export const CANCEL = 'Cancel'
export const nameFieldLabel = (name: string): string => `New name for ${name}`

/** A preset's picture as custom properties: its page, then its three card colours' starts in its order. */
export function presetColours(palette: Palette | undefined): CSSProperties {
  if (palette === undefined) return {}
  const [one, two, three] = palette.order.map((set) => CARD_SETS[set].a)
  return {
    '--candy-preset-page': palette.colours.page,
    '--candy-preset-1': one,
    '--candy-preset-2': two,
    '--candy-preset-3': three,
  } as CSSProperties
}

export interface PresetCardsProps {
  /** The active look's palette: its preset shows as picked. */
  readonly palette: string
  readonly onPick: (look: ThemeLook) => void
}

export function PresetCards({ palette, onPick }: PresetCardsProps) {
  return (
    <ul className={styles.presets}>
      {PRESETS.map((preset) => (
        <li key={preset.id} className={styles.presetItem}>
          <button type="button" className={styles.preset} aria-pressed={preset.palette === palette} onClick={() => onPick(preset)}>
            <span className={styles.presetPicture} style={presetColours(paletteById(preset.palette))} aria-hidden="true">
              <span className={styles.presetBar} data-bar="1" />
              <span className={styles.presetBar} data-bar="2" />
              <span className={styles.presetBar} data-bar="3" />
            </span>
            <span className={styles.presetName}>{preset.name}</span>
            <span className={styles.presetSub}>{preset.sub}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

interface RenameFormProps {
  readonly look: ThemeLook
  readonly onRename: (name: string) => void
  readonly onCancel: () => void
}

/** A saved look's new name, typed in place: Save name keeps it, Cancel or Escape leaves it as it was. */
function RenameForm({ look, onRename, onCancel }: RenameFormProps) {
  const [name, setName] = useState(look.name)
  const field = useRef<HTMLInputElement>(null)
  const fieldId = useId()
  useEffect(() => field.current?.select(), [])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onRename(name.trim())
  }
  const escape = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') onCancel()
  }
  return (
    <form className={styles.renameForm} onSubmit={submit}>
      <label htmlFor={fieldId} className={ui.srOnly}>
        {nameFieldLabel(look.name)}
      </label>
      <input id={fieldId} ref={field} className={styles.nameField} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} onKeyDown={escape} />
      <button type="submit" className={`${ui.button} ${ui.small}`}>
        {SAVE_NAME}
      </button>
      <button type="button" className={`${ui.quiet} ${ui.small}`} onClick={onCancel}>
        {CANCEL}
      </button>
    </form>
  )
}

export interface SavedLooksProps {
  readonly saved: readonly ThemeLook[]
  readonly activeId: string
  readonly onPick: (look: ThemeLook) => void
  /** True when the host took the new name. */
  readonly onRename: (look: ThemeLook, name: string) => boolean
  readonly onDelete: (look: ThemeLook) => void
}

export function SavedLooks({ saved, activeId, onPick, onRename, onDelete }: SavedLooksProps) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const headingId = useId()
  const rename = (look: ThemeLook, name: string) => {
    if (onRename(look, name)) setRenaming(null)
  }
  if (saved.length === 0) return null
  return (
    <section className={styles.saved} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.savedHeading}>
        {SAVED_HEADING}
      </h3>
      <ul className={styles.savedList}>
        {saved.map((look) => (
          <li key={look.id} className={styles.savedRow}>
            {renaming === look.id ? (
              <RenameForm look={look} onCancel={() => setRenaming(null)} onRename={(name) => rename(look, name)} />
            ) : (
              <>
                <button type="button" className={`${ui.pill} ${styles.savedPick}`} aria-pressed={look.id === activeId} onClick={() => onPick(look)}>
                  {look.name}
                </button>
                <button type="button" className={`${ui.quiet} ${ui.small}`} aria-label={`${RENAME} ${look.name}`} onClick={() => setRenaming(look.id)}>
                  {RENAME}
                </button>
                <button type="button" className={`${ui.quiet} ${ui.small}`} aria-label={`${DELETE} ${look.name}`} onClick={() => onDelete(look)}>
                  {DELETE}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
