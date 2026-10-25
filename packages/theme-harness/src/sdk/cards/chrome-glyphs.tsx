/**
 * The chrome stand-ins' glyphs (src/sdk/cards/chrome.tsx): plain line drawings at the sizes core's icons take, never a
 * copy of core's icon set, each hidden from assistive technology (the control around it carries the name).
 */
import type { ReactElement, SVGProps } from 'react'

/** A glyph's size in pixels: core's h-4 w-4 icons. */
export const GLYPH_SIZE = 16

const LINE: SVGProps<SVGSVGElement> = Object.freeze({
  width: GLYPH_SIZE,
  height: GLYPH_SIZE,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
})

/** The first-run nudge's key. */
export function KeyGlyph({ color }: { readonly color: string }): ReactElement {
  return (
    <svg {...LINE} style={{ color, flex: 'none' }}>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M10 13 20 3M16 7l3 3M14 9l2 2" />
    </svg>
  )
}

/** A dismiss cross. */
export function CloseGlyph(): ReactElement {
  return (
    <svg {...LINE}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
