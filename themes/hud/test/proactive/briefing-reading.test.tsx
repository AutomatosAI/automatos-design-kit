// HUD 1.3.0 (PRD-268, SDK 1.4.0): BRIEFING built in time with Auto's voice, and the brief's thumbs, on the harness's
// BriefVoice stand-in (host.setBriefRow tells its onSpeakingRow the row Auto reads, as the speech's events do in core)
// and its useRateBrief (kept with the body core posts). While Auto reads, the rows he hasn't reached aren't drawn, the
// ones he has are, and `▸` marks the one he reads, the same row the host's Listen marks with data-voice-row; once he
// stops, every row is drawn plainly. Under reduced motion every row is drawn at once and only the marker moves. The
// thumbs, in BRIEFING's footer, rate the brief once per viewer: up is 1 and down -1 with its state_hash; rated, the
// thumb given stays pressed and neither takes a press again, kept for this workspace; refused, they say why and can be
// tried again, the route failing or answering that it didn't take it; a new brief is rated afresh. The thumbs stay
// focusable once rated (aria-disabled), so the focus never drops to the page. Roles, names and attributes only; every
// value is made up.
import { readThemeState } from '@automatos/theme-sdk'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { host } from '@automatos/theme-harness/host'
import { BRIEFING_TITLE } from '../../src/chat/briefing/briefing-panel.tsx'
import { READING_MARK } from '../../src/chat/briefing/briefing-row.tsx'
import { RATED_LINE, THUMB_WORDS, THUMBS_LABEL } from '../../src/chat/briefing/brief-thumbs.tsx'
import { RATE_REFUSED, RATED_KEY, RATED_STATE } from '../../src/chat/briefing/use-brief-rating.ts'
import { briefKey } from '../../src/chat/briefing/use-briefing.ts'
import { renderChat, stubClips } from '../chat/support.tsx'
import { BRIEF } from './support.ts'

const LISTEN = 'Listen to the brief'
const briefing = (): HTMLElement => screen.getByRole('region', { name: BRIEFING_TITLE })
const showBrief = (brief = BRIEF): void => act(() => host.setPageQuery('useBrief', { data: brief }))
/** BRIEFING's rows, whether drawn or not (jsdom applies no CSS). */
const rows = (): HTMLElement[] => Array.from(briefing().querySelectorAll<HTMLElement>('li[data-row-id]'))
const readings = (): (string | null)[] => rows().map((row) => row.getAttribute('data-reading'))
const markers = (): (string | null)[] => rows().map((row) => row.children[1]?.textContent ?? null)
const listenRoot = (): Element | null => briefing().querySelector('[data-brief-voice="root"]')
const thumb = (words: string): HTMLElement => within(briefing()).getByRole('button', { name: words })
const rateRuns = () => host.pageRuns().filter((run) => run.hook === 'useRateBrief')

async function readRow(row: number | null): Promise<void> {
  await act(async () => {
    host.setBriefRow(row)
  })
}

async function pressListen(): Promise<void> {
  await act(async () => {
    fireEvent.click(within(briefing()).getByRole('button', { name: LISTEN }))
  })
}

beforeEach(() => {
  host.reset()
  stubClips()
})

describe('rows built in time with speech', () => {
  it("draws no row until Auto reaches it, marks the one he reads as Listen does, and keeps the ones he read", async () => {
    await renderChat()
    showBrief()
    expect(readings()).toEqual([null, null, null, null])
    await pressListen()
    expect(readings()).toEqual(['ahead', 'ahead', 'ahead', 'ahead'])
    expect(briefing().querySelector('ol')).toHaveAttribute('data-build', 'true')
    await readRow(0)
    expect(readings()).toEqual(['now', 'ahead', 'ahead', 'ahead'])
    expect(markers()).toEqual([READING_MARK, '', '', ''])
    expect(rows()[0]).toHaveAttribute('aria-current', 'true')
    expect(listenRoot()).toHaveAttribute('data-voice-row', '0')
    await readRow(null)
    expect(readings()).toEqual(['read', 'ahead', 'ahead', 'ahead'])
    expect(markers()).toEqual(['', '', '', ''])
    await readRow(2)
    expect(readings()).toEqual(['read', 'read', 'now', 'ahead'])
    expect(rows()[2]).toHaveAttribute('aria-current', 'true')
    expect(listenRoot()).toHaveAttribute('data-voice-row', '2')
  })
})

describe('rows once Auto stops, and under reduced motion', () => {
  it('draws every row plainly once Auto stops, and starts from the top on the next reading', async () => {
    await renderChat()
    showBrief()
    await readRow(3)
    expect(readings()).toEqual(['read', 'read', 'read', 'now'])
    await act(async () => {
      host.setBriefReading(false)
    })
    expect(readings()).toEqual([null, null, null, null])
    expect(markers()).toEqual(['', '', '', ''])
    expect(rows().filter((row) => row.hasAttribute('aria-current'))).toEqual([])
    await pressListen()
    expect(readings()).toEqual(['ahead', 'ahead', 'ahead', 'ahead'])
  })

  it('draws every row at once under reduced motion, only the marker moving with the row Auto reads', async () => {
    host.setReducedMotion(true)
    await renderChat()
    showBrief()
    await pressListen()
    expect(readings()).toEqual([null, null, null, null])
    expect(briefing().querySelector('ol')).not.toHaveAttribute('data-build')
    await readRow(1)
    expect(readings()).toEqual([null, 'now', null, null])
    expect(markers()).toEqual(['', READING_MARK, '', ''])
    await readRow(3)
    expect(readings()).toEqual([null, null, null, 'now'])
    expect(markers()).toEqual(['', '', '', READING_MARK])
    expect(listenRoot()).toHaveAttribute('data-voice-row', '3')
  })
})

describe("the brief's thumbs", () => {
  it("sit in BRIEFING's footer, after its sections, named by their words", async () => {
    await renderChat()
    showBrief()
    const group = within(briefing()).getByRole('group', { name: THUMBS_LABEL })
    expect(briefing().lastElementChild).toContainElement(group)
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(['▲ Useful', '▼ Not useful'])
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-pressed', 'false')
  })

  it.each<['up' | 'down', 1 | -1]>([
    ['up', 1],
    ['down', -1],
  ])('rate it %s, as %s with its state_hash, once: the thumb stays pressed and neither takes a press again', async (rating, sent) => {
    await renderChat()
    showBrief()
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS[rating]))
    })
    expect(rateRuns()).toEqual([{ hook: 'useRateBrief', variables: { state_hash: BRIEF.state_hash, rating: sent } }])
    expect(thumb(THUMB_WORDS[rating])).toHaveAttribute('aria-pressed', 'true')
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-disabled', 'true')
    expect(thumb(THUMB_WORDS.down)).toHaveAttribute('aria-disabled', 'true')
    expect(thumb(THUMB_WORDS[rating])).toBeEnabled()
    expect(within(briefing()).getByText(RATED_LINE)).toHaveAttribute('role', 'status')
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS.up))
      fireEvent.click(thumb(THUMB_WORDS.down))
    })
    expect(rateRuns()).toHaveLength(1)
  })

  it('sends one rating for two presses before the first is on its way', async () => {
    await renderChat()
    showBrief()
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS.up))
      fireEvent.click(thumb(THUMB_WORDS.down))
    })
    expect(rateRuns()).toHaveLength(1)
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('a rating kept, and one refused', () => {
  it("keeps the rating for this viewer when they come back to the chat, and rates a new brief afresh", async () => {
    const { unmount } = await renderChat()
    showBrief()
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS.down))
    })
    expect(readThemeState(RATED_KEY, RATED_STATE).value).toEqual({ brief: briefKey(BRIEF), rating: 'down' })
    unmount()
    await renderChat()
    showBrief({ ...BRIEF })
    expect(thumb(THUMB_WORDS.down)).toHaveAttribute('aria-pressed', 'true')
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-disabled', 'true')
    showBrief({ ...BRIEF, state_hash: 'brief-hash-2' })
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-disabled', 'false')
    expect(thumb(THUMB_WORDS.down)).toHaveAttribute('aria-pressed', 'false')
  })

  it('says why a rating was refused, and can be tried again', async () => {
    await renderChat()
    showBrief()
    host.setPageAction('useRateBrief', () => {
      throw new Error('Ratings are paused.')
    })
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS.up))
    })
    expect(within(briefing()).getByRole('alert')).toHaveTextContent('Ratings are paused.')
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-disabled', 'false')
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-pressed', 'false')
    host.setPageAction('useRateBrief', () => ({ ok: true }))
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS.up))
    })
    expect(rateRuns()).toHaveLength(2)
    expect(thumb(THUMB_WORDS.up)).toHaveAttribute('aria-pressed', 'true')
    expect(within(briefing()).queryByRole('alert')).toBeNull()
  })

  it("takes an answer that the route didn't keep the rating as a refusal, and leaves the brief to rate", async () => {
    await renderChat()
    showBrief()
    host.setPageAction('useRateBrief', () => ({ ok: false }))
    await act(async () => {
      fireEvent.click(thumb(THUMB_WORDS.down))
    })
    expect(within(briefing()).getByRole('alert')).toHaveTextContent(RATE_REFUSED)
    expect(thumb(THUMB_WORDS.down)).toHaveAttribute('aria-pressed', 'false')
    expect(thumb(THUMB_WORDS.down)).toHaveAttribute('aria-disabled', 'false')
    expect(readThemeState(RATED_KEY, RATED_STATE).value).toBeNull()
  })
})
