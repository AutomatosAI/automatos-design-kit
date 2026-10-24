import { type RefObject, useLayoutEffect, useRef, useState } from 'react'

/**
 * How the core screen lays out at the size the frame gives it. The Command design draws it at 1440 by 900 (a
 * 420 px core between two 340 px columns of panels) and on a phone (a 290 px core, no panels); HUD's frame takes
 * the rail's width first, so the screen picks by its own size: three columns when it is wide, the panels in one
 * column beside the conversation when it is narrower, the conversation alone below that; the large core when
 * there is height for it, the phone's core otherwise. Until the screen is measured (and where nothing measures, as
 * in a test), it is the design's desktop.
 */

export type Columns = 'three' | 'two' | 'one'
export type CoreSize = 'large' | 'small'

export interface ScreenLayout {
  readonly columns: Columns
  readonly core: CoreSize
}

export interface ScreenSize {
  readonly width: number
  readonly height: number
}

/** The screen's width, in px, at which the panels sit on both sides of the conversation. */
export const THREE_COLUMNS_MIN = 1180
/** Below this, the conversation stands alone. */
export const TWO_COLUMNS_MIN = 940
/** The screen's height, in px, the 420 px core needs beside the conversation and the message box. */
export const LARGE_CORE_MIN_HEIGHT = 760

export const DEFAULT_LAYOUT: ScreenLayout = { columns: 'three', core: 'large' }

function columnsFor(width: number): Columns {
  if (width >= THREE_COLUMNS_MIN) return 'three'
  return width >= TWO_COLUMNS_MIN ? 'two' : 'one'
}

/** The layout for a size; the design's desktop for none. Pure. */
export function screenLayout(size: ScreenSize | null): ScreenLayout {
  if (size === null) return DEFAULT_LAYOUT
  return { columns: columnsFor(size.width), core: size.height >= LARGE_CORE_MIN_HEIGHT ? 'large' : 'small' }
}

/** An element's inner size, or null while it has none (not laid out). */
function sizeOf(element: HTMLElement): ScreenSize | null {
  const { clientWidth: width, clientHeight: height } = element
  return width > 0 && height > 0 ? { width, height } : null
}

function sameLayout(a: ScreenLayout, b: ScreenLayout): boolean {
  return a.columns === b.columns && a.core === b.core
}

export interface MeasuredLayout {
  /** The screen's element, which the hook measures. */
  readonly ref: RefObject<HTMLDivElement | null>
  readonly layout: ScreenLayout
}

/**
 * The layout of the element `ref` names: measured before the first paint, then again whenever the element
 * resizes. A new layout renders only when the columns or the core change.
 */
export function useScreenLayout(): MeasuredLayout {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ScreenLayout>(DEFAULT_LAYOUT)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return undefined
    const measure = (): void => {
      const next = screenLayout(sizeOf(element))
      setLayout((known) => (sameLayout(known, next) ? known : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, layout }
}
