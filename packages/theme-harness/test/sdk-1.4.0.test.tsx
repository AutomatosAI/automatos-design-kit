/**
 * PRD-268 Wave K (SDK 1.4.0): the brief row Auto is reading on the BriefVoice stand-in (src/sdk/brief-voice.tsx:
 * `data-voice-row` on its root and `onSpeakingRow`, driven by host.setBriefRow as core's speech events drive it), and
 * the brief's thumbs (src/sdk/proactive.ts useRateBrief: each kept as the body core posts to its digest feedback
 * route; given the brief's state_hash, the person's own rating of it, shared with the BriefCard stand-in's thumbs, which
 * `thumbs={false}` leaves out). Read through the SDK as a theme reads them; core's sdk-1.4.0.test.tsx and
 * brief-voice-row.test.tsx hold the same rules. Made-up data. A message's knownParts are message-parts.test.tsx's.
 */
import { BriefCard, BriefVoice, type RateBriefInput, useRateBrief } from '@automatos/theme-sdk'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { host } from '../src/host.ts'
import { SAMPLE_PAGE_DATA } from '../src/host/sample-data.ts'
import { LISTEN_TO_THE_BRIEF } from '../src/sdk/brief-voice.tsx'
import { RATE_LABEL, THUMBS } from '../src/sdk/cards/brief-card.tsx'

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

describe("useRateBrief's rating, the person's own", () => {
  it('is null until rated, and none read without a brief: nothing, or an empty state_hash while it loads', () => {
    expect(renderHook(() => useRateBrief(BRIEF.state_hash)).result.current.rating).toBeNull()
    act(() => host.setBriefRating(BRIEF.state_hash, 'up'))
    expect(renderHook(() => useRateBrief()).result.current.rating).toBeNull()
    expect(renderHook(() => useRateBrief('')).result.current.rating).toBeNull()
    expect(renderHook(() => useRateBrief(null)).result.current.rating).toBeNull()
  })

  it('is what the server remembers for that brief, and the last post it answered: a second press changes it', async () => {
    host.setPageAction('useRateBrief', () => ({ ok: true }))
    act(() => host.setBriefRating(BRIEF.state_hash, 'down'))
    const { result } = renderHook(() => useRateBrief(BRIEF.state_hash))
    expect(result.current.rating).toBe('down')
    await act(() => result.current.runAsync({ state_hash: BRIEF.state_hash, rating: 'up' }))
    expect(result.current.rating).toBe('up')
    act(() => result.current.run({ state_hash: BRIEF.state_hash, rating: 'down' }))
    await waitFor(() => expect(result.current.rating).toBe('down'))
    expect(renderHook(() => useRateBrief('another-brief')).result.current.rating).toBeNull()
  })

  it('stays as it was when the post is refused', async () => {
    host.setPageAction('useRateBrief', () => Promise.reject(new Error('refused')))
    const { result } = renderHook(() => useRateBrief(BRIEF.state_hash))
    await act(() => expect(result.current.runAsync({ state_hash: BRIEF.state_hash, rating: 'up' })).rejects.toThrow('refused'))
    expect(result.current.rating).toBeNull()
    expect(result.current.error).toBe('refused')
  })

  it("refuses a brief that isn't text, and host.setBriefRating anything but a state_hash with up, down or null", () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useRateBrief(7 as unknown as string))).toThrow(SDK_REFUSAL)
    quiet.mockRestore()
    expect(() => host.setBriefRating(' ', 'up')).toThrow(TypeError)
    expect(() => host.setBriefRating(BRIEF.state_hash, 'sideways' as unknown as 'up')).toThrow(TypeError)
  })

  it('is forgotten by the reset', () => {
    act(() => host.setBriefRating(BRIEF.state_hash, 'up'))
    act(() => host.reset())
    expect(renderHook(() => useRateBrief(BRIEF.state_hash)).result.current.rating).toBeNull()
  })
})

describe("BriefCard's thumbs", () => {
  const thumbs = () => screen.queryByRole('group', { name: RATE_LABEL })
  const thumb = (name: string) => screen.getByRole('button', { name })

  it('show the rating useRateBrief posted', async () => {
    host.setPageAction('useRateBrief', () => ({ ok: true }))
    const { result } = renderHook(() => useRateBrief(BRIEF.state_hash))
    render(<BriefCard brief={BRIEF} listen={false} />)
    await act(() => result.current.runAsync({ state_hash: BRIEF.state_hash, rating: 'down' }))
    expect(thumb(THUMBS.notHelpful)).toHaveAttribute('aria-pressed', 'true')
    expect(thumb(THUMBS.helpful)).toHaveAttribute('aria-pressed', 'false')
    expect(thumb(THUMBS.helpful)).toBeDisabled()
  })

  it("show a press on the card in useRateBrief's rating, kept where core posts it", () => {
    const { result } = renderHook(() => useRateBrief(BRIEF.state_hash))
    render(<BriefCard brief={BRIEF} listen={false} />)
    fireEvent.click(thumb(THUMBS.helpful))
    expect(result.current.rating).toBe('up')
    expect(host.cardActions()).toEqual([{ card: 'brief-card', id: BRIEF.state_hash, action: 'helpful' }])
  })

  it('show the rating the server remembers, done: neither thumb takes a press', () => {
    act(() => host.setBriefRating(BRIEF.state_hash, 'up'))
    render(<BriefCard brief={BRIEF} listen={false} />)
    expect(thumb(THUMBS.helpful)).toHaveAttribute('aria-pressed', 'true')
    expect(thumb(THUMBS.notHelpful)).toBeDisabled()
    fireEvent.click(thumb(THUMBS.notHelpful))
    expect(host.cardActions()).toEqual([])
  })

  it('are none with thumbs={false}, for a theme that draws its own beside the card; anything but true or false is refused', () => {
    render(<BriefCard brief={BRIEF} listen={false} thumbs={false} />)
    expect(thumbs()).toBeNull()
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(<Caught><BriefCard brief={BRIEF} listen={false} thumbs={'no' as unknown as boolean} /></Caught>)
    expect(screen.getByRole('alert')).toHaveTextContent(SDK_REFUSAL)
    quiet.mockRestore()
  })
})
