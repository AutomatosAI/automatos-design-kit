/**
 * Every word on the phone view's Studio layout: a role from the app's type scale (src/phone/type.ts) in a tone's
 * colour (src/phone/parts.ts TEXT_TONES), as the app's src/ui/Text.tsx (:37-:46) sets it; the theme's fonts, where it
 * brings them, in place of Studio's faces. The element is the caller's: a span by default, a heading where the app
 * marks one. A colour given outright (a status word, a pill's ink) wins over the tone.
 */
import type { CSSProperties, ReactNode } from 'react'
import { TEXT_TONES, type TextTone } from '../../../src/phone/parts.ts'
import { typeStyle, type TypeRole } from '../../../src/phone/type.ts'
import { useGoPaint } from './paint.tsx'

/** The elements a text is drawn as. */
export type TextElement = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div'

export interface GoTextProps {
  readonly role: TypeRole
  readonly tone?: TextTone
  /** A colour that wins over the tone (#RRGGBB). */
  readonly colour?: string
  readonly weight?: number
  readonly as?: TextElement
  readonly lines?: number
  readonly style?: CSSProperties
  readonly children: ReactNode
}

/** The CSS that clamps text to `lines` lines, as numberOfLines does. */
function clamp(lines: number | undefined): CSSProperties {
  if (lines === undefined) return {}
  return { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
}

export function GoText({ role, tone = 'default', colour, weight, as: Element = 'span', lines, style, children }: GoTextProps) {
  const paint = useGoPaint()
  const face = typeStyle(role, paint.fonts, weight)
  const color = colour ?? paint.colours[TEXT_TONES[tone]]
  return (
    <Element data-go-text={colour === undefined ? tone : 'colour'} style={{ margin: 0, display: 'block', ...face, color, ...clamp(lines), ...style }}>
      {children}
    </Element>
  )
}
