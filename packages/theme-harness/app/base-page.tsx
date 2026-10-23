/**
 * PRD-261 B-02e: the host's own page, as the harness stands it in: what core draws where the theme draws nothing.
 * Inside the theme's frame (the frame's own view, a path the theme has no page for) it is a section of the frame;
 * alone (below the theme's minWidth, or once the theme failed) it is the whole page, in the theme's base design
 * (Studio or Classic) as far as the harness has one: a heading and a line saying why it is here.
 */
import type { CSSProperties } from 'react'

export type BaseReason = 'in-frame' | 'narrow' | 'failed'

export interface BasePageProps {
  readonly base: 'studio' | 'classic'
  readonly path: string
  readonly reason: BaseReason
  /** The theme's minWidth, for the 'narrow' line. */
  readonly minWidth: number
}

const BASE_NAMES: Readonly<Record<BasePageProps['base'], string>> = Object.freeze({ studio: 'Studio', classic: 'Classic' })

function reasonLine(reason: BaseReason, minWidth: number): string {
  if (reason === 'narrow') return `The window is narrower than the theme's minWidth (${minWidth} px), so the host draws its own page.`
  if (reason === 'failed') return 'The theme could not start, so the host draws its own page.'
  return 'The theme draws no page here: this is the host\'s own page, inside the theme\'s frame.'
}

/** Plain and high-contrast, so the stand-in itself never fails the shots' axe scan. */
const PAGE_STYLE: CSSProperties = Object.freeze({
  boxSizing: 'border-box',
  minHeight: '100%',
  padding: '32px',
  background: '#ffffff',
  color: '#1a1a1a',
  fontFamily: 'system-ui, sans-serif',
  lineHeight: 1.5,
})

export function BasePage({ base, path, reason, minWidth }: BasePageProps) {
  const headingId = `harness-base-${reason}`
  const body = (
    <>
      <h1 id={headingId} style={{ margin: '0 0 8px', fontSize: '24px' }}>
        {BASE_NAMES[base]}: {path}
      </h1>
      <p style={{ margin: 0 }}>{reasonLine(reason, minWidth)}</p>
    </>
  )
  if (reason === 'in-frame') {
    return (
      <section aria-labelledby={headingId} data-harness-base={path} style={PAGE_STYLE}>
        {body}
      </section>
    )
  }
  return (
    <main aria-labelledby={headingId} data-harness-base={path} style={PAGE_STYLE}>
      {body}
    </main>
  )
}
