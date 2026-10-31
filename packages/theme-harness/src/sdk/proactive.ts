/**
 * PRD-268 (SDK 1.3.0): the fake of SDK area `proactive`. It mirrors core's frontend/lib/theme-sdk/proactive.ts (at
 * 1a8956c874dc42cff05b96f431c50b7d722a71aa) in the page areas' frozen views (src/internal/page-views.ts):
 *
 * - useBrief, useReadiness and useSuggestions answer what a test set (host.setPageQuery), loading until then. The day's
 *   brief exists only while the workspace's proactive mode is shadow or live; otherwise core's open answers 404
 *   `brief_off` and the host stays quiet, so useBrief is null and not loading: a test sets that with 'idle', the
 *   brief's normal state on a day without one.
 * - useCheckReadiness, useStartSuggestion and useHideSuggestion run as the page areas' writes (host.setPageAction; null
 *   until a test sets an answer), each kept with the variables core would send (host.pageRuns()). An id that isn't a
 *   suggestion's, or a reason Hide doesn't know, throws a TypeError before anything is kept, as core's does.
 * - useCalibration and useAnswerCalibration are inert, as core's are until the server offers calibration: nothing
 *   offered, `available` false, and an answer refused ("not available on this server") with nothing kept. A test that
 *   draws calibration ahead of the server offers one (host.setCalibration); answers are then kept as runs.
 */
import type {
  Brief, Calibration, CalibrationAction, CalibrationAnswer, CalibrationQuery, HideAnswer, HideReason, HideSuggestionInput, Readiness,
  StartAnswer, StartSuggestionInput, Suggestion,
} from '@automatos/theme-sdk'
import { useMemo, useState } from 'react'
import { cell, refuse } from '../internal/cell.ts'
import { frozenCopy, messageOf, usePageAction, usePageQuery } from '../internal/page-views.ts'
import { HIDE_REASONS, isProactiveId } from '../internal/proactive/wire.ts'

type Sdk = typeof import('@automatos/theme-sdk')

const NO_ARGS: readonly unknown[] = Object.freeze([])
const NO_OP = (): void => undefined
/** hooks/use-calibration.ts CALIBRATION_UNAVAILABLE: why an answer is refused while nothing is offered. */
export const CALIBRATION_UNAVAILABLE = 'not available on this server'
const NOT_A_SUGGESTION_ID = 'needs the id of a suggestion from useSuggestions.'
const NOT_A_HIDE_REASON = `useHideSuggestion needs reason to be one of ${HIDE_REASONS.join(', ')}.`
const NOT_AN_ANSWER = 'useAnswerCalibration needs a calibration_id with an accept, or a reject and its line_id.'

/** The calibration the fake server offers; null: none, as core's server today. */
const offered = cell<Calibration | null>(null)

function checkedStart(input: StartSuggestionInput): StartSuggestionInput {
  return isProactiveId(input?.id) ? { id: input.id } : refuse(`useStartSuggestion ${NOT_A_SUGGESTION_ID}`)
}

function checkedReason(reason: unknown): HideReason | undefined {
  if (reason === undefined) return undefined
  return HIDE_REASONS.find((known) => known === reason) ?? refuse(NOT_A_HIDE_REASON)
}

function checkedHide(input: HideSuggestionInput): HideSuggestionInput {
  if (!isProactiveId(input?.id)) return refuse(`useHideSuggestion ${NOT_A_SUGGESTION_ID}`)
  const reason = checkedReason(input.reason)
  return reason === undefined ? { id: input.id } : { id: input.id, reason }
}

const someText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

/** proactive.ts checkedAnswer: an accept, or a reject of one line, as the host sends it; else a TypeError. */
function checkedAnswer(answer: CalibrationAnswer): CalibrationAnswer {
  const id = answer?.calibration_id
  if (!someText(id)) return refuse(NOT_AN_ANSWER)
  if (answer.answer === 'accept') return { calibration_id: id, answer: 'accept' }
  if (answer.answer === 'reject' && someText(answer.line_id)) return { calibration_id: id, answer: 'reject', line_id: answer.line_id }
  return refuse(NOT_AN_ANSWER)
}

/** proactive.ts:158. */
export const useBrief = (() => usePageQuery<Brief>('useBrief', NO_ARGS)) satisfies Sdk['useBrief']

/** proactive.ts:163. */
export const useReadiness = (() => usePageQuery<Readiness>('useReadiness', NO_ARGS)) satisfies Sdk['useReadiness']

/** proactive.ts:168: Check again sends nothing. */
export const useCheckReadiness = (() => usePageAction<void, Readiness>('useCheckReadiness')) satisfies Sdk['useCheckReadiness']

/** proactive.ts:173. */
export const useSuggestions = (() => usePageQuery<readonly Suggestion[]>('useSuggestions', NO_ARGS)) satisfies Sdk['useSuggestions']

/** proactive.ts:178. */
export const useStartSuggestion = (() =>
  usePageAction<StartSuggestionInput, StartAnswer>('useStartSuggestion', checkedStart)) satisfies Sdk['useStartSuggestion']

/** proactive.ts:183. */
export const useHideSuggestion = (() =>
  usePageAction<HideSuggestionInput, HideAnswer>('useHideSuggestion', checkedHide)) satisfies Sdk['useHideSuggestion']

/** proactive.ts:188: none offered, and nothing asked, until a test offers one. */
export const useCalibration = ((): CalibrationQuery => {
  const calibration = offered.use()
  return useMemo(() => Object.freeze({
    data: calibration === null ? null : frozenCopy(calibration),
    available: calibration !== null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: NO_OP,
  }), [calibration])
}) satisfies Sdk['useCalibration']

/** use-calibration.ts NOTHING_ASKED: the answer is checked, then refused with nothing kept. */
function useRefusedAnswer(): CalibrationAction {
  const [error, setError] = useState<string | null>(null)
  return useMemo(() => {
    const send = (answer: CalibrationAnswer): Promise<void> => {
      checkedAnswer(answer)
      return Promise.reject(new Error(CALIBRATION_UNAVAILABLE))
    }
    return Object.freeze({
      available: false,
      run: (answer: CalibrationAnswer) => {
        void send(answer).catch((failure: unknown) => setError(messageOf(failure)))
      },
      runAsync: (answer: CalibrationAnswer) => new Promise<void>((resolve, reject) => {
        void send(answer).then(resolve, reject)
      }),
      isRunning: false,
      error,
      result: null,
      reset: () => setError(null),
    })
  }, [error])
}

/** proactive.ts:203: refused while nothing is offered; once a test offers one, a write kept as a run. */
export const useAnswerCalibration = ((): CalibrationAction => {
  const calibration = offered.use()
  const refused = useRefusedAnswer()
  const answering = usePageAction<CalibrationAnswer, void>('useAnswerCalibration', checkedAnswer)
  return useMemo(
    () => (calibration === null ? refused : Object.freeze({ ...answering, result: null, available: true })),
    [calibration, refused, answering],
  )
}) satisfies Sdk['useAnswerCalibration']

/** The controls of this area, gathered by host.ts. */
export const proactiveControls = Object.freeze({
  /** The calibration the fake server offers from now on; null: none (core's server today, and the default). */
  setCalibration(calibration: Calibration | null): void {
    offered.set(calibration === null ? null : frozenCopy(calibration))
  },
})

export function resetProactive(): void {
  offered.set(null)
}
