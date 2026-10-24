/**
 * The skin designer's colour controls: one row for each of the block's 24 tokens in the scheme it edits (Light, or Dark
 * when the draft gives Dark its own colours), each a colour picker and a text field. The text field takes exactly what
 * the vendored validator takes ("H S% L%", such as "0 0% 100%", or "#rrggbb"): a value it would refuse is marked and
 * not used, and an empty field leaves the token to Studio's colour. The picker shows the colour the phone paints
 * (Studio's for a token the draft leaves out) and writes the #rrggbb picked. The two tokens a scheme can't go without
 * are marked.
 */
import { isMobileColour, MOBILE_REQUIRED_TOKENS, MOBILE_TOKEN_NAMES } from '@automatos/theme-cli/mobile'
import { parseColour } from '@automatos/theme-cli/mobile-paint'
import { isStudioColour, tokenName, type StudioColours } from '@automatos/theme-cli/phone'
import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react'
import type { DraftScheme, DraftSchemeName } from '../../../src/phone/designer.ts'

export const SCHEME_NAMES: Readonly<Record<DraftSchemeName, string>> = Object.freeze({ light: 'Light', dark: 'Dark' })
export const INVALID_TEXT = 'Not a colour the validator takes: use "H S% L%" (such as "0 0% 100%") or "#rrggbb".'
export const UNSET_PLACEHOLDER = "Studio's colour"
const NO_COLOUR = '#000000'

const ROW_STYLE: CSSProperties = Object.freeze({
  display: 'grid', gridTemplateColumns: '170px 36px 1fr', alignItems: 'center', gap: '4px 8px', padding: '2px 0',
})
const TEXT_STYLE: CSSProperties = Object.freeze({ font: '13px ui-monospace, monospace', padding: '2px 4px', minWidth: 0 })
const INVALID_STYLE: CSSProperties = Object.freeze({ gridColumn: '1 / -1', color: '#b91c1c', fontSize: '12px', margin: 0 })

/** The text field's label for a token. */
export const valueLabel = (token: string): string => `${token} value`
/** The colour picker's label for a token. */
export const pickerLabel = (token: string): string => `${token} colour`

/** The picker's #rrggbb: the token's own colour, else what the phone paints for it. */
function pickerValue(value: string | undefined, shown: string | null): string {
  const colour = value === undefined ? shown : parseColour(value)
  return (colour ?? NO_COLOUR).slice(0, NO_COLOUR.length).toLowerCase()
}

interface TokenFieldProps {
  readonly token: string
  /** The draft's value; undefined: Studio's colour. */
  readonly value: string | undefined
  /** The colour the phone paints for the token, or null when the layout has none for it. */
  readonly shown: string | null
  readonly onValue: (value: string | null) => void
}

function TokenField({ token, value, shown, onValue }: TokenFieldProps) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  const valid = text === '' || isMobileColour(text)
  const typed = (event: ChangeEvent<HTMLInputElement>): void => {
    const next = event.target.value
    setText(next)
    if (next === '') onValue(null)
    else if (isMobileColour(next)) onValue(next)
  }
  const required = MOBILE_REQUIRED_TOKENS.includes(token)
  return (
    <div data-skin-token={token} data-skin-valid={valid} style={ROW_STYLE}>
      <code>{token}{required ? ' (required)' : ''}</code>
      <input type="color" aria-label={pickerLabel(token)} value={pickerValue(value, shown)}
        onChange={(event) => onValue(event.target.value)} />
      <input type="text" aria-label={valueLabel(token)} aria-invalid={!valid} value={text} placeholder={UNSET_PLACEHOLDER}
        spellCheck={false} autoComplete="off" style={TEXT_STYLE} onChange={typed} />
      {valid ? null : <p style={INVALID_STYLE}>{INVALID_TEXT}</p>}
    </div>
  )
}

export interface TokenFieldsProps {
  /** The scheme the fields edit. */
  readonly editing: DraftSchemeName
  /** The scheme on screen, when it is not the one edited (no Dark of its own: the phone draws Light's under Dark). */
  readonly shownScheme: DraftSchemeName
  readonly values: DraftScheme
  /** The colours the phone paints for the scheme on screen. */
  readonly colours: StudioColours
  readonly onToken: (token: string, value: string | null) => void
}

function paintedOf(colours: StudioColours, token: string): string | null {
  const name = tokenName(token)
  return isStudioColour(name) ? colours[name] : null
}

/** What the fields say when the scheme on screen has no colours of its own. */
export function borrowedText(editing: DraftSchemeName, shown: DraftSchemeName): string {
  const [name, other] = [SCHEME_NAMES[editing], SCHEME_NAMES[shown]]
  return `The draft gives no ${other} colours, so the phone draws ${name}'s under ${other} too: these are ${name}'s.`
}

export function TokenFields({ editing, shownScheme, values, colours, onToken }: TokenFieldsProps) {
  const name = SCHEME_NAMES[editing]
  return (
    <fieldset data-skin-scheme={editing} style={{ border: '1px solid #d4d4d8', borderRadius: '6px', padding: '8px 12px', margin: 0 }}>
      <legend>{`${name}'s colours`}</legend>
      {shownScheme === editing ? null : (
        <p style={{ margin: '0 0 8px' }}>{borrowedText(editing, shownScheme)}</p>
      )}
      {MOBILE_TOKEN_NAMES.map((token) => (
        <TokenField key={`${editing} ${token}`} token={token} value={values[token]} shown={paintedOf(colours, token)}
          onValue={(value) => onToken(token, value)} />
      ))}
    </fieldset>
  )
}
