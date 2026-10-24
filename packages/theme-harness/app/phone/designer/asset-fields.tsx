/**
 * The skin designer's file controls, each from the theme's own files under assets/ (the build's list):
 *
 * - a font for each of the three roles: Studio's face, or one of the theme's files the vendored validator takes as a
 *   phone font (a .ttf or .otf in assets/fonts/mobile/, src/phone/designer.ts fontFiles), each file for one role only;
 * - the mascot mode: none, stills or clips (stills and clips need theme.json's top-level `mascot` with its states),
 *   with each state's files the mode needs and whether the theme holds each, as `automatos-theme skin` checks them.
 */
import { MOBILE_FONT_ROLES, MOBILE_MASCOT_MODES } from '@automatos/theme-cli/mobile'
import type { FontRole, MascotMode } from '@automatos/theme-cli/mobile-answer'
import type { ChangeEvent, CSSProperties } from 'react'
import { mascotStates, stateFiles, type DraftFonts, type StateFiles } from '../../../src/phone/designer.ts'

export const ROLE_NAMES: Readonly<Record<FontRole, string>> = Object.freeze({ sans: 'Sans', serif: 'Serif', mono: 'Mono' })
export const MODE_NAMES: Readonly<Record<MascotMode, string>> = Object.freeze({
  none: 'None: no Auto of the theme', stills: 'Stills: his .png for each state', clips: 'Clips: his .mp4 and .png for each state',
})
export const STUDIO_FACE = "Studio's face"
export const NO_FONT_FILES = 'The theme has no .ttf or .otf in assets/fonts/mobile/, so each role keeps Studio\'s face.'
export const NO_STATES = 'theme.json has no top-level mascot with states, so Auto can only be none.'
/** What the field says under none, naming the states stills or clips would show. */
export const noneText = (names: readonly string[]): string => `Its states: ${names.join(', ')}. Stills or clips show Auto in them.`
const NOT_IN_THEME = ' (not in the theme)'

const FIELD_STYLE: CSSProperties = Object.freeze({ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' })
const SET_STYLE: CSSProperties = Object.freeze({ border: '1px solid #d4d4d8', borderRadius: '6px', padding: '8px 12px', margin: 0 })

/** The font select's label for a role. */
export const fontLabel = (role: FontRole): string => `${ROLE_NAMES[role]} font`
export const MASCOT_LABEL = 'Mascot'

export interface FontFieldsProps {
  readonly fonts: DraftFonts
  /** The theme's files the validator takes as a phone font. */
  readonly files: readonly string[]
  readonly onFont: (role: FontRole, path: string | null) => void
}

/** The files a role may pick: the theme's, less those another role has, and the role's own even when not the theme's. */
function fileChoices(role: FontRole, fonts: DraftFonts, files: readonly string[]): { path: string; label: string; taken: boolean }[] {
  const mine = fonts[role]
  const others = new Set(MOBILE_FONT_ROLES.filter((other) => other !== role).map((other) => fonts[other as FontRole]))
  const known = files.map((path) => ({ path, label: path, taken: others.has(path) }))
  const stray = mine !== undefined && !files.includes(mine) ? [{ path: mine, label: `${mine}${NOT_IN_THEME}`, taken: false }] : []
  return [...known, ...stray]
}

export function FontFields({ fonts, files, onFont }: FontFieldsProps) {
  return (
    <fieldset style={SET_STYLE}>
      <legend>Fonts</legend>
      {files.length === 0 ? <p style={{ margin: '0 0 4px' }}>{NO_FONT_FILES}</p> : null}
      {MOBILE_FONT_ROLES.map((name) => {
        const role = name as FontRole
        const pick = (event: ChangeEvent<HTMLSelectElement>): void => onFont(role, event.target.value === '' ? null : event.target.value)
        return (
          <label key={role} style={FIELD_STYLE}>
            {fontLabel(role)}
            <select value={fonts[role] ?? ''} onChange={pick}>
              <option value="">{STUDIO_FACE}</option>
              {fileChoices(role, fonts, files).map((choice) => (
                <option key={choice.path} value={choice.path} disabled={choice.taken}>{choice.label}</option>
              ))}
            </select>
          </label>
        )
      })}
    </fieldset>
  )
}

const isMode = (value: string): value is MascotMode => MOBILE_MASCOT_MODES.includes(value)

function StateList({ states }: { readonly states: readonly StateFiles[] }) {
  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
      {states.map((state) => (
        <li key={state.name} data-skin-state={state.name}>
          {`${state.name}: `}
          {state.files.map((file, index) => (
            <span key={file.path} data-skin-file={file.held ? 'held' : 'missing'}>
              {index > 0 ? ', ' : ''}<code>{file.path}</code> {file.held ? 'in the theme' : 'missing'}
            </span>
          ))}
        </li>
      ))}
    </ul>
  )
}

export interface MascotFieldProps {
  readonly mode: MascotMode
  readonly manifest: Readonly<Record<string, unknown>>
  readonly assets: readonly string[]
  readonly onMode: (mode: MascotMode) => void
}

export function MascotField({ mode, manifest, assets, onMode }: MascotFieldProps) {
  const names = mascotStates(manifest)
  const pick = (event: ChangeEvent<HTMLSelectElement>): void => onMode(isMode(event.target.value) ? event.target.value : mode)
  return (
    <fieldset style={SET_STYLE}>
      <legend>Auto</legend>
      <label style={FIELD_STYLE}>
        {MASCOT_LABEL}
        <select value={mode} onChange={pick}>
          {MOBILE_MASCOT_MODES.filter(isMode).map((option) => (
            <option key={option} value={option} disabled={option !== 'none' && names.length === 0}>{MODE_NAMES[option]}</option>
          ))}
        </select>
      </label>
      {names.length === 0 || mode === 'none'
        ? <p style={{ margin: '4px 0 0' }}>{names.length === 0 ? NO_STATES : noneText(names)}</p>
        : <StateList states={stateFiles(manifest, mode, assets)} />}
    </fieldset>
  )
}
