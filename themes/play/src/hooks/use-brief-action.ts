'use client'

import { useCallback } from 'react'
import {
  type BriefRow,
  useCoreNav,
  useHideSuggestion,
  useHostRouter,
  useStartSuggestion,
} from '@automatos/theme-sdk'

import { briefStepOf, settingsHrefOf } from '../components/play/proactive/brief-rows'

/**
 * Play 1.3.0 (PRD-268 §6.12.3) — the brief card's row action (BriefCard's `onAction`): Start or Hide a suggestion's row
 * through the proactive area, or go where the row opens (brief-rows.ts). It resolves once the action went through, so
 * the card shows "✓ {done_label}" in place, and rejects when the row has nowhere to go or the server refused, so the
 * row stays as it was.
 */

/** Why a row's press did nothing: it names no suggestion and opens nowhere this caller can go. */
export const NOWHERE_TO_GO = 'This row has nowhere to go.'

export function useBriefAction(): (row: BriefRow) => Promise<unknown> {
  const { runAsync: start } = useStartSuggestion()
  const { runAsync: hide } = useHideSuggestion()
  const router = useHostRouter()
  const settingsHref = settingsHrefOf(useCoreNav().footer)
  return useCallback(
    (row: BriefRow): Promise<unknown> => {
      try {
        const step = briefStepOf(row, settingsHref)
        if (step === null) return Promise.reject(new Error(NOWHERE_TO_GO))
        if (step.kind === 'start') return start({ id: step.id })
        if (step.kind === 'hide') return hide({ id: step.id })
        router.push(step.href)
        return Promise.resolve(step.href)
      } catch (failure) {
        return Promise.reject(failure)
      }
    },
    [start, hide, router, settingsHref],
  )
}
