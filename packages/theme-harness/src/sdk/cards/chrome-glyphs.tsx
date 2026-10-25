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

/** Help: a circled question mark, at core's 15 pixels (studio-header.tsx's HelpCircle). */
export function HelpGlyph(): ReactElement {
  return (
    <svg {...LINE} width={15} height={15}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
    </svg>
  )
}

/** Notifications: a bell, at core's 20 pixels (notification-bell.tsx's w-5 h-5). */
export function BellGlyph(): ReactElement {
  return (
    <svg {...LINE} width={20} height={20}>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

/** The theme menu: a sun, the light tone's mark (theme-toggle.tsx's h-4 w-4). */
export function ToneGlyph(): ReactElement {
  return (
    <svg {...LINE}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1.5V4M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </svg>
  )
}

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
