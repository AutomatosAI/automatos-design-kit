import { useCallback } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

/**
 * A modal sheet's keys: Escape closes it, and Tab and Shift+Tab go round the controls inside it, so the keyboard
 * never leaves the sheet for the page behind it while it is open.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function stopsIn(box: HTMLElement): readonly HTMLElement[] {
  return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/** Tab past the last control goes to the first; Shift+Tab before the first (or from the title) to the last. */
function goRound(event: KeyboardEvent<HTMLElement>, box: HTMLElement): void {
  const stops = stopsIn(box)
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (first === undefined || last === undefined) return
  const at = stops.indexOf(box.ownerDocument.activeElement as HTMLElement)
  if (event.shiftKey && at <= 0) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && at === stops.length - 1) {
    event.preventDefault()
    first.focus()
  }
}

export function useDialogKeys(box: RefObject<HTMLElement | null>, onClose: () => void): (event: KeyboardEvent<HTMLElement>) => void {
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'Tab' && box.current !== null) goRound(event, box.current)
    },
    [box, onClose],
  )
}
