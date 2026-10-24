/**
 * The app's primitives the phone view's screens are made of, as DOM (src/ui at the Automatos Go commit
 * packages/theme-cli's README names): a card (Card.tsx, a button while it opens something, the hover look while
 * pressed), the status dot and word (StatusPip.tsx), the reason chip (Chip.tsx), the count badge (CountBadge.tsx), the
 * rule (Divider.tsx) and the icons, drawn here as plain marks in the text's colour (the app draws lucide's). Sizes are
 * the app's, a point a pixel; colours come from src/phone/parts.ts through `painted`.
 */
import type { CSSProperties, ReactNode } from 'react'
import { PIP_COLOURS, type PipStatus } from '../../../src/phone/parts.ts'
import { painted, pressHandlers, useGoPaint, usePress } from './paint.tsx'
import { GoText } from './text.tsx'

/** src/styles/tokens/studio.ts STUDIO_SPACING (:83-:94) and STUDIO_RADII (:70-:80). */
export const SPACE = Object.freeze({ s1: 4, s2: 6, s3: 8, s4: 10, s5: 12, s6: 14, s7: 16, s8: 18, s9: 24, s10: 28 })
export const RADII = Object.freeze({ tag: 2, chip: 3, segment: 4, control: 6, card: 8, panel: 10, pill: 12, sheet: 14, full: 999 })
/** spacing.css --shadow-hairline: the cards' 1 pt shadow (the app's STUDIO_SHADOWS.hairline). */
export const HAIRLINE_SHADOW = '0 1px 0 rgba(69, 46, 23, 0.05)'
/** variants.ts DOT_SIZE. */
const DOT_SIZE = 7
const ICON_STROKE = 2

const BUTTON_RESET: CSSProperties = Object.freeze({
  font: 'inherit', textAlign: 'left', cursor: 'pointer', appearance: 'none', margin: 0,
})

export interface CardProps {
  /** What the card opens, for a screen reader; without it the card is not a button. */
  readonly label?: string
  readonly radius?: 'card' | 'panel'
  readonly style?: CSSProperties
  readonly children: ReactNode
}

/** Card.tsx: --card ground, 1 pt --border, the hairline shadow; pressed, the hover look. */
export function Card({ label, radius = 'card', style, children }: CardProps) {
  const paint = useGoPaint()
  const press = usePress()
  const layout: CSSProperties = {
    ...BUTTON_RESET, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: SPACE.s5,
    borderWidth: 1, borderStyle: 'solid', borderRadius: RADII[radius], boxShadow: HAIRLINE_SHADOW, ...style,
  }
  const part = painted(paint, 'card', layout, press.pressed ? 'pressed' : 'rest')
  if (label === undefined) return <div {...part}>{children}</div>
  return (
    <button type="button" aria-label={label} {...pressHandlers(press)} {...part}>
      {children}
    </button>
  )
}

/** StatusPip.tsx: a status as a dot AND a word, so the colour is never the only signal. */
export function StatusPip({ status, word }: { readonly status: PipStatus; readonly word: string }) {
  const { colours } = useGoPaint()
  return (
    <span data-go-pip={status} style={{ display: 'flex', alignItems: 'center', gap: SPACE.s1 }}>
      <span style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: RADII.full, backgroundColor: colours[PIP_COLOURS[status]] }} />
      <GoText role="label" tone="muted">{word}</GoText>
    </span>
  )
}

/** Chip.tsx: mono uppercase on the accent at 10 %, 3 pt radius. */
export function Chip({ label }: { readonly label: string }) {
  const paint = useGoPaint()
  const part = painted(paint, 'reasonChip', { alignSelf: 'flex-start', borderRadius: RADII.chip, padding: `2px ${SPACE.s2}px` })
  return (
    <span {...part}>
      <GoText role="label" colour={String(part.style.color)}>{label}</GoText>
    </span>
  )
}

/** CountBadge.tsx: mono figures on --accent, round, at least 16 pt. */
export function CountBadge({ count }: { readonly count: number }) {
  const paint = useGoPaint()
  const layout: CSSProperties = {
    minWidth: 16, minHeight: 16, boxSizing: 'border-box', padding: `0 ${SPACE.s1}px`, borderRadius: RADII.full,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const part = painted(paint, 'countBadge', layout)
  return (
    <span {...part}>
      <GoText role="label" colour={String(part.style.color)} style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</GoText>
    </span>
  )
}

/** Divider.tsx: a 1 pt --border rule. */
export function Divider() {
  const paint = useGoPaint()
  return <div aria-hidden="true" {...painted(paint, 'divider', { height: 1, alignSelf: 'stretch' })} />
}

export type IconName = 'menu' | 'arrow-up' | 'plus' | 'chevron-left' | 'report' | 'task' | 'target'

const ICON_PATHS: Readonly<Record<IconName, string>> = Object.freeze({
  'menu': 'M4 6h16M4 12h16M4 18h16',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'plus': 'M12 5v14M5 12h14',
  'chevron-left': 'M15 18l-6-6 6-6',
  'report': 'M6 3h9l4 4v14H6zM9 17v-3M12 17v-6M15 17v-4',
  'task': 'M4 4h16v16H4zM8 12l3 3 5-6',
  'target': 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8',
})

/** A mark in the text's colour (currentColor), hidden from a screen reader: its button or row says what it is. */
export function Icon({ name, size }: { readonly name: IconName; readonly size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={ICON_STROKE} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

/** The sail mark (assets/brand in the app), in one colour. */
export function SailMark({ height, colour }: { readonly height: number; readonly colour: string }) {
  return (
    <svg aria-hidden="true" width={height * 0.82} height={height} viewBox="0 0 32 39" style={{ flexShrink: 0 }}>
      <path d="M17 1 L30 31 L17 31 Z M14 6 L14 31 L2 31 Z M2 34 L30 34 L26 38 L6 38 Z" fill={colour} />
    </svg>
  )
}
