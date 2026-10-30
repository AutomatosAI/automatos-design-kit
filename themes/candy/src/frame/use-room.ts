import { type CSSProperties, type RefObject, useEffect, useState } from 'react'

/**
 * The room the host's header utilities take at the top right of the page column: their width, measured as they draw
 * (it differs by edition, plan and role: the hosted edition adds the credit balance), as --candy-utilities, which a
 * page's header row (ui.module.css .pageHead) keeps clear. Where the browser can't measure (no ResizeObserver, as in
 * jsdom, and the server) the stylesheet's default holds.
 */

export function useUtilitiesRoom(ref: RefObject<HTMLElement | null>): CSSProperties {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => setWidth(Math.ceil(element.getBoundingClientRect().width))
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [ref])
  return width === null || width === 0 ? {} : ({ '--candy-utilities': `${width}px` } as CSSProperties)
}
