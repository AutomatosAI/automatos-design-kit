/**
 * A theme the phone draws in its own built-in layout (automatos/play and automatos/hud: the app's
 * src/styles/themes/follow.ts BUILT_IN_THEME_STYLES): Automatos Go switches to its native Play or HUD layout, painted
 * from the member's looks, and reads none of the theme's `mobile` block. That layout is compiled into the app, so the
 * harness can't draw it. Nor are the theme's own web screens a stand-in: their theme.json minWidth (1024 for both)
 * keeps them off a phone-width browser, where the host draws its own pages. So the phone says so, in the look's tone.
 */
import type { CSSProperties } from 'react'
import type { PhoneScheme } from '../../src/phone/settings.ts'
import type { BuiltInStyle } from '../../src/phone/skin.ts'

export const BUILT_IN_NAMES: Readonly<Record<BuiltInStyle, string>> = Object.freeze({ play: 'Play', hud: 'HUD' })

/** What the phone shows for a built-in layout. */
export function builtInScreenText(style: BuiltInStyle): string {
  const name = BUILT_IN_NAMES[style]
  return `Automatos Go draws ${name} with its own built-in ${name} layout. It is part of the app, so the harness `
    + 'can’t draw it: open Automatos Go on a phone to see it.'
}

const SCREEN_STYLE: CSSProperties = Object.freeze({
  flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px',
  textAlign: 'center', lineHeight: 1.5,
})
const TONES: Readonly<Record<PhoneScheme, CSSProperties>> = Object.freeze({
  light: Object.freeze({ background: '#ffffff', color: '#18181b' }),
  dark: Object.freeze({ background: '#18181b', color: '#fafafa' }),
})

export interface BuiltInPhoneProps {
  readonly style: BuiltInStyle
  readonly scheme: PhoneScheme
}

/** The phone's screen for a built-in layout: what it is and where to see it. */
export function BuiltInPhone({ style, scheme }: BuiltInPhoneProps) {
  return (
    <div data-go-built-in={style} style={{ ...SCREEN_STYLE, ...TONES[scheme] }}>
      <p style={{ margin: 0 }}>{builtInScreenText(style)}</p>
    </div>
  )
}
