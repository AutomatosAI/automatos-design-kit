/**
 * Where each of the block's 24 tokens lands on the phone's Studio layout, for the scheme on screen: the colour the
 * phone paints (the theme's, or Studio's where the theme leaves the token out), whether the theme set it, and the parts
 * of these screens that draw with it (src/phone/parts.ts). The three tokens the Studio layout has no colour for are
 * read by no part (the app's paint.ts drops them), and a few more are painted but drawn by none of these screens.
 */
import { MOBILE_TOKEN_NAMES } from '@automatos/theme-cli/mobile'
import { isStudioColour, tokenName, type StudioColours } from '@automatos/theme-cli/phone'
import type { CSSProperties } from 'react'
import { partsOfToken, PIP_COLOURS, TEXT_TONES, type PipStatus, type TextTone } from '../../src/phone/parts.ts'

export const DROPPED_TEXT = 'not read: the Studio layout has no colour for it'
export const UNDRAWN_TEXT = 'painted; none of these screens draws it'

const PANEL_STYLE: CSSProperties = Object.freeze({
  fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#18181b', background: '#ffffff', border: '1px solid #a1a1aa',
  borderRadius: '8px', padding: '12px 16px', minWidth: '320px', maxWidth: '520px',
})
const CELL: CSSProperties = Object.freeze({ padding: '3px 6px', textAlign: 'left', borderBottom: '1px solid #e4e4e7', verticalAlign: 'top' })
const SWATCH: CSSProperties = Object.freeze({
  display: 'inline-block', width: '14px', height: '14px', border: '1px solid #71717a', verticalAlign: 'middle', marginRight: '6px',
})

/** The text tones these screens set words in (text.tsx's callers). */
const SCREEN_TONES: readonly TextTone[] = ['default', 'muted', 'accent', 'success']

/** The text tones that read a Studio colour, as places a token lands. */
function tonesOf(name: string): string[] {
  return SCREEN_TONES.filter((tone) => TEXT_TONES[tone] === name).map((tone) => `text (${tone})`)
}

/** The statuses these screens draw a dot for (copy.ts's needs, tickets and pills). */
const SCREEN_STATUSES: readonly PipStatus[] = ['review', 'blocked', 'in_progress', 'failed', 'done']

function dotsOf(name: string): string[] {
  return SCREEN_STATUSES.filter((status) => PIP_COLOURS[status] === name).map((status) => `status dot (${status})`)
}

/** The places a '--' token lands: the parts, text in a tone and the status dots that read its Studio colour. */
export function placesOf(token: string): readonly string[] {
  const name = tokenName(token)
  if (!isStudioColour(name)) return []
  return [...partsOfToken(name), ...tonesOf(name), ...dotsOf(name)]
}

export interface TokenPanelProps {
  readonly colours: StudioColours
  /** The '--' tokens the theme painted in this scheme; null: none (Studio's own). */
  readonly themed: readonly string[] | null
}

function TokenRow({ token, colours, themed }: { readonly token: string } & TokenPanelProps) {
  const name = tokenName(token)
  const studio = isStudioColour(name)
  const places = placesOf(token)
  const where = !studio ? DROPPED_TEXT : places.length === 0 ? UNDRAWN_TEXT : places.join(', ')
  return (
    <tr data-token={token}>
      <td style={CELL}><code>{token}</code></td>
      <td style={CELL}>
        {studio ? <span aria-hidden="true" style={{ ...SWATCH, background: colours[name] }} /> : null}
        {studio ? <code data-value="">{colours[name]}</code> : '–'}
      </td>
      <td style={CELL}>{themed?.includes(token) ? 'theme' : 'Studio'}</td>
      <td data-places="" style={CELL}>{where}</td>
    </tr>
  )
}

export function TokenPanel({ colours, themed }: TokenPanelProps) {
  return (
    <section aria-labelledby="phone-tokens-heading" style={PANEL_STYLE}>
      <h2 id="phone-tokens-heading" style={{ margin: '0 0 8px', fontSize: '16px' }}>Where each token lands</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr><th style={CELL}>Token</th><th style={CELL}>Painted</th><th style={CELL}>From</th><th style={CELL}>Drawn by</th></tr>
        </thead>
        <tbody>
          {MOBILE_TOKEN_NAMES.map((token) => <TokenRow key={token} token={token} colours={colours} themed={themed} />)}
        </tbody>
      </table>
    </section>
  )
}
