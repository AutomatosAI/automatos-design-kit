/**
 * PRD-268 Wave K (SDK 1.4.0): the brief row Auto is reading on the BriefVoice stand-in (src/sdk/brief-voice.tsx:
 * `data-voice-row` on its root and `onSpeakingRow`, driven by host.setBriefRow as core's speech events drive it), and
 * the brief's thumbs (src/sdk/proactive.ts useRateBrief: each kept as the body core posts to its digest feedback
 * route). Read through the SDK as a theme reads them; core's sdk-1.4.0.test.tsx and brief-voice-row.test.tsx hold the
 * same rules. Made-up data. A message's knownParts are message-parts.test.tsx's.
 */
import { BriefVoice, type RateBriefInput, useRateBrief } from '@automatos/theme-sdk'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '../src/host.ts'
import { SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { LISTEN_TO_THE_BRIEF } from '../src/sdk/brief-voice.tsx'

const BRIEF = SAMPLE_PAGE_DATA.brief
const ROOT = '[data-brief-voice="root"]'
const SDK_REFUSAL = /^Automatos theme SDK: /
const NOT_A_RATING = "useRateBrief needs the brief's state_hash and a rating of up or down."

/** A theme's error boundary: what the stand-in threw, as one line. */
class Caught extends Component<{ readonly children: ReactNode }, { readonly error: Error | null }> {
  override state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  override render() {
    return this.state.error === null ? this.props.children : <p role="alert">{this.state.error.message}</p>
  }
}

beforeEach(() => {
  host.reset()
  host.setPageQuery('useBrief', { data: BRIEF })
})

describe("BriefVoice's speaking row", () => {
  it('marks the row Auto reads on its root and tells onSpeakingRow each change once, null between rows and once it stops', () => {
    const onSpeakingRow = vi.fn<(row: number | null) => void>()
    const { container } = render(<BriefVoice onSpeakingRow={onSpeakingRow} />)
    const root = container.querySelector(ROOT)
    fireEvent.click(screen.getByRole('button', { name: LISTEN_TO_THE_BRIEF }))
    expect(root).toHaveAttribute('data-voice-speaking', 'true')
    expect(root).not.toHaveAttribute('data-voice-row')
    act(() => host.setBriefRow(0))
    expect(root).toHaveAttribute('data-voice-row', '0')
    act(() => host.setBriefRow(0))
    act(() => host.setBriefRow(null))
    expect(root).not.toHaveAttribute('data-voice-row')
    act(() => host.setBriefRow(2))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(root).not.toHaveAttribute('data-voice-row')
    expect(onSpeakingRow.mock.calls.map(([row]) => row)).toEqual([0, null, 2, null])
  })

  it('starts the reading with a row, tells null when it leaves the page mid-row, and logs a handler that throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const heard: Array<number | null> = []
    const onSpeakingRow = (row: number | null): void => {
      heard.push(row)
      throw new Error('a theme bug')
    }
    const { container, unmount } = render(<BriefVoice onSpeakingRow={onSpeakingRow} />)
    act(() => host.setBriefRow(1))
    expect(container.querySelector(ROOT)).toHaveAttribute('data-voice-speaking', 'true')
    expect(container.querySelector(ROOT)).toHaveAttribute('data-voice-row', '1')
    unmount()
    expect(heard).toEqual([1, null])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('reads no row once a voice session starts, and draws as before with no props', () => {
    const { container } = render(<BriefVoice />)
    act(() => host.setBriefRow(3))
    act(() => host.setVoicePhase('listening'))
    expect(container.querySelector(ROOT)).not.toHaveAttribute('data-voice-speaking')
    expect(container.querySelector(ROOT)).not.toHaveAttribute('data-voice-row')
  })

  it("refuses an onSpeakingRow that isn't a function, naming it, and a row that isn't a brief row's index", () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Caught><BriefVoice onSpeakingRow={'row' as unknown as (row: number | null) => void} /></Caught>)
    expect(screen.getByRole('alert')).toHaveTextContent('Automatos theme SDK: BriefVoice needs onSpeakingRow to be a function.')
    expect(() => host.setBriefRow(-1)).toThrow(TypeError)
    expect(() => host.setBriefRow(1.5)).toThrow(TypeError)
    quiet.mockRestore()
  })
})

describe('useRateBrief, the brief\'s thumbs', () => {
  it('keeps each thumb as the body core posts, 1 for up and -1 for down, and answers what a test set', async () => {
    const answered: unknown[] = []
    host.setPageAction('useRateBrief', (body) => {
      answered.push(body)
      return { ok: true }
    })
    const { result } = renderHook(() => useRateBrief())
    const rated = await act(() => result.current.runAsync({ state_hash: BRIEF.state_hash, rating: 'up' }))
    await act(() => result.current.runAsync({ state_hash: BRIEF.state_hash, rating: 'down' }))
    expect(rated).toEqual({ ok: true })
    expect(result.current.result).toEqual({ ok: true })
    const posted = [{ state_hash: BRIEF.state_hash, rating: 1 }, { state_hash: BRIEF.state_hash, rating: -1 }]
    expect(host.pageRuns()).toEqual(posted.map((variables) => ({ hook: 'useRateBrief', variables })))
    expect(answered).toEqual(posted)
  })

  it("refuses a state_hash that isn't some text and a rating that is neither up nor down, before anything is kept", async () => {
    const { result } = renderHook(() => useRateBrief())
    expect(() => result.current.run({ state_hash: ' ', rating: 'up' })).toThrow(SDK_REFUSAL)
    const sideways = { state_hash: BRIEF.state_hash, rating: 'sideways' } as unknown as RateBriefInput
    await expect(result.current.runAsync(sideways)).rejects.toThrow(NOT_A_RATING)
    await expect(result.current.runAsync({ state_hash: 7, rating: 'up' } as unknown as RateBriefInput)).rejects.toThrow(NOT_A_RATING)
    expect(host.pageRuns()).toEqual([])
  })
})
