// PRD-268 (SDK 1.3.0): the fake proactive area, read through the SDK as a theme reads it (src/sdk/proactive.ts). Its
// reads are loading until a test answers them, and a brief may be 'idle': no data and not loading, the normal day
// when the workspace's brief is off (core's open answers 404 brief_off and the host stays quiet). Start, Hide and
// Check again are kept as runs with core's variables, an id that isn't a suggestion's or an unknown reason refused
// first; calibration is inert, as core's is, until a test offers one.
import {
  useAnswerCalibration, useBrief, useCalibration, useCheckReadiness, useHideSuggestion, useReadiness, useStartSuggestion,
  useSuggestions, type Brief, type CalibrationAction, type CalibrationQuery, type HideSuggestionInput,
} from '@automatos/theme-sdk'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '../src/host.ts'
import { SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { CALIBRATION_UNAVAILABLE } from '../src/sdk/proactive.ts'

const SUGGESTION_ID = SAMPLE_PAGE_DATA.suggestions[0].id
const NOT_AN_ID = '../../admin'
const SDK_REFUSAL = /^Automatos theme SDK: /
const ACCEPT = Object.freeze({ calibration_id: SAMPLE_PAGE_DATA.calibration.id, answer: 'accept' as const })

/** The brief as a theme's chat reads it: loading, none today, or its greeting. */
function BriefLine() {
  const brief = useBrief()
  const line = brief.isLoading ? 'loading' : brief.data === null ? `no brief${brief.error ? `: ${brief.error}` : ''}` : brief.data.greeting
  return <p data-testid="brief">{line}</p>
}

const briefLine = (): string => screen.getByTestId('brief').textContent ?? ''

beforeEach(() => {
  host.reset()
})

describe("the proactive area's reads", () => {
  it('are loading until a test answers them, and ask for what they read', () => {
    const { result } = renderHook(() => ({ brief: useBrief(), readiness: useReadiness(), suggestions: useSuggestions() }))
    const { brief, readiness, suggestions } = result.current
    expect([brief.isLoading, readiness.isLoading, suggestions.isLoading]).toEqual([true, true, true])
    expect(host.pageAsks().map((ask) => ask.hook)).toEqual(['useBrief', 'useReadiness', 'useSuggestions'])
  })

  it("answer the day's brief, and no brief today as a quiet, finished read: no data, not loading, no error", () => {
    render(<BriefLine />)
    expect(briefLine()).toBe('loading')
    act(() => host.setPageQuery('useBrief', { data: SAMPLE_PAGE_DATA.brief }))
    expect(briefLine()).toBe('Morning.')
    act(() => host.setPageQuery('useBrief', 'idle'))
    expect(briefLine()).toBe('no brief')
  })

  it('hand back frozen copies', () => {
    host.setPageQuery('useBrief', { data: SAMPLE_PAGE_DATA.brief })
    host.setPageQuery('useSuggestions', { data: SAMPLE_PAGE_DATA.suggestions })
    const { result } = renderHook(() => ({ brief: useBrief().data as Brief, suggestions: useSuggestions().data }))
    expect(Object.isFrozen(result.current.brief.sections.needs_you[0])).toBe(true)
    expect(result.current.brief).not.toBe(SAMPLE_PAGE_DATA.brief)
    expect(result.current.suggestions?.map((row) => row.id)).toEqual(SAMPLE_PAGE_DATA.suggestions.map((row) => row.id))
  })
})

describe("the proactive area's writes", () => {
  it('Start and Hide are kept with the variables core sends, and answer what a test set', async () => {
    const started = { ...SAMPLE_PAGE_DATA.suggestions[0], status: 'started' as const }
    host.setPageAction('useStartSuggestion', () => ({ suggestion: started, opens: { type: 'board_task', board_task_id: 7 } }))
    const { result } = renderHook(() => ({ start: useStartSuggestion(), hide: useHideSuggestion() }))
    const answer = await act(() => result.current.start.runAsync({ id: SUGGESTION_ID }))
    await act(() => result.current.hide.runAsync({ id: SUGGESTION_ID, reason: 'not_now' }))
    await act(() => result.current.hide.runAsync({ id: SUGGESTION_ID }))
    expect(answer.opens).toEqual({ type: 'board_task', board_task_id: 7 })
    expect(host.pageRuns()).toEqual([
      { hook: 'useStartSuggestion', variables: { id: SUGGESTION_ID } },
      { hook: 'useHideSuggestion', variables: { id: SUGGESTION_ID, reason: 'not_now' } },
      { hook: 'useHideSuggestion', variables: { id: SUGGESTION_ID } },
    ])
  })

  it("refuse an id that isn't a suggestion's, and a reason Hide doesn't know, before anything is kept", async () => {
    const { result } = renderHook(() => ({ start: useStartSuggestion(), hide: useHideSuggestion() }))
    expect(() => result.current.start.run({ id: NOT_AN_ID })).toThrow(SDK_REFUSAL)
    const shouting = { id: SUGGESTION_ID, reason: 'shouting' } as unknown as HideSuggestionInput
    await expect(result.current.hide.runAsync(shouting)).rejects.toThrow(/reason to be one of not_now, not_useful, wrong_agent/)
    expect(host.pageRuns()).toEqual([])
  })

  it('Check again is kept, and its refusal is its error', async () => {
    host.setPageAction('useCheckReadiness', () => {
      throw new Error('Checked a moment ago.')
    })
    const { result } = renderHook(() => useCheckReadiness())
    act(() => result.current.run())
    await waitFor(() => expect(result.current.error).toBe('Checked a moment ago.'))
    expect(host.pageRuns()).toEqual([{ hook: 'useCheckReadiness', variables: undefined }])
  })
})

describe('calibration', () => {
  const read = (): { calibration: CalibrationQuery; answer: CalibrationAction } => ({
    calibration: useCalibration(), answer: useAnswerCalibration(),
  })

  it('is inert, as core is until the server offers it: nothing offered, and an answer refused with nothing kept', async () => {
    const { result } = renderHook(read)
    expect(result.current.calibration).toMatchObject({ data: null, available: false, isLoading: false, error: null })
    expect(result.current.answer.available).toBe(false)
    await expect(result.current.answer.runAsync(ACCEPT)).rejects.toThrow(CALIBRATION_UNAVAILABLE)
    act(() => result.current.answer.run(ACCEPT))
    await waitFor(() => expect(result.current.answer.error).toBe(CALIBRATION_UNAVAILABLE))
    expect(() => result.current.answer.run({ calibration_id: '', answer: 'accept' })).toThrow(SDK_REFUSAL)
    expect(host.pageRuns()).toEqual([])
  })

  it('once a test offers one, it is read and its answers are kept as runs', async () => {
    host.setCalibration(SAMPLE_PAGE_DATA.calibration)
    const { result } = renderHook(read)
    expect([result.current.calibration.available, result.current.calibration.data?.id]).toEqual([true, SAMPLE_PAGE_DATA.calibration.id])
    await act(() => result.current.answer.runAsync({ calibration_id: ACCEPT.calibration_id, answer: 'reject', line_id: 'line-1' }))
    expect(host.pageRuns()).toEqual([
      { hook: 'useAnswerCalibration', variables: { calibration_id: ACCEPT.calibration_id, answer: 'reject', line_id: 'line-1' } },
    ])
    expect(result.current.answer.result).toBeNull()
    act(() => host.reset())
    expect(result.current.calibration.available).toBe(false)
  })
})
