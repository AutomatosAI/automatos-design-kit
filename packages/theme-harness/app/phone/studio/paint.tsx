/**
 * What every part of the phone view's Studio layout paints with, handed down once (the app's useTokens()): the
 * colours of the scheme on screen, the thread's boxes made from them, the theme's fonts, the mascot it brings and the
 * motion setting. `painted` gives a part its colours from src/phone/parts.ts in a state, with the data attribute a
 * test or a designer finds the part by; `usePress` is a Pressable's pressed state as pointer events.
 */
import type { FontRole } from '@automatos/theme-cli/mobile-answer'
import type { PhoneMascot, StudioColours, ThreadPaint } from '@automatos/theme-cli/phone'
import { createContext, useContext, useState, type CSSProperties, type PointerEvent } from 'react'
import { partPaint, type PartState, type StudioPart } from '../../../src/phone/parts.ts'

export interface GoPaint {
  readonly colours: StudioColours
  readonly thread: ThreadPaint
  /** The theme's font URL for each role it brings; none: Studio's faces. */
  readonly fonts: Readonly<Partial<Record<FontRole, string>>>
  /** The Auto the theme brings; null: none (Studio shows no mascot, and neither does a theme with mode none). */
  readonly mascot: PhoneMascot | null
  readonly reducedMotion: boolean
}

const GoPaintContext = createContext<GoPaint | null>(null)

export const GoPaintProvider = GoPaintContext.Provider

export function useGoPaint(): GoPaint {
  const paint = useContext(GoPaintContext)
  if (paint === null) throw new Error('a phone part drew outside the phone view (GoPaintProvider)')
  return paint
}

/** The attribute a part carries: its name in src/phone/parts.ts. */
export const PART_ATTR = 'data-go-part'
/** The attribute a part carries while it is not at rest: 'pressed' or 'focused'. */
export const STATE_ATTR = 'data-go-state'

export interface PaintedPart {
  readonly [PART_ATTR]: StudioPart
  readonly [STATE_ATTR]?: PartState
  readonly style: CSSProperties
}

/** A part's attributes and its colours in a state, laid over `layout`. */
export function painted(paint: GoPaint, part: StudioPart, layout: CSSProperties, state: PartState = 'rest'): PaintedPart {
  const colours = partPaint(part, paint.colours, paint.thread, state)
  return {
    [PART_ATTR]: part,
    ...(state === 'rest' ? {} : { [STATE_ATTR]: state }),
    style: { ...layout, ...colours },
  }
}

export interface Press {
  readonly pressed: boolean
  readonly onPointerDown: (event: PointerEvent) => void
  readonly onPointerUp: () => void
  readonly onPointerLeave: () => void
  readonly onPointerCancel: () => void
}

/** Pressed while a pointer is down on it, as a Pressable is. */
export function usePress(): Press {
  const [pressed, setPressed] = useState(false)
  const release = (): void => setPressed(false)
  return {
    pressed,
    onPointerDown: () => setPressed(true),
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
  }
}

/** The press handlers alone, for an element's props. */
export function pressHandlers(press: Press): Omit<Press, 'pressed'> {
  const { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel } = press
  return { onPointerDown, onPointerUp, onPointerLeave, onPointerCancel }
}
