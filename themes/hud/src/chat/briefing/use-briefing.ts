import { useCallback, useMemo, useState } from 'react'
import { type Brief, type ThemeStateOptions, useBrief, useThemeState, writeThemeState } from '@automatos/theme-sdk'

/**
 * HUD 1.2.0 (PRD-268): whether the core screen shows BRIEFING, held by the chat page so it outlives a conversation
 * switch and a window crossing the phone's width. The day's brief (the SDK's useBrief, which never builds one; the
 * host opens it as Automatos loads) shows once the host has it, until it folds back (BRIEFING's own 60 s, or any
 * press: use-fold.ts). Folded, that brief stays folded for the tab's session in this workspace, kept through the SDK's
 * storage area (FOLDED_KEY), so coming back to the chat never floods you with it again; where the host keeps no theme
 * state, it stays folded on this page. A new brief (another day, another state) shows again. No brief is a normal day:
 * with the workspace's proactive mode off the host's open is refused quietly (404 `brief_off`) and useBrief has no
 * data, so nothing shows and the screen is as it is without one; a brief still loading, or one that failed, is the same.
 */

/** The folded brief, kept for the tab's session in this workspace. */
export const FOLDED_KEY = 'hud-brief-folded'
export const FOLDED_STATE: ThemeStateOptions = Object.freeze({ lifetime: 'session', within: 'workspace' })

export interface Briefing {
  /** The brief to show now; null while there is none, or once it has folded. */
  readonly brief: Brief | null
  /** Folds it back: the screen as it is without a brief. */
  readonly fold: () => void
}

/** One brief, whatever copy of it the host hands out: its day and its state, not when the copy was made. */
export function briefKey(brief: Brief): string {
  return `${brief.date}|${brief.state_hash}`
}

export function useBriefing(): Briefing {
  const { data } = useBrief()
  const kept = useThemeState(FOLDED_KEY, FOLDED_STATE).value
  const [foldedHere, setFoldedHere] = useState<string | null>(null)
  const key = data === null ? null : briefKey(data)
  const shown = data !== null && key !== foldedHere && key !== kept ? data : null
  const fold = useCallback(() => {
    if (key === null) return
    setFoldedHere(key)
    writeThemeState(FOLDED_KEY, key, FOLDED_STATE)
  }, [key])
  return useMemo(() => ({ brief: shown, fold }), [shown, fold])
}
