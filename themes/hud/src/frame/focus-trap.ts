import type { KeyboardEvent } from 'react'

/**
 * The phone's menu keeps the keyboard inside it while it is open (WAI-ARIA's modal dialog): Tab from its last control
 * goes to its first, Shift+Tab from its first to its last, a Tab from a part of it Tab doesn't stop on goes to its
 * first (or, backwards, its last), and Esc closes it.
 * Only a key pressed inside the menu's own elements counts: a host menu the menu holds (the header utilities' popovers)
 * may render elsewhere in the page, and its keys stay its own, Esc included. The rest of the page is inert while the
 * menu is open (src/frame/hud-frame.tsx), so a pointer or a screen reader can't leave it either.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** The controls inside `container` the keyboard reaches, in the page's order; none inside a hidden or inert part. */
export function focusables(container: HTMLElement): HTMLElement[] {
  const found = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
  return found.filter((element) => element.closest('[hidden], [inert]') === null)
}

/** The control Tab moves to from `active`, or null when the browser's own Tab stays inside the container. */
function wrapTarget(controls: readonly HTMLElement[], active: Element | null, backwards: boolean): HTMLElement | null {
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (first === undefined || last === undefined) return null
  const inside = active !== null && controls.includes(active as HTMLElement)
  if (!inside) return backwards ? last : first
  if (backwards) return active === first ? last : null
  return active === last ? first : null
}

/** Tab and Shift+Tab wrap inside `container`; Esc calls `onEscape`. Keys from outside its elements pass. */
export function trapKey(event: KeyboardEvent<HTMLElement>, container: HTMLElement, onEscape: () => void): void {
  if (!(event.target instanceof Node) || !container.contains(event.target)) return
  if (event.key === 'Escape') {
    event.preventDefault()
    onEscape()
    return
  }
  if (event.key !== 'Tab') return
  const target = wrapTarget(focusables(container), document.activeElement, event.shiftKey)
  if (target === null) return
  event.preventDefault()
  target.focus()
}
