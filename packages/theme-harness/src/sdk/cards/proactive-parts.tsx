/**
 * PRD-268 (SDK 1.3.0): what the proactive card stand-ins share, after core's frontend/components/proactive/card-parts.tsx
 * and status-label.tsx (at 1a8956c874dc42cff05b96f431c50b7d722a71aa): the studio-eyebrow label, the tiny "Auto is an
 * AI" caption (the in-app AI label's words, once per card, outside the fence of Auto's words), a state's glyph and
 * word as a pill (never colour alone), and a refused call's one line.
 */
import type { DisplayStateLabel } from '@automatos/theme-sdk'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useTone } from '../context.ts'
import { ALERT, CAPTION, EYEBROW, pillStyle } from './proactive-styles.ts'

/** lib/ai-label/copy.ts aiLabelText(null). */
export const AI_CAPTION = 'Auto is an AI'

export function Eyebrow({ children, style }: { readonly children: ReactNode; readonly style?: CSSProperties }): ReactElement {
  return <p className="studio-eyebrow" style={{ ...EYEBROW, ...style }}>{children}</p>
}

/** card-parts.tsx AiCaption. */
export function AiCaption(): ReactElement {
  return <span role="note" aria-label={AI_CAPTION} data-proactive-ai-caption="" style={CAPTION}>{AI_CAPTION}</span>
}

/** status-label.tsx StatePill (Studio's): the glyph and the word, in the role's token for the ground's tone. */
export function StatePill({ label }: { readonly label: DisplayStateLabel }): ReactElement {
  const dark = useTone() === 'dark'
  return (
    <span className="studio-pill" data-status-role={label.role} style={pillStyle(label.role, dark)}>
      <span aria-hidden="true">{label.glyph}</span>
      <span>{label.word}</span>
    </span>
  )
}

/** suggestion-parts.tsx RefusedLine: one line, and the card stays where it is. */
export function RefusedLine({ text }: { readonly text: string | null }): ReactElement | null {
  return text ? <p role="alert" style={ALERT}>{text}</p> : null
}
