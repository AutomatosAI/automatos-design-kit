import { type RefObject, useEffect, useState } from 'react'

/**
 * HUD 1.2.0 (PRD-268): how BRIEFING folds back into the screen it stands in for, and how it knows Auto is reading it.
 *
 * - It folds after BRIEFING_MS, a clock that stands still while Auto reads the brief or the focus is inside it, and
 *   starts again from the top once neither is so. The focus is read again whenever the panel's content changes, so a
 *   focused control that leaves it (Listen giving way to Stop, Start to "✓ Started") never holds the clock for good.
 * - It folds on any press outside it: a pointer pressed anywhere else on the page, or a key pressed anywhere else (the
 *   press still does what it does there). Escape folds it from anywhere. Tab and the modifier keys never do, so the
 *   keyboard can reach it, and a press inside it (Listen, a row's Start, a link) never does. Folded with the focus
 *   inside it, the focus goes to the screen's heading rather than dropping to the page.
 * - The host's Listen (the SDK's BriefVoice) carries `data-voice-speaking="true"` on its root while Auto reads the
 *   brief; BRIEFING follows that mark to show `▸ SPEAKING`. HUD never speaks: the host's control reads the brief.
 */

/** How long BRIEFING stands before it folds back. */
export const BRIEFING_MS = 60_000
/** The host's Listen while Auto reads the brief. */
export const SPEAKING_ROOT = '[data-brief-voice="root"][data-voice-speaking="true"]'
/** The screen's heading (src/theme.ts THEME_HEADING), which takes the focus when BRIEFING folds from under it. */
export const SCREEN_HEADING = 'h1[data-theme-heading]'
const SPEAKING_ATTRIBUTE = 'data-voice-speaking'
const FOLD_KEY = 'Escape'
/** Keys that move the focus or change another key: they reach BRIEFING and never fold it. */
const PASSING_KEYS: ReadonlySet<string> = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock'])
const PRESSES = ['pointerdown', 'keydown'] as const

export interface PanelHold {
  /** The host's Listen inside the panel reads the brief. */
  readonly speaking: boolean
  /** The focus is inside the panel. */
  readonly focused: boolean
}

const AT_REST: PanelHold = { speaking: false, focused: false }

/** Whether a press folds BRIEFING (`panel`, its element). */
export function foldsOn(event: Event, panel: Element | null): boolean {
  if (event instanceof KeyboardEvent) {
    if (event.key === FOLD_KEY) return true
    if (PASSING_KEYS.has(event.key)) return false
  }
  const target = event.target
  return !(panel !== null && target instanceof Node && panel.contains(target))
}

/** Folds, handing the focus to the screen's heading when it was inside the panel. */
function foldFrom(panel: Element | null, fold: () => void): void {
  const hadFocus = panel !== null && panel.contains(document.activeElement)
  fold()
  if (hadFocus) document.querySelector<HTMLElement>(SCREEN_HEADING)?.focus()
}

/** Folds after BRIEFING_MS unless `held`, and on any press foldsOn counts. */
export function useFoldAway(fold: () => void, held: boolean, panel: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (held) return undefined
    const timer = setTimeout(() => foldFrom(panel.current, fold), BRIEFING_MS)
    return () => clearTimeout(timer)
  }, [fold, held, panel])
  useEffect(() => {
    const onPress = (event: Event): void => {
      if (foldsOn(event, panel.current)) foldFrom(panel.current, fold)
    }
    PRESSES.forEach((type) => document.addEventListener(type, onPress, true))
    return () => PRESSES.forEach((type) => document.removeEventListener(type, onPress, true))
  }, [fold, panel])
}

/** Whether the host's Listen inside `panel` reads the brief, and whether the focus is inside it. */
export function usePanelHold(panel: RefObject<HTMLElement | null>): PanelHold {
  const [hold, setHold] = useState<PanelHold>(AT_REST)
  useEffect(() => {
    const element = panel.current
    if (element === null) return undefined
    const read = (focused: boolean): void => {
      const speaking = element.querySelector(SPEAKING_ROOT) !== null
      setHold((was) => (was.speaking === speaking && was.focused === focused ? was : { speaking, focused }))
    }
    const onChange = (): void => read(element.contains(document.activeElement))
    const onFocusIn = (): void => read(true)
    const onFocusOut = (event: FocusEvent): void => read(element.contains(event.relatedTarget as Node | null))
    onChange()
    element.addEventListener('focusin', onFocusIn)
    element.addEventListener('focusout', onFocusOut)
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(onChange)
    observer?.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: [SPEAKING_ATTRIBUTE] })
    return () => {
      observer?.disconnect()
      element.removeEventListener('focusin', onFocusIn)
      element.removeEventListener('focusout', onFocusOut)
    }
  }, [panel])
  return hold
}
