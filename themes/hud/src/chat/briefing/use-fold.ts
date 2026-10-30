import { type RefObject, useEffect, useState } from 'react'

/**
 * HUD 1.2.0 (PRD-268): how BRIEFING folds back into the screen it stands in for, and how it knows Auto is reading it.
 *
 * - It folds after BRIEFING_MS, a clock that stands still while Auto reads the brief or the focus is inside it, and
 *   starts again from the top once neither is so.
 * - It folds on any press outside it: a pointer pressed anywhere else on the page, or a key pressed anywhere else.
 *   Escape folds it from anywhere. Tab and the modifier keys never do, so the keyboard can reach it, and a press inside
 *   it (Listen, a row's Start, a link) never does.
 * - The host's Listen (the SDK's BriefVoice) carries `data-voice-speaking="true"` on its root while Auto reads the
 *   brief; BRIEFING follows that mark to show `▸ SPEAKING`. HUD never speaks: the host's control reads the brief.
 */

/** How long BRIEFING stands before it folds back. */
export const BRIEFING_MS = 60_000
/** The host's Listen while Auto reads the brief. */
export const SPEAKING_ROOT = '[data-brief-voice="root"][data-voice-speaking="true"]'
const SPEAKING_ATTRIBUTE = 'data-voice-speaking'
const FOLD_KEY = 'Escape'
/** Keys that move the focus or change another key: they reach BRIEFING and never fold it. */
const PASSING_KEYS: ReadonlySet<string> = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const PRESSES = ['pointerdown', 'keydown'] as const

/** Whether a press folds BRIEFING (`panel`, its element). */
export function foldsOn(event: Event, panel: Element | null): boolean {
  if (event instanceof KeyboardEvent) {
    if (event.key === FOLD_KEY) return true
    if (PASSING_KEYS.has(event.key)) return false
  }
  const target = event.target
  return !(panel !== null && target instanceof Node && panel.contains(target))
}

/** Folds after BRIEFING_MS unless `held`, and on any press foldsOn counts. */
export function useFoldAway(fold: () => void, held: boolean, panel: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (held) return undefined
    const timer = setTimeout(fold, BRIEFING_MS)
    return () => clearTimeout(timer)
  }, [fold, held])
  useEffect(() => {
    const onPress = (event: Event): void => {
      if (foldsOn(event, panel.current)) fold()
    }
    PRESSES.forEach((type) => document.addEventListener(type, onPress, true))
    return () => PRESSES.forEach((type) => document.removeEventListener(type, onPress, true))
  }, [fold, panel])
}

/** True while the host's Listen inside `panel` reads the brief. */
export function useBriefSpeaking(panel: RefObject<HTMLElement | null>): boolean {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    const element = panel.current
    if (element === null) return undefined
    const read = (): void => setSpeaking(element.querySelector(SPEAKING_ROOT) !== null)
    read()
    if (typeof MutationObserver === 'undefined') return undefined
    const observer = new MutationObserver(read)
    observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: [SPEAKING_ATTRIBUTE] })
    return () => observer.disconnect()
  }, [panel])
  return speaking
}
